import { chatChannelMessages, planningChatPeers } from './actionPlanChatChannels';
const shared = { sender_id: 'leader', recipient_id: 'planning', private_channel: true, channel_kind: 'leader_planning', message: 'Shared' };
const privateMessage = { sender_id: 'admin', sender_name: 'Admin', recipient_id: 'planning', recipient_type: 'planning_effectiveness' };
const reply = { sender_id: 'planning', recipient_id: 'admin', recipient_type: 'administrator' };

test('administrator cannot switch to leader to read leader-planning traffic', () => {
  const message = { sender_id: 'leader', recipient_id: 'planning', private_channel: true, channel_kind: 'leader_planning' };
  expect(chatChannelMessages([message, shared], { id: 'admin', role: 'administrador' }, 'leader')).toEqual([]);
  expect(chatChannelMessages([message], { id: 'planning', role: 'planeacion_efectividad' }, 'leader')).toEqual([message]);
});

test('administrator default conversation contains only private planning messages', () => {
  const thread = [shared, privateMessage, reply];
  expect(chatChannelMessages(thread, { id: 'admin', role: 'administrador' }, 'planning_effectiveness')).toEqual([privateMessage, reply]);
  expect(chatChannelMessages(thread, { id: 'admin', role: 'administrador' }, 'leader')).toEqual([]);
});
test('planning selects the administrator conversation without mixing leader messages', () => {
  const user = { id: 'planning', role: 'planeacion_efectividad' };
  expect(planningChatPeers([privateMessage, reply], user)).toEqual([{ id: 'admin', name: 'Admin' }]);
  expect(chatChannelMessages([shared, privateMessage, reply], user, 'administrator:admin')).toEqual([privateMessage, reply]);
  expect(chatChannelMessages([shared, privateMessage, reply], user, 'leader')).toEqual([shared]);
});
test('leader cannot see private messages even if they were accidentally supplied by a client cache', () => {
  expect(chatChannelMessages([shared, privateMessage, reply], { id: 'leader', role: 'consulta' }, 'leader')).toEqual([shared]);
});

test('each leader sees only their own pair, including when the client receives another conversation', () => {
  const other = { ...shared, sender_id: 'leader-b', message: 'Other leader' };
  expect(chatChannelMessages([shared, other], { id: 'leader', role: 'consulta' }, 'leader')).toEqual([shared]);
  expect(chatChannelMessages([shared, other], { id: 'leader-b', role: 'consulta' }, 'leader')).toEqual([other]);
});

test('an ordinary leader cannot choose an administrator as a new recipient', () => {
  const adminMessage = { sender_id: 'admin', sender_name: 'Admin', recipient_id: 'leader', recipient_type: 'leader', private_channel: true, channel_kind: 'admin_leader' };
  const leader = { id: 'leader', role: 'consulta' };
  expect(planningChatPeers([adminMessage], leader)).toEqual([]);
  expect(chatChannelMessages([shared, adminMessage], leader, 'leader')).toEqual([shared]);
  expect(chatChannelMessages([shared, adminMessage], leader, 'administrator:admin')).toEqual([adminMessage]);
});
