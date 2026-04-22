import React, { useState } from 'react';
import { Box, Paper, Tabs, Tab, Stack, Typography } from '@mui/material';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import AutoGraphRoundedIcon from '@mui/icons-material/AutoGraphRounded';
import RendimientoCompetenciasPanel from './RendimientoCompetenciasPanel';

const TABS = [
  {
    value: 'genericas',
    label: 'Competencias Genéricas',
    short: 'Genéricas',
    color: '#10b981',
    colorDark: '#047857',
    soft: '#d1fae5',
    icon: TrendingUpRoundedIcon
  },
  {
    value: 'especificas',
    label: 'Competencias Específicas',
    short: 'Específicas',
    color: '#7c3aed',
    colorDark: '#5b21b6',
    soft: '#ede9fe',
    icon: AutoGraphRoundedIcon
  }
];

function RendimientoCompetenciasContainer() {
  const [grupo, setGrupo] = useState('genericas');
  const activeTab = TABS.find((t) => t.value === grupo) || TABS[0];

  return (
    <Box sx={{ bgcolor: '#f1f5f9', minHeight: 'calc(100vh - 120px)' }}>
      <Paper
        elevation={0}
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          px: { xs: 1.5, md: 2.5 },
          pt: 1.4,
          pb: 0,
          bgcolor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          borderRadius: 0
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'flex-end' }} justifyContent="space-between" spacing={1} sx={{ mb: 0.2 }}>
          <Box>
            <Typography
              sx={{
                fontSize: 10.5,
                fontWeight: 800,
                color: '#64748b',
                letterSpacing: '0.12em',
                textTransform: 'uppercase'
              }}
            >
              Resultados Agregados
            </Typography>
            <Typography
              sx={{
                fontSize: 18,
                fontWeight: 900,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                lineHeight: 1.1
              }}
            >
              Rendimiento por Competencia
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 600, mb: 0.5 }}>
            Fuente: <b>saber_pro_resultados_agregados</b> · ICFES
          </Typography>
        </Stack>

        <Tabs
          value={grupo}
          onChange={(_, v) => setGrupo(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 44,
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
              background: `linear-gradient(90deg, ${activeTab.color} 0%, ${activeTab.colorDark} 100%)`
            },
            '& .MuiTab-root': {
              minHeight: 44,
              textTransform: 'none',
              fontWeight: 700,
              fontSize: 13,
              color: '#64748b',
              letterSpacing: '-0.01em',
              px: 2,
              gap: 0.8,
              transition: 'color 0.15s, background-color 0.15s',
              '&:hover': { bgcolor: '#f8fafc', color: '#0f172a' }
            },
            '& .Mui-selected': { color: `${activeTab.colorDark} !important` }
          }}
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const selected = t.value === grupo;
            return (
              <Tab
                key={t.value}
                value={t.value}
                icon={
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: 1.4,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: selected ? t.soft : '#f1f5f9',
                      transition: 'background-color 0.15s'
                    }}
                  >
                    <Icon sx={{ fontSize: 15, color: selected ? t.colorDark : '#64748b' }} />
                  </Box>
                }
                iconPosition="start"
                label={t.label}
              />
            );
          })}
        </Tabs>
      </Paper>

      <RendimientoCompetenciasPanel key={grupo} grupo={grupo} />
    </Box>
  );
}

export default RendimientoCompetenciasContainer;
