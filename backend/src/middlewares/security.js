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
    process.env.BACKEND_PUBLIC_URL,
    process.env.API_PUBLIC_URL,
    ...splitCsv(process.env.CORS_ORIGINS)
  ].map(normalizeOrigin);

  const developmentOrigins = process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5000', 'http://127.0.0.1:5000'];

  return unique([...configured, ...developmentOrigins]);
};

const allowedOrigins = getAllowedOrigins();

const corsOptions = {
  origin(origin, callback) {
    if (!origin || origin === 'null') return callback(null, true);
    const normalized = normalizeOrigin(origin);
    if (allowedOrigins.includes(normalized)) return callback(null, true);
    
    // Permitir siempre origenes locales (localhost / 127.0.0.1) en cualquier puerto
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) {
      return callback(null, true);
    }
    
    console.warn(`[CORS] Origen rechazado: ${origin}. Origenes permitidos:`, allowedOrigins);
    return callback(new Error('Origen no permitido por CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  credentials: false,
  maxAge: 600
};

const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 5 * 60 * 1000),
  limit: Number(process.env.RATE_LIMIT_MAX || 900),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  skipSuccessfulRequests: false,
  message: {
    success: false,
    message: 'Demasiadas solicitudes. Intenta nuevamente mas tarde.'
  }
});

const publicLimiter = rateLimit({
  windowMs: Number(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS || 5 * 60 * 1000),
  limit: Number(process.env.PUBLIC_RATE_LIMIT_MAX || 80),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  message: {
    success: false,
    message: 'Demasiadas solicitudes. Intenta nuevamente mas tarde.'
  }
});

const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 5 * 60 * 1000),
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX || 40),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET' || req.method === 'OPTIONS',
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Se alcanzaron muchos intentos seguidos. Espera unos minutos e intenta nuevamente.'
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

const sqlInjectionGuard = (req, res, next) => {
  const suspiciousPatterns = [
    /(?:^|[\s'"])or\s+1\s*=\s*1(?:[\s'"]|$)/i,
    /(?:^|[\s'"])and\s+1\s*=\s*1(?:[\s'"]|$)/i,
    /\bunion\s+(?:all\s+)?select\b/i,
    /\b(?:drop|truncate|alter)\s+(?:table|database|schema|user|role)\b/i,
    /\b(?:insert|update|delete)\s+(?:into|from)?\s+[a-z0-9_".]+\s*(?:set|where|values)?/i,
    /\bexec(?:ute)?\s*\(/i,
    /\binformation_schema\b/i,
    /\bpg_catalog\b/i,
    /(?:--|#|\/\*)\s*(?:$|\w)/,
    /;\s*(?:select|insert|update|delete|drop|alter|truncate|create)\b/i,
    /\b(?:sleep|pg_sleep|benchmark)\s*\(/i
  ];

  const containers = [
    { source: 'query', value: req.query },
    { source: 'params', value: req.params },
    { source: 'body', value: req.body }
  ];
  const maxFieldLength = Number(process.env.REQUEST_MAX_FIELD_LENGTH || 8000);
  const authTokenLimits = new Map([
    ['body.credential', 8192],
    ['body.turnstileToken', 4096]
  ]);
  const isGoogleAuthRequest = /^\/api\/auth\/google(?:\/redirect)?(?:\?|$)/i.test(String(req.originalUrl || ''));
  const stack = containers.map((item) => ({ ...item, path: item.source, depth: 0 }));

  while (stack.length) {
    const { source, value, path: currentPath, depth } = stack.pop();
    if (value === null || value === undefined) continue;

    if (typeof value === 'string') {
      const authTokenLimit = isGoogleAuthRequest ? authTokenLimits.get(currentPath) : undefined;
      if (authTokenLimit) {
        if (value.length > authTokenLimit) {
          return res.status(413).json({
            success: false,
            message: 'Credencial de autenticacion demasiado grande'
          });
        }
        // Son tokens opacos firmados y se verifican posteriormente con Google y
        // Cloudflare. Analizarlos como texto SQL produce falsos positivos aleatorios.
        continue;
      }

      const decoded = (() => {
        try {
          return decodeURIComponent(value.replace(/\+/g, '%20'));
        } catch (_) {
          return value;
        }
      })();
      const compact = decoded.replace(/\s+/g, ' ').trim();

      if (compact.length > maxFieldLength) {
        return res.status(413).json({
          success: false,
          message: 'Campo de solicitud demasiado grande'
        });
      }

      if (suspiciousPatterns.some((pattern) => pattern.test(compact))) {
        console.warn('[security] Solicitud bloqueada por patron SQL sospechoso:', {
          source,
          path: currentPath,
          ip: req.ip,
          method: req.method,
          url: req.originalUrl
        });
        return res.status(400).json({
          success: false,
          message: 'La solicitud contiene parametros no permitidos'
        });
      }
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => stack.push({
        source,
        value: item,
        path: `${currentPath}[${index}]`,
        depth: depth + 1
      }));
      continue;
    }

    if (typeof value === 'object' && depth < 12) {
      Object.entries(value).forEach(([key, item]) => stack.push({
        source,
        value: item,
        path: `${currentPath}.${key}`,
        depth: depth + 1
      }));
    }
  }

  return next();
};

const noStore = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

const sensitivePathGuard = (req, res, next) => {
  let decodedPath = String(req.path || '').toLowerCase();
  try {
    decodedPath = decodeURIComponent(decodedPath);
  } catch (_) {
    return res.status(400).json({
      success: false,
      status: 400,
      code: 'BAD_REQUEST',
      message: 'Solicitud invalida'
    });
  }
  if (
    decodedPath.includes('..') ||
    /(^|\/)\.(?!well-known\/)/.test(decodedPath) ||
    /\.(env|ini|log|bak|backup|old|orig|sql|sqlite|db|dump|pem|key|crt|p12|pfx|config|yml|yaml|zip|tar|gz|map)$/i.test(decodedPath)
  ) {
    return res.status(404).json({
      success: false,
      status: 404,
      code: 'RESOURCE_NOT_FOUND',
      message: 'Recurso no encontrado'
    });
  }
  return next();
};

const uploadsStaticOptions = {
  dotfiles: 'deny',
  fallthrough: false,
  index: false,
  maxAge: '5m',
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
};

module.exports = {
  corsOptions,
  apiLimiter,
  publicLimiter,
  authLimiter,
  methodGuard,
  payloadShapeGuard,
  sqlInjectionGuard,
  sensitivePathGuard,
  noStore,
  uploadsStaticOptions
};
