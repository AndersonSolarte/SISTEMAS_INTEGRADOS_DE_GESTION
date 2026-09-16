import api from './api';

const root = '/meeting-minutes';
const unwrap = (response) => response.data;

const meetingMinuteService = {
  getConfig: () => api.get(`${root}/config`).then(unwrap),
  updateConfig: (enabled) => api.patch(`${root}/config`, { enabled }).then(unwrap),
  lookupParticipant: (document) => api.get(`${root}/participants/lookup`, { params: { document } }).then(unwrap),
  list: () => api.get(root).then(unwrap),
  get: (id) => api.get(`${root}/${id}`).then(unwrap),
  save: (payload) => api.post(root, payload).then(unwrap),
  publish: (id, payload = {}) => api.post(`${root}/${id}/publish`, payload).then(unwrap),
  sendFinal: (id) => api.post(`${root}/${id}/send-final`).then(unwrap),
  downloadWord: (id) => api.get(`${root}/${id}/word`, { responseType: 'blob' }).then((response) => response.data),
  publicMinute: (token) => api.get(`${root}/public/${token}`, { skipAuthRedirect: true }).then(unwrap),
  requestCode: (token, payload) => api.post(`${root}/public/${token}/request-code`, payload, { skipAuthRedirect: true }).then(unwrap),
  sign: (token, payload) => api.post(`${root}/public/${token}/sign`, payload, { skipAuthRedirect: true }).then(unwrap)
};

export default meetingMinuteService;
