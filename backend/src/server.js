const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const multer = require('multer');
const fs = require('fs');
const { sequelize, testConnection } = require('./config/database');
const {
  corsOptions,
  apiLimiter,
  authLimiter,
  methodGuard,
  payloadShapeGuard,
  publicLimiter,
  sqlInjectionGuard,
  sensitivePathGuard,
  noStore,
  uploadsStaticOptions
} = require('./middlewares/security');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'no-referrer' }
}));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: false, limit: process.env.URLENCODED_BODY_LIMIT || '256kb' }));
app.use(morgan('dev'));
app.use(compression());

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const cronogramasUploadsDir = path.join(uploadsDir, 'cronogramas');
if (!fs.existsSync(cronogramasUploadsDir)) {
  fs.mkdirSync(cronogramasUploadsDir, { recursive: true });
}

app.use('/uploads', express.static(uploadsDir, uploadsStaticOptions));
app.use('/api/uploads', express.static(uploadsDir, uploadsStaticOptions));

app.use('/api/auth', authLimiter);
app.use('/api/public', publicLimiter);
app.use('/api', apiLimiter, methodGuard, sensitivePathGuard, noStore, payloadShapeGuard, sqlInjectionGuard);

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/documentos', require('./routes/documentoRoutes'));
app.use('/api/favoritos', require('./routes/favoritoRoutes'));
app.use('/api', require('./routes/catalogoRoutes'));
app.use('/api/import', require('./routes/importRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/evidencias', require('./routes/evidenciaRoutes'));
app.use('/api/planeacion/gestion-informacion', require('./routes/gestionInformacionRoutes'));
app.use('/api/planeacion/plan-accion-workflow', require('./routes/planAccionWorkflowRoutes'));
app.use('/api/strategic-planning', require('./routes/strategicPlanningRoutes'));
app.use('/api/public/strategic-planning', require('./routes/publicStrategicPlanningRoutes'));
app.use('/api/autoevaluacion/instrumentos', require('./routes/instrumentosRoutes'));
app.use('/api/public/instrumentos', require('./routes/publicInstrumentosRoutes'));
app.use('/api/security', require('./routes/securityRoutes'));
app.use('/api/reporte-salida', require('./routes/reporteSalidaRoutes'));
app.use('/api/desplazamientos-viaticos', require('./routes/desplazamientoViaticosRoutes'));
app.use('/api/legalizacion-viaticos', require('./routes/legalizacionViaticosRoutes'));
app.use('/api/cronograma-movilidad', require('./routes/cronogramaMovilidadRoutes'));
app.use('/api/pesv/parqueaderos', require('./routes/pesvParqueaderoRoutes'));
app.use('/api/planeacion/gestion-informacion/saber-pro', require('./routes/saberProAnalyticsRoutes'));
app.use('/api/planeacion/gestion-informacion/saber-pro/consulta', require('./routes/consultaValidacionRoutes'));
app.use('/api/admin/activity', require('./routes/activityRoutes'));

app.get('/api/health', (req, res) => res.json({ success: true, status: 'OK' }));

const HTTP_STATUS_MESSAGES = {
  400: 'Solicitud invalida',
  401: 'No autenticado',
  403: 'Acceso denegado',
  404: 'Recurso no encontrado',
  405: 'Metodo no permitido',
  409: 'Conflicto de datos',
  413: 'Carga demasiado grande',
  415: 'Tipo de contenido no soportado',
  422: 'Entidad no procesable',
  429: 'Demasiadas solicitudes',
  500: 'Error interno del servidor',
  502: 'Puerta de enlace invalida',
  503: 'Servicio no disponible',
  504: 'Tiempo de espera agotado'
};

app.use('/api', (req, res, next) => {
  if (res.headersSent) return next();
  return res.status(404).json({
    success: false,
    status: 404,
    code: 'API_ROUTE_NOT_FOUND',
    message: HTTP_STATUS_MESSAGES[404],
    details: `No existe ${req.method} ${req.originalUrl}`
  });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxMb = Number(process.env.EXCEL_UPLOAD_MAX_MB || 500);
      return res.status(413).json({
        success: false,
        status: 413,
        code: 'LIMIT_FILE_SIZE',
        message: `El archivo supera el tamano maximo permitido para importacion (${maxMb} MB).`
      });
    }
    return res.status(400).json({
      success: false,
      status: 400,
      code: err.code || 'MULTER_ERROR',
      message: `Error de carga de archivo: ${err.message}`
    });
  }

  if (err && /archivo no permitido/i.test(String(err.message || ''))) {
    return res.status(415).json({
      success: false,
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: err.message
    });
  }

  const status = Number(err?.status || err?.statusCode) || 500;
  const safeStatus = HTTP_STATUS_MESSAGES[status] ? status : 500;
  const fallbackMessage = HTTP_STATUS_MESSAGES[safeStatus];

  return res.status(safeStatus).json({
    success: false,
    status: safeStatus,
    code: err?.code || 'UNHANDLED_ERROR',
    message: safeStatus === 500 ? fallbackMessage : (err?.message || fallbackMessage),
    details: process.env.NODE_ENV === 'production' ? undefined : String(err?.stack || err?.message || '')
  });
});

const DEFAULT_PORT = Number(process.env.PORT || 5000);
const MAX_PORT_ATTEMPTS = Number(process.env.PORT_RETRY_ATTEMPTS || 15);

const validateGoogleRuntimeConfig = () => {
  const authGoogleOnly = String(process.env.AUTH_GOOGLE_ONLY || '').toLowerCase() === 'true';
  const hasGoogleClientId = Boolean(String(process.env.GOOGLE_CLIENT_ID || '').trim());
  const hasFrontendGoogleClientId = Boolean(String(process.env.REACT_APP_GOOGLE_CLIENT_ID || '').trim());

  if (authGoogleOnly && !hasGoogleClientId) {
    console.warn('Aviso de configuracion: AUTH_GOOGLE_ONLY=true pero falta GOOGLE_CLIENT_ID en backend/.env');
  }

  if (hasFrontendGoogleClientId && hasGoogleClientId && process.env.REACT_APP_GOOGLE_CLIENT_ID !== process.env.GOOGLE_CLIENT_ID) {
    console.warn('Aviso de configuracion: GOOGLE_CLIENT_ID de backend y REACT_APP_GOOGLE_CLIENT_ID no coinciden.');
  }

  const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    ? path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
    : path.join(__dirname, '../keys/google-service-account.json');

  if (!fs.existsSync(serviceAccountPath)) {
    console.warn(`Aviso de configuracion: no existe el JSON de cuenta de servicio en ${serviceAccountPath}`);
  }
};

const startServer = (port, attempt = 0) => {
  const server = app.listen(port, () => {
    const suffix = attempt > 0 ? ` (fallback automatico tras puerto ocupado)` : '';
    console.log(`Servidor SGC iniciado en puerto ${port}${suffix}`);
  });

  server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
      const nextPort = port + 1;
      console.warn(`Puerto ${port} ocupado. Reintentando en ${nextPort}...`);
      startServer(nextPort, attempt + 1);
      return;
    }

    if (error?.code === 'EADDRINUSE') {
      console.error(`No se pudo iniciar el servidor: el puerto ${port} ya esta en uso.`);
      console.error(`Se agotaron los reintentos automaticos (${MAX_PORT_ATTEMPTS}). Ajusta PORT o libera los puertos ocupados.`);
      process.exit(1);
    }

    throw error;
  });
};

testConnection()
  .then(async () => {
    validateGoogleRuntimeConfig();
    try {
      const User = require('./models/User');
      const { DataTypes } = require('sequelize');
      await User.sync();
      try {
        await sequelize.query(`ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'prueba'`);
        console.log('[database] Rol "prueba" garantizado.');
      } catch (err) {
        console.warn('[database] Nota sobre rol "prueba":', err.message);
      }
      try {
        await sequelize.query('ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_key"');
        await sequelize.query('DROP INDEX IF EXISTS "users_email_key"');
        await sequelize.query('ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_unique"');
        await sequelize.query('DROP INDEX IF EXISTS "users_email_unique"');
        console.log('[database] Restricción de email único de usuarios eliminada.');
      } catch (err) {
        console.warn('[database] Error al remover restricciones de email único:', err.message);
      }
      const qi = sequelize.getQueryInterface();
      const usersTable = await qi.describeTable('users');
      const addUserColumn = async (column, type = DataTypes.STRING(220), defaultValue = null) => {
        if (!usersTable[column]) {
          const opts = { type, allowNull: true };
          if (defaultValue !== null) {
            opts.allowNull = false;
            opts.defaultValue = defaultValue;
          }
          await qi.addColumn('users', column, opts);
        }
      };
      await addUserColumn('dependencia');
      await addUserColumn('vicerrectoria');
      await addUserColumn('cargo');
      await addUserColumn('jefe_inmediato');
      await addUserColumn('welcome_email_sent', DataTypes.BOOLEAN, false);
      
      // Marcar de forma retroactiva a los usuarios ya registrados y activos que ya ingresaron o son de sistema
      try {
        await sequelize.query(`
          UPDATE "users" 
          SET "welcome_email_sent" = true 
          WHERE "last_login" IS NOT NULL 
             OR "email" = 'sgc@unicesmag.edu.co' 
             OR "username" = '2744' 
             OR "email" = 'admin@sgc.com'
        `);
        console.log('[users] Estado retroactivo de correos enviados listo.');
      } catch (err) {
        console.warn('[users] No se pudo actualizar de forma retroactiva welcome_email_sent:', err.message);
      }
      console.log('[users] Columnas de perfil laboral y notificaciones listas.');
    } catch (e) {
      console.warn('[users] No se pudo sincronizar columnas de perfil laboral:', e?.message);
    }
    try {
      const { DataTypes } = require('sequelize');
      const CronogramaMovilidadActividad = require('./models/CronogramaMovilidadActividad');
      const qi = sequelize.getQueryInterface();
      await CronogramaMovilidadActividad.sync();
      const actTable = await qi.describeTable('cronograma_movilidad_actividades');
      const addActColumn = async (column, type, defaultValue = null) => {
        if (!actTable[column]) {
          const opts = { type, allowNull: true };
          if (defaultValue !== null) {
            opts.defaultValue = defaultValue;
          }
          await qi.addColumn('cronograma_movilidad_actividades', column, opts);
        }
      };
      await addActColumn('hora_salida', DataTypes.STRING(20), '06:00 AM');
      await addActColumn('hora_regreso', DataTypes.STRING(20), '06:00 PM');
      await addActColumn('requiere_viaticos', DataTypes.BOOLEAN, true);
      await addActColumn('alojamiento', DataTypes.STRING(100), 'Hotel / Hospedaje en destino');
      await addActColumn('transporte', DataTypes.STRING(100), 'Terrestre Intermunicipal');
      await addActColumn('entidad_destino', DataTypes.STRING(255), '');
      console.log('[cronograma-movilidad] Columnas de viáticos, horarios y entidad_destino listas.');
    } catch (err) {
      console.warn('[cronograma-movilidad] Error al sincronizar columnas de actividades:', err?.message);
    }
    try {
      const PlanAccion = require('./models/PlanAccion');
      await PlanAccion.sync();
      console.log('[gestion-informacion] Tabla plan_accion lista.');
    } catch (e) {
      console.warn('[gestion-informacion] No se pudo sincronizar plan_accion:', e?.message);
    }
    try {
      const { syncStrategicPlanningModels, ensureStrategicPlanningDefaults } = require('./services/strategicPlanningBootstrap');
      await syncStrategicPlanningModels();
      await ensureStrategicPlanningDefaults();
      const { startStrategicPlanningSyncWorker } = require('./services/strategicPlanningDriveService');
      startStrategicPlanningSyncWorker();
      console.log('[planeacion-estrategica] Nueva plataforma parametrizable lista.');
    } catch (e) {
      console.warn('[planeacion-estrategica] No se pudo inicializar la nueva plataforma:', e?.message);
    }
    try {
      const { DataTypes } = require('sequelize');
      const qi = sequelize.getQueryInterface();
      const Autoevaluacion = require('./models/Autoevaluacion');
      const AutoevaluacionParticipante = require('./models/AutoevaluacionParticipante');
      const AutoevaluacionPrograma = require('./models/AutoevaluacionPrograma');
      const RegistroCalificadoHistorico = require('./models/RegistroCalificadoHistorico');
      const {
        InstrumentForm,
        InstrumentSection,
        InstrumentQuestion,
        InstrumentCondition,
        InstrumentResponse,
        InstrumentAnswer,
        InstrumentAttachment,
        InstrumentQuestionBank,
        InstrumentBackup,
        SecurityScan,
        SecurityFinding,
        SecurityRemediationProposal,
        SecurityFindingComment
      } = require('./models');
      await Autoevaluacion.sync();
      await AutoevaluacionParticipante.sync();
      await AutoevaluacionPrograma.sync();
      await RegistroCalificadoHistorico.sync();
      await InstrumentForm.sync();
      await InstrumentSection.sync();
      await InstrumentQuestion.sync();
      await InstrumentCondition.sync();
      await InstrumentResponse.sync();
      await InstrumentAnswer.sync();
      await InstrumentAttachment.sync();
      await InstrumentQuestionBank.sync();
      await InstrumentBackup.sync();
      await SecurityScan.sync();
      await SecurityFinding.sync();
      await SecurityRemediationProposal.sync();
      await SecurityFindingComment.sync();
      const ReporteSalidaSolicitud = require('./models/ReporteSalidaSolicitud');
      const DesplazamientoViaticosSolicitud = require('./models/DesplazamientoViaticosSolicitud');
      const ViaticosLegalizacion = require('./models/ViaticosLegalizacion');
      const SystemSetting = require('./models/SystemSetting');
      const DatabaseBackupRun = require('./models/DatabaseBackupRun');
      await ReporteSalidaSolicitud.sync();
      await DesplazamientoViaticosSolicitud.sync();
      await ViaticosLegalizacion.sync();
      const legalizacionesTableName = 'viaticos_legalizaciones';
      const legalizacionesTable = await qi.describeTable(legalizacionesTableName).catch(() => ({}));
      if (!legalizacionesTable.codigo_verificacion) {
        await qi.addColumn(legalizacionesTableName, 'codigo_verificacion', {
          type: DataTypes.UUID,
          allowNull: true
        });
        await sequelize.query(`
          UPDATE "${legalizacionesTableName}"
          SET "codigo_verificacion" = md5(random()::text || clock_timestamp()::text || "id"::text)::uuid
          WHERE "codigo_verificacion" IS NULL
        `);
        await qi.changeColumn(legalizacionesTableName, 'codigo_verificacion', {
          type: DataTypes.UUID,
          allowNull: false
        });
      }
      await qi.addIndex(legalizacionesTableName, ['codigo_verificacion'], {
        name: 'viaticos_legalizaciones_codigo_verificacion_unique',
        unique: true
      }).catch(() => null);
      const reporteSalidaTableName = 'reporte_salida_solicitudes';
      let reporteSalidaTable = await qi.describeTable(reporteSalidaTableName).catch(() => ({}));
      const ensureReporteSalidaColumn = async (column, definition) => {
        if (!reporteSalidaTable[column]) {
          await qi.addColumn(reporteSalidaTableName, column, definition);
          reporteSalidaTable[column] = definition;
        }
      };
      for (const enumValue of [
        'pendiente_aprobacion_vicerrectoria_academica',
        'aprobada_vicerrectoria_academica',
        'pendiente_aprobacion_rectoria',
        'aprobada_rectoria',
        'pendiente_aprobacion_sst',
        'aprobada_sst'
      ]) {
        await sequelize.query(`ALTER TYPE "enum_reporte_salida_solicitudes_estado" ADD VALUE IF NOT EXISTS '${enumValue}'`).catch(() => null);
      }
      await qi.changeColumn(reporteSalidaTableName, 'jefe_inmediato_user_id', {
        type: DataTypes.INTEGER,
        allowNull: true
      });
      await ensureReporteSalidaColumn('jefe_aprobado_at', { type: DataTypes.DATE, allowNull: true });
      await ensureReporteSalidaColumn('vicerrectoria_aprobado_at', { type: DataTypes.DATE, allowNull: true });
      await ensureReporteSalidaColumn('rectoria_aprobado_at', { type: DataTypes.DATE, allowNull: true });
      await ensureReporteSalidaColumn('gestion_humana_aprobado_at', { type: DataTypes.DATE, allowNull: true });
      await ensureReporteSalidaColumn('enviado_sst_at', { type: DataTypes.DATE, allowNull: true });
      await ensureReporteSalidaColumn('aprobacion_vicerrectoria_token_hash', { type: DataTypes.STRING(128), allowNull: true });
      await ensureReporteSalidaColumn('aprobacion_rectoria_token_hash', { type: DataTypes.STRING(128), allowNull: true });
      await ensureReporteSalidaColumn('aprobacion_sst_token_hash', { type: DataTypes.STRING(128), allowNull: true });
      await ensureReporteSalidaColumn('correo_vicerrectoria_enviado_at', { type: DataTypes.DATE, allowNull: true });
      await ensureReporteSalidaColumn('correo_rectoria_enviado_at', { type: DataTypes.DATE, allowNull: true });
      await ensureReporteSalidaColumn('correo_sst_enviado_at', { type: DataTypes.DATE, allowNull: true });
      await ensureReporteSalidaColumn('observacion_gestion_humana', { type: DataTypes.TEXT, allowNull: true });
      await SystemSetting.sync();
      await DatabaseBackupRun.sync();
      const { startDatabaseBackupScheduler } = require('./services/databaseBackupScheduler');
      await startDatabaseBackupScheduler();
      console.log('[gestion-informacion] Tablas autoevaluacion listas.');
    } catch (e) {
      console.warn('[gestion-informacion] No se pudo sincronizar autoevaluacion:', e?.message);
    }
    startServer(DEFAULT_PORT);
  })
  .catch((error) => {
    console.error('No fue posible iniciar el backend:', error?.message || error);
    process.exit(1);
  });
