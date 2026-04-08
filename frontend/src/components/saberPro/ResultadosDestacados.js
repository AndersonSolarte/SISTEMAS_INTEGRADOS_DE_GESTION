import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Chip, CircularProgress, FormControl,
  InputLabel, MenuItem, OutlinedInput, Paper, Select,
  Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tooltip, Typography
} from '@mui/material';
import EmojiEventsRoundedIcon      from '@mui/icons-material/EmojiEventsRounded';
import GroupsRoundedIcon           from '@mui/icons-material/GroupsRounded';
import SchoolRoundedIcon           from '@mui/icons-material/SchoolRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import CloseRoundedIcon            from '@mui/icons-material/CloseRounded';
import saberProAnalyticsService    from '../../services/saberProAnalyticsService';

/* ─── constantes ──────────────────────────────────────────────────── */
const NUM_MODULES = 8;
const ALL_YEARS   = ['2021', '2022', '2023', '2024'];
const ALL_PERIODS = ['I', 'II'];
const MEDAL = {
  0: { bg: '#fef9c3', border: '#fde047', color: '#a16207', emoji: '🥇' },
  1: { bg: '#f1f5f9', border: '#cbd5e1', color: '#475569', emoji: '🥈' },
  2: { bg: '#fff7ed', border: '#fdba74', color: '#c2410c', emoji: '🥉' }
};

const fmt  = (v) => v == null ? '—' : Number(v).toLocaleString('es-CO', { maximumFractionDigits: 2 });
const fmtAvg = (v) => v == null ? '—' : (Number(v) / NUM_MODULES).toLocaleString('es-CO', { maximumFractionDigits: 2 });
const SEL = { PaperProps: { style: { maxHeight: 300 } } };

const selSx = {
  fontSize: 13, fontWeight: 600, height: 36, bgcolor: '#fff',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94a3b8' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#f59e0b', borderWidth: 1.5 }
};

/* ═══════════════════════════════════════════════════════════════════ */
export default function ResultadosDestacados() {
  const [tipoPrueba, setTipoPrueba] = useState('saber_pro');
  const [anios,      setAnios]      = useState([]);
  const [periodos,   setPeriodos]   = useState([]);

  const [rows,     setRows]     = useState([]);
  const [catalogs, setCatalogs] = useState({ anios: [], periodos: [] });
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  /* cargar catálogos una vez */
  useEffect(() => {
    saberProAnalyticsService.getFiltros()
      .then((d) => setCatalogs({
        anios:    (d?.anios    || []).map(String).sort((a, b) => b - a),
        periodos: d?.periodos  || []
      }))
      .catch(() => {});
  }, []);

  /* cargar datos */
  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    const filters = {
      tipoPrueba:  [tipoPrueba],
      ...(anios.length    && { anios    }),
      ...(periodos.length && { periodos })
    };
    saberProAnalyticsService
      .getTable({ filters, pagination: { page: 1, pageSize: 100 }, sort: [{ field: 'puntaje_global', direction: 'desc' }] })
      .then((res) => { setRows(res?.data?.rows || res?.rows || []); setLoading(false); })
      .catch(() => { setError('No se pudieron cargar los datos.'); setLoading(false); });
  }, [tipoPrueba, anios, periodos]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* KPIs */
  const kpis = useMemo(() => {
    const scores = rows.map((r) => Number(r.puntaje_global)).filter(Number.isFinite);
    const pcts   = rows.map((r) => Number(r.percentil_nacional_global)).filter(Number.isFinite);
    return {
      total: rows.length,
      top:   scores.length ? Math.max(...scores)                                  : null,
      avg:   scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length   : null,
      pct:   pcts.length   ? pcts.reduce((a, b) => a + b, 0)   / pcts.length     : null
    };
  }, [rows]);

  /* top 50 para la tabla */
  const displayRows = rows.slice(0, 50);
  const topScore    = Number(displayRows[0]?.puntaje_global) || 1;

  const hasFilters = anios.length || periodos.length || tipoPrueba !== 'saber_pro';
  const clearFilters = () => { setAnios([]); setPeriodos([]); setTipoPrueba('saber_pro'); };

  /* ── render ─────────────────────────────────────────────────────── */
  return (
    <Stack spacing={2}>

      {/* BANNER */}
      <Paper elevation={0} sx={{
        borderRadius: 3, overflow: 'hidden',
        background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 60%, #f59e0b 100%)',
        position: 'relative'
      }}>
        <Box sx={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)' }} />
        <Stack direction="row" alignItems="center" spacing={2} sx={{ px: 3, py: 2.2, position: 'relative' }}>
          <Box sx={{ width: 46, height: 46, borderRadius: 2.5, bgcolor: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <EmojiEventsRoundedIcon sx={{ color: '#fde047', fontSize: 26 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 19, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Mejores Resultados UNICESMAG
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', mt: 0.3 }}>
              Top 50 estudiantes con mayor puntaje global · {tipoPrueba === 'saber_pro' ? 'Saber Pro' : 'TyT'}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* KPI CARDS */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4,1fr)' }, gap: 1.5 }}>
        {[
          { icon: <GroupsRoundedIcon           sx={{ fontSize: 19, color: '#2563eb' }} />, label: 'Estudiantes',      value: kpis.total || '—', bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
          { icon: <EmojiEventsRoundedIcon      sx={{ fontSize: 19, color: '#f59e0b' }} />, label: 'Mejor puntaje',    value: fmt(kpis.top),     bg: '#fffbeb', border: '#fde68a', color: '#b45309' },
          { icon: <SchoolRoundedIcon           sx={{ fontSize: 19, color: '#10b981' }} />, label: 'Promedio global',  value: fmt(kpis.avg),     bg: '#f0fdf4', border: '#bbf7d0', color: '#065f46' },
          { icon: <WorkspacePremiumRoundedIcon sx={{ fontSize: 19, color: '#8b5cf6' }} />, label: 'Percentil prom.', value: kpis.pct != null ? `P${Math.round(kpis.pct)}` : '—', bg: '#faf5ff', border: '#ddd6fe', color: '#6d28d9' }
        ].map(({ icon, label, value, bg, border, color }) => (
          <Paper key={label} elevation={0} sx={{ p: 1.8, borderRadius: 2.5, border: `1.5px solid ${border}`, background: `linear-gradient(145deg,#fff 0%,${bg} 100%)` }}>
            <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.5 }}>
              {icon}
              <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</Typography>
            </Stack>
            <Typography sx={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.03em' }}>
              {loading ? <CircularProgress size={16} thickness={5} sx={{ color }} /> : value}
            </Typography>
          </Paper>
        ))}
      </Box>

      {/* FILTROS */}
      <Paper elevation={0} sx={{
        px: 2, py: 1.3, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#fff',
        display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap'
      }}>
        {/* Prueba */}
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel sx={{ fontSize: 12 }}>Prueba</InputLabel>
          <Select label="Prueba" value={tipoPrueba} onChange={(e) => setTipoPrueba(e.target.value)} sx={selSx}>
            <MenuItem value="saber_pro" sx={{ fontSize: 13 }}>Saber Pro</MenuItem>
            <MenuItem value="tyt"       sx={{ fontSize: 13 }}>TyT</MenuItem>
          </Select>
        </FormControl>

        {/* Años */}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel sx={{ fontSize: 12 }}>Años</InputLabel>
          <Select
            multiple value={anios}
            onChange={(e) => setAnios(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
            input={<OutlinedInput label="Años" />}
            renderValue={(s) => s.join(', ')}
            MenuProps={SEL} sx={selSx}
          >
            {(catalogs.anios.length ? catalogs.anios : ALL_YEARS).map((y) => (
              <MenuItem key={y} value={String(y)} sx={{ fontSize: 13 }}>{y}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Periodo */}
        <FormControl size="small" sx={{ minWidth: 115 }}>
          <InputLabel sx={{ fontSize: 12 }}>Periodo</InputLabel>
          <Select
            multiple value={periodos}
            onChange={(e) => setPeriodos(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
            input={<OutlinedInput label="Periodo" />}
            renderValue={(s) => s.join(', ')}
            MenuProps={SEL} sx={selSx}
          >
            {(catalogs.periodos.length ? catalogs.periodos : ALL_PERIODS).map((p) => (
              <MenuItem key={p} value={p} sx={{ fontSize: 13 }}>{p}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {hasFilters && (
          <Button size="small" startIcon={<CloseRoundedIcon sx={{ fontSize: 13 }} />} onClick={clearFilters}
            sx={{ height: 30, fontSize: 12, fontWeight: 600, color: '#ef4444', textTransform: 'none', px: 1.2, borderRadius: 1.5, '&:hover': { bgcolor: '#fff1f2' } }}>
            Limpiar
          </Button>
        )}

        <Box sx={{ flexGrow: 1 }} />
        <Chip
          label={loading ? 'Cargando…' : `${displayRows.length} de ${kpis.total}`}
          size="small"
          sx={{ height: 24, fontSize: 11.5, fontWeight: 700, bgcolor: '#fffbeb', color: '#b45309', border: '1.5px solid #fde68a' }}
        />
      </Paper>

      {/* ERROR */}
      {error && (
        <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: '1px solid #fecaca', bgcolor: '#fff1f2' }}>
          <Typography variant="body2" sx={{ color: '#991b1b', fontWeight: 700 }}>{error}</Typography>
        </Paper>
      )}

      {/* TABLA */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', overflow: 'hidden' }}>

        {/* cabecera */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, py: 1.6, borderBottom: '1px solid #f1f5f9' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <EmojiEventsRoundedIcon sx={{ fontSize: 19, color: '#f59e0b' }} />
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>Ranking general</Typography>
              <Typography sx={{ fontSize: 11.5, color: '#94a3b8', mt: 0.2 }}>Ordenado por puntaje global descendente</Typography>
            </Box>
          </Stack>
          <Chip label={`Top ${displayRows.length}`} size="small"
            sx={{ height: 22, fontSize: 11, fontWeight: 800, bgcolor: '#fffbeb', color: '#b45309', border: '1.5px solid #fde68a' }} />
        </Stack>

        {/* loading */}
        {loading && (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
            <CircularProgress size={30} thickness={4} sx={{ color: '#f59e0b' }} />
            <Typography sx={{ mt: 1.5, fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>Cargando ranking…</Typography>
          </Stack>
        )}

        {/* vacío */}
        {!loading && !displayRows.length && (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 7 }}>
            <EmojiEventsRoundedIcon sx={{ fontSize: 38, color: '#e2e8f0', mb: 1.5 }} />
            <Typography sx={{ fontSize: 13.5, color: '#94a3b8', fontWeight: 700 }}>Sin resultados para los filtros activos</Typography>
          </Stack>
        )}

        {/* tabla */}
        {!loading && displayRows.length > 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  {['#', 'Nombre', 'Nº Registro', 'Documento', 'Programa', 'Año · P.', 'Resultado global', 'Promedio'].map((h, i) => (
                    <TableCell key={h} align={i >= 6 ? 'right' : 'left'}
                      sx={{ fontWeight: 800, fontSize: 10.5, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', py: 1.2, pl: i === 0 ? 2.5 : undefined, pr: i === 7 ? 2.5 : undefined }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {displayRows.map((row, idx) => {
                  const medal  = MEDAL[idx];
                  const isTop3 = idx < 3;
                  const bar    = Math.round((Number(row.puntaje_global) / topScore) * 100);
                  return (
                    <TableRow key={`${row.documento || row.numero_registro || idx}-${idx}`}
                      sx={{ bgcolor: isTop3 ? medal.bg : idx % 2 === 0 ? '#fff' : '#fafafa', '&:hover': { bgcolor: isTop3 ? medal.bg : '#f0f7ff' }, transition: 'background-color .15s' }}>

                      {/* ranking */}
                      <TableCell sx={{ pl: 2.5, py: 1.1 }}>
                        {isTop3
                          ? <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 1.5, bgcolor: medal.border, fontSize: 14 }}>{medal.emoji}</Box>
                          : <Typography sx={{ fontWeight: 800, fontSize: 12.5, color: '#94a3b8', pl: 0.5 }}>{idx + 1}</Typography>}
                      </TableCell>

                      {/* nombre */}
                      <TableCell sx={{ py: 1.1 }}>
                        <Typography sx={{ fontWeight: isTop3 ? 800 : 600, fontSize: 13, color: '#0f172a' }}>
                          {row.nombre || '—'}
                        </Typography>
                      </TableCell>

                      {/* registro */}
                      <TableCell sx={{ py: 1.1 }}>
                        <Typography sx={{ fontSize: 12, color: '#475569', fontFamily: 'monospace', fontWeight: 600 }}>
                          {row.numero_registro || '—'}
                        </Typography>
                      </TableCell>

                      {/* documento */}
                      <TableCell sx={{ py: 1.1 }}>
                        <Typography sx={{ fontSize: 12, color: '#64748b' }}>{row.documento || '—'}</Typography>
                      </TableCell>

                      {/* programa */}
                      <TableCell sx={{ py: 1.1 }}>
                        <Typography sx={{ fontSize: 12, color: '#334155', fontWeight: 600, maxWidth: 190, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row.programa || '—'}
                        </Typography>
                      </TableCell>

                      {/* año · periodo */}
                      <TableCell sx={{ py: 1.1 }}>
                        <Chip label={`${row.anio || '—'}-${row.periodo || '—'}`} size="small"
                          sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: '#f1f5f9', color: '#475569' }} />
                      </TableCell>

                      {/* puntaje global */}
                      <TableCell align="right" sx={{ py: 1.1 }}>
                        <Stack alignItems="flex-end" spacing={0.3}>
                          <Typography sx={{ fontWeight: 900, fontSize: 15, color: isTop3 ? medal.color : '#1e293b', lineHeight: 1 }}>
                            {fmt(row.puntaje_global)}
                          </Typography>
                          <Box sx={{ width: 56, height: 4, borderRadius: 2, bgcolor: '#e2e8f0', overflow: 'hidden' }}>
                            <Box sx={{ width: `${bar}%`, height: '100%', borderRadius: 2, bgcolor: isTop3 ? medal.border : '#bfdbfe' }} />
                          </Box>
                          {row.percentil_nacional_global != null && (
                            <Typography sx={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>
                              P{Math.round(Number(row.percentil_nacional_global))} nac.
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>

                      {/* promedio */}
                      <TableCell align="right" sx={{ py: 1.1, pr: 2.5 }}>
                        <Tooltip title={`Puntaje global ÷ ${NUM_MODULES} módulos`} placement="top" arrow>
                          <Typography sx={{ fontWeight: 800, fontSize: 14, color: isTop3 ? medal.color : '#334155', cursor: 'default' }}>
                            {fmtAvg(row.puntaje_global)}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* pie */}
        {!loading && displayRows.length > 0 && (
          <Box sx={{ px: 2.5, py: 1.2, borderTop: '1px solid #f1f5f9', bgcolor: '#fafafa' }}>
            <Typography sx={{ fontSize: 10.5, color: '#94a3b8' }}>
              Promedio = Resultado global ÷ {NUM_MODULES} módulos · Fuente: ICFES / Base institucional · Top 50 mejores puntajes
            </Typography>
          </Box>
        )}
      </Paper>
    </Stack>
  );
}
