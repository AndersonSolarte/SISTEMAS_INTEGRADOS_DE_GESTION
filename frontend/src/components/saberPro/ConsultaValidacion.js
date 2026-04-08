import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Box, Stack, Typography, Paper, Button, TextField, Chip,
  CircularProgress, Divider, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, Alert, LinearProgress,
  Tooltip, IconButton, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import ExpandMoreRoundedIcon    from '@mui/icons-material/ExpandMoreRounded';
import SearchRoundedIcon        from '@mui/icons-material/SearchRounded';
import UploadFileRoundedIcon    from '@mui/icons-material/UploadFileRounded';
import PersonSearchRoundedIcon  from '@mui/icons-material/PersonSearchRounded';
import CheckCircleRoundedIcon   from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon        from '@mui/icons-material/CancelRounded';
import WarningAmberRoundedIcon  from '@mui/icons-material/WarningAmberRounded';
import DownloadRoundedIcon      from '@mui/icons-material/DownloadRounded';
import BadgeRoundedIcon         from '@mui/icons-material/BadgeRounded';
import SchoolRoundedIcon        from '@mui/icons-material/SchoolRounded';
import AssessmentRoundedIcon    from '@mui/icons-material/AssessmentRounded';
import TrendingUpRoundedIcon    from '@mui/icons-material/TrendingUpRounded';
import CloseRoundedIcon         from '@mui/icons-material/CloseRounded';
import OpenInNewRoundedIcon     from '@mui/icons-material/OpenInNewRounded';
import FingerprintRoundedIcon   from '@mui/icons-material/FingerprintRounded';
import VerifiedRoundedIcon      from '@mui/icons-material/VerifiedRounded';
import InsightsRoundedIcon      from '@mui/icons-material/InsightsRounded';
import ArrowForwardRoundedIcon  from '@mui/icons-material/ArrowForwardRounded';
import ErrorRoundedIcon         from '@mui/icons-material/ErrorRounded';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';
import api from '../../services/api';
import XLSXStyle from 'xlsx-js-style';

const BASE_URL = '/planeacion/gestion-informacion/saber-pro/consulta';

/* ─── helpers ──────────────────────────────── */
const hasCeroGlobal = (val) => {
  if (!val || val === '—') return false;
  return String(val).split(';').map(s => s.trim()).some(v => v !== '' && !isNaN(v) && parseFloat(v) === 0);
};
const hasObs = (row) => row.observaciones && row.observaciones !== '—' && row.observaciones.trim() !== '';
const isAlertRow = (row) => row.estado === 'Validar información' || hasCeroGlobal(row.puntaje_global) || hasObs(row);

/* ─── tipo prueba config ─────────────────── */
const getTipoCfg = (tipo) => {
  const t = String(tipo || '').toLowerCase();
  if (t.includes('pro')) return { bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe', label: 'SABER PRO' };
  if (t.includes('tyt') || t.includes('t&t') || t.includes('tt')) return { bg: '#ede9fe', color: '#7c3aed', border: '#ddd6fe', label: 'SABER TyT' };
  return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', label: String(tipo || '—').toUpperCase() };
};

const TipoBadge = ({ tipo }) => {
  const parts = String(tipo || '').split(';').map(s => s.trim()).filter(Boolean);
  if (!parts.length) return <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>—</Typography>;
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap">
      {parts.map((p, i) => {
        const c = getTipoCfg(p);
        return (
          <Box key={i} sx={{ display: 'inline-flex', alignItems: 'center', px: 0.9, py: 0.25,
            borderRadius: 1, bgcolor: c.bg, border: `1.5px solid ${c.border}` }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: c.color, letterSpacing: '0.03em' }}>{c.label}</Typography>
          </Box>
        );
      })}
    </Stack>
  );
};

/* ─── paleta de estados ──────────────────── */
const STATE_CFG = {
  'Encontrado':          { color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0', xlFill: 'DCFCE7', icon: <CheckCircleRoundedIcon  sx={{ fontSize: 13 }} /> },
  'No encontrado':       { color: '#dc2626', bg: '#fee2e2', border: '#fecaca', xlFill: 'FEE2E2', icon: <CancelRoundedIcon        sx={{ fontSize: 13 }} /> },
  'Duplicado':           { color: '#d97706', bg: '#fef3c7', border: '#fde68a', xlFill: 'FEF3C7', icon: <WarningAmberRoundedIcon  sx={{ fontSize: 13 }} /> },
  'Validar información': { color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5', xlFill: 'FECACA', icon: <ReportProblemRoundedIcon sx={{ fontSize: 13 }} /> }
};

const stateChip = (estado, filled = false) => {
  const c = STATE_CFG[estado] || STATE_CFG['No encontrado'];
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, px: 1, py: 0.3, borderRadius: 1.5,
      bgcolor: filled ? c.color : c.bg, border: `1px solid ${filled ? c.color : c.border}` }}>
      <Box sx={{ color: filled ? '#fff' : c.color, display: 'flex' }}>{c.icon}</Box>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: filled ? '#fff' : c.color }}>{estado}</Typography>
    </Box>
  );
};

const getRowStyle = (row) => {
  const alert = isAlertRow(row);
  if (alert) return { bgcolor: '#fde8e8', borderLeft: '4px solid #ef4444', '&:hover': { bgcolor: '#fdd5d5' } };
  if (row.estado === 'No encontrado') return { bgcolor: '#fff8f8', borderLeft: '4px solid #fca5a5', '&:hover': { bgcolor: '#fee2e2' } };
  if (row.estado === 'Duplicado')    return { bgcolor: '#fffbeb', borderLeft: '4px solid #fcd34d', '&:hover': { bgcolor: '#fef9c3' } };
  if (row.estado === 'Encontrado')   return { bgcolor: '#f0fdf4', borderLeft: '4px solid #86efac', '&:hover': { bgcolor: '#dcfce7' } };
  return { '&:hover': { bgcolor: '#f8fafc' } };
};

const KpiMini = ({ label, value, color, icon: Icon }) => (
  <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: `1.5px solid ${color}18`,
    background: `linear-gradient(145deg,#fff 0%,${color}06 100%)`, minWidth: 110, textAlign: 'center' }}>
    <Icon sx={{ fontSize: 20, color, mb: 0.3 }} />
    <Typography sx={{ fontSize: 22, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{value}</Typography>
    <Typography sx={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600, mt: 0.2 }}>{label}</Typography>
  </Paper>
);

/* ══════════════════════════════════════════════
   INSTRUCTIVO ICFES — 3 pasos
══════════════════════════════════════════════ */
const PASOS_ICFES = [
  {
    num: '01', color: '#2563eb', bg: 'linear-gradient(145deg,#eff6ff,#dbeafe)',
    border: '#bfdbfe', Icon: FingerprintRoundedIcon,
    title: 'Consulta tu Código EK',
    sub: 'Número de registro ICFES',
    desc: 'Accede al portal ICFES para obtener tu Número de Código EK, el identificador único de tu presentación de examen.',
    link: 'https://resultados.icfes.edu.co/resultados-saber2016-web/pages/publicacionResultados/autenticacion/consultaSnp.jsf#No-back-button',
    btnLabel: 'Consultar Código EK',
  },
  {
    num: '02', color: '#059669', bg: 'linear-gradient(145deg,#ecfdf5,#a7f3d0)',
    border: '#6ee7b7', Icon: VerifiedRoundedIcon,
    title: 'Certificado de Presentación',
    sub: 'Descarga tu certificado oficial',
    desc: 'Descarga o visualiza tu certificado oficial de presentación de Saber Pro desde el portal de certificados ICFES.',
    link: 'https://www2.icfesinteractivo.gov.co/certificadoSaberPro/',
    btnLabel: 'Ver Certificado',
  },
  {
    num: '03', color: '#7c3aed', bg: 'linear-gradient(145deg,#f5f3ff,#ede9fe)',
    border: '#c4b5fd', Icon: InsightsRoundedIcon,
    title: 'Resultados Saber PRO y TyT',
    sub: 'Consulta tus puntajes',
    desc: 'Consulta tus resultados detallados de Saber PRO y Saber TyT. Puedes realizar múltiples consultas desde este enlace.',
    link: 'https://www.icfes.gov.co/evaluaciones-icfes/resultados/',
    btnLabel: 'Ver Resultados',
  },
];

function InstructivoICFES() {
  return (
    <Box sx={{ mb: 3 }}>
      {/* Header */}
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
        <Box sx={{ width: 4, height: 22, borderRadius: 1, background: 'linear-gradient(180deg,#2563eb,#7c3aed)' }} />
        <Box>
          <Typography sx={{ fontWeight: 900, fontSize: 14, color: '#0f172a', lineHeight: 1 }}>
            Instructivo de Consulta ICFES
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: '#64748b', mt: 0.2 }}>
            Sigue estos pasos para validar tu información oficial en el portal ICFES
          </Typography>
        </Box>
      </Stack>

      {/* Cards grid */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr', md: '1fr 40px 1fr 40px 1fr' },
        alignItems: 'stretch', gap: { xs: 2, md: 0 }
      }}>
        {PASOS_ICFES.map((paso, i) => (
          <React.Fragment key={i}>
            <Paper elevation={0} sx={{
              borderRadius: 3, border: `1.5px solid ${paso.border}`,
              background: paso.bg, position: 'relative', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 8px 30px ${paso.color}25` }
            }}>
              {/* Watermark number */}
              <Typography sx={{
                position: 'absolute', bottom: -16, right: 8, fontSize: 80, fontWeight: 900,
                color: paso.color, opacity: 0.07, lineHeight: 1, userSelect: 'none', pointerEvents: 'none'
              }}>{paso.num}</Typography>

              {/* Top accent bar */}
              <Box sx={{ height: 4, background: `linear-gradient(90deg,${paso.color},${paso.color}88)`, borderRadius: '12px 12px 0 0' }} />

              <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', flex: 1, gap: 1.5 }}>
                {/* Step badge + icon */}
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{
                    width: 48, height: 48, borderRadius: 2.5, bgcolor: paso.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 4px 14px ${paso.color}50`, flexShrink: 0
                  }}>
                    <paso.Icon sx={{ color: '#fff', fontSize: 24 }} />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 1, py: 0.2, borderRadius: 1,
                      bgcolor: `${paso.color}18`, mb: 0.3 }}>
                      <Typography sx={{ fontSize: 9.5, fontWeight: 900, color: paso.color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        Paso {paso.num}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 14, fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>
                      {paso.title}
                    </Typography>
                    <Typography sx={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>{paso.sub}</Typography>
                  </Box>
                </Stack>

                <Divider sx={{ borderColor: `${paso.color}20` }} />

                <Typography sx={{ fontSize: 11.5, color: '#475569', lineHeight: 1.65, flex: 1 }}>
                  {paso.desc}
                </Typography>

                <Button
                  component="a"
                  href={paso.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="contained"
                  endIcon={<OpenInNewRoundedIcon sx={{ fontSize: 14 }} />}
                  size="small"
                  fullWidth
                  sx={{
                    textTransform: 'none', fontWeight: 700, borderRadius: 1.5, fontSize: 12,
                    py: 1, bgcolor: paso.color, mt: 'auto',
                    boxShadow: `0 2px 10px ${paso.color}40`,
                    '&:hover': { bgcolor: paso.color, filter: 'brightness(0.88)', boxShadow: `0 4px 16px ${paso.color}50` }
                  }}
                >
                  {paso.btnLabel}
                </Button>
              </Box>
            </Paper>

            {/* Arrow between cards */}
            {i < PASOS_ICFES.length - 1 && (
              <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'center' }}>
                <Box sx={{
                  width: 30, height: 30, borderRadius: '50%', bgcolor: '#fff',
                  border: '1.5px solid #e2e8f0', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                }}>
                  <ArrowForwardRoundedIcon sx={{ fontSize: 15, color: '#94a3b8' }} />
                </Box>
              </Box>
            )}
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
}

/* ══════════════════════════════════════════════
   SECCIÓN A — CONSULTA INDIVIDUAL
══════════════════════════════════════════════ */
function ConsultaIndividual() {
  const [documento, setDocumento] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [result,    setResult]    = useState(null);

  const handleSearch = useCallback(async () => {
    if (!documento.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const { data } = await api.get(`${BASE_URL}/individual`, { params: { documento: documento.trim() } });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al consultar. Verifique el documento.');
    } finally {
      setLoading(false);
    }
  }, [documento]);

  const presentaciones = result?.presentaciones || [];
  const nombre = presentaciones[0]?.nombre || '';

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5 }, maxWidth: 1020, mx: 'auto' }}>

      {/* Search bar */}
      <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0', mb: 2,
        display: 'flex', gap: 1.5, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <PersonSearchRoundedIcon sx={{ fontSize: 22, color: '#2563eb', mb: 0.5 }} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Número de documento
          </Typography>
          <TextField
            fullWidth size="small" variant="outlined"
            placeholder="Ej. 1234567890"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            InputProps={{ sx: { fontSize: 13, fontWeight: 700, bgcolor: '#f8fafc', borderRadius: 1.5 } }}
          />
        </Box>
        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <SearchRoundedIcon />}
          onClick={handleSearch}
          disabled={loading || !documento.trim()}
          sx={{ fontWeight: 700, borderRadius: 1.5, px: 2.5, height: 40, textTransform: 'none',
            background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}
        >
          {loading ? 'Buscando…' : 'Buscar'}
        </Button>
        {result && (
          <IconButton size="small" onClick={() => { setResult(null); setDocumento(''); }}
            sx={{ color: '#94a3b8', '&:hover': { color: '#ef4444' } }}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        )}
      </Paper>

      {error && <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {/* Resultados */}
      {result && presentaciones.length > 0 && (
        <Box>
          {/* Encabezado estudiante */}
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0', mb: 2,
            background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between">
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ width: 42, height: 42, borderRadius: 2, background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <BadgeRoundedIcon sx={{ color: '#fff', fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 900, fontSize: 15, color: '#fff', lineHeight: 1.1 }}>{nombre || '—'}</Typography>
                  <Typography sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Documento: {presentaciones[0]?.documento}</Typography>
                </Box>
              </Stack>
              <Chip
                size="small"
                label={`${presentaciones.length} presentación${presentaciones.length !== 1 ? 'es' : ''} registrada${presentaciones.length !== 1 ? 's' : ''}`}
                sx={{ bgcolor: '#ffffff18', color: '#e2e8f0', fontWeight: 700, fontSize: 11, border: '1px solid #ffffff25' }}
              />
            </Stack>
          </Paper>

          {/* Acordeón por presentación */}
          <Stack spacing={1.5}>
            {presentaciones.map((p, i) => {
              const tc = getTipoCfg(p.tipo_prueba);
              const alertaPuntaje = parseFloat(p.puntaje_global) === 0;
              const alertaNovedad = p.novedades && p.novedades.trim();
              const hasAlert = alertaPuntaje || !!alertaNovedad;

              return (
                <Accordion key={i} defaultExpanded={i === 0} elevation={0} sx={{
                  border: hasAlert ? '1.5px solid #fca5a5' : '1px solid #e2e8f0',
                  borderRadius: '12px !important', overflow: 'hidden',
                  '&::before': { display: 'none' },
                  '&.Mui-expanded': { boxShadow: hasAlert ? '0 4px 20px rgba(239,68,68,0.15)' : '0 4px 20px rgba(37,99,235,0.10)' }
                }}>
                  <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} sx={{
                    px: 2, py: 1,
                    bgcolor: hasAlert ? '#fff5f5' : '#f8fafc',
                    '&.Mui-expanded': { bgcolor: hasAlert ? '#fff0f0' : '#f0f7ff' }
                  }}>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, pr: 1 }} flexWrap="wrap">
                      {/* Tipo badge */}
                      <Box sx={{ px: 1, py: 0.3, borderRadius: 1, bgcolor: tc.bg, border: `1.5px solid ${tc.border}` }}>
                        <Typography sx={{ fontSize: 10.5, fontWeight: 900, color: tc.color }}>{tc.label}</Typography>
                      </Box>
                      {/* Año - periodo */}
                      <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: '#1e293b' }}>
                        {p.anio} — Periodo {p.periodo}
                      </Typography>
                      {/* Puntaje global */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5,
                        px: 1, py: 0.3, borderRadius: 1, bgcolor: alertaPuntaje ? '#fee2e2' : '#f0fdf4',
                        border: `1px solid ${alertaPuntaje ? '#fca5a5' : '#bbf7d0'}` }}>
                        <AssessmentRoundedIcon sx={{ fontSize: 12, color: alertaPuntaje ? '#dc2626' : '#16a34a' }} />
                        <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: alertaPuntaje ? '#dc2626' : '#15803d' }}>
                          {p.puntaje_global != null ? p.puntaje_global : '—'}
                        </Typography>
                      </Box>
                      {/* Indicadores de alerta */}
                      {alertaPuntaje && (
                        <Chip size="small" icon={<ErrorRoundedIcon sx={{ fontSize: '14px !important', color: '#dc2626 !important' }} />}
                          label="Puntaje 0" sx={{ bgcolor: '#fee2e2', color: '#b91c1c', fontWeight: 700, fontSize: 10.5, height: 22, border: '1px solid #fca5a5' }} />
                      )}
                      {alertaNovedad && (
                        <Chip size="small" icon={<WarningAmberRoundedIcon sx={{ fontSize: '14px !important', color: '#d97706 !important' }} />}
                          label="Tiene novedades" sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: 10.5, height: 22, border: '1px solid #fde68a' }} />
                      )}
                    </Stack>
                  </AccordionSummary>

                  <AccordionDetails sx={{ p: 2, bgcolor: '#fff' }}>
                    {/* Alertas */}
                    {hasAlert && (
                      <Box sx={{ mb: 2 }}>
                        {alertaPuntaje && (
                          <Alert severity="error" icon={<ErrorRoundedIcon />} sx={{ mb: 1, borderRadius: 2, fontWeight: 600, fontSize: 12.5 }}>
                            <strong>Puntaje global: 0</strong> — Se recomienda verificar el estado de esta presentación directamente con el ICFES. Puede haber una situación especial o novedad registrada.
                          </Alert>
                        )}
                        {alertaNovedad && (
                          <Alert severity="warning" icon={<ReportProblemRoundedIcon />} sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12.5 }}>
                            <strong>Novedad registrada:</strong> {p.novedades}
                          </Alert>
                        )}
                      </Box>
                    )}

                    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1.5fr' } }}>
                      {/* Tarjeta de información */}
                      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                        <Typography sx={{ fontWeight: 800, fontSize: 12, color: '#475569', mb: 1.5,
                          textTransform: 'uppercase', letterSpacing: '0.05em' }}>Información de la presentación</Typography>

                        {[
                          { icon: SchoolRoundedIcon,     label: 'Programa',         value: p.programa },
                          { icon: AssessmentRoundedIcon, label: 'Tipo de prueba',   value: p.tipo_prueba?.toUpperCase() },
                          { icon: BadgeRoundedIcon,      label: 'Año · Periodo',    value: `${p.anio} — ${p.periodo}` },
                          { icon: TrendingUpRoundedIcon, label: 'N° Registro',      value: p.numero_registro },
                          { icon: SchoolRoundedIcon,     label: 'Grupo Referencia', value: p.grupo_referencia },
                          { icon: AssessmentRoundedIcon, label: 'Modalidad',        value: p.modalidad },
                          { icon: SchoolRoundedIcon,     label: 'Observaciones',    value: p.novedades || 'Sin novedades', alert: !!alertaNovedad }
                        ].map(({ icon: Ic, label, value, alert }) => (
                          <Stack key={label} direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1 }}>
                            <Ic sx={{ fontSize: 14, color: alert ? '#d97706' : '#94a3b8', mt: 0.3, flexShrink: 0 }} />
                            <Box>
                              <Typography sx={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, lineHeight: 1 }}>{label}</Typography>
                              <Typography sx={{ fontSize: 12.5, color: alert ? '#92400e' : '#1e293b', fontWeight: 700 }}>{value || '—'}</Typography>
                            </Box>
                          </Stack>
                        ))}

                        <Divider sx={{ my: 1.5 }} />

                        <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap>
                          <KpiMini label="Puntaje Global"   value={p.puntaje_global  ?? '—'} color={alertaPuntaje ? '#dc2626' : '#2563eb'} icon={AssessmentRoundedIcon} />
                          <KpiMini label="Percentil Nac."   value={p.percentil_nacional_global != null ? `P${p.percentil_nacional_global}` : '—'} color="#0891b2" icon={TrendingUpRoundedIcon} />
                          <KpiMini label="Percentil G.Ref." value={p.percentil_grupo_referencia != null ? `P${p.percentil_grupo_referencia}` : '—'} color="#10b981" icon={TrendingUpRoundedIcon} />
                        </Stack>
                      </Paper>

                      {/* Tabla competencias */}
                      <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        <Box sx={{ px: 2, py: 1.2, borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                          <Typography sx={{ fontWeight: 800, fontSize: 12.5, color: '#1e293b' }}>Módulos / Competencias</Typography>
                          <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>{p.competencias?.length || 0} módulos evaluados</Typography>
                        </Box>
                        {p.competencias?.length ? (
                          <TableContainer sx={{ maxHeight: 320 }}>
                            <Table size="small" stickyHeader>
                              <TableHead>
                                <TableRow>
                                  {['Módulo', 'Puntaje', 'Nivel', '% Nac.'].map((h) => (
                                    <TableCell key={h} sx={{ fontWeight: 800, fontSize: 10.5, color: '#64748b',
                                      bgcolor: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em', py: 1 }}>
                                      {h}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {p.competencias.map((c, ci) => {
                                  const nivel = c.nivel_desempeno || '';
                                  const nivelAlto = nivel.includes('4') || nivel.includes('3');
                                  return (
                                    <TableRow key={ci} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                                      <TableCell sx={{ fontSize: 11.5, fontWeight: 700, color: '#334155', maxWidth: 200 }}>
                                        <Tooltip title={c.modulo}>
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                                            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{c.modulo}</span>
                                        </Tooltip>
                                      </TableCell>
                                      <TableCell sx={{ fontWeight: 900, fontSize: 13.5, color: '#2563eb' }}>{c.puntaje ?? '—'}</TableCell>
                                      <TableCell>
                                        <Chip size="small" label={nivel || '—'} sx={{ fontSize: 10, fontWeight: 700, height: 20,
                                          bgcolor: nivelAlto ? '#dcfce7' : '#fff7ed',
                                          color:   nivelAlto ? '#16a34a' : '#d97706' }} />
                                      </TableCell>
                                      <TableCell sx={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                                        {c.percentil_nacional != null ? `P${c.percentil_nacional}` : '—'}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        ) : (
                          <Box sx={{ p: 3, textAlign: 'center' }}>
                            <Typography sx={{ color: '#94a3b8', fontSize: 13 }}>No hay datos de módulos disponibles.</Typography>
                          </Box>
                        )}
                      </Paper>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Stack>
        </Box>
      )}
    </Box>
  );
}

/* ══════════════════════════════════════════════
   SECCIÓN B — CARGA MASIVA Y VALIDACIÓN
══════════════════════════════════════════════ */
function CargaMasiva() {
  const [file,        setFile]      = useState(null);
  const [loading,     setLoading]   = useState(false);
  const [progress,    setProgress]  = useState(0);
  const [error,       setError]     = useState(null);
  const [result,      setResult]    = useState(null);
  const [filterState, setFilter]    = useState('Todos');
  const inputRef = useRef();

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get(`${BASE_URL}/template`, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'plantilla_validacion_documentos.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (_error) {
      setError('No se pudo descargar la plantilla. Intenta nuevamente.');
    }
  };

  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) { setError('Formato no válido. Use .xlsx, .xls o .csv'); return; }
    setFile(f); setError(null); setResult(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true); setProgress(10); setError(null);
    const form = new FormData();
    form.append('archivo', file);
    try {
      setProgress(40);
      const { data } = await api.post(`${BASE_URL}/masiva`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 60) + 10)
      });
      setProgress(100);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Error procesando el archivo.');
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    if (!result?.resultado) return;

    const COLS = ['#', 'Documento', 'Nombre', 'Programa', 'Tipo Prueba',
      'Año', 'Periodo', 'Puntaje Global', 'N° Registro', 'Observaciones', 'Estado'];

    const cellStyle = (fill, bold = false) => ({
      font: { name: 'Calibri', sz: 11, bold },
      alignment: { vertical: 'center', wrapText: true },
      ...(fill ? { fill: { patternType: 'solid', fgColor: { rgb: fill } } } : {})
    });

    const headerStyle = {
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '1E40AF' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { bottom: { style: 'medium', color: { rgb: 'FFFFFF' } } }
    };

    /* ── Construir filas expandidas por sub-registro ──
       Columnas compartidas (#, doc, nombre, programa) se fusionan igual que en la tabla.
       Columnas variables (tipo, año, puntaje, registro, obs, estado) van por sub-registro. */
    const SHARED_COLS = [0, 1, 2, 3]; // índices de columnas que se fusionan
    const merges = [];
    const dataRows = [];  // {values[], fill, isLast (last of group), rowIdx}

    let excelRow = 1; // fila Excel (1-indexed, encabezado en 0)
    let docSeq   = 0; // numeración secuencial de documentos

    result.resultado.forEach((row) => {
      docSeq++;
      const subs = row.subrecords && row.subrecords.length > 0
        ? row.subrecords
        : [{ tipo_prueba: row.tipo_prueba, anio: row.anio, periodo: row.periodo,
             puntaje_global: row.puntaje_global, numero_registro: row.numero_registro,
             observaciones: row.observaciones, hasAlert: isAlertRow(row) }];
      const subCount = subs.length;
      const overallAlert = isAlertRow(row);

      /* Fusionar celdas compartidas cuando hay más de 1 sub-registro */
      if (subCount > 1) {
        SHARED_COLS.forEach((ci) => {
          merges.push({ s: { r: excelRow, c: ci }, e: { r: excelRow + subCount - 1, c: ci } });
        });
      }

      subs.forEach((sub, si) => {
        const isFirst = si === 0;
        const isLastSub = si === subCount - 1;
        const subAlert = sub.hasAlert;
        const subEstado = row.estado === 'No encontrado' ? 'No encontrado'
          : row.estado === 'Duplicado' ? 'Duplicado'
          : subAlert ? 'Validar información'
          : 'Encontrado';

        /* Fill: celdas compartidas → blanco; celdas variables → color del sub-registro */
        const sharedFill = overallAlert ? 'FFF5F5' : null;
        const subFill    = subAlert ? 'FECACA'
          : subEstado === 'No encontrado' ? 'FFF5F5'
          : 'F0FDF4';

        /* Borde inferior: grueso al final del grupo, punteado entre sub-filas */
        const bottomBorder = isLastSub
          ? { style: 'medium', color: { rgb: '94A3B8' } }
          : { style: 'dashed', color: { rgb: '93C5FD' } };

        const sharedCellStyle = (bold = false) => ({
          font: { name: 'Calibri', sz: 11, bold },
          alignment: { vertical: 'center', wrapText: true },
          fill: sharedFill ? { patternType: 'solid', fgColor: { rgb: sharedFill } } : undefined,
          border: { bottom: bottomBorder }
        });
        const subCellStyle = (bold = false) => ({
          font: { name: 'Calibri', sz: 11, bold },
          alignment: { vertical: 'center', wrapText: true },
          fill: { patternType: 'solid', fgColor: { rgb: subFill } },
          border: { bottom: bottomBorder }
        });

        dataRows.push({ excelRow, isFirst, isLastSub, subCount,
          row, sub, subEstado, subAlert, docSeq,
          sharedCellStyle, subCellStyle });
        excelRow++;
      });
    });

    const totalDataRows = excelRow - 1;
    const ws = {};
    const range = { s: { r: 0, c: 0 }, e: { r: totalDataRows, c: COLS.length - 1 } };

    /* Encabezados */
    COLS.forEach((h, ci) => {
      const addr = XLSXStyle.utils.encode_cell({ r: 0, c: ci });
      ws[addr] = { v: h, t: 's', s: headerStyle };
    });

    /* Filas de datos */
    dataRows.forEach(({ excelRow: er, isFirst, row, sub, subEstado, docSeq, sharedCellStyle, subCellStyle }) => {

      /* Celdas compartidas (solo escribir en primera sub-fila; las demás quedan fusionadas) */
      if (isFirst) {
        const shared = [docSeq, row.documento, row.nombre, row.programa];
        shared.forEach((v, ci) => {
          const addr = XLSXStyle.utils.encode_cell({ r: er, c: ci });
          ws[addr] = { v: v ?? '', t: (typeof v === 'number' ? 'n' : 's'), s: sharedCellStyle(ci === 0) };
        });
      }

      /* Celdas variables */
      const varValues = [
        String(sub.tipo_prueba || '').toUpperCase() || '-',
        sub.anio ?? '-',
        sub.periodo ?? '-',
        sub.puntaje_global ?? '-',
        sub.numero_registro || '-',
        sub.observaciones || '-',
        subEstado
      ];
      varValues.forEach((v, i) => {
        const ci = 4 + i; // columnas 4..10
        const addr = XLSXStyle.utils.encode_cell({ r: er, c: ci });
        ws[addr] = { v: v ?? '', t: 's', s: subCellStyle(ci === COLS.length - 1) };
      });
    });

    ws['!ref']    = XLSXStyle.utils.encode_range(range);
    ws['!merges'] = merges;
    ws['!cols']   = [4, 14, 22, 22, 14, 10, 10, 14, 18, 28, 16].map((w) => ({ wch: w }));
    ws['!rows']   = [{ hpt: 22 }, ...Array(totalDataRows).fill({ hpt: 18 })];

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Validación');
    XLSXStyle.writeFile(wb, `validacion_saber_pro_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const filtered = result?.resultado?.filter((r) => filterState === 'Todos' || r.estado === filterState) || [];
  const STATES   = ['Todos', 'Encontrado', 'Validar información', 'No encontrado', 'Duplicado'];

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5 }, maxWidth: 1150, mx: 'auto' }}>

      {/* ── Instructivo ── */}
      <InstructivoICFES />

      {/* ── Upload card ── */}
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2.5, border: '1px solid #e2e8f0', mb: 2, bgcolor: '#fff' }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
          <UploadFileRoundedIcon sx={{ fontSize: 22, color: '#2563eb' }} />
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 13.5, color: '#1e293b' }}>Carga Masiva de Documentos</Typography>
            <Typography sx={{ fontSize: 11.5, color: '#94a3b8' }}>
              Suba un archivo Excel o CSV con la primera columna llamada <b>Documento</b>
            </Typography>
          </Box>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<DownloadRoundedIcon />}
            onClick={handleDownloadTemplate}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: 1.5,
              alignSelf: 'flex-start'
            }}
          >
            Descargar plantilla
          </Button>
          <Typography sx={{ fontSize: 11.5, color: '#64748b', alignSelf: 'center' }}>
            Usa esta plantilla para evitar errores de formato. Solo debe contener la columna <b>Documento</b>.
          </Typography>
        </Stack>

        <Box
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
          sx={{
            border: `2px dashed ${file ? '#2563eb' : '#e2e8f0'}`,
            borderRadius: 2, p: 3, textAlign: 'center', cursor: 'pointer',
            bgcolor: file ? '#eff6ff' : '#f8fafc', transition: 'all 0.2s',
            '&:hover': { borderColor: '#93c5fd', bgcolor: '#f0f9ff' }
          }}
        >
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files[0])} />
          <UploadFileRoundedIcon sx={{ fontSize: 32, color: file ? '#2563eb' : '#cbd5e1', mb: 1 }} />
          {file ? (
            <Stack alignItems="center" spacing={0.5}>
              <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#2563eb' }}>{file.name}</Typography>
              <Typography sx={{ fontSize: 11.5, color: '#64748b' }}>{(file.size / 1024).toFixed(1)} KB</Typography>
            </Stack>
          ) : (
            <>
              <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#475569' }}>Arrastra el archivo aquí o haz clic para seleccionarlo</Typography>
              <Typography sx={{ fontSize: 11.5, color: '#94a3b8', mt: 0.5 }}>Formatos aceptados: .xlsx, .xls, .csv · Máx 10 MB</Typography>
            </>
          )}
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2 }}>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <SearchRoundedIcon />}
            onClick={handleUpload}
            disabled={loading || !file}
            sx={{ fontWeight: 700, borderRadius: 1.5, px: 2.5, textTransform: 'none',
              background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}
          >
            {loading ? 'Procesando…' : 'Validar documentos'}
          </Button>
          {file && (
            <Button size="small" startIcon={<CloseRoundedIcon />}
              onClick={() => { setFile(null); setResult(null); setError(null); }}
              sx={{ textTransform: 'none', color: '#94a3b8', fontWeight: 600 }}>
              Limpiar
            </Button>
          )}
        </Stack>

        {loading && <LinearProgress variant="determinate" value={progress} sx={{ mt: 1.5, borderRadius: 1 }} />}
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {result && (
        <>
          {/* KPIs */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
            <KpiMini label="Total"          value={result.stats.total}         color="#475569"  icon={BadgeRoundedIcon} />
            <KpiMini label="Encontrados"    value={result.stats.encontrados}   color="#16a34a"  icon={CheckCircleRoundedIcon} />
            <KpiMini label="Validar info."  value={result.stats.validar ?? 0}  color="#dc2626"  icon={ReportProblemRoundedIcon} />
            <KpiMini label="No encontrados" value={result.stats.noEncontrados} color="#7f1d1d"  icon={CancelRoundedIcon} />
            <KpiMini label="Duplicados"     value={result.stats.duplicados}    color="#d97706"  icon={WarningAmberRoundedIcon} />
            <Box sx={{ ml: 'auto', alignSelf: 'center' }}>
              <Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={exportExcel}
                sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5, borderColor: '#10b981', color: '#10b981',
                  '&:hover': { bgcolor: '#f0fdf4', borderColor: '#059669' } }}>
                Exportar Excel
              </Button>
            </Box>
          </Stack>

          {/* Leyenda de alertas */}
          <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: '1px solid #fca5a5', bgcolor: '#fff5f5', mb: 1.5,
            display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <ErrorRoundedIcon sx={{ fontSize: 17, color: '#dc2626' }} />
            <Typography sx={{ fontSize: 11.5, color: '#7f1d1d', fontWeight: 600 }}>
              Las filas resaltadas en <strong>rojo</strong> indican registros con <strong>puntaje global 0</strong>, <strong>observaciones</strong> o estado <strong>"Validar información"</strong> que requieren revisión.
            </Typography>
          </Paper>

          {/* Filter chips */}
          <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap alignItems="center">
            {STATES.map((s) => (
              <Chip key={s} size="small" label={s} onClick={() => setFilter(s)}
                sx={{ fontWeight: 700, fontSize: 11,
                  bgcolor: filterState === s ? '#2563eb' : '#f1f5f9',
                  color:   filterState === s ? '#fff'    : '#475569',
                  border:  filterState === s ? 'none'    : '1px solid #e2e8f0' }} />
            ))}
            <Typography sx={{ fontSize: 11.5, color: '#94a3b8' }}>
              Mostrando {filtered.length} de {result.resultado.length} registros
            </Typography>
          </Stack>

          {/* Tabla rediseñada */}
          <Paper elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 520 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {[
                      { label: '#',             width: 42,  align: 'center' },
                      { label: 'Documento',     width: 110, align: 'left' },
                      { label: 'Nombre',        width: 180, align: 'left' },
                      { label: 'Programa',      width: 170, align: 'left' },
                      { label: 'Tipo',          width: 120, align: 'left' },
                      { label: 'Año / Periodo', width: 95,  align: 'center' },
                      { label: 'Puntaje',       width: 75,  align: 'center' },
                      { label: 'N° Registro',   width: 115, align: 'left' },
                      { label: 'Observaciones', width: 160, align: 'left' },
                      { label: 'Estado',        width: 130, align: 'center' },
                    ].map((h) => (
                      <TableCell key={h.label} align={h.align} sx={{
                        fontWeight: 800, fontSize: 10.5, color: '#475569',
                        bgcolor: '#f1f5f9', textTransform: 'uppercase', letterSpacing: '0.04em',
                        whiteSpace: 'nowrap', py: 1.2, minWidth: h.width,
                        borderBottom: '2px solid #e2e8f0'
                      }}>
                        {h.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.flatMap((row, rowIdx) => {
                    /* ── determinar sub-registros ── */
                    const subs = row.subrecords && row.subrecords.length > 0
                      ? row.subrecords
                      : [{
                          tipo_prueba:     row.tipo_prueba,
                          anio:            row.anio,
                          periodo:         row.periodo,
                          puntaje_global:  row.puntaje_global,
                          numero_registro: row.numero_registro,
                          observaciones:   row.observaciones,
                          hasAlert:        isAlertRow(row)
                        }];

                    const spanCount  = subs.length;
                    const overallAlert = isAlertRow(row);

                    /* Color del borde-izquierdo según estado global */
                    const leftBorderColor = row.estado === 'No encontrado' ? '#dc2626'
                      : overallAlert ? '#ef4444'
                      : row.estado === 'Duplicado' ? '#f59e0b'
                      : '#22c55e';

                    return subs.map((sub, subIdx) => {
                      const isFirst = subIdx === 0;
                      const isLast  = subIdx === spanCount - 1;
                      const subAlert = sub.hasAlert;

                      /* Background por sub-registro */
                      const subBg = row.estado === 'No encontrado' ? '#fff5f5'
                        : subAlert ? '#fde8e8'
                        : '#f7fdf9';

                      /* Estado individual del sub-registro */
                      const subEstado = row.estado === 'No encontrado' ? 'No encontrado'
                        : row.estado === 'Duplicado' ? 'Duplicado'
                        : subAlert ? 'Validar información'
                        : 'Encontrado';

                      /* Bordes entre sub-filas */
                      const cellBorderSx = isLast
                        ? { borderBottom: '3px solid #94a3b8 !important' }   /* separador entre estudiantes */
                        : { borderBottom: '1.5px solid #93c5fd !important' }; /* separador entre pruebas del mismo estudiante */

                      return (
                        <TableRow key={`${rowIdx}-${subIdx}`} sx={{ bgcolor: subBg,
                          '&:hover .MuiTableCell-root': { filter: 'brightness(0.96)' } }}>

                          {/* ── Celdas compartidas (rowSpan) — solo primera sub-fila ── */}
                          {isFirst && (
                            <>
                              {/* # / indicador */}
                              <TableCell rowSpan={spanCount} align="center"
                                sx={{ bgcolor: '#fff !important', py: 1.2,
                                  borderLeft: `4px solid ${leftBorderColor}`,
                                  ...cellBorderSx, verticalAlign: 'middle' }}>
                                {overallAlert
                                  ? <ReportProblemRoundedIcon sx={{ fontSize: 16, color: '#dc2626' }} />
                                  : <Typography sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>{rowIdx + 1}</Typography>
                                }
                              </TableCell>

                              {/* Documento */}
                              <TableCell rowSpan={spanCount}
                                sx={{ bgcolor: '#fff !important', py: 1.2,
                                  fontSize: 12, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap',
                                  ...cellBorderSx, verticalAlign: 'middle' }}>
                                {row.documento}
                              </TableCell>

                              {/* Nombre */}
                              <TableCell rowSpan={spanCount}
                                sx={{ bgcolor: '#fff !important', py: 1.2,
                                  ...cellBorderSx, verticalAlign: 'middle' }}>
                                <Tooltip title={row.nombre}>
                                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#334155',
                                    maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {row.nombre}
                                  </Typography>
                                </Tooltip>
                              </TableCell>

                              {/* Programa */}
                              <TableCell rowSpan={spanCount}
                                sx={{ bgcolor: '#fff !important', py: 1.2,
                                  ...cellBorderSx, verticalAlign: 'middle' }}>
                                <Tooltip title={row.programa}>
                                  <Typography sx={{ fontSize: 11.5, color: '#475569',
                                    maxWidth: 165, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {row.programa}
                                  </Typography>
                                </Tooltip>
                              </TableCell>
                            </>
                          )}

                          {/* ── Celdas por sub-registro ── */}

                          {/* Tipo */}
                          <TableCell sx={{ py: 1, ...cellBorderSx }}>
                            <TipoBadge tipo={sub.tipo_prueba} />
                          </TableCell>

                          {/* Año/Periodo */}
                          <TableCell align="center" sx={{ py: 1, ...cellBorderSx }}>
                            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                              {sub.anio}{sub.periodo && sub.periodo !== '—' ? `-${sub.periodo}` : ''}
                            </Typography>
                          </TableCell>

                          {/* Puntaje */}
                          <TableCell align="center" sx={{ py: 1, ...cellBorderSx }}>
                            {(() => {
                              const esCero = !isNaN(sub.puntaje_global) && parseFloat(sub.puntaje_global) === 0;
                              return (
                                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4,
                                  px: 0.9, py: 0.25, borderRadius: 1,
                                  bgcolor: esCero ? '#fee2e2' : 'transparent',
                                  border: esCero ? '1px solid #fca5a5' : 'none' }}>
                                  {esCero && <ErrorRoundedIcon sx={{ fontSize: 12, color: '#dc2626' }} />}
                                  <Typography sx={{ fontSize: 13, fontWeight: 900,
                                    color: esCero ? '#dc2626' : '#2563eb' }}>
                                    {sub.puntaje_global ?? '—'}
                                  </Typography>
                                </Box>
                              );
                            })()}
                          </TableCell>

                          {/* N° Registro */}
                          <TableCell sx={{ fontSize: 11.5, color: '#64748b', py: 1, whiteSpace: 'nowrap', ...cellBorderSx }}>
                            {sub.numero_registro || '—'}
                          </TableCell>

                          {/* Observaciones */}
                          <TableCell sx={{ py: 1, ...cellBorderSx }}>
                            {sub.observaciones && sub.observaciones !== '—' && sub.observaciones.trim() ? (
                              <Tooltip title={sub.observaciones}>
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                  <WarningAmberRoundedIcon sx={{ fontSize: 13, color: '#d97706', flexShrink: 0 }} />
                                  <Typography sx={{ fontSize: 11, color: '#92400e', fontWeight: 700,
                                    maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {sub.observaciones}
                                  </Typography>
                                </Stack>
                              </Tooltip>
                            ) : (
                              <Typography sx={{ fontSize: 11, color: '#cbd5e1' }}>—</Typography>
                            )}
                          </TableCell>

                          {/* Estado individual */}
                          <TableCell align="center" sx={{ py: 1, ...cellBorderSx }}>
                            {stateChip(subEstado, subAlert)}
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })}
                  {!filtered.length && (
                    <TableRow>
                      <TableCell colSpan={10} sx={{ textAlign: 'center', py: 5, color: '#94a3b8', fontSize: 13 }}>
                        No hay registros para el filtro seleccionado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {result.columnaDetectada && (
            <Typography sx={{ fontSize: 10.5, color: '#94a3b8', mt: 1 }}>
              Columna de documento detectada: <b>{result.columnaDetectada}</b>
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}

/* ══════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════ */
export default function ConsultaValidacion({ initialSection, allowedSections = [] }) {
  const VIEWS = useMemo(() => [
    { key: 'individual', label: 'Consulta Individual',  icon: PersonSearchRoundedIcon, color: '#2563eb' },
    { key: 'masiva',     label: 'Validación Masiva',    icon: UploadFileRoundedIcon,   color: '#10b981' }
  ], []);

  const visibleViews = useMemo(() => {
    if (!Array.isArray(allowedSections) || allowedSections.length === 0) return VIEWS;
    const allowed = new Set(allowedSections);
    return VIEWS.filter((v) => allowed.has(v.key));
  }, [VIEWS, allowedSections]);

  const defaultView = useMemo(() => {
    if (initialSection && visibleViews.some((v) => v.key === initialSection)) return initialSection;
    return visibleViews[0]?.key || 'individual';
  }, [initialSection, visibleViews]);

  const [view, setView] = useState(defaultView);

  useEffect(() => {
    if (!visibleViews.some((item) => item.key === view)) setView(defaultView);
  }, [defaultView, view, visibleViews]);

  return (
    <Box sx={{ bgcolor: '#f1f5f9', minHeight: 'calc(100vh - 84px)' }}>
      {visibleViews.length > 1 && (
        <Box sx={{ bgcolor: '#fff', borderBottom: '1px solid #e2e8f0', px: 2.5, display: 'flex', gap: 0 }}>
          {visibleViews.map((v) => {
            const Ic = v.icon;
            const active = view === v.key;
            return (
              <Stack key={v.key} direction="row" spacing={0.7} alignItems="center" onClick={() => setView(v.key)}
                sx={{
                  px: 2.5, py: 1.2, cursor: 'pointer', userSelect: 'none',
                  color: active ? v.color : '#64748b',
                  borderBottom: active ? `2.5px solid ${v.color}` : '2.5px solid transparent',
                  transition: 'all 0.15s',
                  '&:hover': { color: '#1e293b', bgcolor: '#f8fafc' }
                }}
              >
                <Ic sx={{ fontSize: 16 }} />
                <Typography sx={{ fontWeight: 700, fontSize: 12.5 }}>{v.label}</Typography>
              </Stack>
            );
          })}
        </Box>
      )}

      {view === 'individual' && <ConsultaIndividual />}
      {view === 'masiva'     && <CargaMasiva />}
    </Box>
  );
}
