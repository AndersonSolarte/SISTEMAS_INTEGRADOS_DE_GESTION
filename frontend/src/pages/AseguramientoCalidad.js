import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Grid, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, FormControl, Select, MenuItem, CircularProgress, Chip, IconButton, Tooltip, Fade, Slide, Stack, Divider } from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon, OpenInNew as OpenInNewIcon, FileDownloadOutlined as FileDownloadOutlinedIcon, FilterList as FilterIcon, Description as DescriptionIcon, Article as ArticleIcon, AssignmentTurnedIn as AssignmentIcon, ListAlt as ListIcon, Policy as PolicyIcon, AccountTree as AccountTreeIcon, Upload as UploadIcon, GetApp as DownloadTemplateIcon } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import documentoService from '../services/documentoService';
import catalogoService from '../services/catalogoService';
import api from '../services/api';

// Función para extraer el ID de archivos de Google Drive
const extractGoogleDriveId = (url) => {
  if (!url) return null;
  
  const patterns = [
    /\/file\/d\/([^\/]+)/,
    /id=([^&]+)/,
    /\/d\/([^\/]+)\/view/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
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
  const fileId = extractGoogleDriveId(url);
  if (!fileId) return url;
  return `https://drive.google.com/file/d/${fileId}/preview`;
};

const getDownloadUrl = (url) => {
  const fileId = extractGoogleDriveId(url);
  if (!fileId) return url;
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
};

function AseguramientoCalidad() {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const location = useLocation();
  const [filters, setFilters] = useState({ macro_proceso_id: '', proceso_id: '', subproceso_id: '', tipo_documentacion_id: '', titulo: '', estado: '' });
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

  useEffect(() => {
    catalogoService.getMacroProcesos().then(r => setMacroProcesos(r.data.macroProcesos || []));
    catalogoService.getTiposDocumentacion().then(r => setTiposDocumentacion(r.data.tipos || []));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const quickTitulo = params.get('titulo');
    if (quickTitulo) {
      const nextFilters = { macro_proceso_id: '', proceso_id: '', subproceso_id: '', tipo_documentacion_id: '', titulo: quickTitulo, estado: '' };
      setFilters(nextFilters);
      setLoading(true);
      documentoService.getDocumentos(nextFilters, 1, 10)
        .then((response) => {
          if (response.success) {
            setDocumentos(response.data.documentos);
            setTotalDocumentos(response.data.pagination.total);
          }
        })
        .catch(() => enqueueSnackbar('Error al buscar documentos', { variant: 'error' }))
        .finally(() => setLoading(false));
    }
  }, [location.search, enqueueSnackbar]);

  useEffect(() => {
    if (filters.macro_proceso_id) {
      catalogoService.getProcesos(filters.macro_proceso_id).then(r => setProcesos(r.data.procesos || []));
    } else {
      setProcesos([]);
      setFilters(prev => ({ ...prev, proceso_id: '', subproceso_id: '' }));
    }
  }, [filters.macro_proceso_id]);

  useEffect(() => {
    if (filters.proceso_id) {
      catalogoService.getSubProcesos(filters.proceso_id).then(r => setSubprocesos(r.data.subprocesos || []));
    } else {
      setSubprocesos([]);
      setFilters(prev => ({ ...prev, subproceso_id: '' }));
    }
  }, [filters.proceso_id]);

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
      enqueueSnackbar('Error al buscar documentos', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setFilters({ macro_proceso_id: '', proceso_id: '', subproceso_id: '', tipo_documentacion_id: '', titulo: '', estado: '' });
    setDocumentos([]);
    setTotalDocumentos(0);
    setPage(0);
  };

  const handleChangePage = async (event, newPage) => {
    setPage(newPage);
    setLoading(true);
    try {
      const response = await documentoService.getDocumentos(filters, newPage + 1, rowsPerPage);
      if (response.success) {
        setDocumentos(response.data.documentos);
      }
    } catch (error) {
      enqueueSnackbar('Error al cargar documentos', { variant: 'error' });
    } finally {
      setLoading(false);
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
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'plantilla_documentos_sgc.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      enqueueSnackbar('Error al descargar plantilla', { variant: 'error' });
    }
  };

  const activeFiltersCount = Object.values(filters).filter(f => f !== '').length;
  const tiposDocumentacionDisplay = tiposDocumentacion.filter((td) => !isDocumentCode(td.nombre));

  return (
    <Fade in={true} timeout={500}>
      <Box>
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1 }}>
            <DescriptionIcon sx={{ color: '#1d4ed8' }} />
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b' }}>
              Consultar Documentos
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            Consulta documentación institucional con filtros claros y resultados rápidos
          </Typography>
        </Box>

        {/* IMPORTAR EXCEL (solo admin) */}
        {user?.role === 'administrador' && (
          <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid #e2e8f0', borderRadius: 3 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <UploadIcon sx={{ color: '#1d4ed8' }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Importar Documentos</Typography>
            </Stack>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <Button variant="outlined" fullWidth component="label" startIcon={<UploadIcon />} sx={{ borderRadius: 2, py: 1.5 }}>
                  {selectedFile ? selectedFile.name : 'Seleccionar Excel'}
                  <input type="file" hidden accept=".xlsx,.xls" onChange={handleFileSelect} />
                </Button>
              </Grid>
              <Grid item xs={12} md={3}>
                <Button variant="contained" fullWidth disabled={!selectedFile || importing} onClick={handleImport} sx={{ borderRadius: 2, py: 1.5 }}>
                  {importing ? 'Importando...' : 'Importar Ahora'}
                </Button>
              </Grid>
              <Grid item xs={12} md={3}>
                <Button variant="outlined" fullWidth startIcon={<DownloadTemplateIcon />} onClick={handleDownloadTemplate} sx={{ borderRadius: 2, py: 1.5 }}>
                  Descargar Plantilla
                </Button>
              </Grid>
            </Grid>
          </Paper>
        )}

        <Slide direction="down" in={true} timeout={600}>
          <Paper elevation={0} sx={{ p: 4, mb: 3, border: '1px solid #e2e8f0', borderRadius: 3, bgcolor: 'white' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
              <Box sx={{ width: 48, height: 48, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                <FilterIcon sx={{ color: 'white', fontSize: 24 }} />
              </Box>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>Filtros de Búsqueda</Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontSize: 13 }}>
                  {activeFiltersCount > 0 ? `${activeFiltersCount} filtro(s) aplicado(s) • Click en buscar para ver resultados` : 'Selecciona los criterios de búsqueda'}
                </Typography>
              </Box>
            </Box>
            
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={3}>
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mb: 1, display: 'block' }}>MACRO PROCESO</Typography>
                  <FormControl fullWidth>
                    <Select value={filters.macro_proceso_id} onChange={(e) => setFilters({ ...filters, macro_proceso_id: e.target.value })} displayEmpty sx={{ borderRadius: 2, bgcolor: filters.macro_proceso_id ? '#eff6ff' : 'white', '& .MuiOutlinedInput-notchedOutline': { borderColor: filters.macro_proceso_id ? '#3b82f6' : '#e2e8f0', borderWidth: 2 } }}>
                      <MenuItem value=""><em>Seleccionar...</em></MenuItem>
                      {macroProcesos.map((mp) => <MenuItem key={mp.id} value={mp.id}>{mp.nombre}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Box>
              </Grid>

              <Grid item xs={12} md={3}>
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mb: 1, display: 'block' }}>PROCESO</Typography>
                  <FormControl fullWidth disabled={!filters.macro_proceso_id}>
                    <Select value={filters.proceso_id} onChange={(e) => setFilters({ ...filters, proceso_id: e.target.value })} displayEmpty sx={{ borderRadius: 2, bgcolor: filters.proceso_id ? '#eff6ff' : 'white', '& .MuiOutlinedInput-notchedOutline': { borderColor: filters.proceso_id ? '#3b82f6' : '#e2e8f0', borderWidth: 2 } }}>
                      <MenuItem value=""><em>Seleccionar...</em></MenuItem>
                      {procesos.map((p) => <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Box>
              </Grid>

              <Grid item xs={12} md={3}>
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mb: 1, display: 'block' }}>SUBPROCESO</Typography>
                  <FormControl fullWidth disabled={!filters.proceso_id}>
                    <Select value={filters.subproceso_id} onChange={(e) => setFilters({ ...filters, subproceso_id: e.target.value })} displayEmpty sx={{ borderRadius: 2, bgcolor: filters.subproceso_id ? '#eff6ff' : 'white', '& .MuiOutlinedInput-notchedOutline': { borderColor: filters.subproceso_id ? '#3b82f6' : '#e2e8f0', borderWidth: 2 } }}>
                      <MenuItem value=""><em>Seleccionar...</em></MenuItem>
                      {subprocesos.map((sp) => <MenuItem key={sp.id} value={sp.id}>{sp.nombre}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Box>
              </Grid>

              <Grid item xs={12} md={3}>
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mb: 1, display: 'block' }}>TIPO DOCUMENTO</Typography>
                  <FormControl fullWidth>
                    <Select value={filters.tipo_documentacion_id} onChange={(e) => setFilters({ ...filters, tipo_documentacion_id: e.target.value })} displayEmpty sx={{ borderRadius: 2, bgcolor: filters.tipo_documentacion_id ? '#eff6ff' : 'white', '& .MuiOutlinedInput-notchedOutline': { borderColor: filters.tipo_documentacion_id ? '#3b82f6' : '#e2e8f0', borderWidth: 2 } }}>
                      <MenuItem value=""><em>Seleccionar...</em></MenuItem>
                      {tiposDocumentacionDisplay.map((td) => <MenuItem key={td.id} value={td.id}>{td.nombre}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Box>
              </Grid>
            </Grid>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mb: 1, display: 'block' }}>BUSCAR POR TÍTULO</Typography>
                <TextField fullWidth value={filters.titulo} onChange={(e) => setFilters({ ...filters, titulo: e.target.value })} placeholder="Escribe el nombre del documento..." sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white' } }} />
              </Grid>

              <Grid item xs={12} md={2}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mb: 1, display: 'block' }}>ESTADO</Typography>
                <FormControl fullWidth>
                  <Select value={filters.estado} onChange={(e) => setFilters({ ...filters, estado: e.target.value })} displayEmpty sx={{ borderRadius: 2, bgcolor: filters.estado ? '#eff6ff' : 'white' }}>
                    <MenuItem value=""><em>Todos</em></MenuItem>
                    <MenuItem value="vigente">Vigente</MenuItem>
                    <MenuItem value="obsoleto">Obsoleto</MenuItem>
                    <MenuItem value="en_revision">En Revisión</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography variant="caption" sx={{ color: 'transparent', fontWeight: 600, mb: 1, display: 'block' }}>.</Typography>
                <Stack direction="row" spacing={2}>
                  <Button variant="contained" startIcon={<SearchIcon />} onClick={handleSearch} fullWidth sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, py: 1.5, fontSize: 15, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', boxShadow: '0 4px 14px rgba(102, 126, 234, 0.4)', '&:hover': { background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)', boxShadow: '0 6px 20px rgba(102, 126, 234, 0.6)' } }}>
                    Buscar
                  </Button>
                  <Button variant="outlined" startIcon={<ClearIcon />} onClick={handleClearFilters} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, py: 1.5, borderColor: '#e2e8f0', color: '#64748b', borderWidth: 2, '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc', borderWidth: 2 } }}>
                    Limpiar
                  </Button>
                </Stack>
              </Grid>
            </Grid>
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
                        <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13, borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Versión</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13, borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Estado</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13, borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                            <CircularProgress size={50} thickness={4} />
                            <Typography variant="body1" sx={{ color: '#64748b', mt: 3, fontWeight: 600 }}>Cargando documentos...</Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        documentos.map((doc) => {
                          const normalized = normalizeDocFields(doc);
                          return (
                            <TableRow hover sx={{ '&:hover': { bgcolor: '#f8fafc' }, transition: 'all 0.2s', cursor: 'pointer' }}>
                              <TableCell sx={{ fontWeight: 700, color: '#3b82f6', fontSize: 14, fontFamily: 'monospace' }}>{normalized.codigo}</TableCell>
                              <TableCell>
                                <Chip icon={getTipoIcon(normalized.tipo)} label={normalized.tipo || 'N/A'} size="small" sx={{ bgcolor: getTipoColor(normalized.tipo).bg, color: getTipoColor(normalized.tipo).color, fontWeight: 700, fontSize: 12, borderRadius: 2, px: 1 }} />
                              </TableCell>
                              <TableCell sx={{ color: '#1e293b', fontWeight: 600, fontSize: 14 }}>{normalized.titulo}</TableCell>
                              <TableCell>
                                <Chip label={`v${doc.version || '1.0'}`} size="small" sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 700, fontFamily: 'monospace', borderRadius: 1.5 }} />
                              </TableCell>
                              <TableCell>
                                <Chip label={doc.estado} color={getEstadoColor(doc.estado)} size="small" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, borderRadius: 1.5 }} />
                              </TableCell>
                              <TableCell align="center">
                                <Stack direction="row" spacing={1} justifyContent="center">
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
                                            const previewUrl = getPreviewUrl(doc.link_acceso);
                                            window.open(previewUrl, '_blank', 'noopener,noreferrer');
                                          }
                                        }}
                                      >
                                        <OpenInNewIcon fontSize="small" />
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
                                            const downloadUrl = getDownloadUrl(doc.link_acceso);
                                            const link = document.createElement('a');
                                            link.href = downloadUrl;
                                            link.download = `${normalized.codigo}_${normalized.titulo}`;
                                            link.target = '_blank';
                                            link.rel = 'noopener noreferrer';
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
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
      </Box>
    </Fade>
  );
}

export default AseguramientoCalidad;
