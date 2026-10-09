import React, { useMemo } from 'react';
import { Alert, Box, Button, Fade, Paper, Stack, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import JuridicaWorkflowPanel from './JuridicaWorkflowPanel';
import { ROLES } from '../../constants/roles';

const normalizePermissions = (raw) => {
  if (!raw) return [];
  if (typeof raw === 'string') return [raw];
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => typeof item === 'string' ? item : item?.module_key || item?.moduleKey || item?.key || '').filter(Boolean);
};

export default function OficinaJuridicaLandingPage({ user, onBack }) {
  const hasAccess = useMemo(() => {
    if (!user) return false;
    if (user.role === ROLES.ADMINISTRADOR) return true;
    const permissions = [
      ...normalizePermissions(user.allowedModules), ...normalizePermissions(user.modulePermissions),
      ...normalizePermissions(user.permissions?.modules), ...normalizePermissions(user.modules)
    ];
    return permissions.includes('oficina_juridica');
  }, [user]);

  if (!hasAccess) return <Fade in><Stack spacing={2.5}>
    <Button startIcon={<ArrowBackRoundedIcon />} onClick={onBack} sx={{ alignSelf: 'flex-start', fontWeight: 800 }}>Volver</Button>
    <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: '1.5px dashed #fca5a5', bgcolor: '#fff5f5', textAlign: 'center' }}>
      <LockOutlinedIcon sx={{ fontSize: 48, color: '#dc2626', mb: 1.5 }} />
      <Typography variant="h5" fontWeight={900} color="#991b1b">Acceso restringido</Typography>
      <Alert severity="warning" sx={{ maxWidth: 720, mx: 'auto', mt: 2, textAlign: 'left' }}>Un administrador debe habilitar el permiso “Oficina Jurídica” en Gestión de Usuarios.</Alert>
    </Paper>
  </Stack></Fade>;

  return <Fade in timeout={250}><Box>
    <Button startIcon={<ArrowBackRoundedIcon />} onClick={onBack} sx={{ mb: 1.5, fontWeight: 850, color: '#334155' }}>Volver a tableros estadísticos</Button>
    <JuridicaWorkflowPanel />
  </Box></Fade>;
}
