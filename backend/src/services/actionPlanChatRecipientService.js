const failure = (message, statusCode = 422) => Object.assign(new Error(message), { statusCode });
const threadFor = plan => [...(plan.metadata?.chat_archive || []), ...(plan.metadata?.chat_thread || [])];
const otherParticipant = (message, id) => String(message.sender_id) === String(id) ? message.recipient_id : message.sender_id;

async function resolveAdminChatRecipient({ actor, plan, recipient, users = require('../models').User }) {
  if (actor.role === 'planeacion_efectividad' && String(recipient).startsWith('administrator:')) {
    const id = recipient.slice('administrator:'.length);
    const thread = [...(plan.metadata?.chat_thread || []), ...(plan.metadata?.chat_archive || [])];
    const hasConversation = thread.some(message =>
      (message.channel_kind === 'admin_planning' || !message.channel_kind && ['planning_effectiveness', 'administrator'].includes(message.recipient_type))
      && [message.sender_id, message.recipient_id].some(value => String(value) === id)
      && [message.sender_id, message.recipient_id].some(value => String(value) === String(actor.id)));
    if (!hasConversation) throw failure('No tiene acceso a esta conversación.', 403);
    const selected = await users.findOne({ where: { id, role: 'administrador', estado: 'activo' } });
    if (!selected) throw failure('El administrador no está activo.');
    return { type: 'administrator', channel: 'admin_planning', user: { id: selected.id, role: selected.role, name: selected.nombre || selected.username || '', email: selected.email || '' } };
  }
  if (actor.role !== 'administrador') throw failure('Solo un administrador puede elegir el destinatario del chat.', 403);
  if (recipient !== 'planning_effectiveness') throw failure('Los mensajes del administrador solo se envían a Planeación y Efectividad.');
  const existing = threadFor(plan).find(message => message.sender_id != null && message.recipient_id != null
    && (message.channel_kind === 'admin_planning' || ['planning_effectiveness', 'administrator'].includes(message.recipient_type))
    && [message.sender_id, message.recipient_id].some(id => String(id) === String(actor.id)));
  const selected = await users.findOne({ where: { ...(existing ? { id: otherParticipant(existing, actor.id) } : {}), role: 'planeacion_efectividad', estado: 'activo' }, order: [['updated_at', 'DESC'], ['id', 'ASC']] });
  if (!selected) throw failure('No hay un usuario activo de Planeación y Efectividad para esta conversación.');
  if (String(selected.id) === String(actor.id)) throw failure('Seleccione un destinatario distinto de su propia cuenta.');
  return { type: recipient, user: { id: selected.id, role: selected.role, name: selected.nombre || selected.username || '', email: selected.email || '' } };
}

async function resolveLeaderPlanningRecipient({ actor, plan, users = require('../models').User }) {
  const fromLeader = String(plan.responsible_user_id) === String(actor.id);
  const existing = threadFor(plan).find(message => ['leader_planning', 'admin_planning'].includes(message.channel_kind)
    && message.sender_id != null && message.recipient_id != null
    && [message.sender_id, message.recipient_id].some(id => String(id) === String(plan.responsible_user_id)));
  const planningId = existing ? otherParticipant(existing, plan.responsible_user_id) : null;
  if (!fromLeader && planningId && String(planningId) !== String(actor.id)) throw failure('Esta conversación pertenece a otro usuario de Planeación y Efectividad.', 403);
  const where = fromLeader ? { ...(planningId ? { id: planningId } : {}), role: 'planeacion_efectividad', estado: 'activo' } : { id: plan.responsible_user_id, estado: 'activo' };
  if (!fromLeader && !plan.responsible_user_id) throw failure('El plan no tiene un líder asignado.');
  const selected = await users.findOne({ where, order: [['updated_at', 'DESC'], ['id', 'ASC']] });
  if (!selected || String(selected.id) === String(actor.id)) throw failure('No hay un destinatario activo para esta conversación.');
  return { type: fromLeader ? 'planning_leader' : selected.role === 'administrador' ? 'administrator' : 'leader',
    ...(selected.role === 'administrador' && !fromLeader ? { channel: 'admin_planning' } : {}),
    user: { id: selected.id, role: selected.role, name: selected.nombre || selected.username || '', email: selected.email || '' } };
}

async function notifyAdminChatRecipient({ actor, plan, delivery, message, baseUrl,
  notifications = require('../models').StrategicNotification,
  sendEmail = require('./strategicPlanningEmailService').sendStrategicPlanningEmail }) {
  const { renderInstitutionalTemplate, escapeHtml } = require('./emailService');
  const path = delivery.type === 'leader' ? '/dashboard/plan-accion-mi-plan' : '/dashboard/planeacion-efectividad';
  const link = path + '?planId=' + encodeURIComponent(plan.id) + '&openChat=true'
    + (['leader', 'planning_leader'].includes(delivery.type) && message.channel_kind !== 'admin_leader' ? '&chatPeer=leader' : '&chatPeer=' + encodeURIComponent(actor.id))
    + '&chatChannel=' + encodeURIComponent(message.channel_kind || '');
  const title = 'Mensaje del chat · ' + plan.code;
  await notifications.create({ user_id: delivery.user.id, action_plan_id: plan.id, type: 'action_plan_chat_message',
    title: title.slice(0, 240), message: (actor.nombre || actor.username || 'Administrador') + ': ' + message.message.slice(0, 95),
    link, metadata: { action_plan_code: plan.code, sender_id: actor.id, sender_name: message.sender_name,
      recipient_type: delivery.type, recipient_id: delivery.user.id, channel_kind: message.channel_kind, conversation_id: message.conversation_id, chat_message_id: message.id } });
  const emailPolicy = require('./actionPlanChatEmailPolicy').chatEmailPolicy({ actor, plan, delivery, message });
  if (emailPolicy.to) {
    const url = baseUrl + link;
    await sendEmail({ ...emailPolicy,
      text: message.sender_name + ' le escribió sobre el plan ' + plan.code + ':\n\n' + message.message + '\n\n' + url,
      html: renderInstitutionalTemplate({ title,
        introHtml: '<p>Hola, ' + escapeHtml(delivery.user.name) + '. ' + escapeHtml(message.sender_name) + ' le envió un mensaje sobre este plan.</p>',
        bodyHtml: '<div style="white-space:pre-wrap">' + escapeHtml(message.message) + '</div><p><a href="' + escapeHtml(url) + '">Abrir chat del Plan de Acción</a></p>' }) }).catch(error => console.warn('Error enviando correo del chat:', error.message));
  }
}

module.exports = { resolveAdminChatRecipient, resolveLeaderPlanningRecipient, notifyAdminChatRecipient };
