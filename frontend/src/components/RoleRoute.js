import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Box, Typography, Paper } from '@mui/material';
import { Block as BlockIcon } from '@mui/icons-material';

const normalizePermissionList = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x || '').trim()).filter(Boolean);
};

function RoleRoute({ children, allowedRoles = [], permissionKey = null, deniedRoles = [] }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const menuPermissions = normalizePermissionList(user?.menuPermissions);
  const hasExplicitPermission = permissionKey ? menuPermissions.includes(permissionKey) : false;
  const isDenied = deniedRoles.includes(user.role);
  const hasAccess = !isDenied && (allowedRoles.includes(user.role) || hasExplicitPermission);

  if (!hasAccess) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
        <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: 3, maxWidth: 520 }}>
          <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', mb: 3 }}>
            <BlockIcon sx={{ fontSize: 40, color: '#ef4444' }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
            Acceso Restringido
          </Typography>
          <Typography variant="body1" sx={{ color: '#64748b' }}>
            Tu usuario no tiene permisos para este módulo.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return children;
}

export default RoleRoute;
