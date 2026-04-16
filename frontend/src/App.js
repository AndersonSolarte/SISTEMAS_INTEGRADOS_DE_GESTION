import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { SnackbarProvider } from 'notistack';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import RoleRoute from './components/RoleRoute';
import DashboardLayout from './components/DashboardLayout';
import AppLoader from './components/AppLoader';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AseguramientoCalidad from './pages/AseguramientoCalidad';
import GestionUsuarios from './pages/GestionUsuarios';
import GestionDocumentos from './pages/GestionDocumentos';
import MapaProcesos from './pages/MapaProcesos';
import PlaneacionEstrategica from './pages/PlaneacionEstrategica';
import PlaneacionEfectividad from './pages/PlaneacionEfectividad';
import Autoevaluacion from './pages/Autoevaluacion';
import GestionInformacion from './pages/GestionInformacion';
import SessionTimeoutModal from './components/SessionTimeoutModal';
import { ROLES } from './constants/roles';

/* Tiempo mínimo que el loader permanece visible antes de iniciar el fade-out */
const MIN_LOADER_MS = 3500;

/* ── Inner wrapper: consumes AuthContext to drive the loading screen ── */
function AppContent({ children }) {
  const { loading } = useAuth();
  const [showLoader, setShowLoader] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const startRef = React.useRef(Date.now());

  useEffect(() => {
    if (!loading && showLoader) {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, MIN_LOADER_MS - elapsed);
      const t1 = setTimeout(() => setFadeOut(true), remaining);
      const t2 = setTimeout(() => setShowLoader(false), remaining + 560);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [loading, showLoader]);

  return (
    <>
      {showLoader && <AppLoader fadeOut={fadeOut} />}
      {children}
    </>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3} autoHideDuration={2500} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <AuthProvider>
          <SessionTimeoutModal />
          <AppContent>
            <Router>
              <Routes>
                {/* Rutas públicas */}
                <Route path="/login" element={<Login />} />

                {/* Rutas protegidas */}
                <Route path="/dashboard" element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
                  <Route index element={<Dashboard />} />
                  <Route
                    path="aseguramiento-calidad"
                    element={(
                      <RoleRoute
                        allowedRoles={[ROLES.ADMINISTRADOR]}
                        permissionKey="aseguramiento_calidad"
                      >
                        <AseguramientoCalidad />
                      </RoleRoute>
                    )}
                  />
                  <Route
                    path="buscar-documentos"
                    element={(
                      <RoleRoute
                        allowedRoles={[
                          ROLES.ADMINISTRADOR,
                          ROLES.GESTION_PROCESOS,
                          ROLES.PLANEACION_ESTRATEGICA,
                          ROLES.PLANEACION_EFECTIVIDAD,
                          ROLES.AUTOEVALUACION,
                          ROLES.GESTION_INFORMACION,
                          ROLES.CONSULTA
                        ]}
                        permissionKey="buscar_documentos"
                      >
                        <AseguramientoCalidad />
                      </RoleRoute>
                    )}
                  />
                  <Route
                    path="planeacion-estrategica"
                    element={
                      <RoleRoute
                        allowedRoles={[ROLES.ADMINISTRADOR, ROLES.PLANEACION_ESTRATEGICA]}
                        permissionKey="planeacion_estrategica"
                      >
                        <PlaneacionEstrategica />
                      </RoleRoute>
                    }
                  />
                  <Route
                    path="planeacion-efectividad"
                    element={
                      <RoleRoute
                        allowedRoles={[ROLES.ADMINISTRADOR, ROLES.PLANEACION_ESTRATEGICA, ROLES.PLANEACION_EFECTIVIDAD]}
                        permissionKey="planeacion_efectividad"
                      >
                        <PlaneacionEfectividad />
                      </RoleRoute>
                    }
                  />
                  <Route
                    path="autoevaluacion"
                    element={
                      <RoleRoute
                        allowedRoles={[ROLES.ADMINISTRADOR, ROLES.PLANEACION_ESTRATEGICA, ROLES.AUTOEVALUACION]}
                        permissionKey="autoevaluacion"
                      >
                        <Autoevaluacion />
                      </RoleRoute>
                    }
                  />
                  <Route
                    path="gestion-informacion"
                    element={
                      <RoleRoute
                        allowedRoles={[ROLES.ADMINISTRADOR, ROLES.PLANEACION_ESTRATEGICA, ROLES.PLANEACION_EFECTIVIDAD, ROLES.AUTOEVALUACION, ROLES.GESTION_INFORMACION, ROLES.GESTION_PROCESOS]}
                        permissionKey="gestion_informacion"
                      >
                        <GestionInformacion />
                      </RoleRoute>
                    }
                  />

                  {/* Rutas de administración */}
                  <Route
                    path="gestion-usuarios"
                    element={
                      <RoleRoute
                        allowedRoles={[ROLES.ADMINISTRADOR, ROLES.PLANEACION_ESTRATEGICA, ROLES.GESTION_PROCESOS]}
                        permissionKey="gestion_usuarios"
                      >
                        <GestionUsuarios />
                      </RoleRoute>
                    }
                  />
                  <Route
                    path="gestion-documentos"
                    element={(
                      <RoleRoute
                        allowedRoles={[ROLES.ADMINISTRADOR]}
                        permissionKey="gestion_documentos"
                      >
                        <GestionDocumentos />
                      </RoleRoute>
                    )}
                  />
                  {/* Ruta legado */}
                  <Route path="mapa-procesos" element={<MapaProcesos />} />
                </Route>

                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Router>
          </AppContent>
        </AuthProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;
