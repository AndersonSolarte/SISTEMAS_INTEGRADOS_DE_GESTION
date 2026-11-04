const crypto = require('crypto');
const policy = require('../config/saludConsentimiento.json');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const policyHash = sha256(JSON.stringify(policy));
const getSaludConsentimientoPolicy = () => ({ ...policy, hash: policyHash });
const isSalidaSalud = (salida = {}) => (salida.categoria || salida.category) === 'salud'
  || ['cita_eps', 'cita_particular', 'cita_medica_laboral', 'urgencia_medica', 'terapias'].includes(salida.tipo);

const validateSaludConsentimiento = (salida, consent, isMultiple = false) => {
  if (!isSalidaSalud(salida)) return null;
  if (isMultiple) return 'Los permisos de Salud y Bienestar requieren radicación individual y autorización personal de cada solicitante.';
  if (consent?.accepted !== true) return 'Debe aceptar la autorización para la verificación de información y el tratamiento de datos personales de Salud y Bienestar.';
  if (consent.version !== policy.version || consent.policyHash !== policyHash) {
    return 'La autorización de Salud y Bienestar cambió. Abra nuevamente el formulario, lea el texto y acepte la versión vigente.';
  }
  return null;
};

const buildSaludConsentimiento = ({ user, consent, request, now = new Date() }) => {
  // Identidad, texto, fecha y evidencia se generan en el servidor.
  const record = {
    accepted: true,
    policy: getSaludConsentimientoPolicy(),
    acceptedAt: now.toISOString(),
    timeZone: 'America/Bogota',
    actor: { userId: user.id, nombre: user.nombre || '', documento: user.username || '', correo: user.email || '' },
    method: 'casilla expresa en sesión institucional autenticada',
    clientAcceptedAt: typeof consent.clientAcceptedAt === 'string' ? consent.clientAcceptedAt.slice(0, 40) : null,
    ip: String(request.ip || '').slice(0, 100),
    userAgent: String(request.get?.('user-agent') || '').slice(0, 500),
    transactionId: crypto.randomUUID()
  };
  return { ...record, evidenceHash: sha256(JSON.stringify(record)) };
};

const buildSaludConsentimientoTrace = (record) => ({
  event: 'consentimiento_salud_aceptado', at: record.acceptedAt,
  actor: record.actor,
  detail: { observacion: `Autorización expresa de Salud y Bienestar. Versión: ${record.policy.version}. SHA-256: ${record.evidenceHash}`, transactionId: record.transactionId, policyHash: record.policy.hash }
});

module.exports = { getSaludConsentimientoPolicy, isSalidaSalud, validateSaludConsentimiento, buildSaludConsentimiento, buildSaludConsentimientoTrace };
