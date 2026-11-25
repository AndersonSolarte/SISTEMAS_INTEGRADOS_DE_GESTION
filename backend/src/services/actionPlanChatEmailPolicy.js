const { createHash } = require('node:crypto');
const { conversationId } = require('./actionPlanChatPrivacy');

const PLANNING_CHAT_MAILBOX = 'planeacionestrategica@unicesmag.edu.co';
const digest = value => createHash('sha256').update(String(value)).digest('hex');

function chatEmailThreadRoot(message, metadata = {}) {
  return [...(metadata.chat_archive || []), ...(metadata.chat_thread || [])]
    .find(previous => previous.conversation_id === message.conversation_id && previous.email_thread_root_id)?.email_thread_root_id || message.id;
}

function chatEmailPolicy({ actor, plan, delivery, message }) {
  const planningRecipient = ['planning_effectiveness', 'planning_leader'].includes(delivery.type)
    || delivery.user.role === 'planeacion_efectividad';
  const key = conversationId(plan.id, actor.id, delivery.user.id);
  const threadKey = digest(key);
  const mailId = id => `<siac-chat-${threadKey.slice(0, 32)}-${digest(id).slice(0, 24)}@unicesmag.edu.co>`;
  const rootId = message.email_thread_root_id || message.id;
  return {
    to: planningRecipient ? PLANNING_CHAT_MAILBOX : delivery.user.email,
    replyTo: actor.role === 'planeacion_efectividad' ? PLANNING_CHAT_MAILBOX : actor.email || PLANNING_CHAT_MAILBOX,
    subject: `[Chat ${threadKey.slice(0, 12)}] Plan de Acción ${plan.code}`,
    headers: {
      'Message-ID': mailId(message.id),
      ...(String(rootId) === String(message.id) ? {} : { 'In-Reply-To': mailId(rootId), References: mailId(rootId) })
    }
  };
}

module.exports = { PLANNING_CHAT_MAILBOX, chatEmailPolicy, chatEmailThreadRoot };
