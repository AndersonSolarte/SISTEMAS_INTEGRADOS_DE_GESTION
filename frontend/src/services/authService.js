import api from './api';

const SESSION_LOGIN_AT_KEY = 'session_login_at';
const SESSION_LAST_ACTIVITY_KEY = 'session_last_activity_at';

const touchSessionTimestamps = () => {
  const now = Date.now().toString();
  if (!localStorage.getItem(SESSION_LOGIN_AT_KEY)) {
    localStorage.setItem(SESSION_LOGIN_AT_KEY, now);
  }
  localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, now);
};

const authService = {
  setToken: (token) => {
    if (!token) return;
    localStorage.setItem('token', String(token));
    touchSessionTimestamps();
  },

  loginWithGoogle: async (credential) => {
    const response = await api.post('/auth/google', { credential });
    if (response.data.success && response.data.data.token) {
      localStorage.setItem('token', response.data.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
      touchSessionTimestamps();
    }
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile');
    if (response.data.success && response.data.data?.user) {
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
    }
    return response.data;
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem(SESSION_LOGIN_AT_KEY);
    localStorage.removeItem(SESSION_LAST_ACTIVITY_KEY);
  },
  
  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch (_error) {
      // Evita romper la app si localStorage quedó con HTML/texto inválido.
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      return null;
    }
  },
  
  isAuthenticated: () => !!localStorage.getItem('token'),
  
  isAdmin: () => {
    const user = authService.getCurrentUser();
    return user && user.role === 'administrador';
  },

  updateCurrentUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user));
  },

  touchSessionActivity: () => {
    localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, Date.now().toString());
  },

  ensureSessionStart: () => {
    if (!localStorage.getItem(SESSION_LOGIN_AT_KEY)) {
      localStorage.setItem(SESSION_LOGIN_AT_KEY, Date.now().toString());
    }
  },

  // Siempre resetea loginAt y lastActivityAt a "ahora".
  // Usar al montar el monitor de sesión para evitar que timestamps
  // viejos de localStorage disparen el modal de expiración de inmediato.
  resetSessionStart: () => {
    const now = Date.now().toString();
    localStorage.setItem(SESSION_LOGIN_AT_KEY, now);
    localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, now);
  },

  getSessionMeta: () => ({
    loginAt: Number(localStorage.getItem(SESSION_LOGIN_AT_KEY) || 0),
    lastActivityAt: Number(localStorage.getItem(SESSION_LAST_ACTIVITY_KEY) || 0)
  })
};

export default authService;
