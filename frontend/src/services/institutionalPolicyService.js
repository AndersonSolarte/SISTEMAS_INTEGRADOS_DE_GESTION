import api from './api';
const root = '/politicas-institucionales';
const institutionalPolicyService = {
  list: () => api.get(root).then((response) => response.data.data),
  template: () => api.get(`${root}/plantilla`, { responseType: 'blob' }),
  export: (format = 'xlsx') => api.get(`${root}/exportar`, { params: { format }, responseType: 'blob' }),
  import: (file) => {
    const data = new FormData();
    data.append('file', file);
    return api.post(`${root}/importar`, data, { timeout: 0 }).then((response) => response.data);
  }
};
export default institutionalPolicyService;
