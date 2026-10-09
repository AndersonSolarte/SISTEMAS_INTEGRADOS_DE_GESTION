import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, Menu, MenuItem, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography
} from '@mui/material';
import {
  Add, ArrowBack, ArrowForward, CalendarMonth, Close, ContentCopy, DeleteOutline, Download, EditNote, Email, PersonSearch,
  HelpOutline, QrCode2, Refresh, Save, Send, ViewSidebar, Visibility
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import meetingMinuteService from '../../services/meetingMinuteService';
import logoFormatos from '../../assets/logo_formatos.jpg';
import RichTextEditor, { sanitizeRichHtml } from './RichTextEditor';
import MeetingCalendarScheduler from './MeetingCalendarScheduler';
import formatPersonName from '../../utils/formatPersonName';

const localDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const currentLocalTime = (date = new Date()) => (
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
);
const today = () => localDate();
const formatDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || '';
};
const formatSentenceCase = (value) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const letters = text.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
  if (letters && letters === letters.toLocaleUpperCase('es')) {
    const lower = text.toLocaleLowerCase('es');
    return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1);
  }
  return text;
};
const MEETING_PLACES = [
  'Sala de Rectoría',
  'Salón H201F',
  'Sala Bellina',
  'Sala de Juntas San Damián',
  'Sala de Juntas Campus San Damián'
];
const normalizePlaceSearch = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();
const filterMeetingPlaces = (options, { inputValue }) => {
  const words = normalizePlaceSearch(inputValue).split(/\s+/).filter(Boolean);
  if (!words.length) return options;
  return options.filter((option) => {
    const normalized = normalizePlaceSearch(option);
    return words.every((word) => normalized.includes(word));
  });
};
const emptyForm = (user = {}) => ({
  id: '', code: '', status: 'draft', created_by: user.id || '', revision_required: false, titulo: '', responsables: '', dependencia: '',
  responsable_document: '', responsable_role: '', responsables_data: [],
  lugar: '', fecha: today(), hora_inicio: currentLocalTime(), hora_fin: '10:00',
  objetivo: '', desarrollo: '', conclusiones: '', participants: []
});

const formatResponsablesText = (list = []) => {
  if (!list || !list.length) return '';
  if (list.length === 1) {
    const r = list[0];
    const name = formatPersonName(r.name);
    const details = [r.role_title, r.organization].filter(Boolean).join(' · ');
    return details ? `${name} (${details})` : name;
  }
  return list.map((r) => {
    const details = [r.role_title, r.organization].filter(Boolean).join(' · ');
    return `• ${formatPersonName(r.name)}${details ? ` (${details})` : ''}`;
  }).join('\n');
};

const loadResponsablesFromMinute = (content = {}) => {
  if (Array.isArray(content.responsables_data) && content.responsables_data.length > 0) {
    return content.responsables_data.map((r, i) => ({
      user_id: r.user_id || null,
      document: r.document || '',
      name: formatPersonName(r.name || ''),
      email: r.email || '',
      organization: r.organization || '',
      role_title: r.role_title || '',
      is_primary: i === 0 || Boolean(r.is_primary)
    }));
  }
  if (content.responsable_document || content.responsables) {
    return [{
      user_id: null,
      document: content.responsable_document || '',
      name: formatPersonName(content.responsables || ''),
      email: '',
      organization: content.dependencia || '',
      role_title: content.responsable_role || '',
      is_primary: true
    }];
  }
  return [];
};

const syncParticipantsWithResponsables = (currentParticipants = [], newResponsables = []) => {
  const respDocs = new Set(newResponsables.map((r) => String(r.document || '').trim().toLowerCase()).filter(Boolean));
  const respEmails = new Set(newResponsables.map((r) => String(r.email || '').trim().toLowerCase()).filter(Boolean));

  const respParticipants = newResponsables.map((r, idx) => {
    const doc = String(r.document || '').trim().toLowerCase();
    const email = String(r.email || '').trim().toLowerCase();
    const existing = currentParticipants.find((p) =>
      (doc && String(p.document || '').trim().toLowerCase() === doc) ||
      (email && String(p.email || '').trim().toLowerCase() === email)
    );
    return {
      id: existing?.id || undefined,
      user_id: r.user_id || existing?.user_id || null,
      document: r.document || existing?.document || '',
      // Si la persona ya estaba en participantes, se promueve el mismo registro.
      // Sus datos editados no deben desaparecer al asignarla como responsable.
      name: formatPersonName(existing?.name || r.name || ''),
      email: existing?.email || r.email || '',
      organization: existing?.organization || r.organization || '',
      role_title: existing?.role_title || r.role_title || (idx === 0 ? 'Responsable Principal' : 'Co-responsable'),
      status: existing?.status || 'invited'
    };
  });

  const nonRespParticipants = currentParticipants.filter((p) => {
    const pDoc = String(p.document || '').trim().toLowerCase();
    const pEmail = String(p.email || '').trim().toLowerCase();
    return !(pDoc && respDocs.has(pDoc)) && !(pEmail && respEmails.has(pEmail));
  });

  return [...respParticipants, ...nonRespParticipants];
};

const MeetingPreview = ({ document, form, signatures = [], previewType = 'original' }) => {
  const signed = new Set(signatures.map((signature) => String(signature.participant_id)));
  const signatureByParticipant = new Map(signatures.map((signature) => [String(signature.participant_id), signature]));
  const cell = { px: 0.8, py: 0.65, borderBottom: '1px solid #111', fontSize: 11.5 };
  const responsablesArray = (Array.isArray(form.responsables_data) && form.responsables_data.length > 0)
    ? form.responsables_data
    : (typeof form.responsables === 'string' && form.responsables.trim()
      ? form.responsables.split('\n').map((l) => l.replace(/^[•*\s-]+/, '').trim()).filter(Boolean).map((line, idx) => {
        const match = line.match(/^([^(]+)(?:\((.*)\))?$/);
        return { name: match ? match[1].trim() : line, role_title: match ? (match[2] || '').trim() : '', is_primary: idx === 0 };
      })
      : []);

  return (
    <Box sx={{ border: '1px solid #111', bgcolor: '#fff', color: '#111', fontFamily: 'Arial, sans-serif', minWidth: 650 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '22% 56% 22%', minHeight: 82, borderBottom: '1px solid #111' }}>
        <Box sx={{ borderRight: '1px solid #111', p: 0.75, display: 'grid', placeItems: 'center' }}><Box component="img" src={logoFormatos} alt="Universidad CESMAG" sx={{ maxWidth: '95%', maxHeight: 65 }} /></Box>
        <Box sx={{ borderRight: '1px solid #111', display: 'grid', placeItems: 'center', textAlign: 'center', fontWeight: 900 }}>REGISTRO DE ASISTENCIA Y REUNIÓN</Box>
        <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', fontWeight: 800, fontSize: 10 }}>
          <span>CÓDIGO: {document?.codigo || 'COM-ID-FR-002'}</span><span>VERSIÓN: {document?.version || '1'}</span><span>FECHA: {formatDate(document?.fecha_creacion)}</span>
        </Box>
      </Box>
      <Box sx={{ ...cell, py: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
          <strong>Responsable(s):</strong>
          {responsablesArray.length > 1 && (
            <Box component="span" sx={{ fontSize: 10, color: '#334155', fontWeight: 800, bgcolor: '#f1f5f9', px: 0.8, py: 0.2, borderRadius: 1 }}>
              {responsablesArray.length} asignados
            </Box>
          )}
        </Box>
        {responsablesArray.length === 0 ? (
          <Box sx={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', pl: 0.5 }}>
            (Sin responsables asignados)
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: responsablesArray.length > 1 ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr',
              gap: 1
            }}
          >
            {responsablesArray.map((r, i) => {
              const isPrimary = Boolean(r.is_primary) || i === 0;
              const roleOrg = [r.role_title, r.organization].map(formatSentenceCase).filter(Boolean).join(' · ');
              return (
                <Box
                  key={i}
                  sx={{
                    border: '1px solid #cbd5e1',
                    borderRadius: 1.5,
                    bgcolor: isPrimary ? '#f8fafc' : '#ffffff',
                    p: 0.85,
                    borderLeft: isPrimary ? '4px solid #1e3a8a' : '4px solid #64748b'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
                    <Box
                      component="span"
                      sx={{
                        fontSize: 9.5,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        color: isPrimary ? '#1e3a8a' : '#475569'
                      }}
                    >
                      {isPrimary ? 'Responsable Principal' : 'Co-responsable'}
                    </Box>
                  </Box>
                  <Box sx={{ fontSize: 11.5, fontWeight: 850, color: '#0f172a' }}>
                    {formatPersonName(r.name)}
                  </Box>
                  {roleOrg && (
                    <Box sx={{ fontSize: 10.5, color: '#475569', mt: 0.2 }}>
                      {roleOrg}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
      <Box sx={cell}><strong>Dependencia que cita:</strong> {form.dependencia}</Box>
      <Box sx={{ ...cell, bgcolor: '#d9d9d9', textAlign: 'center', fontWeight: 900 }}>Información de la Reunión</Box>
      <Box sx={cell}><strong>Lugar:</strong> {form.lugar}</Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', borderBottom: '1px solid #111' }}><Box sx={{ p: 0.8, borderRight: '1px solid #111' }}><strong>Fecha:</strong> {formatDate(form.fecha)}</Box><Box sx={{ p: 0.8 }}><strong>Horario:</strong> {form.hora_inicio} - {form.hora_fin}</Box></Box>
      <Box sx={{ ...cell, bgcolor: '#d9d9d9', textAlign: 'center', fontWeight: 900 }}>Participantes</Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '45px 1.5fr 1fr 150px', bgcolor: '#f2f2f2', borderBottom: '1px solid #111', fontWeight: 900, textAlign: 'center' }}><Box /><Box sx={{ p: 0.6, borderLeft: '1px solid #111' }}>Nombres y Apellidos</Box><Box sx={{ p: 0.6, borderLeft: '1px solid #111' }}>Cargo</Box><Box sx={{ p: 0.6, borderLeft: '1px solid #111' }}>Firma</Box></Box>
      {form.participants.map((participant, index) => {
        const signature = signatureByParticipant.get(String(participant.id));
        const isSigned = signed.has(String(participant.id)) || participant.status === 'signed';
        const roleLabel = [participant.organization, participant.role_title]
          .map(formatSentenceCase)
          .filter(Boolean)
          .join(' · ');
        const showGraphic = previewType !== 'copia' && Boolean(signature?.signature_preview);
        return (
          <Box key={participant.id || participant.user_id || index} sx={{ display: 'grid', gridTemplateColumns: '45px 1.5fr 1fr 150px', borderBottom: '1px solid #111', fontSize: 11.5, lineHeight: 1.35 }}>
            <Box sx={{ p: 0.6, textAlign: 'center', fontWeight: 800 }}>{index + 1}</Box>
            <Box sx={{ p: 0.6, borderLeft: '1px solid #111' }}>{formatPersonName(participant.name)}</Box>
            <Box sx={{ p: 0.6, borderLeft: '1px solid #111' }}>{roleLabel}</Box>
            <Box sx={{ minHeight: 42, p: 0.45, borderLeft: '1px solid #111', display: 'grid', placeItems: 'center', textAlign: 'center', color: isSigned ? '#15803d' : '#64748b', fontWeight: 800 }}>
              {showGraphic ? (
                <Box component="img" src={signature.signature_preview} alt={`Firma de ${formatPersonName(participant.name)}`} sx={{ width: '100%', height: 38, objectFit: 'contain' }} />
              ) : isSigned ? (
                <Box component="span" sx={{ color: '#166534', fontWeight: 900, fontSize: 11, letterSpacing: 0.3 }}>ORIGINAL FIRMADO</Box>
              ) : (
                'Pendiente · QR'
              )}
            </Box>
          </Box>
        );
      })}
      {['Objetivo', 'Desarrollo', 'Conclusiones / Compromisos'].map((title) => {
        const key = title === 'Objetivo' ? 'objetivo' : title === 'Desarrollo' ? 'desarrollo' : 'conclusiones';
        return <React.Fragment key={title}><Box sx={{ ...cell, bgcolor: '#d9d9d9', textAlign: 'center', fontWeight: 900 }}>{title}</Box><Box sx={{ p: 1, minHeight: key === 'objetivo' ? 62 : 90, fontSize: 11.5, '& p': { my: 0.3 }, '& h2, & h3': { my: 0.4 }, '& a': { color: '#1d5fd1', textDecoration: 'underline' }, '& blockquote': { my: 0.5, mx: 0, pl: 1, borderLeft: '3px solid #94a3b8' }, '& hr': { border: 0, borderTop: '1px solid #777' }, '& ul, & ol': { my: 0.4, pl: 2.5 }, '& table': { width: '100%', maxWidth: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', my: 0.5, boxSizing: 'border-box' }, '& th, & td': { border: '1px solid #555', p: 0.6, whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', verticalAlign: 'top', boxSizing: 'border-box' }, '& th': { bgcolor: '#f2f2f2' } }} dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(form[key]) }} /></React.Fragment>;
      })}
    </Box>
  );
};

export default function MeetingMinuteFormDialog({ open, document, user, onClose }) {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const [form, setForm] = useState(() => emptyForm(user));
  const [responsablesList, setResponsablesList] = useState([]);
  const [minutes, setMinutes] = useState([]);
  const [signatures, setSignatures] = useState([]);
  const [responsibleDocument, setResponsibleDocument] = useState('');
  const [responsibleCandidate, setResponsibleCandidate] = useState(null);
  const [responsibleOptions, setResponsibleOptions] = useState([]);
  const [responsibleSearchOpen, setResponsibleSearchOpen] = useState(false);
  const [searchingResponsible, setSearchingResponsible] = useState(false);
  const [externalDraft, setExternalDraft] = useState({ document: '', name: '', email: '', organization: '', role_title: '' });
  const [externalStudentResult, setExternalStudentResult] = useState(null);
  const [lookingUpExternalStudent, setLookingUpExternalStudent] = useState(false);
  const [participantSearchOptions, setParticipantSearchOptions] = useState([]);
  const [participantSearchOpen, setParticipantSearchOpen] = useState(false);
  const [searchingParticipant, setSearchingParticipant] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qr, setQr] = useState(null);
  const [confirmAdjust, setConfirmAdjust] = useState(false);
  const [minuteToDelete, setMinuteToDelete] = useState(null);
  const [downloadAnchorEl, setDownloadAnchorEl] = useState(null);
  const [layoutMode, setLayoutMode] = useState('split'); // 'split' | 'form' | 'preview'
  const [previewType] = useState('original'); // 'original' | 'copia'
  const [autoSaving, setAutoSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'pending' | 'saving' | 'error'
  const [fieldErrors, setFieldErrors] = useState({});
  const [meetingPlaceOptions, setMeetingPlaceOptions] = useState(MEETING_PLACES);
  const [loadingMeetingPlaces, setLoadingMeetingPlaces] = useState(false);
  // El sondeo remoto nunca debe reemplazar cambios que el usuario todavia no ha guardado.
  const hasUnsavedChangesRef = useRef(false);
  const localChangeVersionRef = useRef(0);
  const failedAutoSaveVersionRef = useRef(null);
  const saveRequestRef = useRef(null);
  const participantsDirtyRef = useRef(false);
  const participantGuidanceShownRef = useRef(false);
  const guideSnackbarKeyRef = useRef(null);
  const guideAnimationRef = useRef(null);
  const removedParticipantKeysRef = useRef(new Set());
  const locked = form.status !== 'draft';
  const allSigned = Boolean(form.participants.length) && form.participants.every((participant) => participant.status === 'signed');
  const pendingCount = useMemo(() => (form.participants || []).filter((p) => p.status !== 'signed').length, [form.participants]);

  const userDoc = String(user?.username || user?.documento || user?.cedula || user?.document || '').trim().toLowerCase();
  const userEmail = String(user?.email || '').trim().toLowerCase();
  const userId = Number(user?.id);

  const isCreator = Boolean(!form.id || (form.created_by && Number(form.created_by) === userId));
  const isResponsible = Boolean(
    (Array.isArray(responsablesList) && responsablesList.some((r) =>
      (userDoc && r.document && String(r.document).trim().toLowerCase() === userDoc) ||
      (userId && r.user_id && Number(r.user_id) === userId) ||
      (userEmail && r.email && String(r.email).trim().toLowerCase() === userEmail)
    )) ||
    (Array.isArray(form.responsables_data) && form.responsables_data.some((r) =>
      (userDoc && r.document && String(r.document).trim().toLowerCase() === userDoc) ||
      (userId && r.user_id && Number(r.user_id) === userId) ||
      (userEmail && r.email && String(r.email).trim().toLowerCase() === userEmail)
    )) ||
    (userDoc && form.responsable_document && String(form.responsable_document).trim().toLowerCase() === userDoc) ||
    (userEmail && form.responsable_email && String(form.responsable_email).trim().toLowerCase() === userEmail)
  );
  const isAdminUser = Boolean(
    user?.role === 'admin' ||
    user?.role === 'administrador' ||
    user?.isAdmin ||
    user?.is_admin ||
    user?.tipo_usuario === 'administrador'
  );
  // Mantener la misma regla del servidor: estar autenticado no concede por sí solo
  // permiso para modificar actas de otros usuarios.
  const canManageMinute = Boolean(!form.id || isCreator || isResponsible || isAdminUser);
  const canManageCalendar = Boolean(form.id && (isCreator || isResponsible || isAdminUser));
  const canRevise = Boolean(form.id && ['signing', 'signed'].includes(form.status) && isResponsible);
  const canEdit = Boolean(canManageMinute && !locked && (!form.revision_required || isResponsible));
  const showManualDraftSave = Boolean(canEdit && ['pending', 'error'].includes(saveStatus));
  const canManageParticipants = Boolean(canEdit && !form.revision_required);
  const canSendFinal = Boolean(isCreator || isResponsible || isAdminUser);

  const canDeleteMinute = (target) => {
    if (!target) return false;
    if (isAdminUser) return true;

    // Creator can delete
    if (target.created_by && Number(target.created_by) === userId) {
      return true;
    }

    // Primary responsible can delete
    const respData = Array.isArray(target.content?.responsables_data)
      ? target.content.responsables_data
      : (Array.isArray(target.responsables_data) ? target.responsables_data : []);
    const primary = respData.find((r) => r.is_primary) || respData[0];
    if (primary) {
      if (userDoc && primary.document && String(primary.document).trim().toLowerCase() === userDoc) return true;
      if (userId && primary.user_id && Number(primary.user_id) === userId) return true;
      if (userEmail && primary.email && String(primary.email).trim().toLowerCase() === userEmail) return true;
    }

    const singleDoc = target.content?.responsable_document || target.responsable_document;
    if (singleDoc && userDoc && String(singleDoc).trim().toLowerCase() === userDoc) {
      return true;
    }

    return false;
  };

  const handleRestoreAll = async () => {
    setLoading(true);
    try {
      const response = await meetingMinuteService.restoreAll();
      enqueueSnackbar(response.message || 'Actas restauradas.', { variant: 'success' });
      await loadMinutes();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible restaurar las actas.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const horario = useMemo(() => `${form.hora_inicio || ''} - ${form.hora_fin || ''}`, [form.hora_inicio, form.hora_fin]);
  const additionalParticipants = useMemo(() => {
    const respDocs = new Set((responsablesList || []).map((r) => String(r.document || '').trim().toLowerCase()).filter(Boolean));
    const respEmails = new Set((responsablesList || []).map((r) => String(r.email || '').trim().toLowerCase()).filter(Boolean));
    return (form.participants || []).filter((p) => {
      const pDoc = String(p.document || '').trim().toLowerCase();
      const pEmail = String(p.email || '').trim().toLowerCase();
      return !(pDoc && respDocs.has(pDoc)) && !(pEmail && respEmails.has(pEmail));
    });
  }, [form.participants, responsablesList]);

  const loadMinutes = async () => {
    try { const response = await meetingMinuteService.list(); setMinutes(response.data || []); } catch (_) { setMinutes([]); }
  };
  const loadMeetingPlaces = async () => {
    setLoadingMeetingPlaces(true);
    try {
      const response = await meetingMinuteService.listLocations();
      const locations = Array.isArray(response.data) ? response.data : [];
      setMeetingPlaceOptions(Array.from(new Set([...MEETING_PLACES, ...locations])));
    } catch (_) {
      setMeetingPlaceOptions(MEETING_PLACES);
    } finally {
      setLoadingMeetingPlaces(false);
    }
  };
  useEffect(() => {
    const query = responsibleDocument.trim();
    if (!open || !canManageParticipants || responsibleCandidate || query.length < 2) {
      setResponsibleOptions([]);
      setResponsibleSearchOpen(false);
      return undefined;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setSearchingResponsible(true);
      try {
        const response = await meetingMinuteService.searchParticipants(query);
        if (!active) return;
        const matches = Array.isArray(response.data) ? response.data : [];
        setResponsibleOptions(matches);
        setResponsibleSearchOpen(matches.length > 0);
      } catch (_) {
        if (!active) return;
        setResponsibleOptions([]);
        setResponsibleSearchOpen(false);
      } finally {
        if (active) setSearchingResponsible(false);
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, canManageParticipants, responsibleDocument, responsibleCandidate]);

  useEffect(() => {
    const query = String(externalDraft.document || '').trim();
    const isNameSearch = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(query);
    if (!open || !canManageParticipants || externalStudentResult?.found || !isNameSearch || query.length < 2) {
      setParticipantSearchOptions([]);
      setParticipantSearchOpen(false);
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setSearchingParticipant(true);
      try {
        const response = await meetingMinuteService.searchParticipants(query);
        if (!active) return;
        const matches = Array.isArray(response.data) ? response.data : [];
        setParticipantSearchOptions(matches);
        setParticipantSearchOpen(matches.length > 0);
      } catch (_) {
        if (!active) return;
        setParticipantSearchOptions([]);
        setParticipantSearchOpen(false);
      } finally {
        if (active) setSearchingParticipant(false);
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, canManageParticipants, externalDraft.document, externalStudentResult?.found]);

  useEffect(() => {
    if (!open) return;
    guideAnimationRef.current?.cancel?.();
    guideAnimationRef.current = null;
    if (guideSnackbarKeyRef.current) closeSnackbar(guideSnackbarKeyRef.current);
    guideSnackbarKeyRef.current = null;
    participantGuidanceShownRef.current = false;
    hasUnsavedChangesRef.current = false;
    localChangeVersionRef.current = 0;
    failedAutoSaveVersionRef.current = null;
    participantsDirtyRef.current = false;
    removedParticipantKeysRef.current.clear();
    setSaveStatus('saved');
    setFieldErrors({});
    setForm(emptyForm(user));
    setResponsablesList([]);
    setSignatures([]);
    setQr(null);
    setResponsibleDocument('');
    setResponsibleCandidate(null);
    setExternalStudentResult(null);
    setExternalDraft({ document: '', name: '', email: '', organization: '', role_title: '' });
    setParticipantSearchOptions([]);
    setParticipantSearchOpen(false);
    loadMinutes();
    loadMeetingPlaces();
  }, [open, user, closeSnackbar]);

  const markUnsavedChanges = ({ participants = false } = {}) => {
    hasUnsavedChangesRef.current = true;
    localChangeVersionRef.current += 1;
    failedAutoSaveVersionRef.current = null;
    if (participants) participantsDirtyRef.current = true;
    setSaveStatus('pending');
  };

  const setField = (key, value) => {
    markUnsavedChanges({ participants: key === 'participants' });
    setFieldErrors((previous) => previous[key] ? { ...previous, [key]: false } : previous);
    setForm((previous) => ({ ...previous, [key]: value }));
  };
  const openMinute = async (id) => {
    setFieldErrors({});
    participantGuidanceShownRef.current = false;
    guideAnimationRef.current?.cancel?.();
    guideAnimationRef.current = null;
    if (guideSnackbarKeyRef.current) closeSnackbar(guideSnackbarKeyRef.current);
    guideSnackbarKeyRef.current = null;
    setExternalStudentResult(null);
    if (!id) {
      hasUnsavedChangesRef.current = false;
      localChangeVersionRef.current = 0;
      failedAutoSaveVersionRef.current = null;
      participantsDirtyRef.current = false;
      removedParticipantKeysRef.current.clear();
      setSaveStatus('saved');
      setForm(emptyForm(user));
      setResponsablesList([]);
      setSignatures([]);
      setQr(null);
      setResponsibleDocument('');
      setResponsibleCandidate(null);
      return;
    }
    setLoading(true);
    try {
      const response = await meetingMinuteService.get(id);
      const row = response.data;
      const content = row.content || {};
      const [start = '', end = ''] = String(content.horario || '').split('-').map((part) => part.trim());
      const loadedResponsables = loadResponsablesFromMinute(content);
      hasUnsavedChangesRef.current = false;
      localChangeVersionRef.current = 0;
      failedAutoSaveVersionRef.current = null;
      participantsDirtyRef.current = false;
      removedParticipantKeysRef.current.clear();
      setSaveStatus('saved');
      setResponsablesList(loadedResponsables);
      const formattedText = content.responsables || formatResponsablesText(loadedResponsables);
      setForm({
        id: row.id,
        code: row.code,
        status: row.status,
        created_by: row.created_by,
        revision_required: Boolean(content._revision?.requires_resignature),
        titulo: content.titulo || '',
        responsables: formattedText,
        responsable_document: content.responsable_document || loadedResponsables[0]?.document || '',
        responsable_role: content.responsable_role || loadedResponsables[0]?.role_title || '',
        responsables_data: loadedResponsables,
        dependencia: content.dependencia || '',
        lugar: content.lugar || '',
        fecha: content.fecha || today(),
        hora_inicio: start || '08:00',
        hora_fin: end || '10:00',
        objetivo: content.objetivo?.[0] || '',
        desarrollo: content.desarrollo?.[0] || '',
        conclusiones: content.conclusiones?.[0] || '',
        participants: row.participants || []
      });
      setResponsibleDocument('');
      setResponsibleCandidate(null);
      setSignatures(row.signatures || []);
      setQr(null);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible abrir el acta.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Sincronización automática en tiempo real entre responsable y corresponsables
  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    const syncInterval = setInterval(async () => {
      if (!isMounted) return;

      // 1. Refrescar la lista de actas guardadas en segundo plano
      try {
        const listRes = await meetingMinuteService.list();
        if (isMounted && Array.isArray(listRes.data)) {
          setMinutes(listRes.data);
        }
      } catch (_) {}

      // 2. Si hay un acta seleccionada, sincronizar participantes, firmas y estado en vivo
      if (form.id && !loading) {
        try {
          const detailRes = await meetingMinuteService.get(form.id);
          const row = detailRes.data;
          if (isMounted && row && row.id === form.id) {
            if (Array.isArray(row.signatures)) {
              setSignatures(row.signatures);
            }
            if (Array.isArray(row.participants)) {
              setForm((prev) => {
                if (prev.id !== row.id) return prev;
                const rowContent = row.content || {};
                const loadedResp = loadResponsablesFromMinute(rowContent);
                const hasUnsavedChanges = hasUnsavedChangesRef.current;
                if (layoutMode === 'preview' && !hasUnsavedChanges) {
                  const [start = '', end = ''] = String(rowContent.horario || '').split('-').map((p) => p.trim());
                  return {
                    ...prev,
                    status: row.status,
                    revision_required: Boolean(rowContent._revision?.requires_resignature),
                    titulo: rowContent.titulo || '',
                    responsables: rowContent.responsables || formatResponsablesText(loadedResp),
                    responsable_document: rowContent.responsable_document || loadedResp[0]?.document || '',
                    responsable_role: rowContent.responsable_role || loadedResp[0]?.role_title || '',
                    responsables_data: loadedResp,
                    dependencia: rowContent.dependencia || prev.dependencia,
                    lugar: rowContent.lugar || prev.lugar,
                    fecha: rowContent.fecha || prev.fecha,
                    hora_inicio: start || prev.hora_inicio,
                    hora_fin: end || prev.hora_fin,
                    objetivo: rowContent.objetivo?.[0] || prev.objetivo,
                    desarrollo: rowContent.desarrollo?.[0] || prev.desarrollo,
                    conclusiones: rowContent.conclusiones?.[0] || prev.conclusiones,
                    participants: row.participants || []
                  };
                }
                return {
                  ...prev,
                  status: row.status,
                  revision_required: Boolean(rowContent._revision?.requires_resignature),
                  titulo: hasUnsavedChanges ? prev.titulo : (rowContent.titulo || ''),
                  // Si hay ediciones locales, el servidor aun no conoce participantes
                  // recien agregados o eliminados. Conservarlos evita que desaparezcan
                  // durante el sondeo de cinco segundos.
                  participants: hasUnsavedChanges ? prev.participants : (row.participants || prev.participants)
                };
              });
            }
          }
        } catch (_) {}
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(syncInterval);
    };
  }, [open, form.id, layoutMode, loading]);

  const lookupResponsible = async () => {
    if (!responsibleDocument.trim()) return;
    setSearchingResponsible(true);
    setResponsibleCandidate(null);
    try {
      const response = await meetingMinuteService.searchParticipants(responsibleDocument.trim());
      const matches = Array.isArray(response.data) ? response.data : [];
      setResponsibleOptions(matches);
      if (matches.length === 1) {
        setResponsibleCandidate(matches[0]);
        setResponsibleDocument(`${formatPersonName(matches[0].name)} · CC ${matches[0].document}`);
        setResponsibleSearchOpen(false);
      } else if (matches.length > 1) {
        setResponsibleSearchOpen(true);
      } else {
        enqueueSnackbar('No se encontraron personas activas con ese nombre o cédula.', { variant: 'info' });
      }
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No se encontró el responsable.', { variant: 'error' });
    } finally {
      setSearchingResponsible(false);
    }
  };

  const addResponsableCandidate = (isPrimary = false) => {
    if (!responsibleCandidate) return;
    const doc = String(responsibleCandidate.document || '').trim();
    if (responsablesList.some((r) => String(r.document || '').toLowerCase() === doc.toLowerCase())) {
      enqueueSnackbar('Esta persona ya está agregada como responsable.', { variant: 'info' });
      return;
    }

    const newResp = {
      user_id: responsibleCandidate.id || null,
      document: responsibleCandidate.document || '',
      name: formatPersonName(responsibleCandidate.name || ''),
      email: responsibleCandidate.email || '',
      organization: responsibleCandidate.organization || '',
      role_title: responsibleCandidate.role_title || '',
      is_primary: isPrimary || responsablesList.length === 0
    };

    let updatedList = [];
    if (newResp.is_primary) {
      updatedList = [newResp, ...responsablesList.map((r) => ({ ...r, is_primary: false }))];
    } else {
      updatedList = [...responsablesList, newResp];
    }

    const primaryResp = updatedList.find((r) => r.is_primary) || updatedList[0];
    const textFormatted = formatResponsablesText(updatedList);
    const updatedParticipants = syncParticipantsWithResponsables(form.participants, updatedList);

    markUnsavedChanges({ participants: true });
    setFieldErrors((previous) => ({ ...previous, responsables: false, dependencia: false, participants: false }));
    setResponsablesList(updatedList);
    setForm((prev) => ({
      ...prev,
      responsables: textFormatted,
      responsable_document: primaryResp?.document || '',
      responsable_role: primaryResp?.role_title || '',
      responsables_data: updatedList,
      dependencia: (isPrimary || !prev.dependencia) ? (primaryResp?.organization || prev.dependencia) : prev.dependencia,
      participants: updatedParticipants
    }));

    setResponsibleCandidate(null);
    setResponsibleDocument('');
    setResponsibleOptions([]);
    setResponsibleSearchOpen(false);
    enqueueSnackbar(newResp.is_primary ? 'Responsable Principal asignado.' : 'Co-responsable agregado.', { variant: 'success' });
  };

  const makePrimaryResponsable = (index) => {
    if (index < 0 || index >= responsablesList.length) return;
    const target = { ...responsablesList[index], is_primary: true };
    const others = responsablesList.filter((_, i) => i !== index).map((r) => ({ ...r, is_primary: false }));
    const updatedList = [target, ...others];
    const primaryResp = updatedList[0];
    const textFormatted = formatResponsablesText(updatedList);
    const updatedParticipants = syncParticipantsWithResponsables(form.participants, updatedList);

    markUnsavedChanges({ participants: true });
    setResponsablesList(updatedList);
    setForm((prev) => ({
      ...prev,
      responsables: textFormatted,
      responsable_document: primaryResp.document || '',
      responsable_role: primaryResp.role_title || '',
      responsables_data: updatedList,
      dependencia: primaryResp.organization || prev.dependencia,
      participants: updatedParticipants
    }));
    enqueueSnackbar(`${formatPersonName(primaryResp.name)} ahora es el Responsable Principal.`, { variant: 'info' });
  };

  const removeResponsable = (index) => {
    if (index < 0 || index >= responsablesList.length) return;
    const wasPrimary = responsablesList[index].is_primary;
    let remaining = responsablesList.filter((_, i) => i !== index);
    if (wasPrimary && remaining.length > 0) {
      remaining = remaining.map((r, i) => (i === 0 ? { ...r, is_primary: true } : r));
    }
    const primaryResp = remaining.find((r) => r.is_primary) || remaining[0];
    const textFormatted = formatResponsablesText(remaining);
    const updatedParticipants = syncParticipantsWithResponsables(form.participants, remaining);

    const removedResponsible = responsablesList[index];
    const removedDoc = String(removedResponsible?.document || '').trim().toLowerCase();
    const removedEmail = String(removedResponsible?.email || '').trim().toLowerCase();
    if (removedDoc) removedParticipantKeysRef.current.add(`doc:${removedDoc}`);
    if (removedEmail) removedParticipantKeysRef.current.add(`email:${removedEmail}`);
    markUnsavedChanges({ participants: true });
    setResponsablesList(remaining);
    setForm((prev) => ({
      ...prev,
      responsables: textFormatted,
      responsable_document: primaryResp?.document || '',
      responsable_role: primaryResp?.role_title || '',
      responsables_data: remaining,
      dependencia: wasPrimary && primaryResp ? (primaryResp.organization || prev.dependencia) : (remaining.length === 0 ? '' : prev.dependencia),
      participants: updatedParticipants
    }));
    enqueueSnackbar('Responsable removido.', { variant: 'info' });
  };

  const addExternalParticipant = () => {
    const external = Object.fromEntries(Object.entries(externalDraft).map(([key, value]) => [key, String(value || '').trim()]));
    if (!externalStudentResult || externalStudentResult.error) return enqueueSnackbar('Consulte primero la identificación para validar si pertenece a una persona institucional o estudiante.', { variant: 'warning' });
    if (!external.document || !external.name || !external.email || !external.role_title) return enqueueSnackbar('Complete cédula, nombre, correo y cargo.', { variant: 'warning' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(external.email)) return enqueueSnackbar('Digite un correo válido.', { variant: 'warning' });
    const normalizedDocument = external.document.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const normalizedEmail = external.email.toLowerCase();
    if (form.participants.some((participant) => (
      String(participant.document || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === normalizedDocument
      || String(participant.email || '').trim().toLowerCase() === normalizedEmail
    ))) return enqueueSnackbar('La persona ya está agregada.', { variant: 'info' });
    const isInstitutional = externalStudentResult.kind === 'institutional';
    setField('participants', [...form.participants, {
      ...external,
      name: formatPersonName(external.name),
      user_id: isInstitutional ? (externalStudentResult.institutionalId || null) : null,
      status: 'invited',
      external: !isInstitutional
    }]);
    setExternalDraft({ document: '', name: '', email: '', organization: '', role_title: '' });
    setExternalStudentResult(null);
    setParticipantSearchOptions([]);
    setParticipantSearchOpen(false);
  };

  const selectInstitutionalParticipant = async (person) => {
    if (!person) return;
    const normalizedDocument = String(person.document || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const normalizedEmail = String(person.email || '').trim().toLowerCase();
    const alreadyAdded = form.participants.some((participant) => (
      (person.id && String(participant.user_id) === String(person.id))
      || (normalizedDocument && String(participant.document || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === normalizedDocument)
      || (normalizedEmail && String(participant.email || '').trim().toLowerCase() === normalizedEmail)
    ));
    if (alreadyAdded) {
      setExternalDraft({ document: '', name: '', email: '', organization: '', role_title: '' });
      setExternalStudentResult(null);
      setParticipantSearchOptions([]);
      setParticipantSearchOpen(false);
      enqueueSnackbar('La persona institucional ya está agregada al acta.', { variant: 'info' });
      return;
    }
    setParticipantSearchOptions([]);
    setParticipantSearchOpen(false);
    setExternalDraft({
      document: person.document || '',
      name: person.name || '',
      email: person.email || '',
      organization: person.organization || '',
      role_title: person.role_title || ''
    });
    setExternalStudentResult({
      found: true,
      kind: 'institutional',
      institutionalId: person.id || null,
      missingEmail: !person.email,
      institutionalProfile: person,
      studentOptions: []
    });
    setLookingUpExternalStudent(true);

    let institutionalProfile = person;
    let studentOptions = [];
    try {
      const response = await meetingMinuteService.lookupEnrolledStudent(person.document);
      if (response?.found && ['institutional', 'dual'].includes(response.kind) && response.data) {
        institutionalProfile = response.data;
        studentOptions = Array.isArray(response.student_options) ? response.student_options : [];
      }
    } catch (_) {
      // La búsqueda por nombre ya validó al usuario interno. Si Matriculados no
      // está disponible, se conserva esa vinculación y se permite continuar.
    } finally {
      setLookingUpExternalStudent(false);
    }

    setExternalDraft({
      document: institutionalProfile.document || person.document || '',
      name: institutionalProfile.name || person.name || '',
      email: institutionalProfile.email || person.email || '',
      organization: institutionalProfile.organization || person.organization || '',
      role_title: institutionalProfile.role_title || person.role_title || ''
    });
    setExternalStudentResult({
      found: true,
      kind: 'institutional',
      institutionalId: institutionalProfile.id || person.id || null,
      alsoStudent: studentOptions.length > 0,
      missingEmail: !(institutionalProfile.email || person.email),
      institutionalProfile,
      studentOptions
    });
    enqueueSnackbar(
      studentOptions.length > 0
        ? 'La persona aparece como colaborador institucional y estudiante. Seleccione cómo participa en esta acta.'
        : 'Datos institucionales precargados. Puede revisarlos antes de agregar la persona.',
      { variant: 'success' }
    );
  };

  const searchParticipantInput = async () => {
    const query = String(externalDraft.document || '').trim();
    if (!query) return;
    const isNameSearch = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(query);
    if (!isNameSearch) {
      await lookupExternalStudent();
      return;
    }
    setSearchingParticipant(true);
    try {
      const response = await meetingMinuteService.searchParticipants(query);
      const matches = Array.isArray(response.data) ? response.data : [];
      setParticipantSearchOptions(matches);
      setParticipantSearchOpen(matches.length > 0);
      if (!matches.length) enqueueSnackbar('No se encontraron usuarios internos con ese nombre.', { variant: 'info' });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible buscar usuarios internos.', { variant: 'error' });
    } finally {
      setSearchingParticipant(false);
    }
  };

  const lookupExternalStudent = async () => {
    const document = String(externalDraft.document || '').trim();
    if (!document) {
      enqueueSnackbar('Digite la cédula o identificación de la persona.', { variant: 'warning' });
      return;
    }

    setLookingUpExternalStudent(true);
    setExternalStudentResult(null);
    try {
      const response = await meetingMinuteService.lookupEnrolledStudent(document);
      if (!response?.found || !response.data) {
        setExternalStudentResult({ found: false, kind: 'external' });
        enqueueSnackbar('No pertenece a usuarios institucionales ni aparece en Matriculados. Puede completar los datos como externo.', { variant: 'info' });
        return;
      }

      const person = response.data;
      if (response.kind === 'institutional' || response.kind === 'dual') {
        const normalizedDocument = String(person.document || document).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const normalizedEmail = String(person.email || '').trim().toLowerCase();
        const alreadyAdded = form.participants.some((participant) => (
          (person.id && String(participant.user_id) === String(person.id))
          || String(participant.document || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === normalizedDocument
          || String(participant.email || '').trim().toLowerCase() === normalizedEmail
        ));
        if (alreadyAdded) {
          setExternalDraft({ document: '', name: '', email: '', organization: '', role_title: '' });
          setExternalStudentResult(null);
          setParticipantSearchOptions([]);
          setParticipantSearchOpen(false);
          enqueueSnackbar('La persona institucional ya está agregada al acta.', { variant: 'info' });
          return;
        }

        setExternalDraft({
          document: person.document || document,
          name: person.name || '',
          email: person.email || '',
          organization: person.organization || '',
          role_title: person.role_title || ''
        });
        setExternalStudentResult({
          found: true,
          kind: 'institutional',
          institutionalId: person.id || null,
          alsoStudent: Boolean(response.also_student),
          missingEmail: !person.email,
          institutionalProfile: person,
          studentOptions: Array.isArray(response.student_options) ? response.student_options : []
        });
        enqueueSnackbar(
          response.also_student
            ? 'La persona aparece como institucional y estudiante. Seleccione cómo participa en esta acta.'
            : 'Datos institucionales precargados. Puede revisarlos y modificarlos antes de agregar la persona.',
          { variant: 'success' }
        );
        return;
      }

      const student = person;
      setExternalDraft({
        document: student.document || document,
        name: student.name || '',
        email: student.email || '',
        organization: student.organization || '',
        role_title: 'Estudiante'
      });
      setExternalStudentResult({
        found: true,
        kind: 'student',
        studentCode: student.student_code || '',
        program: student.program || '',
        academicPeriod: student.academic_period || '',
        hasEmail: Boolean(student.email),
        studentOptions: Array.isArray(response.student_options) ? response.student_options : [student]
      });
      enqueueSnackbar('Datos del estudiante precargados desde Matriculados.', { variant: 'success' });
    } catch (error) {
      setExternalStudentResult({ found: false, kind: 'unknown', error: true });
      enqueueSnackbar(error.response?.data?.message || 'No fue posible consultar la base de Matriculados.', { variant: 'error' });
    } finally {
      setLookingUpExternalStudent(false);
    }
  };

  const removeParticipant = (index) => {
    const p = form.participants[index];
    const pDoc = String(p?.document || '').toLowerCase();
    const pEmail = String(p?.email || '').toLowerCase();
    const respIdx = responsablesList.findIndex((r) =>
      (pDoc && String(r.document || '').toLowerCase() === pDoc) ||
      (pEmail && String(r.email || '').toLowerCase() === pEmail)
    );
    if (respIdx >= 0) {
      if (responsablesList[respIdx].is_primary && responsablesList.length === 1) {
        enqueueSnackbar('No puede eliminar al único Responsable Principal desde aquí. Modifíquelo en la sección 1.', { variant: 'warning' });
        return;
      }
      removeResponsable(respIdx);
      return;
    }
    if (pDoc) removedParticipantKeysRef.current.add(`doc:${pDoc}`);
    if (pEmail) removedParticipantKeysRef.current.add(`email:${pEmail}`);
    setField('participants', form.participants.filter((_, i) => i !== index));
  };

  const payload = () => ({
    id: form.id || undefined,
    documento_id: document.id,
    titulo: form.titulo,
    responsables: form.responsables,
    responsable_document: form.responsable_document,
    responsable_role: form.responsable_role,
    responsables_data: responsablesList,
    dependencia: form.dependencia,
    lugar: form.lugar,
    fecha: form.fecha,
    horario,
    objetivo: form.objetivo,
    desarrollo: form.desarrollo,
    conclusiones: form.conclusiones,
    participants: form.participants
  });

  const hasRichTextValue = (value) => Boolean(
    sanitizeRichHtml(value || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').trim()
  );

  // Un borrador representa cualquier avance del usuario. No debe exigir que el
  // acta este completa; esa validacion corresponde exclusivamente al envio.
  const hasSavableData = () => Boolean(
    form.id ||
    responsablesList.length ||
    String(form.titulo || '').trim() ||
    String(form.dependencia || '').trim() ||
    String(form.lugar || '').trim() ||
    String(form.fecha || '').trim() ||
    String(form.hora_inicio || '').trim() ||
    String(form.hora_fin || '').trim() ||
    hasRichTextValue(form.objetivo) ||
    hasRichTextValue(form.desarrollo) ||
    hasRichTextValue(form.conclusiones) ||
    form.participants.length
  );

  const validateRequiredFields = () => {
    return {
      responsables: !responsablesList.length || !String(form.responsables || '').trim(),
      titulo: !String(form.titulo || '').trim(),
      dependencia: !String(form.dependencia || '').trim(),
      lugar: !String(form.lugar || '').trim(),
      fecha: !String(form.fecha || '').trim(),
      hora_inicio: !String(form.hora_inicio || '').trim(),
      hora_fin: !String(form.hora_fin || '').trim(),
      objetivo: !hasRichTextValue(form.objetivo),
      desarrollo: !hasRichTextValue(form.desarrollo),
      conclusiones: !hasRichTextValue(form.conclusiones),
      participants: form.participants.length < 2
    };
  };

  useEffect(() => {
    if (!open || locked) return;
    if (form.participants.length < 2) {
      participantGuidanceShownRef.current = false;
      return;
    }
    if (participantGuidanceShownRef.current) return;
    participantGuidanceShownRef.current = true;
    const remainingErrors = validateRequiredFields();
    const readyToSend = !Object.entries(remainingErrors).some(([key, missing]) => key !== 'participants' && missing);
    if (guideSnackbarKeyRef.current) closeSnackbar(guideSnackbarKeyRef.current);
    guideSnackbarKeyRef.current = enqueueSnackbar(
      readyToSend
        ? 'Ya cuenta con al menos dos participantes. Si no agregará más personas, el acta está lista para enviar a firmas.'
        : 'Ya cuenta con el mínimo de dos participantes. Si no agregará más personas, continúe con los campos pendientes del acta.',
      { variant: readyToSend ? 'success' : 'info', autoHideDuration: 11000 }
    );
    // Se evalúa al cruzar el mínimo de participantes; los demás cambios no deben repetir el aviso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, locked, form.participants.length]);

  const focusFirstInvalidField = (errors) => {
    const order = [
      ['responsables', 'responsible-document-field'],
      ['titulo', 'meeting-titulo-field'],
      ['dependencia', 'meeting-dependencia-field'],
      ['lugar', 'meeting-lugar-field'],
      ['fecha', 'meeting-fecha-field'],
      ['hora_inicio', 'meeting-hora-inicio-field'],
      ['hora_fin', 'meeting-hora-fin-field'],
      ['objetivo', 'meeting-objetivo-field'],
      ['desarrollo', 'meeting-desarrollo-field'],
      ['conclusiones', 'meeting-conclusiones-field'],
      ['participants', 'meeting-participants-section']
    ];
    const targetId = order.find(([key]) => errors[key])?.[1];
    if (!targetId) return;
    if (layoutMode === 'preview') setLayoutMode('form');
    window.setTimeout(() => {
      const target = window.document.getElementById(targetId);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focusable = target.matches?.('input,textarea,[contenteditable="true"]')
        ? target
        : target.querySelector?.('input,textarea,[contenteditable="true"],button');
      focusable?.focus?.();
    }, 120);
  };

  const save = async ({ quiet = false, automatic = false } = {}) => {
    if (!canEdit) {
      if (!automatic) enqueueSnackbar('Esta acta está en modo consulta. Solo el creador, los responsables asignados o un administrador pueden editarla.', { variant: 'warning' });
      return null;
    }
    if (!hasSavableData()) {
      if (!automatic) enqueueSnackbar('Diligencie al menos un campo para guardar el borrador.', { variant: 'warning' });
      return null;
    }
    // Evita que dos autoguardados modifiquen simultaneamente los responsables
    // y participantes. Si habia una escritura en curso, el siguiente ciclo
    // guardara cualquier cambio que haya quedado pendiente.
    if (saveRequestRef.current) {
      if (automatic) return null;
      try { await saveRequestRef.current; } catch (_) {}
    }
    // Guardar un avance parcial no debe mostrar como errores los campos que aun
    // faltan. Se marcaran en rojo solamente al intentar enviar para firmas.
    setFieldErrors({});
    const changeVersionAtStart = localChangeVersionRef.current;
    const participantsChangedAtStart = participantsDirtyRef.current;
    const removedParticipantKeysAtStart = [...removedParticipantKeysRef.current];
    if (automatic) {
      setAutoSaving(true);
      setSaveStatus('saving');
    } else {
      setLoading(true);
    }
    try {
      const requestPayload = {
        ...payload(),
        autosave: automatic,
        participants_changed: participantsChangedAtStart,
        removed_participant_keys: removedParticipantKeysAtStart
      };
      const activeRequest = meetingMinuteService.save(requestPayload);
      saveRequestRef.current = activeRequest;
      const response = await activeRequest;
      if (saveRequestRef.current === activeRequest) saveRequestRef.current = null;
      const row = response.data;
      const noNewerLocalChanges = localChangeVersionRef.current === changeVersionAtStart;
      removedParticipantKeysAtStart.forEach((key) => removedParticipantKeysRef.current.delete(key));
      if (noNewerLocalChanges) {
        hasUnsavedChangesRef.current = false;
        failedAutoSaveVersionRef.current = null;
        participantsDirtyRef.current = false;
        setSaveStatus('saved');
      } else {
        setSaveStatus('pending');
      }
      setForm((previous) => ({
        ...previous,
        id: row.id,
        status: row.status,
        created_by: row.created_by || previous.created_by,
        revision_required: Boolean(row.content?._revision?.requires_resignature),
        // Una respuesta antigua no puede borrar cambios hechos mientras se guardaba.
        participants: noNewerLocalChanges ? (row.participants || previous.participants) : previous.participants
      }));
      await loadMinutes();
      if (!quiet) enqueueSnackbar(form.status === 'draft' ? 'Borrador del acta guardado.' : 'Cambios del acta guardados exitosamente.', { variant: 'success' });
      return row;
    } catch (error) {
      saveRequestRef.current = null;
      setSaveStatus('error');
      if (automatic) {
        failedAutoSaveVersionRef.current = changeVersionAtStart;
      }
      enqueueSnackbar(error.response?.data?.message || 'No fue posible guardar el acta.', { variant: 'error' });
      return null;
    } finally {
      if (automatic) setAutoSaving(false);
      else setLoading(false);
    }
  };

  // Guardado automático: agrupa la escritura durante una pausa breve y persiste
  // el acta sin exigir que el usuario pulse el botón de guardar.
  useEffect(() => {
    if (!open || !canEdit || !hasUnsavedChangesRef.current || loading || autoSaving) return undefined;
    if (failedAutoSaveVersionRef.current === localChangeVersionRef.current) return undefined;
    if (!hasSavableData()) return undefined;

    const timer = window.setTimeout(() => {
      save({ quiet: true, automatic: true });
    }, 900);
    return () => window.clearTimeout(timer);
    // `save` pertenece al mismo render que los datos incluidos arriba.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form, responsablesList, loading, autoSaving, canEdit]);

  const handleClose = async () => {
    if (loading || autoSaving) return;
    if (hasUnsavedChangesRef.current && hasSavableData()) {
      const saved = await save({ quiet: true, automatic: true });
      if (!saved) return;
    }
    onClose();
  };

  const publish = async () => {
    const validationErrors = validateRequiredFields();
    if (Object.values(validationErrors).some(Boolean)) {
      setFieldErrors(validationErrors);
      focusFirstInvalidField(validationErrors);
      enqueueSnackbar('Complete el acta antes de enviarla. Revise los campos marcados en rojo.', { variant: 'warning' });
      return;
    }
    const row = await save({ quiet: true });
    if (!row) return;
    setLoading(true);
    try {
      const response = await meetingMinuteService.publish(row.id, { public_base_url: window.location.origin });
      setQr(response.data);
      setForm((previous) => ({ ...previous, id: row.id, status: 'signing' }));
      await loadMinutes();
      enqueueSnackbar(response.message || 'Firmas habilitadas e invitaciones enviadas.', { variant: response.data?.invitations?.failed ? 'warning' : 'success' });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible habilitar las firmas.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };
  const resendInvitations = async () => {
    if (!form.id) return;
    setLoading(true);
    try {
      const response = await meetingMinuteService.resendInvitations(form.id, { public_base_url: window.location.origin });
      enqueueSnackbar(response.message || 'Invitaciones reenviadas.', { variant: response.data?.failed ? 'warning' : 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible reenviar las invitaciones.', { variant: 'error' }); }
    finally { setLoading(false); }
  };
  const showSigningAccess = async (regenerate = false) => {
    if (!form.id) return;
    setLoading(true);
    try {
      const shouldRegenerate = regenerate === true;
      const response = await meetingMinuteService.getSigningAccess(form.id, { public_base_url: window.location.origin, regenerate: shouldRegenerate });
      setQr(response.data);
      enqueueSnackbar(response.message || 'Acceso QR obtenido.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible recuperar el acceso de firma.', { variant: 'error' }); }
    finally { setLoading(false); }
  };
  const handleEditActaClick = () => {
    if (layoutMode === 'preview') {
      setLayoutMode('split');
    }
    const formPanel = window.document.getElementById('meeting-minute-form-panel');
    if (formPanel) {
      formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const firstTarget = formPanel.querySelector('input:not([disabled]), textarea:not([disabled]), [contenteditable="true"]');
      if (firstTarget) {
        firstTarget.focus();
      }
    }
    enqueueSnackbar('Modo edición activo. Los cambios se guardarán automáticamente mientras trabaja.', { variant: 'info' });
  };
  const reopenForEditing = async () => {
    if (!form.id) return;
    setLoading(true);
    try {
      const response = await meetingMinuteService.reopen(form.id);
      setConfirmAdjust(false); setQr(null); setSignatures([]);
      await openMinute(form.id); await loadMinutes();
      setLayoutMode('split');
      enqueueSnackbar(response.message || 'El acta regresó a borrador.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible habilitar los ajustes.', { variant: 'error' }); }
    finally { setLoading(false); }
  };
  const handleDeleteMinute = async () => {
    if (!minuteToDelete?.id) return;
    setLoading(true);
    try {
      const response = await meetingMinuteService.deleteMinute(minuteToDelete.id);
      enqueueSnackbar(response.message || 'Acta eliminada del sistema.', { variant: 'success' });
      if (form.id === minuteToDelete.id) {
        hasUnsavedChangesRef.current = false;
        localChangeVersionRef.current = 0;
        failedAutoSaveVersionRef.current = null;
        participantsDirtyRef.current = false;
        removedParticipantKeysRef.current.clear();
        setSaveStatus('saved');
        setForm(emptyForm(user));
        setResponsablesList([]);
        setSignatures([]);
        setQr(null);
        setResponsibleDocument('');
        setResponsibleCandidate(null);
        setExternalStudentResult(null);
      }
      setMinuteToDelete(null);
      await loadMinutes();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible eliminar el acta.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };
  const download = async (tipo = 'original') => {
    setDownloadAnchorEl(null);
    if (!form.id) return enqueueSnackbar('Guarde primero el borrador.', { variant: 'warning' });
    try {
      const isCopia = tipo === 'copia';
      const blob = await meetingMinuteService.downloadPdf(form.id, isCopia ? { tipo: 'copia' } : {});
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      const cleanTitle = (form.titulo || '')
        .replace(/[/\\?%*:|"<>]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60)
        .trim();
      const datePart = form.fecha || 'REUNION';
      const titleSuffix = cleanTitle ? ` - ${cleanTitle}` : '';
      const copySuffix = isCopia ? ' - COPIA' : '';
      anchor.download = `ACTA-${datePart}${titleSuffix}${copySuffix}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible descargar el acta.', { variant: 'error' });
    }
  };
  const sendFinal = async () => {
    if (!canSendFinal || !form.id) return;
    setLoading(true);
    try {
      const response = await meetingMinuteService.sendFinal(form.id);
      enqueueSnackbar(response.message || 'Acta firmada enviada a todos los participantes.', { variant: 'success' });
      await openMinute(form.id); await loadMinutes();
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible enviar el acta firmada.', { variant: 'error' }); }
    finally { setLoading(false); }
  };

  const guideErrors = validateRequiredFields();
  const guideSteps = [
    { key: 'responsables', label: 'Responsable Principal', target: 'responsible-document-field', instruction: 'Busque por nombre o cédula, seleccione la persona correcta y asígnela al acta.' },
    { key: 'titulo', label: 'Título corto', target: 'meeting-titulo-field', instruction: 'Escriba un nombre breve que permita identificar y encontrar fácilmente esta acta.' },
    { key: 'dependencia', label: 'Dependencia que cita', target: 'meeting-dependencia-field', instruction: 'Confirme o escriba la dependencia que está convocando la reunión.' },
    { key: 'lugar', label: 'Lugar', target: 'meeting-lugar-field', instruction: 'Seleccione una ubicación sugerida o escriba el lugar donde se realizará la reunión.' },
    { key: 'fecha', label: 'Fecha', target: 'meeting-fecha-field', instruction: 'Seleccione la fecha en que se realiza la reunión.' },
    { key: 'hora_inicio', label: 'Hora de inicio', target: 'meeting-hora-inicio-field', instruction: 'Indique la hora real de inicio de la reunión.' },
    { key: 'hora_fin', label: 'Hora de finalización', target: 'meeting-hora-fin-field', instruction: 'Indique la hora prevista o real de finalización.' },
    { key: 'objetivo', label: 'Objetivo', target: 'meeting-objetivo-field', instruction: 'Describa de manera concreta el propósito de la reunión.' },
    { key: 'desarrollo', label: 'Desarrollo', target: 'meeting-desarrollo-field', instruction: 'Registre los temas tratados y los aspectos relevantes de la reunión.' },
    { key: 'conclusiones', label: 'Conclusiones y compromisos', target: 'meeting-conclusiones-field', instruction: 'Registre las decisiones, responsables o compromisos acordados.' },
    { key: 'participants', label: 'Participantes', target: 'meeting-participants-section', instruction: 'Agregue como mínimo dos personas contando responsables y participantes convocados.' }
  ];
  const missingGuideSteps = guideSteps.filter(({ key }) => guideErrors[key]);
  const nextGuideStep = missingGuideSteps[0] || null;
  const guideInfo = form.status === 'draft'
    ? saveStatus === 'saving'
      ? { title: 'Guardando sus cambios', message: 'Espere un momento. El autoguardado está registrando el avance del acta.' }
      : missingGuideSteps.length
        ? {
            title: 'Continúe completando el acta',
            message: nextGuideStep.instruction,
            focusMissing: true
          }
        : { title: 'El acta está lista para firmas', message: 'Revise la vista previa y use “Habilitar y enviar invitaciones” en la parte superior.' }
    : ['signing', 'signed'].includes(form.status) && !allSigned
      ? { title: 'Firmas en proceso', message: `Actualice las firmas para consultar el avance. Aún hay ${pendingCount} firma${pendingCount === 1 ? '' : 's'} pendiente${pendingCount === 1 ? '' : 's'}; si es necesario puede reenviar las invitaciones desde la parte superior.` }
      : form.status === 'distributed'
        ? { title: 'Proceso finalizado', message: 'El acta firmada ya fue enviada a los participantes. Como paso final, descargue la copia oficial desde “Descargar PDF”. Después, si lo necesita, puede programar la siguiente sesión.' }
        : { title: 'Firmas completadas', message: 'Todos firmaron. Use “Enviar acta firmada” en la parte superior para distribuir la copia final.' };

  const followGuide = () => {
    if (guideSnackbarKeyRef.current) closeSnackbar(guideSnackbarKeyRef.current);
    guideSnackbarKeyRef.current = null;
    if (guideInfo.focusMissing && nextGuideStep) {
      setFieldErrors(guideErrors);
      focusFirstInvalidField(guideErrors);
      window.setTimeout(() => {
        const target = window.document.getElementById(nextGuideStep.target);
        if (!target) return;
        guideAnimationRef.current?.cancel?.();
        guideAnimationRef.current = target.animate?.([
          { boxShadow: '0 0 0 0 rgba(22,163,74,0)', transform: 'scale(1)' },
          { boxShadow: '0 0 0 8px rgba(22,163,74,0.28)', transform: 'scale(1.012)' },
          { boxShadow: '0 0 0 0 rgba(22,163,74,0)', transform: 'scale(1)' }
        ], { duration: 2200, iterations: 4, easing: 'ease-in-out' });
        guideSnackbarKeyRef.current = enqueueSnackbar(`Siguiente paso: ${nextGuideStep.instruction}`, { variant: 'success', autoHideDuration: 12000 });
      }, 260);
      return;
    }
    const targetId = form.status === 'draft'
      ? 'meeting-publish-button'
      : ['signing', 'signed'].includes(form.status) && !allSigned
        ? 'meeting-refresh-signatures-button'
        : allSigned && form.status !== 'distributed'
          ? 'meeting-send-final-button'
          : 'meeting-download-button';
    const target = window.document.getElementById(targetId);
    target?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    guideAnimationRef.current?.cancel?.();
    guideAnimationRef.current = target?.animate?.([
      { boxShadow: '0 0 0 0 rgba(22,163,74,0)', transform: 'scale(1)' },
      { boxShadow: '0 0 0 9px rgba(22,163,74,0.3)', transform: 'scale(1.025)' },
      { boxShadow: '0 0 0 0 rgba(22,163,74,0)', transform: 'scale(1)' }
    ], { duration: 2300, iterations: 4, easing: 'ease-in-out' });
    guideSnackbarKeyRef.current = enqueueSnackbar(guideInfo.message, { variant: 'success', autoHideDuration: 12000 });
  };

  return <>
    <Dialog open={open} onClose={handleClose} fullScreen PaperProps={{ sx: { bgcolor: '#f4f7fb', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}>
      <DialogTitle sx={{ px: { xs: 2, md: 4 }, py: 1.5, background: 'linear-gradient(135deg,#214c9c,#315ee8)', color: '#fff', flexShrink: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
          <Box>
            <Typography variant="h5" fontWeight={950}>Registro de Asistencia y Reunión</Typography>
            <Typography sx={{ opacity: .9, fontSize: 13 }}>{document?.codigo || 'COM-ID-FR-002'}</Typography>
          </Box>
          <Stack direction="row" alignItems="center" gap={1.5}>
            <ToggleButtonGroup
              value={layoutMode}
              exclusive
              onChange={(_, val) => val && setLayoutMode(val)}
              size="small"
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.35)',
                borderRadius: 2,
                '& .MuiToggleButton-root': {
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontWeight: 800,
                  fontSize: 12,
                  px: { xs: 1, sm: 1.5 },
                  py: 0.5,
                  textTransform: 'none',
                  border: 'none',
                  '&.Mui-selected': {
                    bgcolor: '#ffffff',
                    color: '#1d4ed8',
                    fontWeight: 900,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                    '&:hover': { bgcolor: '#f8fafc' }
                  },
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.25)',
                    color: '#fff'
                  }
                }
              }}
            >
              <ToggleButton value="form" title="Ocultar vista previa y expandir formulario">
                <EditNote sx={{ fontSize: 19, mr: { xs: 0, sm: 0.5 } }} />
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Formulario</Box>
              </ToggleButton>
              <ToggleButton value="split" title="Vista dividida (50/50)">
                <ViewSidebar sx={{ fontSize: 19, mr: { xs: 0, sm: 0.5 } }} />
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Dividido</Box>
              </ToggleButton>
              <ToggleButton value="preview" title="Ocultar formulario y expandir vista previa">
                <Visibility sx={{ fontSize: 19, mr: { xs: 0, sm: 0.5 } }} />
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Vista previa</Box>
              </ToggleButton>
            </ToggleButtonGroup>
            <IconButton disabled={loading || autoSaving} onClick={handleClose} sx={{ color: '#fff', border: '1px solid rgba(255,255,255,.5)', borderRadius: 2 }}><Close /></IconButton>
          </Stack>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ p: { xs: 1.5, md: 2.5 }, flex: 1, overflow: { xs: 'auto', lg: 'hidden' }, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 2.5, width: '100%', height: { lg: '100%' }, minHeight: 0, flex: 1 }}>
          <Stack
            id="meeting-minute-form-panel"
            gap={2}
            sx={{
              width: layoutMode === 'form' ? '100%' : { xs: '100%', lg: '47%' },
              maxWidth: layoutMode === 'form' ? '1250px' : 'none',
              mx: layoutMode === 'form' ? 'auto' : 0,
              height: { lg: '100%' },
              display: layoutMode === 'preview' ? 'none' : 'flex',
              overflowY: { lg: 'auto' },
              pr: { lg: 1.5 },
              // Barra de scroll ubicada al medio, ampliada y de fácil agarre
              '&::-webkit-scrollbar': {
                width: '14px'
              },
              '&::-webkit-scrollbar-track': {
                bgcolor: '#e2e8f0',
                borderRadius: '8px',
                border: '1px solid #cbd5e1'
              },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: '#475569',
                borderRadius: '8px',
                border: '2.5px solid #e2e8f0',
                '&:hover': {
                  bgcolor: '#1e293b'
                }
              },
              scrollbarWidth: 'auto',
              scrollbarColor: '#475569 #e2e8f0'
            }}
          >
            <Paper variant="outlined" sx={{
              p: 2.25,
              borderRadius: 3,
              borderColor: '#94a3b8',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#94a3b8', borderWidth: '1.5px' },
              '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#64748b' },
              '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: '2px' },
              '& .MuiOutlinedInput-root.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: '#dc2626', borderWidth: '2px' }
            }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1.5} mb={2}>
                <Typography fontWeight={900}>Actas de reunión</Typography>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Button variant="outlined" onClick={() => openMinute('')} sx={{ textTransform: 'none', fontWeight: 800 }}>Nueva acta</Button>
                  <Tooltip title={layoutMode === 'split' ? 'Expandir formulario a pantalla completa' : 'Restaurar vista dividida (50/50)'}>
                    <IconButton
                      size="small"
                      onClick={() => setLayoutMode(layoutMode === 'split' ? 'form' : 'split')}
                      sx={{
                        bgcolor: layoutMode === 'form' ? '#0f3a68' : '#e2e8f0',
                        color: layoutMode === 'form' ? '#fff' : '#1e293b',
                        border: '1px solid #cbd5e1',
                        borderRadius: 2,
                        width: 36,
                        height: 36,
                        '&:hover': {
                          bgcolor: layoutMode === 'form' ? '#0b2b4d' : '#cbd5e1'
                        }
                      }}
                    >
                      {layoutMode === 'split' ? <ArrowForward fontSize="small" /> : <ArrowBack fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
              <Stack direction="row" gap={1} alignItems="center">
                <TextField
                  fullWidth
                  select
                  size="small"
                  label="Abrir un acta guardada"
                  value={form.id}
                  onChange={(event) => openMinute(event.target.value)}
                  SelectProps={{
                    renderValue: (selected) => {
                      if (!selected) return 'Nueva acta';
                      const min = minutes.find((m) => m.id === selected);
                      if (!min) return 'Nueva acta';
                      const statusLabel = { draft: 'Borrador', signing: 'En firmas', signed: 'Firmada', distributed: 'Enviada' }[min.status] || min.status;
                      const shortTitle = String(min.content?.titulo || '').trim();
                      return `${shortTitle ? `${shortTitle} · ` : ''}${min.code} · ${min.content?.fecha || 'Sin fecha'} · ${statusLabel}`;
                    }
                  }}
                >
                  <MenuItem value="">
                    <em>+ Nueva acta</em>
                  </MenuItem>
                  {minutes.map((minute) => {
                    const canDelete = canDeleteMinute(minute);
                    const creatorLabel = minute.creator?.nombre
                      ? ` · Creada por: ${formatPersonName(minute.creator.nombre)}`
                      : '';
                    const statusLabel = { draft: 'Borrador', signing: 'En firmas', signed: 'Firmada', distributed: 'Enviada' }[minute.status] || minute.status;
                    const shortTitle = String(minute.content?.titulo || '').trim();
                    return (
                      <MenuItem
                        key={minute.id}
                        value={minute.id}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 1,
                          py: 0.85,
                          pr: 1
                        }}
                      >
                        <Box component="span" sx={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                          {shortTitle && (
                            <Typography component="span" display="block" fontSize={13} fontWeight={850} noWrap>
                              {shortTitle}
                            </Typography>
                          )}
                          <Typography component="span" display="block" variant="caption" color={shortTitle ? 'text.secondary' : 'text.primary'} noWrap>
                            {minute.code} · {minute.content?.fecha || 'Sin fecha'} · {statusLabel}{creatorLabel}
                          </Typography>
                        </Box>
                        {canDelete && (
                          <Tooltip title={`Eliminar acta ${minute.code}`}>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMinuteToDelete(minute);
                              }}
                              sx={{
                                color: '#ef4444',
                                p: 0.5,
                                borderRadius: 1.5,
                                '&:hover': { bgcolor: '#fee2e2', color: '#dc2626' }
                              }}
                            >
                              <DeleteOutline fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </MenuItem>
                    );
                  })}
                </TextField>
                {form.id && canDeleteMinute(form) && (
                  <Tooltip title={`Eliminar acta actual (${form.code || 'abierta'})`}>
                    <IconButton
                      color="error"
                      onClick={() => setMinuteToDelete({ id: form.id, code: form.code || 'esta acta', created_by: form.created_by, content: { responsable_document: form.responsable_document, responsables_data: form.responsables_data } })}
                      sx={{
                        border: '1px solid #fca5a5',
                        borderRadius: 2,
                        p: 0.85,
                        color: '#dc2626',
                        bgcolor: '#fff',
                        '&:hover': { bgcolor: '#fee2e2' }
                      }}
                    >
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {isAdminUser && (
                  <Tooltip title="Restaurar todas las actas del sistema">
                    <Button
                      size="small"
                      variant="outlined"
                      color="secondary"
                      onClick={handleRestoreAll}
                      disabled={loading}
                      startIcon={<Refresh fontSize="small" />}
                      sx={{ textTransform: 'none', fontSize: 12, borderRadius: 2, whiteSpace: 'nowrap' }}
                    >
                      Restaurar actas
                    </Button>
                  </Tooltip>
                )}
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{
              p: 2.25,
              borderRadius: 3,
              borderColor: '#94a3b8',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#94a3b8', borderWidth: '1.5px' },
              '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#64748b' },
              '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: '2px' },
              '& .MuiOutlinedInput-root.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: '#dc2626', borderWidth: '2px' }
            }}>
              <Typography fontWeight={900} mb={2}>1. Información de la reunión</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 1.5 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ gridColumn: '1 / -1' }}>
                  <Autocomplete
                    freeSolo
                    fullWidth
                    disabled={!canManageParticipants}
                    open={responsibleSearchOpen && responsibleOptions.length > 0}
                    onOpen={() => responsibleOptions.length > 0 && setResponsibleSearchOpen(true)}
                    onClose={() => setResponsibleSearchOpen(false)}
                    options={responsibleOptions}
                    value={null}
                    inputValue={responsibleDocument}
                    loading={searchingResponsible}
                    filterOptions={(options) => options}
                    getOptionLabel={(option) => typeof option === 'string'
                      ? option
                      : `${formatPersonName(option.name)} · CC ${option.document}`}
                    isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
                    onInputChange={(_, value, reason) => {
                      if (reason === 'input') {
                        setResponsibleDocument(value.slice(0, 100));
                        setResponsibleCandidate(null);
                      } else if (reason === 'clear') {
                        setResponsibleDocument('');
                        setResponsibleCandidate(null);
                        setResponsibleOptions([]);
                      }
                    }}
                    onChange={(_, option) => {
                      if (option && typeof option !== 'string') {
                        setResponsibleCandidate(option);
                        setResponsibleDocument(`${formatPersonName(option.name)} · CC ${option.document}`);
                        setResponsibleOptions([]);
                        setResponsibleSearchOpen(false);
                      }
                    }}
                    noOptionsText="No se encontraron coincidencias"
                    loadingText="Buscando personas..."
                    renderOption={(props, option) => {
                      const { key, ...optionProps } = props;
                      return (
                        <Box component="li" key={key} {...optionProps} sx={{ alignItems: 'flex-start !important', py: '10px !important' }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
                              <Typography variant="body2" fontWeight={900}>{formatPersonName(option.name)}</Typography>
                              <Chip size="small" label={`CC ${option.document}`} variant="outlined" sx={{ height: 20, fontSize: 10.5 }} />
                            </Stack>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {[option.role_title, option.organization].filter(Boolean).join(' · ') || 'Sin cargo o dependencia registrados'}
                            </Typography>
                            {option.email && <Typography variant="caption" color="text.secondary">{option.email}</Typography>}
                          </Box>
                        </Box>
                      );
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        id="responsible-document-field"
                        error={Boolean(fieldErrors.responsables)}
                        label={responsablesList.length === 0 ? 'Nombre o cédula del Responsable Principal *' : 'Nombre o cédula del responsable'}
                        placeholder="Escriba al menos 2 caracteres"
                        helperText="Busque por nombre, apellido o cédula y seleccione una persona de la lista."
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {searchingResponsible ? <CircularProgress color="inherit" size={18} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          )
                        }}
                      />
                    )}
                  />
                  <Button
                    disabled={!canManageParticipants || searchingResponsible || responsibleDocument.trim().length < 2 || Boolean(responsibleCandidate)}
                    variant="outlined"
                    startIcon={searchingResponsible ? <CircularProgress size={16} /> : <PersonSearch />}
                    onClick={lookupResponsible}
                    sx={{ minWidth: 135, textTransform: 'none', fontWeight: 800 }}
                  >
                    Buscar persona
                  </Button>
                </Stack>

                {responsibleCandidate && canManageParticipants && (
                  <Paper
                    variant="outlined"
                    sx={{
                      gridColumn: '1 / -1',
                      p: 1.5,
                      borderRadius: 2.5,
                      bgcolor: '#f8fbff',
                      border: '1.5px solid #93c5fd',
                      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.08)'
                    }}
                  >
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={1.5}>
                      <Box>
                        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                          <Typography fontWeight={900} fontSize={15}>{formatPersonName(responsibleCandidate.name)}</Typography>
                          <Chip size="small" label={`CC: ${responsibleCandidate.document}`} variant="outlined" sx={{ fontWeight: 700 }} />
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                          {[responsibleCandidate.role_title, responsibleCandidate.organization].filter(Boolean).join(' · ')}
                        </Typography>
                        {responsibleCandidate.email && (
                          <Typography variant="caption" color="text.secondary">{responsibleCandidate.email}</Typography>
                        )}
                      </Box>
                      <Stack direction="row" gap={1} flexWrap="wrap">
                        {responsablesList.length === 0 ? (
                          <Button
                            variant="contained"
                            color="primary"
                            onClick={() => addResponsableCandidate(true)}
                            sx={{ textTransform: 'none', fontWeight: 800 }}
                          >
                            Asignar como Responsable Principal
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="contained"
                              color="primary"
                              onClick={() => addResponsableCandidate(false)}
                              sx={{ textTransform: 'none', fontWeight: 800 }}
                            >
                              + Agregar Co-responsable
                            </Button>
                            <Button
                              variant="outlined"
                              color="primary"
                              onClick={() => addResponsableCandidate(true)}
                              sx={{ textTransform: 'none', fontWeight: 800 }}
                            >
                              Cambiar Principal
                            </Button>
                          </>
                        )}
                      </Stack>
                    </Stack>
                  </Paper>
                )}

                {/* Lista de Responsables Convocantes */}
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <Typography variant="subtitle2" fontWeight={900} color="#1e293b" mb={0.75} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    Responsables de la reunión ({responsablesList.length}):
                  </Typography>
                  {responsablesList.length === 0 ? (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                      Busque por nombre o cédula para asignar al <strong>Responsable Principal</strong> de la reunión.
                    </Alert>
                  ) : (
                    <Stack gap={1}>
                      {responsablesList.map((resp, idx) => (
                        <Paper
                          key={resp.document || idx}
                          variant="outlined"
                          sx={{
                            p: 1.25,
                            borderRadius: 2,
                            bgcolor: resp.is_primary ? '#f0fdf4' : '#ffffff',
                            borderColor: resp.is_primary ? '#86efac' : '#cbd5e1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 1.5
                          }}
                        >
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                              <Typography variant="body2" fontWeight={900} color="#0f172a">
                                {formatPersonName(resp.name)}
                              </Typography>
                              {resp.is_primary ? (
                                <Chip size="small" label="Principal" color="success" sx={{ fontWeight: 850, height: 22, fontSize: 11 }} />
                              ) : (
                                <Chip size="small" label="Co-responsable" color="default" sx={{ fontWeight: 750, height: 22, fontSize: 11 }} />
                              )}
                              <Typography variant="caption" sx={{ color: 'text.secondary', bgcolor: '#f1f5f9', px: 0.8, py: 0.2, borderRadius: 1 }}>
                                CC: {resp.document}
                              </Typography>
                            </Stack>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                              {[resp.role_title, resp.organization].filter(Boolean).join(' · ')} {resp.email ? `(${resp.email})` : ''}
                            </Typography>
                          </Box>
                          {canManageParticipants && (
                            <Stack direction="row" alignItems="center" gap={0.5}>
                              {!resp.is_primary && (
                                <Tooltip title="Asignar como Responsable Principal">
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="primary"
                                    onClick={() => makePrimaryResponsable(idx)}
                                    sx={{ textTransform: 'none', fontSize: 11, fontWeight: 800, py: 0.2, px: 1 }}
                                  >
                                    Hacer principal
                                  </Button>
                                </Tooltip>
                              )}
                              <Tooltip title="Eliminar de los responsables">
                                <IconButton size="small" color="error" onClick={() => removeResponsable(idx)}>
                                  <DeleteOutline fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          )}
                        </Paper>
                      ))}
                    </Stack>
                  )}
                </Box>

                <TextField
                  id="meeting-titulo-field"
                  error={Boolean(fieldErrors.titulo)}
                  disabled={!canEdit}
                  fullWidth
                  label="Título corto del acta *"
                  value={form.titulo || ''}
                  onChange={(e) => setField('titulo', e.target.value.slice(0, 120))}
                  inputProps={{ maxLength: 120 }}
                  sx={{ gridColumn: '1 / -1' }}
                />
                <TextField id="meeting-dependencia-field" error={Boolean(fieldErrors.dependencia)} disabled={!canEdit} fullWidth label="Dependencia que cita *" value={form.dependencia} onChange={(e) => setField('dependencia', e.target.value)} />
                <Autocomplete
                  freeSolo
                  disabled={!canEdit}
                  loading={loadingMeetingPlaces}
                  options={meetingPlaceOptions}
                  filterOptions={filterMeetingPlaces}
                  value={form.lugar || ''}
                  onChange={(_, value) => setField('lugar', value || '')}
                  onInputChange={(_, value, reason) => {
                    if (reason === 'input' || reason === 'clear') setField('lugar', value);
                  }}
                  loadingText="Cargando oficinas..."
                  noOptionsText="Escriba otro lugar"
                  renderInput={(params) => <TextField {...params} id="meeting-lugar-field" error={Boolean(fieldErrors.lugar)} fullWidth label="Lugar *" />}
                />
                <TextField id="meeting-fecha-field" error={Boolean(fieldErrors.fecha)} disabled={!canEdit} fullWidth type="date" InputLabelProps={{ shrink: true }} label="Fecha *" value={form.fecha} onChange={(e) => setField('fecha', e.target.value)} />
                <TextField id="meeting-hora-inicio-field" error={Boolean(fieldErrors.hora_inicio)} disabled={!canEdit} fullWidth type="time" InputLabelProps={{ shrink: true }} label="Hora de inicio *" value={form.hora_inicio} onChange={(e) => setField('hora_inicio', e.target.value)} />
                <TextField id="meeting-hora-fin-field" error={Boolean(fieldErrors.hora_fin)} disabled={!canEdit} fullWidth type="time" InputLabelProps={{ shrink: true }} label="Hora de finalización *" value={form.hora_fin} onChange={(e) => setField('hora_fin', e.target.value)} />
                <RichTextEditor id="meeting-objetivo-field" error={Boolean(fieldErrors.objetivo)} disabled={!canEdit} label="Objetivo *" value={form.objetivo} onChange={(value) => setField('objetivo', value)} minHeight={90} />
                <RichTextEditor id="meeting-desarrollo-field" error={Boolean(fieldErrors.desarrollo)} disabled={!canEdit} label="Desarrollo de la reunión *" value={form.desarrollo} onChange={(value) => setField('desarrollo', value)} minHeight={150} />
                <RichTextEditor id="meeting-conclusiones-field" error={Boolean(fieldErrors.conclusiones)} disabled={!canEdit} label="Conclusiones / Compromisos *" value={form.conclusiones} onChange={(value) => setField('conclusiones', value)} minHeight={120} />
              </Box>
            </Paper>
            <Paper id="meeting-participants-section" variant="outlined" sx={{ p: 2.25, borderRadius: 3, borderWidth: fieldErrors.participants ? '2px' : '1.5px', borderColor: fieldErrors.participants ? '#dc2626' : '#94a3b8', boxShadow: fieldErrors.participants ? '0 0 0 2px rgba(220,38,38,0.12)' : 'none' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} mb={1}>
                <Typography fontWeight={900}>2. Participantes y firmas</Typography>
                {form.participants.length >= 2 ? (
                  <Chip size="small" color="success" label={`${form.participants.length} personas en la reunión (${additionalParticipants.length} convocados)`} sx={{ fontWeight: 850 }} />
                ) : (
                  <Chip size="small" color="warning" label="Al menos 2 participantes requeridos" sx={{ fontWeight: 850 }} />
                )}
              </Stack>
              {form.revision_required && <Alert severity="info" sx={{ my: 1.5, borderRadius: 2 }}>Los responsables y participantes quedaron fijados desde el primer envío a firmas. En esta revisión solo puede modificar el contenido del acta.</Alert>}
              {canManageParticipants && (
                <Paper variant="outlined" sx={{ p: 1.5, mt: 1.5, borderRadius: 2.5, bgcolor: '#f8fbff' }}>
                  <Stack direction="row" alignItems="center" gap={1} mb={1}>
                    <PersonSearch color="primary" />
                    <Box>
                      <Typography fontWeight={850}>Buscar participante</Typography>
                    </Box>
                  </Stack>

                  <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="stretch" gap={1} mb={1}>
                    <Autocomplete
                      freeSolo
                      fullWidth
                      size="small"
                      open={participantSearchOpen && participantSearchOptions.length > 0}
                      onOpen={() => participantSearchOptions.length > 0 && setParticipantSearchOpen(true)}
                      onClose={() => setParticipantSearchOpen(false)}
                      options={participantSearchOptions}
                      value={null}
                      inputValue={externalDraft.document}
                      loading={searchingParticipant}
                      filterOptions={(options) => options}
                      getOptionLabel={(option) => typeof option === 'string'
                        ? option
                        : `${formatPersonName(option.name)} · CC ${option.document}`}
                      isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
                      onInputChange={(_, value, reason) => {
                        if (!['input', 'clear'].includes(reason)) return;
                        const nextDocument = value.slice(0, 100);
                        setExternalDraft((old) => externalStudentResult?.found
                          ? { document: nextDocument, name: '', email: '', organization: '', role_title: '' }
                          : { ...old, document: nextDocument });
                        setExternalStudentResult(null);
                        if (reason === 'clear') {
                          setParticipantSearchOptions([]);
                          setParticipantSearchOpen(false);
                        }
                      }}
                      onChange={(_, option) => {
                        if (option && typeof option !== 'string') selectInstitutionalParticipant(option);
                      }}
                      noOptionsText="No se encontraron usuarios internos"
                      loadingText="Buscando usuarios internos..."
                      renderOption={(props, option) => {
                        const { key, ...optionProps } = props;
                        return (
                          <Box component="li" key={key} {...optionProps} sx={{ alignItems: 'flex-start !important', py: '9px !important' }}>
                            <Box sx={{ minWidth: 0 }}>
                              <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
                                <Typography variant="body2" fontWeight={900}>{formatPersonName(option.name)}</Typography>
                                <Chip size="small" label={`CC ${option.document}`} variant="outlined" sx={{ height: 20, fontSize: 10.5 }} />
                              </Stack>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                {[option.role_title, option.organization].filter(Boolean).join(' · ') || 'Sin cargo o dependencia registrados'}
                              </Typography>
                              {option.email && <Typography variant="caption" color="text.secondary">{option.email}</Typography>}
                            </Box>
                          </Box>
                        );
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Nombre o cédula/identificación"
                          placeholder="Nombre interno o cédula"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              searchParticipantInput();
                            }
                          }}
                          InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                              <>
                                {searchingParticipant ? <CircularProgress color="inherit" size={16} /> : null}
                                {params.InputProps.endAdornment}
                              </>
                            )
                          }}
                        />
                      )}
                    />
                    <Button
                      variant="outlined"
                      startIcon={(lookingUpExternalStudent || searchingParticipant) ? <CircularProgress size={16} /> : <PersonSearch />}
                      disabled={lookingUpExternalStudent || searchingParticipant || !String(externalDraft.document || '').trim()}
                      onClick={searchParticipantInput}
                      sx={{
                        minWidth: { xs: '100%', sm: 140 },
                        height: 40,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        textTransform: 'none',
                        fontWeight: 800
                      }}
                    >
                      Buscar
                    </Button>
                  </Stack>

                  {externalStudentResult?.institutionalProfile && externalStudentResult.studentOptions?.length > 0 && (
                    <Paper variant="outlined" sx={{ p: 1.25, mb: 1.5, borderRadius: 2, borderColor: '#93c5fd', bgcolor: '#f8fbff' }}>
                      <Typography variant="body2" fontWeight={850} mb={1}>
                        Esta persona tiene dos vinculaciones. ¿Cómo participa en esta acta?
                      </Typography>
                      <ToggleButtonGroup
                        exclusive
                        fullWidth
                        size="small"
                        color="primary"
                        value={externalStudentResult.kind}
                        onChange={(_, selectedKind) => {
                          if (!selectedKind) return;
                          if (selectedKind === 'institutional') {
                            const profile = externalStudentResult.institutionalProfile;
                            setExternalDraft({
                              document: profile.document || externalDraft.document,
                              name: profile.name || '',
                              email: profile.email || '',
                              organization: profile.organization || '',
                              role_title: profile.role_title || ''
                            });
                            setExternalStudentResult((old) => ({
                              ...old,
                              kind: 'institutional',
                              missingEmail: !profile.email
                            }));
                            return;
                          }
                          const profile = externalStudentResult.studentOptions[0];
                          setExternalDraft({
                            document: profile.document || externalDraft.document,
                            name: profile.name || '',
                            email: profile.email || '',
                            organization: profile.program || profile.organization || '',
                            role_title: 'Estudiante'
                          });
                          setExternalStudentResult((old) => ({
                            ...old,
                            kind: 'student',
                            studentCode: profile.student_code || '',
                            program: profile.program || profile.organization || '',
                            academicPeriod: profile.academic_period || '',
                            hasEmail: Boolean(profile.email),
                            missingEmail: false
                          }));
                        }}
                      >
                        <ToggleButton value="institutional" sx={{ fontWeight: 800, textTransform: 'none' }}>
                          Colaborador institucional
                        </ToggleButton>
                        <ToggleButton value="student" sx={{ fontWeight: 800, textTransform: 'none' }}>
                          Estudiante
                        </ToggleButton>
                      </ToggleButtonGroup>
                    </Paper>
                  )}

                  {externalStudentResult?.found && externalStudentResult.kind === 'student' && (
                    <Alert
                      severity="success"
                      sx={{ mb: 1, py: 0, fontSize: 12.5, '& .MuiAlert-icon': { py: 0.65 }, '& .MuiAlert-message': { py: 0.65 } }}
                    >
                      <strong>Estudiante encontrado.</strong>
                      {externalStudentResult.program ? ` ${formatSentenceCase(externalStudentResult.program)}` : ''}
                      {externalStudentResult.studentCode ? ` · ${externalStudentResult.studentCode}` : ''}
                      {!externalStudentResult.hasEmail && ' · Complete el correo.'}
                    </Alert>
                  )}
                  {externalStudentResult?.kind === 'student' && externalStudentResult.studentOptions?.length > 1 && (
                    <Autocomplete
                      fullWidth
                      size="small"
                      sx={{ mb: 1.5 }}
                      options={externalStudentResult.studentOptions}
                      value={externalStudentResult.studentOptions.find((option) => (
                        String(option.student_code || '') === String(externalStudentResult.studentCode || '')
                        && String(option.program || '') === String(externalStudentResult.program || '')
                      )) || externalStudentResult.studentOptions[0]}
                      isOptionEqualToValue={(option, value) => (
                        String(option.student_code || '') === String(value.student_code || '')
                        && String(option.program || '') === String(value.program || '')
                      )}
                      getOptionLabel={(option) => [
                        option.program || 'Programa sin registrar',
                        option.student_code ? `Código ${option.student_code}` : '',
                        option.academic_period ? `Periodo ${option.academic_period}` : ''
                      ].filter(Boolean).join(' · ')}
                      onChange={(_, option) => {
                        if (!option) return;
                        setExternalDraft((old) => ({
                          ...old,
                          document: option.document || old.document,
                          name: option.name || old.name,
                          email: option.email || old.email,
                          organization: option.program || option.organization || '',
                          role_title: 'Estudiante'
                        }));
                        setExternalStudentResult((old) => ({
                          ...old,
                          studentCode: option.student_code || '',
                          program: option.program || option.organization || '',
                          academicPeriod: option.academic_period || '',
                          hasEmail: Boolean(option.email)
                        }));
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Seleccione el programa académico"
                          helperText="La persona registra más de un programa en Matriculados."
                        />
                      )}
                    />
                  )}
                  {externalStudentResult?.found && externalStudentResult.kind === 'institutional' && (
                    <Alert
                      severity={externalStudentResult.missingEmail ? 'warning' : 'success'}
                      sx={{ mb: 1, py: 0, fontSize: 12.5, '& .MuiAlert-icon': { py: 0.65 }, '& .MuiAlert-message': { py: 0.65 } }}
                    >
                      <strong>Usuario institucional encontrado.</strong>
                      {externalStudentResult.missingEmail ? ' Complete el correo.' : ' Puede editar los datos.'}
                    </Alert>
                  )}
                  {externalStudentResult && !externalStudentResult.found && (
                    <Alert severity={externalStudentResult.error ? 'error' : 'warning'} sx={{ mb: 1.5 }}>
                      {externalStudentResult.error
                        ? 'No fue posible validar la identificación. Intente nuevamente antes de agregarla.'
                        : 'No pertenece a usuarios institucionales ni aparece en Matriculados. Complete los datos manualmente para agregarla como externa.'}
                    </Alert>
                  )}

                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 1 }}>
                    <TextField size="small" label="Nombre completo" value={externalDraft.name} onChange={(e) => setExternalDraft((old) => ({ ...old, name: e.target.value }))} />
                    <TextField size="small" type="email" label="Correo empresarial o personal" value={externalDraft.email} onChange={(e) => setExternalDraft((old) => ({ ...old, email: e.target.value }))} />
                    <TextField
                      size="small"
                      label="Cargo"
                      value={externalDraft.role_title}
                      onChange={(e) => setExternalDraft((old) => ({ ...old, role_title: e.target.value }))}
                    />
                    <TextField size="small" label="Empresa, entidad o programa (opcional)" value={externalDraft.organization} onChange={(e) => setExternalDraft((old) => ({ ...old, organization: e.target.value }))} />
                  </Box>
                  <Stack direction="row" justifyContent="flex-end" gap={1} mt={1.25}>
                    <Button onClick={() => {
                      setExternalDraft({ document: '', name: '', email: '', organization: '', role_title: '' });
                      setExternalStudentResult(null);
                      setParticipantSearchOptions([]);
                      setParticipantSearchOpen(false);
                    }}>Limpiar</Button>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      disabled={!externalStudentResult || externalStudentResult.error}
                      onClick={addExternalParticipant}
                    >
                      Agregar al acta
                    </Button>
                  </Stack>
                </Paper>
              )}
              <Stack gap={1} mt={2}>
                {form.participants.map((participant, index) => {
                  const pDoc = String(participant.document || '').toLowerCase();
                  const pEmail = String(participant.email || '').toLowerCase();
                  const respItem = responsablesList.find((r) =>
                    (pDoc && String(r.document || '').toLowerCase() === pDoc) ||
                    (pEmail && String(r.email || '').toLowerCase() === pEmail)
                  );
                  const isResp = Boolean(respItem);
                  const isPrimary = Boolean(respItem?.is_primary);

                  return (
                    <Box key={participant.id || participant.user_id || `${participant.document}-${index}`} sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1, alignItems: 'center', p: 1.25, border: '1px solid #dbe5f0', borderRadius: 2, bgcolor: isPrimary ? '#f0fdf4' : isResp ? '#f8fafc' : '#ffffff' }}>
                      <Box>
                        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                          <Typography variant="body2" fontWeight={850}>{formatPersonName(participant.name)}</Typography>
                          {isPrimary && <Chip size="small" label="Responsable Principal" color="success" sx={{ height: 20, fontSize: 11, fontWeight: 800 }} />}
                          {isResp && !isPrimary && <Chip size="small" label="Co-responsable" color="primary" variant="outlined" sx={{ height: 20, fontSize: 11, fontWeight: 750 }} />}
                          {!participant.user_id && !isResp && <Chip size="small" label="Externo" variant="outlined" color="primary" sx={{ height: 20, fontSize: 11 }} />}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">{participant.role_title} · {participant.email}</Typography>
                      </Box>
                      <Stack direction="row" alignItems="center" gap={0.5}>
                        <Chip size="small" label={participant.status === 'signed' ? 'Firmado' : 'Pendiente'} color={participant.status === 'signed' ? 'success' : 'default'} />
                        {canManageParticipants && participant.status !== 'signed' && (
                          <IconButton color="error" size="small" onClick={() => removeParticipant(index)}>
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        )}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </Paper>
            <Box id="meeting-calendar-section">
              {canManageCalendar ? (
                <MeetingCalendarScheduler
                minuteId={form.id}
                minuteTitle={form.titulo}
                defaultLocation={form.lugar}
                participants={form.participants}
                responsibles={responsablesList}
                lookupParticipantByDocument={meetingMinuteService.lookupParticipant}
                dialogMode
                />
              ) : (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, borderColor: '#93c5fd', bgcolor: '#f8fbff' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" gap={1.5}>
                  <Stack direction="row" alignItems="center" gap={1.25}>
                    <Box sx={{ width: 46, height: 46, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: '#dbeafe', color: '#1d4ed8' }}><CalendarMonth /></Box>
                    <Box>
                      <Typography fontWeight={900}>Programar siguiente sesión</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {!responsablesList.length
                          ? 'Opcional · Asigne al Responsable Principal para habilitar Calendar.'
                          : 'Opcional · Disponible para el creador, responsables y administradores del acta.'}
                      </Typography>
                    </Box>
                  </Stack>
                  <Button disabled variant="contained" startIcon={<CalendarMonth />} sx={{ borderRadius: 2.5, px: 2.5, textTransform: 'none', fontWeight: 900 }}>
                    Abrir Calendar
                  </Button>
                </Stack>
                </Paper>
              )}
            </Box>
          </Stack>
          <Paper
            variant="outlined"
            sx={{
              width: layoutMode === 'preview' ? '100%' : { xs: '100%', lg: '53%' },
              maxWidth: layoutMode === 'preview' ? '1250px' : 'none',
              mx: layoutMode === 'preview' ? 'auto' : 0,
              height: { lg: '100%' },
              display: layoutMode === 'form' ? 'none' : 'flex',
              flexDirection: 'column',
              p: 2,
              borderRadius: 3,
              minHeight: 0,
              bgcolor: '#fff'
            }}
          >
            <Box sx={{ mb: 2, pb: 2, borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5} flexWrap="wrap" gap={1}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Tooltip title={layoutMode === 'split' ? 'Expandir vista previa a pantalla completa' : 'Restaurar vista dividida (50/50)'}>
                    <IconButton
                      size="small"
                      onClick={() => setLayoutMode(layoutMode === 'split' ? 'preview' : 'split')}
                      sx={{
                        bgcolor: layoutMode === 'preview' ? '#0f3a68' : '#e2e8f0',
                        color: layoutMode === 'preview' ? '#fff' : '#1e293b',
                        border: '1px solid #cbd5e1',
                        borderRadius: 2,
                        width: 36,
                        height: 36,
                        '&:hover': {
                          bgcolor: layoutMode === 'preview' ? '#0b2b4d' : '#cbd5e1'
                        }
                      }}
                    >
                      {layoutMode === 'split' ? <ArrowBack fontSize="small" /> : <ArrowForward fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                  <Typography fontWeight={900}>Vista previa del acta</Typography>
                </Stack>
                {(form.id || saveStatus !== 'saved') && (
                  <Stack direction="row" alignItems="center" gap={0.75} sx={{ color: saveStatus === 'error' ? '#b91c1c' : saveStatus === 'saved' ? '#15803d' : '#a16207', fontSize: 11, fontWeight: 750, bgcolor: saveStatus === 'error' ? '#fef2f2' : saveStatus === 'saved' ? '#f0fdf4' : '#fffbeb', px: 1, py: 0.3, borderRadius: 1.5, border: `1px solid ${saveStatus === 'error' ? '#fecaca' : saveStatus === 'saved' ? '#bbf7d0' : '#fde68a'}` }}>
                    {saveStatus === 'saving' ? <CircularProgress size={10} color="inherit" /> : <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: saveStatus === 'error' ? '#ef4444' : saveStatus === 'saved' ? '#22c55e' : '#eab308' }} />}
                    <span>{saveStatus === 'saving' ? 'Guardando automáticamente…' : saveStatus === 'pending' ? 'Cambios pendientes…' : saveStatus === 'error' ? 'Error al guardar' : 'Todo guardado · Autoguardado activo'}</span>
                  </Stack>
                )}
              </Stack>
              <Menu
                anchorEl={downloadAnchorEl}
                open={Boolean(downloadAnchorEl)}
                onClose={() => setDownloadAnchorEl(null)}
                PaperProps={{ sx: { minWidth: 260, borderRadius: 2.5, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' } }}
              >
                <MenuItem onClick={() => download('original')} sx={{ py: 1 }}>
                  <Box>
                    <Typography variant="body2" fontWeight={850} color="primary.main">Original (con firmas gráficas)</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">Documento máster custodiado por el responsable</Typography>
                  </Box>
                </MenuItem>
                <MenuItem onClick={() => download('copia')} sx={{ py: 1 }}>
                  <Box>
                    <Typography variant="body2" fontWeight={850} color="text.primary">Copia oficial (sin firmas visibles)</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">Versión oficial para participantes con constancia 'ORIGINAL FIRMADO'</Typography>
                  </Box>
                </MenuItem>
              </Menu>

              {locked ? (
                <Stack spacing={1} sx={{ width: '100%' }}>
                  {/* Fila 1: Documento y Control del Acta */}
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: canRevise ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))' },
                      gap: 1,
                      width: '100%',
                      '& .MuiButton-root': {
                        width: '100%',
                        minHeight: 38,
                        py: 0.6,
                        px: 1.5,
                        textTransform: 'none',
                        fontWeight: 800,
                        fontSize: { xs: 11.5, sm: 12.5 },
                        borderRadius: 2,
                        boxShadow: 'none',
                        '& .MuiButton-startIcon': { mr: 0.75, ml: 0 }
                      }
                    }}
                  >
                    <Button id="meeting-download-button" fullWidth startIcon={<Download />} disabled={!form.id} onClick={(e) => setDownloadAnchorEl(e.currentTarget)} variant="outlined">
                      Descargar PDF
                    </Button>
                    {canRevise && (
                      <Button fullWidth startIcon={<EditNote />} onClick={() => setConfirmAdjust(true)} color="warning" variant="outlined" sx={{ fontWeight: 850 }}>
                        Ajustar y volver a firmar
                      </Button>
                    )}
                    <Button id="meeting-refresh-signatures-button" fullWidth startIcon={<Refresh />} disabled={loading} onClick={() => openMinute(form.id)} variant="outlined">
                      Actualizar firmas
                    </Button>
                  </Box>

                  {/* Fila 2: Gestión de Firmas y Envío */}
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        sm: `repeat(${((form.status === 'signing' ? 1 : 0) + (form.status === 'signing' && !allSigned ? 1 : 0) + (canSendFinal ? 1 : 0)) || 1}, minmax(0, 1fr))`
                      },
                      gap: 1,
                      width: '100%',
                      '& .MuiButton-root': {
                        width: '100%',
                        minHeight: 38,
                        py: 0.6,
                        px: 1.5,
                        textTransform: 'none',
                        fontWeight: 800,
                        fontSize: { xs: 11.5, sm: 12.5 },
                        borderRadius: 2,
                        boxShadow: 'none',
                        '& .MuiButton-startIcon': { mr: 0.75, ml: 0 }
                      }
                    }}
                  >
                    {form.status === 'signing' && (
                      <Button fullWidth startIcon={<QrCode2 />} disabled={loading} onClick={() => showSigningAccess(false)} variant="outlined">
                        Ver enlace y QR
                      </Button>
                    )}
                    {form.status === 'signing' && !allSigned && (
                      <Tooltip title={`Enviar nuevamente el correo solo a ${pendingCount} participante${pendingCount === 1 ? '' : 's'} pendiente${pendingCount === 1 ? '' : 's'}`}>
                        <Button fullWidth startIcon={<Email />} disabled={loading} onClick={resendInvitations} variant="outlined">
                          Reenviar solo a pendientes
                        </Button>
                      </Tooltip>
                    )}
                    {canSendFinal && (
                      <Tooltip title={!allSigned ? `Se habilitará cuando todos los participantes hayan firmado (${pendingCount} pendiente${pendingCount === 1 ? '' : 's'})` : 'Enviar versión final del acta con firmas a todos los participantes'}>
                        <Box component="span" sx={{ display: 'flex', width: '100%' }}>
                          <Button
                            id="meeting-send-final-button"
                            fullWidth
                            startIcon={<Send />}
                            disabled={loading || !allSigned}
                            onClick={sendFinal}
                            color="success"
                            variant={allSigned ? "contained" : "outlined"}
                            sx={{ fontWeight: 850 }}
                          >
                            {form.status === 'distributed' ? "Reenviar acta firmada" : "Enviar acta firmada"}
                          </Button>
                        </Box>
                      </Tooltip>
                    )}
                  </Box>
                </Stack>
              ) : (
                /* Acciones principales del borrador. El guardado manual permanece en el pie. */
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fit, minmax(180px, 1fr))' },
                    gap: 1,
                    width: '100%',
                    '& .MuiButton-root': {
                      width: '100%',
                      minHeight: 38,
                      py: 0.6,
                      px: 1.5,
                      textTransform: 'none',
                      fontWeight: 800,
                      fontSize: { xs: 11.5, sm: 12.5 },
                      borderRadius: 2,
                      boxShadow: 'none',
                      '& .MuiButton-startIcon': { mr: 0.75, ml: 0 }
                    }
                  }}
                >
                  <Button fullWidth startIcon={<Download />} disabled={!form.id} onClick={(e) => setDownloadAnchorEl(e.currentTarget)} variant="outlined">
                    Descargar PDF
                  </Button>
                  {canEdit && (
                    <Button fullWidth startIcon={<EditNote />} onClick={handleEditActaClick} color="primary" variant="outlined" sx={{ fontWeight: 850 }}>
                      Editar acta
                    </Button>
                  )}
                  <Tooltip title="Validar el acta completa, habilitar firmas y enviar las invitaciones">
                    <Box component="span" sx={{ display: 'flex', width: '100%' }}>
                      <Button
                        id="meeting-publish-button"
                        fullWidth
                        startIcon={<Email />}
                        onClick={publish}
                        disabled={loading || autoSaving}
                        variant="contained"
                        sx={{ fontWeight: 850 }}
                      >
                        Habilitar y enviar invitaciones
                      </Button>
                    </Box>
                  </Tooltip>
                </Box>
              )}
            </Box>
            <Box
              sx={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'auto',
                minHeight: 0,
                pr: 1,
                // Barra de scroll de la vista previa ampliada y de fácil agarre
                '&::-webkit-scrollbar': {
                  width: '14px',
                  height: '14px'
                },
                '&::-webkit-scrollbar-track': {
                  bgcolor: '#e2e8f0',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1'
                },
                '&::-webkit-scrollbar-thumb': {
                  bgcolor: '#475569',
                  borderRadius: '8px',
                  border: '2.5px solid #e2e8f0',
                  '&:hover': {
                    bgcolor: '#1e293b'
                  }
                },
                scrollbarWidth: 'auto',
                scrollbarColor: '#475569 #e2e8f0'
              }}
            >
              <MeetingPreview document={document} form={form} signatures={signatures} previewType={previewType} />
            </Box>
          </Paper>
        </Box>
      </DialogContent>
      <DialogActions sx={{
        px: { xs: 1.5, md: 4 }, py: 1.25, bgcolor: '#fff',
        borderTop: '1px solid #dbe5f0', flexShrink: 0,
        justifyContent: 'space-between', gap: 1,
        boxShadow: '0 -8px 24px rgba(30,64,175,.06)'
      }}>
        <Button disabled={loading || autoSaving} onClick={handleClose}>Cerrar</Button>
        <Stack direction="row" alignItems="center" gap={1}>
          <Button
            variant="outlined"
            color="success"
            startIcon={<HelpOutline />}
            onClick={followGuide}
            sx={{
              textTransform: 'none',
              fontWeight: 850,
              animation: 'guidePulse 3s ease-in-out infinite',
              '@keyframes guidePulse': {
                '0%, 100%': { boxShadow: '0 0 0 0 rgba(22,163,74,0)' },
                '50%': { boxShadow: '0 0 0 8px rgba(22,163,74,0.2)' }
              }
            }}
          >
            ¿Qué sigue?
          </Button>
          {showManualDraftSave && (
            <Button
              variant="outlined"
              startIcon={saveStatus === 'error' ? <Refresh /> : <Save />}
              disabled={loading || autoSaving}
              onClick={() => save()}
              color={saveStatus === 'error' ? 'error' : 'primary'}
              sx={{ textTransform: 'none', fontWeight: 850 }}
            >
              Guardar borrador
            </Button>
          )}
        </Stack>
      </DialogActions>
    </Dialog>
    <Dialog open={Boolean(qr)} onClose={() => setQr(null)} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight={900}>Acceso presencial para firmar</DialogTitle>
      <DialogContent>
        <Stack alignItems="center" gap={1.5} pt={0.5}>
          <Alert severity="info" sx={{ fontSize: 12.5 }}>
            Al escanear, cada participante continúa con Google usando el mismo correo registrado en el acta. Puede ser institucional o externo y solo se abrirá su propio registro.
          </Alert>
          {qr?.qr_data_url && <Box component="img" src={qr.qr_data_url} alt="QR alternativo para firmar" sx={{ width: 260, height: 260, borderRadius: 2, border: '1px solid #e2e8f0' }} />}
          <TextField fullWidth size="small" value={qr?.signing_url || ''} InputProps={{ readOnly: true }} />
          <Button
            fullWidth
            variant="contained"
            startIcon={<ContentCopy />}
            onClick={() => { navigator.clipboard.writeText(qr?.signing_url || ''); enqueueSnackbar('Enlace copiado al portapapeles.', { variant: 'success' }); }}
            sx={{ textTransform: 'none', fontWeight: 800 }}
          >
            Copiar enlace para firmar
          </Button>
          <Button
            size="small"
            color="warning"
            onClick={() => showSigningAccess(true)}
            sx={{ textTransform: 'none', fontSize: 11.5, color: '#b45309' }}
          >
            Regenerar código QR (invalidará el QR anterior)
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setQr(null)}>Cerrar</Button>
      </DialogActions>
    </Dialog>
    <Dialog open={confirmAdjust} onClose={() => !loading && setConfirmAdjust(false)} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={900}>Ajustar el acta y solicitar nuevas firmas</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mt: 1 }}>
          Al continuar se invalidarán todas las firmas registradas, los enlaces personales y el QR actuales. Solo el responsable principal o los corresponsables podrán modificar el acta. Después de cualquier ajuste deberá enviarla nuevamente y todos los participantes recibirán, en el mismo hilo de correo, la solicitud de volver a firmar.
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button disabled={loading} onClick={() => setConfirmAdjust(false)}>Cancelar</Button>
        <Button disabled={loading} onClick={reopenForEditing} color="warning" variant="contained">Invalidar firmas y editar</Button>
      </DialogActions>
    </Dialog>
    <Dialog open={Boolean(minuteToDelete)} onClose={() => !loading && setMinuteToDelete(null)} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight={900} sx={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: 1 }}>
        <DeleteOutline /> Eliminar acta
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1.5, lineHeight: 1.6 }}>
          ¿Está seguro de eliminar el acta <strong>{minuteToDelete?.code}</strong> del sistema?
        </Typography>
        <Alert severity="warning" sx={{ fontSize: 12.5 }}>
          Esta acción retirará el acta del sistema. Solo el creador o responsable principal pueden realizar esta acción. Si el acta ya fue enviada, los participantes conservarán su copia en PDF en sus correos.
        </Alert>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button disabled={loading} onClick={() => setMinuteToDelete(null)} sx={{ textTransform: 'none' }}>
          Cancelar
        </Button>
        <Button
          disabled={loading}
          color="error"
          variant="contained"
          onClick={handleDeleteMinute}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <DeleteOutline />}
          sx={{ textTransform: 'none', fontWeight: 900 }}
        >
          {loading ? 'Eliminando…' : 'Eliminar definitivamente'}
        </Button>
      </DialogActions>
    </Dialog>
  </>;
}
