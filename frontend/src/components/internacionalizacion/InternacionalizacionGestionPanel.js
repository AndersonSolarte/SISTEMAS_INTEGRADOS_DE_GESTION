import React, { useRef, useState } from 'react';
import {
  Box, Paper, Typography, Stack, Button, Chip,
  LinearProgress, Alert, Fade, CircularProgress, Divider
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TableChartIcon from '@mui/icons-material/TableChart';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ArticleIcon from '@mui/icons-material/Article';
import FlightIcon from '@mui/icons-material/Flight';
import HandshakeIcon from '@mui/icons-material/Handshake';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { useSnackbar } from 'notistack';
import gestionInformacionService from '../../services/gestionInformacionService';

// ── Paleta ────────────────────────────────────────────────────────────────────
const COL = {
  s1bg: 'linear-gradient(135deg,#f97316,#ea580c)',   // naranja – paso 1
  s2bg: 'linear-gradient(135deg,#0891b2,#0e7490)',   // cyan    – paso 2
  s1sh: 'rgba(249,115,22,.28)',
  s2sh: 'rgba(8,145,178,.28)'
};

// ── Flecha tipo Canva ─────────────────────────────────────────────────────────
function ArrowStep({ num, label, icon: Icon, active, done, gradient, shadow, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative',
        flex: 1,
        minWidth: 0,
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      {/* Cuerpo flecha (clip-path chevron) */}
      <Box
        sx={{
          position: 'relative',
          background: done ? 'linear-gradient(135deg,#059669,#047857)' : active ? gradient : 'linear-gradient(135deg,#cbd5e1,#94a3b8)',
          boxShadow: active || done ? `0 8px 22px ${shadow}` : 'none',
          borderRadius: '12px 0 0 12px',
          px: 2.5,
          py: 2.2,
          display: 'flex',
          alignItems: 'center',
          gap: 1.6,
          transition: 'all .3s ease',
          '&::after': {
            content: '""',
            position: 'absolute',
            right: -22,
            top: 0,
            bottom: 0,
            width: 44,
            background: done ? 'linear-gradient(135deg,#059669,#047857)' : active ? gradient : 'linear-gradient(135deg,#cbd5e1,#94a3b8)',
            clipPath: 'polygon(0 0, 50% 50%, 0 100%)',
            zIndex: 2,
            transition: 'all .3s ease'
          }
        }}
      >
        {/* Número */}
        <Box sx={{
          width: 44, height: 44, borderRadius: '50%',
          bgcolor: 'rgba(255,255,255,.22)',
          display: 'grid', placeItems: 'center', flexShrink: 0
        }}>
          {done
            ? <CheckCircleIcon sx={{ color: '#fff', fontSize: 24 }} />
            : <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 20, lineHeight: 1 }}>
                {String(num).padStart(2, '0')}
              </Typography>
          }
        </Box>

        <Box sx={{ minWidth: 0, flex: 1, pr: 3 }}>
          <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.2 }}>
            <Icon sx={{ color: 'rgba(255,255,255,.85)', fontSize: 16 }} />
            <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,.75)', fontWeight: 600, letterSpacing: 0.4 }}>
              {done ? 'COMPLETADO' : active ? 'ACTIVO' : 'PENDIENTE'}
            </Typography>
          </Stack>
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
            {label}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ── Tarjeta de paso ────────────────────────────────────────────────────────────
function StepCard({ num, title, subtitle, icon: HeaderIcon, color, gradient, shadow, active, done, children }) {
  return (
    <Fade in timeout={400 + num * 150}>
      <Paper
        elevation={0}
        sx={{
          borderRadius: 4,
          border: `2px solid ${active ? color : done ? '#059669' : '#e2e8f0'}`,
          overflow: 'hidden',
          transition: 'border-color .3s, box-shadow .3s',
          boxShadow: active ? `0 16px 40px ${shadow}` : done ? '0 8px 20px rgba(5,150,105,.15)' : 'none'
        }}
      >
        {/* Header con gradiente */}
        <Box sx={{
          background: active ? gradient : done ? 'linear-gradient(135deg,#059669,#047857)' : '#f1f5f9',
          px: 3, py: 2.4,
          display: 'flex', alignItems: 'center', gap: 2
        }}>
          <Box sx={{
            width: 52, height: 52, borderRadius: 2.5, flexShrink: 0,
            bgcolor: 'rgba(255,255,255,.2)',
            display: 'grid', placeItems: 'center'
          }}>
            {done
              ? <CheckCircleIcon sx={{ color: '#fff', fontSize: 28 }} />
              : <HeaderIcon sx={{ color: active || done ? '#fff' : '#94a3b8', fontSize: 28 }} />
            }
          </Box>
          <Box>
            <Typography sx={{
              fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
              color: active || done ? 'rgba(255,255,255,.75)' : '#94a3b8', mb: 0.2
            }}>
              PASO {String(num).padStart(2, '0')}
            </Typography>
            <Typography sx={{
              fontSize: 17, fontWeight: 900, lineHeight: 1.15,
              color: active || done ? '#fff' : '#475569'
            }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography sx={{ fontSize: 11.5, color: active || done ? 'rgba(255,255,255,.72)' : '#94a3b8', mt: 0.3 }}>
                {subtitle}
              </Typography>
            )}
          </Box>

          {/* Badge número grande decorativo */}
          <Box sx={{
            ml: 'auto', width: 54, height: 54, borderRadius: '50%',
            bgcolor: 'rgba(255,255,255,.12)',
            display: 'grid', placeItems: 'center', flexShrink: 0
          }}>
            <Typography sx={{ color: 'rgba(255,255,255,.5)', fontWeight: 900, fontSize: 26, lineHeight: 1 }}>
              {num}
            </Typography>
          </Box>
        </Box>

        {/* Contenido */}
        <Box sx={{ px: 3, py: 3, bgcolor: '#fff' }}>
          {children}
        </Box>
      </Paper>
    </Fade>
  );
}

// ── Info row ──────────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, color, children }) {
  return (
    <Stack direction="row" alignItems="flex-start" spacing={1.2} sx={{ py: 0.6 }}>
      <Box sx={{ width: 28, height: 28, borderRadius: 1.5, bgcolor: `${color}15`, display: 'grid', placeItems: 'center', flexShrink: 0, mt: 0.1 }}>
        <Icon sx={{ fontSize: 15, color }} />
      </Box>
      <Typography sx={{ fontSize: 12.5, color: '#475569', lineHeight: 1.45 }}>{children}</Typography>
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PANEL PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
function InternacionalizacionGestionPanel({ onBack }) {
  const { enqueueSnackbar } = useSnackbar();
  const fileRef = useRef(null);

  const [downloadDone, setDownloadDone]   = useState(false);
  const [downloading, setDownloading]     = useState(false);
  const [uploading, setUploading]         = useState(false);
  const [progress, setProgress]           = useState(0);
  const [result, setResult]               = useState(null);
  const [selectedFile, setSelectedFile]   = useState(null);

  // ── Descargar plantilla ────────────────────────────────────────────────────
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await gestionInformacionService.downloadTemplate('Internacionalización', '');
      const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'plantilla_internacionalizacion.xlsx'; a.click();
      URL.revokeObjectURL(url);
      setDownloadDone(true);
      enqueueSnackbar('Plantilla descargada correctamente', { variant: 'success' });
    } catch {
      enqueueSnackbar('Error descargando la plantilla', { variant: 'error' });
    } finally { setDownloading(false); }
  };

  // ── Cargar archivo ──────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) { setSelectedFile(f); setResult(null); }
  };

  const handleUpload = async () => {
    if (!selectedFile) { enqueueSnackbar('Selecciona un archivo primero', { variant: 'warning' }); return; }
    setUploading(true); setProgress(10);
    let tick = null;
    try {
      tick = setInterval(() => setProgress((p) => Math.min(p + 7, 88)), 450);
      const r = await gestionInformacionService.importExcel('Internacionalización', selectedFile, '');
      clearInterval(tick); tick = null;
      setProgress(100);
      // r = { success, message, data: { total, importados, hojasProcesadas } }
      const payload = r?.data || r || {};
      const movilidadHoja = (payload.hojasProcesadas || []).find((h) => /movilidad/i.test(h.variable));
      const conveniosHoja = (payload.hojasProcesadas || []).find((h) => /convenio/i.test(h.variable));
      setResult({
        total:     payload.total     ?? 0,
        importados: payload.importados ?? 0,
        movilidad:  movilidadHoja?.importados ?? movilidadHoja?.total ?? null,
        convenios:  conveniosHoja?.importados ?? conveniosHoja?.total ?? null,
        mensaje:    r?.message || 'Datos cargados correctamente'
      });
      enqueueSnackbar(r?.message || 'Datos cargados correctamente', { variant: 'success' });
    } catch (err) {
      if (tick) { clearInterval(tick); tick = null; }
      setProgress(0);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Error al cargar el archivo. Verifica que el servidor backend esté corriendo con los modelos más recientes.';
      enqueueSnackbar(msg, { variant: 'error', autoHideDuration: 8000 });
    } finally { setUploading(false); }
  };

  const resetUpload = () => { setSelectedFile(null); setResult(null); setProgress(0); if (fileRef.current) fileRef.current.value = ''; };

  const step2Active = downloadDone && !result;
  const step2Done   = !!result;

  return (
    <Box sx={{ pb: 5 }}>
      {/* ── Back bar ──────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{ p: 1.6, mb: 3, border: '1px solid #fed7aa', borderRadius: 2.5, bgcolor: '#fff7ed' }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Button variant="outlined" size="small" startIcon={<ArrowBackRoundedIcon />} onClick={onBack}
            sx={{ borderColor: '#f97316', color: '#ea580c', '&:hover': { bgcolor: '#fff7ed', borderColor: '#ea580c' } }}>
            Internacionalización
          </Button>
          <Chip label="Gestión Estadística" size="small" sx={{ bgcolor: '#f97316', color: '#fff', fontWeight: 700 }} />
        </Stack>
      </Paper>

      {/* ── Stepper tipo flecha Canva ─────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 0, mb: 3.5, overflow: 'hidden', borderRadius: 2 }}>
        <ArrowStep num={1} label="Descargar plantilla" icon={DownloadIcon}
          active={!downloadDone} done={downloadDone}
          gradient={COL.s1bg} shadow={COL.s1sh} />
        <Box sx={{ width: 24, flexShrink: 0 }} /> {/* gap para la flecha */}
        <ArrowStep num={2} label="Cargar información" icon={CloudUploadIcon}
          active={step2Active} done={step2Done}
          gradient={COL.s2bg} shadow={COL.s2sh} />
      </Box>

      {/* ── Contenido en 2 columnas ──────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>

        {/* ══ PASO 1: Descargar plantilla ══════════════════════════ */}
        <StepCard num={1} title="Descargar plantilla"
          subtitle="Formato oficial XLSX con estructura e instructivo"
          icon={TableChartIcon}
          color="#f97316" gradient={COL.s1bg} shadow={COL.s1sh}
          active={!downloadDone} done={downloadDone}>

          <Stack spacing={1.2} sx={{ mb: 2.5 }}>
            <InfoRow icon={ArticleIcon} color="#f97316">
              La plantilla incluye una hoja <strong>ESTRUCTURA</strong> con la descripción de cada campo y las instrucciones de llenado.
            </InfoRow>
            <InfoRow icon={FlightIcon} color="#0891b2">
              Hoja <strong>MOVILIDAD</strong> — registra cada evento de movilidad: persona, país, institución, fechas, financiación y resultados.
            </InfoRow>
            <InfoRow icon={HandshakeIcon} color="#7c3aed">
              Hoja <strong>CONVENIOS</strong> — registra cada convenio: entidad, tipo, programa gestor, objeto, fechas y enlace de acceso.
            </InfoRow>
            <InfoRow icon={LightbulbIcon} color="#d97706">
              Mantén los encabezados exactamente como aparecen en la plantilla para garantizar un cargue exitoso.
            </InfoRow>
          </Stack>

          <Divider sx={{ mb: 2.2, borderStyle: 'dashed' }} />

          {downloadDone ? (
            <Stack spacing={1.2}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <CheckCircleIcon sx={{ color: '#059669', fontSize: 20 }} />
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>
                  Plantilla descargada correctamente
                </Typography>
              </Stack>
              <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={handleDownload}
                disabled={downloading}
                sx={{ borderColor: '#f97316', color: '#f97316', width: 'fit-content',
                  '&:hover': { bgcolor: '#fff7ed' } }}>
                Descargar nuevamente
              </Button>
            </Stack>
          ) : (
            <Button
              variant="contained"
              fullWidth
              size="large"
              startIcon={downloading ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon />}
              onClick={handleDownload}
              disabled={downloading}
              sx={{
                py: 1.5, borderRadius: 99, fontWeight: 800, fontSize: 14,
                background: COL.s1bg,
                boxShadow: `0 8px 24px ${COL.s1sh}`,
                '&:hover': { background: COL.s1bg, filter: 'brightness(1.08)' }
              }}
            >
              {downloading ? 'Descargando…' : 'Descargar plantilla Excel'}
            </Button>
          )}
        </StepCard>

        {/* ══ PASO 2: Cargar información ═══════════════════════════ */}
        <StepCard num={2} title="Cargar información"
          subtitle="Sube el archivo Excel completado"
          icon={CloudUploadIcon}
          color="#0891b2" gradient={COL.s2bg} shadow={COL.s2sh}
          active={step2Active} done={step2Done}>

          {!downloadDone && !result && (
            <Alert severity="info" sx={{ borderRadius: 2.5, mb: 2, fontSize: 12 }}>
              Completa primero el <strong>Paso 1</strong> — descarga y llena la plantilla antes de cargar.
            </Alert>
          )}

          {!result && (
            <>
              <Stack spacing={1.2} sx={{ mb: 2.5, opacity: downloadDone ? 1 : 0.45 }}>
                <InfoRow icon={TableChartIcon} color="#0891b2">
                  El sistema procesa automáticamente las hojas <strong>MOVILIDAD</strong> y <strong>CONVENIOS</strong> del archivo.
                </InfoRow>
                <InfoRow icon={LightbulbIcon} color="#d97706">
                  Sube el <strong>archivo completo</strong> (XLSX) — no es necesario seleccionar una subbase individual.
                </InfoRow>
                <InfoRow icon={ArrowForwardIcon} color="#7c3aed">
                  El cargue <strong>reemplaza</strong> los datos existentes en ambas subbases. Verifica los datos antes de subir.
                </InfoRow>
              </Stack>

              <Divider sx={{ mb: 2.2, borderStyle: 'dashed' }} />

              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFileChange} />

              {!selectedFile ? (
                /* ── Drop zone ─────────────────────────────────────────── */
                <Box
                  onClick={() => downloadDone && fileRef.current?.click()}
                  sx={{
                    border: `2px dashed ${downloadDone ? '#0891b2' : '#cbd5e1'}`,
                    borderRadius: 3,
                    p: 3.5,
                    textAlign: 'center',
                    cursor: downloadDone ? 'pointer' : 'not-allowed',
                    bgcolor: downloadDone ? '#f0fdff' : '#f8fafc',
                    transition: 'all .2s',
                    '&:hover': downloadDone ? { bgcolor: '#e0f9ff', borderColor: '#0e7490' } : {}
                  }}
                >
                  <CloudUploadIcon sx={{ fontSize: 44, color: downloadDone ? '#0891b2' : '#cbd5e1', mb: 1 }} />
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: downloadDone ? '#0e7490' : '#94a3b8' }}>
                    {downloadDone ? 'Haz clic para seleccionar el archivo' : 'Disponible después del Paso 1'}
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, color: '#94a3b8', mt: 0.5 }}>
                    Formatos aceptados: XLSX, XLS, CSV
                  </Typography>
                </Box>
              ) : (
                /* ── Archivo seleccionado ──────────────────────────────── */
                <Box>
                  {/* Chip del archivo */}
                  <Paper elevation={0} sx={{ p: 1.8, borderRadius: 2.5, border: '1px solid #bae6fd', bgcolor: '#f0fdff', mb: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: '#0891b215', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <TableChartIcon sx={{ color: '#0891b2', fontSize: 22 }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#0e7490' }} noWrap>
                          {selectedFile.name}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: '#64748b' }}>
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </Typography>
                      </Box>
                      <Button size="small" onClick={resetUpload}
                        sx={{ fontSize: 10.5, color: '#64748b', minWidth: 0 }}>
                        Cambiar
                      </Button>
                    </Stack>
                  </Paper>

                  {/* Progreso */}
                  {uploading && (
                    <Box sx={{ mb: 2 }}>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.6 }}>
                        <Typography sx={{ fontSize: 12, color: '#0891b2', fontWeight: 600 }}>Procesando archivo…</Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#0e7490' }}>{progress}%</Typography>
                      </Stack>
                      <LinearProgress variant="determinate" value={progress}
                        sx={{ height: 8, borderRadius: 4, bgcolor: '#bae6fd',
                          '& .MuiLinearProgress-bar': { background: COL.s2bg, borderRadius: 4 } }} />
                    </Box>
                  )}

                  <Button
                    fullWidth variant="contained" size="large"
                    startIcon={uploading ? <CircularProgress size={18} color="inherit" /> : <CloudUploadIcon />}
                    onClick={handleUpload} disabled={uploading}
                    sx={{
                      py: 1.5, borderRadius: 99, fontWeight: 800, fontSize: 14,
                      background: COL.s2bg,
                      boxShadow: `0 8px 24px ${COL.s2sh}`,
                      '&:hover': { background: COL.s2bg, filter: 'brightness(1.08)' }
                    }}
                  >
                    {uploading ? 'Cargando datos…' : 'Cargar datos al sistema'}
                  </Button>
                </Box>
              )}
            </>
          )}

          {/* ── Resultado exitoso ────────────────────────────────────── */}
          {result && (
            <Fade in timeout={400}>
              <Box>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '2px solid #bbf7d0', bgcolor: '#f0fdf4', mb: 2.5 }}>
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
                    <Box sx={{ width: 48, height: 48, borderRadius: 2.5, bgcolor: '#059669', display: 'grid', placeItems: 'center' }}>
                      <CheckCircleIcon sx={{ color: '#fff', fontSize: 26 }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#065f46' }}>¡Datos cargados exitosamente!</Typography>
                      <Typography sx={{ fontSize: 12, color: '#047857' }}>El sistema procesó el archivo correctamente.</Typography>
                    </Box>
                  </Stack>
                  <Divider sx={{ mb: 1.5, borderColor: '#bbf7d0' }} />
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                    {[
                      { icon: FlightIcon,     label: 'Registros Movilidad', val: result.movilidad  ?? result.total   ?? 0, color: '#0891b2' },
                      { icon: HandshakeIcon,  label: 'Registros Convenios', val: result.convenios  ?? 0,               color: '#7c3aed'  }
                    ].filter((s) => s.val !== null).map((s) => (
                      <Paper key={s.label} elevation={0} sx={{ p: 1.8, borderRadius: 2.5, border: `1px solid ${s.color}22`, bgcolor: `${s.color}08` }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.4 }}>
                          <s.icon sx={{ fontSize: 16, color: s.color }} />
                          <Typography sx={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</Typography>
                        </Stack>
                        <Typography sx={{ fontSize: 24, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                          {Number(s.val).toLocaleString('es-CO')}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                </Paper>
                <Button fullWidth variant="outlined" onClick={resetUpload}
                  sx={{ borderRadius: 99, borderColor: '#0891b2', color: '#0891b2', fontWeight: 700,
                    '&:hover': { bgcolor: '#f0fdff' } }}>
                  Cargar otro archivo
                </Button>
              </Box>
            </Fade>
          )}
        </StepCard>
      </Box>

      {/* ── Footer contenido del módulo ──────────────────────────── */}
      <Box sx={{ mt: 3.5 }}>
        <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, mb: 1.5 }}>
          Contenido del módulo de Internacionalización
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5 }}>
          {[
            { icon: TableChartIcon, label: 'Plantilla', desc: 'Hoja ESTRUCTURA + MOVILIDAD + CONVENIOS en un solo archivo Excel', color: '#f97316' },
            { icon: FlightIcon, label: 'Movilidad', desc: 'Personas, países, instituciones, actividades, fechas y financiación', color: '#0891b2' },
            { icon: HandshakeIcon, label: 'Convenios', desc: 'Entidad, tipo, programa gestor, objeto, vigencia y enlace adjunto', color: '#7c3aed' }
          ].map((it) => (
            <Paper key={it.label} elevation={0}
              sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0', display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: `${it.color}15`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <it.icon sx={{ fontSize: 19, color: it.color }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#0f172a', mb: 0.2 }}>{it.label}</Typography>
                <Typography sx={{ fontSize: 11.5, color: '#64748b', lineHeight: 1.4 }}>{it.desc}</Typography>
              </Box>
            </Paper>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

export default InternacionalizacionGestionPanel;
