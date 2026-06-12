import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  Box,
  Paper,
  Stack,
  Typography,
  Chip,
  CircularProgress,
  Tooltip,
  Skeleton,
  Divider,
  Button
} from '@mui/material';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import AutoGraphRoundedIcon from '@mui/icons-material/AutoGraphRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  LabelList
} from 'recharts';
import { useSnackbar } from 'notistack';
import html2canvas from 'html2canvas';
import saberProAnalyticsService from '../../services/saberProAnalyticsService';

const GROUP_THEMES = {
  genericas: {
    label: 'Competencias Genéricas',
    desc: 'Núcleo común evaluado por el ICFES: razonamiento cuantitativo, lectura crítica, inglés, comunicación escrita y ciudadanas.',
    primary: '#1d4ed8',
    primarySoft: '#dbeafe',
    primaryDark: '#172554',
    accent: '#0f172a',
    icon: TrendingUpRoundedIcon
  },
  especificas: {
    label: 'Competencias Específicas',
    desc: 'Competencias propias del programa académico que complementan el núcleo común.',
    primary: '#1e40af',
    primarySoft: '#dbeafe',
    primaryDark: '#172554',
    accent: '#2563eb',
    icon: AutoGraphRoundedIcon
  }
};

const REFERENCE_DARK = '#475569';

const fmt = (v, digits = 1) => (v == null || !Number.isFinite(Number(v))
  ? '—'
  : Number(v).toLocaleString('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits }));

function FancyTooltip({ active, payload, label, theme }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <Paper elevation={8} sx={{
      p: 1.4, minWidth: 190, borderRadius: 2,
      border: `1px solid ${theme.primary}33`,
      boxShadow: '0 10px 30px rgba(15,23,42,0.14)'
    }}>
      <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Año {label}
      </Typography>
      <Divider sx={{ my: 0.7 }} />
      {payload.map((p) => (
        <Stack direction="row" key={p.dataKey} alignItems="center" justifyContent="space-between" spacing={1.2} sx={{ py: 0.25 }}>
          <Stack direction="row" alignItems="center" spacing={0.7}>
            <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: p.color }} />
            <Typography sx={{ fontSize: 12, color: '#334155', fontWeight: 600 }}>{p.name}</Typography>
          </Stack>
          <Typography sx={{ fontSize: 13, color: '#0f172a', fontWeight: 800 }}>{fmt(p.value, 1)}</Typography>
        </Stack>
      ))}
    </Paper>
  );
}

const RenderLineLabelAbove = (props) => {
  const { x, y, value, index, chartData } = props || {};
  if (x == null || y == null || value == null || !Number.isFinite(Number(value))) return null;

  // Default offset is above (-12)
  let offset = -12;

  if (index != null && Array.isArray(chartData) && chartData[index]) {
    const item = chartData[index];
    const valPrincipal = Number(item.principal);
    const valGrupoRef = Number(item.grupoRef);

    if (Number.isFinite(valPrincipal) && Number.isFinite(valGrupoRef)) {
      const diff = valPrincipal - valGrupoRef;
      if (Math.abs(diff) < 3.5) {
        // If close, higher goes above (-12), lower goes below (+20)
        // If equal (diff === 0), grupoRef goes below (+20)
        if (diff > 0) {
          offset = 20; // lower goes below
        } else {
          offset = -12; // higher or equal goes above
        }
      }
    }
  }

  return (
    <text
      x={x}
      y={y + offset}
      textAnchor="middle"
      fontSize="11.5"
      fontWeight="800"
      fill="#475569"
      style={{ pointerEvents: 'none' }}
    >
      {fmt(value, 1)}
    </text>
  );
};

const RenderLineLabelBelow = (props) => {
  const { x, y, value, index, chartData, themeColor } = props || {};
  if (x == null || y == null || value == null || !Number.isFinite(Number(value))) return null;

  // Default offset is below (+20)
  let offset = 20;

  if (index != null && Array.isArray(chartData) && chartData[index]) {
    const item = chartData[index];
    const valPrincipal = Number(item.principal);
    const valGrupoRef = Number(item.grupoRef);

    if (Number.isFinite(valPrincipal) && Number.isFinite(valGrupoRef)) {
      const diff = valPrincipal - valGrupoRef;
      if (Math.abs(diff) < 3.5) {
        // If close, higher goes above (-12), lower goes below (+20)
        // If equal (diff === 0), principal goes above (-12)
        if (diff >= 0) {
          offset = -12; // higher or equal goes above
        } else {
          offset = 20; // lower goes below
        }
      }
    }
  }

  return (
    <text
      x={x}
      y={y + offset}
      textAnchor="middle"
      fontSize="11.5"
      fontWeight="800"
      fill={themeColor || "#1d4ed8"}
      style={{ pointerEvents: 'none' }}
    >
      {fmt(value, 1)}
    </text>
  );
};



async function copyChartSvgAsImage(containerId) {
  const container = document.getElementById(containerId);
  if (!container) throw new Error('chart-not-found');

  const canvas = await html2canvas(container, {
    backgroundColor: '#ffffff',
    scale: Math.min(window.devicePixelRatio || 1, 2),
    useCORS: true,
    ignoreElements: (element) => element?.dataset?.copyIgnore === 'true',
    onclone: (doc) => {
      const cloned = doc.getElementById(containerId);
      if (!cloned) return;
      cloned.style.fontFamily = 'Arial, Helvetica, sans-serif';
      cloned.querySelectorAll('*').forEach((node) => {
        node.style.fontFamily = 'Arial, Helvetica, sans-serif';
      });
    }
  });

  const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!pngBlob) throw new Error('blob-failed');

  if (navigator.clipboard?.write && window.ClipboardItem) {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
    return;
  }

  const a = document.createElement('a');
  a.href = URL.createObjectURL(pngBlob);
  a.download = 'grafico_rendimiento_competencias.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function copyTableAsImage(tableId) {
  const container = document.getElementById(tableId);
  if (!container) throw new Error('table-not-found');

  const canvas = await html2canvas(container, {
    backgroundColor: '#ffffff',
    scale: Math.min(window.devicePixelRatio || 1, 2),
    useCORS: true,
    onclone: (doc) => {
      const cloned = doc.getElementById(tableId);
      if (!cloned) return;
      cloned.style.fontFamily = 'Arial, Helvetica, sans-serif';
      cloned.style.backgroundColor = '#ffffff';
      cloned.style.width = 'max-content';
      cloned.style.overflow = 'hidden';

      // Force cell-specific rounded corners inside html2canvas to workaround container clipping bugs
      const table = cloned.querySelector('table');
      if (table) {
        table.style.borderCollapse = 'separate';
        table.style.borderSpacing = '0';
        
        // Top row (thead th)
        const theadRow = table.querySelector('thead tr');
        if (theadRow) {
          const cells = theadRow.querySelectorAll('th, td');
          if (cells.length > 0) {
            cells[0].style.borderTopLeftRadius = '8px';
            cells[cells.length - 1].style.borderTopRightRadius = '8px';
          }
        }
        
        // Bottom row (tbody tr:last-child)
        const tbodyRows = table.querySelectorAll('tbody tr');
        if (tbodyRows.length > 0) {
          const lastRow = tbodyRows[tbodyRows.length - 1];
          const cells = lastRow.querySelectorAll('td, th');
          if (cells.length > 0) {
            cells[0].style.borderBottomLeftRadius = '8px';
            cells[cells.length - 1].style.borderBottomRightRadius = '8px';
          }
        }
      }

      cloned.querySelectorAll('*').forEach((node) => {
        node.style.fontFamily = 'Arial, Helvetica, sans-serif';
      });
    }
  });

  const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!pngBlob) throw new Error('blob-failed');

  if (navigator.clipboard?.write && window.ClipboardItem) {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
    return 'clipboard';
  }

  const a = document.createElement('a');
  a.href = URL.createObjectURL(pngBlob);
  a.download = 'tabla_matriz_competencias.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return 'download';
}

function ProgramFilterPanel({ label, options, value, onChange, placeholder, themeColor }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [visibleOptions, setVisibleOptions] = useState(options);
  const [portalStyle, setPortalStyle] = useState({});
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const computePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPortalStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      minWidth: 280,
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    setVisibleOptions(options);
  }, [open, options]);

  useEffect(() => {
    if (!open) return;
    computePosition();
    const onScroll = (event) => {
      if (dropdownRef.current?.contains(event.target)) return;
      computePosition();
    };
    const onResize = () => computePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (triggerRef.current?.contains(e.target) || dropdownRef.current?.contains(e.target)) return;
      setOpen(false);
      setSearch('');
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const effectiveOptions = open ? visibleOptions : options;
  const filtered = effectiveOptions.filter((o) =>
    o.nombre.toLowerCase().includes(search.toLowerCase())
  );
  const selectedIds = value.map((id) => String(id));
  const allSelected = selectedIds.length === 0;
  const isSel = (id) => selectedIds.includes(String(id));

  const toggle = (id) => {
    const key = String(id);
    onChange(isSel(key) ? selectedIds.filter((vId) => vId !== key) : [...selectedIds, key]);
  };

  const toggleAll = () => {
    onChange(allSelected ? effectiveOptions.map((o) => String(o.id)) : []);
  };

  const displayText = selectedIds.length === 0 
    ? 'TODOS (INSTITUCIONAL)' 
    : `${selectedIds.length} SELECCIONADO${selectedIds.length > 1 ? 'S' : ''}`;

  const C = themeColor || '#1d4ed8';

  const dropdownPortal = open ? ReactDOM.createPortal(
    <div
      ref={dropdownRef}
      style={{
        ...portalStyle,
        background: '#fff',
        borderRadius: 10,
        boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
        border: '1px solid #cbd5e1',
        overflow: 'hidden',
        fontFamily: 'Arial, Helvetica, sans-serif'
      }}
    >
      <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', borderRadius: 6, padding: '6px 10px', border: '1px solid #e2e8f0' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder || 'Buscar...'}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5, flex: 1, color: '#334155', minWidth: 0 }}
          />
        </div>
      </div>
      <div
        onClick={toggleAll}
        style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9', background: 'transparent', transition: 'background-color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background='#f1f5f9'}
        onMouseLeave={e => e.currentTarget.style.background='transparent'}
      >
        <div style={{ width: 15, height: 15, flexShrink: 0, borderRadius: 4, border: `2px solid ${allSelected ? C : '#94a3b8'}`, background: allSelected ? C : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {allSelected && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: C, letterSpacing: '0.02em' }}>SELECCIONAR TODOS ({effectiveOptions.length})</span>
      </div>
      <div
        onWheel={(event) => event.stopPropagation()}
        style={{ maxHeight: 200, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'thin' }}
      >
        {filtered.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', fontSize: 12.5, color: '#94a3b8' }}>Sin resultados</div>
        ) : (
          filtered.map((opt) => (
            <div
              key={opt.id}
              onClick={() => toggle(opt.id)}
              style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', transition: 'background-color 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}
            >
              <div style={{ width: 15, height: 15, flexShrink: 0, borderRadius: 4, border: `2px solid ${isSel(opt.id) ? C : '#cbd5e1'}`, background: isSel(opt.id) ? C : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isSel(opt.id) && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <span style={{ fontSize: 12.5, color: '#334155', fontWeight: isSel(opt.id) ? 700 : 500 }}>{opt.nombre}</span>
            </div>
          ))
        )}
      </div>
      <div style={{ padding: '6px 12px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>
          {selectedIds.length > 0 ? `${selectedIds.length} de ${effectiveOptions.length} seleccionados` : `${effectiveOptions.length} opciones`}
        </span>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <Box ref={triggerRef} sx={{ position: 'relative', width: '100%' }}>
      <Box
        onClick={() => setOpen((o) => !o)}
        sx={{
          cursor: 'pointer',
          borderRadius: '10px',
          p: '8px 14px',
          minHeight: 46,
          bgcolor: selectedIds.length ? '#eff6ff' : '#f8fafc',
          border: `1.5px solid ${selectedIds.length ? C : '#cbd5e1'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1.5,
          transition: 'all 0.15s',
          userSelect: 'none',
          '&:hover': { borderColor: C, bgcolor: selectedIds.length ? '#eff6ff' : '#f1f5f9' }
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: '9px', fontWeight: 800, color: C, letterSpacing: '0.8px', textTransform: 'uppercase', mb: 0.25 }}>
            {label}
          </Typography>
          <Typography sx={{ fontSize: '12.5px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {displayText}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexShrink: 0 }}>
          {selectedIds.length > 0 && (
            <Box
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              sx={{
                width: 17,
                height: 17,
                borderRadius: '50%',
                bgcolor: C,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'opacity 0.15s',
                '&:hover': { opacity: 0.85 }
              }}
            >
              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </Box>
          )}
          <Box sx={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none', display: 'flex', alignItems: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C} strokeWidth="3"><polyline points="6 9 12 15 18 9"/></svg>
          </Box>
        </Box>
      </Box>
      {dropdownPortal}
    </Box>
  );
}

function RendimientoCompetenciasPanel({ grupo = 'genericas' }) {
  const theme = GROUP_THEMES[grupo] || GROUP_THEMES.genericas;
  const { enqueueSnackbar } = useSnackbar();

  const [appliedProgramas, setAppliedProgramas] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedCompetencia, setSelectedCompetencia] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showGrupoReferencia, setShowGrupoReferencia] = useState(true);

  const loadData = useCallback(async (silent = false, programsToUse = appliedProgramas) => {
    if (!silent) setLoading(true);
    try {
      const response = await saberProAnalyticsService.getAgregadosCompetencias({
        grupo,
        programas: programsToUse,
        anios: []
      });
      const payload = response?.data || {};
      setData(payload);
      const years = Array.isArray(payload.aniosPresentes) ? payload.aniosPresentes : [];
      setSelectedYears((prev) => {
        if (!prev || prev.length === 0) return years;
        const filtered = prev.filter((y) => years.includes(y));
        return filtered.length ? filtered : years;
      });
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.message || 'Error al cargar competencias agregadas', { variant: 'error' });
      setData(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [enqueueSnackbar, grupo, appliedProgramas]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    setSelectedCompetencia('');
  }, [grupo, appliedProgramas]);

  const programOptions = useMemo(() => {
    const catalog = data?.programas || [];
    return catalog.map(p => ({ id: p, nombre: p }));
  }, [data?.programas]);

  const handleProgramasChange = (newPrograms) => {
    setAppliedProgramas(newPrograms);
    loadData(false, newPrograms);
  };
  const aniosDisponibles = useMemo(() => (Array.isArray(data?.aniosPresentes) ? data.aniosPresentes : []), [data]);
  const matriz = useMemo(() => (Array.isArray(data?.matriz) ? data.matriz : []), [data]);
  const promedioRow = useMemo(() => (data?.promedio || { byYear: {} }), [data]);

  const aniosVisibles = useMemo(
    () => (selectedYears.length ? [...selectedYears].sort((a, b) => a - b) : aniosDisponibles),
    [selectedYears, aniosDisponibles]
  );

  const matrizOrdenada = useMemo(() => {
    if (!matriz.length) return [];
    
    // Filter out rows that have absolutely no data for any of the currently visible years
    const filtered = matriz.filter((row) => {
      return aniosVisibles.some((anio) => {
        const cell = row.byYear?.[anio];
        if (!cell) return false;
        const v = cell.programa;
        return v != null && Number.isFinite(Number(v));
      });
    });

    return [...filtered].sort((a, b) => (b.promedio || 0) - (a.promedio || 0));
  }, [matriz, aniosVisibles]);

  const activeRow = useMemo(() => {
    if (!selectedCompetencia) return null;
    return matrizOrdenada.find((r) => r.competencia === selectedCompetencia) || null;
  }, [selectedCompetencia, matrizOrdenada]);

  const chartData = useMemo(() => {
    const raw = aniosVisibles.map((anio) => {
      let principal = null;
      let grupoRef = null;
      if (activeRow) {
        principal = activeRow.byYear?.[anio]?.programa ?? null;
        grupoRef = activeRow.byYear?.[anio]?.grupo ?? null;
      } else {
        principal = promedioRow.byYear?.[anio]?.programa ?? null;
        grupoRef = promedioRow.byYear?.[anio]?.grupo ?? null;
      }
      return { anio, principal, grupoRef };
    });
    // Filter out years that have no data at all for both lines
    return raw.filter((d) => 
      (d.principal != null && Number.isFinite(Number(d.principal))) || 
      (d.grupoRef != null && Number.isFinite(Number(d.grupoRef)))
    );
  }, [aniosVisibles, activeRow, promedioRow]);

  const chartYDomain = useMemo(() => {
    const vals = chartData
      .flatMap((r) => [r.principal, r.grupoRef])
      .filter((v) => Number.isFinite(Number(v)));
    if (!vals.length) return [0, 300];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    // Margen holgado de 15 puntos para centrar verticalmente los datos
    const minLimit = Math.max(0, Math.floor((min - 15) / 10) * 10);
    const maxLimit = Math.min(300, Math.ceil((max + 15) / 10) * 10);
    return [minLimit, maxLimit];
  }, [chartData]);

  const hasAppliedPrograms = appliedProgramas.length > 0;
  const scopeLabel = hasAppliedPrograms
    ? (appliedProgramas.length === 1 ? appliedProgramas[0] : `${appliedProgramas.length} Programas`)
    : 'Institucional';

  const principalName = hasAppliedPrograms
    ? (appliedProgramas.length === 1 ? `Programa: ${appliedProgramas[0]}` : `Programas (${appliedProgramas.length})`)
    : 'Institucional';
  const chartTitle = activeRow ? activeRow.competencia : 'COMPORTAMIENTO GENERAL (PROMEDIO)';

  const brecha = useMemo(() => {
    const pairs = chartData.filter((d) => Number.isFinite(Number(d.principal)) && Number.isFinite(Number(d.grupoRef)));
    if (!pairs.length) return null;
    const diffs = pairs.map((p) => Number(p.principal) - Number(p.grupoRef));
    return {
      promedio: diffs.reduce((a, b) => a + b, 0) / diffs.length,
      ultimo: diffs[diffs.length - 1]
    };
  }, [chartData]);

  const toggleYear = (year) => {
    setSelectedYears((prev) => {
      if (prev.includes(year)) {
        if (prev.length === 1) return prev;
        return prev.filter((y) => y !== year);
      }
      return [...prev, year];
    });
  };

  const handleCopyTable = useCallback(async () => {
    try {
      const result = await copyTableAsImage('saberpro-matriz-table');
      enqueueSnackbar(result === 'clipboard' ? 'Tabla copiada al portapapeles como imagen' : 'Tabla descargada como imagen', { variant: 'success' });
    } catch (_error) {
      enqueueSnackbar('No se pudo copiar la tabla', { variant: 'warning' });
    }
  }, [enqueueSnackbar]);

  const handleCopyChart = useCallback(async () => {
    try {
      await copyChartSvgAsImage('rendimiento-competencias-chart');
      enqueueSnackbar('Gráfico copiado como imagen limpia', { variant: 'success' });
    } catch (_error) {
      enqueueSnackbar('No se pudo copiar el gráfico', { variant: 'warning' });
    }
  }, [enqueueSnackbar]);

  const handleCopyPromedioChart = useCallback(async () => {
    try {
      await copyChartSvgAsImage('promedio-competencias-chart');
      enqueueSnackbar('Gráfico de clasificación copiado como imagen limpia', { variant: 'success' });
    } catch (_error) {
      enqueueSnackbar('No se pudo copiar el gráfico', { variant: 'warning' });
    }
  }, [enqueueSnackbar]);

  const chartEmpty = !chartData.some((d) => Number.isFinite(Number(d.principal)) || Number.isFinite(Number(d.grupoRef)));

  const rankingCompetencias = useMemo(() => {
    if (grupo === 'especificas' || !matrizOrdenada.length) return [];
    
    const calculated = matrizOrdenada.map((row) => {
      const vals = aniosVisibles
        .map((anio) => row.byYear?.[anio]?.programa)
        .filter((v) => v != null && Number.isFinite(Number(v)));
      
      const promedio = vals.length
        ? vals.reduce((acc, v) => acc + v, 0) / vals.length
        : 0;
      
      return {
        competencia: row.competencia,
        promedio
      };
    });

    return calculated
      .filter((c) => c.promedio > 0)
      .sort((a, b) => b.promedio - a.promedio);
  }, [matrizOrdenada, aniosVisibles, grupo]);

  const promedioGeneralAcumulado = useMemo(() => {
    if (grupo === 'especificas') return null;
    const vals = aniosVisibles
      .map((anio) => promedioRow.byYear?.[anio]?.programa)
      .filter((v) => v != null && Number.isFinite(Number(v)));
    
    return vals.length
      ? vals.reduce((acc, v) => acc + v, 0) / vals.length
      : null;
  }, [aniosVisibles, promedioRow, grupo]);

  const rankingMinLimit = useMemo(() => {
    const vals = rankingCompetencias.map((c) => c.promedio);
    if (promedioGeneralAcumulado != null) vals.push(promedioGeneralAcumulado);
    if (!vals.length) return 0;
    const minVal = Math.min(...vals);
    return Math.max(0, Math.floor((minVal - 15) / 10) * 10);
  }, [rankingCompetencias, promedioGeneralAcumulado]);

  const rankingMaxLimit = useMemo(() => {
    const vals = rankingCompetencias.map((c) => c.promedio);
    if (promedioGeneralAcumulado != null) vals.push(promedioGeneralAcumulado);
    if (!vals.length) return 300;
    const maxVal = Math.max(...vals);
    return Math.min(300, Math.ceil((maxVal + 15) / 10) * 10);
  }, [rankingCompetencias, promedioGeneralAcumulado]);

  const rankingEmpty = rankingCompetencias.length === 0;

  const matrizEmpty = !matrizOrdenada.length;

  const RenderAbove = useMemo(() => {
    return (props) => <RenderLineLabelAbove {...props} chartData={chartData} />;
  }, [chartData]);

  const RenderBelow = useMemo(() => {
    return (props) => <RenderLineLabelBelow {...props} chartData={chartData} themeColor={theme.primary} />;
  }, [chartData, theme.primary]);

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5 }, bgcolor: '#f8fafc', minHeight: 'calc(100vh - 120px)' }}>
      {/* ═══════════ FILTROS DE BÚSQUEDA ═══════════ */}
      <Paper elevation={0} sx={{
        p: 2,
        borderRadius: 3,
        mb: 2.5,
        border: '1px solid #cbd5e1',
        bgcolor: '#ffffff',
        boxShadow: '0 4px 18px rgba(15,23,42,0.04)'
      }}>
        <ProgramFilterPanel
          label="Programa académico"
          options={programOptions}
          value={appliedProgramas}
          onChange={handleProgramasChange}
          placeholder="Buscar programa académico..."
          themeColor={theme.primary}
        />
      </Paper>

      {/* ═══════════ TABLA DE COMPETENCIAS ═══════════ */}
      <Paper elevation={0} sx={{
        p: { xs: 1.5, md: 2.2 },
        borderRadius: 2.5,
        mb: 2,
        border: '1px solid #e2e8f0',
        bgcolor: '#ffffff'
      }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 1.6 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TableChartRoundedIcon sx={{ color: theme.primary, fontSize: 18 }} />
            <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: '#0f172a', letterSpacing: '-0.01em' }}>
              Matriz Competencia × {scopeLabel}
            </Typography>
          </Stack>

          {/* Selector de años local (Segmented Control) y Copiar Tabla */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }} flexWrap="wrap" useFlexGap sx={{ mt: { xs: 1, md: 0 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: '0.04em' }}>AÑOS:</Typography>
              <Box sx={{ display: 'flex', bgcolor: '#f1f5f9', p: 0.4, borderRadius: '8px', border: '1px solid #cbd5e1', flexWrap: 'wrap', gap: 0.25 }}>
                {aniosDisponibles.map((anio) => {
                  const active = selectedYears.includes(anio);
                  return (
                    <Box
                      key={anio}
                      onClick={() => toggleYear(anio)}
                      role="button"
                      sx={{
                        px: 1.4,
                        py: 0.45,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        fontSize: 11.5,
                        fontWeight: 700,
                        transition: 'all 0.15s',
                        bgcolor: active ? theme.primary : 'transparent',
                        color: active ? '#fff' : '#64748b',
                        boxShadow: active ? `0 2px 8px ${theme.primary}26` : 'none',
                        '&:hover': {
                          bgcolor: active ? theme.primary : '#e2e8f0',
                          color: active ? '#fff' : '#0f172a'
                        }
                      }}
                    >
                      {anio}
                    </Box>
                  );
                })}
              </Box>
            </Box>

            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopyRoundedIcon sx={{ fontSize: 15 }} />}
              onClick={handleCopyTable}
              disabled={matrizEmpty}
              sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2, fontSize: 11, py: 0.35, height: 32 }}
            >
              Copiar tabla
            </Button>
          </Stack>
        </Stack>

        {loading ? (
          <Stack spacing={0.8}>
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} variant="rectangular" height={36} sx={{ borderRadius: 1 }} />)}
          </Stack>
        ) : matrizEmpty ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography sx={{ color: '#94a3b8', fontWeight: 600, fontSize: 13 }}>
              No hay datos para el alcance actual.
            </Typography>
          </Box>
        ) : (
          <Box id="saberpro-matriz-table" sx={{ overflowX: 'auto', borderRadius: 2, border: '1px solid #cbd5e1', bgcolor: '#ffffff' }}>
            <Box component="table" sx={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12.5
            }}>
              <Box component="thead">
                <Box component="tr" sx={{ bgcolor: theme.primary }}>
                  <Box component="th" sx={{ textAlign: 'left', px: 1.6, py: 1.1, color: '#fff', fontWeight: 800, fontSize: 11.5, letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 260 }}>
                    Competencia
                  </Box>
                  {aniosVisibles.map((anio) => (
                    <Box component="th" key={anio} sx={{ textAlign: 'center', px: 1.2, py: 1.1, color: '#fff', fontWeight: 800, fontSize: 12, minWidth: 68 }}>
                      {anio}
                    </Box>
                  ))}
                  <Box component="th" sx={{ textAlign: 'center', px: 1.2, py: 1.1, color: '#fff', fontWeight: 800, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', borderLeft: '1px solid #1f2937', minWidth: 90 }}>
                    Promedio
                  </Box>
                </Box>
              </Box>
              <Box component="tbody">
                {matrizOrdenada.map((row) => {
                  const selected = selectedCompetencia === row.competencia;
                  return (
                    <Box
                      component="tr"
                      key={row.competencia}
                      onClick={() => setSelectedCompetencia(selected ? '' : row.competencia)}
                      sx={{
                        cursor: 'pointer',
                        transition: 'background-color 0.12s',
                        bgcolor: selected ? '#eef4ff' : '#fff',
                        '&:hover': { bgcolor: selected ? '#e0ebff' : '#f8fafc' }
                      }}
                    >
                      <Box component="td" sx={{
                        px: 1.6, py: 1,
                        fontWeight: 700,
                        color: selected ? '#172554' : '#0f172a',
                        fontSize: 12.8,
                        borderBottom: '1px solid #f1f5f9',
                        borderLeft: selected ? `3px solid ${theme.primary}` : '3px solid transparent'
                      }}>
                        <Stack direction="row" spacing={0.8} alignItems="center">
                          {selected && <CheckCircleRoundedIcon sx={{ fontSize: 15, color: theme.primary }} />}
                          <span>{row.competencia}</span>
                        </Stack>
                      </Box>
                      {aniosVisibles.map((anio) => {
                        const cell = row.byYear?.[anio] || {};
                        const v = cell.programa;
                        const g = cell.grupo;
                        return (
                          <Tooltip
                            key={anio}
                            arrow
                            placement="top"
                            title={
                              <Box>
                                <Typography sx={{ fontSize: 11.5, fontWeight: 800 }}>{row.competencia} · {anio}</Typography>
                                <Typography sx={{ fontSize: 11 }}>{principalName}: <b>{fmt(v, 1)}</b></Typography>
                                <Typography sx={{ fontSize: 11 }}>Grupo referencia: <b>{fmt(g, 1)}</b></Typography>
                              </Box>
                            }
                          >
                            <Box component="td" sx={{
                              px: 1.2, py: 1,
                              textAlign: 'center',
                              fontWeight: 700,
                              color: '#0f172a',
                              borderBottom: '1px solid #f1f5f9',
                              bgcolor: '#fff'
                            }}>
                              {fmt(v, 1)}
                            </Box>
                          </Tooltip>
                        );
                      })}
                      <Box component="td" sx={{
                        px: 1.2, py: 1,
                        textAlign: 'center',
                        fontWeight: 900,
                        color: '#1e3a8a',
                        borderBottom: '1px solid #f1f5f9',
                        borderLeft: '1px solid #e2e8f0',
                        bgcolor: '#f8fafc'
                      }}>
                        {fmt(row.promedio, 1)}
                      </Box>
                    </Box>
                  );
                })}
                {/* Fila PROMEDIO general */}
                {grupo !== 'especificas' && (
                  <Box component="tr" sx={{ bgcolor: '#f1f5f9' }}>
                    <Box component="td" sx={{
                      px: 1.6, py: 1.1,
                      fontWeight: 900,
                      color: '#0f172a',
                      fontSize: 12,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      borderTop: `2px solid ${theme.primary}`
                    }}>
                      Promedio
                    </Box>
                    {aniosVisibles.map((anio) => (
                      <Box component="td" key={anio} sx={{
                        px: 1.2, py: 1.1,
                        textAlign: 'center',
                        fontWeight: 900,
                        color: '#0f172a',
                        borderTop: `2px solid ${theme.primary}`
                      }}>
                        {fmt(promedioRow.byYear?.[anio]?.programa, 1)}
                      </Box>
                    ))}
                    <Box component="td" sx={{
                      px: 1.2, py: 1.1,
                      textAlign: 'center',
                      fontWeight: 900,
                      color: '#1e3a8a',
                      borderTop: `2px solid ${theme.primary}`,
                      borderLeft: '1px solid #cbd5e1',
                      bgcolor: '#fff'
                    }}>
                      {fmt(Object.values(promedioRow.byYear || {}).map((c) => c?.programa).filter((v) => Number.isFinite(Number(v))).reduce((acc, v, _, arr) => acc + Number(v) / arr.length, 0) || null, 1)}
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        )}
      </Paper>

      {/* ═══════════ GRÁFICO DE LÍNEAS ═══════════ */}
      <Paper
        id="rendimiento-competencias-chart"
        elevation={0}
        sx={{
          p: { xs: 1.5, md: 2.2 },
          borderRadius: 2.5,
          border: '1px solid #e2e8f0',
          bgcolor: '#ffffff',
          mb: 2
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TimelineRoundedIcon sx={{ color: theme.primary, fontSize: 18 }} />
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: '#0f172a', letterSpacing: '-0.01em' }}>
                {chartTitle}
              </Typography>
              <Typography data-copy-ignore="true" sx={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                ({activeRow ? 'Selección individual' : `Promedio · ${scopeLabel}`})
              </Typography>
            </Box>
          </Stack>

          <Stack data-copy-ignore="true" direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Box
              sx={{
                display: 'inline-flex',
                bgcolor: '#f1f5f9',
                borderRadius: '8px',
                p: '3px',
                border: '1px solid #cbd5e1',
                mr: 0.5
              }}
            >
              <Box
                onClick={() => setShowGrupoReferencia(false)}
                sx={{
                  px: 1.4,
                  py: 0.4,
                  borderRadius: '6px',
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.2s',
                  bgcolor: !showGrupoReferencia ? '#ffffff' : 'transparent',
                  color: !showGrupoReferencia ? theme.primary : '#475569',
                  boxShadow: !showGrupoReferencia ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                Solo {hasAppliedPrograms ? 'Programa' : 'Institucional'}
              </Box>
              <Box
                onClick={() => setShowGrupoReferencia(true)}
                sx={{
                  px: 1.4,
                  py: 0.4,
                  borderRadius: '6px',
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.2s',
                  bgcolor: showGrupoReferencia ? '#ffffff' : 'transparent',
                  color: showGrupoReferencia ? theme.primary : '#475569',
                  boxShadow: showGrupoReferencia ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                Comparativo Nacional
              </Box>
            </Box>

            <Button
              data-copy-ignore="true"
              size="small"
              variant="outlined"
              startIcon={<ImageRoundedIcon sx={{ fontSize: 14 }} />}
              onClick={handleCopyChart}
              disabled={chartEmpty}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '8px',
                fontSize: 11,
                borderColor: '#cbd5e1',
                color: '#475569',
                height: 28,
                px: 1.2,
                '&:hover': {
                  borderColor: '#94a3b8',
                  bgcolor: '#f8fafc',
                  color: '#1f2937'
                }
              }}
            >
              Copiar gráfico
            </Button>
            {brecha && showGrupoReferencia && (
              <>
                <Chip
                  label={`Brecha promedio: ${brecha.promedio >= 0 ? '+' : ''}${fmt(brecha.promedio, 1)}`}
                  size="small"
                  sx={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    height: 24,
                    bgcolor: brecha.promedio >= 0 ? '#eff6ff' : '#fef2f2',
                    color: brecha.promedio >= 0 ? '#1e40af' : '#991b1b',
                    border: brecha.promedio >= 0 ? '1px solid #bfdbfe' : '1px solid #fecaca'
                  }}
                />
                <Chip
                  label={`Último año: ${brecha.ultimo >= 0 ? '+' : ''}${fmt(brecha.ultimo, 1)}`}
                  size="small"
                  sx={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    height: 24,
                    bgcolor: '#f8fafc',
                    color: '#475569',
                    border: '1px solid #e2e8f0'
                  }}
                />
              </>
            )}
          </Stack>
        </Stack>

        {loading ? (
          <Skeleton variant="rectangular" height={340} sx={{ borderRadius: 2 }} />
        ) : chartEmpty ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ color: '#94a3b8', fontWeight: 600, fontSize: 13 }}>
              Sin datos para graficar en los años seleccionados.
            </Typography>
          </Box>
        ) : (
          <Box sx={{
            bgcolor: '#ffffff',
            borderRadius: 2,
            border: '1px solid #cbd5e1',
            p: { xs: 1, md: 1.4 }
          }}>
            <Box sx={{ bgcolor: '#fff', fontFamily: 'Arial, Helvetica, sans-serif' }}>
              <ResponsiveContainer width="100%" height={360}>
              <LineChart data={chartData} margin={{ top: 28, right: 34, left: 6, bottom: 8 }}>
                <CartesianGrid
                  stroke="#cbd5e1"
                  strokeDasharray="4 4"
                  strokeOpacity={0.75}
                  horizontal
                  vertical
                />
                <XAxis
                  dataKey="anio"
                  tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  padding={{ left: 20, right: 20 }}
                />
                <YAxis
                  domain={chartYDomain}
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  width={46}
                  label={{ value: 'Puntaje (0 - 300)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                />
                <RechartsTooltip content={<FancyTooltip theme={theme} />} cursor={{ stroke: '#94a3b8', strokeOpacity: 0.22, strokeWidth: 2 }} />
                <Legend
                  verticalAlign="bottom"
                  height={32}
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12, fontWeight: 700, color: '#334155' }}
                />
                {showGrupoReferencia && (
                  <Line
                    type="linear"
                    dataKey="grupoRef"
                    name="Grupo de Referencia"
                    stroke={REFERENCE_DARK}
                    strokeWidth={3}
                    strokeDasharray="7 4"
                    dot={{ r: 5, fill: '#fff', stroke: REFERENCE_DARK, strokeWidth: 2.5 }}
                    activeDot={{ r: 7, fill: REFERENCE_DARK, stroke: '#fff', strokeWidth: 2.4 }}
                    connectNulls
                  >
                    <LabelList dataKey="grupoRef" content={RenderAbove} />
                  </Line>
                )}
                <Line
                  type="linear"
                  dataKey="principal"
                  name={principalName}
                  stroke={theme.primary}
                  strokeWidth={4}
                  dot={{ r: 6, fill: '#fff', stroke: theme.primary, strokeWidth: 3 }}
                  activeDot={{ r: 8, fill: theme.primary, stroke: '#fff', strokeWidth: 2.6 }}
                  connectNulls
                >
                  <LabelList dataKey="principal" content={RenderBelow} />
                </Line>
              </LineChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        )}

        {/* Nota explicativa */}
        <Stack data-copy-ignore="true" direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 1.5, p: 1.2, borderRadius: 1.8, bgcolor: '#f8fafc', border: '1px dashed #cbd5e1' }}>
          <InfoRoundedIcon sx={{ color: '#64748b', fontSize: 16, mt: 0.1 }} />
          <Typography sx={{ fontSize: 11.5, color: '#475569', lineHeight: 1.5, fontWeight: 500 }}>
            La línea <b style={{ color: theme.primary }}>{principalName}</b> representa el puntaje promedio {hasAppliedPrograms ? 'del alcance seleccionado' : 'institucional'}.
            {showGrupoReferencia && (
              <>
                {' '}La línea <b style={{ color: REFERENCE_DARK }}>Grupo de Referencia</b> corresponde al puntaje promedio nacional del grupo comparable reportado por el ICFES.
                Valores positivos en la brecha indican desempeño por encima del grupo de referencia.
              </>
            )}
          </Typography>
        </Stack>
      </Paper>

      {/* ═══════════ GRÁFICO DE CLASIFICACIÓN (RANKING) HORIZONTAL (Solo para genéricas) ═══════════ */}
      {grupo !== 'especificas' && (
        <Paper
          id="promedio-competencias-chart"
          elevation={0}
          sx={{
            p: { xs: 1.5, md: 2.2 },
            borderRadius: 2.5,
            border: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            mb: 2
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TrendingUpRoundedIcon sx={{ color: theme.primary, fontSize: 18 }} />
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: '#0f172a', letterSpacing: '-0.01em' }}>
                  CLASIFICACIÓN GENERAL DE COMPETENCIAS
                </Typography>
                <Typography data-copy-ignore="true" sx={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                  (Promedio acumulado de todos los años seleccionados · {scopeLabel})
                </Typography>
              </Box>
            </Stack>

            <Button
              data-copy-ignore="true"
              size="small"
              variant="outlined"
              startIcon={<ImageRoundedIcon sx={{ fontSize: 14 }} />}
              onClick={handleCopyPromedioChart}
              disabled={rankingEmpty}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '8px',
                fontSize: 11,
                borderColor: '#cbd5e1',
                color: '#475569',
                height: 28,
                px: 1.2,
                '&:hover': {
                  borderColor: '#94a3b8',
                  bgcolor: '#f8fafc',
                  color: '#1f2937'
                }
              }}
            >
              Copiar gráfico
            </Button>
          </Stack>

          {loading ? (
            <Stack spacing={1.8} sx={{ py: 1 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} variant="rectangular" height={42} sx={{ borderRadius: 1.5 }} />)}
            </Stack>
          ) : rankingEmpty ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography sx={{ color: '#94a3b8', fontWeight: 600, fontSize: 13 }}>
                Sin datos para graficar el promedio acumulado.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.8, py: 1 }}>
              {rankingCompetencias.map((item, index) => {
                const range = rankingMaxLimit - rankingMinLimit;
                const widthPercent = range > 0
                  ? ((item.promedio - rankingMinLimit) / range) * 85 + 15
                  : 15;
                return (
                  <Box
                    key={item.competencia}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.2,
                      borderRadius: '12px',
                      bgcolor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 2px 6px rgba(15,23,42,0.03)',
                      transition: 'all 0.2s',
                      '&:hover': {
                        transform: 'translateX(4px)',
                        boxShadow: '0 4px 12px rgba(15,23,42,0.06)',
                        bgcolor: '#f8fafc'
                      }
                    }}
                  >
                    {/* Medalla del Ranking */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        bgcolor: '#eff6ff',
                        color: theme.primary,
                        fontWeight: 800,
                        fontSize: 12.5,
                        border: `1px solid #bfdbfe`,
                        flexShrink: 0
                      }}
                    >
                      {index + 1}
                    </Box>

                    {/* Nombre de la Competencia */}
                    <Box
                      sx={{
                        width: { xs: 150, sm: 220 },
                        px: 1.8,
                        py: 0.8,
                        borderRadius: '8px',
                        bgcolor: '#eff6ff',
                        color: '#1e3a8a',
                        fontWeight: 700,
                        fontSize: 12.5,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        borderLeft: `4px solid ${theme.primary}`,
                        flexShrink: 0
                      }}
                    >
                      {item.competencia}
                    </Box>

                    {/* Barra de Progreso y Valor */}
                    <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        sx={{
                          flexGrow: 1,
                          height: 20,
                          bgcolor: '#f1f5f9',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          position: 'relative'
                        }}
                      >
                        <Box
                          sx={{
                            height: '100%',
                            width: `${widthPercent}%`,
                            bgcolor: theme.primary,
                            borderRadius: '10px',
                            backgroundImage: `linear-gradient(90deg, ${theme.primary}ee, ${theme.primary})`,
                            transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}
                        />
                      </Box>
                      {/* Píldora de Puntaje */}
                      <Box
                        sx={{
                          px: 1.4,
                          py: 0.45,
                          borderRadius: '6px',
                          bgcolor: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          fontSize: 12,
                          fontWeight: 800,
                          color: '#1e293b',
                          minWidth: 54,
                          textAlign: 'center',
                          flexShrink: 0
                        }}
                      >
                        {fmt(item.promedio, 1)}
                      </Box>
                    </Box>
                  </Box>
                );
              })}

              {/* Fila de Promedio General */}
              {promedioGeneralAcumulado != null && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.2,
                    borderRadius: '12px',
                    bgcolor: '#f8fafc',
                    border: '2px dashed #cbd5e1',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: '#f1f5f9'
                    }
                  }}
                >
                  {/* Icono de Promedio */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: '#475569',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: 12.5,
                      border: '1px solid #475569',
                      flexShrink: 0
                    }}
                  >
                    ★
                  </Box>

                  {/* Etiqueta Promedio General */}
                  <Box
                    sx={{
                      width: { xs: 150, sm: 220 },
                      px: 1.8,
                      py: 0.8,
                      borderRadius: '8px',
                      bgcolor: '#475569',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: 12.5,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      borderLeft: '4px solid #1e293b',
                      flexShrink: 0
                    }}
                  >
                    PROMEDIO GENERAL
                  </Box>

                  {/* Barra de Progreso y Valor */}
                  <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        flexGrow: 1,
                        height: 20,
                        bgcolor: '#e2e8f0',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        position: 'relative'
                      }}
                    >
                      <Box
                        sx={{
                          height: '100%',
                          width: `${rankingMaxLimit - rankingMinLimit > 0 ? ((promedioGeneralAcumulado - rankingMinLimit) / (rankingMaxLimit - rankingMinLimit)) * 85 + 15 : 15}%`,
                          bgcolor: '#475569',
                          borderRadius: '10px',
                          transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                      />
                    </Box>
                    {/* Píldora de Puntaje */}
                    <Box
                      sx={{
                        px: 1.4,
                        py: 0.45,
                        borderRadius: '6px',
                        bgcolor: '#475569',
                        border: '1px solid #475569',
                        fontSize: 12,
                        fontWeight: 800,
                        color: '#ffffff',
                        minWidth: 54,
                        textAlign: 'center',
                        flexShrink: 0
                      }}
                    >
                      {fmt(promedioGeneralAcumulado, 1)}
                    </Box>
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* Nota explicativa */}
          <Stack data-copy-ignore="true" direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 1.5, p: 1.2, borderRadius: 1.8, bgcolor: '#f8fafc', border: '1px dashed #cbd5e1' }}>
            <InfoRoundedIcon sx={{ color: '#64748b', fontSize: 16, mt: 0.1 }} />
            <Typography sx={{ fontSize: 11.5, color: '#475569', lineHeight: 1.5, fontWeight: 500 }}>
              Este gráfico clasifica las competencias de <b>mayor a menor puntaje promedio</b> acumulado de todos los años seleccionados (<b>{aniosVisibles.join(', ')}</b>). La última fila destaca el promedio general de todas las competencias. Ayuda a identificar instantáneamente fortalezas y debilidades.
            </Typography>
          </Stack>
        </Paper>
      )}

      {loading && (
        <Box sx={{ position: 'fixed', top: 120, right: 24, zIndex: 1400 }}>
          <Paper elevation={4} sx={{ p: 1.2, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} sx={{ color: theme.primary }} />
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Cargando…</Typography>
          </Paper>
        </Box>
      )}
    </Box>
  );
}

export default RendimientoCompetenciasPanel;
