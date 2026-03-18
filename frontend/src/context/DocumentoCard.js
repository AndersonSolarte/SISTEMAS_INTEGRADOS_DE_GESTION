import React from 'react';
import {
    Button,
    Card,
    CardContent,
    Chip,
    Stack,
    Typography,
    Box
} from '@mui/material';
import {
    Download as DownloadIcon,
    Visibility as VisibilityIcon
} from '@mui/icons-material';

const buildFileUrl = (link = '') => {
    if (!link) return '';
    if (/^https?:\/\//i.test(link)) return link;

    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    const base = apiUrl.replace(/\/api\/?$/, '');
    return `${base}${link.startsWith('/') ? '' : '/'}${link}`;
};

const DocumentoCard = ({ doc }) => {
    const fileUrl = buildFileUrl(doc.link_acceso);
    const estadoColor = doc.estado === 'vigente' ? 'success' : doc.estado === 'en_revision' ? 'warning' : 'default';
    const macro = doc?.subproceso?.proceso?.macroProceso?.nombre || 'Sin macroproceso';
    const proceso = doc?.subproceso?.proceso?.nombre || 'Sin proceso';
    const subproceso = doc?.subproceso?.nombre || 'Sin subproceso';

    return (
        <Card
            sx={{
                height: '100%',
                borderRadius: 3,
                border: '1px solid #e2e8f0',
                transition: 'all 0.2s',
                '&:hover': {
                    boxShadow: '0 10px 24px rgba(15, 118, 110, 0.16)'
                }
            }}
        >
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Chip label={doc.codigo || 'SIN CÓDIGO'} sx={{ fontWeight: 700 }} size="small" />
                    <Chip label={doc.estado || 'N/A'} size="small" color={estadoColor} />
                </Stack>

                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', lineHeight: 1.25 }}>
                    {doc.titulo || 'Documento sin título'}
                </Typography>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip label={doc?.tipoDocumentacion?.nombre || 'Sin tipo'} size="small" variant="outlined" />
                    <Chip label={`v${doc.version || 'N/A'}`} size="small" variant="outlined" />
                </Stack>

                <Box sx={{ mt: 0.5 }}>
                    <Typography variant="caption" sx={{ display: 'block', color: '#64748b' }}>{macro}</Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: '#64748b' }}>{proceso}</Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: '#64748b' }}>{subproceso}</Typography>
                </Box>

                <Stack direction="row" spacing={1} sx={{ mt: 'auto', pt: 1 }}>
                    <Button
                        fullWidth
                        variant="contained"
                        size="small"
                        startIcon={<VisibilityIcon />}
                        disabled={!fileUrl}
                        onClick={() => window.open(fileUrl, '_blank', 'noopener,noreferrer')}
                        sx={{ textTransform: 'none', fontWeight: 700, background: '#0e7490' }}
                    >
                        Ver
                    </Button>
                    <Button
                        fullWidth
                        variant="outlined"
                        size="small"
                        startIcon={<DownloadIcon />}
                        disabled={!fileUrl}
                        onClick={() => window.open(fileUrl, '_blank', 'noopener,noreferrer')}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                        Descargar
                    </Button>
                </Stack>
            </CardContent>
        </Card>
    );
};

export default DocumentoCard;