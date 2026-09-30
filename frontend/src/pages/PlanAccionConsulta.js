import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box, Paper, Stack, Typography, Chip, Button, Alert,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  TextField, CircularProgress, Divider, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem,
  Grid
} from '@mui/material';
import {
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  Verified as VerifiedIcon,
  Refresh as RefreshIcon,
  ArrowBack as ArrowBackIcon,
  CalendarMonth as CalendarMonthIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Folder as FolderIcon,
  CloudUpload as CloudUploadIcon,
  WarningAmber as WarningIcon,
  EditNote as EditNoteIcon,
  AttachFile as AttachFileIcon,
  Description as DescriptionIcon,
  Send as SendIcon,
  Lock as LockIcon,
  InsertDriveFile as FileIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import strategicPlanningService from '../services/strategicPlanningService';
import planAccionWorkflowService, { ESTADOS_WORKFLOW } from '../services/planAccionWorkflowService';

const STATUS_CONFIG = {
  convocation: { label: 'Convocatoria', color: 'default', bg: '#f1f5f9', fg: '#475569' },
  meeting_scheduled: { label: 'Reunión Programada', color: 'info', bg: '#e0f2fe', fg: '#0369a1' },
  formulation: { label: 'En Formulación', color: 'info', bg: '#e0e7ff', fg: '#3730a3' },
  preliminary_minutes: { label: 'Acta Preliminar', color: 'warning', bg: '#fef3c7', fg: '#92400e' },
  technical_review: { label: 'Revisión Técnica', color: 'warning', bg: '#fef3c7', fg: '#92400e' },
  adjustments: { label: 'En Ajustes', color: 'error', bg: '#fee2e2', fg: '#991b1b' },
  owner_validation: { label: 'En Revisión / Firmas', color: 'warning', bg: '#fef3c7', fg: '#b45309' },
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

export default function PlanAccionConsulta() {
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const userId = authUser?.id;

  const [loading, setLoading] = useState(false);
  const [peiPlans, setPeiPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [legacyPlans, setLegacyPlans] = useState([]);

  // Modal de registro de avances y evidencias
  const [monitoringModalOpen, setMonitoringModalOpen] = useState(false);
  const [targetItem, setTargetItem] = useState(null);
  const [monitoringForm, setMonitoringForm] = useState({
    period_id: '',
    physical_progress: '',
    observations: '',
    file: null,
    description: ''
  });
  const [savingMonitoring, setSavingMonitoring] = useState(false);

  // Modal para solicitar ajustes a Planeación y Efectividad
  const [adjustmentsModalOpen, setAdjustmentsModalOpen] = useState(false);
  const [adjustmentComment, setAdjustmentComment] = useState('');
  const [sendingAdjustments, setSendingAdjustments] = useState(false);

  // Descarga de acta
  const [downloadingMinute, setDownloadingMinute] = useState(false);

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

  // Abrir modal de seguimiento para un ítem
  const handleOpenMonitoringModal = (item) => {
    setTargetItem(item);
    const periods = selectedPlan?.term?.monitoringPeriods || [];
    const defaultPeriodId = periods[0]?.id || '';
    // Buscar si ya existe resultado para este período
    const existingResult = (item.monitoringResults || []).find((r) => r.monitoring_period_id === defaultPeriodId);
    setMonitoringForm({
      period_id: defaultPeriodId,
      physical_progress: existingResult?.physical_progress ?? '',
      observations: existingResult?.observations ?? '',
      file: null,
      description: ''
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
      physical_progress: existingResult?.physical_progress ?? '',
      observations: existingResult?.observations ?? ''
    }));
  };

  // Guardar avance y subir evidencia
  const handleSaveMonitoring = async () => {
    if (!targetItem || !monitoringForm.period_id) {
      enqueueSnackbar('Seleccione el semestre del informe.', { variant: 'warning' });
      return;
    }
    setSavingMonitoring(true);
    try {
      // 1. Guardar avance de seguimiento
      if (monitoringForm.physical_progress !== '' || monitoringForm.observations) {
        await strategicPlanningService.saveMonitoring(targetItem.id, monitoringForm.period_id, {
          physical_progress: monitoringForm.physical_progress,
          observations: monitoringForm.observations,
          status: 'submitted'
        });
      }

      // 2. Si adjuntó archivo, subirlo como evidencia
      if (monitoringForm.file) {
        const formData = new FormData();
        formData.append('file', monitoringForm.file);
        formData.append('monitoring_period_id', monitoringForm.period_id);
        if (monitoringForm.description) {
          formData.append('description', monitoringForm.description);
        }
        await strategicPlanningService.uploadEvidence(targetItem.id, formData);
      }

      enqueueSnackbar('Avance y evidencia registrados correctamente.', { variant: 'success' });
      setMonitoringModalOpen(false);
      setTargetItem(null);
      await cargarPlanes();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Error al guardar el seguimiento o evidencia.';
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

  // Descargar acta oficial COM-IF-FR-002
  const handleDownloadMinute = async (minuteId) => {
    if (!minuteId) return;
    setDownloadingMinute(true);
    try {
      const blob = await strategicPlanningService.downloadMinutePdf(minuteId);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Acta_COM-IF-FR-002_${selectedPlan?.code || 'Plan'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      enqueueSnackbar('No se pudo descargar el acta en PDF.', { variant: 'error' });
    } finally {
      setDownloadingMinute(false);
    }
  };

  // Obtener enlace a Drive y última acta del plan seleccionado
  const { driveFolderUrl, latestMinute } = useMemo(() => {
    if (!selectedPlan) return {};
    let folderUrl = selectedPlan.drive_folder_url || null;
    let min = null;
    const meetings = selectedPlan.meetings || [];
    for (const m of meetings) {
      const versions = m.minuteVersions || [];
      if (versions.length > 0) {
        min = versions[0];
        if (min?.content?.drive_folder_url) folderUrl = min.content.drive_folder_url;
        break;
      }
    }
    return { driveFolderUrl: folderUrl, latestMinute: min };
  }, [selectedPlan]);

  // Períodos de monitoreo (S1 y S2)
  const periods = useMemo(() => {
    return selectedPlan?.term?.monitoringPeriods || [];
  }, [selectedPlan]);

  const periodS1 = periods.find((p) => p.code === 'S1') || periods[0] || null;
  const periodS2 = periods.find((p) => p.code === 'S2') || periods[1] || null;

  // Cálculos de métricas del plan seleccionado
  const planMetrics = useMemo(() => {
    if (!selectedPlan) return { totalActivities: 0, avgProgress: 0, totalEvidences: 0 };
    const items = selectedPlan.items || [];
    const totalActivities = items.length;
    let sumProgress = 0;
    let totalEvidences = 0;

    items.forEach((it) => {
      sumProgress += Number(it.current_progress || 0);
      totalEvidences += (it.evidence || []).length;
    });

    const avgProgress = totalActivities > 0 ? (sumProgress / totalActivities).toFixed(1) : '0';
    return { totalActivities, avgProgress, totalEvidences };
  }, [selectedPlan]);

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
                    Pendientes de Revisión y Firma ({pendingReviewPlans.length})
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
                            <Chip size="small" label="Requiere su revisión o firma" sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 800 }} />
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
                          Revisar y Validar Plan
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
  const items = selectedPlan.items || [];

  return (
    <Stack spacing={2.2}>
      {/* 1. Header con Navegación y Acciones Rápidas */}
      <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #dbeafe', bgcolor: '#ffffff' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
          <Stack direction="row" spacing={1.2} alignItems="center" flexWrap="wrap">
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => setSelectedPlan(null)}
              sx={{ textTransform: 'none', fontWeight: 800, color: '#1e3a8a' }}
            >
              Volver a Mis Planes
            </Button>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Chip size="small" label={selectedPlan.code} sx={{ bgcolor: '#eef2ff', color: '#3730a3', fontWeight: 900 }} />
            <Chip
              size="small"
              label={STATUS_CONFIG[selectedPlan.status]?.label || selectedPlan.status}
              sx={{
                bgcolor: STATUS_CONFIG[selectedPlan.status]?.bg || '#f1f5f9',
                color: STATUS_CONFIG[selectedPlan.status]?.fg || '#334155',
                fontWeight: 900
              }}
            />
            <Chip
              size="small"
              icon={<CalendarMonthIcon sx={{ fontSize: 14 }} />}
              label={`Vigencia ${selectedPlan.term?.year || '—'}`}
              sx={{ bgcolor: '#f1f5f9', fontWeight: 700 }}
            />
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap">
            {driveFolderUrl && (
              <Button
                variant="outlined"
                color="primary"
                startIcon={<FolderIcon />}
                href={driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ borderRadius: 2.2, textTransform: 'none', fontWeight: 800 }}
              >
                Carpeta en Google Drive
              </Button>
            )}

            {latestMinute && (
              <Button
                variant="outlined"
                color="secondary"
                startIcon={downloadingMinute ? <CircularProgress size={16} /> : <DescriptionIcon />}
                disabled={downloadingMinute}
                onClick={() => handleDownloadMinute(latestMinute.id)}
                sx={{ borderRadius: 2.2, textTransform: 'none', fontWeight: 800 }}
              >
                Descargar Acta Oficial (PDF)
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* 2. Banner de Estado y Advertencia Institucional */}
      {isOwnerValidation ? (
        <Alert
          severity="warning"
          icon={<WarningIcon sx={{ fontSize: 28 }} />}
          sx={{ borderRadius: 3, border: '1px solid #f59e0b', bgcolor: '#fffbeb' }}
          action={
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<EditNoteIcon />}
                onClick={() => setAdjustmentsModalOpen(true)}
                sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2 }}
              >
                Solicitar Ajustes a Planeación
              </Button>
              {latestMinute && (
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={<VerifiedIcon />}
                  onClick={() => navigate(`/strategic-minutes/${latestMinute.id}/signing`)}
                  sx={{ textTransform: 'none', fontWeight: 900, borderRadius: 2, color: '#451a03' }}
                >
                  Firmar Acta COM-IF-FR-002
                </Button>
              )}
            </Stack>
          }
        >
          <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#92400e' }}>
            Plan de Acción formulado en etapa de validación y firmas
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#b45309', mt: 0.3 }}>
            Revise detenidamente las actividades concertadas y el Acta COM-IF-FR-002. Si tiene dudas o requiere modificaciones, pulse <strong>Solicitar Ajustes</strong> para devolver el plan a Planeación y Efectividad. Si todo está conforme, proceda a la firma del acta.
          </Typography>
        </Alert>
      ) : (
        <Alert
          severity="info"
          icon={<LockIcon sx={{ fontSize: 26, color: '#0284c7' }} />}
          sx={{ borderRadius: 3, border: '1px solid #bae6fd', bgcolor: '#f0f9ff' }}
        >
          <Typography sx={{ fontWeight: 900, fontSize: 15, color: '#0369a1' }}>
            Plan de Acción en Ejecución Oficial (Modo Solo Lectura)
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#0c4a6e', mt: 0.3 }}>
            Las actividades, metas e indicadores fueron concertados formalmente y se encuentran en firme mediante el Acta COM-IF-FR-002. <strong>Si requiere agregar, modificar o retirar una actividad del plan, debe solicitarlo a la Dirección de Planeación y Aseguramiento de la Calidad.</strong> Su función en esta etapa es registrar el avance físico semestral (%) y cargar las evidencias de cumplimiento de cada actividad.
          </Typography>
        </Alert>
      )}

      {/* 3. Métricas Rápidas */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
        <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Dependencia</Typography>
          <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#0f172a', mt: 0.3 }} noWrap title={selectedPlan.organizationalUnit?.name}>
            {selectedPlan.organizationalUnit?.name || '—'}
          </Typography>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Actividades Concertadas</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 900, color: '#1e3a8a', mt: 0.3 }}>
            {planMetrics.totalActivities}
          </Typography>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Avance Físico Promedio</Typography>
          <Stack direction="row" spacing={1} alignItems="center" mt={0.3}>
            <Typography sx={{ fontSize: 22, fontWeight: 900, color: '#059669' }}>
              {planMetrics.avgProgress}%
            </Typography>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Evidencias Adjuntas</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 900, color: '#7c3aed', mt: 0.3 }}>
            {planMetrics.totalEvidences} archivos
          </Typography>
        </Paper>
      </Box>

      {/* 4. Tabla de Actividades y Evidencias de Cumplimiento */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden', bgcolor: '#fff' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                Actividades y Evidencias de Cumplimiento
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: '#64748b' }}>
                Diligencie los avances de Semestre 1 (S1) y Semestre 2 (S2), y adjunte los soportes documentales correspondientes.
              </Typography>
            </Box>
          </Stack>
        </Box>

        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ bgcolor: '#f1f5f9', fontWeight: 900, width: 85 }}>Código</TableCell>
                <TableCell sx={{ bgcolor: '#f1f5f9', fontWeight: 900, minWidth: 260 }}>Actividad Concertada</TableCell>
                <TableCell sx={{ bgcolor: '#f1f5f9', fontWeight: 900, minWidth: 200 }}>Indicador y Meta</TableCell>
                <TableCell sx={{ bgcolor: '#f1f5f9', fontWeight: 900, minWidth: 140 }}>Plazo (Fechas)</TableCell>
                <TableCell sx={{ bgcolor: '#f1f5f9', fontWeight: 900, minWidth: 130 }} align="center">Avance S1</TableCell>
                <TableCell sx={{ bgcolor: '#f1f5f9', fontWeight: 900, minWidth: 130 }} align="center">Avance S2</TableCell>
                <TableCell sx={{ bgcolor: '#f1f5f9', fontWeight: 900, minWidth: 130 }} align="center">Evidencias</TableCell>
                <TableCell sx={{ bgcolor: '#f1f5f9', fontWeight: 900, minWidth: 170 }} align="center">Acción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4, color: '#64748b' }}>
                    No hay actividades registradas en este plan.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((it) => {
                  const s1Result = (it.monitoringResults || []).find((r) => r.monitoring_period_id === periodS1?.id);
                  const s2Result = (it.monitoringResults || []).find((r) => r.monitoring_period_id === periodS2?.id);
                  const evidences = it.evidence || [];

                  return (
                    <TableRow key={it.id} hover sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                      {/* Código */}
                      <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                        <Chip size="small" label={it.code || '—'} sx={{ fontWeight: 900, bgcolor: '#e2e8f0', fontSize: 11 }} />
                      </TableCell>

                      {/* Actividad */}
                      <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', lineHeight: 1.35 }}>
                          {it.activity}
                        </Typography>
                        {it.macroactivity && (
                          <Typography sx={{ fontSize: 11, color: '#64748b', mt: 0.4 }}>
                            PED: {it.macroactivity}
                          </Typography>
                        )}
                      </TableCell>

                      {/* Indicador y Meta */}
                      <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>
                          {it.indicator || 'Sin indicador'}
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: '#64748b' }}>
                          Meta: <strong>{it.target || '—'}</strong>
                        </Typography>
                      </TableCell>

                      {/* Fechas */}
                      <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                        <Typography sx={{ fontSize: 11.5, color: '#334155' }}>
                          {formatFecha(it.starts_on)} al {formatFecha(it.ends_on)}
                        </Typography>
                      </TableCell>

                      {/* Avance S1 */}
                      <TableCell align="center" sx={{ verticalAlign: 'top', pt: 1.5 }}>
                        {s1Result ? (
                          <Tooltip title={s1Result.observations || 'Sin observaciones'} arrow>
                            <Chip
                              size="small"
                              label={`${s1Result.physical_progress || 0}%`}
                              sx={{
                                fontWeight: 900,
                                bgcolor: Number(s1Result.physical_progress) >= 100 ? '#dcfce7' : '#fef3c7',
                                color: Number(s1Result.physical_progress) >= 100 ? '#15803d' : '#b45309'
                              }}
                            />
                          </Tooltip>
                        ) : (
                          <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>—</Typography>
                        )}
                      </TableCell>

                      {/* Avance S2 */}
                      <TableCell align="center" sx={{ verticalAlign: 'top', pt: 1.5 }}>
                        {s2Result ? (
                          <Tooltip title={s2Result.observations || 'Sin observaciones'} arrow>
                            <Chip
                              size="small"
                              label={`${s2Result.physical_progress || 0}%`}
                              sx={{
                                fontWeight: 900,
                                bgcolor: Number(s2Result.physical_progress) >= 100 ? '#dcfce7' : '#fef3c7',
                                color: Number(s2Result.physical_progress) >= 100 ? '#15803d' : '#b45309'
                              }}
                            />
                          </Tooltip>
                        ) : (
                          <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>—</Typography>
                        )}
                      </TableCell>

                      {/* Evidencias */}
                      <TableCell align="center" sx={{ verticalAlign: 'top', pt: 1.5 }}>
                        {evidences.length > 0 ? (
                          <Tooltip
                            title={
                              <Box>
                                <Typography sx={{ fontSize: 11, fontWeight: 800 }}>Archivos adjuntos:</Typography>
                                {evidences.map((ev) => (
                                  <Typography key={ev.id} sx={{ fontSize: 10.5 }}>
                                    • {ev.original_name} ({formatBytes(ev.size_bytes)})
                                  </Typography>
                                ))}
                              </Box>
                            }
                            arrow
                          >
                            <Chip
                              size="small"
                              icon={<AttachFileIcon sx={{ fontSize: 14 }} />}
                              label={`${evidences.length} arch.`}
                              sx={{ fontWeight: 800, bgcolor: '#e0e7ff', color: '#4338ca' }}
                            />
                          </Tooltip>
                        ) : (
                          <Typography sx={{ fontSize: 11.5, color: '#94a3b8' }}>Sin soportes</Typography>
                        )}
                      </TableCell>

                      {/* Acciones */}
                      <TableCell align="center" sx={{ verticalAlign: 'top', pt: 1.2 }}>
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          startIcon={<CloudUploadIcon />}
                          onClick={() => handleOpenMonitoringModal(it)}
                          sx={{
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 800,
                            fontSize: 12,
                            bgcolor: '#2563eb',
                            '&:hover': { bgcolor: '#1d4ed8' }
                          }}
                        >
                          Cargar Avance / Evidencia
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
          MODAL: REGISTRAR AVANCE Y EVIDENCIA
         ========================================== */}
      <Dialog
        open={monitoringModalOpen}
        onClose={() => !savingMonitoring && setMonitoringModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3.5 } }}
      >
        <DialogTitle sx={{ px: 3, pt: 3, pb: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center' }}>
              <CloudUploadIcon />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                Registrar Avance y Evidencias de Cumplimiento
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: '#64748b' }}>
                Actividad: <strong>{targetItem?.code}</strong> · {targetItem?.activity}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ px: 3, py: 2 }}>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            {/* Recordatorio de Meta */}
            <Paper variant="outlined" sx={{ p: 1.8, borderRadius: 2.5, bgcolor: '#f8fafc', borderColor: '#e2e8f0' }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Indicador</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>{targetItem?.indicator || '—'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Meta Concertada</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#059669' }}>{targetItem?.target || '—'}</Typography>
                </Grid>
              </Grid>
            </Paper>

            {/* Selector de Período y Avance */}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  size="small"
                  label="Semestre del Informe *"
                  value={monitoringForm.period_id}
                  onChange={(e) => handlePeriodChange(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.2 } }}
                >
                  {periods.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  inputProps={{ min: 0, max: 100 }}
                  label="Avance Físico Alcanzado (%) *"
                  value={monitoringForm.physical_progress}
                  onChange={(e) => setMonitoringForm({ ...monitoringForm, physical_progress: e.target.value })}
                  placeholder="Ej: 50"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.2 } }}
                />
              </Grid>
            </Grid>

            {/* Observaciones y Logros */}
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Observaciones y Logros Cualitativos del Semestre"
              placeholder="Describa el resultado de las acciones realizadas, logros clave, aspectos por mejorar o justificación del avance..."
              value={monitoringForm.observations}
              onChange={(e) => setMonitoringForm({ ...monitoringForm, observations: e.target.value })}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}
            />

            {/* Subida de Evidencia */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, bgcolor: '#f0fdf4', borderColor: '#bbf7d0' }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: '#166534', mb: 1.2 }}>
                Adjuntar Soporte / Evidencia Documental
              </Typography>
              <Stack spacing={1.5}>
                <Button
                  component="label"
                  variant="outlined"
                  color="success"
                  startIcon={<CloudUploadIcon />}
                  sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2 }}
                >
                  {monitoringForm.file ? monitoringForm.file.name : 'Seleccionar Archivo (PDF, Excel, Word, ZIP, Imagen)'}
                  <input
                    hidden
                    type="file"
                    onChange={(e) => setMonitoringForm({ ...monitoringForm, file: e.target.files?.[0] || null })}
                  />
                </Button>

                {monitoringForm.file && (
                  <TextField
                    fullWidth
                    size="small"
                    label="Descripción de la Evidencia Adjunta"
                    placeholder="Ej: Lista de asistencia del taller y registro fotográfico"
                    value={monitoringForm.description}
                    onChange={(e) => setMonitoringForm({ ...monitoringForm, description: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.2, bgcolor: '#fff' } }}
                  />
                )}
              </Stack>
            </Paper>

            {/* Lista de Evidencias ya cargadas en este ítem */}
            {targetItem && (targetItem.evidence || []).length > 0 && (
              <Box>
                <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: '#475569', mb: 0.8 }}>
                  Evidencias registradas anteriormente en esta actividad:
                </Typography>
                <Stack spacing={0.8}>
                  {(targetItem.evidence || []).map((ev) => (
                    <Paper
                      key={ev.id}
                      variant="outlined"
                      sx={{ p: 1.2, px: 1.8, borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ minWidth: 0 }}>
                        <FileIcon sx={{ color: '#2563eb', fontSize: 20 }} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }} noWrap>
                            {ev.original_name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b' }}>
                            {formatBytes(ev.size_bytes)} · {formatFecha(ev.created_at)}
                          </Typography>
                        </Box>
                      </Stack>
                      <Button
                        size="small"
                        startIcon={<DownloadIcon />}
                        href={`/api/strategic-planning/evidence/${ev.id}/download`}
                        target="_blank"
                        sx={{ textTransform: 'none', fontWeight: 800, fontSize: 11.5 }}
                      >
                        Descargar
                      </Button>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          <Button
            onClick={() => setMonitoringModalOpen(false)}
            disabled={savingMonitoring}
            sx={{ textTransform: 'none', fontWeight: 800 }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={savingMonitoring ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            onClick={handleSaveMonitoring}
            disabled={savingMonitoring}
            sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900, px: 3, bgcolor: '#2563eb' }}
          >
            {savingMonitoring ? 'Guardando...' : 'Guardar Avance y Evidencia'}
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
    </Stack>
  );
}
