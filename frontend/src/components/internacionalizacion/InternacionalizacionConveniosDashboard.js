import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Chip,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import SearchIcon from '@mui/icons-material/Search';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import HandshakeIcon from '@mui/icons-material/Handshake';
import { useSnackbar } from 'notistack';
import gestionInformacionService from '../../services/gestionInformacionService';
import InternacionalizacionNavSegment from './InternacionalizacionNavSegment';

const statusChip = (fechaTerminacion) => {
  if (!fechaTerminacion) return null;
  const today = new Date();
  const end = new Date(fechaTerminacion);
  const diffDays = Math.ceil((end - today) / 86400000);
  if (diffDays < 0) return <Chip label="Vencido" size="small" sx={{ bgcolor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontSize: 10, height: 20, fontWeight: 700 }} />;
  if (diffDays < 180) return <Chip label="Por vencer" size="small" sx={{ bgcolor: '#fefce8', color: '#d97706', border: '1px solid #fde68a', fontSize: 10, height: 20, fontWeight: 700 }} />;
  return <Chip label="Vigente" size="small" sx={{ bgcolor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', fontSize: 10, height: 20, fontWeight: 700 }} />;
};

function InternacionalizacionConveniosDashboard({ onBack, onNavigateMovilidad }) {
  const { enqueueSnackbar } = useSnackbar();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({ tipo_convenio: '', anio: '', programa: '' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
      const result = await gestionInformacionService.getConveniosDashboard(params);
      setData(result.data);
      setPage(0);
    } catch {
      enqueueSnackbar('Error cargando convenios', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [search, filters, enqueueSnackbar]);

  useEffect(() => { load(); }, [load]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const setFilter = (k, v) => { setFilters((prev) => ({ ...prev, [k]: v })); setPage(0); };

  const resetAll = () => {
    setSearch('');
    setSearchInput('');
    setFilters({ tipo_convenio: '', anio: '', programa: '' });
  };

  const hasFilters = search || Object.values(filters).some(Boolean);
  const cat = data?.catalogos || {};
  const rows = data?.rows || [];

  const paged = useMemo(() => rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), [rows, page, rowsPerPage]);

  const vigentes = rows.filter((r) => {
    if (!r.fecha_terminacion) return true;
    return new Date(r.fecha_terminacion) >= new Date();
  }).length;

  const formatDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <Box>
      {/* Back button */}
      <Paper elevation={0} sx={{ p: 1.4, mb: 2, border: '1px solid #ede9fe', borderRadius: 2.5, bgcolor: '#faf5ff' }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Button variant="outlined" size="small" startIcon={<ArrowBackRoundedIcon />} onClick={onBack}
            sx={{ borderColor: '#7c3aed', color: '#7c3aed', '&:hover': { borderColor: '#6d28d9', bgcolor: '#f5f3ff' } }}>
            Internacionalización
          </Button>
          <Chip label="Convenios de Internacionalización" size="small" sx={{ bgcolor: '#7c3aed', color: '#fff', fontWeight: 700 }} />
        </Stack>
      </Paper>

      {/* Full-width nav segment */}
      <InternacionalizacionNavSegment
        activeView="convenios"
        onNavigateMovilidad={onNavigateMovilidad}
        onNavigateConvenios={onBack}
      />

      {/* Search & filters */}
      <Paper elevation={0} sx={{ p: 2, mb: 2.5, border: '1px solid #e2e8f0', borderRadius: 2.5 }}>
        <Stack spacing={1.5}>
          <form onSubmit={handleSearchSubmit}>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar por entidad, tipo, programa, objeto del convenio..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: '#94a3b8' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <Button type="submit" size="small" variant="contained" sx={{ fontSize: 11, py: 0.5, px: 1.5 }}>
                      Buscar
                    </Button>
                  </InputAdornment>
                )
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </form>

          <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center">
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Filtros:</Typography>
            {[
              { label: 'Tipo convenio', key: 'tipo_convenio', opts: cat.tiposConvenio || [] },
              { label: 'Año', key: 'anio', opts: cat.anios || [] },
              { label: 'Programa gestor', key: 'programa', opts: cat.programas || [] }
            ].map(({ label, key, opts }) => (
              <FormControl key={key} size="small" sx={{ minWidth: 160 }}>
                <InputLabel sx={{ fontSize: 12 }}>{label}</InputLabel>
                <Select
                  value={filters[key]}
                  label={label}
                  onChange={(e) => setFilter(key, e.target.value)}
                  sx={{ fontSize: 12 }}
                >
                  <MenuItem value=""><em>Todos</em></MenuItem>
                  {opts.map((o) => <MenuItem key={o} value={o} sx={{ fontSize: 12 }}>{o}</MenuItem>)}
                </Select>
              </FormControl>
            ))}
            <Tooltip title="Limpiar todo">
              <span>
                <IconButton size="small" onClick={resetAll} disabled={!hasFilters} color={hasFilters ? 'error' : 'default'}>
                  <FilterAltOffIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Actualizar">
              <IconButton size="small" onClick={load} disabled={loading}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {loading && <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress /></Box>}

      {!loading && data && (
        <>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ mb: 2 }}>
            <Chip
              icon={<HandshakeIcon sx={{ fontSize: 14 }} />}
              label={`${data.total} convenios encontrados`}
              sx={{ fontWeight: 700, bgcolor: '#f1f5f9', fontSize: 12 }}
            />
            <Chip
              label={`${vigentes} vigentes`}
              size="small"
              sx={{ bgcolor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', fontWeight: 700, fontSize: 12 }}
            />
            <Chip
              label={`${data.total - vigentes} vencidos`}
              size="small"
              sx={{ bgcolor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontWeight: 700, fontSize: 12 }}
            />
          </Stack>

          {rows.length === 0 ? (
            <Alert severity="info">No hay convenios con los filtros seleccionados.</Alert>
          ) : (
            <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                      {['Año', 'Entidad / Convenio', 'Tipo', 'Programa gestor', 'Objeto', 'Inicio', 'Terminación', 'Estado', 'Enlace'].map((h) => (
                        <TableCell key={h} sx={{ fontWeight: 800, fontSize: 11, color: '#475569', py: 1.2, whiteSpace: 'nowrap' }}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paged.map((row) => (
                      <TableRow
                        key={row.id}
                        hover
                        sx={{ '&:hover': { bgcolor: '#f8f8ff' }, verticalAlign: 'top' }}
                      >
                        <TableCell sx={{ fontSize: 12, color: '#0f172a', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {row.anio || '—'}
                        </TableCell>
                        <TableCell sx={{ fontSize: 12, color: '#0f172a', maxWidth: 220 }}>
                          <Typography sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>
                            {row.convenio_entidad || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>
                          {row.tipo_convenio || '—'}
                        </TableCell>
                        <TableCell sx={{ fontSize: 11, color: '#475569', maxWidth: 160 }}>
                          {row.programa_gestor || '—'}
                        </TableCell>
                        <TableCell sx={{ fontSize: 11, color: '#64748b', maxWidth: 240 }}>
                          <Typography sx={{ fontSize: 11, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {row.objeto_convenio || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>
                          {formatDate(row.fecha_inicio)}
                        </TableCell>
                        <TableCell sx={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>
                          {formatDate(row.fecha_terminacion)}
                        </TableCell>
                        <TableCell>
                          {statusChip(row.fecha_terminacion)}
                        </TableCell>
                        <TableCell>
                          {row.link_anexo ? (
                            <Tooltip title="Ver convenio">
                              <IconButton
                                size="small"
                                onClick={() => window.open(row.link_anexo, '_blank', 'noopener,noreferrer')}
                                sx={{ color: '#7c3aed' }}
                              >
                                <OpenInNewIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Typography sx={{ fontSize: 10, color: '#cbd5e1' }}>—</Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={rows.length}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
                rowsPerPageOptions={[10, 15, 25, 50]}
                labelRowsPerPage="Filas:"
                sx={{ borderTop: '1px solid #f1f5f9', '.MuiTablePagination-toolbar': { fontSize: 12 } }}
              />
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}

export default InternacionalizacionConveniosDashboard;
