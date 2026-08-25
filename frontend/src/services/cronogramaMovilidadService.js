import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
};

const cronogramaMovilidadService = {
  crearOBorrador: async (data) => {
    const res = await axios.post(`${API_URL}/cronograma-movilidad`, data, getAuthHeaders());
    return res.data;
  },

  obtenerCronogramas: async (params = {}) => {
    const res = await axios.get(`${API_URL}/cronograma-movilidad`, { ...getAuthHeaders(), params });
    return res.data;
  },

  obtenerPorId: async (id) => {
    const res = await axios.get(`${API_URL}/cronograma-movilidad/${id}`, getAuthHeaders());
    return res.data;
  },

  actualizarCronograma: async (id, data) => {
    const res = await axios.put(`${API_URL}/cronograma-movilidad/${id}`, data, getAuthHeaders());
    return res.data;
  },

  eliminarCronograma: async (id) => {
    const res = await axios.delete(`${API_URL}/cronograma-movilidad/${id}`, getAuthHeaders());
    return res.data;
  },

  radicarCronograma: async (id) => {
    const res = await axios.post(`${API_URL}/cronograma-movilidad/${id}/radicar`, {}, getAuthHeaders());
    return res.data;
  },

  vistoBuenoAcademica: async (id) => {
    const res = await axios.post(`${API_URL}/cronograma-movilidad/${id}/visto-bueno-academica`, {}, getAuthHeaders());
    return res.data;
  },

  devolverACorreccion: async (id, observaciones) => {
    const res = await axios.post(`${API_URL}/cronograma-movilidad/${id}/devolver-correccion`, { observaciones }, getAuthHeaders());
    return res.data;
  },

  aprobarFinanciera: async (id) => {
    const res = await axios.post(`${API_URL}/cronograma-movilidad/${id}/aprobar-financiera`, {}, getAuthHeaders());
    return res.data;
  },

  buscarEstudiantesMatriculados: async (query, programa) => {
    const res = await axios.get(`${API_URL}/cronograma-movilidad/estudiantes/buscar`, {
      ...getAuthHeaders(),
      params: { query, programa }
    });
    return res.data;
  },

  buscarResponsables: async (query, dependencia) => {
    const res = await axios.get(`${API_URL}/cronograma-movilidad/responsables/buscar`, {
      ...getAuthHeaders(),
      params: { query, dependencia }
    });
    return res.data;
  },

  misActividadesAsignadas: async () => {
    const res = await axios.get(`${API_URL}/cronograma-movilidad/mis-actividades`, getAuthHeaders());
    return res.data;
  },

  marcarActividadCumplida: async (idActividad) => {
    const res = await axios.post(`${API_URL}/cronograma-movilidad/actividades/${idActividad}/cumplir`, {}, getAuthHeaders());
    return res.data;
  }
};

export default cronogramaMovilidadService;
