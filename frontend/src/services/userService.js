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
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },

  // Cambiar estado (activo/inactivo)
  updateStatus: async (id, estado) => {
    const response = await api.patch(`/users/${id}/status`, { estado });
    return response.data;
  },

  // Resetear contraseña temporal por admin
  resetTempPassword: async (id) => {
    const response = await api.post(`/users/${id}/reset-temp-password`);
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

  // Solicitar recuperación de contraseña
  requestPasswordReset: async (email) => {
    const response = await api.post('/users/request-password-reset', { email });
    return response.data;
  },

  // Restablecer contraseña
  resetPassword: async (token, newPassword) => {
    const response = await api.post('/users/reset-password', { token, newPassword });
    return response.data;
  }
};

export default userService;
