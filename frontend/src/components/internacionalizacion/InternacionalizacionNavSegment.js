import React from 'react';
import { Box, Paper, Typography, Stack } from '@mui/material';
import FlightIcon from '@mui/icons-material/Flight';
import HandshakeIcon from '@mui/icons-material/Handshake';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const MOVILIDAD_GRADIENT = 'linear-gradient(135deg,#1d4ed8,#1e40af)';
const CONVENIOS_GRADIENT = 'linear-gradient(135deg,#7c3aed,#6d28d9)';

function InternacionalizacionNavSegment({ activeView, onNavigateMovilidad, onNavigateConvenios }) {
  const isMovilidad = activeView === 'movilidad';
  const isConvenios = activeView === 'convenios';

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        mb: 2.5
      }}
    >
      {/* Movilidad side */}
      <Box
        onClick={isMovilidad ? undefined : onNavigateMovilidad}
        sx={{
          p: { xs: 1.8, md: 2.5 },
          background: isMovilidad ? MOVILIDAD_GRADIENT : '#f8fafc',
          cursor: isMovilidad ? 'default' : 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.6,
          borderRight: '1px solid',
          borderColor: isMovilidad ? 'transparent' : '#e2e8f0',
          transition: 'background .2s, box-shadow .2s',
          '&:hover': isMovilidad ? {} : {
            background: '#eff6ff'
          }
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.2}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              display: 'grid',
              placeItems: 'center',
              bgcolor: isMovilidad ? 'rgba(255,255,255,0.18)' : '#dbeafe',
              flexShrink: 0
            }}
          >
            <FlightIcon sx={{ color: isMovilidad ? '#fff' : '#1d4ed8', fontSize: 20 }} />
          </Box>
          <Box flex={1} minWidth={0}>
            <Stack direction="row" alignItems="center" spacing={0.8}>
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: 13, md: 15 },
                  color: isMovilidad ? '#fff' : '#0f172a',
                  lineHeight: 1.2
                }}
              >
                Estadística de Movilidad
              </Typography>
              {isMovilidad && (
                <CheckCircleIcon sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, flexShrink: 0 }} />
              )}
            </Stack>
            <Typography
              sx={{
                fontSize: { xs: 11, md: 12 },
                color: isMovilidad ? 'rgba(255,255,255,0.75)' : '#64748b',
                mt: 0.2
              }}
            >
              {isMovilidad ? 'Módulo activo' : 'Dashboard estadístico e indicadores'}
            </Typography>
          </Box>
          {!isMovilidad && (
            <ArrowForwardRoundedIcon
              sx={{ color: '#3b82f6', fontSize: 20, flexShrink: 0, transform: 'rotate(180deg)' }}
            />
          )}
        </Stack>
      </Box>

      {/* Convenios side */}
      <Box
        onClick={isConvenios ? undefined : onNavigateConvenios}
        sx={{
          p: { xs: 1.8, md: 2.5 },
          background: isConvenios ? CONVENIOS_GRADIENT : '#f8fafc',
          cursor: isConvenios ? 'default' : 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.6,
          transition: 'background .2s',
          '&:hover': isConvenios ? {} : {
            background: '#f5f3ff'
          }
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.2}>
          {!isConvenios && (
            <ArrowForwardRoundedIcon sx={{ color: '#7c3aed', fontSize: 20, flexShrink: 0 }} />
          )}
          <Box flex={1} minWidth={0}>
            <Stack direction="row" alignItems="center" spacing={0.8} justifyContent={isConvenios ? 'flex-start' : 'flex-end'}>
              {isConvenios && (
                <CheckCircleIcon sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, flexShrink: 0 }} />
              )}
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: 13, md: 15 },
                  color: isConvenios ? '#fff' : '#0f172a',
                  lineHeight: 1.2,
                  textAlign: isConvenios ? 'left' : 'right'
                }}
              >
                Convenios
              </Typography>
            </Stack>
            <Typography
              sx={{
                fontSize: { xs: 11, md: 12 },
                color: isConvenios ? 'rgba(255,255,255,0.75)' : '#64748b',
                mt: 0.2,
                textAlign: isConvenios ? 'left' : 'right'
              }}
            >
              {isConvenios ? 'Módulo activo' : 'Catálogo con búsqueda y documentos'}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              display: 'grid',
              placeItems: 'center',
              bgcolor: isConvenios ? 'rgba(255,255,255,0.18)' : '#ede9fe',
              flexShrink: 0
            }}
          >
            <HandshakeIcon sx={{ color: isConvenios ? '#fff' : '#7c3aed', fontSize: 20 }} />
          </Box>
        </Stack>
      </Box>
    </Paper>
  );
}

export default InternacionalizacionNavSegment;
