import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  CircularProgress,
  LinearProgress,
  Paper,
  Typography
} from '@mui/material';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import SearchIcon from '@mui/icons-material/Search';
import saberProAnalyticsService from '../../services/saberProAnalyticsService';

function CompactFilter({ label, options = [], value, onChange, disabled, placeholder = 'Buscar...' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

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

  const selected = options.find((item) => String(item.value) === String(value));
  const filteredOptions = options.filter((item) =>
    String(item.label || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box ref={ref} sx={{ position: 'relative', opacity: disabled ? 0.55 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      <Box
        onClick={() => setOpen((prev) => !prev)}
        sx={{
          minHeight: 54,
          px: 1.5,
          py: 1,
          borderRadius: 2,
          bgcolor: selected ? '#e0f2fe' : '#ffffff',
          border: `1.5px solid ${selected ? '#0891b2' : '#dbe6f5'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          cursor: 'pointer',
          transition: 'all 0.18s ease',
          '&:hover': { borderColor: '#0891b2', bgcolor: selected ? '#bae6fd' : '#f8fafc' }
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 10, fontWeight: 900, color: '#0f766e', letterSpacing: 0.6, textTransform: 'uppercase' }}>
            {label}
          </Typography>
          <Typography sx={{ mt: 0.2, fontSize: 13, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selected?.label || 'Todos'}
          </Typography>
        </Box>
        <Box sx={{ color: '#0891b2', fontWeight: 900, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s ease' }}>
          ▾
        </Box>
      </Box>

      {open && (
        <Box sx={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          zIndex: 1500,
          width: '100%',
          minWidth: 260,
          bgcolor: '#fff',
          borderRadius: 2,
          border: '1px solid #dbe6f5',
          boxShadow: '0 16px 38px rgba(15, 23, 42, 0.16)',
          overflow: 'hidden'
        }}>
          <Box sx={{ p: 1.2, borderBottom: '1px solid #eef2f7' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.8, borderRadius: 1.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <SearchIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={placeholder}
                style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, minWidth: 0, fontSize: 12, color: '#334155' }}
              />
            </Box>
          </Box>
          <Box sx={{ maxHeight: 260, overflowY: 'auto', p: 0.7 }}>
            <Box
              onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
              sx={{
                px: 1.2, py: 1, borderRadius: 1.5, fontSize: 13,
                fontWeight: value ? 600 : 900,
                color: value ? '#334155' : '#0f766e',
                cursor: 'pointer',
                '&:hover': { bgcolor: '#f0fdfa' }
              }}
            >
              Todos
            </Box>
            {filteredOptions.map((item) => {
              const active = String(item.value) === String(value);
              return (
                <Box
                  key={item.value}
                  onClick={() => { onChange(item.value); setOpen(false); setSearch(''); }}
                  sx={{
                    mt: 0.3, px: 1.2, py: 1, borderRadius: 1.5, fontSize: 13,
                    fontWeight: active ? 900 : 600,
                    color: active ? '#075985' : '#334155',
                    bgcolor: active ? '#e0f2fe' : '#fff',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: active ? '#bae6fd' : '#f8fafc' }
                  }}
                >
                  {item.label}
                </Box>
              );
            })}
            {filteredOptions.length === 0 && (
              <Typography sx={{ px: 1.2, py: 1.4, color: '#64748b', fontSize: 13 }}>Sin resultados.</Typography>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}

const CELL_SX = {
  base: { px: 1.5, py: 1, fontSize: 12.5, borderBottom: '1px solid #e2e8f0', textAlign: 'right' },
  header: { px: 1.5, py: 1, fontSize: 11, fontWeight: 900, color: '#fff', textAlign: 'right', bgcolor: '#1e3a5f', borderBottom: 'none', whiteSpace: 'nowrap' },
  moduloHeader: { px: 1.5, py: 1, fontSize: 11, fontWeight: 900, color: '#fff', textAlign: 'left', bgcolor: '#1e3a5f', borderBottom: 'none' },
  modulo: { px: 1.5, py: 1, fontSize: 12.5, fontWeight: 700, color: '#0f172a', textAlign: 'left', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' },
  promedio: { px: 1.5, py: 1.2, fontSize: 13, fontWeight: 900, color: '#1e3a5f', textAlign: 'right', borderTop: '2px solid #1e3a5f', bgcolor: '#f0f4f8' },
  promedioLabel: { px: 1.5, py: 1.2, fontSize: 13, fontWeight: 900, color: '#1e3a5f', textAlign: 'left', borderTop: '2px solid #1e3a5f', bgcolor: '#f0f4f8' }
};

function fmt(val) {
  if (val == null) return '-';
  return Number(val).toFixed(2);
}

export default function ResultadosIndividualesSaberPro({ tipoPrueba = 'saber_pro' }) {
  const [programa, setPrograma] = useState('');
  const [anio, setAnio] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (prog, yr, tp) => {
    setLoading(true);
    setError('');
    try {
      const filters = { tipoPrueba: tp };
      if (prog) filters.programas = [prog];
      if (yr) filters.anios = [Number(yr)];
      const res = await saberProAnalyticsService.getTablaModulosAnio(filters);
      setData(res?.data || null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(programa, anio, tipoPrueba); }, [load, programa, anio, tipoPrueba]);

  const programaOptions = (data?.programas || []).map((p) => ({ value: p, label: p }));
  const anioOptions = (data?.aniosDisponibles || []).map((y) => ({ value: String(y), label: String(y) }));
  const years = data?.years || [];
  const modulos = data?.modulos || [];
  const promedioRow = modulos.find((m) => m.modulo === 'PROMEDIO');
  const dataRows = modulos.filter((m) => m.modulo !== 'PROMEDIO');
  const trendData = data?.trendByYear || [];

  const yMin = trendData.length
    ? Math.floor(Math.min(...trendData.map((d) => d.promedio)) - 5)
    : 120;
  const yMax = trendData.length
    ? Math.ceil(Math.max(...trendData.map((d) => d.promedio)) + 5)
    : 160;

  return (
    <Box sx={{ bgcolor: '#f1f5f9', minHeight: '100%', p: { xs: 1.5, md: 2 } }}>

      {/* Filtros */}
      <Paper elevation={0} sx={{ mb: 2, p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <CompactFilter
            label="Programa"
            options={programaOptions}
            value={programa}
            onChange={setPrograma}
            disabled={loading}
            placeholder="Buscar programa..."
          />
          <CompactFilter
            label="Año"
            options={anioOptions}
            value={anio}
            onChange={setAnio}
            disabled={loading}
            placeholder="Buscar año..."
          />
        </Box>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

      {error && (
        <Paper elevation={0} sx={{ mb: 2, p: 1.5, borderRadius: 2, border: '1px solid #fecaca', bgcolor: '#fff1f2' }}>
          <Typography variant="body2" sx={{ color: '#991b1b', fontWeight: 700 }}>{error}</Typography>
        </Paper>
      )}

      {!loading && !error && data && (
        <>
          {/* Tabla módulos × año */}
          <Paper elevation={0} sx={{ mb: 2, borderRadius: 2.5, border: '1px solid #dbe6f5', overflow: 'hidden' }}>
            <Box sx={{ overflowX: 'auto' }}>
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <Box component="tr">
                    <Box component="th" sx={CELL_SX.moduloHeader}>Módulo</Box>
                    {years.map((y) => (
                      <Box component="th" key={y} sx={CELL_SX.header}>{y}</Box>
                    ))}
                  </Box>
                </thead>
                <tbody>
                  {dataRows.map((row, idx) => (
                    <Box
                      component="tr"
                      key={row.modulo}
                      sx={{ bgcolor: idx % 2 === 0 ? '#fff' : '#f8fafc', '&:hover': { bgcolor: '#eff6ff' } }}
                    >
                      <Box component="td" sx={CELL_SX.modulo}>{row.modulo}</Box>
                      {years.map((y) => (
                        <Box component="td" key={y} sx={CELL_SX.base}>{fmt(row.years[y])}</Box>
                      ))}
                    </Box>
                  ))}
                  {promedioRow && (
                    <Box component="tr">
                      <Box component="td" sx={CELL_SX.promedioLabel}>PROMEDIO</Box>
                      {years.map((y) => (
                        <Box component="td" key={y} sx={CELL_SX.promedio}>{fmt(promedioRow.years[y])}</Box>
                      ))}
                    </Box>
                  )}
                </tbody>
              </Box>
            </Box>
          </Paper>

          {/* Gráfico tendencia */}
          {trendData.length > 0 && (
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2.5, border: '1px solid #dbe6f5' }}>
              <Typography sx={{ fontWeight: 900, fontSize: 13, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1, mb: 0.5, bgcolor: '#1e3a5f', color: '#fff', py: 1, borderRadius: 1 }}>
                Competencias Genéricas
              </Typography>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={trendData} margin={{ top: 24, right: 24, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="anio"
                    tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                    label={{ value: 'Año', position: 'insideBottomRight', offset: -4, fontSize: 12, fill: '#64748b' }}
                  />
                  <YAxis
                    domain={[yMin, yMax]}
                    tick={{ fontSize: 12, fill: '#475569' }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: 'Puntaje 0-300', angle: -90, position: 'insideLeft', offset: 12, fontSize: 11, fill: '#64748b' }}
                  />
                  <Tooltip
                    formatter={(val) => [Number(val).toFixed(2), 'Promedio']}
                    labelFormatter={(label) => `Año ${label}`}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #dbe6f5' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="promedio"
                    stroke="#c0392b"
                    strokeWidth={2.5}
                    dot={{ fill: '#1e3a5f', r: 5, strokeWidth: 0 }}
                    activeDot={{ r: 7, fill: '#c0392b' }}
                    label={{ position: 'top', fontSize: 11, fontWeight: 700, fill: '#1e3a5f', formatter: (val) => Number(val).toFixed(2) }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          )}

          {modulos.length === 0 && !loading && (
            <Paper elevation={0} sx={{ p: 3, borderRadius: 2.5, border: '1px solid #fde68a', bgcolor: '#fffbeb', textAlign: 'center' }}>
              <Typography sx={{ color: '#92400e', fontWeight: 700 }}>
                No hay datos para los filtros seleccionados.
              </Typography>
            </Paper>
          )}
        </>
      )}

      {loading && !data && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={36} />
        </Box>
      )}
    </Box>
  );
}
