import React from 'react';
import { Paper, Stack, Typography } from '@mui/material';
import BadgeEstado from './BadgeEstado';

const formatNumber = (value, digits = 2) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

function ResumenCobertura({ coverage }) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #ddd6fe', bgcolor: '#faf5ff' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
        <Stack spacing={0.5}>
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Resumen Cobertura
          </Typography>
          <Typography sx={{ fontSize: 14, color: '#475569' }}>
            {`${coverage?.estudiantes_con_match || 0} con match de ${coverage?.total_estudiantes || 0} estudiantes`}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1.2} alignItems="center" flexWrap="wrap">
          <Typography sx={{ fontSize: 22, fontWeight: 900, color: '#312e81' }}>
            {formatNumber(coverage?.porcentaje_cobertura || 0)}%
          </Typography>
          <BadgeEstado estado={coverage?.estado_cobertura} label={coverage?.etiqueta_cobertura || 'NO REPRESENTATIVO'} />
        </Stack>
      </Stack>
    </Paper>
  );
}

export default ResumenCobertura;
