import React, { createContext, useState, useContext, useEffect, useCallback, useMemo, useRef } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);
const SESSION_IDLE_TIMEOUT_MS = Number(process.env.REACT_APP_SESSION_IDLE_TIMEOUT_MS || 10 * 60 * 1000);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSessionTimeoutModal, setShowSessionTimeoutModal] = useState(false);
  const timeoutModalShownRef = useRef(false);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  const confirmRelogin = useCallback(() => {
    timeoutModalShownRef.current = false;
    setShowSessionTimeoutModal(false);
    logout();
  }, [logout]);

  const cancelSessionTimeout = useCallback(() => {
    timeoutModalShownRef.current = false;
    setShowSessionTimeoutModal(false);
    authService.touchSessionActivity();
  }, []);

  const touchActivity = useCallback(() => {
    if (!authService.isAuthenticated()) return;
    authService.touchSessionActivity();
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrapAuth = async () => {
      const localUser = authService.getCurrentUser();
      if (mounted) setUser(localUser);

      if (!authService.isAuthenticated()) {
        if (mounted) setLoading(false);
        return;
      }

      // Conserva el inicio real de sesión y completa timestamps faltantes.
      authService.syncSessionTimestamps();
      authService.touchSessionActivity();

      try {
        const profile = await authService.getProfile();
        if (mounted && profile?.success && profile?.data?.user) {
          setUser(profile.data.user);
        }
      } catch (_error) {
        if (mounted && !localUser) {
          // Si el backend no responde o el token expiro, evitamos bloqueo infinito.
          authService.logout();
          setUser(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    bootstrapAuth();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user || !authService.isAuthenticated()) return undefined;

    // Conserva la fecha real de login para poder forzar reautenticación
    // después del tiempo máximo permitido.
    authService.syncSessionTimestamps();
    authService.touchSessionActivity();

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    const onActivity = () => touchActivity();
    events.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));

    const checkSession = () => {
      if (timeoutModalShownRef.current) return;
      const now = Date.now();
      const { lastActivityAt } = authService.getSessionMeta();
      const safeLastActivityAt = lastActivityAt || now;

      const idleExceeded = now - safeLastActivityAt > SESSION_IDLE_TIMEOUT_MS;
      if (idleExceeded) {
        timeoutModalShownRef.current = true;
        setShowSessionTimeoutModal(true);
      }
    };

    const intervalId = window.setInterval(checkSession, 30 * 1000);
    document.addEventListener('visibilitychange', checkSession);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', checkSession);
      events.forEach((evt) => window.removeEventListener(evt, onActivity));
    };
  }, [user, logout, touchActivity]);

  const loginWithGoogle = async (credential) => {
    try {
      const response = await authService.loginWithGoogle(credential);
      if (response.success) {
        setUser(response.data.user);
        return {
          success: true,
          message: response.message
        };
      }
      return { success: false, message: response.message };
    } catch (error) {
      const backendMessage = String(error.response?.data?.message || '').trim();
      const backendDetail = String(error.response?.data?.detail || '').trim();
      const composed = [backendMessage, backendDetail].filter(Boolean).join(' | ');
      return { success: false, message: composed || 'Error al iniciar sesion con Google' };
    }
  };

  const hydrateFromToken = async () => {
    try {
      if (!authService.isAuthenticated()) {
        return { success: false, message: 'Token no disponible' };
      }
      const profile = await authService.getProfile();
      if (profile?.success && profile?.data?.user) {
        authService.ensureSessionStart();
        authService.touchSessionActivity();
        setUser(profile.data.user);
        return { success: true };
      }
      return { success: false, message: 'No fue posible recuperar perfil' };
    } catch (error) {
      authService.logout();
      setUser(null);
      return { success: false, message: error.response?.data?.message || 'Token invalido' };
    }
  };

  const hasAnyRole = (roles = []) => roles.includes(user?.role);

  // Optimizamos el valor del contexto con useMemo para evitar re-renderizados
  const value = useMemo(() => ({
    user, loading, loginWithGoogle, hydrateFromToken, logout,
    isAuthenticated: () => !!user,
    isAdmin: () => user?.role === 'administrador',
    hasAnyRole,
    showSessionTimeoutModal,
    confirmRelogin,
    cancelSessionTimeout,
  }), [user, loading, logout, showSessionTimeoutModal, confirmRelogin, cancelSessionTimeout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
