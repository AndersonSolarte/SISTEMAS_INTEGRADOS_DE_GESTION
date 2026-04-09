import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputAdornment,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from '@mui/material';
import Checkbox from '@mui/material/Checkbox';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

const NUM_MODULES = 8;
const ALL_YEARS = ['2021', '2022', '2023', '2024'];
const ALL_PERIODS = ['I', 'II'];
const MEDAL = {
  0: { bg: '#fef9c3', border: '#fde047', color: '#a16207', emoji: '🥇' },
  1: { bg: '#f1f5f9', border: '#cbd5e1', color: '#475569', emoji: '🥈' },
  2: { bg: '#fff7ed', border: '#fdba74', color: '#c2410c', emoji: '🥉' }
};

const SELECT_MENU_PROPS = { PaperProps: { style: { maxHeight: 360, maxWidth: 340 } } };
const fmt = (value) => (value == null ? '—' : Number(value).toLocaleString('es-CO', { maximumFractionDigits: 2 }));
const fmtAvg = (value) => (value == null ? '—' : (Number(value) / NUM_MODULES).toLocaleString('es-CO', { maximumFractionDigits: 2 }));
const uniq = (items = []) => Array.from(new Set(items.map((item) => String(item || '').trim()).filter(Boolean)));

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

function FilterMultiSelect({
  label,
  value = [],
  onChange = () => {},
  options = [],
  renderSelectedLabel,
  searchable = false
}) {
  const [search, setSearch] = useState('');
  const normalizedOptions = useMemo(() => uniq(options), [options]);
  const selected = useMemo(() => uniq(value), [value]);
  const filteredOptions = useMemo(() => {
    if (!searchable || !search.trim()) return normalizedOptions;
    const query = search.trim().toLowerCase();
    return normalizedOptions.filter((option) => option.toLowerCase().includes(query));
  }, [normalizedOptions, search, searchable]);
  const allSelected = normalizedOptions.length > 0 && selected.length === normalizedOptions.length;

  const handleChange = (event) => {
    const next = typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value;
    if (next.includes('__all__')) {
      onChange(normalizedOptions);
      return;
    }
    if (next.includes('__clear__')) {
      onChange([]);
      return;
    }
    onChange(next.filter((item) => !['__all__', '__clear__'].includes(item)));
  };

  return (
    <FormControl size="small" sx={{ width: '100%' }}>
      <InputLabel sx={{ fontSize: 12, fontWeight: 800 }}>{label}</InputLabel>
      <Select
        multiple
        value={selected}
        onChange={handleChange}
        input={<OutlinedInput label={label} />}
        renderValue={() => (renderSelectedLabel ? renderSelectedLabel(selected) : (selected.length ? `${selected.length} seleccionados` : 'Todos'))}
        MenuProps={SELECT_MENU_PROPS}
        sx={selectSx}
        onClose={() => setSearch('')}
      >
        {searchable && (
          <MenuItem
            disableRipple
            disableTouchRipple
            disableGutters
            dense
            sx={{ px: 1.2, py: 1, cursor: 'default', '&:hover': { bgcolor: 'transparent' } }}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <TextField
              fullWidth
              size="small"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar..."
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                  </InputAdornment>
                )
              }}
            />
          </MenuItem>
        )}
        <MenuItem value="__all__" sx={{ fontSize: 13, fontWeight: 700 }}>
          <Checkbox checked={allSelected} size="small" />
          <ListItemText primary={`Seleccionar todos (${normalizedOptions.length})`} />
        </MenuItem>
        <MenuItem value="__clear__" sx={{ fontSize: 13, fontWeight: 700 }}>
          <Checkbox checked={selected.length === 0} size="small" />
          <ListItemText primary="Limpiar selección" />
        </MenuItem>
        {filteredOptions.map((option) => (
          <MenuItem key={option} value={option} sx={{ fontSize: 13 }}>
            <Checkbox checked={selected.includes(option)} size="small" />
            <ListItemText primary={option} />
          </MenuItem>
        ))}
        {!filteredOptions.length && (
          <MenuItem disabled sx={{ fontSize: 13, color: '#94a3b8' }}>
            Sin coincidencias
          </MenuItem>
        )}
      </Select>
    </FormControl>
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
  const yearOptions = useMemo(
    () => uniq((catalogs.anios.length ? catalogs.anios : ALL_YEARS).map(String)).sort((a, b) => Number(a) - Number(b)),
    [catalogs.anios]
  );
  const periodOptions = useMemo(
    () => uniq((catalogs.periodos.length ? catalogs.periodos : ALL_PERIODS).map(String)),
    [catalogs.periodos]
  );

  const kpis = useMemo(() => {
    const scores = rows.map((row) => Number(row.puntaje_global)).filter(Number.isFinite);
    const percentiles = rows.map((row) => Number(row.percentil_nacional_global)).filter(Number.isFinite);
    const uniquePrograms = new Set(rows.map((row) => String(row.programa || '').trim()).filter(Boolean));
    return {
      total: rows.length,
      top: scores.length ? Math.max(...scores) : null,
      avg: scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null,
      pct: percentiles.length ? percentiles.reduce((sum, value) => sum + value, 0) / percentiles.length : null,
      programs: uniquePrograms.size
    };
  }, [rows]);

  const displayRows = useMemo(() => rows.slice(0, onlyTopPerProgram ? 200 : 50), [onlyTopPerProgram, rows]);
  const topScore = Number(displayRows[0]?.puntaje_global) || 1;
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
    ? 'Se muestra solo el estudiante con mayor puntaje global dentro de cada programa.'
    : 'Ordenado por puntaje global descendente';

  return (
    <Stack spacing={2}>
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 58%, #f59e0b 100%)',
          position: 'relative'
        }}
      >
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
              {onlyTopPerProgram ? 'Mejor resultado por programa' : 'Top institucional de puntaje global'} · {tipoPrueba === 'saber_pro' ? 'Saber Pro' : 'TyT'}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 1.5 }}>
        {[
          { icon: <GroupsRoundedIcon sx={{ fontSize: 19, color: '#2563eb' }} />, label: onlyTopPerProgram ? 'Programas visibles' : 'Estudiantes', value: onlyTopPerProgram ? (kpis.programs || '—') : (kpis.total || '—'), bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
          { icon: <EmojiEventsRoundedIcon sx={{ fontSize: 19, color: '#f59e0b' }} />, label: 'Mejor puntaje', value: fmt(kpis.top), bg: '#fffbeb', border: '#fde68a', color: '#b45309' },
          { icon: <SchoolRoundedIcon sx={{ fontSize: 19, color: '#10b981' }} />, label: 'Promedio global', value: fmt(kpis.avg), bg: '#f0fdf4', border: '#bbf7d0', color: '#065f46' },
          { icon: <WorkspacePremiumRoundedIcon sx={{ fontSize: 19, color: '#8b5cf6' }} />, label: 'Percentil prom.', value: kpis.pct != null ? `P${Math.round(kpis.pct)}` : '—', bg: '#faf5ff', border: '#ddd6fe', color: '#6d28d9' }
        ].map(({ icon, label, value, bg, border, color }) => (
          <Paper key={label} elevation={0} sx={{ p: 1.8, borderRadius: 2.5, border: `1.5px solid ${border}`, background: `linear-gradient(145deg, #fff 0%, ${bg} 100%)` }}>
            <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.6 }}>
              {icon}
              <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
              </Typography>
            </Stack>
            <Typography sx={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.03em' }}>
              {loading ? <CircularProgress size={16} thickness={5} sx={{ color }} /> : value}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Paper elevation={0} sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
        <Stack spacing={1.6}>
          <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={1.5} alignItems={{ xs: 'stretch', lg: 'center' }}>
            <Box>
              <Typography sx={{ fontSize: 13.5, fontWeight: 900, color: '#0f172a' }}>
                Filtros del ranking destacado
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#64748b', mt: 0.35 }}>
                Ajusta prueba, programa, año y periodo para perfilar el ranking institucional.
              </Typography>
            </Box>
            <ToggleButtonGroup
              exclusive
              value={onlyTopPerProgram ? 'programa' : 'general'}
              onChange={(_event, value) => {
                if (value) setOnlyTopPerProgram(value === 'programa');
              }}
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  textTransform: 'none',
                  fontWeight: 800,
                  px: 1.8,
                  py: 0.9,
                  borderRadius: 2,
                  borderColor: '#dbe4f0',
                  color: '#475569'
                },
                '& .Mui-selected': {
                  bgcolor: '#eff6ff',
                  color: '#1d4ed8',
                  borderColor: '#bfdbfe'
                }
              }}
            >
              <ToggleButton value="general">Top general</ToggleButton>
              <ToggleButton value="programa">1 por programa</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: '180px 1.3fr 220px 220px' }, gap: 1.4 }}>
            <FormControl size="small" sx={{ width: '100%' }}>
              <InputLabel sx={{ fontSize: 12, fontWeight: 800 }}>Prueba</InputLabel>
              <Select label="Prueba" value={tipoPrueba} onChange={(event) => setTipoPrueba(event.target.value)} sx={selectSx}>
                <MenuItem value="saber_pro" sx={{ fontSize: 13 }}>Saber Pro</MenuItem>
                <MenuItem value="tyt" sx={{ fontSize: 13 }}>TyT</MenuItem>
              </Select>
            </FormControl>

            <FilterMultiSelect
              label="Programas"
              value={programas}
              onChange={setProgramas}
              options={programOptions}
              searchable
              renderSelectedLabel={(selected) => {
                if (!selected.length) return 'Todos';
                if (selected.length === 1) return selected[0];
                return `${selected.length} programa(s)`;
              }}
            />

            <FilterMultiSelect
              label="Años"
              value={anios}
              onChange={setAnios}
              options={yearOptions}
              renderSelectedLabel={(selected) => (selected.length ? `${selected.length} año(s)` : 'Todos')}
            />

            <FilterMultiSelect
              label="Periodos"
              value={periodos}
              onChange={setPeriodos}
              options={periodOptions}
              renderSelectedLabel={(selected) => (selected.length ? `${selected.length} periodo(s)` : 'Todos')}
            />
          </Box>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={onlyTopPerProgram ? 'Modo: 1 mejor por programa' : 'Modo: top general'} sx={{ fontWeight: 800, bgcolor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }} />
              {!!programas.length && <Chip size="small" label={`${programas.length} programa(s)`} sx={{ fontWeight: 700, bgcolor: '#f8fafc', color: '#475569' }} />}
              {!!anios.length && <Chip size="small" label={`${anios.length} año(s)`} sx={{ fontWeight: 700, bgcolor: '#f8fafc', color: '#475569' }} />}
              {!!periodos.length && <Chip size="small" label={`${periodos.length} periodo(s)`} sx={{ fontWeight: 700, bgcolor: '#f8fafc', color: '#475569' }} />}
            </Stack>

            <Box sx={{ flexGrow: 1 }} />

            <Stack direction="row" spacing={1} alignItems="center">
              {hasFilters && (
                <Button
                  size="small"
                  startIcon={<CloseRoundedIcon sx={{ fontSize: 13 }} />}
                  onClick={clearFilters}
                  sx={{ height: 34, fontSize: 12, fontWeight: 700, color: '#ef4444', textTransform: 'none', px: 1.3, borderRadius: 1.8, '&:hover': { bgcolor: '#fff1f2' } }}
                >
                  Limpiar
                </Button>
              )}
              <Chip
                label={loading ? 'Cargando...' : `${displayRows.length} de ${rows.length}`}
                size="small"
                sx={{ height: 28, fontSize: 11.5, fontWeight: 800, bgcolor: '#fffbeb', color: '#b45309', border: '1.5px solid #fde68a' }}
              />
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      {error && (
        <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: '1px solid #fecaca', bgcolor: '#fff1f2' }}>
          <Typography variant="body2" sx={{ color: '#991b1b', fontWeight: 700 }}>
            {error}
          </Typography>
        </Paper>
      )}

      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', overflow: 'hidden' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, py: 1.6, borderBottom: '1px solid #f1f5f9' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <EmojiEventsRoundedIcon sx={{ fontSize: 19, color: '#f59e0b' }} />
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                {rankingTitle}
              </Typography>
              <Typography sx={{ fontSize: 11.5, color: '#94a3b8', mt: 0.2 }}>
                {rankingDescription}
              </Typography>
            </Box>
          </Stack>
          <Chip
            label={onlyTopPerProgram ? `${displayRows.length} programas` : `Top ${displayRows.length}`}
            size="small"
            sx={{ height: 24, fontSize: 11, fontWeight: 800, bgcolor: '#fffbeb', color: '#b45309', border: '1.5px solid #fde68a' }}
          />
        </Stack>

        {loading && (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
            <CircularProgress size={30} thickness={4} sx={{ color: '#f59e0b' }} />
            <Typography sx={{ mt: 1.5, fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>
              Cargando ranking...
            </Typography>
          </Stack>
        )}

        {!loading && !displayRows.length && (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 7 }}>
            <EmojiEventsRoundedIcon sx={{ fontSize: 38, color: '#e2e8f0', mb: 1.5 }} />
            <Typography sx={{ fontSize: 13.5, color: '#94a3b8', fontWeight: 700 }}>
              Sin resultados para los filtros activos
            </Typography>
          </Stack>
        )}

        {!loading && displayRows.length > 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  {['#', 'Nombre', 'N° Registro', 'Documento', 'Programa', 'Año · P.', 'Resultado global', 'Promedio'].map((header, index) => (
                    <TableCell
                      key={header}
                      align={index >= 6 ? 'right' : 'left'}
                      sx={{
                        fontWeight: 800,
                        fontSize: 10.5,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        py: 1.2,
                        pl: index === 0 ? 2.5 : undefined,
                        pr: index === 7 ? 2.5 : undefined
                      }}
                    >
                      {header}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {displayRows.map((row, index) => {
                  const medal = MEDAL[index];
                  const isTop3 = !onlyTopPerProgram && index < 3;
                  const bar = Math.round((Number(row.puntaje_global) / topScore) * 100);
                  return (
                    <TableRow
                      key={`${row.documento || row.numero_registro || index}-${index}`}
                      sx={{
                        bgcolor: isTop3 ? medal.bg : index % 2 === 0 ? '#fff' : '#fafafa',
                        '&:hover': { bgcolor: isTop3 ? medal.bg : '#f0f7ff' },
                        transition: 'background-color .15s'
                      }}
                    >
                      <TableCell sx={{ pl: 2.5, py: 1.1 }}>
                        {isTop3 ? (
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 1.5, bgcolor: medal.border, fontSize: 14 }}>
                            {medal.emoji}
                          </Box>
                        ) : (
                          <Typography sx={{ fontWeight: 800, fontSize: 12.5, color: '#94a3b8', pl: 0.5 }}>
                            {index + 1}
                          </Typography>
                        )}
                      </TableCell>

                      <TableCell sx={{ py: 1.1 }}>
                        <Typography sx={{ fontWeight: isTop3 ? 800 : 600, fontSize: 13, color: '#0f172a' }}>
                          {row.nombre || '—'}
                        </Typography>
                      </TableCell>

                      <TableCell sx={{ py: 1.1 }}>
                        <Typography sx={{ fontSize: 12, color: '#475569', fontFamily: 'monospace', fontWeight: 600 }}>
                          {row.numero_registro || '—'}
                        </Typography>
                      </TableCell>

                      <TableCell sx={{ py: 1.1 }}>
                        <Typography sx={{ fontSize: 12, color: '#64748b' }}>
                          {row.documento || '—'}
                        </Typography>
                      </TableCell>

                      <TableCell sx={{ py: 1.1 }}>
                        <Typography sx={{ fontSize: 12, color: '#334155', fontWeight: 600, maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row.programa || '—'}
                        </Typography>
                      </TableCell>

                      <TableCell sx={{ py: 1.1 }}>
                        <Chip
                          label={`${row.anio || '—'}-${row.periodo || '—'}`}
                          size="small"
                          sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: '#f1f5f9', color: '#475569' }}
                        />
                      </TableCell>

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

        {!loading && displayRows.length > 0 && (
          <Box sx={{ px: 2.5, py: 1.2, borderTop: '1px solid #f1f5f9', bgcolor: '#fafafa' }}>
            <Typography sx={{ fontSize: 10.5, color: '#94a3b8' }}>
              Promedio = Resultado global ÷ {NUM_MODULES} módulos · Fuente: ICFES / Base institucional · {onlyTopPerProgram ? 'mejor estudiante por programa' : 'top de mejores puntajes'}
            </Typography>
          </Box>
        )}
      </Paper>
    </Stack>
  );
}
