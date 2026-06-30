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
  Typography,
  Tooltip,
  useMediaQuery,
  useTheme
} from '@mui/material';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PeopleIcon from '@mui/icons-material/People';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import PersonIcon from '@mui/icons-material/Person';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import reporteSalidaService from '../../services/reporteSalidaService';

const INITIAL_FORM = {
  personal: { nombre: '', documento: '', correo: '' },
  laboral: { dependencia: '', cargo: '' },
  salida: { tipo: 'cita_eps', alcance: '', especialidadMedica: '', terapiasList: [], fecha: '', fechaRegreso: '', horaInicio: '', horaFin: '', motivo: '', campusSalida: '', campusDestino: '' },
  reposicion: { fecha: '', fechaFin: '', horaInicio: '', horaFin: '', observacion: '' }
};

const CARGO_SUBTYPES = [
  { value: 'ponencia', label: 'Ponencia' },
  { value: 'visita_ies', label: 'Visita a otras IES' },
  { value: 'capacitacion', label: 'Capacitación' },
  { value: 'proyecto_investigacion', label: 'Proyecto de investigación' },
  { value: 'asistente_congreso', label: 'Asistente a congreso' },
  { value: 'practica_academica', label: 'Práctica académica' },
  { value: 'torneo_deportivo', label: 'Participante en torneo deportivo' },
  { value: 'salida_campus', label: 'Salida entre campus' },
  { value: 'otra', label: 'Otra, ¿Cuál?:' }
];

const SALUD_SUBTYPES = [
  { value: 'cita_eps', label: 'Cita médica por EPS' },
  { value: 'cita_particular', label: 'Cita médica particular' },
  { value: 'cita_medica_laboral', label: 'Cita médica laboral' },
  { value: 'urgencia_medica', label: 'Urgencias' },
  { value: 'terapias', label: 'Terapias' }
];

const PERSONALES_SUBTYPES = [
  { value: 'diligencia_personal', label: 'Diligencia personal' }
];

const ESPECIALIDADES_MEDICAS = [
  'Medicina general',
  'Medicina especializada',
  'Odontológica',
  'Optometría',
  'Laboratorios'
];

const ALCANCE_OPTIONS = [
  'Institucional',
  'Regional',
  'Nacional',
  'Internacional'
];

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
  
  if (startDate && startTime) {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (startDate === todayStr) {
      const currentMinutes = today.getHours() * 60 + today.getMinutes();
      const [h, m] = String(startTime || '').split(':').map(Number);
      if (Number.isFinite(h) && Number.isFinite(m)) {
        const startMins = h * 60 + m;
        if (startMins < currentMinutes) {
          return `La hora de inicio de ${label} no puede ser anterior a la hora actual.`;
        }
      }
    }
  }

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

const isPastTimeError = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return false;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (dateStr === todayStr) {
    const currentMinutes = today.getHours() * 60 + today.getMinutes();
    const [h, m] = String(timeStr).split(':').map(Number);
    if (Number.isFinite(h) && Number.isFinite(m)) {
      return (h * 60 + m) < currentMinutes;
    }
  }
  return false;
};

function ReporteSalidaFormDialog({ open, documento, user, onClose, onSubmitted }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const todayDate = new Date();
  const todayString = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
  const [showSaludWarning, setShowSaludWarning] = useState(false);
  const [showPersonalesWarning, setShowPersonalesWarning] = useState(false);
  const [showPropiasCargoWarning, setShowPropiasCargoWarning] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [isSalidaMultiple, setIsSalidaMultiple] = useState(false);
  const [participantes, setParticipantes] = useState([]);
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
  const [adjuntoFile, setAdjuntoFile] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successResponse, setSuccessResponse] = useState(null);

  const handleAddParticipant = (colaborador) => {
    if (!colaborador) return;
    if (participantes.some((p) => String(p.documento).trim() === String(colaborador.documento).trim())) {
      return;
    }
    setParticipantes((prev) => [
      ...prev,
      {
        nombre: colaborador.nombre,
        documento: colaborador.documento,
        correo: colaborador.email || '',
        dependencia: colaborador.dependencia,
        cargo: colaborador.cargo
      }
    ]);
  };

  const handleUpdateParticipantEmail = (index, value) => {
    setParticipantes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], correo: value };
      return next;
    });
  };

  const handleRemoveParticipant = (index) => {
    setParticipantes((prev) => prev.filter((_, i) => i !== index));
  };

  const { category, subtype, otraDescripcion } = useMemo(() => {
    const tipo = form.salida.tipo || '';
    if (SALUD_SUBTYPES.some((s) => s.value === tipo)) {
      return { category: 'salud', subtype: tipo, otraDescripcion: '' };
    }
    if (PERSONALES_SUBTYPES.some((s) => s.value === tipo)) {
      return { category: 'personales', subtype: tipo, otraDescripcion: '' };
    }
    if (CARGO_SUBTYPES.some((s) => s.value === tipo)) {
      return { category: 'propias_cargo', subtype: tipo, otraDescripcion: '' };
    }
    if (tipo.startsWith('otra:')) {
      return { category: 'propias_cargo', subtype: 'otra', otraDescripcion: tipo.substring(5) };
    }
    return { category: 'salud', subtype: 'cita_eps', otraDescripcion: '' };
  }, [form.salida.tipo]);

  const handleCategoryChange = (newCategory) => {
    if (newCategory === 'propias_cargo') {
      update('salida', 'tipo', 'ponencia');
      setShowPropiasCargoWarning(true);
    } else if (newCategory === 'salud') {
      update('salida', 'tipo', 'cita_eps');
      setShowSaludWarning(true);
    } else if (newCategory === 'personales') {
      update('salida', 'tipo', 'diligencia_personal');
      setShowPersonalesWarning(true);
    }
  };

  const handleSubtypeChange = (newSubtype) => {
    if (newSubtype === 'otra') {
      update('salida', 'tipo', 'otra:');
    } else {
      update('salida', 'tipo', newSubtype);
    }
  };

  const handleOtraDescripcionChange = (newDesc) => {
    update('salida', 'tipo', `otra:${newDesc}`);
  };

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
      },
      laboral: {
        dependencia: user?.dependencia || '',
        cargo: user?.cargo || ''
      }
    });

    if (user?.jefe_inmediato) {
      setJefe({
        id: `profile-jefe:${normalizeOption(user.jefe_inmediato)}`,
        userId: null,
        nombre: user.jefe_inmediato,
        email: '',
        username: '',
        cargo: '',
        dependencia: '',
        jefe_inmediato: user.jefe_inmediato,
        source: 'users'
      });
    } else {
      setJefe(null);
    }
    
    setJefeSearch('');
    setErrorMessage('');
    setIsSalidaMultiple(false);
    setParticipantes([]);
    setAdjuntoFile(null);
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    if (isSalidaMultiple) {
      setParticipantes([
        {
          nombre: user?.nombre || '',
          documento: user?.username || '',
          correo: user?.email || '',
          dependencia: form.laboral.dependencia || '',
          cargo: form.laboral.cargo || ''
        }
      ]);
      if (PERSONALES_SUBTYPES.some(s => s.value === form.salida.tipo)) {
        setForm(prev => ({
          ...prev,
          salida: {
            ...prev.salida,
            tipo: 'ponencia'
          }
        }));
      }
    } else {
      setParticipantes([]);
    }
  }, [isSalidaMultiple, open, user, form.laboral.dependencia, form.laboral.cargo, form.salida.tipo]);

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

  const salidaMinutes = useMemo(() => {
    if (subtype === 'terapias') {
      const list = form.salida.terapiasList || [];
      return list.reduce((total, t) => {
        const tMins = countBusinessMinutes(t.fecha, t.fecha, t.horaInicio, t.horaFin) || 0;
        return total + tMins;
      }, 0);
    }
    return countBusinessMinutes(form.salida.fecha, form.salida.fechaRegreso, form.salida.horaInicio, form.salida.horaFin);
  }, [form.salida.fecha, form.salida.fechaRegreso, form.salida.horaInicio, form.salida.horaFin, form.salida.terapiasList, subtype]);

  const reposicionMinutes = useMemo(
    () => countElapsedMinutes(form.reposicion.fecha, form.reposicion.fechaFin, form.reposicion.horaInicio, form.reposicion.horaFin),
    [form.reposicion.fecha, form.reposicion.fechaFin, form.reposicion.horaInicio, form.reposicion.horaFin]
  );

  const salidaRangeIssue = useMemo(() => {
    if (subtype === 'terapias') {
      const list = form.salida.terapiasList || [];
      for (let i = 0; i < list.length; i++) {
        const issue = getRangeIssue({
          startDate: list[i].fecha,
          endDate: list[i].fecha,
          startTime: list[i].horaInicio,
          endTime: list[i].horaFin,
          minutes: countBusinessMinutes(list[i].fecha, list[i].fecha, list[i].horaInicio, list[i].horaFin),
          label: `terapia #${i + 1}`
        });
        if (issue) return issue;
      }
      return '';
    }
    return getRangeIssue({
      startDate: form.salida.fecha,
      endDate: form.salida.fechaRegreso,
      startTime: form.salida.horaInicio,
      endTime: form.salida.horaFin,
      minutes: salidaMinutes,
      label: 'salida'
    });
  }, [form.salida.fecha, form.salida.fechaRegreso, form.salida.horaFin, form.salida.horaInicio, salidaMinutes, form.salida.terapiasList, subtype]);
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
    if (isSalidaMultiple) {
      if (participantes.length === 0) {
        issues.push('Debe agregar al menos un participante a la salida grupal.');
      }
      participantes.forEach((p, idx) => {
        if (!p.correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.correo)) {
          issues.push(`El participante #${idx + 1} (${p.nombre || 'Sin nombre'}) no tiene un correo electronico valido.`);
        }
      });
    } else {
      if (!form.laboral.dependencia) issues.push('Seleccione la dependencia del colaborador.');
      if (!form.laboral.cargo) issues.push('Seleccione el cargo del colaborador.');
      if (!jefe) issues.push('Seleccione el jefe inmediato que aprobara la solicitud.');
      else if (!jefe.email) issues.push('El jefe inmediato seleccionado no tiene correo registrado.');
    }

    if (!subtype) {
      issues.push('Seleccione el motivo de la salida.');
    } else if (subtype === 'otra' && !otraDescripcion.trim()) {
      issues.push('Especifique el motivo de la salida para la opcion "Otra, ¿Cual?".');
    } else if (subtype === 'salida_campus') {
      if (!form.salida.campusSalida || !form.salida.campusDestino) {
        issues.push('Debe seleccionar el campus de salida y el campus de destino.');
      } else if (form.salida.campusSalida === form.salida.campusDestino) {
        issues.push('El campus de salida y el campus de destino no pueden ser iguales.');
      }
    } else if (['cita_eps', 'cita_particular'].includes(subtype) && !form.salida.especialidadMedica) {
      issues.push('Seleccione la especialidad medica para la cita.');
    }

    if (subtype === 'terapias') {
      const list = form.salida.terapiasList || [];
      if (list.length === 0) {
        issues.push('Debe indicar la cantidad de terapias y completarlas.');
      } else {
        list.forEach((t, i) => {
          if (!t.fecha || !t.horaInicio || !t.horaFin) {
            issues.push(`Complete fecha, hora inicio y hora fin para la terapia #${i + 1}.`);
          }
        });
      }
      if (salidaRangeIssue) {
        issues.push(salidaRangeIssue);
      } else if (!salidaMinutes) {
        issues.push('El tiempo total de terapias debe ser mayor a cero.');
      }
    } else {
      if (!form.salida.fecha || !form.salida.horaInicio || !form.salida.fechaRegreso || !form.salida.horaFin) {
        issues.push('Complete fecha de salida, hora de salida, fecha de regreso y hora de regreso.');
      } else if (salidaRangeIssue) {
        issues.push(salidaRangeIssue);
      } else if (!salidaMinutes) {
        issues.push('El tiempo solicitado debe sumar al menos un periodo dentro de la jornada laboral.');
      }
    }
    
    if (['cita_eps', 'cita_particular', 'urgencia_medica', 'terapias'].includes(subtype) && !adjuntoFile) {
      issues.push('Debe adjuntar el soporte médico obligatorio en la sección de datos adicionales.');
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
    isSalidaMultiple,
    participantes,
    form.laboral.cargo,
    form.laboral.dependencia,
    form.salida.fecha,
    form.salida.fechaRegreso,
    form.salida.horaFin,
    form.salida.horaInicio,
    form.salida.campusSalida,
    form.salida.campusDestino,
    subtype,
    otraDescripcion,
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

  const dependenciaOptions = useMemo(() => {
    if (!laboralRows.length) return dependencias;
    if (selectedCargoIsCatalog) {
      const filteredRows = laboralRows.filter(
        (row) => normalizeOption(row.cargo) === normalizeOption(form.laboral.cargo)
      );
      return uniqueSorted(filteredRows.map((row) => row.dependencia));
    }
    return uniqueSorted(laboralRows.map((row) => row.dependencia));
  }, [dependencias, form.laboral.cargo, laboralRows, selectedCargoIsCatalog]);

  const cargoOptions = useMemo(() => {
    if (!laboralRows.length) return cargos;
    if (selectedDependenciaIsCatalog) {
      const filteredRows = laboralRows.filter(
        (row) => normalizeOption(row.dependencia) === normalizeOption(form.laboral.dependencia)
      );
      return uniqueSorted(filteredRows.map((row) => row.cargo));
    }
    return uniqueSorted(laboralRows.map((row) => row.cargo));
  }, [cargos, form.laboral.dependencia, laboralRows, selectedDependenciaIsCatalog]);

  useEffect(() => {
    if (!laboralRows.length) return;
    const depNormalized = normalizeOption(form.laboral.dependencia);
    const cargoNormalized = normalizeOption(form.laboral.cargo);

    const matchedRow = laboralRows.find(
      (row) => normalizeOption(row.dependencia) === depNormalized && normalizeOption(row.cargo) === cargoNormalized
    );

    if (matchedRow && matchedRow.jefe_inmediato) {
      const jefeName = matchedRow.jefe_inmediato;
      const matchedBoss = jefes.find(
        (item) => normalizeOption(item.jefe_inmediato || item.nombre) === normalizeOption(jefeName)
      );
      if (matchedBoss) {
        setJefe(matchedBoss);
      } else {
        setJefe({
          id: `profile-jefe:${normalizeOption(jefeName)}`,
          userId: null,
          nombre: jefeName,
          email: '',
          username: '',
          cargo: '',
          dependencia: '',
          jefe_inmediato: jefeName,
          source: 'users'
        });
      }
    }
  }, [form.laboral.dependencia, form.laboral.cargo, laboralRows, jefes]);

  useEffect(() => {
    if (jefe && !jefe.email && jefes.length > 0) {
      const matchedBoss = jefes.find(
        (item) => normalizeOption(item.jefe_inmediato || item.nombre) === normalizeOption(jefe.nombre)
      );
      if (matchedBoss) {
        setJefe(matchedBoss);
      }
    }
  }, [jefe, jefes]);

  const displayJefeValue = useMemo(() => {
    if (!jefe) return '';
    const main = [jefe.cargo, jefe.nombre].filter(Boolean).join(' - ');
    const label = main || jefe.jefe_inmediato || '';
    return jefe.email ? `${label} (${jefe.email})` : label;
  }, [jefe]);

  const jefeHelperText = !jefe && (form.laboral.dependencia || form.laboral.cargo)
    ? 'No hay jefe inmediato relacionado con la dependencia y cargo seleccionados.'
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
        isSalidaMultiple,
        participantes: isSalidaMultiple ? participantes : [],
        jefeInmediatoUserId: isSalidaMultiple ? null : (jefe?.userId || null),
        jefeInmediato: isSalidaMultiple ? null : (jefe ? {
          id: jefe.id,
          userId: jefe.userId || null,
          nombre: jefe.nombre || '',
          email: jefe.email || '',
          username: jefe.username || '',
          cargo: jefe.cargo || '',
          dependencia: jefe.dependencia || '',
          jefe_inmediato: jefe.jefe_inmediato || jefe.nombre || '',
          source: jefe.source || 'recurso_humano_administrativos'
        } : null),
        ...form
      };
      
      if (adjuntoFile) {
        const formData = new FormData();
        formData.append('adjunto', adjuntoFile);
        const uploadRes = await reporteSalidaService.uploadAdjunto(formData);
        if (uploadRes.success && uploadRes.filename) {
          payload.datos_formulario = payload.datos_formulario || {};
          payload.datos_formulario.adjunto_path = uploadRes.filename;
        }
      }
      
      const response = await reporteSalidaService.radicarSolicitud(payload);
      setSuccessResponse(response);
      setShowSuccessModal(true);
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || error?.message || 'No se pudo radicar la solicitud.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    onSubmitted?.(successResponse);
    onClose?.();
  };

  const disableSubmit = submitting || validationIssues.length > 0;

  return (
    <>
      <Dialog
        open={open}
        onClose={submitting ? undefined : onClose}
        maxWidth="lg"
        fullWidth
        fullScreen={fullScreen}
        PaperProps={{
          sx: {
            borderRadius: fullScreen ? 0 : 3,
            overflow: 'hidden',
            width: fullScreen ? '100%' : 'min(1180px, calc(100vw - 32px))'
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
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ ml: { sm: 'auto' }, alignSelf: { xs: 'stretch', sm: 'center' } }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<QrCode2Icon />}
                onClick={() => setQrOpen(true)}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 900, height: 38, alignSelf: { xs: 'flex-start', sm: 'center' } }}
              >
                Generar QR
              </Button>
            </Stack>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: '#f6f8fb', p: { xs: 2, md: 3 } }}>
          <Stack spacing={2}>
            {/* New Toggle Group / Individual */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5, mb: 2 }}>
              <Box
                onClick={() => setIsSalidaMultiple(false)}
                sx={{
                  py: 0.8,
                  px: 3,
                  width: '100%',
                  borderRadius: 3,
                  border: '2px solid',
                  borderColor: !isSalidaMultiple ? '#2563eb' : '#e2e8f0',
                  bgcolor: !isSalidaMultiple ? '#eff6ff' : '#ffffff',
                  boxShadow: !isSalidaMultiple ? '0 8px 20px rgba(37, 99, 235, 0.15)' : '0 2px 5px rgba(0,0,0,0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 44,
                  gap: 1.5,
                  '&:hover': {
                    borderColor: '#2563eb',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 10px 25px rgba(37, 99, 235, 0.12)'
                  }
                }}
              >
                <PersonIcon sx={{ fontSize: 24, color: !isSalidaMultiple ? '#2563eb' : '#94a3b8', transition: 'color 0.2s' }} />
                <Typography sx={{ fontWeight: 800, fontSize: 13, color: !isSalidaMultiple ? '#1e3a8a' : '#475569', textAlign: 'center' }}>
                  Salida Individual
                </Typography>
              </Box>
              <Box
                onClick={() => setIsSalidaMultiple(true)}
                sx={{
                  py: 0.8,
                  px: 3,
                  width: '100%',
                  borderRadius: 3,
                  border: '2px solid',
                  borderColor: isSalidaMultiple ? '#2563eb' : '#e2e8f0',
                  bgcolor: isSalidaMultiple ? '#eff6ff' : '#ffffff',
                  boxShadow: isSalidaMultiple ? '0 8px 20px rgba(37, 99, 235, 0.15)' : '0 2px 5px rgba(0,0,0,0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 44,
                  gap: 1.5,
                  '&:hover': {
                    borderColor: '#2563eb',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 10px 25px rgba(37, 99, 235, 0.12)'
                  }
                }}
              >
                <PeopleIcon sx={{ fontSize: 24, color: isSalidaMultiple ? '#2563eb' : '#94a3b8', transition: 'color 0.2s' }} />
                <Typography sx={{ fontWeight: 800, fontSize: 13, color: isSalidaMultiple ? '#1e3a8a' : '#475569', textAlign: 'center' }}>
                  Salida Grupal
                </Typography>
              </Box>
            </Box>

            <Box sx={sectionSx}>
              <SectionTitle title={isSalidaMultiple ? "Datos del líder de la actividad" : "Datos del colaborador"} />
              <Box sx={responsiveFieldGrid('minmax(220px, 1fr) minmax(180px, 0.75fr) minmax(260px, 1.2fr)')}>
                <TextField sx={inputSx} fullWidth size="small" label="Nombre" value={form.personal.nombre} disabled />
                <TextField sx={inputSx} fullWidth size="small" label="Documento" value={form.personal.documento} disabled />
                <TextField sx={inputSx} fullWidth size="small" label="Correo" value={form.personal.correo} disabled />
              </Box>
            </Box>

            <Box sx={sectionSx}>
              <SectionTitle title={isSalidaMultiple ? "Información laboral del líder de la actividad" : "Información laboral"} />
              <Box sx={responsiveFieldGrid('minmax(360px, 1.45fr) minmax(240px, 0.9fr)')}>
                <Autocomplete
                  freeSolo
                  fullWidth
                  openOnFocus
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
                  openOnFocus
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
              {!isSalidaMultiple && (
                <Box sx={{ mt: 1.5 }}>
                  <TextField
                    sx={inputSx}
                    fullWidth
                    InputProps={{ readOnly: true }}
                    size="small"
                    label="Jefe inmediato"
                    value={displayJefeValue}
                    helperText={jefe && !jefe.email ? 'El jefe inmediato asignado no tiene correo registrado en el sistema. Solicite su registro a un administrador.' : jefeHelperText}
                    error={Boolean(jefe && !jefe.email) || Boolean(!jefe && (form.laboral.dependencia || form.laboral.cargo))}
                  />
                </Box>
              )}
            </Box>
            {isSalidaMultiple && (
              <Box sx={sectionSx}>
                <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1.5 }}>
                  <PeopleIcon sx={{ color: '#2563eb', fontSize: 24 }} />
                  <Typography sx={{ fontWeight: 950, color: '#0f172a', fontSize: 15.5 }}>
                    Participantes de la salida grupal
                  </Typography>
                </Stack>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Usted es el <strong>líder de la actividad</strong>. Agregue a los demás colaboradores que participarán con usted en la salida grupal. Se registrará la salida para todos y pasará directo a aprobación de Gestión Humana.
                </Alert>

                <Autocomplete
                  openOnFocus
                  options={laboralRows}
                  getOptionLabel={(option) => {
                    if (typeof option === 'string') return option;
                    return `${option.nombre} - ${option.cargo || ''}`;
                  }}
                  filterOptions={(options, state) => {
                    const query = normalizeOption(state.inputValue);
                    return options.filter(opt => {
                      const nameMatch = normalizeOption(opt.nombre).includes(query);
                      const docMatch = normalizeOption(opt.documento).includes(query);
                      const emailMatch = normalizeOption(opt.email).includes(query);
                      const cargoMatch = normalizeOption(opt.cargo).includes(query);
                      const depMatch = normalizeOption(opt.dependencia).includes(query);
                      return nameMatch || docMatch || emailMatch || cargoMatch || depMatch;
                    });
                  }}
                  onChange={(_, value) => {
                    if (value) {
                      handleAddParticipant(value);
                    }
                  }}
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
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      sx={{
                        ...inputSx,
                        '& .MuiOutlinedInput-root': {
                          bgcolor: '#eff6ff',
                          transition: 'all 0.2s',
                          animation: 'pulseGlow 2s infinite',
                          '@keyframes pulseGlow': {
                            '0%': { boxShadow: '0 0 0 0 rgba(59, 130, 246, 0.4)' },
                            '70%': { boxShadow: '0 0 0 10px rgba(59, 130, 246, 0)' },
                            '100%': { boxShadow: '0 0 0 0 rgba(59, 130, 246, 0)' }
                          },
                          '& fieldset': { border: '2px solid #3b82f6' },
                          '&:hover fieldset': { border: '2px solid #2563eb' },
                          '&.Mui-focused fieldset': { border: '2px solid #1d4ed8' },
                          '&:hover': { bgcolor: '#dbeafe' },
                          '&.Mui-focused': { bgcolor: '#fff', animation: 'none', boxShadow: '0 0 0 4px rgba(29, 78, 216, 0.2)' }
                        }
                      }}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <>
                            <SearchIcon sx={{ color: '#64748b', ml: 1, mr: -0.5 }} />
                            {params.InputProps.startAdornment}
                          </>
                        )
                      }}
                      fullWidth
                      size="medium"
                      label="Buscar colaborador para agregar..."
                      placeholder="Escriba nombre, cargo, dependencia, cedula o correo"
                    />
                  )}
                />

                {participantes.length > 0 ? (
                  <Box sx={{ mt: 2, border: '1px solid #e2e8f0', borderRadius: 2.5, overflow: 'hidden' }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '2.5fr 2.5fr 3fr 40px', bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', p: 1, fontWeight: 800, fontSize: 12.5, color: '#475569' }}>
                      <Box sx={{ pl: 1 }}>Colaborador</Box>
                      <Box>Cargo / Dependencia</Box>
                      <Box>Correo institucional (editable)</Box>
                      <Box></Box>
                    </Box>
                    <Stack divider={<Box sx={{ borderBottom: '1px solid #f1f5f9' }} />}>
                      {participantes.map((p, idx) => (
                        <Box key={p.documento} sx={{ display: 'grid', gridTemplateColumns: '2.5fr 2.5fr 3fr 40px', alignItems: 'center', p: 1, minHeight: 54 }}>
                          <Box sx={{ pl: 1 }}>
                            <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#1e293b' }}>
                              {p.nombre}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography sx={{ fontWeight: 600, fontSize: 12, color: '#334155' }}>
                              {p.cargo}
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: '#64748b' }}>
                              {p.dependencia}
                            </Typography>
                          </Box>
                          <Box sx={{ pr: 1 }}>
                            <TextField
                              size="small"
                              fullWidth
                              value={p.correo}
                              placeholder="Ingrese correo institucional"
                              onChange={(e) => handleUpdateParticipantEmail(idx, e.target.value)}
                              error={!p.correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.correo)}
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  borderRadius: 1.5,
                                  height: 36,
                                  fontSize: 12.5
                                }
                              }}
                            />
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                            <Button
                              onClick={() => handleRemoveParticipant(idx)}
                              sx={{ minWidth: 0, p: 0.5, color: '#ef4444', '&:hover': { bgcolor: '#fef2f2' } }}
                            >
                              <DeleteIcon sx={{ fontSize: 18 }} />
                            </Button>
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                ) : (
                  <Box sx={{ mt: 2, py: 4, border: '1px dashed #cbd5e1', borderRadius: 2.5, textAlign: 'center', bgcolor: '#f8fafc' }}>
                    <Typography sx={{ fontSize: 13.5, color: '#64748b', fontWeight: 600 }}>
                      No se han agregado participantes. Use el buscador superior para añadir colaboradores.
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            <Box sx={sectionSx}>
              <SectionTitle title="Datos de la salida" />

              {/* Category Selector Tabs */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: isSalidaMultiple ? '1fr 1fr' : '1fr 1fr 1fr' }, gap: 1.5, mb: 1.8 }}>
                <Box
                  onClick={() => handleCategoryChange('propias_cargo')}
                  sx={{
                    py: 0.5,
                    px: 1.5,
                    width: '100%',
                    borderRadius: 3,
                    border: '2px solid',
                    borderColor: category === 'propias_cargo' ? '#2563eb' : '#e2e8f0',
                    bgcolor: category === 'propias_cargo' ? '#eff6ff' : '#ffffff',
                    boxShadow: category === 'propias_cargo' ? '0 0 12px rgba(37, 99, 235, 0.5)' : '0 2px 5px rgba(0,0,0,0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 40,
                    gap: 1.5,
                    '&:hover': {
                      borderColor: '#2563eb',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 20px rgba(37, 99, 235, 0.3)'
                    }
                  }}
                >
                  <BusinessCenterIcon sx={{ fontSize: 24, color: category === 'propias_cargo' ? '#2563eb' : '#94a3b8', transition: 'color 0.2s' }} />
                  <Typography sx={{ fontWeight: 800, fontSize: 12.5, color: category === 'propias_cargo' ? '#1e3a8a' : '#475569', textAlign: 'left', lineHeight: 1.2 }}>
                    Actividades propias del cargo (Misionales)
                  </Typography>
                </Box>
                <Box
                  onClick={() => handleCategoryChange('salud')}
                  sx={{
                    py: 1,
                    px: 1.5,
                    width: '100%',
                    borderRadius: 3,
                    border: '2px solid',
                    borderColor: category === 'salud' ? '#2563eb' : '#e2e8f0',
                    bgcolor: category === 'salud' ? '#eff6ff' : '#ffffff',
                    boxShadow: category === 'salud' ? '0 0 12px rgba(37, 99, 235, 0.5)' : '0 2px 5px rgba(0,0,0,0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 40,
                    gap: 1.5,
                    '&:hover': {
                      borderColor: '#2563eb',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 20px rgba(37, 99, 235, 0.3)'
                    }
                  }}
                >
                  <LocalHospitalIcon sx={{ fontSize: 24, color: category === 'salud' ? '#2563eb' : '#94a3b8', transition: 'color 0.2s' }} />
                  <Typography sx={{ fontWeight: 800, fontSize: 12.5, color: category === 'salud' ? '#1e3a8a' : '#475569', textAlign: 'left', lineHeight: 1.2 }}>
                    Salud y Bienestar
                  </Typography>
                </Box>
                {!isSalidaMultiple && (
                  <Box
                    onClick={() => handleCategoryChange('personales')}
                    sx={{
                      py: 0.5,
                      px: 1.5,
                      width: '100%',
                      borderRadius: 3,
                      border: '2px solid',
                      borderColor: category === 'personales' ? '#2563eb' : '#e2e8f0',
                      bgcolor: category === 'personales' ? '#eff6ff' : '#ffffff',
                      boxShadow: category === 'personales' ? '0 0 12px rgba(37, 99, 235, 0.5)' : '0 2px 5px rgba(0,0,0,0.02)',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 40,
                      gap: 1.5,
                      '&:hover': {
                        borderColor: '#2563eb',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 20px rgba(37, 99, 235, 0.3)'
                      }
                    }}
                  >
                    <DirectionsWalkIcon sx={{ fontSize: 24, color: category === 'personales' ? '#2563eb' : '#94a3b8', transition: 'color 0.2s' }} />
                    <Typography sx={{ fontWeight: 800, fontSize: 12.5, color: category === 'personales' ? '#1e3a8a' : '#475569', textAlign: 'left', lineHeight: 1.2 }}>
                      Actividades personales
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Subtype Dropdown & Conditional Custom Description */}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: subtype === 'salida_campus' ? (category === 'propias_cargo' ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr') :
                    subtype === 'otra' ? (category === 'propias_cargo' ? '1fr 1fr 2fr' : '1fr 2fr') :
                      ['cita_eps', 'cita_particular'].includes(subtype) ? '1fr 1fr' :
                        category === 'propias_cargo' ? '1fr 1fr' : '1fr'
                },
                gap: 1.5,
                mb: 1.8
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    sx={{
                      ...inputSx,
                      '& .MuiSelect-select': { whiteSpace: 'normal !important' }
                    }}
                    select
                    fullWidth
                    size="medium"
                    label="Opción / Motivo de la salida"
                    value={subtype}
                    onChange={(e) => handleSubtypeChange(e.target.value)}
                  >
                    {(category === 'propias_cargo'
                      ? CARGO_SUBTYPES
                      : category === 'salud'
                        ? (isSalidaMultiple ? SALUD_SUBTYPES.filter(opt => opt.value === 'urgencia_medica') : SALUD_SUBTYPES)
                        : PERSONALES_SUBTYPES
                    ).map((opt) => (
                      <MenuItem key={opt.value} value={opt.value} sx={{ whiteSpace: 'normal' }}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  {category === 'salud' && (
                    <Tooltip
                      title="El permiso por motivo de salud se otorga exclusivamente para la atención médica del colaborador (consultas, procedimientos, terapias, exámenes). El acompañamiento a citas médicas de familiares (hijos, padres, cónyuge) debe registrarse en la categoría de 'Actividades personales'"
                      arrow
                      placement="top"
                    >
                      <InfoIcon sx={{ color: '#0284c7', cursor: 'help' }} />
                    </Tooltip>
                  )}
                </Box>

                {category === 'propias_cargo' && subtype !== 'salida_campus' && (
                  <TextField
                    sx={inputSx}
                    select
                    fullWidth
                    required
                    size="medium"
                    label="Alcance de la actividad"
                    value={form.salida.alcance || ''}
                    onChange={(e) => update('salida', 'alcance', e.target.value)}
                  >
                    {ALCANCE_OPTIONS.map((opt) => (
                      <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                    ))}
                  </TextField>
                )}

                {['cita_eps', 'cita_particular'].includes(subtype) && (
                  <TextField
                    sx={inputSx}
                    select
                    fullWidth
                    required
                    size="medium"
                    label="Especialidad médica"
                    value={form.salida.especialidadMedica || ''}
                    onChange={(e) => update('salida', 'especialidadMedica', e.target.value)}
                  >
                    {ESPECIALIDADES_MEDICAS.map((opt) => (
                      <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                    ))}
                  </TextField>
                )}

                {subtype === 'otra' && (
                  <TextField
                    sx={inputSx}
                    fullWidth
                    required
                    size="medium"
                    label="Especifique el motivo (¿Cuál?)"
                    placeholder="Ej: Visita técnica a laboratorios"
                    value={otraDescripcion}
                    onChange={(e) => handleOtraDescripcionChange(e.target.value)}
                  />
                )}

                {subtype === 'salida_campus' && (() => {
                  const hasCampusError = form.salida.campusSalida && form.salida.campusDestino && form.salida.campusSalida === form.salida.campusDestino;
                  return (
                    <>
                      <TextField
                        sx={inputSx}
                        select
                        fullWidth
                        required
                        size="medium"
                        label="Campus salida"
                        error={hasCampusError}
                        value={form.salida.campusSalida || ''}
                        onChange={(e) => update('salida', 'campusSalida', e.target.value)}
                      >
                        {['Campus Centro', 'Campus Santiago', 'Campus San Damián'].map((opt) => (
                          <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        sx={inputSx}
                        select
                        fullWidth
                        required
                        size="medium"
                        label="Campus destino"
                        error={hasCampusError}
                        helperText={hasCampusError ? 'Los campus de salida y destino no pueden ser iguales' : ''}
                        value={form.salida.campusDestino || ''}
                        onChange={(e) => update('salida', 'campusDestino', e.target.value)}
                      >
                        {['Campus Centro', 'Campus Santiago', 'Campus San Damián'].map((opt) => (
                          <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                        ))}
                      </TextField>
                    </>
                  );
                })()}

                {subtype === 'terapias' && (
                  <TextField
                    sx={inputSx}
                    fullWidth
                    required
                    type="number"
                    size="medium"
                    label="¿Cuántas terapias le van a realizar?"
                    InputProps={{ inputProps: { min: 1, max: 20 } }}
                    onKeyDown={(e) => { if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault(); }}
                    value={form.salida.terapiasList?.length || ''}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 0;
                      if (count < 0 || count > 30) return;
                      const newList = [...(form.salida.terapiasList || [])];
                      if (count > newList.length) {
                        for (let i = newList.length; i < count; i++) {
                          newList.push({ fecha: '', horaInicio: '', horaFin: '' });
                        }
                      } else {
                        newList.splice(count);
                      }
                      update('salida', 'terapiasList', newList);
                    }}
                  />
                )}
              </Box>

              {subtype === 'terapias' && form.salida.terapiasList?.length > 0 && (
                <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {form.salida.terapiasList.map((terapia, idx) => {
                    const tMins = countBusinessMinutes(terapia.fecha, terapia.fecha, terapia.horaInicio, terapia.horaFin) || 0;
                    return (
                      <Box key={idx} sx={{ p: 1.5, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#334155', mb: 1 }}>
                          Terapia {idx + 1}
                        </Typography>
                        <Box sx={responsiveFieldGrid('minmax(160px, 1fr) minmax(140px, 1fr) minmax(140px, 1fr) minmax(100px, 0.5fr)')}>
                          <TextField sx={inputSx} fullWidth size="small" required type="date" label="Fecha" InputLabelProps={{ shrink: true }} inputProps={{ min: todayString }} value={terapia.fecha} onChange={(e) => { const n = [...form.salida.terapiasList]; n[idx].fecha = e.target.value; update('salida', 'terapiasList', n); }} />
                          <TextField sx={inputSx} fullWidth size="small" required type="time" label="Hora inicio" InputLabelProps={{ shrink: true }} error={isPastTimeError(terapia.fecha, terapia.horaInicio)} value={terapia.horaInicio} onChange={(e) => { const n = [...form.salida.terapiasList]; n[idx].horaInicio = e.target.value; update('salida', 'terapiasList', n); }} />
                          <TextField sx={inputSx} fullWidth size="small" required type="time" label="Hora fin" InputLabelProps={{ shrink: true }} error={isPastTimeError(terapia.fecha, terapia.horaFin)} value={terapia.horaFin} onChange={(e) => { const n = [...form.salida.terapiasList]; n[idx].horaFin = e.target.value; update('salida', 'terapiasList', n); }} />
                          <Box sx={{ minHeight: 40, px: 1.5, borderRadius: 1.5, bgcolor: tMins ? '#ecfdf5' : '#fff7ed', border: `1px solid ${tMins ? '#bbf7d0' : '#fed7aa'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography sx={{ color: tMins ? '#166534' : '#c2410c', fontSize: 12, fontWeight: 800 }}>
                              {formatMinutes(tMins)}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}

                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5, pr: 0.5 }}>
                    <Box sx={{ minHeight: 40, px: 2, borderRadius: 1.5, bgcolor: salidaMinutes ? '#ecfdf5' : '#fff7ed', border: `1px solid ${salidaMinutes ? '#bbf7d0' : '#fed7aa'}`, display: 'flex', alignItems: 'center', gap: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>
                        TOTAL GENERAL:
                      </Typography>
                      <Typography sx={{ color: salidaMinutes ? '#166534' : '#c2410c', fontSize: 14, fontWeight: 900 }}>
                        {formatMinutes(salidaMinutes)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}

              {subtype !== 'terapias' && (
                <Box sx={responsiveFieldGrid('minmax(160px, 1fr) minmax(140px, 0.8fr) minmax(160px, 1fr) minmax(140px, 0.8fr) minmax(135px, 0.7fr)')}>
                  <TextField sx={inputSx} fullWidth size="small" required type="date" label="Fecha salida" InputLabelProps={{ shrink: true }} inputProps={{ min: todayString }} value={form.salida.fecha} onChange={(e) => update('salida', 'fecha', e.target.value)} />
                  <TextField sx={inputSx} fullWidth size="small" required type="time" label="Hora salida" InputLabelProps={{ shrink: true }} error={isPastTimeError(form.salida.fecha, form.salida.horaInicio)} value={form.salida.horaInicio} onChange={(e) => update('salida', 'horaInicio', e.target.value)} />
                  <TextField sx={inputSx} fullWidth size="small" required type="date" label="Fecha regreso" InputLabelProps={{ shrink: true }} inputProps={{ min: todayString }} value={form.salida.fechaRegreso} onChange={(e) => update('salida', 'fechaRegreso', e.target.value)} />
                  <TextField sx={inputSx} fullWidth size="small" required type="time" label="Hora regreso" InputLabelProps={{ shrink: true }} error={isPastTimeError(form.salida.fechaRegreso, form.salida.horaFin)} value={form.salida.horaFin} onChange={(e) => update('salida', 'horaFin', e.target.value)} />
                  <Box sx={{ minHeight: 44, px: 1.5, borderRadius: 2, bgcolor: salidaMinutes ? '#ecfdf5' : '#fff7ed', border: `1px solid ${salidaMinutes ? '#bbf7d0' : '#fed7aa'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography sx={{ color: salidaMinutes ? '#166534' : '#c2410c', fontSize: 12, fontWeight: 900 }}>
                      {formatMinutes(salidaMinutes)}
                    </Typography>
                  </Box>
                </Box>
              )}

              {['cita_eps', 'cita_particular', 'urgencia_medica', 'terapias'].includes(subtype) && (
                <Box sx={{ mt: 1, p: 2, borderRadius: 2, border: '1px dashed #94a3b8', bgcolor: '#f8fafc' }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 13.5, color: '#0f172a', mb: 0.5 }}>
                    Soporte médico obligatorio
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#64748b', mb: 1.5 }}>
                    Adjunte la constancia, epicrisis, u orden médica correspondiente (PDF o Imagen).
                  </Typography>
                  <Button
                    variant="outlined"
                    component="label"
                    fullWidth
                    sx={{ textTransform: 'none', justifyContent: 'flex-start', color: '#334155', borderColor: '#cbd5e1' }}
                  >
                    {adjuntoFile ? adjuntoFile.name : 'Seleccionar archivo...'}
                    <input
                      type="file"
                      hidden
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => setAdjuntoFile(e.target.files?.[0] || null)}
                    />
                  </Button>
                </Box>
              )}

              <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                  sx={inputSx}
                  fullWidth
                  size="small"
                  multiline
                  minRows={2}
                  label={form.salida.tipo === 'terapias' ? 'Diagnóstico de las terapias' : 'Motivo / observación'}
                  value={form.salida.motivo}
                  onChange={(e) => update('salida', 'motivo', e.target.value)}
                />
                {form.salida.tipo === 'terapias' && (
                  <Tooltip
                    title="Registre el diagnóstico o condición de salud que origina el tratamiento terapéutico, de acuerdo con la información consignada por el profesional tratante o en la orden médica correspondiente."
                    arrow
                    placement="top"
                  >
                    <InfoIcon sx={{ color: '#0284c7', cursor: 'help' }} />
                  </Tooltip>
                )}
              </Box>
            </Box>

            <Alert severity={salidaMinutes ? 'success' : 'warning'}>Tiempo solicitado: {formatMinutes(salidaMinutes)}</Alert>
            {salidaRangeIssue && <Alert severity="warning">{salidaRangeIssue}</Alert>}

            {isPersonal && (
              <Box sx={{ ...sectionSx, borderColor: '#bfdbfe', bgcolor: '#f8fbff' }}>
                <SectionTitle title="Plan inicial de reposición" />
                <Grid container spacing={1.5}>
                  <Grid item xs={12} md={3}><TextField sx={inputSx} fullWidth size="small" required type="date" label="Fecha reposicion" InputLabelProps={{ shrink: true }} inputProps={{ min: todayString }} value={form.reposicion.fecha} onChange={(e) => update('reposicion', 'fecha', e.target.value)} /></Grid>
                  <Grid item xs={6} md={3}><TextField sx={inputSx} fullWidth size="small" required type="time" label="Hora reposicion" InputLabelProps={{ shrink: true }} error={isPastTimeError(form.reposicion.fecha, form.reposicion.horaInicio)} value={form.reposicion.horaInicio} onChange={(e) => update('reposicion', 'horaInicio', e.target.value)} /></Grid>
                  <Grid item xs={12} md={3}><TextField sx={inputSx} fullWidth size="small" required type="date" label="Fecha fin reposicion" InputLabelProps={{ shrink: true }} inputProps={{ min: todayString }} value={form.reposicion.fechaFin} onChange={(e) => update('reposicion', 'fechaFin', e.target.value)} /></Grid>
                  <Grid item xs={6} md={3}><TextField sx={inputSx} fullWidth size="small" required type="time" label="Hora fin reposicion" InputLabelProps={{ shrink: true }} error={isPastTimeError(form.reposicion.fechaFin, form.reposicion.horaFin)} value={form.reposicion.horaFin} onChange={(e) => update('reposicion', 'horaFin', e.target.value)} /></Grid>
                  <Grid item xs={12}><TextField sx={inputSx} fullWidth size="small" label="Observación reposición" value={form.reposicion.observacion} onChange={(e) => update('reposicion', 'observacion', e.target.value)} /></Grid>
                </Grid>
              <Grid item xs={12}>{reposicionRangeIssue && <Alert sx={{ mt: 1.4 }} severity="warning">{reposicionRangeIssue}</Alert>}
                <Box sx={{ mt: 1.4, p: 1, borderRadius: 1.5, border: '1px solid #cbd5e1', bgcolor: '#f8fafc', display: 'flex', justifyContent: 'center' }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#475569' }}>
                    Horas propuestas: {formatMinutes(reposicionMinutes)} | Horas pendientes: {formatMinutes(salidaMinutes)}
                  </Typography>
                </Box>
              </Grid>
              </Box>
            )}

            <Alert severity="info" icon={false} sx={{ mt: 1, '& .MuiAlert-message': { width: '100%' } }}>
              <Typography sx={{ fontSize: 13, color: '#0f172a', textAlign: 'center' }}>
                Al registrar esta solicitud, autoriza el tratamiento de sus datos de acuerdo a la <a href="https://www.unicesmag.edu.co/documentos/DATOS-UNICESMAG.pdf" target="_blank" rel="noopener noreferrer" style={{ color: '#0284c7', fontWeight: 600, textDecoration: 'none' }}>Política de Tratamiento de Datos de UNICESMAG</a>.
              </Typography>
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0', gap: 1, flexWrap: 'wrap' }}>
          {errorMessage && (
            <Alert severity="error" sx={{ width: '100%', mb: 1 }}>
              <Typography sx={{ fontWeight: 900, fontSize: 13.5 }}>Error interno</Typography>
              {errorMessage}
            </Alert>
          )}
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

      <Dialog open={showSaludWarning} onClose={() => setShowSaludWarning(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 900, color: '#1e3a8a', pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <LocalHospitalIcon sx={{ color: '#2563eb' }} />
          Importante: Condiciones de permisos por salud
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#334155', lineHeight: 1.6, fontSize: 14.5, mt: 1 }}>
            La información registrada en la categoría de <strong>Salud y Bienestar</strong> debe ser fidedigna.
            En cualquier momento, las áreas encargadas podrán realizar seguimiento y usted deberá aportar
            los documentos médicos que soporten esta solicitud.
            <br /><br />
            En caso de no poder verificar esta actuación, las áreas encargadas procederán de acuerdo a lo
            estipulado en el Reglamento Interno de Trabajo.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, justifyContent: 'center' }}>
          <Button onClick={() => setShowSaludWarning(false)} variant="contained" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, px: 4, py: 1 }}>
            Entendido, continuar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showPersonalesWarning} onClose={() => setShowPersonalesWarning(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 900, color: '#1e3a8a', pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <DirectionsWalkIcon sx={{ color: '#2563eb' }} />
          Importante: Reposición de tiempo
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#334155', lineHeight: 1.6, fontSize: 14.5, mt: 1 }}>
            Tenga en cuenta que los permisos otorgados bajo la categoría de <strong>Actividades personales</strong> requieren reposición de tiempo obligatorio.
            <br /><br />
            Usted deberá registrar un plan inicial de reposición en la parte inferior de este formulario, el cual será evaluado por su jefe inmediato para su respectiva aprobación y seguimiento.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, justifyContent: 'center' }}>
          <Button onClick={() => setShowPersonalesWarning(false)} variant="contained" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, px: 4, py: 1 }}>
            Entendido, continuar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showPropiasCargoWarning} onClose={() => setShowPropiasCargoWarning(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 900, color: '#1e3a8a', pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <BusinessCenterIcon sx={{ color: '#2563eb' }} />
          Importante: Actividades propias del cargo
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#334155', lineHeight: 1.6, fontSize: 14.5, mt: 1 }}>
            Tenga en cuenta que esta categoría es exclusivamente para salidas relacionadas con funciones 
            inherentes a su rol, así como para el cumplimiento de labores <strong>académico-administrativas</strong>.
            <br /><br />
            Esta solicitud debe contar con la validación y autorización previa de su jefe inmediato.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, justifyContent: 'center' }}>
          <Button onClick={() => setShowPropiasCargoWarning(false)} variant="contained" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, px: 4, py: 1 }}>
            Entendido, continuar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showSuccessModal} onClose={handleSuccessClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 3, textAlign: 'center' } }}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <CheckCircleOutlineIcon color="success" sx={{ fontSize: 100, mb: 2 }} />
          <Typography variant="h5" fontWeight="800" color="success.main" gutterBottom>
            ¡Solicitud Radicada con Éxito!
          </Typography>
          <Typography sx={{ color: '#475569', fontSize: 16, mb: 3 }}>
            El reporte ha sido guardado correctamente y se enviará una notificación a su jefe inmediato para aprobación.
          </Typography>
          <Button onClick={handleSuccessClose} variant="contained" color="success" fullWidth sx={{ borderRadius: 2, fontWeight: 700, py: 1.5, fontSize: 16 }}>
            Cerrar y continuar
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ReporteSalidaFormDialog;
