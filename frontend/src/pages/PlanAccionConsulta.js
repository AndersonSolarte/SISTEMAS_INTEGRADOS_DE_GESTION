import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box, Paper, Stack, Typography, Chip, Button, Alert,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  TextField, CircularProgress, Divider, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem,
  Grid, InputAdornment, Tabs, Tab
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
  Visibility as VisibilityIcon,
  CloudDone as CloudDoneIcon,
  FolderShared as FolderSharedIcon
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
  // eslint-disable-next-line no-unused-vars
  const isPlanningStaff = Boolean(authUser && [ROLES.ADMINISTRADOR, ROLES.PLANEACION_ESTRATEGICA, ROLES.PLANEACION_EFECTIVIDAD].includes(authUser.role));

  const [loading, setLoading] = useState(false);
  const [peiPlans, setPeiPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [legacyPlans, setLegacyPlans] = useState([]);
  const [activityViewTab, setActivityViewTab] = useState('responsible'); // 'responsible' | 'co_responsible'

  // Modal de registro de avances y evidencias (sin campos de texto, solo documento)
  const [monitoringModalOpen, setMonitoringModalOpen] = useState(false);
  const [targetItem, setTargetItem] = useState(null);
  const [monitoringForm, setMonitoringForm] = useState({
    period_id: '',
    description: '',
    file: null
  });
  const [isDragging, setIsDragging] = useState(false);
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

    // Parametrización estricta por fecha de calendario:
    // Primer Reporte: 1 de enero al 31 de julio (meses 1 a 7)
    // Segundo Reporte: 1 de agosto al 31 de diciembre (meses 8 a 12)
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1 = Enero ... 7 = Julio, 8 = Agosto ... 12 = Diciembre
    const isFirstReportPeriod = currentMonth <= 7;

    let autoPeriod = null;
    if (isFirstReportPeriod) {
      autoPeriod = periodsList.find((p) => (p.code || '').toUpperCase() === 'S1' || /1|prim/i.test(p.name || ''));
    } else {
      autoPeriod = periodsList.find((p) => (p.code || '').toUpperCase() === 'S2' || /2|seg/i.test(p.name || ''));
    }

    if (!autoPeriod) {
      autoPeriod = periodsList[isFirstReportPeriod ? 0 : Math.min(1, periodsList.length - 1)] || periodsList[0] || null;
    }

    const defaultPeriodId = autoPeriod?.id || '';
    setMonitoringForm({
      period_id: defaultPeriodId,
      description: '',
      file: null
    });
    setIsDragging(false);
    setMonitoringModalOpen(true);
  };

  // Cambio de período dentro del modal
  const handlePeriodChange = (newPeriodId) => {
    setMonitoringForm((prev) => ({
      ...prev,
      period_id: newPeriodId
    }));
  };

  // Radicar documento de evidencia de cumplimiento institucional
  const handleSaveMonitoring = async () => {
    if (!targetItem || !monitoringForm.period_id) {
      enqueueSnackbar('Por favor seleccione el semestre o período de seguimiento.', { variant: 'warning' });
      return;
    }
    if (!monitoringForm.file) {
      enqueueSnackbar('Por favor adjunte el documento de soporte o evidencia que desea radicar.', { variant: 'warning' });
      return;
    }

    setSavingMonitoring(true);
    try {
      // 1. Subir documento de evidencia oficial
      const formData = new FormData();
      formData.append('file', monitoringForm.file);
      formData.append('monitoring_period_id', monitoringForm.period_id);
      if (monitoringForm.description?.trim()) {
        formData.append('description', monitoringForm.description.trim());
      }
      await strategicPlanningService.uploadEvidence(targetItem.id, formData);

      // 2. Notificar actualización de estado como 'submitted' sin alterar la calificación de Planeación
      try {
        await strategicPlanningService.saveMonitoring(targetItem.id, monitoringForm.period_id, {
          status: 'submitted'
        });
      } catch (errStatus) {
        console.warn('Nota sobre sincronización de estado de seguimiento:', errStatus);
      }

      enqueueSnackbar('Documento de evidencia radicado exitosamente. Queda disponible para revisión y valoración de Planeación y Efectividad.', { variant: 'success' });
      setMonitoringModalOpen(false);
      setTargetItem(null);
      setMonitoringForm({ period_id: '', description: '', file: null });
      setIsDragging(false);
      await cargarPlanes();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Error al radicar el documento de evidencia.';
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

  // Exportar formato oficial Excel DIR-PE-FR-003 (con hoja PLAN DE ACCIÓN y hoja EN CORRESPONSABILIDAD)
  const handleExportExcel = async () => {
    if (!selectedPlan?.id) return;
    try {
      enqueueSnackbar('Generando formato oficial DIR-PE-FR-003...', { variant: 'info' });
      const blob = await strategicPlanningService.exportActionPlan(selectedPlan.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `DIR-PE-FR-003_${selectedPlan.code}_${selectedPlan.term?.year || ''}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
      enqueueSnackbar('Formato institucional DIR-PE-FR-003 descargado exitosamente.', { variant: 'success' });
    } catch (error) {
      console.error('Error al exportar Excel:', error);
      enqueueSnackbar('No fue posible exportar el formato DIR-PE-FR-003.', { variant: 'error' });
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

  const handleOpenDriveUrl = (url) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleOpenActivityFolder = async (item, periodId = null) => {
    if (!item) return;
    const targetPeriodId = periodId || monitoringForm?.period_id || null;
    const directUrl = (item.evidence || []).find((e) => targetPeriodId ? (String(e.monitoring_period_id) === String(targetPeriodId) && e.drive_folder_url) : e.drive_folder_url)?.drive_folder_url
      || ((item.evidence || []).find((e) => targetPeriodId ? (String(e.monitoring_period_id) === String(targetPeriodId) && e.drive_folder_id) : e.drive_folder_id)
          ? `https://drive.google.com/drive/folders/${item.evidence.find((e) => targetPeriodId ? (String(e.monitoring_period_id) === String(targetPeriodId) && e.drive_folder_id) : e.drive_folder_id).drive_folder_id}`
          : null);
    
    if (directUrl) {
      window.open(directUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    try {
      enqueueSnackbar('Localizando carpeta en Google Drive...', { variant: 'info' });
      const res = await strategicPlanningService.getActionItemDriveFolder(item.id, targetPeriodId);
      const url = res?.folderUrl || res?.data?.folderUrl;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        enqueueSnackbar('La carpeta de la actividad en Drive se habilitará al sincronizar el primer soporte.', { variant: 'warning' });
      }
    } catch (e) {
      console.error('Error al obtener carpeta de Drive:', e);
      enqueueSnackbar('No fue posible abrir la carpeta en Google Drive.', { variant: 'error' });
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

  // Actividades en corresponsabilidad asignadas a esta dependencia
  const coResponsibleItems = useMemo(() => {
    return selectedPlan?.co_responsible_items || [];
  }, [selectedPlan]);

  // Cálculos de métricas del plan seleccionado (Sumatoria institucional de seguimientos)
  const planMetrics = useMemo(() => {
    if (!selectedPlan) return { totalActivities: 0, avgProgress: '0.0', totalEvidences: 0, completedActivities: 0, inProgressActivities: 0, totalCoActivities: 0 };
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
    const totalCoActivities = coResponsibleItems.length;
    return { totalActivities, avgProgress, totalEvidences, completedActivities, inProgressActivities, totalCoActivities };
  }, [selectedPlan, coResponsibleItems]);

  // Actividades filtradas por búsqueda en tiempo real (Como Responsable)
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

  // Actividades filtradas por búsqueda en tiempo real (En Corresponsabilidad)
  const filteredCoItems = useMemo(() => {
    const list = coResponsibleItems;
    if (!activitySearch.trim()) return list;
    const term = activitySearch.toLowerCase().trim();
    return list.filter((it) =>
      (it.code || '').toLowerCase().includes(term) ||
      (it.activity || '').toLowerCase().includes(term) ||
      (it.indicator || '').toLowerCase().includes(term) ||
      (it.macroactivity || '').toLowerCase().includes(term) ||
      (it.parent_plan?.dependency_name || '').toLowerCase().includes(term) ||
      (it.parent_plan?.leader_name || '').toLowerCase().includes(term)
    );
  }, [coResponsibleItems, activitySearch]);

  // Evidencias asociadas al período seleccionado en el modal de radicación
  const targetPeriodEvidences = useMemo(() => {
    if (!targetItem?.evidence) return [];
    if (!monitoringForm.period_id) return targetItem.evidence;
    return (targetItem.evidence || []).filter((e) => e.monitoring_period_id === monitoringForm.period_id);
  }, [targetItem, monitoringForm.period_id]);

  // Calificación / resultado de seguimiento emitido por Planeación para el período seleccionado
  const targetPeriodResult = useMemo(() => {
    if (!targetItem?.monitoringResults || !monitoringForm.period_id) return null;
    return (targetItem.monitoringResults || []).find((r) => r.monitoring_period_id === monitoringForm.period_id) || null;
  }, [targetItem, monitoringForm.period_id]);

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
              variant="contained"
              startIcon={<ExcelIcon />}
              onClick={handleExportExcel}
              sx={{
                borderRadius: 2.2,
                textTransform: 'none',
                fontWeight: 850,
                fontSize: 12.5,
                px: 1.8,
                py: 0.6,
                bgcolor: '#16a34a',
                color: '#ffffff',
                '&:hover': { bgcolor: '#15803d' },
                boxShadow: 'none'
              }}
            >
              Exportar DIR-PE-FR-003
            </Button>
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
                  <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mt: 0.2 }}>
                    <Typography sx={{ fontSize: { xs: 22, md: 26 }, fontWeight: 900, color: '#1e3a8a' }}>
                      {planMetrics.totalActivities}
                    </Typography>
                    {planMetrics.totalCoActivities > 0 && (
                      <Chip
                        size="small"
                        label={`+${planMetrics.totalCoActivities} corresponsables`}
                        sx={{ bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 800, fontSize: 10, height: 20 }}
                      />
                    )}
                  </Stack>
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
        {/* ENCABEZADO INSTITUCIONAL OFICIAL DIR-PE-FR-003 */}
        <Box sx={{ bgcolor: '#ffffff', borderBottom: '1px solid #cbd5e1', py: 1, px: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <img
            src="/Encabezado_correos.png"
            alt="Universidad CESMAG"
            style={{ maxHeight: 54, maxWidth: '100%', objectFit: 'contain' }}
          />
        </Box>

        {/* PESTAÑAS ESTILO HOJAS EXCEL Y BUSCADOR */}
        <Box sx={{ bgcolor: '#f8fafc', borderBottom: '1px solid #cbd5e1', px: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Tabs
            value={activityViewTab}
            onChange={(e, val) => setActivityViewTab(val)}
            sx={{
              minHeight: 44,
              '& .MuiTabs-indicator': {
                bgcolor: activityViewTab === 'responsible' ? '#1f3864' : '#800000',
                height: 3
              }
            }}
          >
            <Tab
              value="responsible"
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontSize: 13, fontWeight: activityViewTab === 'responsible' ? 900 : 700 }}>
                    Hoja 1: PLAN DE ACCIÓN
                  </Typography>
                  <Chip
                    size="small"
                    label={filteredItems.length}
                    sx={{
                      bgcolor: activityViewTab === 'responsible' ? '#dbeafe' : '#f1f5f9',
                      color: activityViewTab === 'responsible' ? '#1e40af' : '#64748b',
                      fontWeight: 850,
                      fontSize: 10.5,
                      height: 20
                    }}
                  />
                </Stack>
              }
              sx={{ textTransform: 'none', px: 2, minHeight: 44, color: activityViewTab === 'responsible' ? '#1f3864' : '#64748b' }}
            />
            <Tab
              value="co_responsible"
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontSize: 13, fontWeight: activityViewTab === 'co_responsible' ? 900 : 700 }}>
                    Hoja 2: EN CORRESPONSABILIDAD
                  </Typography>
                  <Chip
                    size="small"
                    label={filteredCoItems.length}
                    sx={{
                      bgcolor: activityViewTab === 'co_responsible' ? '#fee2e2' : '#f1f5f9',
                      color: activityViewTab === 'co_responsible' ? '#991b1b' : '#64748b',
                      fontWeight: 850,
                      fontSize: 10.5,
                      height: 20
                    }}
                  />
                </Stack>
              }
              sx={{ textTransform: 'none', px: 2, minHeight: 44, color: activityViewTab === 'co_responsible' ? '#800000' : '#64748b' }}
            />
          </Tabs>

          <TextField
            size="small"
            placeholder={activityViewTab === 'responsible' ? "Buscar por código, actividad..." : "Buscar por código, actividad, dependencia..."}
            value={activitySearch}
            onChange={(e) => setActivitySearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#94a3b8', fontSize: 16 }} />
                </InputAdornment>
              )
            }}
            sx={{
              width: { xs: '100%', sm: 260 },
              py: 0.5,
              '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#ffffff', fontSize: 12, height: 32 }
            }}
          />
        </Box>

        {/* TIRA INSTITUCIONAL (FILA 5 EXCEL) */}
        <Box
          sx={{
            p: 1.25,
            px: 2.5,
            bgcolor: activityViewTab === 'responsible' ? '#d9e2f3' : '#fef3c7',
            borderBottom: `2px solid ${activityViewTab === 'responsible' ? '#2f5597' : '#b45309'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1
          }}
        >
          <Typography sx={{ fontWeight: 900, fontSize: 13, color: activityViewTab === 'responsible' ? '#1f3864' : '#78350f', letterSpacing: 0.5 }}>
            {activityViewTab === 'responsible'
              ? `${selectedPlan?.code || 'PLAN'}_ ${(selectedPlan?.organizationalUnit?.name || selectedPlan?.title || 'PLAN DE ACCIÓN').toUpperCase()}`
              : `ACTIVIDADES EN CORRESPONSABILIDAD · ${(selectedPlan?.organizationalUnit?.name || selectedPlan?.title || 'PLAN DE ACCIÓN').toUpperCase()}`}
          </Typography>
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: activityViewTab === 'responsible' ? '#2f5597' : '#b45309' }}>
            FORMATO OFICIAL DIR-PE-FR-003 · HOJA: {activityViewTab === 'responsible' ? 'PLAN DE ACCIÓN' : 'EN CORRESPONSABILIDAD'}
          </Typography>
        </Box>

        {activityViewTab === 'responsible' ? (
          <TableContainer sx={{ maxHeight: 560, overflowX: 'auto' }}>
          <Table stickyHeader size="small" sx={{ minWidth: 1040 }}>
            <TableHead>
              <TableRow>
                <TableCell align="center" sx={{ bgcolor: '#2f5597', fontWeight: 900, color: '#ffffff', width: 55, py: 1.2, px: 0.5, fontSize: 11.5, borderRight: '1px solid #ffffff' }}>
                  NO.
                </TableCell>
                <TableCell align="center" sx={{ bgcolor: '#2f5597', fontWeight: 900, color: '#ffffff', width: 85, py: 1.2, px: 1, fontSize: 11.5, borderRight: '1px solid #ffffff' }}>
                  CÓDIGO
                </TableCell>
                <TableCell sx={{ bgcolor: '#2f5597', fontWeight: 900, color: '#ffffff', minWidth: 200, maxWidth: { xs: 240, sm: 280, md: 320 }, py: 1.2, px: 1.5, fontSize: 11.5, borderRight: '1px solid #ffffff' }}>
                  ACTIVIDAD CONCERTADA
                </TableCell>
                <TableCell sx={{ bgcolor: '#2f5597', fontWeight: 900, color: '#ffffff', minWidth: 160, py: 1.2, px: 1.5, fontSize: 11.5, borderRight: '1px solid #ffffff' }}>
                  INDICADOR Y META
                </TableCell>
                <TableCell align="center" sx={{ bgcolor: '#2f5597', fontWeight: 900, color: '#ffffff', width: 115, py: 1.2, px: 1, fontSize: 11.5, borderRight: '1px solid #ffffff' }}>
                  PLAZO
                </TableCell>
                {/* Columnas dinámicas de seguimiento según el plan de desarrollo */}
                {periods.map((p, pIdx) => {
                  const isS1 = (p.code || '').toUpperCase() === 'S1' || /1|prim/i.test(p.name || '') || pIdx === 0;
                  const isS2 = (p.code || '').toUpperCase() === 'S2' || /2|seg/i.test(p.name || '') || pIdx === 1;
                  const label = isS1 ? 'AVANCE S1 (1 ENE - 31 JUL)' : (isS2 ? 'AVANCE S2 (1 AGO - 31 DIC)' : `AVANCE ${p.code || p.name}`);
                  return (
                    <TableCell
                      key={p.id}
                      align="center"
                      sx={{
                        bgcolor: '#2f5597',
                        fontWeight: 900,
                        color: '#ffffff',
                        minWidth: 110,
                        maxWidth: 140,
                        py: 1.2,
                        px: 0.8,
                        fontSize: 11,
                        borderRight: '1px solid #ffffff',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {label}
                    </TableCell>
                  );
                })}
                <TableCell sx={{ bgcolor: '#2f5597', fontWeight: 900, color: '#ffffff', width: 120, minWidth: 110, py: 1.2, px: 0.5, fontSize: 11.5, borderRight: '1px solid #ffffff' }} align="center">
                  CUMPLIMIENTO
                </TableCell>
                <TableCell sx={{ bgcolor: '#2f5597', fontWeight: 900, color: '#ffffff', width: 95, py: 1.2, px: 0.5, fontSize: 11.5, borderRight: '1px solid #ffffff' }} align="center">
                  EVIDENCIAS
                </TableCell>
                <TableCell sx={{ bgcolor: '#2f5597', fontWeight: 900, color: '#ffffff', width: 120, py: 1.2, px: 1, fontSize: 11.5 }} align="center">
                  ACCIÓN
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8 + periods.length} align="center" sx={{ py: 6, color: '#64748b', fontSize: 12 }}>
                    {activitySearch ? 'No se encontraron actividades con ese criterio de búsqueda.' : 'No hay actividades registradas en este plan.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((it, idx) => {
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
                      {/* NO. */}
                      <TableCell align="center" sx={{ position: 'sticky', left: 0, bgcolor: '#d9e2f3', fontWeight: 900, color: '#1f3864', fontSize: 12, zIndex: 1, borderRight: '1px solid #b4c6e7', verticalAlign: 'middle', width: 55 }}>
                        {idx + 1}
                      </TableCell>

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
                              <Tooltip title={`Valoración oficial de Planeación y Efectividad: ${prog}%`} arrow>
                                <Chip
                                  size="small"
                                  label={`${prog}%`}
                                  sx={{
                                    fontWeight: 800,
                                    fontSize: 11,
                                    height: 22,
                                    borderRadius: 1,
                                    bgcolor: prog >= 100 ? '#dcfce7' : (prog > 0 ? '#fef3c7' : '#f1f5f9'),
                                    color: prog >= 100 ? '#15803d' : (prog > 0 ? '#b45309' : '#64748b'),
                                    cursor: 'help'
                                  }}
                                />
                              </Tooltip>
                            ) : (
                              <Tooltip title="Sin valoración registrada por Planeación y Efectividad para este período" arrow>
                                <Typography sx={{ fontSize: 11.5, color: '#94a3b8', cursor: 'help' }}>—</Typography>
                              </Tooltip>
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
                          startIcon={<CloudUploadIcon sx={{ fontSize: 16 }} />}
                          onClick={() => handleOpenMonitoringModal(it)}
                          sx={{
                            borderRadius: 2.2,
                            textTransform: 'none',
                            fontWeight: 850,
                            fontSize: 12,
                            py: 0.6,
                            px: 1.8,
                            bgcolor: '#0284c7',
                            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.22)',
                            '&:hover': { bgcolor: '#0369a1', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.32)' },
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Cargar Evidencia
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        ) : (
          /* TABLA DE ACTIVIDADES EN CORRESPONSABILIDAD */
          <TableContainer sx={{ maxHeight: 560, overflowX: 'auto' }}>
            <Table stickyHeader size="small" sx={{ minWidth: 1040 }}>
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ bgcolor: '#78350f', fontWeight: 900, color: '#ffffff', width: 55, py: 1.2, px: 0.5, fontSize: 11.5, borderRight: '1px solid #ffffff' }}>
                    NO.
                  </TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#78350f', fontWeight: 900, color: '#ffffff', width: 85, py: 1.2, px: 1, fontSize: 11.5, borderRight: '1px solid #ffffff' }}>
                    CÓDIGO
                  </TableCell>
                  <TableCell sx={{ bgcolor: '#78350f', fontWeight: 900, color: '#ffffff', minWidth: 200, maxWidth: { xs: 240, sm: 280, md: 320 }, py: 1.2, px: 1.5, fontSize: 11.5, borderRight: '1px solid #ffffff' }}>
                    ACTIVIDAD EN CORRESPONSABILIDAD
                  </TableCell>
                  <TableCell sx={{ bgcolor: '#78350f', fontWeight: 900, color: '#ffffff', minWidth: 170, py: 1.2, px: 1.5, fontSize: 11.5, borderRight: '1px solid #ffffff' }}>
                    PLAN / DEPENDENCIA RESPONSABLE
                  </TableCell>
                  <TableCell sx={{ bgcolor: '#78350f', fontWeight: 900, color: '#ffffff', minWidth: 150, py: 1.2, px: 1.5, fontSize: 11.5, borderRight: '1px solid #ffffff' }}>
                    INDICADOR Y META
                  </TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#78350f', fontWeight: 900, color: '#ffffff', width: 115, py: 1.2, px: 1, fontSize: 11.5, borderRight: '1px solid #ffffff' }}>
                    PLAZO
                  </TableCell>
                  {periods.map((p, pIdx) => {
                    const isS1 = (p.code || '').toUpperCase() === 'S1' || /1|prim/i.test(p.name || '') || pIdx === 0;
                    const isS2 = (p.code || '').toUpperCase() === 'S2' || /2|seg/i.test(p.name || '') || pIdx === 1;
                    const label = isS1 ? 'AVANCE S1 (1 ENE - 31 JUL)' : (isS2 ? 'AVANCE S2 (1 AGO - 31 DIC)' : `AVANCE ${p.code || p.name}`);
                    return (
                      <TableCell
                        key={p.id}
                        align="center"
                        sx={{
                          bgcolor: '#78350f',
                          fontWeight: 900,
                          color: '#ffffff',
                          minWidth: 110,
                          maxWidth: 140,
                          py: 1.2,
                          px: 0.8,
                          fontSize: 11,
                          borderRight: '1px solid #ffffff',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {label}
                      </TableCell>
                    );
                  })}
                  <TableCell sx={{ bgcolor: '#78350f', fontWeight: 900, color: '#ffffff', width: 120, minWidth: 110, py: 1.2, px: 0.5, fontSize: 11.5, borderRight: '1px solid #ffffff' }} align="center">
                    CUMPLIMIENTO
                  </TableCell>
                  <TableCell sx={{ bgcolor: '#78350f', fontWeight: 900, color: '#ffffff', width: 95, py: 1.2, px: 0.5, fontSize: 11.5, borderRight: '1px solid #ffffff' }} align="center">
                    EVIDENCIAS
                  </TableCell>
                  <TableCell sx={{ bgcolor: '#78350f', fontWeight: 900, color: '#ffffff', width: 125, py: 1.2, px: 1, fontSize: 11.5 }} align="center">
                    ACCIÓN
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCoItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9 + periods.length} align="center" sx={{ py: 6, color: '#64748b', fontSize: 12 }}>
                      <Stack spacing={1} alignItems="center">
                        <Typography sx={{ fontWeight: 700, color: '#94a3b8' }}>
                          {activitySearch ? 'No se encontraron actividades en corresponsabilidad con ese criterio.' : 'No tiene actividades asignadas en corresponsabilidad en esta vigencia.'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                          Cuando otras dependencias incluyan su dependencia en el campo "Corresponsables", aparecerán automáticamente aquí.
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCoItems.map((it, idx) => {
                    const evidences = it.evidence || [];
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
                          '&:hover': { bgcolor: '#fffbeb' },
                          borderBottom: '1px solid #fef3c7'
                        }}
                      >
                        {/* NO. */}
                        <TableCell align="center" sx={{ position: 'sticky', left: 0, bgcolor: '#fef3c7', fontWeight: 900, color: '#78350f', fontSize: 12, zIndex: 1, borderRight: '1px solid #fde68a', verticalAlign: 'middle', width: 55 }}>
                          {idx + 1}
                        </TableCell>

                        {/* Código */}
                        <TableCell align="center" sx={{ verticalAlign: 'middle', py: 1, px: 1 }}>
                          <Chip
                            size="small"
                            label={it.code || '—'}
                            sx={{
                              fontWeight: 800,
                              bgcolor: '#fef3c7',
                              color: '#92400e',
                              fontSize: 10.5,
                              height: 22,
                              borderRadius: 1
                            }}
                          />
                        </TableCell>
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
                        <TableCell sx={{ verticalAlign: 'middle', py: 1, px: 1 }}>
                          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#1e3a8a', lineHeight: 1.25 }}>
                            {it.parent_plan?.dependency_name || 'Dependencia'}
                          </Typography>
                          <Typography sx={{ fontSize: 10.5, color: '#64748b', mt: 0.2 }}>
                            Plan {it.parent_plan?.code} · Líder: <strong>{it.parent_plan?.leader_name || '—'}</strong>
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ verticalAlign: 'middle', py: 1, px: 1 }}>
                          <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: '#334155', lineHeight: 1.25 }}>
                            {it.indicator || 'Sin indicador'}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: '#059669', fontWeight: 700, mt: 0.2 }}>
                            Meta: {it.target || '100%'}
                          </Typography>
                        </TableCell>
                        <TableCell align="center" sx={{ verticalAlign: 'middle', py: 1, px: 1 }}>
                          <Typography sx={{ fontSize: 10.5, color: '#475569', lineHeight: 1.3 }}>
                            {formatFecha(it.starts_on)} al {formatFecha(it.ends_on)}
                          </Typography>
                        </TableCell>
                        {periods.map((p) => {
                          const r = (it.monitoringResults || []).find((res) => res.monitoring_period_id === p.id);
                          const prog = r && r.physical_progress !== null && r.physical_progress !== undefined ? Number(r.physical_progress) : null;
                          return (
                            <TableCell key={p.id} align="center" sx={{ verticalAlign: 'middle', py: 1, px: 0.5 }}>
                              {prog !== null ? (
                                <Tooltip title={`Valoración oficial de Planeación y Efectividad: ${prog}%`} arrow>
                                  <Chip
                                    size="small"
                                    label={`${prog}%`}
                                    sx={{
                                      fontWeight: 800,
                                      fontSize: 11,
                                      height: 22,
                                      borderRadius: 1,
                                      bgcolor: prog >= 100 ? '#dcfce7' : prog > 0 ? '#e0f2fe' : '#f1f5f9',
                                      color: prog >= 100 ? '#15803d' : prog > 0 ? '#0369a1' : '#64748b',
                                      cursor: 'help'
                                    }}
                                  />
                                </Tooltip>
                              ) : (
                                <Tooltip title="Sin valoración registrada por Planeación y Efectividad para este período" arrow>
                                  <Typography sx={{ fontSize: 11, color: '#cbd5e1', cursor: 'help' }}>—</Typography>
                                </Tooltip>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell align="center" sx={{ verticalAlign: 'middle', py: 1, px: 0.5 }}>
                          {compProg !== null && compProg >= 100 ? (
                            <Tooltip title="Meta cumplida exitosamente (100% o superior)" arrow>
                              <Stack alignItems="center" spacing={0.2}>
                                <Chip
                                  size="small"
                                  icon={<CheckCircleIcon sx={{ fontSize: 13, color: '#15803d !important' }} />}
                                  label={`${compProg}%`}
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
                                <Typography sx={{ fontSize: 9, fontWeight: 800, color: '#15803d', lineHeight: 1 }}>
                                  Cumplida
                                </Typography>
                              </Stack>
                            </Tooltip>
                          ) : compProg !== null && compProg > 0 ? (
                            <Tooltip title={`Cumplimiento acumulado del ${compProg}%. Resta ${Number((100 - compProg).toFixed(0))}% para completar la meta.`} arrow>
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
                                  bgcolor: '#fef3c7',
                                  color: '#92400e',
                                  transition: 'all 0.15s ease',
                                  '&:hover': { bgcolor: '#fde68a' }
                                }}
                              />
                            </Tooltip>
                          ) : (
                            <Typography sx={{ fontSize: 10.5, color: '#94a3b8' }}>Sin soportes</Typography>
                          )}
                        </TableCell>
                        <TableCell align="center" sx={{ verticalAlign: 'middle', py: 1, px: 1 }}>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<CloudUploadIcon sx={{ fontSize: 16 }} />}
                            onClick={() => handleOpenMonitoringModal(it)}
                            sx={{
                              borderRadius: 2.2,
                              textTransform: 'none',
                              fontWeight: 850,
                              fontSize: 12,
                              py: 0.6,
                              px: 1.8,
                              bgcolor: '#d97706',
                              boxShadow: '0 2px 8px rgba(217, 119, 6, 0.22)',
                              '&:hover': { bgcolor: '#b45309', boxShadow: '0 4px 10px rgba(217, 119, 6, 0.32)' },
                              whiteSpace: 'nowrap'
                            }}
                          >
                            Aportar Evidencia
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ==========================================
          MODAL EJECUTIVO: CARGAR EVIDENCIA DE ACTIVIDAD
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
            boxShadow: '0 25px 60px rgba(15, 23, 42, 0.2)'
          }
        }}
      >
        <DialogTitle
          sx={{
            m: 0,
            px: 3,
            py: 1.8,
            borderBottom: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 2,
                bgcolor: '#eff6ff',
                color: '#2563eb',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0
              }}
            >
              <CloudUploadIcon sx={{ fontSize: 22 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  size="small"
                  label={targetItem?.code || 'Actividad'}
                  sx={{ bgcolor: '#e0e7ff', color: '#1e40af', fontWeight: 900, fontSize: 11, height: 22 }}
                />
                <Typography sx={{ fontSize: 15.5, fontWeight: 900, color: '#0f172a' }}>
                  Cargar Evidencia
                </Typography>
              </Stack>
              <Typography sx={{ fontSize: 12, color: '#475569', fontWeight: 600, mt: 0.2 }} noWrap>
                {targetItem?.activity}
              </Typography>
            </Box>
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
          <Stack spacing={2}>
            {/* Fila Ejecutiva: Selección de Período y Estado de Calificación de Planeación */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between">
              <TextField
                select
                size="small"
                label="Período de Reporte *"
                value={monitoringForm.period_id}
                onChange={(e) => handlePeriodChange(e.target.value)}
                sx={{
                  flex: 1,
                  '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#f8fafc' }
                }}
              >
                {periods.map((p, idx) => {
                  const isS1 = (p.code || '').toUpperCase() === 'S1' || /1|prim/i.test(p.name || '') || idx === 0;
                  const labelPeriod = isS1
                    ? 'Primer Reporte · 1 de enero al 31 de julio'
                    : 'Segundo Reporte · 1 de agosto al 31 de diciembre';
                  return (
                    <MenuItem key={p.id} value={p.id}>
                      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                        {labelPeriod}
                      </Typography>
                    </MenuItem>
                  );
                })}
              </TextField>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {targetPeriodResult?.physical_progress !== null && targetPeriodResult?.physical_progress !== undefined && targetPeriodResult?.physical_progress !== '' ? (
                  <Chip
                    size="small"
                    label={`Planeación: ${targetPeriodResult.physical_progress}%`}
                    color={Number(targetPeriodResult.physical_progress) >= 100 ? 'success' : 'primary'}
                    sx={{ fontWeight: 850, fontSize: 11, height: 28 }}
                  />
                ) : (
                  <Chip
                    size="small"
                    label="Sin valoración aún"
                    sx={{ bgcolor: '#f1f5f9', color: '#64748b', fontWeight: 700, fontSize: 11, height: 28 }}
                  />
                )}
                {targetPeriodEvidences.length > 0 && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FolderSharedIcon sx={{ fontSize: 14 }} />}
                    onClick={() => handleOpenActivityFolder(targetItem, monitoringForm.period_id)}
                    sx={{ textTransform: 'none', fontWeight: 750, fontSize: 11, borderRadius: 2, height: 28, py: 0 }}
                  >
                    Drive
                  </Button>
                )}
              </Box>
            </Stack>

            {/* Listado Ejecutivo de Evidencias ya Radicadas para este Período */}
            {targetPeriodEvidences.length > 0 && (
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#475569', mb: 0.8 }}>
                  Soportes radicados en este período ({targetPeriodEvidences.length}):
                </Typography>
                <Stack spacing={0.6}>
                  {targetPeriodEvidences.map((ev) => (
                    <Paper
                      key={ev.id}
                      variant="outlined"
                      sx={{
                        p: 0.8,
                        px: 1.2,
                        borderRadius: 1.5,
                        bgcolor: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                        {getFileIcon(ev.original_name)}
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }} noWrap>
                          {ev.original_name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11, flexShrink: 0 }}>
                          ({formatBytes(ev.size_bytes)})
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {(ev.drive_url || ev.drive_file_id) && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            startIcon={<OpenInNewIcon sx={{ fontSize: 12 }} />}
                            onClick={() => handleOpenDriveUrl(ev.drive_url || `https://drive.google.com/file/d/${ev.drive_file_id}/view`)}
                            sx={{ textTransform: 'none', fontWeight: 750, fontSize: 10.5, borderRadius: 1.5, py: 0.2, px: 0.8, bgcolor: '#f0fdf4', borderColor: '#86efac', color: '#15803d' }}
                          >
                            Drive
                          </Button>
                        )}
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<VisibilityIcon sx={{ fontSize: 13 }} />}
                          onClick={() => handlePreviewEvidence(ev)}
                          sx={{ textTransform: 'none', fontWeight: 750, fontSize: 11, py: 0.2, px: 0.8 }}
                        >
                          Ver
                        </Button>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            )}

            {/* Zona de Carga Ejecutiva (Drag & Drop) */}
            <Box>
              {!monitoringForm.file ? (
                <Paper
                  component="label"
                  variant="outlined"
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped) setMonitoringForm((prev) => ({ ...prev, file: dropped }));
                  }}
                  sx={{
                    p: 2.5,
                    borderRadius: 2.5,
                    border: isDragging ? '2px dashed #0284c7' : '2px dashed #93c5fd',
                    bgcolor: isDragging ? '#eff6ff' : '#f8fbff',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                    display: 'block',
                    '&:hover': {
                      borderColor: '#0284c7',
                      bgcolor: '#eff6ff'
                    }
                  }}
                >
                  <input
                    hidden
                    type="file"
                    onChange={(e) => setMonitoringForm({ ...monitoringForm, file: e.target.files?.[0] || null })}
                  />
                  <CloudUploadIcon sx={{ fontSize: 34, color: '#0284c7', mb: 0.5 }} />
                  <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: '#0369a1' }}>
                    Seleccione o arrastre el archivo aquí
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.3, fontSize: 11 }}>
                    Formatos admitidos: PDF, Excel, Word, Imágenes (máx. 50 MB)
                  </Typography>
                </Paper>
              ) : (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: '#f0fdf4',
                    borderColor: '#86efac',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1.5
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ width: 38, height: 38, borderRadius: 1.5, bgcolor: '#dcfce7', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      {getFileIcon(monitoringForm.file.name)}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#166534' }} noWrap>
                        {monitoringForm.file.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 600 }}>
                        {formatBytes(monitoringForm.file.size)} · Listo para cargar
                      </Typography>
                    </Box>
                  </Stack>
                  <Button
                    size="small"
                    color="error"
                    variant="text"
                    onClick={() => setMonitoringForm({ ...monitoringForm, file: null })}
                    sx={{ textTransform: 'none', fontWeight: 800, fontSize: 11.5, flexShrink: 0 }}
                  >
                    Quitar
                  </Button>
                </Paper>
              )}
            </Box>

            {/* Observación Ejecutiva (Opcional) */}
            <TextField
              fullWidth
              size="small"
              label="Observación o detalle (opcional)"
              placeholder="Ej: Acta firmada, listado de asistencia o informe ejecutivo..."
              value={monitoringForm.description}
              onChange={(e) => setMonitoringForm({ ...monitoringForm, description: e.target.value })}
              multiline
              rows={2}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 12.5 } }}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
          <Button
            onClick={() => setMonitoringModalOpen(false)}
            disabled={savingMonitoring}
            variant="outlined"
            sx={{ textTransform: 'none', fontWeight: 750, borderRadius: 2, color: '#64748b', borderColor: '#cbd5e1' }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={savingMonitoring ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            onClick={handleSaveMonitoring}
            disabled={savingMonitoring || !monitoringForm.file}
            sx={{
              borderRadius: 2.2,
              textTransform: 'none',
              fontWeight: 850,
              fontSize: 13,
              px: 3.5,
              py: 0.9,
              bgcolor: '#0284c7',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.28)',
              '&:hover': { bgcolor: '#0369a1' }
            }}
          >
            {savingMonitoring ? 'Radicando...' : 'Radicar Evidencia'}
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
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small"
              variant="outlined"
              color="primary"
              startIcon={<FolderSharedIcon sx={{ fontSize: 16 }} />}
              onClick={() => handleOpenActivityFolder(evidenceItem)}
              sx={{ textTransform: 'none', fontWeight: 800, fontSize: 11.5, borderRadius: 2 }}
            >
              Carpeta en Google Drive
            </Button>
            <IconButton
              aria-label="cerrar"
              onClick={() => setEvidenceModalOpen(false)}
              size="small"
              sx={{ color: '#64748b' }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
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
                        {(ev.drive_file_id || ev.drive_url) && (
                          <>
                            <Typography variant="caption" sx={{ color: '#94a3b8' }}>•</Typography>
                            <Chip
                              size="small"
                              icon={<CloudDoneIcon sx={{ fontSize: '13px !important', color: '#16a34a !important' }} />}
                              label="En Google Drive"
                              sx={{ bgcolor: '#f0fdf4', color: '#166534', fontWeight: 750, fontSize: 10.5, height: 20 }}
                            />
                          </>
                        )}
                      </Stack>
                    </Box>
                  </Stack>

                  <Stack direction="row" spacing={1} sx={{ flexShrink: 0, alignSelf: { xs: 'flex-end', sm: 'center' } }}>
                    {(ev.drive_url || ev.drive_file_id) && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="success"
                        startIcon={<OpenInNewIcon sx={{ fontSize: 15 }} />}
                        onClick={() => handleOpenDriveUrl(ev.drive_url || `https://drive.google.com/file/d/${ev.drive_file_id}/view`)}
                        sx={{
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 800,
                          fontSize: 12,
                          bgcolor: '#f0fdf4',
                          borderColor: '#86efac',
                          color: '#15803d',
                          '&:hover': { bgcolor: '#dcfce7', borderColor: '#4ade80' }
                        }}
                      >
                        Ver en Drive
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      startIcon={<VisibilityIcon sx={{ fontSize: 15 }} />}
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
