import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, Grid, Alert, CircularProgress, Fade, Stack
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Visibility as ViewIcon,
  Download as DownloadIcon, Search as SearchIcon, Clear as ClearIcon,
  CloudUpload as UploadIcon, Restore as RestoreIcon, DescriptionOutlined as DocsIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import documentoManagementService from '../services/documentoManagementService';
import catalogoService from '../services/catalogoService';

function GestionDocumentos() {
  const { enqueueSnackbar } = useSnackbar();
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [incluirEliminados, setIncluirEliminados] = useState(false);

  // Catálogos
  const [macroProcesos, setMacroProcesos] = useState([]);
  const [procesos, setProcesos] = useState([]);
  const [subprocesos, setSubprocesos] = useState([]);
  const [tiposDocumentacion, setTiposDocumentacion] = useState([]);

  // Modales
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Formulario
  const [formData, setFormData] = useState({
    codigo: '',
    titulo: '',
    version: '',
    macro_proceso_id: '',
    proceso_id: '',
    subproceso_id: '',
    tipo_documentacion_id: '',
    estado: 'vigente',
    fecha_creacion: '',
    revisa: '',
    aprueba: '',
    fecha_aprobacion: '',
    autor: ''
  });
  const [archivo, setArchivo] = useState(null);

  useEffect(() => {
    loadDocumentos();
    loadCatalogos();
  }, [page, rowsPerPage, search, incluirEliminados]);

  useEffect(() => {
    if (formData.macro_proceso_id) {
      catalogoService.getProcesos(formData.macro_proceso_id).then(r => setProcesos(r.data.procesos || []));
    } else {
      setProcesos([]);
      setFormData(prev => ({ ...prev, proceso_id: '', subproceso_id: '' }));
    }
  }, [formData.macro_proceso_id]);

  useEffect(() => {
    if (formData.proceso_id) {
      catalogoService.getSubProcesos(formData.proceso_id).then(r => setSubprocesos(r.data.subprocesos || []));
    } else {
      setSubprocesos([]);
      setFormData(prev => ({ ...prev, subproceso_id: '' }));
    }
  }, [formData.proceso_id]);

  const loadCatalogos = async () => {
    try {
      const [mpRes, tdRes] = await Promise.all([
        catalogoService.getMacroProcesos(),
        catalogoService.getTiposDocumentacion()
      ]);
      setMacroProcesos(mpRes.data.macroProcesos || []);
      setTiposDocumentacion(tdRes.data.tipos || []);
    } catch (error) {
      enqueueSnackbar('Error al cargar catálogos', { variant: 'error' });
    }
  };

  const loadDocumentos = async () => {
    setLoading(true);
    try {
      const response = await documentoManagementService.getDocumentos({
        page: page + 1,
        limit: rowsPerPage,
        search,
        incluirEliminados
      });
      setDocumentos(response.data.documentos);
      setTotal(response.data.pagination.total);
    } catch (error) {
      enqueueSnackbar('Error al cargar documentos', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (mode, doc = null) => {
    setDialogMode(mode);
    setSelectedDoc(doc);
    
    if (doc) {
      setFormData({
        codigo: doc.codigo,
        titulo: doc.titulo,
        version: doc.version,
        macro_proceso_id: doc.subproceso?.proceso?.macroProceso?.id || '',
        proceso_id: doc.subproceso?.proceso?.id || '',
        subproceso_id: doc.subproceso_id,
        tipo_documentacion_id: doc.tipo_documentacion_id,
        estado: doc.estado,
        fecha_creacion: doc.fecha_creacion || '',
        revisa: doc.revisa || '',
        aprueba: doc.aprueba || '',
        fecha_aprobacion: doc.fecha_aprobacion || '',
        autor: doc.autor || ''
      });
    } else {
      setFormData({
        codigo: '',
        titulo: '',
        version: '',
        macro_proceso_id: '',
        proceso_id: '',
        subproceso_id: '',
        tipo_documentacion_id: '',
        estado: 'vigente',
        fecha_creacion: '',
        revisa: '',
        aprueba: '',
        fecha_aprobacion: '',
        autor: ''
      });
    }
    setArchivo(null);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedDoc(null);
    setArchivo(null);
  };

  const handleSubmit = async () => {
    try {
      // Validaciones
      if (!formData.codigo || !formData.titulo || !formData.version || !formData.subproceso_id || !formData.tipo_documentacion_id) {
        enqueueSnackbar('Complete todos los campos obligatorios', { variant: 'warning' });
        return;
      }

      if (dialogMode === 'create' && !archivo) {
        enqueueSnackbar('Debe adjuntar un archivo PDF', { variant: 'warning' });
        return;
      }

      const formDataToSend = new FormData();
      formDataToSend.append('codigo', formData.codigo);
      formDataToSend.append('titulo', formData.titulo);
      formDataToSend.append('version', formData.version);
      formDataToSend.append('subproceso_id', formData.subproceso_id);
      formDataToSend.append('tipo_documentacion_id', formData.tipo_documentacion_id);
      formDataToSend.append('estado', formData.estado);
      if (formData.fecha_creacion) formDataToSend.append('fecha_creacion', formData.fecha_creacion);
      if (formData.revisa) formDataToSend.append('revisa', formData.revisa);
      if (formData.aprueba) formDataToSend.append('aprueba', formData.aprueba);
      if (formData.fecha_aprobacion) formDataToSend.append('fecha_aprobacion', formData.fecha_aprobacion);
      if (formData.autor) formDataToSend.append('autor', formData.autor);
      if (archivo) formDataToSend.append('archivo', archivo);

      if (dialogMode === 'create') {
        await documentoManagementService.createDocumento(formDataToSend);
        enqueueSnackbar('Documento creado exitosamente', { variant: 'success' });
      } else {
        await documentoManagementService.updateDocumento(selectedDoc.id, formDataToSend);
        enqueueSnackbar('Documento actualizado exitosamente', { variant: 'success' });
      }

      handleCloseDialog();
      loadDocumentos();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al guardar documento', { variant: 'error' });
    }
  };

  const handleDelete = async (doc) => {
    if (window.confirm(`¿Está seguro de eliminar el documento ${doc.codigo}?`)) {
      try {
        await documentoManagementService.deleteDocumento(doc.id);
        enqueueSnackbar('Documento eliminado exitosamente', { variant: 'success' });
        loadDocumentos();
      } catch (error) {
        enqueueSnackbar('Error al eliminar documento', { variant: 'error' });
      }
    }
  };

  const handleRestore = async (doc) => {
    if (window.confirm(`¿Desea restaurar el documento ${doc.codigo}?`)) {
      try {
        await documentoManagementService.restoreDocumento(doc.id);
        enqueueSnackbar('Documento restaurado exitosamente', { variant: 'success' });
        loadDocumentos();
      } catch (error) {
        enqueueSnackbar('Error al restaurar documento', { variant: 'error' });
      }
    }
  };

  const handleDownload = async (doc) => {
    try {
      const blob = await documentoManagementService.downloadDocumento(doc.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${doc.codigo}_${doc.titulo}.pdf`;
      link.click();
    } catch (error) {
      enqueueSnackbar('Error al descargar documento', { variant: 'error' });
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

  return (
    <Fade in={true}>
      <Box>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1 }}>
            <DocsIcon sx={{ color: '#1d4ed8' }} />
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b' }}>
              Gestión de Documentos
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            Administra el ciclo de vida completo de los documentos institucionales
          </Typography>
        </Box>

        {/* Acciones principales */}
        <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid #e2e8f0', borderRadius: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                fullWidth
                onClick={() => handleOpenDialog('create')}
                sx={{ borderRadius: 2, py: 1.5, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
              >
                Crear Documento
              </Button>
            </Grid>
            <Grid item xs={12} md={5}>
              <TextField
                fullWidth
                placeholder="Buscar por código o título..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: '#64748b' }} />
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <Select
                  value={incluirEliminados}
                  onChange={(e) => setIncluirEliminados(e.target.value)}
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value={false}>Activos</MenuItem>
                  <MenuItem value={true}>Incluir Eliminados</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                fullWidth
                onClick={() => {
                  setSearch('');
                  setIncluirEliminados(false);
                }}
                sx={{ borderRadius: 2 }}
              >
                Limpiar
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Tabla de documentos */}
        <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>CÓDIGO</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>TÍTULO</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>TIPO</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>VERSIÓN</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>ESTADO</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>ACCIONES</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : documentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                      <Typography color="text.secondary">No hay documentos registrados</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  documentos.map((doc) => (
                    <TableRow 
                      key={doc.id} 
                      hover 
                      sx={{ 
                        opacity: doc.eliminado ? 0.5 : 1,
                        bgcolor: doc.eliminado ? '#fee2e2' : 'inherit'
                      }}
                    >
                      <TableCell sx={{ fontWeight: 700, color: '#3b82f6', fontFamily: 'monospace' }}>
                        {doc.codigo}
                        {doc.eliminado && (
                          <Chip label="ELIMINADO" size="small" color="error" sx={{ ml: 1, fontSize: 10 }} />
                        )}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{doc.titulo}</TableCell>
                      <TableCell>
                        <Chip 
                          label={doc.tipoDocumentacion?.nombre} 
                          size="small" 
                          sx={{ bgcolor: '#eff6ff', color: '#3b82f6', fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={`v${doc.version}`} 
                          size="small" 
                          variant="outlined"
                          sx={{ fontFamily: 'monospace', fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={doc.estado}
                          color={getEstadoColor(doc.estado)}
                          size="small"
                          sx={{ fontWeight: 700, textTransform: 'uppercase' }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          {!doc.eliminado && (
                            <>
                              <Tooltip title="Editar">
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenDialog('edit', doc)}
                                  sx={{ color: '#3b82f6', bgcolor: '#eff6ff' }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Descargar">
                                <IconButton
                                  size="small"
                                  onClick={() => handleDownload(doc)}
                                  sx={{ color: '#10b981', bgcolor: '#d1fae5' }}
                                >
                                  <DownloadIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Eliminar">
                                <IconButton
                                  size="small"
                                  onClick={() => handleDelete(doc)}
                                  sx={{ color: '#ef4444', bgcolor: '#fee2e2' }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          {doc.eliminado && (
                            <Tooltip title="Restaurar">
                              <IconButton
                                size="small"
                                onClick={() => handleRestore(doc)}
                                sx={{ color: '#10b981', bgcolor: '#d1fae5' }}
                              >
                                <RestoreIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={total}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            labelRowsPerPage="Filas por página:"
          />
        </Paper>

        {/* Dialog Crear/Editar */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            {dialogMode === 'create' ? 'Crear Nuevo Documento' : 'Editar Documento'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Alert severity="warning" sx={{ mb: 3 }}>
                Todos los campos marcados con (*) son obligatorios. El archivo debe ser en formato PDF.
              </Alert>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Código del Documento *"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Versión *"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Título del Documento *"
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth required>
                    <InputLabel>Macro Proceso *</InputLabel>
                    <Select
                      value={formData.macro_proceso_id}
                      label="Macro Proceso *"
                      onChange={(e) => setFormData({ ...formData, macro_proceso_id: e.target.value })}
                    >
                      {macroProcesos.map((mp) => (
                        <MenuItem key={mp.id} value={mp.id}>{mp.nombre}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth required disabled={!formData.macro_proceso_id}>
                    <InputLabel>Proceso *</InputLabel>
                    <Select
                      value={formData.proceso_id}
                      label="Proceso *"
                      onChange={(e) => setFormData({ ...formData, proceso_id: e.target.value })}
                    >
                      {procesos.map((p) => (
                        <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth required disabled={!formData.proceso_id}>
                    <InputLabel>Subproceso *</InputLabel>
                    <Select
                      value={formData.subproceso_id}
                      label="Subproceso *"
                      onChange={(e) => setFormData({ ...formData, subproceso_id: e.target.value })}
                    >
                      {subprocesos.map((sp) => (
                        <MenuItem key={sp.id} value={sp.id}>{sp.nombre}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth required>
                    <InputLabel>Tipo de Documento *</InputLabel>
                    <Select
                      value={formData.tipo_documentacion_id}
                      label="Tipo de Documento *"
                      onChange={(e) => setFormData({ ...formData, tipo_documentacion_id: e.target.value })}
                    >
                      {tiposDocumentacion.map((td) => (
                        <MenuItem key={td.id} value={td.id}>{td.nombre}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth required>
                    <InputLabel>Estado *</InputLabel>
                    <Select
                      value={formData.estado}
                      label="Estado *"
                      onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                    >
                      <MenuItem value="vigente">Vigente</MenuItem>
                      <MenuItem value="obsoleto">Obsoleto</MenuItem>
                      <MenuItem value="en_revision">En Revisión</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Fecha de Creación"
                    type="date"
                    value={formData.fecha_creacion}
                    onChange={(e) => setFormData({ ...formData, fecha_creacion: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Autor"
                    value={formData.autor}
                    onChange={(e) => setFormData({ ...formData, autor: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Revisa"
                    value={formData.revisa}
                    onChange={(e) => setFormData({ ...formData, revisa: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Aprueba"
                    value={formData.aprueba}
                    onChange={(e) => setFormData({ ...formData, aprueba: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    component="label"
                    fullWidth
                    startIcon={<UploadIcon />}
                    sx={{ py: 2 }}
                  >
                    {archivo ? archivo.name : dialogMode === 'create' ? 'Adjuntar Archivo PDF *' : 'Cambiar Archivo PDF (Opcional)'}
                    <input
                      type="file"
                      hidden
                      accept=".pdf"
                      onChange={(e) => setArchivo(e.target.files[0])}
                    />
                  </Button>
                  {dialogMode === 'create' && (
                    <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                      * Archivo obligatorio para crear documento
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancelar</Button>
            <Button variant="contained" onClick={handleSubmit}>
              {dialogMode === 'create' ? 'Crear Documento' : 'Actualizar Documento'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
}

export default GestionDocumentos;
