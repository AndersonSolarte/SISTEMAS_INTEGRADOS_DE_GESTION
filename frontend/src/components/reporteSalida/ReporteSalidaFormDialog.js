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
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import reporteSalidaService from '../../services/reporteSalidaService';

const INITIAL_FORM = {
  personal: { nombre: '', documento: '', correo: '' },
  laboral: { dependencia: '', cargo: '' },
  salida: { tipo: 'cita_eps', fecha: '', fechaRegreso: '', horaInicio: '', horaFin: '', motivo: '' },
  reposicion: { fecha: '', fechaFin: '', horaInicio: '', horaFin: '', observacion: '' }
};

const WORK_BLOCKS = [
  { start: '07:00', end: '12:00' },
  { start: '14:00', end: '18:00' }
];

const timeToMinutes = (time) => {
  const [hours, minutes] = String(time || '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const parseDateOnly = (date) => {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isBusinessDay = (date) => {
  const day = date.getDay();
  return day >= 1 && day <= 5 && !isColombiaHoliday(date);
};

const toIsoDate = (date) => date.toISOString().slice(0, 10);

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const nextMonday = (date) => {
  const next = new Date(date);
  const diff = (8 - next.getDay()) % 7;
  next.setDate(next.getDate() + diff);
  return next;
};

const getEasterDate = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
};

const getColombiaHolidaySet = (year) => {
  const dates = new Set();
  const addFixed = (month, day) => dates.add(toIsoDate(new Date(year, month - 1, day)));
  const addMoved = (month, day) => dates.add(toIsoDate(nextMonday(new Date(year, month - 1, day))));
  addFixed(1, 1);
  addFixed(5, 1);
  addFixed(7, 20);
  addFixed(8, 7);
  addFixed(12, 8);
  addFixed(12, 25);
  addMoved(1, 6);
  addMoved(3, 19);
  addMoved(6, 29);
  addMoved(8, 15);
  addMoved(10, 12);
  addMoved(11, 1);
  addMoved(11, 11);
  const easter = getEasterDate(year);
  [-3, -2, 43, 64, 71].forEach((offset) => dates.add(toIsoDate(addDays(easter, offset))));
  return dates;
};

const holidayCache = new Map();

const isColombiaHoliday = (date) => {
  const year = date.getFullYear();
  if (!holidayCache.has(year)) holidayCache.set(year, getColombiaHolidaySet(year));
  return holidayCache.get(year).has(toIsoDate(date));
};

const countBusinessMinutes = (startDate, endDate, startTime, endTime) => {
  const fromDate = parseDateOnly(startDate);
  const toDate = parseDateOnly(endDate || startDate);
  const fromMinutes = timeToMinutes(startTime);
  const toMinutesValue = timeToMinutes(endTime);
  if (!fromDate || !toDate || fromMinutes == null || toMinutesValue == null || toDate < fromDate) return null;

  const sameDay = toIsoDate(fromDate) === toIsoDate(toDate);
  if (sameDay && toMinutesValue <= fromMinutes) return null;

  let total = 0;
  const cursor = new Date(fromDate);
  while (cursor <= toDate) {
    if (isBusinessDay(cursor)) {
      const current = toIsoDate(cursor);
      const rangeStart = current === toIsoDate(fromDate) ? fromMinutes : 0;
      const rangeEnd = current === toIsoDate(toDate) ? toMinutesValue : 24 * 60;
      for (const block of WORK_BLOCKS) {
        const blockStart = timeToMinutes(block.start);
        const blockEnd = timeToMinutes(block.end);
        const overlap = Math.max(0, Math.min(rangeEnd, blockEnd) - Math.max(rangeStart, blockStart));
        total += overlap;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return total > 0 ? total : null;
};

const countElapsedMinutes = (startDate, endDate, startTime, endTime) => {
  const fromDate = parseDateOnly(startDate);
  const toDate = parseDateOnly(endDate || startDate);
  const fromMinutes = timeToMinutes(startTime);
  const toMinutesValue = timeToMinutes(endTime);
  if (!fromDate || !toDate || fromMinutes == null || toMinutesValue == null || toDate < fromDate) return null;
  const from = new Date(fromDate);
  from.setMinutes(fromMinutes);
  const to = new Date(toDate);
  to.setMinutes(toMinutesValue);
  if (to <= from) return null;
  return Math.round((to.getTime() - from.getTime()) / 60000);
};

const getBusinessDateIssue = (date, label) => {
  const parsed = parseDateOnly(date);
  if (!parsed) return '';
  const day = parsed.getDay();
  if (day === 0) return `${label} cae domingo y no cuenta como dia laboral.`;
  if (day === 6) return `${label} cae sabado y no cuenta como dia laboral.`;
  if (isColombiaHoliday(parsed)) return `${label} es festivo en Colombia y no cuenta como dia laboral.`;
  return '';
};

const getRangeIssue = ({ startDate, endDate, startTime, endTime, minutes, label }) => {
  const startIssue = getBusinessDateIssue(startDate, `La fecha inicial de ${label}`);
  if (startIssue) return startIssue;
  const endIssue = getBusinessDateIssue(endDate, `La fecha final de ${label}`);
  if (endIssue) return endIssue;
  if (startDate && endDate && startTime && endTime && !minutes) {
    return `El rango de ${label} no suma tiempo laboral. Revise fechas, horas y jornada institucional.`;
  }
  return '';
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
  const [qrOpen, setQrOpen] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);

  const directFormUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams({
      titulo: documento?.codigo || 'THM-DP-FR-002',
      abrir: 'reporte-salida'
    });
    return `${window.location.origin}/dashboard/buscar-documentos?${params.toString()}`;
  }, [documento?.codigo]);

  const qrImageUrl = useMemo(() => (
    directFormUrl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=14&data=${encodeURIComponent(directFormUrl)}`
      : ''
  ), [directFormUrl]);

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
        const nextJefes = data.jefes || [];
        setJefes(nextJefes);
        if (data.currentEmployee) {
          const currentBoss = nextJefes.find((item) =>
            normalizeOption(item.jefe_inmediato || item.nombre) === normalizeOption(data.currentEmployee.jefe_inmediato)
          ) || null;
          setForm((prev) => ({
            ...prev,
            laboral: {
              dependencia: data.currentEmployee.dependencia || prev.laboral.dependencia,
              cargo: data.currentEmployee.cargo || prev.laboral.cargo
            }
          }));
          if (currentBoss) setJefe(currentBoss);
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
    () => countBusinessMinutes(form.salida.fecha, form.salida.fechaRegreso, form.salida.horaInicio, form.salida.horaFin),
    [form.salida.fecha, form.salida.fechaRegreso, form.salida.horaInicio, form.salida.horaFin]
  );

  const reposicionMinutes = useMemo(
    () => countElapsedMinutes(form.reposicion.fecha, form.reposicion.fechaFin, form.reposicion.horaInicio, form.reposicion.horaFin),
    [form.reposicion.fecha, form.reposicion.fechaFin, form.reposicion.horaInicio, form.reposicion.horaFin]
  );
  const salidaRangeIssue = useMemo(
    () => getRangeIssue({
      startDate: form.salida.fecha,
      endDate: form.salida.fechaRegreso,
      startTime: form.salida.horaInicio,
      endTime: form.salida.horaFin,
      minutes: salidaMinutes,
      label: 'salida'
    }),
    [form.salida.fecha, form.salida.fechaRegreso, form.salida.horaFin, form.salida.horaInicio, salidaMinutes]
  );
  const reposicionHasAnyValue = Boolean(form.reposicion.fecha || form.reposicion.fechaFin || form.reposicion.horaInicio || form.reposicion.horaFin);
  const reposicionPlanComplete = Boolean(form.reposicion.fecha && form.reposicion.fechaFin && form.reposicion.horaInicio && form.reposicion.horaFin);
  const reposicionRangeIssue = useMemo(() => {
    if (!reposicionHasAnyValue) return '';
    if (!reposicionPlanComplete) {
      return 'Complete todos los campos del plan inicial de reposicion o dejelos vacios para gestionarlo luego en seguimiento.';
    }
    if (!reposicionMinutes) return 'El rango del plan inicial de reposicion no es valido. Revise fecha y hora de inicio y fin.';
    return '';
  }, [reposicionHasAnyValue, reposicionMinutes, reposicionPlanComplete]);

  const isPersonal = form.salida.tipo === 'diligencia_personal';
  const validationIssues = useMemo(() => {
    const issues = [];
    if (!form.laboral.dependencia) issues.push('Seleccione la dependencia del colaborador.');
    if (!form.laboral.cargo) issues.push('Seleccione el cargo del colaborador.');
    if (!jefe) issues.push('Seleccione el jefe inmediato que aprobara la solicitud.');
    else if (!jefe.email) issues.push('El jefe inmediato seleccionado no tiene correo registrado.');
    if (!form.salida.fecha || !form.salida.horaInicio || !form.salida.fechaRegreso || !form.salida.horaFin) {
      issues.push('Complete fecha de salida, hora de salida, fecha de regreso y hora de regreso.');
    } else if (salidaRangeIssue) {
      issues.push(salidaRangeIssue);
    } else if (!salidaMinutes) {
      issues.push('El tiempo solicitado debe sumar al menos un periodo dentro de la jornada laboral.');
    }
    if (isPersonal && reposicionHasAnyValue) {
      if (reposicionRangeIssue) {
        issues.push(reposicionRangeIssue);
      } else if (!reposicionMinutes) {
        issues.push('El plan inicial de reposicion debe sumar tiempo valido.');
      }
    }
    return issues;
  }, [
    form.laboral.cargo,
    form.laboral.dependencia,
    form.salida.fecha,
    form.salida.fechaRegreso,
    form.salida.horaFin,
    form.salida.horaInicio,
    isPersonal,
    jefe,
    reposicionMinutes,
    reposicionRangeIssue,
    reposicionHasAnyValue,
    salidaMinutes,
    salidaRangeIssue
  ]);

  const selectedDependenciaIsCatalog = hasExactOption(form.laboral.dependencia, dependencias);
  const selectedCargoIsCatalog = hasExactOption(form.laboral.cargo, cargos);
  const selectedJefeName = jefe?.jefe_inmediato || jefe?.nombre || '';
  const selectedJefeIsCatalog = Boolean(normalizeOption(selectedJefeName));

  const filteredLaboralRows = useMemo(() => {
    return laboralRows.filter((row) => {
      const rowDep = normalizeOption(row.dependencia);
      const rowCargo = normalizeOption(row.cargo);
      const rowJefe = normalizeOption(row.jefe_inmediato);
      if (selectedDependenciaIsCatalog && rowDep !== normalizeOption(form.laboral.dependencia)) return false;
      if (selectedCargoIsCatalog && rowCargo !== normalizeOption(form.laboral.cargo)) return false;
      if (selectedJefeIsCatalog && rowJefe !== normalizeOption(selectedJefeName)) return false;
      return true;
    });
  }, [form.laboral.cargo, form.laboral.dependencia, laboralRows, selectedCargoIsCatalog, selectedDependenciaIsCatalog, selectedJefeIsCatalog, selectedJefeName]);

  const dependenciaOptions = useMemo(() => {
    if (!laboralRows.length) return dependencias;
    if (selectedCargoIsCatalog || selectedJefeIsCatalog) {
      return uniqueSorted(filteredLaboralRows.map((row) => row.dependencia));
    }
    return uniqueSorted(laboralRows.map((row) => row.dependencia));
  }, [dependencias, filteredLaboralRows, laboralRows, selectedCargoIsCatalog, selectedJefeIsCatalog]);

  const cargoOptions = useMemo(() => {
    if (!laboralRows.length) return cargos;
    if (selectedDependenciaIsCatalog || selectedJefeIsCatalog) {
      return uniqueSorted(filteredLaboralRows.map((row) => row.cargo));
    }
    return uniqueSorted(laboralRows.map((row) => row.cargo));
  }, [cargos, filteredLaboralRows, laboralRows, selectedDependenciaIsCatalog, selectedJefeIsCatalog]);

  const jefeOptions = useMemo(() => {
    const term = normalizeOption(jefeSearch);
    const hasRelationFilter = selectedDependenciaIsCatalog || selectedCargoIsCatalog;
    const relatedRows = hasRelationFilter
      ? filteredLaboralRows
      : laboralRows;
    const allowedBosses = new Set(
      relatedRows
        .map((row) => normalizeOption(row.jefe_inmediato))
        .filter(Boolean)
    );
    const matchesSearch = (item) => {
      if (!term) return true;
      return [item.nombre, item.jefe_inmediato, item.email, item.username, item.cargo, item.dependencia]
        .some((value) => normalizeOption(value).includes(term));
    };

    return jefes
      .filter((item) => {
        if (!hasRelationFilter) return true;
        if (!allowedBosses.size) return false;
        return allowedBosses.has(normalizeOption(item.jefe_inmediato || item.nombre));
      })
      .filter(matchesSearch)
      .map((item) => ({
        ...item,
        matchGroup: hasRelationFilter ? 'Jefes relacionados' : 'Jefes disponibles'
      }));
  }, [filteredLaboralRows, jefeSearch, jefes, laboralRows, selectedCargoIsCatalog, selectedDependenciaIsCatalog]);

  useEffect(() => {
    if (!jefe || (!selectedDependenciaIsCatalog && !selectedCargoIsCatalog)) return;
    const validBosses = new Set(filteredLaboralRows.map((row) => normalizeOption(row.jefe_inmediato)).filter(Boolean));
    if (!validBosses.size || !validBosses.has(normalizeOption(jefe.jefe_inmediato || jefe.nombre))) {
      setJefe(null);
    }
  }, [filteredLaboralRows, jefe, selectedCargoIsCatalog, selectedDependenciaIsCatalog]);

  const jefeHasDirectDependencyMatch = useMemo(() => {
    if (!selectedDependenciaIsCatalog && !selectedCargoIsCatalog) return true;
    return jefeOptions.length > 0;
  }, [jefeOptions.length, selectedCargoIsCatalog, selectedDependenciaIsCatalog]);

  const jefeHelperText = (selectedDependenciaIsCatalog || selectedCargoIsCatalog) && !jefeHasDirectDependencyMatch
    ? 'No hay jefe inmediato relacionado con los filtros seleccionados.'
    : '';

  const update = (section, key, value) => {
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
        ...(section === 'salida' && key === 'fecha' && !prev.salida.fechaRegreso ? { fechaRegreso: value } : {}),
        ...(section === 'reposicion' && key === 'fecha' && !prev.reposicion.fechaFin ? { fechaFin: value } : {})
      }
    }));
  };

  const copyDirectFormUrl = async () => {
    if (!directFormUrl) return;
    try {
      await navigator.clipboard.writeText(directFormUrl);
      setQrCopied(true);
      setTimeout(() => setQrCopied(false), 1800);
    } catch (_) {
      setQrCopied(false);
    }
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
          jefe_inmediato: jefe.jefe_inmediato || jefe.nombre || '',
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

  const disableSubmit = submitting || validationIssues.length > 0;

  return (
    <>
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
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between">
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: '#2563eb', display: 'grid', placeItems: 'center' }}>
              <AssignmentTurnedInIcon sx={{ color: '#fff', fontSize: 22 }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Diligenciar reporte de salida</Typography>
              <Typography sx={{ color: '#64748b', fontSize: 12 }}>{documento?.codigo} - {documento?.titulo}</Typography>
            </Box>
          </Stack>
          <Button
            variant="outlined"
            size="small"
            startIcon={<QrCode2Icon />}
            onClick={() => setQrOpen(true)}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 900, alignSelf: { xs: 'flex-start', sm: 'center' } }}
          >
            Generar QR
          </Button>
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
                onChange={(_, value) => setJefe(value)}
                getOptionLabel={(option) => {
                  if (!option) return '';
                  const main = [option.cargo, option.nombre].filter(Boolean).join(' - ');
                  const label = main || option.jefe_inmediato || '';
                  return option.email ? `${label} (${option.email})` : label;
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
            <Alert severity="info" sx={{ mb: 1.4 }}>
              El sistema calcula cuantas horas queda debiendo el colaborador segun la jornada laboral vigente: lunes a viernes, excluyendo festivos de Colombia, 7:00 a.m. a 12:00 m. y 2:00 p.m. a 6:00 p.m.
            </Alert>
            <Box sx={responsiveFieldGrid('minmax(220px, 1.15fr) minmax(160px, 0.8fr) minmax(140px, 0.7fr) minmax(160px, 0.8fr) minmax(140px, 0.7fr) minmax(135px, 0.6fr)')}>
              <TextField sx={inputSx} select fullWidth size="small" label="Tipo de salida" value={form.salida.tipo} onChange={(e) => update('salida', 'tipo', e.target.value)}>
                <MenuItem value="cita_eps">Cita médica por EPS</MenuItem>
                <MenuItem value="cita_particular">Cita médica particular</MenuItem>
                <MenuItem value="diligencia_personal">Diligencia personal</MenuItem>
              </TextField>
              <TextField sx={inputSx} fullWidth size="small" required type="date" label="Fecha salida" InputLabelProps={{ shrink: true }} value={form.salida.fecha} onChange={(e) => update('salida', 'fecha', e.target.value)} />
              <TextField sx={inputSx} fullWidth size="small" required type="time" label="Hora salida" InputLabelProps={{ shrink: true }} value={form.salida.horaInicio} onChange={(e) => update('salida', 'horaInicio', e.target.value)} />
              <TextField sx={inputSx} fullWidth size="small" required type="date" label="Fecha regreso" InputLabelProps={{ shrink: true }} value={form.salida.fechaRegreso} onChange={(e) => update('salida', 'fechaRegreso', e.target.value)} />
              <TextField sx={inputSx} fullWidth size="small" required type="time" label="Hora regreso" InputLabelProps={{ shrink: true }} value={form.salida.horaFin} onChange={(e) => update('salida', 'horaFin', e.target.value)} />
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
          {salidaRangeIssue && <Alert severity="warning">{salidaRangeIssue}</Alert>}

          {isPersonal && (
            <Box sx={{ ...sectionSx, borderColor: '#bfdbfe', bgcolor: '#f8fbff' }}>
              <SectionTitle title="Plan inicial de reposición" subtitle="Opcional. La recuperacion real de horas se gestionara luego por seguimiento y validacion de Talento Humano." />
              <Grid container spacing={1.5}>
                <Grid item xs={12} md={3}><TextField sx={inputSx} fullWidth size="small" required type="date" label="Fecha reposicion" InputLabelProps={{ shrink: true }} value={form.reposicion.fecha} onChange={(e) => update('reposicion', 'fecha', e.target.value)} /></Grid>
                <Grid item xs={6} md={3}><TextField sx={inputSx} fullWidth size="small" required type="time" label="Hora reposicion" InputLabelProps={{ shrink: true }} value={form.reposicion.horaInicio} onChange={(e) => update('reposicion', 'horaInicio', e.target.value)} /></Grid>
                <Grid item xs={12} md={3}><TextField sx={inputSx} fullWidth size="small" required type="date" label="Fecha fin reposicion" InputLabelProps={{ shrink: true }} value={form.reposicion.fechaFin} onChange={(e) => update('reposicion', 'fechaFin', e.target.value)} /></Grid>
                <Grid item xs={6} md={3}><TextField sx={inputSx} fullWidth size="small" required type="time" label="Hora fin reposicion" InputLabelProps={{ shrink: true }} value={form.reposicion.horaFin} onChange={(e) => update('reposicion', 'horaFin', e.target.value)} /></Grid>
                <Grid item xs={12}><TextField sx={inputSx} fullWidth size="small" label="Observación reposición" value={form.reposicion.observacion} onChange={(e) => update('reposicion', 'observacion', e.target.value)} /></Grid>
              </Grid>
              {reposicionRangeIssue && <Alert sx={{ mt: 1.4 }} severity="warning">{reposicionRangeIssue}</Alert>}
              <Alert sx={{ mt: 1.4 }} severity={reposicionMinutes ? 'info' : 'warning'}>
                Horas propuestas en este plan inicial: {formatMinutes(reposicionMinutes)}. Horas pendientes de la solicitud: {formatMinutes(salidaMinutes)}.
              </Alert>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0', gap: 1, flexWrap: 'wrap' }}>
        {validationIssues.length > 0 && (
          <Alert severity="warning" sx={{ mr: 'auto', textAlign: 'left', alignItems: 'flex-start', maxWidth: { xs: '100%', md: 620 } }}>
            <Typography sx={{ fontWeight: 900, fontSize: 13, mb: 0.4 }}>No se puede registrar todavía</Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {validationIssues.slice(0, 3).map((issue) => (
                <Box component="li" key={issue} sx={{ fontSize: 12.5 }}>{issue}</Box>
              ))}
            </Box>
          </Alert>
        )}
        <Button onClick={onClose} disabled={submitting}>Cancelar</Button>
        <Button variant="contained" onClick={submit} disabled={disableSubmit}>
          {submitting ? 'Radicando...' : 'Registrar solicitud'}
        </Button>
      </DialogActions>
    </Dialog>
    <Dialog open={qrOpen} onClose={() => setQrOpen(false)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 950, pb: 1 }}>Codigo QR del reporte de salida</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          El QR abre directamente este formato. Si la persona no ha iniciado sesion, primero ingresara con Google institucional y luego volvera al formulario.
        </Alert>
        <Box sx={{ display: 'grid', placeItems: 'center', p: 2, border: '1px solid #dbe6f5', borderRadius: 2.5, bgcolor: '#f8fbff' }}>
          {qrImageUrl && (
            <Box
              component="img"
              src={qrImageUrl}
              alt="Codigo QR para reporte de salida"
              sx={{ width: 260, height: 260, bgcolor: '#fff', borderRadius: 1.5 }}
            />
          )}
        </Box>
        <TextField
          fullWidth
          size="small"
          label="Enlace directo"
          value={directFormUrl}
          InputProps={{ readOnly: true }}
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button startIcon={<ContentCopyIcon />} onClick={copyDirectFormUrl}>
          {qrCopied ? 'Copiado' : 'Copiar enlace'}
        </Button>
        <Button
          component="a"
          href={qrImageUrl}
          target="_blank"
          rel="noreferrer"
          startIcon={<DownloadIcon />}
          variant="contained"
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 900 }}
        >
          Exportar QR
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}

export default ReporteSalidaFormDialog;
