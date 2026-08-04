import React from 'react';
import { Box, IconButton, Paper, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { SnackbarContent, useSnackbar } from 'notistack';

const snackbarStyles = {
  success: {
    title: 'Proceso completado',
    icon: CheckCircleRoundedIcon,
    accent: '#16a34a',
    soft: '#f0fdf4',
    iconBg: '#dcfce7',
  },
  error: {
    title: 'No fue posible completar la acción',
    icon: ErrorRoundedIcon,
    accent: '#dc2626',
    soft: '#fef2f2',
    iconBg: '#fee2e2',
  },
  warning: {
    title: 'Atención',
    icon: WarningAmberRoundedIcon,
    accent: '#d97706',
    soft: '#fffbeb',
    iconBg: '#fef3c7',
  },
  info: {
    title: 'Información',
    icon: InfoRoundedIcon,
    accent: '#2563eb',
    soft: '#eff6ff',
    iconBg: '#dbeafe',
  },
  default: {
    title: 'Notificación',
    icon: InfoRoundedIcon,
    accent: '#475569',
    soft: '#f8fafc',
    iconBg: '#e2e8f0',
  },
};

const AppSnackbar = React.forwardRef(function AppSnackbar(props, ref) {
  const { closeSnackbar } = useSnackbar();
  const { id, message, variant = 'default', style } = props;
  const appearance = snackbarStyles[variant] || snackbarStyles.default;
  const StatusIcon = appearance.icon;

  return (
    <SnackbarContent
      ref={ref}
      role="alert"
      style={style}
      sx={{
        width: 'min(560px, calc(100vw - 32px))',
        minWidth: 'unset !important',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
          width: '100%',
          px: { xs: 2, sm: 2.5 },
          py: 1.75,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: `${appearance.accent}33`,
          borderRadius: 2.5,
          bgcolor: appearance.soft,
          boxShadow: '0 18px 45px rgba(15, 23, 42, 0.18)',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: '0 auto 0 0',
            width: 5,
            bgcolor: appearance.accent,
          },
        }}
      >
        <Box
          sx={{
            display: 'grid',
            placeItems: 'center',
            width: 38,
            height: 38,
            flexShrink: 0,
            borderRadius: '50%',
            color: appearance.accent,
            bgcolor: appearance.iconBg,
          }}
        >
          <StatusIcon sx={{ fontSize: 22 }} />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0, pt: 0.1 }}>
          <Typography sx={{ color: '#0f172a', fontSize: 14, fontWeight: 800, lineHeight: 1.35 }}>
            {appearance.title}
          </Typography>
          <Typography sx={{ mt: 0.35, color: '#475569', fontSize: 13.5, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
            {message}
          </Typography>
        </Box>

        <IconButton
          aria-label="Cerrar notificación"
          size="small"
          onClick={() => closeSnackbar(id)}
          sx={{ mt: -0.5, mr: -0.75, color: '#64748b', '&:hover': { bgcolor: `${appearance.accent}14` } }}
        >
          <CloseRoundedIcon sx={{ fontSize: 19 }} />
        </IconButton>
      </Paper>
    </SnackbarContent>
  );
});

export default AppSnackbar;
