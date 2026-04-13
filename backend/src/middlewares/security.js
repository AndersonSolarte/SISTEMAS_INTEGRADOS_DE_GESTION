const rateLimit = require('express-rate-limit');

const splitCsv = (value = '') => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const unique = (items = []) => Array.from(new Set(items.filter(Boolean)));

const normalizeOrigin = (origin = '') => String(origin || '').replace(/\/+$/, '');

const getAllowedOrigins = () => {
  const configured = [
    process.env.FRONTEND_URL,
    process.env.PUBLIC_APP_URL,
    ...splitCsv(process.env.CORS_ORIGINS)
  ].map(normalizeOrigin);

  const developmentOrigins = process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  return unique([...configured, ...developmentOrigins]);
};

const allowedOrigins = getAllowedOrigins();

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(normalizeOrigin(origin))) return callback(null, true);
    return callback(new Error('Origen no permitido por CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  credentials: false,
  maxAge: 600
};

const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  limit: Number(process.env.RATE_LIMIT_MAX || 600),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiadas solicitudes. Intenta nuevamente mas tarde.'
  }
});

const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiados intentos de acceso. Intenta nuevamente mas tarde.'
  }
});

const methodGuard = (req, res, next) => {
  const allowedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
  if (allowedMethods.has(req.method)) return next();
  return res.status(405).json({
    success: false,
    status: 405,
    code: 'METHOD_NOT_ALLOWED',
    message: 'Metodo no permitido'
  });
};

const payloadShapeGuard = (req, res, next) => {
  const blockedKeys = new Set(['__proto__', 'prototype', 'constructor']);
  const maxDepth = Number(process.env.REQUEST_MAX_DEPTH || 12);
  const stack = [
    { value: req.body, depth: 0 },
    { value: req.query, depth: 0 },
    { value: req.params, depth: 0 }
  ];

  while (stack.length) {
    const { value, depth } = stack.pop();
    if (!value || typeof value !== 'object') continue;

    if (depth > maxDepth) {
      return res.status(400).json({
        success: false,
        message: 'La solicitud tiene una estructura demasiado profunda'
      });
    }

    for (const key of Object.keys(value)) {
      if (blockedKeys.has(key)) {
        return res.status(400).json({
          success: false,
          message: 'La solicitud contiene parametros no permitidos'
        });
      }
      stack.push({ value: value[key], depth: depth + 1 });
    }
  }

  return next();
};

const noStore = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

const uploadsStaticOptions = {
  dotfiles: 'deny',
  fallthrough: false,
  index: false,
  maxAge: '5m',
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  }
};

module.exports = {
  corsOptions,
  apiLimiter,
  authLimiter,
  methodGuard,
  payloadShapeGuard,
  noStore,
  uploadsStaticOptions
};
