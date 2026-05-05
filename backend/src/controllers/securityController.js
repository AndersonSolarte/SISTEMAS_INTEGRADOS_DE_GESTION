const XLSX = require('xlsx');
const { Op, fn, col, literal } = require('sequelize');
const {
  User,
  UserModulePermission,
  SecurityScan,
  SecurityFinding,
  SecurityRemediationProposal,
  SecurityFindingComment
} = require('../models');
const { ROLES } = require('../constants/roles');
const { runStaticSecurityScan, getCodeWindow } = require('../services/securityScannerService');

const SECURITY_PERMISSIONS = {
  VIEW: 'seguridad_aplicativa.ver',
  SCAN: 'seguridad_aplicativa.escanear',
  FINDINGS: 'seguridad_aplicativa.ver_hallazgos',
  MANAGE: 'seguridad_aplicativa.gestionar_hallazgos',
  REMEDIATE: 'seguridad_aplicativa.analizar_remediacion',
  EXPORT: 'seguridad_aplicativa.exportar',
  CONFIGURE: 'seguridad_aplicativa.configurar'
};

const SECURITY_PERMISSION_KEYS = Object.values(SECURITY_PERMISSIONS);
const SEVERITIES = ['Critico', 'Alto', 'Medio', 'Bajo', 'Informativo'];
const STATUSES = ['Detectado', 'En analisis', 'En remediacion', 'Corregido', 'Validado', 'Cerrado'];

const isAdmin = (user) => user?.role === ROLES.ADMINISTRADOR || user?.role === ROLES.PLANEACION_ESTRATEGICA;

const hasSecurityPermission = async (user, permissionKey = SECURITY_PERMISSIONS.VIEW) => {
  if (isAdmin(user)) return true;
  const keys = permissionKey === SECURITY_PERMISSIONS.VIEW
    ? SECURITY_PERMISSION_KEYS
    : [permissionKey];
  const count = await UserModulePermission.count({
    where: { user_id: user.id, can_view: true, module_key: { [Op.in]: keys } }
  });
  return count > 0;
};

const requireSecurityPermission = (permissionKey) => async (req, res, next) => {
  try {
    if (await hasSecurityPermission(req.user, permissionKey)) return next();
    return res.status(403).json({ success: false, message: 'No tienes permiso para Gestion de Seguridad Aplicativa' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error validando permisos de seguridad aplicativa' });
  }
};

const normalizeSeverity = (value) => {
  const normalized = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized === 'critico') return 'Critico';
  if (normalized === 'alto') return 'Alto';
  if (normalized === 'medio') return 'Medio';
  if (normalized === 'bajo') return 'Bajo';
  return 'Informativo';
};

const summarizeCounts = (findings = []) => findings.reduce((acc, item) => {
  const sev = normalizeSeverity(item.severity);
  acc.total += 1;
  if (sev === 'Critico') acc.critical_count += 1;
  if (sev === 'Alto') acc.high_count += 1;
  if (sev === 'Medio') acc.medium_count += 1;
  if (sev === 'Bajo') acc.low_count += 1;
  if (sev === 'Informativo') acc.informational_count += 1;
  return acc;
}, { total: 0, critical_count: 0, high_count: 0, medium_count: 0, low_count: 0, informational_count: 0 });

const getDashboard = async (req, res) => {
  try {
    const [
      totalFindings,
      critical,
      high,
      corrected,
      pending,
      lastScan,
      bySeverity,
      byStatus,
      byComponent,
      history
    ] = await Promise.all([
      SecurityFinding.count(),
      SecurityFinding.count({ where: { severity: 'Critico' } }),
      SecurityFinding.count({ where: { severity: 'Alto' } }),
      SecurityFinding.count({ where: { status: { [Op.in]: ['Corregido', 'Validado', 'Cerrado'] } } }),
      SecurityFinding.count({ where: { status: { [Op.notIn]: ['Corregido', 'Validado', 'Cerrado'] } } }),
      SecurityScan.findOne({ order: [['started_at', 'DESC']], raw: true }),
      SecurityFinding.findAll({ attributes: ['severity', [fn('COUNT', col('id')), 'total']], group: ['severity'], raw: true }),
      SecurityFinding.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'total']], group: ['status'], raw: true }),
      SecurityFinding.findAll({ attributes: ['affected_component', [fn('COUNT', col('id')), 'total']], group: ['affected_component'], raw: true }),
      SecurityScan.findAll({
        attributes: [
          [literal(`DATE_TRUNC('day', "started_at")`), 'date'],
          [fn('SUM', col('total_findings')), 'total'],
          [fn('SUM', col('critical_count')), 'critical'],
          [fn('SUM', col('high_count')), 'high']
        ],
        group: [literal(`DATE_TRUNC('day', "started_at")`)],
        order: [[literal(`DATE_TRUNC('day', "started_at")`), 'ASC']],
        limit: 30,
        raw: true
      })
    ]);

    return res.json({
      success: true,
      data: { totalFindings, critical, high, corrected, pending, lastScan, bySeverity, byStatus, byComponent, history }
    });
  } catch (error) {
    console.error('[security.dashboard]', error);
    return res.status(500).json({ success: false, message: 'Error consultando dashboard de seguridad' });
  }
};

const listScans = async (req, res) => {
  const rows = await SecurityScan.findAll({
    include: [{ model: User, as: 'executor', attributes: ['id', 'nombre', 'email'] }],
    order: [['started_at', 'DESC']],
    limit: 80
  });
  return res.json({ success: true, data: rows });
};

const runScan = async (req, res) => {
  const startedAt = new Date();
  const scan = await SecurityScan.create({
    scan_code: `SEC-${startedAt.getFullYear()}-${Date.now().toString(36).toUpperCase()}`,
    scan_type: 'static_rules',
    status: 'running',
    started_at: startedAt,
    executed_by: req.user?.id || null
  });

  try {
    const rawFindings = runStaticSecurityScan();
    const counts = summarizeCounts(rawFindings);
    const rows = rawFindings.map((item, index) => ({
      scan_id: scan.id,
      finding_code: `${scan.scan_code}-F${String(index + 1).padStart(4, '0')}`,
      title: item.title,
      description: item.description,
      severity: normalizeSeverity(item.severity),
      status: 'Detectado',
      affected_component: item.affected_component,
      affected_file: item.affected_file,
      affected_line: item.affected_line,
      evidence: item.evidence,
      recommendation: item.recommendation,
      detected_at: startedAt
    }));
    if (rows.length) await SecurityFinding.bulkCreate(rows);
    await scan.update({
      status: 'completed',
      finished_at: new Date(),
      total_findings: counts.total,
      critical_count: counts.critical_count,
      high_count: counts.high_count,
      medium_count: counts.medium_count,
      low_count: counts.low_count,
      informational_count: counts.informational_count
    });
    return res.status(201).json({ success: true, data: scan, message: 'Escaneo de seguridad finalizado' });
  } catch (error) {
    await scan.update({ status: 'failed', finished_at: new Date() });
    console.error('[security.runScan]', error);
    return res.status(500).json({ success: false, message: 'Error ejecutando escaneo de seguridad' });
  }
};

const listFindings = async (req, res) => {
  const where = {};
  if (req.query.severity) where.severity = req.query.severity;
  if (req.query.status) where.status = req.query.status;
  if (req.query.component) where.affected_component = req.query.component;
  if (req.query.responsible_user_id) where.responsible_user_id = Number(req.query.responsible_user_id);
  if (req.query.search) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${req.query.search}%` } },
      { affected_file: { [Op.iLike]: `%${req.query.search}%` } },
      { finding_code: { [Op.iLike]: `%${req.query.search}%` } }
    ];
  }
  const rows = await SecurityFinding.findAll({
    where,
    include: [
      { model: SecurityScan, as: 'scan', attributes: ['id', 'scan_code', 'started_at'] },
      { model: User, as: 'responsible', attributes: ['id', 'nombre', 'email'] }
    ],
    order: [['detected_at', 'DESC']],
    limit: 300
  });
  return res.json({ success: true, data: rows });
};

const getFinding = async (req, res) => {
  const finding = await SecurityFinding.findByPk(req.params.id, {
    include: [
      { model: SecurityScan, as: 'scan' },
      { model: User, as: 'responsible', attributes: ['id', 'nombre', 'email'] },
      { model: SecurityRemediationProposal, as: 'remediationProposals', order: [['created_at', 'DESC']] },
      { model: SecurityFindingComment, as: 'comments', include: [{ model: User, as: 'user', attributes: ['id', 'nombre', 'email'] }] }
    ]
  });
  if (!finding) return res.status(404).json({ success: false, message: 'Hallazgo no encontrado' });
  return res.json({ success: true, data: finding });
};

const updateStatus = async (req, res) => {
  const finding = await SecurityFinding.findByPk(req.params.id);
  if (!finding) return res.status(404).json({ success: false, message: 'Hallazgo no encontrado' });
  const status = STATUSES.includes(req.body.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ success: false, message: 'Estado invalido' });
  await finding.update({ status, closed_at: ['Validado', 'Cerrado'].includes(status) ? new Date() : null });
  if (req.body.comment) {
    await SecurityFindingComment.create({ finding_id: finding.id, user_id: req.user.id, comment: String(req.body.comment).slice(0, 4000) });
  }
  return res.json({ success: true, data: finding, message: 'Estado actualizado' });
};

const assignFinding = async (req, res) => {
  const finding = await SecurityFinding.findByPk(req.params.id);
  if (!finding) return res.status(404).json({ success: false, message: 'Hallazgo no encontrado' });
  const userId = Number(req.body.responsible_user_id);
  const user = userId ? await User.findByPk(userId) : null;
  if (userId && !user) return res.status(404).json({ success: false, message: 'Responsable no encontrado' });
  await finding.update({ responsible_user_id: userId || null });
  return res.json({ success: true, data: finding, message: 'Responsable actualizado' });
};

const analyzeRemediation = async (req, res) => {
  const finding = await SecurityFinding.findByPk(req.params.id);
  if (!finding) return res.status(404).json({ success: false, message: 'Hallazgo no encontrado' });
  const currentCode = getCodeWindow(finding.affected_file, finding.affected_line);
  const proposedCode = [
    '// Propuesta segura pendiente de revision humana',
    '// Aplicar el cambio minimo necesario segun la recomendacion del hallazgo.',
    currentCode ? currentCode.replace(/eval\s*\(/g, '/* reemplazar eval por parser seguro */(').replace(/dangerouslySetInnerHTML/g, '/* evitar HTML crudo: usar texto o sanitizar */dangerouslySetInnerHTML') : '// No se pudo extraer contexto de codigo para este hallazgo.'
  ].join('\n');
  const proposal = await SecurityRemediationProposal.create({
    finding_id: finding.id,
    current_code: currentCode || finding.evidence,
    proposed_code: proposedCode,
    explanation: `Propuesta generada como guia de remediacion segura para "${finding.title}". No modifica archivos ni produccion.`,
    risk_mitigated: finding.description || 'Reduce la superficie de ataque identificada por el escaneo estatico.',
    functional_impact: 'Impacto esperado bajo si se aplica como cambio minimo y se valida con pruebas funcionales del modulo afectado.',
    recommended_tests: [
      'Ejecutar build de frontend y verificacion sintactica backend.',
      'Probar flujo funcional del archivo o endpoint afectado.',
      'Repetir escaneo y confirmar que el hallazgo cambie a Corregido/Validado.'
    ],
    generated_by: req.user.id
  });
  return res.status(201).json({ success: true, data: proposal, message: 'Propuesta generada para revision humana' });
};

const exportReport = async (req, res) => {
  const rows = await SecurityFinding.findAll({ include: [{ model: User, as: 'responsible', attributes: ['nombre', 'email'] }], order: [['detected_at', 'DESC']] });
  const records = rows.map((row) => ({
    ID: row.finding_code,
    Vulnerabilidad: row.title,
    Criticidad: row.severity,
    Estado: row.status,
    Componente: row.affected_component,
    Archivo: row.affected_file,
    Linea: row.affected_line,
    Responsable: row.responsible?.email || '',
    Detectado: row.detected_at,
    Cierre: row.closed_at,
    Recomendacion: row.recommendation
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(records), 'HALLAZGOS');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="informe_seguridad_aplicativa.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return res.send(buffer);
};

module.exports = {
  SECURITY_PERMISSIONS,
  SECURITY_PERMISSION_KEYS,
  requireSecurityPermission,
  getDashboard,
  listScans,
  runScan,
  listFindings,
  getFinding,
  updateStatus,
  assignFinding,
  analyzeRemediation,
  exportReport
};
