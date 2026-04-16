import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Box, Paper, Typography, Grid, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, CircularProgress, Chip, IconButton, Tooltip, Fade, Slide, Stack, Dialog, DialogTitle, DialogContent, DialogActions, InputAdornment, Switch } from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon, VisibilityOutlined as VisibilityOutlinedIcon, FileDownloadOutlined as FileDownloadOutlinedIcon, Description as DescriptionIcon, Article as ArticleIcon, AssignmentTurnedIn as AssignmentIcon, ListAlt as ListIcon, Policy as PolicyIcon, AccountTree as AccountTreeIcon, Upload as UploadIcon, GetApp as DownloadTemplateIcon, Favorite as FavoriteIcon, FavoriteBorder as FavoriteBorderIcon } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import documentoService from '../services/documentoService';
import catalogoService from '../services/catalogoService';
import favoritoService from '../services/favoritoService';
import api from '../services/api';

const getApiErrorMessage = (error, fallback) => (
  error?.response?.data?.error
  || error?.response?.data?.message
  || error?.message
  || fallback
);

// Extrae ID y metadatos de enlaces de Google Drive/Docs.
// Conserva 'resourcekey' porque algunos enlaces compartidos dejan de funcionar sin ese parametro.
const extractGoogleDriveMeta = (rawUrl) => {
  if (!rawUrl) return null;

  const url = String(rawUrl).trim();
  let parsed = null;

  try {
    parsed = new URL(url);
  } catch {
    parsed = null;
  }
  
  const patterns = [
    /\/file\/d\/([^/?#]+)/,
    /\/document\/d\/([^/?#]+)/,
    /\/spreadsheets\/d\/([^/?#]+)/,
    /\/presentation\/d\/([^/?#]+)/,
    /[?&]id=([^&#]+)/,
    /\/d\/([^/?#]+)(?:\/|$)/,
  ];
  
  let fileId = null;
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      fileId = match[1];
      break;
    }
  }

  if (!fileId) return null;

  const host = parsed?.hostname || '';
  const pathname = parsed?.pathname || '';
  const resourceKey = parsed?.searchParams?.get('resourcekey') || '';
  const gid = parsed?.searchParams?.get('gid') || '';

  let kind = 'drive-file';
  if (host.includes('docs.google.com')) {
    if (pathname.includes('/document/')) kind = 'google-doc';
    else if (pathname.includes('/spreadsheets/')) kind = 'google-sheet';
    else if (pathname.includes('/presentation/')) kind = 'google-slide';
  }
  
  return { fileId, resourceKey, gid, kind };
};

const isDocumentCode = (value = '') => /^[A-Z0-9]{2,6}(?:-[A-Z0-9]{2,6}){1,6}$/.test(String(value).trim().toUpperCase());

const isDocTypeLabel = (value = '') => {
  const text = String(value).toLowerCase();
  return [
    'manual',
    'procedimiento',
    'instructivo',
    'formato',
    'política',
    'politica',
    'programa',
    'plan',
    'guía',
    'guia',
    'caracterización',
    'caracterizacion'
  ].some((keyword) => text.includes(keyword));
};

const normalizeDocFields = (doc) => {
  let tipo = doc?.tipoDocumentacion?.nombre || '';
  let codigo = doc?.codigo || '';
  let titulo = doc?.titulo || '';

  if (isDocumentCode(tipo) && !isDocumentCode(codigo) && isDocTypeLabel(titulo)) {
    const originalTipo = tipo;
    tipo = titulo;
    titulo = codigo;
    codigo = originalTipo;
  }

  return { tipo, codigo, titulo };
};

const getPreviewUrl = (url) => {
  const meta = extractGoogleDriveMeta(url);
  if (!meta) {
    const safeUrl = String(url || '');
    if (safeUrl.includes('docs.google.com')) {
      return safeUrl
        .replace('/edit', '/preview')
        .replace('/view', '/preview')
        .replace('/copy', '/preview');
    }
    return url;
  }

  const { fileId, resourceKey, gid, kind } = meta;
  const rkQuery = resourceKey ? `?resourcekey=${encodeURIComponent(resourceKey)}` : '';

  if (kind === 'google-doc') return `https://docs.google.com/document/d/${fileId}/preview${rkQuery}${rkQuery ? '&' : '?'}rm=minimal`;
  if (kind === 'google-sheet') {
    const params = new URLSearchParams();
    params.set('rm', 'minimal');
    if (gid) params.set('gid', gid);
    if (resourceKey) params.set('resourcekey', resourceKey);
    return `https://docs.google.com/spreadsheets/d/${fileId}/preview?${params.toString()}`;
  }
  if (kind === 'google-slide') return `https://docs.google.com/presentation/d/${fileId}/preview${rkQuery}`;

  return `https://drive.google.com/file/d/${fileId}/preview${rkQuery}`;
};

const getDownloadUrl = (url) => {
  const meta = extractGoogleDriveMeta(url);
  if (!meta) return url;

  const { fileId, resourceKey, kind } = meta;
  const driveExtra = resourceKey ? `&resourcekey=${encodeURIComponent(resourceKey)}` : '';

  if (kind === 'google-doc') {
    const extra = resourceKey ? `&resourcekey=${encodeURIComponent(resourceKey)}` : '';
    return `https://docs.google.com/document/d/${fileId}/export?format=docx${extra}`;
  }

  if (kind === 'google-sheet') {
    const extra = resourceKey ? `&resourcekey=${encodeURIComponent(resourceKey)}` : '';
    return `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx${extra}`;
  }

  if (kind === 'google-slide') {
    const extra = resourceKey ? `?resourcekey=${encodeURIComponent(resourceKey)}` : '';
    return `https://docs.google.com/presentation/d/${fileId}/export/pdf${extra}`;
  }

  return `https://drive.google.com/uc?export=download&id=${fileId}${driveExtra}`;
};

const toAbsoluteDocumentUrl = (url) => {
  if (!url) return '';
  const value = String(url).trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/uploads/')) {
    const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    const backendBase = apiBase.replace(/\/api\/?$/, '');
    return `${backendBase}${value}`;
  }
  return value;
};

const sanitizeFileName = (value = '') =>
  Array.from(String(value))
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code < 32 || /[<>:"/\\|?*]/.test(char)) return '_';
      return char;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

const getExtensionFromUrl = (url) => {
  if (!url) return '';

  const meta = extractGoogleDriveMeta(url);
  if (meta?.kind === 'google-doc') return 'docx';
  if (meta?.kind === 'google-sheet') return 'xlsx';
  if (meta?.kind === 'google-slide') return 'pptx';

  try {
    const parsed = new URL(url, window.location.origin);
    const path = parsed.pathname || '';
    const match = path.match(/\.([a-zA-Z0-9]{2,8})$/);
    return match?.[1]?.toLowerCase() || '';
  } catch {
    const clean = String(url).split('?')[0];
    const match = clean.match(/\.([a-zA-Z0-9]{2,8})$/);
    return match?.[1]?.toLowerCase() || '';
  }
};

const buildDownloadFileName = (doc, normalized) => {
  const base = sanitizeFileName(`${normalized?.codigo || 'documento'}_${normalized?.titulo || 'archivo'}`);
  const ext = getExtensionFromUrl(doc?.link_acceso);
  return ext ? `${base}.${ext}` : base;
};

const formatDate = (value) => {
  if (!value) return '-';
  const str = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('es-CO');
};

const emptyFilterOptions = {
  macroProcesos: null,
  procesos: null,
  subprocesos: null,
  tipos: null
};

const byName = (a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');

const mergeSelectedOptions = (available = [], base = [], selectedIds = []) => {
  const map = new Map();
  (available || []).forEach((item) => {
    if (item?.id) map.set(String(item.id), item);
  });
  (base || []).forEach((item) => {
    if (item?.id && selectedIds.some((id) => String(id) === String(item.id))) {
      map.set(String(item.id), item);
    }
  });
  return Array.from(map.values()).sort(byName);
};

const withoutFilterKey = (filters = {}, keyToRemove) =>
  Object.fromEntries(
    Object.entries(filters).filter(([, value]) => String(value || '').trim() !== '').filter(([key]) => key !== keyToRemove)
  );

function DocFilterPanel({ label, options, value, onChange, disabled, placeholder }) {
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
      minWidth: 240,
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setVisibleOptions(options);
      return;
    }
    setVisibleOptions((prev) => {
      const map = new Map();
      [...prev, ...options].forEach((item) => {
        if (item?.id) map.set(String(item.id), item);
      });
      return Array.from(map.values());
    });
  }, [open, options]);

  // Calcular posición y cerrar en scroll/resize
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

  // Cerrar al hacer click fuera
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
  const filtered = effectiveOptions.filter((o) => o.nombre.toLowerCase().includes(search.toLowerCase()));
  const selectedIds = value.map((id) => String(id));
  const allSelected = selectedIds.length === 0;
  const isSel = (id) => selectedIds.includes(String(id));
  const toggle = (id) => {
    const key = String(id);
    onChange(isSel(key) ? selectedIds.filter((valueId) => valueId !== key) : [...selectedIds, key]);
  };
  const toggleAll = () => onChange(allSelected ? effectiveOptions.map((o) => String(o.id)) : []);
  const displayText = selectedIds.length === 0 ? 'TODOS' : `${selectedIds.length} SELECCIONADO${selectedIds.length > 1 ? 'S' : ''}`;
  const C = '#2563eb';

  const dropdownPortal = open ? ReactDOM.createPortal(
    <div
      ref={dropdownRef}
      style={{ ...portalStyle, background: '#fff', borderRadius: 10, boxShadow: '0 12px 36px rgba(0,0,0,0.22)', border: '1px solid #e2e8f0', overflow: 'hidden' }}
    >
      <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', borderRadius: 6, padding: '4px 8px', border: '1px solid #e2e8f0' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={placeholder || 'Buscar...'} style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, flex: 1, color: '#334155', minWidth: 0 }} />
        </div>
      </div>
      <div onClick={toggleAll} style={{ padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9', background: 'transparent' }}
        onMouseEnter={e => e.currentTarget.style.background='#eff6ff'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
        <div style={{ width: 14, height: 14, flexShrink: 0, borderRadius: 3, border: `2px solid ${allSelected ? C : '#d1d5db'}`, background: allSelected ? C : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {allSelected && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: C }}>SELECCIONAR TODOS ({effectiveOptions.length})</span>
      </div>
      <div
        onWheel={(event) => event.stopPropagation()}
        style={{ maxHeight: 220, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'thin' }}
      >
        {filtered.length === 0
          ? <div style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>Sin resultados</div>
          : filtered.map((opt) => (
            <div key={opt.id} onClick={() => toggle(opt.id)}
              style={{ padding: '5px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background='#eff6ff'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              <div style={{ width: 14, height: 14, flexShrink: 0, borderRadius: 3, border: `2px solid ${isSel(opt.id) ? C : '#d1d5db'}`, background: isSel(opt.id) ? C : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isSel(opt.id) && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <span style={{ fontSize: 12, color: '#334155', textTransform: 'uppercase' }}>{opt.nombre}</span>
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
// ── fin DocFilterPanel ─────────────────────────────────────────────────────────

function AseguramientoCalidad() {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search || ''), [location.search]);
  const forceReadOnly = useMemo(
    () => searchParams.get('readonly') === '1' || searchParams.get('mode') === 'consulta',
    [searchParams]
  );
  const normalizedRole = useMemo(
    () =>
      String(user?.role || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, ''),
    [user?.role]
  );
  const canManageDocumental = useMemo(
    () => ['administrador', 'gestion_por_procesos', 'gestion_procesos'].includes(normalizedRole) && !forceReadOnly,
    [normalizedRole, forceReadOnly]
  );
  const [filters, setFilters] = useState({ macro_proceso_id: '', proceso_id: '', subproceso_id: '', tipo_documentacion_id: '', titulo: '', estado: '', include_inactive: '', estado_scope: '' });
  const [selMacros, setSelMacros] = useState([]);
  const [selProcesos, setSelProcesos] = useState([]);
  const [selSubprocesos, setSelSubprocesos] = useState([]);
  const [selTipos, setSelTipos] = useState([]);
  const [macroProcesos, setMacroProcesos] = useState([]);
  const [procesos, setProcesos] = useState([]);
  const [subprocesos, setSubprocesos] = useState([]);
  const [tiposDocumentacion, setTiposDocumentacion] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalDocumentos, setTotalDocumentos] = useState(0);
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [openPreviewDialog, setOpenPreviewDialog] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewDownloadUrl, setPreviewDownloadUrl] = useState('');
  const [previewDownloadName, setPreviewDownloadName] = useState('');
  const [autoSearching, setAutoSearching] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [syncingSheet, setSyncingSheet] = useState(false);
  const [filterOptions, setFilterOptions] = useState(emptyFilterOptions);

  const syncCatalogosFromPayload = useCallback((data = {}) => {
    setMacroProcesos(data.macroProcesos || []);
    setProcesos(data.procesos || []);
    setSubprocesos(data.subprocesos || []);
    setTiposDocumentacion(data.tipos || []);
  }, []);

  const loadCatalogosDirecto = useCallback(async (opts = {}) => {
    const extra = opts.include_inactive ? { include_inactive: opts.include_inactive, estado_scope: opts.estado_scope || 'inactive' } : {};
    const [macroRes, procRes, subRes, tipoRes] = await Promise.all([
      catalogoService.getMacroProcesos(extra),
      catalogoService.getProcesos(null, extra),
      catalogoService.getSubProcesos(null, extra),
      catalogoService.getTiposDocumentacion(extra)
    ]);
    syncCatalogosFromPayload({
      macroProcesos: macroRes?.data?.macroProcesos || [],
      procesos:      procRes?.data?.procesos       || [],
      subprocesos:   subRes?.data?.subprocesos     || [],
      tipos:         tipoRes?.data?.tipos          || []
    });
  }, [syncCatalogosFromPayload]);

  const loadCatalogos = useCallback(async (activeFilters = {}) => {
    const hasUserFilter = Object.entries(activeFilters).some(
      ([key, value]) => !['include_inactive', 'estado_scope'].includes(key) && String(value || '').trim() !== ''
    );
    if (!hasUserFilter) {
      setFilterOptions(emptyFilterOptions);
      await loadCatalogosDirecto(activeFilters);
      return;
    }

    try {
      const [macroRes, procesoRes, subprocesoRes, tipoRes] = await Promise.all([
        catalogoService.getFilterOptions(withoutFilterKey(activeFilters, 'macro_proceso_id')),
        catalogoService.getFilterOptions(withoutFilterKey(activeFilters, 'proceso_id')),
        catalogoService.getFilterOptions(withoutFilterKey(activeFilters, 'subproceso_id')),
        catalogoService.getFilterOptions(withoutFilterKey(activeFilters, 'tipo_documentacion_id'))
      ]);

      setFilterOptions({
        macroProcesos: macroRes?.data?.macroProcesos || [],
        procesos: procesoRes?.data?.procesos || [],
        subprocesos: subprocesoRes?.data?.subprocesos || [],
        tipos: tipoRes?.data?.tipos || []
      });
      return;
    } catch (_e) {}

    setFilterOptions(emptyFilterOptions);
  }, [loadCatalogosDirecto]);

  useEffect(() => {
    const extra = filters.include_inactive ? { include_inactive: filters.include_inactive, estado_scope: filters.estado_scope || 'inactive' } : {};
    setFilterOptions(emptyFilterOptions);
    loadCatalogosDirecto(extra).catch(() => {
      enqueueSnackbar('No fue posible cargar los filtros', { variant: 'warning' });
    });
  }, [filters.include_inactive, filters.estado_scope, loadCatalogosDirecto, enqueueSnackbar]);

  useEffect(() => {
    const params = {};
    if (selMacros.length) params.macro_proceso_id = selMacros.join(',');
    if (selProcesos.length) params.proceso_id = selProcesos.join(',');
    if (selSubprocesos.length) params.subproceso_id = selSubprocesos.join(',');
    if (selTipos.length) params.tipo_documentacion_id = selTipos.join(',');
    if (filters.titulo) params.titulo = filters.titulo;
    if (filters.include_inactive) {
      params.include_inactive = filters.include_inactive;
      params.estado_scope = filters.estado_scope || 'inactive';
    }

    const hasUserFilter = Object.keys(params).some((key) => !['include_inactive', 'estado_scope'].includes(key));
    if (!hasUserFilter) {
      setFilterOptions(emptyFilterOptions);
      return;
    }

    loadCatalogos(params).catch(() => setFilterOptions(emptyFilterOptions));
  }, [loadCatalogos, selMacros, selProcesos, selSubprocesos, selTipos, filters.titulo, filters.include_inactive, filters.estado_scope]);

  useEffect(() => {
    if (!user?.id) return;
    setLoadingFavorites(true);
    favoritoService
      .getFavoriteIds()
      .then((response) => {
        const ids = response?.data?.ids || [];
        setFavoriteIds(new Set(ids.map((id) => String(id))));
      })
      .catch(() => {})
      .finally(() => setLoadingFavorites(false));
  }, [user?.id]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const quickTitulo = params.get('titulo');
    if (quickTitulo) {
      const nextFilters = { macro_proceso_id: '', proceso_id: '', subproceso_id: '', tipo_documentacion_id: '', titulo: quickTitulo, estado: '', include_inactive: '', estado_scope: '' };
      setSelMacros([]); setSelProcesos([]); setSelSubprocesos([]); setSelTipos([]);
      setFilters(nextFilters);
      setLoading(true);
      documentoService.getDocumentos(nextFilters, 1, 10)
        .then((response) => {
          if (response.success) {
            setDocumentos(response.data.documentos);
            setTotalDocumentos(response.data.pagination.total);
          }
        })
        .catch((error) => enqueueSnackbar(getApiErrorMessage(error, 'Error al buscar documentos'), { variant: 'error' }))
        .finally(() => setLoading(false));
    }
  }, [location.search, enqueueSnackbar]);


  const handleSearch = async () => {
    setLoading(true);
    setPage(0);
    try {
      const response = await documentoService.getDocumentos(filters, 1, rowsPerPage);
      if (response.success) {
        setDocumentos(response.data.documentos);
        setTotalDocumentos(response.data.pagination.total);
        if (response.data.documentos.length === 0) {
          enqueueSnackbar(response.message || 'No se encontraron documentos', { variant: 'info' });
        } else {
          enqueueSnackbar(`✓ ${response.data.pagination.total} documentos encontrados`, { variant: 'success' });
        }
      }
    } catch (error) {
      enqueueSnackbar(getApiErrorMessage(error, 'Error al buscar documentos'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setFilters({ macro_proceso_id: '', proceso_id: '', subproceso_id: '', tipo_documentacion_id: '', titulo: '', estado: '', include_inactive: '', estado_scope: '' });
    setSelMacros([]); setSelProcesos([]); setSelSubprocesos([]); setSelTipos([]);
    setDocumentos([]);
    setTotalDocumentos(0);
    setPage(0);
  };

  // Sync multi-select arrays → filters (comma-separated IDs for backend)
  useEffect(() => { setFilters(prev => ({ ...prev, macro_proceso_id: selMacros.join(',') })); }, [selMacros]);
  useEffect(() => { setFilters(prev => ({ ...prev, proceso_id: selProcesos.join(',') })); }, [selProcesos]);
  useEffect(() => { setFilters(prev => ({ ...prev, subproceso_id: selSubprocesos.join(',') })); }, [selSubprocesos]);
  useEffect(() => { setFilters(prev => ({ ...prev, tipo_documentacion_id: selTipos.join(',') })); }, [selTipos]);

  useEffect(() => {
    const hasActiveFilters = Object.values(filters).some((value) => String(value).trim() !== '');
    if (!hasActiveFilters) return;

    setAutoSearching(true);
    const debounceId = setTimeout(async () => {
      setLoading(true);
      setPage(0);
      try {
        const response = await documentoService.getDocumentos(filters, 1, rowsPerPage);
        if (response.success) {
          setDocumentos(response.data.documentos);
          setTotalDocumentos(response.data.pagination.total);
        }
      } catch (error) {
        enqueueSnackbar(getApiErrorMessage(error, 'Error al aplicar filtros'), { variant: 'error' });
      } finally {
        setLoading(false);
        setAutoSearching(false);
      }
    }, 450);

    return () => clearTimeout(debounceId);
  }, [filters, rowsPerPage, enqueueSnackbar]);

  const handleChangePage = async (event, newPage) => {
    setPage(newPage);
    setLoading(true);
    try {
      const response = await documentoService.getDocumentos(filters, newPage + 1, rowsPerPage);
      if (response.success) {
        setDocumentos(response.data.documentos);
      }
    } catch (error) {
      enqueueSnackbar(getApiErrorMessage(error, 'Error al cargar documentos'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };


  const toggleFavorite = async (docId) => {
    if (!docId) return;
    const key = String(docId);
    const exists = favoriteIds.has(key);

    try {
      if (exists) {
        await favoritoService.removeFavorite(docId);
      } else {
        await favoritoService.addFavorite(docId);
      }

      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (exists) next.delete(key);
        else next.add(key);
        return next;
      });

      enqueueSnackbar(exists ? 'Eliminado de favoritos' : 'Agregado a favoritos', { variant: 'success' });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('favorites:updated'));
      }
    } catch (error) {
      const backendMessage = error?.response?.data?.message;
      const backendDetail = error?.response?.data?.detail;
      const message = backendDetail ? `${backendMessage || 'No se pudo actualizar favoritos'}: ${backendDetail}` : (backendMessage || 'No se pudo actualizar favoritos');
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'vigente': return 'success';
      case 'obsoleto': return 'error';
      case 'en_revision': return 'warning';
      default: return 'default';
    }
  };

  const getEstadoLabel = (estado) => {
    if (String(estado || '').toLowerCase() === 'vigente') return 'ACTIVOS';
    return String(estado || '').toUpperCase();
  };

  const getTipoIcon = (tipo) => {
    const nombre = tipo?.toLowerCase() || '';
    if (nombre.includes('manual')) return <DescriptionIcon sx={{ fontSize: 20 }} />;
    if (nombre.includes('procedimiento')) return <ListIcon sx={{ fontSize: 20 }} />;
    if (nombre.includes('instructivo')) return <ArticleIcon sx={{ fontSize: 20 }} />;
    if (nombre.includes('formato')) return <AssignmentIcon sx={{ fontSize: 20 }} />;
    if (nombre.includes('política')) return <PolicyIcon sx={{ fontSize: 20 }} />;
    if (nombre.includes('caracterización')) return <AccountTreeIcon sx={{ fontSize: 20 }} />;
    return <DescriptionIcon sx={{ fontSize: 20 }} />;
  };

  const getTipoColor = (tipo) => {
    const nombre = tipo?.toLowerCase() || '';
    if (nombre.includes('manual')) return { bg: '#dbeafe', color: '#1e40af' };
    if (nombre.includes('procedimiento')) return { bg: '#dcfce7', color: '#15803d' };
    if (nombre.includes('instructivo')) return { bg: '#fef3c7', color: '#a16207' };
    if (nombre.includes('formato')) return { bg: '#f3e8ff', color: '#7c3aed' };
    if (nombre.includes('política')) return { bg: '#ffe4e6', color: '#be123c' };
    return { bg: '#f1f5f9', color: '#475569' };
  };

  const handleFileSelect = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleImport = async () => {
    if (!selectedFile) {
      enqueueSnackbar('Selecciona un archivo Excel', { variant: 'warning' });
      return;
    }

    setImporting(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await api.post('/import/excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        enqueueSnackbar(response.data.message, { variant: 'success' });
        setSelectedFile(null);
        await loadCatalogos();
        handleSearch();
      }
    } catch (error) {
      const backendMessage = error?.response?.data?.message;
      enqueueSnackbar(backendMessage || 'Error al importar archivo', { variant: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/import/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      triggerDownload(url, 'plantilla_documentos_sgc.xlsx');
    } catch (error) {
      enqueueSnackbar('Error al descargar plantilla', { variant: 'error' });
    }
  };

  const handleSyncFromSheets = async (mode) => {
    setSyncingSheet(true);
    try {
      const response = await api.post('/import/sheets', { mode }, { timeout: 300000 });
      await loadCatalogos();
      if (response.data?.success) {
        enqueueSnackbar(response.data.message || 'Base del servidor actualizada', { variant: 'success' });
        handleSearch();
      }
    } catch (error) {
      const backendMessage = error?.response?.data?.message;
      const backendDetail = error?.response?.data?.error;
      const message = backendDetail ? `${backendMessage || 'Error al cargar Sheets al servidor'}: ${backendDetail}` : (backendMessage || 'Error al cargar Sheets al servidor');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSyncingSheet(false);
    }
  };

  const openDocumentPreview = (doc, normalized) => {
    if (!doc?.link_acceso) return;
    const resolved = toAbsoluteDocumentUrl(doc.link_acceso);
    setPreviewUrl(getPreviewUrl(resolved));
    setPreviewTitle(`${normalized?.codigo || ''} ${normalized?.titulo || ''}`.trim());
    setPreviewDownloadUrl(getDownloadUrl(resolved));
    setPreviewDownloadName(buildDownloadFileName(doc, normalized));
    setOpenPreviewDialog(true);
  };

  const closeDocumentPreview = () => {
    setOpenPreviewDialog(false);
    setPreviewUrl('');
    setPreviewTitle('');
    setPreviewDownloadUrl('');
    setPreviewDownloadName('');
  };

  const triggerDownload = (url, filename) => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    if (filename) link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeFiltersCount = Object.entries(filters)
    .filter(([key, value]) => key !== 'estado_scope' && value !== '')
    .length;
  const hasActiveFilters = activeFiltersCount > 0;
  const tiposDocumentacionDisplay = tiposDocumentacion.filter((td) => !isDocumentCode(td.nombre));

  const baseMacroOptions = macroProcesos;
  const baseProcesoOptions = procesos;
  const baseSubprocesoOptions = subprocesos;
  const baseTipoOptions = tiposDocumentacionDisplay;
  const resolveFacetOptions = (dynamicOptions, baseOptions, selectedIds, clean = (items) => items) => {
    if (!dynamicOptions) return baseOptions;
    const cleanedDynamic = clean(dynamicOptions);
    return mergeSelectedOptions(cleanedDynamic, baseOptions, selectedIds);
  };
  const macroOptions = resolveFacetOptions(filterOptions.macroProcesos, baseMacroOptions, selMacros);
  const procesoOptions = resolveFacetOptions(filterOptions.procesos, baseProcesoOptions, selProcesos);
  const subprocesoOptions = resolveFacetOptions(filterOptions.subprocesos, baseSubprocesoOptions, selSubprocesos);
  const tipoOptions = resolveFacetOptions(
    filterOptions.tipos,
    baseTipoOptions,
    selTipos,
    (items) => items.filter((td) => !isDocumentCode(td.nombre))
  );
  const isFiltering = loading || autoSearching;

  return (
    <Fade in={true} timeout={500}>
      <Box>
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            p: { xs: 2.5, md: 3 },
            borderRadius: 3.5,
            border: '1px solid #dbeafe',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(120deg, #0f1f3a 0%, #1d4ed8 45%, #be185d 100%)',
            boxShadow: '0 14px 34px rgba(15, 23, 42, 0.28)'
          }}
        >
          <Box sx={{ position: 'absolute', right: -60, top: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
          <Box sx={{ position: 'absolute', right: 40, bottom: -80, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ sm: 'center' }} sx={{ position: 'relative', zIndex: 1 }}>
            <Box sx={{ width: 62, height: 62, borderRadius: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.18)', color: 'white', border: '1px solid rgba(255,255,255,0.35)' }}>
              <SearchIcon sx={{ fontSize: 28 }} />
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.2 }}>
                Inicio de Consulta Documental
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                Accede al mapa de procesos y encuentra documentos institucionales de forma rápida y clara.
              </Typography>
            </Box>
            <Button
              variant="contained"
              onClick={handleSearch}
              startIcon={<SearchIcon />}
              sx={{
                bgcolor: 'white',
                color: '#0f1f3a',
                textTransform: 'none',
                fontWeight: 700,
                px: 3,
                py: 1.2,
                borderRadius: 2,
                boxShadow: '0 8px 18px rgba(15, 23, 42, 0.25)',
                '&:hover': { bgcolor: '#f8fafc' }
              }}
            >
              Consulta de documentos
            </Button>
          </Stack>
        </Paper>

        {/* IMPORTAR EXCEL (administrador y gestion por procesos) */}
        {canManageDocumental && (
          <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid #e2e8f0', borderRadius: 3 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <UploadIcon sx={{ color: '#1d4ed8' }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Cargar documentos a la base del servidor</Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  Excel y Google Sheets solo alimentan PostgreSQL. La consulta y los filtros trabajan siempre con la base alojada en el servidor.
                </Typography>
              </Box>
            </Stack>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <Button variant="outlined" fullWidth component="label" startIcon={<UploadIcon />} sx={{ borderRadius: 2, py: 1.5 }}>
                  {selectedFile ? selectedFile.name : 'Seleccionar plantilla Excel'}
                  <input type="file" hidden accept=".xlsx,.xls" onChange={handleFileSelect} />
                </Button>
              </Grid>
              <Grid item xs={12} md={3}>
                <Button variant="contained" fullWidth disabled={!selectedFile || importing} onClick={handleImport} sx={{ borderRadius: 2, py: 1.5 }}>
                  {importing ? 'Cargando al servidor...' : 'Cargar Excel al servidor'}
                </Button>
              </Grid>
              <Grid item xs={12} md={3}>
                <Button variant="outlined" fullWidth startIcon={<DownloadTemplateIcon />} onClick={handleDownloadTemplate} sx={{ borderRadius: 2, py: 1.5 }}>
                  Descargar Plantilla
                </Button>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" sx={{ display: 'block', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Fuente externa autorizada
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  Usa Sheets para traer datos al servidor. Despues de cargar, la pantalla deja de depender de Sheets y consulta la informacion guardada en PostgreSQL.
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Button
                  variant="contained"
                  fullWidth
                  disabled={syncingSheet}
                  onClick={() => handleSyncFromSheets('incremental')}
                  sx={{ borderRadius: 2, py: 1.4, textTransform: 'none', fontWeight: 700 }}
                >
                  {syncingSheet ? 'Cargando Sheets al servidor...' : 'Actualizar servidor desde Sheets'}
                </Button>
                <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: '#64748b' }}>
                  Agrega nuevos documentos y actualiza los existentes sin borrar la base.
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Button
                  variant="outlined"
                  color="warning"
                  fullWidth
                  disabled={syncingSheet}
                  onClick={() => handleSyncFromSheets('reemplazar')}
                  sx={{ borderRadius: 2, py: 1.4, textTransform: 'none', fontWeight: 700 }}
                >
                  Sincronizar todo desde Sheets
                </Button>
                <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: '#64748b' }}>
                  Revisa todas las filas de Sheets y conserva los registros existentes del servidor.
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        )}

        <Slide direction="down" in={true} timeout={600}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, sm: 2.5 },
              mb: 3,
              border: '1px solid rgba(59,130,246,0.25)',
              borderRadius: 3,
              bgcolor: 'white',
              position: 'relative',
              overflow: 'visible',
              boxShadow: '0 18px 40px rgba(59, 130, 246, 0.12)',
              transition: 'transform 220ms ease, box-shadow 220ms ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 22px 50px rgba(59, 130, 246, 0.16)'
              },
              ...(hasActiveFilters && {
                border: '1px solid rgba(59,130,246,0.55)',
                boxShadow: '0 22px 55px rgba(59, 130, 246, 0.28)'
              }),
              '&::after': {
                content: '""',
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                opacity: 0.18,
                backgroundImage: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, transparent 40%)',
                mixBlendMode: 'multiply'
              }
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background: `
                  radial-gradient(circle at 15% 0%, rgba(59,130,246,0.18), transparent 45%),
                  radial-gradient(circle at 90% 20%, rgba(219,39,119,0.12), transparent 45%)
                `,
                backgroundSize: '140% 140%',
                animation: 'bgDrift 12s ease-in-out infinite',
                '@keyframes bgDrift': {
                  '0%': { backgroundPosition: '0% 0%' },
                  '50%': { backgroundPosition: '100% 20%' },
                  '100%': { backgroundPosition: '0% 0%' }
                }
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: 'linear-gradient(90deg, #2563eb, #7c3aed, #db2777, #2563eb)',
                backgroundSize: '300% 100%',
                animation: 'titleGlow 6s ease-in-out infinite',
                '@keyframes titleGlow': {
                  '0%': { backgroundPosition: '0% 50%' },
                  '50%': { backgroundPosition: '100% 50%' },
                  '100%': { backgroundPosition: '0% 50%' }
                }
              }}
            />
            <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <Box sx={{ width: '100%', maxWidth: 860 }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mb: 1, display: 'block', textAlign: 'center' }}>
                  Buscar por título, código, palabras clave y consecutivos
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={filters.titulo}
                  onChange={(e) => setFilters({ ...filters, titulo: e.target.value })}
                  placeholder="Ej: plan estratégico, SES-EN, 2024, FR-001, seguridad vial..."
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#94a3b8' }} />
                      </InputAdornment>
                    )
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2.5,
                      bgcolor: 'white',
                      '& fieldset': { borderColor: '#bfdbfe' },
                      '&:hover fieldset': { borderColor: '#60a5fa' },
                      '&.Mui-focused fieldset': { borderColor: '#2563eb' },
                      '&.Mui-focused': { boxShadow: '0 0 0 5px rgba(59,130,246,0.2)' }
                    }
                  }}
                />
              </Box>
            </Box>

            <Box sx={{ overflowX: 'auto' }}>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr 1fr 1fr', minWidth: 820 }}>
                <DocFilterPanel
                  label="Macroproceso"
                  options={macroOptions}
                  value={selMacros}
                  onChange={setSelMacros}
                  placeholder="Buscar macroproceso..."
                />
                <DocFilterPanel
                  label="Proceso"
                  options={procesoOptions}
                  value={selProcesos}
                  onChange={setSelProcesos}
                  placeholder="Buscar proceso..."
                />
                <DocFilterPanel
                  label="Subproceso"
                  options={subprocesoOptions}
                  value={selSubprocesos}
                  onChange={setSelSubprocesos}
                  placeholder="Buscar subproceso..."
                />
                <DocFilterPanel
                  label="Tipo documento"
                  options={tipoOptions}
                  value={selTipos}
                  onChange={setSelTipos}
                  placeholder="Buscar tipo..."
                />
              </Box>
            </Box>

            {canManageDocumental && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mt: 1.5, px: 0.5 }}>
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 0.75,
                  borderRadius: 2, border: `1.5px solid ${filters.include_inactive === 'true' ? '#f59e0b' : '#e2e8f0'}`,
                  bgcolor: filters.include_inactive === 'true' ? '#fffbeb' : '#f8fafc',
                  transition: 'all 0.2s'
                }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: filters.include_inactive === 'true' ? '#f59e0b' : '#10b981', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: filters.include_inactive === 'true' ? '#92400e' : '#065f46', letterSpacing: '0.4px', textTransform: 'uppercase', userSelect: 'none' }}>
                    {filters.include_inactive === 'true' ? 'Solo no activos' : 'Solo documentos activos'}
                  </Typography>
                  <Switch
                    checked={filters.include_inactive === 'true'}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      include_inactive: e.target.checked ? 'true' : '',
                      estado_scope: e.target.checked ? 'inactive' : ''
                    }))}
                    size="small"
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: '#f59e0b' },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#f59e0b' }
                    }}
                  />
                </Box>
              </Box>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" sx={{ mt: 2.5 }}>
              <Button
                variant="contained"
                startIcon={<SearchIcon />}
                onClick={handleSearch}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                  py: 1.5,
                  fontSize: 15,
                  minWidth: { xs: '100%', sm: 260 },
                  background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 60%, #db2777 100%)',
                  boxShadow: '0 8px 22px rgba(59, 130, 246, 0.45)',
                  '&:hover': { background: 'linear-gradient(135deg, #1d4ed8 0%, #6d28d9 60%, #be185d 100%)', boxShadow: '0 12px 26px rgba(59, 130, 246, 0.6)' },
                  ...(isFiltering && {
                    background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 60%, #db2777 100%)',
                    animation: 'pulseGlow 1.4s ease-in-out infinite',
                    '@keyframes pulseGlow': {
                      '0%': { boxShadow: '0 0 0 rgba(59,130,246,0.0)' },
                      '50%': { boxShadow: '0 0 34px rgba(59,130,246,0.45)' },
                      '100%': { boxShadow: '0 0 0 rgba(59,130,246,0.0)' }
                    }
                  })
                }}
              >
                Buscar
              </Button>
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={handleClearFilters}
                sx={{
                  minWidth: { xs: '100%', sm: 200 },
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                  py: 1.5,
                  px: 2.5,
                  borderColor: '#bfdbfe',
                  color: '#1e3a8a',
                  bgcolor: '#eff6ff',
                  borderWidth: 2,
                  whiteSpace: 'nowrap',
                  '&:hover': { borderColor: '#60a5fa', bgcolor: '#dbeafe', borderWidth: 2 }
                }}
              >
                Limpiar filtros
              </Button>
            </Stack>
            </Box>
          </Paper>
        </Slide>

        <Slide direction="up" in={true} timeout={700}>
          <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
            {documentos.length === 0 && !loading ? (
              <Box sx={{ p: 10, textAlign: 'center' }}>
                <Box sx={{ width: 100, height: 100, borderRadius: '50%', bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', mb: 3 }}>
                  <SearchIcon sx={{ fontSize: 50, color: '#94a3b8' }} />
                </Box>
                <Typography variant="h5" sx={{ color: '#475569', fontWeight: 700, mb: 1 }}>
                  {Object.values(filters).some(f => f !== '') ? 'No se encontraron documentos' : 'Aplica filtros para comenzar'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#94a3b8', maxWidth: 400, mx: 'auto' }}>
                  {Object.values(filters).some(f => f !== '') ? 'Intenta ajustar los criterios de búsqueda o limpia los filtros' : 'Selecciona al menos un criterio y presiona el botón "Buscar"'}
                </Typography>
              </Box>
            ) : (
              <>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13, borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Código</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13, borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tipo</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13, borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Nombre Documento</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13, borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Autor</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13, borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Fecha Creacion</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13, borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Versión</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13, borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Estado</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13, borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={8} align="center" sx={{ py: 10 }}>
                            <CircularProgress size={50} thickness={4} />
                            <Typography variant="body1" sx={{ color: '#64748b', mt: 3, fontWeight: 600 }}>Cargando documentos...</Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        documentos.map((doc) => {
                          const isFavorite = favoriteIds.has(String(doc.id));
                          const normalized = normalizeDocFields(doc);
                          return (
                            <TableRow key={doc.id} hover sx={{ '&:hover': { bgcolor: '#f8fafc' }, transition: 'all 0.2s', cursor: 'pointer' }}>
                              <TableCell sx={{ fontWeight: 700, color: '#3b82f6', fontSize: 14, fontFamily: 'monospace' }}>{normalized.codigo}</TableCell>
                              <TableCell>
                                <Chip icon={getTipoIcon(normalized.tipo)} label={normalized.tipo || 'N/A'} size="small" sx={{ bgcolor: getTipoColor(normalized.tipo).bg, color: getTipoColor(normalized.tipo).color, fontWeight: 700, fontSize: 12, borderRadius: 2, px: 1 }} />
                              </TableCell>
                              <TableCell sx={{ color: '#1e293b', fontWeight: 600, fontSize: 14 }}>{normalized.titulo}</TableCell>
                              <TableCell sx={{ color: '#475569', fontSize: 13 }}>{doc.autor || '-'}</TableCell>
                              <TableCell sx={{ color: '#475569', fontSize: 13, whiteSpace: 'nowrap' }}>{formatDate(doc.fecha_creacion)}</TableCell>
                              <TableCell>
                                <Chip label={`v${doc.version || '1.0'}`} size="small" sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 700, fontFamily: 'monospace', borderRadius: 1.5 }} />
                              </TableCell>
                              <TableCell>
                                <Chip label={getEstadoLabel(doc.estado)} color={getEstadoColor(doc.estado)} size="small" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, borderRadius: 1.5 }} />
                              </TableCell>
                              <TableCell align="center">
                                <Stack direction="row" spacing={1} justifyContent="center">

                                  <Tooltip title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'} arrow>
                                    <span>
                                      <IconButton
                                        size="small"
                                        onClick={() => toggleFavorite(doc.id)}
                                        disabled={loadingFavorites}
                                        sx={{
                                          color: isFavorite ? '#ef4444' : '#94a3b8',
                                          bgcolor: isFavorite ? '#fee2e2' : '#f1f5f9',
                                          '&:hover': { bgcolor: isFavorite ? '#fecaca' : '#e2e8f0' },
                                          '&:disabled': { opacity: 0.5 }
                                        }}
                                      >
                                        {isFavorite ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  <Tooltip title="Ver documento" arrow>
                                    <span>
                                      <IconButton 
                                        size="small" 
                                        sx={{ 
                                          color: '#2563eb', 
                                          bgcolor: '#eff6ff', 
                                          '&:hover': { bgcolor: '#dbeafe' },
                                          '&:disabled': { opacity: 0.3 }
                                        }} 
                                        disabled={!doc.link_acceso}
                                        onClick={() => {
                                          if (doc.link_acceso) {
                                            openDocumentPreview(doc, normalized);
                                          }
                                        }}
                                      >
                                        <VisibilityOutlinedIcon fontSize="small" />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  
                                  <Tooltip title="Descargar documento" arrow>
                                    <span>
                                      <IconButton 
                                        size="small" 
                                        sx={{ 
                                          color: '#059669', 
                                          bgcolor: '#d1fae5', 
                                          '&:hover': { bgcolor: '#a7f3d0' },
                                          '&:disabled': { opacity: 0.3 }
                                        }} 
                                        disabled={!doc.link_acceso}
                                        onClick={() => {
                                          if (doc.link_acceso) {
                                            const absoluteUrl = toAbsoluteDocumentUrl(doc.link_acceso);
                                            const downloadUrl = getDownloadUrl(absoluteUrl);
                                            triggerDownload(downloadUrl, buildDownloadFileName(doc, normalized));
                                          }
                                        }}
                                      >
                                        <FileDownloadOutlinedIcon fontSize="small" />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                
                <TablePagination 
                  rowsPerPageOptions={[5, 10, 25, 50]} 
                  component="div" 
                  count={totalDocumentos} 
                  rowsPerPage={rowsPerPage} 
                  page={page} 
                  onPageChange={handleChangePage} 
                  onRowsPerPageChange={(e) => { 
                    setRowsPerPage(parseInt(e.target.value, 10)); 
                    setPage(0); 
                  }} 
                  labelRowsPerPage="Mostrar:" 
                  sx={{ borderTop: '2px solid #e2e8f0', bgcolor: '#f8fafc' }} 
                />
              </>
            )}
          </Paper>
        </Slide>
        <Dialog open={openPreviewDialog} onClose={closeDocumentPreview} maxWidth="lg" fullWidth>
          <DialogTitle sx={{ fontWeight: 700, pr: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
              <Box sx={{ fontWeight: 700, color: '#1e293b', pr: 1 }}>
                {previewTitle || 'Previsualizar documento'}
              </Box>
              <Button
                variant="contained"
                color="success"
                size="small"
                startIcon={<FileDownloadOutlinedIcon />}
                onClick={() => triggerDownload(previewDownloadUrl, previewDownloadName)}
                disabled={!previewDownloadUrl}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, px: 2 }}
              >
                Descargar
              </Button>
            </Stack>
          </DialogTitle>
          <DialogContent dividers sx={{ p: 0, height: { xs: '70vh', md: '80vh' } }}>
            {previewUrl ? (
              <Box sx={{ width: '100%', height: '100%', bgcolor: '#f8fafc' }}>
                <Box
                  component="iframe"
                  title={previewTitle || 'Previsualizacion de documento'}
                  src={previewUrl}
                  sx={{ width: '100%', height: '100%', border: 0, bgcolor: 'white' }}
                />
              </Box>
            ) : (
              <Box sx={{ p: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  No se pudo generar la previsualizacion del documento.
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={closeDocumentPreview}>Cerrar</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
}

export default AseguramientoCalidad;
