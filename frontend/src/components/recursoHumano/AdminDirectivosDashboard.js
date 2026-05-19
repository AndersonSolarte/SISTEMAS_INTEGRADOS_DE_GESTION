import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Fade,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import {
  Business as BusinessIcon,
  ContentCopy as ContentCopyIcon,
  FilterAltOff as FilterAltOffIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useSnackbar } from 'notistack';
import html2canvas from 'html2canvas';
import gestionInformacionService from '../../services/gestionInformacionService';

/* ═══════════════════════════ PALETTE ════════════════════════════════════════ */
const C = {
  admin:     { base: '#1f73e8', light: '#b8cae9', border: '#6aa3ff', shadow: 'rgba(31,115,232,0.13)' },
  outsource: { base: '#1565c0', light: '#90caf9', border: '#64b5f6', shadow: 'rgba(21,101,192,0.13)'  },
  ondas:     { base: '#0288d1', light: '#b3e5fc', border: '#4fc3f7', shadow: 'rgba(2,136,209,0.13)'   }
};
const GC        = '#0d47a1';
const TEXT_BLUE = '#1764c9';
const SOFT_BG   = '#f8fbff';
const numFmt    = new Intl.NumberFormat('es-CO');
const RADIAN    = Math.PI / 180;

/* ═══════════════════════════ NORMALIZERS ════════════════════════════════════ */
const nt = (v) => String(v || '').trim();
const nu = (v) => nt(v).toUpperCase();

const nGender = (v) => {
  const r = nu(v);
  if (['M', 'MASCULINO', 'HOMBRE'].includes(r)) return 'MASCULINO';
  if (['F', 'FEMENINO', 'MUJER'].includes(r))   return 'FEMENINO';
  return r || 'SIN INFO';
};

const nPeriod = (v) => {
  if (!v && v !== 0) return '';
  const t = nt(v);
  const n = Number(t.replace(',', '.'));
  if (Number.isFinite(n) && n > 20000 && n < 90000) {
    const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
    return d.getUTCMonth() + 1 <= 6 ? 'IP' : 'IIP';
  }
  const u = t.toUpperCase();
  if (/\b(IIP|II|2)\b/.test(u)) return 'IIP';
  if (/\b(IP|I|1)\b/.test(u))   return 'IP';
  return '';
};

const getYear    = (row) => { const y = Number(row?.anio || 0); return (Number.isFinite(y) && y >= 1900 && y <= 2200) ? String(y) : ''; };
const getPeriodL = (row) => { const y = getYear(row); const p = nPeriod(row?.periodo || ''); return y && p ? `${y} ${p}` : y || ''; };

const sortPeriods = (arr) => {
  const ord = { IP: 1, IIP: 2 };
  return [...arr].sort((a, b) => {
    const [ya, pa] = String(a).split(/\s+/);
    const [yb, pb] = String(b).split(/\s+/);
    return Number(yb || 0) - Number(ya || 0) || (ord[pa] || 9) - (ord[pb] || 9);
  });
};

const uniq = (rows, fn) =>
  Array.from(new Set(rows.map((r) => nt(fn(r))).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));

const groupBy = (rows, fn, weightFn = null) => {
  const m = new Map();
  rows.forEach((r) => {
    const k = nt(fn(r)) || 'Sin información';
    const w = weightFn ? Number(weightFn(r) || 1) : 1;
    m.set(k, (m.get(k) || 0) + w);
  });
  return [...m.entries()].map(([name, value]) => ({ name, value })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
};

const buildGenderData = (groups) =>
  ['MASCULINO', 'FEMENINO']
    .map((n) => ({ name: n, value: Number((groups.find((g) => g.name === n) || { value: 0 }).value || 0) }))
    .filter((x) => x.value > 0);

const emptyF = { anio: '', periodo: '', dependencia: '', vicerectoria: '' };

/* ═══════════════════════════ COPY TO CLIPBOARD ═════════════════════════════ */
const copyChartAsImage = async (cardEl, enqueueSnackbar) => {
  try {
    const canvas = await html2canvas(cardEl, {
      scale: 3, useCORS: true, backgroundColor: '#ffffff', logging: false,
      ignoreElements: (el) => el.hasAttribute('data-copy-btn')
    });
    canvas.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        enqueueSnackbar('Gráfico copiado al portapapeles', { variant: 'success' });
      } catch {
        enqueueSnackbar('No se pudo copiar al portapapeles', { variant: 'warning' });
      }
    }, 'image/png');
  } catch {
    enqueueSnackbar('Error al copiar el gráfico', { variant: 'error' });
  }
};

const CopyChartBtn = ({ chartRef }) => {
  const { enqueueSnackbar } = useSnackbar();
  return (
    <IconButton
      data-copy-btn="true"
      size="small"
      title="Copiar gráfico"
      onClick={() => { if (chartRef?.current) copyChartAsImage(chartRef.current, enqueueSnackbar); }}
      sx={{
        position: 'absolute', top: 4, right: 4, zIndex: 10,
        width: 26, height: 26,
        bgcolor: 'rgba(255,255,255,.88)', border: '1px solid #dbeafe', color: C.admin.base,
        '&:hover': { bgcolor: '#eff6ff', borderColor: C.admin.base }
      }}
    >
      <ContentCopyIcon sx={{ fontSize: 13 }} />
    </IconButton>
  );
};

/* ═══════════════════════════ DONUT LABEL ════════════════════════════════════ */
const DonutLabel = ({ cx, cy, midAngle, outerRadius, value, total }) => {
  if (!value || !total) return null;
  const r = Number(outerRadius || 0) + 16;
  const x = Number(cx || 0) + r * Math.cos(-midAngle * RADIAN);
  const y = Number(cy || 0) + r * Math.sin(-midAngle * RADIAN);
  const pct = ((value / total) * 100).toFixed(1).replace('.', ',');
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="#0f172a">
      <tspan x={x} dy="-0.38em" style={{ fontSize: 13, fontWeight: 950 }}>{numFmt.format(value)}</tspan>
      <tspan x={x} dy="1.22em"  style={{ fontSize: 10, fontWeight: 900 }}>{pct}%</tspan>
    </text>
  );
};

/* ════════════════════════════ PILL HEADER ═══════════════════════════════════ */
const PillHeader = ({ label, palette, fontSize = 16 }) => (
  <Box sx={{ bgcolor: palette.base, px: 2.2, py: 1.2 }}>
    <Box sx={{
      mx: 'auto', maxWidth: 320, minHeight: 34, px: 2.2,
      border: '1px solid rgba(255,255,255,.88)', borderRadius: 999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#ffffff', fontSize, fontWeight: 950, textTransform: 'uppercase',
      lineHeight: 1.1, textAlign: 'center', background: 'rgba(255,255,255,.1)'
    }}>
      {label}
    </Box>
  </Box>
);

/* ═════════════════════════ DONUT CONTENT ════════════════════════════════════ */
const DonutContent = ({ total, genderData, palette }) => {
  const colors = [palette.base, palette.light];
  if (!genderData.length && total === 0) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
        <Typography sx={{ color: '#94a3b8', fontWeight: 700, fontSize: 13 }}>Sin datos</Typography>
      </Stack>
    );
  }
  return (
    <Stack sx={{ height: '100%' }}>
      <Box sx={{ flex: 1, position: 'relative', minHeight: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={genderData} dataKey="value" nameKey="name" cx="50%" cy="50%"
              innerRadius={52} outerRadius={82} paddingAngle={1} startAngle={90} endAngle={-270}
              label={(props) => <DonutLabel {...props} total={total} />}
              labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
              isAnimationActive animationDuration={900}>
              {genderData.map((e, i) => (
                <Cell key={e.name} fill={colors[i % colors.length]} stroke="#ffffff" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip formatter={(v, n) => [
              `${numFmt.format(Number(v || 0))} (${total ? ((Number(v) / total) * 100).toFixed(1).replace('.', ',') : 0}%)`, n
            ]} />
          </PieChart>
        </ResponsiveContainer>
        <Stack alignItems="center" justifyContent="center" sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <Typography sx={{ color: palette.base, fontSize: 44, fontWeight: 500, lineHeight: 1 }}>
            {numFmt.format(total)}
          </Typography>
        </Stack>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: { xs: 2, md: 3.5 }, pt: 1.2, pb: 0.5 }}>
        {genderData.map((item, i) => (
          <Stack key={item.name} direction="row" spacing={0.7} alignItems="center">
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colors[i % colors.length], flexShrink: 0 }} />
            <Typography sx={{ fontSize: 11.5, color: '#475569', fontWeight: 950, textTransform: 'uppercase' }}>
              {item.name}
            </Typography>
          </Stack>
        ))}
      </Box>
    </Stack>
  );
};

/* ═══════════════════════ CATEGORY CARD ═════════════════════════════════════ */
const CategoryCard = ({ title, total, genderData, palette }) => {
  const cardRef = useRef(null);
  return (
    <Paper ref={cardRef} elevation={0} sx={{
      height: '100%', minHeight: 310, position: 'relative',
      border: `1px solid ${palette.border}`, borderRadius: 1,
      overflow: 'hidden', background: '#ffffff', boxShadow: `0 12px 28px ${palette.shadow}`
    }}>
      <PillHeader label={title} palette={palette} />
      <Box sx={{ px: 2.2, pt: 1.4, pb: 1.6, height: 'calc(100% - 58px)', position: 'relative' }}>
        <CopyChartBtn chartRef={cardRef} />
        <DonutContent total={total} genderData={genderData} palette={palette} />
      </Box>
    </Paper>
  );
};

/* ═══════════════════════ OUTSOURCING CARD ═══════════════════════════════════ */
const OutsourcingCard = ({ total, genderData, cargo, palette }) => {
  const cardRef = useRef(null);
  const bodyHeight = Math.max(280, cargo.length * 50 + 80);
  return (
    <Paper ref={cardRef} elevation={0} sx={{
      height: '100%', position: 'relative',
      border: `1px solid ${palette.border}`, borderRadius: 1,
      overflow: 'hidden', background: '#ffffff', boxShadow: `0 12px 28px ${palette.shadow}`
    }}>
      <PillHeader label="Outsourcing" palette={palette} />
      <Box sx={{ position: 'relative' }}>
        <CopyChartBtn chartRef={cardRef} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1.5fr' }, minHeight: bodyHeight }}>
          <Box sx={{
            px: 2, py: 1.6,
            borderRight: { sm: `1px solid ${palette.border}40` },
            borderBottom: { xs: `1px solid ${palette.border}40`, sm: 'none' }
          }}>
            <DonutContent total={total} genderData={genderData} palette={palette} />
          </Box>
          <Box sx={{ px: 1.5, py: 1.6, display: 'flex', flexDirection: 'column' }}>
            {cargo.length > 0 ? (
              <>
                <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', mb: 1, textAlign: 'center' }}>
                  Por Cargo
                </Typography>
                <Box sx={{ flex: 1, minHeight: Math.max(180, cargo.length * 50 + 20) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cargo} layout="vertical" margin={{ top: 4, right: 68, left: 8, bottom: 4 }}>
                      <CartesianGrid stroke="#dbeafe" strokeDasharray="2 4" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#475569' }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10.5, fontWeight: 800, fill: '#0f172a' }} width={148} />
                      <Tooltip formatter={(v) => [numFmt.format(Number(v || 0)), 'Cantidad']} />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} fill={palette.base} isAnimationActive animationDuration={820}>
                        <LabelList dataKey="value" position="right"
                          formatter={(v) => numFmt.format(Number(v || 0))}
                          style={{ fill: '#0f172a', fontSize: 11, fontWeight: 900 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </>
            ) : (
              <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
                <Typography sx={{ color: '#94a3b8', fontWeight: 700, fontSize: 13 }}>Sin datos de cargo</Typography>
              </Stack>
            )}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

/* ══════════════════════ HORIZONTAL BAR (generic) ════════════════════════════ */
const HorizBar = ({ data, color }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} layout="vertical" margin={{ top: 4, right: 68, left: 8, bottom: 4 }}>
      <CartesianGrid stroke="#dbeafe" strokeDasharray="2 4" horizontal={false} />
      <XAxis type="number" tick={{ fontSize: 10, fill: '#475569' }} />
      <YAxis type="category" dataKey="name" tick={{ fontSize: 10.5, fontWeight: 800, fill: '#0f172a' }} width={152} />
      <Tooltip formatter={(v) => [numFmt.format(Number(v || 0)), 'Personas']} />
      <Bar dataKey="value" radius={[0, 6, 6, 0]} fill={color} isAnimationActive animationDuration={820}>
        <LabelList dataKey="value" position="right"
          formatter={(v) => numFmt.format(Number(v || 0))}
          style={{ fill: '#0f172a', fontSize: 11, fontWeight: 900 }} />
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

/* ══════════════════════ SECTION CHART CARD ══════════════════════════════════ */
const SectionCard = ({ title, palette, height, children }) => {
  const cardRef = useRef(null);
  return (
    <Paper ref={cardRef} elevation={0} sx={{
      position: 'relative', border: `1px solid ${palette.border}`, borderRadius: 1,
      overflow: 'hidden', background: '#ffffff', boxShadow: `0 10px 24px ${palette.shadow}`
    }}>
      <PillHeader label={title} palette={palette} fontSize={14} />
      <Box sx={{ px: 1.5, py: 1.5, height: height || 240, position: 'relative' }}>
        <CopyChartBtn chartRef={cardRef} />
        {children}
      </Box>
    </Paper>
  );
};

/* ═══════════════════════ SECTION LABEL ══════════════════════════════════════ */
const SectionLabel = ({ text, color }) => (
  <Box sx={{
    mb: 1.8, mt: 0.5, border: `1px solid ${color}30`,
    borderLeft: `4px solid ${color}`, borderRadius: 1,
    background: '#ffffff', textAlign: 'center', py: 0.7
  }}>
    <Typography sx={{ fontSize: 17, fontWeight: 950, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '.04em' }}>
      {text}
    </Typography>
  </Box>
);

/* ══════════════════════ GRADO TABLE WITH MINI BARS ═════════════════════════ */
const GradoTableWithBars = ({ byGrado, cardRef }) => {
  const maxVal = byGrado[0]?.value || 1;
  const grandTotal = byGrado.reduce((s, r) => s + r.value, 0);
  return (
    <Paper ref={cardRef} elevation={0} sx={{
      position: 'relative', border: `1px solid ${C.outsource.border}`, borderRadius: 1,
      overflow: 'hidden', background: '#ffffff', boxShadow: `0 10px 24px ${C.outsource.shadow}`
    }}>
      <CopyChartBtn chartRef={cardRef} />
      <Box sx={{ bgcolor: GC, px: 2.2, py: 1.1 }}>
        <Box sx={{
          mx: 'auto', maxWidth: 200, minHeight: 32, px: 2,
          border: '1px solid rgba(255,255,255,.88)', borderRadius: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#ffffff', fontSize: 14, fontWeight: 950, textTransform: 'uppercase',
          background: 'rgba(255,255,255,.1)'
        }}>
          GRADO — CANTIDAD
        </Box>
      </Box>
      <Box sx={{ maxHeight: 480, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 900, fontSize: 12, color: GC, bgcolor: '#eff6ff', borderBottom: `2px solid ${C.outsource.border}`, py: 0.9, width: '45%' }}>
                GRADO
              </TableCell>
              <TableCell sx={{ fontWeight: 900, fontSize: 12, color: GC, bgcolor: '#eff6ff', borderBottom: `2px solid ${C.outsource.border}`, py: 0.9 }}>
                CANTIDAD
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {byGrado.map((row, i) => {
              const pct = Math.round((row.value / maxVal) * 100);
              return (
                <TableRow key={row.name} sx={{ bgcolor: i % 2 === 0 ? '#ffffff' : '#f5f9ff', '&:last-child td': { border: 0 } }}>
                  <TableCell sx={{ fontSize: 11.5, fontWeight: 700, color: '#0f172a', py: 0.6 }}>
                    {row.name}
                  </TableCell>
                  <TableCell sx={{ py: 0.6 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <Box sx={{ flex: 1, height: 8, bgcolor: '#dbeafe', borderRadius: 999, minWidth: 30 }}>
                        <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: GC, borderRadius: 999 }} />
                      </Box>
                      <Typography sx={{ fontSize: 12, fontWeight: 950, color: GC, minWidth: 28, textAlign: 'right', flexShrink: 0 }}>
                        {numFmt.format(row.value)}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow sx={{ bgcolor: '#eff6ff' }}>
              <TableCell sx={{ fontWeight: 950, fontSize: 12, color: '#0f172a', py: 0.8 }}>Total</TableCell>
              <TableCell sx={{ py: 0.8 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <Box sx={{ flex: 1, height: 8, bgcolor: '#bfdbfe', borderRadius: 999 }}>
                    <Box sx={{ height: '100%', width: '100%', bgcolor: GC, borderRadius: 999, opacity: 0.5 }} />
                  </Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 950, color: GC, minWidth: 28, textAlign: 'right', flexShrink: 0 }}>
                    {numFmt.format(grandTotal)}
                  </Typography>
                </Box>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
};

/* ═══════════════════ DECOMPOSITION TREE ════════════════════════════════════
   Árbol estilo Power BI: líneas SVG spine+branch
   COLABORADORES → DEPENDENCIAS → GRADOS
══════════════════════════════════════════════════════════════════════════════ */
const ROW_H        = 44;   /* altura fija de cada nodo */
const ROW_GAP      = 6;    /* espacio entre nodos */
const CONN_W       = 48;   /* ancho de la SVG conectora */
const SPINE_X      = 26;   /* X del tronco dentro del SVG */
const MAX_DEPS     = 22;   /* máx. dependencias visibles en el árbol */

const getNodeCenterY = (i) => i * (ROW_H + ROW_GAP) + ROW_H / 2;

const DecompositionTree = ({ deps: allDeps, adminTotal, cardRef }) => {
  const deps    = allDeps.slice(0, MAX_DEPS);
  const [activeDep, setActiveDep] = useState(deps[0]?.dep || null);

  useEffect(() => {
    if (!deps.find((d) => d.dep === activeDep)) setActiveDep(deps[0]?.dep || null);
  }, [deps, activeDep]);  // eslint-disable-line react-hooks/exhaustive-deps

  const selected  = deps.find((d) => d.dep === activeDep);
  const selIdx    = deps.findIndex((d) => d.dep === activeDep);

  const maxDepVal   = deps[0]?.total || 1;
  const maxGradoVal = selected?.grados[0]?.value || 1;

  const depColH          = deps.length * (ROW_H + ROW_GAP) - ROW_GAP;
  const totalBoxCenterY  = depColH / 2;
  const selectedDepCY    = getNodeCenterY(selIdx);

  const gradeCount    = selected?.grados.length || 0;
  const gradeColH     = Math.max(0, gradeCount * (ROW_H + ROW_GAP) - ROW_GAP);
  const gradeMarginTop = Math.max(0, Math.round(selectedDepCY - gradeColH / 2));

  const getGradeCY  = (i) => gradeMarginTop + getNodeCenterY(i);
  const firstGradeCY = getGradeCY(0);
  const lastGradeCY  = gradeCount > 0 ? getGradeCY(gradeCount - 1) : firstGradeCY;

  /* SVG connector 1 (total → deps): height = depColH */
  const firstDepCY  = getNodeCenterY(0);
  const lastDepCY   = getNodeCenterY(deps.length - 1);

  /* SVG connector 2 (selectedDep → grades): trunk spans min/max of both sides */
  const conn2H       = Math.max(depColH, gradeMarginTop + gradeColH) + 4;
  const trunkTop     = Math.min(selectedDepCY, firstGradeCY);
  const trunkBot     = Math.max(selectedDepCY, lastGradeCY);

  return (
    <Paper ref={cardRef} elevation={0} sx={{
      position: 'relative',
      border: `1px solid ${C.outsource.border}`, borderRadius: 1,
      overflow: 'hidden', background: '#ffffff',
      boxShadow: `0 10px 24px ${C.outsource.shadow}`
    }}>
      <CopyChartBtn chartRef={cardRef} />

      {/* Header pill */}
      <Box sx={{ bgcolor: GC, px: 2.2, py: 1.1 }}>
        <Box sx={{
          mx: 'auto', maxWidth: 300, minHeight: 32, px: 2,
          border: '1px solid rgba(255,255,255,.88)', borderRadius: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#ffffff', fontSize: 14, fontWeight: 950, textTransform: 'uppercase',
          background: 'rgba(255,255,255,.1)'
        }}>
          ÁRBOL DE EXPANSIÓN POR DEPENDENCIA
        </Box>
      </Box>

      {/* Hint */}
      <Box sx={{
        px: 2, py: 0.7, borderBottom: '1px solid #dbeafe',
        background: 'linear-gradient(90deg, #eff6ff 0%, #f5f9ff 100%)',
        display: 'flex', alignItems: 'center', gap: 1.5
      }}>
        <Typography sx={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Colaboradores: {numFmt.format(adminTotal)}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>
          Clic en una dependencia para ver sus grados →
        </Typography>
        {allDeps.length > MAX_DEPS && (
          <Chip size="small" label={`Top ${MAX_DEPS} de ${allDeps.length}`}
            sx={{ bgcolor: '#dbeafe', color: TEXT_BLUE, fontWeight: 800, fontSize: 9.5, height: 20 }} />
        )}
      </Box>

      {/* Tree canvas — horizontal scroll */}
      <Box sx={{ p: 1.5, overflowX: 'auto', overflowY: 'visible' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', minWidth: 580 }}>

          {/* ─── NIVEL 0: TOTAL ─── */}
          <Box sx={{ mt: `${Math.max(0, totalBoxCenterY - 30)}px`, width: 96, flexShrink: 0 }}>
            <Box sx={{
              border: `2px solid ${GC}`, borderRadius: 1.5,
              bgcolor: '#eff6ff', px: 1.2, py: 1, textAlign: 'center',
              boxShadow: `0 4px 12px ${GC}22`
            }}>
              <Typography sx={{ fontSize: 8.5, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Colaboradores
              </Typography>
              <Typography sx={{ fontSize: 26, fontWeight: 700, color: GC, lineHeight: 1 }}>
                {numFmt.format(adminTotal)}
              </Typography>
            </Box>
          </Box>

          {/* ─── SVG CONECTOR 0 → 1 ─── */}
          <svg
            width={CONN_W} height={depColH}
            style={{ flexShrink: 0, overflow: 'visible', display: 'block' }}
          >
            {/* Horizontal from total box center */}
            <line x1={0} y1={totalBoxCenterY} x2={SPINE_X} y2={totalBoxCenterY}
              stroke="#94a3b8" strokeWidth={1.5} />
            {/* Vertical spine: first dep → last dep, extended to meet total if needed */}
            <line
              x1={SPINE_X} y1={Math.min(totalBoxCenterY, firstDepCY)}
              x2={SPINE_X} y2={Math.max(totalBoxCenterY, lastDepCY)}
              stroke="#94a3b8" strokeWidth={1.5}
            />
            {/* Horizontal branches to each dep */}
            {deps.map((dep, i) => {
              const y = getNodeCenterY(i);
              const isAct = dep.dep === activeDep;
              return (
                <line key={dep.dep}
                  x1={SPINE_X} y1={y} x2={CONN_W} y2={y}
                  stroke={isAct ? GC : '#bfdbfe'}
                  strokeWidth={isAct ? 2.5 : 1.2}
                />
              );
            })}
          </svg>

          {/* ─── NIVEL 1: DEPENDENCIAS ─── */}
          <Box sx={{ minWidth: 200, maxWidth: 240, flexShrink: 0 }}>
            {deps.map((dep, i) => {
              const isAct = dep.dep === activeDep;
              const pct   = Math.round((dep.total / maxDepVal) * 100);
              const depPct = adminTotal > 0 ? ((dep.total / adminTotal) * 100).toFixed(1) : '0';
              return (
                <Box
                  key={dep.dep}
                  onClick={() => setActiveDep(dep.dep)}
                  sx={{
                    height: ROW_H, mb: `${ROW_GAP}px`,
                    display: 'flex', flexDirection: 'column', justifyContent: 'center',
                    px: 1.2, borderRadius: 1, cursor: 'pointer',
                    border: `1.5px solid ${isAct ? GC : '#dbeafe'}`,
                    bgcolor: isAct ? '#eff6ff' : '#ffffff',
                    boxShadow: isAct ? `0 3px 10px ${GC}26` : 'none',
                    transition: 'all .15s ease',
                    '&:hover': { borderColor: `${GC}aa`, bgcolor: '#f5f9ff', transform: 'translateX(1px)' }
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 0.3 }}>
                    <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: isAct ? GC : '#0f172a', lineHeight: 1.15, flex: 1, pr: 0.5 }}>
                      {dep.dep}
                    </Typography>
                    <Stack direction="row" spacing={0.4} alignItems="baseline" sx={{ flexShrink: 0 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 950, color: isAct ? GC : C.admin.base }}>
                        {numFmt.format(dep.total)}
                      </Typography>
                      <Typography sx={{ fontSize: 8.5, fontWeight: 800, color: '#94a3b8' }}>
                        {depPct}%
                      </Typography>
                    </Stack>
                  </Stack>
                  <Box sx={{ height: 4, bgcolor: '#dbeafe', borderRadius: 999 }}>
                    <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: isAct ? GC : C.admin.base, borderRadius: 999, transition: 'width .3s' }} />
                  </Box>
                </Box>
              );
            })}
          </Box>

          {/* ─── SVG CONECTOR 1 → 2 (solo dependencia seleccionada) ─── */}
          {selected && (
            <svg
              width={CONN_W} height={conn2H}
              style={{ flexShrink: 0, overflow: 'visible', display: 'block' }}
            >
              {/* Horizontal from selected dep */}
              <line x1={0} y1={selectedDepCY} x2={SPINE_X} y2={selectedDepCY}
                stroke={GC} strokeWidth={2} />
              {/* Vertical trunk */}
              <line x1={SPINE_X} y1={trunkTop} x2={SPINE_X} y2={trunkBot}
                stroke={GC} strokeWidth={1.5} opacity={0.55} />
              {/* Branches to each grade */}
              {selected.grados.map((g, i) => (
                <line key={g.name}
                  x1={SPINE_X} y1={getGradeCY(i)} x2={CONN_W} y2={getGradeCY(i)}
                  stroke={GC} strokeWidth={1.5} opacity={0.6}
                />
              ))}
            </svg>
          )}

          {/* ─── NIVEL 2: GRADOS ─── */}
          {selected && (
            <Box sx={{ minWidth: 150, maxWidth: 200, flexShrink: 0, mt: `${gradeMarginTop}px` }}>
              <Box sx={{ mb: 0.5, px: 0.5 }}>
                <Typography sx={{ fontSize: 8.5, fontWeight: 900, color: GC, textTransform: 'uppercase', letterSpacing: '.08em', lineHeight: 1.2 }}>
                  {selected.dep}
                </Typography>
              </Box>
              {selected.grados.map((g, i) => {
                const pct = Math.round((g.value / maxGradoVal) * 100);
                return (
                  <Box key={g.name} sx={{
                    height: ROW_H, mb: `${ROW_GAP}px`,
                    display: 'flex', flexDirection: 'column', justifyContent: 'center',
                    px: 1.2, borderRadius: 1,
                    border: `1px solid ${i === 0 ? GC + '99' : '#dbeafe'}`,
                    bgcolor: i === 0 ? '#f0f6ff' : '#ffffff'
                  }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.3 }}>
                      <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: '#0f172a', flex: 1, pr: 0.5, lineHeight: 1.15 }}>
                        {g.name}
                      </Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 950, color: GC, flexShrink: 0 }}>
                        {numFmt.format(g.value)}
                      </Typography>
                    </Stack>
                    <Box sx={{ height: 4, bgcolor: '#dbeafe', borderRadius: 999 }}>
                      <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: GC, borderRadius: 999 }} />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}

        </Box>
      </Box>
    </Paper>
  );
};

/* ════════════════════════════ MAIN COMPONENT ════════════════════════════════ */
function AdminDirectivosDashboard({ onBack }) {
  const { enqueueSnackbar } = useSnackbar();
  const ondasRef  = useRef(null);
  const histRef   = useRef(null);
  const gradoRef  = useRef(null);
  const decompRef = useRef(null);

  const [loading, setLoading]  = useState(true);
  const [allData, setAllData]  = useState(null);
  const [filters, setFilters]  = useState(emptyF);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await gestionInformacionService.getEstadisticas({
        categoria: 'Recurso Humano',
        aggregate: 'recurso_humano_dashboard'
      });
      setAllData(res?.data || null);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Error al cargar datos', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const adminRows     = useMemo(() => allData?.administrativos?.rows || [], [allData]);
  const outsourceRows = useMemo(() => allData?.outsourcing?.rows     || [], [allData]);
  const ondasRows     = useMemo(() => allData?.ondas?.rows           || [], [allData]);

  const filterOpts = useMemo(() => {
    const base4Period = filters.anio ? adminRows.filter((r) => getYear(r) === filters.anio) : adminRows;
    return {
      anios:         uniq(adminRows, getYear),
      periodos:      sortPeriods(uniq(base4Period, getPeriodL)),
      dependencias:  uniq(adminRows, (r) => r.dependencia),
      vicerectorias: uniq(adminRows, (r) => r.vicerectoria)
    };
  }, [adminRows, filters.anio]);

  const filtAdmin = useMemo(() => adminRows.filter((r) => {
    if (filters.anio         && getYear(r)        !== filters.anio)         return false;
    if (filters.periodo      && getPeriodL(r)      !== filters.periodo)      return false;
    if (filters.dependencia  && nt(r.dependencia)  !== filters.dependencia)  return false;
    if (filters.vicerectoria && nt(r.vicerectoria) !== filters.vicerectoria) return false;
    return true;
  }), [adminRows, filters]);

  const filtOutsource = useMemo(() => outsourceRows.filter((r) => {
    if (filters.anio    && getYear(r)   !== filters.anio)    return false;
    if (filters.periodo && getPeriodL(r) !== filters.periodo) return false;
    return true;
  }), [outsourceRows, filters]);

  const filtOndas = useMemo(() => ondasRows.filter((r) => {
    if (filters.anio    && getYear(r)   !== filters.anio)    return false;
    if (filters.periodo && getPeriodL(r) !== filters.periodo) return false;
    return true;
  }), [ondasRows, filters]);

  const adminM = useMemo(() => ({
    total:        filtAdmin.length,
    gender:       buildGenderData(groupBy(filtAdmin, (r) => nGender(r.genero_biologico || r.genero))),
    vicerectoria: groupBy(filtAdmin, (r) => r.vicerectoria).slice(0, 10),
    dependencia:  groupBy(filtAdmin, (r) => r.dependencia).slice(0, 12)
  }), [filtAdmin]);

  const outsourceM = useMemo(() => ({
    total:  filtOutsource.reduce((s, r) => s + Number(r.cantidad || 0), 0),
    gender: buildGenderData(groupBy(filtOutsource, (r) => nGender(r.genero_biologico || r.genero), (r) => r.cantidad || 1)),
    cargo:  groupBy(filtOutsource, (r) => r.cargo, (r) => r.cantidad || 1)
  }), [filtOutsource]);

  const ondasM = useMemo(() => ({
    total:  filtOndas.length,
    gender: buildGenderData(groupBy(filtOndas, (r) => nGender(r.genero)))
  }), [filtOndas]);

  const getGrado = (row) =>
    nt(row?.raw_data?.GRADO || row?.raw_data?.grado || row?.cargo_especifico) || 'Sin información';

  const gradoM = useMemo(() => {
    const byGrado = groupBy(filtAdmin, getGrado);
    const byDep = new Map();
    filtAdmin.forEach((r) => {
      const dep   = nt(r.dependencia) || 'Sin información';
      const grado = getGrado(r);
      if (!byDep.has(dep)) byDep.set(dep, new Map());
      byDep.get(dep).set(grado, (byDep.get(dep).get(grado) || 0) + 1);
    });
    const deps = Array.from(byDep.entries())
      .map(([dep, gradoMap]) => ({
        dep,
        total: Array.from(gradoMap.values()).reduce((s, v) => s + v, 0),
        grados: Array.from(gradoMap.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
      }))
      .sort((a, b) => b.total - a.total);
    return { byGrado, deps };
  }, [filtAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Tendencia histórica — cronológica: 2021 IP → 2021 IIP → 2022 IP → ... */
  const historicalData = useMemo(() => {
    const m = new Map();
    adminRows.forEach((r) => {
      const label = getPeriodL(r);
      if (!label) return;
      m.set(label, (m.get(label) || 0) + 1);
    });
    const ord = { IP: 1, IIP: 2 };
    return Array.from(m.keys())
      .sort((a, b) => {
        const [ya, pa] = String(a).split(/\s+/);
        const [yb, pb] = String(b).split(/\s+/);
        return Number(ya || 0) - Number(yb || 0) || (ord[pa] || 9) - (ord[pb] || 9);
      })
      .map((label) => ({ periodo: label, total: m.get(label) }));
  }, [adminRows]);

  const hasFilters = Object.values(filters).some(Boolean);
  const titleLabel = filters.periodo || filters.anio
    || filterOpts.periodos[0]
    || filterOpts.anios[filterOpts.anios.length - 1]
    || 'Administrativos y Directivos';

  const handleF = (key, val) =>
    setFilters((prev) => ({ ...prev, [key]: val, ...(key === 'anio' ? { periodo: '' } : {}) }));

  const Sel = ({ k, label, vals }) => (
    <FormControl size="small" fullWidth>
      <InputLabel>{label}</InputLabel>
      <Select value={filters[k]} label={label} onChange={(e) => handleF(k, e.target.value)}
        sx={{ bgcolor: '#ffffff', borderRadius: 1.4, '& .MuiSelect-select': { fontWeight: 700, color: '#334155' } }}>
        <MenuItem value="">Todos</MenuItem>
        {vals.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
      </Select>
    </FormControl>
  );

  if (loading) {
    return (
      <Paper elevation={0} sx={{ p: 3, border: '1px solid #dbeafe', borderRadius: 2 }}>
        <Typography sx={{ fontWeight: 900, mb: 1, color: C.admin.base }}>Cargando Administrativos y Directivos...</Typography>
        <LinearProgress sx={{ borderRadius: 999 }} />
      </Paper>
    );
  }

  if (!allData) {
    return (
      <Paper elevation={0} sx={{ p: 3, border: '1px dashed #dbeafe', borderRadius: 2 }}>
        <Typography sx={{ color: '#475569' }}>No fue posible cargar los datos.</Typography>
      </Paper>
    );
  }

  return (
    <Fade in timeout={350}>
      <Box sx={{ background: '#f0f6ff', minHeight: 'calc(100vh - 210px)', pb: 5 }}>

        {/* ════════════════════ COVER ENCABEZADO ═══════════════════════════ */}
        <Box sx={{
          mb: 2, borderRadius: { xs: 2.5, md: 3.5 }, overflow: 'hidden', position: 'relative',
          background: 'linear-gradient(130deg, #0d47a1 0%, #1565c0 22%, #1976d2 48%, #1e88e5 72%, #42a5f5 100%)',
          boxShadow: '0 18px 52px rgba(13,71,161,.32)'
        }}>
          <Box sx={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,.07)', pointerEvents: 'none' }} />
          <Box sx={{ position: 'absolute', bottom: -40, left: 100, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.05)', pointerEvents: 'none' }} />
          <Box sx={{ position: 'absolute', top: '25%', right: '20%', width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,.04)', pointerEvents: 'none' }} />

          <Box sx={{ px: { xs: 2.5, md: 4.5 }, py: { xs: 2.2, md: 2.8 }, position: 'relative', zIndex: 1 }}>
            {onBack && (
              <Box component="button" onClick={onBack} sx={{
                mb: 1.8, display: 'inline-flex', alignItems: 'center', gap: 0.7,
                px: 1.4, py: 0.55, borderRadius: 999,
                border: '1px solid rgba(255,255,255,.32)', background: 'rgba(255,255,255,.12)',
                color: 'rgba(255,255,255,.88)', fontSize: 12, fontWeight: 800, letterSpacing: '0.01em',
                cursor: 'pointer', transition: 'background .15s',
                '&:hover': { background: 'rgba(255,255,255,.22)' }
              }}>
                ← Recurso Humano
              </Box>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 2, sm: 3 }}
              alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
              <Stack direction="row" spacing={2.4} alignItems="center">
                <Box sx={{
                  width: { xs: 58, md: 72 }, height: { xs: 58, md: 72 }, borderRadius: 2.5,
                  background: 'rgba(255,255,255,.17)', border: '1.5px solid rgba(255,255,255,.36)',
                  display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: '0 8px 24px rgba(0,0,0,.16)'
                }}>
                  <BusinessIcon sx={{ color: '#fff', fontSize: { xs: 30, md: 38 } }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 10.5, fontWeight: 900, color: 'rgba(255,255,255,.7)', textTransform: 'uppercase', letterSpacing: '0.15em', mb: 0.2 }}>
                    Gestión de la Información
                  </Typography>
                  <Typography sx={{ fontSize: { xs: 20, md: 28 }, fontWeight: 900, color: '#ffffff', lineHeight: 1.05, letterSpacing: '-0.025em' }}>
                    Administrativos y Directivos
                  </Typography>
                  <Typography sx={{ fontSize: { xs: 13, md: 15.5 }, fontWeight: 800, color: 'rgba(255,255,255,.8)', letterSpacing: '0.08em', textTransform: 'uppercase', mt: 0.3 }}>
                    UNICESMAG
                  </Typography>
                </Box>
              </Stack>
              <Box sx={{
                px: { xs: 2.5, md: 3.4 }, py: { xs: 1.2, md: 1.8 }, borderRadius: 3,
                background: 'rgba(255,255,255,.14)', border: '1.5px solid rgba(255,255,255,.28)',
                backdropFilter: 'blur(14px)', textAlign: 'center',
                minWidth: { xs: 120, md: 148 }, alignSelf: { xs: 'flex-start', sm: 'center' }, flexShrink: 0
              }}>
                <Typography sx={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,.64)', textTransform: 'uppercase', letterSpacing: '0.14em', mb: 0.2 }}>
                  Período activo
                </Typography>
                <Typography sx={{ fontSize: { xs: 30, md: 38 }, fontWeight: 900, color: '#ffffff', lineHeight: 1.08, letterSpacing: '-0.02em' }}>
                  {titleLabel || '—'}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Box>

        {/* ════════════════════ FILTROS ════════════════════════════════════ */}
        <Paper elevation={0} sx={{
          mb: 2.5, border: '1px solid #c5d9f7', borderRadius: 2.5,
          background: 'linear-gradient(180deg, #ffffff 0%, #f5f9ff 100%)',
          overflow: 'hidden', boxShadow: '0 4px 16px rgba(21,101,216,.07)'
        }}>
          <Box sx={{
            px: { xs: 1.8, md: 2.4 }, py: 1, borderBottom: '1px solid #dbeafe',
            background: 'linear-gradient(90deg, #e8f0fe 0%, #f0f6ff 100%)',
            display: 'flex', alignItems: 'center', gap: 1
          }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: C.admin.base, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 11.5, fontWeight: 900, color: TEXT_BLUE, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Filtros de consulta
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Chip size="small" label={`${numFmt.format(filtAdmin.length)} registros`}
              sx={{ bgcolor: '#dbeafe', color: TEXT_BLUE, fontWeight: 800, fontSize: 11, height: 22 }} />
          </Box>
          <Box sx={{ px: { xs: 1.6, md: 2.2 }, pt: 1.6, pb: 1.4 }}>
            <Box sx={{
              display: 'grid', gap: 1.2, alignItems: 'center',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1.9fr 1.9fr 44px' }
            }}>
              <Sel k="anio"         label="Año"           vals={filterOpts.anios} />
              <Sel k="periodo"      label="Periodo"       vals={filterOpts.periodos} />
              <Sel k="dependencia"  label="Dependencia"   vals={filterOpts.dependencias} />
              <Sel k="vicerectoria" label="Vicerrectoría" vals={filterOpts.vicerectorias} />
              <Button variant="outlined" title="Limpiar filtros" disabled={!hasFilters}
                onClick={() => setFilters(emptyF)}
                sx={{ minWidth: 44, height: 40, px: 0, bgcolor: '#ffffff', borderRadius: 1.4, borderColor: '#c5d9f7', color: TEXT_BLUE }}>
                <FilterAltOffIcon fontSize="small" />
              </Button>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.4, flexWrap: 'wrap' }}>
              <Chip size="small" label={`Administrativos: ${numFmt.format(adminM.total)}`}
                sx={{ bgcolor: '#eff6ff', color: TEXT_BLUE, fontWeight: 800, border: '1px solid #bfdbfe' }} />
              <Chip size="small" variant="outlined"
                sx={{ borderColor: C.outsource.border, color: C.outsource.base, fontWeight: 800 }}
                label={`Outsourcing: ${numFmt.format(outsourceM.total)}`} />
              <Chip size="small" variant="outlined"
                sx={{ borderColor: C.ondas.border, color: C.ondas.base, fontWeight: 800 }}
                label={`Ondas: ${numFmt.format(ondasM.total)}`} />
              <Button size="small" startIcon={<RefreshIcon />} onClick={fetchData} sx={{ ml: 'auto', color: TEXT_BLUE }}>
                Actualizar
              </Button>
            </Stack>
          </Box>
        </Paper>

        {/* ════════════════════ ROW 1: ADMIN + OUTSOURCING ════════════════ */}
        <Box sx={{
          display: 'grid', gap: { xs: 2, lg: 2.6 },
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1.8fr' },
          alignItems: 'stretch', mb: 3
        }}>
          <CategoryCard title="Administrativos" total={adminM.total} genderData={adminM.gender} palette={C.admin} />
          <OutsourcingCard total={outsourceM.total} genderData={outsourceM.gender} cargo={outsourceM.cargo} palette={C.outsource} />
        </Box>

        {/* ════════════════════ PROYECTO ONDAS ════════════════════════════ */}
        <Paper ref={ondasRef} elevation={0} sx={{
          mb: 3, position: 'relative',
          border: `1px solid ${C.ondas.border}`, borderRadius: 1,
          overflow: 'hidden', background: '#ffffff', boxShadow: `0 12px 28px ${C.ondas.shadow}`
        }}>
          <PillHeader label="Proyecto Ondas" palette={C.ondas} />
          <Box sx={{ px: { xs: 2, md: 3 }, py: 2.5, position: 'relative' }}>
            <CopyChartBtn chartRef={ondasRef} />
            {ondasM.total === 0 ? (
              <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 130 }}>
                <Typography sx={{ color: C.ondas.base, fontSize: 72, fontWeight: 300, lineHeight: 1 }}>0</Typography>
                <Typography sx={{ color: '#94a3b8', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', mt: 0.5 }}>
                  Sin registros disponibles
                </Typography>
              </Stack>
            ) : (
              <Box sx={{ display: 'grid', gap: 2.4, gridTemplateColumns: { xs: '1fr', md: '220px 1fr' }, alignItems: 'center' }}>
                <Stack alignItems="center" justifyContent="center" spacing={1}>
                  <Typography sx={{ color: C.ondas.base, fontSize: 72, fontWeight: 400, lineHeight: 1 }}>
                    {numFmt.format(ondasM.total)}
                  </Typography>
                  <Typography sx={{ color: '#64748b', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
                    Participantes
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap', pt: 0.5 }}>
                    {ondasM.gender.map((g, i) => (
                      <Stack key={g.name} direction="row" spacing={0.6} alignItems="center">
                        <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: [C.ondas.base, C.ondas.light][i], flexShrink: 0 }} />
                        <Typography sx={{ fontSize: 11, color: '#475569', fontWeight: 950, textTransform: 'uppercase' }}>{g.name}</Typography>
                        <Typography sx={{ fontSize: 12, color: '#0f172a', fontWeight: 900 }}>{numFmt.format(g.value)}</Typography>
                      </Stack>
                    ))}
                  </Box>
                </Stack>
                <Box sx={{ height: 240 }}>
                  <DonutContent total={ondasM.total} genderData={ondasM.gender} palette={C.ondas} />
                </Box>
              </Box>
            )}
          </Box>
        </Paper>

        {/* ════════════════════ DISTRIBUCIÓN ADMINISTRATIVA ═══════════════ */}
        {adminM.total > 0 && (adminM.vicerectoria.length > 0 || adminM.dependencia.length > 0) && (
          <>
            <SectionLabel text="Distribución administrativa" color={C.admin.base} />
            <Box sx={{
              display: 'grid', gap: 2.4,
              gridTemplateColumns: { xs: '1fr', lg: adminM.vicerectoria.length > 0 && adminM.dependencia.length > 0 ? '1fr 1fr' : '1fr' },
              mb: 2.5
            }}>
              {adminM.vicerectoria.length > 0 && (
                <SectionCard title="Por Vicerrectoría" palette={C.admin}
                  height={Math.max(220, adminM.vicerectoria.length * 44 + 54)}>
                  <HorizBar data={adminM.vicerectoria} color={C.admin.base} />
                </SectionCard>
              )}
              {adminM.dependencia.length > 0 && (
                <SectionCard title="Por Dependencia (top 12)" palette={C.outsource}
                  height={Math.max(220, Math.min(adminM.dependencia.length, 12) * 40 + 54)}>
                  <HorizBar data={adminM.dependencia} color={C.outsource.base} />
                </SectionCard>
              )}
            </Box>
          </>
        )}

        {/* ════════════════════ EXPLORADOR GRADO + DECOMPOSITION TREE ════ */}
        {adminM.total > 0 && gradoM.byGrado.length > 0 && (
          <>
            <SectionLabel text="Explorador por Grado y Dependencia" color={GC} />
            <Box sx={{
              display: 'grid', gap: 2.4, mb: 3,
              gridTemplateColumns: { xs: '1fr', lg: '380px 1fr' },
              alignItems: 'start'
            }}>
              {/* Tabla GRADO con mini barras */}
              <GradoTableWithBars byGrado={gradoM.byGrado} cardRef={gradoRef} />

              {/* Árbol de expansión estilo Power BI: TOTAL → DEPENDENCIAS → GRADOS */}
              <DecompositionTree deps={gradoM.deps} adminTotal={adminM.total} cardRef={decompRef} />
            </Box>
          </>
        )}

        {/* ════════════════════ TENDENCIA HISTÓRICA ═══════════════════════
            No responde a filtros — muestra evolución de todos los periodos
        ════════════════════════════════════════════════════════════════════ */}
        {historicalData.length > 1 && (
          <>
            <SectionLabel text="Evolución histórica de colaboradores administrativos" color={C.admin.base} />
            <Paper ref={histRef} elevation={0} sx={{
              mb: 3, position: 'relative',
              border: `1px solid ${C.admin.border}`, borderRadius: 1,
              overflow: 'hidden', background: '#ffffff', boxShadow: `0 12px 28px ${C.admin.shadow}`
            }}>
              <PillHeader label="Administrativos UNICESMAG — Tendencia histórica" palette={C.admin} />
              <Box sx={{ px: 2, pt: 2, pb: 1.5, height: 320, position: 'relative' }}>
                <CopyChartBtn chartRef={histRef} />
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historicalData} margin={{ top: 28, right: 24, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="adminHistGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={C.admin.base} stopOpacity={0.30} />
                        <stop offset="95%" stopColor={C.admin.base} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" vertical={false} />
                    <XAxis
                      dataKey="periodo"
                      tick={{ fontSize: 11, fill: '#475569', fontWeight: 700 }}
                      axisLine={{ stroke: '#dbeafe' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10.5, fill: '#475569' }}
                      axisLine={false}
                      tickLine={false}
                      width={38}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      formatter={(v) => [numFmt.format(v), 'Administrativos']}
                      contentStyle={{ fontSize: 12, fontWeight: 700, borderColor: C.admin.border, borderRadius: 8 }}
                    />
                    <ReferenceLine
                      y={historicalData.reduce((s, d) => s + d.total, 0) / historicalData.length}
                      stroke={C.admin.border}
                      strokeDasharray="4 4"
                      label={{ value: 'Promedio', position: 'insideTopLeft', fontSize: 10, fill: '#64748b' }}
                    />
                    <Area
                      type="linear"
                      dataKey="total"
                      stroke={C.admin.base}
                      strokeWidth={3}
                      fill="url(#adminHistGrad)"
                      dot={{ r: 5, fill: C.admin.base, stroke: '#ffffff', strokeWidth: 2 }}
                      activeDot={{ r: 7, fill: GC, stroke: '#ffffff', strokeWidth: 2 }}
                    >
                      <LabelList
                        dataKey="total"
                        position="top"
                        formatter={(v) => numFmt.format(v)}
                        style={{ fontSize: 10.5, fontWeight: 900, fill: GC }}
                      />
                    </Area>
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ px: 2, pb: 1.2, borderTop: '1px solid #dbeafe', pt: 0.8, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip size="small" label={`Periodos registrados: ${historicalData.length}`}
                  sx={{ bgcolor: '#eff6ff', color: TEXT_BLUE, fontWeight: 800, border: '1px solid #bfdbfe', fontSize: 10.5 }} />
                <Chip size="small" label={`Máximo: ${numFmt.format(Math.max(...historicalData.map((d) => d.total)))}`}
                  sx={{ bgcolor: '#eff6ff', color: TEXT_BLUE, fontWeight: 800, border: '1px solid #bfdbfe', fontSize: 10.5 }} />
                <Chip size="small" label={`Mínimo: ${numFmt.format(Math.min(...historicalData.map((d) => d.total)))}`}
                  sx={{ bgcolor: '#f5f9ff', color: '#64748b', fontWeight: 800, border: '1px solid #dbeafe', fontSize: 10.5 }} />
                <Typography sx={{ fontSize: 10, color: '#94a3b8', alignSelf: 'center', ml: 'auto', fontStyle: 'italic' }}>
                  * Este gráfico no se ve afectado por los filtros de período
                </Typography>
              </Box>
            </Paper>
          </>
        )}

      </Box>
    </Fade>
  );
}

export default AdminDirectivosDashboard;
