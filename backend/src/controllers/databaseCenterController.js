const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const XLSX = require('xlsx');
const { QueryTypes } = require('sequelize');
const { OAuth2Client } = require('google-auth-library');
const { sequelize } = require('../config/database');
const { User } = require('../models');
const { verifyTurnstileToken } = require('../utils/turnstile');
const {
  executeBackup,
  getMonitorStatus,
  setPaused,
  isBackupRunning,
  setBackupBlocked,
  getBackupFilePath
} = require('../services/databaseBackupScheduler');
const {
  UPLOADS_ROOT,
  runCommand: runArchiveCommand,
  extractIntegralBundle
} = require('../services/integralBackupService');

const quoteIdentifier = (value) => `"${String(value).replace(/"/g, '""')}"`;

const MODULE_RULES = [
  [/^autoevaluacion/, 'Autoevaluación'],
  [/^instrument_/, 'Formularios e instrumentos'],
  [/^plan_accion/, 'Plan de Acción'],
  [/^reporte_salida_/, 'Reportes de salida'],
  [/^user_activity_logs$/, 'Monitor de actividad'],
  [/^security_/, 'Seguridad aplicativa'],
  [/^(users|user_module_permissions)/, 'Usuarios y permisos'],
  [/^(poblacional_infraestructura|poblacional_edificaciones)/, 'Infraestructura física'],
  [/^(document|macro_proces|procesos|subprocesos|tipos_documentacion)/, 'Gestión documental'],
  [/^registros_calificados_/, 'Registros calificados y acreditación'],
  [/^estadisticas$/, 'Indicadores y estadísticas'],
  [/^(poblacional_|cantidad_total_egresados)/, 'Información poblacional'],
  [/^(saber_|resultados_saber11)/, 'Saber Pro y Saber 11'],
  [/^(ref_|georreferencia_|matriculados_ubicacion)/, 'DIVIPOLA y georreferenciación'],
  [/^recurso_humano_/, 'Talento humano'],
  [/^internacionalizacion_/, 'Internacionalización'],
  [/^gestion_informacion_cargas/, 'Importaciones y trazabilidad'],
  [/^database_backup_/, 'Copias de seguridad'],
  [/^(system_|va_equivalencias|diccionario_)/, 'Configuración']
];

const resolveModule = (tableName) => {
  const match = MODULE_RULES.find(([pattern]) => pattern.test(String(tableName || '').toLowerCase()));
  return match ? match[1] : 'Otras tablas del sistema';
};

const isSensitiveTable = (tableName) => /^(users|user_module_permissions|user_activity_logs|security_|system_settings|database_backup_|reporte_salida_|viaticos_|instrument_(responses|answers|attachments))/i.test(tableName);

const assertPublicTable = async (tableName) => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(String(tableName || ''))) return false;
  const rows = await sequelize.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name = :tableName`,
    { replacements: { tableName }, type: QueryTypes.SELECT }
  );
  return rows.length > 0;
};

const getDatabaseHealth = async (req, res) => {
  try {
    const [health] = await sequelize.query(
      `SELECT current_database() AS database_name,
              version() AS version,
              pg_database_size(current_database())::bigint AS size_bytes,
              pg_size_pretty(pg_database_size(current_database())) AS size_pretty,
              (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS table_count,
              (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database()) AS active_connections,
              now() AS checked_at`,
      { type: QueryTypes.SELECT }
    );
    return res.json({ success: true, data: { ...health, status: 'healthy' } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No fue posible consultar el estado de PostgreSQL', detail: error.message });
  }
};

const getSystemTablesCatalog = async (req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT t.table_name,
              COALESCE(s.n_live_tup, 0)::bigint AS estimated_rows,
              pg_total_relation_size(format('%I.%I', t.table_schema, t.table_name)::regclass)::bigint AS size_bytes,
              pg_size_pretty(pg_total_relation_size(format('%I.%I', t.table_schema, t.table_name)::regclass)) AS size_pretty,
              count(c.column_name)::int AS column_count,
              max(s.last_analyze) AS last_analyze,
              max(s.last_autoanalyze) AS last_autoanalyze
       FROM information_schema.tables t
       LEFT JOIN pg_stat_user_tables s ON s.schemaname = t.table_schema AND s.relname = t.table_name
       LEFT JOIN information_schema.columns c ON c.table_schema = t.table_schema AND c.table_name = t.table_name
       WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
       GROUP BY t.table_schema, t.table_name, s.n_live_tup
       ORDER BY t.table_name`,
      { type: QueryTypes.SELECT }
    );
    const data = rows.map((row) => ({
      ...row,
      module: resolveModule(row.table_name),
      sensitive: isSensitiveTable(row.table_name)
    }));
    return res.json({ success: true, data, total: data.length });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No fue posible construir el catálogo de tablas', detail: error.message });
  }
};

const exportTableData = async (req, res) => {
  try {
    const tableName = String(req.query.table || '').trim();
    const format = String(req.query.format || 'csv').toLowerCase();
    if (!(await assertPublicTable(tableName))) {
      return res.status(400).json({ success: false, message: 'La tabla solicitada no es válida' });
    }
    if (isSensitiveTable(tableName) && req.user?.role !== 'administrador') {
      return res.status(403).json({ success: false, message: 'Esta tabla contiene información restringida' });
    }
    if (!['csv', 'json', 'xlsx'].includes(format)) {
      return res.status(400).json({ success: false, message: 'Formato no permitido' });
    }

    const rawRows = await sequelize.query(`SELECT * FROM public.${quoteIdentifier(tableName)}`, { type: QueryTypes.SELECT });
    const rows = rawRows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [
      key,
      /password|token|secret|credential/i.test(key) ? '[PROTEGIDO]' : value
    ])));
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${tableName}_${stamp}.json"`);
      return res.send(JSON.stringify(rows, null, 2));
    }

    const tabularRows = rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [
      key,
      value !== null && typeof value === 'object' ? JSON.stringify(value) : value
    ])));
    const worksheet = XLSX.utils.json_to_sheet(tabularRows);
    if (format === 'xlsx') {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, tableName.slice(0, 31));
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${tableName}_${stamp}.xlsx"`);
      return res.send(buffer);
    }

    const csv = XLSX.utils.sheet_to_csv(worksheet);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${tableName}_${stamp}.csv"`);
    return res.send(`\uFEFF${csv}`);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No fue posible exportar la tabla', detail: error.message });
  }
};

const findPgDump = () => {
  const candidates = [
    process.env.PG_DUMP_PATH,
    'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe',
    'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe',
    'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe',
    'pg_dump'
  ].filter(Boolean);
  return candidates.find((candidate) => candidate === 'pg_dump' || fs.existsSync(candidate)) || 'pg_dump';
};

const findPgRestore = () => {
  const candidates = [
    process.env.PG_RESTORE_PATH,
    'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe',
    'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_restore.exe',
    'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_restore.exe',
    'pg_restore'
  ].filter(Boolean);
  return candidates.find((candidate) => candidate === 'pg_restore' || fs.existsSync(candidate)) || 'pg_restore';
};

const validateAuthorizedGoogleIdentity = async (req, res) => {
  const credential = String(req.body?.googleCredential || '').trim();
  if (!credential) {
    res.status(400).json({ success: false, message: 'Debe confirmar nuevamente su identidad con Google' });
    return false;
  }
  const googleClientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  if (!googleClientId) {
    res.status(503).json({ success: false, message: 'La confirmación con Google no está configurada en el servidor' });
    return false;
  }
  try {
    const ticket = await new OAuth2Client(googleClientId).verifyIdToken({ idToken: credential, audience: googleClientId });
    const payload = ticket.getPayload() || {};
    const verifiedEmail = String(payload.email || '').trim().toLowerCase();
    const currentEmail = String(req.user?.email || '').trim().toLowerCase();
    const issuedAt = Number(payload.iat || 0);
    const tokenAgeSeconds = Math.floor(Date.now() / 1000) - issuedAt;
    if (!payload.email_verified || !verifiedEmail || verifiedEmail !== currentEmail) {
      res.status(403).json({ success: false, message: 'La cuenta Google debe coincidir con el administrador autenticado' });
      return false;
    }
    if (!issuedAt || tokenAgeSeconds < -60 || tokenAgeSeconds > 300) {
      res.status(401).json({ success: false, message: 'La confirmación con Google expiró. Inténtelo nuevamente.' });
      return false;
    }
    const authorizedUser = await User.findByPk(req.user?.id);
    if (!authorizedUser || authorizedUser.estado !== 'activo') {
      res.status(403).json({ success: false, message: 'El usuario autorizado debe permanecer activo' });
      return false;
    }
    if (String(authorizedUser.email || '').trim().toLowerCase() !== verifiedEmail) {
      res.status(403).json({ success: false, message: 'La identidad confirmada no corresponde al usuario autorizado' });
      return false;
    }
    return true;
  } catch (_error) {
    res.status(401).json({ success: false, message: 'No fue posible confirmar la identidad con Google' });
    return false;
  }
};

const runProcess = (executable, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(executable, args, { windowsHide: true, ...options, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.on('error', reject);
  child.on('close', (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr || `El proceso terminó con código ${code}`)));
});

const validateTurnstileToken = async (req, res, expectedAction) => {
  const verification = await verifyTurnstileToken({
    token: req.body?.turnstileToken,
    remoteIp: req.ip,
    expectedAction
  });
  if (verification.success) return true;
  res.status(verification.status).json({ success: false, message: verification.message });
  return false;
};

let restoreRunning = false;
let manualDumpRunning = false;

const restoreDatabaseFile = async (dumpPath) => {
  const pgRestore = findPgRestore();
  await runProcess(pgRestore, ['--list', dumpPath]);
  await runProcess(pgRestore, [
    '--clean', '--if-exists', '--no-owner', '--no-privileges', '--exit-on-error', '--single-transaction',
    '--host', process.env.DB_HOST || 'localhost',
    '--port', String(process.env.DB_PORT || 5432),
    '--username', process.env.DB_USER,
    '--dbname', process.env.DB_NAME,
    dumpPath
  ], { env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD } });
};

const prepareUploadsReplacement = async (uploadsArchive, stagingRoot) => {
  const restoredUploads = path.join(stagingRoot, 'restored-uploads');
  const rollbackDirectory = path.join(UPLOADS_ROOT, `.restore-rollback-${crypto.randomUUID()}`);
  fs.mkdirSync(restoredUploads, { recursive: true, mode: 0o700 });
  fs.mkdirSync(rollbackDirectory, { recursive: true, mode: 0o700 });
  await runArchiveCommand('tar', ['-xzf', uploadsArchive, '--no-same-owner', '--no-same-permissions', '-C', restoredUploads]);

  const protectedNames = new Set(['temp', path.basename(stagingRoot), path.basename(rollbackDirectory)]);
  const isInternalEntry = (name) => protectedNames.has(name) || /^\.(?:restore|backup)-/.test(name);
  const previousEntries = fs.readdirSync(UPLOADS_ROOT).filter((name) => !isInternalEntry(name));
  const replacementEntries = fs.readdirSync(restoredUploads).filter((name) => !isInternalEntry(name));
  const installedEntries = [];
  const movedPreviousEntries = [];

  const rollback = () => {
    installedEntries.slice().reverse().forEach((name) => {
      const installedPath = path.join(UPLOADS_ROOT, name);
      if (fs.existsSync(installedPath)) fs.rmSync(installedPath, { recursive: true, force: true });
    });
    movedPreviousEntries.slice().reverse().forEach((name) => {
      const savedPath = path.join(rollbackDirectory, name);
      if (fs.existsSync(savedPath)) fs.renameSync(savedPath, path.join(UPLOADS_ROOT, name));
    });
    fs.rmSync(rollbackDirectory, { recursive: true, force: true });
  };

  try {
    previousEntries.forEach((name) => {
      fs.renameSync(path.join(UPLOADS_ROOT, name), path.join(rollbackDirectory, name));
      movedPreviousEntries.push(name);
    });
    replacementEntries.forEach((name) => {
      fs.renameSync(path.join(restoredUploads, name), path.join(UPLOADS_ROOT, name));
      installedEntries.push(name);
    });
  } catch (error) {
    rollback();
    throw error;
  }

  return {
    rollback,
    commit: () => {
      try {
        fs.rmSync(rollbackDirectory, { recursive: true, force: true });
      } catch (error) {
        // La restauracion ya fue confirmada. Una reserva pendiente se puede
        // depurar despues sin convertir una recuperacion correcta en fallo.
        console.warn('[database-restore] No fue posible depurar la reserva temporal:', error.message);
      }
    }
  };
};

const restoreDatabaseDump = async (req, res) => {
  const uploadedPath = req.file?.path;
  let ownsRestoreLock = false;
  let stagingRoot = '';
  let uploadsReplacement = null;
  try {
    if (restoreRunning) return res.status(409).json({ success: false, message: 'Ya existe una restauración en curso' });
    if (isBackupRunning() || manualDumpRunning) return res.status(409).json({ success: false, message: 'Espere a que finalice la copia de seguridad en curso.' });
    restoreRunning = true;
    ownsRestoreLock = true;
    setBackupBlocked(true);
    if (!(await validateTurnstileToken(req, res, 'database_restore'))) return null;
    if (!(await validateAuthorizedGoogleIdentity(req, res))) return null;
    if (!req.file || !uploadedPath) {
      return res.status(400).json({ success: false, message: 'Debe seleccionar una copia integral o .dump válida' });
    }
    const originalName = String(req.file.originalname || '').toLowerCase();
    const integral = originalName.endsWith('.siacbackup');
    const legacy = originalName.endsWith('.dump') || originalName.endsWith('.backup');
    if (!integral && !legacy) {
      return res.status(400).json({ success: false, message: 'Formato no permitido. Use .siacbackup, .dump o .backup.' });
    }

    let dumpPath = uploadedPath;
    if (integral) {
      stagingRoot = path.join(UPLOADS_ROOT, `.restore-stage-${crypto.randomUUID()}`);
      const extracted = await extractIntegralBundle(uploadedPath, stagingRoot, { pgRestorePath: findPgRestore() });
      dumpPath = extracted.dumpPath;
      uploadsReplacement = await prepareUploadsReplacement(extracted.uploadsArchive, stagingRoot);
    } else {
      const signature = Buffer.alloc(5);
      const descriptor = fs.openSync(uploadedPath, 'r');
      try { fs.readSync(descriptor, signature, 0, 5, 0); } finally { fs.closeSync(descriptor); }
      if (signature.toString('ascii') !== 'PGDMP') {
        return res.status(400).json({ success: false, message: 'El archivo no es una copia PostgreSQL válida' });
      }
    }

    try {
      await restoreDatabaseFile(dumpPath);
      uploadsReplacement?.commit();
      uploadsReplacement = null;
    } catch (error) {
      uploadsReplacement?.rollback();
      uploadsReplacement = null;
      throw error;
    }
    return res.json({
      success: true,
      message: integral
        ? 'Base de datos y archivos restaurados correctamente. Debe iniciar sesión nuevamente.'
        : 'Base de datos restaurada correctamente. Debe iniciar sesión nuevamente.'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No fue posible restaurar la copia. La transacción fue revertida.', detail: error.message });
  } finally {
    if (ownsRestoreLock) {
      restoreRunning = false;
      setBackupBlocked(false);
    }
    if (uploadedPath && fs.existsSync(uploadedPath)) {
      try { fs.unlinkSync(uploadedPath); } catch (error) { /* limpieza no crítica */ }
    }
    if (stagingRoot && fs.existsSync(stagingRoot)) {
      try { fs.rmSync(stagingRoot, { recursive: true, force: true }); } catch (error) { /* limpieza no crítica */ }
    }
  }
};

const downloadDatabaseDump = async (req, res) => {
  if (!(await validateTurnstileToken(req, res, 'database_backup'))) return null;
  if (!(await validateAuthorizedGoogleIdentity(req, res))) return null;
  if (restoreRunning || isBackupRunning() || manualDumpRunning) {
    return res.status(409).json({ success: false, message: 'Ya existe otra operación de base de datos en curso.' });
  }
  manualDumpRunning = true;
  try {
    const run = await executeBackup({ trigger: 'download', requestedBy: req.user?.id });
    const filename = run.file_name;
    const filePath = getBackupFilePath(filename);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    if (!res.headersSent) {
      return res.status(error.status || 500).json({ success: false, message: error.message || 'No fue posible generar la copia integral' });
    }
    return res.destroy(error);
  } finally {
    manualDumpRunning = false;
  }
};

const getBackupMonitor = async (_req, res) => {
  try {
    return res.json({ success: true, data: await getMonitorStatus() });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No fue posible consultar el monitor de respaldos', detail: error.message });
  }
};

const runAutomaticBackupNow = async (req, res) => {
  try {
    if (restoreRunning || manualDumpRunning || isBackupRunning()) {
      return res.status(409).json({ success: false, message: 'Ya existe una copia de seguridad en ejecución.' });
    }
    executeBackup({ trigger: 'manual', requestedBy: req.user?.id }).catch((error) => {
      console.error('[backup] Ejecución manual fallida:', error.message);
    });
    return res.status(202).json({ success: true, message: 'La copia fue iniciada y puede seguirse desde el monitor.' });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message || 'No fue posible iniciar la copia' });
  }
};

const pauseAutomaticBackups = async (req, res) => {
  try {
    return res.json({ success: true, message: 'Programación automática pausada.', data: await setPaused(true, req.user?.id) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No fue posible pausar la programación', detail: error.message });
  }
};

const resumeAutomaticBackups = async (req, res) => {
  try {
    return res.json({ success: true, message: 'Programación automática reanudada.', data: await setPaused(false, req.user?.id) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No fue posible reanudar la programación', detail: error.message });
  }
};

module.exports = {
  getDatabaseHealth,
  getSystemTablesCatalog,
  exportTableData,
  downloadDatabaseDump,
  restoreDatabaseDump,
  getBackupMonitor,
  runAutomaticBackupNow,
  pauseAutomaticBackups,
  resumeAutomaticBackups
};
