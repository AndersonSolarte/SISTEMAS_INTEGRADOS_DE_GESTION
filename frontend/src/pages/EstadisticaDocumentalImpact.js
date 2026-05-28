import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import html2canvas from 'html2canvas';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Fade,
  IconButton,
  Paper,
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
import {
  Analytics as AnalyticsIcon,
  AccountTree as AccountTreeIcon,
  Article as ArticleIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  AutoGraph as AutoGraphIcon,
  Clear as ClearIcon,
  Close as CloseIcon,
  ContentCopy as ContentCopyIcon,
  Description as DescriptionIcon,
  DonutSmall as DonutSmallIcon,
  FilterAlt as FilterAltIcon,
  FolderCopy as FolderCopyIcon,
  Gavel as GavelIcon,
  InsertDriveFile as InsertDriveFileIcon,
  LibraryBooks as LibraryBooksIcon,
  MenuBook as MenuBookIcon,
  OpenInNew as OpenInNewIcon,
  RuleFolder as RuleFolderIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import documentoService from '../services/documentoService';
import catalogoService from '../services/catalogoService';

const CHART_COLORS = ['#0f766e', '#0369a1', '#1d4ed8', '#be123c', '#a16207', '#7c3aed', '#0891b2', '#475569'];
const MAPA_PROCESOS_VIGENTE = { macroprocesos: 3, procesos: 11, subprocesos: 42 };

const CARD_TONES = [
  { soft: '#e0f2fe', fg: '#0369a1', border: '#bae6fd' },
  { soft: '#dcfce7', fg: '#15803d', border: '#bbf7d0' },
  { soft: '#fee2e2', fg: '#b91c1c', border: '#fecaca' },
  { soft: '#fef3c7', fg: '#a16207', border: '#fde68a' },
  { soft: '#e2e8f0', fg: '#475569', border: '#cbd5e1' },
  { soft: '#fce7f3', fg: '#be185d', border: '#fbcfe8' },
  { soft: '#f0fdfa', fg: '#0f766e', border: '#99f6e4' },
  { soft: '#eef2ff', fg: '#4338ca', border: '#c7d2fe' }
];

const DOCUMENT_TYPE_ICONS = [
  { pattern: /FORMATO/i, Icon: AssignmentTurnedInIcon },
  { pattern: /PROCEDIMIENTO/i, Icon: RuleFolderIcon },
  { pattern: /INSTRUCTIVO/i, Icon: ArticleIcon },
  { pattern: /MANUAL/i, Icon: MenuBookIcon },
  { pattern: /PLAN/i, Icon: LibraryBooksIcon },
  { pattern: /PROGRAMA/i, Icon: FolderCopyIcon },
  { pattern: /PROTOCOLO/i, Icon: InsertDriveFileIcon }
];

const getDocumentTypeIcon = (name = '') =>
  (DOCUMENT_TYPE_ICONS.find((item) => item.pattern.test(String(name))) || { Icon: DescriptionIcon }).Icon;

const formatNumber = (value) => new Intl.NumberFormat('es-CO').format(Number(value || 0));
const normalizeFilterArray = (value) => (Array.isArray(value) ? value : String(value || '').split(',')).map((item) => String(item || '').trim()).filter(Boolean);
const serializeFilterArray = (value) => normalizeFilterArray(value).join(',');

const emptyData = {
  periodosDisponibles: [],
  resumen: {
    totalDocumentos: 0,
    totalTipos: 0,
    totalMacroProcesos: 0,
    totalProcesos: 0,
    totalSubprocesos: 0,
    periodoSeleccionado: 'Todos',
    tipoMasFrecuente: null,
    macroMasFrecuente: null,
    procesoMasFrecuente: null,
    subprocesoMasFrecuente: null,
    promedioPorTipo: 0,
    promedioPorMacroProceso: 0,
    promedioPorProceso: 0,
    promedioPorSubproceso: 0,
    concentracionTipoPrincipal: 0,
    concentracionMacroPrincipal: 0,
    concentracionProcesoPrincipal: 0,
    concentracionSubprocesoPrincipal: 0
  },
  filtrosDisponibles: {
    macroProcesos: [],
    procesos: [],
    subprocesos: [],
    tiposDocumentacion: [],
    periodos: []
  },
  distribucion: {
    porTipoDocumento: [],
    porMacroProceso: [],
    porProceso: [],
    porSubproceso: []
  }
};

function DocFilterPanel({ label, options = [], value = [], onChange, disabled, placeholder = 'Buscar...' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [visibleOptions, setVisibleOptions] = useState(options);
  const [portalStyle, setPortalStyle] = useState({});
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const computePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPortalStyle({ position: 'fixed', top: rect.bottom + 6, left: rect.left, width: rect.width, minWidth: 240, zIndex: 9999 });
  }, []);

  useEffect(() => { setVisibleOptions(options); }, [open, options]);

  useEffect(() => {
    if (!open) return undefined;
    computePosition();
    const onScroll = (e) => { if (dropdownRef.current?.contains(e.target)) return; computePosition(); };
    const onResize = () => computePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onResize); };
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => {
      if (triggerRef.current?.contains(e.target) || dropdownRef.current?.contains(e.target)) return;
      setOpen(false); setSearch('');
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const effectiveOptions = open ? visibleOptions : options;
  const filtered = effectiveOptions.filter((o) => String(o.label || '').toLowerCase().includes(search.toLowerCase()));
  const selectedIds = (Array.isArray(value) ? value : []).map((id) => String(id));
  const allSelected = selectedIds.length === 0;
  const isSel = (val) => selectedIds.includes(String(val));
  const toggle = (val) => {
    const key = String(val);
    onChange(isSel(key) ? selectedIds.filter((v) => v !== key) : [...selectedIds, key]);
  };
  const toggleAll = () => onChange(allSelected ? effectiveOptions.map((o) => String(o.value)) : []);
  const displayText = selectedIds.length === 0 ? 'TODOS' : `${selectedIds.length} SELECCIONADO${selectedIds.length > 1 ? 'S' : ''}`;
  const C = '#2563eb';

  const dropdownPortal = open ? ReactDOM.createPortal(
    <div ref={dropdownRef} style={{ ...portalStyle, background: '#fff', borderRadius: 10, boxShadow: '0 12px 36px rgba(0,0,0,0.22)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', borderRadius: 6, padding: '4px 8px', border: '1px solid #e2e8f0' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={placeholder} style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, flex: 1, color: '#334155', minWidth: 0 }} />
        </div>
      </div>
      <div onClick={toggleAll} style={{ padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9', background: 'transparent' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
        <div style={{ width: 14, height: 14, flexShrink: 0, borderRadius: 3, border: `2px solid ${allSelected ? C : '#d1d5db'}`, background: allSelected ? C : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {allSelected && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: C }}>SELECCIONAR TODOS ({effectiveOptions.length})</span>
      </div>
      <div onWheel={(e) => e.stopPropagation()} style={{ maxHeight: 220, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'thin' }}>
        {filtered.length === 0
          ? <div style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>Sin resultados</div>
          : filtered.map((opt) => (
            <div key={opt.value} onClick={() => toggle(opt.value)}
              style={{ padding: '5px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
              <div style={{ width: 14, height: 14, flexShrink: 0, borderRadius: 3, border: `2px solid ${isSel(opt.value) ? C : '#d1d5db'}`, background: isSel(opt.value) ? C : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isSel(opt.value) && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <span style={{ fontSize: 12, color: '#334155', textTransform: 'uppercase' }}>{opt.label}</span>
            </div>
          ))}
      </div>
      <div style={{ padding: '4px 12px', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>{selectedIds.length > 0 ? `${selectedIds.length} de ${effectiveOptions.length} seleccionados` : `${effectiveOptions.length} opciones`}</span>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <Box ref={triggerRef} sx={{ position: 'relative', opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      <Box onClick={() => !disabled && setOpen((o) => !o)} sx={{ cursor: 'pointer', borderRadius: '8px', p: '8px 12px', minHeight: 48, bgcolor: selectedIds.length ? '#eff6ff' : '#fff', border: `1.5px solid ${selectedIds.length ? C : '#bfdbfe'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, transition: 'all 0.15s', userSelect: 'none', '&:hover': { borderColor: C } }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: '9px', fontWeight: 700, color: C, letterSpacing: '0.8px', textTransform: 'uppercase', mb: 0.25 }}>{label}</Typography>
          <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#1e3a5f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayText}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          {selectedIds.length > 0 && (
            <Box onClick={(e) => { e.stopPropagation(); onChange([]); }} sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: C, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </Box>
          )}
          <Box sx={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C} strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </Box>
        </Box>
      </Box>
      {dropdownPortal}
    </Box>
  );
}

function InfographicStatCard({ index, title, value, subtitle, color = '#1d4ed8', Icon = AutoGraphIcon, onClick }) {
  const soft = `${color}14`;
  return (
    <Paper elevation={0} onClick={onClick} sx={{ minHeight: 120, p: 1.6, borderRadius: '8px', border: `1px solid ${color}33`, bgcolor: '#ffffff', position: 'relative', overflow: 'hidden', boxShadow: '0 8px 20px rgba(15,23,42,0.07)', ...(onClick && { cursor: 'pointer', transition: 'all 0.18s', '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 14px 32px ${color}30`, borderColor: `${color}66` } }), '&::before': { content: '""', position: 'absolute', left: 0, top: 0, width: '30%', height: '100%', bgcolor: soft }, '&::after': { content: '""', position: 'absolute', right: 0, top: 0, width: 5, height: '100%', bgcolor: color } }}>
      <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between" sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ width: 36, height: 22, borderRadius: '6px', bgcolor: color, color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 10px ${color}30` }}>
            <Typography sx={{ color: '#ffffff', fontWeight: 950, fontSize: 11 }}>{String(index).padStart(2, '0')}</Typography>
          </Box>
          <Typography sx={{ color: '#0f172a', fontWeight: 950, fontSize: 13, mt: 0.9, lineHeight: 1.18, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title}</Typography>
          {subtitle && <Typography sx={{ color: '#64748b', fontWeight: 750, fontSize: 11, mt: 0.4, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{subtitle}</Typography>}
        </Box>
        <Box sx={{ width: 38, height: 38, borderRadius: '8px', bgcolor: soft, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${color}22` }}>
          <Icon sx={{ fontSize: 22 }} />
        </Box>
      </Stack>
      <Box sx={{ mt: 1.2, position: 'relative', zIndex: 1 }}>
        <Typography sx={{ color: '#0f172a', fontWeight: 950, fontSize: 28, lineHeight: 1 }}>{formatNumber(value)}</Typography>
      </Box>
    </Paper>
  );
}

function CopyButton({ targetRef, label = 'Copiar gráfico' }) {
  const { enqueueSnackbar } = useSnackbar();
  const [copying, setCopying] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!targetRef.current || copying) return;
    setCopying(true);
    try {
      const canvas = await html2canvas(targetRef.current, {
        useCORS: true,
        backgroundColor: '#ffffff',
        scale: 2,
        onclone: (_doc, el) => {
          el.querySelectorAll('[data-export-scroll]').forEach((node) => {
            node.style.maxHeight = 'none';
            node.style.overflow = 'visible';
          });
        }
      });
      canvas.toBlob(async (blob) => {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          enqueueSnackbar('Gráfico copiado al portapapeles', { variant: 'success' });
        } catch {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${label}.png`;
          a.click();
          URL.revokeObjectURL(url);
          enqueueSnackbar('Imagen descargada', { variant: 'info' });
        }
        setCopying(false);
      }, 'image/png');
    } catch {
      enqueueSnackbar('No se pudo copiar el gráfico', { variant: 'error' });
      setCopying(false);
    }
  }, [targetRef, copying, enqueueSnackbar, label]);

  return (
    <Tooltip title={copying ? 'Copiando...' : label} placement="top">
      <span>
        <IconButton onClick={handleCopy} size="small" disabled={copying}
          sx={{ color: '#94a3b8', '&:hover': { bgcolor: '#f1f5f9', color: '#475569' } }}>
          {copying ? <CircularProgress size={14} /> : <ContentCopyIcon sx={{ fontSize: 15 }} />}
        </IconButton>
      </span>
    </Tooltip>
  );
}

function CapsuleRanking({ title, rows = [], nameKey, color = '#1d4ed8' }) {
  const panelRef = useRef(null);
  const max = Math.max(...rows.map((row) => Number(row.cantidad || 0)), 1);
  return (
    <Paper ref={panelRef} elevation={0} sx={{ p: 2.4, borderRadius: '8px', border: '1px solid #dbe6f5', bgcolor: '#ffffff', boxShadow: '0 16px 36px rgba(15,23,42,0.07)' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography sx={{ color: '#0f172a', fontWeight: 950, fontSize: 20 }}>{title}</Typography>
        <CopyButton targetRef={panelRef} label={`Copiar: ${title}`} />
      </Stack>
      {rows.length === 0 ? <Alert severity="info">Sin datos para mostrar.</Alert> : (
        <Box data-export-scroll sx={{ maxHeight: 420, overflowY: 'auto', pr: 0.5 }}>
          <Stack spacing={1.45}>
            {rows.map((row, index) => {
              const rowColor = CHART_COLORS[index % CHART_COLORS.length] || color;
              const pct = Math.max(10, Math.round((Number(row.cantidad || 0) / max) * 100));
              return (
                <Box key={`${row[nameKey]}-${index}`} sx={{ minHeight: 64, borderRadius: '32px', bgcolor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 10px 24px rgba(15,23,42,0.07)', display: 'grid', gridTemplateColumns: '58px minmax(0, 1fr) 78px', alignItems: 'center', overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', bgcolor: `${rowColor}18`, color: rowColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 950, fontSize: 18 }}>{String(index + 1).padStart(2, '0')}</Box>
                  <Box sx={{ px: 1.7, minWidth: 0 }}>
                    <Typography sx={{ color: '#0f172a', fontWeight: 900, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row[nameKey]}</Typography>
                    <Box sx={{ mt: 0.8, height: 7, borderRadius: 99, bgcolor: '#e2e8f0', overflow: 'hidden' }}>
                      <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: rowColor, borderRadius: 99 }} />
                    </Box>
                  </Box>
                  <Typography sx={{ color: rowColor, fontWeight: 950, fontSize: 15, textAlign: 'center' }}>{formatNumber(row.cantidad)}</Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>
      )}
    </Paper>
  );
}

function DocumentTypeList({ title, rows = [], total }) {
  const panelRef = useRef(null);
  const [selectedTipo, setSelectedTipo] = useState(null);
  const [docsForTipo, setDocsForTipo] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const handleTipoClick = useCallback((row) => {
    setSelectedTipo(row);
    setDocsForTipo([]);
    setDocsLoading(true);
    documentoService.getDocumentos({ tipo_documentacion_id: row.tipo_documento }, 1, 500)
      .then((res) => setDocsForTipo(res?.data?.documentos || []))
      .catch(() => {})
      .finally(() => setDocsLoading(false));
  }, []);

  const selectedIndex = selectedTipo ? rows.findIndex((r) => r.tipo_documento === selectedTipo.tipo_documento) : -1;
  const selTone = selectedIndex >= 0 ? CARD_TONES[selectedIndex % CARD_TONES.length] : CARD_TONES[0];
  const SelIcon = selectedTipo ? getDocumentTypeIcon(selectedTipo.tipo_documento) : DescriptionIcon;

  return (
    <Paper ref={panelRef} elevation={0} sx={{ p: 1.8, borderRadius: '8px', border: '1px solid #dbe6f5', bgcolor: '#ffffff', boxShadow: '0 10px 28px rgba(15,23,42,0.07)' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1.2 }}>
        <Typography sx={{ color: '#0f172a', fontWeight: 950, fontSize: 16 }}>{title}</Typography>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Chip size="small" label={`${formatNumber(total)} docs`} sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 900, fontSize: 11 }} />
          <CopyButton targetRef={panelRef} label={`Copiar: ${title}`} />
        </Stack>
      </Stack>
      {rows.length === 0 ? <Alert severity="info">Sin datos para mostrar.</Alert> : (
        <Box data-export-scroll sx={{ maxHeight: 440, overflowY: 'auto', pr: 0.4 }}>
        <Stack spacing={0.6}>
          {rows.map((row, index) => {
            const tone = CARD_TONES[index % CARD_TONES.length];
            const cantidad = Number(row.cantidad || 0);
            const pct = total > 0 ? Math.round((cantidad / total) * 1000) / 10 : 0;
            const Icon = getDocumentTypeIcon(row.tipo_documento);
            return (
              <Box key={`${row.tipo_documento}-${index}`} onClick={() => handleTipoClick(row)}
                sx={{ borderRadius: '8px', bgcolor: '#ffffff', border: `1px solid ${tone.border}`, overflow: 'hidden', display: 'grid', gridTemplateColumns: '50px minmax(0,1fr) 68px', alignItems: 'center', cursor: 'pointer', transition: 'all 0.14s', '&:hover': { borderColor: tone.fg, boxShadow: `0 3px 12px ${tone.fg}22`, transform: 'translateX(2px)' } }}>
                <Box sx={{ height: '100%', minHeight: 54, bgcolor: tone.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography sx={{ fontWeight: 950, fontSize: 14, color: '#fff', lineHeight: 1 }}>{String(index + 1).padStart(2, '0')}</Typography>
                </Box>
                <Box sx={{ px: 1.5, py: 0.8 }}>
                  <Typography sx={{ fontSize: 8.5, fontWeight: 900, color: tone.fg, letterSpacing: 0.7, textTransform: 'uppercase', lineHeight: 1 }}>Tipo Documental</Typography>
                  <Typography sx={{ fontWeight: 950, fontSize: 12.5, color: '#0f172a', lineHeight: 1.2, mt: 0.15 }}>{row.tipo_documento}</Typography>
                  <Typography sx={{ fontSize: 9.5, fontWeight: 600, color: '#94a3b8', mt: 0.15 }}>{formatNumber(cantidad)} documentos activos · {pct}% del total</Typography>
                </Box>
                <Box sx={{ pr: 1.3, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.15 }}>
                  <Box sx={{ width: 24, height: 24, borderRadius: '6px', bgcolor: tone.soft, color: tone.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon sx={{ fontSize: 14 }} />
                  </Box>
                  <Typography sx={{ fontWeight: 950, fontSize: 14, color: tone.fg, lineHeight: 1 }}>{formatNumber(cantidad)}</Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: 9, color: '#94a3b8', lineHeight: 1 }}>{pct}%</Typography>
                </Box>
              </Box>
            );
          })}
          </Stack>
        </Box>
      )}

      <Dialog open={!!selectedTipo} onClose={() => setSelectedTipo(null)} maxWidth="lg" fullWidth
        slotProps={{ paper: { sx: { borderRadius: '12px', maxHeight: '85vh' } } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.4, px: 2.4, borderBottom: '1px solid #f1f5f9' }}>
          <Stack direction="row" alignItems="center" spacing={1.4}>
            <Box sx={{ width: 36, height: 36, borderRadius: '8px', bgcolor: selTone.soft, color: selTone.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${selTone.border}` }}>
              <SelIcon sx={{ fontSize: 19 }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 950, fontSize: 16, color: '#0f172a', lineHeight: 1.2 }}>{selectedTipo?.tipo_documento}</Typography>
              <Typography sx={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>
                {docsLoading ? 'Cargando documentos...' : `${docsForTipo.length} documento${docsForTipo.length !== 1 ? 's' : ''}`}
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={() => setSelectedTipo(null)} size="small" sx={{ color: '#94a3b8', '&:hover': { bgcolor: '#f1f5f9' } }}>
            <CloseIcon sx={{ fontSize: 19 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {docsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={26} /></Box>
          ) : docsForTipo.length === 0 ? (
            <Box sx={{ p: 2.5 }}><Alert severity="info">No se encontraron documentos para este tipo.</Alert></Box>
          ) : (
            <TableContainer sx={{ maxHeight: 480, overflowY: 'auto' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {['#', 'Código', 'Título', 'Macroproceso', 'Proceso', 'v.', 'Ver'].map((col) => (
                      <TableCell key={col} sx={{ fontWeight: 900, fontSize: 11, color: '#475569', bgcolor: '#f8fafc', borderBottom: `2px solid ${selTone.border}`, whiteSpace: 'nowrap', py: 0.9 }}>{col}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {docsForTipo.map((doc, i) => (
                    <TableRow key={doc.id} hover sx={{ '&:hover td': { bgcolor: '#f8fafc' } }}>
                      <TableCell sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, py: 0.7 }}>{i + 1}</TableCell>
                      <TableCell sx={{ fontSize: 11, fontWeight: 800, color: '#1d4ed8', whiteSpace: 'nowrap', py: 0.7 }}>{doc.codigo || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 12, color: '#0f172a', fontWeight: 600, minWidth: 220, py: 0.7 }}>{doc.titulo}</TableCell>
                      <TableCell sx={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap', py: 0.7 }}>{doc.macroproceso || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 11, color: '#475569', py: 0.7, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.proceso_texto || doc.proceso || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 11, color: '#475569', textAlign: 'center', py: 0.7, whiteSpace: 'nowrap' }}>{doc.version ? `v${doc.version}` : '—'}</TableCell>
                      <TableCell sx={{ py: 0.7 }}>
                        {doc.link_acceso ? (
                          <Box component="a" href={doc.link_acceso} target="_blank" rel="noopener noreferrer"
                            sx={{ display: 'flex', alignItems: 'center', gap: 0.4, color: selTone.fg, textDecoration: 'none', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', '&:hover': { opacity: 0.75 } }}>
                            <OpenInNewIcon sx={{ fontSize: 12 }} />Ver
                          </Box>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
      </Dialog>
    </Paper>
  );
}

function ImpactInfographic({ resumen, tipos, macros, procesos, subprocesos, total, filtersSlot = null, politicas = [], politicasLoading = false }) {
  const [politicasOpen, setPoliticasOpen] = useState(false);
  const cards = [
    { title: 'Total general', value: resumen.totalDocumentos, subtitle: 'Información documentada activa', color: '#1d4ed8', Icon: DescriptionIcon },
    { title: 'Macroprocesos', value: MAPA_PROCESOS_VIGENTE.macroprocesos, subtitle: 'Mapa de procesos vigente', color: '#0369a1', Icon: AccountTreeIcon },
    { title: 'Procesos', value: MAPA_PROCESOS_VIGENTE.procesos, subtitle: 'Mapa de procesos vigente', color: '#be123c', Icon: AutoGraphIcon },
    { title: 'Subprocesos', value: MAPA_PROCESOS_VIGENTE.subprocesos, subtitle: 'Mapa de procesos vigente', color: '#a16207', Icon: DonutSmallIcon },
    { title: 'Políticas', value: politicasLoading ? '...' : politicas.length, subtitle: 'Ver políticas institucionales', color: '#15803d', Icon: GavelIcon, onClick: () => setPoliticasOpen(true) }
  ];
  return (
    <Stack spacing={2.4}>
      <Paper elevation={0} sx={{ p: { xs: 2.4, md: 3 }, borderRadius: '8px', color: '#ffffff', background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 72%, #dc143c 100%)', boxShadow: '0 20px 46px rgba(15,23,42,0.18)', position: 'relative', overflow: 'hidden' }}>
        <Stack direction="row" spacing={1.4} alignItems="center" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ width: 56, height: 56, borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AnalyticsIcon sx={{ fontSize: 30 }} />
          </Box>
          <Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.76)', fontWeight: 950, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Estadistica documental</Typography>
            <Typography sx={{ color: '#ffffff', fontWeight: 950, fontSize: { xs: 26, md: 36 }, lineHeight: 1.03 }}>Estadistica Documental</Typography>
          </Box>
        </Stack>
      </Paper>
      {filtersSlot}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(5, minmax(0, 1fr))' }, gap: 1.5 }}>
        {cards.map((card, index) => <InfographicStatCard key={card.title} index={index + 1} {...card} />)}
      </Box>
      <Dialog open={politicasOpen} onClose={() => setPoliticasOpen(false)} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: '12px', maxHeight: '85vh' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, borderBottom: '1px solid #f1f5f9' }}>
          <Stack direction="row" alignItems="center" spacing={1.4}>
            <Box sx={{ width: 38, height: 38, borderRadius: '8px', bgcolor: '#f0fdf4', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #bbf7d0' }}>
              <GavelIcon sx={{ fontSize: 20 }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 950, fontSize: 18, color: '#0f172a', lineHeight: 1.2 }}>Políticas Institucionales</Typography>
              <Typography sx={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{politicasLoading ? 'Cargando...' : `${politicas.length} políticas registradas`}</Typography>
            </Box>
          </Stack>
          <IconButton onClick={() => setPoliticasOpen(false)} size="small" sx={{ color: '#94a3b8', '&:hover': { bgcolor: '#f1f5f9', color: '#475569' } }}>
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {politicasLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={28} sx={{ color: '#15803d' }} /></Box>
          ) : politicas.length === 0 ? (
            <Alert severity="info">No hay políticas institucionales registradas.</Alert>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: 0.9, pb: 1 }}>
              {politicas.map((doc, idx) => {
                const tone = CARD_TONES[idx % CARD_TONES.length];
                return (
                  <Box key={doc.id} sx={{ borderRadius: '10px', bgcolor: '#ffffff', border: `1px solid ${tone.border}`, overflow: 'hidden', display: 'grid', gridTemplateColumns: '46px minmax(0, 1fr) 52px', alignItems: 'center', minHeight: 52 }}>
                    <Box sx={{ height: '100%', minHeight: 52, bgcolor: tone.fg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 950, fontSize: 13 }}>
                      {String(idx + 1).padStart(2, '0')}
                    </Box>
                    <Box sx={{ px: 1.3, py: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 12, color: '#0f172a', lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{doc.titulo}</Typography>
                      <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: '#94a3b8', mt: 0.2 }}>{doc.codigo || ''}{doc.version ? ` · v${doc.version}` : ''}</Typography>
                    </Box>
                    {doc.link_acceso ? (
                      <Box component="a" href={doc.link_acceso} target="_blank" rel="noopener noreferrer"
                        sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.2, color: tone.fg, fontWeight: 700, fontSize: 10, textDecoration: 'none', height: '100%', bgcolor: tone.soft, '&:hover': { bgcolor: tone.border } }}>
                        <OpenInNewIcon sx={{ fontSize: 13 }} />
                        Ver
                      </Box>
                    ) : <Box sx={{ bgcolor: tone.soft, height: '100%', minHeight: 52 }} />}
                  </Box>
                );
              })}
            </Box>
          )}
        </DialogContent>
      </Dialog>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1.05fr 0.95fr' }, gap: 2 }}>
        <DocumentTypeList title="Tipos documentales destacados" rows={tipos} total={total} />
        <CapsuleRanking title="Macroprocesos con mayor carga" rows={macros} nameKey="macro_proceso" color="#1d4ed8" />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
        <CapsuleRanking title="Procesos principales" rows={procesos} nameKey="proceso" color="#be123c" />
        <CapsuleRanking title="Subprocesos principales" rows={subprocesos} nameKey="subproceso" color="#a16207" />
      </Box>
    </Stack>
  );
}

export function EstadisticaDocumentalPanel({ embedded = false }) {
  const { enqueueSnackbar } = useSnackbar();
  const [filters, setFilters] = useState({
    macro_proceso_id: [],
    proceso: [],
    subproceso: [],
    tipo_documentacion_id: [],
    periodo: []
  });
  const [macroProcesos, setMacroProcesos] = useState([]);
  const [tiposDocumentacion, setTiposDocumentacion] = useState([]);
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [politicas, setPoliticas] = useState([]);
  const [politicasLoading, setPoliticasLoading] = useState(true);

  const loadCatalogs = useCallback(async () => {
    const [macroRes, tipoRes] = await Promise.all([
      catalogoService.getMacroProcesos(),
      catalogoService.getTiposDocumentacion()
    ]);
    setMacroProcesos(macroRes?.data?.macroProcesos || []);
    setTiposDocumentacion(tipoRes?.data?.tipos || []);
  }, []);

  const loadDashboard = useCallback(async (currentFilters) => {
    setLoading(true);
    try {
      const response = await documentoService.getEstadisticaDocumental({
        macro_proceso_id: serializeFilterArray(currentFilters.macro_proceso_id),
        proceso: serializeFilterArray(currentFilters.proceso),
        subproceso: serializeFilterArray(currentFilters.subproceso),
        tipo_documentacion_id: serializeFilterArray(currentFilters.tipo_documentacion_id),
        periodo: serializeFilterArray(currentFilters.periodo)
      });
      setData(response?.data || emptyData);
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.message || 'No se pudo cargar la estadistica documental', { variant: 'error' });
      setData(emptyData);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [enqueueSnackbar]);

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    const init = { macro_proceso_id: [], proceso: [], subproceso: [], tipo_documentacion_id: [], periodo: [] };
    Promise.all([loadCatalogs(), loadDashboard(init)]).catch(() => setInitialLoading(false));
  }, [loadCatalogs, loadDashboard]);

  useEffect(() => {
    if (initialLoading) return undefined;
    const timer = setTimeout(() => loadDashboard(filtersRef.current), 500);
    return () => clearTimeout(timer);
  }, [filters, initialLoading, loadDashboard]);

  useEffect(() => {
    let cancelled = false;
    documentoService.getDocumentos({ document_scope: 'politicas' }, 1, 200)
      .then((res) => {
        if (!cancelled) {
          const raw = res?.data?.documentos || [];
          const seen = new Set();
          const unique = raw.filter((doc) => {
            const key = String(doc.titulo || '').trim().toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setPoliticas(unique);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPoliticasLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleClear = () => {
    const clean = { macro_proceso_id: [], proceso: [], subproceso: [], tipo_documentacion_id: [], periodo: [] };
    setFilters(clean);
    loadDashboard(clean);
  };

  const macroOptions = useMemo(() => macroProcesos.map((m) => ({ value: m.id, label: m.nombre })), [macroProcesos]);
  const tipoOptions = useMemo(() => tiposDocumentacion.map((t) => ({ value: t.id, label: t.nombre })), [tiposDocumentacion]);
  const procesoOptions = useMemo(() => (data?.filtrosDisponibles?.procesos || []).map((p) => ({ value: p.label, label: p.label })), [data?.filtrosDisponibles?.procesos]);
  const subprocesoOptions = useMemo(() => (data?.filtrosDisponibles?.subprocesos || []).map((s) => ({ value: s.label, label: s.label })), [data?.filtrosDisponibles?.subprocesos]);
  const periodoOptions = useMemo(() => (data?.periodosDisponibles || []).map((p) => ({ value: p.value, label: `${p.label} (${p.cantidad})` })), [data?.periodosDisponibles]);

  const resumen = data?.resumen || emptyData.resumen;
  const tipos = data?.distribucion?.porTipoDocumento || [];
  const macros = data?.distribucion?.porMacroProceso || [];
  const procesos = data?.distribucion?.porProceso || [];
  const subprocesos = data?.distribucion?.porSubproceso || [];
  const total = Number(resumen.totalDocumentos || 0);

  const filtersSlot = (
    <Paper elevation={0} sx={{ p: { xs: 2, md: 2.4 }, borderRadius: '8px', border: '1px solid #dbe6f5', bgcolor: '#ffffff', boxShadow: '0 8px 24px rgba(15,23,42,0.06)' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.8 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <FilterAltIcon sx={{ color: '#0369a1', fontSize: 20 }} />
          <Typography sx={{ color: '#0f172a', fontWeight: 900, fontSize: 15 }}>Filtros</Typography>
        </Stack>
        <Button variant="outlined" size="small" startIcon={<ClearIcon sx={{ fontSize: 13 }} />} onClick={handleClear} disabled={loading}
          sx={{ height: 30, px: 1.4, borderRadius: '7px', fontWeight: 800, textTransform: 'none', fontSize: 12, color: '#64748b', borderColor: '#e2e8f0', bgcolor: '#f8fafc', '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f1f5f9' } }}>
          Limpiar
        </Button>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)', xl: 'repeat(5, 1fr)' }, gap: 1.4 }}>
        <DocFilterPanel label="Macroproceso" options={macroOptions} value={filters.macro_proceso_id} onChange={(v) => setFilters((p) => ({ ...p, macro_proceso_id: v }))} disabled={loading} placeholder="Buscar macroproceso..." />
        <DocFilterPanel label="Proceso" options={procesoOptions} value={filters.proceso} onChange={(v) => setFilters((p) => ({ ...p, proceso: v }))} disabled={loading} placeholder="Buscar proceso..." />
        <DocFilterPanel label="Subproceso" options={subprocesoOptions} value={filters.subproceso} onChange={(v) => setFilters((p) => ({ ...p, subproceso: v }))} disabled={loading} placeholder="Buscar subproceso..." />
        <DocFilterPanel label="Tipo documento" options={tipoOptions} value={filters.tipo_documentacion_id} onChange={(v) => setFilters((p) => ({ ...p, tipo_documentacion_id: v }))} disabled={loading} placeholder="Buscar tipo..." />
        <DocFilterPanel label="Periodo academico" options={periodoOptions} value={filters.periodo} onChange={(v) => setFilters((p) => ({ ...p, periodo: v }))} disabled={loading} placeholder="Buscar periodo..." />
      </Box>
    </Paper>
  );

  if (initialLoading && loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 10, gap: 2 }}>
        <CircularProgress size={40} />
        <Typography sx={{ color: '#64748b' }}>Cargando estadísticas...</Typography>
      </Box>
    );
  }

  const content = (
    <ImpactInfographic
      resumen={resumen}
      tipos={tipos}
      macros={macros}
      procesos={procesos}
      subprocesos={subprocesos}
      total={total}
      filtersSlot={filtersSlot}
      politicas={politicas}
      politicasLoading={politicasLoading}
    />
  );

  if (embedded) return <Box sx={{ pb: 2 }}>{content}</Box>;

  return (
    <Fade in={true}>
      <Box sx={{ pb: 2 }}>{content}</Box>
    </Fade>
  );
}

export default EstadisticaDocumentalPanel;
