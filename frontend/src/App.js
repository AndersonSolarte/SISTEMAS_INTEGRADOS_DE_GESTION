import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { SnackbarProvider } from 'notistack';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import DashboardLayout from './components/DashboardLayout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import FirstAccessPassword from './pages/FirstAccessPassword';
import Dashboard from './pages/Dashboard';
import AseguramientoCalidad from './pages/AseguramientoCalidad';
import GestionUsuarios from './pages/GestionUsuarios';
import GestionDocumentos from './pages/GestionDocumentos';
import MapaProcesos from './pages/MapaProcesos';

const theme = createTheme({ 
  palette: { 
    primary: { main: '#3b82f6' },
    secondary: { main: '#8b5cf6' }
  } 
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <AuthProvider>
          <Router>
            <Routes>
              {/* Rutas públicas */}
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
              <Route path="/primer-acceso" element={<PrivateRoute><FirstAccessPassword /></PrivateRoute>} />
              
              {/* Rutas protegidas */}
              <Route path="/dashboard" element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="aseguramiento-calidad" element={<AseguramientoCalidad />} />
                <Route path="buscar-documentos" element={<AseguramientoCalidad />} />
                
                {/* Rutas solo para administrador */}
                <Route path="gestion-usuarios" element={<AdminRoute><GestionUsuarios /></AdminRoute>} />
                <Route path="gestion-documentos" element={<AdminRoute><GestionDocumentos /></AdminRoute>} />
                
                {/* Ruta legado */}
                <Route path="mapa-procesos" element={<MapaProcesos />} />
              </Route>
              
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Router>
        </AuthProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;
