import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Autocomplete, Avatar, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControl, FormControlLabel, FormGroup, Grid, IconButton, InputLabel,
  LinearProgress, MenuItem, Paper, Select, Stack, Tab, Tabs, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AlarmRoundedIcon from '@mui/icons-material/AlarmRounded';
import AssignmentIndRoundedIcon from '@mui/icons-material/AssignmentIndRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import EditCalendarRoundedIcon from '@mui/icons-material/EditCalendarRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import FilterAltOffRoundedIcon from '@mui/icons-material/FilterAltOffRounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import OutboxRoundedIcon from '@mui/icons-material/OutboxRounded';
import PendingActionsRoundedIcon from '@mui/icons-material/PendingActionsRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import ThumbUpAltRoundedIcon from '@mui/icons-material/ThumbUpAltRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useAuth } from '../../context/AuthContext';
import oficinaJuridicaService from '../../services/oficinaJuridicaService';
import {
  addBusinessDays,
  addCalendarDays,
  diffBusinessDays,
  diffCalendarDays,
  formatDateBrief,
  formatDateDetailed,
  getTermAlert,
  DERECHO_PETICION_PRESETS
} from '../../utils/juridicaTerms';

const COLORS = {
  navy: '#0b1f45',
  blue: '#2358d5',
  cyan: '#0e7490',
  orange: '#d97706',
  green: '#047857',
  red: '#dc2626',
  ink: '#172033'
};

const STATE = {
  pendiente_clasificacion: ['Pendiente de clasificación', '#b45309', '#fff7ed'],
  asignado: ['Asignado', '#1d4ed8', '#eff6ff'],
  en_estudio: ['En estudio', '#0369a1', '#ecfeff'],
  devuelto_informacion: ['Devuelto por información', '#be123c', '#fff1f2'],
  respuesta_revision: ['Respuesta en revisión', '#7c3aed', '#f5f3ff'],
  aprobado_jefatura: ['Aprobado por jefatura', '#047857', '#ecfdf5'],
  pendiente_radicacion_salida: ['Pendiente de radicación', '#b45309', '#fffbeb'],
  entregado: ['Entregado', '#15803d', '#f0fdf4'],
  cerrado: ['Cerrado', '#334155', '#f1f5f9'],
  cancelado: ['Cancelado', '#991b1b', '#fef2f2']
};

const GROUPS = [
  'Derechos de petición',
  'Tutelas',
  'Requerimientos',
  'Contratación',
  'Convenios',
  'Normatividad',
  'Conceptos',
  'Procesos disciplinarios',
  'Otro'
];

const ACTIONS = {
  asesor: [
    ['en_estudio', 'Confirmar recibido e Iniciar estudio'],
    ['respuesta_revision', 'Enviar a revisión de jefatura']
  ],
  jefatura: [
    ['aprobado_jefatura', 'Aprobar respuesta (Listo para Despacho)'],
    ['devuelto_informacion', 'Devolver al asesor con observaciones / retroalimentación'],
    ['pendiente_radicacion_salida', 'Enviar a radicación de salida'],
    ['entregado', 'Marcar entregado'],
    ['cerrado', 'Cerrar expediente']
  ],
  secretaria: [
    ['pendiente_radicacion_salida', 'Registrar radicado de salida'],
    ['entregado', 'Marcar entregado y despachado al peticionario'],
    ['cerrado', 'Cerrar expediente']
  ],
  administrador: [
    ['en_estudio', 'Confirmar recibido e Iniciar estudio'],
    ['respuesta_revision', 'Enviar a revisión'],
    ['aprobado_jefatura', 'Aprobar respuesta'],
    ['devuelto_informacion', 'Devolver con observaciones'],
    ['pendiente_radicacion_salida', 'Radicar salida'],
    ['entregado', 'Entregar'],
    ['cerrado', 'Cerrar']
  ]
};

const getAvailableActionsForRole = (role, currentCase) => {
  const base = ACTIONS[role] || [];
  if (!currentCase) return base;
  if (role === 'asesor') {
    if (['asignado', 'devuelto_informacion'].includes(currentCase.estado)) {
      return base.filter(([val]) => val === 'en_estudio');
    }
    if (currentCase.estado === 'en_estudio') {
      return base.filter(([val]) => val === 'respuesta_revision');
    }
    return [];
  }
  if (role === 'secretaria') {
    if (['aprobado_jefatura', 'pendiente_radicacion_salida'].includes(currentCase.estado)) {
      return base.filter(([val]) => ['pendiente_radicacion_salida', 'entregado', 'cerrado'].includes(val));
    }
    return [];
  }
  return base;
};

const emptyForm = {
  asunto: '',
  interesado: '',
  descripcion: '',
  grupo: 'Derechos de petición',
  clase: '',
  nivel: 'Media',
  dependencia_solicitante: '',
  fecha_limite: '',
  radicado: '',
  forma_recepcion: 'Aplicativo',
  dias_habiles_calculados: null,
  regla_aplicada: ''
};

const GROUP_THEMES = {
  'derechos de petición': { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  'tutelas': { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  'requerimientos': { color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  'contratación': { color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  'convenios': { color: '#0e7490', bg: '#ecfeff', border: '#a5f3fc' },
  'normatividad': { color: '#4338ca', bg: '#eef2ff', border: '#c7d2fe' },
  'conceptos': { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  'procesos disciplinarios': { color: '#be123c', bg: '#fff1f2', border: '#fecdd3' },
  'otro': { color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' }
};

const getGroupTheme = (grupo) => {
  if (!grupo) return GROUP_THEMES['otro'];
  const key = String(grupo).toLowerCase().trim();
  return GROUP_THEMES[key] || GROUP_THEMES['otro'];
};

const getInitials = (name) => {
  if (!name) return '??';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatUserName = (name) => {
  if (!name) return 'Sin asignar';
  return String(name)
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

const StatusChip = ({ value }) => {
  const meta = STATE[value] || [value || 'Sin estado', '#475569', '#f1f5f9'];
  return (
    <Chip
      size="small"
      icon={
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: meta[1],
            ml: 0.8,
            boxShadow: `0 0 4px ${meta[1]}80`
          }}
        />
      }
      label={meta[0]}
      sx={{
        color: meta[1],
        bgcolor: meta[2],
        fontWeight: 800,
        border: `1px solid ${meta[1]}30`,
        fontSize: '0.69rem',
        height: 22,
        maxWidth: 130,
        '& .MuiChip-label': { px: 0.7, overflow: 'hidden', textOverflow: 'ellipsis' }
      }}
    />
  );
};

const TermAlertChip = ({ fechaLimite, estado, fechaIngreso }) => {
  const alert = getTermAlert(fechaLimite, estado, fechaIngreso);
  const formattedLimit = fechaLimite ? formatDateBrief(fechaLimite) : null;
  const tooltipText = alert.sublabel
    ? alert.sublabel
    : formattedLimit
    ? `Límite: ${formattedLimit} (${alert.label})`
    : alert.label;

  return (
    <Tooltip title={tooltipText} arrow placement="top">
      <Chip
        size="small"
        icon={alert.urgent ? <AlarmRoundedIcon sx={{ fontSize: '13px !important', color: `${alert.color} !important` }} /> : undefined}
        label={alert.badge || alert.label}
        sx={{
          color: alert.color,
          bgcolor: alert.bg,
          fontWeight: 850,
          border: `1px solid ${alert.borderColor}`,
          fontSize: '0.69rem',
          height: 22,
          maxWidth: 135,
          cursor: 'pointer',
          transition: 'transform 0.15s ease',
          '&:hover': { transform: 'scale(1.03)' },
          '& .MuiChip-label': { px: 0.7 },
          '& .MuiChip-icon': { ml: 0.5, mr: -0.3 }
        }}
      />
    </Tooltip>
  );
};

const formatDate = (value) => formatDateBrief(value);

const saveBlob = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

function Metric({
  icon: Icon,
  label,
  value,
  helper,
  onClick,
  active,
  pastelBg = '#f0f7ff',
  pastelBorder = '#dbeafe',
  accentColor = '#1d4ed8'
}) {
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 1.4,
        px: 1.6,
        borderRadius: 3,
        border: active ? `2px solid ${accentColor}` : `1px solid ${pastelBorder}`,
        bgcolor: pastelBg,
        flex: '1 1 155px',
        minWidth: 150,
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: active ? `0 6px 18px ${accentColor}25` : '0 1px 3px rgba(15,23,42,0.03)',
        transition: 'all .2s ease',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': onClick
          ? {
              transform: 'translateY(-2px)',
              borderColor: accentColor,
              boxShadow: `0 8px 20px ${accentColor}20`
            }
          : {}
      }}
    >
      {active && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3.5,
            bgcolor: accentColor
          }}
        />
      )}
      <Stack direction="row" spacing={1.2} alignItems="center">
        <Avatar
          sx={{
            bgcolor: '#ffffff',
            color: accentColor,
            width: 38,
            height: 38,
            borderRadius: 2,
            border: `1px solid ${pastelBorder}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}
        >
          <Icon sx={{ fontSize: 20 }} />
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="caption"
            sx={{
              color: '#64748b',
              fontWeight: 850,
              letterSpacing: 0.4,
              fontSize: '0.67rem',
              display: 'block',
              textTransform: 'uppercase',
              lineHeight: 1.2
            }}
          >
            {label}
          </Typography>
          <Typography
            sx={{
              fontWeight: 950,
              color: '#0f172a',
              lineHeight: 1.15,
              fontSize: '1.4rem'
            }}
          >
            {value ?? 0}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: active ? accentColor : '#94a3b8',
              fontSize: '0.66rem',
              fontWeight: active ? 750 : 500,
              display: 'block',
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {helper}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function QuickScopeCard({
  active,
  onClick,
  icon: Icon,
  title,
  subtitle,
  count,
  activeColor = '#0b1f45',
  inactiveIconColor = '#2563eb',
  badgeBg = '#f1f5f9',
  badgeColor = '#334155',
  urgent = false
}) {
  return (
    <Button
      onClick={onClick}
      variant="text"
      sx={{
        py: 1,
        px: 1.6,
        borderRadius: 2.5,
        border: active
          ? `2px solid ${activeColor}`
          : urgent && count > 0
          ? '1.5px solid #f87171'
          : '1px solid #e2e8f0',
        bgcolor: active
          ? activeColor
          : urgent && count > 0
          ? '#fff5f5'
          : '#ffffff',
        color: active ? '#ffffff' : '#1e293b',
        textTransform: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1.3,
        flex: { xs: '1 1 auto', md: '0 0 auto' },
        boxShadow: active
          ? `0 6px 18px ${activeColor}40`
          : urgent && count > 0
          ? '0 2px 8px rgba(239, 68, 68, 0.12)'
          : '0 1px 3px rgba(0,0,0,0.03)',
        transition: 'all 0.18s ease-in-out',
        cursor: 'pointer',
        '&:hover': {
          bgcolor: active ? activeColor : '#f8fafc',
          borderColor: active ? activeColor : inactiveIconColor,
          transform: 'translateY(-2px)',
          boxShadow: active
            ? `0 8px 22px ${activeColor}45`
            : '0 4px 12px rgba(0,0,0,0.07)'
        }
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          bgcolor: active ? 'rgba(255, 255, 255, 0.22)' : `${inactiveIconColor}15`,
          color: active ? '#ffffff' : inactiveIconColor,
          flexShrink: 0
        }}
      >
        <Icon sx={{ fontSize: 19 }} />
      </Box>

      <Box sx={{ textAlign: 'left', minWidth: 0 }}>
        <Typography
          sx={{
            fontWeight: active ? 900 : 750,
            fontSize: '0.84rem',
            lineHeight: 1.2,
            color: active ? '#ffffff' : '#1e293b',
            whiteSpace: 'nowrap'
          }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography
            sx={{
              fontSize: '0.69rem',
              color: active ? 'rgba(255, 255, 255, 0.82)' : '#64748b',
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
              fontWeight: 500
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>

      <Box
        component="span"
        sx={{
          ml: 0.4,
          px: 1,
          py: 0.28,
          borderRadius: 999,
          fontSize: '0.76rem',
          fontWeight: 950,
          lineHeight: 1,
          flexShrink: 0,
          bgcolor: active ? '#ffffff' : badgeBg,
          color: active ? activeColor : badgeColor,
          border: active ? 'none' : `1px solid ${badgeBg === '#fee2e2' ? '#fca5a5' : '#e2e8f0'}`
        }}
      >
        {Number(count || 0).toLocaleString()}
      </Box>
    </Button>
  );
}

export default function JuridicaWorkflowPanel() {
  const { user: authUser } = useAuth();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [profile, setProfile] = useState({ role: 'solicitante', team: [] });
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({});
  const [internalUsers, setInternalUsers] = useState([]);

  // Filtros
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [termFilter, setTermFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState(''); // 'mis_asignados', 'vencidos', 'por_vencer', 'salidas'

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const handleSelectScope = (scope) => {
    if (scopeFilter === scope) {
      setScopeFilter('');
    } else {
      setScopeFilter(scope);
      setStateFilter('');
      setTermFilter('');
    }
    setPage(0);
  };

  const handleSelectStateMetric = (st) => {
    if (stateFilter === st && !scopeFilter && !termFilter) {
      handleSelectAll();
      return;
    }
    setStateFilter(st);
    setTermFilter('');
    setScopeFilter('');
    setPage(0);
  };

  const handleSelectAll = () => {
    setScopeFilter('');
    setStateFilter('');
    setTermFilter('');
    setSearch('');
    setGroupFilter('');
    setPage(0);
  };

  // Radicación
  const [createOpen, setCreateOpen] = useState(false);
  const [createFiles, setCreateFiles] = useState([]);
  const [form, setForm] = useState(emptyForm);

  // Edición completa del expediente si hubo error
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null,
    nri: '',
    asunto: '',
    interesado: '',
    dependencia_solicitante: '',
    grupo: '',
    clase: '',
    nivel: 'Media',
    radicado: '',
    fecha_ingreso: '',
    fecha_limite: '',
    descripcion: '',
    observaciones: '',
    despacho: ''
  });

  // Detalle y trazabilidad
  const [selected, setSelected] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Asignación de jefatura
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignment, setAssignment] = useState({
    responsables_ids: [],
    responsable_id: '',
    secretario_id: '',
    nivel: 'Media',
    fecha_limite: '',
    comentario: '',
    dias_calculados: null
  });

  // Visto Bueno de Concepto Jurídico
  const [vbOpen, setVbOpen] = useState(false);
  const [vbComentario, setVbComentario] = useState('');

  // Prórroga o ajuste de término
  const [prorrogaOpen, setProrrogaOpen] = useState(false);
  const [prorrogaData, setProrrogaData] = useState({ fecha_limite: '', motivo: '' });

  // Transición de estado
  const [transition, setTransition] = useState({ estado: '', comentario: '', radicado: '', despacho: '', resultado: '' });

  const importRef = useRef();
  const attachmentRef = useRef();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [p, list, summary, usersRes] = await Promise.all([
        oficinaJuridicaService.getProfile(),
        oficinaJuridicaService.list(),
        oficinaJuridicaService.stats(),
        oficinaJuridicaService.getInternalUsers().catch(() => ({ data: [] }))
      ]);
      setProfile(p.data);
      setRows(list.data || []);
      setStats(summary.data || {});
      setInternalUsers(usersRes.data || []);
      if (p.data?.role === 'asesor') {
        setScopeFilter((prev) => prev || 'mis_asignados');
      }
    } catch (e) {
      setError(e.response?.data?.message || 'No fue posible cargar la gestión jurídica.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Usuario efectivo para permisos y filtrado (soporta simulación de perspectiva)
  const effectiveUser = useMemo(() => {
    if (profile.isSimulation && profile.actor) {
      return profile.actor;
    }
    return authUser;
  }, [profile, authUser]);

  // Contabilización en vivo de términos
  const termCounts = useMemo(() => {
    let vencidos = 0;
    let porVencer = 0;
    let enTermino = 0;
    let sinLimite = 0;

    rows.forEach((row) => {
      const alert = getTermAlert(row.fecha_limite, row.estado, row.fecha_ingreso);
      if (alert.status === 'vencido') vencidos++;
      else if (alert.status === 'urgente' || alert.status === 'por_vencer' || alert.status === 'vence_hoy') porVencer++;
      else if (alert.status === 'en_termino') enTermino++;
      else if (alert.status === 'sin_limite') sinLimite++;
    });

    return { vencidos, porVencer, enTermino, sinLimite };
  }, [rows]);

  // Métricas avanzadas segregadas por rol institucional
  const roleMetrics = useMemo(() => {
    const uid = Number(effectiveUser?.id);
    let porAsignar = 0;
    let enEstudio = 0;
    let enRevision = 0;
    let listosDespacho = 0;
    let devueltos = 0;

    let misAsignados = 0;
    let misPendientes = 0;
    let misEnEstudio = 0;
    let misDevueltos = 0;
    let misEnRevision = 0;
    let misFinalizados = 0;

    rows.forEach((r) => {
      const respId = Number(r.responsable_id);
      const isDirect = respId === uid || r.metadata?.responsable_snapshot?.id === uid;
      const ids = (r.metadata?.responsables_ids || []).map(Number);
      const isMine = uid && (isDirect || ids.includes(uid));

      if (r.estado === 'pendiente_clasificacion') porAsignar++;
      if (['asignado', 'en_estudio'].includes(r.estado)) enEstudio++;
      if (r.estado === 'respuesta_revision') enRevision++;
      if (['aprobado_jefatura', 'pendiente_radicacion_salida'].includes(r.estado)) listosDespacho++;
      if (r.estado === 'devuelto_informacion') devueltos++;

      if (isMine) {
        misAsignados++;
        if (r.estado === 'asignado') misPendientes++;
        if (r.estado === 'en_estudio') misEnEstudio++;
        if (r.estado === 'devuelto_informacion') misDevueltos++;
        if (r.estado === 'respuesta_revision') misEnRevision++;
        if (['entregado', 'cerrado'].includes(r.estado)) misFinalizados++;
      }
    });

    return {
      porAsignar,
      enEstudio,
      enRevision,
      listosDespacho,
      devueltos,
      misAsignados,
      misPendientes,
      misEnEstudio,
      misDevueltos,
      misEnRevision,
      misFinalizados
    };
  }, [rows, effectiveUser]);

  const myAssignedCount = roleMetrics.misAsignados;

  const salidasCount = useMemo(() => {
    return rows.filter((r) => ['aprobado_jefatura', 'pendiente_radicacion_salida', 'respuesta_revision'].includes(r.estado)).length;
  }, [rows]);

  // Filtrado compuesto con scopes específicos por rol
  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const query = search.toLowerCase();
      const matchesSearch =
        !query ||
        [row.nri, row.radicado, row.asunto, row.interesado, row.dependencia_solicitante, row.responsable?.nombre].some(
          (v) => String(v || '').toLowerCase().includes(query)
        );

      const matchesState = !stateFilter || row.estado === stateFilter;
      const matchesGroup = !groupFilter || row.grupo === groupFilter;

      let matchesScope = true;
      if (scopeFilter === 'mis_asignados') {
        const uid = Number(effectiveUser?.id);
        const respId = Number(row.responsable_id);
        const isDirect = respId === uid || row.metadata?.responsable_snapshot?.id === uid;
        const ids = (row.metadata?.responsables_ids || []).map(Number);
        matchesScope = isDirect || ids.includes(uid);
      } else if (scopeFilter === 'por_asignar') {
        matchesScope = row.estado === 'pendiente_clasificacion';
      } else if (scopeFilter === 'en_estudio') {
        matchesScope = ['asignado', 'en_estudio'].includes(row.estado);
      } else if (scopeFilter === 'en_revision') {
        matchesScope = row.estado === 'respuesta_revision';
      } else if (scopeFilter === 'ready_dispatch') {
        matchesScope = ['aprobado_jefatura', 'pendiente_radicacion_salida'].includes(row.estado);
      } else if (scopeFilter === 'devueltos') {
        matchesScope = row.estado === 'devuelto_informacion';
      } else if (scopeFilter === 'mis_pendientes') {
        const uid = Number(effectiveUser?.id);
        const respId = Number(row.responsable_id);
        const isDirect = respId === uid || row.metadata?.responsable_snapshot?.id === uid;
        const ids = (row.metadata?.responsables_ids || []).map(Number);
        matchesScope = (isDirect || ids.includes(uid)) && row.estado === 'asignado';
      } else if (scopeFilter === 'mis_en_estudio') {
        const uid = Number(effectiveUser?.id);
        const respId = Number(row.responsable_id);
        const isDirect = respId === uid || row.metadata?.responsable_snapshot?.id === uid;
        const ids = (row.metadata?.responsables_ids || []).map(Number);
        matchesScope = (isDirect || ids.includes(uid)) && row.estado === 'en_estudio';
      } else if (scopeFilter === 'mis_devueltos') {
        const uid = Number(effectiveUser?.id);
        const respId = Number(row.responsable_id);
        const isDirect = respId === uid || row.metadata?.responsable_snapshot?.id === uid;
        const ids = (row.metadata?.responsables_ids || []).map(Number);
        matchesScope = (isDirect || ids.includes(uid)) && row.estado === 'devuelto_informacion';
      } else if (scopeFilter === 'mis_en_revision') {
        const uid = Number(effectiveUser?.id);
        const respId = Number(row.responsable_id);
        const isDirect = respId === uid || row.metadata?.responsable_snapshot?.id === uid;
        const ids = (row.metadata?.responsables_ids || []).map(Number);
        matchesScope = (isDirect || ids.includes(uid)) && row.estado === 'respuesta_revision';
      } else if (scopeFilter === 'mis_finalizados') {
        const uid = Number(effectiveUser?.id);
        const respId = Number(row.responsable_id);
        const isDirect = respId === uid || row.metadata?.responsable_snapshot?.id === uid;
        const ids = (row.metadata?.responsables_ids || []).map(Number);
        matchesScope = (isDirect || ids.includes(uid)) && ['entregado', 'cerrado'].includes(row.estado);
      } else if (scopeFilter === 'vencidos') {
        const alert = getTermAlert(row.fecha_limite, row.estado, row.fecha_ingreso);
        matchesScope = alert.status === 'vencido';
      } else if (scopeFilter === 'por_vencer') {
        const alert = getTermAlert(row.fecha_limite, row.estado, row.fecha_ingreso);
        matchesScope = alert.status === 'urgente' || alert.status === 'por_vencer' || alert.status === 'vence_hoy';
      } else if (scopeFilter === 'salidas') {
        matchesScope = ['aprobado_jefatura', 'pendiente_radicacion_salida', 'respuesta_revision'].includes(row.estado);
      }

      let matchesTerm = true;
      if (termFilter) {
        const alert = getTermAlert(row.fecha_limite, row.estado, row.fecha_ingreso);
        if (termFilter === 'vencidos') matchesTerm = alert.status === 'vencido';
        else if (termFilter === 'por_vencer') matchesTerm = alert.status === 'urgente' || alert.status === 'por_vencer' || alert.status === 'vence_hoy';
        else if (termFilter === 'en_termino') matchesTerm = alert.status === 'en_termino';
        else if (termFilter === 'sin_limite') matchesTerm = alert.status === 'sin_limite';
        else if (termFilter === 'finalizados') matchesTerm = alert.status === 'finalizado';
      }

      return matchesSearch && matchesState && matchesGroup && matchesScope && matchesTerm;
    });
  }, [rows, search, stateFilter, groupFilter, scopeFilter, termFilter, effectiveUser]);

  const visibleRows = useMemo(() => {
    return filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  useEffect(() => {
    setPage(0);
  }, [search, stateFilter, groupFilter, scopeFilter, termFilter]);

  const advisers = useMemo(() => profile.team.filter((u) => ['asesor', 'jefatura'].includes(u.juridica_rol)), [profile.team]);
  const secretaries = useMemo(() => profile.team.filter((u) => u.juridica_rol === 'secretaria'), [profile.team]);
  const jefaturaList = useMemo(() => profile.team.filter((u) => u.juridica_rol === 'jefatura'), [profile.team]);
  const secretariaList = useMemo(() => profile.team.filter((u) => u.juridica_rol === 'secretaria'), [profile.team]);
  const asesorList = useMemo(() => profile.team.filter((u) => u.juridica_rol === 'asesor'), [profile.team]);

  const isSuperAdmin = String(authUser?.email || '').trim().toLowerCase() === 'sgc@unicesmag.edu.co';
  const isJefatura = profile.role === 'jefatura';
  // La secretaría y los asistentes NO pueden asignar expedientes. Solo la Jefatura o el SuperAdmin (en vista real)
  const canAssign = (!profile.isSimulation && isSuperAdmin) || isJefatura;
  // Solo Secretaría, Jefatura y Administrador pueden modificar datos de radicación básica
  const canEditCase = ['administrador', 'jefatura', 'secretaria'].includes(profile.role);
  // Solo Jefatura y Administrador pueden conceder prórrogas de términos legales
  const canProrroga = ['administrador', 'jefatura'].includes(profile.role);

  const handleSwitchPerspective = async (userId) => {
    setBusy(true);
    try {
      oficinaJuridicaService.setSimulatedUserId(userId);
      await load();
      if (userId) {
        setNotice('Modo de simulación activado. Ahora estás visualizando la interfaz exactamente como este funcionario.');
      } else {
        setNotice('Has vuelto a tu vista de SuperAdmin (Control Total).');
      }
    } catch (err) {
      setError('Error al cambiar de perspectiva de usuario.');
    } finally {
      setBusy(false);
    }
  };

  const refreshSelected = async (id) => {
    const response = await oficinaJuridicaService.get(id);
    setSelected(response.data);
  };

  const refreshStats = async () => {
    const response = await oficinaJuridicaService.stats();
    setStats(response.data || {});
  };

  const replaceRow = (updated) => {
    setRows((current) => current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
  };

  // Apertura del modal de edición
  const openEdit = (row) => {
    setEditForm({
      id: row.id,
      nri: row.nri || '',
      asunto: row.asunto || '',
      interesado: row.interesado || '',
      dependencia_solicitante: row.dependencia_solicitante || '',
      grupo: row.grupo || 'Derechos de petición',
      clase: row.clase || '',
      nivel: row.nivel || 'Media',
      radicado: row.radicado || '',
      fecha_ingreso: row.fecha_ingreso ? String(row.fecha_ingreso).slice(0, 10) : '',
      fecha_limite: row.fecha_limite ? String(row.fecha_limite).slice(0, 10) : '',
      descripcion: row.descripcion || '',
      observaciones: row.observaciones || '',
      despacho: row.despacho || ''
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.asunto.trim() || !editForm.interesado.trim()) {
      return setError('Asunto e interesado son obligatorios para guardar.');
    }
    setBusy(true);
    setError('');
    try {
      const response = await oficinaJuridicaService.update(editForm.id, {
        asunto: editForm.asunto,
        interesado: editForm.interesado,
        dependencia_solicitante: editForm.dependencia_solicitante,
        grupo: editForm.grupo,
        clase: editForm.clase,
        nivel: editForm.nivel,
        radicado: editForm.radicado,
        fecha_ingreso: editForm.fecha_ingreso,
        fecha_limite: editForm.fecha_limite,
        descripcion: editForm.descripcion,
        observaciones: editForm.observaciones,
        despacho: editForm.despacho,
        comentario: 'Información del expediente editada y corregida por el usuario.'
      });
      replaceRow(response.data);
      if (selected && selected.id === editForm.id) {
        setSelected(response.data);
      }
      setEditOpen(false);
      setNotice(`Expediente NRI ${editForm.nri} corregido y actualizado correctamente.`);
      await Promise.all([refreshStats()]);
    } catch (e) {
      setError(e.response?.data?.message || 'No fue posible guardar los cambios del expediente.');
    } finally {
      setBusy(false);
    }
  };

  // Cálculo rápido de plazos legales para el formulario de radicación
  const applyPresetToForm = (preset) => {
    const baseDate = form.fecha_ingreso || new Date().toISOString().slice(0, 10);
    const calculatedDate = addBusinessDays(baseDate, preset.days);
    setForm((prev) => ({
      ...prev,
      fecha_limite: calculatedDate,
      dias_habiles_calculados: preset.days,
      regla_aplicada: `${preset.title} (${preset.rule})`
    }));
  };

  // Cálculo rápido de plazos legales para el formulario de edición
  const applyPresetToEdit = (preset) => {
    const baseDate = editForm.fecha_ingreso || new Date().toISOString().slice(0, 10);
    const calculatedDate = addBusinessDays(baseDate, preset.days);
    setEditForm((prev) => ({
      ...prev,
      fecha_limite: calculatedDate
    }));
  };

  // Cálculo rápido para la asignación de jefatura
  const applyPresetToAssignment = (preset) => {
    const baseDate = selected?.fecha_ingreso || new Date().toISOString().slice(0, 10);
    const calculatedDate = addBusinessDays(baseDate, preset.days);
    setAssignment((prev) => ({
      ...prev,
      fecha_limite: calculatedDate,
      dias_calculados: preset.days
    }));
  };

  const openAssignment = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await oficinaJuridicaService.getProfile();
      const freshProfile = response.data || { role: profile.role, team: [] };
      setProfile(freshProfile);
      const currentAdvisers = freshProfile.team.filter((u) => ['asesor', 'jefatura'].includes(u.juridica_rol));
      const currentSecretaries = freshProfile.team.filter((u) => u.juridica_rol === 'secretaria');

      const rawCurrentIds = selected.metadata?.responsables_ids || (selected.responsable_id ? [selected.responsable_id] : []);
      const activeIds = rawCurrentIds.map(Number).filter((id) => currentAdvisers.some((u) => Number(u.id) === id));
      const primaryId = activeIds[0] || (currentAdvisers.some((u) => Number(u.id) === Number(selected.responsable_id)) ? selected.responsable_id : '');
      const activeSecretaryId = currentSecretaries.some((u) => Number(u.id) === Number(selected.secretario_id))
        ? selected.secretario_id
        : currentSecretaries[0]?.id || '';

      setAssignment({
        responsables_ids: activeIds.length ? activeIds : (primaryId ? [Number(primaryId)] : []),
        responsable_id: primaryId,
        secretario_id: activeSecretaryId,
        nivel: selected.nivel || 'Media',
        fecha_limite: selected.fecha_limite ? String(selected.fecha_limite).slice(0, 10) : '',
        comentario: '',
        dias_calculados: null
      });
      setAssignOpen(true);
    } catch (e) {
      setError(e.response?.data?.message || 'No fue posible actualizar el equipo jurídico.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (!form.asunto.trim() || !form.interesado.trim()) {
      return setError('Asunto e interesado son obligatorios.');
    }
    setBusy(true);
    setError('');
    try {
      let payload;
      if (createFiles.length > 0) {
        payload = new FormData();
        Object.entries(form).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') payload.append(k, v);
        });
        createFiles.forEach((file) => {
          payload.append('archivos', file);
        });
      } else {
        payload = form;
      }

      const r = await oficinaJuridicaService.create(payload);
      setCreateOpen(false);
      setForm(emptyForm);
      setCreateFiles([]);
      setNotice(`Solicitud NRI ${r.data.nri} sistematizada y radicada exitosamente. Se ha notificado por correo a la Asesora Jurídica y Secretaría${createFiles.length ? ` con ${createFiles.length} anexo(s)` : ''}.`);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'No fue posible radicar.');
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (row) => {
    setBusy(true);
    try {
      await refreshSelected(row.id);
      setDetailOpen(true);
    } catch (e) {
      setError('No fue posible abrir el expediente.');
    } finally {
      setBusy(false);
    }
  };

  const handleAssign = async () => {
    if (!assignment.responsables_ids || !assignment.responsables_ids.length) {
      return setError('Debe seleccionar al menos un asesor responsable.');
    }
    setBusy(true);
    setError('');
    try {
      const response = await oficinaJuridicaService.assign(selected.id, {
        responsables_ids: assignment.responsables_ids,
        responsable_id: assignment.responsables_ids[0],
        secretario_id: assignment.secretario_id || null,
        nivel: assignment.nivel,
        fecha_limite: assignment.fecha_limite,
        comentario: assignment.comentario
      });
      replaceRow(response.data);
      if (selected && selected.id === response.data.id) {
        setSelected(response.data);
      }
      setAssignOpen(false);
      setNotice(
        assignment.responsables_ids.length > 1
          ? `Asignación colectiva registrada exitosamente a ${assignment.responsables_ids.length} asesores.`
          : 'El asunto fue asignado con término actualizado.'
      );
      await Promise.all([refreshSelected(selected.id), refreshStats()]);
    } catch (e) {
      setError(e.response?.data?.message || 'No fue posible asignar.');
    } finally {
      setBusy(false);
    }
  };

  const handleVistoBueno = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await oficinaJuridicaService.vistoBueno(selected.id, {
        comentario: vbComentario
      });
      replaceRow(response.data);
      setSelected(response.data);
      setVbOpen(false);
      setVbComentario('');
      setNotice(response.message || 'Visto bueno registrado correctamente.');
      await Promise.all([refreshSelected(selected.id), refreshStats()]);
    } catch (e) {
      setError(e.response?.data?.message || 'No fue posible registrar el visto bueno.');
    } finally {
      setBusy(false);
    }
  };

  const canGiveVistoBueno = useMemo(() => {
    if (!selected || !effectiveUser?.id) return false;
    const uid = Number(effectiveUser.id);
    const ids = (selected.metadata?.responsables_ids || (selected.responsable_id ? [selected.responsable_id] : [])).map(Number);
    const isAssigned = ids.includes(uid);
    const isPrivileged = (!profile.isSimulation && isSuperAdmin) || profile.role === 'jefatura';
    const vb = selected.metadata?.vistos_buenos || {};
    const alreadyApproved = vb[uid]?.aprobado === true;
    return (isAssigned || isPrivileged) && !alreadyApproved && !['entregado', 'cerrado', 'cancelado'].includes(selected.estado);
  }, [selected, effectiveUser, profile, isSuperAdmin]);

  const handleProrroga = async () => {
    if (!prorrogaData.fecha_limite) return setError('Indique la nueva fecha límite.');
    setBusy(true);
    try {
      const response = await oficinaJuridicaService.update(selected.id, {
        fecha_limite: prorrogaData.fecha_limite,
        comentario: `Prórroga de término legal registrada: ${prorrogaData.motivo || 'Ampliación de término conforme a la ley'}`
      });
      replaceRow(response.data);
      setProrrogaOpen(false);
      setProrrogaData({ fecha_limite: '', motivo: '' });
      setNotice('Término actualizado correctamente en el expediente.');
      await Promise.all([refreshSelected(selected.id), refreshStats()]);
    } catch (e) {
      setError(e.response?.data?.message || 'No fue posible actualizar el término.');
    } finally {
      setBusy(false);
    }
  };

  const handleDirectTransition = async (nextState, comment = '', extraPayload = {}) => {
    if (!nextState || !selected) return;
    setBusy(true);
    setError('');
    try {
      const response = await oficinaJuridicaService.transition(selected.id, {
        estado: nextState,
        comentario: comment || '',
        ...extraPayload
      });
      replaceRow(response.data);
      setSelected(response.data);
      setTransition({ estado: '', comentario: '', radicado: '', despacho: '', resultado: '' });
      setNotice('Estado del expediente actualizado correctamente.');
      await Promise.all([refreshSelected(selected.id), refreshStats()]);
    } catch (e) {
      setError(e.response?.data?.message || 'No fue posible actualizar el estado del expediente.');
    } finally {
      setBusy(false);
    }
  };

  const handleTransition = async () => {
    if (!transition.estado) return;
    await handleDirectTransition(transition.estado, transition.comentario, {
      radicado: transition.radicado,
      despacho: transition.despacho,
      resultado: transition.resultado
    });
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const r = await oficinaJuridicaService.importExcel(file);
      setNotice(`Importación lista: ${r.data.imported} nuevos, ${r.data.updated} actualizados y ${r.data.skipped} omitidos.`);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'No fue posible importar el Excel.');
    } finally {
      event.target.value = '';
      setBusy(false);
    }
  };

  const handleAttachment = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selected) return;
    setBusy(true);
    try {
      await oficinaJuridicaService.upload(selected.id, file, selected.estado === 'respuesta_revision' ? 'respuesta' : 'soporte');
      setNotice('Documento incorporado al expediente.');
      await refreshSelected(selected.id);
    } catch (e) {
      setError(e.response?.data?.message || 'No fue posible adjuntar el documento.');
    } finally {
      event.target.value = '';
      setBusy(false);
    }
  };

  const handleExport = async () => {
    setBusy(true);
    try {
      const r = await oficinaJuridicaService.downloadExcel();
      saveBlob(r.data, `seguimiento_juridico_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (_) {
      setError('No fue posible generar el Excel.');
    } finally {
      setBusy(false);
    }
  };

  const downloadAttachment = async (item) => {
    const r = await oficinaJuridicaService.downloadAttachment(item.id);
    saveBlob(r.data, item.nombre_original);
  };

  // Cálculo de progreso del término para el detalle
  const selectedTermProgress = useMemo(() => {
    if (!selected || !selected.fecha_limite) return null;
    const alert = getTermAlert(selected.fecha_limite, selected.estado, selected.fecha_ingreso);
    const start = new Date(`${String(selected.fecha_ingreso).slice(0, 10)}T00:00:00`);
    const end = new Date(`${String(selected.fecha_limite).slice(0, 10)}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.max(0, Math.round((today - start) / (1000 * 60 * 60 * 24)));
    const percentage = Math.min(100, Math.round((elapsedDays / totalDays) * 100));

    return { alert, totalDays, elapsedDays, percentage };
  }, [selected]);

  return (
    <Stack spacing={2.2}>
      {/* Banner Principal Diferenciado por Rol Operativo */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.4, md: 3 },
          borderRadius: 4,
          color: '#fff',
          overflow: 'hidden',
          position: 'relative',
          background: profile.role === 'secretaria'
            ? 'linear-gradient(135deg, #0b1f45 0%, #1e293b 50%, #78350f 100%)'
            : profile.role === 'jefatura'
            ? 'linear-gradient(135deg, #0b1f45 0%, #1e1b4b 50%, #312e81 100%)'
            : profile.role === 'asesor'
            ? 'linear-gradient(135deg, #0b1f45 0%, #064e3b 50%, #065f46 100%)'
            : 'linear-gradient(120deg,#091b3d 0%,#1745a5 58%,#0e7490 100%)',
          boxShadow: '0 8px 30px rgba(11, 31, 69, 0.15)'
        }}
      >
        <Box sx={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', bgcolor: '#ffffff10', right: -60, top: -110 }} />
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ md: 'center' }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ width: 58, height: 58, bgcolor: '#ffffff18', border: '1px solid #ffffff40' }}>
              {profile.role === 'secretaria' ? '📋' : profile.role === 'jefatura' ? '⚖️' : profile.role === 'asesor' ? '👥' : <GavelRoundedIcon sx={{ fontSize: 32 }} />}
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 950, fontSize: { xs: 22, md: 29 } }}>
                {profile.role === 'secretaria'
                  ? 'Panel Secretaría Jurídica · Radicación y Despacho'
                  : profile.role === 'jefatura'
                  ? 'Panel Jefatura Jurídica · Dirección, Asignación y Control'
                  : profile.role === 'asesor'
                  ? 'Panel Asistente Jurídico · Mis Expedientes Asignados'
                  : 'Gestión de Asuntos Jurídicos · Oficina Jurídica'}
              </Typography>
              <Typography sx={{ color: '#dbeafe', mt: 0.4, fontSize: { xs: '0.85rem', md: '0.94rem' }, maxWidth: 850 }}>
                {profile.role === 'secretaria'
                  ? 'Recepción de solicitudes externas e internas, sistematización, monitoreo de términos legales y despacho de radicados de salida.'
                  : profile.role === 'jefatura'
                  ? 'Dirección jurídica institucional, asignación y reasignación de expedientes a asesores, supervisión de términos improrrogables y aprobación de respuestas.'
                  : profile.role === 'asesor'
                  ? 'Estudio exhaustivo de antecedentes, proyección sustentada de respuestas jurídicas y emisión de visto bueno para aprobación final.'
                  : 'Control institucional de términos legales, radicación de derechos de petición, órdenes de salida y expediente digital.'}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip
              icon={<TimerRoundedIcon sx={{ fontSize: 16, color: '#0284c7 !important' }} />}
              label="Control de Términos Ley 1755"
              sx={{ bgcolor: '#fff', color: COLORS.blue, fontWeight: 900 }}
            />
            <Chip
              label={
                profile.role === 'secretaria'
                  ? '📋 Rol: Secretaría Jurídica'
                  : profile.role === 'jefatura'
                  ? '⚖️ Rol: Jefatura Jurídica'
                  : profile.role === 'asesor'
                  ? '👥 Rol: Asistente Jurídico'
                  : `Perfil: ${profile.role}${profile.isSimulation ? ` (Simulando a ${formatUserName(profile.actor?.nombre)})` : ''}`
              }
              sx={{ bgcolor: profile.isSimulation ? '#f59e0b' : '#ffffff25', color: '#fff', fontWeight: 900, textTransform: 'capitalize' }}
            />
          </Stack>
        </Stack>
      </Paper>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}

      {/* Barra de Simulación de Perspectivas para Pruebas del SuperAdmin */}
      {isSuperAdmin && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 3.5,
            border: profile.isSimulation ? '2px solid #f59e0b' : '1.5px solid #dbeafe',
            bgcolor: profile.isSimulation ? '#fffdf7' : '#f8fbff',
            boxShadow: profile.isSimulation ? '0 4px 16px rgba(245, 158, 11, 0.12)' : '0 2px 8px rgba(37, 99, 235, 0.05)'
          }}
        >
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1.5}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar
                  sx={{
                    width: 38,
                    height: 38,
                    bgcolor: profile.isSimulation ? '#fef3c7' : '#eff6ff',
                    color: profile.isSimulation ? '#b45309' : '#1d4ed8',
                    border: profile.isSimulation ? '1px solid #fde68a' : '1px solid #bfdbfe',
                    fontSize: '1.1rem'
                  }}
                >
                  🧪
                </Avatar>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    Simulador de Perspectiva y Pruebas de Roles
                    {profile.isSimulation ? (
                      <Chip
                        size="small"
                        label={`Viendo como: ${profile.actor?.nombre || 'Funcionario'} (${profile.actor?.cargo || 'Oficina Jurídica'} · Rol: ${profile.role?.toUpperCase()})`}
                        sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 900, border: '1px solid #fde68a', fontSize: '0.74rem' }}
                      />
                    ) : (
                      <Chip
                        size="small"
                        label="👑 Modo Real: SuperAdmin SGC (Control Total)"
                        sx={{ bgcolor: '#ecfdf5', color: '#047857', fontWeight: 900, border: '1px solid #a7f3d0', fontSize: '0.74rem' }}
                      />
                    )}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Permite al administrador probar y verificar la interfaz, permisos y bandejas de cada usuario activo sin cerrar sesión ni cambiar contraseñas.
                  </Typography>
                </Box>
              </Stack>

              {profile.isSimulation && (
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  onClick={() => handleSwitchPerspective(null)}
                  sx={{ fontWeight: 800, textTransform: 'none', borderRadius: 2 }}
                >
                  ✕ Salir de Simulación (Restaurar SuperAdmin)
                </Button>
              )}
            </Stack>

            {/* Selector interactivo de perspectivas */}
            <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', mr: 0.5 }}>
                Perspectiva:
              </Typography>

              <Button
                size="small"
                variant={!profile.isSimulation ? 'contained' : 'outlined'}
                onClick={() => handleSwitchPerspective(null)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 800,
                  borderRadius: 2,
                  bgcolor: !profile.isSimulation ? '#0b1f45' : 'transparent',
                  borderColor: '#cbd5e1',
                  color: !profile.isSimulation ? '#ffffff' : '#334155',
                  '&:hover': { bgcolor: !profile.isSimulation ? '#172554' : '#f1f5f9' }
                }}
              >
                👑 SuperAdmin (Control Total)
              </Button>

              {jefaturaList.map((j) => (
                <Button
                  key={j.id}
                  size="small"
                  variant={profile.actor?.id === j.id ? 'contained' : 'outlined'}
                  onClick={() => handleSwitchPerspective(j.id)}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 800,
                    borderRadius: 2,
                    bgcolor: profile.actor?.id === j.id ? '#7c3aed' : 'transparent',
                    borderColor: '#ddd6fe',
                    color: profile.actor?.id === j.id ? '#ffffff' : '#6d28d9',
                    '&:hover': { bgcolor: profile.actor?.id === j.id ? '#6d28d9' : '#f5f3ff' }
                  }}
                >
                  ⚖️ Jefatura ({formatUserName(j.nombre)})
                </Button>
              ))}

              {secretariaList.map((s) => (
                <Button
                  key={s.id}
                  size="small"
                  variant={profile.actor?.id === s.id ? 'contained' : 'outlined'}
                  onClick={() => handleSwitchPerspective(s.id)}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 800,
                    borderRadius: 2,
                    bgcolor: profile.actor?.id === s.id ? '#0284c7' : 'transparent',
                    borderColor: '#bae6fd',
                    color: profile.actor?.id === s.id ? '#ffffff' : '#0369a1',
                    '&:hover': { bgcolor: profile.actor?.id === s.id ? '#0369a1' : '#f0f9ff' }
                  }}
                >
                  📋 Secretaría ({formatUserName(s.nombre)})
                </Button>
              ))}

              <FormControl size="small" sx={{ minWidth: 260 }}>
                <InputLabel id="sim-asistente-label" sx={{ fontSize: '0.8rem', fontWeight: 700 }}>
                  👥 Asistentes Jurídicos Activos ({asesorList.length})
                </InputLabel>
                <Select
                  labelId="sim-asistente-label"
                  label={`👥 Asistentes Jurídicos Activos (${asesorList.length})`}
                  value={asesorList.some((u) => u.id === profile.actor?.id) ? profile.actor.id : ''}
                  onChange={(e) => handleSwitchPerspective(e.target.value)}
                  sx={{ height: 32, fontSize: '0.8rem', borderRadius: 2 }}
                >
                  <MenuItem value="" disabled>
                    <em>Seleccionar Asistente Jurídico...</em>
                  </MenuItem>
                  {asesorList.map((asistente) => (
                    <MenuItem key={asistente.id} value={asistente.id} sx={{ fontSize: '0.8rem' }}>
                      👤 {formatUserName(asistente.nombre)} ({asistente.cargo || 'Asistente'})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Stack>
        </Paper>
      )}

      {/* Métricas Pastel Interactivas Diferenciadas por Rol */}
      <Stack direction="row" flexWrap="wrap" gap={1.2}>
        {profile.role === 'jefatura' ? (
          <>
            <Metric
              icon={InboxRoundedIcon}
              label="TOTAL ASUNTOS"
              value={stats.total}
              helper="Bandeja general"
              pastelBg="#f0f7ff"
              pastelBorder="#dbeafe"
              accentColor="#1d4ed8"
              onClick={handleSelectAll}
              active={!stateFilter && !termFilter && !scopeFilter}
            />
            <Metric
              icon={AssignmentIndRoundedIcon}
              label="PENDIENTES ASIGNAR"
              value={roleMetrics.porAsignar}
              helper="Requieren designación"
              pastelBg="#fff7ed"
              pastelBorder="#fed7aa"
              accentColor="#c2410c"
              onClick={() => handleSelectScope('por_asignar')}
              active={scopeFilter === 'por_asignar'}
            />
            <Metric
              icon={PendingActionsRoundedIcon}
              label="EN ESTUDIO ASESORES"
              value={roleMetrics.enEstudio}
              helper="En elaboración"
              pastelBg="#ecfeff"
              pastelBorder="#a5f3fc"
              accentColor="#0e7490"
              onClick={() => handleSelectScope('en_estudio')}
              active={scopeFilter === 'en_estudio'}
            />
            <Metric
              icon={FactCheckRoundedIcon}
              label="PARA MI REVISIÓN"
              value={roleMetrics.enRevision}
              helper="Respuestas proyectadas"
              pastelBg="#f5f3ff"
              pastelBorder="#ddd6fe"
              accentColor="#7c3aed"
              onClick={() => handleSelectScope('en_revision')}
              active={scopeFilter === 'en_revision'}
            />
            <Metric
              icon={AlarmRoundedIcon}
              label="POR VENCER (≤ 5 D.H.)"
              value={stats.por_vencer ?? termCounts.porVencer}
              helper="Alerta de términos"
              pastelBg="#fefce8"
              pastelBorder="#fef08a"
              accentColor="#ca8a04"
              onClick={() => handleSelectScope('por_vencer')}
              active={scopeFilter === 'por_vencer'}
            />
            <Metric
              icon={CheckCircleRoundedIcon}
              label="FINALIZADOS"
              value={stats.cerrados}
              helper="Entregados o cerrados"
              pastelBg="#f0fdf4"
              pastelBorder="#bbf7d0"
              accentColor="#16a34a"
              onClick={() => handleSelectStateMetric('entregado')}
              active={stateFilter === 'entregado' && !scopeFilter && !termFilter}
            />
          </>
        ) : profile.role === 'secretaria' ? (
          <>
            <Metric
              icon={InboxRoundedIcon}
              label="TOTAL RADICADOS"
              value={stats.total}
              helper="Solicitudes recibidas"
              pastelBg="#f0f7ff"
              pastelBorder="#dbeafe"
              accentColor="#1d4ed8"
              onClick={handleSelectAll}
              active={!stateFilter && !termFilter && !scopeFilter}
            />
            <Metric
              icon={OutboxRoundedIcon}
              label="POR ENVIAR A JEFATURA"
              value={roleMetrics.porAsignar}
              helper="Pendientes clasificación"
              pastelBg="#fffbeb"
              pastelBorder="#fef3c7"
              accentColor="#b45309"
              onClick={() => handleSelectScope('por_asignar')}
              active={scopeFilter === 'por_asignar'}
            />
            <Metric
              icon={PendingActionsRoundedIcon}
              label="EN TRÁMITE JURÍDICO"
              value={roleMetrics.enEstudio + roleMetrics.enRevision}
              helper="Con asesores / jefatura"
              pastelBg="#ecfeff"
              pastelBorder="#a5f3fc"
              accentColor="#0e7490"
              onClick={() => handleSelectScope('en_estudio')}
              active={scopeFilter === 'en_estudio'}
            />
            <Metric
              icon={TaskAltRoundedIcon}
              label="LISTOS PARA DESPACHO"
              value={roleMetrics.listosDespacho}
              helper="Aprobados por Jefatura"
              pastelBg="#ecfdf5"
              pastelBorder="#a7f3d0"
              accentColor="#047857"
              onClick={() => handleSelectScope('ready_dispatch')}
              active={scopeFilter === 'ready_dispatch'}
            />
            <Metric
              icon={AlarmRoundedIcon}
              label="POR VENCER (≤ 5 D.H.)"
              value={stats.por_vencer ?? termCounts.porVencer}
              helper="Alerta preventiva"
              pastelBg="#fefce8"
              pastelBorder="#fef08a"
              accentColor="#ca8a04"
              onClick={() => handleSelectScope('por_vencer')}
              active={scopeFilter === 'por_vencer'}
            />
            <Metric
              icon={CheckCircleRoundedIcon}
              label="DESPACHADOS / CERRADOS"
              value={stats.cerrados}
              helper="Salidas entregadas"
              pastelBg="#f0fdf4"
              pastelBorder="#bbf7d0"
              accentColor="#16a34a"
              onClick={() => handleSelectStateMetric('entregado')}
              active={stateFilter === 'entregado' && !scopeFilter && !termFilter}
            />
          </>
        ) : profile.role === 'asesor' ? (
          <>
            <Metric
              icon={PersonRoundedIcon}
              label="MIS ASIGNADOS"
              value={roleMetrics.misAsignados}
              helper="Mi carga de trabajo"
              pastelBg="#f0fdfa"
              pastelBorder="#ccfbf1"
              accentColor="#0f766e"
              onClick={() => handleSelectScope('mis_asignados')}
              active={scopeFilter === 'mis_asignados'}
            />
            <Metric
              icon={HourglassTopRoundedIcon}
              label="POR CONFIRMAR RECIBIDO"
              value={roleMetrics.misPendientes}
              helper="Designados a mi nombre"
              pastelBg="#eff6ff"
              pastelBorder="#bfdbfe"
              accentColor="#1d4ed8"
              onClick={() => handleSelectScope('mis_pendientes')}
              active={scopeFilter === 'mis_pendientes'}
            />
            <Metric
              icon={PendingActionsRoundedIcon}
              label="EN ESTUDIO / PROYECCIÓN"
              value={roleMetrics.misEnEstudio}
              helper="Proyectando respuesta"
              pastelBg="#ecfeff"
              pastelBorder="#a5f3fc"
              accentColor="#0e7490"
              onClick={() => handleSelectScope('mis_en_estudio')}
              active={scopeFilter === 'mis_en_estudio'}
            />
            <Metric
              icon={WarningAmberRoundedIcon}
              label="DEVUELTOS CON AJUSTES"
              value={roleMetrics.misDevueltos}
              helper="Observaciones de jefatura"
              pastelBg="#fff1f2"
              pastelBorder="#fecdd3"
              accentColor="#e11d48"
              onClick={() => handleSelectScope('mis_devueltos')}
              active={scopeFilter === 'mis_devueltos'}
            />
            <Metric
              icon={FactCheckRoundedIcon}
              label="EN REVISIÓN JEFATURA"
              value={roleMetrics.misEnRevision}
              helper="Esperando visto bueno"
              pastelBg="#f5f3ff"
              pastelBorder="#ddd6fe"
              accentColor="#7c3aed"
              onClick={() => handleSelectScope('mis_en_revision')}
              active={scopeFilter === 'mis_en_revision'}
            />
            <Metric
              icon={CheckCircleRoundedIcon}
              label="FINALIZADOS CON MI VB"
              value={roleMetrics.misFinalizados}
              helper="Concluidos exitosamente"
              pastelBg="#f0fdf4"
              pastelBorder="#bbf7d0"
              accentColor="#16a34a"
              onClick={() => handleSelectScope('mis_finalizados')}
              active={scopeFilter === 'mis_finalizados'}
            />
          </>
        ) : (
          <>
            <Metric
              icon={InboxRoundedIcon}
              label="TOTAL ASUNTOS"
              value={stats.total}
              helper="Bandeja general"
              pastelBg="#f0f7ff"
              pastelBorder="#dbeafe"
              accentColor="#1d4ed8"
              onClick={handleSelectAll}
              active={!stateFilter && !termFilter && !scopeFilter}
            />
            <Metric
              icon={PersonRoundedIcon}
              label="MIS ASIGNADOS"
              value={myAssignedCount}
              helper="Mi carga de trabajo"
              pastelBg="#f0fdfa"
              pastelBorder="#ccfbf1"
              accentColor="#0f766e"
              onClick={() => handleSelectScope('mis_asignados')}
              active={scopeFilter === 'mis_asignados'}
            />
            <Metric
              icon={PendingActionsRoundedIcon}
              label="EN TRÁMITE"
              value={stats.abiertos}
              helper="Bandeja activa"
              pastelBg="#fffbeb"
              pastelBorder="#fef3c7"
              accentColor="#d97706"
              onClick={() => handleSelectStateMetric('asignado')}
              active={stateFilter === 'asignado' && !scopeFilter && !termFilter}
            />
            <Metric
              icon={AlarmRoundedIcon}
              label="POR VENCER (≤ 5 D.H.)"
              value={stats.por_vencer ?? termCounts.porVencer}
              helper="Alerta preventiva"
              pastelBg="#fefce8"
              pastelBorder="#fef08a"
              accentColor="#ca8a04"
              onClick={() => handleSelectScope('por_vencer')}
              active={scopeFilter === 'por_vencer'}
            />
            <Metric
              icon={WarningAmberRoundedIcon}
              label="VENCIDOS"
              value={stats.vencidos ?? termCounts.vencidos}
              helper="Término legal superado"
              pastelBg="#fff1f2"
              pastelBorder="#fecdd3"
              accentColor="#e11d48"
              onClick={() => handleSelectScope('vencidos')}
              active={scopeFilter === 'vencidos'}
            />
            <Metric
              icon={CheckCircleRoundedIcon}
              label="FINALIZADOS"
              value={stats.cerrados}
              helper="Entregados o cerrados"
              pastelBg="#f0fdf4"
              pastelBorder="#bbf7d0"
              accentColor="#16a34a"
              onClick={() => handleSelectStateMetric('entregado')}
              active={stateFilter === 'entregado' && !scopeFilter && !termFilter}
            />
          </>
        )}
      </Stack>

      {/* Contenedor Principal */}
      <Paper elevation={0} sx={{ border: '1px solid #dbe5f3', borderRadius: 3, overflow: 'hidden' }}>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          justifyContent="space-between"
          alignItems={{ lg: 'center' }}
          gap={1.5}
          sx={{ p: 1.5, borderBottom: '1px solid #e2e8f0' }}
        >
          <Tabs value={tab} onChange={(_, value) => setTab(value)}>
            <Tab icon={<InboxRoundedIcon />} iconPosition="start" label="Bandeja de asuntos" />
            <Tab icon={<FactCheckRoundedIcon />} iconPosition="start" label="Estadística automática" />
          </Tabs>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {profile.role !== 'asesor' && (
              <Button
                startIcon={<AddRoundedIcon />}
                variant="contained"
                onClick={() => {
                  setForm(emptyForm);
                  applyPresetToForm(DERECHO_PETICION_PRESETS[1]); // 15 días hábiles regla general
                  setCreateOpen(true);
                }}
                sx={{ fontWeight: 850, bgcolor: COLORS.blue }}
              >
                {profile.role === 'secretaria' ? 'Radicar solicitud (Entrada)' : 'Nueva solicitud'}
              </Button>
            )}
            {['administrador', 'jefatura', 'secretaria'].includes(profile.role) && (
              <>
                <input hidden ref={importRef} type="file" accept=".xlsx" onChange={handleImport} />
                <Button startIcon={<CloudUploadRoundedIcon />} variant="outlined" onClick={() => importRef.current?.click()}>
                  Importar control
                </Button>
              </>
            )}
            <Button startIcon={<DownloadRoundedIcon />} variant="outlined" onClick={handleExport}>
              {profile.role === 'asesor' ? 'Exportar mis expedientes' : 'Exportar Excel'}
            </Button>
          </Stack>
        </Stack>

        {loading ? (
          <Box sx={{ py: 10, display: 'grid', placeItems: 'center' }}>
            <CircularProgress />
          </Box>
        ) : tab === 0 ? (
          <>
            {/* Barra de Búsqueda y Filtros */}
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.2}
              alignItems="center"
              sx={{ p: 1.4, bgcolor: '#f8fafc', borderBottom: '1px solid #eef2f6' }}
            >
              <TextField
                fullWidth
                size="small"
                placeholder="Buscar por NRI, radicado, asunto, interesado, dependencia o responsable..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: <SearchRoundedIcon sx={{ mr: 1, color: '#64748b', fontSize: 19 }} />,
                  sx: { fontSize: '0.82rem', bgcolor: '#fff', borderRadius: 2 }
                }}
              />

              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel sx={{ fontSize: '0.82rem' }}>Grupo / Tipo</InputLabel>
                <Select
                  label="Grupo / Tipo"
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  sx={{ fontSize: '0.82rem', bgcolor: '#fff', borderRadius: 2 }}
                >
                  <MenuItem value="">Todos los grupos</MenuItem>
                  {GROUPS.map((g) => (
                    <MenuItem key={g} value={g} sx={{ fontSize: '0.82rem' }}>{g}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 190 }}>
                <InputLabel sx={{ fontSize: '0.82rem' }}>Alerta de Término</InputLabel>
                <Select
                  label="Alerta de Término"
                  value={termFilter}
                  onChange={(e) => setTermFilter(e.target.value)}
                  sx={{ fontSize: '0.82rem', bgcolor: '#fff', borderRadius: 2 }}
                >
                  <MenuItem value="">Todos los términos</MenuItem>
                  <MenuItem value="vencidos" sx={{ color: '#dc2626', fontWeight: 700, fontSize: '0.82rem' }}>🚨 Vencidos ({termCounts.vencidos})</MenuItem>
                  <MenuItem value="por_vencer" sx={{ color: '#d97706', fontWeight: 700, fontSize: '0.82rem' }}>⏰ Por vencer ≤ 5 d.h. ({termCounts.porVencer})</MenuItem>
                  <MenuItem value="en_termino" sx={{ color: '#059669', fontWeight: 700, fontSize: '0.82rem' }}>🟢 En término ({termCounts.enTermino})</MenuItem>
                  <MenuItem value="sin_limite" sx={{ fontSize: '0.82rem' }}>⚪ Sin fecha límite ({termCounts.sinLimite})</MenuItem>
                  <MenuItem value="finalizados" sx={{ fontSize: '0.82rem' }}>✓ Finalizados</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 170 }}>
                <InputLabel sx={{ fontSize: '0.82rem' }}>Estado</InputLabel>
                <Select
                  label="Estado"
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  sx={{ fontSize: '0.82rem', bgcolor: '#fff', borderRadius: 2 }}
                >
                  <MenuItem value="">Todos los estados</MenuItem>
                  {Object.entries(STATE).map(([key, value]) => (
                    <MenuItem key={key} value={key} sx={{ fontSize: '0.82rem' }}>{value[0]}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {(search || stateFilter || termFilter || groupFilter || scopeFilter) && (
                <Tooltip title="Restablecer todos los filtros">
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleSelectAll}
                    startIcon={<FilterAltOffRoundedIcon sx={{ fontSize: '15px !important' }} />}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 850,
                      fontSize: '0.74rem',
                      whiteSpace: 'nowrap',
                      borderRadius: 2,
                      borderColor: '#cbd5e1',
                      color: '#475569',
                      bgcolor: '#fff',
                      height: 36,
                      px: 1.2
                    }}
                  >
                    Limpiar
                  </Button>
                </Tooltip>
              )}
            </Stack>

            {/* Tabla de Asuntos con Alerta y Términos */}
            <TableContainer
              sx={{
                maxHeight: 620,
                borderRadius: '0 0 8px 8px',
                borderTop: '1px solid #e2e8f0',
                '&::-webkit-scrollbar': { width: 7, height: 7 },
                '&::-webkit-scrollbar-thumb': { bgcolor: '#cbd5e1', borderRadius: 4 },
                '&::-webkit-scrollbar-thumb:hover': { bgcolor: '#94a3b8' }
              }}
            >
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {[
                      { label: 'NRI / Radicado', width: 115 },
                      { label: 'Fecha radicación', width: 110 },
                      { label: 'Término / Vencimiento', width: 140 },
                      { label: 'Asunto e Interesado', width: 280 },
                      { label: 'Dependencia', width: 135 },
                      { label: 'Responsable', width: 160 },
                      { label: 'Estado', width: 125 },
                      { label: 'Acciones', width: 75, align: 'center' }
                    ].map((h) => (
                      <TableCell
                        key={h.label}
                        align={h.align || 'left'}
                        sx={{
                          bgcolor: '#0e2246',
                          color: '#ffffff',
                          fontWeight: 850,
                          fontSize: '0.71rem',
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                          py: 1,
                          px: 1.2,
                          whiteSpace: 'nowrap',
                          borderBottom: '2.5px solid #2563eb',
                          width: h.width,
                          maxWidth: h.width
                        }}
                      >
                        {h.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleRows.map((row, index) => (
                    <TableRow
                      hover
                      key={row.id}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: index % 2 === 0 ? '#ffffff' : '#fbfcfd',
                        transition: 'background-color 0.15s ease',
                        '&:hover': {
                          bgcolor: '#f0f7ff !important',
                          '& .action-btn': { transform: 'scale(1.08)' }
                        }
                      }}
                      onClick={() => openDetail(row)}
                    >
                      {/* NRI / Radicado */}
                      <TableCell sx={{ py: 0.7, px: 1.2, width: 115, maxWidth: 115, whiteSpace: 'nowrap' }}>
                        <Stack direction="row" spacing={0.7} alignItems="center">
                          <Box
                            sx={{
                              px: 0.8,
                              py: 0.2,
                              borderRadius: 1.5,
                              bgcolor: '#0b1f450f',
                              color: '#0b1f45',
                              fontWeight: 900,
                              fontSize: '0.74rem',
                              border: '1px solid #0b1f451a',
                              lineHeight: 1.2
                            }}
                          >
                            #{row.nri}
                          </Box>
                          {row.radicado ? (
                            <Tooltip title={`Radicado: ${row.radicado}`} arrow placement="top">
                              <Typography
                                sx={{
                                  fontSize: '0.68rem',
                                  color: '#475569',
                                  fontWeight: 700,
                                  maxWidth: 65,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {row.radicado}
                              </Typography>
                            </Tooltip>
                          ) : (
                            <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8', fontStyle: 'italic' }}>
                              s/rad
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>

                      {/* Fecha radicación */}
                      <TableCell sx={{ py: 0.7, px: 1, width: 110, maxWidth: 110, whiteSpace: 'nowrap' }}>
                        <Typography sx={{ fontSize: '0.74rem', fontWeight: 750, color: '#1e293b', lineHeight: 1.2 }}>
                          {formatDate(row.fecha_ingreso)}
                        </Typography>
                      </TableCell>

                      {/* Término y vencimiento */}
                      <TableCell sx={{ py: 0.7, px: 1, width: 140, maxWidth: 140 }}>
                        <TermAlertChip
                          fechaLimite={row.fecha_limite}
                          estado={row.estado}
                          fechaIngreso={row.fecha_ingreso}
                        />
                      </TableCell>

                      {/* Asunto e Interesado */}
                      <TableCell sx={{ py: 0.7, px: 1.2, width: 280, maxWidth: 280 }}>
                        <Stack direction="row" spacing={0.6} alignItems="center" mb={0.2}>
                          {(() => {
                            const gTheme = getGroupTheme(row.grupo);
                            return (
                              <Chip
                                size="small"
                                label={row.grupo || 'General'}
                                sx={{
                                  height: 18,
                                  fontSize: '0.62rem',
                                  fontWeight: 850,
                                  color: gTheme.color,
                                  bgcolor: gTheme.bg,
                                  border: `1px solid ${gTheme.border}`,
                                  flexShrink: 0,
                                  '& .MuiChip-label': { px: 0.6 }
                                }}
                              />
                            );
                          })()}
                          <Tooltip title={row.asunto || ''} arrow placement="top-start">
                            <Typography
                              sx={{
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                color: '#0f172a',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1
                              }}
                            >
                              {row.asunto}
                            </Typography>
                          </Tooltip>
                        </Stack>
                        <Tooltip title={`Interesado: ${row.interesado || 'Sin interesado'}`} arrow placement="bottom-start">
                          <Typography
                            sx={{
                              fontSize: '0.69rem',
                              color: '#475569',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {row.interesado || 'Sin interesado'}
                          </Typography>
                        </Tooltip>
                      </TableCell>

                      {/* Dependencia */}
                      <TableCell sx={{ py: 0.7, px: 1, width: 135, maxWidth: 135 }}>
                        <Tooltip title={row.dependencia_solicitante || 'Sin dependencia'} arrow placement="top">
                          <Typography
                            sx={{
                              fontSize: '0.72rem',
                              color: '#334155',
                              fontWeight: 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {row.dependencia_solicitante || '—'}
                          </Typography>
                        </Tooltip>
                      </TableCell>

                      {/* Responsable */}
                      <TableCell sx={{ py: 0.7, px: 1, width: 160, maxWidth: 160 }}>
                        {(() => {
                          const mainName = row.responsable?.nombre || row.metadata?.responsable_snapshot?.nombre;
                          const coCount = (row.metadata?.co_responsables || []).length;
                          const formatted = formatUserName(mainName);
                          const initials = getInitials(mainName);

                          if (!mainName) {
                            return (
                              <Chip
                                size="small"
                                label="Sin asignar"
                                sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#f1f5f9', color: '#64748b' }}
                              />
                            );
                          }

                          return (
                            <Stack direction="row" spacing={0.7} alignItems="center">
                              <Avatar
                                sx={{
                                  width: 22,
                                  height: 22,
                                  fontSize: '0.62rem',
                                  fontWeight: 900,
                                  bgcolor: '#0b1f45',
                                  color: '#fff',
                                  flexShrink: 0
                                }}
                              >
                                {initials}
                              </Avatar>
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Tooltip title={`Responsable principal: ${mainName}`} arrow placement="top">
                                  <Typography
                                    sx={{
                                      fontSize: '0.73rem',
                                      fontWeight: 750,
                                      color: '#1e293b',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {formatted}
                                  </Typography>
                                </Tooltip>
                                {coCount > 1 && (
                                  <Stack direction="row" spacing={0.4} alignItems="center" mt={0.15}>
                                    <Chip
                                      size="small"
                                      label={`+${coCount - 1}`}
                                      sx={{
                                        height: 15,
                                        fontSize: '0.6rem',
                                        fontWeight: 900,
                                        bgcolor: '#eff6ff',
                                        color: '#1d4ed8',
                                        '& .MuiChip-label': { px: 0.4 }
                                      }}
                                    />
                                    {(() => {
                                      const ids = (row.metadata?.responsables_ids || []).map(Number);
                                      const vb = row.metadata?.vistos_buenos || {};
                                      const count = ids.filter((id) => vb[id]?.aprobado).length;
                                      const all = count === ids.length && ids.length > 0;
                                      return (
                                        <Chip
                                          size="small"
                                          label={`VB: ${count}/${ids.length}`}
                                          sx={{
                                            height: 15,
                                            fontSize: '0.6rem',
                                            fontWeight: 900,
                                            bgcolor: all ? '#ecfdf5' : '#fffbeb',
                                            color: all ? '#047857' : '#b45309',
                                            border: `1px solid ${all ? '#a7f3d0' : '#fde68a'}`,
                                            '& .MuiChip-label': { px: 0.4 }
                                          }}
                                        />
                                      );
                                    })()}
                                  </Stack>
                                )}
                              </Box>
                            </Stack>
                          );
                        })()}
                      </TableCell>

                      {/* Estado */}
                      <TableCell sx={{ py: 0.7, px: 1, width: 125, maxWidth: 125 }}>
                        <StatusChip value={row.estado} />
                      </TableCell>

                      {/* Acciones */}
                      <TableCell align="center" sx={{ py: 0.7, px: 0.4, width: 75, maxWidth: 75, whiteSpace: 'nowrap' }}>
                        <Stack direction="row" spacing={0.3} justifyContent="center" alignItems="center">
                          {canEditCase && (
                            <Tooltip title="Editar datos del expediente" arrow placement="top">
                              <IconButton
                                size="small"
                                className="action-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEdit(row);
                                }}
                                sx={{
                                  color: '#0284c7',
                                  p: 0.5,
                                  borderRadius: 1.5,
                                  transition: 'all 0.15s ease',
                                  '&:hover': { bgcolor: '#e0f2fe', color: '#0369a1' }
                                }}
                              >
                                <EditRoundedIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}

                          <Tooltip title="Abrir expediente completo" arrow placement="top">
                            <IconButton
                              size="small"
                              className="action-btn"
                              sx={{
                                color: '#1d4ed8',
                                p: 0.5,
                                borderRadius: 1.5,
                                transition: 'all 0.15s ease',
                                '&:hover': { bgcolor: '#eff6ff', color: '#1e40af' }
                              }}
                            >
                              <OpenInNewRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}

                  {!filtered.length && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 9, bgcolor: '#fbfcfd' }}>
                        <Stack spacing={1.5} alignItems="center" justifyContent="center">
                          <Avatar sx={{ bgcolor: '#f1f5f9', color: '#64748b', width: 52, height: 52 }}>
                            <SearchRoundedIcon sx={{ fontSize: 28 }} />
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1e293b' }}>
                              No hay asuntos jurídicos que coincidan con la búsqueda o filtros aplicados
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#64748b', mt: 0.3 }}>
                              Pruebe ajustando o limpiando los criterios de búsqueda, estado o alerta de término.
                            </Typography>
                          </Box>
                          {(search || stateFilter || termFilter || groupFilter || scopeFilter) && (
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<FilterAltOffRoundedIcon />}
                              onClick={handleSelectAll}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 800,
                                borderRadius: 2,
                                mt: 0.5,
                                borderColor: '#cbd5e1',
                                color: '#334155'
                              }}
                            >
                              Restablecer todos los filtros ({rows.length} expedientes)
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={filtered.length}
              page={page}
              onPageChange={(_, value) => setPage(value)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50, 100]}
              labelRowsPerPage="Filas por página"
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
            />
          </>
        ) : (
          /* Tab de Estadística Automática */
          <Box sx={{ p: 2.5, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,1fr)' }, gap: 2 }}>
            <Paper variant="outlined" sx={{ p: 2.2, borderRadius: 3, gridColumn: { md: 'span 2' } }}>
              <Typography fontWeight={950} mb={1}>
                Cumplimiento y Control de Términos Legales
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Monitoreo preventivo del vencimiento de plazos según la Ley 1755 de 2015 y términos institucionales.
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={3}>
                  <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                    <Typography variant="h4" fontWeight={900} color="#059669">{termCounts.enTermino}</Typography>
                    <Typography variant="caption" fontWeight={800} color="#047857">EN TÉRMINO (&gt; 5 D.H.)</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: '#fffbeb', border: '1px solid #fde047', textAlign: 'center' }}>
                    <Typography variant="h4" fontWeight={900} color="#d97706">{termCounts.porVencer}</Typography>
                    <Typography variant="caption" fontWeight={800} color="#b45309">POR VENCER (≤ 5 D.H.)</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: '#fef2f2', border: '1px solid #fca5a5', textAlign: 'center' }}>
                    <Typography variant="h4" fontWeight={900} color="#dc2626">{termCounts.vencidos}</Typography>
                    <Typography variant="caption" fontWeight={800} color="#b91c1c">TÉRMINO SUPERADO</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <Typography variant="h4" fontWeight={900} color="#64748b">{termCounts.sinLimite}</Typography>
                    <Typography variant="caption" fontWeight={800} color="#475569">SIN TÉRMINO FIJADO</Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>

            {[
              ['Distribución por estado', stats.estados],
              ['Carga por responsable', stats.responsables],
              ['Tipos de asunto', stats.grupos],
              ['Dependencias solicitantes', stats.dependencias]
            ].map(([title, items]) => (
              <Paper key={title} variant="outlined" sx={{ p: 2.2, borderRadius: 3 }}>
                <Typography fontWeight={950} mb={2}>{title}</Typography>
                <Stack spacing={1.2}>
                  {(items || []).slice(0, 8).map((item) => (
                    <Box key={item.label}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">{STATE[item.label]?.[0] || item.label}</Typography>
                        <Typography variant="body2" fontWeight={900}>{item.value}</Typography>
                      </Stack>
                      <Box sx={{ height: 7, bgcolor: '#e8eef7', borderRadius: 9, mt: 0.5 }}>
                        <Box
                          sx={{
                            height: '100%',
                            width: `${Math.max(4, (item.value / Math.max(1, stats.total)) * 100)}%`,
                            bgcolor: COLORS.blue,
                            borderRadius: 9
                          }}
                        />
                      </Box>
                    </Box>
                  ))}
                  {!(items || []).length && <Typography color="text.secondary">Sin datos todavía.</Typography>}
                </Stack>
              </Paper>
            ))}
          </Box>
        )}
      </Paper>

      {/* DIÁLOGO: RADICAR NUEVA SOLICITUD CON ASISTENTE DE DERECHOS DE PETICIÓN */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 950 }}>
          Radicar nueva solicitud jurídica
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            El sistema genera el NRI automático y contabiliza los términos legales de respuesta según la normativa colombiana.
          </Alert>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,1fr)' }, gap: 2 }}>
            <TextField
              required
              label="Asunto"
              placeholder="Ej: Derecho de petición de información curricular..."
              value={form.asunto}
              onChange={(e) => setForm({ ...form, asunto: e.target.value })}
              sx={{ gridColumn: { md: 'span 2' } }}
            />

            <Autocomplete
              freeSolo
              options={internalUsers}
              getOptionLabel={(option) => {
                if (typeof option === 'string') return option;
                return option.nombre || '';
              }}
              filterOptions={(options, state) => {
                const term = (state.inputValue || '').toLowerCase().trim();
                if (!term) return options.slice(0, 40);
                return options.filter((u) => {
                  const nombre = String(u.nombre || '').toLowerCase();
                  const cedula = String(u.username || '').toLowerCase();
                  const dep = String(u.dependencia || '').toLowerCase();
                  return nombre.includes(term) || cedula.includes(term) || dep.includes(term);
                }).slice(0, 40);
              }}
              value={form.interesado}
              onInputChange={(event, newInputValue) => {
                setForm((prev) => ({ ...prev, interesado: newInputValue }));
              }}
              onChange={(event, newValue) => {
                if (typeof newValue === 'object' && newValue !== null) {
                  setForm((prev) => ({
                    ...prev,
                    interesado: newValue.nombre,
                    dependencia_solicitante: newValue.dependencia || prev.dependencia_solicitante
                  }));
                } else if (typeof newValue === 'string') {
                  setForm((prev) => ({ ...prev, interesado: newValue }));
                } else {
                  setForm((prev) => ({ ...prev, interesado: '' }));
                }
              }}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option.id} sx={{ py: 0.9, borderBottom: '1px solid #f1f5f9' }}>
                  <Stack spacing={0.3} sx={{ width: '100%' }}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                        {option.nombre}
                      </Typography>
                      {option.username && (
                        <Chip
                          size="small"
                          label={`C.C. ${option.username}`}
                          sx={{ height: 20, fontSize: '0.7rem', fontWeight: 800, bgcolor: '#f1f5f9', color: '#334155' }}
                        />
                      )}
                    </Stack>
                    <Typography variant="caption" sx={{ color: '#0284c7', fontWeight: 600 }}>
                      🏢 {option.dependencia || 'Sin dependencia registrada'} {option.cargo ? `· ${option.cargo}` : ''}
                    </Typography>
                  </Stack>
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  required
                  label="Interesado / solicitante *"
                  placeholder="Buscar por nombre o cédula, o digite peticionario..."
                  helperText="Busque por nombre o cédula para auto-llenar la dependencia, o digite libremente si es externo."
                />
              )}
            />

            <TextField
              label="Dependencia solicitante"
              placeholder="Auto-completada al seleccionar usuario, o digite..."
              value={form.dependencia_solicitante}
              onChange={(e) => setForm({ ...form, dependencia_solicitante: e.target.value })}
              helperText="Se auto-completa al seleccionar un usuario interno, o puede editarla libremente."
            />

            <TextField
              select
              label="Grupo"
              value={form.grupo}
              onChange={(e) => {
                const newGrupo = e.target.value;
                setForm({ ...form, grupo: newGrupo });
                if (newGrupo === 'Derechos de petición') {
                  applyPresetToForm(DERECHO_PETICION_PRESETS[1]); // 15 días hábiles regla general
                } else if (newGrupo === 'Tutelas') {
                  applyPresetToForm(DERECHO_PETICION_PRESETS[4]); // 3 días
                } else if (newGrupo === 'Requerimientos') {
                  applyPresetToForm(DERECHO_PETICION_PRESETS[5]); // 5 días
                }
              }}
            >
              {GROUPS.map((x) => (
                <MenuItem key={x} value={x}>{x}</MenuItem>
              ))}
            </TextField>

            <TextField
              label="Clase / tema específico"
              placeholder="Ej: Copias de exámenes, concepto legal..."
              value={form.clase}
              onChange={(e) => setForm({ ...form, clase: e.target.value })}
            />

            <TextField
              select
              label="Prioridad"
              value={form.nivel}
              onChange={(e) => setForm({ ...form, nivel: e.target.value })}
            >
              {['Alta', 'Media', 'Baja'].map((x) => (
                <MenuItem key={x} value={x}>{x}</MenuItem>
              ))}
            </TextField>

            <TextField
              label="Fecha límite calculada"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={form.fecha_limite}
              onChange={(e) => setForm({ ...form, fecha_limite: e.target.value, regla_aplicada: 'Personalizada' })}
              helperText={form.fecha_limite ? `Vence el ${formatDateDetailed(form.fecha_limite)}` : 'Seleccione o calcule el plazo'}
            />

            {/* SECCIÓN ASISTENTE DE TÉRMINOS LEGALES */}
            <Paper
              variant="outlined"
              sx={{
                gridColumn: { md: 'span 2' },
                p: 2,
                borderRadius: 2.5,
                bgcolor: '#f8fafc',
                border: '1px solid #bfdbfe'
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                <TimerRoundedIcon sx={{ color: '#1d4ed8' }} />
                <Typography variant="subtitle2" fontWeight={900} color="#1e3a8a">
                  Plazos Legales para Derechos de Petición y Asuntos Jurídicos
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                Haga clic para aplicar el término en días hábiles (excluye fines de semana y festivos en Colombia):
              </Typography>

              <Stack direction="row" flexWrap="wrap" gap={1} mb={1.5}>
                {DERECHO_PETICION_PRESETS.map((preset) => {
                  const isSelected = form.dias_habiles_calculados === preset.days;
                  return (
                    <Chip
                      key={preset.key}
                      label={`${preset.label} · ${preset.title}`}
                      onClick={() => applyPresetToForm(preset)}
                      color={isSelected ? 'primary' : 'default'}
                      variant={isSelected ? 'filled' : 'outlined'}
                      sx={{
                        fontWeight: 800,
                        cursor: 'pointer',
                        borderColor: '#93c5fd',
                        '&:hover': { bgcolor: '#eff6ff' }
                      }}
                    />
                  );
                })}
              </Stack>

              {form.regla_aplicada && (
                <Alert severity="success" sx={{ py: 0.5, px: 1.5, borderRadius: 2 }}>
                  <Typography variant="caption" fontWeight={750}>
                    Término aplicado: <strong>{form.regla_aplicada}</strong>. Fecha límite fijada al{' '}
                    <strong>{formatDateDetailed(form.fecha_limite)}</strong> ({form.dias_habiles_calculados} días hábiles).
                  </Typography>
                </Alert>
              )}
            </Paper>

            <TextField
              multiline
              minRows={3}
              label="Descripción y solicitud concreta"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              sx={{ gridColumn: { md: 'span 2' } }}
            />

            {/* SECCIÓN ADJUNTOS / DOCUMENTOS INICIALES */}
            <Paper
              variant="outlined"
              sx={{
                gridColumn: { md: 'span 2' },
                p: 2,
                borderRadius: 2.5,
                bgcolor: '#f8fafc',
                border: '1px dashed #94a3b8'
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" mb={1} justifyContent="space-between">
                <Stack direction="row" spacing={1} alignItems="center">
                  <AttachFileRoundedIcon sx={{ color: '#0369a1' }} />
                  <Typography variant="subtitle2" fontWeight={900} color="#0f172a">
                    Anexos y Documentos de la Solicitud (Llegados al correo de Jurídica)
                  </Typography>
                </Stack>
                <Button
                  component="label"
                  variant="outlined"
                  size="small"
                  startIcon={<CloudUploadRoundedIcon />}
                  sx={{ textTransform: 'none', fontWeight: 800 }}
                >
                  Seleccionar archivos
                  <input
                    type="file"
                    hidden
                    multiple
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setCreateFiles((prev) => [...prev, ...files]);
                      e.target.value = '';
                    }}
                  />
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                La secretaría puede adjuntar los oficios, derechos de petición, tutelas y anexos recibidos por correo. Se enviarán directamente por correo electrónico a la Asesora Jurídica y a los Asistentes asignados.
              </Typography>

              {createFiles.length > 0 ? (
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {createFiles.map((file, idx) => (
                    <Chip
                      key={`${file.name}-${idx}`}
                      label={`${file.name} (${(file.size / 1024).toFixed(0)} KB)`}
                      onDelete={() => setCreateFiles((prev) => prev.filter((_, i) => i !== idx))}
                      color="primary"
                      variant="outlined"
                      size="small"
                      sx={{ fontWeight: 750, bgcolor: '#eff6ff' }}
                    />
                  ))}
                </Stack>
              ) : (
                <Typography variant="caption" color="#94a3b8" fontStyle="italic">
                  No se han seleccionado archivos adjuntos aún (opcional).
                </Typography>
              )}
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button disabled={busy} variant="contained" onClick={handleCreate} sx={{ bgcolor: COLORS.blue }}>
            Radicar solicitud
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIÁLOGO: EDITAR EXPEDIENTE COMPLETO SI HUBO ERROR O CORRECCIÓN */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 950 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <EditRoundedIcon sx={{ color: '#0284c7' }} />
            <Typography variant="h6" fontWeight={950}>
              Editar y corregir expediente NRI {editForm.nri}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Puede corregir cualquier dato ingresado (asunto, fechas, radicado, solicitante o grupo). Los cambios quedarán registrados en la trazabilidad.
          </Alert>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,1fr)' }, gap: 2 }}>
            <TextField
              required
              label="Asunto"
              value={editForm.asunto}
              onChange={(e) => setEditForm({ ...editForm, asunto: e.target.value })}
              sx={{ gridColumn: { md: 'span 2' } }}
            />

            <Autocomplete
              freeSolo
              options={internalUsers}
              getOptionLabel={(option) => {
                if (typeof option === 'string') return option;
                return option.nombre || '';
              }}
              filterOptions={(options, state) => {
                const term = (state.inputValue || '').toLowerCase().trim();
                if (!term) return options.slice(0, 40);
                return options.filter((u) => {
                  const nombre = String(u.nombre || '').toLowerCase();
                  const cedula = String(u.username || '').toLowerCase();
                  const dep = String(u.dependencia || '').toLowerCase();
                  return nombre.includes(term) || cedula.includes(term) || dep.includes(term);
                }).slice(0, 40);
              }}
              value={editForm.interesado}
              onInputChange={(event, newInputValue) => {
                setEditForm((prev) => ({ ...prev, interesado: newInputValue }));
              }}
              onChange={(event, newValue) => {
                if (typeof newValue === 'object' && newValue !== null) {
                  setEditForm((prev) => ({
                    ...prev,
                    interesado: newValue.nombre,
                    dependencia_solicitante: newValue.dependencia || prev.dependencia_solicitante
                  }));
                } else if (typeof newValue === 'string') {
                  setEditForm((prev) => ({ ...prev, interesado: newValue }));
                } else {
                  setEditForm((prev) => ({ ...prev, interesado: '' }));
                }
              }}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option.id} sx={{ py: 0.9, borderBottom: '1px solid #f1f5f9' }}>
                  <Stack spacing={0.3} sx={{ width: '100%' }}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                        {option.nombre}
                      </Typography>
                      {option.username && (
                        <Chip
                          size="small"
                          label={`C.C. ${option.username}`}
                          sx={{ height: 20, fontSize: '0.7rem', fontWeight: 800, bgcolor: '#f1f5f9', color: '#334155' }}
                        />
                      )}
                    </Stack>
                    <Typography variant="caption" sx={{ color: '#0284c7', fontWeight: 600 }}>
                      🏢 {option.dependencia || 'Sin dependencia registrada'} {option.cargo ? `· ${option.cargo}` : ''}
                    </Typography>
                  </Stack>
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  required
                  label="Interesado / solicitante *"
                  placeholder="Buscar por nombre o cédula, o digite peticionario..."
                />
              )}
            />

            <TextField
              label="Dependencia solicitante"
              placeholder="Auto-completada o digite..."
              value={editForm.dependencia_solicitante}
              onChange={(e) => setEditForm({ ...editForm, dependencia_solicitante: e.target.value })}
            />

            <TextField
              select
              label="Grupo"
              value={editForm.grupo}
              onChange={(e) => setEditForm({ ...editForm, grupo: e.target.value })}
            >
              {GROUPS.map((x) => (
                <MenuItem key={x} value={x}>{x}</MenuItem>
              ))}
            </TextField>

            <TextField
              label="Clase / tema específico"
              value={editForm.clase}
              onChange={(e) => setEditForm({ ...editForm, clase: e.target.value })}
            />

            <TextField
              select
              label="Prioridad"
              value={editForm.nivel}
              onChange={(e) => setEditForm({ ...editForm, nivel: e.target.value })}
            >
              {['Alta', 'Media', 'Baja'].map((x) => (
                <MenuItem key={x} value={x}>{x}</MenuItem>
              ))}
            </TextField>

            <TextField
              label="Número de radicado"
              value={editForm.radicado}
              onChange={(e) => setEditForm({ ...editForm, radicado: e.target.value })}
            />

            <TextField
              label="Fecha de ingreso / radicación"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={editForm.fecha_ingreso}
              onChange={(e) => setEditForm({ ...editForm, fecha_ingreso: e.target.value })}
            />

            <TextField
              label="Fecha límite de vencimiento"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={editForm.fecha_limite}
              onChange={(e) => setEditForm({ ...editForm, fecha_limite: e.target.value })}
              helperText={editForm.fecha_limite ? `Vence el ${formatDateDetailed(editForm.fecha_limite)}` : ''}
            />

            {/* Asistente rápido de plazos en edición */}
            <Box sx={{ gridColumn: { md: 'span 2' }, p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Typography variant="caption" fontWeight={800} color="#1e3a8a" display="block" mb={0.8}>
                Ajuste rápido de plazo legal a partir de la fecha de ingreso:
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.8}>
                {DERECHO_PETICION_PRESETS.map((preset) => (
                  <Chip
                    key={preset.key}
                    label={`${preset.label} (${preset.title})`}
                    size="small"
                    onClick={() => applyPresetToEdit(preset)}
                    sx={{ cursor: 'pointer', fontWeight: 800, bgcolor: '#fff', borderColor: '#93c5fd' }}
                    variant="outlined"
                  />
                ))}
              </Stack>
            </Box>

            <TextField
              multiline
              minRows={3}
              label="Descripción y contenido de la solicitud"
              value={editForm.descripcion}
              onChange={(e) => setEditForm({ ...editForm, descripcion: e.target.value })}
              sx={{ gridColumn: { md: 'span 2' } }}
            />

            <TextField
              label="Despacho o entidad de origen"
              value={editForm.despacho}
              onChange={(e) => setEditForm({ ...editForm, despacho: e.target.value })}
            />

            <TextField
              label="Observaciones adicionales"
              value={editForm.observaciones}
              onChange={(e) => setEditForm({ ...editForm, observaciones: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditOpen(false)}>Cancelar</Button>
          <Button disabled={busy} variant="contained" onClick={handleSaveEdit} sx={{ bgcolor: '#0284c7' }}>
            Guardar cambios
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIÁLOGO: EXPEDIENTE COMPLETO CON SEMÁFORO DE VENCIMIENTO */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
            <Box>
              <Typography variant="h6" fontWeight={950}>
                Expediente NRI {selected?.nri}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selected?.radicado || 'Pendiente de número de radicado'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              {selected && canEditCase && (
                <Button
                  size="small"
                  startIcon={<EditRoundedIcon />}
                  variant="outlined"
                  onClick={() => openEdit(selected)}
                  sx={{ textTransform: 'none', fontWeight: 850, borderRadius: 2 }}
                >
                  Editar datos
                </Button>
              )}
              {selected && (
                <TermAlertChip
                  fechaLimite={selected.fecha_limite}
                  estado={selected.estado}
                  fechaIngreso={selected.fecha_ingreso}
                />
              )}
              {selected && <StatusChip value={selected.estado} />}
            </Stack>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1.5fr) minmax(300px,.7fr)' }, gap: 2.5 }}>
              <Stack spacing={2}>
                {/* BANNER DESTACADO DE DEVOLUCIÓN CON RETROALIMENTACIÓN DE JEFATURA */}
                {selected.estado === 'devuelto_informacion' && (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.2,
                      borderRadius: 3,
                      bgcolor: '#fff1f2',
                      border: '2px solid #fecdd3',
                      boxShadow: '0 4px 16px rgba(225, 29, 72, 0.08)'
                    }}
                  >
                    <Stack direction="row" spacing={1.2} alignItems="center" mb={1}>
                      <WarningAmberRoundedIcon sx={{ color: '#e11d48', fontSize: 24 }} />
                      <Typography fontWeight={950} color="#9f1239" fontSize="0.98rem">
                        Expediente Devuelto con Retroalimentación de Jefatura
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="#881337" fontWeight={600} mb={1}>
                      La Asesora Jurídica / Jefatura revisó el proyecto de respuesta y solicitó ajustes previos a la aprobación definitiva:
                    </Typography>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1.8,
                        borderRadius: 2,
                        bgcolor: '#ffffff',
                        border: '1.5px solid #fda4af',
                        color: '#4c0519',
                        fontWeight: 650,
                        fontSize: '0.86rem',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.5
                      }}
                    >
                      {selected.devolucion || selected.observaciones || 'Se requieren correcciones, ajustes normativos o ampliación de antecedentes antes de emitir la aprobación definitiva.'}
                    </Paper>
                  </Paper>
                )}

                {/* SEMÁFORO DESTACADO DE TÉRMINOS */}
                {selectedTermProgress && (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2.2,
                      borderRadius: 3,
                      bgcolor: selectedTermProgress.alert.bg,
                      borderColor: selectedTermProgress.alert.borderColor
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TimerRoundedIcon sx={{ color: selectedTermProgress.alert.color }} />
                        <Typography fontWeight={900} sx={{ color: selectedTermProgress.alert.color }}>
                          Contabilización de Términos Legales
                        </Typography>
                      </Stack>
                      {canProrroga && (
                        <Button
                          size="small"
                          startIcon={<EditCalendarRoundedIcon />}
                          onClick={() => {
                            setProrrogaData({
                              fecha_limite: selected.fecha_limite || '',
                              motivo: ''
                            });
                            setProrrogaOpen(true);
                          }}
                          sx={{ textTransform: 'none', fontWeight: 800 }}
                        >
                          Ajustar término / Prórroga
                        </Button>
                      )}
                    </Stack>

                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, my: 1.5 }}>
                      <Box sx={{ p: 1.2, bgcolor: '#fff', borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={800}>FECHA INGRESO</Typography>
                        <Typography fontWeight={900}>{formatDateBrief(selected.fecha_ingreso)}</Typography>
                      </Box>
                      <Box sx={{ p: 1.2, bgcolor: '#fff', borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={800}>FECHA LÍMITE</Typography>
                        <Typography fontWeight={900}>{formatDateBrief(selected.fecha_limite)}</Typography>
                      </Box>
                      <Box sx={{ p: 1.2, bgcolor: '#fff', borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={800}>TIEMPO RESTANTE</Typography>
                        <Typography fontWeight={900} sx={{ color: selectedTermProgress.alert.color }}>
                          {selectedTermProgress.alert.label}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ mt: 1 }}>
                      <Stack direction="row" justifyContent="space-between" mb={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          Plazo consumido ({selectedTermProgress.elapsedDays} días transcurridos)
                        </Typography>
                        <Typography variant="caption" fontWeight={800} sx={{ color: selectedTermProgress.alert.color }}>
                          {selectedTermProgress.percentage}%
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={selectedTermProgress.percentage}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          bgcolor: '#e2e8f0',
                          '& .MuiLinearProgress-bar': { bgcolor: selectedTermProgress.alert.color }
                        }}
                      />
                    </Box>
                  </Paper>
                )}

                {/* DATOS DEL EXPEDIENTE */}
                <Paper variant="outlined" sx={{ p: 2.2, borderRadius: 3 }}>
                  <Typography variant="caption" fontWeight={900} color="text.secondary">
                    ASUNTO
                  </Typography>
                  <Typography variant="h6" fontWeight={900}>
                    {selected.asunto}
                  </Typography>
                  <Typography color="text.secondary" mt={1}>
                    {selected.descripcion || 'Sin descripción adicional.'}
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 1.5 }}>
                    {[
                      ['Interesado', selected.interesado],
                      ['Dependencia', selected.dependencia_solicitante],
                      ['Grupo', selected.grupo],
                      ['Clase', selected.clase],
                      ['Prioridad', selected.nivel],
                      ['Fecha límite', formatDateDetailed(selected.fecha_limite)],
                      ['Responsable', selected.responsable?.nombre || selected.metadata?.responsable_snapshot?.nombre || 'Sin asignar'],
                      ['Secretaría', selected.secretario?.nombre || selected.metadata?.secretario_snapshot?.nombre || 'Sin asignar']
                    ].map(([k, v]) => (
                      <Box key={k}>
                        <Typography variant="caption" color="text.secondary" fontWeight={850}>
                          {k}
                        </Typography>
                        <Typography fontWeight={750}>{v || '—'}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Paper>

                {/* SECCIÓN DE ASIGNACIÓN COLECTIVA Y CONTROL DE VISTOS BUENOS */}
                {selected.metadata?.co_responsables?.length > 0 && (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2.2,
                      borderRadius: 3,
                      border: '1.5px solid #dbeafe',
                      bgcolor: '#f8fbff'
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5} flexWrap="wrap" gap={1}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <GroupsRoundedIcon sx={{ color: '#1d4ed8' }} />
                        <Typography fontWeight={950} color="#1e3a8a">
                          Comisión Asignada y Vistos Buenos Obligatorios
                        </Typography>
                      </Stack>
                      {(() => {
                        const ids = (selected.metadata?.responsables_ids || []).map(Number);
                        const vb = selected.metadata?.vistos_buenos || {};
                        const count = ids.filter((id) => vb[id]?.aprobado).length;
                        const all = count === ids.length && ids.length > 0;
                        return (
                          <Chip
                            icon={all ? <CheckCircleRoundedIcon sx={{ fontSize: 16 }} /> : <HourglassTopRoundedIcon sx={{ fontSize: 16 }} />}
                            label={`${count} de ${ids.length} Vistos Buenos`}
                            sx={{
                              fontWeight: 900,
                              bgcolor: all ? '#ecfdf5' : '#eff6ff',
                              color: all ? '#047857' : '#1d4ed8',
                              border: `1px solid ${all ? '#a7f3d0' : '#bfdbfe'}`
                            }}
                          />
                        );
                      })()}
                    </Stack>

                    <Alert
                      severity={selected.metadata?.todos_vistos_buenos ? 'success' : 'info'}
                      sx={{ mb: 2, fontSize: 13 }}
                    >
                      {selected.metadata?.todos_vistos_buenos
                        ? '¡Visto bueno unánime concedido! Todos los asesores asignados han emitido su concepto favorable.'
                        : 'Para que este expediente pueda entregarse y cerrarse, todos los asesores asignados deben ingresar con su usuario y dar su visto bueno individual.'}
                    </Alert>

                    <Stack spacing={1.2}>
                      {(selected.metadata?.co_responsables || []).map((resp) => {
                        const vbInfo = selected.metadata?.vistos_buenos?.[resp.id] || {};
                        const isApproved = vbInfo.aprobado === true;
                        return (
                          <Paper
                            key={resp.id}
                            variant="outlined"
                            sx={{
                              p: 1.4,
                              borderRadius: 2,
                              bgcolor: isApproved ? '#ffffff' : '#fffdfa',
                              borderColor: isApproved ? '#bbf7d0' : '#fed7aa',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 1
                            }}
                          >
                            <Stack direction="row" spacing={1.2} alignItems="center">
                              <Avatar sx={{ width: 36, height: 36, bgcolor: isApproved ? '#ecfdf5' : '#fff7ed', color: isApproved ? '#16a34a' : '#ea580c', fontWeight: 900, fontSize: 14 }}>
                                {resp.nombre?.charAt(0) || 'A'}
                              </Avatar>
                              <Box>
                                <Typography fontWeight={850} fontSize={14}>
                                  {resp.nombre}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {resp.cargo}
                                </Typography>
                              </Box>
                            </Stack>

                            <Box sx={{ textAlign: 'right' }}>
                              {isApproved ? (
                                <Box>
                                  <Chip
                                    size="small"
                                    icon={<CheckCircleRoundedIcon sx={{ fontSize: '14px !important', color: '#16a34a !important' }} />}
                                    label="Visto Bueno Aprobado"
                                    sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 900 }}
                                  />
                                  {vbInfo.fecha && (
                                    <Typography variant="caption" display="block" color="text.secondary" mt={0.3}>
                                      {formatDateDetailed(vbInfo.fecha)}
                                    </Typography>
                                  )}
                                </Box>
                              ) : (
                                <Chip
                                  size="small"
                                  icon={<HourglassTopRoundedIcon sx={{ fontSize: '14px !important', color: '#d97706 !important' }} />}
                                  label="Pendiente de Visto Bueno"
                                  sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 800 }}
                                />
                              )}
                            </Box>

                            {vbInfo.comentario && (
                              <Box sx={{ width: '100%', mt: 0.5, p: 1, bgcolor: '#f8fafc', borderRadius: 1.5, borderLeft: '3px solid #10b981' }}>
                                <Typography variant="caption" sx={{ color: '#475569', fontStyle: 'italic' }}>
                                  "{vbInfo.comentario}"
                                </Typography>
                              </Box>
                            )}
                          </Paper>
                        );
                      })}
                    </Stack>
                  </Paper>
                )}

                {/* DOCUMENTOS */}
                <Paper variant="outlined" sx={{ p: 2.2, borderRadius: 3 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography fontWeight={950}>Documentos y anexos del expediente</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {['entregado', 'cerrado'].includes(selected.estado)
                          ? 'Los documentos son temporales durante el trámite y se conservan en el hilo de correos institucionales tras su entrega.'
                          : 'Cualquier asesor o funcionario asignado puede incorporar archivos de soporte o respuestas.'}
                      </Typography>
                    </Box>
                    {!['entregado', 'cerrado', 'cancelado'].includes(selected.estado) && (
                      <>
                        <input hidden ref={attachmentRef} type="file" accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg" onChange={handleAttachment} />
                        <Button size="small" variant="contained" startIcon={<AttachFileRoundedIcon />} onClick={() => attachmentRef.current?.click()} sx={{ bgcolor: COLORS.blue, textTransform: 'none', fontWeight: 800 }}>
                          Adjuntar
                        </Button>
                      </>
                    )}
                  </Stack>

                  {Boolean(selected.metadata?.adjuntos_purgados || ['entregado', 'cerrado'].includes(selected.estado)) && (
                    <Alert severity="info" sx={{ mt: 1.5, mb: 1, borderRadius: 2, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>
                      <Typography variant="subtitle2" fontWeight={900}>
                        Documentos temporales depurados del servidor
                      </Typography>
                      <Typography variant="caption" display="block">
                        Conforme a la política institucional de no saturar almacenamiento, los archivos adjuntos son temporales mientras el expediente está activo y son depurados del servidor al cerrar el trámite. Todos los documentos se conservan permanentemente en el <strong>hilo de correos electrónicos institucionales</strong> enviado a los funcionarios asignados y la jefatura.
                      </Typography>
                    </Alert>
                  )}

                  <Stack spacing={1} mt={1.8}>
                    {/* Archivos activos en base de datos (durante el trámite) */}
                    {(selected.adjuntos || []).map((a) => (
                      <Paper
                        key={a.id}
                        variant="outlined"
                        sx={{
                          p: 1.2,
                          px: 1.6,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1
                        }}
                      >
                        <Stack direction="row" spacing={1.2} alignItems="center" sx={{ minWidth: 0 }}>
                          <AttachFileRoundedIcon sx={{ color: '#2563eb' }} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography fontWeight={800} fontSize={13.5} noWrap>
                              {a.nombre_original}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {a.usuario?.nombre ? `Cargado por: ${a.usuario.nombre}` : 'Documento del expediente'} · {formatDateBrief(a.created_at)}
                            </Typography>
                          </Box>
                        </Stack>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<DownloadRoundedIcon />}
                          onClick={() => downloadAttachment(a)}
                          sx={{ flexShrink: 0, textTransform: 'none', fontWeight: 800 }}
                        >
                          Descargar
                        </Button>
                      </Paper>
                    ))}

                    {/* Archivos depurados (tras el cierre formal) */}
                    {(selected.metadata?.adjuntos_depurados || []).map((a, idx) => (
                      <Paper
                        key={`dep-${idx}`}
                        variant="outlined"
                        sx={{
                          p: 1.2,
                          px: 1.6,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1,
                          bgcolor: '#f8fafc',
                          border: '1px dashed #cbd5e1'
                        }}
                      >
                        <Stack direction="row" spacing={1.2} alignItems="center" sx={{ minWidth: 0 }}>
                          <AttachFileRoundedIcon sx={{ color: '#64748b' }} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography fontWeight={800} fontSize={13.5} color="#334155" noWrap>
                              {a.nombre_original}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {(Number(a.tamano_bytes) / 1024).toFixed(0)} KB · Depurado el {formatDateBrief(a.fecha_depuracion)}
                            </Typography>
                          </Box>
                        </Stack>
                        <Chip
                          size="small"
                          label="Enviado por Correo Institucional"
                          variant="outlined"
                          color="success"
                          sx={{ fontWeight: 800, fontSize: '0.72rem', bgcolor: '#f0fdf4' }}
                        />
                      </Paper>
                    ))}

                    {!selected.adjuntos?.length && !selected.metadata?.adjuntos_depurados?.length && (
                      <Typography variant="body2" color="text.secondary" sx={{ py: 1, textAlign: 'center' }}>
                        Todavía no hay soportes o respuestas adjuntas en este expediente.
                      </Typography>
                    )}
                  </Stack>
                </Paper>

                {/* TRAZABILIDAD */}
                <Paper variant="outlined" sx={{ p: 2.2, borderRadius: 3 }}>
                  <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                    <HistoryRoundedIcon color="primary" />
                    <Typography fontWeight={950}>Trazabilidad completa</Typography>
                  </Stack>
                  <Stack spacing={0}>
                    {(selected.historial || []).map((h, index) => (
                      <Box
                        key={h.id}
                        sx={{
                          pl: 2.5,
                          pb: 2,
                          borderLeft: index === selected.historial.length - 1 ? '2px solid transparent' : '2px solid #cbd5e1',
                          position: 'relative',
                          '&:before': {
                            content: '""',
                            position: 'absolute',
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: COLORS.blue,
                            left: -6,
                            top: 5
                          }
                        }}
                      >
                        <Typography fontWeight={850}>{h.evento.replaceAll('_', ' ')}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {h.usuario?.nombre || 'Sistema'} · {formatDateBrief(h.created_at)}
                        </Typography>
                        {h.comentario && (
                          <Typography variant="body2" mt={0.5} sx={{ color: '#334155', bgcolor: '#f8fafc', p: 1, borderRadius: 1.5 }}>
                            {h.comentario}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              </Stack>

              {/* PANEL LATERAL DE ACCIONES */}
              <Stack spacing={2}>
                {/* BOTÓN DESTACADO PARA EMITIR VISTO BUENO */}
                {canGiveVistoBueno && (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.2,
                      borderRadius: 3,
                      bgcolor: '#f0fdf4',
                      border: '2px solid #86efac',
                      boxShadow: '0 4px 16px rgba(22, 163, 74, 0.12)'
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                      <TaskAltRoundedIcon sx={{ color: '#16a34a' }} />
                      <Typography fontWeight={950} color="#14532d">
                        Tu Visto Bueno Requerido
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="#166534" mb={1.8}>
                      Estás asignado como asesor a este asunto. Registra tu visto bueno para autorizar formalmente la entrega del expediente.
                    </Typography>
                    <Button
                      fullWidth
                      variant="contained"
                      color="success"
                      startIcon={<ThumbUpAltRoundedIcon />}
                      onClick={() => setVbOpen(true)}
                      sx={{ fontWeight: 900, py: 1.1, borderRadius: 2 }}
                    >
                      Emitir mi Visto Bueno
                    </Button>
                  </Paper>
                )}

                {canAssign && (
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: '#f8fbff' }}>
                    <Typography fontWeight={950}>Asignación de jefatura</Typography>
                    <Typography variant="body2" color="text.secondary" mb={1.5}>
                      Asigna a uno o varios asesores y fija el término legal de respuesta.
                    </Typography>
                    <Button fullWidth variant="contained" startIcon={<AssignmentIndRoundedIcon />} onClick={openAssignment}>
                      Asignar o reasignar
                    </Button>
                  </Paper>
                )}

                {/* ACCIONES SEGREGADAS POR ROL OPERATIVO */}
                {profile.role === 'secretaria' ? (
                  !['aprobado_jefatura', 'pendiente_radicacion_salida', 'entregado', 'cerrado'].includes(selected?.estado) ? (
                    <Paper variant="outlined" sx={{ p: 2.2, borderRadius: 3, bgcolor: '#fffbeb', borderColor: '#fde68a' }}>
                      <Stack direction="row" spacing={1} alignItems="center" mb={0.8}>
                        <InfoOutlinedIcon sx={{ color: '#b45309', fontSize: 20 }} />
                        <Typography fontWeight={900} color="#92400e" fontSize="0.9rem">
                          En Trámite con Jefatura y Asesores
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="#78350f" fontSize="0.82rem">
                        Estado actual: <strong>{STATE[selected?.estado]?.[0] || selected?.estado}</strong>.
                        <br />
                        Este caso se encuentra en análisis técnico y revisión jurídica. La Secretaría podrá radicar la salida institucional y realizar el despacho tan pronto la Asesora Jurídica apruebe la respuesta final (estado <em>&quot;Aprobado por jefatura&quot;</em>).
                      </Typography>
                    </Paper>
                  ) : (
                    <Paper elevation={0} sx={{ p: 2.2, borderRadius: 3, bgcolor: '#f0fdfa', border: '1.5px solid #99f6e4' }}>
                      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                        <SendRoundedIcon sx={{ color: '#0d9488' }} />
                        <Typography fontWeight={950} color="#115e59">
                          Radicación de Salida y Despacho
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="#134e4a" fontSize="0.82rem" mb={1.5}>
                        Expediente aprobado por la Jefatura Jurídica. Registre el radicado de salida oficial y despache al peticionario:
                      </Typography>

                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="Acción de Secretaría"
                        value={transition.estado || 'pendiente_radicacion_salida'}
                        onChange={(e) => setTransition({ ...transition, estado: e.target.value })}
                        sx={{ mb: 1.5, bgcolor: '#fff' }}
                      >
                        <MenuItem value="pendiente_radicacion_salida">Asignar radicado de salida</MenuItem>
                        <MenuItem value="entregado">Marcar entregado y despachado</MenuItem>
                        <MenuItem value="cerrado">Cerrar expediente definitivamente</MenuItem>
                      </TextField>

                      <TextField
                        fullWidth
                        size="small"
                        label="Número de radicado de salida"
                        placeholder="Ej: OF-JUR-2026-0042"
                        value={transition.radicado}
                        onChange={(e) => setTransition({ ...transition, radicado: e.target.value })}
                        sx={{ mb: 1.5, bgcolor: '#fff' }}
                      />

                      <TextField
                        fullWidth
                        size="small"
                        label="Medio de despacho / entrega"
                        placeholder="Ej: Correo electrónico al peticionario, ventanilla única..."
                        value={transition.despacho}
                        onChange={(e) => setTransition({ ...transition, despacho: e.target.value })}
                        sx={{ mb: 1.5, bgcolor: '#fff' }}
                      />

                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        size="small"
                        label="Comentario de despacho"
                        placeholder="Detalles del envío o notificación..."
                        value={transition.comentario}
                        onChange={(e) => setTransition({ ...transition, comentario: e.target.value })}
                        sx={{ mb: 1.5, bgcolor: '#fff' }}
                      />

                      <Button
                        fullWidth
                        disabled={busy}
                        variant="contained"
                        color="success"
                        startIcon={<SendRoundedIcon />}
                        onClick={() => {
                          const targetState = transition.estado || 'pendiente_radicacion_salida';
                          handleDirectTransition(targetState, transition.comentario || 'Radicación de salida y despacho registrada por secretaría.', {
                            radicado: transition.radicado,
                            despacho: transition.despacho
                          });
                        }}
                        sx={{ fontWeight: 900, py: 1.1, borderRadius: 2 }}
                      >
                        Registrar Salida / Despacho
                      </Button>
                    </Paper>
                  )
                ) : profile.role === 'asesor' ? (
                  ['asignado', 'devuelto_informacion'].includes(selected?.estado) ? (
                    <Paper elevation={0} sx={{ p: 2.2, borderRadius: 3, bgcolor: '#eff6ff', border: '1.5px solid #bfdbfe' }}>
                      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                        <PendingActionsRoundedIcon sx={{ color: '#2563eb' }} />
                        <Typography fontWeight={950} color="#1e40af">
                          Confirmación de Recibido
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="#1e3a8a" fontSize="0.82rem" mb={1.5}>
                        {selected?.estado === 'devuelto_informacion'
                          ? 'El expediente fue devuelto con retroalimentación de Jefatura. Confirma el reinicio de estudio para proceder con los ajustes solicitados.'
                          : 'Asunto asignado a tu cargo. Confirma el recibido para registrar formalmente el inicio del trámite e iniciar la proyección.'}
                      </Typography>
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        size="small"
                        label="Nota de confirmación (Opcional)"
                        placeholder="Ej: Recibido conforme, procedo con el análisis de antecedentes..."
                        value={transition.comentario}
                        onChange={(e) => setTransition({ ...transition, comentario: e.target.value })}
                        sx={{ mb: 1.5, bgcolor: '#fff' }}
                      />
                      <Button
                        fullWidth
                        variant="contained"
                        disabled={busy}
                        startIcon={<PlayArrowRoundedIcon />}
                        onClick={() => handleDirectTransition('en_estudio', transition.comentario || 'Recibido formalmente por el asesor jurídico asignado.')}
                        sx={{ fontWeight: 900, py: 1.1, borderRadius: 2 }}
                      >
                        Confirmar Recibido e Iniciar Estudio
                      </Button>
                    </Paper>
                  ) : selected?.estado === 'en_estudio' ? (
                    <Paper elevation={0} sx={{ p: 2.2, borderRadius: 3, bgcolor: '#f5f3ff', border: '1.5px solid #ddd6fe' }}>
                      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                        <FactCheckRoundedIcon sx={{ color: '#7c3aed' }} />
                        <Typography fontWeight={950} color="#5b21b6">
                          Enviar a Revisión de Jefatura
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="#4c1d95" fontSize="0.82rem" mb={1.5}>
                        Adjunta el documento borrador en <strong>&quot;Anexos y Soportes&quot;</strong> y emite tu Visto Bueno antes de enviar a revisión.
                      </Typography>
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        size="small"
                        label="Observaciones para la Jefatura"
                        placeholder="Resumen del sentido del concepto o respuesta..."
                        value={transition.comentario}
                        onChange={(e) => setTransition({ ...transition, comentario: e.target.value })}
                        sx={{ mb: 1.5, bgcolor: '#fff' }}
                      />
                      <Button
                        fullWidth
                        variant="contained"
                        disabled={busy}
                        startIcon={<FactCheckRoundedIcon />}
                        onClick={() => handleDirectTransition('respuesta_revision', transition.comentario || 'Propuesta de respuesta enviada a revisión de jefatura.')}
                        sx={{
                          fontWeight: 900,
                          py: 1.1,
                          borderRadius: 2,
                          bgcolor: '#7c3aed',
                          '&:hover': { bgcolor: '#6d28d9' }
                        }}
                      >
                        Enviar a Revisión de Jefatura
                      </Button>
                    </Paper>
                  ) : (
                    <Paper variant="outlined" sx={{ p: 2.2, borderRadius: 3, bgcolor: '#f8fafc', borderColor: '#e2e8f0' }}>
                      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                        <CheckCircleOutlineRoundedIcon sx={{ color: '#059669', fontSize: 22 }} />
                        <Typography fontWeight={950} color="#0f172a" fontSize="0.92rem">
                          {selected?.estado === 'respuesta_revision' ? 'En Revisión de Jefatura' : 'Trámite en Gestión Final'}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="#475569" fontSize="0.82rem" lineHeight={1.5}>
                        {selected?.estado === 'respuesta_revision'
                          ? 'El expediente se encuentra en revisión con la Asesora Jurídica. Si requiere ajustes, se te devolverá con comentarios.'
                          : `Expediente en estado "${STATE[selected?.estado]?.[0] || selected?.estado}". La Secretaría efectúa el despacho de salida.`}
                      </Typography>
                    </Paper>
                  )
                ) : (
                  /* ROL JEFATURA / ADMINISTRADOR */
                  <Paper variant="outlined" sx={{ p: 2.2, borderRadius: 3 }}>
                    <Typography fontWeight={950} mb={1}>Trámite y Control de Jefatura</Typography>

                    {selected?.estado === 'respuesta_revision' && (
                      <Stack spacing={1.5} mb={2}>
                        <Button
                          fullWidth
                          variant="contained"
                          color="success"
                          startIcon={<CheckCircleRoundedIcon />}
                          disabled={busy}
                          onClick={() => handleDirectTransition('aprobado_jefatura', transition.comentario || 'Respuesta revisada y aprobada por la Jefatura Jurídica. Lista para despacho institucional.')}
                          sx={{ fontWeight: 900, py: 1, borderRadius: 2 }}
                        >
                          Aprobar Respuesta (Listo para Despacho)
                        </Button>
                        <Button
                          fullWidth
                          variant="outlined"
                          color="error"
                          startIcon={<WarningAmberRoundedIcon />}
                          disabled={busy}
                          onClick={() => {
                            if (!transition.comentario?.trim()) {
                              setError('Por favor indique las observaciones o motivos de devolución en el campo inferior de comentarios.');
                              return;
                            }
                            handleDirectTransition('devuelto_informacion', transition.comentario, { devolucion: transition.comentario });
                          }}
                          sx={{ fontWeight: 900, py: 1, borderRadius: 2 }}
                        >
                          Devolver al Asesor con Retroalimentación
                        </Button>
                      </Stack>
                    )}

                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Cambiar estado a..."
                      value={transition.estado}
                      onChange={(e) => setTransition({ ...transition, estado: e.target.value })}
                      sx={{ mt: 0.5 }}
                    >
                      {(getAvailableActionsForRole(profile.role, selected) || ACTIONS.jefatura).map(([value, label]) => (
                        <MenuItem key={value} value={value}>{label}</MenuItem>
                      ))}
                    </TextField>

                    {['pendiente_radicacion_salida', 'entregado', 'cerrado'].includes(transition.estado) && (
                      <>
                        <TextField
                          fullWidth
                          size="small"
                          label="Radicado de salida"
                          placeholder="Ej: OF-JUR-2026-0042"
                          value={transition.radicado}
                          onChange={(e) => setTransition({ ...transition, radicado: e.target.value })}
                          sx={{ mt: 1.5 }}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          label="Despacho / medio de entrega"
                          placeholder="Ej: Correo electrónico, ventanilla única..."
                          value={transition.despacho}
                          onChange={(e) => setTransition({ ...transition, despacho: e.target.value })}
                          sx={{ mt: 1.5 }}
                        />
                      </>
                    )}

                    <TextField
                      fullWidth
                      multiline
                      minRows={3}
                      size="small"
                      label="Comentario / Retroalimentación obligatoria"
                      placeholder="Ingrese los motivos, instrucciones para el asesor o detalles de trazabilidad..."
                      value={transition.comentario}
                      onChange={(e) => setTransition({ ...transition, comentario: e.target.value })}
                      sx={{ mt: 1.5 }}
                    />

                    <Button
                      fullWidth
                      disabled={!transition.estado || busy}
                      variant="contained"
                      color="primary"
                      startIcon={<AutorenewRoundedIcon />}
                      onClick={handleTransition}
                      sx={{ mt: 1.5, fontWeight: 900, borderRadius: 2 }}
                    >
                      Registrar Avance de Jefatura
                    </Button>
                  </Paper>
                )}
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* DIÁLOGO: ASIGNAR ASUNTO Y TÉRMINO */}
      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle fontWeight={950}>Asignar asunto jurídico y fijar término</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={0.5}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, bgcolor: '#f8fafc' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1} flexWrap="wrap" gap={1}>
                <Typography variant="subtitle2" fontWeight={900} color="#0f172a">
                  Asignación a Asesores ({assignment.responsables_ids?.length || 0} seleccionados)
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    onClick={() => setAssignment({ ...assignment, responsables_ids: advisers.map((u) => u.id) })}
                    sx={{ textTransform: 'none', fontWeight: 850, fontSize: 12 }}
                  >
                    Seleccionar todos
                  </Button>
                  <Button
                    size="small"
                    color="secondary"
                    onClick={() => setAssignment({ ...assignment, responsables_ids: [] })}
                    sx={{ textTransform: 'none', fontWeight: 850, fontSize: 12 }}
                  >
                    Limpiar
                  </Button>
                </Stack>
              </Stack>

              <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                Puede asignar a uno, varios o a todos los asesores jurídicos. Cuando se asignan múltiples responsables, cada uno deberá ingresar desde su cuenta para emitir su visto bueno antes de que el asunto pueda cerrarse o entregarse.
              </Typography>

              <FormGroup>
                {advisers.map((u) => {
                  const isChecked = (assignment.responsables_ids || []).includes(u.id);
                  return (
                    <Paper
                      key={u.id}
                      variant="outlined"
                      sx={{
                        p: 0.8,
                        px: 1.2,
                        mb: 0.8,
                        borderRadius: 2,
                        bgcolor: isChecked ? '#eff6ff' : '#ffffff',
                        borderColor: isChecked ? '#93c5fd' : '#e2e8f0'
                      }}
                    >
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={isChecked}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const current = assignment.responsables_ids || [];
                              const updated = checked ? [...current, u.id] : current.filter((id) => id !== u.id);
                              setAssignment({ ...assignment, responsables_ids: updated });
                            }}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" fontWeight={850}>
                              {u.nombre}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {u.cargo}
                            </Typography>
                          </Box>
                        }
                        sx={{ m: 0, width: '100%' }}
                      />
                    </Paper>
                  );
                })}
              </FormGroup>
            </Paper>

            <TextField
              select
              label="Secretaría para sistematización"
              value={assignment.secretario_id}
              onChange={(e) => setAssignment({ ...assignment, secretario_id: e.target.value })}
            >
              <MenuItem value="">Sin asignar</MenuItem>
              {secretaries.map((u) => (
                <MenuItem key={u.id} value={u.id}>{u.nombre}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Prioridad"
              value={assignment.nivel}
              onChange={(e) => setAssignment({ ...assignment, nivel: e.target.value })}
            >
              {['Alta', 'Media', 'Baja'].map((x) => (
                <MenuItem key={x} value={x}>{x}</MenuItem>
              ))}
            </TextField>

            <TextField
              label="Fecha límite de respuesta"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={assignment.fecha_limite}
              onChange={(e) => setAssignment({ ...assignment, fecha_limite: e.target.value })}
              helperText={assignment.fecha_limite ? `Vence el ${formatDateDetailed(assignment.fecha_limite)}` : ''}
            />

            {/* BOTONES RÁPIDOS DE TÉRMINO */}
            <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Typography variant="caption" fontWeight={850} color="#1e3a8a" display="block" mb={1}>
                Calcular término a partir de la fecha de radicación:
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.8}>
                {DERECHO_PETICION_PRESETS.map((preset) => (
                  <Chip
                    key={preset.key}
                    label={`${preset.label} (${preset.title})`}
                    size="small"
                    onClick={() => applyPresetToAssignment(preset)}
                    sx={{
                      cursor: 'pointer',
                      fontWeight: 800,
                      borderColor: '#93c5fd',
                      bgcolor: assignment.dias_calculados === preset.days ? '#dbeafe' : '#fff'
                    }}
                    variant="outlined"
                  />
                ))}
              </Stack>
            </Box>

            <TextField
              multiline
              minRows={3}
              label="Instrucciones de la jefatura"
              value={assignment.comentario}
              onChange={(e) => setAssignment({ ...assignment, comentario: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignOpen(false)}>Cancelar</Button>
          <Button variant="contained" disabled={busy} onClick={handleAssign}>
            Confirmar asignación
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIÁLOGO: PRÓRROGA O AJUSTE DE TÉRMINO */}
      <Dialog open={prorrogaOpen} onClose={() => setProrrogaOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle fontWeight={950}>Ajustar término o registrar prórroga</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <Alert severity="info" sx={{ fontSize: 13 }}>
              Según el Art. 14 de la Ley 1755 de 2015, la prórroga no podrá exceder del doble del término inicial.
            </Alert>
            <TextField
              label="Nueva fecha límite"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={prorrogaData.fecha_limite}
              onChange={(e) => setProrrogaData({ ...prorrogaData, fecha_limite: e.target.value })}
              helperText={prorrogaData.fecha_limite ? `Nueva fecha: ${formatDateDetailed(prorrogaData.fecha_limite)}` : ''}
            />
            <TextField
              multiline
              minRows={3}
              label="Motivo de la prórroga o ajuste"
              placeholder="Indique las razones fácticas o jurídicas de la ampliación del plazo..."
              value={prorrogaData.motivo}
              onChange={(e) => setProrrogaData({ ...prorrogaData, motivo: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProrrogaOpen(false)}>Cancelar</Button>
          <Button variant="contained" color="warning" onClick={handleProrroga} disabled={busy || !prorrogaData.fecha_limite}>
            Guardar prórroga
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIÁLOGO: EMITIR VISTO BUENO / ENTREGA DE CONCEPTO */}
      <Dialog open={vbOpen} onClose={() => setVbOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle fontWeight={950}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TaskAltRoundedIcon sx={{ color: '#16a34a' }} />
            <Typography variant="h6" fontWeight={950}>
              Emitir Visto Bueno / Entregar Concepto
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            Al confirmar, dejarás constancia formal de que has revisado y aprobado el asunto. Tu visto bueno quedará registrado con fecha y hora en el expediente.
          </Alert>

          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Comentarios u observaciones del concepto (opcional)"
            placeholder="Ej: Revisado y conforme a derecho. Documento listo para trámite de salida..."
            value={vbComentario}
            onChange={(e) => setVbComentario(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setVbOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="success"
            disabled={busy}
            onClick={handleVistoBueno}
            sx={{ fontWeight: 900 }}
          >
            Confirmar y emitir visto bueno
          </Button>
        </DialogActions>
      </Dialog>

      {busy && (
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: '#ffffff77', zIndex: 1800, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <CircularProgress />
        </Box>
      )}
    </Stack>
  );
}
