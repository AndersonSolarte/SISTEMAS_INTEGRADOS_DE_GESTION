import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import reporteSalidaService from '../../services/reporteSalidaService';

const INITIAL_FORM = {
  personal: { nombre: '', documento: '', correo: '' },
  laboral: { dependencia: '', cargo: '' },
  salida: { tipo: 'cita_eps', fecha: '', horaInicio: '', horaFin: '', motivo: '' },
  reposicion: { fecha: '', horaInicio: '', horaFin: '', observacion: '' }
};

const toMinutes = (date, start, end) => {
  if (!date || !start || !end) return null;
  const from = new Date(`${date}T${start}`);
  const to = new Date(`${date}T${end}`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) return null;
  return Math.round((to.getTime() - from.getTime()) / 60000);
};

const formatMinutes = (minutes) => {
  const total = Number(minutes || 0);
  if (!Number.isFinite(total) || total <= 0) return '0h 00m';
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

const normalizeOption = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const uniqueSorted = (values) => {
  const seen = new Set();
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value) => {
      const key = normalizeOption(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.localeCompare(b, 'es'));
};

const hasExactOption = (value, options) => {
  const key = normalizeOption(value);
  return Boolean(key) && options.some((option) => normalizeOption(option) === key);
};

const sectionSx = {
  p: { xs: 1.4, md: 1.8 },
  border: '1px solid #dbe6f5',
  borderRadius: 2.5,
  bgcolor: '#ffffff'
};

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    bgcolor: '#fff',
    minHeight: 44
  },
  '& .MuiInputLabel-root': {
    fontWeight: 800,
    color: '#64748b'
  }
};

const autocompleteListSx = {
  maxHeight: 340,
  '& li': {
    whiteSpace: 'normal',
    lineHeight: 1.35,
    py: 1,
    px: 1.5,
    fontSize: 14
  }
};

const autocompletePopperSx = {
  '& .MuiAutocomplete-paper': {
    borderRadius: 2,
    border: '1px solid #bfdbfe',
    boxShadow: '0 18px 42px rgba(15, 23, 42, 0.18)'
  }
};

const responsiveFieldGrid = (columns) => ({
  display: 'grid',
  gap: 1.5,
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, minmax(0, 1fr))',
    md: columns
  },
  alignItems: 'start',
  '& > *': {
    minWidth: 0
  }
});

const SectionTitle = ({ title, subtitle }) => (
  <Box sx={{ mb: 1.4 }}>
    <Typography sx={{ fontWeight: 950, color: '#0f172a', fontSize: 15 }}>{title}</Typography>
    {subtitle && <Typography sx={{ color: '#64748b', fontSize: 12.5, mt: 0.2 }}>{subtitle}</Typography>}
  </Box>
);

function ReporteSalidaFormDialog({ open, documento, user, onClose, onSubmitted }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [jefe, setJefe] = useState(null);
  const [jefes, setJefes] = useState([]);
  const [dependencias, setDependencias] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [laboralRows, setLaboralRows] = useState([]);
  const [catalogYear, setCatalogYear] = useState('');
  const [jefeSearch, setJefeSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingJefes, setLoadingJefes] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm({
      ...INITIAL_FORM,
      personal: {
        nombre: user?.nombre || '',
        documento: user?.username || '',
        correo: user?.email || ''
      }
    });
    setJefe(null);
    setJefeSearch('');
    setErrorMessage('');
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    reporteSalidaService.getCatalogoLaboral()
      .then((response) => {
        const data = response?.data || {};
        setDependencias(data.dependencias || []);
        setCargos(data.cargos || []);
        setLaboralRows(data.relaciones || []);
        setCatalogYear(data.periodoLabel || data.anio || '');
        setJefes(data.jefes || []);
        if (data.currentEmployee) {
          setForm((prev) => ({
            ...prev,
            laboral: {
              dependencia: data.currentEmployee.dependencia || prev.laboral.dependencia,
              cargo: data.currentEmployee.cargo || prev.laboral.cargo
            }
          }));
        }
      })
      .catch(() => {
        setDependencias([]);
        setCargos([]);
        setLaboralRows([]);
        setCatalogYear('');
      });
  }, [open]);

  useEffect(() => {
    setLoadingJefes(false);
  }, [jefeSearch, open]);

  const salidaMinutes = useMemo(
    () => toMinutes(form.salida.fecha, form.salida.horaInicio, form.salida.horaFin),
    [form.salida.fecha, form.salida.horaInicio, form.salida.horaFin]
  );

  const reposicionMinutes = useMemo(
    () => toMinutes(form.reposicion.fecha, form.reposicion.horaInicio, form.reposicion.horaFin),
    [form.reposicion.fecha, form.reposicion.horaInicio, form.reposicion.horaFin]
  );

  const isPersonal = form.salida.tipo === 'diligencia_personal';
  const diff = isPersonal ? Number(reposicionMinutes || 0) - Number(salidaMinutes || 0) : 0;

  const selectedDependenciaIsCatalog = hasExactOption(form.laboral.dependencia, dependencias);
  const selectedCargoIsCatalog = hasExactOption(form.laboral.cargo, cargos);
  const selectedJefeDependencia = jefe?.dependencia || '';

  const filteredLaboralRows = useMemo(() => {
    return laboralRows.filter((row) => {
      const rowDep = normalizeOption(row.dependencia);
      const rowCargo = normalizeOption(row.cargo);
      if (selectedDependenciaIsCatalog && rowDep !== normalizeOption(form.laboral.dependencia)) return false;
      if (selectedCargoIsCatalog && rowCargo !== normalizeOption(form.laboral.cargo)) return false;
      if (selectedJefeDependencia && rowDep !== normalizeOption(selectedJefeDependencia)) return false;
      return true;
    });
  }, [form.laboral.cargo, form.laboral.dependencia, laboralRows, selectedCargoIsCatalog, selectedDependenciaIsCatalog, selectedJefeDependencia]);

  const dependenciaOptions = useMemo(() => {
    if (!laboralRows.length) return dependencias;
    const sourceRows = selectedCargoIsCatalog || selectedJefeDependencia
      ? filteredLaboralRows
      : laboralRows;
    return uniqueSorted((sourceRows.length ? sourceRows : laboralRows).map((row) => row.dependencia));
  }, [dependencias, filteredLaboralRows, laboralRows, selectedCargoIsCatalog, selectedJefeDependencia]);

  const cargoOptions = useMemo(() => {
    if (!laboralRows.length) return cargos;
    const sourceRows = selectedDependenciaIsCatalog || selectedJefeDependencia
      ? filteredLaboralRows
      : laboralRows;
    return uniqueSorted((sourceRows.length ? sourceRows : laboralRows).map((row) => row.cargo));
  }, [cargos, filteredLaboralRows, laboralRows, selectedDependenciaIsCatalog, selectedJefeDependencia]);

  const jefeOptions = useMemo(() => {
    const depKey = normalizeOption(form.laboral.dependencia);
    const term = normalizeOption(jefeSearch);
    const matchesSearch = (item) => {
      if (!term) return true;
      return [item.nombre, item.email, item.username, item.cargo, item.dependencia]
        .some((value) => normalizeOption(value).includes(term));
    };

    const bySearch = jefes.filter(matchesSearch);
    if (!selectedDependenciaIsCatalog) return bySearch;

    const sameDependency = bySearch.filter((item) => normalizeOption(item.dependencia) === depKey);
    if (sameDependency.length) {
      return sameDependency.map((item) => ({ ...item, matchGroup: 'Jefes de la dependencia' }));
    }

    return bySearch.map((item) => ({ ...item, matchGroup: 'Jefes institucionales disponibles' }));
  }, [form.laboral.dependencia, jefeSearch, jefes, selectedDependenciaIsCatalog]);

  useEffect(() => {
    if (!jefe || !selectedDependenciaIsCatalog) return;
    const depKey = normalizeOption(form.laboral.dependencia);
    const hasSameDependencyBoss = jefes.some((item) => normalizeOption(item.dependencia) === depKey);
    if (hasSameDependencyBoss && normalizeOption(jefe.dependencia) !== depKey) {
      setJefe(null);
    }
  }, [form.laboral.dependencia, jefe, jefes, selectedDependenciaIsCatalog]);

  const jefeHasDirectDependencyMatch = useMemo(() => {
    if (!selectedDependenciaIsCatalog) return true;
    const depKey = normalizeOption(form.laboral.dependencia);
    return jefes.some((item) => normalizeOption(item.dependencia) === depKey);
  }, [form.laboral.dependencia, jefes, selectedDependenciaIsCatalog]);

  const jefeHelperText = selectedDependenciaIsCatalog && !jefeHasDirectDependencyMatch
    ? 'No hay jefe directivo registrado en esta dependencia; se muestran jefes institucionales disponibles.'
    : '';

  const update = (section, key, value) => {
    setForm((prev) => ({
      ...prev,
      [section]: { ...prev[section], [key]: value }
    }));
  };

  const submit = async () => {
    setSubmitting(true);
    setErrorMessage('');
    try {
      const response = await reporteSalidaService.radicarSolicitud({
        documentoId: documento?.id,
        jefeInmediatoUserId: jefe?.userId || null,
        jefeInmediato: jefe ? {
          id: jefe.id,
          userId: jefe.userId || null,
          nombre: jefe.nombre || '',
          email: jefe.email || '',
          username: jefe.username || '',
          cargo: jefe.cargo || '',
          dependencia: jefe.dependencia || '',
          source: jefe.source || 'recurso_humano_administrativos'
        } : null,
        ...form
      });
      onSubmitted?.(response);
      onClose?.();
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || error?.message || 'No se pudo radicar la solicitud.');
    } finally {
      setSubmitting(false);
    }
  };

  const disableSubmit = submitting || !jefe || !jefe.email || !form.laboral.dependencia || !form.laboral.cargo
    || !form.salida.fecha || !form.salida.horaInicio || !form.salida.horaFin
    || !salidaMinutes
    || (isPersonal && (!form.reposicion.fecha || !form.reposicion.horaInicio || !form.reposicion.horaFin || !reposicionMinutes));

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
          width: 'min(1180px, calc(100vw - 32px))'
        }
      }}
    >
      <DialogTitle sx={{ px: { xs: 2, md: 3 }, py: 2, bgcolor: '#f8fbff', borderBottom: '1px solid #dbe6f5' }}>
        <Stack direction="row" spacing={1.2} alignItems="center">
          <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: '#2563eb', display: 'grid', placeItems: 'center' }}>
            <AssignmentTurnedInIcon sx={{ color: '#fff', fontSize: 22 }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Diligenciar reporte de salida</Typography>
            <Typography sx={{ color: '#64748b', fontSize: 12 }}>{documento?.codigo} - {documento?.titulo}</Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: '#f6f8fb', p: { xs: 2, md: 3 } }}>
        <Stack spacing={2}>
          <Alert severity="info">
            La solicitud se radica para el usuario autenticado. El sistema no permite enviar reportes a nombre de otros usuarios.
          </Alert>
          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

          <Box sx={sectionSx}>
            <SectionTitle title="Datos del colaborador" subtitle="Estos datos se toman del usuario autenticado." />
            <Box sx={responsiveFieldGrid('minmax(220px, 1fr) minmax(180px, 0.75fr) minmax(260px, 1.2fr)')}>
              <TextField sx={inputSx} fullWidth size="small" label="Nombre" value={form.personal.nombre} disabled />
              <TextField sx={inputSx} fullWidth size="small" label="Documento" value={form.personal.documento} disabled />
              <TextField sx={inputSx} fullWidth size="small" label="Correo" value={form.personal.correo} disabled />
            </Box>
          </Box>

          <Box sx={sectionSx}>
            <SectionTitle
              title="Información laboral"
              subtitle={catalogYear ? `Datos sugeridos desde Recurso Humano administrativo ${catalogYear}.` : 'Seleccione la dependencia institucional y registre el cargo.'}
            />
            <Box sx={responsiveFieldGrid('minmax(360px, 1.45fr) minmax(240px, 0.9fr)')}>
              <Autocomplete
                freeSolo
                fullWidth
                options={dependenciaOptions}
                value={form.laboral.dependencia || ''}
                onChange={(_, value) => update('laboral', 'dependencia', value || '')}
                onInputChange={(_, value) => update('laboral', 'dependencia', value || '')}
                ListboxProps={{ sx: autocompleteListSx }}
                componentsProps={{
                  popper: {
                    sx: {
                      ...autocompletePopperSx,
                      width: { xs: 'calc(100vw - 48px) !important', md: '720px !important' },
                      maxWidth: 'calc(100vw - 48px)'
                    }
                  }
                }}
                renderInput={(params) => <TextField {...params} sx={inputSx} fullWidth size="small" required label="Dependencia" placeholder="Buscar dependencia" />}
              />
              <Autocomplete
                freeSolo
                fullWidth
                options={cargoOptions}
                value={form.laboral.cargo || ''}
                onChange={(_, value) => update('laboral', 'cargo', value || '')}
                onInputChange={(_, value) => update('laboral', 'cargo', value || '')}
                ListboxProps={{ sx: autocompleteListSx }}
                componentsProps={{
                  popper: {
                    sx: {
                      ...autocompletePopperSx,
                      width: { xs: 'calc(100vw - 48px) !important', md: '620px !important' },
                      maxWidth: 'calc(100vw - 48px)'
                    }
                  }
                }}
                renderInput={(params) => <TextField {...params} sx={inputSx} fullWidth size="small" required label="Cargo" placeholder="Buscar cargo" />}
              />
            </Box>
            <Box sx={{ mt: 1.5 }}>
              <Autocomplete
                fullWidth
                options={jefeOptions}
                value={jefe}
                loading={loadingJefes}
                groupBy={(option) => option.matchGroup || ''}
                onInputChange={(_, value) => setJefeSearch(value)}
                onChange={(_, value) => {
                  setJefe(value);
                  if (value?.dependencia && !form.laboral.dependencia) {
                    update('laboral', 'dependencia', value.dependencia);
                  }
                }}
                getOptionLabel={(option) => {
                  if (!option) return '';
                  const main = [option.cargo, option.nombre].filter(Boolean).join(' - ');
                  return option.email ? `${main} (${option.email})` : main;
                }}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                ListboxProps={{ sx: autocompleteListSx }}
                componentsProps={{
                  popper: {
                    sx: {
                      ...autocompletePopperSx,
                      width: { xs: 'calc(100vw - 48px) !important', md: '860px !important' },
                      maxWidth: 'calc(100vw - 48px)'
                    }
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    sx={inputSx}
                    label="Jefe inmediato"
                    required
                    size="small"
                    placeholder="Buscar por nombre, correo o documento"
                    helperText={jefe && !jefe.email ? 'El jefe seleccionado no tiene correo registrado en Recurso Humano.' : jefeHelperText}
                    error={Boolean(jefe && !jefe.email)}
                  />
                )}
              />
            </Box>
          </Box>

          <Box sx={sectionSx}>
            <SectionTitle title="Datos de la salida" subtitle="Indique el tipo de salida y el tiempo solicitado." />
            <Box sx={responsiveFieldGrid('minmax(230px, 1.25fr) minmax(190px, 1fr) minmax(170px, 0.9fr) minmax(170px, 0.9fr) minmax(110px, 0.55fr)')}>
              <TextField sx={inputSx} select fullWidth size="small" label="Tipo de salida" value={form.salida.tipo} onChange={(e) => update('salida', 'tipo', e.target.value)}>
                <MenuItem value="cita_eps">Cita médica por EPS</MenuItem>
                <MenuItem value="cita_particular">Cita médica particular</MenuItem>
                <MenuItem value="diligencia_personal">Diligencia personal</MenuItem>
              </TextField>
              <TextField sx={inputSx} fullWidth size="small" required type="date" label="Fecha salida" InputLabelProps={{ shrink: true }} value={form.salida.fecha} onChange={(e) => update('salida', 'fecha', e.target.value)} />
              <TextField sx={inputSx} fullWidth size="small" required type="time" label="Hora inicio" InputLabelProps={{ shrink: true }} value={form.salida.horaInicio} onChange={(e) => update('salida', 'horaInicio', e.target.value)} />
              <TextField sx={inputSx} fullWidth size="small" required type="time" label="Hora fin" InputLabelProps={{ shrink: true }} value={form.salida.horaFin} onChange={(e) => update('salida', 'horaFin', e.target.value)} />
              <Box sx={{ minHeight: 44, px: 1.5, borderRadius: 2, bgcolor: salidaMinutes ? '#ecfdf5' : '#fff7ed', border: `1px solid ${salidaMinutes ? '#bbf7d0' : '#fed7aa'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ color: salidaMinutes ? '#166534' : '#c2410c', fontSize: 12, fontWeight: 900 }}>
                  {formatMinutes(salidaMinutes)}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ mt: 1.5 }}>
              <TextField sx={inputSx} fullWidth size="small" multiline minRows={2} label="Motivo / observación" value={form.salida.motivo} onChange={(e) => update('salida', 'motivo', e.target.value)} />
            </Box>
          </Box>

          <Alert severity={salidaMinutes ? 'success' : 'warning'}>Tiempo solicitado: {formatMinutes(salidaMinutes)}</Alert>

          {isPersonal && (
            <Box sx={{ ...sectionSx, borderColor: '#bfdbfe', bgcolor: '#f8fbff' }}>
              <SectionTitle title="Reposición de tiempo" subtitle="Obligatorio para diligencia personal." />
              <Grid container spacing={1.5}>
                <Grid item xs={12} md={4}><TextField sx={inputSx} fullWidth size="small" required type="date" label="Fecha reposición" InputLabelProps={{ shrink: true }} value={form.reposicion.fecha} onChange={(e) => update('reposicion', 'fecha', e.target.value)} /></Grid>
                <Grid item xs={6} md={4}><TextField sx={inputSx} fullWidth size="small" required type="time" label="Hora inicio" InputLabelProps={{ shrink: true }} value={form.reposicion.horaInicio} onChange={(e) => update('reposicion', 'horaInicio', e.target.value)} /></Grid>
                <Grid item xs={6} md={4}><TextField sx={inputSx} fullWidth size="small" required type="time" label="Hora fin" InputLabelProps={{ shrink: true }} value={form.reposicion.horaFin} onChange={(e) => update('reposicion', 'horaFin', e.target.value)} /></Grid>
                <Grid item xs={12}><TextField sx={inputSx} fullWidth size="small" label="Observación reposición" value={form.reposicion.observacion} onChange={(e) => update('reposicion', 'observacion', e.target.value)} /></Grid>
              </Grid>
              <Alert sx={{ mt: 1.4 }} severity={diff >= 0 ? 'success' : 'warning'}>
                Tiempo a reponer: {formatMinutes(reposicionMinutes)}. Diferencia: {diff >= 0 ? '+' : ''}{formatMinutes(Math.abs(diff))}.
              </Alert>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
        <Button onClick={onClose} disabled={submitting}>Cancelar</Button>
        <Button variant="contained" onClick={submit} disabled={disableSubmit}>
          {submitting ? 'Radicando...' : 'Registrar solicitud'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ReporteSalidaFormDialog;
