const { Op } = require('sequelize');
const crypto = require('crypto');
const { sequelize } = require('../config/database');
const { StrategicMeeting, StrategicMeetingParticipant, StrategicMinuteVersion, StrategicActionPlan, StrategicNotification, StrategicAuditEvent } = require('../models');
const { canEditDraft, assertDraft, assertVersion, draftPatch } = require('../services/strategicDraftPolicy');
const include = [{ model: StrategicMeetingParticipant, as: 'participants' }, { model: StrategicMinuteVersion, as: 'minuteVersions', attributes: ['id', 'status', 'version'] }, { model: StrategicActionPlan, as: 'actionPlan', attributes: ['id', 'code', 'title', 'deleted_at'] }];
const wrap = fn => async (req, res) => { try { await fn(req, res); } catch (e) { res.status(e.statusCode || 500).json({ success: false, message: e.statusCode ? e.message : 'No se pudo procesar el borrador.' }); } };
async function load(id, transaction) {
  const row = await StrategicMeeting.findByPk(id, { transaction, ...(transaction ? { lock: { level: transaction.LOCK.UPDATE, of: StrategicMeeting } } : {}), include });
  if (!row || !row.actionPlan || row.actionPlan.deleted_at) throw Object.assign(new Error('Acta no encontrada.'), { statusCode: 404 });
  return row;
}
function authorize(user, row) { if (!canEditDraft(user, row)) throw Object.assign(new Error('Solo el creador, Planeación y los responsables designados pueden abrir este borrador.'), { statusCode: 403 }); }
const list = wrap(async (req, res) => {
  const memberships = await StrategicMeetingParticipant.findAll({ where: { meeting_role: { [Op.in]: ['principal', 'co_responsible'] }, [Op.or]: [{ user_id: req.user.id }, ...(req.user.email ? [{ user_id: null, email: { [Op.iLike]: req.user.email } }] : [])] }, attributes: ['meeting_id'] });
  const rows = await StrategicMeeting.findAll({ where: { [Op.or]: [{ created_by: req.user.id }, { id: { [Op.in]: memberships.map(p => p.meeting_id) } }] }, include, order: [['updated_at', 'DESC']], limit: 300 });
  res.json({ success: true, data: rows.filter(r => r.actionPlan && !r.actionPlan.deleted_at && canEditDraft(req.user, r)).map(r => ({ ...r.toJSON(), updated_at: r.updatedAt, source: 'action_plan', status: [...r.minuteVersions].sort((a, b) => b.version - a.version)[0]?.status === 'signing' ? 'signing' : r.status, code: r.actionPlan.code, content: { titulo: r.title, fecha: r.starts_at }, can_edit: canEditDraft(req.user, r) })) });
});
const get = wrap(async (req, res) => { const row = await load(req.params.id); authorize(req.user, row); res.json({ success: true, data: { ...row.toJSON(), updated_at: row.updatedAt } }); });
const update = wrap(async (req, res) => {
  const row = await sequelize.transaction(async transaction => {
    const meeting = await load(req.params.id, transaction); authorize(req.user, meeting); assertDraft(meeting); assertVersion(meeting, req.body.expected_updated_at);
    const patch = draftPatch(req.body.changes || {});
    const previous = Object.fromEntries(Object.keys(patch).map(key => [key, meeting[key]]));
    await meeting.update({ ...patch, updated_by: req.user.id }, { transaction });
    // Keep the very same draft version used by preview, Drive and the signing workflow.
    const minute = await StrategicMinuteVersion.findOne({ where: { meeting_id: meeting.id }, order: [['version', 'DESC']], transaction, lock: transaction.LOCK.UPDATE });
    if (minute) {
      assertDraft({ status: meeting.status, minuteVersions: [minute] });
      const { minutePayload } = require('./strategicPlanningController');
      const content = await minutePayload(meeting, transaction);
      await minute.update({ content: { ...minute.content, ...content }, content_hash: crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex') }, { transaction });
    }
    await StrategicAuditEvent.create({ actor_user_id: req.user.id, action: 'meeting.draft.collaborative_update', entity_type: 'meeting', entity_id: meeting.id, previous_value: previous, new_value: patch }, { transaction });
    return meeting;
  });
  res.json({ success: true, data: { ...row.toJSON(), updated_at: row.updatedAt } });
});
async function notifyDraft(meetingId, actorId) {
  return sequelize.transaction(async transaction => {
  const row = await load(meetingId, transaction);
  try { assertDraft(row); } catch (_) { return; }
  const userIds = new Set([row.created_by, ...row.participants.filter(p => ['principal', 'co_responsible'].includes(p.meeting_role)).map(p => p.user_id)].filter(id => id && String(id) !== String(actorId)));
  for (const user_id of userIds) {
    const exists = await StrategicNotification.findOne({ where: { user_id, type: 'action_plan_minute_draft', metadata: { [Op.contains]: { meeting_id: row.id } } }, transaction });
    if (!exists) await StrategicNotification.create({ user_id, action_plan_id: row.action_plan_id, type: 'action_plan_minute_draft', title: `Acta en borrador: ${row.title || row.actionPlan.code}`.slice(0, 240), message: 'Fue designado responsable o corresponsable. Puede abrir y editar el acta del Plan de Acción antes del envío a firmas.', link: `/dashboard?planMinute=${row.id}`, metadata: { meeting_id: row.id } }, { transaction });
  }
  });
}
module.exports = { list, get, update, notifyDraft };
