import React from 'react';
import { Paper, Typography } from '@mui/material';

function CardKPI({ label, value, tone = '#2563eb', helper = null }) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #dbe6f5', minHeight: 112 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </Typography>
      <Typography sx={{ mt: 0.8, fontSize: 26, fontWeight: 900, color: tone, lineHeight: 1.1 }}>
        {value}
      </Typography>
      {helper ? (
        <Typography sx={{ mt: 0.8, fontSize: 12, color: '#64748b' }}>
          {helper}
        </Typography>
      ) : null}
    </Paper>
  );
}

export default CardKPI;
