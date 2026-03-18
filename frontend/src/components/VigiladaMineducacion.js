import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * Marca de agua oficial "Vigilada MINEDUCACIÓN"
 * Diseñada para ser discreta — funciona como marca de agua institucional.
 * variant: 'dark'  → fondos oscuros (sidebar, panel login)
 * variant: 'light' → fondos claros (tarjeta login)
 */
export default function VigiladaMineducacion({ variant = 'dark', size = 'sm' }) {
  const isDark  = variant === 'dark';
  const isMd    = size === 'md';
  const opacity = isDark ? 0.28 : 0.2;

  return (
    <Box sx={{
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '2px',
      opacity,
      userSelect: 'none',
      pointerEvents: 'none',
      transition: 'opacity 0.3s ease',
      '&:hover': { opacity: isDark ? 0.5 : 0.38 },
    }}>

      {/* Línea superior con gradiente */}
      <Box sx={{
        width: isMd ? 110 : 80,
        height: '0.5px',
        background: isDark
          ? 'linear-gradient(90deg,transparent,rgba(148,197,253,0.55),transparent)'
          : 'linear-gradient(90deg,transparent,rgba(29,78,216,0.35),transparent)',
        mb: '2px',
        animation: 'vigiladaLine 3s ease-in-out infinite alternate',
        '@keyframes vigiladaLine': {
          '0%':   { opacity: 0.4 },
          '100%': { opacity: 1   }
        }
      }} />

      {/* Texto */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        <Typography sx={{
          fontSize: isMd ? 6.5 : 5.5,
          fontWeight: 500,
          color: isDark ? 'rgba(148,197,253,0.9)' : 'rgba(71,85,105,0.85)',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          lineHeight: 1.3,
          fontFamily: '"Montserrat","Segoe UI",sans-serif',
        }}>
          ✦ Vigilada
        </Typography>
        <Typography sx={{
          fontSize: isMd ? 9.5 : 8,
          fontWeight: 800,
          color: isDark ? 'rgba(191,219,254,0.95)' : 'rgba(29,78,216,0.8)',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          lineHeight: 1.1,
          fontFamily: '"Montserrat","Segoe UI",sans-serif',
        }}>
          Mineducación
        </Typography>
      </Box>
    </Box>
  );
}
