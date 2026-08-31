import React, { useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, LinearProgress, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Tooltip, Typography
} from '@mui/material';
import DocumentScannerRoundedIcon from '@mui/icons-material/DocumentScannerRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import XLSXStyle from 'xlsx-js-style';
import { extractDocumentInformation } from '../../services/documentExtractionService';

const MAX_FILE_SIZE = 12 * 1024 * 1024;
const API_BATCH_MAX_SIZE = 60 * 1024 * 1024;
const API_BATCH_MAX_FILES = 20;
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const FILTERS = ['Todos', 'Procesado', 'Revisar', 'Error'];

const STATUS_CONFIG = {
  Procesado: { color: '#15803d', bg: '#dcfce7', border: '#bbf7d0', icon: CheckCircleRoundedIcon },
  Revisar: { color: '#b45309', bg: '#fef3c7', border: '#fde68a', icon: WarningAmberRoundedIcon },
  Error: { color: '#b91c1c', bg: '#fee2e2', border: '#fecaca', icon: ErrorRoundedIcon }
};

const formatBytes = (bytes = 0) => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const StatusChip = ({ status }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.Error;
  const Icon = config.icon;
  return <Chip size="small" icon={<Icon />} label={status} sx={{ bgcolor: config.bg, color: config.color, border: `1px solid ${config.border}`, fontWeight: 800, '& .MuiChip-icon': { color: config.color } }} />;
};

const confidenceColor = (value) => value >= 85 ? 'success' : value >= 60 ? 'warning' : 'error';

const splitIntoUploadBatches = (files) => {
  const batches = [];
  let current = [];
  let currentSize = 0;
  files.forEach((file) => {
    const requiresNextBatch = current.length >= API_BATCH_MAX_FILES || currentSize + file.size > API_BATCH_MAX_SIZE;
    if (requiresNextBatch && current.length > 0) {
      batches.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(file);
    currentSize += file.size;
  });
  if (current.length > 0) batches.push(current);
  return batches;
};

export default function ExtraccionDocumentos() {
  const inputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [instructions, setInstructions] = useState('');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [batch, setBatch] = useState(null);
  const [filter, setFilter] = useState('Todos');
  const [expandedFile, setExpandedFile] = useState('');
  const [progress, setProgress] = useState({ processed: 0, total: 0, batch: 0, batches: 0 });

  const addFiles = (incoming) => {
    setError('');
    setNotice('');
    setBatch(null);
    const candidates = Array.from(incoming || []);
    const invalid = candidates.filter((file) => !ACCEPTED_TYPES.includes(file.type));
    const oversized = candidates.filter((file) => file.size > MAX_FILE_SIZE);
    const valid = candidates.filter((file) => ACCEPTED_TYPES.includes(file.type) && file.size <= MAX_FILE_SIZE);
    const byKey = new Map(files.map((file) => [`${file.name}-${file.size}-${file.lastModified}`, file]));
    valid.forEach((file) => byKey.set(`${file.name}-${file.size}-${file.lastModified}`, file));
    const next = Array.from(byKey.values());
    setFiles(next);
    if (invalid.length || oversized.length) {
      const messages = [];
      if (invalid.length) messages.push(`${invalid.length} archivo(s) con formato no permitido`);
      if (oversized.length) messages.push(`${oversized.length} archivo(s) superiores a 12 MB`);
      setError(messages.join('. ') + '.');
    }
    if (inputRef.current) inputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const removeFile = (indexToRemove) => {
    setFiles((current) => current.filter((_, index) => index !== indexToRemove));
    setBatch(null);
  };

  const reset = () => {
    setFiles([]);
    setInstructions('');
    setBatch(null);
    setFilter('Todos');
    setExpandedFile('');
    setError('');
    setNotice('');
    setProgress({ processed: 0, total: 0, batch: 0, batches: 0 });
    if (inputRef.current) inputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const analyzeBatch = async () => {
    if (files.length === 0) return setError('Selecciona al menos un documento para analizar.');
    setLoading(true);
    setError('');
    setNotice('');
    setBatch(null);
    setProgress({ processed: 0, total: files.length, batch: 0, batches: 0 });
    try {
      const uploadBatches = splitIntoUploadBatches(files);
      const combinedResults = [];
      setProgress({ processed: 0, total: files.length, batch: 0, batches: uploadBatches.length });
      for (let index = 0; index < uploadBatches.length; index += 1) {
        const currentFiles = uploadBatches[index];
        setProgress((current) => ({ ...current, batch: index + 1 }));
        try {
          const payload = await extractDocumentInformation({ files: currentFiles, instructions: instructions.trim() });
          combinedResults.push(...(payload?.resultados || []));
        } catch (requestError) {
          const message = requestError?.response?.data?.message || 'No fue posible procesar este bloque de archivos.';
          combinedResults.push(...currentFiles.map((file) => ({
            archivo: { nombre: file.webkitRelativePath || file.name, tipo: file.type, tamano: file.size },
            estado: 'Error', resultado: null, error: message
          })));
        }
        setProgress((current) => ({ ...current, processed: Math.min(files.length, current.processed + currentFiles.length) }));
      }
      const stats = {
        total: combinedResults.length,
        procesados: combinedResults.filter((item) => item.estado === 'Procesado').length,
        revisar: combinedResults.filter((item) => item.estado === 'Revisar').length,
        errores: combinedResults.filter((item) => item.estado === 'Error').length
      };
      setBatch({ success: true, resultados: combinedResults, stats, persistido: false });
      setNotice(`Analisis terminado: ${stats.total} documento(s), ${stats.procesados} procesados, ${stats.revisar} para revisar y ${stats.errores} con error.`);
    } catch (requestError) {
      setError(requestError?.message || 'No fue posible procesar la carpeta.');
    } finally {
      setLoading(false);
    }
  };

  const documentRows = useMemo(() => (batch?.resultados || []).map((item, index) => ({
    id: `${index}-${item.archivo?.nombre || 'archivo'}`,
    index: index + 1,
    archivo: item.archivo?.nombre || 'Sin nombre',
    tamano: item.archivo?.tamano || 0,
    estado: item.estado,
    tipoDocumento: item.resultado?.tipoDocumento || '—',
    resumen: item.resultado?.resumen || item.error || '—',
    campos: item.resultado?.campos || [],
    texto: item.resultado?.textoExtraido || '',
    advertencias: item.resultado?.advertencias || [],
    error: item.error || ''
  })), [batch]);

  const visibleRows = useMemo(() => filter === 'Todos' ? documentRows : documentRows.filter((row) => row.estado === filter), [documentRows, filter]);

  const exportRows = useMemo(() => documentRows.flatMap((row) => {
    if (row.campos.length === 0) {
      return [{
        ARCHIVO: row.archivo, ESTADO: row.estado, TIPO_DOCUMENTO: row.tipoDocumento,
        RESUMEN: row.resumen, CAMPO: '', VALOR: '', CONFIANZA: '', PAGINA: '', OBSERVACIONES: row.error || row.advertencias.join(' | ')
      }];
    }
    return row.campos.map((field) => ({
      ARCHIVO: row.archivo, ESTADO: row.estado, TIPO_DOCUMENTO: row.tipoDocumento,
      RESUMEN: row.resumen, CAMPO: field.campo, VALOR: field.valor,
      CONFIANZA: field.confianza, PAGINA: field.pagina || '', OBSERVACIONES: row.advertencias.join(' | ')
    }));
  }), [documentRows]);

  const exportExcel = () => {
    if (exportRows.length === 0) return;
    const sheet = XLSXStyle.utils.json_to_sheet(exportRows);
    sheet['!cols'] = [
      { wch: 34 }, { wch: 14 }, { wch: 24 }, { wch: 52 }, { wch: 28 },
      { wch: 46 }, { wch: 13 }, { wch: 10 }, { wch: 48 }
    ];
    const range = XLSXStyle.utils.decode_range(sheet['!ref']);
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const cell = sheet[XLSXStyle.utils.encode_cell({ r: 0, c: column })];
      if (cell) cell.s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1D4ED8' } }, alignment: { horizontal: 'center' } };
    }
    const workbook = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(workbook, sheet, 'Extraccion documental');
    XLSXStyle.writeFile(workbook, `extraccion_documental_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1500, mx: 'auto' }}>
      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #dbeafe', overflow: 'hidden', bgcolor: '#fff' }}>
        <Box sx={{ px: { xs: 2, md: 3 }, py: 2.1, background: 'linear-gradient(135deg,#eff6ff 0%,#faf5ff 100%)', borderBottom: '1px solid #dbeafe' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5}>
            <Stack direction="row" spacing={1.4} alignItems="center">
              <Box sx={{ width: 46, height: 46, borderRadius: 2.2, bgcolor: '#7c3aed', display: 'grid', placeItems: 'center', boxShadow: '0 8px 20px rgba(124,58,237,.22)' }}>
                <DocumentScannerRoundedIcon sx={{ color: '#fff', fontSize: 27 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>Extraccion masiva de PDF e imagenes</Typography>
                <Typography sx={{ fontSize: 12.5, color: '#64748b' }}>Selecciona una carpeta completa o archivos individuales; el sistema los procesa por bloques y consolida una sola tabla.</Typography>
              </Box>
            </Stack>
            {documentRows.length > 0 && <Button variant="contained" startIcon={<DownloadRoundedIcon />} onClick={exportExcel} sx={{ bgcolor: '#15803d', textTransform: 'none', fontWeight: 850, '&:hover': { bgcolor: '#166534' } }}>Exportar tabla a Excel</Button>}
          </Stack>
        </Box>

        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Box
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            sx={{ minHeight: 150, borderRadius: 3, border: `2px dashed ${dragging ? '#7c3aed' : '#bfdbfe'}`, bgcolor: dragging ? '#f5f3ff' : '#f8fbff', display: 'grid', placeItems: 'center', cursor: 'pointer', textAlign: 'center', px: 2, transition: 'all .18s', '&:hover': { borderColor: '#7c3aed', bgcolor: '#f5f3ff' } }}
          >
            <input ref={inputRef} hidden multiple type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onClick={(event) => event.stopPropagation()} onChange={(event) => addFiles(event.target.files)} />
            <input ref={folderInputRef} hidden multiple type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" webkitdirectory="" directory="" onClick={(event) => event.stopPropagation()} onChange={(event) => addFiles(event.target.files)} />
            <Stack spacing={.7} alignItems="center">
              <UploadFileRoundedIcon sx={{ fontSize: 52, color: '#7c3aed' }} />
              <Typography sx={{ fontWeight: 900, color: '#1e293b', fontSize: 16 }}>Arrastra varios documentos o haz clic para seleccionarlos</Typography>
              <Typography sx={{ color: '#64748b', fontSize: 12.5 }}>PDF, PNG, JPG, JPEG o WEBP · 12 MB por archivo · envio automatico en bloques de 20/60 MB</Typography>
            </Stack>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="center" sx={{ mt: 1.2 }}>
            <Button variant="contained" startIcon={<FolderOpenRoundedIcon />} onClick={() => folderInputRef.current?.click()} disabled={loading} sx={{ bgcolor: '#7c3aed', textTransform: 'none', fontWeight: 850, '&:hover': { bgcolor: '#6d28d9' } }}>Seleccionar carpeta completa</Button>
            <Button variant="outlined" startIcon={<UploadFileRoundedIcon />} onClick={() => inputRef.current?.click()} disabled={loading} sx={{ textTransform: 'none', fontWeight: 800 }}>Seleccionar archivos</Button>
          </Stack>

          {files.length > 0 && (
            <Paper elevation={0} sx={{ mt: 1.5, p: 1.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography sx={{ fontWeight: 850, color: '#334155', fontSize: 13 }}>Documentos compatibles encontrados: {files.length}</Typography>
                <Button size="small" color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={(event) => { event.stopPropagation(); reset(); }} sx={{ textTransform: 'none' }}>Quitar todos</Button>
              </Stack>
              <Stack direction="row" spacing={.8} useFlexGap flexWrap="wrap">
                {files.slice(0, 100).map((file, index) => (
                  <Chip key={`${file.webkitRelativePath || file.name}-${file.size}-${index}`} icon={file.type === 'application/pdf' ? <PictureAsPdfRoundedIcon /> : <ImageRoundedIcon />} label={`${file.webkitRelativePath || file.name} · ${formatBytes(file.size)}`} onDelete={() => removeFile(index)} sx={{ maxWidth: 420, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }} />
                ))}
                {files.length > 100 && <Chip color="primary" variant="outlined" label={`+ ${files.length - 100} archivos adicionales`} />}
              </Stack>
            </Paper>
          )}

          <TextField sx={{ mt: 1.5 }} label="¿Que informacion deseas extraer de todos los archivos? (opcional)" placeholder="Ejemplo: nombre, documento, fecha, numero de resolucion y vigencia" value={instructions} onChange={(event) => setInstructions(event.target.value.slice(0, 1200))} multiline minRows={2} fullWidth helperText={`${instructions.length}/1200 · La misma instruccion se aplicara a todo el lote.`} />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
            <Button variant="contained" startIcon={loading ? <CircularProgress color="inherit" size={18} /> : <AutoAwesomeRoundedIcon />} disabled={files.length === 0 || loading} onClick={analyzeBatch} sx={{ bgcolor: '#7c3aed', fontWeight: 850, textTransform: 'none', '&:hover': { bgcolor: '#6d28d9' } }}>{loading ? `Analizando ${files.length} documento(s)...` : `Analizar ${files.length || ''} documento(s)`}</Button>
            {(files.length > 0 || batch) && <Button variant="outlined" startIcon={<RestartAltRoundedIcon />} disabled={loading} onClick={reset} sx={{ textTransform: 'none' }}>Nuevo lote</Button>}
          </Stack>
          {loading && (
            <Box sx={{ mt: 1.5 }}>
              <LinearProgress variant={progress.total > 0 ? 'determinate' : 'indeterminate'} value={progress.total > 0 ? (progress.processed / progress.total) * 100 : 0} sx={{ borderRadius: 99, height: 8 }} />
              <Typography sx={{ mt: .6, color: '#64748b', fontSize: 12, textAlign: 'center' }}>Bloque {progress.batch} de {progress.batches} · {progress.processed} de {progress.total} documentos completados</Typography>
            </Box>
          )}
          {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
          {notice && <Alert severity="success" sx={{ mt: 1.5 }}>{notice}</Alert>}
          <Alert severity="info" sx={{ mt: 1.5, fontSize: 12 }}>Los archivos no se almacenan, pero se envian al proveedor de IA configurado. No cargues informacion sensible sin autorizacion y revisa los resultados contra el original.</Alert>

          {documentRows.length > 0 && (
            <Box sx={{ mt: 2.5 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1.2} sx={{ mb: 1.2 }}>
                <Stack direction="row" spacing={.8} useFlexGap flexWrap="wrap">
                  {FILTERS.map((item) => {
                    const count = item === 'Todos' ? documentRows.length : documentRows.filter((row) => row.estado === item).length;
                    return <Chip key={item} clickable label={`${item} (${count})`} color={filter === item ? 'primary' : 'default'} variant={filter === item ? 'filled' : 'outlined'} onClick={() => setFilter(item)} sx={{ fontWeight: 800 }} />;
                  })}
                </Stack>
                <Typography sx={{ color: '#64748b', fontSize: 12 }}>Mostrando {visibleRows.length} de {documentRows.length} documentos</Typography>
              </Stack>

              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #dbe6f5', borderRadius: 2.5, maxHeight: 620 }}>
                <Table stickyHeader size="small">
                  <TableHead><TableRow>
                    {['#', 'Archivo', 'Tipo detectado', 'Resumen', 'Campos', 'Confianza', 'Estado', 'Detalle'].map((header) => <TableCell key={header} align={['#', 'Campos', 'Confianza', 'Estado', 'Detalle'].includes(header) ? 'center' : 'left'} sx={{ bgcolor: '#f1f5f9', color: '#334155', fontWeight: 900, fontSize: 11.5, textTransform: 'uppercase', py: 1.4 }}>{header}</TableCell>)}
                  </TableRow></TableHead>
                  <TableBody>
                    {visibleRows.map((row) => {
                      const confidenceValues = row.campos.map((field) => Number(field.confianza)).filter(Number.isFinite);
                      const confidence = confidenceValues.length ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length) : 0;
                      const expanded = expandedFile === row.id;
                      return (
                        <React.Fragment key={row.id}>
                          <TableRow hover sx={{ '& td': { borderBottom: expanded ? 0 : undefined } }}>
                            <TableCell align="center" sx={{ color: '#64748b' }}>{row.index}</TableCell>
                            <TableCell sx={{ minWidth: 230 }}><Stack direction="row" spacing={.8} alignItems="center">{row.archivo.toLowerCase().endsWith('.pdf') ? <PictureAsPdfRoundedIcon sx={{ color: '#dc2626', fontSize: 20 }} /> : <ImageRoundedIcon sx={{ color: '#7c3aed', fontSize: 20 }} />}<Box sx={{ minWidth: 0 }}><Tooltip title={row.archivo}><Typography sx={{ fontWeight: 850, color: '#0f172a', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.archivo}</Typography></Tooltip><Typography sx={{ fontSize: 10.5, color: '#94a3b8' }}>{formatBytes(row.tamano)}</Typography></Box></Stack></TableCell>
                            <TableCell sx={{ fontWeight: 750, color: '#334155', minWidth: 150 }}>{row.tipoDocumento}</TableCell>
                            <TableCell sx={{ color: row.estado === 'Error' ? '#b91c1c' : '#475569', minWidth: 260, maxWidth: 430 }}><Tooltip title={row.resumen}><Typography sx={{ fontSize: 12.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.resumen}</Typography></Tooltip></TableCell>
                            <TableCell align="center" sx={{ fontWeight: 900 }}>{row.campos.length}</TableCell>
                            <TableCell align="center">{row.estado !== 'Error' ? <Chip size="small" color={confidenceColor(confidence)} label={`${confidence}%`} /> : '—'}</TableCell>
                            <TableCell align="center"><StatusChip status={row.estado} /></TableCell>
                            <TableCell align="center"><Tooltip title="Ver campos extraidos"><span><Button size="small" disabled={row.estado === 'Error' && !row.error} onClick={() => setExpandedFile(expanded ? '' : row.id)} startIcon={<VisibilityRoundedIcon />} sx={{ textTransform: 'none', minWidth: 84 }}>{expanded ? 'Ocultar' : 'Ver'}</Button></span></Tooltip></TableCell>
                          </TableRow>
                          {expanded && (
                            <TableRow><TableCell colSpan={8} sx={{ p: 0, bgcolor: '#f8fbff', borderLeft: '4px solid #7c3aed' }}>
                              <Box sx={{ p: 1.5 }}>
                                {row.advertencias.length > 0 && <Alert severity="warning" sx={{ mb: 1 }}>{row.advertencias.join(' · ')}</Alert>}
                                {row.error && <Alert severity="error" sx={{ mb: 1 }}>{row.error}</Alert>}
                                {row.campos.length > 0 ? (
                                  <Table size="small"><TableHead><TableRow><TableCell sx={{ fontWeight: 900 }}>Campo</TableCell><TableCell sx={{ fontWeight: 900 }}>Valor</TableCell><TableCell align="center" sx={{ fontWeight: 900 }}>Confianza</TableCell><TableCell align="center" sx={{ fontWeight: 900 }}>Pagina</TableCell></TableRow></TableHead><TableBody>{row.campos.map((field, fieldIndex) => <TableRow key={`${field.campo}-${fieldIndex}`}><TableCell sx={{ fontWeight: 800 }}>{field.campo}</TableCell><TableCell sx={{ whiteSpace: 'pre-wrap' }}>{field.valor}</TableCell><TableCell align="center">{field.confianza}%</TableCell><TableCell align="center">{field.pagina || '—'}</TableCell></TableRow>)}</TableBody></Table>
                                ) : <Typography sx={{ color: '#64748b', py: 1 }}>No hay campos extraidos para este archivo.</Typography>}
                                {row.texto && <Box sx={{ mt: 1.2, p: 1.2, bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 1.5, maxHeight: 180, overflow: 'auto' }}><Typography sx={{ fontWeight: 850, mb: .5 }}>Texto extraido</Typography><Typography component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12, color: '#475569' }}>{row.texto}</Typography></Box>}
                              </Box>
                            </TableCell></TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
