const fs = require('fs');

// Multipart fields are available only after upload.single has finished.
const allowAutoevaluacionUpload = (fallback) => (req, res, next) => {
  if (req.user?.role === 'autoevaluacion') return next();
  return fallback(req, res, next);
};

const allowAutoevaluacionDataset = (fallback) => (req, res, next) => {
  const categoria = String(req.body?.categoria || req.query?.categoria || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  if (req.user?.role === 'autoevaluacion' && categoria === 'autoevaluacion') {
    return next();
  }
  return fallback(req, res, next);
};

// A denied multipart request must not leave its temporary file on disk.
const cleanupDeniedUpload = (permission) => (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 400 && req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
  });
  return permission(req, res, next);
};

module.exports = { allowAutoevaluacionUpload, allowAutoevaluacionDataset, cleanupDeniedUpload };
