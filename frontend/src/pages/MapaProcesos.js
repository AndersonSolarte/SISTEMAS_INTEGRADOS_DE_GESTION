import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Fade,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import {
  ManageSearch as ExploreIcon,
  FindInPage as FindIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import DocumentoCard from '../context/DocumentoCard';
import catalogoService from '../services/catalogoService';
import documentoService from '../services/documentoService';

// ── DocFilterPanel: checklist con búsqueda, select all y cascada ──────────────
function DocFilterPanel({ label, options, value, onChange, disabled, placeholder }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = options.filter((o) =>
    o.nombre.toLowerCase().includes(search.toLowerCase())
  );
  const allSelected = value.length === 0;
  const isSelected = (id) => value.includes(id);
  const toggle = (id) => onChange(isSelected(id) ? value.filter((v) => v !== id) : [...value, id]);
  const toggleAll = () => onChange(allSelected ? options.map((o) => o.id) : []);
  const isDisabled = disabled;

  const displayText = value.length === 0
    ? 'Todos'
    : `${value.length} seleccionado${value.length > 1 ? 's' : ''}`;

  const accentColor = '#0891b2';
  const accentLight = '#e0f2fe';
  const accentHover = '#f0f9ff';

  return (
    <Box ref={ref} sx={{ position: 'relative', opacity: isDisabled ? 0.5 : 1, pointerEvents: isDisabled ? 'none' : 'auto' }}>
      {/* Trigger */}
      <Box
        onClick={() => setOpen((o) => !o)}
        sx={{
          cursor: 'pointer', borderRadius: '10px', p: '10px 14px', minHeight: 52,
          bgcolor: value.length ? accentLight : '#fff',
          border: `1.5px solid ${value.length ? accentColor : '#e2e8f0'}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1,
          transition: 'all 0.15s', userSelect: 'none',
          '&:hover': { borderColor: accentColor, bgcolor: value.length ? '#bae6fd' : accentHover }
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: '9px', fontWeight: 700, color: accentColor, letterSpacing: '0.8px', textTransform: 'uppercase', mb: 0.25 }}>
            {label}
          </Typography>
          <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#0c4a6e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {displayText}
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
          {value.length > 0 && (
            <Box
              onClick={(e) => { e.stopPropagation(); onChange([]); }}
              sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', '&:hover': { bgcolor: '#0e7490' } }}
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </Box>
          )}
          <Box sx={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </Box>
        </Stack>
      </Box>

      {/* Dropdown */}
      {open && (
        <Box sx={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1400,
          width: '100%', minWidth: 240, bgcolor: '#fff', borderRadius: '12px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.14)', border: '1px solid #e2e8f0', overflow: 'hidden'
        }}>
          {/* Buscador */}
          <Box sx={{ p: 1.25, borderBottom: '1px solid #f1f5f9' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#f8fafc', borderRadius: '8px', px: 1.25, py: 0.75, border: '1px solid #e2e8f0' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder || 'Buscar...'}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, flex: 1, color: '#334155', minWidth: 0 }}
              />
            </Box>
          </Box>

          {/* Seleccionar todos */}
          <Box
            onClick={toggleAll}
            sx={{ px: 1.5, py: 0.875, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.25, borderBottom: '1px solid #f1f5f9', '&:hover': { bgcolor: accentHover } }}
          >
            <Box sx={{ width: 15, height: 15, flexShrink: 0, borderRadius: '4px', border: `2px solid ${allSelected ? accentColor : '#d1d5db'}`, bgcolor: allSelected ? accentColor : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {allSelected && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
            </Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: accentColor }}>
              Seleccionar todos ({options.length})
            </Typography>
          </Box>

          {/* Lista */}
          <Box sx={{ maxHeight: 220, overflow: 'auto' }}>
            {filtered.length === 0 ? (
              <Box sx={{ px: 2, py: 2, textAlign: 'center' }}>
                <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>Sin resultados</Typography>
              </Box>
            ) : filtered.map((opt) => (
              <Box
                key={opt.id}
                onClick={() => toggle(opt.id)}
                sx={{ px: 1.5, py: 0.75, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.25, '&:hover': { bgcolor: accentHover } }}
              >
                <Box sx={{ width: 15, height: 15, flexShrink: 0, borderRadius: '4px', border: `2px solid ${isSelected(opt.id) ? accentColor : '#d1d5db'}`, bgcolor: isSelected(opt.id) ? accentColor : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isSelected(opt.id) && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </Box>
                <Typography sx={{ fontSize: 12, color: '#334155' }}>{opt.nombre}</Typography>
              </Box>
            ))}
          </Box>

          {/* Footer */}
          <Box sx={{ px: 1.5, py: 0.75, borderTop: '1px solid #f1f5f9', bgcolor: '#f8fafc' }}>
            <Typography sx={{ fontSize: '10px', color: '#94a3b8' }}>
              {value.length > 0 ? `${value.length} de ${options.length} seleccionados` : `${options.length} opciones`}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}
// ── fin DocFilterPanel ─────────────────────────────────────────────────────────

function MapaProcesos() {
  const { enqueueSnackbar } = useSnackbar();

  // Filtros multi-select (arrays de IDs)
  const [selectedMacros,      setSelectedMacros]      = useState([]);
  const [selectedProcesos,    setSelectedProcesos]    = useState([]);
  const [selectedSubprocesos, setSelectedSubprocesos] = useState([]);
  const [selectedTipos,       setSelectedTipos]       = useState([]);
  const [searchText, setSearchText] = useState('');
  const [estado,     setEstado]     = useState('');

  // Catálogos disponibles
  const [macroProcesos, setMacroProcesos] = useState([]);
  const [procesos,      setProcesos]      = useState([]);
  const [subprocesos,   setSubprocesos]   = useState([]);
  const [tipos,         setTipos]         = useState([]);

  const [loadingCatalogs,  setLoadingCatalogs]  = useState(true);
  const [loadingProcesos,  setLoadingProcesos]  = useState(false);
  const [loadingSubproces, setLoadingSubproces] = useState(false);
  const [loadingDocs,      setLoadingDocs]      = useState(false);
  const [documentos,       setDocumentos]       = useState([]);

  // Construye params para el backend (solo envía si hay selección)
  const buildParams = useCallback((macros, procs, subs, tipos, text, est) => {
    const p = {};
    if (macros.length)  p.macro_proceso_id      = macros.join(',');
    if (procs.length)   p.proceso_id            = procs.join(',');
    if (subs.length)    p.subproceso_id         = subs.join(',');
    if (tipos.length)   p.tipo_documentacion_id = tipos.join(',');
    if (text.trim())    p.titulo                = text.trim();
    if (est)            p.estado                = est;
    return p;
  }, []);

  const loadDocumentos = useCallback(async (params) => {
    setLoadingDocs(true);
    try {
      const response = await documentoService.getDocumentos(params, 1, 50);
      setDocumentos(response?.data?.documentos || []);
    } catch {
      enqueueSnackbar('No fue posible cargar los documentos', { variant: 'error' });
    } finally {
      setLoadingDocs(false);
    }
  }, [enqueueSnackbar]);

  // Carga inicial: macroprocesos + tipos
  useEffect(() => {
    const loadInitial = async () => {
      setLoadingCatalogs(true);
      try {
        const [macroRes, tiposRes] = await Promise.all([
          catalogoService.getMacroProcesos(),
          catalogoService.getTiposDocumentacion()
        ]);
        setMacroProcesos(macroRes?.data?.macroProcesos || []);
        setTipos(tiposRes?.data?.tipos || []);
      } catch {
        enqueueSnackbar('No fue posible cargar catálogos', { variant: 'error' });
      } finally {
        setLoadingCatalogs(false);
      }
    };
    loadInitial();
    loadDocumentos({});
  }, [enqueueSnackbar, loadDocumentos]);

  // Cascada: macros → procesos
  useEffect(() => {
    if (!selectedMacros.length) {
      setProcesos([]);
      setSelectedProcesos([]);
      setSubprocesos([]);
      setSelectedSubprocesos([]);
      return;
    }
    setLoadingProcesos(true);
    catalogoService
      .getProcesos(selectedMacros.join(','))
      .then((r) => setProcesos(r?.data?.procesos || []))
      .catch(() => enqueueSnackbar('No fue posible cargar procesos', { variant: 'warning' }))
      .finally(() => setLoadingProcesos(false));
    // Resetear selección dependiente
    setSelectedProcesos([]);
    setSubprocesos([]);
    setSelectedSubprocesos([]);
  }, [selectedMacros, enqueueSnackbar]);

  // Cascada: procesos → subprocesos
  useEffect(() => {
    if (!selectedProcesos.length) {
      setSubprocesos([]);
      setSelectedSubprocesos([]);
      return;
    }
    setLoadingSubproces(true);
    catalogoService
      .getSubProcesos(selectedProcesos.join(','))
      .then((r) => setSubprocesos(r?.data?.subprocesos || []))
      .catch(() => enqueueSnackbar('No fue posible cargar subprocesos', { variant: 'warning' }))
      .finally(() => setLoadingSubproces(false));
    setSelectedSubprocesos([]);
  }, [selectedProcesos, enqueueSnackbar]);

  const handleSearch = () => {
    const params = buildParams(selectedMacros, selectedProcesos, selectedSubprocesos, selectedTipos, searchText, estado);
    loadDocumentos(params);
  };

  const handleClear = () => {
    setSelectedMacros([]);
    setSelectedProcesos([]);
    setSelectedSubprocesos([]);
    setSelectedTipos([]);
    setSearchText('');
    setEstado('');
    setProcesos([]);
    setSubprocesos([]);
    loadDocumentos({});
  };

  const stats = useMemo(() => {
    const vigentes  = documentos.filter((d) => d.estado === 'vigente').length;
    const tiposSet  = new Set(documentos.map((d) => d?.tipoDocumentacion?.nombre).filter(Boolean));
    return { total: documentos.length, vigentes, tipos: tiposSet.size };
  }, [documentos]);

  return (
    <Fade in={true} timeout={500}>
      <Box>
        {/* Header */}
        <Box sx={{
          mb: { xs: 2.5, md: 3 }, p: { xs: 2.5, sm: 3, md: 4 },
          borderRadius: { xs: 3, md: 4 },
          background: 'linear-gradient(120deg, #0f766e 0%, #0e7490 60%, #155e75 100%)',
          color: 'white', boxShadow: '0 10px 30px rgba(14, 116, 144, 0.25)',
          position: 'relative', overflow: 'hidden'
        }}>
          <Box sx={{ position: 'absolute', inset: 0, opacity: 0.2, background: 'radial-gradient(circle at 20% 10%, rgba(255,255,255,0.22), transparent 45%)' }} />
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <ExploreIcon fontSize="small" />
            <Typography variant="overline" sx={{ letterSpacing: 1.2, opacity: 0.9 }}>PERFIL CONSULTA</Typography>
          </Stack>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, fontSize: { xs: 22, sm: 26, md: 32 } }}>
            Consulta Documental Inteligente
          </Typography>
          <Typography sx={{ opacity: 0.95, fontSize: { xs: 13, sm: 14, md: 16 } }}>
            Encuentra documentos por proceso, tipo y estado en pocos clics. Diseñado para consulta rápida y navegación clara.
          </Typography>
        </Box>

        {/* Panel de filtros */}
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5, md: 3 }, borderRadius: 3, border: '1px solid #e2e8f0', mb: 3 }}>

          {/* Búsqueda por texto — fila superior */}
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="Buscar por título, código, palabras clave o consecutivos"
              placeholder="Ej: plan estratégico, SES-EN, 2024, FR-001, seguridad vial..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.disabled', fontSize: 18 }} /> }}
            />
          </Box>

          {/* Filtros cascada */}
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6} md={3}>
              <DocFilterPanel
                label="Macroproceso"
                options={macroProcesos}
                value={selectedMacros}
                onChange={setSelectedMacros}
                disabled={loadingCatalogs}
                placeholder="Buscar macroproceso..."
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <DocFilterPanel
                label={loadingProcesos ? 'Cargando procesos...' : 'Proceso'}
                options={procesos}
                value={selectedProcesos}
                onChange={setSelectedProcesos}
                disabled={loadingCatalogs || loadingProcesos || !selectedMacros.length}
                placeholder="Buscar proceso..."
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <DocFilterPanel
                label={loadingSubproces ? 'Cargando subprocesos...' : 'Subproceso'}
                options={subprocesos}
                value={selectedSubprocesos}
                onChange={setSelectedSubprocesos}
                disabled={loadingCatalogs || loadingSubproces || !selectedProcesos.length}
                placeholder="Buscar subproceso..."
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <DocFilterPanel
                label="Tipo de documento"
                options={tipos}
                value={selectedTipos}
                onChange={setSelectedTipos}
                disabled={loadingCatalogs}
                placeholder="Buscar tipo..."
              />
            </Grid>
          </Grid>

          {/* Estado + botones */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Estado</InputLabel>
              <Select value={estado} label="Estado" onChange={(e) => setEstado(e.target.value)}>
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="vigente">Vigente</MenuItem>
                <MenuItem value="en_revision">En Revisión</MenuItem>
                <MenuItem value="obsoleto">Obsoleto</MenuItem>
              </Select>
            </FormControl>

            <Button
              onClick={handleSearch}
              variant="contained"
              startIcon={<SearchIcon />}
              sx={{ flex: 1, textTransform: 'none', fontWeight: 700, background: 'linear-gradient(120deg, #0f766e, #0e7490)', minWidth: 120 }}
            >
              Buscar
            </Button>

            <Button
              onClick={handleClear}
              variant="outlined"
              sx={{ flex: 1, textTransform: 'none', fontWeight: 700, minWidth: 120 }}
            >
              Limpiar filtros
            </Button>
          </Stack>

          {/* Chips de filtros activos */}
          {(selectedMacros.length || selectedProcesos.length || selectedSubprocesos.length || selectedTipos.length || searchText || estado) ? (
            <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {selectedMacros.map((id) => {
                const m = macroProcesos.find((x) => x.id === id);
                return m ? <Chip key={id} size="small" label={m.nombre} onDelete={() => setSelectedMacros((p) => p.filter((v) => v !== id))} color="primary" variant="outlined" /> : null;
              })}
              {selectedProcesos.map((id) => {
                const p = procesos.find((x) => x.id === id);
                return p ? <Chip key={id} size="small" label={p.nombre} onDelete={() => setSelectedProcesos((prev) => prev.filter((v) => v !== id))} color="info" variant="outlined" /> : null;
              })}
              {selectedSubprocesos.map((id) => {
                const s = subprocesos.find((x) => x.id === id);
                return s ? <Chip key={id} size="small" label={s.nombre} onDelete={() => setSelectedSubprocesos((prev) => prev.filter((v) => v !== id))} color="secondary" variant="outlined" /> : null;
              })}
              {selectedTipos.map((id) => {
                const t = tipos.find((x) => x.id === id);
                return t ? <Chip key={id} size="small" label={t.nombre} onDelete={() => setSelectedTipos((prev) => prev.filter((v) => v !== id))} sx={{ borderColor: '#0891b2', color: '#0891b2' }} variant="outlined" /> : null;
              })}
              {searchText && <Chip size="small" label={`"${searchText}"`} onDelete={() => setSearchText('')} variant="outlined" />}
              {estado && <Chip size="small" label={estado} onDelete={() => setEstado('')} variant="outlined" />}
            </Box>
          ) : null}
        </Paper>

        {/* KPIs */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
              <CardContent>
                <Typography variant="caption" color="text.secondary">TOTAL RESULTADOS</Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f766e', fontSize: { xs: 22, sm: 26, md: 32 } }}>{stats.total}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
              <CardContent>
                <Typography variant="caption" color="text.secondary">DOCUMENTOS VIGENTES</Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#0ea5e9', fontSize: { xs: 22, sm: 26, md: 32 } }}>{stats.vigentes}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
              <CardContent>
                <Typography variant="caption" color="text.secondary">TIPOS EN LISTA</Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#475569', fontSize: { xs: 22, sm: 26, md: 32 } }}>{stats.tipos}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Resultados */}
        {loadingDocs ? (
          <Paper elevation={0} sx={{ p: 6, borderRadius: 3, border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <CircularProgress />
            <Typography sx={{ mt: 2, color: '#64748b' }}>Consultando documentos...</Typography>
          </Paper>
        ) : documentos.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 3 }}>
            No se encontraron documentos con estos filtros. Ajusta los criterios y vuelve a consultar.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {documentos.map((doc) => (
              <Grid item xs={12} md={6} lg={4} key={doc.id}>
                <DocumentoCard doc={doc} />
              </Grid>
            ))}
          </Grid>
        )}

        <Box sx={{ mt: 3 }}>
          <Alert icon={<FindIcon fontSize="inherit" />} severity="success" sx={{ borderRadius: 3 }}>
            Sugerencia: usa primero Macroproceso y Proceso para reducir resultados y encontrar más rápido el documento correcto.
          </Alert>
        </Box>
      </Box>
    </Fade>
  );
}

export default MapaProcesos;
