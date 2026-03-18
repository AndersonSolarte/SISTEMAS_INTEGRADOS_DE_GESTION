const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const multer = require('multer');
const fs = require('fs');
const { testConnection } = require('./config/database');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));
app.use(compression());

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/documentos', require('./routes/documentoRoutes'));
app.use('/api/favoritos', require('./routes/favoritoRoutes'));
app.use('/api', require('./routes/catalogoRoutes'));
app.use('/api/import', require('./routes/importRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/management/documentos', require('./routes/documentoManagementRoutes'));
app.use('/api/planeacion/gestion-informacion', require('./routes/gestionInformacionRoutes'));
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
      const maxMb = Number(process.env.EXCEL_UPLOAD_MAX_MB || 1024);
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
    /* Garantizar que la tabla de actividad exista sin afectar otras tablas */
    try {
      const UserActivityLog = require('./models/UserActivityLog');
      await UserActivityLog.sync();
      console.log('[activity] Tabla user_activity_logs lista.');
    } catch (e) {
      console.warn('[activity] No se pudo sincronizar user_activity_logs:', e?.message);
    }
    startServer(DEFAULT_PORT);
  })
  .catch((error) => {
    console.error('No fue posible iniciar el backend:', error?.message || error);
    process.exit(1);
  });
