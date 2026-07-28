import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Box, Paper, Typography, Grid, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Chip, IconButton, Tooltip, Fade, Slide, Stack, Dialog, DialogTitle, DialogContent, DialogActions, InputAdornment, Switch, Menu, MenuItem, ListItemIcon, ListItemText, Divider as MuiDivider, LinearProgress } from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon, VisibilityOutlined as VisibilityOutlinedIcon, FileDownloadOutlined as FileDownloadOutlinedIcon, Description as DescriptionIcon, Article as ArticleIcon, AssignmentTurnedIn as AssignmentIcon, ListAlt as ListIcon, Policy as PolicyIcon, AccountTree as AccountTreeIcon, Upload as UploadIcon, GetApp as DownloadTemplateIcon, DeleteSweep as DeleteSweepIcon, Favorite as FavoriteIcon, FavoriteBorder as FavoriteBorderIcon, MoreVert as MoreVertIcon, HelpOutline as HelpOutlineIcon, PostAdd as PostAddIcon } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import documentoService from '../services/documentoService';
import catalogoService from '../services/catalogoService';
import favoritoService from '../services/favoritoService';
import api from '../services/api';
import ReporteSalidaFormDialog from '../components/reporteSalida/ReporteSalidaFormDialog';
import { isReporteSalidaDocument } from '../config/reporteSalida';
import reporteSalidaService from '../services/reporteSalidaService';
import { FaFileWord, FaFileExcel, FaFilePowerpoint, FaFilePdf } from 'react-icons/fa';
import { BsFileEarmarkText } from 'react-icons/bs';

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
  const isOfficeFile = parsed?.searchParams?.get('rtpof') === 'true' || parsed?.searchParams?.get('sd') === 'true';

  let kind = 'drive-file';
  if (host.includes('docs.google.com')) {
    if (pathname.includes('/document/')) kind = 'google-doc';
    else if (pathname.includes('/spreadsheets/')) kind = 'google-sheet';
    else if (pathname.includes('/presentation/')) kind = 'google-slide';
  }
  
  return { fileId, resourceKey, gid, kind, isOfficeFile };
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

  const { fileId, resourceKey, gid, kind, isOfficeFile } = meta;
  const rkQuery = resourceKey ? `?resourcekey=${encodeURIComponent(resourceKey)}` : '';

  if (isOfficeFile || kind === 'drive-file') return buildEmbeddedDrivePreviewUrl(meta);
  if (kind === 'google-doc') return `https://docs.google.com/document/d/${fileId}/preview${rkQuery}${rkQuery ? '&' : '?'}rm=minimal`;
  if (kind === 'google-sheet') {
    const params = new URLSearchParams();
    params.set('single', 'true');
    params.set('widget', 'false');
    params.set('headers', 'false');
    if (gid) params.set('gid', gid);
    if (resourceKey) params.set('resourcekey', resourceKey);
    return `https://docs.google.com/spreadsheets/d/${fileId}/htmlview?${params.toString()}`;
  }
  if (kind === 'google-slide') return `https://docs.google.com/presentation/d/${fileId}/preview${rkQuery}`;

  return buildEmbeddedDrivePreviewUrl(meta);
};

const buildEmbeddedDrivePreviewUrl = (meta) => {
  const rkQuery = meta.resourceKey ? `?resourcekey=${encodeURIComponent(meta.resourceKey)}` : '';
  return `https://drive.google.com/file/d/${meta.fileId}/preview${rkQuery}`;
};

const getDownloadUrl = (url) => {
  const meta = extractGoogleDriveMeta(url);
  if (!meta) return appendQueryParam(url, 'download', '1');

  const { fileId, resourceKey, kind, isOfficeFile } = meta;

  if (isOfficeFile) return buildDriveDownloadUrl(meta);
  if (kind === 'google-doc') {
    const extra = resourceKey ? `&resourcekey=${encodeURIComponent(resourceKey)}` : '';
    return `https://docs.google.com/document/d/${fileId}/export?format=docx${extra}`;
  }

  if (kind === 'google-sheet') {
    const extra = resourceKey ? `&resourcekey=${encodeURIComponent(resourceKey)}` : '';
    return `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx${extra}`;
  }

  if (kind === 'google-slide') {
    const extra = resourceKey ? `&resourcekey=${encodeURIComponent(resourceKey)}` : '';
    return `https://docs.google.com/presentation/d/${fileId}/export?format=pptx${extra}`;
  }

  return buildDriveDownloadUrl(meta);
};

const buildDriveDownloadUrl = ({ fileId, resourceKey }) => {
  const params = new URLSearchParams();
  params.set('usp', 'sharing');
  if (resourceKey) params.set('resourcekey', resourceKey);
  return `https://drive.google.com/file/d/${fileId}/view?${params.toString()}`;
};

const appendQueryParam = (url, key, value) => {
  if (!url) return '';
  try {
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.set(key, value);
    return parsed.href.replace(window.location.origin, '');
  } catch {
    const separator = String(url).includes('?') ? '&' : '?';
    return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  }
};

const toAbsoluteDocumentUrl = (url) => {
  if (!url) return '';
  const value = String(url).trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/uploads/')) {
    const apiBase = process.env.REACT_APP_API_URL || '/api';
    const backendBase = apiBase.replace(/\/api\/?$/, '');
    return `${backendBase}${value}`;
  }
  if (value.startsWith('/api/')) return `${window.location.origin}${value}`;
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
  if (meta?.kind === 'drive-file') return 'pdf';

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

const getDocumentExtension = (doc) => (
  String(doc?.archivo_extension || getExtensionFromUrl(doc?.link_acceso) || '').toLowerCase()
);

const buildDocumentPreviewUrl = (doc) => {
  const resolved = toAbsoluteDocumentUrl(doc?.link_acceso);
  const extension = getDocumentExtension(doc);
  if (doc?.url_segura && ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension)) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(resolved)}`;
  }
  return getPreviewUrl(resolved);
};

const buildDownloadFileName = (doc, normalized) => {
  const base = sanitizeFileName(`${normalized?.codigo || 'documento'}_${normalized?.titulo || 'archivo'}`);
  const ext = getDocumentExtension(doc);
  return ext ? `${base}.${ext}` : base;
};

const formatDate = (value) => {
  if (!value) return '-';
  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d}/${m}/${y}`;
  }
  const dmyMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    date.getFullYear()
  ].join('/');
};

const getOriginalDateValue = (doc, keys = []) => {
  const original = doc?.datos_originales || {};
  for (const key of keys) {
    const value = original[key] ?? original[key.toLowerCase()] ?? original[key.toUpperCase()];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
};

const getDocumentoFechaCreacion = (doc) => (
  doc?.fecha_creacion
  || getOriginalDateValue(doc, ['FECHA_CREACION', 'fecha_creacion'])
);

const emptyFilterOptions = {
  macroProcesos: null,
  procesos: null,
  subprocesos: null,
  tipos: null
};

const DOCUMENT_SCOPE_TABS = [
  {
    key: 'documentos',
    label: 'Consulta de documentos',
    helper: 'Procedimientos, formatos, instructivos, manuales y demás documentos institucionales.',
    Icon: DescriptionIcon
  },
  {
    key: 'politicas',
    label: 'Políticas institucionales',
    helper: 'Listado exclusivo de políticas vigentes y su información de aprobación.',
    Icon: PolicyIcon
  },
  {
    key: 'plantillas',
    label: 'Plantillas institucionales',
    helper: 'Plantillas para la construcción de información documentada institucional.',
    Icon: AssignmentIcon
  }
];

const buildInitialDocumentFilters = (scope = 'documentos') => ({
  macro_proceso_id: '',
  proceso_id: '',
  subproceso_id: '',
  tipo_documentacion_id: '',
  titulo: '',
  estado: '',
  formatos_digitales: false,
  include_inactive: '',
  estado_scope: '',
  document_scope: scope
});

const byNombre = (a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es', { sensitivity: 'base' });

const buildCatalogosFromRelaciones = (relaciones = [], filters = {}) => {
  const macroValues = new Set((filters.macro_proceso_id || []).map(String));
  const procesoValues = new Set((filters.proceso_id || []).map(String));
  const subprocesoValues = new Set((filters.subproceso_id || []).map(String));
  const tipoValues = new Set((filters.tipo_documentacion_id || []).map(String));
  const terms = String(filters.titulo || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const maps = {
    macroProcesos: new Map(),
    procesos: new Map(),
    subprocesos: new Map(),
    tipos: new Map()
  };

  relaciones
    .filter((row) => {
      if (macroValues.size && !macroValues.has(String(row.macro_id))) return false;
      if (procesoValues.size && !procesoValues.has(String(row.proceso_id))) return false;
      if (subprocesoValues.size && !subprocesoValues.has(String(row.subproceso_id))) return false;
      if (tipoValues.size && !tipoValues.has(String(row.tipo_id))) return false;
      if (!terms.length) return true;
      const text = `${row.codigo || ''} ${row.titulo || ''}`.toLowerCase();
      return terms.every((term) => text.includes(term));
    })
    .forEach((row) => {
      maps.macroProcesos.set(String(row.macro_id), { id: String(row.macro_id), nombre: String(row.macro_nombre) });
      maps.procesos.set(String(row.proceso_id), { id: String(row.proceso_id), nombre: String(row.proceso_nombre), macro_proceso_id: String(row.macro_id) });
      maps.subprocesos.set(String(row.subproceso_id), { id: String(row.subproceso_id), nombre: String(row.subproceso_nombre), proceso_id: String(row.proceso_id), macro_proceso_id: String(row.macro_id) });
      maps.tipos.set(String(row.tipo_id), { id: String(row.tipo_id), nombre: String(row.tipo_nombre) });
    });

  return {
    macroProcesos: Array.from(maps.macroProcesos.values()).sort(byNombre),
    procesos: Array.from(maps.procesos.values()).sort(byNombre),
    subprocesos: Array.from(maps.subprocesos.values()).sort(byNombre),
    tipos: Array.from(maps.tipos.values()).sort(byNombre)
  };
};

const buildRelacionesFromDocumentos = (docs = []) => {
  const map = new Map();

  docs.forEach((doc) => {
    const macro = doc?.macroproceso || doc?.subproceso?.proceso?.macroProceso?.nombre || '';
    const proceso = doc?.proceso_texto || doc?.subproceso?.proceso?.nombre || '';
    const subproceso = doc?.subproceso_texto || doc?.subproceso?.nombre || '';
    const tipo = doc?.tipo_documento || doc?.tipoDocumentacion?.nombre || '';
    if (!macro || !proceso || !subproceso || !tipo) return;

    const key = [macro, proceso, subproceso, tipo, doc?.codigo || '', doc?.titulo || ''].join('::');
    map.set(key, {
      macro_id: String(macro),
      macro_nombre: String(macro),
      proceso_id: String(proceso),
      proceso_nombre: String(proceso),
      subproceso_id: String(subproceso),
      subproceso_nombre: String(subproceso),
      tipo_id: String(tipo),
      tipo_nombre: String(tipo),
      codigo: doc?.codigo || '',
      titulo: doc?.titulo || ''
    });
  });

  return Array.from(map.values());
};

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
    setVisibleOptions(options);
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
  const isDocumentSearchRoute = location.pathname === '/dashboard/buscar-documentos';
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
  const hasDocumentalManagementPermission = useMemo(() => {
    const permissions = [
      ...(Array.isArray(user?.menuPermissions) ? user.menuPermissions : []),
      ...(Array.isArray(user?.modulePermissions) ? user.modulePermissions : []),
      ...(Array.isArray(user?.allowedModules) ? user.allowedModules : [])
    ].map((item) => String(item || '').trim());
    return permissions.some((key) => ['aseguramiento_calidad', 'gestion_procesos'].includes(key));
  }, [user]);
  const canManageDocumental = useMemo(
    () => (
      ['administrador', 'gestion_por_procesos', 'gestion_procesos'].includes(normalizedRole)
      || hasDocumentalManagementPermission
    ) && !forceReadOnly && !(isDocumentSearchRoute && ['gestion_por_procesos', 'gestion_procesos'].includes(normalizedRole)),
    [normalizedRole, hasDocumentalManagementPermission, forceReadOnly, isDocumentSearchRoute]
  );
  const [activeDocumentScope, setActiveDocumentScope] = useState('documentos');
  const [filters, setFilters] = useState(buildInitialDocumentFilters('documentos'));
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
  const [adminMenuAnchor, setAdminMenuAnchor] = useState(null);
  const [openPreviewDialog, setOpenPreviewDialog] = useState(false);
  const [previewKind, setPreviewKind] = useState('default');
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewNormalized, setPreviewNormalized] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewDownloadUrl, setPreviewDownloadUrl] = useState('');
  const [previewDownloadName, setPreviewDownloadName] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [manualSearchMode, setManualSearchMode] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [reporteSalidaDoc, setReporteSalidaDoc] = useState(null);
  const [reporteSalidaFeature, setReporteSalidaFeature] = useState({ enabled: false, canToggle: false, loading: false });
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [syncingSheet, setSyncingSheet] = useState(false);
  const [openClearDialog, setOpenClearDialog] = useState(false);
  const [clearEmail, setClearEmail] = useState('');
  const [clearConfirmation, setClearConfirmation] = useState('');
  const [clearingDocuments, setClearingDocuments] = useState(false);
  const [filterOptions, setFilterOptions] = useState(emptyFilterOptions);
  const [filterRelations, setFilterRelations] = useState([]);
  const [visibleRelations, setVisibleRelations] = useState([]);
  const catalogRequestId = useRef(0);
  const documentRequestId = useRef(0);
  const initialDocumentsLoaded = useRef(false);
  const skipNextDocumentFilterEffect = useRef(false);
  const autoOpenReporteSalidaDone = useRef(false);

  const syncCatalogosFromPayload = useCallback((data = {}) => {
    setMacroProcesos(data.macroProcesos || []);
    setProcesos(data.procesos || []);
    setSubprocesos(data.subprocesos || []);
    setTiposDocumentacion(data.tipos || []);
  }, []);

  const loadCatalogosDirecto = useCallback(async (opts = {}) => {
    const requestId = ++catalogRequestId.current;
    const extra = {
      document_scope: opts.document_scope || activeDocumentScope,
      ...(opts.include_inactive ? { include_inactive: opts.include_inactive, estado_scope: opts.estado_scope || 'inactive' } : {})
    };
    try {
      const response = await catalogoService.getFilterRelations(extra);
      if (requestId !== catalogRequestId.current) return;
      const relaciones = response?.data?.relaciones || [];
      setFilterRelations(relaciones);
      syncCatalogosFromPayload(buildCatalogosFromRelaciones(relaciones));
    } catch (error) {
      const fallback = await documentoService.getDocumentos(extra, 1, 5000);
      if (requestId !== catalogRequestId.current) return;
      const relaciones = buildRelacionesFromDocumentos(fallback?.data?.documentos || []);
      setFilterRelations(relaciones);
      syncCatalogosFromPayload(buildCatalogosFromRelaciones(relaciones));
    }
  }, [activeDocumentScope, syncCatalogosFromPayload]);

  const loadCatalogos = useCallback(async (activeFilters = {}) => {
    const hasUserFilter = Object.entries(activeFilters).some(
      ([key, value]) => !['include_inactive', 'estado_scope', 'document_scope'].includes(key) && String(value || '').trim() !== ''
    );
    if (!hasUserFilter) {
      setFilterOptions(emptyFilterOptions);
      await loadCatalogosDirecto(activeFilters);
      return;
    }

    if (filterRelations.length) {
      const nextOptions = buildCatalogosFromRelaciones(filterRelations, {
        macro_proceso_id: selMacros,
        proceso_id: selProcesos,
        subproceso_id: selSubprocesos,
        tipo_documentacion_id: selTipos,
        titulo: activeFilters.titulo || ''
      });
      setFilterOptions(nextOptions);
      syncCatalogosFromPayload(nextOptions);
      return;
    }

    setFilterOptions(emptyFilterOptions);
  }, [filterRelations, loadCatalogosDirecto, selMacros, selProcesos, selSubprocesos, selTipos, syncCatalogosFromPayload]);

  useEffect(() => {
    const extra = {
      document_scope: activeDocumentScope,
      ...(filters.include_inactive ? { include_inactive: filters.include_inactive, estado_scope: filters.estado_scope || 'inactive' } : {})
    };
    setFilterOptions(emptyFilterOptions);
    loadCatalogosDirecto(extra).catch(() => {
      enqueueSnackbar('No fue posible cargar los filtros', { variant: 'warning' });
    });
  }, [activeDocumentScope, filters.include_inactive, filters.estado_scope, loadCatalogosDirecto, enqueueSnackbar]);

  useEffect(() => {
    const params = {};
    if (selMacros.length) params.macro_proceso_id = selMacros.join(',');
    if (selProcesos.length) params.proceso_id = selProcesos.join(',');
    if (selSubprocesos.length) params.subproceso_id = selSubprocesos.join(',');
    if (selTipos.length) params.tipo_documentacion_id = selTipos.join(',');
    if (filters.titulo) params.titulo = filters.titulo;
    if (filters.formatos_digitales) params.formatos_digitales = true;
    params.document_scope = activeDocumentScope;
    if (filters.include_inactive) {
      params.include_inactive = filters.include_inactive;
      params.estado_scope = filters.estado_scope || 'inactive';
    }

    const hasUserFilter = Object.keys(params).some((key) => !['include_inactive', 'estado_scope', 'document_scope'].includes(key));
    if (!hasUserFilter) {
      setFilterOptions(emptyFilterOptions);
      if (filterRelations.length) syncCatalogosFromPayload(buildCatalogosFromRelaciones(filterRelations));
      return;
    }

    loadCatalogos(params).catch(() => setFilterOptions(emptyFilterOptions));
  }, [activeDocumentScope, filterRelations, loadCatalogos, selMacros, selProcesos, selSubprocesos, selTipos, filters.titulo, filters.include_inactive, filters.estado_scope, syncCatalogosFromPayload]);

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

  const loadReporteSalidaFeature = useCallback(async () => {
    try {
      const response = await reporteSalidaService.getConfig();
      setReporteSalidaFeature({
        enabled: Boolean(response?.data?.enabled),
        canToggle: Boolean(response?.data?.canToggle),
        loading: false
      });
    } catch (_) {
      setReporteSalidaFeature((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    loadReporteSalidaFeature();
  }, [loadReporteSalidaFeature, user?.id]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const shouldOpenReporteSalida = params.get('abrir') === 'reporte-salida' || params.get('formato') === 'reporte-salida';
    if (!shouldOpenReporteSalida || autoOpenReporteSalidaDone.current || !reporteSalidaFeature.enabled) return;
    const doc = documentos.find((item) => isReporteSalidaDocument(item));
    if (!doc) return;
    autoOpenReporteSalidaDone.current = true;
    setReporteSalidaDoc(doc);
  }, [documentos, location.search, reporteSalidaFeature.enabled]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const quickTitulo = params.get('titulo');
    if (quickTitulo) {
      const requestId = ++documentRequestId.current;
      const nextFilters = { ...buildInitialDocumentFilters(activeDocumentScope), titulo: quickTitulo };
      initialDocumentsLoaded.current = true;
      skipNextDocumentFilterEffect.current = true;
      setSelMacros([]); setSelProcesos([]); setSelSubprocesos([]); setSelTipos([]);
      setFilters(nextFilters);
      setHasSearched(true);
      setManualSearchMode(false);
      setLoading(true);
      documentoService.getDocumentos(nextFilters, 1, 10)
        .then((response) => {
          if (requestId !== documentRequestId.current) return;
          if (response.success) {
            const nextDocs = response.data.documentos || [];
            setDocumentos(nextDocs);
            setVisibleRelations(buildRelacionesFromDocumentos(nextDocs));
            setTotalDocumentos(response.data.pagination.total);
          }
        })
        .catch((error) => {
          if (requestId === documentRequestId.current) {
            enqueueSnackbar(getApiErrorMessage(error, 'Error al buscar documentos'), { variant: 'error' });
          }
        })
        .finally(() => {
          if (requestId === documentRequestId.current) setLoading(false);
        });
    }
  }, [activeDocumentScope, location.search, enqueueSnackbar]);

  useEffect(() => {
    if (initialDocumentsLoaded.current) return;
    const params = new URLSearchParams(location.search);
    if (params.get('titulo')) return;
    initialDocumentsLoaded.current = true;
    skipNextDocumentFilterEffect.current = true;

    const requestId = ++documentRequestId.current;
    const initialFilters = buildInitialDocumentFilters(activeDocumentScope);
    setLoading(true);
    setHasSearched(true);

    documentoService.getDocumentos(initialFilters, 1, rowsPerPage)
      .then((response) => {
        if (requestId !== documentRequestId.current) return;
        if (response.success) {
          const nextDocs = response.data.documentos || [];
          setDocumentos(nextDocs);
          setVisibleRelations(buildRelacionesFromDocumentos(nextDocs));
          setTotalDocumentos(response.data.pagination.total);
          setHasSearched(true);
        }
      })
      .catch((error) => {
        if (requestId === documentRequestId.current) {
          enqueueSnackbar(getApiErrorMessage(error, 'Error al cargar documentos'), { variant: 'error' });
        }
      })
      .finally(() => {
        if (requestId === documentRequestId.current) setLoading(false);
      });
  }, [activeDocumentScope, location.search, rowsPerPage, enqueueSnackbar]);


  const handleSearch = async (overrideFilters = null) => {
    const base = overrideFilters !== null ? overrideFilters : filters;
    // document_scope siempre viene del tab activo para evitar búsquedas cruzadas
    const activeFilters = { ...base, document_scope: activeDocumentScope };
    const requestId = ++documentRequestId.current;
    setLoading(true);
    setPage(0);
    setHasSearched(true);
    setManualSearchMode(true);
    try {
      const response = await documentoService.getDocumentos(activeFilters, 1, rowsPerPage);
      if (requestId !== documentRequestId.current) return;
      if (response.success) {
        const nextDocs = response.data.documentos || [];
        setDocumentos(nextDocs);
        setVisibleRelations(buildRelacionesFromDocumentos(nextDocs));
        setTotalDocumentos(response.data.pagination.total);
        if (response.data.documentos.length === 0) {
          enqueueSnackbar(response.message || 'No se encontraron documentos', { variant: 'info' });
        } else {
          enqueueSnackbar(`✓ ${response.data.pagination.total} documentos encontrados`, { variant: 'success' });
        }
      }
    } catch (error) {
      if (requestId === documentRequestId.current) {
        enqueueSnackbar(getApiErrorMessage(error, 'Error al buscar documentos'), { variant: 'error' });
      }
    } finally {
      if (requestId === documentRequestId.current) setLoading(false);
    }
  };

  const handleSegmentChange = (key) => {
    const newFilters = {
      ...filters,
      include_inactive: key !== 'vigente' ? 'true' : '',
      estado_scope: key,
      document_scope: activeDocumentScope
    };
    setFilters(newFilters);
    // Llamar directamente al servicio para evitar problemas de closure con handleSearch
    const requestId = ++documentRequestId.current;
    skipNextDocumentFilterEffect.current = true;
    setLoading(true);
    setPage(0);
    setHasSearched(true);
    setManualSearchMode(true);
    documentoService.getDocumentos(newFilters, 1, rowsPerPage)
      .then((response) => {
        if (requestId !== documentRequestId.current) return;
        if (response.success) {
          setDocumentos(response.data.documentos || []);
          setTotalDocumentos(response.data.pagination.total);
        }
      })
      .catch(() => {})
      .finally(() => { if (requestId === documentRequestId.current) setLoading(false); });
  };

  const handleClearFilters = () => {
    documentRequestId.current += 1;
    setFilters(buildInitialDocumentFilters(activeDocumentScope));
    setSelMacros([]); setSelProcesos([]); setSelSubprocesos([]); setSelTipos([]);
    setDocumentos([]);
    setVisibleRelations([]);
    setTotalDocumentos(0);
    setHasSearched(false);
    setManualSearchMode(false);
    setPage(0);
  };

  const handleDocumentScopeChange = async (scope) => {
    if (scope === activeDocumentScope) return;
    const requestId = ++documentRequestId.current;
    setActiveDocumentScope(scope);
    const nextFilters = buildInitialDocumentFilters(scope);
    skipNextDocumentFilterEffect.current = true;
    setFilters(nextFilters);
    setSelMacros([]); setSelProcesos([]); setSelSubprocesos([]); setSelTipos([]);
    setFilterOptions(emptyFilterOptions);
    setVisibleRelations([]);
    setDocumentos([]);
    setTotalDocumentos(0);
    setHasSearched(true);
    setManualSearchMode(false);
    setPage(0);
    setLoading(true);

    try {
      const response = await documentoService.getDocumentos(nextFilters, 1, rowsPerPage);
      if (requestId !== documentRequestId.current) return;
      if (response.success) {
        const nextDocs = response.data.documentos || [];
        setDocumentos(nextDocs);
        setVisibleRelations(buildRelacionesFromDocumentos(nextDocs));
        setTotalDocumentos(response.data.pagination.total);
        setHasSearched(true);
      }
    } catch (error) {
      if (requestId === documentRequestId.current) {
        enqueueSnackbar(getApiErrorMessage(error, 'Error al cambiar el tipo de consulta'), { variant: 'error' });
      }
    } finally {
      if (requestId === documentRequestId.current) setLoading(false);
    }
  };

  const handleMacroChange = (values) => {
    setSelMacros(values);
  };

  const handleProcesoChange = (values) => {
    setSelProcesos(values);
  };

  // Sync multi-select arrays → filters (comma-separated IDs for backend)
  useEffect(() => { setFilters(prev => ({ ...prev, macro_proceso_id: selMacros.join(',') })); }, [selMacros]);
  useEffect(() => { setFilters(prev => ({ ...prev, proceso_id: selProcesos.join(',') })); }, [selProcesos]);
  useEffect(() => { setFilters(prev => ({ ...prev, subproceso_id: selSubprocesos.join(',') })); }, [selSubprocesos]);
  useEffect(() => { setFilters(prev => ({ ...prev, tipo_documentacion_id: selTipos.join(',') })); }, [selTipos]);
  useEffect(() => { setFilters(prev => ({ ...prev, document_scope: activeDocumentScope })); }, [activeDocumentScope]);

  useEffect(() => {
    if (skipNextDocumentFilterEffect.current) {
      skipNextDocumentFilterEffect.current = false;
      return;
    }

    const hasUserFilter = Object.entries(filters).some(
      ([key, value]) => !['estado_scope', 'document_scope'].includes(key) && String(value || '').trim() !== ''
    );

    if (!hasUserFilter) {
      if (!initialDocumentsLoaded.current || manualSearchMode) return;

      const requestId = ++documentRequestId.current;
      const debounceId = setTimeout(async () => {
        setLoading(true);
        setPage(0);
        setHasSearched(true);
        try {
          const response = await documentoService.getDocumentos(filters, 1, rowsPerPage);
          if (requestId !== documentRequestId.current) return;
          if (response.success) {
            const nextDocs = response.data.documentos || [];
            setDocumentos(nextDocs);
            setVisibleRelations(buildRelacionesFromDocumentos(nextDocs));
            setTotalDocumentos(response.data.pagination.total);
          }
        } catch (error) {
          if (requestId === documentRequestId.current) {
            enqueueSnackbar(getApiErrorMessage(error, 'Error al cargar documentos'), { variant: 'error' });
          }
        } finally {
          if (requestId === documentRequestId.current) setLoading(false);
        }
      }, 350);

      return () => clearTimeout(debounceId);
    }

    if (!initialDocumentsLoaded.current) {
      initialDocumentsLoaded.current = true;
    }

    setManualSearchMode(false);
    setHasSearched(true);
    const requestId = ++documentRequestId.current;
    const debounceId = setTimeout(async () => {
      setLoading(true);
      setPage(0);
      try {
        const response = await documentoService.getDocumentos(filters, 1, rowsPerPage);
        if (requestId !== documentRequestId.current) return;
        if (response.success) {
          const nextDocs = response.data.documentos || [];
          setDocumentos(nextDocs);
          setVisibleRelations(buildRelacionesFromDocumentos(nextDocs));
          setTotalDocumentos(response.data.pagination.total);
        }
      } catch (error) {
        if (requestId === documentRequestId.current) {
          enqueueSnackbar(getApiErrorMessage(error, 'Error al aplicar filtros'), { variant: 'error' });
        }
      } finally {
        if (requestId === documentRequestId.current) setLoading(false);
      }
    }, 350);

    return () => clearTimeout(debounceId);
  }, [filters, manualSearchMode, rowsPerPage, enqueueSnackbar]);

  const handleChangePage = async (event, newPage) => {
    const requestId = ++documentRequestId.current;
    setPage(newPage);
    setLoading(true);
    try {
      const response = await documentoService.getDocumentos(filters, newPage + 1, rowsPerPage);
      if (requestId !== documentRequestId.current) return;
      if (response.success) {
        const total = Number(response.data.pagination.total || 0);
        const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
        if (newPage >= totalPages && total > 0) {
          const lastPage = totalPages - 1;
          const lastPageResponse = await documentoService.getDocumentos(filters, lastPage + 1, rowsPerPage);
          if (requestId !== documentRequestId.current) return;
          if (lastPageResponse.success) {
            const nextDocs = lastPageResponse.data.documentos || [];
            setPage(lastPage);
            setDocumentos(nextDocs);
            setVisibleRelations(buildRelacionesFromDocumentos(nextDocs));
            setTotalDocumentos(lastPageResponse.data.pagination.total);
          }
          return;
        }
        const nextDocs = response.data.documentos || [];
        setDocumentos(nextDocs);
        setVisibleRelations(buildRelacionesFromDocumentos(nextDocs));
        setTotalDocumentos(total);
      }
    } catch (error) {
      if (requestId === documentRequestId.current) {
        enqueueSnackbar(getApiErrorMessage(error, 'Error al cargar documentos'), { variant: 'error' });
      }
    } finally {
      if (requestId === documentRequestId.current) setLoading(false);
    }
  };

  const handleChangeRowsPerPage = async (event) => {
    const nextRowsPerPage = parseInt(event.target.value, 10);
    const requestId = ++documentRequestId.current;
    skipNextDocumentFilterEffect.current = true;
    setRowsPerPage(nextRowsPerPage);
    setPage(0);
    setLoading(true);
    setHasSearched(true);
    try {
      const response = await documentoService.getDocumentos(filters, 1, nextRowsPerPage);
      if (requestId !== documentRequestId.current) return;
      if (response.success) {
        const nextDocs = response.data.documentos || [];
        setDocumentos(nextDocs);
        setVisibleRelations(buildRelacionesFromDocumentos(nextDocs));
        setTotalDocumentos(response.data.pagination.total);
      }
    } catch (error) {
      if (requestId === documentRequestId.current) {
        enqueueSnackbar(getApiErrorMessage(error, 'Error al cargar documentos'), { variant: 'error' });
      }
    } finally {
      if (requestId === documentRequestId.current) setLoading(false);
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

  const openReporteSalidaForm = (doc) => {
    setReporteSalidaDoc(doc);
  };

  const toggleReporteSalidaFeature = async (nextEnabled) => {
    setReporteSalidaFeature((prev) => ({ ...prev, loading: true }));
    try {
      const response = await reporteSalidaService.updateConfig(nextEnabled);
      const isEnabled = Boolean(response?.data?.enabled);
      setReporteSalidaFeature({
        enabled: isEnabled,
        canToggle: Boolean(response?.data?.canToggle),
        loading: false
      });
      
      // Si se desactiva el formulario, limpiamos el filtro activo
      if (!isEnabled) {
        setFilters((prev) => ({ ...prev, formatos_digitales: false }));
      }
      
      enqueueSnackbar(response?.message || (nextEnabled ? 'Formulario activado' : 'Formulario desactivado'), { variant: 'success' });
    } catch (error) {
      setReporteSalidaFeature((prev) => ({ ...prev, loading: false }));
      enqueueSnackbar(getApiErrorMessage(error, 'No se pudo actualizar la bandera del formulario'), { variant: 'error' });
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
    switch (String(estado || '').toLowerCase()) {
      case 'vigente':     return 'VIGENTE';
      case 'obsoleto':    return 'INACTIVO';
      case 'en_revision': return 'EN CONSTRUCCIÓN';
      default:            return String(estado || '').toUpperCase();
    }
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

  const getFormatoIcon = (doc) => {
    const extension = getDocumentExtension(doc);
    if (['doc', 'docx'].includes(extension)) return <FaFileWord size={18} />;
    if (extension === 'pdf') return <FaFilePdf size={18} />;
    if (['xls', 'xlsx', 'csv'].includes(extension)) return <FaFileExcel size={18} />;
    if (['ppt', 'pptx'].includes(extension)) return <FaFilePowerpoint size={18} />;
    return <BsFileEarmarkText size={18} />;
  };

  const getFormatoColor = (doc) => {
    const extension = getDocumentExtension(doc);
    if (['doc', 'docx'].includes(extension)) return '#2563eb';
    if (extension === 'pdf') return '#dc2626';
    if (['xls', 'xlsx', 'csv'].includes(extension)) return '#059669';
    if (['ppt', 'pptx'].includes(extension)) return '#ea580c';
    return '#475569';
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
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000
      });

      if (response.data.success) {
        enqueueSnackbar(response.data.message, { variant: 'success' });
        setSelectedFile(null);
        await loadCatalogos();
        handleSearch();
      }
    } catch (error) {
      const isTimeout = error?.code === 'ECONNABORTED' || error?.message?.includes('timeout');
      const backendMessage = error?.response?.data?.message;
      const userMessage = isTimeout
        ? 'El archivo tardó demasiado en procesarse. Intenta de nuevo.'
        : (backendMessage || 'Error al importar archivo. Verifica el formato del Excel.');
      enqueueSnackbar(userMessage, { variant: 'error' });
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

  const handleOpenClearDialog = () => {
    setClearEmail(user?.email || '');
    setClearConfirmation('');
    setOpenClearDialog(true);
  };

  const handleCloseClearDialog = () => {
    if (clearingDocuments) return;
    setOpenClearDialog(false);
  };

  const handleClearServerDocuments = async () => {
    setClearingDocuments(true);
    try {
      const response = await api.post('/import/clear', {
        email: clearEmail,
        confirmText: clearConfirmation
      });

      enqueueSnackbar(response.data?.message || 'Base documental limpiada', { variant: 'success' });
      setOpenClearDialog(false);
      setDocumentos([]);
      setVisibleRelations([]);
      setTotalDocumentos(0);
      setHasSearched(false);
      setManualSearchMode(false);
      await loadCatalogos();
    } catch (error) {
      enqueueSnackbar(getApiErrorMessage(error, 'Error al limpiar la base documental'), { variant: 'error' });
    } finally {
      setClearingDocuments(false);
    }
  };

  const getPreviewKind = (doc) => {
    const meta = extractGoogleDriveMeta(doc?.link_acceso);
    return meta?.kind || 'default';
  };

  const openDocumentPreview = (doc, normalized) => {
    if (!doc?.link_acceso) return;
    const resolved = toAbsoluteDocumentUrl(doc.link_acceso);
    setPreviewUrl(buildDocumentPreviewUrl(doc));
    setPreviewTitle(`${normalized?.codigo || ''} ${normalized?.titulo || ''}`.trim());
    setPreviewDownloadUrl(getDownloadUrl(resolved));
    setPreviewDownloadName(buildDownloadFileName(doc, normalized));
    setPreviewKind(getPreviewKind(doc));
    setPreviewDoc(doc);
    setPreviewNormalized(normalized);
    setOpenPreviewDialog(true);
  };

  const closeDocumentPreview = () => {
    setOpenPreviewDialog(false);
    setPreviewUrl('');
    setPreviewTitle('');
    setPreviewDownloadUrl('');
    setPreviewDownloadName('');
    setPreviewKind('default');
    setPreviewDoc(null);
    setPreviewNormalized(null);
  };

  const triggerDownload = (url, filename) => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    if (filename) link.download = filename;
    if (/^https?:\/\//i.test(url) && !url.startsWith(window.location.origin)) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownload = (doc, normalized) => {
    if (!doc) return;
    try {
      const token = localStorage.getItem('token') || '';
      const baseURL = process.env.REACT_APP_API_URL || '/api';
      const absoluteBaseURL = baseURL.startsWith('http')
        ? baseURL
        : `${window.location.origin}${baseURL}`;
      const downloadUrl = `${absoluteBaseURL}/documentos/descargar/${doc.id}?token=${encodeURIComponent(token)}`;
      window.location.href = downloadUrl;
    } catch (error) {
      console.error('Error al iniciar la descarga:', error);
      enqueueSnackbar('Error al descargar el archivo original', { variant: 'error' });
    }
  };

  const activeFiltersCount = Object.entries(filters)
    .filter(([key, value]) => !['estado_scope', 'document_scope'].includes(key) && value !== '')
    .length;
  const hasActiveFilters = activeFiltersCount > 0;
  const tiposDocumentacionDisplay = tiposDocumentacion.filter((td) => !isDocumentCode(td.nombre));
  const selectedRelationFilters = useMemo(() => ({
    macro_proceso_id: selMacros,
    proceso_id: selProcesos,
    subproceso_id: selSubprocesos,
    tipo_documentacion_id: selTipos,
    titulo: filters.titulo
  }), [filters.titulo, selMacros, selProcesos, selSubprocesos, selTipos]);
  const activeRelationRows = filterRelations.length ? filterRelations : visibleRelations;
  const buildFacetOptions = useCallback((skipKey = '') => {
    if (!activeRelationRows.length) return null;
    return buildCatalogosFromRelaciones(activeRelationRows, {
      ...selectedRelationFilters,
      [skipKey]: []
    });
  }, [activeRelationRows, selectedRelationFilters]);

  const macroRelationOptions = useMemo(() => buildFacetOptions('macro_proceso_id'), [buildFacetOptions]);
  const procesoRelationOptions = useMemo(() => buildFacetOptions('proceso_id'), [buildFacetOptions]);
  const subprocesoRelationOptions = useMemo(() => buildFacetOptions('subproceso_id'), [buildFacetOptions]);
  const tipoRelationOptions = useMemo(() => buildFacetOptions('tipo_documentacion_id'), [buildFacetOptions]);

  // Filtrado client-side usando relaciones del catálogo (macro_proceso_id, proceso_id)
  const resolveFilterOptions = (key, fallback) => (
    Array.isArray(filterOptions[key]) ? filterOptions[key] : fallback
  );

  const macroOptions = macroRelationOptions?.macroProcesos || resolveFilterOptions('macroProcesos', macroProcesos);
  const procesoSource = procesoRelationOptions?.procesos || resolveFilterOptions('procesos', procesos);
  const subprocesoSource = subprocesoRelationOptions?.subprocesos || resolveFilterOptions('subprocesos', subprocesos);
  const tipoSource = tipoRelationOptions?.tipos || resolveFilterOptions('tipos', tiposDocumentacionDisplay);

  const procesoOptions = procesoRelationOptions?.procesos || (selMacros.length > 0
    ? procesoSource.filter(p => selMacros.some(mId => String(p.macro_proceso_id) === String(mId)))
    : procesoSource);

  const subprocesoOptions = subprocesoRelationOptions?.subprocesos || (selProcesos.length > 0
    ? subprocesoSource.filter(sp => selProcesos.some(pId => String(sp.proceso_id) === String(pId)))
    : selMacros.length > 0
      ? subprocesoSource.filter(sp => procesoOptions.some(p => String(p.id) === String(sp.proceso_id)))
      : subprocesoSource);

  const tipoOptions = tipoSource.filter((td) => !isDocumentCode(td.nombre));
  const isFiltering = loading;
  const displayDocumentos = useMemo(() => {
    if (!filters.formatos_digitales) return documentos;
    return documentos.filter(doc => isReporteSalidaDocument(doc));
  }, [documentos, filters.formatos_digitales]);

  useEffect(() => {
    const keepValidSelections = (selected, options) => {
      if (!selected.length) return selected;
      const validIds = new Set(options.map((option) => String(option.id)));
      return selected.filter((id) => validIds.has(String(id)));
    };

    const nextMacros = keepValidSelections(selMacros, macroOptions);
    const nextProcesos = keepValidSelections(selProcesos, procesoOptions);
    const nextSubprocesos = keepValidSelections(selSubprocesos, subprocesoOptions);
    const nextTipos = keepValidSelections(selTipos, tipoOptions);

    if (nextMacros.length !== selMacros.length) setSelMacros(nextMacros);
    if (nextProcesos.length !== selProcesos.length) setSelProcesos(nextProcesos);
    if (nextSubprocesos.length !== selSubprocesos.length) setSelSubprocesos(nextSubprocesos);
    if (nextTipos.length !== selTipos.length) setSelTipos(nextTipos);
  }, [macroOptions, procesoOptions, selMacros, selProcesos, selSubprocesos, selTipos, subprocesoOptions, tipoOptions]);

  return (
    <Fade in={true} timeout={500}>
      <Box>
        {/* IMPORTAR EXCEL (administrador y gestion por procesos) */}
        {canManageDocumental && (
          <Paper elevation={0} sx={{ mb: 3, borderRadius: '14px', overflow: 'hidden', border: '1px solid #c7d7f5', boxShadow: '0 8px 32px rgba(29,78,216,0.10), 0 1.5px 6px rgba(15,23,42,0.06)' }}>

            {/* Header principal azul — único encabezado de la página */}
            <Box sx={{ px: 3, py: 2.4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 60%, #2563eb 100%)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.8, minWidth: 0 }}>
                <Box sx={{ width: 46, height: 46, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <SearchIcon sx={{ color: '#fff', fontSize: 24 }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ fontWeight: 900, fontSize: 17, color: '#fff', lineHeight: 1.2 }}>Administración del Sistema Documental</Typography>
                    <Box sx={{ px: 1, py: 0.25, borderRadius: '5px', bgcolor: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', flexShrink: 0 }}>
                      <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: '#fff', letterSpacing: '0.6px' }}>SIAC</Typography>
                    </Box>
                  </Stack>
                  <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', mt: 0.3 }}>Gestión y consulta de información documentada institucional</Typography>
                </Box>
              </Box>
              {/* Menú de tres puntos */}
              <IconButton
                onClick={(e) => setAdminMenuAnchor(e.currentTarget)}
                sx={{ width: 42, height: 42, flexShrink: 0, bgcolor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', transition: 'all 0.15s', '&:hover': { bgcolor: 'rgba(255,255,255,0.26)', borderColor: 'rgba(255,255,255,0.55)' } }}
              >
                <MoreVertIcon sx={{ fontSize: 20 }} />
              </IconButton>
              <Menu
                anchorEl={adminMenuAnchor}
                open={Boolean(adminMenuAnchor)}
                onClose={() => setAdminMenuAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{ paper: { elevation: 0, sx: { mt: 1, borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 8px 28px rgba(15,23,42,0.12)', minWidth: 220, overflow: 'visible', '&::before': { content: '""', display: 'block', position: 'absolute', top: -6, right: 14, width: 12, height: 12, bgcolor: '#fff', border: '1px solid #e2e8f0', borderBottom: 'none', borderRight: 'none', transform: 'rotate(45deg)', zIndex: 0 } } } }}
              >
                <Box sx={{ px: 2, pt: 1.4, pb: 0.8 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Administración</Typography>
                </Box>
                <MenuItem
                  onClick={() => { setAdminMenuAnchor(null); handleOpenClearDialog(); }}
                  sx={{ mx: 1, mb: 0.8, borderRadius: '8px', py: 1.1, px: 1.4, '&:hover': { bgcolor: '#fff5f5' } }}
                >
                  <ListItemIcon sx={{ minWidth: 34 }}>
                    <Box sx={{ width: 30, height: 30, borderRadius: '8px', bgcolor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <DeleteSweepIcon sx={{ color: '#b91c1c', fontSize: 17 }} />
                    </Box>
                  </ListItemIcon>
                  <ListItemText
                    primary={<Typography sx={{ fontWeight: 700, fontSize: 13, color: '#b91c1c' }}>Limpiar base de datos</Typography>}
                    secondary={<Typography sx={{ fontSize: 11, color: '#94a3b8', mt: 0.2 }}>Elimina todos los documentos</Typography>}
                  />
                </MenuItem>
              </Menu>
            </Box>

            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5, bgcolor: '#fff' }}>

              {/* Sección 1 – Archivo Excel con flujo de 3 pasos */}
              <Box>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.8 }}>
                  <Box sx={{ width: 4, height: 18, borderRadius: 2, background: 'linear-gradient(180deg,#1d4ed8,#2563eb)' }} />
                  <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Carga por archivo Excel</Typography>
                </Stack>

                {/* Flujo 3 pasos */}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr auto 1fr auto 1fr' }, gap: 1, alignItems: 'center' }}>

                  {/* Paso 1 – Descargar plantilla */}
                  <Box sx={{ borderRadius: '10px', border: '1.5px solid #bfdbfe', bgcolor: '#f0f7ff', p: 1.6, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 11, lineHeight: 1 }}>1</Typography>
                      </Box>
                      <Typography sx={{ fontWeight: 800, fontSize: 12, color: '#1e3a8a' }}>Descargar plantilla</Typography>
                    </Stack>
                    <Typography sx={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>Descarga el archivo Excel con el formato correcto.</Typography>
                    <Button variant="outlined" startIcon={<DownloadTemplateIcon />} onClick={handleDownloadTemplate}
                      sx={{ borderRadius: '8px', py: 0.9, textTransform: 'none', fontWeight: 700, fontSize: 12, borderColor: '#1d4ed8', color: '#1d4ed8', bgcolor: '#fff', '&:hover': { bgcolor: '#eff6ff' } }}>
                      Descargar plantilla
                    </Button>
                  </Box>

                  {/* Flecha 1→2 */}
                  <Typography sx={{ color: '#94a3b8', fontWeight: 900, fontSize: 20, textAlign: 'center', display: { xs: 'none', md: 'block' } }}>→</Typography>

                  {/* Paso 2 – Adjuntar archivo */}
                  <Box sx={{ borderRadius: '10px', border: `1.5px solid ${selectedFile ? '#1d4ed8' : '#e2e8f0'}`, bgcolor: selectedFile ? '#eff6ff' : '#fafafa', p: 1.6, display: 'flex', flexDirection: 'column', gap: 1, transition: 'all 0.2s' }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: selectedFile ? '#1d4ed8' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                        <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 11, lineHeight: 1 }}>2</Typography>
                      </Box>
                      <Typography sx={{ fontWeight: 800, fontSize: 12, color: selectedFile ? '#1e3a8a' : '#475569' }}>Adjuntar archivo</Typography>
                    </Stack>
                    {!selectedFile ? (
                      <>
                        <Typography sx={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>Selecciona el archivo Excel con los datos.</Typography>
                        <Button component="label" variant="outlined" startIcon={<UploadIcon />}
                          sx={{ borderRadius: '8px', py: 0.9, textTransform: 'none', fontWeight: 700, fontSize: 12, borderColor: '#cbd5e1', color: '#475569', bgcolor: '#fff', '&:hover': { borderColor: '#1d4ed8', color: '#1d4ed8', bgcolor: '#eff6ff' } }}>
                          Seleccionar archivo
                          <input type="file" hidden accept=".xlsx,.xls" onChange={handleFileSelect} />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, bgcolor: '#fff', borderRadius: '7px', border: '1px solid #bfdbfe', px: 1.2, py: 0.5, minWidth: 0 }}>
                          <UploadIcon sx={{ color: '#1d4ed8', fontSize: 14, flexShrink: 0 }} />
                          <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: '#1d4ed8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{selectedFile.name}</Typography>
                          <Tooltip title="Quitar archivo" placement="top">
                            <IconButton size="small" onClick={() => setSelectedFile(null)} sx={{ width: 20, height: 20, flexShrink: 0, color: '#94a3b8', '&:hover': { bgcolor: '#fee2e2', color: '#b91c1c' } }}>
                              <ClearIcon sx={{ fontSize: 13 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                        <Button component="label" variant="text"
                          sx={{ borderRadius: '8px', py: 0.5, textTransform: 'none', fontWeight: 600, fontSize: 11, color: '#64748b', alignSelf: 'flex-start', '&:hover': { color: '#1d4ed8' } }}>
                          Cambiar archivo
                          <input type="file" hidden accept=".xlsx,.xls" onChange={handleFileSelect} />
                        </Button>
                      </>
                    )}
                  </Box>

                  {/* Flecha 2→3 */}
                  <Typography sx={{ color: '#94a3b8', fontWeight: 900, fontSize: 20, textAlign: 'center', display: { xs: 'none', md: 'block' } }}>→</Typography>

                  {/* Paso 3 – Cargar al servidor */}
                  <Box sx={{ borderRadius: '10px', border: `1.5px solid ${selectedFile ? '#bbf7d0' : '#e2e8f0'}`, bgcolor: selectedFile ? '#f0fdf4' : '#fafafa', p: 1.6, display: 'flex', flexDirection: 'column', gap: 1, transition: 'all 0.2s' }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: selectedFile ? '#15803d' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                        <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 11, lineHeight: 1 }}>3</Typography>
                      </Box>
                      <Typography sx={{ fontWeight: 800, fontSize: 12, color: selectedFile ? '#14532d' : '#475569' }}>Cargar al servidor</Typography>
                    </Stack>
                    <Typography sx={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>Importa los datos a la base de PostgreSQL.</Typography>
                    <Button variant="contained" disabled={!selectedFile || importing} onClick={handleImport}
                      sx={{ borderRadius: '8px', py: 0.9, textTransform: 'none', fontWeight: 700, fontSize: 12, bgcolor: '#15803d', boxShadow: selectedFile ? '0 4px 14px #15803d30' : 'none', '&:hover': { bgcolor: '#166534', boxShadow: 'none' }, '&:disabled': { bgcolor: '#e2e8f0', boxShadow: 'none' } }}>
                      {importing ? 'Cargando...' : 'Cargar libro completo'}
                    </Button>
                  </Box>

                </Box>

                <Box sx={{ mt: 1.4, px: 1.4, py: 0.9, bgcolor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                  <Typography sx={{ fontSize: 11.5, color: '#64748b' }}>
                    <Box component="span" sx={{ fontWeight: 700, color: '#334155' }}>Hojas requeridas: </Box>
                    {['BD_SGD_UNICESMAG','POLITICAS','PLANTILLAS'].map((s) => (
                      <Box key={s} component="span" sx={{ fontFamily: 'monospace', bgcolor: '#e2e8f0', color: '#1e40af', px: 0.6, py: 0.1, borderRadius: '4px', fontSize: 10.5, fontWeight: 700, mx: 0.3 }}>{s}</Box>
                    ))}
                  </Typography>
                </Box>
              </Box>

              {/* Divider */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ flex: 1, height: '1px', bgcolor: '#f1f5f9' }} />
                <Typography sx={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap' }}>o sincroniza directo desde Sheets</Typography>
                <Box sx={{ flex: 1, height: '1px', bgcolor: '#f1f5f9' }} />
              </Box>

              {/* Sección 2 – Google Sheets */}
              <Box>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.6 }}>
                  <Box sx={{ width: 4, height: 18, borderRadius: 2, background: 'linear-gradient(180deg,#0f766e,#14b8a6)' }} />
                  <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#0f5652', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Sincronización con Google Sheets</Typography>
                </Stack>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>

                  {/* Actualizar incremental – RECOMENDADO */}
                  <Box sx={{ borderRadius: '12px', border: '1.5px solid #bfdbfe', background: 'linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%)', p: 2.2, display: 'flex', flexDirection: 'column', gap: 1.4, position: 'relative', overflow: 'hidden' }}>
                    <Chip label="RECOMENDADO" size="small" sx={{ position: 'absolute', top: 12, right: 12, bgcolor: '#1d4ed8', color: '#fff', fontWeight: 800, fontSize: 9, height: 18, letterSpacing: '0.4px' }} />
                    <Box>
                      <Typography sx={{ fontWeight: 900, fontSize: 13.5, color: '#1e3a8a', pr: 10 }}>Actualizar servidor desde Sheets</Typography>
                      <Typography sx={{ fontSize: 11.5, color: '#3b82f6', mt: 0.4, lineHeight: 1.5 }}>Agrega nuevos documentos y actualiza los existentes <strong>sin borrar la base</strong>.</Typography>
                    </Box>
                    <Button variant="contained" disabled={syncingSheet} onClick={() => handleSyncFromSheets('incremental')}
                      sx={{ borderRadius: '8px', py: 1.15, textTransform: 'none', fontWeight: 700, fontSize: 13, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', boxShadow: '0 4px 14px #1d4ed840', '&:hover': { background: 'linear-gradient(135deg,#1e40af,#1d4ed8)', boxShadow: 'none' }, alignSelf: 'flex-start', minWidth: 190 }}>
                      {syncingSheet ? 'Cargando Sheets...' : 'Actualizar desde Sheets'}
                    </Button>
                  </Box>

                  {/* Sincronizar completo – USO EVENTUAL */}
                  <Box sx={{ borderRadius: '12px', border: '1.5px solid #fde68a', background: 'linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%)', p: 2.2, display: 'flex', flexDirection: 'column', gap: 1.4, position: 'relative', overflow: 'hidden' }}>
                    <Chip label="USO EVENTUAL" size="small" sx={{ position: 'absolute', top: 12, right: 12, bgcolor: '#b45309', color: '#fff', fontWeight: 800, fontSize: 9, height: 18, letterSpacing: '0.4px' }} />
                    <Box>
                      <Typography sx={{ fontWeight: 900, fontSize: 13.5, color: '#78350f', pr: 12 }}>Sincronizar todo desde Sheets</Typography>
                      <Typography sx={{ fontSize: 11.5, color: '#d97706', mt: 0.4, lineHeight: 1.5 }}>Recorre <strong>todas</strong> las filas. Úsalo solo si hay inconsistencias graves.</Typography>
                    </Box>
                    <Button variant="outlined" color="warning" disabled={syncingSheet} onClick={() => handleSyncFromSheets('reemplazar')}
                      sx={{ borderRadius: '8px', py: 1.15, textTransform: 'none', fontWeight: 700, fontSize: 13, borderColor: '#f59e0b', color: '#b45309', bgcolor: '#fff', '&:hover': { bgcolor: '#fef3c7', borderColor: '#d97706' }, alignSelf: 'flex-start', minWidth: 190 }}>
                      {syncingSheet ? 'Sincronizando...' : 'Sincronizar todo'}
                    </Button>
                  </Box>

                </Box>
              </Box>

            </Box>
          </Paper>
        )}

        {/* Header para usuarios Consulta */}
        {!canManageDocumental && (
          <Box sx={{ mb: 2.5, px: 3, py: 2.2, borderRadius: '14px', display: 'flex', alignItems: 'center', gap: 1.8, background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 60%, #2563eb 100%)', boxShadow: '0 8px 24px rgba(29,78,216,0.18)' }}>
            <Box sx={{ width: 46, height: 46, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <SearchIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography sx={{ fontWeight: 900, fontSize: 17, color: '#fff', lineHeight: 1.2 }}>Consulta de Documentos</Typography>
                <Box sx={{ px: 1.4, py: 0.3, borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.35)', flexShrink: 0, backdropFilter: 'blur(4px)' }}>
                  <Typography sx={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.92)', letterSpacing: '1px', textTransform: 'uppercase' }}>SIAC</Typography>
                </Box>
              </Stack>
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', mt: 0.3 }}>Accede y encuentra documentos institucionales de forma rápida y clara</Typography>
            </Box>
          </Box>
        )}

        <Slide direction="down" in={true} timeout={400}>
          <Paper elevation={0} sx={{ mb: 3, borderRadius: '14px', overflow: 'hidden', border: `1px solid ${hasActiveFilters ? '#93c5fd' : '#e2e8f0'}`, boxShadow: hasActiveFilters ? '0 4px 20px rgba(37,99,235,0.10)' : '0 2px 12px rgba(15,23,42,0.06)' }}>

            {/* Tabs — ancho completo igual para cada tab */}
            <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${DOCUMENT_SCOPE_TABS.length}, 1fr)`, borderBottom: '2px solid #e2e8f0', bgcolor: '#fafbff' }}>
              {DOCUMENT_SCOPE_TABS.map((tab) => {
                const selected = activeDocumentScope === tab.key;
                const Icon = tab.Icon;
                const helpText = tab.key === 'documentos'
                  ? 'Todos los documentos registrados en el sistema documental institucional.'
                  : tab.helper;
                return (
                  <Box key={tab.key} onClick={() => handleDocumentScopeChange(tab.key)} role="button" tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleDocumentScopeChange(tab.key); }}
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.2, px: 2, py: 1.6, cursor: 'pointer', outline: 'none', userSelect: 'none', transition: 'all 0.15s', position: 'relative',
                      borderBottom: `3px solid ${selected ? '#2563eb' : 'transparent'}`,
                      bgcolor: selected ? '#fff' : 'transparent',
                      '&:hover': { bgcolor: '#f0f6ff' },
                      '&:not(:last-child)': { borderRight: '1px solid #f1f5f9' },
                      '&:focus-visible': { outline: '2px solid #2563eb', outlineOffset: '-2px' }
                    }}
                  >
                    <Box sx={{ width: 32, height: 32, borderRadius: '9px', display: 'grid', placeItems: 'center', bgcolor: selected ? '#2563eb' : '#eef0f5', color: selected ? '#fff' : '#94a3b8', flexShrink: 0, transition: 'all 0.15s' }}>
                      <Icon sx={{ fontSize: 17 }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" spacing={0.7}>
                        <Typography sx={{ fontWeight: selected ? 800 : 600, fontSize: { xs: 12, sm: 13.5 }, color: selected ? '#1e3a8a' : '#64748b', transition: 'color 0.15s', lineHeight: 1.2 }}>{tab.label}</Typography>
                        <Tooltip
                          arrow
                          enterTouchDelay={0}
                          placement="top"
                          title={<Typography sx={{ fontSize: 12, lineHeight: 1.35, fontWeight: 600 }}>{helpText}</Typography>}
                        >
                          <IconButton
                            size="small"
                            onClick={(event) => event.stopPropagation()}
                            onMouseDown={(event) => event.stopPropagation()}
                            sx={{
                              width: 20,
                              height: 20,
                              color: selected ? '#2563eb' : '#94a3b8',
                              bgcolor: selected ? '#eff6ff' : '#f1f5f9',
                              border: `1px solid ${selected ? '#bfdbfe' : '#e2e8f0'}`,
                              animation: selected ? 'helpPulse 1.8s ease-in-out 2' : 'none',
                              '@keyframes helpPulse': {
                                '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(37,99,235,0.28)' },
                                '55%': { transform: 'scale(1.08)', boxShadow: '0 0 0 6px rgba(37,99,235,0)' },
                                '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(37,99,235,0)' }
                              },
                              '&:hover': { bgcolor: '#dbeafe', color: '#1d4ed8' }
                            }}
                          >
                            <HelpOutlineIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Box>
                  </Box>
                );
              })}
            </Box>

            {/* Cuerpo: búsqueda + filtros */}
            <Box sx={{ px: 2.2, py: 2, display: 'flex', flexDirection: 'column', gap: 1.6 }}>

              {/* Buscador */}
              <TextField fullWidth size="small" value={filters.titulo}
                onChange={(e) => setFilters({ ...filters, titulo: e.target.value })}
                placeholder="Buscar por título, código, palabras clave o consecutivos..."
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#93c5fd', fontSize: 19 }} /></InputAdornment> }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px', bgcolor: '#f0f6ff', fontSize: 13.5,
                    boxShadow: '0 0 0 3px rgba(37,99,235,0.08)',
                    animation: 'searchPulse 3s ease-in-out infinite',
                    '@keyframes searchPulse': {
                      '0%':   { boxShadow: '0 0 0 3px rgba(37,99,235,0.08)' },
                      '50%':  { boxShadow: '0 0 0 5px rgba(37,99,235,0.18)' },
                      '100%': { boxShadow: '0 0 0 3px rgba(37,99,235,0.08)' },
                    },
                    '& fieldset': { borderColor: '#93c5fd', borderWidth: 1.5 },
                    '&:hover fieldset': { borderColor: '#3b82f6', borderWidth: 1.5 },
                    '&.Mui-focused': {
                      bgcolor: '#fff',
                      animation: 'none',
                      boxShadow: '0 0 0 4px rgba(37,99,235,0.20)',
                    },
                    '&.Mui-focused fieldset': { borderColor: '#2563eb', borderWidth: 2 },
                  }
                }}
              />

              {/* Filtros desplegables */}
              <Box sx={{ overflowX: 'auto' }}>
                <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr 1fr 1fr', minWidth: 780 }}>
                  <DocFilterPanel label="Macroproceso" options={macroOptions} value={selMacros} onChange={handleMacroChange} placeholder="Buscar macroproceso..." />
                  <DocFilterPanel label="Proceso" options={procesoOptions} value={selProcesos} onChange={handleProcesoChange} placeholder="Buscar proceso..." />
                  <DocFilterPanel label="Subproceso" options={subprocesoOptions} value={selSubprocesos} onChange={setSelSubprocesos} placeholder="Buscar subproceso..." />
                  <DocFilterPanel label="Tipo documento" options={tipoOptions} value={selTipos} onChange={setSelTipos} placeholder="Buscar tipo..." />
                </Box>
              </Box>

              {/* Fila inferior: segmentadores (solo gestión/admin) + acciones */}
              {(() => {
                const currentScope = filters.estado_scope || 'vigente';
                const segments = [
                  { key: 'vigente',     label: 'Vigente',         activeBg: '#f0fdf4', activeBorder: '#4ade80', activeText: '#166534', activeDot: '#10b981' },
                  { key: 'en_revision', label: 'En construcción', activeBg: '#fffbeb', activeBorder: '#fbbf24', activeText: '#92400e', activeDot: '#f59e0b' },
                  { key: 'obsoleto',    label: 'Inactivos',       activeBg: '#f8fafc', activeBorder: '#94a3b8', activeText: '#475569', activeDot: '#94a3b8' },
                ];
                return (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.2, pt: 0.5, borderTop: '1px solid #f1f5f9' }}>
                    <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap' }}>
                      {/* Segmentador Formatos Digitalizados */}
                      <Box sx={{ display: 'flex', borderRadius: '10px', bgcolor: '#f1f5f9', border: '1px solid #d1d5db', overflow: 'hidden' }}>
                          <Box
                            onClick={() => {
                              const val = !filters.formatos_digitales;
                              const newFilters = { ...filters, formatos_digitales: val };
                              setFilters(newFilters);
                              const requestId = ++documentRequestId.current;
                              skipNextDocumentFilterEffect.current = true;
                              setLoading(true);
                              setPage(0);
                              setHasSearched(true);
                              setManualSearchMode(true);
                              documentoService.getDocumentos(newFilters, 1, rowsPerPage)
                                .then((response) => {
                                  if (requestId !== documentRequestId.current) return;
                                  if (response.success) {
                                    setDocumentos(response.data.documentos || []);
                                    setTotalDocumentos(response.data.pagination.total);
                                  }
                                })
                                .catch(() => {})
                                .finally(() => { if (requestId === documentRequestId.current) setLoading(false); });
                            }}
                            sx={{
                              display: 'flex', alignItems: 'center', gap: 0.7,
                              px: 1.6, py: 0.7,
                              cursor: 'pointer', userSelect: 'none', transition: 'all 0.18s',
                              bgcolor: filters.formatos_digitales ? '#dbeafe' : 'transparent',
                              borderTop: `2.5px solid ${filters.formatos_digitales ? '#3b82f6' : 'transparent'}`,
                              '&:hover': { bgcolor: filters.formatos_digitales ? '#dbeafe' : '#e9eef5' }
                            }}>
                            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: filters.formatos_digitales ? '#3b82f6' : '#d1d5db', flexShrink: 0, transition: 'all 0.18s', boxShadow: filters.formatos_digitales ? `0 0 0 2.5px #3b82f630` : 'none' }} />
                            <Typography sx={{ fontSize: 11.5, fontWeight: filters.formatos_digitales ? 800 : 500, color: filters.formatos_digitales ? '#1d4ed8' : '#6b7280', whiteSpace: 'nowrap', transition: 'all 0.18s' }}>Formatos digitalizados</Typography>
                          </Box>
                      </Box>

                      {/* Segmentadores — solo roles con gestión documental */}
                      {canManageDocumental && (
                        <Box sx={{ display: 'flex', borderRadius: '10px', bgcolor: '#f1f5f9', border: '1px solid #d1d5db', overflow: 'hidden' }}>
                          {segments.map((seg, idx) => {
                        const active = currentScope === seg.key;
                        return (
                          <Box key={seg.key} onClick={() => handleSegmentChange(seg.key)}
                            sx={{
                              display: 'flex', alignItems: 'center', gap: 0.7,
                              px: 1.6, py: 0.7,
                              cursor: 'pointer', userSelect: 'none', transition: 'all 0.18s',
                              bgcolor: active ? seg.activeBg : 'transparent',
                              borderTop: `2.5px solid ${active ? seg.activeDot : 'transparent'}`,
                              borderLeft: idx > 0 ? `1.5px solid ${active ? seg.activeDot + '55' : '#d1d5db'}` : 'none',
                              '&:hover': { bgcolor: active ? seg.activeBg : '#e9eef5' }
                            }}>
                            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: active ? seg.activeDot : '#d1d5db', flexShrink: 0, transition: 'all 0.18s', boxShadow: active ? `0 0 0 2.5px ${seg.activeDot}30` : 'none' }} />
                            <Typography sx={{ fontSize: 11.5, fontWeight: active ? 800 : 500, color: active ? seg.activeText : '#6b7280', whiteSpace: 'nowrap', transition: 'all 0.18s' }}>{seg.label}</Typography>
                          </Box>
                        );
                      })}
                    </Box>
                    )}
                    </Box>

                    {/* Botones acción */}
                    <Stack direction="row" spacing={1}>
                      <Button variant="contained" startIcon={<SearchIcon />} onClick={handleSearch}
                        sx={{ borderRadius: '9px', textTransform: 'none', fontWeight: 700, py: 1, px: 2.5, fontSize: 14, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', boxShadow: '0 4px 14px rgba(37,99,235,0.35)', '&:hover': { background: 'linear-gradient(135deg,#1d4ed8,#1e40af)', boxShadow: '0 6px 18px rgba(37,99,235,0.45)' } }}>
                        Buscar
                      </Button>
                      <Button variant="outlined" startIcon={<ClearIcon sx={{ fontSize: 14 }} />} onClick={handleClearFilters}
                        sx={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600, py: 0.7, px: 1.8, fontSize: 12, borderColor: '#dde3ed', color: '#94a3b8', bgcolor: '#f8fafc', whiteSpace: 'nowrap', minWidth: 0, letterSpacing: '0.2px', '&:hover': { borderColor: '#93c5fd', color: '#1d4ed8', bgcolor: '#eff6ff' } }}>
                        Limpiar
                      </Button>
                    </Stack>
                  </Box>
                );
              })()}

            </Box>
          </Paper>
        </Slide>

        <Paper elevation={0} sx={{ border: '1px solid #dbe3ee', borderRadius: 0, overflow: 'hidden', position: 'relative', boxShadow: '0 4px 14px rgba(15,23,42,0.04)' }}>
            {loading && displayDocumentos.length > 0 && (
              <LinearProgress
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  zIndex: 2,
                  bgcolor: '#dbeafe',
                  '& .MuiLinearProgress-bar': { bgcolor: '#2563eb' }
                }}
              />
            )}
            {loading && displayDocumentos.length === 0 ? (
              <Box sx={{ p: { xs: 4, md: 5 }, textAlign: 'center', minHeight: 150, display: 'grid', placeItems: 'center' }}>
                <Box sx={{ width: 'min(420px, 100%)' }}>
                  <LinearProgress
                    sx={{
                      height: 6,
                      borderRadius: 999,
                      bgcolor: '#dbeafe',
                      '& .MuiLinearProgress-bar': { borderRadius: 999, bgcolor: '#2563eb' }
                    }}
                  />
                  <Typography variant="body2" sx={{ color: '#64748b', mt: 2, fontWeight: 700 }}>
                    Cargando documentos...
                  </Typography>
                </Box>
              </Box>
            ) : displayDocumentos.length === 0 ? (
              <Box sx={{ p: 10, textAlign: 'center' }}>
                <Box sx={{ width: 100, height: 100, borderRadius: '50%', bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', mb: 3 }}>
                  <SearchIcon sx={{ fontSize: 50, color: '#94a3b8' }} />
                </Box>
                <Typography variant="h5" sx={{ color: '#475569', fontWeight: 700, mb: 1 }}>
                  {hasSearched ? 'No se encontraron documentos' : 'Selecciona un filtro o presiona Buscar'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#94a3b8', maxWidth: 400, mx: 'auto' }}>
                  {hasActiveFilters ? 'Intenta ajustar los criterios de búsqueda o limpia los filtros' : 'Selecciona al menos un criterio y presiona el botón "Buscar"'}
                </Typography>
              </Box>
            ) : (
              <>
                <TableContainer
                  sx={{
                    width: '100%',
                    maxWidth: '100%',
                    overflowX: 'auto',
                    scrollbarWidth: 'thin',
                    '&::-webkit-scrollbar': { height: 8 },
                    '&::-webkit-scrollbar-track': { bgcolor: '#f8fafc' },
                    '&::-webkit-scrollbar-thumb': { bgcolor: '#cbd5e1', borderRadius: 8 }
                  }}
                >
                  <Table
                    sx={{
                      width: '100%',
                      minWidth: { xs: 820, sm: 900, lg: 1020 },
                      tableLayout: 'fixed',
                      '& .MuiTableCell-root': {
                        borderRight: '1px solid #eef2f7'
                      },
                      '& .MuiTableCell-root:last-of-type': {
                        borderRight: 0
                      }
                    }}
                  >
                    <colgroup>
                      <col style={{ width: '104px' }} />
                      <col style={{ width: '106px' }} />
                      <col style={{ width: '24%' }} />
                      <col style={{ width: '150px' }} />
                      <col style={{ width: '96px' }} />
                      <col style={{ width: '58px' }} />
                      {canManageDocumental && <col style={{ width: '78px' }} />}
                      <col style={{ width: '108px' }} />
                    </colgroup>
                    <TableHead>
                      <TableRow sx={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)' }}>
                        {[
                          { label: 'Código',           align: 'left'   },
                          { label: 'Tipo',             align: 'left'   },
                          { label: 'Nombre Documento', align: 'left'   },
                          { label: 'Autor',            align: 'left'   },
                          { label: 'Fecha Creación',   align: 'left'   },
                          { label: 'Versión',          align: 'center' },
                          ...(canManageDocumental ? [{ label: 'Estado', align: 'center' }] : []),
                          { label: 'Acciones',         align: 'center' },
                        ].map(({ label, align }) => (
                          <TableCell key={label} align={align} sx={{ fontWeight: 800, color: '#fff', fontSize: { xs: 9.5, sm: 10, md: 10.5 }, borderBottom: 'none', borderRight: '1px solid rgba(255,255,255,0.18)', textTransform: 'uppercase', letterSpacing: 0, py: { xs: 0.65, md: 0.85 }, px: { xs: 0.35, sm: 0.5, md: 0.65 }, whiteSpace: 'normal', lineHeight: 1.12, borderRadius: 0 }}>
                            {label}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {displayDocumentos.map((doc) => {
                          const isFavorite = favoriteIds.has(String(doc.id));
                          const normalized = normalizeDocFields(doc);
                          return (
                            <TableRow key={doc.id} hover sx={{ height: { xs: 46, sm: 50, md: 54 }, '&:hover': { bgcolor: '#f8fafc' }, transition: 'all 0.2s', cursor: 'pointer', '& .MuiTableCell-root': { borderBottom: '1px solid #e6edf5', borderRight: '1px solid #eef2f7', verticalAlign: 'middle' }, '& .MuiTableCell-root:last-of-type': { borderRight: 0 } }}>
                              <TableCell sx={{ fontWeight: 700, color: '#2563eb', fontSize: { xs: 10.25, sm: 11, md: 11.5 }, fontFamily: 'monospace', px: { xs: 0.35, sm: 0.5, md: 0.65 }, py: 0.45, overflowWrap: 'anywhere', lineHeight: 1.15 }}>{normalized.codigo}</TableCell>
                              <TableCell sx={{ px: { xs: 0.35, sm: 0.5, md: 0.65 }, py: 0.45 }}>
                                <Chip
                                  icon={getFormatoIcon(doc)}
                                  label={normalized.tipo || 'N/A'}
                                  size="small"
                                  sx={{
                                    bgcolor: getTipoColor(normalized.tipo).bg,
                                    color: getTipoColor(normalized.tipo).color,
                                    fontWeight: 700,
                                    fontSize: { xs: 9, sm: 9.75, md: 10.5 },
                                    height: { xs: 19, sm: 20, md: 22 },
                                    borderRadius: 1,
                                    px: 0.3,
                                    '& .MuiChip-label': { px: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
                                    '& .MuiChip-icon': { color: `${getFormatoColor(doc)} !important`, fontSize: { xs: 15, sm: 16, md: 18 }, ml: 0.2 }
                                  }}
                                />
                              </TableCell>
                              <TableCell sx={{ color: '#111827', fontWeight: 700, fontSize: { xs: 10.75, sm: 11.25, md: 12 }, px: { xs: 0.35, sm: 0.5, md: 0.65 }, py: 0.45, lineHeight: 1.2, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                <Box component="span" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{normalized.titulo}</Box>
                              </TableCell>
                              <TableCell sx={{ color: '#475569', fontSize: { xs: 10.5, sm: 11.25, md: 12 }, px: { xs: 0.35, sm: 0.5, md: 0.65 }, py: 0.45, lineHeight: 1.2, overflowWrap: 'anywhere' }}>
                                <Box component="span" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{doc.autor || '-'}</Box>
                              </TableCell>
                              <TableCell sx={{ color: '#475569', fontSize: { xs: 10.5, sm: 11.25, md: 12 }, whiteSpace: 'nowrap', px: { xs: 0.35, sm: 0.5, md: 0.65 }, py: 0.45 }}>{formatDate(getDocumentoFechaCreacion(doc))}</TableCell>
                              <TableCell align="center" sx={{ px: 0.35, py: 0.45 }}>
                                <Chip label={`v${doc.version || '1.0'}`} size="small" sx={{ height: { xs: 18, md: 20 }, bgcolor: '#f1f5f9', color: '#475569', fontWeight: 700, fontSize: { xs: 9, md: 10 }, fontFamily: 'monospace', borderRadius: 1 }} />
                              </TableCell>
                              {canManageDocumental && (
                              <TableCell align="center" sx={{ px: 0.35, py: 0.45 }}>
                                <Chip label={getEstadoLabel(doc.estado)} color={getEstadoColor(doc.estado)} size="small" sx={{ height: { xs: 18, md: 21 }, color: '#fff', fontWeight: 700, textTransform: 'uppercase', fontSize: { xs: 8.5, sm: 9.25, md: 10 }, borderRadius: 1, '& .MuiChip-label': { px: { xs: 0.45, md: 0.8 } } }} />
                              </TableCell>
                              )}
                              <TableCell align="center" sx={{ px: 0.35, py: 0.45 }}>
                                <Stack direction="row" spacing={{ xs: 0.25, sm: 0.35, md: 0.45 }} justifyContent="center" flexWrap="nowrap">

                                  <Tooltip title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'} arrow>
                                    <span>
                                      <IconButton
                                        size="small"
                                        onClick={() => toggleFavorite(doc.id)}
                                        disabled={loadingFavorites}
                                        sx={{
                                          width: { xs: 24, sm: 26, md: 28 },
                                          height: { xs: 24, sm: 26, md: 28 },
                                          color: isFavorite ? '#ef4444' : '#94a3b8',
                                          bgcolor: isFavorite ? '#fee2e2' : '#f1f5f9',
                                          '&:hover': { bgcolor: isFavorite ? '#fecaca' : '#e2e8f0' },
                                          '&:disabled': { opacity: 0.5 }
                                        }}
                                      >
                                        {isFavorite ? <FavoriteIcon sx={{ fontSize: { xs: 15, md: 17 } }} /> : <FavoriteBorderIcon sx={{ fontSize: { xs: 15, md: 17 } }} />}
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  {isReporteSalidaDocument(doc) && reporteSalidaFeature.canToggle && (
                                    <Tooltip title={reporteSalidaFeature.enabled ? 'Desactivar formulario de reporte de salida' : 'Activar formulario de reporte de salida'} arrow>
                                      <span>
                                        <Switch
                                          size="small"
                                          checked={reporteSalidaFeature.enabled}
                                          disabled={reporteSalidaFeature.loading}
                                          onChange={(event) => toggleReporteSalidaFeature(event.target.checked)}
                                          sx={{
                                            '& .MuiSwitch-switchBase.Mui-checked': { color: '#0f766e' },
                                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#0f766e' }
                                          }}
                                        />
                                      </span>
                                    </Tooltip>
                                  )}
                                  {reporteSalidaFeature.enabled && isReporteSalidaDocument(doc) && (
                                    <Tooltip title="Diligenciar reporte de salida" arrow>
                                      <span>
                                        <IconButton
                                          size="small"
                                          sx={{
                                            width: { xs: 24, sm: 26, md: 28 },
                                            height: { xs: 24, sm: 26, md: 28 },
                                            color: '#0f766e',
                                            bgcolor: '#ccfbf1',
                                            '&:hover': { bgcolor: '#99f6e4' }
                                          }}
                                          onClick={() => openReporteSalidaForm(doc)}
                                        >
                                          <PostAddIcon sx={{ fontSize: { xs: 15, md: 17 } }} />
                                        </IconButton>
                                      </span>
                                    </Tooltip>
                                  )}
                                  <Tooltip title="Ver documento" arrow>
                                    <span>
                                      <IconButton
                                        size="small"
                                        sx={{
                                          width: { xs: 24, sm: 26, md: 28 },
                                          height: { xs: 24, sm: 26, md: 28 },
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
                                        <VisibilityOutlinedIcon sx={{ fontSize: { xs: 15, md: 17 } }} />
                                      </IconButton>
                                    </span>
                                  </Tooltip>

                                  <Tooltip title="Descargar documento" arrow>
                                    <span>
                                      <IconButton
                                        size="small"
                                        sx={{
                                          width: { xs: 24, sm: 26, md: 28 },
                                          height: { xs: 24, sm: 26, md: 28 },
                                          color: '#059669',
                                          bgcolor: '#d1fae5',
                                          '&:hover': { bgcolor: '#a7f3d0' },
                                          '&:disabled': { opacity: 0.3 }
                                        }}
                                        disabled={!doc.link_acceso}
                                        onClick={() => handleDownload(doc, normalized)}
                                      >
                                        <FileDownloadOutlinedIcon sx={{ fontSize: { xs: 15, md: 17 } }} />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        })}
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
                  onRowsPerPageChange={handleChangeRowsPerPage} 
                  labelRowsPerPage="Mostrar:" 
                  sx={{ borderTop: '2px solid #e2e8f0', bgcolor: '#f8fafc' }} 
                />
              </>
            )}
        </Paper>
        <Dialog open={openClearDialog} onClose={handleCloseClearDialog} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 800 }}>
            Confirmar limpieza de base de datos
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
              Esta accion eliminara todos los documentos y favoritos asociados. Ingresa tu correo y escribe CONFIRMAR para continuar.
            </Typography>
            <TextField
              fullWidth
              label="Correo electronico"
              value={clearEmail}
              onChange={(event) => setClearEmail(event.target.value)}
              disabled={clearingDocuments}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label='Escribe "CONFIRMAR" para continuar'
              value={clearConfirmation}
              onChange={(event) => setClearConfirmation(event.target.value)}
              disabled={clearingDocuments}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={handleCloseClearDialog} disabled={clearingDocuments}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteSweepIcon />}
              onClick={handleClearServerDocuments}
              disabled={clearingDocuments || clearConfirmation.trim().toUpperCase() !== 'CONFIRMAR'}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
            >
              {clearingDocuments ? 'Limpiando...' : 'Confirmar limpieza'}
            </Button>
          </DialogActions>
        </Dialog>
        <ReporteSalidaFormDialog
          open={Boolean(reporteSalidaDoc)}
          documento={reporteSalidaDoc}
          user={user}
          onClose={() => setReporteSalidaDoc(null)}
          onSubmitted={(response) => enqueueSnackbar(response?.message || 'Solicitud radicada correctamente', { variant: 'success' })}
        />
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
                onClick={() => handleDownload(previewDoc, previewNormalized)}
                disabled={!previewDoc}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, px: 2 }}
              >
                Descargar
              </Button>
            </Stack>
          </DialogTitle>
          <DialogContent dividers sx={{ p: 0, height: { xs: '70vh', md: '80vh' } }}>
            {previewUrl ? (
              <Box sx={{ 
                width: '100%', 
                height: '100%', 
                bgcolor: '#ffffff', 
                position: 'relative', 
                overflow: 'hidden'
              }}>
                <Box
                  component="iframe"
                  title={previewTitle || 'Previsualizacion de documento'}
                  src={previewUrl}
                  sx={{
                    position: 'absolute',
                    top: previewKind === 'drive-file' ? -56 : 0,
                    left: previewKind === 'google-sheet' ? 0 : -50,
                    width: previewKind === 'google-sheet' ? 'calc(100% + 80px)' : 'calc(100% + 100px)',
                    height: previewKind === 'drive-file' ? 'calc(100% + 56px)' : '100%',
                    border: 0,
                    bgcolor: 'white'
                  }}
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
