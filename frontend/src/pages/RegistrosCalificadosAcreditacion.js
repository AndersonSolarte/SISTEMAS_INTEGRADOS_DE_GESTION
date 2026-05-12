import React, { useCallback, useEffect, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import {
  Folder as FolderIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import gestionInformacionService from '../services/gestionInformacionService';

const normalizeDriveName = (value = '') =>
  String(value || '')
    .replace(/\.[A-Za-z0-9]{2,8}$/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

const getDrivePreviewUrl = (file = {}) => {
  if (file.previewLink) return file.previewLink;
  if (!file.id) return file.webViewLink || '';
  return file.isFolder
    ? file.webViewLink || file.folderUrl || ''
    : `https://drive.google.com/file/d/${file.id}/preview`;
};

const getDriveDownloadUrl = (file = {}) => {
  if (file.webContentLink) return file.webContentLink;
  if (!file.id) return file.webViewLink || '';
  return `https://drive.google.com/uc?export=download&id=${file.id}`;
};

function RegistrosCalificadosAcreditacion() {
  const { enqueueSnackbar } = useSnackbar();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ programa: '', estado: 'activos' });
  const [evidence, setEvidence] = useState({ open: false, loading: false, row: null, expected: [], files: [] });
  const [evidenceSearch, setEvidenceSearch] = useState('');
  const [preview, setPreview] = useState({ open: false, file: null });

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await gestionInformacionService.getRegistrosCalificadosDashboard({
        programa: filters.programa || '',
        estado: filters.estado || 'activos',
        _ts: Date.now()
      });
      setData(response.data || null);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al cargar Registros Calificados y Acreditacion', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, filters]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const openEvidence = async (row) => {
    setEvidenceSearch('');
    setEvidence({ open: true, loading: true, row, expected: [], files: [] });
    try {
      const response = await gestionInformacionService.getRegistrosCalificadosEvidencias(row.id);
      const expected = response?.data?.expected || [];
      const files = response?.data?.files || [];
      setEvidence({
        open: true,
        loading: false,
        row,
        expected,
        files
      });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No se pudieron consultar las evidencias de Drive', { variant: 'error' });
      setEvidence((prev) => ({ ...prev, loading: false }));
    }
  };

  const formatDate = (value) => {
    if (!value) return '-';
    const numeric = Number(String(value).trim());
    if (Number.isFinite(numeric) && numeric > 20000 && numeric < 90000) {
      const date = new Date(Math.round((numeric - 25569) * 86400 * 1000));
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleDateString('es-CO', { timeZone: 'UTC' });
      }
    }
    const [year, month, day] = String(value).slice(0, 10).split('-');
    return year && month && day ? `${day}/${month}/${year}` : String(value);
  };

  const registros = data?.registros || [];
  const programas = data?.programasDisponibles || [];
  const evidenceRows = (evidence.expected || []).map((name) => {
    const fileMatch = (evidence.files || []).find((item) => normalizeDriveName(item.name) === normalizeDriveName(name));
    return {
      expectedName: name,
      file: fileMatch,
      name: fileMatch?.name || name,
      type: fileMatch?.mimeType?.includes('pdf') ? 'PDF'
        : fileMatch?.mimeType?.includes('spreadsheet') || /\.xlsx?$/i.test(fileMatch?.name || '') ? 'Hoja de calculo'
          : fileMatch?.mimeType?.includes('document') || /\.docx?$/i.test(fileMatch?.name || '') ? 'Documento'
            : fileMatch?.isFolder ? 'Carpeta'
              : 'Archivo',
      modifiedTime: fileMatch?.modifiedTime || ''
    };
  }).filter((row) => {
    const q = evidenceSearch.trim().toLowerCase();
    if (!q) return true;
    return `${row.expectedName} ${row.name} ${row.type}`.toLowerCase().includes(q);
  });
  const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
  };

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: { xs: 1.5, md: 1.8 }, borderRadius: 3, border: '1px solid #dbe6f5', bgcolor: '#fff' }}>
        <Box>
            <Autocomplete
              options={programas}
              value={filters.programa || null}
              onChange={(_, value) => setFilters((prev) => ({ ...prev, programa: value || '' }))}
              renderInput={(params) => <TextField {...params} label="Filtro de programa" placeholder="Todos los programas" size="small" />}
            />
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ p: 1.1, borderRadius: 3, border: '1px solid #dbe6f5', bgcolor: '#fff' }}>
        <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="flex-end">
          <ToggleButtonGroup
            exclusive
            size="small"
            value={filters.estado}
            onChange={(_, next) => setFilters((prev) => ({ ...prev, estado: next || 'activos' }))}
            sx={{
              width: { xs: '100%', md: 390 },
              height: 42,
              '& .MuiToggleButton-root': { flex: 1, fontWeight: 900, color: '#1d4ed8', borderColor: '#93c5fd', fontSize: 12.5 },
              '& .Mui-selected': { color: '#fff !important', bgcolor: '#3b82f6 !important' }
            }}
          >
            <ToggleButton value="activos">Activos</ToggleButton>
            <ToggleButton value="inactivos">Inactivos</ToggleButton>
            <ToggleButton value="todos">Todos</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #dbe6f5', overflow: 'hidden', bgcolor: '#fff' }}>
        <Box sx={{ px: 1.8, py: 1.3, bgcolor: '#1e3a8a' }}>
          <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Historico_RC
          </Typography>
        </Box>
        <TableContainer sx={{ maxHeight: 570, overflowX: 'auto' }}>
          <Table
            size="small"
            stickyHeader
            sx={{
              minWidth: 980,
              tableLayout: 'fixed',
              '& .MuiTableCell-root': { fontSize: 12.5, py: 0.9 }
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 230, fontWeight: 900, color: '#334155', bgcolor: '#f8fafc', fontSize: 12 }}>Programa</TableCell>
                <TableCell sx={{ width: 180, fontWeight: 900, color: '#334155', bgcolor: '#f8fafc', fontSize: 12 }}>Aprobación</TableCell>
                <TableCell sx={{ width: 150, fontWeight: 900, color: '#334155', bgcolor: '#f8fafc', fontSize: 12 }}>Resolución</TableCell>
                <TableCell sx={{ width: 300, fontWeight: 900, color: '#334155', bgcolor: '#f8fafc', fontSize: 12 }}>Documentos esperados</TableCell>
                <TableCell sx={{ width: 90, fontWeight: 900, color: '#334155', bgcolor: '#f8fafc', fontSize: 12 }}>Estado</TableCell>
                <TableCell sx={{ width: 125, fontWeight: 900, color: '#334155', bgcolor: '#f8fafc', fontSize: 12 }}>Drive</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}><CircularProgress size={30} /></TableCell></TableRow>
              ) : registros.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}>No hay registros para el filtro seleccionado.</TableCell></TableRow>
              ) : registros.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell sx={{ fontWeight: 800, color: '#0f172a' }}>
                    <Typography sx={{ fontWeight: 900, fontSize: 12.8, lineHeight: 1.2 }}>{row.programaAcademico}</Typography>
                    <Typography sx={{ color: '#64748b', fontSize: 11.5, mt: 0.25 }}>{row.nivel || '-'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontWeight: 700, fontSize: 12.4, lineHeight: 1.25 }}>{row.tipoAprobacion || '-'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ color: '#1d4ed8', fontWeight: 900, fontSize: 13 }}>{row.resolucionMen || '-'}</Typography>
                    <Typography sx={{ color: '#64748b', fontSize: 11.5 }}>{formatDate(row.fechaResolucion)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontWeight: 800, fontSize: 12.2, lineHeight: 1.2, color: '#0f172a' }}>{row.resolucionRc || '-'}</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: 12, lineHeight: 1.2, color: '#475569', mt: 0.45 }}>{row.planEstudios || '-'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={row.estado} sx={{ fontWeight: 800, bgcolor: row.estado === 'Activo' ? '#dcfce7' : '#f1f5f9', color: row.estado === 'Activo' ? '#166534' : '#475569' }} />
                  </TableCell>
                  <TableCell>
                    <Button size="small" variant="outlined" startIcon={<FolderIcon />} onClick={() => openEvidence(row)} disabled={!row.enlace} sx={{ whiteSpace: 'nowrap', fontWeight: 800 }}>
                      Ver archivos
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={evidence.open} onClose={() => setEvidence((prev) => ({ ...prev, open: false }))} fullWidth maxWidth="lg">
        <DialogTitle sx={{ fontWeight: 900, pb: 1.3 }}>
          <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1.2} alignItems="center">
              <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#eff6ff', color: '#1d4ed8', display: 'grid', placeItems: 'center' }}>
                <FolderIcon />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 950, color: '#0f172a', fontSize: 18 }}>Evidencias</Typography>
                <Typography sx={{ color: '#64748b', fontSize: 12.5 }}>Coincidencias de Resolucion RC y Plan de Estudios</Typography>
              </Box>
            </Stack>
            <Button onClick={() => setEvidence((prev) => ({ ...prev, open: false }))} sx={{ minWidth: 0, color: '#64748b', fontSize: 24, lineHeight: 1 }}>×</Button>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 1.6 }}>
          {evidence.loading ? (
            <Box sx={{ py: 7, textAlign: 'center' }}>
              <CircularProgress size={34} thickness={4} />
              <Typography sx={{ mt: 1.4, color: '#0f172a', fontWeight: 900 }}>
                Consultando evidencias en Drive...
              </Typography>
              <Typography sx={{ mt: 0.4, color: '#64748b', fontSize: 13 }}>
                La primera consulta puede tardar un poco; las siguientes quedan aceleradas con caché.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1.4}>
              <TextField
                size="small"
                fullWidth
                placeholder="Buscar archivo"
                value={evidenceSearch}
                onChange={(event) => setEvidenceSearch(event.target.value)}
              />
              <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 900, color: '#64748b', bgcolor: '#f8fafc' }}>Nombre</TableCell>
                      <TableCell sx={{ width: 170, fontWeight: 900, color: '#64748b', bgcolor: '#f8fafc' }}>Tipo</TableCell>
                      <TableCell sx={{ width: 190, fontWeight: 900, color: '#64748b', bgcolor: '#f8fafc' }}>Modificación</TableCell>
                      <TableCell align="center" sx={{ width: 150, fontWeight: 900, color: '#64748b', bgcolor: '#f8fafc' }}>Acción</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {evidenceRows.length === 0 ? (
                      <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4 }}>No hay archivos coincidentes para mostrar.</TableCell></TableRow>
                    ) : evidenceRows.map((row) => (
                      <TableRow key={row.expectedName} hover>
                        <TableCell>
                          <Stack direction="row" spacing={1.2} alignItems="center">
                            <Box sx={{ width: 38, height: 38, borderRadius: '50%', bgcolor: row.file ? '#dbeafe' : '#ffedd5', color: row.file ? '#1d4ed8' : '#9a3412', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                              <FolderIcon fontSize="small" />
                            </Box>
                            <Box>
                              <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 13 }}>{row.expectedName}</Typography>
                              <Typography sx={{ color: row.file ? '#166534' : '#c2410c', fontWeight: 800, fontSize: 11.5 }}>
                                {row.file ? `Encontrado: ${row.name}` : 'No encontrado en la carpeta de Drive'}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>{row.file ? row.type : '-'}</TableCell>
                        <TableCell>{row.file ? formatDateTime(row.modifiedTime) : '-'}</TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.8} justifyContent="center">
                            <Button size="small" variant="text" disabled={!row.file} onClick={() => setPreview({ open: true, file: row.file })} sx={{ minWidth: 0 }}>
                              <VisibilityIcon fontSize="small" />
                            </Button>
                            <Button size="small" variant="text" disabled={!row.file} onClick={() => window.open(getDriveDownloadUrl(row.file), '_blank', 'noopener,noreferrer')} sx={{ minWidth: 0 }}>
                              <DownloadIcon fontSize="small" />
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.4 }}>
          <Button variant="contained" onClick={() => setEvidence((prev) => ({ ...prev, open: false }))} sx={{ fontWeight: 900 }}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={preview.open} onClose={() => setPreview({ open: false, file: null })} fullWidth maxWidth="lg">
        <DialogTitle sx={{ fontWeight: 900 }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Typography sx={{ fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {preview.file?.name || 'Previsualizacion'}
            </Typography>
            <Button variant="contained" startIcon={<DownloadIcon />} disabled={!preview.file} onClick={() => window.open(getDriveDownloadUrl(preview.file), '_blank', 'noopener,noreferrer')} sx={{ fontWeight: 900 }}>
              Descargar
            </Button>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, height: { xs: '70vh', md: '78vh' } }}>
          {preview.file ? (
            <Box component="iframe" title={preview.file.name || 'Previsualizacion'} src={getDrivePreviewUrl(preview.file)} sx={{ width: '100%', height: '100%', border: 0, bgcolor: '#fff' }} />
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreview({ open: false, file: null })}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default RegistrosCalificadosAcreditacion;
