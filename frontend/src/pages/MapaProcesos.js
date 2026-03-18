import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Download as DownloadIcon,
  FindInPage as FindIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import DocumentoCard from '../context/DocumentoCard';
import catalogoService from '../services/catalogoService';
import documentoService from '../services/documentoService';

const initialFilters = {
  macro_proceso_id: '',
  proceso_id: '',
  subproceso_id: '',
  tipo_documentacion_id: '',
  estado: '',
  titulo: ''
};

function MapaProcesos() {
  const { enqueueSnackbar } = useSnackbar();

  const [filters, setFilters] = useState(initialFilters);
  const [macroProcesos, setMacroProcesos] = useState([]);
  const [procesos, setProcesos] = useState([]);
  const [subprocesos, setSubprocesos] = useState([]);
  const [tipos, setTipos] = useState([]);

  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [documentos, setDocumentos] = useState([]);

  const loadDocumentos = useCallback(async (customFilters) => {
    setLoadingDocs(true);
    try {
      const response = await documentoService.getDocumentos(customFilters, 1, 30);
      setDocumentos(response?.data?.documentos || []);
    } catch (error) {
      enqueueSnackbar('No fue posible cargar la consulta documental', { variant: 'error' });
    } finally {
      setLoadingDocs(false);
    }
  }, [enqueueSnackbar]);

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
      } catch (error) {
        enqueueSnackbar('No fue posible cargar catálogos', { variant: 'error' });
      } finally {
        setLoadingCatalogs(false);
      }
    };

    loadInitial();
    loadDocumentos(initialFilters);
  }, [enqueueSnackbar, loadDocumentos]);

  useEffect(() => {
    if (!filters.macro_proceso_id) {
      setProcesos([]);
      setSubprocesos([]);
      return;
    }

    catalogoService
      .getProcesos(filters.macro_proceso_id)
      .then((response) => setProcesos(response?.data?.procesos || []))
      .catch(() => enqueueSnackbar('No fue posible cargar procesos', { variant: 'warning' }));
  }, [enqueueSnackbar, filters.macro_proceso_id]);

  useEffect(() => {
    if (!filters.proceso_id) {
      setSubprocesos([]);
      return;
    }

    catalogoService
      .getSubProcesos(filters.proceso_id)
      .then((response) => setSubprocesos(response?.data?.subprocesos || []))
      .catch(() => enqueueSnackbar('No fue posible cargar subprocesos', { variant: 'warning' }));
  }, [enqueueSnackbar, filters.proceso_id]);

  const handleFilterChange = (field, value) => {
    if (field === 'macro_proceso_id') {
      setFilters((prev) => ({
        ...prev,
        macro_proceso_id: value,
        proceso_id: '',
        subproceso_id: ''
      }));
      return;
    }

    if (field === 'proceso_id') {
      setFilters((prev) => ({
        ...prev,
        proceso_id: value,
        subproceso_id: ''
      }));
      return;
    }

    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleSearch = () => loadDocumentos(filters);

  const handleClear = () => {
    setFilters(initialFilters);
    setProcesos([]);
    setSubprocesos([]);
    loadDocumentos(initialFilters);
  };

  const stats = useMemo(() => {
    const vigentes = documentos.filter((doc) => doc.estado === 'vigente').length;
    const tiposUnicos = new Set(documentos.map((doc) => doc?.tipoDocumentacion?.nombre).filter(Boolean));

    return {
      total: documentos.length,
      vigentes,
      tipos: tiposUnicos.size
    };
  }, [documentos]);

  return (
    <Fade in={true} timeout={500}>
      <Box>
        <Box
          sx={{
            mb: { xs: 2.5, md: 3 },
            p: { xs: 2.5, sm: 3, md: 4 },
            borderRadius: { xs: 3, md: 4 },
            background: 'linear-gradient(120deg, #0f766e 0%, #0e7490 60%, #155e75 100%)',
            color: 'white',
            boxShadow: '0 10px 30px rgba(14, 116, 144, 0.25)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <Box sx={{ position: 'absolute', inset: 0, opacity: 0.2, background: 'radial-gradient(circle at 20% 10%, rgba(255,255,255,0.22), transparent 45%)' }} />
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <ExploreIcon fontSize="small" />
            <Typography variant="overline" sx={{ letterSpacing: 1.2, opacity: 0.9 }}>
              PERFIL CONSULTA
            </Typography>
          </Stack>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, fontSize: { xs: 22, sm: 26, md: 32 } }}>
            Consulta Documental Inteligente
          </Typography>
          <Typography sx={{ opacity: 0.95, fontSize: { xs: 13, sm: 14, md: 16 } }}>
            Encuentra documentos por proceso, tipo y estado en pocos clics. Diseñado para consulta rápida y navegación clara.
          </Typography>
        </Box>

        <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5, md: 3 }, borderRadius: 3, border: '1px solid #e2e8f0', mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small" disabled={loadingCatalogs}>
                <InputLabel>Macroproceso</InputLabel>
                <Select
                  value={filters.macro_proceso_id}
                  label="Macroproceso"
                  onChange={(e) => handleFilterChange('macro_proceso_id', e.target.value)}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {macroProcesos.map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small" disabled={!filters.macro_proceso_id || loadingCatalogs}>
                <InputLabel>Proceso</InputLabel>
                <Select
                  value={filters.proceso_id}
                  label="Proceso"
                  onChange={(e) => handleFilterChange('proceso_id', e.target.value)}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {procesos.map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small" disabled={!filters.proceso_id || loadingCatalogs}>
                <InputLabel>Subproceso</InputLabel>
                <Select
                  value={filters.subproceso_id}
                  label="Subproceso"
                  onChange={(e) => handleFilterChange('subproceso_id', e.target.value)}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {subprocesos.map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small" disabled={loadingCatalogs}>
                <InputLabel>Tipo</InputLabel>
                <Select
                  value={filters.tipo_documentacion_id}
                  label="Tipo"
                  onChange={(e) => handleFilterChange('tipo_documentacion_id', e.target.value)}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {tipos.map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Buscar por título"
                value={filters.titulo}
                onChange={(e) => handleFilterChange('titulo', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Estado</InputLabel>
                <Select
                  value={filters.estado}
                  label="Estado"
                  onChange={(e) => handleFilterChange('estado', e.target.value)}
                >
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="vigente">Vigente</MenuItem>
                  <MenuItem value="en_revision">En Revisión</MenuItem>
                  <MenuItem value="obsoleto">Obsoleto</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button
                  onClick={handleSearch}
                  variant="contained"
                  startIcon={<SearchIcon />}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    fontWeight: 700,
                    background: 'linear-gradient(120deg, #0f766e, #0e7490)'
                  }}
                >
                  Consultar
                </Button>
                <Button
                  onClick={handleClear}
                  variant="outlined"
                  sx={{ flex: 1, textTransform: 'none', fontWeight: 700 }}
                >
                  Limpiar filtros
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

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
            {documentos.map((doc) => {
              return <Grid item xs={12} md={6} lg={4} key={doc.id}><DocumentoCard doc={doc} /></Grid>;
            })}
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
