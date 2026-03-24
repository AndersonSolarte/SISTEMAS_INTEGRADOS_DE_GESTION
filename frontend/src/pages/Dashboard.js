import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  IconButton,
  Fade,
  Grid,
  Paper,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Tooltip,
  TextField,
  TablePagination,
  InputAdornment
} from '@mui/material';
import {
  AccountTree as ProcessIcon,
  Assessment as AssessmentIcon,
  CheckCircle as CheckIcon,
  EnergySavingsLeaf as EcoIcon,
  ManageSearch as SearchIcon,
  Close as CloseIcon,
  Security as SecurityIcon,
  Favorite as FavoriteIcon,
  VisibilityOutlined as VisibilityOutlinedIcon,
  FileDownloadOutlined as FileDownloadOutlinedIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import favoritoService from '../services/favoritoService';
import { ROLES, ROLE_LABELS } from '../constants/roles';

function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const favoritosRef = useRef(null);

  const [favorites, setFavorites] = useState([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [favoriteSearch, setFavoriteSearch] = useState('');
  const [favoritePage, setFavoritePage] = useState(0);
  const [favoriteRowsPerPage, setFavoriteRowsPerPage] = useState(10);
  const [openPreviewDialog, setOpenPreviewDialog] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewDownloadUrl, setPreviewDownloadUrl] = useState('');
  const [previewDownloadName, setPreviewDownloadName] = useState('');

  const fetchFavorites = () => {
    setLoadingFavorites(true);
    favoritoService
      .getFavorites()
      .then((response) => {
        const items = response?.data?.favoritos || [];
        setFavorites(items.map((fav) => fav.documento || fav));
      })
      .catch(() => setFavorites([]))
      .finally(() => setLoadingFavorites(false));
  };

  const handleRemoveFavorite = async (docId) => {
    if (!docId) return;
    try {
      await favoritoService.removeFavorite(docId);
      setFavorites((prev) => prev.filter((doc) => doc.id !== docId));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('favorites:updated'));
      }
    } catch (error) {
      // noop
    }
  };

  const [openMapa, setOpenMapa] = useState(false);
  const explicitMenuPermissions = useMemo(
    () => (Array.isArray(user?.menuPermissions) ? user.menuPermissions.map((x) => String(x || '').trim()).filter(Boolean) : []),
    [user?.menuPermissions]
  );
  const isConsultaLikeRole = true;
  const hasMenuPermission = (key) => explicitMenuPermissions.includes(key);

  useEffect(() => {
    if (!isConsultaLikeRole) return;

    fetchFavorites();

    const handler = () => fetchFavorites();
    window.addEventListener('favorites:updated', handler);

    return () => window.removeEventListener('favorites:updated', handler);
  }, [isConsultaLikeRole]);

  // Auto-scroll a favoritos cuando viene del menú
  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    if (params.get('section') === 'favoritos' && favoritosRef.current) {
      setTimeout(() => {
        favoritosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 400);
    }
  }, [location.search]);

  const filteredFavorites = useMemo(() => {
    const term = String(favoriteSearch || '').trim().toLowerCase();
    if (!term) return favorites;
    return favorites.filter((doc) => {
      const tipo = doc?.tipoDocumentacion?.nombre || '';
      const haystack = `${doc?.codigo || ''} ${doc?.titulo || ''} ${doc?.autor || ''} ${tipo}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [favorites, favoriteSearch]);

  const favoritePageData = useMemo(() => {
    const start = favoritePage * favoriteRowsPerPage;
    const end = start + favoriteRowsPerPage;
    return filteredFavorites.slice(start, end);
  }, [filteredFavorites, favoritePage, favoriteRowsPerPage]);

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
      /\/d\/([^/?#]+)(?:\/|$)/
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

  const buildDownloadFileName = (doc) => {
    const base = sanitizeFileName(`${doc?.codigo || 'documento'}_${doc?.titulo || 'archivo'}`);
    const ext = getExtensionFromUrl(doc?.link_acceso);
    return ext ? `${base}.${ext}` : base;
  };

  const openDocumentPreview = (doc) => {
    if (!doc?.link_acceso) return;
    const resolved = toAbsoluteDocumentUrl(doc.link_acceso);
    setPreviewUrl(getPreviewUrl(resolved));
    setPreviewTitle(`${doc?.codigo || ''} ${doc?.titulo || ''}`.trim());
    setPreviewDownloadUrl(getDownloadUrl(resolved));
    setPreviewDownloadName(buildDownloadFileName(doc));
    setOpenPreviewDialog(true);
  };

  const closeDocumentPreview = () => {
    setOpenPreviewDialog(false);
    setPreviewUrl('');
    setPreviewTitle('');
    setPreviewDownloadUrl('');
    setPreviewDownloadName('');
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

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'vigente':
        return 'success';
      case 'obsoleto':
        return 'error';
      case 'en_revision':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getTipoColor = (tipo = '') => {
    const nombre = String(tipo || '').toLowerCase();
    if (nombre.includes('manual')) return { bg: '#dbeafe', color: '#1e40af' };
    if (nombre.includes('procedimiento')) return { bg: '#dcfce7', color: '#15803d' };
    if (nombre.includes('instructivo')) return { bg: '#fef3c7', color: '#a16207' };
    if (nombre.includes('formato')) return { bg: '#f3e8ff', color: '#7c3aed' };
    if (nombre.includes('política') || nombre.includes('politica')) return { bg: '#ffe4e6', color: '#be123c' };
    return { bg: '#f1f5f9', color: '#475569' };
  };


  if (isConsultaLikeRole) {
    return (
      <Container maxWidth="xl" sx={{ px: { xs: 0, sm: 1, md: 2, lg: 3 } }}>
        <Fade in={true} timeout={500}>
          <Box>
            <Paper
              elevation={0}
              sx={{
                mb: { xs: 3, md: 4, lg: 5 },
                p: { xs: 2.5, sm: 3, md: 4, lg: 4.5 },
                borderRadius: { xs: 3, md: 4 },
                border: '1px solid #d7e3f5',
                background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 40%, #be123c 100%)',
                color: 'white',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <Box sx={{ position: 'absolute', inset: 0, opacity: 0.25, background: 'radial-gradient(circle at 15% 10%, rgba(255,255,255,0.18), transparent 45%)' }} />
              <Box sx={{ position: 'absolute', right: -80, bottom: -80, width: { xs: 200, lg: 280, xl: 320 }, height: { xs: 200, lg: 280, xl: 320 }, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 2, md: 3 }} alignItems={{ md: 'center' }} sx={{ position: 'relative', zIndex: 1 }}>
                <Box sx={{ width: { xs: 72, md: 96, xl: 112 }, height: { xs: 72, md: 96, xl: 112 }, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.45)', boxShadow: '0 8px 26px rgba(15, 23, 42, 0.35)', flexShrink: 0 }}>
                  <ProcessIcon sx={{ fontSize: { xs: 34, md: 42, xl: 50 }, color: 'white' }} />
                </Box>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="h4" sx={{ fontWeight: 900, mb: 1, letterSpacing: 0.2, fontSize: { xs: 22, sm: 26, md: 32, lg: 34, xl: 36 } }}>
                    Inicio de Consulta Documental
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)', fontSize: { xs: 13, sm: 14, md: 16, lg: 17 } }}>
                    Accede al mapa de procesos y encuentra documentos institucionales de forma rápida y clara.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<SearchIcon />}
                  onClick={() => navigate('/dashboard/buscar-documentos')}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 800,
                    borderRadius: 2.5,
                    px: 3,
                    bgcolor: '#fff',
                    color: '#0b1e46',
                    width: { xs: '100%', sm: 'auto' },
                    '&:hover': { bgcolor: '#f1f5f9' }
                  }}
                >
                  Consulta de documentos
                </Button>
              </Stack>
            </Paper>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5, lg: 3 }, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ mb: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <ProcessIcon sx={{ color: '#1d4ed8' }} />
                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b', fontSize: { xs: 16, md: 18, lg: 20 } }}>
                        Mapa de Procesos Institucional
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setOpenMapa(true)}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                      >
                        Ampliar
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        component="a"
                        href="/mapa_procesos_cesmag.png"
                        download="mapa_procesos_cesmag.png"
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                      >
                        Descargar
                      </Button>
                    </Stack>
                  </Stack>
                  <Box
                    sx={{
                      borderRadius: 2,
                      border: '1px solid #93c5fd',
                      bgcolor: '#f8fafc',
                      boxShadow: 'inset 0 0 0 1px rgba(29, 78, 216, 0.08)',
                      p: { xs: 1, sm: 1.5 },
                      overflow: 'hidden'
                    }}
                  >
                    <Box
                      component="img"
                      src="/mapa_procesos_cesmag.png"
                      alt="Mapa de procesos CESMAG"
                      sx={{
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                        maxHeight: { xs: 420, sm: 580, md: 760, lg: 900, xl: 1060 },
                        objectFit: 'contain',
                        objectPosition: 'center top',
                        mx: 'auto'
                      }}
                    />
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Stack spacing={2.5}>

                  <Paper ref={favoritosRef} elevation={0} sx={{ p: { xs: 2, sm: 2.5, lg: 3 }, borderRadius: 3, border: '1px solid #e2e8f0', scrollMarginTop: 72 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                      <FavoriteIcon sx={{ color: '#ef4444' }} />
                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b', fontSize: { xs: 16, md: 18, lg: 20 } }}>
                        Documentos Favoritos
                      </Typography>
                    </Stack>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Buscar en favoritos por código, nombre, autor o tipo..."
                      value={favoriteSearch}
                      onChange={(e) => {
                        setFavoriteSearch(e.target.value);
                        setFavoritePage(0);
                      }}
                      sx={{ mb: 2 }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon sx={{ color: '#94a3b8' }} />
                          </InputAdornment>
                        )
                      }}
                    />
                    {loadingFavorites ? (
                      <Box sx={{ py: 4, textAlign: 'center' }}>
                        <CircularProgress size={32} />
                        <Typography variant="body2" sx={{ mt: 1, color: '#64748b' }}>
                          Cargando favoritos...
                        </Typography>
                      </Box>
                    ) : favorites.length === 0 ? (
                      <Alert severity="info">Aún no has marcado documentos como favoritos.</Alert>
                    ) : filteredFavorites.length === 0 ? (
                      <Alert severity="warning">No hay coincidencias con la búsqueda.</Alert>
                    ) : (
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: '#f8fafc' }}>
                              <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13, borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Código</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13, borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tipo</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13, borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Nombre Documento</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13, borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Autor</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13, borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Fecha Creación</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13, borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Estado</TableCell>
                              <TableCell align="center" sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13, borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Acciones</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {favoritePageData.map((doc) => (
                              <TableRow key={doc.id} hover sx={{ '&:hover': { bgcolor: '#f8fafc' }, transition: 'all 0.2s', cursor: 'pointer' }}>
                                <TableCell sx={{ fontWeight: 700, color: '#2563eb', fontSize: 14, fontFamily: 'monospace' }}>{doc.codigo}</TableCell>
                                <TableCell>
                                  <Chip
                                    label={doc?.tipoDocumentacion?.nombre || 'N/A'}
                                    size="small"
                                    sx={{
                                      fontWeight: 700,
                                      fontSize: 12,
                                      borderRadius: 2,
                                      px: 1,
                                      bgcolor: getTipoColor(doc?.tipoDocumentacion?.nombre).bg,
                                      color: getTipoColor(doc?.tipoDocumentacion?.nombre).color
                                    }}
                                  />
                                </TableCell>
                                <TableCell sx={{ color: '#1e293b', fontWeight: 600, fontSize: 14 }}>{doc.titulo}</TableCell>
                                <TableCell sx={{ color: '#475569', fontSize: 13 }}>{doc.autor || '-'}</TableCell>
                                <TableCell sx={{ color: '#475569', fontSize: 13, whiteSpace: 'nowrap' }}>{formatDate(doc.fecha_creacion)}</TableCell>
                                <TableCell>
                                  <Chip label={doc.estado || 'vigente'} color={getEstadoColor(doc.estado)} size="small" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, borderRadius: 1.5 }} />
                                </TableCell>
                                <TableCell align="center">
                                  <Stack direction="row" spacing={1} justifyContent="center">
                                    <Tooltip title="Ver documento" arrow>
                                      <span>
                                        <IconButton
                                          size="small"
                                          sx={{ color: '#2563eb', bgcolor: '#eff6ff', '&:hover': { bgcolor: '#dbeafe' }, '&:disabled': { opacity: 0.3 } }}
                                          disabled={!doc.link_acceso}
                                          onClick={() => {
                                            if (doc.link_acceso) {
                                              openDocumentPreview(doc);
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
                                          sx={{ color: '#059669', bgcolor: '#d1fae5', '&:hover': { bgcolor: '#a7f3d0' }, '&:disabled': { opacity: 0.3 } }}
                                          disabled={!doc.link_acceso}
                                          onClick={() => {
                                            if (doc.link_acceso) {
                                              const absoluteUrl = toAbsoluteDocumentUrl(doc.link_acceso);
                                              const downloadUrl = getDownloadUrl(absoluteUrl);
                                              const link = document.createElement('a');
                                              link.href = downloadUrl;
                                              link.download = buildDownloadFileName(doc);
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
                                    <Tooltip title="Quitar de favoritos" arrow>
                                      <IconButton
                                        size="small"
                                        onClick={() => handleRemoveFavorite(doc.id)}
                                        sx={{ color: '#ef4444', bgcolor: '#fee2e2', '&:hover': { bgcolor: '#fecaca' } }}
                                      >
                                        <FavoriteIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Abrir en búsqueda" arrow>
                                      <IconButton
                                        size="small"
                                        onClick={() => navigate(`/dashboard/buscar-documentos?titulo=${encodeURIComponent(doc.codigo || doc.titulo || '')}`)}
                                        sx={{ color: '#1d4ed8', bgcolor: '#eff6ff', '&:hover': { bgcolor: '#dbeafe' } }}
                                      >
                                        <SearchIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </Stack>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <TablePagination
                          component="div"
                          count={filteredFavorites.length}
                          page={favoritePage}
                          onPageChange={(_e, newPage) => setFavoritePage(newPage)}
                          rowsPerPage={favoriteRowsPerPage}
                          onRowsPerPageChange={(e) => {
                            setFavoriteRowsPerPage(parseInt(e.target.value, 10));
                            setFavoritePage(0);
                          }}
                          rowsPerPageOptions={[5, 10, 25]}
                          labelRowsPerPage="Mostrar:"
                          sx={{ borderTop: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}
                        />
                      </TableContainer>
                    )}
                  </Paper>

                </Stack>
              </Grid>
            </Grid>
          </Box>
        </Fade>
        <Dialog open={openMapa} onClose={() => setOpenMapa(false)} maxWidth="xl" fullWidth>
          <DialogTitle sx={{ fontWeight: 700, pr: 6 }}>
            Mapa de Procesos Institucional
            <IconButton
              onClick={() => setOpenMapa(false)}
              sx={{ position: 'absolute', right: 8, top: 8 }}
              aria-label="Cerrar"
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers sx={{ p: 0, bgcolor: '#0b1220' }}>
            <Box
              component="img"
              src="/mapa_procesos_cesmag.png"
              alt="Mapa de procesos CESMAG"
              sx={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </DialogContent>
        </Dialog>
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
                onClick={() => {
                  if (!previewDownloadUrl) return;
                  const link = document.createElement('a');
                  link.href = previewDownloadUrl;
                  if (previewDownloadName) link.download = previewDownloadName;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
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
      </Container>
    );
  }

  const modules = [
    {
      title: 'Administración del Sistema Documental',
      description: 'Gestiona documentos, manuales, procedimientos y formatos del sistema de calidad',
      icon: <CheckIcon sx={{ fontSize: 60 }} />,
      color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      path: '/dashboard/aseguramiento-calidad',
      active: true
    },
    {
      title: 'Planeación Estratégica',
      description: 'Planeación y efectividad, autoevaluación y gestión de la información',
      icon: <AssessmentIcon sx={{ fontSize: 60 }} />,
      color: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)',
      path: '/dashboard/planeacion-estrategica',
      active: [ROLES.ADMINISTRADOR, ROLES.PLANEACION_ESTRATEGICA].includes(user?.role) || hasMenuPermission('planeacion_estrategica')
    },
    {
      title: 'Gestión de la Información',
      description: 'Centro estadístico institucional con filtros, gráficos y consolidado',
      icon: <AssessmentIcon sx={{ fontSize: 60 }} />,
      color: 'linear-gradient(135deg, #10b981 0%, #0f766e 100%)',
      path: '/dashboard/gestion-informacion',
      active:
        [ROLES.ADMINISTRADOR, ROLES.PLANEACION_ESTRATEGICA, ROLES.GESTION_INFORMACION].includes(user?.role) ||
        hasMenuPermission('gestion_informacion')
    },
    {
      title: 'Sistema Ambiental',
      description: 'Próximamente: Gestión ambiental y sostenibilidad',
      icon: <EcoIcon sx={{ fontSize: 60 }} />,
      color: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
      path: null,
      active: false
    },
    {
      title: 'Seguridad y Salud',
      description: 'Próximamente: SST y gestión de riesgos laborales',
      icon: <SecurityIcon sx={{ fontSize: 60 }} />,
      color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      path: null,
      active: false
    },
    {
      title: 'Indicadores',
      description: 'Próximamente: Dashboard de indicadores y KPIs',
      icon: <AssessmentIcon sx={{ fontSize: 60 }} />,
      color: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
      path: null,
      active: false
    }
  ];

  return (
    <Container maxWidth="xl">
      <Fade in={true} timeout={500}>
        <Box>
          <Box sx={{ 
            mb: 6, 
            p: 4, 
            borderRadius: 4, 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
          }}>
            <Typography variant="h3" sx={{ fontWeight: 800, color: 'white', mb: 1 }}>
              Bienvenido, {user?.nombre}
            </Typography>
            <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 400 }}>
              Sistema Integrado de Gestión - Calidad, Ambiente, SST
            </Typography>
          </Box>

          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                borderRadius: 3, 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 4px 14px rgba(102, 126, 234, 0.3)'
              }}>
                <CardContent>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>MÓDULOS ACTIVOS</Typography>
                  <Typography variant="h2" sx={{ fontWeight: 800, color: 'white', my: 1 }}>{modules.filter((m) => m.active).length}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>de {modules.length} disponibles</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                borderRadius: 3, 
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                boxShadow: '0 4px 14px rgba(240, 147, 251, 0.3)'
              }}>
                <CardContent>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>USUARIO</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'white', my: 1 }}>{ROLE_LABELS[user?.role] || user?.role}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Nivel de acceso</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                borderRadius: 3, 
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                boxShadow: '0 4px 14px rgba(79, 172, 254, 0.3)'
              }}>
                <CardContent>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>ESTADO</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'white', my: 1 }}>Activo</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Sistema operativo</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                borderRadius: 3, 
                background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                boxShadow: '0 4px 14px rgba(67, 233, 123, 0.3)'
              }}>
                <CardContent>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>VERSIÓN</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'white', my: 1 }}>1.0.0</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Última actualización</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Box sx={{ mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
              Módulos del Sistema
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
              Accede a las diferentes áreas del sistema integrado de gestión
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gap: 3,
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              alignItems: 'stretch'
            }}
          >
            {modules.map((module) => (
              <Card
                key={module.title}
                sx={{
                  height: '100%',
                  minHeight: { xs: 250, md: 290 },
                  borderRadius: 4,
                  border: '2px solid',
                  borderColor: module.active ? 'transparent' : '#e2e8f0',
                  boxShadow: module.active ? '0 8px 24px rgba(102, 126, 234, 0.2)' : 'none',
                  transition: 'all 0.3s',
                  opacity: module.active ? 1 : 0.6,
                  position: 'relative',
                  overflow: 'hidden',
                  '&:hover': { boxShadow: module.active ? '0 12px 32px rgba(102, 126, 234, 0.3)' : 'none' }
                }}
              >
                {!module.active && (
                  <Box sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    bgcolor: '#f59e0b',
                    color: 'white',
                    px: 2,
                    py: 0.5,
                    borderRadius: 2,
                    fontSize: 11,
                    fontWeight: 700
                  }}>
                    PRÓXIMAMENTE
                  </Box>
                )}
                <Box
                  sx={{ height: '100%', p: 3, cursor: module.active ? 'pointer' : 'default', display: 'flex' }}
                  onClick={() => module.active && navigate(module.path)}
                >
                  <CardContent sx={{ p: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{
                      width: 80,
                      height: 80,
                      borderRadius: 3,
                      background: module.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 3,
                      boxShadow: '0 4px 14px rgba(0,0,0,0.1)'
                    }}>
                      <Box sx={{ color: 'white' }}>
                        {module.icon}
                      </Box>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
                      {module.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.6 }}>
                      {module.description}
                    </Typography>
                  </CardContent>
                </Box>
              </Card>
            ))}
          </Box>

          <Box sx={{ mt: 6, p: 4, bgcolor: '#f8fafc', borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 2 }}>
                  Recursos Disponibles
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
                  • Gestión documental completa
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
                  • Filtros jerárquicos inteligentes
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
                  • Importación masiva desde Excel
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  • Control de versiones y estados
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 2 }}>
                  Próximas Actualizaciones
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
                  • Sistema de gestión ambiental
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
                  • Módulo de seguridad y salud en el trabajo
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
                  • Dashboard de indicadores de desempeño
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  • Reportes y analytics avanzados
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </Box>
      </Fade>
    </Container>
  );
}

export default Dashboard;

