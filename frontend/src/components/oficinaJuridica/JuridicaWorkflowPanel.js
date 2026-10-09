import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
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
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
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
    ['en_estudio', 'Iniciar estudio'],
    ['respuesta_revision', 'Enviar a revisión de jefatura'],
    ['devuelto_informacion', 'Solicitar información al área'],
    ['pendiente_radicacion_salida', 'Registrar orden de salida'],
    ['entregado', 'Marcar entregado al interesado']
  ],
  jefatura: [
    ['aprobado_jefatura', 'Aprobar respuesta'],
    ['devuelto_informacion', 'Devolver al asesor con observaciones'],
    ['pendiente_radicacion_salida', 'Enviar a radicación de salida'],
    ['entregado', 'Marcar entregado'],
    ['cerrado', 'Cerrar expediente']
  ],
  secretaria: [
    ['pendiente_radicacion_salida', 'Registrar radicado de salida'],
    ['entregado', 'Marcar entregado y despachado'],
    ['cerrado', 'Cerrar expediente']
  ],
  administrador: [
    ['en_estudio', 'Iniciar estudio'],
    ['respuesta_revision', 'Enviar a revisión'],
    ['aprobado_jefatura', 'Aprobar'],
    ['pendiente_radicacion_salida', 'Radicar salida'],
    ['entregado', 'Entregar'],
    ['cerrado', 'Cerrar']
  ]
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

const StatusChip = ({ value }) => {
  const meta = STATE[value] || [value || 'Sin estado', '#475569', '#f1f5f9'];
  return (
    <Chip
      size="small"
      label={meta[0]}
      sx={{ color: meta[1], bgcolor: meta[2], fontWeight: 850, border: `1px solid ${meta[1]}22` }}
    />
  );
};

const TermAlertChip = ({ fechaLimite, estado, fechaIngreso }) => {
  const alert = getTermAlert(fechaLimite, estado, fechaIngreso);
  return (
    <Tooltip title={alert.sublabel || alert.label} arrow>
      <Chip
        size="small"
        icon={alert.urgent ? <AlarmRoundedIcon sx={{ fontSize: '14px !important', color: `${alert.color} !important` }} /> : undefined}
        label={alert.label}
        sx={{
          color: alert.color,
          bgcolor: alert.bg,
          fontWeight: 850,
          border: `1px solid ${alert.borderColor}`,
          fontSize: 11.5,
          height: 24,
          '& .MuiChip-icon': { ml: 0.5 }
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

function Metric({ icon: Icon, label, value, color, helper, onClick, active }) {
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 2.1,
        borderRadius: 3,
        border: active ? `2px solid ${color}` : '1px solid #dbe5f3',
        bgcolor: active ? `${color}08` : '#fff',
        flex: '1 1 170px',
        minWidth: 165,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all .2s ease',
        '&:hover': onClick ? { transform: 'translateY(-2px)', borderColor: color, boxShadow: `0 8px 20px ${color}15` } : {}
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Avatar sx={{ bgcolor: `${color}14`, color, width: 46, height: 46 }}>
          <Icon />
        </Avatar>
        <Box>
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 900, letterSpacing: 0.5 }}>
            {label}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 950, color: COLORS.ink, lineHeight: 1.1 }}>
            {value ?? 0}
          </Typography>
          <Typography variant="caption" color="text.secondary">
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
      const [p, list, summary] = await Promise.all([
        oficinaJuridicaService.getProfile(),
        oficinaJuridicaService.list(),
        oficinaJuridicaService.stats()
      ]);
      setProfile(p.data);
      setRows(list.data || []);
      setStats(summary.data || {});
    } catch (e) {
      setError(e.response?.data?.message || 'No fue posible cargar la gestión jurídica.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  // Contadores para filtros de asesor
  const myAssignedCount = useMemo(() => {
    if (!authUser?.id) return 0;
    const uid = Number(authUser.id);
    return rows.filter((r) => {
      const respId = Number(r.responsable_id);
      const isDirect = respId === uid || r.metadata?.responsable_snapshot?.id === uid;
      const ids = (r.metadata?.responsables_ids || []).map(Number);
      return isDirect || ids.includes(uid);
    }).length;
  }, [rows, authUser]);

  const salidasCount = useMemo(() => {
    return rows.filter((r) => ['aprobado_jefatura', 'pendiente_radicacion_salida', 'respuesta_revision'].includes(r.estado)).length;
  }, [rows]);

  // Filtrado compuesto
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
        const uid = Number(authUser?.id);
        const respId = Number(row.responsable_id);
        const isDirect = respId === uid || row.metadata?.responsable_snapshot?.id === uid;
        const ids = (row.metadata?.responsables_ids || []).map(Number);
        matchesScope = isDirect || ids.includes(uid);
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
  }, [rows, search, stateFilter, groupFilter, scopeFilter, termFilter, authUser]);

  const visibleRows = useMemo(() => {
    return filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  useEffect(() => {
    setPage(0);
  }, [search, stateFilter, groupFilter, scopeFilter, termFilter]);

  const advisers = profile.team.filter((u) => ['asesor', 'jefatura'].includes(u.juridica_rol));
  const secretaries = profile.team.filter((u) => u.juridica_rol === 'secretaria');
  const canAssign = ['administrador', 'jefatura'].includes(profile.role);

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
      const r = await oficinaJuridicaService.create(form);
      setCreateOpen(false);
      setForm(emptyForm);
      setNotice(`Solicitud NRI ${r.data.nri} radicada correctamente con término fijado al ${formatDateBrief(r.data.fecha_limite)}.`);
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
    if (!selected || !authUser?.id) return false;
    const uid = Number(authUser.id);
    const ids = (selected.metadata?.responsables_ids || (selected.responsable_id ? [selected.responsable_id] : [])).map(Number);
    const isAssigned = ids.includes(uid);
    const vb = selected.metadata?.vistos_buenos || {};
    const alreadyApproved = vb[uid]?.aprobado === true;
    return isAssigned && !alreadyApproved && !['entregado', 'cerrado', 'cancelado'].includes(selected.estado);
  }, [selected, authUser]);

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

  const handleTransition = async () => {
    if (!transition.estado) return;
    setBusy(true);
    try {
      const response = await oficinaJuridicaService.transition(selected.id, transition);
      replaceRow(response.data);
      setTransition({ estado: '', comentario: '', radicado: '', despacho: '', resultado: '' });
      setNotice('Estado actualizado con trazabilidad.');
      await Promise.all([refreshSelected(selected.id), refreshStats()]);
    } catch (e) {
      setError(e.response?.data?.message || 'No fue posible actualizar el estado.');
    } finally {
      setBusy(false);
    }
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
      {/* Banner Principal */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.4, md: 3 },
          borderRadius: 4,
          color: '#fff',
          overflow: 'hidden',
          position: 'relative',
          background: 'linear-gradient(120deg,#091b3d 0%,#1745a5 58%,#0e7490 100%)'
        }}
      >
        <Box sx={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', bgcolor: '#ffffff10', right: -60, top: -110 }} />
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ md: 'center' }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ width: 58, height: 58, bgcolor: '#ffffff18', border: '1px solid #ffffff40' }}>
              <GavelRoundedIcon sx={{ fontSize: 32 }} />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 950, fontSize: { xs: 24, md: 31 } }}>
                Gestión de Asuntos Jurídicos
              </Typography>
              <Typography sx={{ color: '#dbeafe', mt: 0.4 }}>
                Control de términos legales, radicación de derechos de petición, órdenes de salida y expediente digital.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Chip
              icon={<TimerRoundedIcon sx={{ fontSize: 16, color: '#0284c7 !important' }} />}
              label="Control de Términos Ley 1755"
              sx={{ bgcolor: '#fff', color: COLORS.blue, fontWeight: 900 }}
            />
            <Chip
              label={`Perfil: ${profile.role}`}
              sx={{ bgcolor: '#ffffff25', color: '#fff', fontWeight: 900, textTransform: 'capitalize' }}
            />
          </Stack>
        </Stack>
      </Paper>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}

      {/* Métricas con Semáforo de Términos */}
      <Stack direction="row" flexWrap="wrap" gap={1.5}>
        <Metric
          icon={InboxRoundedIcon}
          label="TOTAL DE ASUNTOS"
          value={stats.total}
          color={COLORS.blue}
          helper="Expedientes registrados"
          onClick={handleSelectAll}
          active={!stateFilter && !termFilter && !scopeFilter}
        />
        <Metric
          icon={PendingActionsRoundedIcon}
          label="EN TRÁMITE"
          value={stats.abiertos}
          color={COLORS.orange}
          helper="Bandeja activa"
          onClick={() => { setStateFilter('asignado'); setTermFilter(''); setScopeFilter(''); setPage(0); }}
          active={stateFilter === 'asignado' && !scopeFilter}
        />
        <Metric
          icon={AlarmRoundedIcon}
          label="POR VENCER (≤ 5 D.H.)"
          value={stats.por_vencer ?? termCounts.porVencer}
          color="#d97706"
          helper="Términos próximos a vencer"
          onClick={() => handleSelectScope('por_vencer')}
          active={scopeFilter === 'por_vencer'}
        />
        <Metric
          icon={WarningAmberRoundedIcon}
          label="VENCIDOS"
          value={stats.vencidos ?? termCounts.vencidos}
          color={COLORS.red}
          helper="Término legal superado"
          onClick={() => handleSelectScope('vencidos')}
          active={scopeFilter === 'vencidos'}
        />
        <Metric
          icon={CheckCircleRoundedIcon}
          label="FINALIZADOS"
          value={stats.cerrados}
          color={COLORS.green}
          helper="Entregados o cerrados"
          onClick={() => { setStateFilter('entregado'); setTermFilter(''); setScopeFilter(''); setPage(0); }}
          active={stateFilter === 'entregado'}
        />
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
              Nueva solicitud
            </Button>
            {['administrador', 'jefatura', 'secretaria'].includes(profile.role) && (
              <>
                <input hidden ref={importRef} type="file" accept=".xlsx" onChange={handleImport} />
                <Button startIcon={<CloudUploadRoundedIcon />} variant="outlined" onClick={() => importRef.current?.click()}>
                  Importar control
                </Button>
              </>
            )}
            <Button startIcon={<DownloadRoundedIcon />} variant="outlined" onClick={handleExport}>
              Exportar Excel
            </Button>
          </Stack>
        </Stack>

        {loading ? (
          <Box sx={{ py: 10, display: 'grid', placeItems: 'center' }}>
            <CircularProgress />
          </Box>
        ) : tab === 0 ? (
          <>
            {/* BARRA DE VISTAS OPERATIVAS RÁPIDAS (SEGMENTOS MODERNOS) */}
            <Box
              sx={{
                p: { xs: 1.2, md: 1.5 },
                bgcolor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                overflowX: 'auto',
                '&::-webkit-scrollbar': { height: 6 },
                '&::-webkit-scrollbar-thumb': { bgcolor: '#cbd5e1', borderRadius: 3 }
              }}
            >
              <Stack
                direction="row"
                spacing={1.2}
                alignItems="center"
                sx={{ minWidth: 'max-content' }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 900,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: 0.7,
                    fontSize: '0.72rem',
                    pr: 0.5,
                    display: { xs: 'none', lg: 'block' }
                  }}
                >
                  Vistas rápidas:
                </Typography>

                <QuickScopeCard
                  title="Todos los asuntos"
                  subtitle="Bandeja general"
                  icon={InboxRoundedIcon}
                  count={rows.length}
                  activeColor="#0b1f45"
                  inactiveIconColor="#1e40af"
                  badgeBg="#f1f5f9"
                  badgeColor="#334155"
                  active={!scopeFilter && !stateFilter && !termFilter}
                  onClick={handleSelectAll}
                />

                <QuickScopeCard
                  title="Mis asuntos asignados"
                  subtitle="Mi carga laboral"
                  icon={PersonRoundedIcon}
                  count={myAssignedCount}
                  activeColor="#1d4ed8"
                  inactiveIconColor="#2563eb"
                  badgeBg="#dbeafe"
                  badgeColor="#1e40af"
                  active={scopeFilter === 'mis_asignados'}
                  onClick={() => handleSelectScope('mis_asignados')}
                />

                <QuickScopeCard
                  title="Atrasados / Vencidos"
                  subtitle="Término legal superado"
                  icon={WarningAmberRoundedIcon}
                  count={termCounts.vencidos}
                  activeColor="#dc2626"
                  inactiveIconColor="#dc2626"
                  badgeBg="#fee2e2"
                  badgeColor="#b91c1c"
                  urgent={true}
                  active={scopeFilter === 'vencidos'}
                  onClick={() => handleSelectScope('vencidos')}
                />

                <QuickScopeCard
                  title="Por vencer ≤ 5 d.h."
                  subtitle="Alerta preventiva"
                  icon={AlarmRoundedIcon}
                  count={termCounts.porVencer}
                  activeColor="#d97706"
                  inactiveIconColor="#d97706"
                  badgeBg="#fef3c7"
                  badgeColor="#b45309"
                  active={scopeFilter === 'por_vencer'}
                  onClick={() => handleSelectScope('por_vencer')}
                />

                <QuickScopeCard
                  title="Órdenes de salida"
                  subtitle="Listas para radicación"
                  icon={OutboxRoundedIcon}
                  count={salidasCount}
                  activeColor="#7c3aed"
                  inactiveIconColor="#7c3aed"
                  badgeBg="#f3e8ff"
                  badgeColor="#6d28d9"
                  active={scopeFilter === 'salidas'}
                  onClick={() => handleSelectScope('salidas')}
                />
              </Stack>
            </Box>

            {/* AVISO INFORMATIVO DE VISTA RÁPIDA ACTIVA */}
            {scopeFilter && (
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ px: 2, py: 0.8, bgcolor: '#eff6ff', borderBottom: '1px solid #bfdbfe' }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#1e40af' }}>
                    Vista rápida activa:
                  </Typography>
                  <Chip
                    size="small"
                    label={
                      scopeFilter === 'mis_asignados'
                        ? 'Mis asuntos asignados'
                        : scopeFilter === 'vencidos'
                        ? 'Atrasados / Vencidos (Término superado)'
                        : scopeFilter === 'por_vencer'
                        ? 'Por vencer (≤ 5 días hábiles)'
                        : 'Órdenes de salida / Por radicar'
                    }
                    sx={{ bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 900 }}
                  />
                  <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 700 }}>
                    ({filtered.length} {filtered.length === 1 ? 'asunto coincide' : 'asuntos coinciden'})
                  </Typography>
                </Stack>
                <Button
                  size="small"
                  variant="text"
                  onClick={handleSelectAll}
                  sx={{ textTransform: 'none', fontWeight: 850, color: '#1d4ed8' }}
                >
                  Restablecer a todos
                </Button>
              </Stack>
            )}

            {/* Barra de Filtros con Alerta de Término */}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ p: 1.7, bgcolor: '#f8fafc', borderBottom: '1px solid #eef2f6' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Buscar por NRI, radicado, asunto, interesado, dependencia o responsable..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{ startAdornment: <SearchRoundedIcon sx={{ mr: 1, color: '#64748b' }} /> }}
              />

              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Grupo / Tipo</InputLabel>
                <Select label="Grupo / Tipo" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                  <MenuItem value="">Todos los grupos</MenuItem>
                  {GROUPS.map((g) => (
                    <MenuItem key={g} value={g}>{g}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Alerta de Término</InputLabel>
                <Select label="Alerta de Término" value={termFilter} onChange={(e) => setTermFilter(e.target.value)}>
                  <MenuItem value="">Todos los términos</MenuItem>
                  <MenuItem value="vencidos" sx={{ color: '#dc2626', fontWeight: 700 }}>🚨 Vencidos ({termCounts.vencidos})</MenuItem>
                  <MenuItem value="por_vencer" sx={{ color: '#d97706', fontWeight: 700 }}>⏰ Por vencer ≤ 5 d.h. ({termCounts.porVencer})</MenuItem>
                  <MenuItem value="en_termino" sx={{ color: '#059669', fontWeight: 700 }}>🟢 En término ({termCounts.enTermino})</MenuItem>
                  <MenuItem value="sin_limite">⚪ Sin fecha límite ({termCounts.sinLimite})</MenuItem>
                  <MenuItem value="finalizados">✓ Finalizados</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Estado</InputLabel>
                <Select label="Estado" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
                  <MenuItem value="">Todos los estados</MenuItem>
                  {Object.entries(STATE).map(([key, value]) => (
                    <MenuItem key={key} value={key}>{value[0]}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {(search || stateFilter || termFilter || groupFilter || scopeFilter) && (
                <Tooltip title="Limpiar todos los filtros">
                  <IconButton
                    size="small"
                    onClick={() => { setSearch(''); setStateFilter(''); setTermFilter(''); setGroupFilter(''); setScopeFilter(''); }}
                    sx={{ alignSelf: 'center', bgcolor: '#e2e8f0' }}
                  >
                    <FilterAltOffRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>

            {/* Tabla de Asuntos con Alerta y Términos */}
            <TableContainer sx={{ maxHeight: 580 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {['NRI / Radicado', 'Fecha radicación', 'Término y vencimiento', 'Asunto e interesado', 'Dependencia', 'Responsable', 'Estado', 'Acciones'].map((h) => (
                      <TableCell key={h} sx={{ bgcolor: '#eef3fb', color: COLORS.navy, fontWeight: 950, py: 1.4 }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleRows.map((row) => (
                    <TableRow hover key={row.id} sx={{ cursor: 'pointer' }} onClick={() => openDetail(row)}>
                      <TableCell>
                        <Typography fontWeight={900}>{row.nri}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.radicado || 'Sin radicado'}</Typography>
                      </TableCell>

                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" fontWeight={700}>
                          {formatDate(row.fecha_ingreso)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Ingreso
                        </Typography>
                      </TableCell>

                      <TableCell sx={{ minWidth: 170 }}>
                        <Stack spacing={0.4}>
                          <TermAlertChip
                            fechaLimite={row.fecha_limite}
                            estado={row.estado}
                            fechaIngreso={row.fecha_ingreso}
                          />
                          {row.fecha_limite && (
                            <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11 }}>
                              Límite: {formatDate(row.fecha_limite)}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>

                      <TableCell sx={{ maxWidth: 360 }}>
                        <Typography fontWeight={850} noWrap sx={{ color: '#0f172a' }}>
                          {row.asunto}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" noWrap>
                          {row.interesado} · <strong style={{ color: '#1d4ed8' }}>{row.grupo || 'Sin clasificar'}</strong>
                        </Typography>
                      </TableCell>

                      <TableCell sx={{ maxWidth: 180 }}>
                        <Typography variant="body2" noWrap>
                          {row.dependencia_solicitante || '—'}
                        </Typography>
                      </TableCell>

                      <TableCell sx={{ minWidth: 175 }}>
                        {row.metadata?.co_responsables?.length > 1 ? (
                          <Box>
                            <Typography variant="body2" fontWeight={800} noWrap>
                              {row.responsable?.nombre || row.metadata?.responsable_snapshot?.nombre || 'Asesor'}
                            </Typography>
                            <Stack direction="row" spacing={0.6} alignItems="center" mt={0.3} flexWrap="wrap">
                              <Chip
                                size="small"
                                icon={<GroupsRoundedIcon sx={{ fontSize: '13px !important' }} />}
                                label={`+${row.metadata.co_responsables.length - 1} co-responsables`}
                                sx={{ height: 20, fontSize: 10.5, bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 800 }}
                              />
                              {(() => {
                                const ids = (row.metadata?.responsables_ids || []).map(Number);
                                const vb = row.metadata?.vistos_buenos || {};
                                const count = ids.filter((id) => vb[id]?.aprobado).length;
                                const all = count === ids.length && ids.length > 0;
                                return (
                                  <Tooltip title={`Vistos buenos: ${count} de ${ids.length} emitidos`}>
                                    <Chip
                                      size="small"
                                      label={`VB: ${count}/${ids.length}`}
                                      sx={{
                                        height: 20,
                                        fontSize: 10.5,
                                        fontWeight: 900,
                                        bgcolor: all ? '#ecfdf5' : '#fffbeb',
                                        color: all ? '#047857' : '#b45309',
                                        border: `1px solid ${all ? '#a7f3d0' : '#fde68a'}`
                                      }}
                                    />
                                  </Tooltip>
                                );
                              })()}
                            </Stack>
                          </Box>
                        ) : (
                          <Typography variant="body2" fontWeight={700} noWrap>
                            {row.responsable?.nombre || row.metadata?.responsable_snapshot?.nombre || (
                              <Chip size="small" label="Sin asignar" sx={{ bgcolor: '#f1f5f9', color: '#64748b' }} />
                            )}
                          </Typography>
                        )}
                      </TableCell>

                      <TableCell>
                        <StatusChip value={row.estado} />
                      </TableCell>

                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip title="Editar datos del expediente">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(row);
                            }}
                            sx={{ color: '#0284c7', mr: 0.5 }}
                          >
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Abrir expediente completo">
                          <IconButton size="small" sx={{ color: COLORS.blue }}>
                            <OpenInNewRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
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

            <TextField
              required
              label="Interesado / solicitante"
              value={form.interesado}
              onChange={(e) => setForm({ ...form, interesado: e.target.value })}
            />

            <TextField
              label="Dependencia solicitante"
              value={form.dependencia_solicitante}
              onChange={(e) => setForm({ ...form, dependencia_solicitante: e.target.value })}
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

            <TextField
              required
              label="Interesado / solicitante"
              value={editForm.interesado}
              onChange={(e) => setEditForm({ ...editForm, interesado: e.target.value })}
            />

            <TextField
              label="Dependencia solicitante"
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
              {selected && (
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
                        Cualquier asesor o funcionario asignado puede incorporar archivos de soporte o respuestas.
                      </Typography>
                    </Box>
                    <>
                      <input hidden ref={attachmentRef} type="file" accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg" onChange={handleAttachment} />
                      <Button size="small" variant="contained" startIcon={<AttachFileRoundedIcon />} onClick={() => attachmentRef.current?.click()} sx={{ bgcolor: COLORS.blue }}>
                        Adjuntar
                      </Button>
                    </>
                  </Stack>
                  <Stack spacing={1} mt={1.8}>
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
                    {!selected.adjuntos?.length && (
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

                {(ACTIONS[profile.role] || []).length > 0 && (
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Typography fontWeight={950}>Actualizar trámite</Typography>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Siguiente estado"
                      value={transition.estado}
                      onChange={(e) => setTransition({ ...transition, estado: e.target.value })}
                      sx={{ mt: 2 }}
                    >
                      {ACTIONS[profile.role].map(([value, label]) => (
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
                      label="Comentario obligatorio para la trazabilidad"
                      value={transition.comentario}
                      onChange={(e) => setTransition({ ...transition, comentario: e.target.value })}
                      sx={{ mt: 1.5 }}
                    />
                    <Button
                      fullWidth
                      disabled={!transition.estado || busy}
                      variant="contained"
                      color="success"
                      startIcon={<AutorenewRoundedIcon />}
                      onClick={handleTransition}
                      sx={{ mt: 1.5 }}
                    >
                      Registrar avance
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
