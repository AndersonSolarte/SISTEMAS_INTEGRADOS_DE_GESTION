const fs = require('fs');
const path = require('path');
const os = require('os');
const multer = require('multer');

const DEFAULT_MAX_FILE_SIZE_MB = Number(process.env.EXCEL_UPLOAD_MAX_MB || 1024);
const MAX_FILE_SIZE_BYTES = Number.isFinite(DEFAULT_MAX_FILE_SIZE_MB) && DEFAULT_MAX_FILE_SIZE_MB > 0
  ? Math.trunc(DEFAULT_MAX_FILE_SIZE_MB * 1024 * 1024)
  : 1024 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv']);
const ALLOWED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
  'application/octet-stream'
]);

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const excelFileFilter = (req, file, cb) => {
  const originalName = String(file?.originalname || '').trim();
  const extension = path.extname(originalName).toLowerCase();
  const mimeType = String(file?.mimetype || '').toLowerCase();

  const hasValidExtension = ALLOWED_EXTENSIONS.has(extension);
  const hasValidMimeType = !mimeType || ALLOWED_MIME_TYPES.has(mimeType);

  if (!hasValidExtension || !hasValidMimeType) {
    return cb(new Error('Archivo no permitido. Solo se admiten archivos Excel/CSV (.xlsx, .xls, .csv).'));
  }

  return cb(null, true);
};

const createExcelUpload = (dest) => {
  const finalDir = process.env.EXCEL_UPLOAD_TMP_DIR
    ? path.resolve(process.env.EXCEL_UPLOAD_TMP_DIR)
    : path.join(os.tmpdir(), 'sgc_uploads');
  ensureDir(finalDir);

  return multer({
    dest: finalDir,
    fileFilter: excelFileFilter,
    limits: {
      fileSize: MAX_FILE_SIZE_BYTES,
      files: 1
    }
  });
};

module.exports = {
  createExcelUpload,
  MAX_FILE_SIZE_BYTES
};
