const editableFields = ['title', 'starts_at', 'ends_at', 'location', 'modality', 'objective', 'development', 'commitments'];
const error = (message, statusCode) => Object.assign(new Error(message), { statusCode });
function canEditDraft(user, meeting) {
  if (!user?.id) return false;
  return ['administrador', 'planeacion_efectividad'].includes(user.role)
    || String(meeting.created_by) === String(user.id)
    || (meeting.participants || []).some(p => ['principal', 'co_responsible'].includes(p.meeting_role)
      && (p.user_id ? String(p.user_id) === String(user.id) : Boolean(user.email && p.email && p.email.toLowerCase() === user.email.toLowerCase())));
}
function assertDraft(meeting) {
  if (meeting.status !== 'draft' || (meeting.minuteVersions || []).some(v => v.status !== 'draft'))
    throw error('El acta ya fue enviada a firmas. El borrador compartido quedó cerrado.', 409);
}
function assertVersion(row, expected) {
  if (!expected || new Date(row.updated_at || row.updatedAt).getTime() !== new Date(expected).getTime())
    throw error('Otra persona actualizó el acta. Revise la versión reciente antes de guardar; su texto se conserva.', 409);
}
function draftPatch(body) {
  const patch = Object.fromEntries(editableFields.filter(k => Object.hasOwn(body, k)).map(k => [k, body[k]]));
  if (Object.keys(body).some(k => !editableFields.includes(k))) throw error('Campo no permitido en el borrador compartido.', 422);
  if ('title' in patch && (!String(patch.title || '').trim() || patch.title.length > 180)) throw error('Revise el título del acta.', 422);
  if ('objective' in patch && !String(patch.objective || '').trim()) throw error('El objetivo es obligatorio.', 422);
  for (const key of ['starts_at', 'ends_at']) if (key in patch && (key === 'starts_at' || patch[key]) && !Number.isFinite(new Date(patch[key]).getTime())) throw error('Fecha inválida.', 422);
  if ('commitments' in patch && !Array.isArray(patch.commitments)) throw error('Conclusiones inválidas.', 422);
  return patch;
}
module.exports = { canEditDraft, assertDraft, assertVersion, draftPatch };
