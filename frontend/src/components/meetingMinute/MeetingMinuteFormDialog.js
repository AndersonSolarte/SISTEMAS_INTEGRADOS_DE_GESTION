import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, Menu, MenuItem, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography
} from '@mui/material';
import {
  Add, ArrowBack, ArrowForward, Close, ContentCopy, DeleteOutline, Download, Edit, EditNote, Email, PersonSearch,
  QrCode2, Refresh, Save, Send, ViewSidebar, Visibility
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import meetingMinuteService from '../../services/meetingMinuteService';
import logoFormatos from '../../assets/logo_formatos.jpg';
import RichTextEditor, { sanitizeRichHtml } from './RichTextEditor';
import formatPersonName from '../../utils/formatPersonName';

const today = () => new Date().toISOString().slice(0, 10);
const formatDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || '';
};
const MEETING_PLACES = [
  'Sala de Rectoría',
  'Salón H201F',
  'Sala Bellina',
  'Sala de Juntas San Damián',
  'Sala de Juntas Campus San Damián'
];
const emptyForm = (user = {}) => ({
  id: '', status: 'draft', created_by: user.id || '', responsables: '', dependencia: '',
  responsable_document: '', responsable_role: '', responsables_data: [],
  lugar: '', fecha: today(), hora_inicio: '08:00', hora_fin: '10:00',
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
      name: formatPersonName(r.name || existing?.name || ''),
      email: r.email || existing?.email || '',
      organization: r.organization || existing?.organization || '',
      role_title: r.role_title || existing?.role_title || (idx === 0 ? 'Responsable Principal' : 'Co-responsable'),
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
      ? form.responsables.split('\n').map((l) => l.replace(/^[•\-\*\s]+/, '').trim()).filter(Boolean).map((line, idx) => {
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
          <span>CÓDIGO: {document?.codigo || 'COM-ID-FR-002'}</span><span>VERSIÓN: {document?.version || '1'}</span><span>FECHA: {formatDate(form.fecha)}</span>
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
              const roleOrg = [r.role_title, r.organization].filter(Boolean).join(' · ');
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
        const roleLabel = !participant.user_id && participant.organization ? [participant.organization, participant.role_title].filter(Boolean).join(' · ') : (participant.role_title || participant.organization || '');
        const showGraphic = previewType !== 'copia' && Boolean(signature?.signature_preview);
        return (
          <Box key={participant.id || participant.user_id || index} sx={{ display: 'grid', gridTemplateColumns: '45px 1.5fr 1fr 150px', borderBottom: '1px solid #111' }}>
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
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState(() => emptyForm(user));
  const [responsablesList, setResponsablesList] = useState([]);
  const [minutes, setMinutes] = useState([]);
  const [signatures, setSignatures] = useState([]);
  const [documentNumber, setDocumentNumber] = useState('');
  const [candidate, setCandidate] = useState(null);
  const [responsibleDocument, setResponsibleDocument] = useState('');
  const [responsibleCandidate, setResponsibleCandidate] = useState(null);
  const [searchingResponsible, setSearchingResponsible] = useState(false);
  const [externalMode, setExternalMode] = useState(false);
  const [externalDraft, setExternalDraft] = useState({ document: '', name: '', email: '', organization: '', role_title: '' });
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [qr, setQr] = useState(null);
  const [confirmAdjust, setConfirmAdjust] = useState(false);
  const [downloadAnchorEl, setDownloadAnchorEl] = useState(null);
  const [layoutMode, setLayoutMode] = useState('split'); // 'split' | 'form' | 'preview'
  const [previewType, setPreviewType] = useState('original'); // 'original' | 'copia'
  const locked = form.status !== 'draft';
  const hasSignatures = signatures.length > 0;
  const allSigned = Boolean(form.participants.length) && form.participants.every((participant) => participant.status === 'signed');
  const pendingCount = useMemo(() => (form.participants || []).filter((p) => p.status !== 'signed').length, [form.participants]);

  const userDoc = String(user?.username || user?.documento || user?.cedula || user?.document || '').trim().toLowerCase();
  const userEmail = String(user?.email || '').trim().toLowerCase();
  const userName = String(user?.nombre || user?.name || '').trim().toLowerCase();
  const userId = Number(user?.id);

  const isCreator = Boolean(!form.id || (form.created_by && Number(form.created_by) === userId));
  const isResponsible = Boolean(
    (Array.isArray(responsablesList) && responsablesList.some((r) =>
      (userDoc && r.document && String(r.document).trim().toLowerCase() === userDoc) ||
      (userId && r.user_id && Number(r.user_id) === userId) ||
      (userEmail && r.email && String(r.email).trim().toLowerCase() === userEmail) ||
      (userName && (r.name || r.nombre) && String(r.name || r.nombre).trim().toLowerCase() === userName)
    )) ||
    (Array.isArray(form.responsables_data) && form.responsables_data.some((r) =>
      (userDoc && r.document && String(r.document).trim().toLowerCase() === userDoc) ||
      (userId && r.user_id && Number(r.user_id) === userId) ||
      (userEmail && r.email && String(r.email).trim().toLowerCase() === userEmail) ||
      (userName && (r.name || r.nombre) && String(r.name || r.nombre).trim().toLowerCase() === userName)
    )) ||
    (userDoc && form.responsable_document && String(form.responsable_document).trim().toLowerCase() === userDoc) ||
    (userEmail && form.responsable_email && String(form.responsable_email).trim().toLowerCase() === userEmail) ||
    (userName && form.responsable_nombre && String(form.responsable_nombre).trim().toLowerCase() === userName)
  );
  const isAdminUser = Boolean(
    user?.role === 'admin' ||
    user?.role === 'administrador' ||
    user?.isAdmin ||
    user?.is_admin ||
    user?.tipo_usuario === 'administrador'
  );
  const canEdit = Boolean(!form.id || isCreator || isResponsible || isAdminUser || Boolean(user));
  const canSendFinal = Boolean(isCreator || isResponsible || isAdminUser || Boolean(user));

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
  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(user));
    setResponsablesList([]);
    setSignatures([]);
    setQr(null);
    setCandidate(null);
    setDocumentNumber('');
    setResponsibleDocument('');
    setResponsibleCandidate(null);
    setExternalMode(false);
    loadMinutes();
  }, [open, user]);

  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const openMinute = async (id) => {
    if (!id) {
      setForm(emptyForm(user));
      setResponsablesList([]);
      return;
    }
    setLoading(true);
    try {
      const response = await meetingMinuteService.get(id);
      const row = response.data;
      const content = row.content || {};
      const [start = '', end = ''] = String(content.horario || '').split('-').map((part) => part.trim());
      const loadedResponsables = loadResponsablesFromMinute(content);
      setResponsablesList(loadedResponsables);
      const formattedText = content.responsables || formatResponsablesText(loadedResponsables);
      setForm({
        id: row.id,
        status: row.status,
        created_by: row.created_by,
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

  const lookup = async () => {
    if (!documentNumber.trim()) return;
    setSearching(true);
    setCandidate(null);
    try {
      const response = await meetingMinuteService.lookupParticipant(documentNumber.trim());
      setCandidate(response.data);
    } catch (error) {
      if (error.response?.status === 404) {
        setExternalDraft({ document: documentNumber.trim(), name: '', email: '', organization: '', role_title: '' });
        setExternalMode(true);
        enqueueSnackbar('La persona no está registrada. Puede agregarla únicamente a esta acta.', { variant: 'info' });
      } else {
        enqueueSnackbar(error.response?.data?.message || 'No se encontró la cédula.', { variant: 'error' });
      }
    } finally {
      setSearching(false);
    }
  };

  const addParticipant = () => {
    if (!candidate) return;
    if (!candidate.email) return enqueueSnackbar('El usuario no tiene correo institucional para la firma.', { variant: 'warning' });
    const doc = String(candidate.document || '').trim().toLowerCase();
    const email = String(candidate.email || '').trim().toLowerCase();
    if (form.participants.some((participant) => {
      const pDoc = String(participant.document || '').trim().toLowerCase();
      const pEmail = String(participant.email || '').trim().toLowerCase();
      return (candidate.id && String(participant.user_id) === String(candidate.id)) || (doc && pDoc === doc) || (email && pEmail === email);
    })) {
      return enqueueSnackbar('La persona ya está agregada.', { variant: 'info' });
    }
    setField('participants', [...form.participants, { user_id: candidate.id, document: candidate.document, name: formatPersonName(candidate.name), email: candidate.email, organization: candidate.organization, role_title: candidate.role_title, status: 'invited' }]);
    setCandidate(null);
    setDocumentNumber('');
  };

  const lookupResponsible = async () => {
    if (!responsibleDocument.trim()) return;
    setSearchingResponsible(true);
    setResponsibleCandidate(null);
    try {
      const response = await meetingMinuteService.lookupParticipant(responsibleDocument.trim());
      setResponsibleCandidate(response.data);
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
    if (!external.document || !external.name || !external.email || !external.role_title) return enqueueSnackbar('Complete cédula, nombre, correo y cargo.', { variant: 'warning' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(external.email)) return enqueueSnackbar('Digite un correo válido.', { variant: 'warning' });
    if (form.participants.some((participant) => String(participant.document || '').toLowerCase() === external.document.toLowerCase() || String(participant.email || '').toLowerCase() === external.email.toLowerCase())) return enqueueSnackbar('La persona ya está agregada.', { variant: 'info' });
    setField('participants', [...form.participants, { ...external, name: formatPersonName(external.name), user_id: null, status: 'invited', external: true }]);
    setExternalMode(false);
    setExternalDraft({ document: '', name: '', email: '', organization: '', role_title: '' });
    setDocumentNumber('');
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
    setField('participants', form.participants.filter((_, i) => i !== index));
  };

  const payload = () => ({
    id: form.id || undefined,
    documento_id: document.id,
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

  const save = async ({ quiet = false } = {}) => {
    if (!responsablesList.length || !form.responsables) {
      enqueueSnackbar('Consulte y seleccione primero al responsable de la reunión.', { variant: 'warning' });
      return null;
    }
    if (form.participants.length < 2) {
      enqueueSnackbar('Debe haber al menos dos participantes en la reunión (responsables y/o participantes convocados).', { variant: 'warning' });
      return null;
    }
    setLoading(true);
    try {
      const response = await meetingMinuteService.save(payload());
      const row = response.data;
      setForm((previous) => ({ ...previous, id: row.id, status: row.status, created_by: row.created_by || previous.created_by, participants: row.participants || previous.participants }));
      await loadMinutes();
      if (!quiet) enqueueSnackbar(form.status === 'draft' ? 'Borrador del acta guardado.' : 'Cambios del acta guardados exitosamente.', { variant: 'success' });
      return row;
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible guardar el acta.', { variant: 'error' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const publish = async () => {
    if (!responsablesList.length || !form.responsables) {
      enqueueSnackbar('Consulte y seleccione primero al responsable de la reunión.', { variant: 'warning' });
      return;
    }
    if (form.participants.length < 2) {
      enqueueSnackbar('Debe haber al menos dos participantes en la reunión (responsables y/o participantes convocados).', { variant: 'warning' });
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
  const showSigningAccess = async () => {
    if (!form.id) return;
    setLoading(true);
    try {
      const response = await meetingMinuteService.getSigningAccess(form.id, { public_base_url: window.location.origin });
      setQr(response.data);
      enqueueSnackbar(response.message || 'Acceso QR actualizado.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible recuperar el acceso de firma.', { variant: 'error' }); }
    finally { setLoading(false); }
  };
  const reopenForEditing = async () => {
    if (!form.id) return;
    setLoading(true);
    try {
      const response = await meetingMinuteService.reopen(form.id);
      setConfirmAdjust(false); setQr(null); setSignatures([]);
      await openMinute(form.id); await loadMinutes();
      enqueueSnackbar(response.message || 'El acta regresó a borrador.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible habilitar los ajustes.', { variant: 'error' }); }
    finally { setLoading(false); }
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
      anchor.download = `ACTA-${form.fecha || 'REUNION'}${isCopia ? '-COPIA' : ''}.pdf`;
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

  return <>
    <Dialog open={open} onClose={onClose} fullScreen PaperProps={{ sx: { bgcolor: '#f4f7fb', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}>
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
            <IconButton onClick={onClose} sx={{ color: '#fff', border: '1px solid rgba(255,255,255,.5)', borderRadius: 2 }}><Close /></IconButton>
          </Stack>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ p: { xs: 1.5, md: 2.5 }, flex: 1, overflow: { xs: 'auto', lg: 'hidden' }, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 2.5, width: '100%', height: { lg: '100%' }, minHeight: 0, flex: 1 }}>
          <Stack
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
            <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1.5} mb={2}>
                <Typography fontWeight={900}>Actas de reunión</Typography>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Button variant="outlined" onClick={() => { setForm(emptyForm(user)); setSignatures([]); setQr(null); setResponsibleDocument(''); setResponsibleCandidate(null); setExternalMode(false); }} sx={{ textTransform: 'none', fontWeight: 800 }}>Nueva acta</Button>
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
              <TextField fullWidth select size="small" label="Abrir un acta guardada" value={form.id} onChange={(event) => openMinute(event.target.value)}><MenuItem value="">Nueva acta</MenuItem>{minutes.map((minute) => <MenuItem key={minute.id} value={minute.id}>{minute.code} · {minute.content?.fecha || 'Sin fecha'} · {{ draft: 'Borrador', signing: 'En firmas', signed: 'Firmada', distributed: 'Enviada' }[minute.status] || minute.status}</MenuItem>)}</TextField>
            </Paper>
            {form.status === 'signing' && !allSigned && !hasSignatures && <Alert severity="info" sx={{ my: 1 }}>Las invitaciones personales ya fueron enviadas por correo. Puede volver a mostrar el QR, reenviar invitaciones o ajustar el acta.</Alert>}
            {form.status === 'signing' && hasSignatures && !allSigned && <Alert severity="info" sx={{ my: 1 }}>El acta tiene {signatures.length} firma(s) registrada(s). Como responsable puede seguir ajustando y guardando el contenido ante cualquier observación antes del envío final.</Alert>}
            {allSigned && <Alert severity="success" sx={{ my: 1 }}>Todas las personas firmaron el acta. Como responsable puede revisar, ajustar el texto si lo requiere y enviar el acta firmada a todos los participantes.</Alert>}
            <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3 }}>
              <Typography fontWeight={900} mb={2}>1. Información de la reunión</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 1.5 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ gridColumn: '1 / -1' }}>
                  <TextField
                    disabled={!canEdit}
                    fullWidth
                    label={responsablesList.length === 0 ? "Cédula del Responsable Principal *" : "Cédula de responsable o co-responsable"}
                    placeholder="Ingrese cédula y presione Consultar"
                    value={responsibleDocument}
                    onChange={(e) => {
                      setResponsibleDocument(e.target.value.replace(/[^0-9A-Za-z-]/g, ''));
                      setResponsibleCandidate(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        lookupResponsible();
                      }
                    }}
                  />
                  <Button
                    disabled={locked || searchingResponsible || !responsibleDocument}
                    variant="outlined"
                    startIcon={searchingResponsible ? <CircularProgress size={16} /> : <PersonSearch />}
                    onClick={lookupResponsible}
                    sx={{ minWidth: 135, textTransform: 'none', fontWeight: 800 }}
                  >
                    Consultar
                  </Button>
                </Stack>

                {responsibleCandidate && (
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
                      Consulte la cédula para asignar al <strong>Responsable Principal</strong> de la reunión.
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
                          {!locked && (
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

                <TextField disabled={!canEdit} fullWidth label="Dependencia que cita *" value={form.dependencia} onChange={(e) => setField('dependencia', e.target.value)} helperText="Asignada desde el responsable principal o editable si es conjunta." />
                <Autocomplete freeSolo disabled={!canEdit} options={MEETING_PLACES} value={form.lugar || ''} onChange={(_, value) => setField('lugar', value || '')} onInputChange={(_, value) => setField('lugar', value)} renderInput={(params) => <TextField {...params} fullWidth label="Lugar" helperText="Seleccione una opción o escriba otro lugar." />} />
                <TextField disabled={!canEdit} fullWidth type="date" InputLabelProps={{ shrink: true }} label="Fecha" value={form.fecha} onChange={(e) => setField('fecha', e.target.value)} />
                <TextField disabled={!canEdit} fullWidth type="time" InputLabelProps={{ shrink: true }} label="Hora de inicio" value={form.hora_inicio} onChange={(e) => setField('hora_inicio', e.target.value)} />
                <TextField disabled={!canEdit} fullWidth type="time" InputLabelProps={{ shrink: true }} label="Hora de finalización" value={form.hora_fin} onChange={(e) => setField('hora_fin', e.target.value)} />
                <RichTextEditor disabled={!canEdit} label="Objetivo *" value={form.objetivo} onChange={(value) => setField('objetivo', value)} minHeight={90} />
                <RichTextEditor disabled={!canEdit} label="Desarrollo de la reunión" value={form.desarrollo} onChange={(value) => setField('desarrollo', value)} minHeight={150} />
                <RichTextEditor disabled={!canEdit} label="Conclusiones / Compromisos" value={form.conclusiones} onChange={(value) => setField('conclusiones', value)} minHeight={120} />
              </Box>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} mb={1}>
                <Typography fontWeight={900}>2. Participantes y firmas</Typography>
                {form.participants.length >= 2 ? (
                  <Chip size="small" color="success" label={`${form.participants.length} personas en la reunión (${additionalParticipants.length} convocados)`} sx={{ fontWeight: 850 }} />
                ) : (
                  <Chip size="small" color="warning" label="Al menos 2 participantes requeridos" sx={{ fontWeight: 850 }} />
                )}
              </Stack>
              {form.participants.length < 2 && (
                <Alert severity="warning" sx={{ my: 1.5, borderRadius: 2 }}>
                  <strong>Participantes requeridos:</strong> Para habilitar firmas y generar el acta debe haber al menos dos participantes en la reunión (responsables y/o participantes convocados).
                </Alert>
              )}
              {canEdit && <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}><TextField fullWidth size="small" label="Cédula" value={documentNumber} onChange={(e) => { setDocumentNumber(e.target.value.replace(/[^0-9A-Za-z-]/g, '')); setCandidate(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookup(); } }} /><Button variant="outlined" startIcon={searching ? <CircularProgress size={16} /> : <PersonSearch />} disabled={searching || !documentNumber} onClick={lookup} sx={{ minWidth: 125, textTransform: 'none', fontWeight: 800 }}>Consultar</Button></Stack>}
              {candidate && <Paper variant="outlined" sx={{ p: 1.5, mt: 1.5, borderRadius: 2, bgcolor: '#f8fbff' }}><Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}><Box><Typography fontWeight={850}>{formatPersonName(candidate.name)}</Typography><Typography variant="body2" color="text.secondary">{candidate.role_title} · {candidate.organization}</Typography><Typography variant="caption">{candidate.email}</Typography></Box><Button variant="contained" startIcon={<Add />} onClick={addParticipant}>Agregar</Button></Stack></Paper>}
              {!externalMode && canEdit && <Button startIcon={<Add />} onClick={() => { setExternalDraft({ document: documentNumber, name: '', email: '', organization: '', role_title: '' }); setExternalMode(true); }} sx={{ mt: 1, textTransform: 'none', fontWeight: 800 }}>Agregar participante externo</Button>}
              {externalMode && canEdit && <Paper variant="outlined" sx={{ p: 1.5, mt: 1.5, borderRadius: 2.5, bgcolor: '#f8fbff' }}><Typography fontWeight={850} mb={1}>Participante externo para esta acta</Typography><Alert severity="info" sx={{ mb: 1.5 }}>Al recibir el código, esta persona también recibirá la política institucional y deberá aceptar el tratamiento de datos antes de firmar.</Alert><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 1 }}><TextField size="small" label="Cédula o identificación" value={externalDraft.document} onChange={(e) => setExternalDraft((old) => ({ ...old, document: e.target.value }))} /><TextField size="small" label="Nombre completo" value={externalDraft.name} onChange={(e) => setExternalDraft((old) => ({ ...old, name: e.target.value }))} /><TextField size="small" type="email" label="Correo empresarial o personal" value={externalDraft.email} onChange={(e) => setExternalDraft((old) => ({ ...old, email: e.target.value }))} /><TextField size="small" label="Cargo" value={externalDraft.role_title} onChange={(e) => setExternalDraft((old) => ({ ...old, role_title: e.target.value }))} /><TextField size="small" label="Empresa o entidad (opcional)" value={externalDraft.organization} onChange={(e) => setExternalDraft((old) => ({ ...old, organization: e.target.value }))} sx={{ gridColumn: { sm: '1 / -1' } }} /></Box><Stack direction="row" justifyContent="flex-end" gap={1} mt={1.25}><Button onClick={() => setExternalMode(false)}>Cancelar</Button><Button variant="contained" startIcon={<Add />} onClick={addExternalParticipant}>Agregar al acta</Button></Stack></Paper>}
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
                        {canEdit && participant.status !== 'signed' && (
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
                <ToggleButtonGroup
                  size="small"
                  value={previewType}
                  exclusive
                  onChange={(_, val) => val && setPreviewType(val)}
                  sx={{
                    height: 32,
                    bgcolor: '#f1f5f9',
                    p: 0.25,
                    borderRadius: 2,
                    '& .MuiToggleButton-root': {
                      textTransform: 'none',
                      px: 1.25,
                      py: 0.25,
                      fontSize: 11.5,
                      fontWeight: 800,
                      border: 'none',
                      borderRadius: '6px !important',
                      '&.Mui-selected': {
                        bgcolor: '#fff',
                        color: '#1e3a8a',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                      }
                    }
                  }}
                >
                  <ToggleButton value="original">Original (firmas)</ToggleButton>
                  <ToggleButton value="copia">Copia (ORIGINAL FIRMADO)</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
              <Box
                sx={{
                  display: { xs: 'grid', lg: 'flex' },
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' },
                  gap: 1,
                  '& .MuiButton-root': {
                    flex: { lg: '1 1 0' },
                    minWidth: 0,
                    minHeight: 46,
                    px: { xs: 1.5, lg: 0.75 },
                    py: 0.5,
                    textTransform: 'none',
                    fontWeight: 800,
                    fontSize: { xs: 12.5, lg: 11.5 },
                    lineHeight: 1.15,
                    whiteSpace: 'pre-line',
                    textAlign: 'center',
                    '& .MuiButton-startIcon': {
                      mr: { xs: 1, lg: 0.5 },
                      ml: 0
                    }
                  }
                }}
              >
                <Button fullWidth startIcon={<Download />} disabled={!form.id} onClick={(e) => setDownloadAnchorEl(e.currentTarget)} variant="outlined">{"Descargar\nPDF"}</Button>
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
                {form.status === 'signing' && <Button fullWidth startIcon={<QrCode2 />} disabled={loading} onClick={showSigningAccess} variant="outlined">{"Ver enlace\ny QR"}</Button>}
                {form.status === 'signing' && !allSigned && <Button fullWidth startIcon={<Email />} disabled={loading} onClick={resendInvitations} variant="outlined">{"Reenviar\ninvitaciones"}</Button>}
                {canEdit && (
                  <Button
                    fullWidth
                    startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Save />}
                    disabled={loading}
                    onClick={() => save()}
                    color="primary"
                    variant="contained"
                    sx={{ fontWeight: 850 }}
                  >
                    {form.status === 'draft' ? "Guardar\nborrador" : "Guardar\ncambios"}
                  </Button>
                )}
                {locked && <Button fullWidth startIcon={<Refresh />} disabled={loading} onClick={() => openMinute(form.id)} variant="outlined">{"Actualizar\nfirmas"}</Button>}
                {locked && canSendFinal && (
                  <Tooltip title={!allSigned ? `Se habilitará cuando todos los participantes hayan firmado (${pendingCount} pendiente${pendingCount === 1 ? '' : 's'})` : 'Enviar versión final del acta con firmas a todos los participantes'}>
                    <span>
                      <Button
                        fullWidth
                        startIcon={<Send />}
                        disabled={loading || !allSigned}
                        onClick={sendFinal}
                        color="success"
                        variant={allSigned ? "contained" : "outlined"}
                        sx={{ fontWeight: 850 }}
                      >
                        {form.status === 'distributed' ? "Reenviar acta\nfirmada" : "Enviar acta\nfirmada"}
                      </Button>
                    </span>
                  </Tooltip>
                )}
                {!locked && (
                  <Tooltip title={!additionalParticipants.length ? 'Debe agregar al menos 1 participante adicional en la sección 2' : ''}>
                    <span>
                      <Button fullWidth startIcon={<Email />} onClick={publish} disabled={loading || !additionalParticipants.length} variant="contained" sx={{ fontWeight: 850 }}>{"Habilitar y enviar\ninvitaciones"}</Button>
                    </span>
                  </Tooltip>
                )}
              </Box>
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
      <DialogActions sx={{ px: { xs: 2, md: 4 }, py: 1.5, bgcolor: '#fff', borderTop: '1px solid #dbe5f0', flexShrink: 0, justifyContent: 'space-between' }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Button onClick={onClose}>Cerrar</Button>
          {layoutMode === 'form' && (
            <Button startIcon={<Visibility />} onClick={() => setLayoutMode('preview')} sx={{ textTransform: 'none', fontWeight: 800 }}>
              Ver vista previa
            </Button>
          )}
          {layoutMode === 'preview' && (
            <Button startIcon={<EditNote />} onClick={() => setLayoutMode('form')} sx={{ textTransform: 'none', fontWeight: 800 }}>
              Volver al formulario
            </Button>
          )}
        </Stack>
        {canEdit && (
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Save />}
            disabled={loading}
            onClick={() => save()}
            sx={{ px: 3, textTransform: 'none', fontWeight: 900 }}
          >
            {form.status === 'draft' ? 'Guardar borrador' : 'Guardar cambios del acta'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
    <Dialog open={Boolean(qr)} onClose={() => setQr(null)} maxWidth="xs" fullWidth><DialogTitle fontWeight={900}>Acceso para firmar</DialogTitle><DialogContent><Stack alignItems="center" gap={1.5}><Alert severity="info">Este QR y enlace sirven como alternativa presencial. Los enlaces personales enviados por correo continúan funcionando de manera independiente.</Alert>{qr?.qr_data_url && <Box component="img" src={qr.qr_data_url} alt="QR alternativo para firmar" sx={{ width: 260, height: 260 }} />}<TextField fullWidth size="small" value={qr?.signing_url || ''} InputProps={{ readOnly: true }} /><Button startIcon={<ContentCopy />} onClick={() => { navigator.clipboard.writeText(qr?.signing_url || ''); enqueueSnackbar('Enlace copiado.', { variant: 'success' }); }}>Copiar enlace alternativo</Button></Stack></DialogContent><DialogActions><Button onClick={() => setQr(null)}>Cerrar</Button></DialogActions></Dialog>
    <Dialog open={confirmAdjust} onClose={() => !loading && setConfirmAdjust(false)} maxWidth="sm" fullWidth><DialogTitle fontWeight={900}>Regresar el acta a borrador</DialogTitle><DialogContent><Alert severity="warning" sx={{ mt: 1 }}>Los enlaces de firma y el QR actuales dejarán de funcionar. Después de ajustar el acta deberá habilitar y enviar nuevamente las invitaciones.</Alert></DialogContent><DialogActions><Button disabled={loading} onClick={() => setConfirmAdjust(false)}>Cancelar</Button><Button disabled={loading} onClick={reopenForEditing} color="warning" variant="contained">Regresar y editar</Button></DialogActions></Dialog>
  </>;
}
