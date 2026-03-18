import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Box, Typography, Paper, Button } from '@mui/material';
import { Block as BlockIcon } from '@mui/icons-material';

function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'administrador') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
        <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: 3, maxWidth: 500 }}>
          <Box sx={{ 
            width: 80, 
            height: 80, 
            borderRadius: '50%', 
            bgcolor: '#fee2e2', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            margin: '0 auto',
            mb: 3
          }}>
            <BlockIcon sx={{ fontSize: 40, color: '#ef4444' }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', mb: 2 }}>
            Acceso Restringido
          </Typography>
          <Typography variant="body1" sx={{ color: '#64748b', mb: 3 }}>
            Esta sección solo está disponible para usuarios con rol de Administrador.
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => window.history.back()}
            sx={{ borderRadius: 2 }}
          >
            Volver
          </Button>
        </Paper>
      </Box>
    );
  }

  return children;
}

export default AdminRoute;