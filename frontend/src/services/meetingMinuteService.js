import api from './api';

const root = '/meeting-minutes';
const unwrap = (response) => response.data;

const meetingMinuteService = {
  getConfig: () => api.get(`${root}/config`).then(unwrap),
  updateConfig: (enabled) => api.patch(`${root}/config`, { enabled }).then(unwrap),
  lookupParticipant: (document) => api.get(`${root}/participants/lookup`, { params: { document } }).then(unwrap),
  listLocations: () => api.get(`${root}/locations`).then(unwrap),
  list: () => api.get(root).then(unwrap),
  get: (id) => api.get(`${root}/${id}`).then(unwrap),
  save: (payload) => api.post(root, payload).then(unwrap),
  publish: (id, payload = {}) => api.post(`${root}/${id}/publish`, payload).then(unwrap),
  getSigningAccess: (id, payload = {}) => api.post(`${root}/${id}/signing-access`, payload).then(unwrap),
  resendInvitations: (id, payload = {}) => api.post(`${root}/${id}/resend-invitations`, payload).then(unwrap),
  reopen: (id) => api.post(`${root}/${id}/reopen`).then(unwrap),
  sendFinal: (id) => api.post(`${root}/${id}/send-final`).then(unwrap),
  updateComments: (id, payload) => api.post(`${root}/${id}/comments`, payload).then(unwrap),
  getCalendarSchedule: (id) => api.get(`${root}/${id}/calendar`).then(unwrap),
  startCalendarConnection: (id) => api.post(`${root}/${id}/calendar/connect`).then(unwrap),
  disconnectCalendar: (id) => api.delete(`${root}/${id}/calendar/connection`).then(unwrap),
  checkCalendarAvailability: (id, payload) => api.post(`${root}/${id}/calendar/availability`, payload).then(unwrap),
  saveCalendarSchedule: (id, payload) => api.put(`${root}/${id}/calendar`, payload).then(unwrap),
  downloadWord: (id, params = {}) => api.get(`${root}/${id}/word`, { params, responseType: 'blob' }).then((response) => response.data),
  downloadPdf: (id, params = {}) => api.get(`${root}/${id}/pdf`, { params, responseType: 'blob' }).then((response) => response.data),
  deleteMinute: (id) => api.delete(`${root}/${id}`).then(unwrap),
  restoreMinute: (id) => api.post(`${root}/${id}/restore`).then(unwrap),
  restoreAll: () => api.post(`${root}/restore-all`).then(unwrap),
  publicMinute: (token) => api.get(`${root}/public/${encodeURIComponent(String(token || '').trim())}`, { skipAuthRedirect: true }).then(unwrap),
  googleSigningAccess: (token, payload) => api.post(`${root}/public/${encodeURIComponent(String(token || '').trim())}/google-access`, payload, { skipAuthRedirect: true }).then(unwrap),
  sign: (token, payload) => api.post(`${root}/public/${encodeURIComponent(String(token || '').trim())}/sign`, payload, { skipAuthRedirect: true }).then(unwrap)
};

export default meetingMinuteService;
