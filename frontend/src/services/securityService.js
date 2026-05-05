import api from './api';

const securityService = {
  getDashboard: () => api.get('/security/dashboard').then((response) => response.data),
  getScans: () => api.get('/security/scans').then((response) => response.data),
  runScan: () => api.post('/security/scans/run').then((response) => response.data),
  getFindings: (params = {}) => api.get('/security/findings', { params }).then((response) => response.data),
  getFinding: (id) => api.get(`/security/findings/${id}`).then((response) => response.data),
  updateStatus: (id, payload) => api.patch(`/security/findings/${id}/status`, payload).then((response) => response.data),
  assignFinding: (id, payload) => api.patch(`/security/findings/${id}/assign`, payload).then((response) => response.data),
  analyzeRemediation: (id) => api.post(`/security/findings/${id}/remediation/analyze`).then((response) => response.data),
  exportUrl: () => `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/security/reports/export`
};

export default securityService;
