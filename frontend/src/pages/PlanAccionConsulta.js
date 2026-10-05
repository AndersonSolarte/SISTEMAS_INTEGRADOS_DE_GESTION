import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box, Paper, Stack, Typography, Chip, Button, Alert,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  TextField, CircularProgress, Divider, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem,
  Grid, InputAdornment
} from '@mui/material';
import {
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  Business as BusinessIcon,
  TrendingUp as TrendingUpIcon,
  Verified as VerifiedIcon,
  Refresh as RefreshIcon,
  ArrowBack as ArrowBackIcon,
  CalendarMonth as CalendarMonthIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  CloudUpload as CloudUploadIcon,
  WarningAmber as WarningIcon,
  EditNote as EditNoteIcon,
  AttachFile as AttachFileIcon,
  Description as DescriptionIcon,
  PriorityHigh as PriorityHighIcon,
  Send as SendIcon,
  Lock as LockIcon,
  InsertDriveFile as FileIcon,
  Close as CloseIcon,
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon,
  Image as ImageIcon,
  OpenInNew as OpenInNewIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../constants/roles';
import strategicPlanningService from '../services/strategicPlanningService';
import planAccionWorkflowService, { ESTADOS_WORKFLOW } from '../services/planAccionWorkflowService';

const STATUS_CONFIG = {
  convocation: { label: 'Convocatoria', color: 'default', bg: '#f1f5f9', fg: '#475569' },
  meeting_scheduled: { label: 'Reunión Programada', color: 'info', bg: '#e0f2fe', fg: '#0369a1' },
  formulation: { label: 'En Formulación', color: 'info', bg: '#e0e7ff', fg: '#3730a3' },
  preliminary_minutes: { label: 'Acta Preliminar', color: 'warning', bg: '#fef3c7', fg: '#92400e' },
  technical_review: { label: 'Revisión Técnica', color: 'warning', bg: '#fef3c7', fg: '#92400e' },
  adjustments: { label: 'En Ajustes', color: 'error', bg: '#fee2e2', fg: '#991b1b' },
  owner_validation: { label: 'En Revisión y Retroalimentación', color: 'warning', bg: '#fef3c7', fg: '#b45309' },
  active: { label: 'En Ejecución Oficial', color: 'success', bg: '#dcfce7', fg: '#15803d' },
  monitoring: { label: 'En Seguimiento', color: 'primary', bg: '#e0e7ff', fg: '#4338ca' },
  closed: { label: 'Cerrado', color: 'default', bg: '#f1f5f9', fg: '#64748b' }
};

const formatFecha = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' });
  } catch { return '—'; }
};

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const getFileIcon = (fileName) => {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  if (ext === 'pdf') return <PdfIcon sx={{ color: '#dc2626', fontSize: 22 }} />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <ExcelIcon sx={{ color: '#16a34a', fontSize: 22 }} />;
  if (['doc', 'docx'].includes(ext)) return <DescriptionIcon sx={{ color: '#2563eb', fontSize: 22 }} />;
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return <ImageIcon sx={{ color: '#9333ea', fontSize: 22 }} />;
  return <FileIcon sx={{ color: '#64748b', fontSize: 22 }} />;
};

export default function PlanAccionConsulta() {
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const userId = authUser?.id;
  const isPlanningStaff = Boolean(authUser && [ROLES.ADMINISTRADOR, ROLES.PLANEACION_ESTRATEGICA, ROLES.PLANEACION_EFECTIVIDAD].includes(authUser.role));

  const [loading, setLoading] = useState(false);
  const [peiPlans, setPeiPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [legacyPlans, setLegacyPlans] = useState([]);

  // Modal de registro de avances y evidencias (sin campos de texto, solo documento)
  const [monitoringModalOpen, setMonitoringModalOpen] = useState(false);
  const [targetItem, setTargetItem] = useState(null);
  const [monitoringForm, setMonitoringForm] = useState({
    period_id: '',
    physical_progress: '',
    file: null
  });
  const [savingMonitoring, setSavingMonitoring] = useState(false);

  // Modal para ver evidencias cargadas de una actividad en ventana emergente
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [evidenceItem, setEvidenceItem] = useState(null);
  const [previewModal, setPreviewModal] = useState({
    open: false,
    url: '',
    fileName: '',
    isPdf: false,
    isImage: false,
    isOffice: false,
    loading: false
  });

  // Filtro de búsqueda en la tabla de actividades
  const [activitySearch, setActivitySearch] = useState('');

  // Modal para solicitar ajustes a Planeación y Efectividad
  const [adjustmentsModalOpen, setAdjustmentsModalOpen] = useState(false);
  const [adjustmentComment, setAdjustmentComment] = useState('');
  const [sendingAdjustments, setSendingAdjustments] = useState(false);

  // Modal y descarga de actas
  const [actasModalOpen, setActasModalOpen] = useState(false);
  const [refreshingActas, setRefreshingActas] = useState(false);
  const [downloadingMinute, setDownloadingMinute] = useState(null);

  // Cargar planes asignados
  const cargarPlanes = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // 1. Planes estratégicos PEI modernos
      let visiblePei = [];
      try {
        const peiResp = await strategicPlanningService.getMyActionPlans();
        const allPei = Array.isArray(peiResp?.data) ? peiResp.data : [];
        // REGLA INSTITUCIONAL:
        // Visible para el líder únicamente cuando está en:
        // - 'owner_validation' (en revisión / firmas del acta)
        // - 'active' (en ejecución oficial)
        // - 'monitoring' (en seguimiento)
        // - 'closed' (cerrado)
        // Cuando está en 'adjustments', 'formulation', etc., desaparece del módulo del líder
        visiblePei = allPei.filter((p) =>
          ['owner_validation', 'active', 'monitoring', 'closed'].includes(p.status)
        );
      } catch (err) {
        console.error('Error cargando planes PEI:', err);
      }
      setPeiPlans(visiblePei);

      // Si teníamos un plan seleccionado, actualizarlo con la última data
      if (selectedPlan?.id) {
        const refreshed = visiblePei.find((p) => p.id === selectedPlan.id);
        if (refreshed) {
          setSelectedPlan(refreshed);
        } else {
          // Si el plan ya no es visible (ej. pasó a ajustes), volver al listado
          setSelectedPlan(null);
        }
      }

      // 2. Fallback: Planes legacy (si no hay planes PEI)
      if (visiblePei.length === 0) {
        try {
          const legResp = await planAccionWorkflowService.listarPendientes();
          const legList = Array.isArray(legResp?.data) ? legResp.data : [];
          const ESTADOS_LEGACY = new Set([ESTADOS_WORKFLOW.EN_REVISION_RESPONSABLE, ESTADOS_WORKFLOW.APROBADO]);
          const filtrada = legList.filter((p) =>
            Number(p.responsable_id) === Number(userId) && ESTADOS_LEGACY.has(p.estado_workflow)
          );
          setLegacyPlans(filtrada);
        } catch (_) {
          setLegacyPlans([]);
        }
      }
    } catch (err) {
      enqueueSnackbar('No se pudieron cargar tus planes de acción.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [userId, selectedPlan?.id, enqueueSnackbar]);

  useEffect(() => {
    cargarPlanes();
  }, [cargarPlanes]);

  // Selección de plan
  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
  };

  // Abrir modal para ver evidencias cargadas de una actividad
  const handleOpenEvidenceModal = (item) => {
    setEvidenceItem(item);
    setEvidenceModalOpen(true);
  };

  // Abrir modal de seguimiento / radicación para un ítem
  const handleOpenMonitoringModal = (item) => {
    setTargetItem(item);
    const periodsList = [...(selectedPlan?.term?.monitoringPeriods || [])].sort((a, b) => (a.position || 0) - (b.position || 0));

    // Período automático dinámico:
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);
    const currentMonth = now.getMonth() + 1; // 1 a 12

    // 1. Intentar por rango de fechas formal si están configuradas en el período
    let autoPeriod = periodsList.find((p) => p.starts_on && p.ends_on && todayIso >= p.starts_on && todayIso <= p.ends_on);

    // 2. Si son 2 períodos (semestres institucionales: Ene-Jul S1, Ago-Dic S2)
    if (!autoPeriod && periodsList.length === 2) {
      const targetCode = currentMonth <= 7 ? 'S1' : 'S2';
      autoPeriod = periodsList.find((p) => (p.code || '').toUpperCase() === targetCode)
        || periodsList.find((p) => (targetCode === 'S1' ? /1|s1|prim/i.test(p.name || '') : /2|s2|seg/i.test(p.name || '')));
    }

    // 3. Si son más de 2 períodos (ej. 3 cuatrimestres o 4 trimestres)
    if (!autoPeriod && periodsList.length > 2) {
      const idx = Math.min(periodsList.length - 1, Math.floor(((currentMonth - 1) / 12) * periodsList.length));
      autoPeriod = periodsList[idx];
    }

    // 4. Fallback al primer período disponible
    if (!autoPeriod) {
      autoPeriod = periodsList[0] || null;
    }

    const defaultPeriodId = autoPeriod?.id || '';
    const existingResult = (item.monitoringResults || []).find((r) => r.monitoring_period_id === defaultPeriodId);
    setMonitoringForm({
      period_id: defaultPeriodId,
      physical_progress: existingResult?.physical_progress ?? '',
      file: null
    });
    setMonitoringModalOpen(true);
  };

  // Cambio de período dentro del modal
  const handlePeriodChange = (newPeriodId) => {
    if (!targetItem) return;
    const existingResult = (targetItem.monitoringResults || []).find((r) => r.monitoring_period_id === newPeriodId);
    setMonitoringForm((prev) => ({
      ...prev,
      period_id: newPeriodId,
      physical_progress: existingResult?.physical_progress ?? ''
    }));
  };

  // Guardar avance y radicar documento de evidencia
  const handleSaveMonitoring = async () => {
    if (!targetItem || !monitoringForm.period_id) {
      enqueueSnackbar('Seleccione el semestre.', { variant: 'warning' });
      return;
    }
    // Si no es de Planeación, debe seleccionar el archivo de evidencia
    if (!isPlanningStaff && !monitoringForm.file) {
      enqueueSnackbar('Por favor adjunte el documento de evidencia a radicar.', { variant: 'warning' });
      return;
    }

    setSavingMonitoring(true);
    try {
      // 1. Guardar avance de seguimiento
      const payload = {
        status: isPlanningStaff ? 'approved' : 'submitted'
      };
      if (isPlanningStaff && monitoringForm.physical_progress !== '') {
        payload.physical_progress = monitoringForm.physical_progress;
      }
      await strategicPlanningService.saveMonitoring(targetItem.id, monitoringForm.period_id, payload);

      // 2. Si adjuntó archivo, subirlo como evidencia
      if (monitoringForm.file) {
        const formData = new FormData();
        formData.append('file', monitoringForm.file);
        formData.append('monitoring_period_id', monitoringForm.period_id);
        await strategicPlanningService.uploadEvidence(targetItem.id, formData);
      }

      enqueueSnackbar(isPlanningStaff ? 'Seguimiento y valoración actualizados correctamente.' : 'Documento de evidencia radicado correctamente.', { variant: 'success' });
      setMonitoringModalOpen(false);
      setTargetItem(null);
      await cargarPlanes();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Error al radicar el documento o actualizar el seguimiento.';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setSavingMonitoring(false);
    }
  };

  // Solicitar ajustes a Planeación y Efectividad (el plan sale de la bandeja del líder)
  const handleConfirmAdjustments = async () => {
    if (!selectedPlan?.id) return;
    if (!adjustmentComment.trim()) {
      enqueueSnackbar('Por favor indique las observaciones o ajustes solicitados.', { variant: 'warning' });
      return;
    }
    setSendingAdjustments(true);
    try {
      await strategicPlanningService.transition(selectedPlan.id, {
        action: 'request_owner_adjustments',
        comment: adjustmentComment.trim()
      });
      enqueueSnackbar('Observaciones enviadas a Planeación y Efectividad. El plan ha retornado para ajustes.', { variant: 'success' });
      setAdjustmentsModalOpen(false);
      setAdjustmentComment('');
      setSelectedPlan(null);
      await cargarPlanes();
    } catch (err) {
      const msg = err?.response?.data?.message || 'No fue posible registrar la solicitud de ajustes.';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setSendingAdjustments(false);
    }
  };

  // Descargar acta oficial COM-IF-FR-002 (Original o Copia Oficial)
  const handleDownloadMinute = async (minuteId, type = 'original') => {
    if (!minuteId) return;
    const downloadKey = `${minuteId}-${type}`;
    setDownloadingMinute(downloadKey);
    try {
      const blob = await strategicPlanningService.downloadMinutePdf(minuteId, type);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      const typeLabel = type === 'official_copy' ? 'Copia_Oficial' : 'Original';
      a.download = `Acta_COM-IF-FR-002_${selectedPlan?.code || 'Plan'}_${typeLabel}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      enqueueSnackbar('No se pudo descargar el acta en PDF.', { variant: 'error' });
    } finally {
      setDownloadingMinute(null);
    }
  };

  // Actualizar actas y estado del plan desde el repositorio
  const handleRefreshActas = async () => {
    if (!selectedPlan?.id) return;
    setRefreshingActas(true);
    try {
      const resp = await strategicPlanningService.getActionPlan(selectedPlan.id);
      if (resp?.data) {
        setSelectedPlan((prev) => ({ ...prev, ...resp.data }));
        enqueueSnackbar('Repositorio de actas sincronizado con éxito.', { variant: 'success' });
      }
    } catch (err) {
      enqueueSnackbar('No fue posible sincronizar el repositorio de actas.', { variant: 'error' });
    } finally {
      setRefreshingActas(false);
    }
  };

  // Previsualizar acta oficial en el visor interno de SIAC (sin salir a Drive)
  const handlePreviewMinute = async (minuteId, title = 'Acta Oficial COM-IF-FR-002') => {
    if (!minuteId) return;
    const cleanTitle = (title || 'Acta').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${cleanTitle}_${selectedPlan?.code || 'Plan'}.pdf`;

    setPreviewModal({
      open: true,
      url: '',
      fileName,
      isPdf: true,
      isImage: false,
      isOffice: false,
      loading: true
    });

    try {
      const blob = await strategicPlanningService.downloadMinutePdf(minuteId, 'original');
      const blobUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      setPreviewModal((prev) => ({ ...prev, url: blobUrl, loading: false }));
    } catch (err) {
      console.error('Error al previsualizar acta:', err);
      enqueueSnackbar('No fue posible cargar la vista previa del acta.', { variant: 'error' });
      setPreviewModal((prev) => ({ ...prev, open: false, loading: false }));
    }
  };

  const handlePreviewEvidence = async (ev) => {
    if (!ev || !ev.id) return;
    const name = ev.original_name || 'documento';
    const ext = name.split('.').pop().toLowerCase();
    const isPdf = ext === 'pdf';
    const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext);
    const isOffice = ['xls', 'xlsx', 'csv', 'doc', 'docx', 'ppt', 'pptx'].includes(ext);

    setPreviewModal({
      open: true,
      url: '',
      fileName: name,
      isPdf,
      isImage,
      isOffice,
      loading: true
    });

    try {
      const blob = await strategicPlanningService.downloadEvidence(ev.id, true);
      const mimeType = isPdf ? 'application/pdf' : (isImage ? `image/${ext}` : 'application/octet-stream');
      const blobUrl = URL.createObjectURL(new Blob([blob], { type: mimeType }));
      setPreviewModal((prev) => ({ ...prev, url: blobUrl, loading: false }));
    } catch (err) {
      console.error('Error previsualizando evidencia:', err);
      enqueueSnackbar('No fue posible cargar la vista previa del documento.', { variant: 'error' });
      setPreviewModal((prev) => ({ ...prev, open: false, loading: false }));
    }
  };

  const handleClosePreview = () => {
    if (previewModal.url) {
      URL.revokeObjectURL(previewModal.url);
    }
    setPreviewModal({ open: false, url: '', fileName: '', isPdf: false, isImage: false, isOffice: false, loading: false });
  };

  const handleDownloadDirectEvidence = async (ev) => {
    try {
      enqueueSnackbar('Descargando archivo...', { variant: 'info' });
      const blob = await strategicPlanningService.downloadEvidence(ev.id, false);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = ev.original_name || 'evidencia';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al descargar evidencia:', err);
      enqueueSnackbar('No fue posible descargar el archivo.', { variant: 'error' });
    }
  };

  // Listado de actas OFICIALES formalizadas y cargadas en el repositorio (Drive)
  const planActas = useMemo(() => {
    if (!selectedPlan) return [];
    const list = [];
    const meetings = selectedPlan.meetings || [];

    meetings.forEach((m) => {
      const versions = m.minuteVersions || [];
      // Solo versiones formalizadas / cargadas en el repositorio Drive
      const officialVersions = versions.filter(
        (v) => v.status === 'finalized' || v.drive_file_id || v.content?.drive_file_id
      );

      if (officialVersions.length > 0) {
        // Tomar la versión formalizada más reciente para esta reunión
        officialVersions.sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
        const v = officialVersions[0];
        list.push({
          id: v.id,
          minuteId: v.id,
          meetingId: m.id,
          meetingTitle: m.title || 'Reunión de Concertación / Seguimiento',
          meetingType: m.meeting_type || 'concertation',
          meetingDate: m.starts_at || m.meeting_date,
          version: v.version || 1,
          status: 'finalized',
          finalizedAt: v.finalized_at || v.created_at,
          driveFileId: v.drive_file_id || v.content?.drive_file_id || null,
          signaturesCount: (v.signatures || []).length
        });
      }
    });

    // Fallback: si no llegaron minuteVersions en meetings pero el plan tiene latest_minute_id formalizado
    if (list.length === 0 && selectedPlan.latest_minute_id && (selectedPlan.latest_minute_status === 'finalized' || selectedPlan.drive_file_id)) {
      list.push({
        id: selectedPlan.latest_minute_id,
        minuteId: selectedPlan.latest_minute_id,
        meetingId: null,
        meetingTitle: 'Acta Oficial COM-IF-FR-002',
        meetingType: 'concertation',
        meetingDate: selectedPlan.created_at,
        version: 1,
        status: 'finalized',
        finalizedAt: selectedPlan.updated_at,
        driveFileId: selectedPlan.drive_file_id,
        signaturesCount: selectedPlan.my_signed ? 1 : 0
      });
    }

    return list.sort((a, b) => new Date(b.finalizedAt || b.meetingDate || 0) - new Date(a.finalizedAt || a.meetingDate || 0));
  }, [selectedPlan]);

  // Última acta para validación y firma
  const latestMinute = useMemo(() => {
    return planActas.find((a) => a.status === 'signing') || planActas[0] || null;
  }, [planActas]);

  // Períodos de monitoreo dinámicos del plan (1, 2, 3 o más según la vigencia)
  const periods = useMemo(() => {
    const raw = selectedPlan?.term?.monitoringPeriods || [];
    return [...raw].sort((a, b) => (a.position || 0) - (b.position || 0));
  }, [selectedPlan]);

  // Cálculos de métricas del plan seleccionado (Sumatoria institucional de seguimientos)
  const planMetrics = useMemo(() => {
    if (!selectedPlan) return { totalActivities: 0, avgProgress: '0.0', totalEvidences: 0, completedActivities: 0, inProgressActivities: 0 };
    const items = selectedPlan.items || [];
    const totalActivities = items.length;
    let sumProgress = 0;
    let totalEvidences = 0;
    let completedActivities = 0;

    items.forEach((it) => {
      const results = it.monitoringResults || [];
      const validResults = results.filter((r) => r.physical_progress !== null && r.physical_progress !== undefined && !isNaN(Number(r.physical_progress)));
      let itProgress = 0;
      if (validResults.length > 0) {
        // SUMATORIA de los períodos de seguimiento S1 + S2 + ...
        itProgress = validResults.reduce((acc, r) => acc + Number(r.physical_progress || 0), 0);
      } else if (it.current_progress !== undefined && it.current_progress !== null && !isNaN(Number(it.current_progress))) {
        itProgress = Number(it.current_progress);
      }
      sumProgress += itProgress;
      totalEvidences += (it.evidence || []).length;
      if (itProgress >= 100) {
        completedActivities += 1;
      }
    });

    const avgProgress = totalActivities > 0 ? (sumProgress / totalActivities).toFixed(1) : '0.0';
    const inProgressActivities = Math.max(0, totalActivities - completedActivities);
    return { totalActivities, avgProgress, totalEvidences, completedActivities, inProgressActivities };
  }, [selectedPlan]);

  // Actividades filtradas por búsqueda en tiempo real
  const filteredItems = useMemo(() => {
    const planItems = selectedPlan?.items || [];
    if (!activitySearch.trim()) return planItems;
    const term = activitySearch.toLowerCase().trim();
    return planItems.filter((it) =>
      (it.code || '').toLowerCase().includes(term) ||
      (it.activity || '').toLowerCase().includes(term) ||
      (it.indicator || '').toLowerCase().includes(term) ||
      (it.macroactivity || '').toLowerCase().includes(term)
    );
  }, [selectedPlan, activitySearch]);

  // ==========================================
  // RENDER: VISTA LISTADO DE PLANES
  // ==========================================
  if (!selectedPlan) {
    const pendingReviewPlans = peiPlans.filter((p) => p.status === 'owner_validation');
    const activeExecutionPlans = peiPlans.filter((p) => ['active', 'monitoring', 'closed'].includes(p.status));

    return (
      <Stack spacing={2.5}>
        {/* Banner Principal */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3 },
            borderRadius: 3.5,
            color: 'white',
            background: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #10b981 100%)',
            boxShadow: '0 10px 25px rgba(6,78,59,.18)'
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  width: 58,
                  height: 58,
                  borderRadius: 3,
                  bgcolor: 'rgba(255,255,255,.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <AssignmentTurnedInIcon sx={{ fontSize: 34 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 900, letterSpacing: -0.4 }}>
                  Plan de Acción Institucional
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,.9)', maxWidth: 740, fontSize: 14 }}>
                  Módulo de gestión del Líder de Dependencia. Revise y dé conformidad a su Plan de Acción concertado con Planeación y Efectividad, y registre durante la vigencia el avance físico y las evidencias de cumplimiento de cada actividad.
                </Typography>
              </Box>
            </Stack>
            <Tooltip title="Actualizar bandeja" arrow>
              <IconButton
                onClick={cargarPlanes}
                sx={{ color: 'white', bgcolor: 'rgba(255,255,255,.15)', '&:hover': { bgcolor: 'rgba(255,255,255,.25)' } }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Paper>

        {loading ? (
          <Paper elevation={0} sx={{ p: 5, borderRadius: 3.5, border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <CircularProgress size={36} />
            <Typography sx={{ mt: 1.5, color: '#64748b', fontWeight: 600 }}>Cargando planes de acción asignados...</Typography>
          </Paper>
        ) : peiPlans.length === 0 && legacyPlans.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: 5,
              borderRadius: 3.5,
              border: '1px solid #dbeafe',
              textAlign: 'center',
              background: 'linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)'
            }}
          >
            <CheckCircleIcon sx={{ fontSize: 60, color: '#10b981', mb: 1.5 }} />
            <Typography sx={{ fontSize: 19, fontWeight: 900, color: '#0f172a' }}>
              No tiene Planes de Acción activos en esta etapa
            </Typography>
            <Typography sx={{ color: '#64748b', mt: 0.6, maxWidth: 560, mx: 'auto', fontSize: 14 }}>
              Cuando la Dirección de Planeación y Aseguramiento de la Calidad formule o active un Plan de Acción para su dependencia, o requiera su firma y revisión, aparecerá automáticamente aquí.
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={2.5}>
            {/* 1. SECCIÓN: PLANES EN REVISIÓN Y FIRMAS */}
            {pendingReviewPlans.length > 0 && (
              <Box>
                <Stack direction="row" alignItems="center" spacing={1} mb={1.2}>
                  <WarningIcon sx={{ color: '#d97706', fontSize: 22 }} />
                  <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#92400e' }}>
                    Planes en Revisión y Retroalimentación ({pendingReviewPlans.length})
                  </Typography>
                </Stack>
                <Stack spacing={1.5}>
                  {pendingReviewPlans.map((plan) => (
                    <Paper
                      key={plan.id}
                      elevation={0}
                      sx={{
                        p: 2.4,
                        borderRadius: 3,
                        border: '2px solid #f59e0b',
                        bgcolor: '#fffbeb',
                        boxShadow: '0 4px 15px rgba(245,158,11,.10)'
                      }}
                    >
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                        <Stack spacing={0.6} sx={{ flex: 1 }}>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Chip size="small" label={plan.code} sx={{ bgcolor: '#d97706', color: '#fff', fontWeight: 900 }} />
                            <Chip size="small" label="Revisión y retroalimentación" sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 800 }} />
                            <Chip size="small" icon={<CalendarMonthIcon sx={{ fontSize: 14 }} />} label={`Vigencia ${plan.term?.year || '—'}`} sx={{ bgcolor: '#fff', color: '#78350f', fontWeight: 700 }} />
                          </Stack>
                          <Typography sx={{ fontSize: 17, fontWeight: 900, color: '#1e293b' }}>
                            {plan.organizationalUnit?.name || plan.title || 'Plan de Acción'}
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: '#64748b' }}>
                            Formulado por <strong>Dirección de Planeación y Aseguramiento de la Calidad</strong> · {plan.items?.length || 0} actividades concertadas.
                          </Typography>
                        </Stack>
                        <Button
                          variant="contained"
                          color="warning"
                          onClick={() => handleSelectPlan(plan)}
                          sx={{
                            borderRadius: 2.5,
                            textTransform: 'none',
                            fontWeight: 900,
                            px: 3,
                            py: 1,
                            color: '#451a03',
                            bgcolor: '#fbbf24',
                            '&:hover': { bgcolor: '#f59e0b' }
                          }}
                        >
                          Revisar Plan y Acta
                        </Button>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            )}

            {/* 2. SECCIÓN: PLANES EN EJECUCIÓN OFICIAL */}
            {activeExecutionPlans.length > 0 && (
              <Box>
                <Stack direction="row" alignItems="center" spacing={1} mb={1.2}>
                  <VerifiedIcon sx={{ color: '#059669', fontSize: 22 }} />
                  <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#065f46' }}>
                    Planes en Ejecución Oficial ({activeExecutionPlans.length})
                  </Typography>
                </Stack>
                <Stack spacing={1.5}>
                  {activeExecutionPlans.map((plan) => {
                    const items = plan.items || [];
                    const sum = items.reduce((acc, it) => acc + Number(it.current_progress || 0), 0);
                    const avg = items.length ? (sum / items.length).toFixed(1) : 0;
                    const evidenceCount = items.reduce((acc, it) => acc + (it.evidence || []).length, 0);

                    return (
                      <Paper
                        key={plan.id}
                        elevation={0}
                        sx={{
                          p: 2.4,
                          borderRadius: 3,
                          border: '1px solid #bbf7d0',
                          bgcolor: '#ffffff',
                          boxShadow: '0 4px 15px rgba(16,185,129,.06)'
                        }}
                      >
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.8} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                          <Stack spacing={0.6} sx={{ flex: 1 }}>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <Chip size="small" label={plan.code} sx={{ bgcolor: '#ecfdf5', color: '#065f46', fontWeight: 900 }} />
                              <Chip size="small" label="En Ejecución Oficial" sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 800 }} />
                              <Chip size="small" icon={<CalendarMonthIcon sx={{ fontSize: 14 }} />} label={`Vigencia ${plan.term?.year || '—'}`} sx={{ bgcolor: '#f1f5f9', color: '#0f172a', fontWeight: 700 }} />
                            </Stack>
                            <Typography sx={{ fontSize: 17, fontWeight: 900, color: '#0f172a' }}>
                              {plan.organizationalUnit?.name || plan.title || 'Plan de Acción'}
                            </Typography>
                            <Stack direction="row" spacing={2.5} alignItems="center" sx={{ mt: 0.5 }}>
                              <Typography sx={{ fontSize: 13, color: '#64748b' }}>
                                <strong>{items.length}</strong> actividades concertadas
                              </Typography>
                              <Typography sx={{ fontSize: 13, color: '#64748b' }}>
                                <strong>{evidenceCount}</strong> evidencias adjuntas
                              </Typography>
                              <Typography sx={{ fontSize: 13, color: '#059669', fontWeight: 800 }}>
                                Avance Global: {avg}%
                              </Typography>
                            </Stack>
                          </Stack>
                          <Button
                            variant="contained"
                            color="success"
                            onClick={() => handleSelectPlan(plan)}
                            sx={{
                              borderRadius: 2.5,
                              textTransform: 'none',
                              fontWeight: 900,
                              px: 3,
                              py: 1,
                              bgcolor: '#059669',
                              '&:hover': { bgcolor: '#047857' }
                            }}
                          >
                            Gestionar Plan y Evidencias
                          </Button>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>
            )}
          </Stack>
        )}
      </Stack>
    );
  }

  // ==========================================
  // RENDER: DETALLE DEL PLAN SELECCIONADO
  // ==========================================
  const isOwnerValidation = selectedPlan.status === 'owner_validation';

  return (
    <Stack spacing={2.2}>
      {/* 1. Header con Navegación y Acciones Rápidas */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 2.2 },
          borderRadius: 3.5,
          border: '1px solid #e2e8f0',
          bgcolor: '#ffffff',
          boxShadow: '0 2px 12px rgba(15, 23, 42, 0.04)'
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
          <Stack direction="row" spacing={1.2} alignItems="center" flexWrap="wrap">
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => setSelectedPlan(null)}
              sx={{
                textTransform: 'none',
                fontWeight: 850,
                color: '#1e40af',
                borderColor: '#cbd5e1',
                bgcolor: '#f8fafc',
                borderRadius: 2.2,
                px: 1.8,
                py: 0.6,
                fontSize: 13,
                '&:hover': { bgcolor: '#f1f5f9', borderColor: '#94a3b8' }
              }}
            >
              Volver a Mis Planes
            </Button>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5, display: { xs: 'none', sm: 'block' } }} />
            <Chip
              size="small"
              label={selectedPlan.code}
              sx={{ bgcolor: '#e0e7ff', color: '#3730a3', fontWeight: 900, fontSize: 12, height: 26, borderRadius: 1.5 }}
            />
            <Chip
              size="small"
              label={STATUS_CONFIG[selectedPlan.status]?.label || selectedPlan.status}
              sx={{
                bgcolor: STATUS_CONFIG[selectedPlan.status]?.bg || '#f1f5f9',
                color: STATUS_CONFIG[selectedPlan.status]?.fg || '#334155',
                fontWeight: 850,
                fontSize: 12,
                height: 26,
                borderRadius: 1.5
              }}
            />
            <Chip
              size="small"
              icon={<CalendarMonthIcon sx={{ fontSize: '15px !important' }} />}
              label={`Vigencia ${selectedPlan.term?.year || '—'}`}
              sx={{ bgcolor: '#f8fafc', color: '#475569', fontWeight: 750, fontSize: 12, height: 26, borderRadius: 1.5, border: '1px solid #e2e8f0' }}
            />
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<DescriptionIcon />}
              onClick={() => setActasModalOpen(true)}
              sx={{
                borderRadius: 2.2,
                textTransform: 'none',
                fontWeight: 800,
                fontSize: 12.5,
                px: 1.8,
                py: 0.6,
                borderColor: '#d8b4fe',
                bgcolor: '#faf5ff',
                color: '#7e22ce',
                '&:hover': { bgcolor: '#f3e8ff', borderColor: '#c084fc' }
              }}
            >
              Descargar Actas {planActas.length > 0 ? `(${planActas.length})` : ''}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* 2. Banner de Estado y Advertencia Institucional */}
      {isOwnerValidation ? (
        <Alert
          severity="warning"
          icon={<WarningIcon sx={{ fontSize: 26, color: '#d97706' }} />}
          sx={{
            borderRadius: 3,
            border: '1px solid #fde68a',
            bgcolor: '#fffbeb',
            alignItems: 'center',
            '& .MuiAlert-message': { width: '100%' }
          }}
          action={
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<EditNoteIcon />}
                onClick={() => setAdjustmentsModalOpen(true)}
                sx={{ textTransform: 'none', fontWeight: 850, borderRadius: 2, fontSize: 12, borderColor: '#d97706', color: '#92400e', '&:hover': { bgcolor: 'rgba(217,119,6,0.08)' } }}
              >
                Devolver con observaciones a Planeación
              </Button>
              {latestMinute && (
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={<VerifiedIcon />}
                  onClick={() => navigate(`/strategic-minutes/${latestMinute.id}/signing`)}
                  sx={{ textTransform: 'none', fontWeight: 900, borderRadius: 2, color: '#451a03', fontSize: 12 }}
                >
                  Firmar Acta
                </Button>
              )}
            </Stack>
          }
        >
          <Typography sx={{ fontWeight: 850, fontSize: 14, color: '#92400e' }}>
            Plan de Acción en Revisión y Retroalimentación (Etapa Transitoria)
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: '#b45309', mt: 0.2 }}>
            Revise las actividades concertadas y el Acta COM-IF-FR-002. Si requiere modificaciones, devuélvalo con sus observaciones a Planeación y Efectividad (el plan saldrá temporalmente de su bandeja mientras es ajustado). Si está conforme, proceda a la firma del acta.
          </Typography>
        </Alert>
      ) : (
        <Alert
          severity="info"
          icon={<LockIcon sx={{ fontSize: 24, color: '#0284c7' }} />}
          sx={{
            borderRadius: 3,
            border: '1px solid #bae6fd',
            bgcolor: '#f0f9ff',
            py: 1,
            px: 2
          }}
        >
          <Typography sx={{ fontWeight: 850, fontSize: 13.5, color: '#0369a1' }}>
            Plan de Acción Concertado · Ejecución Oficial
          </Typography>
          <Typography sx={{ fontSize: 12, color: '#0c4a6e', mt: 0.2, lineHeight: 1.4 }}>
            Actividades concertadas formalmente mediante el <strong>Acta COM-IF-FR-002</strong>. Como líder de dependencia, en este módulo puede registrar el avance físico semestral y radicar las evidencias de soporte de cada actividad.
          </Typography>
        </Alert>
      )}

      {/* 3. Métricas Rápidas (Tarjetas pastel institucionales) */}
      <Box sx={{ width: '100%' }}>
        <Grid container spacing={2} alignItems="stretch" sx={{ width: '100%' }}>
          {/* Card 1: Dependencia Responsable (Cielo Pastel) */}
          <Grid item xs={12} sm={6} lg={3}>
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 2, sm: 2.2, md: 2.5 },
                minHeight: 96,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                borderRadius: 3,
                bgcolor: '#f0f9ff',
                border: '1px solid #bae6fd',
                boxShadow: '0 2px 8px rgba(14,165,233,0.06)'
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 }}>
                    Dependencia Responsable
                  </Typography>
                  <Typography sx={{ fontSize: 15, fontWeight: 900, color: '#0c4a6e', mt: 0.2, lineHeight: 1.25 }} noWrap title={selectedPlan.organizationalUnit?.name}>
                    {selectedPlan.organizationalUnit?.name || 'Dependencia'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#0284c7', fontWeight: 600, fontSize: 11.5 }}>
                    Plan {selectedPlan.code}
                  </Typography>
                </Box>
                <Box sx={{ width: 48, height: 48, borderRadius: 2.5, bgcolor: '#e0f2fe', color: '#0284c7', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <BusinessIcon sx={{ fontSize: 26 }} />
                </Box>
              </Stack>
            </Paper>
          </Grid>

          {/* Card 2: Actividades Concertadas (Azul Real Pastel) */}
          <Grid item xs={12} sm={6} lg={3}>
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 2, sm: 2.2, md: 2.5 },
                minHeight: 96,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                borderRadius: 3,
                bgcolor: '#eff6ff',
                border: '1px solid #bfdbfe',
                boxShadow: '0 2px 8px rgba(37,99,235,0.06)'
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: '#1e40af', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 }}>
                    Actividades Concertadas
                  </Typography>
                  <Typography sx={{ fontSize: { xs: 22, md: 26 }, fontWeight: 900, color: '#1e3a8a', mt: 0.2 }}>
                    {planMetrics.totalActivities}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 600, fontSize: 11.5 }}>
                    {planMetrics.completedActivities} culminadas al 100%
                  </Typography>
                </Box>
                <Box sx={{ width: 48, height: 48, borderRadius: 2.5, bgcolor: '#dbeafe', color: '#2563eb', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <AssignmentTurnedInIcon sx={{ fontSize: 26 }} />
                </Box>
              </Stack>
            </Paper>
          </Grid>

          {/* Card 3: Avance Físico Promedio (Menta Pastel) */}
          <Grid item xs={12} sm={6} lg={3}>
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 2, sm: 2.2, md: 2.5 },
                minHeight: 96,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                borderRadius: 3,
                bgcolor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                boxShadow: '0 2px 8px rgba(16,185,129,0.06)'
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 }}>
                    Cumplimiento Global
                  </Typography>
                  <Typography sx={{ fontSize: { xs: 22, md: 26 }, fontWeight: 900, color: '#064e3b', mt: 0.2 }}>
                    {planMetrics.avgProgress}%
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#16a34a', fontWeight: 600, fontSize: 11.5 }}>
                    {planMetrics.inProgressActivities} actividades en curso
                  </Typography>
                </Box>
                <Box sx={{ width: 48, height: 48, borderRadius: 2.5, bgcolor: '#dcfce7', color: '#16a34a', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <TrendingUpIcon sx={{ fontSize: 26 }} />
                </Box>
              </Stack>
            </Paper>
          </Grid>

          {/* Card 4: Evidencias Radicadas (Lavanda Pastel) */}
          <Grid item xs={12} sm={6} lg={3}>
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 2, sm: 2.2, md: 2.5 },
                minHeight: 96,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                borderRadius: 3,
                bgcolor: '#faf5ff',
                border: '1px solid #e9d5ff',
                boxShadow: '0 2px 8px rgba(168,85,247,0.06)'
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: '#7e22ce', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 }}>
                    Evidencias Radicadas
                  </Typography>
                  <Typography sx={{ fontSize: { xs: 22, md: 26 }, fontWeight: 900, color: '#581c87', mt: 0.2 }}>
                    {planMetrics.totalEvidences}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#9333ea', fontWeight: 600, fontSize: 11.5 }}>
                    Soportes oficiales cargados
                  </Typography>
                </Box>
                <Box sx={{ width: 48, height: 48, borderRadius: 2.5, bgcolor: '#ede9fe', color: '#9333ea', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <AttachFileIcon sx={{ fontSize: 26 }} />
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* 4. Tabla de Actividades y Evidencias de Cumplimiento */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3.5,
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          bgcolor: '#ffffff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
        }}
      >
        {/* Cabecera compacta con contador y buscador */}
        <Box sx={{ p: 2, px: 2.5, borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: 'center' }}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography sx={{ fontSize: 15.5, fontWeight: 900, color: '#0f172a' }}>
                  Plan de Trabajo y Evidencias de Cumplimiento
                </Typography>
                <Chip
                  size="small"
                  label={`${filteredItems.length} actividades`}
                  sx={{ bgcolor: '#e2e8f0', fontWeight: 850, color: '#334155', fontSize: 11, height: 22 }}
                />
              </Stack>
              <Typography sx={{ fontSize: 12, color: '#64748b', mt: 0.2 }}>
                Monitoreo por periodos semestrales y cargue de evidencias de cumplimiento.
              </Typography>
            </Box>

            <TextField
              size="small"
              placeholder="Buscar por código, actividad..."
              value={activitySearch}
              onChange={(e) => setActivitySearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#94a3b8', fontSize: 17 }} />
                  </InputAdornment>
                )
              }}
              sx={{
                width: { xs: '100%', sm: 280 },
                '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#ffffff', fontSize: 12.5, height: 36 }
              }}
            />
          </Stack>
        </Box>

        <TableContainer sx={{ maxHeight: 520, overflowX: 'auto' }}>
          <Table stickyHeader size="small" sx={{ minWidth: 980 }}>
            <TableHead>
              <TableRow>
                <TableCell align="center" sx={{ bgcolor: '#f1f5f9', fontWeight: 800, color: '#1e293b', width: 75, py: 1, px: 1, fontSize: 11.5 }}>
                  Código
                </TableCell>
                <TableCell sx={{ bgcolor: '#f1f5f9', fontWeight: 800, color: '#1e293b', minWidth: 190, maxWidth: { xs: 230, sm: 280, md: 320 }, py: 1, px: 1, fontSize: 11.5 }}>
                  Actividad Concertada
                </TableCell>
                <TableCell sx={{ bgcolor: '#f1f5f9', fontWeight: 800, color: '#1e293b', minWidth: 160, py: 1, px: 1, fontSize: 11.5 }}>
                  Indicador y Meta
                </TableCell>
                <TableCell align="center" sx={{ bgcolor: '#f1f5f9', fontWeight: 800, color: '#1e293b', width: 110, py: 1, px: 1, fontSize: 11.5 }}>
                  Plazo
                </TableCell>
                {/* Columnas dinámicas de seguimiento según el plan de desarrollo */}
                {periods.map((p) => (
                  <TableCell
                    key={p.id}
                    align="center"
                    sx={{
                      bgcolor: '#f1f5f9',
                      fontWeight: 800,
                      color: '#1e293b',
                      minWidth: 80,
                      maxWidth: 105,
                      py: 1,
                      px: 0.5,
                      fontSize: 11.5
                    }}
                  >
                    Avance {p.code || p.name}
                  </TableCell>
                ))}
                <TableCell sx={{ bgcolor: '#f1f5f9', fontWeight: 800, color: '#1e293b', width: 120, minWidth: 110, py: 1, px: 0.5, fontSize: 11.5 }} align="center">
                  Cumplimiento
                </TableCell>
                <TableCell sx={{ bgcolor: '#f1f5f9', fontWeight: 800, color: '#1e293b', width: 85, py: 1, px: 0.5, fontSize: 11.5 }} align="center">
                  Evidencias
                </TableCell>
                <TableCell sx={{ bgcolor: '#f1f5f9', fontWeight: 800, color: '#1e293b', width: 105, py: 1, px: 1, fontSize: 11.5 }} align="center">
                  Acción
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7 + periods.length} align="center" sx={{ py: 4, color: '#64748b', fontSize: 12 }}>
                    {activitySearch ? 'No se encontraron actividades con ese criterio de búsqueda.' : 'No hay actividades registradas en este plan.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((it) => {
                  const evidences = it.evidence || [];

                  // Cumplimiento consolidado: SUMATORIA institucional de los períodos de seguimiento
                  const validResults = (it.monitoringResults || []).filter(
                    (r) => r.physical_progress !== null && r.physical_progress !== undefined && !isNaN(Number(r.physical_progress))
                  );
                  let compProg = null;
                  if (validResults.length > 0) {
                    compProg = validResults.reduce((acc, r) => acc + Number(r.physical_progress || 0), 0);
                  } else if (it.current_progress !== undefined && it.current_progress !== null && !isNaN(Number(it.current_progress))) {
                    compProg = Number(it.current_progress);
                  }

                  return (
                    <TableRow
                      key={it.id}
                      hover
                      sx={{
                        '&:hover': { bgcolor: '#f8fafc' },
                        borderBottom: '1px solid #f1f5f9'
                      }}
                    >
                      {/* Código */}
                      <TableCell align="center" sx={{ verticalAlign: 'middle', py: 1, px: 1 }}>
                        <Chip
                          size="small"
                          label={it.code || '—'}
                          sx={{
                            fontWeight: 800,
                            bgcolor: '#e2e8f0',
                            color: '#1e293b',
                            fontSize: 10.5,
                            height: 22,
                            borderRadius: 1
                          }}
                        />
                      </TableCell>

                      {/* Actividad */}
                      <TableCell sx={{ verticalAlign: 'middle', py: 1, px: 1, minWidth: 190, maxWidth: { xs: 230, sm: 280, md: 320 } }}>
                        <Tooltip title={it.activity} arrow placement="top-start">
                          <Typography
                            sx={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#0f172a',
                              lineHeight: 1.3,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              cursor: 'pointer'
                            }}
                          >
                            {it.activity}
                          </Typography>
                        </Tooltip>
                        {it.macroactivity && (
                          <Typography
                            sx={{
                              fontSize: 10.5,
                              color: '#64748b',
                              mt: 0.2,
                              display: '-webkit-box',
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            PED: {it.macroactivity}
                          </Typography>
                        )}
                      </TableCell>

                      {/* Indicador y Meta */}
                      <TableCell sx={{ verticalAlign: 'middle', py: 1, px: 1 }}>
                        <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: '#334155', lineHeight: 1.25 }}>
                          {it.indicator || 'Sin indicador'}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: '#059669', fontWeight: 700, mt: 0.2 }}>
                          Meta: {it.target || '100%'}
                        </Typography>
                      </TableCell>

                      {/* Plazo (Fechas) */}
                      <TableCell align="center" sx={{ verticalAlign: 'middle', py: 1, px: 1 }}>
                        <Typography sx={{ fontSize: 10.5, color: '#475569', lineHeight: 1.3 }}>
                          {formatFecha(it.starts_on)} al {formatFecha(it.ends_on)}
                        </Typography>
                      </TableCell>

                      {/* Columnas dinámicas de períodos de seguimiento */}
                      {periods.map((p) => {
                        const r = (it.monitoringResults || []).find((res) => res.monitoring_period_id === p.id);
                        const prog = r && r.physical_progress !== null && r.physical_progress !== undefined ? Number(r.physical_progress) : null;
                        return (
                          <TableCell key={p.id} align="center" sx={{ verticalAlign: 'middle', py: 1, px: 0.5 }}>
                            {prog !== null ? (
                              <Chip
                                size="small"
                                label={`${prog}%`}
                                sx={{
                                  fontWeight: 800,
                                  fontSize: 11,
                                  height: 22,
                                  borderRadius: 1,
                                  bgcolor: prog >= 100 ? '#dcfce7' : (prog > 0 ? '#fef3c7' : '#f1f5f9'),
                                  color: prog >= 100 ? '#15803d' : (prog > 0 ? '#b45309' : '#64748b')
                                }}
                              />
                            ) : (
                              <Typography sx={{ fontSize: 11.5, color: '#94a3b8' }}>—</Typography>
                            )}
                          </TableCell>
                        );
                      })}

                      {/* Columna Cumplimiento */}
                      <TableCell align="center" sx={{ verticalAlign: 'middle', py: 1, px: 0.5 }}>
                        {compProg !== null && compProg > 100 ? (
                          <Tooltip title={`Sobrecumplimiento (${compProg}%). Superó el 100% de la meta programada. Requiere revisión para evaluar aumento de meta o formalizar excedente.`} arrow>
                            <Stack alignItems="center" spacing={0.2}>
                              <Chip
                                size="small"
                                icon={<PriorityHighIcon sx={{ fontSize: '12px !important', color: '#f59e0b !important', fontWeight: 900 }} />}
                                label={`${compProg}%`}
                                sx={{
                                  fontWeight: 900,
                                  fontSize: 11,
                                  height: 23,
                                  borderRadius: 1.2,
                                  bgcolor: '#064e3b',
                                  color: '#ecfdf5',
                                  border: '1.5px dashed #f59e0b',
                                  cursor: 'help'
                                }}
                              />
                              <Typography sx={{ fontSize: 9, fontWeight: 800, color: '#b45309', lineHeight: 1 }}>
                                Revisar meta
                              </Typography>
                            </Stack>
                          </Tooltip>
                        ) : compProg !== null && compProg === 100 ? (
                          <Tooltip title="¡Meta cumplida al 100%!" arrow>
                            <Stack alignItems="center" spacing={0.2}>
                              <Chip
                                size="small"
                                icon={<CheckCircleIcon sx={{ fontSize: '13px !important', color: '#16a34a !important' }} />}
                                label="100%"
                                sx={{
                                  fontWeight: 850,
                                  fontSize: 11,
                                  height: 22,
                                  borderRadius: 1,
                                  bgcolor: '#dcfce7',
                                  color: '#15803d',
                                  border: '1px solid #86efac'
                                }}
                              />
                              <Typography sx={{ fontSize: 9, fontWeight: 750, color: '#15803d', lineHeight: 1 }}>
                                Cumplida
                              </Typography>
                            </Stack>
                          </Tooltip>
                        ) : compProg !== null && compProg > 0 ? (
                          <Tooltip title={`Avance actual: ${compProg}%. Falta ${Number((100 - compProg).toFixed(1))}% para culminar la meta del 100%.`} arrow>
                            <Stack alignItems="center" spacing={0.2}>
                              <Chip
                                size="small"
                                label={`${compProg}%`}
                                sx={{
                                  fontWeight: 800,
                                  fontSize: 11,
                                  height: 22,
                                  borderRadius: 1,
                                  bgcolor: '#fffbeb',
                                  color: '#b45309',
                                  border: '1px solid #fde68a'
                                }}
                              />
                              <Typography sx={{ fontSize: 9, fontWeight: 750, color: '#b45309', lineHeight: 1 }}>
                                Falta {Number((100 - compProg).toFixed(0))}%
                              </Typography>
                            </Stack>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Sin avances registrados aún. Falta el 100% de la meta." arrow>
                            <Stack alignItems="center" spacing={0.2}>
                              <Chip
                                size="small"
                                label="0%"
                                sx={{
                                  fontWeight: 750,
                                  fontSize: 10.5,
                                  height: 21,
                                  borderRadius: 1,
                                  bgcolor: '#f1f5f9',
                                  color: '#64748b',
                                  border: '1px solid #cbd5e1'
                                }}
                              />
                              <Typography sx={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', lineHeight: 1 }}>
                                Falta 100%
                              </Typography>
                            </Stack>
                          </Tooltip>
                        )}
                      </TableCell>

                      {/* Evidencias (Clic para ver en ventana emergente) */}
                      <TableCell align="center" sx={{ verticalAlign: 'middle', py: 1, px: 0.5 }}>
                        {evidences.length > 0 ? (
                          <Tooltip title="Clic para ver evidencias en ventana emergente" arrow>
                            <Chip
                              size="small"
                              icon={<AttachFileIcon sx={{ fontSize: 13 }} />}
                              label={`${evidences.length} arch.`}
                              onClick={() => handleOpenEvidenceModal(it)}
                              sx={{
                                cursor: 'pointer',
                                fontWeight: 800,
                                fontSize: 11,
                                height: 22,
                                borderRadius: 1,
                                bgcolor: '#e0e7ff',
                                color: '#4338ca',
                                transition: 'all 0.15s ease',
                                '&:hover': { bgcolor: '#c7d2fe' }
                              }}
                            />
                          </Tooltip>
                        ) : (
                          <Typography sx={{ fontSize: 10.5, color: '#94a3b8' }}>Sin soportes</Typography>
                        )}
                      </TableCell>

                      {/* Acción */}
                      <TableCell align="center" sx={{ verticalAlign: 'middle', py: 1, px: 1 }}>
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          startIcon={<CloudUploadIcon sx={{ fontSize: 15 }} />}
                          onClick={() => handleOpenMonitoringModal(it)}
                          sx={{
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 800,
                            fontSize: 11.5,
                            py: 0.5,
                            px: 1.5,
                            bgcolor: '#2563eb',
                            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.2)',
                            '&:hover': { bgcolor: '#1d4ed8', boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)' }
                          }}
                        >
                          {isPlanningStaff ? 'Valorar' : 'Cargar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ==========================================
          MODAL: RADICAR DOCUMENTO DE EVIDENCIA (SIN CAMPOS DE TEXTO)
         ========================================== */}
      <Dialog
        open={monitoringModalOpen}
        onClose={() => !savingMonitoring && setMonitoringModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            boxShadow: '0 20px 45px rgba(15, 23, 42, 0.16)'
          }
        }}
      >
        {/* Cabecera limpia y ejecutiva */}
        <DialogTitle
          sx={{
            m: 0,
            px: 3,
            py: 2,
            borderBottom: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
            <Chip
              size="small"
              label={targetItem?.code || 'Actividad'}
              sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 800, fontSize: 12, flexShrink: 0 }}
            />
            <Typography sx={{ fontSize: 15.5, fontWeight: 800, color: '#0f172a' }} noWrap>
              {targetItem?.activity || 'Radicar Evidencia'}
            </Typography>
          </Stack>
          <IconButton
            aria-label="cerrar"
            onClick={() => !savingMonitoring && setMonitoringModalOpen(false)}
            size="small"
            sx={{ color: '#64748b' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ px: 3, py: 2.5, bgcolor: '#ffffff' }}>
          <Stack spacing={2.2}>
            {/* Resumen compacto de Indicador y Meta */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 2,
                alignItems: 'center'
              }}
            >
              <Typography sx={{ fontSize: 13, color: '#475569' }}>
                <strong style={{ color: '#0f172a' }}>Indicador:</strong> {targetItem?.indicator || '—'}
              </Typography>
              <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
              <Typography sx={{ fontSize: 13, color: '#475569' }}>
                <strong style={{ color: '#059669' }}>Meta:</strong> {targetItem?.target || '—'}
              </Typography>
            </Box>

            {/* Período del informe y calificación */}
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={isPlanningStaff ? 6 : 7}>
                <TextField
                  fullWidth
                  select
                  size="small"
                  label={periods.length === 2 ? 'Semestre *' : (periods.length === 4 ? 'Trimestre *' : (periods.length === 3 ? 'Cuatrimestre *' : 'Período de Seguimiento *'))}
                  value={monitoringForm.period_id}
                  onChange={(e) => handlePeriodChange(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                >
                  {periods.map((p) => {
                    const isS1 = (p.code || '').toUpperCase() === 'S1' || /1|prim/i.test(p.name || '');
                    const isS2 = (p.code || '').toUpperCase() === 'S2' || /2|seg/i.test(p.name || '');
                    let labelPeriod = p.name || `Período ${p.code}`;
                    if (periods.length === 2) {
                      if (isS1) labelPeriod = 'Primer Semestre (1 Ene - 31 Jul)';
                      else if (isS2) labelPeriod = 'Segundo Semestre (1 Ago - 31 Dic)';
                    } else if (p.starts_on && p.ends_on) {
                      labelPeriod = `${p.name || p.code} (${formatFecha(p.starts_on)} al ${formatFecha(p.ends_on)})`;
                    }
                    return (
                      <MenuItem key={p.id} value={p.id}>
                        {p.code ? `${p.code} · ` : ''}{labelPeriod}
                      </MenuItem>
                    );
                  })}
                </TextField>
              </Grid>

              {isPlanningStaff ? (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    inputProps={{ min: 0, max: 100, step: 1 }}
                    label="Avance Físico (%) *"
                    value={monitoringForm.physical_progress}
                    onChange={(e) => setMonitoringForm({ ...monitoringForm, physical_progress: e.target.value })}
                    placeholder="0 - 100"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                </Grid>
              ) : (
                <Grid item xs={12} sm={5}>
                  {(() => {
                    const currentResult = (targetItem?.monitoringResults || []).find((r) => r.monitoring_period_id === monitoringForm.period_id);
                    const hasScore = currentResult?.physical_progress !== undefined && currentResult?.physical_progress !== null && currentResult?.physical_progress !== '';
                    return (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontSize: 13, color: '#64748b' }}>Avance Planeación:</Typography>
                        <Chip
                          size="small"
                          color={hasScore ? (Number(currentResult.physical_progress) >= 100 ? 'success' : 'primary') : 'default'}
                          label={hasScore ? `${currentResult.physical_progress}%` : 'Pendiente'}
                          sx={{ fontWeight: 800 }}
                        />
                      </Box>
                    );
                  })()}
                </Grid>
              )}
            </Grid>

            {/* Adjuntar Únicamente el Documento de Evidencia */}
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#1e293b', mb: 1 }}>
                Documento de Evidencia *
              </Typography>
              {!monitoringForm.file ? (
                <Paper
                  component="label"
                  variant="outlined"
                  sx={{
                    p: 2.5,
                    borderRadius: 2.5,
                    border: '2px dashed #93c5fd',
                    bgcolor: '#f8fbff',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                    display: 'block',
                    '&:hover': {
                      borderColor: '#2563eb',
                      bgcolor: '#eff6ff'
                    }
                  }}
                >
                  <input
                    hidden
                    type="file"
                    onChange={(e) => setMonitoringForm({ ...monitoringForm, file: e.target.files?.[0] || null })}
                  />
                  <CloudUploadIcon sx={{ fontSize: 36, color: '#2563eb', mb: 0.5 }} />
                  <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: '#1e3a8a' }}>
                    Haga clic aquí para seleccionar el archivo soporte
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.3 }}>
                    Formatos: PDF, Excel, Word, Imágenes o ZIP (máx. 50 MB)
                  </Typography>
                </Paper>
              ) : (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    bgcolor: '#f0fdf4',
                    borderColor: '#bbf7d0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1.5
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: '#dcfce7', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      {getFileIcon(monitoringForm.file.name)}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: '#166534' }} noWrap>
                        {monitoringForm.file.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 700 }}>
                        {formatBytes(monitoringForm.file.size)} · Archivo listo para radicar
                      </Typography>
                    </Box>
                  </Stack>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    onClick={() => setMonitoringForm({ ...monitoringForm, file: null })}
                    sx={{ textTransform: 'none', fontWeight: 800, fontSize: 12, borderRadius: 2, flexShrink: 0 }}
                  >
                    Quitar archivo
                  </Button>
                </Paper>
              )}
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e2e8f0', gap: 1 }}>
          <Button
            onClick={() => setMonitoringModalOpen(false)}
            disabled={savingMonitoring}
            sx={{ textTransform: 'none', fontWeight: 750, borderRadius: 2 }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={savingMonitoring ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            onClick={handleSaveMonitoring}
            disabled={savingMonitoring}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 800,
              px: 3,
              bgcolor: '#2563eb',
              '&:hover': { bgcolor: '#1d4ed8' }
            }}
          >
            {savingMonitoring ? 'Guardando...' : (isPlanningStaff ? 'Guardar Valoración' : 'Radicar Evidencia')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==========================================
          MODAL: VISUALIZAR EVIDENCIAS RADICADAS EN VENTANA EMERGENTE
         ========================================== */}
      <Dialog
        open={evidenceModalOpen}
        onClose={() => setEvidenceModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3.5,
            overflow: 'hidden',
            boxShadow: '0 25px 60px rgba(15, 23, 42, 0.2)'
          }
        }}
      >
        <DialogTitle
          sx={{
            m: 0,
            px: 3,
            py: 2,
            borderBottom: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: '#ede9fe', color: '#6d28d9', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <AttachFileIcon sx={{ fontSize: 20 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" label={evidenceItem?.code || 'Actividad'} sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 900, fontSize: 11 }} />
                <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }} noWrap>
                  Evidencias Radicadas
                </Typography>
              </Stack>
              <Typography sx={{ fontSize: 12.5, color: '#64748b', mt: 0.2 }} noWrap>
                {evidenceItem?.activity}
              </Typography>
            </Box>
          </Stack>
          <IconButton
            aria-label="cerrar"
            onClick={() => setEvidenceModalOpen(false)}
            size="small"
            sx={{ color: '#64748b' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ px: 3, py: 2.5, bgcolor: '#f8fafc' }}>
          {(!evidenceItem?.evidence || evidenceItem.evidence.length === 0) ? (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 3, bgcolor: '#ffffff' }}>
              <FileIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
              <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: '#475569' }}>
                No hay evidencias radicadas para esta actividad
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#94a3b8', mt: 0.5 }}>
                Utilice el botón "Cargar Evidencia" en la tabla para adjuntar los soportes correspondientes.
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={1.5}>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {evidenceItem.evidence.length} {evidenceItem.evidence.length === 1 ? 'documento radicado' : 'documentos radicados'}
              </Typography>
              {evidenceItem.evidence.map((ev) => (
                <Paper
                  key={ev.id}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    bgcolor: '#ffffff',
                    borderColor: '#e2e8f0',
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    gap: 1.5,
                    transition: 'all 0.15s ease',
                    '&:hover': { borderColor: '#93c5fd', boxShadow: '0 4px 14px rgba(37,99,235,0.06)' }
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#f1f5f9', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      {getFileIcon(ev.original_name)}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a' }} noWrap>
                        {ev.original_name}
                      </Typography>
                      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" sx={{ mt: 0.3 }}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>
                          {formatBytes(ev.size_bytes)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>•</Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          Radicado: {formatFecha(ev.created_at)}
                        </Typography>
                      </Stack>
                    </Box>
                  </Stack>

                  <Stack direction="row" spacing={1} sx={{ flexShrink: 0, alignSelf: { xs: 'flex-end', sm: 'center' } }}>
                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      startIcon={<OpenInNewIcon sx={{ fontSize: 15 }} />}
                      onClick={() => handlePreviewEvidence(ev)}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, fontSize: 12 }}
                    >
                      Visualizar
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="inherit"
                      startIcon={<DownloadIcon sx={{ fontSize: 15 }} />}
                      onClick={() => handleDownloadDirectEvidence(ev)}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, fontSize: 12, bgcolor: '#f1f5f9', color: '#1e293b', '&:hover': { bgcolor: '#e2e8f0' } }}
                    >
                      Descargar
                    </Button>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 1.5, borderTop: '1px solid #e2e8f0' }}>
          <Button
            onClick={() => setEvidenceModalOpen(false)}
            variant="contained"
            color="inherit"
            sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2, bgcolor: '#f1f5f9', '&:hover': { bgcolor: '#e2e8f0' } }}
          >
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==========================================
          MODAL: SOLICITAR AJUSTES A PLANEACIÓN
         ========================================== */}
      <Dialog
        open={adjustmentsModalOpen}
        onClose={() => !sendingAdjustments && setAdjustmentsModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3.5 } }}
      >
        <DialogTitle sx={{ px: 3, pt: 3, pb: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#fee2e2', color: '#dc2626', display: 'grid', placeItems: 'center' }}>
              <WarningIcon />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                Solicitar Ajustes a Planeación y Efectividad
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: '#64748b' }}>
                El Plan de Acción volverá al equipo de Planeación para su corrección.
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ px: 3, py: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="warning" sx={{ borderRadius: 2.5 }}>
              Al enviar observaciones, el plan saldrá temporalmente de su módulo de SIAC hasta que Planeación y Efectividad revise y ejecute las correcciones solicitadas.
            </Alert>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Detalle de observaciones y ajustes requeridos *"
              placeholder="Indique puntualmente qué actividades, metas o fechas requiere ajustar o concertar nuevamente..."
              value={adjustmentComment}
              onChange={(e) => setAdjustmentComment(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          <Button
            onClick={() => setAdjustmentsModalOpen(false)}
            disabled={sendingAdjustments}
            sx={{ textTransform: 'none', fontWeight: 800 }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={sendingAdjustments ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            onClick={handleConfirmAdjustments}
            disabled={sendingAdjustments || !adjustmentComment.trim()}
            sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900, px: 3 }}
          >
            {sendingAdjustments ? 'Enviando...' : 'Confirmar y Devolver a Planeación'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* VENTANA EMERGENTE COMPLETA DE VISTA PREVIA DE EVIDENCIA */}
      <Dialog
        open={previewModal.open}
        onClose={handleClosePreview}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3.5, overflow: 'hidden', height: '88vh', display: 'flex', flexDirection: 'column' }
        }}
      >
        <DialogTitle
          sx={{
            m: 0, px: 3, py: 1.75, borderBottom: '1px solid #e2e8f0', bgcolor: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#f1f5f9', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              {getFileIcon(previewModal.fileName)}
            </Box>
            <Typography sx={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }} noWrap>
              {previewModal.fileName}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            {previewModal.url && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<DownloadIcon sx={{ fontSize: 15 }} />}
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = previewModal.url;
                  a.download = previewModal.fileName;
                  a.click();
                }}
                sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2 }}
              >
                Descargar
              </Button>
            )}
            {previewModal.url && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<OpenInNewIcon sx={{ fontSize: 15 }} />}
                onClick={() => window.open(previewModal.url, '_blank')}
                sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2 }}
              >
                Pestaña Nueva
              </Button>
            )}
            <IconButton aria-label="cerrar" onClick={handleClosePreview} size="small" sx={{ color: '#64748b' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ p: 0, bgcolor: '#f8fafc', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {previewModal.loading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, py: 8 }}>
              <CircularProgress />
              <Typography sx={{ mt: 2, color: '#64748b', fontSize: 13, fontWeight: 700 }}>
                Cargando vista previa del documento...
              </Typography>
            </Stack>
          ) : previewModal.isPdf ? (
            <Box sx={{ flex: 1, width: '100%', height: '100%' }}>
              <iframe
                src={previewModal.url}
                title={previewModal.fileName}
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </Box>
          ) : previewModal.isImage ? (
            <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', p: 3, bgcolor: '#0f172a' }}>
              <img
                src={previewModal.url}
                alt={previewModal.fileName}
                style={{ maxWidth: '100%', maxHeight: '78vh', objectFit: 'contain', borderRadius: 8 }}
              />
            </Box>
          ) : (
            <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, p: 4, textAlign: 'center' }}>
              <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, bgcolor: '#ffffff', maxWidth: 500, width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
                <Box sx={{ width: 64, height: 64, borderRadius: 3, bgcolor: '#f1f5f9', display: 'grid', placeItems: 'center', mx: 'auto', mb: 2 }}>
                  {getFileIcon(previewModal.fileName)}
                </Box>
                <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#0f172a', mb: 0.5 }}>
                  {previewModal.fileName}
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
                  Documento cargado como soporte institucional. Puede descargarlo y visualizarlo de forma nativa en su equipo.
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  startIcon={<DownloadIcon />}
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = previewModal.url;
                    a.download = previewModal.fileName;
                    a.click();
                  }}
                  sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 850, px: 4 }}
                >
                  Descargar Documento
                </Button>
              </Paper>
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para Consultar y Descargar Actas del Plan */}
      <Dialog
        open={actasModalOpen}
        onClose={() => setActasModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3.5, overflow: 'hidden' }
        }}
      >
        <DialogTitle
          sx={{
            px: 3,
            py: 2,
            bgcolor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 2.5,
                bgcolor: '#faf5ff',
                color: '#7e22ce',
                display: 'grid',
                placeItems: 'center',
                border: '1px solid #e9d5ff'
              }}
            >
              <DescriptionIcon sx={{ fontSize: 22 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                Actas Oficiales del Plan de Acción
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                {selectedPlan?.code || ''} — {selectedPlan?.name || ''}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Actualizar actas desde el repositorio" arrow>
              <IconButton
                size="small"
                onClick={handleRefreshActas}
                disabled={refreshingActas}
                sx={{ color: '#475569' }}
              >
                {refreshingActas ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={() => setActasModalOpen(false)} sx={{ color: '#64748b' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ p: 2.5, bgcolor: '#f8fafc' }}>
          {planActas.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 3, bgcolor: '#ffffff' }}>
              <DescriptionIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
              <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#334155' }}>
                No hay actas registradas en este momento
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#64748b', mt: 0.5 }}>
                Las actas formalizadas por Planeación y Efectividad institucional estarán disponibles aquí para su consulta y descarga.
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, color: '#1e293b', fontSize: 11.5, py: 1.2 }}>
                      Acta / Reunión
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: '#1e293b', fontSize: 11.5, py: 1.2, width: 110 }}>
                      Versión
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: '#1e293b', fontSize: 11.5, py: 1.2, width: 150 }}>
                      Estado
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: '#1e293b', fontSize: 11.5, py: 1.2, width: 310 }}>
                      Acciones Disponibles
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {planActas.map((acta, idx) => {
                    const isDownloadingOrig = downloadingMinute === `${acta.minuteId}-original`;
                    const isDownloadingCopy = downloadingMinute === `${acta.minuteId}-official_copy`;

                    return (
                      <TableRow key={acta.minuteId || idx} hover sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                        <TableCell sx={{ py: 1.2 }}>
                          <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a' }}>
                            {acta.meetingTitle}
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.3 }}>
                            <Chip
                              size="small"
                              label={acta.meetingType === 'concertation' ? 'Concertación' : 'Seguimiento'}
                              sx={{
                                height: 18,
                                fontSize: 10,
                                fontWeight: 700,
                                bgcolor: acta.meetingType === 'concertation' ? '#eff6ff' : '#f0fdf4',
                                color: acta.meetingType === 'concertation' ? '#1d4ed8' : '#15803d'
                              }}
                            />
                            <Typography sx={{ fontSize: 11, color: '#64748b' }}>
                              {formatFecha(acta.finalizedAt || acta.meetingDate)}
                            </Typography>
                          </Stack>
                        </TableCell>

                        <TableCell align="center" sx={{ py: 1.2 }}>
                          <Chip
                            size="small"
                            label={`v${acta.version}.0`}
                            sx={{ fontWeight: 800, fontSize: 11, height: 22, bgcolor: '#f1f5f9', color: '#334155' }}
                          />
                          {acta.signaturesCount > 0 && (
                            <Typography sx={{ fontSize: 10, color: '#64748b', mt: 0.3, fontWeight: 600 }}>
                              {acta.signaturesCount} {acta.signaturesCount === 1 ? 'firma' : 'firmas'}
                            </Typography>
                          )}
                        </TableCell>

                        <TableCell align="center" sx={{ py: 1.2 }}>
                          <Chip
                            size="small"
                            icon={<CheckCircleIcon sx={{ fontSize: '13px !important', color: '#15803d !important' }} />}
                            label="Formalizada en Repositorio"
                            sx={{ fontWeight: 800, fontSize: 10.5, height: 22, bgcolor: '#dcfce7', color: '#15803d' }}
                          />
                        </TableCell>

                        <TableCell align="center" sx={{ py: 1.2 }}>
                          <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
                            {/* Previsualizar en el visor interno de SIAC sin salir a Drive */}
                            <Tooltip title="Previsualizar el documento oficial en el visor interno del sistema" arrow>
                              <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                startIcon={<VisibilityIcon sx={{ fontSize: 15 }} />}
                                onClick={() => handlePreviewMinute(acta.minuteId, acta.meetingTitle)}
                                sx={{
                                  textTransform: 'none',
                                  fontSize: 11.5,
                                  fontWeight: 850,
                                  py: 0.5,
                                  px: 1.3,
                                  borderRadius: 2,
                                  boxShadow: 'none'
                                }}
                              >
                                Previsualizar
                              </Button>
                            </Tooltip>

                            {/* Descargar Original */}
                            <Tooltip title="Descargar acta con firmas originales digitalizadas" arrow>
                              <span>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="secondary"
                                  startIcon={isDownloadingOrig ? <CircularProgress size={12} color="inherit" /> : <PdfIcon sx={{ fontSize: 15 }} />}
                                  disabled={Boolean(downloadingMinute)}
                                  onClick={() => handleDownloadMinute(acta.minuteId, 'original')}
                                  sx={{
                                    textTransform: 'none',
                                    fontSize: 11,
                                    fontWeight: 800,
                                    py: 0.5,
                                    px: 1.2,
                                    borderRadius: 2,
                                    borderColor: '#d8b4fe',
                                    bgcolor: '#faf5ff',
                                    color: '#7e22ce',
                                    '&:hover': { bgcolor: '#f3e8ff', borderColor: '#c084fc' }
                                  }}
                                >
                                  Original
                                </Button>
                              </span>
                            </Tooltip>

                            {/* Descargar Copia Oficial */}
                            <Tooltip title="Descargar copia oficial con rótulo de validez institucional" arrow>
                              <span>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                  startIcon={isDownloadingCopy ? <CircularProgress size={12} color="inherit" /> : <DownloadIcon sx={{ fontSize: 15 }} />}
                                  disabled={Boolean(downloadingMinute)}
                                  onClick={() => handleDownloadMinute(acta.minuteId, 'official_copy')}
                                  sx={{
                                    textTransform: 'none',
                                    fontSize: 11,
                                    fontWeight: 800,
                                    py: 0.5,
                                    px: 1.2,
                                    borderRadius: 2,
                                    borderColor: '#cbd5e1',
                                    bgcolor: '#ffffff',
                                    color: '#334155',
                                    '&:hover': { bgcolor: '#f1f5f9', borderColor: '#94a3b8' }
                                  }}
                                >
                                  Copia
                                </Button>
                              </span>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
          <Button
            onClick={() => setActasModalOpen(false)}
            variant="outlined"
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, color: '#475569', borderColor: '#cbd5e1' }}
          >
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
