import React, { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Fade,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import BusinessIcon from '@mui/icons-material/Business';
import SchoolIcon from '@mui/icons-material/School';
import RecursoHumanoDashboard from './RecursoHumanoDashboard';
import AdminDirectivosDashboard from './AdminDirectivosDashboard';

const SUB_CARDS = [
  {
    key: 'profesores',
    label: 'Profesores',
    description: 'Distribución histórica del cuerpo docente por dedicación, nivel de formación, escalafón y género biológico.',
    icon: SchoolIcon,
    color: '#1f73e8',
    gradient: 'linear-gradient(145deg, #2563eb, #1d4ed8 55%, #1e40af)',
    shadow: 'rgba(37,99,235,0.22)',
    backBorder: '#dbe6f5',
    backBg: '#f8fbff',
    backColor: undefined
  },
  {
    key: 'administrativos',
    label: 'Administrativos y Directivos',
    description: 'Personal administrativo y directivo por dependencia, vicerrectoría, tipo de contrato y estado laboral.',
    icon: BusinessIcon,
    color: '#7c3aed',
    gradient: 'linear-gradient(145deg, #7c3aed, #6d28d9 55%, #5b21b6)',
    shadow: 'rgba(124,58,237,0.22)',
    backBorder: '#ede9fe',
    backBg: '#faf5ff',
    backColor: '#7c3aed'
  }
];

function RecursoHumanoLandingPage({ onBack }) {
  const [subView, setSubView] = useState(null);

  if (subView === 'profesores') {
    return <RecursoHumanoDashboard onBack={() => setSubView(null)} />;
  }

  if (subView === 'administrativos') {
    return <AdminDirectivosDashboard onBack={() => setSubView(null)} />;
  }

  return (
    <Fade in timeout={300}>
      <Box>
        <Paper
          elevation={0}
          sx={{ p: 1.4, mb: 2.5, border: '1px solid #dbe6f5', borderRadius: 2.5, bgcolor: '#f8fbff' }}
        >
          <Button
            variant="outlined"
            startIcon={<ArrowBackRoundedIcon />}
            onClick={onBack}
          >
            Volver a Estadística Institucional
          </Button>
        </Paper>

        <Box
          sx={{
            display: 'grid',
            gap: 2.4,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            alignItems: 'stretch'
          }}
        >
          {SUB_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Paper
                key={card.key}
                elevation={0}
                sx={{
                  borderRadius: 4,
                  p: { xs: 2.2, md: 2.8 },
                  border: '1px solid #dbe6f5',
                  minHeight: { xs: 230, md: 270 },
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)',
                  boxShadow: '0 10px 28px rgba(15,23,42,0.04)',
                  transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 14px 34px rgba(37,99,235,0.08)',
                    borderColor: '#bfd4fb'
                  }
                }}
              >
                <Stack spacing={1.8}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                    <Box
                      sx={{
                        width: 74,
                        height: 74,
                        borderRadius: 2.5,
                        background: card.gradient,
                        display: 'grid',
                        placeItems: 'center',
                        boxShadow: `0 10px 22px ${card.shadow}`
                      }}
                    >
                      <Icon sx={{ color: '#fff', fontSize: 36 }} />
                    </Box>
                    <Chip
                      size="small"
                      label="Disponible"
                      sx={{
                        bgcolor: '#f0fdf4',
                        color: '#15803d',
                        border: '1px solid #bbf7d0',
                        fontWeight: 800,
                        fontSize: 11
                      }}
                    />
                  </Stack>

                  <Box sx={{ minHeight: 80 }}>
                    <Typography
                      sx={{
                        fontSize: { xs: 22, md: 26 },
                        fontWeight: 900,
                        color: '#0f172a',
                        lineHeight: 1.08,
                        letterSpacing: '-0.02em'
                      }}
                    >
                      {card.label}
                    </Typography>
                    <Typography
                      sx={{
                        mt: 0.8,
                        color: '#475569',
                        lineHeight: 1.35,
                        fontSize: { xs: 14, md: 15 }
                      }}
                    >
                      {card.description}
                    </Typography>
                  </Box>
                </Stack>

                <Box sx={{ pt: 1 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    endIcon={<ArrowForwardRoundedIcon />}
                    onClick={() => setSubView(card.key)}
                    sx={{
                      mt: 1,
                      borderRadius: 999,
                      py: 1.15,
                      textTransform: 'none',
                      fontWeight: 800,
                      letterSpacing: '-0.01em',
                      background: card.gradient,
                      boxShadow: `0 10px 22px ${card.shadow}`,
                      '&:hover': {
                        background: card.gradient,
                        filter: 'brightness(1.08)'
                      }
                    }}
                  >
                    Abrir dashboard
                  </Button>
                </Box>
              </Paper>
            );
          })}
        </Box>
      </Box>
    </Fade>
  );
}

export default RecursoHumanoLandingPage;
