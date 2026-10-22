import React from 'react';
import { Box, Typography } from '@mui/material';
import fr012Header from '../../assets/fr012-header.png';
import fr012Footer from '../../assets/fr012-footer.png';
import { sanitizeRichHtml } from './RichTextEditor';
import formatPersonName from '../../utils/formatPersonName';

const SPANISH_MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

export const formatCouncilDateLabel = (ciudad = 'San Juan de Pasto', fecha = '', fechaTexto = '') => {
  if (fechaTexto && String(fechaTexto).trim()) {
    return String(fechaTexto).trim();
  }
  const cleanCity = String(ciudad || 'San Juan de Pasto').trim() || 'San Juan de Pasto';
  const rawDate = String(fecha || '').trim();
  const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    const monthName = SPANISH_MONTHS[monthIndex] || match[2];
    return `${cleanCity}, ${day} de ${monthName} de ${year}`;
  }
  if (rawDate) {
    return cleanCity ? `${cleanCity}, ${rawDate}` : rawDate;
  }
  return cleanCity;
};

export const formatActaHeading = (numeroActa = '') => {
  const clean = String(numeroActa || '').trim();
  if (!clean) return 'ACTA';
  if (/^ACTA\b/i.test(clean)) return clean.toLocaleUpperCase('es');
  return `ACTA  ${clean.toLocaleUpperCase('es')}`;
};

export const formatCouncilMemberLine = (member = {}) => {
  const rawName = formatPersonName(member.nombre || member.name || '');
  const cargo = String(member.cargo_acta || member.cargo || member.role_title || '').trim();
  if (!rawName && !cargo) return '';
  return [rawName, cargo].filter(Boolean).join(', ');
};

export const formatCouncilSignerUpperName = (member = {}) => {
  const rawName = String(member.nombre || member.name || '').replace(/\s+/g, ' ').trim();
  return rawName.toLocaleUpperCase('es');
};

const formatDocFooterDate = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '15/SEP/2023';
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const m = months[Number(match[2]) - 1] || match[2];
    return `${match[3]}/${m}/${match[1]}`;
  }
  return raw;
};

const richBlockSx = {
  fontSize: 12.5,
  lineHeight: 1.48,
  textAlign: 'justify',
  color: '#111827',
  minHeight: 36,
  '& p': { my: 0.45 },
  '& h2, & h3': { my: 0.6 },
  '& a': { color: '#1d5fd1', textDecoration: 'underline' },
  '& blockquote': { my: 0.6, mx: 0, pl: 1.2, borderLeft: '3px solid #94a3b8' },
  '& hr': { border: 0, borderTop: '1px solid #94a3b8' },
  '& ul, & ol': { my: 0.5, pl: 2.8 },
  '& table': {
    width: '100%',
    maxWidth: '100%',
    tableLayout: 'fixed',
    borderCollapse: 'collapse',
    my: 0.75,
    boxSizing: 'border-box'
  },
  '& th, & td': {
    border: '1px solid #334155',
    p: 0.7,
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    verticalAlign: 'top',
    boxSizing: 'border-box'
  },
  '& th': { bgcolor: '#f1f5f9', fontWeight: 800 }
};

export default function CouncilMinutePreview({
  document,
  form = {},
  signatures = [],
  previewType = 'original'
}) {
  const signedSet = new Set((signatures || []).map((s) => String(s.participant_id)));
  const signatureByParticipant = new Map((signatures || []).map((s) => [String(s.participant_id), s]));

  const participants = Array.isArray(form.participants) ? form.participants : [];
  const metaList = Array.isArray(form.participantes_meta) ? form.participantes_meta : [];

  const enrichParticipant = (p) => {
    const pDoc = String(p.document || '').trim().toLowerCase();
    const pEmail = String(p.email || '').trim().toLowerCase();
    const meta = metaList.find((m) => (
      (pDoc && m?.document && String(m.document).trim().toLowerCase() === pDoc)
      || (pEmail && m?.email && String(m.email).trim().toLowerCase() === pEmail)
    )) || {};
    return {
      ...p,
      attendance_type: p.attendance_type || meta.attendance_type || 'asistente',
      member_kind: p.member_kind || meta.member_kind || (p.attendance_type === 'invitado' || meta.attendance_type === 'invitado' ? 'invitado' : 'miembro'),
      requires_signature: p.requires_signature ?? meta.requires_signature ?? true,
      cargo_acta: p.cargo_acta || meta.cargo_acta || p.role_title || p.cargo || ''
    };
  };

  const enrichedParticipants = participants.map(enrichParticipant);
  const asistentes = enrichedParticipants.filter(
    (p) => p.member_kind !== 'invitado'
  );
  const invitadosConFirma = enrichedParticipants.filter(
    (p) => p.member_kind === 'invitado'
  );
  const listaInicial = Array.isArray(form.invitados_sin_firma_data) ? form.invitados_sin_firma_data : [];
  const invitadosSinFirma = listaInicial.filter((item) => item.member_kind === 'invitado');
  const pendientes = listaInicial.filter((item) => item.member_kind !== 'invitado');
  const invitados = [...invitadosConFirma, ...invitadosSinFirma];
  const ausentes = (Array.isArray(form.ausentes_data) ? form.ausentes_data : [])
    .filter((item) => item.member_kind !== 'invitado');
  const firmantes = enrichedParticipants.filter((participant) => participant.requires_signature !== false);
  const totalConvocados = asistentes.length + pendientes.length + ausentes.length;
  const quorumMinimo = totalConvocados ? Math.floor(totalConvocados / 2) + 1 : 0;
  const quorumCompleto = pendientes.length === 0;
  const hayQuorum = quorumCompleto && asistentes.length >= quorumMinimo;

  const councilTitle = String(
    form.nombre_consejo || form.dependencia || 'NOMBRE DEL CONSEJO O COMITÉ'
  ).trim().toLocaleUpperCase('es');
  const actaLabel = formatActaHeading(form.numero_acta || '01');
  const fechaDisplay = formatCouncilDateLabel(form.ciudad || 'San Juan de Pasto', form.fecha, form.fecha_texto);
  const horarioDisplay = form.horario || [form.hora_inicio, form.hora_fin].filter(Boolean).join(' - ');
  const ordenDelDiaHtml = Array.isArray(form.orden_del_dia)
    ? form.orden_del_dia.join('<br>')
    : (form.orden_del_dia || (Array.isArray(form.objetivo) ? form.objetivo.join('<br>') : form.objetivo) || '');
  const desarrolloHtml = Array.isArray(form.desarrollo)
    ? form.desarrollo.join('<br>')
    : (form.desarrollo || '');
  const compromisosHtml = Array.isArray(form.compromisos)
    ? form.compromisos.join('<br>')
    : (form.compromisos || (Array.isArray(form.conclusiones) ? form.conclusiones.join('<br>') : form.conclusiones) || '');
  const anexoText = String(form.anexo || '').trim();

  const codigoDoc = document?.codigo || form.header?.codigo || 'COM-GD-FR-012';
  const versionDoc = document?.version || form.header?.version || '2';
  const fechaDoc = formatDocFooterDate(document?.fecha_creacion || form.header?.fecha || '2023-09-15');

  const renderPopulationTable = (title, list = [], emptyText) => (
    <Box sx={{ mb: 1.5, breakInside: 'avoid' }}>
      <Box sx={{ px: 1, py: 0.65, bgcolor: '#e2e8f0', border: '1px solid #64748b', fontSize: 11.5, fontWeight: 900 }}>
        {title}
      </Box>
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 10.75 }}>
        <Box component="thead">
          <Box component="tr" sx={{ bgcolor: '#f8fafc' }}>
            <Box component="th" sx={{ width: 36, border: '1px solid #94a3b8', p: 0.55 }}>N°</Box>
            <Box component="th" sx={{ border: '1px solid #94a3b8', p: 0.55 }}>Nombres y apellidos</Box>
            <Box component="th" sx={{ width: '34%', border: '1px solid #94a3b8', p: 0.55 }}>Cargo / representación</Box>
          </Box>
        </Box>
        <Box component="tbody">
          {list.length ? list.map((member, index) => (
            <Box component="tr" key={member.id || member.user_id || member.document || member.email || `${title}-${index}`}>
              <Box component="td" sx={{ border: '1px solid #94a3b8', p: 0.6, textAlign: 'center' }}>{index + 1}</Box>
              <Box component="td" sx={{ border: '1px solid #94a3b8', p: 0.6, fontWeight: 700 }}>{formatPersonName(member.nombre || member.name || '')}</Box>
              <Box component="td" sx={{ border: '1px solid #94a3b8', p: 0.6 }}>{member.cargo_acta || member.cargo || member.role_title || member.organization || ''}</Box>
            </Box>
          )) : (
            <Box component="tr">
              <Box component="td" colSpan={3} sx={{ border: '1px solid #94a3b8', p: 0.75, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>
                {emptyText}
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        border: '1px solid #cbd5e1',
        borderRadius: 1.5,
        bgcolor: '#ffffff',
        color: '#111827',
        fontFamily: 'Arial, sans-serif',
        minWidth: 640,
        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        p: { xs: 2.5, md: 4 }
      }}
    >
      {/* Encabezado Institucional FR-012 */}
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2.5 }}>
          <Box
            component="img"
            src={fr012Header}
            alt="Encabezado Universidad CESMAG - COM-GD-FR-012"
            sx={{ width: '100%', maxWidth: 620, height: 'auto', objectFit: 'contain' }}
          />
        </Box>

        {/* Títulos centrados: NOMBRE DEL CONSEJO / ACTA XX */}
        <Typography
          sx={{
            fontFamily: 'Arial, sans-serif',
            fontWeight: 900,
            fontSize: 14,
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: 0.3,
            color: '#0f172a',
            mb: 1
          }}
        >
          {councilTitle}
        </Typography>
        <Typography
          sx={{
            fontFamily: 'Arial, sans-serif',
            fontWeight: 900,
            fontSize: 13.5,
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            color: '#0f172a',
            mb: 2.5
          }}
        >
          {actaLabel}
        </Typography>

        {/* Bloque de metadatos sin bordes externos (fiel a FR-012) */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '125px 1fr',
            rowGap: 1.1,
            columnGap: 1.5,
            fontSize: 12.5,
            mb: 2.5,
            alignItems: 'start'
          }}
        >
          <Box sx={{ fontWeight: 900 }}>FECHA:</Box>
          <Box>{fechaDisplay}</Box>

          <Box sx={{ fontWeight: 900 }}>HORA:</Box>
          <Box>{horarioDisplay}</Box>

          <Box sx={{ fontWeight: 900 }}>LUGAR:</Box>
          <Box>{form.lugar || ''}</Box>

        </Box>

        {renderPopulationTable('ASISTENTES', asistentes, 'Sin asistentes registrados')}
        {renderPopulationTable('INVITADOS', invitados, 'Sin invitados registrados')}
        {pendientes.length > 0 && renderPopulationTable('PENDIENTES POR CLASIFICAR', pendientes, '')}
        {renderPopulationTable('AUSENTES', ausentes, 'Sin ausentes registrados')}
        <Box sx={{ mb: 2, border: '1px solid #64748b', bgcolor: '#f8fafc', px: 1.2, py: 0.9, fontSize: 11 }}>
          <Box component="span" sx={{ fontWeight: 900 }}>CONTROL DE QUÓRUM: </Box>
          {asistentes.length} asistentes de {totalConvocados} convocados · mínimo requerido {quorumMinimo} ·{' '}
          <Box component="span" sx={{ fontWeight: 900, color: quorumCompleto ? (hayQuorum ? '#15803d' : '#b91c1c') : '#b45309' }}>
            {quorumCompleto ? (hayQuorum ? 'HAY QUÓRUM' : 'NO HAY QUÓRUM') : `${pendientes.length} PENDIENTE(S) POR CLASIFICAR`}
          </Box>
        </Box>

        {/* ORDEN DEL DÍA */}
        <Box sx={{ mb: 2.25 }}>
          <Typography sx={{ fontFamily: 'Arial, sans-serif', fontWeight: 900, fontSize: 12.5, mb: 0.75 }}>
            ORDEN DEL DÍA:
          </Typography>
          <Box
            sx={richBlockSx}
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(ordenDelDiaHtml) }}
          />
        </Box>

        {/* DESARROLLO */}
        <Box sx={{ mb: 2.25 }}>
          <Typography sx={{ fontFamily: 'Arial, sans-serif', fontWeight: 900, fontSize: 12.5, mb: 0.75 }}>
            DESARROLLO:
          </Typography>
          <Box
            sx={richBlockSx}
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(desarrolloHtml) }}
          />
        </Box>

        {/* COMPROMISOS */}
        <Box sx={{ mb: 2.75 }}>
          <Typography sx={{ fontFamily: 'Arial, sans-serif', fontWeight: 900, fontSize: 12.5, mb: 0.75 }}>
            COMPROMISOS.
          </Typography>
          <Box
            sx={richBlockSx}
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(compromisosHtml) }}
          />
        </Box>

        {/* FIRMAS DE LOS ASISTENTES */}
        <Box sx={{ mt: 3, mb: 2 }}>
          <Typography sx={{ fontFamily: 'Arial, sans-serif', fontWeight: 900, fontSize: 12.5, mb: 2 }}>
            FIRMAS DE LOS ASISTENTES
          </Typography>

          {firmantes.length === 0 ? (
            <Typography sx={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', py: 1 }}>
              (Agregue asistentes firmantes en la sección 2 para visualizar los bloques de firma)
            </Typography>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                columnGap: 4,
                rowGap: 3,
                mt: 1
              }}
            >
              {firmantes.map((participant, idx) => {
                const isLastOdd = firmantes.length % 2 === 1 && idx === firmantes.length - 1;
                const signature = signatureByParticipant.get(String(participant.id));
                const isSigned = signedSet.has(String(participant.id)) || participant.status === 'signed';
                const showGraphic = previewType !== 'copia' && Boolean(signature?.signature_preview);
                const upperName = formatCouncilSignerUpperName(participant);
                const cargoLabel = String(participant.cargo_acta || participant.role_title || participant.cargo || '').trim();

                return (
                  <Box
                    key={participant.id || participant.user_id || `${participant.document}-${idx}`}
                    sx={{
                      gridColumn: isLastOdd ? '1 / -1' : 'auto',
                      maxWidth: isLastOdd ? 320 : '100%',
                      mx: isLastOdd ? 'auto' : 0,
                      width: '100%',
                      textAlign: 'center',
                      pt: 1
                    }}
                  >
                    <Box
                      sx={{
                        minHeight: 48,
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        pb: 0.5,
                        borderBottom: '1px solid #334155',
                        mb: 0.75
                      }}
                    >
                      {showGraphic ? (
                        <Box
                          component="img"
                          src={signature.signature_preview}
                          alt={`Firma de ${upperName}`}
                          sx={{ maxWidth: 165, height: 42, objectFit: 'contain' }}
                        />
                      ) : isSigned ? (
                        <Box component="span" sx={{ color: '#166534', fontWeight: 900, fontSize: 11, letterSpacing: 0.3 }}>
                          ORIGINAL FIRMADO
                        </Box>
                      ) : (
                        <Box component="span" sx={{ color: '#64748b', fontStyle: 'italic', fontSize: 11 }}>
                          Pendiente · QR / Correo
                        </Box>
                      )}
                    </Box>
                    <Typography sx={{ fontFamily: 'Arial, sans-serif', fontWeight: 900, fontSize: 11.5, color: '#0f172a', lineHeight: 1.25 }}>
                      {upperName}
                    </Typography>
                    {cargoLabel && (
                      <Typography sx={{ fontFamily: 'Arial, sans-serif', fontSize: 11.5, color: '#1e293b', lineHeight: 1.25 }}>
                        {cargoLabel}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        {/* Anexo */}
        {anexoText && (
          <Box sx={{ mt: 2, mb: 1.5, fontSize: 12 }}>
            <Box component="span">Anexo: </Box>
            <Box component="span">{anexoText}</Box>
          </Box>
        )}
      </Box>

      {/* Pie de página Institucional FR-012 */}
      <Box sx={{ mt: 4, pt: 1.5, borderTop: '1px dashed #e2e8f0' }}>
        <Typography sx={{ fontFamily: 'Arial, sans-serif', fontWeight: 800, fontSize: 11, textAlign: 'right', mb: 0.75 }}>
          Página 1 de 1
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}>
          <Box
            component="img"
            src={fr012Footer}
            alt="Pie de página Universidad CESMAG - COM-GD-FR-012"
            sx={{ width: '100%', maxWidth: 640, height: 'auto', objectFit: 'contain' }}
          />
        </Box>
        <Typography
          sx={{
            fontFamily: 'Arial, sans-serif',
            fontSize: 10.5,
            color: '#002060',
            textAlign: 'center',
            lineHeight: 1.35
          }}
        >
          Carrera 20A 14-54, PBX 7244434 – Pasto, Nariño, Colombia – correspondencia@unicesmag.edu.co – www.unicesmag.edu.co
        </Typography>
        <Typography
          sx={{
            fontFamily: 'Arial, sans-serif',
            fontSize: 10,
            color: '#808080',
            textAlign: 'center',
            mt: 0.25
          }}
        >
          {codigoDoc}. - V.{versionDoc} - {fechaDoc}
        </Typography>
      </Box>
    </Box>
  );
}
