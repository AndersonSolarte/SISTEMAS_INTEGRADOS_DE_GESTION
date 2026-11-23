export const isPrivateChatMessage = message => message.channel_kind !== 'leader_planning' && (message.private_channel === true
  || ['planning_effectiveness', 'administrator'].includes(message.recipient_type));

export function planningChatPeers(thread, user) {
  if (user?.role !== 'planeacion_efectividad') return [];
  const peers = new Map();
  for (const message of thread || []) {
    if (message.recipient_type === 'planning_effectiveness' && String(message.recipient_id) === String(user.id)) {
      peers.set(String(message.sender_id), { id: String(message.sender_id), name: message.sender_name });
    }
    if (message.recipient_type === 'administrator' && message.channel_kind !== 'admin_leader' && String(message.sender_id) === String(user.id)) {
      peers.set(String(message.recipient_id), { id: String(message.recipient_id), name: message.recipient_name || peers.get(String(message.recipient_id))?.name || 'Administrador' });
    }
  }
  return [...peers.values()];
}

export function chatChannelMessages(thread, user, recipient, leaderId) {
  const existing = user?.role === 'administrador' ? (thread || []).find(message =>
    ['planning_effectiveness', 'administrator'].includes(message.recipient_type)
    && [message.sender_id, message.recipient_id].some(id => String(id) === String(user.id))) : null;
  const planningPeer = existing ? (String(existing.sender_id) === String(user.id) ? existing.recipient_id : existing.sender_id) : null;
  return (thread || []).filter(message => {
    if (message.sender_id == null || message.recipient_id == null
      || ![message.sender_id, message.recipient_id].some(id => String(id) === String(user?.id))) return false;
    if (!isPrivateChatMessage(message)) return user?.role !== 'administrador' && recipient === 'leader'
      && (!leaderId || [message.sender_id, message.recipient_id].some(id => String(id) === String(leaderId)));
    if (message.channel_kind === 'admin_leader') return user.role === 'administrador' ? recipient === 'leader'
      && (!leaderId || [message.sender_id, message.recipient_id].some(id => String(id) === String(leaderId)))
      : recipient === 'administrator:' + (String(message.sender_id) === String(user.id) ? message.recipient_id : message.sender_id);
    if (!['administrador', 'planeacion_efectividad'].includes(user?.role)
      || ![message.sender_id, message.recipient_id].some(id => String(id) === String(user.id))) return false;
    if (user.role === 'administrador') return recipient === 'planning_effectiveness'
      && [message.sender_id, message.recipient_id].some(id => String(id) === String(planningPeer));
    return recipient === 'administrator:' + (message.recipient_type === 'planning_effectiveness' ? message.sender_id : message.recipient_id);
  });
}
