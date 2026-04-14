import api from './api';

const userService = {
  // Listar usuarios
  getUsers: async (params = {}) => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  // Crear usuario
  createUser: async (userData) => {
    const response = await api.post('/users', userData);
    return response.data;
  },

  // Actualizar usuario
  updateUser: async (id, userData) => {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
  },

  // Eliminar usuario
  deleteUser: async (id) => {
    const response = await api.delete(`/users/${id}`, { timeout: 15000 });
    return response.data;
  },

  // Cambiar estado (activo/inactivo)
  updateStatus: async (id, estado) => {
    const response = await api.patch(`/users/${id}/status`, { estado });
    return response.data;
  },

  // Descargar plantilla de carga masiva
  downloadTemplate: async () => {
    const response = await api.get('/users/template', { responseType: 'blob' });
    return response.data;
  },

  // Permisos de módulos por usuario
  getModulePermissions: async (id) => {
    const response = await api.get(`/users/${id}/module-permissions`);
    return response.data;
  },

  updateModulePermissions: async (id, payload) => {
    const response = await api.put(`/users/${id}/module-permissions`, payload);
    return response.data;
  },

  // Carga masiva
  bulkUpload: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/users/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // No se usa recuperación de contraseña en este flujo
};

export default userService;
