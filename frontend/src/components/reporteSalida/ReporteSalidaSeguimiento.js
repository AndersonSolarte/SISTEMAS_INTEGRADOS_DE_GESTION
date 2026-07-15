import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Fade,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  TablePagination,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ManageHistoryIcon from '@mui/icons-material/ManageHistory';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import BarChartIcon from '@mui/icons-material/BarChart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import reporteSalidaService from '../../services/reporteSalidaService';
import ReporteSalidaEstadisticas from './ReporteSalidaEstadisticas';

const ACCESS_COPY = {
  gestion_humana: {
    title: 'Reporte de salida',
    subtitle: 'Seguimiento de aprobaciones, notificaciones y reposicion de tiempo.',
    notice: 'Vista completa para Gestión del Talento Humano. Puedes validar reposiciones cuando el reporte este finalizado.'
  },
  jefe: {
    title: 'Reposiciones de mi equipo',
    subtitle: 'Colaboradores(as) a cargo con horas pendientes por reponer.',
    notice: 'Puedes consultar el saldo pendiente de tus colaboradores(as). La validación final la realiza Talento Humano.'
  },
  jefe_y_colaborador: {
    title: 'Reposiciones pendientes',
    subtitle: 'Tus pendientes y los pendientes de colaboradores(as) a cargo.',
    notice: 'Consulta los saldos pendientes. Talento Humano descuenta horas unicamente cuando valida la reposicion.'
  },
  colaborador: {
    title: 'Mis reposiciones pendientes',
    subtitle: 'Consulta tus horas pendientes por reponer y el estado de validacion.',
    notice: 'Esta vista es solo informativa. No permite modificar, aprobar ni validar solicitudes.'
  },
  sin_pendientes: {
    title: 'Seguimiento a reportes',
    subtitle: 'No tienes reposiciones pendientes por gestionar.',
    notice: 'Cuando exista una reposicion pendiente, el modulo aparecera automaticamente.'
  }
};

const STATUS_LABELS = {
  pendiente_aprobacion_jefe: 'Pendiente Jefe',
  pendiente_aprobacion_gestion_humana: 'Pendiente Talento Humano',
  pendiente_aprobacion_sst: 'Pendiente SST',
  finalizada: 'Aprobada',
  no_aprobada: 'No Aprobada'
};

const STATUS_COLORS = {
  pendiente_aprobacion_jefe: { bg: '#fef3c7', color: '#92400e' },
  pendiente_aprobacion_gestion_humana: { bg: '#ede9fe', color: '#6d28d9' },
  pendiente_aprobacion_sst: { bg: '#e0f2fe', color: '#0369a1' },
  finalizada: { bg: '#dcfce7', color: '#166534' },
  no_aprobada: { bg: '#fee2e2', color: '#991b1b' },
  aprobada_jefe: { bg: '#dbeafe', color: '#1d4ed8' },
  aprobada_gestion_humana: { bg: '#dcfce7', color: '#166534' }
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
};

const minutesBetween = (start, end) => {
  if (!start || !end) return null;
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return null;
  return Math.round((b.getTime() - a.getTime()) / 60000);
};

const formatElapsed = (minutes) => {
  const total = Number(minutes);
  if (!Number.isFinite(total) || total <= 0) return '0h';
  const hours = total / 60;
  const formatted = Number(hours.toFixed(1));
  return `${formatted}h`;
};

const getHorasPendientes = (row) => {
  if (!row) return '0 hrs';
  const totalMinutos = row.reposicion_minutos || row.tiempo_solicitado_minutos || 0;
  const minutosPagados = row.reposicion_minutos_pagados || row.datos_formulario?.reposicion_minutos_pagados || 0;
  const pendientes = totalMinutos - minutosPagados;
  return pendientes > 0 ? (pendientes / 60).toFixed(1) + ' hrs' : '0 hrs';
};

const getReposicionText = (row) => {
  const totalMinutos = row.reposicion_minutos || row.tiempo_solicitado_minutos || 0;
  const minutosPagados = row.reposicion_minutos_pagados || row.datos_formulario?.reposicion_minutos_pagados || 0;
  const pendientes = totalMinutos - minutosPagados;
  
  if (pendientes <= 0) return 'Completado';
  if (minutosPagados === 0) return `Debe ${formatElapsed(totalMinutos)}`;
  return `Abonó ${formatElapsed(minutosPagados)} - Debe ${formatElapsed(pendientes)}`;
};

const getJefeObservacion = (row) => {
  if (!row || !Array.isArray(row.trazabilidad)) return null;
  const trace = row.trazabilidad.find(t => 
    (t.event === 'no_aprobada' || t.event === 'aprobada_jefe') && 
    (t.detail?.justificacion || t.detail?.observacion)
  );
  return trace?.detail?.justificacion || trace?.detail?.observacion || null;
};

const mapReposicionEstado = (est) => {
  const norm = String(est || '').toLowerCase();
  if (norm === 'cumplida') return 'Cumplida';
  return 'Pendiente';
};

const getReposicionChipColors = (est) => {
  const norm = String(est || '').toLowerCase();
  if (norm === 'cumplida') {
    return { bgcolor: '#d1fae5', color: '#065f46' };
  }
  return { bgcolor: '#fef3c7', color: '#92400e' };
};

const REPORT_MODULES = [
  {
    key: 'reporte_salida',
    label: 'Reporte de salida',
    description: 'Radicaciones FR-002, aprobaciones y reposicion de tiempo.',
    icon: AssignmentTurnedInIcon,
    available: true
  },
  {
    key: 'estadisticas',
    label: 'Indicadores de Ausentismo',
    description: 'Análisis detallado, frecuencia y métricas de control.',
    icon: BarChartIcon,
    available: true
  }
];

const parseLogLine = (line) => {
  let timestamp = '';
  let rest = line;
  if (line.startsWith('[')) {
    const endBracket = line.indexOf(']');
    if (endBracket !== -1) {
      timestamp = line.substring(1, endBracket);
      rest = line.substring(endBracket + 1).trim();
    }
  }
  
  const colonIndex = rest.indexOf(':');
  let actor = '';
  let actionAndComment = rest;
  if (colonIndex !== -1) {
    actor = rest.substring(0, colonIndex).trim();
    actionAndComment = rest.substring(colonIndex + 1).trim();
  }
  
  let action = actionAndComment;
  let comment = '';
  const commentIndex = actionAndComment.indexOf(' - "');
  if (commentIndex !== -1) {
    action = actionAndComment.substring(0, commentIndex).trim();
    const rawComment = actionAndComment.substring(commentIndex + 4).trim();
    comment = rawComment.endsWith('"') ? rawComment.substring(0, rawComment.length - 1) : rawComment;
  }
  
  return { timestamp, actor, action, comment };
};

const renderObservationHistory = (jefeObs, ghObs, row) => {
  if (!jefeObs && !ghObs) return null;

  const items = [];

  if (jefeObs) {
    items.push({
      type: 'jefe',
      roleLabel: 'Jefe Inmediato',
      actor: row?.jefe?.nombre || 'Jefe Inmediato',
      timestamp: row?.jefe_aprobado_at ? new Date(row.jefe_aprobado_at).toLocaleString('es-CO') : '',
      action: row?.estado === 'no_aprobada' ? 'Rechazó la solicitud' : 'Aprobó la solicitud',
      comment: jefeObs,
      bgColor: '#eff6ff',
      borderColor: '#bfdbfe',
      badgeColor: '#1d4ed8',
      badgeBg: '#dbeafe'
    });
  }

  if (ghObs) {
    ghObs.split('\n').forEach((line) => {
      if (!line.trim()) return;
      const parsed = parseLogLine(line);
      items.push({
        type: 'gh',
        roleLabel: 'Talento Humano',
        actor: parsed.actor || 'Gestión Humana',
        timestamp: parsed.timestamp || '',
        action: parsed.action,
        comment: parsed.comment,
        bgColor: '#f0fdf4',
        borderColor: '#bbf7d0',
        badgeColor: '#15803d',
        badgeBg: '#dcfce7'
      });
    });
  }

  return (
    <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 900, fontSize: 13, color: '#334155', borderBottom: '2px solid #e2e8f0', pb: 0.5 }}>
        Historial de Observaciones y Acciones
      </Typography>
      <Stack spacing={1.5}>
        {items.map((item, idx) => (
          <Box
            key={idx}
            sx={{
              p: 1.5,
              bgcolor: item.bgColor,
              border: `1px solid ${item.borderColor}`,
              borderRadius: 2.5,
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.02)'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Chip
                label={item.roleLabel}
                size="small"
                sx={{
                  bgcolor: item.badgeBg,
                  color: item.badgeColor,
                  fontWeight: 900,
                  fontSize: 10,
                  height: 20
                }}
              />
              {item.timestamp && (
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                  {item.timestamp}
                </Typography>
              )}
            </Stack>
            
            <Typography variant="body2" sx={{ fontWeight: 800, color: '#1e293b', mb: item.comment ? 0.5 : 0 }}>
              {item.actor} &raquo; <span style={{ color: '#475569', fontWeight: 600 }}>{item.action}</span>
            </Typography>

            {item.comment && (
              <Box sx={{ mt: 1, p: 1, bgcolor: 'rgba(255, 255, 255, 0.7)', borderRadius: 1.5, borderLeft: `3px solid ${item.badgeColor}` }}>
                <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#334155', fontSize: 11.5 }}>
                  "{item.comment}"
                </Typography>
              </Box>
            )}
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

function ReporteSalidaSeguimiento({ initialAccess = null, onBack }) {
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [activeModule, setActiveModule] = useState('reporte_salida');
  const [rows, setRows] = useState([]);
  const [access, setAccess] = useState(initialAccess);
  const [loading, setLoading] = useState(false);
  const [estado, setEstado] = useState('');
  const [viewTab, setViewTab] = useState('todas');
  const [updatingReposicionId, setUpdatingReposicionId] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [cardFilter, setCardFilter] = useState('todas');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [timeRange, setTimeRange] = useState('todos');

  const accessMode = access?.mode || 'sin_pendientes';
  const copy = ACCESS_COPY[accessMode] || ACCESS_COPY.sin_pendientes;
  const canValidateReposicion = Boolean(access?.canValidateReposicion);
  const canManageAll = Boolean(access?.canManageAll);
  const showEstadoFilter = Boolean(access?.canManageAll);

  // Estados para modales de administración GH
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupParticipants, setGroupParticipants] = useState([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editData, setEditData] = useState({ estado: '', reposicion_aplica: false, tiempo_solicitado_minutos: '' });
  
  // Estados para modal de reposición parcial GH
  const [repDialogOpen, setRepDialogOpen] = useState(false);
  const [repTarget, setRepTarget] = useState(null);
  const [repHorasAbonadas, setRepHorasAbonadas] = useState('');
  const [repEstado, setRepEstado] = useState('programada');
  const [repObservacion, setRepObservacion] = useState('');

  const fetchSolicitudes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await reporteSalidaService.getSeguimiento({ page: 1, limit: 50, estado });
      setAccess(response?.data?.access || null);
      setRows(response?.data?.solicitudes || []);
    } finally {
      setLoading(false);
    }
  }, [estado]);

  const load = useCallback(async () => {
    fetchSolicitudes();
  }, [fetchSolicitudes]);

  useEffect(() => {
    if (activeModule === 'reporte_salida' || activeModule === 'estadisticas') load();
  }, [activeModule, load]);

  const filteredRowsBase = useMemo(() => {
    let result = rows;
    if (accessMode === 'jefe_y_colaborador') {
      if (viewTab === 'mis_reposiciones') result = rows.filter((r) => r.solicitante?.userId === user?.id);
      else if (viewTab === 'equipo') result = rows.filter((r) => r.solicitante?.userId !== user?.id);
    }

    if (tipoFiltro) {
      result = result.filter(r => {
        const rowCat = r.datos_formulario?.salida?.categoria;
        const tipo = String(r.datos_formulario?.salida?.tipo || '').toLowerCase();
        
        if (tipoFiltro === 'propias_cargo') {
          if (rowCat === 'propias_cargo') return true;
          return ['ponencia', 'visita_ies', 'salida_campus', 'reunion_institucional', 'evento_institucional'].includes(tipo) || tipo.startsWith('otra_misional:') || (tipo.startsWith('otra:') && rowCat !== 'personales');
        }
        if (tipoFiltro === 'salud') {
          if (rowCat === 'salud') return true;
          return ['cita_eps', 'cita_particular', 'terapias', 'urgencia_medica'].includes(tipo);
        }
        if (tipoFiltro === 'personales') {
          if (rowCat === 'personales') return true;
          return ['diligencia_personal', 'calamidad', 'jurado_votacion', 'sufragante', 'voto_jurado', 'voto_sufragante'].includes(tipo) || tipo.startsWith('otra_personal:') || (tipo.startsWith('otra:') && rowCat === 'personales');
        }
        return false;
      });
    }
    if (estado) {
      result = result.filter(r => r.estado === estado);
    }
    if (timeRange && timeRange !== 'todos') {
      const now = new Date();
      if (timeRange === 'diario') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        result = result.filter(r => {
          const date = new Date(r.created_at);
          return date >= startOfDay;
        });
      } else if (timeRange === 'semanal') {
        const startOfWeek = new Date();
        startOfWeek.setDate(now.getDate() - 7);
        result = result.filter(r => {
          const date = new Date(r.created_at);
          return date >= startOfWeek;
        });
      } else if (timeRange === 'mensual') {
        const startOfMonth = new Date();
        startOfMonth.setDate(now.getDate() - 30);
        result = result.filter(r => {
          const date = new Date(r.created_at);
          return date >= startOfMonth;
        });
      }
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(r => {
        const nameMatch = r.solicitante?.nombre?.toLowerCase().includes(lower) || false;
        const ccMatch = r.solicitante?.username?.toLowerCase().includes(lower) || r.datos_formulario?.laboral?.cedula?.toLowerCase().includes(lower) || false;
        const consecutivoMatch = r.consecutivo?.toLowerCase().includes(lower) || false;
        return nameMatch || ccMatch || consecutivoMatch;
      });
    }
    return result;
  }, [rows, viewTab, accessMode, user?.id, tipoFiltro, searchTerm, estado, timeRange]);

  const summary = useMemo(() => {
    const total = filteredRowsBase.length;
    const pendientes = filteredRowsBase.filter((r) => ['pendiente_aprobacion_jefe', 'pendiente_aprobacion_gestion_humana'].includes(r.estado)).length;
    const personales = filteredRowsBase.filter((r) => r.reposicion_aplica && r.reposicion_estado !== 'cumplida').length;
    const reposicionesValidadas = filteredRowsBase.filter((r) => r.reposicion_aplica && r.reposicion_estado === 'cumplida').length;
    const finalizadas = filteredRowsBase.filter((r) => r.estado === 'finalizada').length;
    return { total, pendientes, personales, reposicionesValidadas, finalizadas };
  }, [filteredRowsBase]);

  const filteredRows = useMemo(() => {
    let result = filteredRowsBase;
    if (cardFilter === 'pendientes') {
      result = result.filter((r) => ['pendiente_aprobacion_jefe', 'pendiente_aprobacion_gestion_humana'].includes(r.estado));
    } else if (cardFilter === 'personales') {
      result = result.filter((r) => r.reposicion_aplica && r.reposicion_estado !== 'cumplida');
    } else if (cardFilter === 'reposicionesValidadas') {
      result = result.filter((r) => r.reposicion_aplica && r.reposicion_estado === 'cumplida');
    } else if (cardFilter === 'finalizadas') {
      result = result.filter((r) => r.estado === 'finalizada');
    }
    return result;
  }, [filteredRowsBase, cardFilter]);

  useEffect(() => {
    setPage(0);
  }, [cardFilter, tipoFiltro, estado, searchTerm, timeRange]);

  const groupedRows = useMemo(() => {
    const groups = {};
    const result = [];

    filteredRows.forEach((row) => {
      const isMultiple = row.datos_formulario?.is_salida_multiple === true;
      const grupoId = row.datos_formulario?.grupo_id;

      if (isMultiple && grupoId) {
        if (!groups[grupoId]) {
          groups[grupoId] = {
            leaderRow: row,
            participants: []
          };
        }
        groups[grupoId].participants.push({
          id: row.id,
          consecutivo: row.consecutivo,
          nombre: row.datos_formulario?.personal?.nombre || row.solicitante_snapshot?.nombre || row.solicitante?.nombre || '',
          documento: row.datos_formulario?.personal?.documento || row.solicitante_snapshot?.username || row.solicitante?.username || '',
          correo: row.datos_formulario?.personal?.correo || row.solicitante_snapshot?.email || '',
          dependencia: row.datos_formulario?.laboral?.dependencia || '',
          cargo: row.datos_formulario?.laboral?.cargo || ''
        });
        
        if (row.datos_formulario?.is_leader === true) {
          groups[grupoId].leaderRow = row;
        }
      } else {
        result.push(row);
      }
    });

    Object.keys(groups).forEach((grupoId) => {
      const g = groups[grupoId];
      const rowClone = {
        ...g.leaderRow,
        groupParticipants: g.participants,
        isGroupRow: true
      };
      result.push(rowClone);
    });

    return result.sort((a, b) => b.id - a.id);
  }, [filteredRows]);

  const paginatedRows = useMemo(() => {
    const start = page * rowsPerPage;
    return groupedRows.slice(start, start + rowsPerPage);
  }, [groupedRows, page, rowsPerPage]);

  const exportToExcel = () => {
    // -------------------------------------------------------------
    // HOJA 1: RESUMEN DE LA TABLA (Muestra lo filtrado en la UI)
    // -------------------------------------------------------------
    const headersSummary = [
      'Consecutivo', 'Fecha Creación', 'Fecha Radicación', 'Colaborador(a)', 'Documento', 'Dependencia', 'Cargo', 
      'Jefe Inmediato', 'Segmento', 'Tipo Permiso', 'Motivo / Detalles', 'Estado', 
      'Requiere Reposicion', 'Estado Reposicion', 'Tiempo Solicitado (Min)'
    ];

    const dataSummary = groupedRows.map(row => {
      const f = row.datos_formulario || {};
      const tipo = f.salida?.tipo || 'N/A';
      
      let segmentoText = 'N/A';
      const rowCat = f.salida?.categoria;
      if (rowCat === 'salud') segmentoText = 'Salud y Bienestar';
      else if (rowCat === 'personales') segmentoText = 'Trámites, Permisos y Licencias';
      else if (rowCat === 'propias_cargo') segmentoText = 'Actividades propias del cargo (Misionales)';
      else {
        if (['cita_eps', 'cita_particular', 'terapias', 'urgencia_medica'].includes(tipo)) segmentoText = 'Salud y Bienestar';
        else if (['diligencia_personal', 'calamidad', 'jurado_votacion', 'sufragante'].includes(tipo)) segmentoText = 'Trámites, Permisos y Licencias';
        else if (['reunion_institucional', 'evento_institucional', 'ponencia', 'visita_ies', 'salida_campus'].includes(tipo)) segmentoText = 'Actividades propias del cargo (Misionales)';
      }

      return [
        row.consecutivo,
        row.created_at ? new Date(row.created_at).toLocaleString('es-CO') : 'N/A',
        row.finalizado_at ? new Date(row.finalizado_at).toLocaleString('es-CO') : 'Pendiente',
        row.isGroupRow ? `${row.solicitante?.nombre} (Grupo de ${row.groupParticipants.length} part.)` : (row.solicitante?.nombre || 'N/A'),
        f.personal?.documento || row.solicitante?.username || 'N/A',
        f.laboral?.dependencia || 'N/A',
        f.laboral?.cargo || 'N/A',
        row.jefe?.nombre || 'N/A',
        segmentoText,
        tipo,
        f.salida?.motivo || f.salida?.otraDescripcion || '',
        STATUS_LABELS[row.estado] || row.estado,
        row.reposicion_aplica ? 'SI' : 'NO',
        row.reposicion_aplica ? (row.reposicion_estado === 'cumplida' ? 'Cumplida' : 'Pendiente') : 'N/A',
        row.tiempo_solicitado_minutos || 0
      ];
    });

    const worksheetSummary = XLSX.utils.aoa_to_sheet([headersSummary, ...dataSummary]);

    // -------------------------------------------------------------
    // HOJA 2: DETALLE COMPLETO Y TRAZABILIDAD (Data desagrupada)
    // -------------------------------------------------------------
    const headersDetail = [
      'Consecutivo', 'Fecha Creación', 'Fecha Aprobación Jefe', 'Fecha Aprobación GH', 'Fecha Radicación (Finalización)', 
      'Colaborador(a)', 'Documento', 'Dependencia', 'Cargo', 'Jefe Inmediato', 
      'Segmento', 'Tipo Permiso', 'Motivo / Detalles', 'Estado Solicitud', 
      'Requiere Reposición', 'Estado Reposición', 
      'Tiempo Solicitado (Min)', 'Tiempo Solicitado (Hrs)', 
      'Tiempo Repuesto / Abonado (Hrs)', 'Saldo Pendiente (Hrs)', 
      'Observación Jefe', 'Historial Observaciones GH / Abonos', 
      'Trazabilidad Histórica Completa', 'Es Salida Grupal', 'Participantes de Salida Grupal'
    ];

    const dataDetail = filteredRows.map(row => {
      const f = row.datos_formulario || {};
      const tipo = f.salida?.tipo || 'N/A';
      
      let segmentoText = 'N/A';
      const rowCat = f.salida?.categoria;
      if (rowCat === 'salud') segmentoText = 'Salud y Bienestar';
      else if (rowCat === 'personales') segmentoText = 'Trámites, Permisos y Licencias';
      else if (rowCat === 'propias_cargo') segmentoText = 'Actividades propias del cargo (Misionales)';
      else {
        if (['cita_eps', 'cita_particular', 'terapias', 'urgencia_medica'].includes(tipo)) segmentoText = 'Salud y Bienestar';
        else if (['diligencia_personal', 'calamidad', 'jurado_votacion', 'sufragante'].includes(tipo)) segmentoText = 'Trámites, Permisos y Licencias';
        else if (['reunion_institucional', 'evento_institucional', 'ponencia', 'visita_ies', 'salida_campus'].includes(tipo)) segmentoText = 'Actividades propias del cargo (Misionales)';
      }

      const totalMinutos = row.reposicion_minutos || row.tiempo_solicitado_minutos || 0;
      const minutosPagados = row.reposicion_minutos_pagados || row.datos_formulario?.reposicion_minutos_pagados || 0;
      const pendientes = totalMinutos - minutosPagados;

      const hrsSolicitadas = (totalMinutos / 60).toFixed(1);
      const hrsPagadas = (minutosPagados / 60).toFixed(1);
      const hrsPendientes = (pendientes / 60).toFixed(1);

      let trazabilidadStr = '';
      if (Array.isArray(row.trazabilidad)) {
        trazabilidadStr = row.trazabilidad.map(t => {
          const dateStr = t.timestamp ? new Date(t.timestamp).toLocaleString('es-CO') : '';
          const userStr = t.actor || t.userId || 'Sistema';
          return `[${dateStr}] ${userStr}: ${t.event}`;
        }).join('\n');
      }

      const esGrupal = Boolean(f.grupo?.participantes && f.grupo.participantes.length > 0);
      let participantesStr = '';
      if (esGrupal) {
        participantesStr = f.grupo.participantes.map(p => `${p.nombre || ''} (${p.documento || p.cedula || ''})`).join(', ');
      }

      return [
        row.consecutivo,
        row.created_at ? new Date(row.created_at).toLocaleString('es-CO') : 'N/A',
        row.jefe_aprobado_at ? new Date(row.jefe_aprobado_at).toLocaleString('es-CO') : 'Pendiente',
        row.gestion_humana_aprobado_at ? new Date(row.gestion_humana_aprobado_at).toLocaleString('es-CO') : 'Pendiente',
        row.finalizado_at ? new Date(row.finalizado_at).toLocaleString('es-CO') : 'Pendiente',
        row.solicitante?.nombre || 'N/A',
        f.personal?.documento || row.solicitante?.username || 'N/A',
        f.laboral?.dependencia || 'N/A',
        f.laboral?.cargo || 'N/A',
        row.jefe?.nombre || 'N/A',
        segmentoText,
        tipo,
        f.salida?.motivo || f.salida?.otraDescripcion || '',
        STATUS_LABELS[row.estado] || row.estado,
        row.reposicion_aplica ? 'SI' : 'NO',
        row.reposicion_aplica ? (row.reposicion_estado === 'cumplida' ? 'Cumplida' : 'Pendiente') : 'N/A',
        row.tiempo_solicitado_minutos || 0,
        hrsSolicitadas,
        hrsPagadas,
        hrsPendientes,
        getJefeObservacion(row) || '',
        row.observacion_gestion_humana || '',
        trazabilidadStr,
        esGrupal ? 'SI' : 'NO',
        participantesStr
      ];
    });

    const worksheetDetail = XLSX.utils.aoa_to_sheet([headersDetail, ...dataDetail]);

    // Aplicar estilos a cabeceras
    const applyHeaderStyles = (ws, headers) => {
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_cell({ r: 0, c: C });
        if (!ws[address]) continue;
        ws[address].s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "1D4ED8" } },
          alignment: { horizontal: "center", vertical: "center" }
        };
      }
      ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length, 15) }));
    };

    applyHeaderStyles(worksheetSummary, headersSummary);
    applyHeaderStyles(worksheetDetail, headersDetail);

    // Ajustar anchos
    worksheetSummary['!cols'][3] = { wch: 30 }; // Colaborador
    worksheetSummary['!cols'][10] = { wch: 45 }; // Motivo

    worksheetDetail['!cols'][5] = { wch: 30 }; // Colaborador
    worksheetDetail['!cols'][12] = { wch: 45 }; // Motivo
    worksheetDetail['!cols'][20] = { wch: 45 }; // Obs Jefe
    worksheetDetail['!cols'][21] = { wch: 50 }; // Historial GH
    worksheetDetail['!cols'][22] = { wch: 60 }; // Trazabilidad
    worksheetDetail['!cols'][24] = { wch: 60 }; // Participantes

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheetSummary, "Resumen de Tabla");
    XLSX.utils.book_append_sheet(workbook, worksheetDetail, "Detalle y Trazabilidad");
    XLSX.writeFile(workbook, `Seguimiento_Reportes_${new Date().getTime()}.xlsx`);
  };

  const updateReposicion = async (row, nextEstado) => {
    if (!canValidateReposicion) return;
    setUpdatingReposicionId(row.id);
    setActionMessage('');
    try {
      const response = await reporteSalidaService.actualizarReposicion(row.id, {
        estado: nextEstado,
        observacion: nextEstado === 'cumplida'
          ? 'Tiempo repuesto validado desde seguimiento de reportes.'
          : nextEstado === 'incumplida'
            ? 'Reposicion marcada como incumplida desde seguimiento de reportes.'
            : 'Reposicion marcada como pendiente/programada desde seguimiento de reportes.'
      });
      const updated = response?.data;
      if (updated) {
        setRows((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      }
      setActionMessage(response?.message || 'Seguimiento actualizado.');
    } catch (error) {
      setActionMessage(error?.response?.data?.message || 'No se pudo actualizar la reposicion.');
    } finally {
      setUpdatingReposicionId(null);
    }
  };

  const handleEditOpen = (row) => {
    setEditTarget(row);
    setEditData({
      estado: row.estado,
      reposicion_aplica: row.reposicion_aplica || false,
      tiempo_solicitado_minutos: row.tiempo_solicitado_minutos || 0,
      reposicion_minutos_pagados: row.reposicion_minutos_pagados || row.datos_formulario?.reposicion_minutos_pagados || 0,
      observacion: ''
    });
    setEditDialogOpen(true);
  };

  const submitEdit = async () => {
    if (!editData.observacion || !editData.observacion.trim()) {
      enqueueSnackbar('Debe ingresar una observación explicando el motivo de la corrección.', { variant: 'error' });
      return;
    }
    try {
      const res = await api.put(`/reporte-salida/solicitudes/${editTarget.id}/admin`, {
        tiempo_solicitado_minutos: editData.tiempo_solicitado_minutos,
        reposicion_minutos_pagados: editData.reposicion_minutos_pagados,
        observacion: editData.observacion
      });
      if (res.data.success) {
        enqueueSnackbar('Corrección registrada correctamente', { variant: 'success' });
        setEditDialogOpen(false);
        const updatedRow = res.data.data;
        setRows((prev) => prev.map((item) => (item.id === updatedRow.id ? updatedRow : item)));
      }
    } catch (error) {
      enqueueSnackbar('Error al registrar la corrección', { variant: 'error' });
    }
  };

  const handleDeleteOpen = (id) => {
    setDeleteTargetId(id);
    setDeleteConfirmOpen(true);
  };

  const submitDelete = async () => {
    try {
      const targetRow = rows.find(r => r.id === deleteTargetId);
      const res = await api.delete(`/reporte-salida/solicitudes/${deleteTargetId}`);
      if (res.data.success) {
        enqueueSnackbar(res.data.message || 'Solicitud eliminada', { variant: 'success' });
        setDeleteConfirmOpen(false);
        const targetGrupoId = targetRow?.datos_formulario?.grupo_id;
        if (targetGrupoId) {
          setRows((prev) => prev.filter((item) => item.datos_formulario?.grupo_id !== targetGrupoId));
        } else {
          setRows((prev) => prev.filter((item) => item.id !== deleteTargetId));
        }
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Error al eliminar';
      const detailMsg = error.response?.data?.detail ? ` - Detalle: ${error.response.data.detail}` : '';
      enqueueSnackbar(`${errorMsg}${detailMsg}`, { variant: 'error' });
    }
  };

  const handleLimpiarMocks = async () => {
    if (!window.confirm('¿Está seguro de que desea eliminar permanentemente todos los reportes de prueba (Mocks)? Esta acción no se puede deshacer.')) {
      return;
    }
    setLoading(true);
    try {
      const res = await api.delete('/reporte-salida/limpiar-mocks');
      if (res.data.success) {
        enqueueSnackbar(res.data.message || 'Datos de prueba eliminados.', { variant: 'success' });
        load();
      }
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al eliminar datos de prueba.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!repTarget) return;
    const totalMinutos = repTarget.reposicion_minutos || repTarget.tiempo_solicitado_minutos || 0;
    const minutosPagados = repTarget.reposicion_minutos_pagados || repTarget.datos_formulario?.reposicion_minutos_pagados || 0;
    const minutosPendientes = totalMinutos - minutosPagados;
    const minutosAbonar = Math.round((parseFloat(repHorasAbonadas) || 0) * 60);
    if (minutosPendientes - minutosAbonar <= 0) {
      setRepEstado('cumplida');
    } else {
      setRepEstado('pendiente');
    }
  }, [repHorasAbonadas, repTarget]);

  const handleRepOpen = (row) => {
    setRepTarget(row);
    setRepEstado(row.reposicion_estado === 'cumplida' ? 'cumplida' : 'pendiente');
    setRepObservacion('');
    setRepHorasAbonadas('');
    setRepDialogOpen(true);
  };

  const submitRep = async () => {
    if (!repTarget) return;
    if (!repHorasAbonadas || Number(repHorasAbonadas) <= 0) {
      enqueueSnackbar('La cantidad de horas a abonar debe ser mayor que cero.', { variant: 'error' });
      return;
    }
    const totalMinutos = repTarget.reposicion_minutos || repTarget.tiempo_solicitado_minutos || 0;
    const minutosPagados = repTarget.reposicion_minutos_pagados || repTarget.datos_formulario?.reposicion_minutos_pagados || 0;
    const minutosPendientes = totalMinutos - minutosPagados;
    const minutosAbonar = Math.round(Number(repHorasAbonadas) * 60);

    if (minutosAbonar > minutosPendientes) {
      enqueueSnackbar('La cantidad de horas a abonar no puede exceder el tiempo pendiente.', { variant: 'error' });
      return;
    }
    if (minutosPendientes - minutosAbonar <= 0 && repEstado === 'pendiente') {
      enqueueSnackbar('No se puede guardar como "Pendiente" si se ha repuesto la totalidad de las horas.', { variant: 'error' });
      return;
    }

    try {
      const res = await api.patch(`/reporte-salida/solicitudes/${repTarget.id}/reposicion`, {
        estado: repEstado,
        observacion: repObservacion,
        horasAbonadas: repHorasAbonadas
      });
      if (res.data.success) {
        enqueueSnackbar('Reposición actualizada', { variant: 'success' });
        setRepDialogOpen(false);
        const updatedRow = res.data.data;
        setRows((prev) => prev.map((item) => (item.id === updatedRow.id ? updatedRow : item)));
      }
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al actualizar', { variant: 'error' });
    }
  };

  const getTrazabilidadTooltip = (row) => {
    const lines = [];
    lines.push(`• Creada: ${row.created_at ? new Date(row.created_at).toLocaleString('es-CO') : 'N/A'}`);
    
    if (row.jefe_aprobado_at) {
      lines.push(`• Aprobado Jefe: ${new Date(row.jefe_aprobado_at).toLocaleString('es-CO')}`);
    } else if (row.estado === 'pendiente_aprobacion_jefe') {
      lines.push('• Aprobado Jefe: Pendiente');
    }
    
    if (row.gestion_humana_aprobado_at) {
      lines.push(`• Aprobado GH: ${new Date(row.gestion_humana_aprobado_at).toLocaleString('es-CO')}`);
    } else if (['pendiente_aprobacion_jefe', 'aprobada_jefe', 'pendiente_aprobacion_gestion_humana'].includes(row.estado)) {
      lines.push('• Aprobado GH: Pendiente');
    }
    
    if (row.enviado_sst_at) {
      lines.push(`• Enviado SST: ${new Date(row.enviado_sst_at).toLocaleString('es-CO')}`);
    }
    
    if (row.finalizado_at) {
      lines.push(`• Finalizada: ${new Date(row.finalizado_at).toLocaleString('es-CO')}`);
    }
    
    return (
      <Box sx={{ p: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5, borderBottom: '1px solid rgba(255,255,255,0.2)', pb: 0.2 }}>
          Línea de Tiempo / Trazabilidad
        </Typography>
        {lines.map((line, idx) => (
          <Typography key={idx} variant="caption" sx={{ display: 'block', fontSize: 11, lineHeight: 1.4 }}>
            {line}
          </Typography>
        ))}
      </Box>
    );
  };

  return (
    <Fade in timeout={250}>
      <Box>
        <Paper elevation={0} sx={{ p: 1.4, mb: 2.5, border: '1px solid #dbe6f5', borderRadius: 2.5, bgcolor: '#f8fbff' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
            <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={onBack}>Volver a Gestión del Talento Humano</Button>
            {activeModule === 'reporte_salida' && (
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Actualizar</Button>
            )}
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ border: '1px solid #dbe6f5', borderRadius: 4, bgcolor: '#fff', mb: 2.2, overflow: 'hidden' }}>

          <Box sx={{ px: { xs: 1.2, md: 1.6 }, py: 1.2, bgcolor: '#f8fbff', borderBottom: '1px solid #e2e8f0' }}>
            <Stack direction="row" spacing={1.1} sx={{ width: '100%' }}>
              {REPORT_MODULES.map((module) => {
                const Icon = module.icon;
                const active = activeModule === module.key;
                return (
                  <Button
                    key={module.key}
                    onClick={() => module.available && setActiveModule(module.key)}
                    disabled={!module.available}
                    startIcon={<Icon />}
                    sx={{
                      flex: 1,
                      justifyContent: 'flex-start',
                      alignItems: 'center',
                      textAlign: 'left',
                      borderRadius: 2,
                      px: 1.5,
                      py: 1.2,
                      border: `1px solid ${active ? '#2563eb' : '#dbe6f5'}`,
                      bgcolor: active ? '#eff6ff' : '#fff',
                      color: active ? '#1d4ed8' : '#334155',
                      opacity: module.available ? 1 : 0.72,
                      textTransform: 'none',
                      '&:hover': { bgcolor: module.available ? '#eef4ff' : '#fff' },
                      '& .MuiButton-startIcon': { color: active ? '#2563eb' : '#64748b' }
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 950, fontSize: 13, lineHeight: 1.1 }}>{module.label}</Typography>
                      <Typography sx={{ color: active ? '#1d4ed8' : '#64748b', fontSize: 11, mt: 0.4, lineHeight: 1.2 }}>
                        {module.available ? 'Disponible' : 'Proximamente'}
                      </Typography>
                    </Box>
                  </Button>
                );
              })}
            </Stack>
          </Box>

          <Box
            sx={{
              p: 2.2,
              background: 'linear-gradient(135deg, #f0f7ff 0%, #e0f0fe 100%)',
              borderBottom: '1px solid #bae6fd',
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 2
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: '10px',
                  bgcolor: '#2563eb',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                }}
              >
                {activeModule === 'reporte_salida' ? <AssignmentTurnedInIcon /> : <BarChartIcon />}
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 850, fontSize: 18, color: '#1e3a8a', lineHeight: 1.2 }}>
                  {activeModule === 'reporte_salida' ? 'Seguimiento a Reportes de Salida' : 'Indicadores de Ausentismo'}
                </Typography>
                <Typography sx={{ color: '#1d4ed8', fontSize: 12, fontWeight: 600, mt: 0.2 }}>
                  {activeModule === 'reporte_salida' ? 'Control de solicitudes, aprobaciones y reposiciones' : 'Estadísticas e historial analítico'}
                </Typography>
              </Box>
            </Box>

            {showEstadoFilter && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems="center" sx={{ width: { xs: '100%', sm: 'auto' } }}>
                <TextField select size="small" label="Filtrar por Segmento" value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)} sx={{ minWidth: 220, bgcolor: '#fff', borderRadius: 1.5 }}>
                  <MenuItem value="">Todos los Segmentos</MenuItem>
                  <MenuItem value="propias_cargo">Actividades propias del cargo (Misionales)</MenuItem>
                  <MenuItem value="salud">Salud y Bienestar</MenuItem>
                  <MenuItem value="personales">Trámites, Permisos y Licencias</MenuItem>
                </TextField>
                <TextField select size="small" label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)} sx={{ minWidth: 150, bgcolor: '#fff', borderRadius: 1.5 }}>
                  <MenuItem value="">Todos los Estados</MenuItem>
                  {Object.entries(STATUS_LABELS).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Período" value={timeRange} onChange={(e) => setTimeRange(e.target.value)} sx={{ minWidth: 140, bgcolor: '#fff', borderRadius: 1.5 }}>
                  <MenuItem value="todos">Todos</MenuItem>
                  <MenuItem value="diario">Hoy</MenuItem>
                  <MenuItem value="semanal">Esta Semana</MenuItem>
                  <MenuItem value="mensual">Este Mes</MenuItem>
                </TextField>
                <Button variant="contained" color="success" startIcon={<DownloadIcon />} onClick={exportToExcel} sx={{ fontWeight: 800, textTransform: 'none', height: 40, px: 2, borderRadius: 1.5 }}>
                  Exportar Excel
                </Button>
              </Stack>
            )}
          </Box>
          <Box sx={{ p: { xs: 2, md: 2.2 } }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mt: 2.2 }}>
              {[
                { key: 'todas', label: 'Solicitudes', value: summary.total, icon: AssignmentTurnedInIcon, color: '#2563eb', gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' },
                { key: 'pendientes', label: 'Pendientes', value: summary.pendientes, icon: PendingActionsIcon, color: '#d97706', gradient: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)' },
                { key: 'personales', label: 'Con Reposición', value: summary.personales, icon: EventRepeatIcon, color: '#7c3aed', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' },
                { key: 'reposicionesValidadas', label: 'Rep. Validadas', value: summary.reposicionesValidadas, icon: FactCheckIcon, color: '#059669', gradient: 'linear-gradient(135deg, #10b981 0%, #047857 100%)' }
              ].map((card) => {
                const CardIcon = card.icon;
                const active = cardFilter === card.key;
                return (
                  <Box
                    key={card.key}
                    onClick={() => setCardFilter(active ? 'todas' : card.key)}
                    sx={{
                      flex: 1,
                      px: 2,
                      py: 1.6,
                      borderRadius: 3,
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      border: active ? `1px solid ${card.color}` : '1px solid #e2e8f0',
                      background: active ? card.gradient : '#fff',
                      color: active ? '#fff' : '#0f172a',
                      boxShadow: active 
                        ? `0 10px 15px -3px ${card.color}40, 0 4px 6px -4px ${card.color}20` 
                        : '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
                      transform: active ? 'translateY(-2px)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      '&:hover': {
                        transform: 'translateY(-3px)',
                        boxShadow: active 
                          ? `0 12px 20px -3px ${card.color}60, 0 6px 8px -4px ${card.color}35` 
                          : '0 8px 16px -4px rgba(0, 0, 0, 0.1)',
                        borderColor: card.color,
                        bgcolor: active ? undefined : '#f8fafc'
                      }
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ color: active ? 'rgba(255,255,255,0.85)' : '#64748b', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {card.label}
                      </Typography>
                      <Typography sx={{ fontSize: 26, fontWeight: 950, mt: 0.2, lineHeight: 1 }}>
                        {card.value}
                      </Typography>
                    </Box>
                    <Box 
                      sx={{ 
                        p: 1, 
                        borderRadius: 2, 
                        bgcolor: active ? 'rgba(255,255,255,0.2)' : `${card.color}15`, 
                        color: active ? '#fff' : card.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        ml: 1
                      }}
                    >
                      <CardIcon sx={{ fontSize: 22 }} />
                    </Box>
                  </Box>
                );
              })}
            </Stack>
            {actionMessage && <Alert sx={{ mt: 1.5 }} severity={actionMessage.includes('No se pudo') ? 'error' : 'success'}>{actionMessage}</Alert>}
          </Box>
        </Paper>

        {activeModule === 'estadisticas' && canManageAll ? (
          <Box sx={{ mt: 2 }}>
            <ReporteSalidaEstadisticas rows={filteredRows} />
          </Box>
        ) : activeModule !== 'reporte_salida' ? (
          <Paper elevation={0} sx={{ p: 3, border: '1px dashed #bfdbfe', borderRadius: 3, bgcolor: '#f8fbff' }}>
            <Chip size="small" label="Proximamente" sx={{ bgcolor: '#e0f2fe', color: '#075985', fontWeight: 900, mb: 1.2 }} />
            <Typography sx={{ fontWeight: 950, fontSize: 22, color: '#0f172a' }}>
              {REPORT_MODULES.find((item) => item.key === activeModule)?.label}
            </Typography>
            <Typography sx={{ color: '#64748b', mt: 0.5 }}>
              Este espacio queda preparado para agregar nuevos reportes sin cambiar la arquitectura de la pantalla.
            </Typography>
          </Paper>
        ) : (
          <>
            {accessMode === 'jefe_y_colaborador' && (
              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={viewTab} onChange={(_, newValue) => setViewTab(newValue)} textColor="primary" indicatorColor="primary">
                  <Tab label="Todas" value="todas" sx={{ fontWeight: 800, textTransform: 'none' }} />
                  <Tab label="Mis reposiciones" value="mis_reposiciones" sx={{ fontWeight: 800, textTransform: 'none' }} />
                  <Tab label="Reposiciones de mi equipo" value="equipo" sx={{ fontWeight: 800, textTransform: 'none' }} />
                </Tabs>
              </Box>
            )}
            
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Buscar por Nombre, Cédula o Consecutivo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ bgcolor: '#fff', '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Box>

            <Paper elevation={0} sx={{ border: '1px solid #dbe6f5', borderRadius: 3, overflow: 'hidden', bgcolor: '#fff' }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Solicitud', 'F. Radicación', 'Colaborador(a)', 'Jefe inmediato', 'Motivo / Detalles', 'Estado', 'Reposición', 'Observaciones', canManageAll ? 'Acciones Adm' : (canValidateReposicion ? 'Validación GH' : 'Seguimiento')].map((label) => (
                        <TableCell key={label} sx={{ bgcolor: '#f8fafc', fontWeight: 950, color: '#334155', fontSize: 11, py: 1, px: 0.8 }}>{label}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={10} align="center" sx={{ py: 6 }}><CircularProgress /></TableCell></TableRow>
                    ) : groupedRows.length === 0 ? (
                      <TableRow><TableCell colSpan={10} sx={{ py: 3 }}><Alert severity="info">No hay solicitudes para el filtro seleccionado.</Alert></TableCell></TableRow>
                    ) : paginatedRows.map((row) => {
                      const statusSx = STATUS_COLORS[row.estado] || { bg: '#f1f5f9', color: '#475569' };
                      return (
                        <TableRow key={row.id} hover>
                          <TableCell sx={{ py: 0.8, px: 0.8, minWidth: 120 }}>
                            <Typography sx={{ fontWeight: 900, color: '#1d4ed8', fontSize: 11.5 }}>{row.consecutivo}</Typography>
                            {(() => {
                              const txId = row.datos_formulario?.tx_id || ('00000000-0000-4000-8000-' + String(row.id).padStart(12, '0'));
                              return (
                                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                                  <Tooltip title={`ID Transacción: ${txId}`} arrow>
                                    <Typography sx={{ fontSize: 8.5, color: '#94a3b8', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                                      Tx: {txId.substring(0, 12)}...
                                    </Typography>
                                  </Tooltip>
                                  <Tooltip title="Copiar ID de Transacción" arrow>
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        navigator.clipboard.writeText(txId);
                                        enqueueSnackbar('ID de transacción copiado', { variant: 'info', autoHideDuration: 1500 });
                                      }}
                                      sx={{ p: 0.2, color: '#94a3b8', '&:hover': { color: '#1d4ed8' } }}
                                    >
                                      <ContentCopyIcon sx={{ fontSize: 10 }} />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              );
                            })()}
                            {(() => {
                              const salida = row.datos_formulario?.salida;
                              if (salida?.tipo !== 'terapias' || !salida?.terapiasList?.length) return null;
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              return (
                                <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
                                  {salida.terapiasList.map((t, idx) => {
                                    const tParts = (t.fecha || '').split('-');
                                    if (tParts.length !== 3) return null;
                                    const tDate = new Date(tParts[0], tParts[1] - 1, tParts[2]);
                                    const isPast = tDate < today;
                                    const isToday = tDate.getTime() === today.getTime();
                                    const bg = isPast ? '#dcfce7' : isToday ? '#fef08a' : '#f1f5f9';
                                    const color = isPast ? '#166534' : isToday ? '#854d0e' : '#475569';
                                    return (
                                      <Tooltip key={idx} title={`Terapia #${idx + 1}: ${t.fecha} ${t.horaInicio}-${t.horaFin}`} arrow>
                                        <Chip size="small" label={`#${idx + 1}`} sx={{ bgcolor: bg, color, fontSize: 9, fontWeight: 700, height: 18, '& .MuiChip-label': { px: 0.8 } }} />
                                      </Tooltip>
                                    );
                                  })}
                                </Stack>
                              );
                            })()}
                          </TableCell>
                          <TableCell sx={{ py: 0.8, px: 0.8 }}>
                            {row.finalizado_at ? (
                              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#0f766e' }}>
                                {new Date(row.finalizado_at).toLocaleDateString('es-CO')}
                              </Typography>
                            ) : (
                              <Typography sx={{ fontSize: 10.5, color: '#94a3b8', fontStyle: 'italic' }}>
                                Pendiente
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ py: 0.8, px: 0.8 }}>
                            {row.isGroupRow ? (
                              <Stack spacing={0.5}>
                                <Typography sx={{ fontWeight: 800, fontSize: 11.5, color: '#0f766e' }}>
                                  {row.solicitante?.nombre}
                                </Typography>
                                <Typography sx={{ color: '#64748b', fontSize: 10.5 }}>
                                  {row.solicitante?.username} (Líder)
                                </Typography>
                                <Chip
                                  label={`Grupo (${row.groupParticipants.length} part.)`}
                                  size="small"
                                  onClick={() => {
                                    setGroupParticipants(row.groupParticipants);
                                    setGroupModalOpen(true);
                                  }}
                                  sx={{
                                    bgcolor: '#f3e8ff',
                                    color: '#6b21a8',
                                    fontWeight: 900,
                                    fontSize: 9,
                                    height: 18,
                                    cursor: 'pointer',
                                    width: 'fit-content',
                                    border: '1px solid #e9d5ff',
                                    '&:hover': { bgcolor: '#e9d5ff' }
                                  }}
                                />
                              </Stack>
                            ) : (
                              <>
                                <Typography sx={{ fontWeight: 800, fontSize: 11.5 }}>{row.solicitante?.nombre}</Typography>
                                <Typography sx={{ color: '#64748b', fontSize: 10.5 }}>{row.solicitante?.username}</Typography>
                              </>
                            )}
                          </TableCell>
                          <TableCell sx={{ py: 0.8, px: 0.8 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: 11.5 }}>{row.jefe?.nombre}</Typography>
                            <Typography sx={{ color: '#64748b', fontSize: 10.5 }}>{row.jefe?.email}</Typography>
                          </TableCell>
                          <TableCell sx={{ py: 0.8, px: 0.8, maxWidth: 200 }}>
                            <Typography sx={{ fontWeight: 800, fontSize: 11, color: '#334155', textTransform: 'capitalize' }}>
                              {(row.datos_formulario?.salida?.tipo || '').replace(/_/g, ' ')}
                            </Typography>
                            <Typography sx={{ color: '#64748b', fontSize: 10, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={row.datos_formulario?.salida?.motivo || row.datos_formulario?.salida?.otraDescripcion || 'Sin descripción'}>
                              {row.datos_formulario?.salida?.motivo || row.datos_formulario?.salida?.otraDescripcion || 'Sin descripción'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 0.8, px: 0.8 }}>
                            <Stack spacing={0.5} alignItems="flex-start">
                              <Tooltip title={getTrazabilidadTooltip(row)} arrow placement="left" sx={{ cursor: 'pointer' }}>
                                <Chip size="small" label={STATUS_LABELS[row.estado] || row.estado} sx={{ bgcolor: statusSx.bg, color: statusSx.color, fontWeight: 900, fontSize: 9, height: 18 }} />
                              </Tooltip>
                              {(() => {
                                const rejectionTrace = Array.isArray(row.trazabilidad)
                                  ? row.trazabilidad.find(t => ['rechazada_jefe', 'rechazada_gestion_humana'].includes(t.event))
                                  : null;
                                const justificacion = rejectionTrace?.detail?.justificacion;
                                if (!justificacion) return null;
                                return (
                                  <Tooltip title={justificacion} arrow>
                                    <Typography sx={{ color: '#ef4444', fontSize: 10, cursor: 'help', textDecoration: 'underline dotted', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      Motivo: {justificacion}
                                    </Typography>
                                  </Tooltip>
                                );
                              })()}
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ py: 0.8, px: 0.8, minWidth: 130 }}>
                            {row.reposicion_aplica ? (
                              <Stack spacing={0.6}>
                                <Chip
                                  size="small"
                                  label={mapReposicionEstado(row.reposicion_estado)}
                                  sx={{
                                    ...getReposicionChipColors(row.reposicion_estado),
                                    fontWeight: 800,
                                    fontSize: 9,
                                    height: 18,
                                    width: 'fit-content'
                                  }}
                                />
                                <Box sx={{ fontSize: 10, lineHeight: 1.4, color: '#334155' }}>
                                  <div><strong>Total:</strong> {formatElapsed(row.reposicion_minutos || row.tiempo_solicitado_minutos || 0)}</div>
                                  <div><strong>Abonado:</strong> {formatElapsed(row.reposicion_minutos_pagados || row.datos_formulario?.reposicion_minutos_pagados || 0)}</div>
                                  <div><strong>Pendiente:</strong> {(() => {
                                    const total = row.reposicion_minutos || row.tiempo_solicitado_minutos || 0;
                                    const pagado = row.reposicion_minutos_pagados || row.datos_formulario?.reposicion_minutos_pagados || 0;
                                    return formatElapsed(Math.max(0, total - pagado));
                                  })()}</div>
                                </Box>
                              </Stack>
                            ) : (
                              <Typography sx={{ fontSize: 10, color: '#64748b' }}>No aplica</Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ py: 0.8, px: 0.8, minWidth: 180, maxWidth: 260 }}>
                            {(() => {
                              const jefeObs = getJefeObservacion(row);
                              const ghObs = row.observacion_gestion_humana || '';
                              return (
                                <Stack spacing={0.8}>
                                  {jefeObs && (
                                    <Box>
                                      <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: '#475569', display: 'inline-block', mr: 0.5 }}>Jefe:</Typography>
                                      <Typography sx={{ fontSize: 9.5, color: '#64748b', fontStyle: 'italic', display: 'inline' }}>"{jefeObs}"</Typography>
                                    </Box>
                                  )}
                                  {ghObs ? (
                                    <Box>
                                      <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: '#0f766e', mb: 0.3 }}>Talento Humano:</Typography>
                                      <Box sx={{ fontSize: 9.5, color: '#334155', maxHeight: 60, overflowY: 'auto', bgcolor: '#f8fafc', p: 0.3, borderRadius: 1, border: '1px solid #e2e8f0' }}>
                                        {ghObs.split('\n').map((line, idx) => (
                                          <Typography key={idx} sx={{ fontSize: 9, lineHeight: 1.3, borderBottom: idx < ghObs.split('\n').length - 1 ? '1px dashed #e2e8f0' : 'none', pb: 0.3, mb: 0.3 }}>
                                            {line}
                                          </Typography>
                                        ))}
                                      </Box>
                                    </Box>
                                  ) : (
                                    !jefeObs && <Typography sx={{ fontSize: 9.5, color: '#94a3b8', fontStyle: 'italic' }}>Sin observaciones</Typography>
                                  )}
                                </Stack>
                              );
                            })()}
                          </TableCell>
                          <TableCell sx={{ py: 0.8, px: 0.8 }}>
                            {canManageAll ? (
                              <Stack direction="row" spacing={0.5}>
                                {row.reposicion_aplica && (
                                  <Tooltip title="Gestionar Reposición" arrow>
                                    <IconButton size="small" color="primary" onClick={() => handleRepOpen(row)}>
                                      <ManageHistoryIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {row.reposicion_aplica && (
                                  <Tooltip title="Editar" arrow>
                                    <IconButton size="small" onClick={() => handleEditOpen(row)}>
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                <Tooltip title="Eliminar" arrow>
                                  <IconButton size="small" color="error" onClick={() => handleDeleteOpen(row.id)}>
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            ) : (
                              row.reposicion_aplica ? (
                                canValidateReposicion ? (
                                  <Stack direction="row" spacing={0.7} alignItems="center">
                                    <Checkbox
                                      size="small"
                                      checked={row.reposicion_estado === 'cumplida'}
                                      disabled={row.estado !== 'finalizada' || updatingReposicionId === row.id}
                                      onChange={(event) => updateReposicion(row, event.target.checked ? 'cumplida' : 'programada')}
                                      sx={{ color: '#0f766e', '&.Mui-checked': { color: '#0f766e' } }}
                                    />
                                    <Box sx={{ minWidth: 96 }}>
                                      <Typography sx={{ fontSize: 12, fontWeight: 900, color: row.reposicion_estado === 'cumplida' ? '#0f766e' : '#64748b' }}>
                                        {row.reposicion_estado === 'cumplida' ? 'Validado' : 'Por validar'}
                                      </Typography>
                                      <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>
                                        {row.estado === 'finalizada' ? 'Talento Humano' : 'Esperar cierre'}
                                      </Typography>
                                    </Box>
                                    {row.reposicion_estado !== 'incumplida' && (
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        color="warning"
                                        disabled={row.estado !== 'finalizada' || updatingReposicionId === row.id}
                                        onClick={() => updateReposicion(row, 'incumplida')}
                                        sx={{ borderRadius: 2, fontSize: 11, fontWeight: 900 }}
                                      >
                                        Incumplida
                                      </Button>
                                    )}
                                  </Stack>
                                ) : (
                                  <Stack spacing={0.3}>
                                    <Typography sx={{ fontSize: 12, fontWeight: 900, color: row.reposicion_estado === 'cumplida' ? '#0f766e' : '#475569' }}>
                                      {row.reposicion_estado === 'cumplida' ? 'Validada por Talento Humano' : 'Pendiente de validacion'}
                                    </Typography>
                                    <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>
                                      Vista solo de consulta
                                    </Typography>
                                  </Stack>
                                )
                              ) : '-'
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[5, 10, 25]}
                component="div"
                count={groupedRows.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(e, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
                labelRowsPerPage="Filas por página:"
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
                sx={{
                  borderTop: '1px solid #e2e8f0',
                  '.MuiTablePagination-toolbar': { minHeight: 44 },
                  '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': { fontSize: 12.5 }
                }}
              />
            </Paper>
{/* Modal de Eliminacion */}
            <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
              <DialogTitle>Confirmar Eliminación</DialogTitle>
              <DialogContent>
                {(() => {
                  const targetRow = rows.find(r => r.id === deleteTargetId);
                  if (targetRow?.datos_formulario?.is_salida_multiple) {
                    return (
                      <>
                        <Typography sx={{ mb: 1 }}>
                          ¿Está seguro de que desea eliminar esta <strong>salida grupal</strong> permanentemente?
                        </Typography>
                        <Typography color="error" variant="caption" sx={{ display: 'block', fontWeight: 'bold' }}>
                          Esta acción eliminará las solicitudes de todos los participantes y no se puede deshacer.
                        </Typography>
                      </>
                    );
                  }
                  return (
                    <>
                      <Typography>¿Está seguro de que desea eliminar este reporte de salida permanentemente?</Typography>
                      <Typography color="error" variant="caption">Esta acción no se puede deshacer.</Typography>
                    </>
                  );
                })()}
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setDeleteConfirmOpen(false)} color="inherit">Cancelar</Button>
                <Button onClick={submitDelete} color="error" variant="contained" disableElevation>Eliminar</Button>
              </DialogActions>
            </Dialog>

            {/* Modal de Participantes de Salida Grupal */}
            <Dialog open={groupModalOpen} onClose={() => setGroupModalOpen(false)} maxWidth="md" fullWidth>
              <DialogTitle sx={{ fontWeight: 900, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                Participantes de la Salida Grupal
              </DialogTitle>
              <DialogContent>
                <TableContainer sx={{ mt: 2 }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                      <TableRow>
                        <TableCell><strong>Cédula</strong></TableCell>
                        <TableCell><strong>Nombre Completo</strong></TableCell>
                        <TableCell><strong>Correo</strong></TableCell>
                        <TableCell><strong>Dependencia</strong></TableCell>
                        <TableCell><strong>Cargo</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {groupParticipants.map((p, idx) => (
                        <TableRow key={p.id || idx}>
                          <TableCell>{p.documento}</TableCell>
                          <TableCell>{p.nombre}</TableCell>
                          <TableCell>{p.correo}</TableCell>
                          <TableCell>{p.dependencia}</TableCell>
                          <TableCell>{p.cargo}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </DialogContent>
              <DialogActions sx={{ bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <Button onClick={() => setGroupModalOpen(false)} variant="contained" disableElevation color="primary">
                  Cerrar
                </Button>
              </DialogActions>
            </Dialog>

            {/* Modal de Corregir Reposición */}
            <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle>Corregir Reposición (Administrador)</DialogTitle>
              <DialogContent>
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Consecutivo: {editTarget?.consecutivo}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    Colaborador(a): {editTarget?.solicitante?.nombre} ({editTarget?.solicitante?.documento})
                  </Typography>

                  <TextField
                    fullWidth
                    size="small"
                    margin="normal"
                    type="number"
                    label="Horas Totales Adeudadas (Corregir)"
                    inputProps={{ min: 0, step: 1 }}
                    value={Math.round(editData.tiempo_solicitado_minutos / 60)}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setEditData({...editData, tiempo_solicitado_minutos: parseInt(val || 0, 10) * 60});
                    }}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    margin="normal"
                    type="number"
                    label="Horas Repuestas / Abonadas (Corregir)"
                    inputProps={{ min: 0, step: 1 }}
                    value={Math.round(editData.reposicion_minutos_pagados / 60)}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setEditData({...editData, reposicion_minutos_pagados: parseInt(val || 0, 10) * 60});
                    }}
                  />
                  <TextField
                    fullWidth
                    required
                    size="small"
                    margin="normal"
                    multiline
                    minRows={3}
                    label="Observaciones de la corrección *"
                    placeholder="Describa brevemente el motivo del ajuste o corrección de horas..."
                    value={editData.observacion}
                    onChange={(e) => setEditData({...editData, observacion: e.target.value})}
                  />
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setEditDialogOpen(false)} color="inherit">Cancelar</Button>
                <Button 
                  onClick={submitEdit} 
                  color="primary" 
                  variant="contained" 
                  disableElevation
                  disabled={!editData.observacion || !editData.observacion.trim()}
                >
                  Guardar Cambios
                </Button>
              </DialogActions>
            </Dialog>

            {/* Modal de Gestionar Reposición */}
            <Dialog open={repDialogOpen} onClose={() => setRepDialogOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle>Gestionar Reposición (Horas)</DialogTitle>
              <DialogContent>
                <Box sx={{ mb: 2, mt: 1 }}>
                  <Typography variant="subtitle2">Consecutivo: {repTarget?.consecutivo}</Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>Tiempo Total Solicitado: {formatElapsed(repTarget?.reposicion_minutos || repTarget?.tiempo_solicitado_minutos || 0)}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>Tiempo Abonado: {formatElapsed(repTarget?.reposicion_minutos_pagados || repTarget?.datos_formulario?.reposicion_minutos_pagados || 0)}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 'bold', color: '#b45309' }}>Saldo pendiente: {getHorasPendientes(repTarget)}</Typography>
                </Box>

                {(() => {
                  const totalMinutos = repTarget?.reposicion_minutos || repTarget?.tiempo_solicitado_minutos || 0;
                  const minutosPagados = repTarget?.reposicion_minutos_pagados || repTarget?.datos_formulario?.reposicion_minutos_pagados || 0;
                  const minutosPendientes = totalMinutos - minutosPagados;
                  const horasPendientes = minutosPendientes / 60;
                  
                  if (horasPendientes <= 0) {
                    return (
                      <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                        El/la colaborador(a) ya repuso la totalidad del tiempo pendiente para esta salida.
                      </Alert>
                    );
                  }

                  if (!repHorasAbonadas) {
                    return (
                      <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                        Ingrese las horas repuestas por el colaborador (no puede ser vacío ni 0).
                      </Alert>
                    );
                  }

                  if (repHorasAbonadas) {
                    const val = Number(repHorasAbonadas);
                    if (val <= 0) {
                      return <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>No se permiten valores negativos ni ceros.</Alert>;
                    }
                    if (val > horasPendientes) {
                      return (
                        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                          La cantidad ingresada ({val} hrs) supera el saldo pendiente de {horasPendientes.toFixed(1)} horas.
                        </Alert>
                      );
                    }
                    const restante = horasPendientes - val;
                    if (restante === 0) {
                      return <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>Correcto. La deuda quedará totalmente saldada.</Alert>;
                    }
                    return (
                      <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                        Correcto. Quedará un saldo pendiente de {restante.toFixed(1)} horas.
                      </Alert>
                    );
                  }
                  return null;
                })()}

                <TextField
                  label="Horas a abonar (Repuestas hoy)"
                  type="number"
                  value={repHorasAbonadas}
                  onChange={(e) => setRepHorasAbonadas(e.target.value.replace(/[^0-9]/g, ''))}
                  fullWidth
                  margin="normal"
                  size="small"
                  disabled={(() => {
                    const totalMinutos = repTarget?.reposicion_minutos || repTarget?.tiempo_solicitado_minutos || 0;
                    const minutosPagados = repTarget?.reposicion_minutos_pagados || repTarget?.datos_formulario?.reposicion_minutos_pagados || 0;
                    return (totalMinutos - minutosPagados) <= 0;
                  })()}
                  inputProps={{ min: 0, step: 1 }}
                  helperText="Ingrese las horas repuestas como número entero (ej: 2). El saldo se descontará automáticamente."
                />

                <TextField
                  select
                  label="Estado de Reposición"
                  value={repEstado}
                  onChange={(e) => setRepEstado(e.target.value)}
                  fullWidth
                  margin="normal"
                  size="small"
                  disabled={(() => {
                    const totalMinutos = repTarget?.reposicion_minutos || repTarget?.tiempo_solicitado_minutos || 0;
                    const minutosPagados = repTarget?.reposicion_minutos_pagados || repTarget?.datos_formulario?.reposicion_minutos_pagados || 0;
                    return (totalMinutos - minutosPagados) <= 0;
                  })()}
                >
                  <MenuItem value="pendiente">Pendiente</MenuItem>
                  <MenuItem value="cumplida">Cumplida</MenuItem>
                </TextField>

                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  margin="normal"
                  label="Comentarios / Observaciones de esta sesión"
                  value={repObservacion}
                  onChange={(e) => setRepObservacion(e.target.value)}
                  placeholder="Ej: Se abona 1.5 horas por reposición realizada en la tarde..."
                  size="small"
                  disabled={(() => {
                    const totalMinutos = repTarget?.reposicion_minutos || repTarget?.tiempo_solicitado_minutos || 0;
                    const minutosPagados = repTarget?.reposicion_minutos_pagados || repTarget?.datos_formulario?.reposicion_minutos_pagados || 0;
                    return (totalMinutos - minutosPagados) <= 0;
                  })()}
                />

                {renderObservationHistory(getJefeObservacion(repTarget), repTarget?.observacion_gestion_humana, repTarget)}
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setRepDialogOpen(false)} color="inherit">Cancelar</Button>
                <Button
                  onClick={submitRep}
                  color="primary"
                  variant="contained"
                  disableElevation
                  disabled={(() => {
                    const totalMinutos = repTarget?.reposicion_minutos || repTarget?.tiempo_solicitado_minutos || 0;
                    const minutosPagados = repTarget?.reposicion_minutos_pagados || repTarget?.datos_formulario?.reposicion_minutos_pagados || 0;
                    const minutosPendientes = totalMinutos - minutosPagados;
                    if (minutosPendientes <= 0) return true;
                    if (!repHorasAbonadas || Number(repHorasAbonadas) <= 0) return true;
                    if (Number(repHorasAbonadas) > (minutosPendientes / 60)) return true;
                    if (minutosPendientes - (Number(repHorasAbonadas) * 60) <= 0 && repEstado === 'pendiente') return true;
                    return false;
                  })()}
                >
                  Actualizar Saldo
                </Button>
              </DialogActions>
            </Dialog>
          </>
        )}
      </Box>
    </Fade>
  );
}

export default ReporteSalidaSeguimiento;
