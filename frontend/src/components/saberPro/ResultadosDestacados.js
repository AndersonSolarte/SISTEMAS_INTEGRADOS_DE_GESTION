import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography
} from '@mui/material';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';

const NUM_MODULES = 8;
const ALL_YEARS = ['2021', '2022', '2023', '2024'];
const ALL_PERIODS = ['I', 'II'];
const MEDAL = {
  0: { bg: '#fef9c3', border: '#fde047', color: '#a16207', emoji: '🥇' },
  1: { bg: '#f1f5f9', border: '#cbd5e1', color: '#475569', emoji: '🥈' },
  2: { bg: '#fff7ed', border: '#fdba74', color: '#c2410c', emoji: '🥉' }
};

const fmt = (value) => (value == null ? '—' : Number(value).toLocaleString('es-CO', { maximumFractionDigits: 2 }));
const uniq = (items = []) => Array.from(new Set(items.map((item) => String(item || '').trim()).filter(Boolean)));
const getCompetenciasCount = (row) => {
  const count = Number(row?.total_competencias_evaluadas);
  return Number.isFinite(count) && count > 0 ? count : NUM_MODULES;
};
const getResultadoGlobal = (row) => {
  const average = Number(row?.promedio_competencias);
  const count = getCompetenciasCount(row);
  return Number.isFinite(average) ? average * count : null;
};
const getPromedioGeneral = (row) => {
  const average = Number(row?.promedio_competencias);
  return Number.isFinite(average) ? average : null;
};

const selectSx = {
  minHeight: 48,
  borderRadius: 2.25,
  bgcolor: '#fff',
  fontSize: 13,
  fontWeight: 700,
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#dbe4f0' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#8ea3bd' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#7c3aed', borderWidth: 1.5 }
};

function SmartFilterPanel({ label, value = [], onChange = () => {}, options = [], searchable = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const normalizedOptions = useMemo(() => uniq(options), [options]);
  const selected = useMemo(() => uniq(value), [value]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filteredOptions = useMemo(() => {
    if (!searchable || !search.trim()) return normalizedOptions;
    const query = search.trim().toLowerCase();
    return normalizedOptions.filter((option) => option.toLowerCase().includes(query));
  }, [normalizedOptions, search, searchable]);

  const allSelected = selected.length === 0;
  const isSelected = (option) => selected.includes(option);
  const toggle = (option) => onChange(isSelected(option) ? selected.filter((item) => item !== option) : [...selected, option]);
  const toggleAll = () => onChange(allSelected ? normalizedOptions : []);

  return (
    <Box ref={ref} sx={{ position: 'relative' }}>
      <Box
        onClick={() => setOpen((current) => !current)}
        sx={{
          cursor: 'pointer',
          borderRadius: '10px',
          p: '10px 14px',
          minHeight: 52,
          bgcolor: selected.length ? '#ede9fe' : '#fff',
          border: `1.5px solid ${selected.length ? '#7c3aed' : '#e2e8f0'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
          transition: 'all 0.15s',
          userSelect: 'none',
          '&:hover': { borderColor: '#7c3aed', bgcolor: selected.length ? '#e9d5ff' : '#faf8ff' }
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: '9px', fontWeight: 700, color: '#7c3aed', letterSpacing: '0.8px', textTransform: 'uppercase', mb: 0.25 }}>
            {label}
          </Typography>
          <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#312e81', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selected.length ? `${selected.length} seleccionado${selected.length > 1 ? 's' : ''}` : 'Todos'}
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
          {selected.length > 0 && (
            <Box
              onClick={(event) => { event.stopPropagation(); onChange([]); }}
              sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', '&:hover': { bgcolor: '#6d28d9' } }}
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </Box>
          )}
          <Box sx={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
          </Box>
        </Stack>
      </Box>

      {open && (
        <Box sx={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1400, width: '100%', minWidth: 220, bgcolor: '#fff', borderRadius: '12px', boxShadow: '0 12px 40px rgba(0,0,0,0.14)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {searchable && (
            <Box sx={{ p: 1.25, borderBottom: '1px solid #f1f5f9' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#f8fafc', borderRadius: '8px', px: 1.25, py: 0.75, border: '1px solid #e2e8f0' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar..." style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, flex: 1, color: '#334155', minWidth: 0 }} />
              </Box>
            </Box>
          )}

          <Box onClick={toggleAll} sx={{ px: 1.5, py: 0.875, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.25, borderBottom: '1px solid #f1f5f9', '&:hover': { bgcolor: '#f5f3ff' } }}>
            <Box sx={{ width: 15, height: 15, flexShrink: 0, borderRadius: '4px', border: `2px solid ${allSelected ? '#7c3aed' : '#d1d5db'}`, bgcolor: allSelected ? '#7c3aed' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {allSelected && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
            </Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#7c3aed' }}>Seleccionar todos ({normalizedOptions.length})</Typography>
          </Box>

          <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
            {filteredOptions.length === 0 ? (
              <Box sx={{ px: 2, py: 2, textAlign: 'center' }}>
                <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>Sin resultados</Typography>
              </Box>
            ) : filteredOptions.map((option) => (
              <Box key={option} onClick={() => toggle(option)} sx={{ px: 1.5, py: 0.75, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.25, '&:hover': { bgcolor: '#f5f3ff' } }}>
                <Box sx={{ width: 15, height: 15, flexShrink: 0, borderRadius: '4px', border: `2px solid ${isSelected(option) ? '#7c3aed' : '#d1d5db'}`, bgcolor: isSelected(option) ? '#7c3aed' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isSelected(option) && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                </Box>
                <Typography sx={{ fontSize: 12, color: '#334155' }}>{option}</Typography>
              </Box>
            ))}
          </Box>

          <Box sx={{ px: 1.5, py: 0.75, borderTop: '1px solid #f1f5f9', bgcolor: '#f8fafc' }}>
            <Typography sx={{ fontSize: '10px', color: '#94a3b8' }}>
              {selected.length > 0 ? `${selected.length} de ${normalizedOptions.length} seleccionados` : `${normalizedOptions.length} opciones`}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default function ResultadosDestacados({
  tipoPrueba = 'saber_pro',
  setTipoPrueba = () => {},
  programas = [],
  setProgramas = () => {},
  anios = [],
  setAnios = () => {},
  periodos = [],
  setPeriodos = () => {},
  onlyTopPerProgram = false,
  setOnlyTopPerProgram = () => {},
  rows = [],
  catalogs = { programas: [], anios: [], periodos: [] },
  loading = false,
  error = ''
}) {
  const programOptions = useMemo(() => uniq(catalogs.programas), [catalogs.programas]);
  const yearOptions = useMemo(() => uniq((catalogs.anios.length ? catalogs.anios : ALL_YEARS).map(String)).sort((a, b) => Number(a) - Number(b)), [catalogs.anios]);
  const periodOptions = useMemo(() => uniq((catalogs.periodos.length ? catalogs.periodos : ALL_PERIODS).map(String)), [catalogs.periodos]);

  const kpis = useMemo(() => {
    const totalScores = rows.map((row) => getResultadoGlobal(row)).filter(Number.isFinite);
    const averageScores = rows.map((row) => getPromedioGeneral(row)).filter(Number.isFinite);
    const percentiles = rows.map((row) => Number(row.percentil_nacional_global)).filter(Number.isFinite);
    const uniquePrograms = new Set(rows.map((row) => String(row.programa || '').trim()).filter(Boolean));
    return {
      total: rows.length,
      top: totalScores.length ? Math.max(...totalScores) : null,
      avg: averageScores.length ? averageScores.reduce((sum, value) => sum + value, 0) / averageScores.length : null,
      pct: percentiles.length ? percentiles.reduce((sum, value) => sum + value, 0) / percentiles.length : null,
      programs: uniquePrograms.size
    };
  }, [rows]);

  const displayRows = useMemo(() => rows.slice(0, onlyTopPerProgram ? 200 : 50), [onlyTopPerProgram, rows]);
  const topScore = getResultadoGlobal(displayRows[0]) || 1;
  const hasFilters = programas.length || anios.length || periodos.length || tipoPrueba !== 'saber_pro' || onlyTopPerProgram;

  const clearFilters = () => {
    setTipoPrueba('saber_pro');
    setProgramas([]);
    setAnios([]);
    setPeriodos([]);
    setOnlyTopPerProgram(false);
  };

  const rankingTitle = onlyTopPerProgram ? 'Mejor resultado por programa' : 'Ranking general';
  const rankingDescription = onlyTopPerProgram
    ? 'Se muestra solo el estudiante con mayor promedio general dentro de cada programa que tenga 5 genéricas y al menos 1 específica.'
    : 'Ordenado por promedio general descendente';

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ borderRadius: 3, overflow: 'hidden', background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 58%, #f59e0b 100%)', position: 'relative' }}>
        <Box sx={{ position: 'absolute', top: -28, right: -20, width: 128, height: 128, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.08)' }} />
        <Stack direction="row" alignItems="center" spacing={2} sx={{ px: 3, py: 2.4, position: 'relative' }}>
          <Box sx={{ width: 48, height: 48, borderRadius: 2.5, bgcolor: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <EmojiEventsRoundedIcon sx={{ color: '#fde047', fontSize: 26 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 19, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Mejores Resultados UNICESMAG
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.76)', mt: 0.35 }}>
              {onlyTopPerProgram ? 'Mejor resultado por programa' : 'Top institucional por promedio general'} · {tipoPrueba === 'saber_pro' ? 'Saber Pro' : 'TyT'}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 1.5 }}>
        {[
          { icon: <GroupsRoundedIcon sx={{ fontSize: 19, color: '#2563eb' }} />, label: onlyTopPerProgram ? 'Programas visibles' : 'Estudiantes', value: onlyTopPerProgram ? (kpis.programs || '—') : (kpis.total || '—'), bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
          { icon: <EmojiEventsRoundedIcon sx={{ fontSize: 19, color: '#f59e0b' }} />, label: 'Mejor resultado', value: fmt(kpis.top), bg: '#fffbeb', border: '#fde68a', color: '#b45309' },
          { icon: <SchoolRoundedIcon sx={{ fontSize: 19, color: '#10b981' }} />, label: 'Promedio general', value: fmt(kpis.avg), bg: '#f0fdf4', border: '#bbf7d0', color: '#065f46' },
          { icon: <WorkspacePremiumRoundedIcon sx={{ fontSize: 19, color: '#8b5cf6' }} />, label: 'Percentil prom.', value: kpis.pct != null ? `P${Math.round(kpis.pct)}` : '—', bg: '#faf5ff', border: '#ddd6fe', color: '#6d28d9' }
        ].map(({ icon, label, value, bg, border, color }) => (
          <Paper key={label} elevation={0} sx={{ p: 1.8, borderRadius: 2.5, border: `1.5px solid ${border}`, background: `linear-gradient(145deg, #fff 0%, ${bg} 100%)` }}>
            <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.6 }}>
              {icon}
              <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</Typography>
            </Stack>
            <Typography sx={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.03em' }}>
              {loading ? <CircularProgress size={16} thickness={5} sx={{ color }} /> : value}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Paper elevation={0} sx={{ p: 2.2, borderRadius: 4, border: '1px solid #ddd6fe', background: 'linear-gradient(135deg, #ffffff 0%, #f5f3ff 48%, #eff6ff 100%)' }}>
        <Stack spacing={1.6}>
          <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={1.5}>
            <Box>
              <Typography sx={{ fontSize: 28, fontWeight: 900, color: '#312e81', letterSpacing: '-0.03em' }}>
                Filtros Destacados
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#64748b', mt: 0.5 }}>
                Usa el mismo esquema de filtros de Valor Agregado para perfilar el ranking institucional.
              </Typography>
              {onlyTopPerProgram && (
                <Typography sx={{ fontSize: 11.5, color: '#7c2d12', mt: 0.75, fontWeight: 700 }}>
                  Regla activa: 1 por programa solo considera estudiantes con las 5 competencias genéricas y al menos 1 específica.
                </Typography>
              )}
            </Box>
            <Chip
              label={onlyTopPerProgram ? 'MEJOR POR PROGRAMA' : 'TOP GENERAL'}
              sx={{
                alignSelf: { xs: 'flex-start', lg: 'center' },
                bgcolor: onlyTopPerProgram ? '#dcfce7' : '#eff6ff',
                color: onlyTopPerProgram ? '#166534' : '#1d4ed8',
                border: `1px solid ${onlyTopPerProgram ? '#86efac' : '#bfdbfe'}`,
                fontWeight: 900
              }}
            />
          </Stack>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
            <FormControl size="small" sx={{ width: '100%' }}>
              <InputLabel sx={{ fontSize: 12, fontWeight: 800 }}>Prueba</InputLabel>
              <Select label="Prueba" value={tipoPrueba} onChange={(event) => setTipoPrueba(event.target.value)} sx={selectSx}>
                <MenuItem value="saber_pro" sx={{ fontSize: 13 }}>Saber Pro</MenuItem>
                <MenuItem value="tyt" sx={{ fontSize: 13 }}>TyT</MenuItem>
              </Select>
            </FormControl>

            <SmartFilterPanel label="Programas" value={programas} onChange={setProgramas} options={programOptions} searchable />
            <SmartFilterPanel label="Años" value={anios} onChange={setAnios} options={yearOptions} />
            <SmartFilterPanel label="Periodos" value={periodos} onChange={setPeriodos} options={periodOptions} />
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap">
            {[
              ['general', 'Top General'],
              ['programa', '1 por Programa']
            ].map(([key, label]) => (
              <Chip
                key={key}
                label={label}
                onClick={() => setOnlyTopPerProgram(key === 'programa')}
                sx={{
                  bgcolor: (onlyTopPerProgram ? 'programa' : 'general') === key ? '#7c3aed' : '#fff',
                  color: (onlyTopPerProgram ? 'programa' : 'general') === key ? '#fff' : '#5b21b6',
                  border: '1px solid #ddd6fe',
                  fontWeight: 800,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: (onlyTopPerProgram ? 'programa' : 'general') === key ? '#6d28d9' : '#f5f3ff' }
                }}
              />
            ))}
            {hasFilters && (
              <Chip
                label="Limpiar filtros"
                onClick={clearFilters}
                sx={{
                  bgcolor: '#fff1f2',
                  color: '#be123c',
                  border: '1px solid #fecdd3',
                  fontWeight: 800,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: '#ffe4e6' }
                }}
              />
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {!!programas.length && <Chip size="small" label={`${programas.length} programa(s)`} sx={{ fontWeight: 700, bgcolor: '#f8fafc', color: '#475569' }} />}
              {!!anios.length && <Chip size="small" label={`${anios.length} año(s)`} sx={{ fontWeight: 700, bgcolor: '#f8fafc', color: '#475569' }} />}
              {!!periodos.length && <Chip size="small" label={`${periodos.length} periodo(s)`} sx={{ fontWeight: 700, bgcolor: '#f8fafc', color: '#475569' }} />}
              <Chip label={loading ? 'Cargando...' : `${displayRows.length} de ${rows.length}`} size="small" sx={{ fontWeight: 800, bgcolor: '#fffbeb', color: '#b45309', border: '1.5px solid #fde68a' }} />
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      {error && (
        <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: '1px solid #fecaca', bgcolor: '#fff1f2' }}>
          <Typography variant="body2" sx={{ color: '#991b1b', fontWeight: 700 }}>{error}</Typography>
        </Paper>
      )}

      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', overflow: 'hidden' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, py: 1.6, borderBottom: '1px solid #f1f5f9' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <EmojiEventsRoundedIcon sx={{ fontSize: 19, color: '#f59e0b' }} />
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{rankingTitle}</Typography>
              <Typography sx={{ fontSize: 11.5, color: '#94a3b8', mt: 0.2 }}>{rankingDescription}</Typography>
            </Box>
          </Stack>
          <Chip label={onlyTopPerProgram ? `${displayRows.length} programas` : `Top ${displayRows.length}`} size="small" sx={{ height: 24, fontSize: 11, fontWeight: 800, bgcolor: '#fffbeb', color: '#b45309', border: '1.5px solid #fde68a' }} />
        </Stack>

        {loading && (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
            <CircularProgress size={30} thickness={4} sx={{ color: '#f59e0b' }} />
            <Typography sx={{ mt: 1.5, fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>Cargando ranking...</Typography>
          </Stack>
        )}

        {!loading && !displayRows.length && (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 7 }}>
            <EmojiEventsRoundedIcon sx={{ fontSize: 38, color: '#e2e8f0', mb: 1.5 }} />
            <Typography sx={{ fontSize: 13.5, color: '#94a3b8', fontWeight: 700 }}>Sin resultados para los filtros activos</Typography>
          </Stack>
        )}

        {!loading && displayRows.length > 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  {['#', 'Nombre', 'N° Registro', 'Documento', 'Programa', 'Año · P.', 'Resultado global', 'Promedio general'].map((header, index) => (
                    <TableCell key={header} align={index >= 6 ? 'right' : 'left'} sx={{ fontWeight: 800, fontSize: 10.5, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', py: 1.2, pl: index === 0 ? 2.5 : undefined, pr: index === 7 ? 2.5 : undefined }}>
                      {header}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {displayRows.map((row, index) => {
                  const medal = MEDAL[index];
                  const isTop3 = !onlyTopPerProgram && index < 3;
                  const resultadoGlobal = getResultadoGlobal(row);
                  const promedioGeneral = getPromedioGeneral(row);
                  const competenciasEvaluadas = getCompetenciasCount(row);
                  const bar = Math.round(((resultadoGlobal || 0) / topScore) * 100);
                  return (
                    <TableRow key={`${row.documento || row.numero_registro || index}-${index}`} sx={{ bgcolor: isTop3 ? medal.bg : index % 2 === 0 ? '#fff' : '#fafafa', '&:hover': { bgcolor: isTop3 ? medal.bg : '#f0f7ff' }, transition: 'background-color .15s' }}>
                      <TableCell sx={{ pl: 2.5, py: 1.1 }}>
                        {isTop3 ? (
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 1.5, bgcolor: medal.border, fontSize: 14 }}>{medal.emoji}</Box>
                        ) : (
                          <Typography sx={{ fontWeight: 800, fontSize: 12.5, color: '#94a3b8', pl: 0.5 }}>{index + 1}</Typography>
                        )}
                      </TableCell>

                      <TableCell sx={{ py: 1.1 }}><Typography sx={{ fontWeight: isTop3 ? 800 : 600, fontSize: 13, color: '#0f172a' }}>{row.nombre || '—'}</Typography></TableCell>
                      <TableCell sx={{ py: 1.1 }}><Typography sx={{ fontSize: 12, color: '#475569', fontFamily: 'monospace', fontWeight: 600 }}>{row.numero_registro || '—'}</Typography></TableCell>
                      <TableCell sx={{ py: 1.1 }}><Typography sx={{ fontSize: 12, color: '#64748b' }}>{row.documento || '—'}</Typography></TableCell>
                      <TableCell sx={{ py: 1.1 }}><Typography sx={{ fontSize: 12, color: '#334155', fontWeight: 600, maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.programa || '—'}</Typography></TableCell>
                      <TableCell sx={{ py: 1.1 }}><Chip label={`${row.anio || '—'}-${row.periodo || '—'}`} size="small" sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: '#f1f5f9', color: '#475569' }} /></TableCell>

                      <TableCell align="right" sx={{ py: 1.1 }}>
                        <Stack alignItems="flex-end" spacing={0.3}>
                          <Typography sx={{ fontWeight: 900, fontSize: 15, color: isTop3 ? medal.color : '#1e293b', lineHeight: 1 }}>{fmt(resultadoGlobal)}</Typography>
                          <Box sx={{ width: 56, height: 4, borderRadius: 2, bgcolor: '#e2e8f0', overflow: 'hidden' }}>
                            <Box sx={{ width: `${bar}%`, height: '100%', borderRadius: 2, bgcolor: isTop3 ? medal.border : '#bfdbfe' }} />
                          </Box>
                          {row.percentil_nacional_global != null && <Typography sx={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>P{Math.round(Number(row.percentil_nacional_global))} nac.</Typography>}
                        </Stack>
                      </TableCell>

                      <TableCell align="right" sx={{ py: 1.1, pr: 2.5 }}>
                        <Tooltip title={`Resultado global ÷ ${competenciasEvaluadas} competencias evaluadas`} placement="top" arrow>
                          <Typography sx={{ fontWeight: 800, fontSize: 14, color: isTop3 ? medal.color : '#334155', cursor: 'default' }}>{fmt(promedioGeneral)}</Typography>
                        </Tooltip>
                        <Typography sx={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{competenciasEvaluadas} comp.</Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {!loading && displayRows.length > 0 && (
          <Box sx={{ px: 2.5, py: 1.2, borderTop: '1px solid #f1f5f9', bgcolor: '#fafafa' }}>
            <Typography sx={{ fontSize: 10.5, color: '#94a3b8' }}>
              Resultado global = suma de competencias evaluadas · Promedio general = resultado global / competencias evaluadas · Fuente: ICFES / Base institucional · {onlyTopPerProgram ? 'mejor estudiante por programa' : 'top de mejores puntajes'}
            </Typography>
          </Box>
        )}
      </Paper>
    </Stack>
  );
}
