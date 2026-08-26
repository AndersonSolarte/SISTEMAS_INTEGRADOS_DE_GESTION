import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, IconButton, InputAdornment, InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import FileUploadRoundedIcon from '@mui/icons-material/FileUploadRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import { useSnackbar } from 'notistack';
import gestionInformacionService from '../../services/gestionInformacionService';

const EMPTY_FORM = {
  identificacion: '', nombres_apellidos: '', correo: '', vinculacion: '', dependencia_programa: '',
  campus: '', parqueadero_ingreso: '', categoria_ingreso: '', tipo_vehiculo: '', placa: '',
  curso_pas: '', pago_validacion: '', soat_vigencia: '', soat_vigencia_texto: '', tecnomecanica_vigencia: '',
  tecnomecanica_vigencia_texto: '', horario: '', observaciones: '',
  vehiculo_fecha_matricula: '', vehiculo_clase: '', vehiculo_servicio: '', vehiculo_modelo: '',
  soat_fecha_expedicion: '', soat_fecha_inicio: '', soat_numero_poliza: '', soat_entidad: '',
  rtm_estado: '', rtm_fecha_expedicion: '', rtm_fecha_exigibilidad: '', rtm_numero_certificado: '', rtm_cda: ''
};
const FORM_DATE_FIELDS = new Set(['vehiculo_fecha_matricula', 'soat_fecha_expedicion', 'soat_fecha_inicio', 'soat_vigencia', 'rtm_fecha_expedicion', 'tecnomecanica_vigencia', 'rtm_fecha_exigibilidad']);
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
const formatDateTime = (value) => value ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Sin consultas confirmadas';
const documentStatusLabel = (value) => ({
  VIGENTE: 'Vigente', VENCIDO: 'Vencido', NO_EXIGIBLE: 'RTM no exigible a la fecha',
  SIN_REGISTRO_RUNT: 'Sin RTM registrada en RUNT', NO_APLICA: 'Exento de RTM'
}[value] || value || 'Sin información');
const normalizeRuntLine = (value = '') => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
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
const expiryLabel = (status) => status?.code === 'vencido'
  ? `${Math.abs(status.days)} días vencido`
  : status?.code === 'proximo' ? `${status.days} días restantes`
    : status?.code === 'vigente' && Number.isFinite(status.days) ? `Vigente · ${status.days} días` : status?.label || 'Sin fecha';

function ExpiryCell({ type, date, rawText, status, row, onNotify, notifying }) {
  const style = STATUS_STYLE[status?.code] || STATUS_STYLE.sin_fecha;
  return (
    <Stack spacing={.65} alignItems="flex-start">
      <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }}>
        {date ? formatDate(date) : rawText || 'Sin información'}
      </Typography>
      <Chip
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
        label={expiryLabel(status)}
        sx={{ height: 23, color: style.color, bgcolor: style.bgcolor, border: `1px solid ${style.border}`, fontWeight: 800, fontSize: 11 }}
      />
      {date && status?.code !== 'vigente' && (
        <Button size="small" startIcon={notifying ? <CircularProgress size={13} /> : <EmailRoundedIcon />} disabled={notifying || !row.correo} onClick={() => onNotify(row, type)} sx={{ p: 0, minWidth: 0, textTransform: 'none', fontWeight: 800, fontSize: 11.5 }}>
          Notificar
        </Button>
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
  const [importResult, setImportResult] = useState(null);
  const [notifying, setNotifying] = useState('');
  const [runtValidation, setRuntValidation] = useState({ open: false, row: null, sessionId: null, estado: '', data: null, loading: false });
  const [runtForm, setRuntForm] = useState(EMPTY_RUNT_FORM);
  const [runtCopiedText, setRuntCopiedText] = useState('');
  const [history, setHistory] = useState({ open: false, row: null, loading: false, data: [] });
  const [lookingUpPerson, setLookingUpPerson] = useState(false);
  const loadRequestRef = useRef(0);

  const handleLookupPersona = async (identificacionValue) => {
    const query = String(identificacionValue || form.identificacion || '').trim();
    if (!query || query.length < 3) return;
    setLookingUpPerson(true);
    try {
      const res = await gestionInformacionService.lookupPesvPersona(query);
      if (res?.found && res?.data) {
        setForm((prev) => ({
          ...prev,
          identificacion: res.data.identificacion || query,
          nombres_apellidos: res.data.nombres_apellidos || prev.nombres_apellidos,
          correo: res.data.correo || prev.correo,
          vinculacion: res.data.vinculacion || prev.vinculacion,
          dependencia_programa: res.data.dependencia_programa || prev.dependencia_programa,
          campus: res.data.campus || prev.campus
        }));
        enqueueSnackbar(`Datos de ${res.data.nombres_apellidos} autocompletados desde ${res.source}`, { variant: 'success' });
      } else {
        enqueueSnackbar('No se encontraron datos de esta cédula en el sistema. Puede digitar los campos manualmente.', { variant: 'info' });
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
        result = await gestionInformacionService.getPesvParqueaderos({ search, campus, estado, indicador: indicator });
      } catch (firstError) {
        const transient = !firstError.response || Number(firstError.response?.status) >= 500;
        if (!transient || requestId !== loadRequestRef.current) throw firstError;
        await new Promise((resolve) => setTimeout(resolve, 350));
        if (requestId !== loadRequestRef.current) return;
        result = await gestionInformacionService.getPesvParqueaderos({ search, campus, estado, indicador: indicator });
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
  }, [campus, enqueueSnackbar, estado, indicator, search]);

  useEffect(() => { const timer = setTimeout(load, 450); return () => clearTimeout(timer); }, [load]);
  const visibleRows = useMemo(() => rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), [page, rows, rowsPerPage]);
  const openCreate = () => { setForm(EMPTY_FORM); setDialog({ open: true, row: null }); };
  const openEdit = (row) => {
    setForm(Object.keys(EMPTY_FORM).reduce((acc, key) => ({ ...acc, [key]: row[key] || '' }), {}));
    setDialog({ open: true, row });
  };
  const updateField = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const save = async () => {
    if (!form.nombres_apellidos.trim()) return enqueueSnackbar('Los nombres y apellidos son obligatorios', { variant: 'warning' });
    setSaving(true);
    try {
      const result = dialog.row
        ? await gestionInformacionService.updatePesvParqueadero(dialog.row.id, form)
        : await gestionInformacionService.createPesvParqueadero(form);
      if (result.data) {
        setRows((current) => dialog.row
          ? current.map((row) => row.id === dialog.row.id ? result.data : row)
          : [result.data, ...current]);
      }
      enqueueSnackbar(dialog.row ? 'Información actualizada correctamente' : 'Registro creado correctamente', { variant: 'success' });
      setDialog({ open: false, row: null });
      await load();
    } catch (error) {
      const message = !error.response ? 'El servidor no está disponible. Intente nuevamente en unos segundos.' : error.response?.data?.message || 'No se pudo guardar';
      enqueueSnackbar(message, { variant: 'error' });
    }
    finally { setSaving(false); }
  };
  const remove = async (row) => {
    if (!window.confirm(`¿Eliminar el cupo de ${row.nombres_apellidos}? Esta acción no se puede deshacer.`)) return;
    try { await gestionInformacionService.deletePesvParqueadero(row.id); enqueueSnackbar('Registro eliminado', { variant: 'success' }); await load(); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No se pudo eliminar', { variant: 'error' }); }
  };
  const importFile = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    if (!window.confirm('La importación reemplazará la base actual de Parqueaderos UNICESMAG. ¿Deseas continuar?')) return;
    setImporting(true); setImportResult(null);
    try { const result = await gestionInformacionService.importPesvParqueaderos(file, true); setImportResult(result.data); enqueueSnackbar(result.message, { variant: 'success' }); await load(); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No se pudo importar el Excel', { variant: 'error' }); }
    finally { setImporting(false); }
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
  const notify = async (row, tipo) => {
    const key = `${row.id}-${tipo}`; setNotifying(key);
    try { const result = await gestionInformacionService.notifyPesvExpiry(row.id, tipo); enqueueSnackbar(result.message, { variant: 'success' }); await load(); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No se pudo enviar la notificación', { variant: 'error' }); }
    finally { setNotifying(''); }
  };
  const startRuntValidation = async (row) => {
    if (!row.placa || !row.identificacion) return enqueueSnackbar('La validación RUNT requiere placa e identificación', { variant: 'warning' });
    const popup = window.open('', '_blank');
    try {
      const result = await gestionInformacionService.startPesvRuntValidation(row.id);
      const session = result.data;
      setRuntForm(EMPTY_RUNT_FORM);
      setRuntCopiedText('');
      setRuntValidation({ open: true, row, sessionId: session.id, runtUrl: session.runtUrl, estado: session.estado, data: null, loading: false });
      navigator.clipboard?.writeText(`Placa: ${row.placa}\nIdentificación: ${row.identificacion}`).catch(() => {});
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
  const extractCopiedRuntResult = () => {
    const parsed = parseRuntCopiedText(runtCopiedText);
    const expectedPlate = String(runtValidation.row?.placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
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
    if (runtForm.rtm_aplica === 'SI' && !runtForm.rtm_fecha_vigencia) return enqueueSnackbar('Copia la vigencia de la tecnomecánica o selecciona No aplica', { variant: 'warning' });
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
      const result = await gestionInformacionService.confirmPesvRuntValidation(runtValidation.sessionId);
      enqueueSnackbar(result.message, { variant: 'success' });
      setRuntValidation({ open: false, row: null, sessionId: null, estado: '', data: null, loading: false }); await load();
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No se pudo confirmar la validación', { variant: 'error' }); setRuntValidation((prev) => ({ ...prev, loading: false })); }
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

  const stats = [
    { key: '', label: 'Cupos registrados', value: summary.total || 0, color: '#1d4ed8', background: '#eff6ff', icon: <DirectionsCarRoundedIcon /> },
    { key: 'soat_vencido', label: 'SOAT vencidos', value: summary.soat_vencidos || 0, color: '#dc2626', background: '#fef2f2', icon: <WarningAmberRoundedIcon /> },
    { key: 'soat_proximo', label: 'SOAT próximos (30 días)', value: summary.soat_proximos || 0, color: '#d97706', background: '#fffbeb', icon: <EmailRoundedIcon /> },
    { key: 'rtm_vencido', label: 'Tecnomecánica vencidas', value: summary.tecnomecanica_vencidos || 0, color: '#be123c', background: '#fff1f2', icon: <WarningAmberRoundedIcon /> },
    { key: 'rtm_proximo', label: 'Tecnomecánica próximas (30 días)', value: summary.tecnomecanica_proximos || 0, color: '#7c3aed', background: '#f5f3ff', icon: <FactCheckRoundedIcon /> }
  ];
  const applyIndicatorFilter = (key) => {
    const next = key && indicator === key ? '' : key;
    setIndicator(next);
    setEstado('');
    setPage(0);
  };
  const formCatalogOptions = {
    vinculacion: catalogs.vinculaciones || [], dependencia_programa: catalogs.dependencias || [], campus: catalogs.campus || [],
    parqueadero_ingreso: catalogs.parqueaderos || [], categoria_ingreso: catalogs.categorias || [],
    curso_pas: catalogs.cursosPas || [], pago_validacion: catalogs.pagosValidacion || [],
    tipo_vehiculo: catalogs.tiposVehiculo || [], vehiculo_clase: catalogs.clasesVehiculo || [],
    vehiculo_servicio: catalogs.serviciosVehiculo || [], soat_entidad: catalogs.aseguradoras || [], rtm_cda: catalogs.centrosDiagnostico || []
  };
  const renderFormField = ([key, label]) => {
    if (key === 'identificacion') {
      return (
        <TextField
          key={key}
          label={label}
          value={form[key]}
          onChange={updateField(key)}
          onBlur={(e) => e.target.value.trim().length >= 3 && handleLookupPersona(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleLookupPersona(form.identificacion))}
          placeholder="Ej: 1085327166"
          helperText="Al digitar la cédula y presionar Enter o cambiar de campo, se autocompletarán los datos."
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
    const options = formCatalogOptions[key];
    if (options) return (
      <Autocomplete
        key={key} freeSolo autoHighlight options={options} value={form[key] || null} inputValue={form[key] || ''}
        onChange={(_, value) => setForm((prev) => ({ ...prev, [key]: value || '' }))}
        onInputChange={(_, value) => setForm((prev) => ({ ...prev, [key]: value || '' }))}
        renderInput={(params) => <TextField {...params} label={label} fullWidth size="small" />}
      />
    );
    return <TextField key={key} label={label} type={FORM_DATE_FIELDS.has(key) ? 'date' : 'text'} value={form[key]} onChange={updateField(key)} InputLabelProps={FORM_DATE_FIELDS.has(key) ? { shrink: true } : undefined} fullWidth size="small" />;
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.2}>
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={onBack} sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 800 }}>Volver a Seguridad Vial</Button>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button variant="outlined" startIcon={downloadingTemplate ? <CircularProgress size={16} /> : <FileDownloadRoundedIcon />} onClick={downloadExcelTemplate} disabled={downloadingTemplate} sx={{ textTransform: 'none', fontWeight: 800 }}>{downloadingTemplate ? 'Preparando…' : 'Descargar plantilla'}</Button>
          <Button component="label" variant="outlined" startIcon={importing ? <CircularProgress size={16} /> : <FileUploadRoundedIcon />} disabled={importing} sx={{ textTransform: 'none', fontWeight: 800 }}>Importar Excel<input hidden type="file" accept=".xlsx,.xls" onChange={importFile} /></Button>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate} sx={{ textTransform: 'none', fontWeight: 800 }}>Nuevo cupo</Button>
        </Stack>
      </Stack>
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3.5, color: '#fff', background: 'linear-gradient(135deg,#92400e,#d97706)' }}>
        <Stack direction="row" spacing={1.5} alignItems="center"><DirectionsCarRoundedIcon sx={{ fontSize: 38 }} /><Box><Typography variant="overline" sx={{ fontWeight: 900, opacity: .85 }}>PESV · Submódulo 01</Typography><Typography variant="h4" sx={{ fontWeight: 900 }}>Parqueaderos UNICESMAG</Typography><Typography sx={{ opacity: .88 }}>Gestión de cupos, vehículos y vigencias documentales.</Typography></Box></Stack>
      </Paper>
      {importResult?.warningCount > 0 && <Alert severity="warning">Se importaron {importResult.imported} registros con {importResult.warningCount} advertencias de datos. Las vigencias no reconocibles quedaron marcadas como “Sin fecha verificable”.</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3,1fr)', lg: 'repeat(5,1fr)' }, gap: 1.4 }}>
        {stats.map((item) => {
          const selected = indicator === item.key && (item.key !== '' || (!indicator && !estado));
          return <Paper
            key={item.label} component="button" type="button" aria-pressed={selected} onClick={() => applyIndicatorFilter(item.key)}
            elevation={0}
            sx={{
              position: 'relative', overflow: 'hidden', width: '100%', p: 2, borderRadius: 3, textAlign: 'left', font: 'inherit', cursor: 'pointer',
              color: item.color, bgcolor: selected ? item.background : '#fff', border: `2px solid ${selected ? item.color : '#e2e8f0'}`,
              boxShadow: selected ? `0 12px 26px ${item.color}2b` : '0 4px 12px rgba(15,23,42,.04)',
              transform: selected ? 'translateY(-3px)' : 'none', transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease, background-color .18s ease',
              '&:hover': { transform: 'translateY(-4px)', borderColor: item.color, boxShadow: `0 14px 28px ${item.color}30` },
              '&:focus-visible': { outline: `3px solid ${item.color}55`, outlineOffset: 2 },
              '&::after': { content: '""', position: 'absolute', right: -22, bottom: -30, width: 105, height: 105, borderRadius: '50%', bgcolor: `${item.color}12` }
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ position: 'relative', zIndex: 1 }}>
              <Box><Typography variant="caption" sx={{ display: 'block', color: selected ? item.color : '#64748b', fontWeight: 900 }}>{item.label}</Typography><Typography sx={{ mt: .65, fontSize: 30, lineHeight: 1, fontWeight: 900, color: '#0f172a' }}>{item.value.toLocaleString('es-CO')}</Typography></Box>
              <Box sx={{ display: 'grid', placeItems: 'center', width: 42, height: 42, flexShrink: 0, borderRadius: 2.2, color: '#fff', bgcolor: item.color, boxShadow: `0 7px 16px ${item.color}38` }}>{item.icon}</Box>
            </Stack>
          </Paper>;
        })}
      </Box>
      <Paper elevation={0} sx={{ p: 1.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
          <Box sx={{ flex: 1 }}>
            <TextField
              fullWidth size="small" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en todos los campos"
              autoComplete="off"
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ color: '#64748b' }} /></InputAdornment>,
                endAdornment: search ? <InputAdornment position="end"><IconButton size="small" aria-label="Limpiar búsqueda" onClick={() => setSearch('')}><ClearRoundedIcon fontSize="small" /></IconButton></InputAdornment> : null
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
      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflowX: 'auto' }}>
        <Table size="small" sx={{ width: '100%', minWidth: 1040, tableLayout: 'fixed', '& .MuiTableCell-head': { px: 1.1, py: 1.25, fontSize: 11.5, lineHeight: 1.2 }, '& .MuiTableCell-body': { px: 1.1, py: 1.15, fontSize: 12.5, verticalAlign: 'top', overflowWrap: 'anywhere' }, '& .MuiTypography-body2': { fontSize: 12.5, lineHeight: 1.3 }, '& .MuiTypography-caption': { fontSize: 10.8, lineHeight: 1.35 }, '& .MuiChip-root': { height: 22, fontSize: 10.5 } }}>
          <colgroup><col style={{ width: '18%' }} /><col style={{ width: '19%' }} /><col style={{ width: '11%' }} /><col style={{ width: '13%' }} /><col style={{ width: '11.5%' }} /><col style={{ width: '15%' }} /><col style={{ width: '12.5%' }} /></colgroup>
          <TableHead><TableRow sx={{ bgcolor: '#eaf2ff', borderBottom: '2px solid #2563eb' }}>{['Persona / identificación', 'Contacto', 'Parqueadero', 'Vehículo / placa', 'SOAT', 'Tecnomecánica'].map((label) => <TableCell key={label} sx={{ color: '#173b72', fontWeight: 900, borderBottom: 0 }}>{label}</TableCell>)}<TableCell align="center" sx={{ color: '#173b72', fontWeight: 900, borderBottom: 0 }}>Acciones</TableCell></TableRow></TableHead>
          <TableBody>{loading ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 7 }}><CircularProgress /></TableCell></TableRow> : visibleRows.length === 0 ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 7 }}><WarningAmberRoundedIcon sx={{ color: '#d97706' }} /><Typography sx={{ fontWeight: 800, color: '#64748b' }}>No hay registros para los filtros seleccionados</Typography></TableCell></TableRow> : visibleRows.map((row, rowIndex) => {
            const critical = row.soat_estado?.code === 'vencido' || row.tecnomecanica_estado?.code === 'vencido';
            return <TableRow key={row.id} sx={{ bgcolor: critical ? '#fff7f7' : rowIndex % 2 ? '#f8fbff' : '#fff', '&:hover': { bgcolor: critical ? '#feecec' : '#eef5ff' }, '& td': { borderBottomColor: '#e5edf7' } }}>
              <TableCell><Typography variant="body2" sx={{ fontWeight: 900 }}>{row.nombres_apellidos}</Typography><Typography variant="caption" color="text.secondary">{row.identificacion ? `CC ${row.identificacion}` : 'Sin identificación'} · {row.dependencia_programa || 'Sin dependencia'}</Typography></TableCell>
              <TableCell><Typography variant="body2">{row.correo || 'Sin correo'}</Typography><Typography variant="caption" color="text.secondary">{row.vinculacion || 'Sin vinculación'}</Typography></TableCell>
              <TableCell><Typography variant="body2" sx={{ fontWeight: 800 }}>{row.parqueadero_ingreso || 'Sin asignar'}</Typography><Typography variant="caption" color="text.secondary">{row.campus || 'Sin campus'} · {row.categoria_ingreso || 'Sin categoría'}</Typography></TableCell>
              <TableCell><Chip label={row.placa || 'SIN PLACA'} size="small" sx={{ fontWeight: 900, bgcolor: '#e0e7ff', color: '#3730a3' }} /><Typography variant="caption" sx={{ display: 'block', mt: .5 }}>{row.tipo_vehiculo || 'Sin tipo'}</Typography></TableCell>
              <TableCell><ExpiryCell type="soat" date={row.soat_vigencia} rawText={row.soat_vigencia_texto} status={row.soat_estado} row={row} onNotify={notify} notifying={notifying === `${row.id}-soat`} /></TableCell>
              <TableCell><ExpiryCell type="tecnomecanica" date={row.tecnomecanica_vigencia} rawText={row.tecnomecanica_vigencia_texto} status={row.tecnomecanica_estado} row={row} onNotify={notify} notifying={notifying === `${row.id}-tecnomecanica`} /></TableCell>
              <TableCell align="center">
                <Box sx={{ display: 'inline-grid', gridTemplateColumns: 'repeat(2, auto)', gap: 0.6, justifyItems: 'center', alignItems: 'center' }}>
                  <Tooltip title="Validar SOAT y RTM en RUNT" arrow placement="top">
                    <span>
                      <IconButton size="small" onClick={() => startRuntValidation(row)} disabled={!row.placa || !row.identificacion} sx={{ color: '#d97706', bgcolor: '#fffbeb', border: '1px solid #fde68a', p: 0.55, '&:hover': { bgcolor: '#fef3c7' }, '&.Mui-disabled': { bgcolor: '#f1f5f9', color: '#cbd5e1', borderColor: '#e2e8f0' } }}>
                        <FactCheckRoundedIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Ver historial de consultas RUNT" arrow placement="top">
                    <IconButton size="small" onClick={() => openHistory(row)} sx={{ color: '#2563eb', bgcolor: '#eff6ff', border: '1px solid #bfdbfe', p: 0.55, '&:hover': { bgcolor: '#dbeafe' } }}>
                      <HistoryRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Editar cupo de parqueadero" arrow placement="bottom">
                    <IconButton size="small" onClick={() => openEdit(row)} sx={{ color: '#475569', bgcolor: '#f8fafc', border: '1px solid #cbd5e1', p: 0.55, '&:hover': { bgcolor: '#f1f5f9', color: '#0f172a' } }}>
                      <EditRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Eliminar registro" arrow placement="bottom">
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
          <Typography sx={{ gridColumn: { sm: '1 / -1' }, fontWeight: 900, color: '#1e3a8a' }}>Persona y asignación del cupo</Typography>
          {[
            ['identificacion', 'Identificación'], ['nombres_apellidos', 'Nombres y apellidos *'], ['correo', 'Correo electrónico'], ['vinculacion', 'Vinculación'], ['dependencia_programa', 'Dependencia o programa'], ['campus', 'Campus'], ['parqueadero_ingreso', 'Parqueadero de ingreso'], ['categoria_ingreso', 'Categoría de ingreso'], ['curso_pas', 'Curso PAS'], ['pago_validacion', 'Pago / validación'], ['horario', 'Horario']
          ].map(renderFormField)}

          <Typography sx={{ gridColumn: { sm: '1 / -1' }, mt: 1, fontWeight: 900, color: '#1e3a8a' }}>Información del vehículo</Typography>
          {[
            ['tipo_vehiculo', 'Tipo de vehículo institucional'], ['placa', 'Placa'], ['vehiculo_clase', 'Clase del vehículo (RUNT)'], ['vehiculo_servicio', 'Tipo de servicio (RUNT)'], ['vehiculo_modelo', 'Modelo'], ['vehiculo_fecha_matricula', 'Fecha inicial de matrícula']
          ].map(renderFormField)}

          <Typography sx={{ gridColumn: { sm: '1 / -1' }, mt: 1, fontWeight: 900, color: '#1e3a8a' }}>Seguro obligatorio — SOAT</Typography>
          {[
            ['soat_fecha_expedicion', 'Fecha de expedición'], ['soat_fecha_inicio', 'Inicio de vigencia'], ['soat_vigencia', 'Fin de vigencia'], ['soat_numero_poliza', 'Número de póliza'], ['soat_entidad', 'Entidad aseguradora']
          ].map(renderFormField)}

          <Typography sx={{ gridColumn: { sm: '1 / -1' }, mt: 1, fontWeight: 900, color: '#1e3a8a' }}>Revisión técnico-mecánica — RTM</Typography>
          <FormControl size="small" fullWidth><InputLabel>Estado de la RTM</InputLabel><Select label="Estado de la RTM" value={form.rtm_estado} onChange={updateField('rtm_estado')}><MenuItem value="">Sin clasificar</MenuItem><MenuItem value="VIGENTE">Vigente</MenuItem><MenuItem value="VENCIDO">Vencida</MenuItem><MenuItem value="NO_EXIGIBLE">RTM no exigible a la fecha</MenuItem><MenuItem value="SIN_REGISTRO_RUNT">Sin RTM registrada en RUNT</MenuItem><MenuItem value="NO_APLICA">Exento por disposición aplicable</MenuItem></Select></FormControl>
          {[
            ['rtm_fecha_expedicion', 'Fecha de expedición RTM'], ['tecnomecanica_vigencia', 'Fin de vigencia RTM'], ['rtm_fecha_exigibilidad', 'Primera fecha de exigibilidad'], ['rtm_numero_certificado', 'Número de certificado'], ['rtm_cda', 'Centro de Diagnóstico Automotor (CDA)']
          ].map(renderFormField)}

          <TextField label="Observaciones" value={form.observaciones} onChange={updateField('observaciones')} multiline minRows={3} fullWidth sx={{ gridColumn: { sm: '1 / -1' } }} />
        </Box></DialogContent>
        <DialogActions><Button onClick={() => setDialog({ open: false, row: null })} disabled={saving}>Cancelar</Button><Button variant="contained" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button></DialogActions>
      </Dialog>

      <Dialog open={runtValidation.open} onClose={() => !runtValidation.loading && setRuntValidation({ open: false, row: null, sessionId: null, estado: '', data: null, loading: false })} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 900 }}>Validación RUNT · {runtValidation.row?.placa}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity={runtValidation.estado === 'CAPTURADA' ? 'success' : runtValidation.estado === 'ERROR' ? 'error' : 'info'}>
              {runtValidation.estado === 'CAPTURADA'
                ? 'Resultado recibido. Compare la información antes de confirmarla.'
                : runtValidation.estado === 'ERROR'
                  ? 'La sesión presentó un error. Cierre esta ventana e intente nuevamente.'
                  : 'Consulte el vehículo en RUNT, complete personalmente el CAPTCHA y pegue aquí el resultado. SIAC identificará el SOAT y la RTM vigentes. No necesita instalar ni pagar nada.'}
            </Alert>
            <Stack direction="row" spacing={1} flexWrap="wrap"><Chip label={`Estado: ${runtValidation.estado === 'CAPTURADA' ? 'LISTO PARA REVISAR' : 'ESPERANDO FECHAS'}`} color={runtValidation.estado === 'CAPTURADA' ? 'success' : 'info'} /><Chip label={`Placa: ${runtValidation.row?.placa || ''}`} /><Chip label={`Documento: ${runtValidation.row?.identificacion || ''}`} /></Stack>
            {runtValidation.estado !== 'CAPTURADA' && (
              <Stack spacing={1.5}>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.5, bgcolor: '#f8fafc' }}><Typography sx={{ fontWeight: 900, color: '#0f172a' }}>1. Realice la consulta pública</Typography><Typography variant="body2" color="text.secondary">Use la placa y el documento mostrados arriba, resuelva el CAPTCHA y abra los acordeones de SOAT y tecnomecánica.</Typography><Button size="small" sx={{ mt: 1, fontWeight: 800 }} onClick={() => window.open(runtValidation.runtUrl, '_blank', 'noopener,noreferrer')}>Abrir RUNT nuevamente</Button></Paper>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.5, borderColor: '#67e8f9', bgcolor: '#ecfeff' }}>
                  <Typography sx={{ fontWeight: 900, color: '#0f172a' }}>2. Pegado inteligente del resultado</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.2 }}>
                    En RUNT expanda «Póliza SOAT» y «Certificado de revisión técnico-mecánica», copie el contenido de la página y péguelo aquí.
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    maxRows={7}
                    value={runtCopiedText}
                    onChange={(e) => setRuntCopiedText(e.target.value)}
                    placeholder="Pegue aquí el texto completo copiado de RUNT"
                    inputProps={{ 'aria-label': 'Resultado copiado de RUNT' }}
                  />
                  <Button variant="contained" size="small" sx={{ mt: 1.2, fontWeight: 900 }} onClick={extractCopiedRuntResult} disabled={!runtCopiedText.trim()}>
                    Extraer SOAT y RTM
                  </Button>
                </Paper>
                <Typography sx={{ fontWeight: 900, color: '#0f172a' }}>3. Revise las fechas extraídas o ingréselas manualmente</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                  <TextField required label="Fecha final del SOAT" type="date" value={runtForm.soat_fecha_fin} onChange={(e) => setRuntForm((prev) => ({ ...prev, soat_fecha_fin: e.target.value }))} InputLabelProps={{ shrink: true }} helperText="Acordeón Póliza SOAT" />
                  <FormControl><InputLabel id="rtm-aplica-label">Situación de la RTM</InputLabel><Select labelId="rtm-aplica-label" label="Situación de la RTM" value={runtForm.rtm_aplica} onChange={(e) => setRuntForm((prev) => ({ ...prev, rtm_aplica: e.target.value, rtm_fecha_vigencia: e.target.value === 'SI' ? prev.rtm_fecha_vigencia : '' }))}><MenuItem value="SI">RTM registrada en RUNT</MenuItem><MenuItem value="NO_EXIGIBLE">RTM no exigible a la fecha</MenuItem><MenuItem value="SIN_REGISTRO_RUNT">Sin RTM registrada en RUNT</MenuItem><MenuItem value="NO_APLICA">Exento de RTM por disposición aplicable</MenuItem></Select></FormControl>
                  {runtForm.rtm_aplica === 'SI' && <TextField required label="Vigencia tecnomecánica" type="date" value={runtForm.rtm_fecha_vigencia} onChange={(e) => setRuntForm((prev) => ({ ...prev, rtm_fecha_vigencia: e.target.value }))} InputLabelProps={{ shrink: true }} helperText="Acordeón revisión técnico-mecánica" />}
                </Box>
                {runtForm.rtm_aplica === 'NO_EXIGIBLE' && <Alert severity="success"><strong>RTM no exigible a la fecha · Modelo {runtForm.vehiculo_modelo || 'sin identificar'}.</strong> Matrícula inicial: {runtForm.vehiculo_fecha_matricula ? formatDate(runtForm.vehiculo_fecha_matricula) : 'sin fecha'} · Fecha estimada de primera exigibilidad: {runtForm.rtm_fecha_exigibilidad ? formatDate(runtForm.rtm_fecha_exigibilidad) : 'por verificar'}. Resultado calculado con la información consultada en RUNT.</Alert>}
                {runtForm.rtm_aplica === 'SIN_REGISTRO_RUNT' && <Alert severity="warning"><strong>RUNT no registra una RTM.</strong> Esto no significa automáticamente que el vehículo esté exento. El registro quedará marcado para revisión.</Alert>}
              </Stack>
            )}
            {runtValidation.estado === 'CAPTURADA' && (() => {
              const captured = runtValidation.data?.resultado || {};
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
              return <TableContainer component={Paper} variant="outlined"><Table size="small"><TableHead><TableRow><TableCell sx={{ fontWeight: 900 }}>Campo</TableCell><TableCell sx={{ fontWeight: 900 }}>SIAC actual</TableCell><TableCell sx={{ fontWeight: 900, color: '#166534' }}>Resultado RUNT</TableCell></TableRow></TableHead><TableBody>{comparisons.map(([field, current, next]) => <TableRow key={field}><TableCell sx={{ fontWeight: 800 }}>{field}</TableCell><TableCell>{current}</TableCell><TableCell sx={{ bgcolor: current !== next ? '#f0fdf4' : undefined, fontWeight: current !== next ? 800 : 400 }}>{next}</TableCell></TableRow>)}</TableBody></Table></TableContainer>;
            })()}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setRuntValidation({ open: false, row: null, sessionId: null, estado: '', data: null, loading: false })} disabled={runtValidation.loading}>Cerrar</Button>{runtValidation.estado !== 'CAPTURADA' && <Button variant="contained" onClick={captureManualRunt} disabled={runtValidation.loading}>{runtValidation.loading ? 'Cargando…' : 'Cargar fechas consultadas'}</Button>}<Button variant="contained" color="success" onClick={confirmRuntValidation} disabled={runtValidation.estado !== 'CAPTURADA' || runtValidation.loading}>{runtValidation.loading ? 'Confirmando…' : 'Confirmar actualización'}</Button></DialogActions>
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
    </Stack>
  );
}

export default ParqueaderosPesvPanel;
