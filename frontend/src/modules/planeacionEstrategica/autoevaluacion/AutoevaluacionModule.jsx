import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Button, Fade, Paper, Stack, Typography } from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  AutoGraph as AutoGraphIcon,
  FactCheckRounded as FactCheckIcon,
  TrendingUpRounded as TrendingUpIcon
} from '@mui/icons-material';
import Autoevaluacion from '../../../pages/Autoevaluacion';
import PlanMejoramiento from './planMejoramiento/PlanMejoramiento';

const cards = [
  {
    key: 'autoevaluacion',
    title: 'Autoevaluación',
    description: 'Consulta resultados, factores, características, aspectos, evidencias e instrumentos del proceso de autoevaluación.',
    action: 'Ingresar a Autoevaluación',
    color: '#2563eb',
    soft: '#eff6ff',
    border: '#bfdbfe',
    icon: <FactCheckIcon sx={{ fontSize: 50 }} />
  },
  {
    key: 'plan-mejoramiento',
    title: 'Plan de mejoramiento',
    description: 'Formula objetivos y actividades, gestiona presupuesto, realiza seguimiento y exporta la matriz institucional diligenciada.',
    action: 'Gestionar planes de mejoramiento',
    color: '#d97706',
    soft: '#fff7ed',
    border: '#fed7aa',
    icon: <TrendingUpIcon sx={{ fontSize: 50 }} />
  }
];

function AutoevaluacionModule({ executionMode = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const submodule = useMemo(() => new URLSearchParams(location.search).get('submodulo') || '', [location.search]);

  const selectSubmodule = (key) => {
    const params = new URLSearchParams(location.search);
    params.set('view', 'autoevaluacion');
    params.set('submodulo', key);
    navigate(`${location.pathname}?${params.toString()}`);
  };

  const goHome = () => {
    const params = new URLSearchParams(location.search);
    params.delete('submodulo');
    navigate(`${location.pathname}?${params.toString()}`);
  };

  if (executionMode) return <PlanMejoramiento executionMode onBack={() => navigate('/dashboard')} />;

  if (submodule === 'autoevaluacion') return <Autoevaluacion />;
  if (submodule === 'plan-mejoramiento') {
    return <PlanMejoramiento onBack={goHome} />;
  }

  return (
    <Fade in>
      <Box sx={{ py: { xs: 1, md: 2 } }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 4 }, mb: 4, borderRadius: 4, color: 'white', overflow: 'hidden', position: 'relative',
            background: 'linear-gradient(125deg, #0b1f43 0%, #1d4ed8 58%, #0f766e 120%)'
          }}
        >
          <Box sx={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', right: -75, top: -115, bgcolor: 'rgba(255,255,255,.1)' }} />
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ position: 'relative' }}>
            <AutoGraphIcon sx={{ fontSize: 36 }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: -0.7 }}>Autoevaluación y mejoramiento continuo</Typography>
              <Typography sx={{ opacity: 0.92, mt: 0.5 }}>Seleccione el proceso que desea gestionar.</Typography>
            </Box>
          </Stack>
        </Paper>

        <Typography variant="h5" sx={{ textAlign: 'center', color: '#0f172a', fontWeight: 950, mb: 3.5 }}>
          Seleccione un submódulo para ingresar
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 3, maxWidth: 1120, mx: 'auto' }}>
          {cards.map((card) => (
            <Paper
              key={card.key}
              elevation={0}
              onClick={() => selectSubmodule(card.key)}
              sx={{
                minHeight: 410, p: { xs: 3, md: 5 }, borderRadius: 5, border: `1px solid ${card.border}`,
                background: `linear-gradient(145deg, #fff 0%, ${card.soft} 150%)`, cursor: 'pointer', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'all .28s ease',
                '&:hover': { transform: 'translateY(-7px)', boxShadow: `0 24px 55px ${card.color}22`, borderColor: card.color, '& .module-icon': { transform: 'scale(1.08) rotate(3deg)' } }
              }}
            >
              <Box className="module-icon" sx={{ width: 106, height: 106, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: card.color, color: 'white', boxShadow: `0 15px 30px ${card.color}35`, transition: 'all .28s ease', mb: 4 }}>
                {card.icon}
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 950, color: card.color, fontSize: { xs: 26, md: 30 }, mb: 2 }}>{card.title}</Typography>
              <Typography sx={{ color: '#64748b', lineHeight: 1.7, fontSize: 16, maxWidth: 440, flexGrow: 1 }}>{card.description}</Typography>
              <Button variant="contained" size="large" onClick={() => selectSubmodule(card.key)} sx={{ mt: 4, borderRadius: 3, px: 4, py: 1.25, textTransform: 'none', fontWeight: 900, bgcolor: card.color, '&:hover': { bgcolor: card.color, filter: 'brightness(.92)' } }}>
                {card.action}
              </Button>
            </Paper>
          ))}
        </Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(location.pathname === '/dashboard/autoevaluacion' ? '/dashboard' : '/dashboard/planeacion-estrategica')} sx={{ mt: 4, textTransform: 'none', fontWeight: 800 }}>
          Volver
        </Button>
      </Box>
    </Fade>
  );
}

export default AutoevaluacionModule;
