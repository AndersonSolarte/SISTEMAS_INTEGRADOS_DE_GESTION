const axios = require('axios');
const https = require('https');
const tls = require('tls');
const { Client } = require('pg');

function databaseConfig() {
  const required = ['INSTITUTIONAL_DB_HOST', 'INSTITUTIONAL_DB_NAME', 'INSTITUTIONAL_DB_USER', 'INSTITUTIONAL_DB_PASSWORD'];
  const missing = required.filter((name) => !String(process.env[name] || '').trim());
  if (missing.length) throw new Error(`Falta configuración institucional: ${missing.join(', ')}`);
  return {
    host: process.env.INSTITUTIONAL_DB_HOST,
    port: Number(process.env.INSTITUTIONAL_DB_PORT || 5432),
    database: process.env.INSTITUTIONAL_DB_NAME,
    user: process.env.INSTITUTIONAL_DB_USER,
    password: process.env.INSTITUTIONAL_DB_PASSWORD,
    ssl: String(process.env.INSTITUTIONAL_DB_SSL || 'false').toLowerCase() === 'true'
      ? { rejectUnauthorized: true } : false,
    application_name: 'siac_saber_pro_readonly',
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
    query_timeout: 30000
  };
}

function normalizeRemotePath(value) {
  const normalized = String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.split('/').includes('..') || !/\.pdf$/i.test(normalized)) {
    throw new Error('La ruta institucional no es un PDF válido.');
  }
  return normalized;
}

function documentUrl(relativePath) {
  const baseValue = String(process.env.INSTITUTIONAL_DOCUMENTS_BASE_URL || '').trim();
  if (!baseValue) throw new Error('Falta INSTITUTIONAL_DOCUMENTS_BASE_URL.');
  const base = new URL(baseValue);
  const resolved = new URL(normalizeRemotePath(relativePath), base);
  if (resolved.origin !== base.origin) throw new Error('La ruta del PDF no pertenece al servidor autorizado.');
  return resolved.toString();
}

function institutionalHttpsAgent() {
  const rejectUnauthorized = String(
    process.env.INSTITUTIONAL_TLS_REJECT_UNAUTHORIZED || 'true'
  ).toLowerCase() !== 'false';
  if (!rejectUnauthorized) return new https.Agent({ rejectUnauthorized: false });
  const systemCertificates = typeof tls.getCACertificates === 'function'
    ? tls.getCACertificates('system') : [];
  if (!systemCertificates.length) return undefined;
  return new https.Agent({ rejectUnauthorized: true, ca: [...tls.rootCertificates, ...systemCertificates] });
}

async function queryDocumentsByIdentifications(identifications) {
  if (!identifications.length) return [];
  const client = new Client(databaseConfig());
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    const result = await client.query(
      `SELECT
         p.numero_identificacion::text AS identification,
         g.codigo_ek::text AS registration_number,
         g.fecha_presentacion_ek AS expected_exam_date,
         g.url_ek::text AS document_path,
         g.fecha_registro AS registered_at
       FROM personas p
       LEFT JOIN estudiantes e ON e.id_persona = p.id
       LEFT JOIN graduados g ON g.id_estudiante = e.id
       WHERE p.numero_identificacion::text = ANY($1::text[])
       ORDER BY p.numero_identificacion::text,
         (g.url_ek IS NOT NULL) DESC,
         g.fecha_registro DESC NULLS LAST,
         g.id DESC NULLS LAST`,
      [identifications]
    );
    await client.query('ROLLBACK');
    return result.rows;
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    await client.end().catch(() => {});
  }
}

async function fetchPdfBuffer(relativePath) {
  const maxBytes = Number(process.env.INSTITUTIONAL_MAX_FILE_MB || 20) * 1024 * 1024;
  const response = await axios.get(documentUrl(relativePath), {
    responseType: 'arraybuffer',
    timeout: 60000,
    maxContentLength: maxBytes,
    maxBodyLength: maxBytes,
    validateStatus: (status) => status === 200,
    httpsAgent: institutionalHttpsAgent()
  });
  const buffer = Buffer.from(response.data);
  if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('El servidor institucional no devolvió un PDF válido.');
  }
  return buffer;
}

module.exports = {
  queryDocumentsByIdentifications,
  fetchPdfBuffer,
  normalizeRemotePath
};
