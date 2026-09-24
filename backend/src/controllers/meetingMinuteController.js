const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { OAuth2Client } = require('google-auth-library');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  DigitalMeetingMinute, DigitalMeetingParticipant, DigitalMeetingSignature,
  Documento, User
} = require('../models');
const {
  getMeetingMinuteFeatureState, isMeetingMinuteDocument, setMeetingMinuteFeatureState
} = require('../config/meetingMinuteConfig');
const { generateActaBuffer } = require('../services/actaExportService');
const { generateMeetingMinutePdf } = require('../services/meetingMinutePdfService');
const { sendInstitutionalEmail, renderInstitutionalTemplate, escapeHtml } = require('../services/emailService');
const {
  PRIVACY_POLICY_NOTICE, PRIVACY_POLICY_URL, PRIVACY_POLICY_VERSION
} = require('../constants/privacyPolicy');
const { formatPersonName } = require('../utils/formatPersonName');

const PRIVATE_ROOT = path.resolve(process.env.SIAC_MEETING_MINUTE_DIR || path.join(__dirname, '../../uploads/.private/digital-meeting-minutes'));
const SIGNATURE_ROOT = path.join(PRIVATE_ROOT, 'signatures');
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const hash = (value) => crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : String(value || '')).digest('hex');
const contentHash = (value) => hash(JSON.stringify(value));
const isAdmin = (user) => String(user?.role || '') === 'administrador';
const clean = (value, max = 8000) => String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
const maskAndEncryptIp = (ip = '') => {
  if (!ip) return null;
  const cleanIp = String(ip).replace(/^::ffff:/, '').trim();
  if (cleanIp === '::1' || cleanIp === '127.0.0.1') {
    return '127.***.***.1 (Protegida · Cifrada)';
  }
  const parts = cleanIp.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.*** (Protegida · Cifrada)`;
  }
  if (cleanIp.includes(':')) {
    const v6 = cleanIp.split(':');
    return `${v6.slice(0, 2).join(':')}:****:**** (Protegida · Cifrada)`;
  }
  return '***.***.***.*** (Protegida · Cifrada)';
};
const cleanRichText = (value) => String(value || '').replace(/\u0000/g, '').trim();
const buildPrivacyPolicyEmailSection = (isExternal) => {
  if (!isExternal) return { html: '', text: '' };
  const paragraphs = PRIVACY_POLICY_NOTICE.split('\n\n').map((paragraph) => `<p style="margin:0 0 12px;line-height:1.65">${escapeHtml(paragraph)}</p>`).join('');
  return {
    html: `<div style="margin:20px 0;padding:18px;border:1px solid #bfdbfe;border-radius:12px;background:#f8fbff"><h3 style="margin:0 0 12px;color:#174ea6">Autorización para el tratamiento de datos personales</h3>${paragraphs}<p style="margin:12px 0"><a href="${PRIVACY_POLICY_URL}" target="_blank" rel="noopener noreferrer">Consultar la política institucional completa</a></p><p style="margin:12px 0 0;font-weight:700">Para continuar, abra el acta y marque la casilla de autorización antes de confirmar su firma.</p></div>`,
    text: `\n\nAUTORIZACIÓN PARA EL TRATAMIENTO DE DATOS PERSONALES\n\n${PRIVACY_POLICY_NOTICE}\n\nPara continuar, abra el acta y marque la casilla de autorización antes de confirmar su firma.`
  };
};
const RICH_TAGS = new Set(['div', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote', 'hr', 'a', 'span', 'font', 'table', 'thead', 'tbody', 'tr', 'th', 'td']);
const sanitizeRichText = (value) => cleanRichText(value)
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
  .replace(/<(\/)?([a-z0-9]+)([^>]*)>/gi, (source, closing, rawTag, attributes) => {
    const tag = rawTag.toLowerCase();
    if (!RICH_TAGS.has(tag)) return '';
    if (closing) return tag === 'br' || tag === 'hr' ? '' : `</${tag}>`;
    if (tag === 'br' || tag === 'hr') return `<${tag}>`;
    const alignment = /text-align\s*:\s*(left|center|right|justify)/i.exec(attributes || '')?.[1]?.toLowerCase();
    const color = /(?:color\s*:\s*)(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))/i.exec(attributes || '')?.[1]
      || /\bcolor\s*=\s*["']([^"']+)["']/i.exec(attributes || '')?.[1];
    const fontFamily = /font-family\s*:\s*([^;"']+)/i.exec(attributes || '')?.[1]?.trim()
      || /\bface\s*=\s*["']([^"']+)["']/i.exec(attributes || '')?.[1]?.trim();
    const fontSize = /font-size\s*:\s*(\d{1,2})(px|pt)/i.exec(attributes || '');
    const indent = /margin-left\s*:\s*(\d{1,3})px/i.exec(attributes || '')?.[1];
    const styles = [];
    if (alignment) styles.push(`text-align:${alignment}`);
    if (color && /^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i.test(color)) styles.push(`color:${color}`);
    if (fontFamily && /^(Arial|Georgia|Times New Roman|Verdana|sans-serif)$/i.test(fontFamily)) styles.push(`font-family:${fontFamily}`);
    if (fontSize) styles.push(`font-size:${Math.min(32, Math.max(9, Number(fontSize[1])))}${fontSize[2].toLowerCase()}`);
    if (indent) styles.push(`margin-left:${Math.min(200, Number(indent))}px`);
    const style = styles.length ? ` style="${styles.join(';')}"` : '';
    if (tag === 'a') {
      const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(attributes || '')?.[1] || '';
      if (!/^(https?:\/\/|mailto:)/i.test(href)) return '';
      return `<a href="${href.replace(/["<>]/g, '')}" target="_blank" rel="noopener noreferrer"${style}>`;
    }
    const legacySize = /\bsize\s*=\s*["']?([1-7])["']?/i.exec(attributes || '')?.[1];
    return `<${tag}${style}${tag === 'font' && legacySize ? ` size="${legacySize}"` : ''}>`;
  });
const richPlainText = (value) => sanitizeRichText(value).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
const participantIdentity = (participant = {}) => ({
  document: clean(participant.document, 100).toLowerCase(),
  email: clean(participant.email, 254).toLowerCase()
});
const participantRoleLabel = (participant = {}) => {
  const role = clean(participant.role_title, 220);
  const organization = clean(participant.organization, 240);
  return !participant.user_id && organization ? [organization, role].filter(Boolean).join(' · ') : (role || organization);
};
const placeResponsibleFirst = (participants = [], responsible = {}) => {
  const responsiblesList = Array.isArray(responsible) ? responsible : [responsible];
  const respParticipants = responsiblesList.filter(Boolean).map((r) => ({
    user_id: r.id || r.user_id || null,
    document: clean(r.username || r.document, 100),
    name: clean(r.nombre || r.name, 240),
    email: clean(r.email, 254).toLowerCase(),
    organization: clean(r.dependencia || r.organization, 240),
    role_title: clean(r.cargo || r.role_title, 220),
    status: 'invited'
  }));
  const seen = new Set();
  const uniqueResponsibles = [];
  for (const resp of respParticipants) {
    const key = participantIdentity(resp);
    const idStr = key.document ? `doc:${key.document}` : (key.email ? `email:${key.email}` : null);
    if (!idStr || !seen.has(idStr)) {
      if (idStr) seen.add(idStr);
      uniqueResponsibles.push(resp);
    }
  }
  return [
    ...uniqueResponsibles,
    ...participants.filter((participant) => {
      const participantKey = participantIdentity(participant);
      return !uniqueResponsibles.some((resp) => {
        const rKey = participantIdentity(resp);
        return (rKey.document && participantKey.document === rKey.document)
          || (rKey.email && participantKey.email === rKey.email);
      });
    })
  ];
};
const formatDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : clean(value, 50);
};
const publicFrontend = (req) => clean(req.body?.public_base_url || process.env.PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`, 500).replace(/\/$/, '');

const minuteThreadSubject = (minuteCode) => `${minuteCode} · Acta de reunión`;

const minuteRootMessageId = (minuteCode) => {
  const safeCode = String(minuteCode || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  return `<minute.${safeCode}@unicesmag.edu.co>`;
};

const minuteParticipantMessageId = (minuteCode, recipientEmail) => {
  const safeCode = String(minuteCode || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const safeEmail = String(recipientEmail || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `<minute.${safeCode}.${safeEmail}@unicesmag.edu.co>`;
};

const resolveMinutePrimaryResponsible = async (minute) => {
  const content = minute?.content || {};
  const data = Array.isArray(content.responsables_data) ? content.responsables_data : [];
  const primary = data.find((r) => r.is_primary) || data[0];
  if (primary?.email) {
    return {
      name: formatPersonName(primary.name || primary.nombre || 'Responsable de la reunión'),
      email: clean(primary.email, 254).toLowerCase()
    };
  }
  const doc = primary?.document || content.responsable_document;
  if (doc) {
    const user = await User.findOne({ where: { username: doc }, attributes: ['nombre', 'email'] });
    if (user?.email) {
      return {
        name: formatPersonName(user.nombre),
        email: clean(user.email, 254).toLowerCase()
      };
    }
  }
  if (minute?.created_by) {
    const creator = await User.findByPk(minute.created_by, { attributes: ['nombre', 'email'] });
    if (creator?.email) {
      return {
        name: formatPersonName(creator.nombre),
        email: clean(creator.email, 254).toLowerCase()
      };
    }
  }
  return null;
};

const resolveMinuteResponsibleEmails = async (minute) => {
  const content = minute?.content || {};
  const data = Array.isArray(content.responsables_data) ? content.responsables_data : [];
  const emails = new Set();
  for (const r of data) {
    if (r.email) emails.add(clean(r.email, 254).toLowerCase());
    else if (r.document) {
      const u = await User.findOne({ where: { username: String(r.document).trim() }, attributes: ['email'] });
      if (u?.email) emails.add(clean(u.email, 254).toLowerCase());
    }
  }
  if (content.responsable_document) {
    const u = await User.findOne({ where: { username: String(content.responsable_document).trim() }, attributes: ['email'] });
    if (u?.email) emails.add(clean(u.email, 254).toLowerCase());
  }
  if (content.responsable_email) {
    emails.add(clean(content.responsable_email, 254).toLowerCase());
  }
  if (minute?.created_by) {
    const creator = await User.findByPk(minute.created_by, { attributes: ['email'] });
    if (creator?.email) emails.add(clean(creator.email, 254).toLowerCase());
  }
  return emails;
};

const canAccessMinuteFullSignatures = async (user, minute) => {
  if (!user || !minute) return false;
  if (isAdmin(user)) return true;
  const userId = Number(user.id);
  if (minute.created_by && Number(minute.created_by) === userId) return true;
  const userDoc = String(user.username || user.documento || user.cedula || '').trim().toLowerCase();
  const userEmail = clean(user.email, 254).toLowerCase();
  const userName = String(user.nombre || user.name || '').trim().toLowerCase();
  const content = minute.content || {};
  const data = Array.isArray(content.responsables_data) ? content.responsables_data : [];
  const isResp = data.some((r) =>
    (userDoc && r.document && String(r.document).trim().toLowerCase() === userDoc) ||
    (userId && r.user_id && Number(r.user_id) === userId) ||
    (userEmail && r.email && clean(r.email, 254).toLowerCase() === userEmail) ||
    (userName && (r.name || r.nombre) && String(r.name || r.nombre).trim().toLowerCase() === userName)
  ) || (userDoc && content.responsable_document && String(content.responsable_document).trim().toLowerCase() === userDoc)
    || (userEmail && content.responsable_email && clean(content.responsable_email, 254).toLowerCase() === userEmail)
    || (userName && content.responsable_nombre && String(content.responsable_nombre).trim().toLowerCase() === userName);
  return Boolean(isResp);
};

const buildSigningInvitationEmail = ({ participant, minute, signingUrl, responsible }) => {
  const externalPolicy = buildPrivacyPolicyEmailSection(!participant.user_id);
  const meetingDate = formatDate(minute.content?.fecha);
  const dependencia = minute.content?.dependencia || 'Universidad CESMAG';
  const rawObjetivo = Array.isArray(minute.content?.objetivo) ? minute.content.objetivo.join(' ') : (minute.content?.objetivo || '');
  const cleanObjetivo = String(rawObjetivo).replace(/<[^>]+>/g, '').trim();
  const truncatedObjetivo = cleanObjetivo.length > 250 ? `${cleanObjetivo.substring(0, 247)}...` : cleanObjetivo;
  const respNombre = responsible?.name || 'Responsable de la reunión';
  const respEmail = responsible?.email || '';

  const subject = `${minute.code} · Solicitud de firma de acta de reunión`;

  const introHtml = `
    <p style="margin:0 0 10px;font-size:17px;font-weight:800;color:#1e3a8a;letter-spacing:0.3px;">ACTA N° ${escapeHtml(minute.code)}</p>
    <p style="margin:0 0 12px;font-size:15px;color:#334155;">Cordial saludo de paz y bien,</p>
    <p style="margin:0 0 12px;font-size:14px;color:#334155;">Estimado(a) <strong>${escapeHtml(participant.name)}</strong>:</p>
    <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">Se convoca a su revisión y firma el acta de reunión institucional <strong>${escapeHtml(minute.code)}</strong>.</p>
  `;

  const bodyHtml = `
    <div style="margin:16px 0;padding:16px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;">
      <p style="margin:0 0 10px;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">Contexto de la reunión</p>
      <table style="width:100%;border-collapse:collapse;font-size:13.5px;color:#1e293b;">
        <tr>
          <td style="padding:4px 0;width:130px;color:#64748b;"><strong>N° Acta:</strong></td>
          <td style="padding:4px 0;font-weight:700;">${escapeHtml(minute.code)}</td>
        </tr>
        ${meetingDate ? `<tr><td style="padding:4px 0;color:#64748b;"><strong>Fecha:</strong></td><td style="padding:4px 0;">${escapeHtml(meetingDate)}</td></tr>` : ''}
        ${dependencia ? `<tr><td style="padding:4px 0;color:#64748b;"><strong>Dependencia:</strong></td><td style="padding:4px 0;">${escapeHtml(dependencia)}</td></tr>` : ''}
        ${truncatedObjetivo ? `<tr><td style="padding:4px 0;color:#64748b;vertical-align:top;"><strong>Objetivo:</strong></td><td style="padding:4px 0;">${escapeHtml(truncatedObjetivo)}</td></tr>` : ''}
        ${respNombre ? `<tr><td style="padding:4px 0;color:#64748b;"><strong>Responsable:</strong></td><td style="padding:4px 0;">${escapeHtml(respNombre)}${respEmail ? ` (${escapeHtml(respEmail)})` : ''}</td></tr>` : ''}
      </table>
    </div>

    <div style="margin:20px 0;padding:20px;border:1px solid #bfdbfe;border-radius:12px;background:#eff6ff;text-align:center;">
      <p style="margin:0 0 14px;font-size:14px;color:#1e3a8a;line-height:1.5;">Adjuntamos una copia en PDF del acta para su lectura previa. Para revisar y firmar el documento directamente en la plataforma, haga clic en el siguiente botón:</p>
      <p style="margin:0;text-align:center;">
        <a href="${escapeHtml(signingUrl)}" style="display:inline-block;padding:14px 28px;border-radius:8px;background:#1e40af;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">Revisar y firmar acta</a>
      </p>
      <p style="margin:14px 0 0;font-size:12px;color:#64748b;">Este enlace es individual e intransferible. Por seguridad, solo puede ser firmado por el destinatario registrado (<strong>${escapeHtml(participant.email)}</strong>).</p>
    </div>

    ${respEmail ? `<div style="margin:16px 0;padding:12px 16px;border-left:4px solid #3b82f6;background:#f0f9ff;font-size:13px;color:#1e40af;line-height:1.5;"><p style="margin:0;"><strong>¿Tiene dudas, observaciones o comentarios adicionales?</strong> Responda directamente a este correo electrónico para comunicarse con el/la responsable principal de la reunión: <strong>${escapeHtml(respNombre)}</strong> &lt;${escapeHtml(respEmail)}&gt;.</p></div>` : ''}

    ${externalPolicy.html}
  `;

  const html = renderInstitutionalTemplate({
    title: `Acta de Reunión · ${minute.code}`,
    introHtml,
    bodyHtml
  });

  const text = `ACTA N° ${minute.code}
Cordial saludo de paz y bien,
Estimado(a) ${participant.name}:

Se convoca a su revisión y firma el acta de reunión institucional ${minute.code}${meetingDate ? ` con fecha ${meetingDate}` : ''}.
Dependencia: ${dependencia}
${truncatedObjetivo ? `Objetivo: ${truncatedObjetivo}\n` : ''}Responsable: ${respNombre}${respEmail ? ` (${respEmail})` : ''}

Para revisar y firmar el acta, ingrese al siguiente enlace institucional:
${signingUrl}

Si tiene observaciones, comentarios o dudas, responda directamente a este correo para contactar al/a la responsable principal (${respNombre} - ${respEmail}).${externalPolicy.text}`;

  return { subject, text, html };
};

const sendParticipantInvitations = async ({ minute, baseUrl }) => {
  const expiresAt = minute.token_expires_at && minute.token_expires_at > new Date()
    ? minute.token_expires_at
    : new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);
  if (!minute.token_expires_at || minute.token_expires_at <= new Date()) {
    await minute.update({ token_expires_at: expiresAt });
  }
  const reviewBuffer = await buildSignedMinutePdfBuffer(minute, { hideSignatures: true });
  const reviewAttachment = { filename: `${minute.code}-PARA-REVISION.pdf`, content: reviewBuffer, contentType: 'application/pdf' };
  const summary = { sent: 0, failed: 0 };
  const rootId = minuteRootMessageId(minute.code);
  const responsible = await resolveMinutePrimaryResponsible(minute);

  for (const participant of (minute.participants || []).filter((item) => item.status !== 'signed')) {
    const invitationToken = crypto.randomBytes(32).toString('base64url');
    const signingUrl = `${baseUrl}/firmar-acta-reunion/${invitationToken}`;
    const email = buildSigningInvitationEmail({ participant, minute, signingUrl, responsible });
    const recipientEmail = clean(participant.email, 254).toLowerCase();
    const participantMsgId = minuteParticipantMessageId(minute.code, recipientEmail);
    const isResend = Boolean(participant.invitation_sent_at);
    const safeCode = String(minute.code || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
    const safeEmail = recipientEmail.replace(/[^a-z0-9]/g, '');

    const previousToken = {
      signing_token_hash: participant.signing_token_hash,
      signing_token_expires_at: participant.signing_token_expires_at
    };
    try {
      await participant.update({ signing_token_hash: hash(invitationToken), signing_token_expires_at: expiresAt });
      const result = await sendInstitutionalEmail({
        to: participant.email,
        ...email,
        replyTo: responsible?.email || undefined,
        subject: isResend ? `Re: ${email.subject}` : email.subject,
        messageId: isResend ? `<minute.${safeCode}.${safeEmail}.resend.${Date.now()}@unicesmag.edu.co>` : participantMsgId,
        inReplyTo: isResend ? participantMsgId : undefined,
        references: isResend ? `${rootId} ${participantMsgId}` : rootId,
        attachments: [reviewAttachment],
        allowExternalRecipients: true
      });
      if (!result.success) throw new Error(result.error || 'El servicio de correo rechazó la invitación.');
      await participant.update({ invitation_sent_at: new Date() });
      summary.sent += 1;
    } catch (error) {
      await participant.update(previousToken).catch(() => {});
      console.error('[digital-meeting-minute] invitation', participant.id, error.message);
      summary.failed += 1;
    }
  }
  return summary;
};

const resolveSigningAccess = async (token) => {
  if (!token) return null;
  const rawToken = String(token).trim();
  let decodedToken = rawToken;
  try {
    decodedToken = decodeURIComponent(rawToken).trim();
  } catch (_) {}

  const tokensToTry = Array.from(new Set([rawToken, decodedToken].filter(Boolean)));
  const now = new Date();

  for (const t of tokensToTry) {
    const tokenHash = hash(t);
    const minute = await DigitalMeetingMinute.findOne({
      where: {
        public_token_hash: tokenHash,
        status: { [Op.in]: ['signing', 'signed', 'distributed'] },
        [Op.or]: [
          { token_expires_at: null },
          { token_expires_at: { [Op.gt]: now } }
        ]
      },
      include: [
        { model: DigitalMeetingParticipant, as: 'participants' },
        { model: Documento, as: 'documento', required: false }
      ]
    });
    if (minute) return { minute, invitedParticipant: null, invitationVerified: false };
    const invitedParticipant = await DigitalMeetingParticipant.findOne({
      where: {
        signing_token_hash: tokenHash,
        [Op.or]: [
          { signing_token_expires_at: null },
          { signing_token_expires_at: { [Op.gt]: now } }
        ]
      }
    });
    if (invitedParticipant) {
      const invitedMinute = await DigitalMeetingMinute.findOne({
        where: { id: invitedParticipant.minute_id, status: { [Op.in]: ['signing', 'signed', 'distributed'] } },
        include: [
          { model: DigitalMeetingParticipant, as: 'participants' },
          { model: Documento, as: 'documento', required: false }
        ]
      });
      if (invitedMinute) return { minute: invitedMinute, invitedParticipant, invitationVerified: true };
    }
  }

  // Fallback de compatibilidad: buscar en historial de tokens o coincidencia directa en content
  for (const t of tokensToTry) {
    const tokenHash = hash(t);
    const activeMinutes = await DigitalMeetingMinute.findAll({
      where: {
        status: { [Op.in]: ['signing', 'signed', 'distributed'] },
        [Op.or]: [
          { token_expires_at: null },
          { token_expires_at: { [Op.gt]: now } }
        ]
      },
      include: [
        { model: DigitalMeetingParticipant, as: 'participants' },
        { model: Documento, as: 'documento', required: false }
      ]
    });
    for (const m of activeMinutes) {
      const history = Array.isArray(m.content?._token_history) ? m.content._token_history : [];
      if (m.content?._public_token === t || history.includes(tokenHash)) {
        return { minute: m, invitedParticipant: null, invitationVerified: false };
      }
    }
  }

  return null;
};

const parseDataUrl = (value) => {
  const match = String(value || '').match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw Object.assign(new Error('La firma enviada no tiene un formato válido.'), { statusCode: 422 });
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 2 * 1024 * 1024) throw Object.assign(new Error('La firma supera el tamaño permitido.'), { statusCode: 422 });
  return { extension: match[1] === 'jpeg' ? 'jpg' : 'png', buffer };
};

const fail = (res, error) => res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Error interno' });
const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (error) { console.error('[digital-meeting-minute]', error); fail(res, error); } };

const participantInclude = { model: DigitalMeetingParticipant, as: 'participants', separate: true, order: [['created_at', 'ASC']], attributes: ['id', 'minute_id', 'user_id', 'document', 'name', 'email', 'organization', 'role_title', 'status', 'created_at'] };
const includeRelations = [
  participantInclude,
  { model: DigitalMeetingSignature, as: 'signatures', separate: true, order: [['signed_at', 'ASC']] },
  { model: Documento, as: 'documento', required: false }
];

const resolveMinuteHeader = (minute) => ({
  ...(minute?.content?.header || {}),
  codigo: minute?.documento?.codigo || minute?.content?.header?.codigo || 'COM-ID-FR-002',
  version: minute?.documento?.version || minute?.content?.header?.version || '1',
  fecha: formatDate(minute?.documento?.fecha_creacion || minute?.content?.header?.fecha)
});

const buildSignedMinutePayload = (minute, options = {}) => {
  const signatures = new Map((minute.signatures || []).map((signature) => [String(signature.participant_id), signature]));
  return {
    ...minute.content,
    fecha: formatDate(minute.content?.fecha),
    header: resolveMinuteHeader(minute),
    participantes: (minute.participants || []).map((participant) => {
      const signature = signatures.get(String(participant.id));
      const hasSignature = Boolean(signature?.signature_storage_key && fs.existsSync(signature.signature_storage_key));
      const signatureData = hasSignature && !options.hideSignatures
        ? `data:${/\.jpe?g$/i.test(signature.signature_storage_key) ? 'image/jpeg' : 'image/png'};base64,${fs.readFileSync(signature.signature_storage_key).toString('base64')}`
        : '';
      const isSigned = participant.status === 'signed';
      return {
        nombre: formatPersonName(participant.name),
        cargo: participantRoleLabel(participant),
        status: participant.status,
        firma: isSigned ? 'ORIGINAL FIRMADO' : 'Pendiente · QR',
        firma_data_url: signatureData
      };
    })
  };
};
const buildSignedMinuteBuffer = async (minute, options = {}) => generateActaBuffer(buildSignedMinutePayload(minute, options));
const buildSignedMinutePdfBuffer = async (minute, options = {}) => generateMeetingMinutePdf(buildSignedMinutePayload(minute, options), options);

const getConfig = wrap(async (req, res) => {
  res.json({ success: true, data: { enabled: await getMeetingMinuteFeatureState(), canToggle: isAdmin(req.user) } });
});

const updateConfig = wrap(async (req, res) => {
  if (!isAdmin(req.user)) throw Object.assign(new Error('Solo el administrador puede activar o desactivar este formulario.'), { statusCode: 403 });
  const enabled = await setMeetingMinuteFeatureState(Boolean(req.body?.enabled), req.user.id);
  res.json({ success: true, message: enabled ? 'Formulario de actas de reunión activado.' : 'Formulario de actas de reunión desactivado.', data: { enabled, canToggle: true } });
});

const lookupParticipant = wrap(async (req, res) => {
  const document = clean(req.query.document, 100);
  if (!document) throw Object.assign(new Error('Digite la cédula del participante.'), { statusCode: 422 });
  const user = await User.findOne({ where: { username: document, estado: 'activo' }, attributes: ['id', 'username', 'nombre', 'email', 'dependencia', 'cargo'] });
  if (!user) throw Object.assign(new Error('No se encontró una persona activa con esa cédula.'), { statusCode: 404 });
  res.json({ success: true, data: { id: user.id, document: user.username, name: formatPersonName(user.nombre), email: user.email, organization: user.dependencia, role_title: user.cargo } });
});

// Restauración automática al inicio para recuperar actas afectadas
DigitalMeetingMinute.update(
  { deleted_at: null },
  { where: { deleted_at: { [Op.ne]: null } } }
).then(([count]) => {
  if (count > 0) console.log(`[meeting-minute] Se restauraron automáticamente ${count} acta(s) eliminada(s).`);
}).catch((err) => console.warn('[meeting-minute] auto-restore on boot error:', err.message));

const listMinutes = wrap(async (req, res) => {
  const where = { deleted_at: null };
  if (!isAdmin(req.user)) {
    const userId = Number(req.user.id);
    const userDoc = String(req.user.username || req.user.documento || req.user.cedula || '').trim();
    const userEmail = clean(req.user.email, 254).toLowerCase();

    const orConditions = [{ created_by: userId }];
    if (userDoc) {
      orConditions.push(sequelize.literal(`content::text ILIKE '%${userDoc.replace(/'/g, "''")}%'`));
    }
    if (userEmail) {
      orConditions.push(sequelize.literal(`content::text ILIKE '%${userEmail.replace(/'/g, "''")}%'`));
    }
    where[Op.or] = orConditions;
  }

  const rows = await DigitalMeetingMinute.findAll({
    where,
    include: [
      participantInclude,
      { model: Documento, as: 'documento', required: false },
      { model: User, as: 'creator', attributes: ['id', 'nombre', 'username', 'email'] }
    ],
    order: [['created_at', 'DESC']],
    limit: 200
  });

  if (isAdmin(req.user)) {
    return res.json({ success: true, data: rows });
  }

  const authorizedRows = [];
  for (const row of rows) {
    if (await canAccessMinuteFullSignatures(req.user, row)) {
      authorizedRows.push(row);
    }
  }

  res.json({ success: true, data: authorizedRows });
});

const getMinute = wrap(async (req, res) => {
  const row = await DigitalMeetingMinute.findByPk(req.params.id, { include: includeRelations });
  if (!row || row.deleted_at) {
    throw Object.assign(new Error('Acta no encontrada.'), { statusCode: 404 });
  }
  const authorized = await canAccessMinuteFullSignatures(req.user, row);
  if (!authorized) throw Object.assign(new Error('No tiene permiso para consultar esta acta.'), { statusCode: 403 });
  for (const signature of row.signatures || []) {
    if (signature.signature_storage_key && fs.existsSync(signature.signature_storage_key)) {
      const mime = /\.jpe?g$/i.test(signature.signature_storage_key) ? 'image/jpeg' : 'image/png';
      signature.setDataValue('signature_preview', `data:${mime};base64,${fs.readFileSync(signature.signature_storage_key).toString('base64')}`);
    }
    signature.setDataValue('signature_storage_key', null);
    signature.setDataValue('ip_address', null);
    signature.setDataValue('user_agent', null);
  }
  res.json({ success: true, data: row });
});

const deleteMinute = wrap(async (req, res) => {
  const minute = await DigitalMeetingMinute.findByPk(req.params.id);
  if (!minute || minute.deleted_at) throw Object.assign(new Error('Acta no encontrada o ya fue eliminada.'), { statusCode: 404 });

  const userId = Number(req.user.id);
  const userDoc = String(req.user.username || req.user.documento || req.user.cedula || '').trim().toLowerCase();
  const isCreator = minute.created_by && Number(minute.created_by) === userId;
  const respData = Array.isArray(minute.content?.responsables_data) ? minute.content.responsables_data : [];
  const primary = respData.find((r) => r.is_primary) || respData[0];
  const isPrimaryResp = (primary?.document && String(primary.document).trim().toLowerCase() === userDoc)
    || (minute.content?.responsable_document && String(minute.content.responsable_document).trim().toLowerCase() === userDoc);
  const isUserAdmin = isAdmin(req.user);

  if (!isCreator && !isPrimaryResp && !isUserAdmin) {
    throw Object.assign(new Error('Solo el creador o el responsable principal pueden eliminar esta acta. Los corresponsables no tienen permiso de eliminación.'), { statusCode: 403 });
  }

  await minute.update({ deleted_at: new Date(), updated_by: req.user.id });

  res.json({
    success: true,
    message: `Acta ${minute.code} eliminada del sistema.`,
    data: { id: minute.id }
  });
});

const restoreMinute = wrap(async (req, res) => {
  const minute = await DigitalMeetingMinute.findByPk(req.params.id);
  if (!minute) throw Object.assign(new Error('Acta no encontrada.'), { statusCode: 404 });
  await minute.update({ deleted_at: null, updated_by: req.user.id });
  res.json({
    success: true,
    message: `Acta ${minute.code} restaurada correctamente.`,
    data: { id: minute.id }
  });
});

const restoreAllMinutes = wrap(async (req, res) => {
  const [restored] = await DigitalMeetingMinute.update(
    { deleted_at: null },
    { where: { deleted_at: { [Op.ne]: null } } }
  );
  res.json({
    success: true,
    message: `Se restauraron exitosamente ${restored} acta(s).`,
    data: { restored }
  });
});

const normalizeContent = (body, user, document, existingContent = {}) => ({
  header: { codigo: document.codigo || 'COM-ID-FR-002', version: document.version || '1', fecha: formatDate(document.fecha_creacion) },
  titulo: clean(body.titulo, 120),
  responsables: clean(body.responsables || user.dependencia, 1500),
  responsable_document: clean(body.responsable_document, 100),
  responsable_role: clean(body.responsable_role, 220),
  responsables_data: Array.isArray(body.responsables_data) ? body.responsables_data : null,
  dependencia: clean(body.dependencia || user.dependencia, 500),
  lugar: clean(body.lugar, 500),
  fecha: clean(body.fecha, 50),
  horario: clean(body.horario, 100),
  objetivo: [sanitizeRichText(body.objetivo)],
  desarrollo: [sanitizeRichText(body.desarrollo)],
  conclusiones: [sanitizeRichText(body.conclusiones)],
  _public_token: body._public_token || existingContent?._public_token || null
});

const saveDraft = wrap(async (req, res) => {
  if (!(await getMeetingMinuteFeatureState())) throw Object.assign(new Error('El formulario de actas de reunión no está habilitado.'), { statusCode: 403 });
  const document = await Documento.findByPk(req.body.documento_id);
  if (!document || !isMeetingMinuteDocument(document)) throw Object.assign(new Error('El formato seleccionado no corresponde al Registro de Asistencia y Reunión.'), { statusCode: 422 });
  const rawResponsablesData = Array.isArray(req.body.responsables_data) && req.body.responsables_data.length > 0
    ? req.body.responsables_data
    : null;
  const primaryDoc = clean(req.body.responsable_document || rawResponsablesData?.find((r) => r.is_primary)?.document || rawResponsablesData?.[0]?.document, 100);
  if (!primaryDoc) throw Object.assign(new Error('Consulte al responsable mediante su cédula.'), { statusCode: 422 });
  const responsibleUser = await User.findOne({ where: { username: primaryDoc, estado: 'activo' }, attributes: ['id', 'username', 'nombre', 'email', 'dependencia', 'cargo'] });
  if (!responsibleUser) throw Object.assign(new Error('El responsable seleccionado ya no está disponible en SIAC.'), { statusCode: 422 });

  const allResponsables = [{
    id: responsibleUser.id,
    user_id: responsibleUser.id,
    username: responsibleUser.username,
    document: responsibleUser.username,
    nombre: responsibleUser.nombre,
    name: responsibleUser.nombre,
    email: responsibleUser.email,
    dependencia: responsibleUser.dependencia,
    organization: responsibleUser.dependencia,
    cargo: responsibleUser.cargo,
    role_title: responsibleUser.cargo,
    is_primary: true
  }];

  if (rawResponsablesData && rawResponsablesData.length > 1) {
    for (const coResp of rawResponsablesData) {
      const coDoc = clean(coResp.document, 100);
      if (coDoc && coDoc !== responsibleUser.username && !allResponsables.some((r) => r.document === coDoc)) {
        const u = await User.findOne({ where: { username: coDoc, estado: 'activo' }, attributes: ['id', 'username', 'nombre', 'email', 'dependencia', 'cargo'] });
        if (u) {
          allResponsables.push({
            id: u.id,
            user_id: u.id,
            username: u.username,
            document: u.username,
            nombre: u.nombre,
            name: u.nombre,
            email: u.email,
            dependencia: u.dependencia,
            organization: u.dependencia,
            cargo: u.cargo,
            role_title: u.cargo,
            is_primary: false
          });
        } else {
          allResponsables.push({
            id: coResp.user_id || null,
            user_id: coResp.user_id || null,
            username: coDoc,
            document: coDoc,
            nombre: clean(coResp.name || coResp.nombre, 240),
            name: clean(coResp.name || coResp.nombre, 240),
            email: clean(coResp.email, 254),
            dependencia: clean(coResp.organization || coResp.dependencia, 240),
            organization: clean(coResp.organization || coResp.dependencia, 240),
            cargo: clean(coResp.role_title || coResp.cargo, 220),
            role_title: clean(coResp.role_title || coResp.cargo, 220),
            is_primary: false
          });
        }
      }
    }
  }

  const participants = placeResponsibleFirst(Array.isArray(req.body.participants) ? req.body.participants : [], allResponsables);
  if (participants.length < 2) {
    throw Object.assign(new Error('Debe agregar al menos un participante aparte del responsable en la sección "2. Participantes y firmas".'), { statusCode: 422 });
  }
  if (!clean(req.body.responsables)) throw Object.assign(new Error('Consulte y seleccione el responsable de la reunión.'), { statusCode: 422 });
  if (!clean(req.body.titulo, 120)) throw Object.assign(new Error('El título corto del acta es obligatorio.'), { statusCode: 422 });
  if (!clean(req.body.dependencia)) throw Object.assign(new Error('La dependencia que cita es obligatoria.'), { statusCode: 422 });
  if (!clean(req.body.lugar)) throw Object.assign(new Error('Seleccione o escriba el lugar de la reunión.'), { statusCode: 422 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean(req.body.fecha, 50))) throw Object.assign(new Error('Seleccione una fecha válida para la reunión.'), { statusCode: 422 });
  if (!/^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$/.test(clean(req.body.horario, 100))) throw Object.assign(new Error('La hora de inicio y finalización son obligatorias.'), { statusCode: 422 });
  if (participants.some((participant) => !clean(participant.name, 240) || !clean(participant.email, 254))) throw Object.assign(new Error('Todos los participantes deben tener nombre y correo.'), { statusCode: 422 });
  const participantKeys = participants.map((participant) => clean(participant.document || participant.email, 254).toLowerCase()).filter(Boolean);
  if (new Set(participantKeys).size !== participantKeys.length) throw Object.assign(new Error('Hay participantes repetidos en el acta.'), { statusCode: 422 });
  if (!richPlainText(req.body.objetivo)) throw Object.assign(new Error('El objetivo de la reunión es obligatorio.'), { statusCode: 422 });
  if (!richPlainText(req.body.desarrollo)) throw Object.assign(new Error('El desarrollo de la reunión es obligatorio.'), { statusCode: 422 });
  if (!richPlainText(req.body.conclusiones)) throw Object.assign(new Error('Las conclusiones o compromisos son obligatorios.'), { statusCode: 422 });

  const minute = await sequelize.transaction(async (transaction) => {
    let row = req.body.id ? await DigitalMeetingMinute.findByPk(req.body.id, { transaction }) : null;
    if (row) {
      const authorized = await canAccessMinuteFullSignatures(req.user, row);
      if (!authorized) throw Object.assign(new Error('No tiene permiso para editar esta acta.'), { statusCode: 403 });
    }
    const content = normalizeContent({
      ...req.body,
      responsables: clean(req.body.responsables, 1500) || formatPersonName(responsibleUser.nombre),
      responsable_document: responsibleUser.username,
      responsable_role: responsibleUser.cargo,
      responsables_data: allResponsables.map((r) => ({
        user_id: r.id || null,
        document: r.username || r.document,
        name: formatPersonName(r.nombre || r.name),
        email: r.email,
        organization: r.dependencia || r.organization,
        role_title: r.cargo || r.role_title,
        is_primary: Boolean(r.is_primary)
      })),
      dependencia: clean(req.body.dependencia, 500) || responsibleUser.dependencia
    }, req.user, document, row?.content || {});
    if (!row) {
      const code = `ACTA-${new Date().getFullYear()}-${Date.now().toString().slice(-9)}`;
      row = await DigitalMeetingMinute.create({ documento_id: document.id, code, content, content_hash: contentHash(content), created_by: req.user.id, updated_by: req.user.id }, { transaction });
      for (const participant of participants) {
        await DigitalMeetingParticipant.create({
          minute_id: row.id,
          user_id: participant.user_id || null,
          document: clean(participant.document, 100) || null,
          name: formatPersonName(clean(participant.name, 240)),
          email: clean(participant.email, 254).toLowerCase() || null,
          organization: clean(participant.organization, 240) || null,
          role_title: clean(participant.role_title, 220) || null
        }, { transaction });
      }
    } else if (row.status === 'draft') {
      await row.update({ content, content_hash: contentHash(content), updated_by: req.user.id }, { transaction });
      const isCollaborativeAutosave = req.body.autosave === true;
      const participantsChanged = req.body.participants_changed === true;

      if (!isCollaborativeAutosave) {
        await DigitalMeetingParticipant.destroy({ where: { minute_id: row.id }, transaction });
        for (const participant of participants) {
          await DigitalMeetingParticipant.create({
            minute_id: row.id,
            user_id: participant.user_id || null,
            document: clean(participant.document, 100) || null,
            name: formatPersonName(clean(participant.name, 240)),
            email: clean(participant.email, 254).toLowerCase() || null,
            organization: clean(participant.organization, 240) || null,
            role_title: clean(participant.role_title, 220) || null
          }, { transaction });
        }
      } else if (participantsChanged) {
        // El autoguardado colaborativo aplica cambios incrementales: nunca elimina
        // participantes de otro editor solo porque su pantalla tenia una copia anterior.
        const removalKeys = new Set(
          (Array.isArray(req.body.removed_participant_keys) ? req.body.removed_participant_keys : [])
            .map((key) => clean(key, 320).toLowerCase())
            .filter(Boolean)
        );
        let existingParticipants = await DigitalMeetingParticipant.findAll({ where: { minute_id: row.id }, transaction });
        const idsToRemove = existingParticipants
          .filter((participant) => {
            const docKey = participant.document ? `doc:${String(participant.document).trim().toLowerCase()}` : '';
            const emailKey = participant.email ? `email:${String(participant.email).trim().toLowerCase()}` : '';
            return (docKey && removalKeys.has(docKey)) || (emailKey && removalKeys.has(emailKey));
          })
          .map((participant) => participant.id);
        if (idsToRemove.length) {
          await DigitalMeetingParticipant.destroy({ where: { id: { [Op.in]: idsToRemove } }, transaction });
          existingParticipants = existingParticipants.filter((participant) => !idsToRemove.includes(participant.id));
        }

        for (const participant of participants) {
          const pDoc = clean(participant.document, 100).toLowerCase();
          const pEmail = clean(participant.email, 254).toLowerCase();
          const existing = existingParticipants.find((current) =>
            (pDoc && String(current.document || '').trim().toLowerCase() === pDoc) ||
            (pEmail && String(current.email || '').trim().toLowerCase() === pEmail)
          );
          const values = {
            user_id: participant.user_id || null,
            document: pDoc || null,
            name: formatPersonName(clean(participant.name, 240)),
            email: pEmail || null,
            organization: clean(participant.organization, 240) || null,
            role_title: clean(participant.role_title, 220) || null
          };
          if (existing) {
            await existing.update(values, { transaction });
          } else {
            const created = await DigitalMeetingParticipant.create({ minute_id: row.id, ...values }, { transaction });
            existingParticipants.push(created);
          }
        }
      }
    } else {
      // En fases de firma o posteriores, se actualiza el contenido (objetivo, desarrollo, acuerdos, etc.)
      // preservando las firmas y participantes ya registrados en el acta
      await row.update({ content, content_hash: contentHash(content), updated_by: req.user.id }, { transaction });

      const existingParticipants = await DigitalMeetingParticipant.findAll({ where: { minute_id: row.id }, transaction });
      const existingDocs = new Set(existingParticipants.map((p) => String(p.document || '').trim().toLowerCase()).filter(Boolean));
      const existingEmails = new Set(existingParticipants.map((p) => String(p.email || '').trim().toLowerCase()).filter(Boolean));

      for (const participant of participants) {
        const pDoc = String(participant.document || '').trim().toLowerCase();
        const pEmail = String(participant.email || '').trim().toLowerCase();
        const alreadyExists = (pDoc && existingDocs.has(pDoc)) || (pEmail && existingEmails.has(pEmail));
        if (!alreadyExists) {
          await DigitalMeetingParticipant.create({
            minute_id: row.id,
            user_id: participant.user_id || null,
            document: clean(participant.document, 100) || null,
            name: formatPersonName(clean(participant.name, 240)),
            email: clean(participant.email, 254).toLowerCase() || null,
            organization: clean(participant.organization, 240) || null,
            role_title: clean(participant.role_title, 220) || null,
            status: 'invited'
          }, { transaction });
        }
      }
    }
    return row;
  });
  const result = await DigitalMeetingMinute.findByPk(minute.id, { include: includeRelations });
  res.status(req.body.id ? 200 : 201).json({ success: true, message: minute.status === 'draft' ? 'Borrador del acta guardado.' : 'Cambios del acta guardados exitosamente.', data: result });
});

const publish = wrap(async (req, res) => {
  const minute = await DigitalMeetingMinute.findByPk(req.params.id, { include: [{ model: DigitalMeetingParticipant, as: 'participants' }, { model: DigitalMeetingSignature, as: 'signatures' }, { model: Documento, as: 'documento', required: false }] });
  if (!minute || minute.deleted_at) throw Object.assign(new Error('Acta no encontrada.'), { statusCode: 404 });
  const authorized = await canAccessMinuteFullSignatures(req.user, minute);
  if (!authorized) throw Object.assign(new Error('No tiene permiso para publicar esta acta.'), { statusCode: 403 });
  if (!minute.participants?.length || minute.participants.length < 2) {
    throw Object.assign(new Error('Debe agregar al menos un participante aparte del responsable en la sección "2. Participantes y firmas".'), { statusCode: 422 });
  }
  if (minute.participants.some((participant) => !participant.email)) {
    throw Object.assign(new Error('Todos los participantes deben tener correo para habilitar las firmas.'), { statusCode: 422 });
  }
  const token = crypto.randomBytes(32).toString('base64url');
  const updatedContent = { ...(minute.content || {}), _public_token: token };
  await minute.update({ status: 'signing', public_token_hash: hash(token), token_expires_at: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), published_at: new Date(), content_hash: contentHash(minute.content), content: updatedContent });
  const signingUrl = `${publicFrontend(req)}/firmar-acta-reunion/${token}`;
  const qr_data_url = await QRCode.toDataURL(signingUrl, { errorCorrectionLevel: 'M', margin: 1, width: 360 });
  const invitations = await sendParticipantInvitations({ minute, baseUrl: publicFrontend(req) });
  const message = invitations.failed
    ? `Acta habilitada. Se enviaron ${invitations.sent} invitaciones y ${invitations.failed} requieren reenvío.`
    : `Acta habilitada y ${invitations.sent} invitación(es) enviada(s) por correo.`;
  res.json({ success: true, message, data: { minute: { id: minute.id, code: minute.code, status: minute.status, version: minute.version }, signing_url: signingUrl, qr_data_url, invitations } });
});

const getSigningAccess = wrap(async (req, res) => {
  const minute = await DigitalMeetingMinute.findByPk(req.params.id);
  if (!minute || minute.deleted_at) throw Object.assign(new Error('Acta no encontrada.'), { statusCode: 404 });
  const authorized = await canAccessMinuteFullSignatures(req.user, minute);
  if (!authorized) throw Object.assign(new Error('No tiene permiso para consultar el acceso de esta acta.'), { statusCode: 403 });
  if (minute.status !== 'signing') throw Object.assign(new Error('El acceso solo está disponible mientras el acta se encuentra en firmas.'), { statusCode: 409 });

  const forceRegenerate = req.body?.regenerate === true || req.query?.regenerate === 'true';
  const existingToken = minute.content?._public_token;
  const isTokenValid = existingToken &&
    minute.public_token_hash &&
    hash(existingToken) === minute.public_token_hash &&
    minute.token_expires_at &&
    new Date(minute.token_expires_at) > new Date();

  let token = existingToken;
  if (!isTokenValid || forceRegenerate) {
    token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);
    const existingHistory = Array.isArray(minute.content?._token_history) ? minute.content._token_history : [];
    const updatedHistory = minute.public_token_hash && !existingHistory.includes(minute.public_token_hash)
      ? [...existingHistory, minute.public_token_hash].slice(-10)
      : existingHistory;
    const updatedContent = { ...(minute.content || {}), _public_token: token, _token_history: updatedHistory };
    await minute.update({
      public_token_hash: hash(token),
      token_expires_at: expiresAt,
      content: updatedContent
    });
  }
  const signingUrl = `${publicFrontend(req)}/firmar-acta-reunion/${token}`;
  const qr_data_url = await QRCode.toDataURL(signingUrl, { errorCorrectionLevel: 'M', margin: 1, width: 360 });
  res.json({
    success: true,
    message: forceRegenerate ? 'Se regeneró el acceso QR vigente. El QR general anterior queda reemplazado.' : 'Acceso QR vigente obtenido.',
    data: { signing_url: signingUrl, qr_data_url }
  });
});

const reopenForEditing = wrap(async (req, res) => {
  const minute = await DigitalMeetingMinute.findByPk(req.params.id);
  if (!minute || minute.deleted_at) throw Object.assign(new Error('Acta no encontrada.'), { statusCode: 404 });
  const authorized = await canAccessMinuteFullSignatures(req.user, minute);
  if (!authorized) throw Object.assign(new Error('No tiene permiso para ajustar esta acta.'), { statusCode: 403 });
  if (minute.status !== 'signing') throw Object.assign(new Error('Solo un acta que está en firmas puede regresar a borrador.'), { statusCode: 409 });
  const signedCount = await DigitalMeetingSignature.count({ where: { minute_id: minute.id } });
  if (signedCount > 0) throw Object.assign(new Error('No se puede modificar el acta porque ya tiene firmas. Esto protege el contenido que las personas aprobaron.'), { statusCode: 409 });
  await sequelize.transaction(async (transaction) => {
    const updatedContent = { ...(minute.content || {}), _public_token: null };
    await minute.update({ status: 'draft', public_token_hash: null, token_expires_at: null, published_at: null, content: updatedContent }, { transaction });
    await DigitalMeetingParticipant.update({ status: 'invited', otp_hash: null, otp_expires_at: null, otp_attempts: 0, signing_token_hash: null, signing_token_expires_at: null, invitation_sent_at: null }, { where: { minute_id: minute.id }, transaction });
  });
  res.json({ success: true, message: 'El acta regresó a borrador. Los enlaces anteriores fueron invalidados y ya puede realizar ajustes.', data: { id: minute.id, status: 'draft' } });
});

const resendInvitations = wrap(async (req, res) => {
  const minute = await DigitalMeetingMinute.findByPk(req.params.id, { include: [{ model: DigitalMeetingParticipant, as: 'participants' }, { model: Documento, as: 'documento', required: false }] });
  if (!minute || minute.deleted_at) throw Object.assign(new Error('Acta no encontrada.'), { statusCode: 404 });
  const authorized = await canAccessMinuteFullSignatures(req.user, minute);
  if (!authorized) throw Object.assign(new Error('No tiene permiso para reenviar estas invitaciones.'), { statusCode: 403 });
  if (minute.status !== 'signing') throw Object.assign(new Error('Solo se pueden reenviar invitaciones de un acta que está en firmas.'), { statusCode: 409 });
  const invitations = await sendParticipantInvitations({ minute, baseUrl: publicFrontend(req) });
  if (!invitations.sent && invitations.failed) throw Object.assign(new Error('No fue posible enviar las invitaciones. Verifique el servicio de correo.'), { statusCode: 503 });
  res.json({ success: true, message: invitations.failed ? `Se reenviaron ${invitations.sent} invitaciones; ${invitations.failed} no pudieron enviarse.` : `Se reenviaron ${invitations.sent} invitación(es) pendiente(s).`, data: invitations });
});

const publicMinute = wrap(async (req, res) => {
  const access = await resolveSigningAccess(req.params.token);
  if (!access) throw Object.assign(new Error('El enlace de firma no es válido o venció.'), { statusCode: 404 });
  const { minute, invitedParticipant, invitationVerified } = access;
  const alreadySigned = Boolean(invitationVerified && invitedParticipant?.status === 'signed');
  // El QR general nunca expone una lista seleccionable. Google confirma la
  // propiedad del correo y el servidor lo compara con el registrado en el acta.
  const available = invitationVerified ? [invitedParticipant] : [];

  let signatureInfo = null;
  if (alreadySigned && invitedParticipant) {
    const signatureRow = await DigitalMeetingSignature.findOne({
      where: { minute_id: minute.id, participant_id: invitedParticipant.id }
    });
    if (signatureRow) {
      let preview = null;
      if (signatureRow.signature_storage_key && fs.existsSync(signatureRow.signature_storage_key)) {
        try {
          preview = `data:image/png;base64,${fs.readFileSync(signatureRow.signature_storage_key).toString('base64')}`;
        } catch (_) {}
      }
      signatureInfo = {
        signed_at: signatureRow.signed_at,
        signature_preview: preview,
        ip_address: maskAndEncryptIp(signatureRow.ip_address),
        user_agent: signatureRow.user_agent ? 'Dispositivo verificado institucionalmente' : null,
        signature_hash: signatureRow.signature_hash
      };
    }
  }

  res.json({
    success: true,
    data: {
      id: minute.id,
      code: minute.code,
      version: minute.version,
      status: minute.status,
      content: invitationVerified ? { ...(minute.content || {}), header: resolveMinuteHeader(minute) } : null,
      invitation_verified: invitationVerified,
      requires_identity_verification: !invitationVerified,
      invited_participant_id: invitedParticipant?.id || null,
      already_signed: alreadySigned,
      participant: invitedParticipant ? {
        id: invitedParticipant.id,
        name: invitedParticipant.name,
        role_title: invitedParticipant.role_title,
        organization: invitedParticipant.organization,
        email: invitedParticipant.email,
        external: !invitedParticipant.user_id,
        status: invitedParticipant.status
      } : null,
      signature_info: signatureInfo,
      preview_participants: (invitationVerified ? minute.participants : []).map((p) => ({
        id: p.id,
        name: p.name,
        role_title: p.role_title,
        organization: p.organization,
        external: !p.user_id,
        status: p.status
      })),
      participants: available.map((p) => ({
        id: p.id,
        name: p.name,
        role_title: p.role_title,
        organization: p.organization,
        external: !p.user_id,
        email_hint: p.email ? `${p.email.slice(0, 2)}***@${p.email.split('@')[1]}` : ''
      }))
    }
  });
});

const googleSigningAccess = wrap(async (req, res) => {
  const access = await resolveSigningAccess(req.params.token);
  const minute = access?.minute;
  if (!minute || access.invitationVerified) throw Object.assign(new Error('El acceso de firma no es válido.'), { statusCode: 404 });

  const googleClientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  const credential = clean(req.body.credential, 8192);
  if (!googleClientId) throw Object.assign(new Error('La verificación con Google no está configurada.'), { statusCode: 503 });
  if (!credential) throw Object.assign(new Error('Google no proporcionó una credencial válida.'), { statusCode: 400 });

  let googlePayload;
  try {
    const ticket = await new OAuth2Client(googleClientId).verifyIdToken({ idToken: credential, audience: googleClientId });
    googlePayload = ticket.getPayload() || {};
  } catch (_) {
    throw Object.assign(new Error('No fue posible validar la cuenta con Google.'), { statusCode: 401 });
  }

  const googleEmail = clean(googlePayload.email, 254).toLowerCase();
  if (!googleEmail || googlePayload.email_verified !== true) {
    throw Object.assign(new Error('Google no confirmó el correo de la cuenta.'), { statusCode: 401 });
  }

  const participant = minute.participants.find((item) => clean(item.email, 254).toLowerCase() === googleEmail);
  if (!participant) {
    throw Object.assign(new Error(`La cuenta ${googleEmail} no coincide con el correo de ningún participante registrado en esta acta. Continúe con la cuenta correcta o solicite al responsable que actualice el correo.`), { statusCode: 403 });
  }
  if (participant.status === 'signed') throw Object.assign(new Error('Usted ya firmó este documento anteriormente.'), { statusCode: 409 });

  const personalToken = crypto.randomBytes(32).toString('base64url');
  await participant.update({
    signing_token_hash: hash(personalToken),
    signing_token_expires_at: new Date(Date.now() + 30 * 60 * 1000),
    email_verified_at: new Date()
  });
  const signingUrl = `${publicFrontend(req)}/firmar-acta-reunion/${personalToken}`;
  res.json({
    success: true,
    message: 'Correo validado con Google. Abriendo únicamente su registro.',
    data: { signing_url: signingUrl }
  });
});

const sign = wrap(async (req, res) => {
  const access = await resolveSigningAccess(req.params.token);
  const minute = access?.minute;
  if (!minute) throw Object.assign(new Error('El enlace de firma no es válido o venció.'), { statusCode: 404 });
  if (!access.invitationVerified || !access.invitedParticipant) {
    throw Object.assign(new Error('Por seguridad, verifique con Google el mismo correo registrado en el acta.'), { statusCode: 403 });
  }
  const participant = access.invitedParticipant;
  if (participant.status === 'signed') throw Object.assign(new Error('Usted ya firmó este documento anteriormente.'), { statusCode: 409 });
  if (!participant.user_id && req.body.privacy_accepted !== true) throw Object.assign(new Error('Debe aceptar la autorización de tratamiento de datos personales para firmar.'), { statusCode: 422 });
  const parsed = parseDataUrl(req.body.signature_data);
  ensureDir(SIGNATURE_ROOT);
  const storage = path.join(SIGNATURE_ROOT, `${minute.id}-${participant.id}-${Date.now()}.${parsed.extension}`);
  fs.writeFileSync(storage, parsed.buffer, { flag: 'wx' });
  const signedAt = new Date();
  const clientIp = clean(req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress, 80);
  await DigitalMeetingSignature.create({ minute_id: minute.id, participant_id: participant.id, signer_name: participant.name, signer_email: participant.email, signature_storage_key: storage, signature_hash: hash(parsed.buffer), content_hash: minute.content_hash, signed_at: signedAt, privacy_accepted_at: !participant.user_id ? signedAt : null, privacy_policy_version: !participant.user_id ? PRIVACY_POLICY_VERSION : null, ip_address: clientIp, user_agent: clean(req.headers['user-agent'], 500) });
  await participant.update({ status: 'signed', email_verified_at: new Date(), otp_hash: null, otp_expires_at: null });
  const [participantCount, signedCount] = await Promise.all([
    DigitalMeetingParticipant.count({ where: { minute_id: minute.id } }),
    DigitalMeetingParticipant.count({ where: { minute_id: minute.id, status: 'signed' } })
  ]);
  if (participantCount > 0 && signedCount === participantCount) {
    await minute.update({ status: 'signed', finalized_at: signedAt });
  }
  res.json({ success: true, message: 'Firma registrada y vinculada al acta.', data: { id: participant.id } });
});

const downloadWord = wrap(async (req, res) => {
  const minute = await DigitalMeetingMinute.findByPk(req.params.id, { include: [{ model: DigitalMeetingParticipant, as: 'participants' }, { model: DigitalMeetingSignature, as: 'signatures' }, { model: Documento, as: 'documento', required: false }] });
  if (!minute || minute.deleted_at) throw Object.assign(new Error('Acta no encontrada.'), { statusCode: 404 });
  const isAuthorized = await canAccessMinuteFullSignatures(req.user, minute);
  if (!isAuthorized) throw Object.assign(new Error('No tiene permiso para descargar esta acta.'), { statusCode: 403 });
  const isCopy = req.query.tipo === 'copia' || req.query.copia === 'true';
  const buffer = await buildSignedMinuteBuffer(minute, { hideSignatures: isCopy });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${minute.code}${isCopy ? '-COPIA' : ''}.docx"`);
  res.send(buffer);
});

const downloadPdf = wrap(async (req, res) => {
  const minute = await DigitalMeetingMinute.findByPk(req.params.id, { include: [{ model: DigitalMeetingParticipant, as: 'participants' }, { model: DigitalMeetingSignature, as: 'signatures' }, { model: Documento, as: 'documento', required: false }] });
  if (!minute || minute.deleted_at) throw Object.assign(new Error('Acta no encontrada.'), { statusCode: 404 });
  const isAuthorized = await canAccessMinuteFullSignatures(req.user, minute);
  if (!isAuthorized) throw Object.assign(new Error('No tiene permiso para descargar esta acta.'), { statusCode: 403 });
  const isCopy = req.query.tipo === 'copia' || req.query.copia === 'true';
  const buffer = await buildSignedMinutePdfBuffer(minute, { hideSignatures: isCopy });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${minute.code}${isCopy ? '-COPIA' : ''}.pdf"`);
  res.send(buffer);
});

const sendFinalMinute = wrap(async (req, res) => {
  const minute = await DigitalMeetingMinute.findByPk(req.params.id, { include: [{ model: DigitalMeetingParticipant, as: 'participants' }, { model: DigitalMeetingSignature, as: 'signatures' }, { model: Documento, as: 'documento', required: false }] });
  if (!minute || minute.deleted_at) throw Object.assign(new Error('Acta no encontrada.'), { statusCode: 404 });
  const isAuthorized = await canAccessMinuteFullSignatures(req.user, minute);
  if (!isAuthorized) throw Object.assign(new Error('Solo el responsable de la reunión o el creador del acta pueden enviarla.'), { statusCode: 403 });
  if (!minute.participants?.length || minute.participants.some((participant) => participant.status !== 'signed')) {
    throw Object.assign(new Error('El acta solo puede enviarse cuando todas las personas hayan firmado.'), { statusCode: 422 });
  }

  const responsible = await resolveMinutePrimaryResponsible(minute);
  const responsibleEmails = await resolveMinuteResponsibleEmails(minute);
  const respNombre = responsible?.name || 'Responsable de la reunión';
  const respEmail = responsible?.email || '';

  const recipients = [...new Set(minute.participants.map((participant) => clean(participant.email, 254).toLowerCase()).filter(Boolean))];
  for (const rEmail of responsibleEmails) {
    if (rEmail && !recipients.includes(rEmail)) {
      recipients.push(rEmail);
    }
  }
  if (!recipients.length) throw Object.assign(new Error('El acta no tiene correos de participantes para el envío.'), { statusCode: 422 });

  // 1. Original PDF con firmas gráficas completas para custodia y archivo del responsable
  const originalBuffer = await buildSignedMinutePdfBuffer(minute, { hideSignatures: false });
  // 2. Copia oficial donde en la columna Firma aparece 'ORIGINAL FIRMADO' sin exponer los trazos de firma
  const copyBuffer = await buildSignedMinutePdfBuffer(minute, { hideSignatures: true });

  const meetingDate = formatDate(minute.content?.fecha);
  const dependencia = minute.content?.dependencia || 'Universidad CESMAG';

  const originalAttachment = { filename: `${minute.code}-ORIGINAL.pdf`, content: originalBuffer, contentType: 'application/pdf' };
  const copyAttachment = { filename: `${minute.code}.pdf`, content: copyBuffer, contentType: 'application/pdf' };

  const buildHtmlForRecipient = (isResponsibleRecipient) => {
    const introHtml = `
      <p style="margin:0 0 10px;font-size:17px;font-weight:800;color:#1e3a8a;letter-spacing:0.3px;">ACTA N° ${escapeHtml(minute.code)}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#334155;">Cordial saludo de paz y bien,</p>
      <p style="margin:0 0 14px;font-size:14px;color:#334155;">El proceso de revisión y firma del acta de reunión institucional <strong>${escapeHtml(minute.code)}</strong> ha finalizado satisfactoriamente.</p>
    `;

    const bodyHtml = `
      <div style="margin:16px 0;padding:16px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">Información del documento final</p>
        <table style="width:100%;border-collapse:collapse;font-size:13.5px;color:#1e293b;">
          <tr>
            <td style="padding:4px 0;width:130px;color:#64748b;"><strong>N° Acta:</strong></td>
            <td style="padding:4px 0;font-weight:700;">${escapeHtml(minute.code)}</td>
          </tr>
          ${meetingDate ? `<tr><td style="padding:4px 0;color:#64748b;"><strong>Fecha:</strong></td><td style="padding:4px 0;">${escapeHtml(meetingDate)}</td></tr>` : ''}
          ${dependencia ? `<tr><td style="padding:4px 0;color:#64748b;"><strong>Dependencia:</strong></td><td style="padding:4px 0;">${escapeHtml(dependencia)}</td></tr>` : ''}
          ${respNombre ? `<tr><td style="padding:4px 0;color:#64748b;"><strong>Responsable:</strong></td><td style="padding:4px 0;">${escapeHtml(respNombre)}${respEmail ? ` (${escapeHtml(respEmail)})` : ''}</td></tr>` : ''}
        </table>
      </div>

      <div style="margin:20px 0;padding:18px;border:1px solid #bbf7d0;border-radius:12px;background:#f0fdf4;">
        <p style="margin:0 0 6px;font-size:14px;color:#166534;font-weight:700;">✓ Documento formalmente firmado por todos los convocados</p>
        <p style="margin:0;font-size:13px;color:#15803d;line-height:1.5;">${
          isResponsibleRecipient
            ? 'Se adjunta a este mensaje el documento <strong>ORIGINAL</strong> en formato PDF con las firmas gráficas de los participantes para su custodia y archivo institucional.'
            : 'Se adjunta a este mensaje la copia oficial en formato PDF debidamente certificada con la constancia <strong>ORIGINAL FIRMADO</strong>.'
        }</p>
      </div>

      ${respEmail ? `<div style="margin:16px 0;padding:12px 16px;border-left:4px solid #3b82f6;background:#f0f9ff;font-size:13px;color:#1e40af;line-height:1.5;"><p style="margin:0;"><strong>¿Requiere aclaraciones o comentarios posteriores?</strong> Puede responder directamente a este mensaje para comunicarse con el/la responsable principal: <strong>${escapeHtml(respNombre)}</strong> &lt;${escapeHtml(respEmail)}&gt;.</p></div>` : ''}
    `;

    return renderInstitutionalTemplate({
      title: `Acta de Reunión Firmada · ${minute.code}${isResponsibleRecipient ? ' (Original)' : ''}`,
      introHtml,
      bodyHtml
    });
  };

  const rootId = minuteRootMessageId(minute.code);
  const safeCode = String(minute.code || '').toLowerCase().replace(/[^a-z0-9-]/g, '');

  const results = [];
  for (const recipient of recipients) {
    const isResponsibleRecipient = responsibleEmails.has(recipient);
    const attachmentForRecipient = isResponsibleRecipient ? originalAttachment : copyAttachment;
    const html = buildHtmlForRecipient(isResponsibleRecipient);
    const participantMsgId = minuteParticipantMessageId(minute.code, recipient);
    const safeEmail = recipient.replace(/[^a-z0-9]/g, '');
    const finalMsgId = `<minute.${safeCode}.${safeEmail}.final.${Date.now()}@unicesmag.edu.co>`;
    try {
      const result = await sendInstitutionalEmail({
        to: recipient,
        replyTo: responsible?.email || undefined,
        subject: `Re: ${minute.code} · Solicitud de firma de acta de reunión`,
        messageId: finalMsgId,
        inReplyTo: participantMsgId,
        references: `${rootId} ${participantMsgId}`,
        text: `ACTA N° ${minute.code}\nCordial saludo de paz y bien,\n\nEl proceso de firma del acta institucional ${minute.code} con fecha ${meetingDate} ha finalizado satisfactoriamente por todos los participantes convocados. Se adjunta ${isResponsibleRecipient ? 'el documento original con las firmas para su custodia' : 'la copia oficial con la constancia ORIGINAL FIRMADO'}.\n\nResponsable: ${respNombre}${respEmail ? ` (${respEmail})` : ''}\nSi tiene comentarios o aclaraciones adicionales, responda directamente a este correo.`,
        html,
        attachments: [attachmentForRecipient],
        allowExternalRecipients: true
      });
      results.push({ recipient, success: Boolean(result.success), error: result.error || '' });
    } catch (error) {
      results.push({ recipient, success: false, error: error.message });
    }
  }
  const failed = results.filter((result) => !result.success);
  if (failed.length) throw Object.assign(new Error(`No fue posible enviar el acta a ${failed.length} destinatario(s). Intente nuevamente.`), { statusCode: 502 });
  const sentAt = new Date();
  await minute.update({ status: 'distributed', distributed_at: sentAt, distribution_count: Number(minute.distribution_count || 0) + 1 });
  res.json({ success: true, message: `Acta firmada enviada a ${recipients.length} participante(s).`, data: { status: 'distributed', distributed_at: sentAt, recipients: recipients.length } });
});

const updateComments = wrap(async (req, res) => {
  const minute = await DigitalMeetingMinute.findByPk(req.params.id, {
    include: [{ model: DigitalMeetingParticipant, as: 'participants' }]
  });
  if (!minute || minute.deleted_at) throw Object.assign(new Error('Acta no encontrada.'), { statusCode: 404 });

  const authorized = await canAccessMinuteFullSignatures(req.user, minute);
  if (!authorized) {
    throw Object.assign(new Error('Solo el responsable de la reunión o el creador del acta pueden registrar comentarios adicionales.'), { statusCode: 403 });
  }

  const rawComments = req.body.comentarios_adicionales;
  const sanitized = Array.isArray(rawComments)
    ? rawComments.map(sanitizeRichText)
    : (rawComments ? [sanitizeRichText(rawComments)] : []);

  minute.content = {
    ...content,
    comentarios_adicionales: sanitized
  };
  minute.changed('content', true);
  await minute.save();

  res.json({
    success: true,
    message: 'Comentarios adicionales guardados correctamente.',
    data: { comentarios_adicionales: minute.content.comentarios_adicionales }
  });
});

module.exports = {
  deleteMinute,
  downloadPdf,
  downloadWord,
  getConfig,
  googleSigningAccess,
  getMinute,
  getSigningAccess,
  listMinutes,
  lookupParticipant,
  publicMinute,
  publish,
  reopenForEditing,
  resendInvitations,
  restoreAllMinutes,
  restoreMinute,
  saveDraft,
  sendFinalMinute,
  sign,
  updateComments,
  updateConfig,
  _internals: {
    buildPrivacyPolicyEmailSection,
    buildSigningInvitationEmail,
    minuteThreadSubject,
    minuteRootMessageId,
    minuteParticipantMessageId,
    participantRoleLabel,
    placeResponsibleFirst,
    sanitizeRichText
  }
};
