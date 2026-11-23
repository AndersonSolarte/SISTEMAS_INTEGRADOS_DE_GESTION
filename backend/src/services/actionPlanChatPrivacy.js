const privateMessage = message => message?.private_channel === true
  || message?.recipient_type === 'planning_effectiveness'
  || message?.recipient_type === 'administrator';

// A role or a current plan assignment never grants access to somebody else's chat.
const visibleTo = (message, user) => message?.sender_id != null && message?.recipient_id != null
  && [message.sender_id, message.recipient_id].some(id => String(id) === String(user?.id));

const conversationId = (planId, first, second) => JSON.stringify([String(planId), ...[String(first), String(second)].sort()]);
const protectedFields = ['chat_thread', 'chat_archive', 'last_planning_response', 'planning_responses_history', 'last_adjustment_request', 'adjustments_history'];
function protectChatMetadata(body) {
  if (body?.metadata && typeof body.metadata === 'object') {
    for (const key of protectedFields) delete body.metadata[key];
  }
}

// Apply before serialization, including nested plans, archives and chat responses.
function filterChatPayload(payload, user) {
  const visit = (value, leaderId) => {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(item => visit(item, leaderId));
    const owner = value.responsible_user_id ?? leaderId;
    for (const key of Object.keys(value)) {
      if (['last_planning_response', 'planning_responses_history', 'last_adjustment_request', 'adjustments_history'].includes(key)) {
        if (Array.isArray(value[key])) value[key] = value[key].filter(message => visibleTo(message, user));
        else if (!visibleTo(value[key], user)) delete value[key];
        continue;
      }
      if (['chat_thread', 'chat_archive'].includes(key) && Array.isArray(value[key])) {
        value[key] = value[key].filter(message => visibleTo(message, user, owner));
      } else value[key] = visit(value[key], owner);
    }
    if (value.message && typeof value.message === 'object' && privateMessage(value.message) && !visibleTo(value.message, user)) delete value.message;
    return value;
  };
  return visit(JSON.parse(JSON.stringify(payload)));
}

module.exports = { privateMessage, visibleTo, filterChatPayload, conversationId, protectChatMetadata };
