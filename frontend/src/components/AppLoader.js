import React from 'react';
import { Box, Typography } from '@mui/material';
import { School as SchoolIcon } from '@mui/icons-material';

/* ── Full-screen app initialization loader ── */
function AppLoader({ fadeOut }) {
  return (
    <Box sx={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#060e1a',
      opacity: fadeOut ? 0 : 1,
      transition: 'opacity 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
      pointerEvents: fadeOut ? 'none' : 'all',
      userSelect: 'none'
    }}>

      {/* Background gradient overlays */}
      <Box sx={{
        position: 'absolute',
        inset: 0,
        background: `
          linear-gradient(135deg, rgba(6,14,26,0.95) 0%, rgba(10,28,56,0.8) 40%, rgba(15,45,87,0.5) 70%, rgba(25,65,120,0.35) 100%),
          radial-gradient(ellipse at 20% 80%, rgba(29,78,216,0.2) 0%, transparent 60%),
          radial-gradient(ellipse at 80% 20%, rgba(124,58,237,0.15) 0%, transparent 50%)
        `,
        animation: 'loaderBgPulse 5s ease-in-out infinite alternate',
        '@keyframes loaderBgPulse': {
          '0%': { opacity: 0.8 },
          '100%': { opacity: 1 }
        }
      }} />

      {/* Animated mesh */}
      <Box sx={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(circle at 15% 85%, rgba(59,130,246,0.18) 0%, transparent 40%),
          radial-gradient(circle at 85% 15%, rgba(139,92,246,0.14) 0%, transparent 35%)
        `,
        animation: 'meshShift 7s ease-in-out infinite alternate',
        '@keyframes meshShift': {
          '0%': { transform: 'scale(1)', opacity: 0.7 },
          '100%': { transform: 'scale(1.08)', opacity: 1 }
        }
      }} />

      {/* ── Main spinner ── */}
      <Box sx={{ position: 'relative', width: 130, height: 130, mb: 4.5, zIndex: 1 }}>

        {/* Outer ring */}
        <Box sx={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '3px solid transparent',
          borderTopColor: '#3b82f6',
          borderRightColor: 'rgba(59,130,246,0.12)',
          animation: 'loaderRing1 2.4s linear infinite',
          '@keyframes loaderRing1': {
            from: { transform: 'rotate(0deg)' },
            to: { transform: 'rotate(360deg)' }
          }
        }} />

        {/* Middle ring – counter-clockwise */}
        <Box sx={{
          position: 'absolute', inset: 15, borderRadius: '50%',
          border: '2.5px solid transparent',
          borderTopColor: '#7c3aed',
          borderLeftColor: 'rgba(124,58,237,0.12)',
          animation: 'loaderRing2 1.7s linear infinite reverse',
          '@keyframes loaderRing2': {
            from: { transform: 'rotate(0deg)' },
            to: { transform: 'rotate(360deg)' }
          }
        }} />

        {/* Inner ring */}
        <Box sx={{
          position: 'absolute', inset: 30, borderRadius: '50%',
          border: '2px solid transparent',
          borderTopColor: '#ec4899',
          borderBottomColor: 'rgba(236,72,153,0.08)',
          animation: 'loaderRing3 1.1s linear infinite',
          '@keyframes loaderRing3': {
            from: { transform: 'rotate(0deg)' },
            to: { transform: 'rotate(360deg)' }
          }
        }} />

        {/* Glow halo */}
        <Box sx={{
          position: 'absolute', inset: -8, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
          animation: 'loaderHalo 2s ease-in-out infinite alternate',
          '@keyframes loaderHalo': {
            '0%': { transform: 'scale(0.95)', opacity: 0.6 },
            '100%': { transform: 'scale(1.05)', opacity: 1 }
          }
        }} />

        {/* Core circle */}
        <Box sx={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Box sx={{
            width: 50, height: 50, borderRadius: '50%',
            background: 'linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'loaderCorePulse 1.6s ease-in-out infinite alternate',
            boxShadow: '0 0 25px rgba(29,78,216,0.55)',
            '@keyframes loaderCorePulse': {
              from: { transform: 'scale(0.88)', boxShadow: '0 0 18px rgba(29,78,216,0.35)' },
              to: { transform: 'scale(1.06)', boxShadow: '0 0 42px rgba(29,78,216,0.75)' }
            }
          }}>
            <SchoolIcon sx={{ fontSize: 24, color: '#fff' }} />
          </Box>
        </Box>
      </Box>

      {/* ── Branding text ── */}
      <Box sx={{
        zIndex: 1, textAlign: 'center',
        animation: 'loaderTextIn 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        '@keyframes loaderTextIn': {
          '0%': { opacity: 0, transform: 'translateY(14px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' }
        }
      }}>
        <Typography sx={{
          fontFamily: '"Montserrat", "Segoe UI", sans-serif',
          fontWeight: 800,
          fontSize: { xs: '1.35rem', sm: '1.55rem' },
          color: '#ffffff',
          letterSpacing: -0.4,
          mb: 0.5,
          textShadow: '0 2px 20px rgba(0,0,0,0.5)'
        }}>
          Sistemas de Gestión
        </Typography>

        <Typography sx={{
          fontFamily: '"Montserrat", "Segoe UI", sans-serif',
          fontWeight: 700,
          fontSize: '0.82rem',
          color: '#60a5fa',
          letterSpacing: 2.5,
          textTransform: 'uppercase',
          mb: 3.5
        }}>
          por Procesos
        </Typography>

        {/* Animated dots indicator */}
        <Box sx={{ display: 'flex', gap: '9px', alignItems: 'center', justifyContent: 'center', mb: 1.5 }}>
          {[0, 1, 2, 3].map((i) => (
            <Box key={i} sx={{
              width: 7, height: 7, borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #7c3aed)',
              animation: 'loaderDot 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.22}s`,
              '@keyframes loaderDot': {
                '0%, 80%, 100%': { transform: 'scale(0.55)', opacity: 0.35 },
                '40%': { transform: 'scale(1)', opacity: 1 }
              }
            }} />
          ))}
        </Box>

        <Typography sx={{
          fontFamily: '"Montserrat", "Segoe UI", sans-serif',
          color: 'rgba(148,163,184,0.75)',
          fontSize: 12.5,
          letterSpacing: 0.5
        }}>
          Inicializando sistema…
        </Typography>
      </Box>

      {/* Subtle bottom accent line */}
      <Box sx={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        background: 'linear-gradient(90deg, #1d4ed8 0%, #7c3aed 50%, #ec4899 100%)',
        animation: 'loaderBarPulse 2s ease-in-out infinite alternate',
        '@keyframes loaderBarPulse': {
          '0%': { opacity: 0.5 },
          '100%': { opacity: 1 }
        }
      }} />
    </Box>
  );
}

export default AppLoader;
