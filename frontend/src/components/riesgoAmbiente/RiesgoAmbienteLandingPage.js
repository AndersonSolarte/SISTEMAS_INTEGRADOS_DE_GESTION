import React, { useMemo, useState } from 'react';
import {
  Box, Button, Chip, Divider, Fade, LinearProgress, Paper, Stack, Typography
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DirectionsCarFilledRoundedIcon from '@mui/icons-material/DirectionsCarFilledRounded';
import EnergySavingsLeafRoundedIcon from '@mui/icons-material/EnergySavingsLeafRounded';
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import LocalParkingRoundedIcon from '@mui/icons-material/LocalParkingRounded';
import { ROLES } from '../../constants/roles';
import ParqueaderosPesvPanel from './ParqueaderosPesvPanel';

const MODULES = [
  {
    key: 'seguridad_salud_trabajo',
    permission: 'gestion_riesgo_ambiente.seguridad_salud_trabajo',
    title: 'Seguridad y Salud en el Trabajo',
    shortTitle: 'SST',
    description: 'Seguimiento preventivo de condiciones laborales, accidentalidad, ausentismo y planes de intervención.',
    icon: HealthAndSafetyRoundedIcon,
    color: '#dc2626',
    dark: '#991b1b',
    light: '#fef2f2',
    gradient: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
    metrics: ['Accidentes de trabajo', 'Tasa de frecuencia', 'Ausentismo laboral', 'Acciones preventivas'],
    analyses: ['Accidentalidad por período', 'Causas y tipos de lesión', 'Inspecciones y hallazgos', 'Ejecución del plan anual'],
    standards: ['Decreto 1072 de 2015', 'Resolución 0312 de 2019', 'ISO 45001']
  },
  {
    key: 'gestion_ambiental',
    permission: 'gestion_riesgo_ambiente.gestion_ambiental',
    title: 'Gestión Ambiental',
    shortTitle: 'Ambiental',
    description: 'Control del desempeño ambiental institucional: recursos, residuos, impactos y programas de sostenibilidad.',
    icon: EnergySavingsLeafRoundedIcon,
    color: '#059669',
    dark: '#065f46',
    light: '#ecfdf5',
    gradient: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
    metrics: ['Consumo de agua', 'Consumo de energía', 'Residuos aprovechados', 'Cumplimiento ambiental'],
    analyses: ['Huella y consumo por sede', 'Gestión integral de residuos', 'Aspectos e impactos ambientales', 'Programas y metas ambientales'],
    standards: ['ISO 14001', 'PIGA institucional', 'Requisitos legales ambientales']
  },
  {
    key: 'seguridad_vial',
    permission: 'gestion_riesgo_ambiente.seguridad_vial',
    title: 'Plan Estratégico de Seguridad Vial',
    shortTitle: 'PESV',
    description: 'Monitoreo de movilidad segura, siniestros, factores de riesgo y avance del Plan Estratégico de Seguridad Vial.',
    icon: DirectionsCarFilledRoundedIcon,
    color: '#d97706',
    dark: '#92400e',
    light: '#fffbeb',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
    metrics: ['Siniestros viales', 'Personas capacitadas', 'Vehículos inspeccionados', 'Avance del PESV'],
    analyses: ['Siniestros por severidad', 'Actores y factores de riesgo', 'Inspecciones preoperacionales', 'Cumplimiento del plan de movilidad'],
    standards: ['Ley 1503 de 2011', 'Decreto 1252 de 2021', 'Resolución 40595 de 2022']
  }
];

const EmptyMetric = ({ label, color }) => (
  <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', minHeight: 112 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
      <Box>
        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</Typography>
        <Typography sx={{ mt: 1, color: '#0f172a', fontSize: 24, fontWeight: 900 }}>Sin datos</Typography>
      </Box>
      <BarChartRoundedIcon sx={{ color, opacity: .85 }} />
    </Stack>
    <Typography variant="caption" sx={{ color: '#94a3b8' }}>Pendiente de conexión con la fuente institucional</Typography>
  </Paper>
);

function ModuleDashboard({ module, onBack }) {
  const Icon = module.icon;
  return (
    <Fade in timeout={250}>
      <Stack spacing={2.2}>
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={onBack} sx={{ alignSelf: 'flex-start', fontWeight: 800, textTransform: 'none' }}>
          Volver a Gestión del Riesgo y Ambiente
        </Button>
        <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3.2 }, borderRadius: 4, color: '#fff', background: module.gradient, overflow: 'hidden', position: 'relative' }}>
          <Box sx={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', bgcolor: 'rgba(255,255,255,.09)', right: -55, top: -85 }} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <Box sx={{ width: 66, height: 66, borderRadius: 3, bgcolor: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center' }}><Icon sx={{ fontSize: 38 }} /></Box>
            <Box sx={{ zIndex: 1 }}>
              <Typography variant="overline" sx={{ fontWeight: 900, opacity: .85 }}>Tablero estadístico · {module.shortTitle}</Typography>
              <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1.1 }}>{module.title}</Typography>
              <Typography sx={{ mt: .7, opacity: .9, maxWidth: 760 }}>{module.description}</Typography>
            </Box>
          </Stack>
        </Paper>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 1.5 }}>
          {module.metrics.map((metric) => <EmptyMetric key={metric} label={metric} color={module.color} />)}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.6fr .9fr' }, gap: 2 }}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3.5, border: '1px solid #e2e8f0' }}>
            <Stack direction="row" spacing={1} alignItems="center"><InsightsRoundedIcon sx={{ color: module.color }} /><Typography sx={{ fontWeight: 900, color: '#0f172a' }}>Paneles de análisis</Typography></Stack>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.3 }}>
              {module.analyses.map((item, index) => (
                <Box key={item} sx={{ p: 1.7, borderRadius: 2.5, bgcolor: module.light, border: `1px solid ${module.color}22` }}>
                  <Stack direction="row" spacing={1.2} alignItems="center"><Box sx={{ width: 27, height: 27, borderRadius: 1.5, bgcolor: module.color, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 12 }}>{index + 1}</Box><Typography sx={{ fontWeight: 800, color: module.dark, fontSize: 14 }}>{item}</Typography></Stack>
                  <LinearProgress variant="determinate" value={0} sx={{ mt: 1.5, height: 5, borderRadius: 5, bgcolor: '#fff', '& .MuiLinearProgress-bar': { bgcolor: module.color } }} />
                </Box>
              ))}
            </Box>
          </Paper>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3.5, border: '1px solid #e2e8f0' }}>
            <Stack direction="row" spacing={1} alignItems="center"><ShieldRoundedIcon sx={{ color: module.color }} /><Typography sx={{ fontWeight: 900, color: '#0f172a' }}>Marco de referencia</Typography></Stack>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={1.2}>{module.standards.map((item) => <Stack key={item} direction="row" spacing={1} alignItems="center"><CheckCircleOutlineRoundedIcon sx={{ color: module.color, fontSize: 20 }} /><Typography variant="body2" sx={{ color: '#334155', fontWeight: 700 }}>{item}</Typography></Stack>)}</Stack>
            <Chip label="Estructura lista para datos" icon={<WarningAmberRoundedIcon />} sx={{ mt: 2.5, bgcolor: module.light, color: module.dark, fontWeight: 800 }} />
          </Paper>
        </Box>
      </Stack>
    </Fade>
  );
}

function RiesgoAmbienteLandingPage({ user, onBack }) {
  const [activeModule, setActiveModule] = useState(null);
  const visibleModules = useMemo(() => {
    if ([ROLES.ADMINISTRADOR, ROLES.PLANEACION_ESTRATEGICA].includes(user?.role)) return MODULES;
    const permissions = [user?.allowedModules, user?.modulePermissions, user?.modules, user?.permissions?.modules]
      .flatMap((entry) => Array.isArray(entry) ? entry : [])
      .map((key) => String(key || '').trim());
    return MODULES.filter((item) => permissions.includes(item.permission));
  }, [user]);

  const selected = MODULES.find((item) => item.key === activeModule);
  if (activeModule === 'parqueaderos') return <ParqueaderosPesvPanel onBack={() => setActiveModule('seguridad_vial')} />;
  if (selected?.key === 'seguridad_vial') {
    return (
      <Fade in timeout={250}>
        <Stack spacing={2.4}>
          <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => setActiveModule(null)} sx={{ alignSelf: 'flex-start', fontWeight: 800, textTransform: 'none' }}>Volver a Gestión del Riesgo y Ambiente</Button>
          <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3.2 }, borderRadius: 4, color: '#fff', background: selected.gradient }}>
            <Stack direction="row" spacing={2} alignItems="center"><DirectionsCarFilledRoundedIcon sx={{ fontSize: 44 }} /><Box><Typography variant="overline" sx={{ fontWeight: 900, opacity: .85 }}>PESV UNICESMAG</Typography><Typography variant="h4" sx={{ fontWeight: 900 }}>Plan Estratégico de Seguridad Vial</Typography><Typography sx={{ mt: .5, opacity: .9 }}>Seleccione un submódulo para gestionar y analizar la movilidad segura institucional.</Typography></Box></Stack>
          </Paper>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a', textAlign: 'center' }}>Submódulos de Seguridad Vial</Typography>
            <Typography sx={{ color: '#64748b', textAlign: 'center', mt: .5 }}>La arquitectura queda preparada para incorporar nuevos componentes del PESV.</Typography>
          </Box>
          <Paper elevation={0} onClick={() => setActiveModule('parqueaderos')} sx={{ maxWidth: 480, width: '100%', mx: 'auto', p: 3.2, borderRadius: 4, border: '1px solid #fde68a', cursor: 'pointer', bgcolor: '#fffdf7', transition: 'all .22s ease', '&:hover': { transform: 'translateY(-4px)', borderColor: '#d97706', boxShadow: '0 18px 40px rgba(217,119,6,.16)' } }}>
            <Box sx={{ width: 72, height: 72, borderRadius: 3, display: 'grid', placeItems: 'center', color: '#fff', background: selected.gradient, mb: 2 }}><LocalParkingRoundedIcon sx={{ fontSize: 42 }} /></Box>
            <Chip label="SUBMÓDULO 01" size="small" sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 900, mb: 1.2 }} />
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a' }}>Parqueaderos UNICESMAG</Typography>
            <Typography sx={{ mt: 1, color: '#64748b', lineHeight: 1.55 }}>Administración de cupos, personas y vehículos, con alertas de vencimiento de SOAT y revisión tecnomecánica.</Typography>
            <Button fullWidth variant="contained" endIcon={<ArrowForwardRoundedIcon />} sx={{ mt: 2.5, borderRadius: 999, textTransform: 'none', fontWeight: 900, background: selected.gradient }}>Gestionar parqueaderos</Button>
          </Paper>
        </Stack>
      </Fade>
    );
  }
  if (selected) return <ModuleDashboard module={selected} onBack={() => setActiveModule(null)} />;

  return (
    <Fade in timeout={250}>
      <Stack spacing={2.5}>
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={onBack} sx={{ alignSelf: 'flex-start', fontWeight: 800, textTransform: 'none' }}>Volver a tableros estadísticos</Button>
        <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 4, color: '#fff', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 55%, #0f766e 100%)' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <Box sx={{ width: 70, height: 70, borderRadius: 3, bgcolor: 'rgba(255,255,255,.14)', display: 'grid', placeItems: 'center' }}><ShieldRoundedIcon sx={{ fontSize: 40 }} /></Box>
            <Box><Typography variant="overline" sx={{ color: '#99f6e4', fontWeight: 900, letterSpacing: '.09em' }}>Gestión de la Información</Typography><Typography variant="h4" sx={{ fontWeight: 900 }}>Gestión del Riesgo y Ambiente</Typography><Typography sx={{ mt: .7, color: 'rgba(255,255,255,.82)' }}>Indicadores institucionales para la prevención, la sostenibilidad y la movilidad segura.</Typography></Box>
          </Stack>
        </Paper>
        <Box><Typography variant="h5" sx={{ textAlign: 'center', fontWeight: 900, color: '#0f172a' }}>Seleccione un submódulo</Typography><Typography sx={{ textAlign: 'center', color: '#64748b', mt: .5 }}>Visualice uno, dos o los tres tableros según los permisos asignados.</Typography></Box>
        {visibleModules.length === 0 ? (
          <Paper elevation={0} sx={{ p: 3, textAlign: 'center', borderRadius: 3, border: '1px dashed #cbd5e1', bgcolor: '#f8fafc' }}><Typography sx={{ fontWeight: 800, color: '#475569' }}>No tiene submódulos asignados. Solicite acceso al administrador del sistema.</Typography></Paper>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: `repeat(${Math.min(visibleModules.length, 3)}, minmax(0, 1fr))` }, gap: 2.2 }}>
            {visibleModules.map((module) => { const Icon = module.icon; return (
              <Paper key={module.key} elevation={0} onClick={() => setActiveModule(module.key)} sx={{ p: 3, borderRadius: 4, border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', flexDirection: 'column', minHeight: 330, transition: 'all .22s ease', position: 'relative', overflow: 'hidden', '&:hover': { transform: 'translateY(-5px)', borderColor: module.color, boxShadow: `0 20px 42px ${module.color}20` } }}>
                <Box sx={{ position: 'absolute', height: 6, top: 0, left: 0, right: 0, background: module.gradient }} />
                <Box sx={{ width: 72, height: 72, borderRadius: 3.2, bgcolor: module.light, color: module.color, display: 'grid', placeItems: 'center', mb: 2.4 }}><Icon sx={{ fontSize: 39 }} /></Box>
                <Chip label={module.shortTitle} size="small" sx={{ alignSelf: 'flex-start', bgcolor: module.light, color: module.dark, fontWeight: 900, mb: 1.2 }} />
                <Typography variant="h6" sx={{ fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>{module.title}</Typography>
                <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.55, mt: 1, mb: 2.5 }}>{module.description}</Typography>
                <Button fullWidth variant="contained" endIcon={<ArrowForwardRoundedIcon />} sx={{ mt: 'auto', borderRadius: 999, py: 1, textTransform: 'none', fontWeight: 900, background: module.gradient }}>Abrir tablero estadístico</Button>
              </Paper>
            ); })}
          </Box>
        )}
      </Stack>
    </Fade>
  );
}

export default RiesgoAmbienteLandingPage;
