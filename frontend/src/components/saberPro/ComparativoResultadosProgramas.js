import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Paper, Stack, Typography, Chip, ButtonBase,
  CircularProgress, IconButton, Button, Tooltip as MuiTooltip
} from '@mui/material';
import CompareArrowsRoundedIcon from '@mui/icons-material/CompareArrowsRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, LabelList, Cell
} from 'recharts';
import { useSnackbar } from 'notistack';
import saberProAnalyticsService from '../../services/saberProAnalyticsService';

/* ── Orden ICFES ── */
const PREFERRED = [
  'RAZONAMIENTO CUANTITATIVO',
  'LECTURA CRITICA',
  'COMUNICACION ESCRITA',
  'INGLES',
  'COMPETENCIAS CIUDADANAS'
];

const LABELS = {
  'RAZONAMIENTO CUANTITATIVO': 'Razonamiento Cuantitativo',
  'LECTURA CRITICA': 'Lectura Crítica',
  'COMUNICACION ESCRITA': 'Comunicación Escrita',
  'INGLES': 'Inglés',
  'COMPETENCIAS CIUDADANAS': 'Competencias Ciudadanas'
};

const COLORS = {
  'RAZONAMIENTO CUANTITATIVO': '#2563eb',
  'LECTURA CRITICA': '#7d2346',
  'COMUNICACION ESCRITA': '#014B43',
  'INGLES': '#053484',
  'COMPETENCIAS CIUDADANAS': '#B3081F'
};

const norm = (s) =>
  String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const getOrder = (c) => { const i = PREFERRED.indexOf(norm(c)); return i === -1 ? 999 : i; };
const getLabel = (c) => { const n = norm(c); return Object.entries(LABELS).find(([k]) => k === n)?.[1] ?? c; };
const getColor = (c) => { const n = norm(c); return COLORS[n] ?? '#2563eb'; };
const makeId   = (c, a) => `cmp-${norm(c).replace(/\s+/g, '-')}-${a}`;

/* ── Captura SVG → Canvas ── */
async function captureToCanvas(chartId, lines, grupoRef) {
  const el = document.getElementById(chartId);
  if (!el) throw new Error('not found');
  const svgEl = el.querySelector('.recharts-surface') || el.querySelector('svg[width][height]');
  if (!svgEl) throw new Error('no svg');

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { width: W, height: H } = svgEl.getBoundingClientRect();
  const PAD = 14, HDR = lines.length * 17 + 8, FTR = grupoRef != null ? 22 : 0;
  const cW = Math.round(W) + PAD * 2;
  const cH = Math.round(H) + HDR + FTR + PAD;

  const canvas = document.createElement('canvas');
  canvas.width = cW * dpr; canvas.height = cH * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cW, cH);

  lines.forEach((line, i) => {
    ctx.fillStyle = i === 0 ? '#000000' : '#64748b';
    ctx.font = i === 0
      ? 'bold 15px "Arial Narrow", Arial, sans-serif'
      : '600 12px "Arial Narrow", Arial, sans-serif';
    ctx.fillText(line, PAD, PAD + 14 + i * 18);
  });

  if (grupoRef != null) {
    const fy = HDR + Math.round(H) + 13;
    ctx.strokeStyle = '#d97706'; ctx.setLineDash([5, 3]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(PAD, fy); ctx.lineTo(PAD + 22, fy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b45309';
    ctx.font = '600 10px "Arial Narrow", Arial, sans-serif';
    ctx.fillText('Grupo de referencia', PAD + 26, fy + 4);
  }

  const clone = svgEl.cloneNode(true);
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  await new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, PAD, HDR, Math.round(W), Math.round(H)); URL.revokeObjectURL(url); res(); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')); };
    img.src = url;
  });
  return canvas;
}

async function pushToClipboard(canvas) {
  return new Promise((res, rej) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { rej(new Error('no blob')); return; }
      try {
        if (navigator.clipboard?.write) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          res('clipboard');
        } else {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'grafica.png';
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          res('download');
        }
      } catch (e) { rej(e); }
    }, 'image/png');
  });
}

async function captureSection(infos) {
  const canvases = [];
  for (const info of infos) {
    try { canvases.push(await captureToCanvas(info.id, [`${info.label} ${info.year}`], info.grupoRef)); }
    catch (e) { console.warn('skip', info.id, e); }
  }
  if (!canvases.length) throw new Error('nothing captured');

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const maxW = Math.max(...canvases.map(c => c.width / dpr));
  const maxH = Math.max(...canvases.map(c => c.height / dpr));
  const COLS = 1;
  const ROWS = Math.ceil(canvases.length / COLS);
  const GAP = 10, PAD = 12;
  const totalW = COLS * maxW + (COLS - 1) * GAP + PAD * 2;
  const totalH = ROWS * maxH + (ROWS - 1) * GAP + PAD * 2;

  const fin = document.createElement('canvas');
  fin.width = totalW * dpr; fin.height = totalH * dpr;
  const ctx = fin.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, totalW, totalH);

  canvases.forEach((c, i) => {
    const col = i % COLS, row = Math.floor(i / COLS);
    ctx.drawImage(c, PAD + col * (maxW + GAP), PAD + row * (maxH + GAP), c.width / dpr, c.height / dpr);
  });
  return pushToClipboard(fin);
}

/* ── Tooltip ── */
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <Paper elevation={0} sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', minWidth: 200 }}>
      <Typography sx={{ fontWeight: 800, fontSize: 12, color: '#475569', mb: 0.5 }}>{d.payload.programa}</Typography>
      <Stack direction="row" justifyContent="space-between" spacing={2}>
        <Typography sx={{ fontSize: 11.5, color: d.fill, fontWeight: 700 }}>Puntaje</Typography>
        <Typography sx={{ fontSize: 11.5, color: '#0f172a', fontWeight: 800 }}>{typeof d.value === 'number' ? d.value.toFixed(1) : d.value}</Typography>
      </Stack>
      {d.payload.grupoReferencia != null && (
        <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ mt: 0.3 }}>
          <Typography sx={{ fontSize: 11.5, color: '#b45309', fontWeight: 700 }}>Grupo referencia</Typography>
          <Typography sx={{ fontSize: 11.5, color: '#0f172a', fontWeight: 800 }}>{d.payload.grupoReferencia.toFixed(1)}</Typography>
        </Stack>
      )}
    </Paper>
  );
};

/* ── Label sobre la línea de referencia ── */
const RefLineLabel = ({ viewBox, value }) => {
  if (!viewBox) return null;
  return (
    <text
      x={viewBox.x}
      y={Math.max(14, (viewBox.y ?? 0) - 5)}
      textAnchor="middle"
      fill="#d97706"
      fontWeight="900"
      fontSize="14.5"
      fontFamily='"Arial Narrow", Arial, sans-serif'
    >
      {value}
    </text>
  );
};

/* ── Label dentro/fuera de la barra según ancho ── */
const BarValueLabel = ({ x, y, width, height, value }) => {
  if (typeof value !== 'number' || !width) return null;
  const label = String(Math.round(value));
  const h2 = (height ?? 0) / 2;
  if (width >= 40) {
    return (
      <text x={x + width - 6} y={y + h2} dy="0.35em"
        fill="rgba(255,255,255,0.98)" fontSize={13} fontWeight="900" textAnchor="end"
        fontFamily='"Arial Narrow", Arial, sans-serif'>
        {label}
      </text>
    );
  }
  return (
    <text x={x + width + 6} y={y + h2} dy="0.35em"
      fill="#000000" fontSize={13} fontWeight="900" textAnchor="start"
      fontFamily='"Arial Narrow", Arial, sans-serif'>
      {label}
    </text>
  );
};

/* ── Cuadrícula Personalizada ── */
const CustomCartesianGrid = ({ horizontalPoints, ...props }) => {
  const filteredPoints = horizontalPoints ? horizontalPoints.filter((_, idx) => idx % 2 === 0) : [];
  return <CartesianGrid {...props} horizontalPoints={filteredPoints} />;
};
CustomCartesianGrid.displayName = 'CartesianGrid';

/* ── Gráfica individual ── */
function ChartAnio({ anio, programas, grupoReferencia, color, competenciaLabel, chartId, onCopy }) {
  const BAR = 22;
  const data = programas.map((p) => ({ programa: p.programa, puntaje: p.puntaje, grupoReferencia }));
  if (!data.length) return null;

  const vals = data.map((d) => d.puntaje).filter(Boolean);
  const mn = Math.min(...vals, grupoReferencia ?? Infinity);
  const mx = Math.max(...vals, grupoReferencia ?? -Infinity);
  const sp = (mx - mn) || 10;
  const pad = Math.max(sp * 0.07, 3);
  const domain = [Math.max(0, Math.floor(mn - pad)), Math.ceil(mx + pad)];
  const chartH = Math.max(220, data.length * (BAR + 10) + 50);
  const yW = Math.min(240, Math.max(120, Math.max(...data.map((d) => d.programa.length)) * 7.6));

  return (
    <Paper id={chartId} elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#fff', overflow: 'hidden' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography sx={{ fontWeight: 900, fontSize: 15.5, color: '#000000', letterSpacing: '-0.01em', fontFamily: '"Arial Narrow", Arial, sans-serif' }}>
          {competenciaLabel} {anio}
        </Typography>
        <MuiTooltip title="Copiar gráfica" placement="top">
          <IconButton size="small" onClick={onCopy} sx={{ color: '#94a3b8', '&:hover': { color, bgcolor: `${color}10` } }}>
            <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </MuiTooltip>
      </Stack>

      <ResponsiveContainer width="100%" height={chartH}>
        <BarChart data={data} layout="vertical" margin={{ top: 26, right: 58, left: 4, bottom: 2 }} style={{ fontFamily: '"Arial Narrow", Arial, sans-serif' }}>
          <CustomCartesianGrid stroke="#cbd5e1" strokeDasharray="4 4" strokeOpacity={0.75} />
          <XAxis type="number" domain={domain} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 700, fontFamily: '"Arial Narrow", Arial, sans-serif' }} axisLine={false} tickLine={false} tickCount={6} />
          <YAxis dataKey="programa" type="category" tick={{ fontSize: 12.5, fill: '#1e293b', fontWeight: 700, fontFamily: '"Arial Narrow", Arial, sans-serif' }} axisLine={false} tickLine={false} width={yW} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
          <Bar dataKey="puntaje" name="Programa" radius={[0, 3, 3, 0]} barSize={BAR} isAnimationActive={false}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={grupoReferencia == null || entry.puntaje >= grupoReferencia ? color : `${color}e6`} />
            ))}
            <LabelList dataKey="puntaje" content={BarValueLabel} />
          </Bar>
          {grupoReferencia != null && (
            <ReferenceLine
              x={grupoReferencia}
              stroke="#d97706"
              strokeDasharray="6 3"
              strokeWidth={2.5}
              label={<RefLineLabel value={Math.round(grupoReferencia)} />}
            />
          )}
        </BarChart>
      </ResponsiveContainer>

      {grupoReferencia != null && (
        <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mt: 0.5, pl: `${yW + 4}px` }}>
          <Box sx={{ width: 22, borderTop: '2.5px dashed #d97706' }} />
          <Typography sx={{ fontSize: 10, color: '#b45309', fontWeight: 600 }}>Grupo de referencia</Typography>
        </Stack>
      )}
    </Paper>
  );
}

/* ── Principal ── */
function ComparativoResultadosProgramas() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading]             = useState(true);
  const [rawData, setRawData]             = useState(null);
  const [selectedAnios, setSelectedAnios] = useState([]);
  const [copying, setCopying]             = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await saberProAnalyticsService.getComparativoProgramasGenericas({});
      if (r?.success && r?.data) {
        setRawData(r.data);
        setSelectedAnios((r.data.anios || []).map(String));
      } else {
        enqueueSnackbar('No se pudieron cargar los datos', { variant: 'error' });
      }
    } catch { enqueueSnackbar('Error de conexión', { variant: 'error' }); }
    finally  { setLoading(false); }
  }, [enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const availableAnios = useMemo(() => (rawData?.anios || []).map(String).sort(), [rawData]);
  const competencias   = useMemo(() => (rawData?.competencias || []).slice().sort((a, b) => getOrder(a) - getOrder(b)), [rawData]);
  const byCA           = rawData?.byCompetenciaAnio || {};

  const toggleAnio = useCallback((a) => {
    setSelectedAnios((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a].sort());
  }, []);

  const doWithCopying = useCallback(async (fn) => {
    setCopying(true);
    try {
      const mode = await fn();
      enqueueSnackbar(mode === 'clipboard' ? 'Copiado al portapapeles' : 'Descargado como imagen', { variant: 'success' });
    } catch { enqueueSnackbar('No se pudo copiar. Intenta de nuevo.', { variant: 'warning' }); }
    finally { setCopying(false); }
  }, [enqueueSnackbar]);

  const handleCopyChart = useCallback((chartId, label, year, grupoRef) => {
    doWithCopying(async () => {
      const canvas = await captureToCanvas(chartId, [`${label} ${year}`], grupoRef);
      return pushToClipboard(canvas);
    });
  }, [doWithCopying]);

  const handleCopySection = useCallback((comp, aniosConDatos, compData) => {
    const label = getLabel(comp);
    const infos = aniosConDatos.map((a) => {
      const cell = compData[a] || compData[Number(a)] || {};
      return { id: makeId(comp, a), label, year: a, grupoRef: cell.grupoReferencia ?? null };
    });
    doWithCopying(() => captureSection(infos));
  }, [doWithCopying]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 340 }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress size={32} sx={{ color: '#2563eb' }} />
          <Typography sx={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>Cargando datos…</Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: '#f1f5f9', minHeight: 'calc(100vh - 120px)' }}>

      {/* ── Header sticky ── */}
      <Paper elevation={0} sx={{ position: 'sticky', top: 0, zIndex: 10, bgcolor: '#fff', borderBottom: '1px solid #e2e8f0', borderRadius: 0 }}>

        {/* Título */}
        <Stack direction="row" alignItems="center" justifyContent="space-between"
          sx={{ px: { xs: 2, md: 3 }, pt: 2, pb: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.3 }}>
              Resultados Agregados · Saber Pro
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <CompareArrowsRoundedIcon sx={{ fontSize: 19, color: '#2563eb' }} />
              <Typography sx={{ fontSize: 18, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1 }}>
                Comparativo Resultados de Programas
              </Typography>
            </Stack>
          </Box>
          <Chip
            size="small"
            label="Competencias Genéricas"
            sx={{ fontSize: 10.5, fontWeight: 700, bgcolor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', display: { xs: 'none', sm: 'flex' }, flexShrink: 0 }}
          />
        </Stack>

        {/* Filtro años */}
        <Box sx={{ px: { xs: 2, md: 3 }, pb: 1.5, borderTop: '1px solid #f1f5f9' }}>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ pt: 1.2 }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
              Año
            </Typography>
            <Stack direction="row" spacing={0.3} alignItems="center">
              <Button variant="text" size="small" onClick={() => setSelectedAnios(availableAnios)}
                sx={{ fontSize: 11, py: 0, px: 0.8, color: '#2563eb', minWidth: 0, textTransform: 'none', fontWeight: 700, lineHeight: 1.8 }}>
                Todos
              </Button>
              <Typography sx={{ fontSize: 10, color: '#cbd5e1' }}>·</Typography>
              <Button variant="text" size="small" onClick={() => setSelectedAnios([])}
                sx={{ fontSize: 11, py: 0, px: 0.8, color: '#94a3b8', minWidth: 0, textTransform: 'none', fontWeight: 700, lineHeight: 1.8 }}>
                Ninguno
              </Button>
            </Stack>
            <Box sx={{ width: '1px', height: 18, bgcolor: '#e2e8f0', flexShrink: 0 }} />
            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
              {availableAnios.map((a) => {
                const sel = selectedAnios.includes(a);
                return (
                  <ButtonBase
                    key={a}
                    onClick={() => toggleAnio(a)}
                    sx={{
                      border: `1.5px solid ${sel ? '#1d4ed8' : '#bfdbfe'}`,
                      borderRadius: '6px',
                      px: 1.5, py: '3px',
                      fontSize: 12, fontWeight: 700, lineHeight: 1.5,
                      bgcolor: sel ? '#2563eb' : '#eff6ff',
                      color: sel ? '#fff' : '#3b82f6',
                      transition: 'all 0.15s ease',
                      '&:hover': { bgcolor: sel ? '#1d4ed8' : '#dbeafe', borderColor: '#2563eb' }
                    }}
                  >
                    {a}
                  </ButtonBase>
                );
              })}
            </Stack>
            {selectedAnios.length > 0 && (
              <Typography sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {selectedAnios.length} año{selectedAnios.length !== 1 ? 's' : ''} · {competencias.length} competencias
              </Typography>
            )}
          </Stack>
        </Box>
      </Paper>

      {/* ── Contenido ── */}
      <Box sx={{ p: { xs: 1.5, md: 2.5 } }}>
        {competencias.length === 0 && (
          <Paper elevation={0} sx={{ p: 5, borderRadius: 2.5, border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <Typography sx={{ color: '#94a3b8', fontWeight: 600, fontSize: 14 }}>No hay datos disponibles</Typography>
          </Paper>
        )}

        {competencias.map((comp) => {
          const color = getColor(comp);
          const label = getLabel(comp);
          const compData = byCA[comp] || {};
          const aniosConDatos = selectedAnios.filter((a) => (compData[a] || compData[Number(a)])?.programas?.length > 0).sort();
          const cols = '1fr';

          return (
            <Box key={comp} sx={{ mb: 5 }}>
              <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
                <Box sx={{ width: 5, height: 24, borderRadius: 99, bgcolor: color, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 14, fontWeight: 900, color: '#0f172a', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {label}
                </Typography>
                <Box sx={{ flex: 1, height: 1, bgcolor: '#e2e8f0' }} />
                {aniosConDatos.length > 0 && (
                  <Button
                    size="small"
                    disabled={copying}
                    onClick={() => handleCopySection(comp, aniosConDatos, compData)}
                    startIcon={<PhotoLibraryRoundedIcon sx={{ fontSize: '14px !important' }} />}
                    sx={{
                      borderRadius: 1.5, textTransform: 'none', fontSize: 11, fontWeight: 700,
                      color, border: `1px solid ${color}35`, py: 0.3, px: 1.2,
                      '&:hover': { bgcolor: `${color}10`, borderColor: `${color}60` },
                      flexShrink: 0
                    }}
                  >
                    Copiar sección
                  </Button>
                )}
              </Stack>

              {aniosConDatos.length === 0 ? (
                <Typography sx={{ color: '#94a3b8', fontSize: 12.5, pl: 2 }}>Sin datos para los años seleccionados</Typography>
              ) : (
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: cols }}>
                  {aniosConDatos.map((anioStr) => {
                    const cell = compData[anioStr] || compData[Number(anioStr)] || {};
                    if (!cell.programas?.length) return null;
                    const chartId = makeId(comp, anioStr);
                    return (
                      <ChartAnio
                        key={anioStr}
                        anio={anioStr}
                        programas={cell.programas}
                        grupoReferencia={cell.grupoReferencia ?? null}
                        color={color}
                        competenciaLabel={label}
                        chartId={chartId}
                        onCopy={() => handleCopyChart(chartId, label, anioStr, cell.grupoReferencia ?? null)}
                      />
                    );
                  })}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export default ComparativoResultadosProgramas;