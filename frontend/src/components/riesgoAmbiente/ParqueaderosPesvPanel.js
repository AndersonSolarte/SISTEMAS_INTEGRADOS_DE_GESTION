import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  FormControl, IconButton, InputAdornment, InputLabel, MenuItem, Paper, Select, Stack, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TablePagination, TableRow, Tabs, TextField, Tooltip, Typography
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import FileUploadRoundedIcon from '@mui/icons-material/FileUploadRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import TableViewRoundedIcon from '@mui/icons-material/TableViewRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import ContactPageRoundedIcon from '@mui/icons-material/ContactPageRounded';
import { useSnackbar } from 'notistack';
import gestionInformacionService from '../../services/gestionInformacionService';

const EMPTY_FORM = {
  identificacion: '', nombres_apellidos: '', correo: '', vinculacion: '', dependencia_programa: '',
  campus: '', parqueadero_ingreso: '', tipo_vehiculo: '', placa: '',
  tiene_licencia: 'SI', licencia_categorias: '', licencia_expedicion: '', licencia_vencimiento: '',
  soat_vigencia: '', soat_vigencia_texto: '', tecnomecanica_vigencia: '',
  vehiculo_autorizado: '', vehiculo_es_propio: 'SI', propietario_identificacion: '',
  tecnomecanica_vigencia_texto: '', observaciones: '',
  vehiculo_fecha_matricula: '', vehiculo_clase: '', vehiculo_servicio: '', vehiculo_modelo: '',
  soat_fecha_expedicion: '', soat_fecha_inicio: '', soat_numero_poliza: '', soat_entidad: '',
  rtm_estado: '', rtm_fecha_expedicion: '', rtm_fecha_exigibilidad: '', rtm_numero_certificado: '', rtm_cda: ''
};
const FORM_DATE_FIELDS = new Set(['vehiculo_fecha_matricula', 'licencia_expedicion', 'licencia_vencimiento', 'soat_fecha_expedicion', 'soat_fecha_inicio', 'soat_vigencia', 'rtm_fecha_expedicion', 'tecnomecanica_vigencia', 'rtm_fecha_exigibilidad']);
const BICYCLE_DOCUMENT_FIELDS = new Set(['soat_fecha_expedicion', 'soat_fecha_inicio', 'soat_vigencia', 'soat_numero_poliza', 'soat_entidad', 'rtm_fecha_expedicion', 'tecnomecanica_vigencia', 'rtm_fecha_exigibilidad', 'rtm_numero_certificado', 'rtm_cda']);
const formatDateForInput = (val) => {
  if (!val) return '';
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const yyyymmdd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return str;
};
const checkLicenseVehicleCompatibility = (licenciaCategoriasRaw, tipoVehiculoRaw) => {
  if (!tipoVehiculoRaw || !licenciaCategoriasRaw) return { compatible: true };
  const normTipo = String(tipoVehiculoRaw).trim().toUpperCase();
  if (['BICICLETA', 'PATINETA', 'MONOPATIN'].some(b => normTipo.includes(b))) {
    return { compatible: true };
  }
  const matchedCategories = (String(licenciaCategoriasRaw || '').toUpperCase().match(/[A-C][1-3]/g) || []);
  if (!matchedCategories.length) return { compatible: true };

  const hasMotoCategory = matchedCategories.some(cat => ['A1', 'A2'].includes(cat));
  const hasCarCategory = matchedCategories.some(cat => ['B1', 'B2', 'B3', 'C1', 'C2', 'C3'].includes(cat));

  const isMotoVehicle = ['MOTO', 'MOTOCICLETA', 'MOTOCICLO', 'MOTOTRICICLO'].some(m => normTipo.includes(m));
  const isCarVehicle = ['AUTO', 'AUTOMOVIL', 'CAMIONETA', 'CAMPERO', 'MICROBUS', 'BUS', 'MOTOCARRO', 'CAMION'].some(c => normTipo.includes(c));

  if (isMotoVehicle && !hasMotoCategory) {
    return {
      compatible: false,
      reason: `La categoría de licencia (${matchedCategories.join(', ')}) solo autoriza vehículos/automóviles. NO autoriza conducir motocicletas (requiere categoría A1 o A2).`
    };
  }
  if (isCarVehicle && !hasCarCategory) {
    return {
      compatible: false,
      reason: `La categoría de licencia (${matchedCategories.join(', ')}) solo autoriza motocicletas. NO autoriza conducir automóviles o camionetas (requiere categoría B1, B2, B3, C1, C2 o C3).`
    };
  }
  return { compatible: true };
};
const EMPTY_RUNT_FORM = {
  soat_fecha_fin: '', soat_numero_poliza: '', soat_entidad: '',
  rtm_aplica: 'SI', rtm_fecha_vigencia: '', rtm_numero_certificado: '', rtm_cda: '',
  vehiculo_fecha_matricula: '', vehiculo_clase: '', vehiculo_servicio: '', vehiculo_modelo: '', rtm_fecha_exigibilidad: ''
};
const STATUS_STYLE = {
  vencido: { dotColor: '#ef4444', shadow: '0 0 8px rgba(239,68,68,0.7)', color: '#991b1b', bgcolor: '#fee2e2', border: '#fecaca' },
  proximo: { dotColor: '#f59e0b', shadow: '0 0 8px rgba(245,158,11,0.7)', color: '#92400e', bgcolor: '#fef3c7', border: '#fde68a' },
  vigente: { dotColor: '#22c55e', shadow: '0 0 8px rgba(34,197,94,0.7)', color: '#166534', bgcolor: '#dcfce7', border: '#bbf7d0' },
  no_exigible: { dotColor: '#0284c7', shadow: '0 0 8px rgba(2,132,199,0.7)', color: '#0369a1', bgcolor: '#e0f2fe', border: '#bae6fd' },
  sin_registro: { dotColor: '#ea580c', shadow: '0 0 8px rgba(234,88,12,0.7)', color: '#9a3412', bgcolor: '#ffedd5', border: '#fdba74' },
  no_aplica: { dotColor: '#0891b2', shadow: '0 0 8px rgba(8,145,178,0.7)', color: '#155e75', bgcolor: '#cffafe', border: '#67e8f9' },
  sin_fecha: { dotColor: '#64748b', shadow: '0 0 6px rgba(100,116,139,0.5)', color: '#475569', bgcolor: '#f1f5f9', border: '#e2e8f0' }
};
const RTM_RULES = Object.freeze({
  MOTO: { firstReviewYears: 2, renewalYears: 1, classes: ['MOTOCICLETA', 'MOTOCICLO', 'MOTOTRICICLO', 'CUATRIMOTO', 'CICLOMOTOR', 'TRICIMOTO'] },
  CARRO_PARTICULAR: { firstReviewYears: 5, renewalYears: 1 },
  VEHICULO_PUBLICO: { firstReviewYears: 2, renewalYears: 1 }
});
const RTM_TRANSITION_RULES = Object.freeze([{ type: 'CARRO_PARTICULAR', from: '2017-05-20', to: '2018-05-19', firstReviewYears: 6 }]);

const formatDate = (value) => value ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) : 'Sin fecha';
const formatDateTime = (value) => value ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(value)) : 'Sin consultas confirmadas';
const documentStatusLabel = (value) => ({
  VIGENTE: 'Vigente', VENCIDO: 'Vencido', NO_EXIGIBLE: 'RTM no exigible a la fecha',
  SIN_REGISTRO_RUNT: 'Sin RTM registrada en RUNT', NO_APLICA: 'Exento de RTM'
}[value] || value || 'Sin información');
const normalizeRuntLine = (value = '') => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
const isBicycleVehicle = (row = {}) => [row.tipo_vehiculo, row.vehiculo_clase].some((value) => /\b(BICI|BICICLETA|CICLA)\b/.test(normalizeRuntLine(value)));
const normalizePlateForRunt = (value = '') => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const getRuntDocument = (row = {}) => String((row.vehiculo_es_propio === false || row.vehiculo_es_propio === 'NO' ? row.propietario_identificacion : row.identificacion) || '').replace(/[^A-Za-z0-9]/g, '');
const runtDateToIso = (value = '') => {
  const match = String(value || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day)
    ? `${year}-${month}-${day}` : '';
};
const latestByDate = (rows, key) => [...rows].sort((a, b) => String(b[key] || '').localeCompare(String(a[key] || '')))[0] || null;
const addYearsToIsoDate = (isoDate, years) => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year + years, month, 0)).getUTCDate();
  const result = new Date(Date.UTC(year + years, month - 1, Math.min(day, lastDay)));
  return Number.isNaN(result.getTime()) ? '' : result.toISOString().slice(0, 10);
};
const parseRuntCopiedText = (text = '') => {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const normalized = lines.map(normalizeRuntLine);
  const plateLabel = normalized.findIndex((line) => line.includes('PLACA DEL VEHICULO'));
  const plate = plateLabel >= 0 ? String(lines[plateLabel + 1] || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase() : '';
  const valueAfter = (label) => {
    const index = normalized.findIndex((line) => line.startsWith(label));
    return index >= 0 ? lines[index + 1] || '' : '';
  };
  const vehicle = {
    servicio: valueAfter('TIPO DE SERVICIO'),
    clase: valueAfter('CLASE DE VEHICULO'),
    modelo: valueAfter('MODELO'),
    fecha_matricula: runtDateToIso(valueAfter('FECHA DE MATRICULA INICIAL'))
  };

  const soatStart = normalized.findIndex((line) => line === 'POLIZA SOAT');
  const soatEnd = normalized.findIndex((line, index) => index > soatStart && line.includes('POLIZAS DE RESPONSABILIDAD CIVIL'));
  const soatRows = [];
  if (soatStart >= 0) {
    const end = soatEnd > soatStart ? soatEnd : lines.length;
    for (let index = soatStart + 1; index < end; index += 1) {
      const estado = normalized[index];
      if (!['VIGENTE', 'NO VIGENTE'].includes(estado) || index < 6) continue;
      const fechaExpedicion = runtDateToIso(lines[index - 5]);
      const fechaInicio = runtDateToIso(lines[index - 4]);
      const fechaFin = runtDateToIso(lines[index - 3]);
      if (!fechaExpedicion || !fechaInicio || !fechaFin) continue;
      soatRows.push({ numero_poliza: lines[index - 6], fecha_expedicion: fechaExpedicion, fecha_inicio: fechaInicio, fecha_fin: fechaFin, entidad: lines[index - 2], codigo_tarifa: lines[index - 1], estado });
    }
  }
  const currentSoat = latestByDate(soatRows.filter((row) => row.estado === 'VIGENTE'), 'fecha_fin') || latestByDate(soatRows, 'fecha_fin');

  const rtmStart = normalized.findIndex((line) => line.includes('CERTIFICADO DE REVISION TECNICO MECANICA') && line.includes('RTM'));
  const rtmEnd = normalized.findIndex((line, index) => index > rtmStart && line.includes('CERTIFICADOS DE REVISION TECNICO AMBIENTAL'));
  const rtmRows = [];
  if (rtmStart >= 0) {
    const end = rtmEnd > rtmStart ? rtmEnd : lines.length;
    for (let index = rtmStart + 1; index < end - 5; index += 1) {
      if (!normalized[index].includes('REVISION TECNICO')) continue;
      const fechaExpedicion = runtDateToIso(lines[index + 1]);
      const fechaVigencia = runtDateToIso(lines[index + 2]);
      const vigente = normalized[index + 4];
      if (!fechaExpedicion || !fechaVigencia || !['SI', 'NO'].includes(vigente)) continue;
      rtmRows.push({ tipo_revision: lines[index], fecha_expedicion: fechaExpedicion, fecha_vigencia: fechaVigencia, cda: lines[index + 3], vigente, numero_certificado: lines[index + 5] });
    }
  }
  const currentRtm = latestByDate(rtmRows.filter((row) => row.vigente === 'SI'), 'fecha_vigencia') || latestByDate(rtmRows, 'fecha_vigencia');
  const rtmHasNoInformation = rtmStart >= 0 && normalized.slice(rtmStart + 1, rtmEnd > rtmStart ? rtmEnd : lines.length).some((line) => line.includes('NO SE ENCONTRO INFORMACION'));
  let rtmSituation = currentRtm ? 'SI' : '';
  let rtmDueDate = '';
  if (!currentRtm && rtmHasNoInformation) {
    const normalizedClass = normalizeRuntLine(vehicle.clase);
    const normalizedService = normalizeRuntLine(vehicle.servicio);
    const isMotorcycle = RTM_RULES.MOTO.classes.some((type) => normalizedClass.includes(type));
    const isPublic = normalizedService.includes('PUBLICO');
    const ruleKey = isMotorcycle ? 'MOTO' : isPublic ? 'VEHICULO_PUBLICO' : 'CARRO_PARTICULAR';
    const transition = RTM_TRANSITION_RULES.find((item) => item.type === ruleKey && vehicle.fecha_matricula >= item.from && vehicle.fecha_matricula <= item.to);
    const years = transition?.firstReviewYears ?? RTM_RULES[ruleKey].firstReviewYears;
    rtmDueDate = addYearsToIsoDate(vehicle.fecha_matricula, years);
    const today = new Date().toISOString().slice(0, 10);
    rtmSituation = rtmDueDate && today < rtmDueDate ? 'NO_EXIGIBLE' : 'SIN_REGISTRO_RUNT';
  }
  return { plate, soat: currentSoat, rtm: currentRtm, vehicle, rtmSituation, rtmDueDate };
};

const getPrimerApellido = (row) => {
  if (row?.primer_apellido) return String(row.primer_apellido).trim();
  const full = String(row?.nombres_apellidos || '').trim();
  if (!full) return '';
  const parts = full.split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts[0] : '';
};

const parseRuntDriverCopiedText = (text = '') => {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const normalized = lines.map(normalizeRuntLine);
  const categoryRegex = /\b(A1|A2|B1|B2|B3|C1|C2|C3)\b/gi;
  const categoriesFound = new Set();
  const datesFound = [];
  let estado = 'VIGENTE';

  lines.forEach((line, idx) => {
    const norm = normalized[idx];
    const catMatches = line.match(categoryRegex);
    if (catMatches) {
      catMatches.forEach((c) => categoriesFound.add(c.toUpperCase()));
    }
    const dateMatches = line.match(/\b(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})\b/g);
    if (dateMatches) {
      dateMatches.forEach((dStr) => {
        const iso = runtDateToIso(dStr);
        if (iso) datesFound.push(iso);
      });
    }
    if (norm.includes('INACTIVA') || norm.includes('SUSPENDIDA') || norm.includes('CANCELADA')) {
      estado = 'INACTIVA';
    }
  });

  datesFound.sort();
  const earliestExpedicion = datesFound.length > 0 ? datesFound[0] : '';
  const latestVencimiento = datesFound.length > 1 ? datesFound[datesFound.length - 1] : (datesFound[0] || '');
  const categoriesList = Array.from(categoriesFound).join(', ');
  const hasLicencia = categoriesFound.size > 0 || datesFound.length > 0;

  return {
    hasLicencia,
    categorias: categoriesList,
    expedicion: earliestExpedicion,
    vencimiento: latestVencimiento,
    estado
  };
};
const expiryLabel = (status) => status?.code === 'vencido'
  ? `${Math.abs(status.days)} días vencido`
  : status?.code === 'proximo' ? `${status.days} días restantes`
    : status?.code === 'vigente' && Number.isFinite(status.days) ? `Vigente · ${status.days} días` : status?.label || 'Sin fecha';

function ExpiryCell({ type, date, rawText, status, row, onNotify, notifying }) {
  const style = STATUS_STYLE[status?.code] || STATUS_STYLE.sin_fecha;
  const isLic = type === 'licencia';
  const isNoLic = isLic && row.tiene_licencia === false;
  const documentsDoNotApply = status?.code === 'no_aplica' && (isBicycleVehicle(row) || isNoLic);
  const lastNotification = row[isLic ? 'ultima_notificacion_licencia' : type === 'tecnomecanica' ? 'ultima_notificacion_tecnomecanica' : 'ultima_notificacion_soat'];
  const notificationAvailable = Number.isFinite(status?.days) && status.days <= 30;
  return (
    <Stack spacing={.65} alignItems="flex-start">
      <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }}>
        {documentsDoNotApply ? (isNoLic ? 'Sin licencia' : 'No aplica para bicicleta') : date ? formatDate(date) : rawText || 'Sin información'}
      </Typography>
      <Chip
        className="pesv-expiry-chip"
        size="small"
        icon={
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              bgcolor: style.dotColor,
              boxShadow: style.shadow,
              ml: '7px !important',
              mr: '-3px !important'
            }}
          />
        }
        label={isNoLic ? 'Sin licencia' : expiryLabel(status)}
        sx={{ color: style.color, bgcolor: style.bgcolor, border: `1px solid ${style.border}`, fontWeight: 800, fontSize: 11 }}
      />
      {date && status?.code !== 'no_aplica' && notificationAvailable && (
        <Tooltip title={lastNotification ? `Último aviso enviado: ${formatDateTime(lastNotification)}. Pulse para consultar el estado.` : 'Enviar notificación manual'} arrow placement="bottom-start">
          <span><Button size="small" startIcon={notifying ? <CircularProgress size={13} /> : <EmailRoundedIcon />} disabled={notifying || !row.correo} onClick={() => onNotify(row, type)} sx={{ p: 0, minWidth: 0, textTransform: 'none', fontWeight: 800, fontSize: 11.5, color: lastNotification ? '#64748b' : undefined }}>
            {lastNotification ? 'Aviso enviado' : 'Notificar'}
          </Button></span>
        </Tooltip>
      )}
    </Stack>
  );
}

function ParqueaderosPesvPanel({ onBack }) {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [catalogs, setCatalogs] = useState({ campus: [], parqueaderos: [] });
  const [loading, setLoading] = useState(true);
  const [estadoRegistro, setEstadoRegistro] = useState('activos');
  const [search, setSearch] = useState('');
  const [campus, setCampus] = useState('');
  const [estado, setEstado] = useState('');
  const [indicator, setIndicator] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [dialog, setDialog] = useState({ open: false, row: null });
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [notifying, setNotifying] = useState('');
  const [notifyingRuntUpdate, setNotifyingRuntUpdate] = useState(false);
  const [runtValidation, setRuntValidation] = useState({ open: false, row: null, sessionId: null, estado: '', data: null, loading: false });
  const [runtValidationMode, setRuntValidationMode] = useState('vehicle');
  const [runtForm, setRuntForm] = useState(EMPTY_RUNT_FORM);
  const [runtDriverForm, setRuntDriverForm] = useState({
    tiene_licencia: 'SI',
    licencia_categorias: '',
    licencia_expedicion: '',
    licencia_vencimiento: ''
  });
  const [runtCopiedText, setRuntCopiedText] = useState('');
  const [history, setHistory] = useState({ open: false, row: null, loading: false, data: [] });
  const [lookingUpPerson, setLookingUpPerson] = useState(false);
  const [submittedAttempt, setSubmittedAttempt] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmModal, setConfirmModal] = useState({
    open: false, title: '', message: '', confirmText: 'Aceptar', severity: 'warning', onConfirm: null
  });
  const showConfirm = ({ title, message, confirmText = 'Aceptar', severity = 'warning', onConfirm }) => {
    setConfirmModal({ open: true, title, message, confirmText, severity, onConfirm });
  };
  const closeConfirm = () => setConfirmModal((prev) => ({ ...prev, open: false }));
  const loadRequestRef = useRef(0);

  const handleLookupPersona = async (identificacionValue) => {
    const query = String(identificacionValue || form.identificacion || '').trim();
    if (!query || query.length < 3) return;
    setLookingUpPerson(true);
    try {
      const res = await gestionInformacionService.lookupPesvPersona(query);
      if (res?.found && res?.data) {
        setForm((prev) => {
          const autoFields = {
            identificacion: res.data.identificacion || query,
            nombres_apellidos: res.data.nombres_apellidos,
            correo: res.data.correo,
            vinculacion: res.data.vinculacion,
            dependencia_programa: res.data.dependencia_programa,
            campus: res.data.campus,
            parqueadero_ingreso: res.data.parqueadero_ingreso,
            tiene_licencia: res.data.tiene_licencia,
            licencia_categorias: res.data.licencia_categorias,
            licencia_expedicion: formatDateForInput(res.data.licencia_expedicion),
            licencia_vencimiento: formatDateForInput(res.data.licencia_vencimiento),
            tipo_vehiculo: res.data.tipo_vehiculo,
            placa: res.data.placa,
            vehiculo_clase: res.data.vehiculo_clase,
            vehiculo_servicio: res.data.vehiculo_servicio,
            vehiculo_modelo: res.data.vehiculo_modelo,
            vehiculo_fecha_matricula: formatDateForInput(res.data.vehiculo_fecha_matricula),
            vehiculo_autorizado: res.data.vehiculo_autorizado,
            vehiculo_es_propio: res.data.vehiculo_es_propio,
            propietario_identificacion: res.data.propietario_identificacion,
            soat_vigencia: formatDateForInput(res.data.soat_vigencia),
            soat_fecha_expedicion: formatDateForInput(res.data.soat_fecha_expedicion),
            soat_fecha_inicio: formatDateForInput(res.data.soat_fecha_inicio),
            soat_numero_poliza: res.data.soat_numero_poliza,
            soat_entidad: res.data.soat_entidad,
            tecnomecanica_vigencia: formatDateForInput(res.data.tecnomecanica_vigencia),
            rtm_estado: res.data.rtm_estado,
            rtm_fecha_expedicion: formatDateForInput(res.data.rtm_fecha_expedicion),
            rtm_fecha_exigibilidad: formatDateForInput(res.data.rtm_fecha_exigibilidad),
            rtm_numero_certificado: res.data.rtm_numero_certificado,
            rtm_cda: res.data.rtm_cda
          };
          const nonEmptyUpdates = Object.fromEntries(
            Object.entries(autoFields).filter(([, value]) => String(value ?? '').trim() !== '')
          );
          return { ...prev, ...nonEmptyUpdates };
        });
        enqueueSnackbar(`Información histórica de ${res.data.nombres_apellidos || query} cargada desde ${res.source}. Revise los datos y actualice únicamente las fechas o datos que renovaron.`, { variant: 'success' });
      } else {
        enqueueSnackbar('No se encontraron datos previos de esta cédula en el sistema. Puede digitar los campos manualmente.', { variant: 'info' });
      }
    } catch (err) {
      console.error('Error autocompletando persona:', err);
    } finally {
      setLookingUpPerson(false);
    }
  };

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    try {
      let result;
      try {
        result = await gestionInformacionService.getPesvParqueaderos({ search, campus, estado, indicador: indicator, estado_registro: estadoRegistro });
      } catch (firstError) {
        const transient = !firstError.response || Number(firstError.response?.status) >= 500;
        if (!transient || requestId !== loadRequestRef.current) throw firstError;
        await new Promise((resolve) => setTimeout(resolve, 350));
        if (requestId !== loadRequestRef.current) return;
        result = await gestionInformacionService.getPesvParqueaderos({ search, campus, estado, indicador: indicator, estado_registro: estadoRegistro });
      }
      if (requestId !== loadRequestRef.current) return;
      setRows(result.data || []); setSummary(result.summary || {}); setCatalogs(result.catalogs || { campus: [], parqueaderos: [] }); setPage(0);
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      const message = Number(error.response?.status) === 404
        ? 'La API PESV no está disponible. Reinicia o despliega el backend actualizado.'
        : error.response?.data?.message || 'No se pudieron cargar los registros PESV';
      enqueueSnackbar(message, { variant: 'error' });
    }
    finally { if (requestId === loadRequestRef.current) setLoading(false); }
  }, [campus, enqueueSnackbar, estado, estadoRegistro, indicator, search]);

  useEffect(() => { const timer = setTimeout(load, 450); return () => clearTimeout(timer); }, [load, refreshKey]);
  const visibleRows = useMemo(() => rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), [page, rows, rowsPerPage]);
  const openCreate = () => { setSubmittedAttempt(false); setForm(EMPTY_FORM); setDialog({ open: true, row: null }); };
  const openEdit = (row) => {
    setSubmittedAttempt(false);
    const isStandardVinculacion = ['ADMINISTRATIVO', 'DOCENTE', 'ESTUDIANTE', 'CONTRATISTA', 'VISITANTE', 'EGRESADO'].includes(String(row.vinculacion || '').trim().toUpperCase());
    const isCustomVinculacion = row.vinculacion && !isStandardVinculacion;
    setForm(Object.keys(EMPTY_FORM).reduce((acc, key) => ({
      ...acc,
      [key]: ['vehiculo_autorizado', 'vehiculo_es_propio', 'tiene_licencia'].includes(key)
        ? row[key] === true ? 'SI' : row[key] === false ? 'NO' : key === 'vehiculo_es_propio' || key === 'tiene_licencia' ? 'SI' : ''
        : FORM_DATE_FIELDS.has(key)
          ? formatDateForInput(row[key])
          : row[key] || ''
    }), {
      vinculacion: isCustomVinculacion ? 'OTRO' : (row.vinculacion || ''),
      vinculacion_especificada: isCustomVinculacion ? row.vinculacion : ''
    }));
    setDialog({ open: true, row });
  };
  const updateField = (key) => (event) => {
    let value = event.target.value;
    if (key === 'placa') value = normalizePlateForRunt(value);
    if (key === 'propietario_identificacion') value = String(value || '').replace(/[^A-Za-z0-9]/g, '');
    setForm((prev) => ({ ...prev, [key]: value, ...(key === 'vehiculo_es_propio' && value !== 'NO' ? { propietario_identificacion: '' } : {}) }));
  };
  const save = async () => {
    setSubmittedAttempt(true);
    if (!form.identificacion.trim()) return enqueueSnackbar('La cédula / identificación es obligatoria', { variant: 'warning' });
    if (!form.nombres_apellidos.trim()) return enqueueSnackbar('Los nombres y apellidos son obligatorios', { variant: 'warning' });
    if (!form.placa.trim()) return enqueueSnackbar('La placa del vehículo es obligatoria para registrar o actualizar el cupo de parqueadero', { variant: 'warning' });
    if (form.vehiculo_es_propio === 'NO' && !form.propietario_identificacion.trim()) return enqueueSnackbar('Digite la identificación del propietario del vehículo', { variant: 'warning' });

    const isOtroVinculacion = String(form.vinculacion || '').trim().toUpperCase() === 'OTRO';
    if (isOtroVinculacion && !form.vinculacion_especificada?.trim()) {
      return enqueueSnackbar('Escriba el tipo de vinculación en el recuadro “¿Cuál vinculación?”', { variant: 'warning' });
    }

    if (form.tiene_licencia !== 'NO' && form.licencia_categorias && form.tipo_vehiculo) {
      const compat = checkLicenseVehicleCompatibility(form.licencia_categorias, form.tipo_vehiculo);
      if (!compat.compatible) {
        return enqueueSnackbar(compat.reason, { variant: 'error', autoHideDuration: 8000 });
      }
    }

    const payload = {
      ...form,
      vinculacion: isOtroVinculacion ? form.vinculacion_especificada.trim().toUpperCase() : form.vinculacion,
      vehiculo_clase: form.vehiculo_clase || form.tipo_vehiculo?.trim().toUpperCase() || ''
    };

    setSaving(true);
    try {
      const result = dialog.row
        ? await gestionInformacionService.updatePesvParqueadero(dialog.row.id, payload)
        : await gestionInformacionService.createPesvParqueadero(payload);
      if (result.data) {
        loadRequestRef.current += 1;
        setRows((current) => dialog.row
          ? current.map((row) => row.id === dialog.row.id ? result.data : row)
          : [result.data, ...current]);
        const focusQuery = String(result.data.identificacion || result.data.placa || result.data.nombres_apellidos || '').trim();
        setSearch(focusQuery);
        setCampus('');
        setEstado('');
        setIndicator('');
        setPage(0);
      }
      enqueueSnackbar(dialog.row ? 'Información actualizada. El registro quedó filtrado para su revisión.' : 'Registro creado. Quedó filtrado para su revisión.', { variant: 'success' });
      setDialog({ open: false, row: null });
      setRefreshKey((current) => current + 1);
    } catch (error) {
      const message = !error.response ? 'El servidor no está disponible. Intente nuevamente en unos segundos.' : error.response?.data?.message || 'No se pudo guardar';
      enqueueSnackbar(message, { variant: 'error' });
    }
    finally { setSaving(false); }
  };
  const remove = (row) => {
    showConfirm({
      title: 'Confirmar inactivación de cupo',
      message: `¿Está seguro de inactivar el cupo de parqueadero de ${row.nombres_apellidos}? El registro dejará de mostrarse en la lista activa, pero su información histórica se conservará de forma segura en la base de datos.`,
      confirmText: 'Inactivar cupo',
      severity: 'error',
      onConfirm: async () => {
        try {
          const res = await gestionInformacionService.deletePesvParqueadero(row.id);
          enqueueSnackbar(res.message || 'Cupo pasado a inactivo', { variant: 'success' });
          await load();
        } catch (error) {
          enqueueSnackbar(error.response?.data?.message || 'No se pudo inactivar', { variant: 'error' });
        }
      }
    });
  };
  const reactivateRow = (row) => {
    showConfirm({
      title: 'Confirmar reactivación de cupo',
      message: `¿Desea reactivar el cupo de parqueadero para ${row.nombres_apellidos}?`,
      confirmText: 'Reactivar cupo',
      severity: 'warning',
      onConfirm: async () => {
        try {
          const res = await gestionInformacionService.reactivatePesvParqueadero(row.id);
          enqueueSnackbar(res.message || 'Cupo reactivado exitosamente', { variant: 'success' });
          await load();
        } catch (error) {
          enqueueSnackbar(error.response?.data?.message || 'No se pudo reactivar el cupo', { variant: 'error' });
        }
      }
    });
  };
  const importFile = (event) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    showConfirm({
      title: 'Reemplazar base de parqueaderos',
      message: 'La importación desde el archivo Excel actualizará y reemplazará los registros actuales de Parqueaderos UNICESMAG. ¿Desea continuar?',
      confirmText: 'Continuar importación',
      severity: 'warning',
      onConfirm: async () => {
        setImporting(true); setImportResult(null);
        try {
          const result = await gestionInformacionService.importPesvParqueaderos(file, true);
          setImportResult(result.data);
          enqueueSnackbar(result.message, { variant: 'success' });
          await load();
        } catch (error) {
          enqueueSnackbar(error.response?.data?.message || 'No se pudo importar el Excel', { variant: 'error' });
        } finally {
          setImporting(false);
        }
      }
    });
  };
  const downloadExcelTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const response = await gestionInformacionService.downloadPesvParqueaderosTemplate();
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url; link.download = 'Plantilla_Parqueaderos_PESV_UNICESMAG.xlsx';
      document.body.appendChild(link); link.click(); link.remove(); window.URL.revokeObjectURL(url);
      enqueueSnackbar('Plantilla Excel con listas desplegables descargada', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No se pudo descargar la plantilla', { variant: 'error' }); }
    finally { setDownloadingTemplate(false); }
  };
  const downloadExcelData = async () => {
    setExportingData(true);
    try {
      const response = await gestionInformacionService.exportPesvParqueaderos({ search, campus, estado, indicador: indicator });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      const date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      link.href = url; link.download = `Base_Parqueaderos_PESV_UNICESMAG_${date}.xlsx`;
      document.body.appendChild(link); link.click(); link.remove(); window.URL.revokeObjectURL(url);
      enqueueSnackbar(`${rows.length} registro${rows.length === 1 ? '' : 's'} exportado${rows.length === 1 ? '' : 's'} en formato compatible con la importación`, { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No se pudo descargar la base de datos', { variant: 'error' }); }
    finally { setExportingData(false); }
  };
  const notify = async (row, tipo) => {
    const key = `${row.id}-${tipo}`; setNotifying(key);
    try { const result = await gestionInformacionService.notifyPesvExpiry(row.id, tipo); enqueueSnackbar(result.message, { variant: 'success' }); await load(); }
    catch (error) {
      const alreadyNotified = Number(error.response?.status) === 409 && error.response?.data?.alreadyNotified;
      enqueueSnackbar(error.response?.data?.message || 'No se pudo enviar la notificación', { variant: alreadyNotified ? 'warning' : 'error', autoHideDuration: alreadyNotified ? 8000 : 5000 });
      if (alreadyNotified) await load();
    }
    finally { setNotifying(''); }
  };
  const copyRuntValue = async (label, value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
      enqueueSnackbar(`${label} copiada`, { variant: 'success' });
    } catch (error) { enqueueSnackbar(`No se pudo copiar ${label.toLowerCase()}`, { variant: 'error' }); }
  };
  const startRuntValidation = async (row, mode = 'vehicle') => {
    setRuntValidationMode(mode);
    const isDriverMode = mode === 'driver';
    const driverUrl = 'https://portalpublico.runt.gov.co/#/consulta-ciudadano-documento/consulta/consulta-ciudadano-documento';

    if (!isDriverMode && isBicycleVehicle(row)) {
      return enqueueSnackbar('SOAT, RTM y validación RUNT no aplican para bicicletas', { variant: 'info' });
    }

    const placaConsulta = normalizePlateForRunt(row.placa);
    const documentoConsulta = getRuntDocument(row) || String(row.identificacion || '').trim();

    if (!documentoConsulta) {
      return enqueueSnackbar('La consulta RUNT requiere la cédula / identificación', { variant: 'warning' });
    }
    if (!isDriverMode && !placaConsulta) {
      return enqueueSnackbar(row.vehiculo_es_propio === false ? 'La validación RUNT requiere la placa y la identificación del propietario' : 'La validación RUNT requiere placa e identificación', { variant: 'warning' });
    }

    const popup = window.open('', '_blank');

    if (isDriverMode) {
      setRuntDriverForm({
        tiene_licencia: row.tiene_licencia === false ? 'NO' : 'SI',
        licencia_categorias: row.licencia_categorias || '',
        licencia_expedicion: formatDateForInput(row.licencia_expedicion) || '',
        licencia_vencimiento: formatDateForInput(row.licencia_vencimiento) || ''
      });
      setRuntCopiedText('');
      setRuntValidation({
        open: true,
        row,
        sessionId: null,
        runtUrl: driverUrl,
        estado: 'PENDIENTE',
        data: null,
        loading: false,
        placaConsulta: row.placa || '',
        documentoConsulta,
        usaDocumentoPropietario: false
      });
      if (popup) {
        try {
          popup.location.replace(driverUrl);
          popup.opener = null;
        } catch (popupError) {
          popup.close();
          enqueueSnackbar('La ventana RUNT se configuró. Use el botón «Abrir RUNT por Documento».', { variant: 'warning' });
        }
      } else {
        enqueueSnackbar('El navegador bloqueó la ventana emergente RUNT. Permita emergentes para SIAC.', { variant: 'warning' });
      }
      return;
    }

    try {
      const result = await gestionInformacionService.startPesvRuntValidation(row.id);
      const session = result.data;
      setRuntForm(EMPTY_RUNT_FORM);
      setRuntCopiedText('');
      const normalizedRow = { ...row, placa: session.placaConsulta || placaConsulta };
      setRuntValidation({ open: true, row: normalizedRow, sessionId: session.id, runtUrl: session.runtUrl, estado: session.estado, data: null, loading: false, placaConsulta: session.placaConsulta || placaConsulta, documentoConsulta: session.documentoConsulta || documentoConsulta, usaDocumentoPropietario: Boolean(session.usaDocumentoPropietario) });
      if (popup) {
        try {
          popup.location.replace(session.runtUrl);
          popup.opener = null;
        } catch (popupError) {
          popup.close();
          enqueueSnackbar('La validación quedó lista. Use el botón «Abrir RUNT nuevamente» del formulario.', { variant: 'warning' });
        }
      }
      else enqueueSnackbar('El navegador bloqueó la pestaña RUNT. Habilita ventanas emergentes para SIAC.', { variant: 'warning' });
    } catch (error) { if (popup) popup.close(); enqueueSnackbar(error.response?.data?.message || 'No se pudo iniciar la validación RUNT', { variant: 'error' }); }
  };

  const extractCopiedRuntDriverResult = () => {
    const parsed = parseRuntDriverCopiedText(runtCopiedText);
    if (!parsed.hasLicencia && !parsed.categorias && !parsed.vencimiento) {
      return enqueueSnackbar('No se encontraron licencias ni categorías en el texto pegado. Expande el acordeón «Licencias de Conducción» en RUNT antes de copiar.', { variant: 'warning' });
    }
    setRuntDriverForm({
      tiene_licencia: parsed.hasLicencia ? 'SI' : 'NO',
      licencia_categorias: parsed.categorias || '',
      licencia_expedicion: parsed.expedicion || '',
      licencia_vencimiento: parsed.vencimiento || ''
    });
    setRuntCopiedText('');
    enqueueSnackbar(`Licencia extraída: Categorías (${parsed.categorias || 'Sin especificar'}). Revisa la información antes de guardar.`, { variant: 'success' });
  };

  const confirmRuntDriverValidation = async () => {
    if (!runtValidation.row?.id) return;
    setRuntValidation((prev) => ({ ...prev, loading: true }));
    try {
      const payload = {
        ...runtValidation.row,
        tiene_licencia: runtDriverForm.tiene_licencia === 'SI',
        licencia_categorias: runtDriverForm.licencia_categorias,
        licencia_expedicion: runtDriverForm.licencia_expedicion,
        licencia_vencimiento: runtDriverForm.licencia_vencimiento
      };
      await gestionInformacionService.updatePesvParqueadero(runtValidation.row.id, payload);
      setSearch(String(runtValidation.row.identificacion || runtValidation.row.placa || '').trim());
      setPage(0);
      setRuntValidation((prev) => ({ ...prev, open: false, loading: false }));
      setRefreshKey((current) => current + 1);
      enqueueSnackbar('Licencia de conducción actualizada exitosamente en SIAC.', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No se pudo guardar la licencia de conducción', { variant: 'error' });
      setRuntValidation((prev) => ({ ...prev, loading: false }));
    }
  };
  const extractCopiedRuntResult = () => {
    const parsed = parseRuntCopiedText(runtCopiedText);
    const expectedPlate = runtValidation.placaConsulta || normalizePlateForRunt(runtValidation.row?.placa);
    if (parsed.plate && expectedPlate && parsed.plate !== expectedPlate) return enqueueSnackbar(`El texto corresponde a la placa ${parsed.plate}, no a ${expectedPlate}`, { variant: 'error' });
    if (!parsed.soat && !parsed.rtm && !parsed.rtmSituation) return enqueueSnackbar('No se encontraron tablas SOAT ni RTM. Expande los acordeones antes de copiar.', { variant: 'warning' });
    setRuntForm((prev) => ({
      ...prev,
      ...(parsed.soat ? { soat_fecha_fin: parsed.soat.fecha_fin, soat_numero_poliza: parsed.soat.numero_poliza, soat_entidad: parsed.soat.entidad } : {}),
      ...(parsed.rtm ? { rtm_aplica: 'SI', rtm_fecha_vigencia: parsed.rtm.fecha_vigencia, rtm_numero_certificado: parsed.rtm.numero_certificado, rtm_cda: parsed.rtm.cda } : {}),
      ...(parsed.rtmSituation && !parsed.rtm ? { rtm_aplica: parsed.rtmSituation, rtm_fecha_vigencia: '' } : {}),
      vehiculo_fecha_matricula: parsed.vehicle?.fecha_matricula || '',
      vehiculo_clase: parsed.vehicle?.clase || '',
      vehiculo_servicio: parsed.vehicle?.servicio || '',
      vehiculo_modelo: parsed.vehicle?.modelo || '',
      rtm_fecha_exigibilidad: parsed.rtmDueDate || ''
    }));
    setRuntCopiedText('');
    const rtmMessage = parsed.rtm ? 'RTM vigente' : parsed.rtmSituation === 'NO_EXIGIBLE' ? 'RTM no exigible a la fecha' : parsed.rtmSituation === 'SIN_REGISTRO_RUNT' ? 'RTM sin registro en RUNT' : '';
    enqueueSnackbar(`Datos extraídos: ${[parsed.soat && 'SOAT', rtmMessage].filter(Boolean).join(' y ')}. Revisa el resultado antes de cargar.`, { variant: 'success' });
  };
  const captureManualRunt = async () => {
    if (!runtForm.soat_fecha_fin) return enqueueSnackbar('Copia desde RUNT la fecha final del SOAT', { variant: 'warning' });
    if (runtForm.rtm_aplica === 'SI' && !runtForm.rtm_fecha_vigencia) return enqueueSnackbar('Copia la vigencia de la tecnomecanica o selecciona No aplica', { variant: 'warning' });
    setRuntValidation((prev) => ({ ...prev, loading: true }));
    try {
      const result = await gestionInformacionService.capturePesvRuntManual(runtValidation.sessionId, { ...runtForm, rtm_aplica: runtForm.rtm_aplica });
      setRuntValidation((prev) => ({ ...prev, estado: 'CAPTURADA', data: result.data, loading: false }));
      enqueueSnackbar(result.message, { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No se pudieron cargar las fechas consultadas', { variant: 'error' });
      setRuntValidation((prev) => ({ ...prev, loading: false }));
    }
  };
  const confirmRuntValidation = async () => {
    if (!runtValidation.sessionId) return;
    setRuntValidation((prev) => ({ ...prev, loading: true }));
    try {
      const focusQuery = String(runtValidation.row?.identificacion || runtValidation.row?.placa || '').trim();
      const result = await gestionInformacionService.confirmPesvRuntValidation(runtValidation.sessionId);
      loadRequestRef.current += 1;
      setSearch(focusQuery);
      setCampus('');
      setEstado('');
      setIndicator('');
      setPage(0);
      setRuntValidation((prev) => ({ ...prev, estado: 'CONFIRMADA', loading: false, confirmationSent: false }));
      setRefreshKey((current) => current + 1);
      enqueueSnackbar(`${result.message} El registro quedó filtrado para su revisión.`, { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No se pudo confirmar la validación', { variant: 'error' }); setRuntValidation((prev) => ({ ...prev, loading: false })); }
  };
  const notifyRuntUpdate = async () => {
    if (!runtValidation.sessionId || runtValidation.estado !== 'CONFIRMADA') return;
    setNotifyingRuntUpdate(true);
    try {
      const result = await gestionInformacionService.notifyPesvRuntUpdate(runtValidation.sessionId);
      setRuntValidation((prev) => ({ ...prev, confirmationSent: true }));
      enqueueSnackbar(result.message, { variant: 'success' });
    } catch (error) {
      const alreadyNotified = Number(error.response?.status) === 409 && error.response?.data?.alreadyNotified;
      if (alreadyNotified) setRuntValidation((prev) => ({ ...prev, confirmationSent: true }));
      enqueueSnackbar(error.response?.data?.message || 'No se pudo enviar la confirmación de actualización', { variant: alreadyNotified ? 'warning' : 'error' });
    } finally { setNotifyingRuntUpdate(false); }
  };
  const openHistory = async (row) => {
    setHistory({ open: true, row, loading: true, data: [] });
    try { const result = await gestionInformacionService.getPesvRuntHistory(row.id); setHistory({ open: true, row, loading: false, data: result.data || [] }); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No se pudo cargar el histórico RUNT', { variant: 'error' }); setHistory((prev) => ({ ...prev, loading: false })); }
  };

  useEffect(() => {
    if (!runtValidation.open || !runtValidation.sessionId || ['CAPTURADA', 'CONFIRMADA', 'CANCELADA', 'ERROR'].includes(runtValidation.estado)) return undefined;
    let active = true;
    const poll = async () => {
      try {
        const result = await gestionInformacionService.getPesvRuntValidation(runtValidation.sessionId);
        if (active) setRuntValidation((prev) => ({ ...prev, estado: result.data?.estado || prev.estado, data: result.data || null }));
      } catch (error) { if (active && Number(error.response?.status) !== 404) setRuntValidation((prev) => ({ ...prev, estado: 'ERROR' })); }
    };
    poll(); const timer = setInterval(poll, 2500);
    return () => { active = false; clearInterval(timer); };
  }, [runtValidation.estado, runtValidation.open, runtValidation.sessionId]);

  const runtUpdateDetected = Boolean(runtValidation.data?.resultado?.comparacion_actualizacion?.detectada);

  const vencidosCount = summary.vencidos !== undefined
    ? summary.vencidos
    : rows.filter((r) => r.soat_estado?.code === 'vencido' || r.tecnomecanica_estado?.code === 'vencido' || r.licencia_estado?.code === 'vencido').length;

  const proximosCount = summary.proximos !== undefined
    ? summary.proximos
    : rows.filter((r) => (r.soat_estado?.code === 'proximo' || r.tecnomecanica_estado?.code === 'proximo' || r.licencia_estado?.code === 'proximo') && r.soat_estado?.code !== 'vencido' && r.tecnomecanica_estado?.code !== 'vencido' && r.licencia_estado?.code !== 'vencido').length;

  const stats = [
    { key: '', label: 'Cupos registrados', value: summary.total || 0, color: '#1d4ed8', background: '#eff6ff', icon: <DirectionsCarRoundedIcon /> },
    { key: 'vencido', label: 'Vencidos', value: vencidosCount, color: '#dc2626', background: '#fef2f2', icon: <WarningAmberRoundedIcon /> },
    { key: 'proximo', label: 'Próximos a vencer (30 días)', value: proximosCount, color: '#d97706', background: '#fffbeb', icon: <FactCheckRoundedIcon /> }
  ];
  const applyIndicatorFilter = (key) => {
    const selectedStat = stats.find((item) => item.key === key);
    if (key && selectedStat?.value === 0) {
      setIndicator('');
      setEstado('');
      setPage(0);
      enqueueSnackbar(`No hay registros en “${selectedStat.label}” para la búsqueda actual. Se conservan visibles los resultados encontrados.`, { variant: 'info' });
      return;
    }
    const next = key && indicator === key ? '' : key;
    setIndicator(next);
    setEstado('');
    setPage(0);
  };
  const handleSearchChange = (value) => {
    setSearch(value);
    setIndicator('');
    setEstado('');
    setCampus('');
    setPage(0);
  };
  const bicycleSelected = isBicycleVehicle(form);
  const formCatalogOptions = {
    vinculacion: catalogs.vinculaciones || [], dependencia_programa: catalogs.dependencias || [], campus: catalogs.campus || [],
    parqueadero_ingreso: catalogs.parqueaderos || [], licencia_categorias: catalogs.categoriasLicencia || [],
    tipo_vehiculo: catalogs.tiposVehiculo || [], vehiculo_clase: catalogs.clasesVehiculo || [],
    vehiculo_servicio: catalogs.serviciosVehiculo || [], soat_entidad: catalogs.aseguradoras || [], rtm_cda: catalogs.centrosDiagnostico || []
  };
  const renderFormField = ([key, label]) => {
    if (key === 'identificacion') {
      const hasError = submittedAttempt && !form.identificacion?.trim();
      return (
        <TextField
          key={key}
          label={label}
          value={form[key]}
          onChange={updateField(key)}
          onBlur={(e) => e.target.value.trim().length >= 3 && handleLookupPersona(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleLookupPersona(form.identificacion))}
          placeholder="Ej: 12345678"
          error={hasError}
          helperText={hasError ? 'Campo obligatorio: digite la cédula' : 'Al digitar la cédula y presionar Enter o la lupa, se autocompletarán los datos.'}
          fullWidth
          size="small"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title="Buscar persona por cédula en bases institucionales">
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => handleLookupPersona(form.identificacion)}
                      disabled={lookingUpPerson || !form.identificacion?.trim()}
                      color={hasError ? 'error' : 'primary'}
                    >
                      {lookingUpPerson ? <CircularProgress size={16} /> : <SearchRoundedIcon fontSize="small" />}
                    </IconButton>
                  </span>
                </Tooltip>
              </InputAdornment>
            )
          }}
        />
      );
    }
    if (key === 'placa') {
      const hasError = submittedAttempt && !form.placa?.trim();
      return (
        <TextField
          key={key}
          label={label}
          value={form[key]}
          onChange={updateField(key)}
          placeholder="Ej: ABC123"
          error={hasError}
          helperText={hasError ? 'Campo obligatorio: digite la placa' : undefined}
          disabled={bicycleSelected && BICYCLE_DOCUMENT_FIELDS.has(key)}
          fullWidth
          size="small"
        />
      );
    }
    if (key === 'nombres_apellidos') {
      const hasError = submittedAttempt && !form.nombres_apellidos?.trim();
      return (
        <TextField
          key={key}
          label={label}
          value={form[key]}
          onChange={updateField(key)}
          error={hasError}
          helperText={hasError ? 'Campo obligatorio' : undefined}
          fullWidth
          size="small"
        />
      );
    }
    if (['vehiculo_autorizado', 'vehiculo_es_propio', 'tiene_licencia'].includes(key)) return (
      <FormControl key={key} size="small" fullWidth error={submittedAttempt && key === 'vehiculo_es_propio' && !form[key]}>
        <InputLabel>{label}</InputLabel>
        <Select label={label} value={form[key]} onChange={updateField(key)}>
          <MenuItem value=""><em>Seleccione una opción</em></MenuItem>
          <MenuItem value="SI">Sí</MenuItem>
          <MenuItem value="NO">No</MenuItem>
        </Select>
      </FormControl>
    );
    if (key === 'licencia_categorias') {
      const catOptions = [
        { code: 'A1', label: 'A1 (Motocicleta hasta 125 cc · Particular)' },
        { code: 'A2', label: 'A2 (Motocicleta mayor a 125 cc · Particular)' },
        { code: 'B1', label: 'B1 (Carro / Camioneta · Servicio Particular)' },
        { code: 'B2', label: 'B2 (Camión / Bus · Servicio Particular)' },
        { code: 'B3', label: 'B3 (Vehículo articulado · Servicio Particular)' },
        { code: 'C1', label: 'C1 (Carro / Camioneta · Conductor Profesional / Servicio Público)' },
        { code: 'C2', label: 'C2 (Camión / Bus · Conductor Profesional / Servicio Público)' },
        { code: 'C3', label: 'C3 (Vehículo articulado · Conductor Profesional / Servicio Público)' }
      ];
      return (
        <Autocomplete
          key={key}
          freeSolo
          autoHighlight
          options={catOptions}
          getOptionLabel={(option) => typeof option === 'string' ? option : (option.label || option.code)}
          renderOption={(props, option) => (
            <li {...props} key={option.code}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {option.label}
              </Typography>
            </li>
          )}
          value={form.licencia_categorias || ''}
          inputValue={form.licencia_categorias || ''}
          onChange={(_, newValue) => {
            const val = typeof newValue === 'object' && newValue ? newValue.code : (newValue || '');
            setForm((prev) => ({ ...prev, licencia_categorias: val }));
          }}
          onInputChange={(_, newInputValue) => {
            setForm((prev) => ({ ...prev, licencia_categorias: newInputValue }));
          }}
          disabled={bicycleSelected && BICYCLE_DOCUMENT_FIELDS.has(key)}
          renderInput={(params) => (
            <TextField
              {...params}
              label={label}
              placeholder="Ej: A2, B1, C1"
              helperText="Seleccione de la lista o digite. Si posee varias categorías, puede escribir por ejemplo: A2, B1"
              fullWidth
              size="small"
            />
          )}
        />
      );
    }
    const options = formCatalogOptions[key];
    if (options) return (
      <Autocomplete
        key={key} freeSolo autoHighlight options={options} value={form[key] || null} inputValue={form[key] || ''}
        onChange={(_, value) => setForm((prev) => ({ ...prev, [key]: value || '' }))}
        onInputChange={(_, value) => setForm((prev) => ({ ...prev, [key]: value || '' }))}
        disabled={bicycleSelected && BICYCLE_DOCUMENT_FIELDS.has(key)}
        renderInput={(params) => <TextField {...params} label={label} fullWidth size="small" />}
      />
    );
    return <TextField key={key} label={label} type={FORM_DATE_FIELDS.has(key) ? 'date' : 'text'} value={FORM_DATE_FIELDS.has(key) ? formatDateForInput(form[key]) : (form[key] || '')} onChange={updateField(key)} disabled={bicycleSelected && BICYCLE_DOCUMENT_FIELDS.has(key)} InputLabelProps={FORM_DATE_FIELDS.has(key) ? { shrink: true } : undefined} fullWidth size="small" />;
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.2}>
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={onBack} sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 800 }}>Volver a Seguridad Vial</Button>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button variant="outlined" startIcon={downloadingTemplate ? <CircularProgress size={16} /> : <FileDownloadRoundedIcon />} onClick={downloadExcelTemplate} disabled={downloadingTemplate} sx={{ textTransform: 'none', fontWeight: 800 }}>{downloadingTemplate ? 'Preparando…' : 'Descargar plantilla'}</Button>
          <Tooltip title="Exporta los resultados actuales. Limpie la búsqueda y los filtros para descargar toda la base.">
            <span><Button variant="outlined" startIcon={exportingData ? <CircularProgress size={16} /> : <TableViewRoundedIcon />} onClick={downloadExcelData} disabled={exportingData} sx={{ textTransform: 'none', fontWeight: 800 }}>{exportingData ? 'Descargando…' : `Descargar base (${rows.length})`}</Button></span>
          </Tooltip>
          <Button component="label" variant="outlined" startIcon={importing ? <CircularProgress size={16} /> : <FileUploadRoundedIcon />} disabled={importing} sx={{ textTransform: 'none', fontWeight: 800 }}>Importar Excel<input hidden type="file" accept=".xlsx,.xls" onChange={importFile} /></Button>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate} sx={{ textTransform: 'none', fontWeight: 800 }}>Nuevo cupo</Button>
        </Stack>
      </Stack>
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3.5, color: '#fff', background: 'linear-gradient(135deg, #064e3b 0%, #059669 100%)', boxShadow: '0 8px 20px rgba(5, 150, 105, 0.22)' }}>
        <Stack direction="row" spacing={1.5} alignItems="center"><DirectionsCarRoundedIcon sx={{ fontSize: 38 }} /><Box><Typography variant="overline" sx={{ fontWeight: 900, opacity: .85 }}>PESV · Submódulo 01</Typography><Typography variant="h4" sx={{ fontWeight: 900 }}>Parqueaderos UNICESMAG</Typography><Typography sx={{ opacity: .88 }}>Gestión de cupos, vehículos y vigencias documentales.</Typography></Box></Stack>
      </Paper>
      {importResult?.warningCount > 0 && <Alert severity="warning">Se importaron {importResult.imported} registros con {importResult.warningCount} advertencias de datos. Las vigencias no reconocibles quedaron marcadas como “Sin fecha verificable”.</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.6 }}>
        {stats.map((item) => {
          const hasSearch = Boolean(search.trim());
          const selected = item.key ? indicator === item.key : !indicator && !estado && !hasSearch;
          const relatedToSearch = hasSearch && !indicator && Boolean(item.key) && item.value > 0;
          const emphasized = selected || relatedToSearch;
          return <Paper
            key={item.label} component="button" type="button" aria-pressed={selected} onClick={() => applyIndicatorFilter(item.key)}
            elevation={0}
            sx={{
              position: 'relative', overflow: 'hidden', width: '100%', p: 2.2, borderRadius: 3.5, textAlign: 'left', font: 'inherit', cursor: 'pointer',
              color: item.color, bgcolor: emphasized ? item.background : '#fff', border: `2px solid ${emphasized ? item.color : '#cbd5e1'}`,
              boxShadow: emphasized ? `0 12px 24px ${item.color}2b` : '0 3px 10px rgba(15,23,42,.04)',
              transform: selected ? 'translateY(-3px)' : 'none', transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease, background-color .18s ease',
              '&:hover': { transform: 'translateY(-4px)', borderColor: item.color, boxShadow: `0 14px 28px ${item.color}30` },
              '&:focus-visible': { outline: `3px solid ${item.color}55`, outlineOffset: 2 }
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5} sx={{ position: 'relative', zIndex: 1 }}>
              <Box><Typography variant="caption" sx={{ display: 'block', color: emphasized ? item.color : '#475569', fontWeight: 900, fontSize: 13 }}>{item.label}</Typography><Typography sx={{ mt: .65, fontSize: 32, lineHeight: 1, fontWeight: 900, color: '#0f172a' }}>{item.value.toLocaleString('es-CO')}</Typography></Box>
              <Box sx={{ display: 'grid', placeItems: 'center', width: 48, height: 48, flexShrink: 0, borderRadius: 2.8, color: '#fff', bgcolor: item.color, boxShadow: `0 7px 16px ${item.color}38` }}>{item.icon}</Box>
            </Stack>
          </Paper>;
        })}
      </Box>
      <Paper elevation={0} sx={{ p: 1.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
          <Box sx={{ flex: 1 }}>
            <TextField
              fullWidth size="small" value={search} onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Buscar en todos los campos"
              autoComplete="off"
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ color: '#64748b' }} /></InputAdornment>,
                endAdornment: search ? <InputAdornment position="end"><IconButton size="small" aria-label="Limpiar búsqueda" onClick={() => handleSearchChange('')}><ClearRoundedIcon fontSize="small" /></IconButton></InputAdornment> : null
              }}
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#fff', borderRadius: 2.2 } }}
            />
            <Typography variant="caption" sx={{ display: 'block', mt: .55, ml: .5, color: '#64748b' }}>Busca por persona, identificación, correo, dependencia, campus, parqueadero, placa, modelo, SOAT o RTM.</Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: 180 }}><InputLabel>Campus</InputLabel><Select label="Campus" value={campus} onChange={(e) => setCampus(e.target.value)}><MenuItem value="">Todos</MenuItem>{catalogs.campus.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl>
          <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>Estado documental</InputLabel><Select label="Estado documental" value={estado} onChange={(e) => { setEstado(e.target.value); setIndicator(''); }}><MenuItem value="">Todos</MenuItem><MenuItem value="vencido">Vencidos</MenuItem><MenuItem value="proximo">Próximos a vencer</MenuItem><MenuItem value="vigente">Vigentes</MenuItem><MenuItem value="sin_fecha">Sin fecha verificable</MenuItem></Select></FormControl>
          <Tooltip title="Actualizar"><IconButton onClick={load}><RefreshRoundedIcon /></IconButton></Tooltip>
        </Stack>
      </Paper>
      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', maxHeight: { xs: '65vh', md: '72vh' }, overflow: 'auto', scrollbarGutter: 'stable' }}>
        <Table stickyHeader size="small" sx={{ width: '100%', minWidth: 1140, tableLayout: 'fixed', '& .MuiTableCell-head': { px: 1.1, py: 1.25, fontSize: 11.5, lineHeight: 1.2, bgcolor: '#eaf2ff', boxShadow: 'inset 0 -2px 0 #2563eb', zIndex: 5 }, '& .MuiTableCell-body': { px: 1.1, py: 1.15, fontSize: 12.5, verticalAlign: 'top', overflowWrap: 'anywhere' }, '& .MuiTypography-body2': { fontSize: 12.5, lineHeight: 1.3 }, '& .MuiTypography-caption': { fontSize: 10.8, lineHeight: 1.35 }, '& .MuiChip-root': { height: 22, fontSize: 10.5 }, '& .pesv-expiry-chip.MuiChip-root': { width: 'fit-content', maxWidth: '100%', height: 'auto', minHeight: 22, alignItems: 'center' }, '& .pesv-expiry-chip .MuiChip-label': { display: 'block', px: 0.8, py: 0.35, whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', lineHeight: 1.15 }, '& .pesv-expiry-chip .MuiChip-icon': { flexShrink: 0 } }}>
          <colgroup><col style={{ width: '25%' }} /><col style={{ width: '12%' }} /><col style={{ width: '13%' }} /><col style={{ width: '13%' }} /><col style={{ width: '13%' }} /><col style={{ width: '14%' }} /><col style={{ width: '10%' }} /></colgroup>
          <TableHead><TableRow sx={{ bgcolor: '#eaf2ff', borderBottom: '2px solid #2563eb' }}>{['Persona / identificación', 'Parqueadero', 'Vehículo / placa', 'SOAT', 'Tecnomecánica', 'Licencia de conducción'].map((label) => <TableCell key={label} sx={{ color: '#173b72', fontWeight: 900, borderBottom: 0 }}>{label}</TableCell>)}<TableCell align="center" sx={{ color: '#173b72', fontWeight: 900, borderBottom: 0 }}>Acciones</TableCell></TableRow></TableHead>
          <TableBody>{loading ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 7 }}><CircularProgress /></TableCell></TableRow> : visibleRows.length === 0 ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 7 }}><WarningAmberRoundedIcon sx={{ color: '#d97706' }} /><Typography sx={{ fontWeight: 800, color: '#64748b' }}>No hay registros para los filtros seleccionados</Typography></TableCell></TableRow> : visibleRows.map((row, rowIndex) => {
            const critical = row.soat_estado?.code === 'vencido' || row.tecnomecanica_estado?.code === 'vencido' || row.licencia_estado?.code === 'vencido';
            return <TableRow key={row.id} sx={{ bgcolor: row.activo === false ? '#f8fafc' : critical ? '#fff7f7' : rowIndex % 2 ? '#f8fbff' : '#fff', opacity: row.activo === false ? 0.75 : 1, '&:hover': { bgcolor: row.activo === false ? '#f1f5f9' : critical ? '#feecec' : '#eef5ff' }, '& td': { borderBottomColor: '#e5edf7' } }}>
              <TableCell>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography variant="body2" sx={{ fontWeight: 900 }}>{row.nombres_apellidos}</Typography>
                  {row.activo === false && <Chip label="INACTIVO" size="small" color="error" variant="outlined" sx={{ height: 18, fontSize: 9, fontWeight: 900 }} />}
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{row.identificacion ? `CC ${row.identificacion}` : 'Sin identificación'} · {row.dependencia_programa || 'Sin dependencia'}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>{row.correo || 'Sin correo'} · {row.vinculacion || 'Sin vinculación'}</Typography>
              </TableCell>
              <TableCell><Typography variant="body2" sx={{ fontWeight: 800 }}>{row.parqueadero_ingreso || 'Sin asignar'}</Typography><Typography variant="caption" color="text.secondary">{row.campus || 'Sin campus'}</Typography></TableCell>
              <TableCell><Chip label={row.placa || 'SIN PLACA'} size="small" sx={{ fontWeight: 900, bgcolor: '#e0e7ff', color: '#3730a3' }} /><Typography variant="caption" sx={{ display: 'block', mt: .5 }}>{row.tipo_vehiculo || 'Sin tipo'}</Typography></TableCell>
              <TableCell><ExpiryCell type="soat" date={row.soat_vigencia} rawText={row.soat_vigencia_texto} status={row.soat_estado} row={row} onNotify={notify} notifying={notifying === `${row.id}-soat`} /></TableCell>
              <TableCell><ExpiryCell type="tecnomecanica" date={row.tecnomecanica_vigencia} rawText={row.tecnomecanica_vigencia_texto} status={row.tecnomecanica_estado} row={row} onNotify={notify} notifying={notifying === `${row.id}-tecnomecanica`} /></TableCell>
              <TableCell><ExpiryCell type="licencia" date={row.licencia_vencimiento} rawText={row.licencia_categorias ? `Cat. ${row.licencia_categorias}` : ''} status={row.licencia_estado} row={row} onNotify={notify} notifying={notifying === `${row.id}-licencia`} /></TableCell>
              <TableCell align="center">
                <Box sx={{ display: 'inline-grid', gridTemplateColumns: 'repeat(2, auto)', gap: 0.6, justifyItems: 'center', alignItems: 'center' }}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      borderRadius: '20px',
                      border: '1px solid #cbd5e1',
                      bgcolor: '#f8fafc',
                      p: '2px',
                      boxShadow: '0 1px 3px rgba(15,23,42,.05)',
                      '&:hover': { borderColor: '#94a3b8', bgcolor: '#f1f5f9' }
                    }}
                  >
                    <Tooltip title={isBicycleVehicle(row) ? 'No aplica para bicicletas' : 'Consultar SOAT y RTM (RUNT por Placa)'} arrow placement="top">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => startRuntValidation(row, 'vehicle')}
                          disabled={isBicycleVehicle(row) || !normalizePlateForRunt(row.placa) || !getRuntDocument(row)}
                          sx={{
                            color: '#d97706',
                            p: '4px 8px',
                            borderRadius: '16px 0 0 16px',
                            '&:hover': { bgcolor: '#fef3c7' },
                            '&.Mui-disabled': { color: '#cbd5e1' }
                          }}
                        >
                          <DirectionsCarRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Box sx={{ width: '1px', height: '14px', bgcolor: '#cbd5e1' }} />

                    <Tooltip title="Consultar Licencia de Conducción (RUNT por Cédula)" arrow placement="top">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => startRuntValidation(row, 'driver')}
                          disabled={!getRuntDocument(row) && !row.identificacion}
                          sx={{
                            color: '#166534',
                            p: '4px 8px',
                            borderRadius: '0 16px 16px 0',
                            '&:hover': { bgcolor: '#dcfce7' },
                            '&.Mui-disabled': { color: '#cbd5e1' }
                          }}
                        >
                          <BadgeRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                  <Tooltip title="Editar cupo de parqueadero" arrow placement="bottom">
                    <IconButton size="small" onClick={() => openEdit(row)} sx={{ color: '#475569', bgcolor: '#f8fafc', border: '1px solid #cbd5e1', p: 0.55, '&:hover': { bgcolor: '#f1f5f9', color: '#0f172a' } }}>
                      <EditRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Inactivar cupo (conserva historial en BD)" arrow placement="bottom">
                    <IconButton size="small" onClick={() => remove(row)} sx={{ color: '#dc2626', bgcolor: '#fef2f2', border: '1px solid #fecaca', p: 0.55, '&:hover': { bgcolor: '#fee2e2' } }}>
                      <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </TableCell>
            </TableRow>;
          })}</TableBody></Table>
        <TablePagination component="div" count={rows.length} page={page} onPageChange={(_, value) => setPage(value)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }} labelRowsPerPage="Filas" labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`} />
      </TableContainer>

      <Dialog open={dialog.open} onClose={() => !saving && setDialog({ open: false, row: null })} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 900 }}>{dialog.row ? 'Editar cupo de parqueadero' : 'Registrar nuevo cupo'}</DialogTitle>
        <DialogContent dividers><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <Box sx={{
            gridColumn: { sm: '1 / -1' },
            p: 1.8,
            borderRadius: 2,
            bgcolor: '#f0f7ff',
            border: '1.5px solid #93c5fd',
            boxShadow: '0 2px 8px rgba(30,58,138,0.06)'
          }}>
            <Typography sx={{ fontWeight: 900, color: '#1e3a8a', mb: 1, fontSize: 13.5 }}>
              Campos principales de búsqueda e identificación
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              {renderFormField(['identificacion', 'Identificación *'])}
              {renderFormField(['placa', 'Placa *'])}
            </Box>
          </Box>

          <Typography sx={{ gridColumn: { sm: '1 / -1' }, mt: 0.5, fontWeight: 900, color: '#1e3a8a' }}>Información del conductor / colaborador</Typography>
          {renderFormField(['nombres_apellidos', 'Nombres y apellidos *'])}
          {renderFormField(['correo', 'Correo electrónico'])}
          {renderFormField(['vinculacion', 'Vinculación'])}
          {String(form.vinculacion || '').toUpperCase().startsWith('OTRO') && (
            <TextField
              label="¿Cuál vinculación? *"
              placeholder="Ej: Pasante, Proveedor, Honorarios, Pasantía..."
              value={form.vinculacion_especificada || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, vinculacion_especificada: e.target.value }))}
              error={submittedAttempt && !form.vinculacion_especificada?.trim()}
              helperText={submittedAttempt && !form.vinculacion_especificada?.trim() ? 'Campo obligatorio' : 'Escriba el tipo de vinculación y se registrará oficialmente.'}
              fullWidth size="small"
              sx={{ gridColumn: { sm: '1 / -1' } }}
            />
          )}
          {renderFormField(['dependencia_programa', 'Dependencia o programa'])}
          {renderFormField(['campus', 'Campus'])}
          {renderFormField(['parqueadero_ingreso', 'Parqueadero de ingreso'])}

          <Typography sx={{ gridColumn: { sm: '1 / -1' }, mt: 1, fontWeight: 900, color: '#1e3a8a' }}>Propiedad y autorización del vehículo</Typography>
          {[
            ['vehiculo_autorizado', '¿El vehículo está autorizado?'], ['vehiculo_es_propio', '¿El vehículo es propio?']
          ].map(renderFormField)}
          {form.vehiculo_es_propio === 'NO' && (
            <TextField
              label="Identificación del propietario *"
              value={form.propietario_identificacion || ''}
              onChange={updateField('propietario_identificacion')}
              error={submittedAttempt && !form.propietario_identificacion?.trim()}
              helperText={submittedAttempt && !form.propietario_identificacion?.trim() ? 'Campo obligatorio cuando el vehículo no es propio' : 'Este documento se utilizará junto con la placa para realizar la consulta pública en RUNT.'}
              fullWidth size="small"
            />
          )}
          {form.vehiculo_es_propio === 'NO' && <Alert severity="info" sx={{ gridColumn: { sm: '1 / -1' }, alignItems: 'center' }}>La persona asignada al cupo se conserva como conductor. Para consultar el vehículo en RUNT se utilizará exclusivamente la identificación del propietario.</Alert>}

          {Boolean(dialog.row) && (
            <>
              <Typography sx={{ gridColumn: { sm: '1 / -1' }, mt: 1, fontWeight: 900, color: '#1e3a8a' }}>Licencia de conducción</Typography>
              {[
                ['tiene_licencia', '¿Tiene Licencia de Conducción?']
              ].map(renderFormField)}
              {form.tiene_licencia !== 'NO' && <>
                {[
                  ['licencia_categorias', 'Categoría(s) autorizadas (ej: A2, B1, C1)'],
                  ['licencia_expedicion', 'Fecha de expedición'],
                  ['licencia_vencimiento', 'Fecha de vencimiento']
                ].map(renderFormField)}
                <Alert severity="info" sx={{ gridColumn: { sm: '1 / -1' }, fontSize: 12 }}>
                  <strong>Vigencia de licencias en Colombia (Ley 769/2002 · Ley 2161/2021):</strong><br />
                  • <strong>Servicio Particular (A1, A2, B1, B2, B3):</strong> Menores de 60 años cada 10 años · De 60 a 69 años cada 5 años · Mayores de 70 años renovación anual.<br />
                  • <strong>Servicio Público (C1, C2, C3):</strong> Menores de 60 años cada 3 años · Mayores de 60 años renovación anual.
                </Alert>
                {form.tiene_licencia !== 'NO' && form.licencia_categorias && form.tipo_vehiculo && (() => {
                  const compat = checkLicenseVehicleCompatibility(form.licencia_categorias, form.tipo_vehiculo);
                  if (!compat.compatible) {
                    return (
                      <Alert severity="error" sx={{ gridColumn: { sm: '1 / -1' }, fontWeight: 800 }}>
                        🚨 <strong>Incompatibilidad Detectada:</strong> {compat.reason}
                      </Alert>
                    );
                  }
                  return null;
                })()}
              </>}

              <Typography sx={{ gridColumn: { sm: '1 / -1' }, mt: 1, fontWeight: 900, color: '#1e3a8a' }}>Información del vehículo</Typography>
              {[ 
                ['tipo_vehiculo', 'Tipo de vehículo'], ['vehiculo_servicio', 'Tipo de servicio (RUNT)'], ['vehiculo_modelo', 'Modelo'], ['vehiculo_fecha_matricula', 'Fecha inicial de matrícula']
              ].map(renderFormField)}
              {form.tipo_vehiculo === 'Otro' && (
                <TextField
                  label="¿Cuál tipo de vehículo? *"
                  placeholder="Ej: Patineta eléctrica, Monopatín, Triciclo..."
                  value={form.tipo_vehiculo_especificado || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      tipo_vehiculo_especificado: val,
                      ...(val.trim() ? { tipo_vehiculo_custom: val.trim() } : {})
                    }));
                  }}
                  onBlur={() => {
                    if (form.tipo_vehiculo_especificado?.trim()) {
                      setForm((prev) => ({ ...prev, tipo_vehiculo: prev.tipo_vehiculo_especificado.trim() }));
                    }
                  }}
                  helperText="Escriba el tipo de vehículo y este se registrará como su tipo oficial."
                  fullWidth size="small"
                />
              )}

              {bicycleSelected && <Alert severity="info" sx={{ gridColumn: { sm: '1 / -1' } }}><strong>Bicicleta:</strong> no requiere SOAT, revisión técnico-mecánica ni validación en RUNT. Al guardar, estos campos se registrarán como “No aplica”.</Alert>}

              {!bicycleSelected && <>
                <Typography sx={{ gridColumn: { sm: '1 / -1' }, mt: 1, fontWeight: 900, color: '#1e3a8a' }}>Seguro obligatorio — SOAT</Typography>
                {[
                  ['soat_fecha_expedicion', 'Fecha de expedición'], ['soat_fecha_inicio', 'Inicio de vigencia'], ['soat_vigencia', 'Fin de vigencia'], ['soat_numero_poliza', 'Número de póliza'], ['soat_entidad', 'Entidad aseguradora']
                ].map(renderFormField)}

                <Typography sx={{ gridColumn: { sm: '1 / -1' }, mt: 1, fontWeight: 900, color: '#1e3a8a' }}>Revisión técnico-mecánica — RTM</Typography>
                <FormControl size="small" fullWidth><InputLabel>Estado de la RTM</InputLabel><Select label="Estado de la RTM" value={form.rtm_estado} onChange={updateField('rtm_estado')}><MenuItem value="">Sin clasificar</MenuItem><MenuItem value="VIGENTE">Vigente</MenuItem><MenuItem value="VENCIDO">Vencida</MenuItem><MenuItem value="NO_EXIGIBLE">RTM no exigible a la fecha</MenuItem><MenuItem value="SIN_REGISTRO_RUNT">Sin RTM registrada en RUNT</MenuItem><MenuItem value="NO_APLICA">Exento por disposición aplicable</MenuItem></Select></FormControl>
                {[
                  ['rtm_fecha_expedicion', 'Fecha de expedición RTM'], ['tecnomecanica_vigencia', 'Fin de vigencia RTM'], ['rtm_fecha_exigibilidad', 'Primera fecha de exigibilidad'], ['rtm_numero_certificado', 'Número de certificado'], ['rtm_cda', 'Centro de Diagnóstico Automotor (CDA)']
                ].map(renderFormField)}
              </>}
            </>
          )}
        </Box></DialogContent>
        <DialogActions><Button onClick={() => setDialog({ open: false, row: null })} disabled={saving}>Cancelar</Button><Button variant="contained" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button></DialogActions>
      </Dialog>

      <Dialog open={runtValidation.open} onClose={() => !runtValidation.loading && setRuntValidation({ open: false, row: null, sessionId: null, estado: '', data: null, loading: false })} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>
          Validación RUNT · {runtValidationMode === 'driver' ? `Licencia (${runtValidation.row?.nombres_apellidos || 'Conductor'})` : `Vehículo (${runtValidation.placaConsulta || runtValidation.row?.placa || ''})`}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Tabs
              value={runtValidationMode}
              onChange={(_, val) => {
                setRuntValidationMode(val);
                setRuntCopiedText('');
              }}
              sx={{ borderBottom: 1, borderColor: 'divider', mb: 0.5 }}
            >
              <Tab value="vehicle" icon={<DirectionsCarRoundedIcon />} iconPosition="start" label="1. SOAT y Tecnomecánica (RUNT por Placa)" />
              <Tab value="driver" icon={<BadgeRoundedIcon />} iconPosition="start" label="2. Licencia de Conducción (RUNT por Cédula)" />
            </Tabs>

            {runtValidationMode === 'driver' ? (
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap justifyContent="space-between">
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Stack direction="row" spacing={0.25} alignItems="center">
                      <Chip label={`Cédula: ${runtValidation.documentoConsulta || runtValidation.row?.identificacion || ''}`} color="primary" sx={{ fontWeight: 800 }} />
                      <Tooltip title="Copiar Cédula">
                        <IconButton size="small" onClick={() => copyRuntValue('Cédula', runtValidation.documentoConsulta || runtValidation.row?.identificacion)}>
                          <ContentCopyRoundedIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>

                    <Stack direction="row" spacing={0.25} alignItems="center">
                      <Chip
                        label={`Primer Apellido: ${getPrimerApellido(runtValidation.row) || 'Sin apellido'}`}
                        sx={{ fontWeight: 800, bgcolor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}
                      />
                      <Tooltip title="Copiar Primer Apellido para formulario RUNT">
                        <IconButton size="small" onClick={() => copyRuntValue('Primer Apellido', getPrimerApellido(runtValidation.row))}>
                          <ContentCopyRoundedIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>

                  <Button size="small" variant="outlined" startIcon={<BadgeRoundedIcon />} sx={{ fontWeight: 800 }} onClick={() => window.open('https://portalpublico.runt.gov.co/#/consulta-ciudadano-documento/consulta/consulta-ciudadano-documento', '_blank', 'noopener,noreferrer')}>
                    Abrir RUNT por Documento
                  </Button>
                </Stack>

                <Paper variant="outlined" sx={{ p: 1.8, borderRadius: 2.5, borderColor: '#67e8f9', bgcolor: '#ecfeff' }}>
                  <Typography sx={{ fontWeight: 900, color: '#0f172a', mb: 1 }}>Pegado inteligente de Licencia</Typography>
                  <TextField
                    fullWidth multiline minRows={3} maxRows={5}
                    value={runtCopiedText} onChange={(e) => setRuntCopiedText(e.target.value)}
                    placeholder="Pegue aquí el texto copiado del acordeón Licencias de Conducción en RUNT"
                  />
                  <Button variant="contained" size="small" sx={{ mt: 1.2, fontWeight: 900 }} onClick={extractCopiedRuntDriverResult} disabled={!runtCopiedText.trim()}>
                    Extraer Licencia y Categorías
                  </Button>
                </Paper>

                <Typography sx={{ fontWeight: 900, color: '#0f172a' }}>Datos de Licencia de Conducción</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>¿Tiene Licencia de Conducción?</InputLabel>
                    <Select label="¿Tiene Licencia de Conducción?" value={runtDriverForm.tiene_licencia} onChange={(e) => setRuntDriverForm((prev) => ({ ...prev, tiene_licencia: e.target.value }))}>
                      <MenuItem value="SI">Sí</MenuItem>
                      <MenuItem value="NO">No</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField label="Categoría(s) autorizadas" placeholder="Ej: A2, B1, C1" value={runtDriverForm.licencia_categorias} onChange={(e) => setRuntDriverForm((prev) => ({ ...prev, licencia_categorias: e.target.value }))} size="small" />
                  <TextField label="Fecha de expedición" type="date" value={runtDriverForm.licencia_expedicion} onChange={(e) => setRuntDriverForm((prev) => ({ ...prev, licencia_expedicion: e.target.value }))} InputLabelProps={{ shrink: true }} size="small" />
                  <TextField label="Fecha de vencimiento" type="date" value={runtDriverForm.licencia_vencimiento} onChange={(e) => setRuntDriverForm((prev) => ({ ...prev, licencia_vencimiento: e.target.value }))} InputLabelProps={{ shrink: true }} size="small" />
                </Box>

                {runtDriverForm.tiene_licencia === 'SI' && runtDriverForm.licencia_categorias && runtValidation.row?.tipo_vehiculo && (() => {
                  const compat = checkLicenseVehicleCompatibility(runtDriverForm.licencia_categorias, runtValidation.row.tipo_vehiculo);
                  if (!compat.compatible) {
                    return (
                      <Alert severity="error" sx={{ fontWeight: 800 }}>
                        🚨 <strong>Incompatibilidad Detectada:</strong> {compat.reason}
                      </Alert>
                    );
                  }
                  return (
                    <Alert severity="success" sx={{ fontWeight: 800 }}>
                      ✅ <strong>Licencia Compatible:</strong> Las categorías autorizadas ({runtDriverForm.licencia_categorias}) cumplen con el tipo de vehículo ({runtValidation.row.tipo_vehiculo}).
                    </Alert>
                  );
                })()}
              </Stack>
            ) : (
              <>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center" justifyContent="space-between">
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Chip label={`Placa: ${runtValidation.placaConsulta || ''}`} color="primary" sx={{ fontWeight: 800 }} />
                    <Chip label={`${runtValidation.usaDocumentoPropietario ? 'Doc. Propietario' : 'Doc. Conductor'}: ${runtValidation.documentoConsulta || ''}`} sx={{ fontWeight: 800 }} />
                  </Stack>
                  <Button size="small" variant="outlined" sx={{ fontWeight: 800 }} onClick={() => window.open(runtValidation.runtUrl, '_blank', 'noopener,noreferrer')}>
                    Abrir RUNT por Placa
                  </Button>
                </Stack>
                {runtValidation.estado !== 'CAPTURADA' && (
                  <Stack spacing={1.5}>
                    <Paper variant="outlined" sx={{ p: 1.8, borderRadius: 2.5, borderColor: '#67e8f9', bgcolor: '#ecfeff' }}>
                      <Typography sx={{ fontWeight: 900, color: '#0f172a', mb: 1 }}>Pegado inteligente del resultado RUNT</Typography>
                      <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        maxRows={5}
                        value={runtCopiedText}
                        onChange={(e) => setRuntCopiedText(e.target.value)}
                        placeholder="Pegue aquí el texto copiado de RUNT por placa"
                        inputProps={{ 'aria-label': 'Resultado copiado de RUNT' }}
                      />
                      <Button variant="contained" size="small" sx={{ mt: 1.2, fontWeight: 900 }} onClick={extractCopiedRuntResult} disabled={!runtCopiedText.trim()}>
                        Extraer SOAT y RTM
                      </Button>
                    </Paper>
                    <Typography sx={{ fontWeight: 900, color: '#0f172a' }}>Fechas extraídas o confirmación manual</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                      <TextField required label="Fecha final del SOAT" type="date" value={runtForm.soat_fecha_fin} onChange={(e) => setRuntForm((prev) => ({ ...prev, soat_fecha_fin: e.target.value }))} InputLabelProps={{ shrink: true }} />
                      <FormControl><InputLabel id="rtm-aplica-label">Situación de la RTM</InputLabel><Select labelId="rtm-aplica-label" label="Situación de la RTM" value={runtForm.rtm_aplica} onChange={(e) => setRuntForm((prev) => ({ ...prev, rtm_aplica: e.target.value, rtm_fecha_vigencia: e.target.value === 'SI' ? prev.rtm_fecha_vigencia : '' }))}><MenuItem value="SI">RTM registrada en RUNT</MenuItem><MenuItem value="NO_EXIGIBLE">RTM no exigible a la fecha</MenuItem><MenuItem value="SIN_REGISTRO_RUNT">Sin RTM registrada en RUNT</MenuItem><MenuItem value="NO_APLICA">Exento de RTM por disposición aplicable</MenuItem></Select></FormControl>
                      {runtForm.rtm_aplica === 'SI' && <TextField required label="Vigencia tecnomecánica" type="date" value={runtForm.rtm_fecha_vigencia} onChange={(e) => setRuntForm((prev) => ({ ...prev, rtm_fecha_vigencia: e.target.value }))} InputLabelProps={{ shrink: true }} />}
                    </Box>
                    {runtForm.rtm_aplica === 'NO_EXIGIBLE' && <Alert severity="success"><strong>RTM no exigible a la fecha · Modelo {runtForm.vehiculo_modelo || 'sin identificar'}.</strong> Matrícula inicial: {runtForm.vehiculo_fecha_matricula ? formatDate(runtForm.vehiculo_fecha_matricula) : 'sin fecha'} · Fecha estimada de primera exigibilidad: {runtForm.rtm_fecha_exigibilidad ? formatDate(runtForm.rtm_fecha_exigibilidad) : 'por verificar'}.</Alert>}
                    {runtForm.rtm_aplica === 'SIN_REGISTRO_RUNT' && <Alert severity="warning"><strong>RUNT no registra una RTM.</strong> El registro quedará marcado para revisión.</Alert>}
                  </Stack>
                )}
                {runtValidation.estado === 'CAPTURADA' && (() => {
                  const captured = runtValidation.data?.resultado || {};
                  const comparison = captured.comparacion_actualizacion || {};
                  const rtmStatusLabel = captured.rtm?.estado === 'NO_EXIGIBLE'
                    ? `RTM no exigible a la fecha · Modelo ${captured.vehiculo?.modelo || 'sin identificar'}`
                    : { VIGENTE: 'Vigente', VENCIDO: 'Vencida', SIN_REGISTRO_RUNT: 'Sin registro en RUNT', NO_APLICA: 'No aplica' }[captured.rtm?.estado] || captured.rtm?.estado || 'Sin información';
                  const comparisons = [
                    ['Estado SOAT', runtValidation.row?.soat_estado?.label || 'Importado / sin verificar', captured.soat?.estado || 'Sin información'],
                    ['Fin de vigencia SOAT', runtValidation.row?.soat_vigencia ? formatDate(runtValidation.row.soat_vigencia) : 'Sin fecha', captured.soat?.fecha_fin ? formatDate(captured.soat.fecha_fin) : 'Sin fecha'],
                    ['Póliza / entidad', runtValidation.row?.soat_numero_poliza || 'Sin información', [captured.soat?.numero_poliza, captured.soat?.entidad].filter(Boolean).join(' · ') || 'Sin información'],
                    ['Estado RTM', runtValidation.row?.tecnomecanica_estado?.label || 'Importado / sin verificar', rtmStatusLabel],
                    ['Vigencia / primera exigibilidad RTM', runtValidation.row?.tecnomecanica_vigencia ? formatDate(runtValidation.row.tecnomecanica_vigencia) : 'Sin fecha', captured.rtm?.fecha_vigencia ? formatDate(captured.rtm.fecha_vigencia) : captured.vehiculo?.rtm_fecha_exigibilidad ? `Estimada: ${formatDate(captured.vehiculo.rtm_fecha_exigibilidad)}` : 'Sin fecha'],
                    ['Certificado / CDA', runtValidation.row?.rtm_numero_certificado || 'Sin información', [captured.rtm?.numero_certificado, captured.rtm?.cda].filter(Boolean).join(' · ') || 'Sin información']
                  ];
                  return <Stack spacing={1.5}>
                    <Alert severity={comparison.detectada ? 'success' : 'warning'}>
                      <strong>{comparison.detectada ? 'RUNT confirma una actualización.' : 'RUNT aún no refleja una nueva vigencia.'}</strong>{' '}
                      {comparison.mensaje || (comparison.detectada ? 'Puede confirmar los cambios.' : 'Realice una nueva consulta cuando la renovación aparezca registrada en RUNT.')}
                    </Alert>
                    <TableContainer component={Paper} variant="outlined"><Table size="small"><TableHead><TableRow><TableCell sx={{ fontWeight: 900 }}>Campo</TableCell><TableCell sx={{ fontWeight: 900 }}>SIAC actual</TableCell><TableCell sx={{ fontWeight: 900, color: '#166534' }}>Resultado RUNT</TableCell></TableRow></TableHead><TableBody>{comparisons.map(([field, current, next]) => <TableRow key={field}><TableCell sx={{ fontWeight: 800 }}>{field}</TableCell><TableCell>{current}</TableCell><TableCell sx={{ bgcolor: current !== next ? '#f0fdf4' : undefined, fontWeight: current !== next ? 800 : 400 }}>{next}</TableCell></TableRow>)}</TableBody></Table></TableContainer>
                  </Stack>;
                })()}
                {runtValidation.estado === 'CONFIRMADA' && <Alert severity="success"><strong>Información actualizada en SIAC.</strong> Revise el resultado y, si lo considera pertinente, envíe manualmente la confirmación a la persona.</Alert>}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRuntValidation({ open: false, row: null, sessionId: null, estado: '', data: null, loading: false })} disabled={runtValidation.loading || notifyingRuntUpdate}>Cerrar</Button>
          {runtValidationMode === 'driver' ? (
            <Button variant="contained" color="success" onClick={confirmRuntDriverValidation} disabled={runtValidation.loading}>
              {runtValidation.loading ? 'Guardando…' : 'Confirmar y Guardar Licencia'}
            </Button>
          ) : (
            <>
              {!['CAPTURADA', 'CONFIRMADA'].includes(runtValidation.estado) && <Button variant="contained" onClick={captureManualRunt} disabled={runtValidation.loading}>{runtValidation.loading ? 'Cargando…' : 'Cargar fechas consultadas'}</Button>}
              {runtValidation.estado === 'CAPTURADA' && <Button variant="contained" color="success" onClick={confirmRuntValidation} disabled={!runtUpdateDetected || runtValidation.loading}>{runtValidation.loading ? 'Confirmando…' : 'Confirmar actualización'}</Button>}
              {runtValidation.estado === 'CONFIRMADA' && <Button variant="contained" onClick={notifyRuntUpdate} disabled={notifyingRuntUpdate || runtValidation.confirmationSent}>{notifyingRuntUpdate ? 'Enviando…' : runtValidation.confirmationSent ? 'Confirmación enviada' : 'Notificar actualización'}</Button>}
            </>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={history.open} onClose={() => setHistory({ open: false, row: null, loading: false, data: [] })} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 900 }}>Historial de validaciones RUNT · {history.row?.placa || 'Vehículo'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="info">Aquí se conservan las consultas RUNT que fueron confirmadas en SIAC. Los cambios realizados manualmente desde Editar no crean una consulta en este historial.</Alert>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, bgcolor: '#f8fbff', borderColor: '#bfdbfe' }}>
              <Typography sx={{ mb: 1.2, fontWeight: 900, color: '#173b72' }}>Estado documental actual</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1 }}>
                {[
                  ['Vehículo', [history.row?.tipo_vehiculo, history.row?.vehiculo_modelo && `Modelo ${history.row.vehiculo_modelo}`].filter(Boolean).join(' · ') || 'Sin información'],
                  ['SOAT', `${history.row?.soat_estado?.label || 'Sin clasificar'}${history.row?.soat_vigencia ? ` · ${formatDate(history.row.soat_vigencia)}` : ''}`],
                  ['RTM', `${history.row?.tecnomecanica_estado?.label || 'Sin clasificar'}${history.row?.tecnomecanica_vigencia ? ` · ${formatDate(history.row.tecnomecanica_vigencia)}` : history.row?.rtm_fecha_exigibilidad ? ` · Exigible desde ${formatDate(history.row.rtm_fecha_exigibilidad)}` : ''}`],
                  ['Última validación RUNT', formatDateTime(history.row?.ultima_consulta_runt)]
                ].map(([label, value]) => <Box key={label} sx={{ p: 1.2, borderRadius: 2, bgcolor: '#fff', border: '1px solid #dbeafe' }}><Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontWeight: 800 }}>{label}</Typography><Typography variant="body2" sx={{ mt: .35, fontWeight: 800, color: '#0f172a' }}>{value}</Typography></Box>)}
              </Box>
            </Paper>

            <Typography sx={{ fontWeight: 900 }}>Consultas RUNT confirmadas ({history.data.length})</Typography>
            {history.loading ? <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box> : history.data.length === 0 ? (
              <Alert severity="warning" action={<Button color="inherit" size="small" sx={{ fontWeight: 900, whiteSpace: 'nowrap' }} onClick={() => { const row = history.row; setHistory({ open: false, row: null, loading: false, data: [] }); startRuntValidation(row); }}>Validar ahora</Button>}>Aún no existen consultas RUNT confirmadas para este vehículo.</Alert>
            ) : <Stack spacing={1.2}>{history.data.map((item, index) => (
              <Paper key={item.id} variant="outlined" sx={{ p: 1.7, borderRadius: 2.5 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                  <Box><Typography sx={{ fontWeight: 900 }}>Validación {history.data.length - index} · {formatDateTime(item.confirmada_en)}</Typography><Typography variant="body2" color="text.secondary">Confirmó: {item.usuarioConfirma?.nombre || 'Usuario SIAC'}</Typography></Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap><Chip size="small" color={item.soat?.estado === 'VIGENTE' ? 'success' : 'default'} label={`SOAT: ${documentStatusLabel(item.soat?.estado)}`} /><Chip size="small" color={item.rtm?.estado === 'VIGENTE' || item.rtm?.estado === 'NO_EXIGIBLE' ? 'success' : 'default'} label={`RTM: ${documentStatusLabel(item.rtm?.estado)}`} /></Stack>
                </Stack>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: .7, mt: 1.4 }}>
                  <Typography variant="body2"><strong>SOAT hasta:</strong> {formatDate(item.soat?.fecha_fin)}</Typography>
                  <Typography variant="body2"><strong>Póliza / aseguradora:</strong> {[item.soat?.numero_poliza, item.soat?.entidad].filter(Boolean).join(' · ') || 'Sin información'}</Typography>
                  <Typography variant="body2"><strong>RTM hasta:</strong> {item.rtm?.fecha_vigencia ? formatDate(item.rtm.fecha_vigencia) : documentStatusLabel(item.rtm?.estado)}</Typography>
                  <Typography variant="body2"><strong>Certificado / CDA:</strong> {[item.rtm?.numero_certificado, item.rtm?.cda].filter(Boolean).join(' · ') || 'Sin información'}</Typography>
                </Box>
              </Paper>
            ))}</Stack>}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setHistory({ open: false, row: null, loading: false, data: [] })}>Cerrar</Button></DialogActions>
      </Dialog>

      {/* Modal Profesional de Confirmación Material-UI */}
      <Dialog
        open={confirmModal.open}
        onClose={closeConfirm}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3.5, p: 1, boxShadow: '0 20px 40px rgba(15,23,42,0.18)' }
        }}
      >
        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 900 }}>
          <Box
            sx={{
              display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: '50%',
              bgcolor: confirmModal.severity === 'error' ? '#fef2f2' : '#fffbeb',
              color: confirmModal.severity === 'error' ? '#dc2626' : '#d97706',
              flexShrink: 0
            }}
          >
            <WarningAmberRoundedIcon />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 900, color: '#0f172a', fontSize: 17, lineHeight: 1.25 }}>
            {confirmModal.title}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ py: 1 }}>
          <DialogContentText sx={{ color: '#475569', fontSize: 14, lineHeight: 1.5 }}>
            {confirmModal.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button onClick={closeConfirm} sx={{ color: '#64748b', fontWeight: 800, textTransform: 'none', borderRadius: 2 }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color={confirmModal.severity === 'error' ? 'error' : 'primary'}
            onClick={async () => {
              const action = confirmModal.onConfirm;
              closeConfirm();
              if (action) await action();
            }}
            sx={{ fontWeight: 800, textTransform: 'none', borderRadius: 2, px: 2.5 }}
          >
            {confirmModal.confirmText}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default ParqueaderosPesvPanel;
