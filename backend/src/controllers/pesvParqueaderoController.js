const fs = require('fs');
const crypto = require('crypto');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const {
  PesvParqueaderoRegistro, PesvRuntValidacion, PesvSoatHistorico, PesvRtmHistorico, User
} = require('../models');
const { sequelize } = require('../config/database');
const { sendMailDirect, renderInstitutionalTemplate, escapeHtml } = require('../services/emailService');
const { evaluateRtmStatus } = require('../services/pesvRtmRules');

const EXCEL_FIELDS = {
  IDENTIFICACION: 'identificacion', NOMBRES_Y_APELLIDOS: 'nombres_apellidos', CORREO: 'correo',
  VINCULACION: 'vinculacion', DEPENDENCIA_PROGRAMA: 'dependencia_programa', CAMPUS: 'campus',
  PARQUEADERO_INGRESO: 'parqueadero_ingreso', CATEGORIA_INGRESO: 'categoria_ingreso',
  TIPO_VEHICULO: 'tipo_vehiculo', PLACA: 'placa', CURSO_PAS: 'curso_pas',
  PAGO_VALIDACION: 'pago_validacion', HORARIO: 'horario', OBSERVACIONES: 'observaciones',
  VEHICULO_CLASE: 'vehiculo_clase', VEHICULO_SERVICIO: 'vehiculo_servicio', VEHICULO_MODELO: 'vehiculo_modelo',
  FECHA_MATRICULA: 'vehiculo_fecha_matricula', SOAT_FECHA_EXPEDICION: 'soat_fecha_expedicion',
  SOAT_FECHA_INICIO: 'soat_fecha_inicio', SOAT_VIGENCIA: 'soat_vigencia', SOAT_NUMERO_POLIZA: 'soat_numero_poliza',
  SOAT_ENTIDAD: 'soat_entidad', RTM_ESTADO: 'rtm_estado', RTM_FECHA_EXPEDICION: 'rtm_fecha_expedicion',
  TECNOMECANICA_VIGENCIA: 'tecnomecanica_vigencia', RTM_FECHA_EXIGIBILIDAD: 'rtm_fecha_exigibilidad',
  RTM_NUMERO_CERTIFICADO: 'rtm_numero_certificado', RTM_CDA: 'rtm_cda'
};
const PESV_TEMPLATE_COLUMNS = [
  'IDENTIFICACION', 'NOMBRES_Y_APELLIDOS', 'CORREO', 'VINCULACION', 'DEPENDENCIA_PROGRAMA', 'CAMPUS',
  'PARQUEADERO_INGRESO', 'CATEGORIA_INGRESO', 'TIPO_VEHICULO', 'PLACA', 'CURSO_PAS', 'PAGO_VALIDACION',
  'VEHICULO_CLASE', 'VEHICULO_SERVICIO', 'VEHICULO_MODELO', 'FECHA_MATRICULA',
  'SOAT_FECHA_EXPEDICION', 'SOAT_FECHA_INICIO', 'SOAT_VIGENCIA', 'SOAT_NUMERO_POLIZA', 'SOAT_ENTIDAD',
  'RTM_ESTADO', 'RTM_FECHA_EXPEDICION', 'TECNOMECANICA_VIGENCIA', 'RTM_FECHA_EXIGIBILIDAD',
  'RTM_NUMERO_CERTIFICADO', 'RTM_CDA', 'HORARIO', 'OBSERVACIONES'
];
const RUNT_PUBLIC_URL = 'https://portalpublico.runt.gov.co/#/consulta-vehiculo/consulta/consulta-ciudadana';
const CATALOG_DEFAULTS = Object.freeze({
  vinculaciones: ['ADMINISTRATIVO', 'DOCENTE', 'ESTUDIANTE', 'CONTRATISTA', 'VISITANTE', 'EGRESADO', 'OTRO'],
  campus: ['CENTRO', 'SAN DAMIAN'],
  parqueaderos: ['PRINCIPAL', 'SAN DAMIAN', 'SAN FRANCISCO'],
  categorias: ['VEHICULO', 'MOTOCICLETA', 'BICICLETA'],
  tiposVehiculo: ['Automóvil', 'Motocicleta', 'Camioneta', 'Bicicleta', 'Otro'],
  clasesVehiculo: ['AUTOMOVIL', 'MOTOCICLETA', 'CAMIONETA', 'CAMPERO', 'MOTOCARRO', 'BICICLETA'],
  serviciosVehiculo: ['Particular', 'Público', 'Oficial'],
  estadosRtm: ['VIGENTE', 'VENCIDO', 'NO_EXIGIBLE', 'SIN_REGISTRO_RUNT', 'NO_APLICA'],
  cursosPas: ['ASISTIÓ', 'NO ASISTIÓ', 'PENDIENTE', 'NO APLICA'],
  pagosValidacion: ['PAGADO', 'DONACIÓN', 'PENDIENTE', 'NO APLICA']
});
const CATALOG_FIELD_MAP = Object.freeze({
  vinculaciones: 'vinculacion', dependencias: 'dependencia_programa', campus: 'campus', parqueaderos: 'parqueadero_ingreso',
  categorias: 'categoria_ingreso', tiposVehiculo: 'tipo_vehiculo', clasesVehiculo: 'vehiculo_clase',
  serviciosVehiculo: 'vehiculo_servicio', cursosPas: 'curso_pas', pagosValidacion: 'pago_validacion',
  aseguradoras: 'soat_entidad', centrosDiagnostico: 'rtm_cda'
});

const uniqueCatalog = (defaults, values) => [...new Set([...(defaults || []), ...(values || [])]
  .map((value) => String(value || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
const buildPesvCatalogs = (rows = []) => ({
  ...Object.fromEntries(Object.entries(CATALOG_FIELD_MAP).map(([key, field]) => [key, uniqueCatalog(CATALOG_DEFAULTS[key], rows.map((row) => row[field]))])),
  estadosRtm: [...CATALOG_DEFAULTS.estadosRtm]
});

const clean = (value, max = 500) => {
  const result = String(value ?? '').trim();
  return result ? result.slice(0, max) : null;
};
const normalizePlate = (value) => clean(value, 30)?.replace(/\s+/g, '').toUpperCase() || null;
const parseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  let match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day)) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? text : null;
};
const daysUntil = (value) => {
  if (!value) return null;
  const today = new Date();
  const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(`${value}T00:00:00Z`).getTime();
  return Number.isNaN(target) ? null : Math.ceil((target - base) / 86400000);
};
const expiryStatus = (value) => {
  const days = daysUntil(value);
  if (days === null) return { code: 'sin_fecha', label: 'Sin fecha verificable', days: null, priority: 3 };
  if (days < 0) return { code: 'vencido', label: 'Vencido', days, priority: 0 };
  if (days <= 30) return { code: 'proximo', label: 'Próximo a vencer', days, priority: 1 };
  return { code: 'vigente', label: 'Vigente', days, priority: 2 };
};
const SEARCHABLE_FIELDS = Object.freeze([
  'identificacion', 'nombres_apellidos', 'correo', 'vinculacion', 'dependencia_programa', 'campus',
  'parqueadero_ingreso', 'categoria_ingreso', 'tipo_vehiculo', 'placa', 'curso_pas', 'pago_validacion',
  'vehiculo_clase', 'vehiculo_servicio', 'vehiculo_modelo', 'soat_numero_poliza', 'soat_entidad',
  'rtm_estado', 'rtm_numero_certificado', 'rtm_cda', 'horario', 'observaciones'
]);
const normalizeSearchText = (value = '') => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9@.-]+/g, ' ').trim();
const getSearchScore = (row, rawQuery) => {
  const query = normalizeSearchText(rawQuery);
  if (!query) return 0;
  const values = Object.fromEntries(SEARCHABLE_FIELDS.map((field) => [field, normalizeSearchText(row[field])]));
  const combined = SEARCHABLE_FIELDS.map((field) => values[field]).filter(Boolean).join(' ');
  const tokens = query.split(/\s+/).filter(Boolean);
  if (!tokens.every((token) => combined.includes(token))) return -1;

  let score = tokens.reduce((total, token) => total + SEARCHABLE_FIELDS.reduce((fieldScore, field) => fieldScore + (values[field].includes(token) ? 3 : 0), 0), 0);
  if (values.placa === query) score += 140;
  if (values.identificacion === query) score += 130;
  if (values.correo === query) score += 120;
  if (values.nombres_apellidos === query) score += 110;
  if (values.placa.startsWith(query)) score += 100;
  if (values.identificacion.startsWith(query)) score += 95;
  if (values.nombres_apellidos.startsWith(query)) score += 85;
  if (values.nombres_apellidos.includes(query)) score += 70;
  if (values.dependencia_programa.includes(query)) score += 55;
  if (combined.includes(query)) score += 35;
  return score;
};
const serialize = (row) => {
  const data = row.toJSON ? row.toJSON() : row;
  const specialRtm = {
    NO_EXIGIBLE: { code: 'no_exigible', label: `RTM no exigible a la fecha${data.vehiculo_modelo ? ` · Modelo ${data.vehiculo_modelo}` : ''}`, days: daysUntil(data.rtm_fecha_exigibilidad), priority: 2 },
    SIN_REGISTRO_RUNT: { code: 'sin_registro', label: 'Sin registro en RUNT', days: null, priority: 1 },
    NO_APLICA: { code: 'no_aplica', label: 'No aplica', days: null, priority: 2 }
  }[data.rtm_estado];
  return { ...data, soat_estado: expiryStatus(data.soat_vigencia), tecnomecanica_estado: specialRtm || expiryStatus(data.tecnomecanica_vigencia) };
};
const payloadFromBody = (body = {}) => ({
  identificacion: clean(body.identificacion, 40), nombres_apellidos: clean(body.nombres_apellidos, 220),
  correo: clean(body.correo, 220)?.toLowerCase() || null, vinculacion: clean(body.vinculacion, 140),
  dependencia_programa: clean(body.dependencia_programa, 220), campus: clean(body.campus, 120),
  parqueadero_ingreso: clean(body.parqueadero_ingreso, 140), categoria_ingreso: clean(body.categoria_ingreso, 120),
  tipo_vehiculo: clean(body.tipo_vehiculo, 120), placa: normalizePlate(body.placa), curso_pas: clean(body.curso_pas, 120),
  pago_validacion: clean(body.pago_validacion, 120), soat_vigencia: parseDate(body.soat_vigencia),
  soat_vigencia_texto: clean(body.soat_vigencia || body.soat_vigencia_texto, 140),
  soat_fecha_expedicion: parseDate(body.soat_fecha_expedicion), soat_fecha_inicio: parseDate(body.soat_fecha_inicio),
  soat_numero_poliza: clean(body.soat_numero_poliza, 120), soat_entidad: clean(body.soat_entidad, 220),
  tecnomecanica_vigencia: parseDate(body.tecnomecanica_vigencia),
  tecnomecanica_vigencia_texto: clean(body.tecnomecanica_vigencia || body.tecnomecanica_vigencia_texto || (body.rtm_estado === 'NO_EXIGIBLE' ? 'RTM no exigible a la fecha' : null), 180),
  rtm_estado: clean(body.rtm_estado, 60)?.toUpperCase().replace(/\s+/g, '_') || null,
  rtm_fecha_expedicion: parseDate(body.rtm_fecha_expedicion), rtm_fecha_exigibilidad: parseDate(body.rtm_fecha_exigibilidad),
  rtm_numero_certificado: clean(body.rtm_numero_certificado, 140), rtm_cda: clean(body.rtm_cda, 220),
  vehiculo_fecha_matricula: parseDate(body.vehiculo_fecha_matricula), vehiculo_clase: clean(body.vehiculo_clase, 120),
  vehiculo_servicio: clean(body.vehiculo_servicio, 120), vehiculo_modelo: clean(body.vehiculo_modelo, 20),
  horario: clean(body.horario, 180), observaciones: clean(body.observaciones, 4000)
});
const validate = (payload) => {
  const errors = [];
  if (!payload.nombres_apellidos) errors.push('Los nombres y apellidos son obligatorios');
  if (payload.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.correo)) errors.push('El correo no es válido');
  return errors;
};

const list = async (req, res) => {
  try {
    const search = clean(req.query.search, 120);
    const where = {};
    if (req.query.campus) where.campus = req.query.campus;
    if (req.query.parqueadero) where.parqueadero_ingreso = req.query.parqueadero;
    const [rows, catalogRows] = await Promise.all([
      PesvParqueaderoRegistro.findAll({ where, order: [['soat_vigencia', 'ASC NULLS LAST'], ['nombres_apellidos', 'ASC']] }),
      PesvParqueaderoRegistro.findAll({ attributes: [...new Set(Object.values(CATALOG_FIELD_MAP))], raw: true })
    ]);
    let data = rows.map(serialize);
    if (search) data = data.map((row) => ({ ...row, _searchScore: getSearchScore(row, search) })).filter((row) => row._searchScore >= 0);
    const summary = {
      total: data.length,
      vehiculos: data.filter((r) => r.placa).length,
      soat_vencidos: data.filter((r) => r.soat_estado.code === 'vencido').length,
      soat_proximos: data.filter((r) => r.soat_estado.code === 'proximo').length,
      tecnomecanica_vencidos: data.filter((r) => r.tecnomecanica_estado.code === 'vencido').length,
      tecnomecanica_proximos: data.filter((r) => r.tecnomecanica_estado.code === 'proximo').length
    };
    const estado = clean(req.query.estado, 30);
    if (estado) data = data.filter((row) => row.soat_estado.code === estado || row.tecnomecanica_estado.code === estado);
    const indicador = clean(req.query.indicador, 30);
    if (indicador === 'soat_vencido') data = data.filter((row) => row.soat_estado.code === 'vencido');
    if (indicador === 'soat_proximo') data = data.filter((row) => row.soat_estado.code === 'proximo');
    if (indicador === 'rtm_vencido') data = data.filter((row) => row.tecnomecanica_estado.code === 'vencido');
    if (indicador === 'rtm_proximo') data = data.filter((row) => row.tecnomecanica_estado.code === 'proximo');
    if (indicador === 'rtm_alerta') data = data.filter((row) => ['vencido', 'proximo'].includes(row.tecnomecanica_estado.code));
    data.sort((a, b) => search
      ? b._searchScore - a._searchScore || String(a.nombres_apellidos || '').localeCompare(String(b.nombres_apellidos || ''), 'es')
      : Math.min(a.soat_estado.priority, a.tecnomecanica_estado.priority) - Math.min(b.soat_estado.priority, b.tecnomecanica_estado.priority) || (a.soat_estado.days ?? 99999) - (b.soat_estado.days ?? 99999));
    data = data.map(({ _searchScore, ...row }) => row);
    res.json({ success: true, data, summary, catalogs: buildPesvCatalogs(catalogRows) });
  } catch (error) {
    console.error('Error consultando registros PESV:', error);
    res.status(500).json({ success: false, message: 'No se pudieron consultar los registros de parqueaderos' });
  }
};

const create = async (req, res) => {
  const payload = payloadFromBody(req.body); const errors = validate(payload);
  if (errors.length) return res.status(400).json({ success: false, message: errors.join('. ') });
  try { const row = await PesvParqueaderoRegistro.create({ ...payload, creado_por: req.user?.id, actualizado_por: req.user?.id }); return res.status(201).json({ success: true, data: serialize(row) }); }
  catch (error) { return res.status(500).json({ success: false, message: 'No se pudo crear el registro' }); }
};
const update = async (req, res) => {
  const payload = payloadFromBody(req.body); const errors = validate(payload);
  if (errors.length) return res.status(400).json({ success: false, message: errors.join('. ') });
  try { const row = await PesvParqueaderoRegistro.findByPk(req.params.id); if (!row) return res.status(404).json({ success: false, message: 'Registro no encontrado' }); await row.update({ ...payload, actualizado_por: req.user?.id }); return res.json({ success: true, data: serialize(row) }); }
  catch (error) { return res.status(500).json({ success: false, message: 'No se pudo actualizar el registro' }); }
};
const remove = async (req, res) => {
  try { const deleted = await PesvParqueaderoRegistro.destroy({ where: { id: req.params.id } }); if (!deleted) return res.status(404).json({ success: false, message: 'Registro no encontrado' }); return res.json({ success: true, message: 'Registro eliminado' }); }
  catch (error) { return res.status(500).json({ success: false, message: 'No se pudo eliminar el registro' }); }
};

const isExpired = (session) => !session?.expira_en || new Date(session.expira_en).getTime() < Date.now();
const normalizeExternalStatus = (value, fallback = 'SIN_INFORMACION') => clean(value, 60)?.toUpperCase().replace(/\s+/g, '_') || fallback;
const sanitizeSourceRecord = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value).slice(0, 40).reduce((acc, [key, fieldValue]) => ({
    ...acc,
    [clean(key, 80) || 'campo']: clean(fieldValue, 500)
  }), {});
};
const normalizeRuntPayload = (body = {}) => {
  const soatInput = body.soat && typeof body.soat === 'object' ? body.soat : null;
  const rtmInput = body.rtm && typeof body.rtm === 'object' ? body.rtm : null;
  const soat = soatInput ? {
    estado: normalizeExternalStatus(soatInput.estado),
    fecha_expedicion: parseDate(soatInput.fecha_expedicion),
    fecha_inicio: parseDate(soatInput.fecha_inicio),
    fecha_fin: parseDate(soatInput.fecha_fin),
    numero_poliza: clean(soatInput.numero_poliza, 120),
    entidad: clean(soatInput.entidad, 220),
    codigo_tarifa: clean(soatInput.codigo_tarifa, 80),
    datos_fuente: sanitizeSourceRecord(soatInput.datos_fuente || soatInput)
  } : null;
  const rawVigente = rtmInput?.vigente;
  const rtm = rtmInput ? {
    estado: normalizeExternalStatus(rtmInput.estado || (rawVigente === true || String(rawVigente).toUpperCase() === 'SI' ? 'VIGENTE' : 'SIN_INFORMACION')),
    vigente: rawVigente === true || ['SI', 'SÍ', 'VIGENTE'].includes(String(rawVigente || '').trim().toUpperCase())
      ? true
      : rawVigente === false || ['NO', 'NO_VIGENTE', 'VENCIDO'].includes(String(rawVigente || '').trim().toUpperCase()) ? false : null,
    tipo_revision: clean(rtmInput.tipo_revision, 180),
    fecha_expedicion: parseDate(rtmInput.fecha_expedicion),
    fecha_vigencia: parseDate(rtmInput.fecha_vigencia),
    numero_certificado: clean(rtmInput.numero_certificado, 140),
    cda: clean(rtmInput.cda, 220),
    datos_fuente: sanitizeSourceRecord(rtmInput.datos_fuente || rtmInput)
  } : null;
  const vehicleInput = body.vehiculo && typeof body.vehiculo === 'object' ? body.vehiculo : {};
  const vehiculo = {
    fecha_matricula: parseDate(vehicleInput.fecha_matricula),
    clase: clean(vehicleInput.clase, 120),
    servicio: clean(vehicleInput.servicio, 120),
    modelo: clean(vehicleInput.modelo, 20),
    rtm_fecha_exigibilidad: parseDate(vehicleInput.rtm_fecha_exigibilidad)
  };
  return {
    soat, rtm, vehiculo,
    capturado_en: new Date().toISOString(),
    pagina_origen: clean(body.pagina_origen, 500)
  };
};
const getConsolidatedStatus = (soat, rtm) => {
  const soatOk = soat?.estado === 'VIGENTE';
  const soatBad = soat && ['VENCIDO', 'NO_VIGENTE'].includes(soat.estado);
  const rtmOk = rtm?.vigente === true || rtm?.estado === 'VIGENTE';
  const rtmBad = rtm?.vigente === false || ['VENCIDO', 'NO_VIGENTE'].includes(rtm?.estado);
  if (soatBad && rtmBad) return 'NO_CUMPLE_SOAT_RTM';
  if (soatBad) return 'NO_CUMPLE_SOAT';
  if (rtmBad) return 'NO_CUMPLE_RTM';
  if (soatOk && (rtmOk || ['NO_APLICA', 'NO_EXIGIBLE'].includes(rtm?.estado))) return 'CUMPLE';
  return 'REVISAR';
};

const startRuntValidation = async (req, res) => {
  try {
    const record = await PesvParqueaderoRegistro.findByPk(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    if (!record.placa || !record.identificacion) return res.status(400).json({ success: false, message: 'La consulta RUNT requiere placa e identificación' });
    await PesvRuntValidacion.update({ estado: 'CANCELADA' }, {
      where: { parqueadero_registro_id: record.id, estado: { [Op.in]: ['PENDIENTE', 'ABIERTA'] } }
    });
    const session = await PesvRuntValidacion.create({
      parqueadero_registro_id: record.id,
      token_hash: crypto.randomBytes(32).toString('hex'),
      estado: 'PENDIENTE',
      expira_en: new Date(Date.now() + 20 * 60 * 1000),
      iniciada_por: req.user.id
    });
    const runtUrl = RUNT_PUBLIC_URL;
    return res.status(201).json({ success: true, data: { id: session.id, runtUrl, estado: session.estado, expira_en: session.expira_en } });
  } catch (error) {
    console.error('Error al iniciar validación RUNT:', error);
    return res.status(500).json({ success: false, message: 'No se pudo iniciar la validación RUNT' });
  }
};

const captureManualRuntResult = async (req, res) => {
  try {
    const session = await PesvRuntValidacion.findByPk(req.params.sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Validación no encontrada' });
    if (session.iniciada_por !== req.user.id && req.user.role !== 'administrador') return res.status(403).json({ success: false, message: 'No tienes acceso a esta validación' });
    if (!['PENDIENTE', 'ABIERTA'].includes(session.estado)) return res.status(409).json({ success: false, message: 'La validación no admite cambios' });
    if (isExpired(session)) { await session.update({ estado: 'CANCELADA', error_detalle: 'Sesión expirada' }); return res.status(410).json({ success: false, message: 'La sesión expiró. Inicia una nueva consulta.' }); }

    const soatDate = parseDate(req.body?.soat_fecha_fin);
    const rawRtmSituation = String(req.body?.rtm_aplica || 'SI').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    const rtmSituacion = rawRtmSituation.includes('NO_EXIGIBLE') ? 'NO_EXIGIBLE'
      : rawRtmSituation.includes('SIN_REGISTRO') ? 'SIN_REGISTRO_RUNT'
        : rawRtmSituation === 'NO' || rawRtmSituation.includes('NO_APLICA') ? 'NO_APLICA' : 'SI';
    const submittedRtmDate = parseDate(req.body?.rtm_fecha_vigencia);
    const rtmConVigencia = rtmSituacion === 'SI' || Boolean(submittedRtmDate);
    const rtmDate = rtmConVigencia ? submittedRtmDate : null;
    const rtmEvaluation = evaluateRtmStatus({
      registrationDate: parseDate(req.body?.vehiculo_fecha_matricula),
      vehicleClass: req.body?.vehiculo_clase,
      service: req.body?.vehiculo_servicio,
      latestCertificateExpiry: rtmDate
    });
    const verifiedRtmSituation = rtmConVigencia || rtmSituacion === 'NO_APLICA'
      ? rtmSituacion
      : ['NO_EXIGIBLE', 'SIN_REGISTRO_RUNT'].includes(rtmEvaluation.status) ? rtmEvaluation.status : rtmSituacion;
    if (!soatDate) return res.status(400).json({ success: false, message: 'Registra la fecha final de vigencia del SOAT consultada en RUNT' });
    if (rtmConVigencia && !rtmDate) return res.status(400).json({ success: false, message: 'Registra la vigencia de la tecnomecánica o selecciona la situación informada por RUNT' });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const statusFor = (date) => new Date(`${date}T00:00:00`).getTime() < today.getTime() ? 'VENCIDO' : 'VIGENTE';
    const result = normalizeRuntPayload({
      soat: {
        estado: statusFor(soatDate), fecha_fin: soatDate,
        numero_poliza: req.body?.soat_numero_poliza, entidad: req.body?.soat_entidad,
        datos_fuente: { metodo: 'REGISTRO_MANUAL', verificado_por: req.user.email || req.user.id }
      },
      rtm: rtmConVigencia ? {
        estado: statusFor(rtmDate), vigente: statusFor(rtmDate) === 'VIGENTE', fecha_vigencia: rtmDate,
        numero_certificado: req.body?.rtm_numero_certificado, cda: req.body?.rtm_cda,
        datos_fuente: { metodo: 'REGISTRO_MANUAL', verificado_por: req.user.email || req.user.id }
      } : {
        estado: verifiedRtmSituation, vigente: null,
        datos_fuente: { metodo: 'REGISTRO_MANUAL', verificado_por: req.user.email || req.user.id }
      },
      vehiculo: {
        fecha_matricula: req.body?.vehiculo_fecha_matricula,
        clase: req.body?.vehiculo_clase,
        servicio: req.body?.vehiculo_servicio,
        modelo: req.body?.vehiculo_modelo,
        rtm_fecha_exigibilidad: rtmEvaluation.firstDueDate || req.body?.rtm_fecha_exigibilidad
      },
      pagina_origen: 'REGISTRO_MANUAL_SIAC'
    });
    await session.update({ estado: 'CAPTURADA', resultado: result, pagina_origen: result.pagina_origen, capturada_en: new Date() });
    return res.json({ success: true, message: 'Fechas RUNT cargadas para revisión', data: { ...session.toJSON(), token_hash: undefined } });
  } catch (error) { return res.status(500).json({ success: false, message: 'No se pudo registrar el resultado consultado' }); }
};

const getRuntValidation = async (req, res) => {
  try {
    const session = await PesvRuntValidacion.findByPk(req.params.sessionId, { include: [{ model: PesvParqueaderoRegistro, as: 'registroParqueadero' }] });
    if (!session) return res.status(404).json({ success: false, message: 'Validación no encontrada' });
    if (session.iniciada_por !== req.user.id && req.user.role !== 'administrador') return res.status(403).json({ success: false, message: 'No tienes acceso a esta validación' });
    return res.json({ success: true, data: { ...session.toJSON(), token_hash: undefined } });
  } catch (error) { return res.status(500).json({ success: false, message: 'No se pudo consultar el estado de validación' }); }
};

const confirmRuntValidation = async (req, res) => {
  try {
    const session = await PesvRuntValidacion.findByPk(req.params.sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Validación no encontrada' });
    if (session.iniciada_por !== req.user.id && req.user.role !== 'administrador') return res.status(403).json({ success: false, message: 'No tienes acceso a esta validación' });
    if (session.estado !== 'CAPTURADA') return res.status(409).json({ success: false, message: 'La validación aún no tiene un resultado para confirmar' });
    const result = session.resultado || {}; const soat = result.soat; const rtm = result.rtm; const vehiculo = result.vehiculo || {};
    const consolidated = getConsolidatedStatus(soat, rtm);
    await sequelize.transaction(async (transaction) => {
      const record = await PesvParqueaderoRegistro.findByPk(session.parqueadero_registro_id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!record) throw new Error('Registro de parqueadero no encontrado');
      if (soat) await PesvSoatHistorico.create({ validacion_id: session.id, parqueadero_registro_id: record.id, ...soat }, { transaction });
      if (rtm) await PesvRtmHistorico.create({ validacion_id: session.id, parqueadero_registro_id: record.id, ...rtm }, { transaction });
      await record.update({
        ...(soat ? { soat_estado: soat.estado, soat_fecha_expedicion: soat.fecha_expedicion, soat_fecha_inicio: soat.fecha_inicio, soat_vigencia: soat.fecha_fin, soat_vigencia_texto: soat.fecha_fin, soat_numero_poliza: soat.numero_poliza, soat_entidad: soat.entidad } : {}),
        ...(rtm ? { rtm_estado: rtm.estado, tecnomecanica_vigencia: rtm.fecha_vigencia, tecnomecanica_vigencia_texto: rtm.fecha_vigencia || (rtm.estado === 'NO_EXIGIBLE' ? 'RTM no exigible a la fecha' : rtm.estado === 'SIN_REGISTRO_RUNT' ? 'Sin registro en RUNT' : 'No aplica'), rtm_fecha_expedicion: rtm.fecha_expedicion, rtm_numero_certificado: rtm.numero_certificado, rtm_cda: rtm.cda } : {}),
        vehiculo_fecha_matricula: vehiculo.fecha_matricula, vehiculo_clase: vehiculo.clase,
        vehiculo_servicio: vehiculo.servicio, vehiculo_modelo: vehiculo.modelo,
        rtm_fecha_exigibilidad: vehiculo.rtm_fecha_exigibilidad,
        ultima_consulta_runt: new Date(), estado_validacion_runt: consolidated, actualizado_por: req.user.id
      }, { transaction });
      await session.update({ estado: 'CONFIRMADA', confirmada_en: new Date(), confirmada_por: req.user.id }, { transaction });
    });
    return res.json({ success: true, message: 'Información RUNT confirmada y almacenada en el histórico', data: { estado_validacion: consolidated } });
  } catch (error) { return res.status(500).json({ success: false, message: 'No se pudo confirmar la validación RUNT' }); }
};

const getRuntHistory = async (req, res) => {
  try {
    const rows = await PesvRuntValidacion.findAll({
      where: { parqueadero_registro_id: req.params.id, estado: 'CONFIRMADA' },
      attributes: { exclude: ['token_hash'] },
      include: [
        { model: PesvSoatHistorico, as: 'soat' }, { model: PesvRtmHistorico, as: 'rtm' },
        { model: User, as: 'usuarioConfirma', attributes: ['id', 'nombre', 'email'] }
      ],
      order: [['confirmada_en', 'DESC']]
    });
    return res.json({ success: true, data: rows });
  } catch (error) { return res.status(500).json({ success: false, message: 'No se pudo consultar el histórico RUNT' }); }
};

const downloadExcelTemplate = async (req, res) => {
  try {
    const rows = await PesvParqueaderoRegistro.findAll({ attributes: [...new Set(Object.values(CATALOG_FIELD_MAP))], raw: true });
    const catalogs = buildPesvCatalogs(rows);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIAC UNICESMAG';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('BASE UNIFICADA', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = PESV_TEMPLATE_COLUMNS.map((header) => ({ header, key: header, width: Math.max(16, Math.min(30, header.length + 3)) }));
    sheet.autoFilter = { from: 'A1', to: `${sheet.getColumn(PESV_TEMPLATE_COLUMNS.length).letter}1` };
    sheet.getRow(1).height = 28;
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173B72' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });

    const listSheet = workbook.addWorksheet('LISTAS');
    const validationMap = {
      VINCULACION: catalogs.vinculaciones, DEPENDENCIA_PROGRAMA: catalogs.dependencias, CAMPUS: catalogs.campus,
      PARQUEADERO_INGRESO: catalogs.parqueaderos, CATEGORIA_INGRESO: catalogs.categorias,
      TIPO_VEHICULO: catalogs.tiposVehiculo, VEHICULO_CLASE: catalogs.clasesVehiculo,
      VEHICULO_SERVICIO: catalogs.serviciosVehiculo, CURSO_PAS: catalogs.cursosPas,
      PAGO_VALIDACION: catalogs.pagosValidacion, SOAT_ENTIDAD: catalogs.aseguradoras,
      RTM_ESTADO: catalogs.estadosRtm, RTM_CDA: catalogs.centrosDiagnostico
    };
    Object.entries(validationMap).forEach(([header, options], listIndex) => {
      const listColumn = listIndex + 1;
      listSheet.getCell(1, listColumn).value = header;
      options.forEach((option, optionIndex) => { listSheet.getCell(optionIndex + 2, listColumn).value = option; });
      const dataColumn = PESV_TEMPLATE_COLUMNS.indexOf(header) + 1;
      if (!dataColumn || options.length === 0) return;
      const letter = listSheet.getColumn(listColumn).letter;
      for (let rowIndex = 2; rowIndex <= 1001; rowIndex += 1) {
        sheet.getCell(rowIndex, dataColumn).dataValidation = {
          type: 'list', allowBlank: true, errorStyle: 'stop', showErrorMessage: true,
          errorTitle: 'Valor no permitido', error: 'Seleccione un valor de la lista desplegable.',
          formulae: [`LISTAS!$${letter}$2:$${letter}$${options.length + 1}`]
        };
      }
    });
    listSheet.state = 'veryHidden';

    ['FECHA_MATRICULA', 'SOAT_FECHA_EXPEDICION', 'SOAT_FECHA_INICIO', 'SOAT_VIGENCIA', 'RTM_FECHA_EXPEDICION', 'TECNOMECANICA_VIGENCIA', 'RTM_FECHA_EXIGIBILIDAD'].forEach((header) => {
      const column = sheet.getColumn(PESV_TEMPLATE_COLUMNS.indexOf(header) + 1);
      column.numFmt = 'yyyy-mm-dd';
    });

    const instructions = workbook.addWorksheet('INSTRUCCIONES');
    instructions.columns = [{ header: 'CAMPO', key: 'campo', width: 30 }, { header: 'INDICACIÓN', key: 'indicacion', width: 100 }];
    instructions.addRows([
      { campo: 'NOMBRES_Y_APELLIDOS', indicacion: 'Obligatorio. Nombre completo de la persona asignada al cupo.' },
      { campo: 'LISTAS DESPLEGABLES', indicacion: 'En las columnas categóricas seleccione uno de los valores disponibles.' },
      { campo: 'FECHAS', indicacion: 'Utilice el formato AAAA-MM-DD.' },
      { campo: 'RTM_ESTADO', indicacion: 'Seleccione VIGENTE, VENCIDO, NO_EXIGIBLE, SIN_REGISTRO_RUNT o NO_APLICA.' },
      { campo: 'IMPORTACIÓN', indicacion: 'La importación reemplaza la base actual. Revise el archivo antes de cargarlo.' }
    ]);
    instructions.getRow(1).eachCell((cell) => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173B72' } }; });

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Plantilla_Parqueaderos_PESV_UNICESMAG.xlsx"');
    return res.send(Buffer.from(buffer));
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No se pudo generar la plantilla Excel' });
  }
};

const importExcel = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Debes adjuntar el archivo Excel' });
  try {
    const workbook = XLSX.readFile(req.file.path, { cellDates: true });
    const sheet = workbook.Sheets['BASE UNIFICADA'] || workbook.Sheets[workbook.SheetNames[0]];
    const inputRows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
    const warnings = [];
    const rows = inputRows.map((source, index) => {
      const mapped = Object.entries(EXCEL_FIELDS).reduce((acc, [column, field]) => ({ ...acc, [field]: source[column] }), {});
      if (!mapped.nombres_apellidos && mapped.identificacion) {
        mapped.nombres_apellidos = 'SIN NOMBRE REGISTRADO';
        warnings.push({ fila: index + 2, campo: 'NOMBRES_Y_APELLIDOS', detalle: 'Registro conservado sin nombre en el archivo fuente' });
      }
      if (mapped.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(mapped.correo)) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(mapped.curso_pas || ''))) {
        warnings.push({ fila: index + 2, detalle: 'Columnas desplazadas detectadas; se recuperaron correo y placa' });
        mapped.correo = mapped.curso_pas;
        mapped.curso_pas = source.CORREO;
        if (/autom[oó]vil|motocicleta/i.test(String(source.PLACA || '')) && source.SOAT_VIGENCIA) {
          mapped.tipo_vehiculo = source.PLACA;
          mapped.placa = source.SOAT_VIGENCIA;
          mapped.soat_vigencia = null;
          mapped.soat_vigencia_texto = null;
        }
      }
      mapped.soat_vigencia = source.SOAT_VIGENCIA; mapped.soat_vigencia_texto = source.SOAT_VIGENCIA;
      if (mapped.placa !== source.PLACA) { mapped.soat_vigencia = null; mapped.soat_vigencia_texto = null; }
      mapped.tecnomecanica_vigencia = source.TECNOMECANICA_VIGENCIA; mapped.tecnomecanica_vigencia_texto = source.TECNOMECANICA_VIGENCIA;
      const payload = payloadFromBody(mapped);
      const errors = validate(payload);
      if (errors.length) { warnings.push({ fila: index + 2, detalle: errors.join('. ') }); return null; }
      if (source.SOAT_VIGENCIA && !payload.soat_vigencia) warnings.push({ fila: index + 2, campo: 'SOAT_VIGENCIA', valor: source.SOAT_VIGENCIA, detalle: 'Fecha no verificable' });
      if (source.TECNOMECANICA_VIGENCIA && !payload.tecnomecanica_vigencia) warnings.push({ fila: index + 2, campo: 'TECNOMECANICA_VIGENCIA', valor: source.TECNOMECANICA_VIGENCIA, detalle: 'Fecha no verificable' });
      return { ...payload, creado_por: req.user?.id, actualizado_por: req.user?.id };
    }).filter(Boolean);
    await sequelize.transaction(async (transaction) => {
      if (String(req.body?.replace || 'true') !== 'false') await PesvParqueaderoRegistro.destroy({ where: {}, transaction });
      if (rows.length) await PesvParqueaderoRegistro.bulkCreate(rows, { transaction });
    });
    return res.json({ success: true, message: `${rows.length} registros importados`, data: { imported: rows.length, omitted: inputRows.length - rows.length, warnings: warnings.slice(0, 100), warningCount: warnings.length } });
  } catch (error) { return res.status(400).json({ success: false, message: `No se pudo importar el archivo: ${error.message}` }); }
  finally { if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => {}); }
};

const notifyExpiry = async (req, res) => {
  try {
    const row = await PesvParqueaderoRegistro.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    if (!row.correo) return res.status(400).json({ success: false, message: 'El registro no tiene correo electrónico' });
    const documentType = req.body?.tipo === 'tecnomecanica' ? 'tecnomecánica' : 'SOAT';
    const field = documentType === 'SOAT' ? 'soat_vigencia' : 'tecnomecanica_vigencia';
    const date = row[field]; const status = expiryStatus(date);
    if (!date) return res.status(400).json({ success: false, message: `No existe una fecha verificable de ${documentType}` });
    const dateLabel = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
    const remainingDaysLabel = `${status.days} ${Math.abs(status.days) === 1 ? 'día' : 'días'}`;
    const statusText = status.code === 'vencido' ? `se encuentra vencido desde el ${dateLabel}` : `vence el ${dateLabel} (${remainingDaysLabel})`;
    const body = `<p>Saludo cordial, <strong>${escapeHtml(row.nombres_apellidos)}</strong>.</p><p>Desde el Plan Estratégico de Seguridad Vial de UNICESMAG informamos que el documento <strong>${escapeHtml(documentType)}</strong> asociado al vehículo de placa <strong>${escapeHtml(row.placa || 'sin placa registrada')}</strong> ${escapeHtml(statusText)}.</p><p>Le agradecemos realizar la renovación y actualizar oportunamente la información institucional.</p>`;
    const senderHtml = `
      <p style="margin: 0; font-weight: bold; color: #0b3a6f;">Seguridad y Salud en el Trabajo</p>
      <p style="margin: 2px 0 0 0; font-size: 11.5px; color: #64748b;">Plan Estratégico de Seguridad Vial · UNICESMAG</p>
      <p style="margin: 2px 0 0 0; font-size: 11.5px; color: #64748b;">Hombres nuevos para tiempos nuevos</p>
    `;
    const threadId = `<pesv-parqueadero-${row.id}@unicesmag.edu.co>`;
    const subject = `[PESV UNICESMAG] Vigencias Documentales · Placa ${row.placa || row.identificacion || 'Vehículo'}`;
    const result = await sendMailDirect({
      to: row.correo,
      subject,
      inReplyTo: threadId,
      references: threadId,
      headers: {
        'In-Reply-To': threadId,
        'References': threadId
      },
      text: `Saludo cordial, ${row.nombres_apellidos}. Su ${documentType} asociado a la placa ${row.placa || 'sin placa'} ${statusText}. Por favor realice la renovación y actualice la información. Fraternalmente, Seguridad y Salud en el Trabajo, Plan Estratégico de Seguridad Vial de UNICESMAG.`,
      html: renderInstitutionalTemplate({ title: `Aviso de vigencia ${documentType}`, introHtml: '', bodyHtml: body, senderHtml })
    });
    if (!result.success) return res.status(503).json({ success: false, message: `No se pudo enviar el correo: ${result.error}` });
    const notificationField = documentType === 'SOAT' ? 'ultima_notificacion_soat' : 'ultima_notificacion_tecnomecanica';
    await row.update({ [notificationField]: new Date(), actualizado_por: req.user?.id });
    return res.json({ success: true, message: `Notificación de ${documentType} enviada a ${row.correo}` });
  } catch (error) { return res.status(500).json({ success: false, message: 'No se pudo enviar la notificación' }); }
};

module.exports = {
  list, create, update, remove, importExcel, downloadExcelTemplate, notifyExpiry,
  startRuntValidation, captureManualRuntResult, getRuntValidation,
  confirmRuntValidation, getRuntHistory
};
