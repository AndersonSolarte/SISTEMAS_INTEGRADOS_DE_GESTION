const { ROLES } = require('../../constants/roles');

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9@.]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const AREA_TERMS = {
  financiera_previa: ['vicerrectoria financiera', 'financiera y de desarrollo institucional'],
  financiera_final: ['vicerrectoria financiera', 'financiera y de desarrollo institucional'],
  gestion_humana: ['gestion humana', 'talento humano', 'recursos humanos'],
  sst: ['seguridad y salud en el trabajo', 'sst'],
  tecnico_contable: ['tecnico contable', 'contabilidad', 'contable'],
  tesoreria: ['tesoreria', 'pagaduria'],
  tramite: ['tesoreria', 'pagaduria']
};

const getCurrentStep = (solicitud = {}) => {
  const plan = Array.isArray(solicitud.plan_aprobacion) ? solicitud.plan_aprobacion : [];
  const index = Number(solicitud.paso_actual || 0);
  return plan[index] || null;
};

const getUserIdentityText = (user = {}) => normalize([
  user.dependencia,
  user.vicerrectoria,
  user.cargo
].filter(Boolean).join(' '));

const stepEmails = (step = {}) => [
  step.email,
  step.alternateApprovalEmail,
  ...(Array.isArray(step.approvalEmails) ? step.approvalEmails : [])
].map(normalizeEmail).filter(Boolean);

const userMatchesStep = (user = {}, step = {}) => {
  if (!step) return false;
  const userEmail = normalizeEmail(user.email);
  if (userEmail && stepEmails(step).includes(userEmail)) return true;

  const identity = getUserIdentityText(user);
  if (!identity) return false;
  const terms = AREA_TERMS[step.key] || [];
  if (terms.some((term) => identity.includes(normalize(term)))) return true;

  const stepLabel = normalize([
    step.label,
    step.alternateApprovalLabel,
    step.alternateAuthorityLabel
  ].filter(Boolean).join(' '));
  const identityParts = [user.dependencia, user.vicerrectoria]
    .map(normalize)
    .filter((part) => part.length >= 8);
  return Boolean(stepLabel) && identityParts.some((part) => stepLabel.includes(part) || part.includes(stepLabel));
};

const userAppearsInTrace = (user = {}, solicitud = {}) => {
  const userEmail = normalizeEmail(user.email);
  if (!userEmail) return false;
  const traces = Array.isArray(solicitud.trazabilidad) ? solicitud.trazabilidad : [];
  return traces.some((entry) => normalizeEmail(entry?.actor?.email) === userEmail);
};

const userAreaAppearsInTrace = (user = {}, solicitud = {}) => {
  const identity = getUserIdentityText(user);
  if (!identity) return false;
  const traces = Array.isArray(solicitud.trazabilidad) ? solicitud.trazabilidad : [];
  return traces.some((entry) => {
    const event = normalize(entry?.event);
    return Object.entries(AREA_TERMS).some(([key, terms]) => (
      event.includes(normalize(key)) && terms.some((term) => identity.includes(normalize(term)))
    ));
  });
};

const isAccountingUser = (user = {}) => {
  const identity = getUserIdentityText(user);
  return AREA_TERMS.tecnico_contable.some((term) => identity.includes(normalize(term)));
};

const canActOnSolicitud = (user = {}, solicitud = {}) => user?.role === ROLES.ADMINISTRADOR
  || userMatchesStep(user, getCurrentStep(solicitud));

const canValidateLegalizacion = (user = {}) => user?.role === ROLES.ADMINISTRADOR || isAccountingUser(user);

const canAccessSolicitud = (user = {}, solicitud = {}) => {
  if (user?.role === ROLES.ADMINISTRADOR) return true;
  const currentStep = getCurrentStep(solicitud);
  if (userMatchesStep(user, currentStep)) return true;
  if (userAppearsInTrace(user, solicitud) || userAreaAppearsInTrace(user, solicitud)) return true;

  return Boolean(isAccountingUser(user) && solicitud.legalizacion);
};

const filterSolicitudesForUser = (user, solicitudes = []) => user?.role === ROLES.ADMINISTRADOR
  ? solicitudes
  : solicitudes.filter((solicitud) => canAccessSolicitud(user, solicitud));

module.exports = {
  canActOnSolicitud,
  canAccessSolicitud,
  canValidateLegalizacion,
  filterSolicitudesForUser,
  getCurrentStep,
  userMatchesStep
};
