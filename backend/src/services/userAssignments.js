const { DEPENDENCY_EMAILS_RAW } = require('../config/dependencyEmails');
const key = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
const text = (value) => String(value || '').trim().slice(0, 220);

const getUserAssignments = (user = {}) => {
  const primary = { dependencia: user.dependencia, vicerrectoria: user.vicerrectoria, jefe_inmediato: user.jefe_inmediato };
  const assignments = [primary, ...(Array.isArray(user.dependencias_asignadas) ? user.dependencias_asignadas : [])];
  const seen = new Set();
  return assignments.filter((item) => {
    const id = key(item?.dependencia);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).map((item) => ({ dependencia: text(item.dependencia), vicerrectoria: text(item.vicerrectoria), jefe_inmediato: text(item.jefe_inmediato) }));
};

const validateAssignments = (items, primary = '') => {
  if (!Array.isArray(items) || items.length > 30) throw new Error('Seleccione hasta 30 dependencias válidas.');
  const seen = new Set();
  if (key(primary)) seen.add(key(primary));
  return items.map((item) => {
    const official = Object.keys(DEPENDENCY_EMAILS_RAW).find((name) => key(name) === key(item?.dependencia));
    if (!official || seen.has(key(official))) throw new Error('Las dependencias deben pertenecer al catálogo oficial y no repetirse.');
    if (!text(item?.jefe_inmediato)) throw new Error(`Seleccione el jefe inmediato de ${official}.`);
    if (!text(item?.vicerrectoria)) throw new Error(`Seleccione la vicerrectoría de ${official}.`);
    seen.add(key(official));
    return { dependencia: official, vicerrectoria: text(item.vicerrectoria), jefe_inmediato: text(item.jefe_inmediato) };
  });
};

// Usar el perfil institucional, nunca un jefe suministrado por el navegador.
const applySelectedAssignment = (payload, user) => {
  const assignments = getUserAssignments(user);
  if (assignments.length < 2) return;
  const selected = assignments.find((item) => key(item.dependencia) === key(payload.laboral?.dependencia));
  if (!selected) throw new Error('Seleccione una de sus dependencias asignadas para radicar la solicitud.');
  payload.laboral = { ...payload.laboral, ...selected, cargo: user.cargo || payload.laboral?.cargo };
  payload.jefeInmediatoUserId = null;
  payload.jefeInmediato = { nombre: selected.jefe_inmediato };
};

module.exports = { getUserAssignments, validateAssignments, applySelectedAssignment };
