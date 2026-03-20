import React from 'react';
import { Chip } from '@mui/material';

const PALETTE = {
  ALTO: { bg: '#ecfdf5', fg: '#047857', border: '#a7f3d0' },
  MEDIO: { bg: '#fffbeb', fg: '#b45309', border: '#fde68a' },
  CRITICO: { bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca' }
};

function BadgeEstado({ estado = 'CRITICO', label }) {
  const palette = PALETTE[estado] || PALETTE.CRITICO;
  return (
    <Chip
      size="small"
      label={label || estado}
      sx={{
        bgcolor: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        fontWeight: 800
      }}
    />
  );
}

export default BadgeEstado;
