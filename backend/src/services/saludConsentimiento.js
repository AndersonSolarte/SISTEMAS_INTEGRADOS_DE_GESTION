const crypto = require('crypto');
const policy = require('../config/saludConsentimiento.json');
const SALUD_CONSENTIMIENTO_TRACE_TEXT = 'Aceptó la verificación de soportes del permiso de salud y el tratamiento de sus datos personales y sensibles para las finalidades informadas.';
const SALUD_SIN_ADJUNTO_DECLARATION = 'Declaro que al momento de radicar esta solicitud no cuento con archivos adjuntos o soportes para cargar en el sistema. Entiendo que la Oficina de Gestion del Talento Humano y/o Seguridad y Salud en el Trabajo podran requerir en cualquier momento los soportes correspondientes; por tanto, me comprometo a conservarlos despues de la atencion o tramite y a suministrarlos oportunamente cuando sean solicitados.';

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
  if ((salida.noCuentaAdjunto === true) !== (consent.withoutAttachment === true)) {
    return 'Debe aceptar nuevamente la autorización y, si no cuenta con soportes, la declaración de entrega posterior.';
  }
  return null;
};

const buildSaludConsentimiento = ({ user, consent, request, salida = {}, now = new Date() }) => {
  // Identidad, texto, fecha y evidencia se generan en el servidor.
  const record = {
    accepted: true,
    policy: getSaludConsentimientoPolicy(),
    acceptedAt: now.toISOString(),
    timeZone: 'America/Bogota',
    actor: { userId: user.id, nombre: user.nombre || '', documento: user.username || '', correo: user.email || '' },
    method: 'casilla expresa en sesión institucional autenticada',
    withoutAttachment: salida.noCuentaAdjunto === true,
    noAttachmentDeclaration: salida.noCuentaAdjunto === true ? SALUD_SIN_ADJUNTO_DECLARATION : null,
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
  detail: { observacion: SALUD_CONSENTIMIENTO_TRACE_TEXT, transactionId: record.transactionId, policyHash: record.policy.hash }
});

module.exports = { SALUD_CONSENTIMIENTO_TRACE_TEXT, SALUD_SIN_ADJUNTO_DECLARATION, getSaludConsentimientoPolicy, isSalidaSalud, validateSaludConsentimiento, buildSaludConsentimiento, buildSaludConsentimientoTrace };
