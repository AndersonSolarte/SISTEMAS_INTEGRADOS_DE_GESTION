import React, { useState } from 'react';
import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import {
  FaArrowRight,
  FaChartColumn,
  FaCircleCheck,
  FaClipboardCheck,
  FaShieldHalved
} from 'react-icons/fa6';
import MeetingMinuteStatisticsDashboard from '../meetingMinute/MeetingMinuteStatisticsDashboard';
import ReporteSalidaFormatStatisticsDashboard from '../reporteSalida/ReporteSalidaFormatStatisticsDashboard';

const MEETING_MINUTES_FORMAT = 'meeting_minutes';
const REPORTE_SALIDA_FORMAT = 'reporte_salida';

const FORMAT_CARDS = [
  {
    key: MEETING_MINUTES_FORMAT,
    codeChip: 'COM-ID-FR-002 · ACTAS',
    codeColor: '#0284c7',
    codeBg: '#e0f2fe',
    statusLabel: 'Disponible',
    statusColor: '#15803d',
    statusBg: '#dcfce7',
    StatusIcon: FaCircleCheck,
    title: 'Registro de Asistencia y Reunión',
    description: 'Resumen de actas, estados, firmas y control de archivo.',
    hoverBorder: '#93c5fd',
    hoverShadow: '0 20px 40px rgba(2, 132, 199, 0.14)',
    buttonGradient: 'linear-gradient(135deg, #0284c7 0%, #1d4ed8 100%)',
    buttonShadow: '0 8px 20px rgba(29, 78, 216, 0.22)',
    buttonAriaLabel: 'Ver estadísticas de Registro de Asistencia y Reunión',
    Icon: FaClipboardCheck
  },
  {
    key: REPORTE_SALIDA_FORMAT,
    codeChip: 'THM-DP-FR-002 · SALIDAS',
    codeColor: '#0f766e',
    codeBg: '#ccfbf1',
    statusLabel: 'Solo consulta',
    statusColor: '#0f766e',
    statusBg: '#f0fdfa',
    StatusIcon: FaShieldHalved,
    title: 'Reportes de Salida',
    description: 'Resumen general de solicitudes, estados, reposiciones y flujo diario en modo solo consulta.',
    hoverBorder: '#5eead4',
    hoverShadow: '0 20px 40px rgba(15, 118, 110, 0.14)',
    buttonGradient: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
    buttonShadow: '0 8px 20px rgba(15, 118, 110, 0.22)',
    buttonAriaLabel: 'Ver estadísticas de Reportes de Salida',
    Icon: FaChartColumn
  }
];

export default function EstadisticasFormatosHub() {
  const [selectedFormat, setSelectedFormat] = useState(null);

  if (selectedFormat === MEETING_MINUTES_FORMAT) {
    return (
      <MeetingMinuteStatisticsDashboard
        initialFormat={MEETING_MINUTES_FORMAT}
        onBackToFormats={() => setSelectedFormat(null)}
      />
    );
  }

  if (selectedFormat === REPORTE_SALIDA_FORMAT) {
    return (
      <ReporteSalidaFormatStatisticsDashboard
        onBack={() => setSelectedFormat(null)}
      />
    );
  }

  return (
    <Box
      sx={{
        p: { xs: 1.5, md: 2.5 },
        borderRadius: '24px',
        bgcolor: '#f4f8ff',
        border: '1px solid #e2ecfb'
      }}
    >
      <Stack spacing={2.8}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1.5}>
          <Typography sx={{ color: '#1e3a8a', fontWeight: 850, fontSize: { xs: 24, md: 30 }, lineHeight: 1.15 }}>
            Estadísticas de formatos
          </Typography>
          <Chip
            icon={<FaCircleCheck size={14} />}
            label={`${FORMAT_CARDS.length} formatos habilitados`}
            sx={{
              alignSelf: { xs: 'flex-start', sm: 'center' },
              bgcolor: '#ffffff',
              color: '#1e3a8a',
              border: '1px solid #cbd5e1',
              fontWeight: 750,
              px: 0.5,
              height: 34,
              '& .MuiChip-icon': { color: '#16a34a' }
            }}
          />
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
            gap: 2.5,
            width: '100%'
          }}
        >
          {FORMAT_CARDS.map((card, index) => {
            const Icon = card.Icon;
            const StatusIcon = card.StatusIcon;
            return (
              <motion.div
                key={card.key}
                initial={{ opacity: 0, y: 14, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.28, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -6 }}
                whileTap={{ scale: 0.99 }}
                style={{ height: '100%' }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.8,
                    pt: 3.1,
                    borderRadius: '22px',
                    border: '1px solid #e2e8f0',
                    bgcolor: '#ffffff',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.05)',
                    transition: 'box-shadow 0.25s ease, border-color 0.25s ease',
                    '&:hover': {
                      borderColor: card.hoverBorder,
                      boxShadow: card.hoverShadow,
                      '& .format-card-icon': {
                        transform: 'scale(1.06) rotate(-3deg)'
                      },
                      '& .format-card-arrow': {
                        transform: 'translateX(4px)'
                      },
                      '& .format-card-watermark': {
                        transform: 'rotate(-2deg) scale(1.05)',
                        opacity: 0.11
                      }
                    }
                  }}
                >
                  <Box
                    aria-hidden="true"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: card.buttonGradient
                    }}
                  />

                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.5} sx={{ position: 'relative', zIndex: 1 }}>
                    <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={card.codeChip} sx={{ color: card.codeColor, bgcolor: card.codeBg, fontWeight: 800 }} />
                      <Chip
                        size="small"
                        icon={<StatusIcon size={11} />}
                        label={card.statusLabel}
                        sx={{
                          color: card.statusColor,
                          bgcolor: card.statusBg,
                          fontWeight: 800,
                          '& .MuiChip-icon': { color: card.statusColor, ml: 0.6 }
                        }}
                      />
                    </Stack>
                    <Box
                      className="format-card-icon"
                      sx={{
                        width: 48,
                        height: 48,
                        flexShrink: 0,
                        borderRadius: '14px',
                        display: 'grid',
                        placeItems: 'center',
                        color: card.codeColor,
                        bgcolor: card.codeBg,
                        border: `1px solid ${card.codeColor}22`,
                        transition: 'transform 0.25s ease'
                      }}
                    >
                      <Icon size={21} aria-hidden="true" />
                    </Box>
                  </Stack>

                  <Box sx={{ mt: 2, mb: 2.5, position: 'relative', zIndex: 1 }}>
                    <Typography sx={{ color: '#1e3a8a', fontWeight: 850, fontSize: 20, lineHeight: 1.25 }}>
                      {card.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', mt: 0.9, lineHeight: 1.6 }}>
                      {card.description}
                    </Typography>
                  </Box>

                  <Button
                    fullWidth
                    variant="contained"
                    aria-label={card.buttonAriaLabel}
                    endIcon={<FaArrowRight size={14} className="format-card-arrow" style={{ transition: 'transform 0.22s ease' }} />}
                    onClick={() => setSelectedFormat(card.key)}
                    sx={{
                      mt: 'auto',
                      minHeight: 44,
                      position: 'relative',
                      zIndex: 1,
                      textTransform: 'none',
                      fontWeight: 800,
                      fontSize: 14.5,
                      borderRadius: '14px',
                      background: card.buttonGradient,
                      boxShadow: card.buttonShadow
                    }}
                  >
                    Ver estadísticas
                  </Button>

                  <Box
                    className="format-card-watermark"
                    aria-hidden="true"
                    sx={{
                      position: 'absolute',
                      right: -12,
                      bottom: -14,
                      color: card.codeColor,
                      opacity: 0.07,
                      pointerEvents: 'none',
                      lineHeight: 0,
                      transform: 'rotate(-8deg)',
                      transition: 'transform 0.25s ease, opacity 0.25s ease'
                    }}
                  >
                    <Icon size={116} />
                  </Box>
                </Paper>
              </motion.div>
            );
          })}
        </Box>
      </Stack>
    </Box>
  );
}
