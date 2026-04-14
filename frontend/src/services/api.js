import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: Number(process.env.REACT_APP_API_TIMEOUT_MS || 10000),
  paramsSerializer: (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      if (Array.isArray(value)) {
        value
          .map((item) => String(item ?? '').trim())
          .filter(Boolean)
          .forEach((item) => searchParams.append(key, item));
        return;
      }
      searchParams.append(key, String(value));
    });
    return searchParams.toString();
  }
});

const HTTP_STATUS_MESSAGES = {
  400: 'Solicitud inválida',
  401: 'Sesión expirada o no autenticada',
  403: 'No tienes permisos para esta acción',
  404: 'Recurso no encontrado',
  405: 'Método no permitido',
  409: 'Conflicto de datos',
  413: 'Archivo o carga demasiado grande',
  415: 'Tipo de archivo no soportado',
  422: 'Datos invalidos para procesar',
  429: 'Demasiadas solicitudes, intenta mas tarde',
  500: 'Error interno del servidor',
  502: 'Error de comunicacion con el servidor',
  503: 'Servicio temporalmente no disponible',
  504: 'Tiempo de espera agotado en el servidor'
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    if (error?.response && !error.response.data?.message) {
      const status = Number(error.response.status) || 500;
      const fallbackMessage = HTTP_STATUS_MESSAGES[status] || 'Error de comunicacion con la API';
      error.response.data = { ...(error.response.data || {}), message: fallbackMessage };
    }

    return Promise.reject(error);
  }
);

export default api;
