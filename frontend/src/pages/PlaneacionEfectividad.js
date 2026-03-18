import React from 'react';
import { Box, Paper, Typography, Stack, Fade, Chip } from '@mui/material';
import { Timeline as TimelineIcon } from '@mui/icons-material';

function PlaneacionEfectividad() {
  return (
    <Fade in={true}>
      <Box>
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1 }}>
            <TimelineIcon sx={{ color: '#1d4ed8' }} />
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b' }}>
              Planeación y Efectividad
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            Submódulo en construcción.
          </Typography>
        </Box>

        <Paper elevation={0} sx={{ p: 4, border: '1px solid #e2e8f0', borderRadius: 3 }}>
          <Chip label="En construcción" color="warning" sx={{ mb: 2 }} />
          <Typography sx={{ color: '#475569' }}>
            Próximamente: planes de acción, seguimiento al plan estratégico, indicadores y reportes exportables.
          </Typography>
        </Paper>
      </Box>
    </Fade>
  );
}

export default PlaneacionEfectividad;
