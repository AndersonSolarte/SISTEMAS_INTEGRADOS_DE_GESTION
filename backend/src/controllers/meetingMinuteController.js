const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
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
const { sendInstitutionalEmail, renderInstitutionalTemplate, escapeHtml } = require('../services/emailService');

const PRIVATE_ROOT = path.resolve(process.env.SIAC_MEETING_MINUTE_DIR || path.join(__dirname, '../../uploads/.private/digital-meeting-minutes'));
const SIGNATURE_ROOT = path.join(PRIVATE_ROOT, 'signatures');
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const hash = (value) => crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : String(value || '')).digest('hex');
const contentHash = (value) => hash(JSON.stringify(value));
const isAdmin = (user) => String(user?.role || '') === 'administrador';
const clean = (value, max = 8000) => String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
const PRIVACY_POLICY_VERSION = 'LEY-1581-2012-DEC-1074-2015';
const RICH_TAGS = new Set(['div', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote', 'hr', 'a', 'span', 'font', 'table', 'thead', 'tbody', 'tr', 'th', 'td']);
const sanitizeRichText = (value) => clean(value)
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
const formatDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : clean(value, 50);
};
const publicFrontend = (req) => clean(req.body?.public_base_url || process.env.PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`, 500).replace(/\/$/, '');

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

const buildSignedMinuteBuffer = async (minute) => {
  const signatures = new Map((minute.signatures || []).map((signature) => [String(signature.participant_id), signature]));
  const payload = { ...minute.content, fecha: formatDate(minute.content?.fecha), header: { ...(minute.content?.header || {}), fecha: formatDate(minute.content?.fecha) }, participantes: minute.participants.map((participant) => {
    const signature = signatures.get(String(participant.id));
    const signatureData = signature?.signature_storage_key && fs.existsSync(signature.signature_storage_key)
      ? `data:${/\.jpe?g$/i.test(signature.signature_storage_key) ? 'image/jpeg' : 'image/png'};base64,${fs.readFileSync(signature.signature_storage_key).toString('base64')}`
      : '';
    return { nombre: participant.name, cargo: participant.role_title || participant.organization || '', firma: participant.status === 'signed' ? 'Firmado electrónicamente' : 'Pendiente · QR', firma_data_url: signatureData };
  }) };
  return generateActaBuffer(payload);
};

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
  res.json({ success: true, data: { id: user.id, document: user.username, name: user.nombre, email: user.email, organization: user.dependencia, role_title: user.cargo } });
});

const listMinutes = wrap(async (req, res) => {
  const where = { deleted_at: null };
  if (!isAdmin(req.user)) where.created_by = req.user.id;
  const rows = await DigitalMeetingMinute.findAll({ where, include: [participantInclude, { model: Documento, as: 'documento', required: false }], order: [['created_at', 'DESC']], limit: 100 });
  res.json({ success: true, data: rows });
});

const getMinute = wrap(async (req, res) => {
  const row = await DigitalMeetingMinute.findByPk(req.params.id, { include: includeRelations });
  if (!row || row.deleted_at) throw Object.assign(new Error('Acta no encontrada.'), { statusCode: 404 });
  if (!isAdmin(req.user) && Number(row.created_by) !== Number(req.user.id)) throw Object.assign(new Error('No tiene permiso para consultar esta acta.'), { statusCode: 403 });
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

const normalizeContent = (body, user, document) => ({
  header: { codigo: document.codigo || 'COM-ID-FR-002', version: document.version || '1', fecha: formatDate(body.fecha || document.fecha_creacion) },
  responsables: clean(body.responsables || user.dependencia, 500),
  responsable_document: clean(body.responsable_document, 100),
  responsable_role: clean(body.responsable_role, 220),
  dependencia: clean(body.dependencia || user.dependencia, 500),
  lugar: clean(body.lugar, 500),
  fecha: clean(body.fecha, 50),
  horario: clean(body.horario, 100),
  objetivo: [sanitizeRichText(body.objetivo)],
  desarrollo: [sanitizeRichText(body.desarrollo)],
  conclusiones: [sanitizeRichText(body.conclusiones)]
});

const saveDraft = wrap(async (req, res) => {
  if (!(await getMeetingMinuteFeatureState())) throw Object.assign(new Error('El formulario de actas de reunión no está habilitado.'), { statusCode: 403 });
  const document = await Documento.findByPk(req.body.documento_id);
  if (!document || !isMeetingMinuteDocument(document)) throw Object.assign(new Error('El formato seleccionado no corresponde al Registro de Asistencia y Reunión.'), { statusCode: 422 });
  const participants = Array.isArray(req.body.participants) ? req.body.participants : [];
  if (!clean(req.body.responsable_document)) throw Object.assign(new Error('Consulte al responsable mediante su cédula.'), { statusCode: 422 });
  if (!clean(req.body.responsables)) throw Object.assign(new Error('Consulte y seleccione el responsable de la reunión.'), { statusCode: 422 });
  if (!clean(req.body.dependencia)) throw Object.assign(new Error('La dependencia que cita es obligatoria.'), { statusCode: 422 });
  if (!clean(req.body.lugar)) throw Object.assign(new Error('Seleccione o escriba el lugar de la reunión.'), { statusCode: 422 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean(req.body.fecha, 50))) throw Object.assign(new Error('Seleccione una fecha válida para la reunión.'), { statusCode: 422 });
  if (!participants.length) throw Object.assign(new Error('Agregue al menos un participante.'), { statusCode: 422 });
  if (participants.some((participant) => !clean(participant.name, 240) || !clean(participant.email, 254))) throw Object.assign(new Error('Todos los participantes deben tener nombre y correo.'), { statusCode: 422 });
  const participantKeys = participants.map((participant) => clean(participant.document || participant.email, 254).toLowerCase()).filter(Boolean);
  if (new Set(participantKeys).size !== participantKeys.length) throw Object.assign(new Error('Hay participantes repetidos en el acta.'), { statusCode: 422 });
  if (!richPlainText(req.body.objetivo)) throw Object.assign(new Error('El objetivo de la reunión es obligatorio.'), { statusCode: 422 });

  const minute = await sequelize.transaction(async (transaction) => {
    let row = req.body.id ? await DigitalMeetingMinute.findByPk(req.body.id, { transaction }) : null;
    if (row && !isAdmin(req.user) && Number(row.created_by) !== Number(req.user.id)) throw Object.assign(new Error('No tiene permiso para editar esta acta.'), { statusCode: 403 });
    if (row && row.status !== 'draft') throw Object.assign(new Error('El acta ya fue habilitada para firmas y no puede modificarse.'), { statusCode: 409 });
    const content = normalizeContent(req.body, req.user, document);
    if (!row) {
      const code = `ACTA-${new Date().getFullYear()}-${Date.now().toString().slice(-9)}`;
      row = await DigitalMeetingMinute.create({ documento_id: document.id, code, content, content_hash: contentHash(content), created_by: req.user.id, updated_by: req.user.id }, { transaction });
    } else {
      await row.update({ content, content_hash: contentHash(content), updated_by: req.user.id }, { transaction });
      await DigitalMeetingParticipant.destroy({ where: { minute_id: row.id }, transaction });
    }
    for (const participant of participants) {
      await DigitalMeetingParticipant.create({
        minute_id: row.id,
        user_id: participant.user_id || null,
        document: clean(participant.document, 100) || null,
        name: clean(participant.name, 240),
        email: clean(participant.email, 254).toLowerCase() || null,
        organization: clean(participant.organization, 240) || null,
        role_title: clean(participant.role_title, 220) || null
      }, { transaction });
    }
    return row;
  });
  const result = await DigitalMeetingMinute.findByPk(minute.id, { include: includeRelations });
  res.status(req.body.id ? 200 : 201).json({ success: true, message: 'Borrador del acta guardado.', data: result });
});

const publish = wrap(async (req, res) => {
  const minute = await DigitalMeetingMinute.findByPk(req.params.id, { include: [{ model: DigitalMeetingParticipant, as: 'participants' }, { model: DigitalMeetingSignature, as: 'signatures' }] });
  if (!minute || minute.deleted_at) throw Object.assign(new Error('Acta no encontrada.'), { statusCode: 404 });
  if (!isAdmin(req.user) && Number(minute.created_by) !== Number(req.user.id)) throw Object.assign(new Error('No tiene permiso para publicar esta acta.'), { statusCode: 403 });
  if (!minute.participants?.length || minute.participants.some((participant) => !participant.email)) throw Object.assign(new Error('Todos los participantes deben tener correo para habilitar las firmas.'), { statusCode: 422 });
  const token = crypto.randomBytes(32).toString('base64url');
  await minute.update({ status: 'signing', public_token_hash: hash(token), token_expires_at: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), published_at: new Date(), content_hash: contentHash(minute.content) });
  const signingUrl = `${publicFrontend(req)}/firmar-acta-reunion/${token}`;
  const qr_data_url = await QRCode.toDataURL(signingUrl, { errorCorrectionLevel: 'M', margin: 1, width: 360 });
  res.json({ success: true, message: 'Acta habilitada para firmas mediante QR.', data: { minute: { id: minute.id, code: minute.code, status: minute.status, version: minute.version }, signing_url: signingUrl, qr_data_url } });
});

const publicMinute = wrap(async (req, res) => {
  const minute = await DigitalMeetingMinute.findOne({ where: { public_token_hash: hash(req.params.token), status: 'signing', token_expires_at: { [Op.gt]: new Date() } }, include: [{ model: DigitalMeetingParticipant, as: 'participants' }] });
  if (!minute) throw Object.assign(new Error('El enlace de firma no es válido o venció.'), { statusCode: 404 });
  res.json({ success: true, data: { id: minute.id, code: minute.code, version: minute.version, content: minute.content, participants: minute.participants.filter((p) => p.status !== 'signed').map((p) => ({ id: p.id, name: p.name, role_title: p.role_title, organization: p.organization, external: !p.user_id, email_hint: p.email ? `${p.email.slice(0, 2)}***@${p.email.split('@')[1]}` : '' })) } });
});

const requestCode = wrap(async (req, res) => {
  const minute = await DigitalMeetingMinute.findOne({ where: { public_token_hash: hash(req.params.token), status: 'signing', token_expires_at: { [Op.gt]: new Date() } } });
  const participant = minute && await DigitalMeetingParticipant.findOne({ where: { id: req.body.participant_id, minute_id: minute.id } });
  if (!participant || clean(participant.email).toLowerCase() !== clean(req.body.email).toLowerCase()) throw Object.assign(new Error('Los datos no coinciden con la invitación.'), { statusCode: 422 });
  if (!participant.user_id && req.body.privacy_accepted !== true) throw Object.assign(new Error('Debe aceptar la autorización de tratamiento de datos personales para continuar.'), { statusCode: 422 });
  const otp = String(crypto.randomInt(100000, 999999));
  await participant.update({ otp_hash: hash(otp), otp_expires_at: new Date(Date.now() + 10 * 60 * 1000), otp_attempts: 0 });
  const url = `${publicFrontend(req)}/firmar-acta-reunion/${req.params.token}`;
  const html = renderInstitutionalTemplate({ title: 'Código para firmar el acta de reunión', introHtml: `<p>Hola <strong>${escapeHtml(participant.name)}</strong>. Use este código para confirmar su firma:</p>`, bodyHtml: `<div style="padding:20px;text-align:center;background:#eff6ff;border-radius:12px"><div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#174ea6;user-select:all">${otp}</div><p>Vence en 10 minutos.</p></div><p style="text-align:center"><a href="${escapeHtml(url)}">Abrir el acta para firmar</a></p>` });
  const sent = await sendInstitutionalEmail({ to: participant.email, subject: `${otp} · Código para firmar acta de reunión`, text: `Su código para firmar el acta es ${otp}. Vence en 10 minutos.`, html, allowExternalRecipients: true });
  if (!sent.success) throw Object.assign(new Error('No fue posible enviar el código al correo.'), { statusCode: 503 });
  res.json({ success: true, message: 'Código enviado al correo institucional.' });
});

const sign = wrap(async (req, res) => {
  const minute = await DigitalMeetingMinute.findOne({ where: { public_token_hash: hash(req.params.token), status: 'signing', token_expires_at: { [Op.gt]: new Date() } } });
  const participant = minute && await DigitalMeetingParticipant.findOne({ where: { id: req.body.participant_id, minute_id: minute.id } });
  if (!participant) throw Object.assign(new Error('Participante no válido.'), { statusCode: 404 });
  if (participant.status === 'signed') throw Object.assign(new Error('Este participante ya firmó el acta.'), { statusCode: 409 });
  if (!participant.user_id && req.body.privacy_accepted !== true) throw Object.assign(new Error('Debe aceptar la autorización de tratamiento de datos personales para firmar.'), { statusCode: 422 });
  if (participant.otp_attempts >= 5 || !participant.otp_expires_at || participant.otp_expires_at < new Date() || participant.otp_hash !== hash(req.body.otp)) {
    await participant.increment('otp_attempts');
    throw Object.assign(new Error('Código inválido o vencido.'), { statusCode: 422 });
  }
  const parsed = parseDataUrl(req.body.signature_data);
  ensureDir(SIGNATURE_ROOT);
  const storage = path.join(SIGNATURE_ROOT, `${minute.id}-${participant.id}-${Date.now()}.${parsed.extension}`);
  fs.writeFileSync(storage, parsed.buffer, { flag: 'wx' });
  const signedAt = new Date();
  await DigitalMeetingSignature.create({ minute_id: minute.id, participant_id: participant.id, signer_name: participant.name, signer_email: participant.email, signature_storage_key: storage, signature_hash: hash(parsed.buffer), content_hash: minute.content_hash, signed_at: signedAt, privacy_accepted_at: !participant.user_id ? signedAt : null, privacy_policy_version: !participant.user_id ? PRIVACY_POLICY_VERSION : null, ip_address: req.ip, user_agent: clean(req.headers['user-agent'], 500) });
  await participant.update({ status: 'signed', email_verified_at: new Date(), otp_hash: null, otp_expires_at: null });
  const [participantCount, signedCount] = await Promise.all([
    DigitalMeetingParticipant.count({ where: { minute_id: minute.id } }),
    DigitalMeetingParticipant.count({ where: { minute_id: minute.id, status: 'signed' } })
  ]);
  if (participantCount > 0 && signedCount === participantCount) {
    await minute.update({ status: 'signed', finalized_at: signedAt, token_expires_at: signedAt });
  }
  res.json({ success: true, message: 'Firma registrada y vinculada al acta.', data: { id: participant.id } });
});

const downloadWord = wrap(async (req, res) => {
  const minute = await DigitalMeetingMinute.findByPk(req.params.id, { include: [{ model: DigitalMeetingParticipant, as: 'participants' }, { model: DigitalMeetingSignature, as: 'signatures' }] });
  if (!minute || minute.deleted_at) throw Object.assign(new Error('Acta no encontrada.'), { statusCode: 404 });
  if (!isAdmin(req.user) && Number(minute.created_by) !== Number(req.user.id)) throw Object.assign(new Error('No tiene permiso para descargar esta acta.'), { statusCode: 403 });
  const buffer = await buildSignedMinuteBuffer(minute);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${minute.code}.docx"`);
  res.send(buffer);
});

const sendFinalMinute = wrap(async (req, res) => {
  const minute = await DigitalMeetingMinute.findByPk(req.params.id, { include: [{ model: DigitalMeetingParticipant, as: 'participants' }, { model: DigitalMeetingSignature, as: 'signatures' }] });
  if (!minute || minute.deleted_at) throw Object.assign(new Error('Acta no encontrada.'), { statusCode: 404 });
  if (Number(minute.created_by) !== Number(req.user.id)) throw Object.assign(new Error('Solo la persona que creó el acta puede enviarla.'), { statusCode: 403 });
  if (!minute.participants?.length || minute.participants.some((participant) => participant.status !== 'signed')) {
    throw Object.assign(new Error('El acta solo puede enviarse cuando todas las personas hayan firmado.'), { statusCode: 422 });
  }

  const recipients = [...new Set(minute.participants.map((participant) => clean(participant.email, 254).toLowerCase()).filter(Boolean))];
  if (!recipients.length) throw Object.assign(new Error('El acta no tiene correos de participantes para el envío.'), { statusCode: 422 });
  const buffer = await buildSignedMinuteBuffer(minute);
  const meetingDate = formatDate(minute.content?.fecha);
  const attachment = { filename: `${minute.code}.docx`, content: buffer, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  const html = renderInstitutionalTemplate({
    title: 'Acta de reunión firmada',
    introHtml: '<p>Cordial saludo,</p><p>El proceso de firma del acta de reunión ha finalizado.</p>',
    bodyHtml: `<div style="padding:16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px"><p style="margin:0 0 6px"><strong>Acta:</strong> ${escapeHtml(minute.code)}</p><p style="margin:0"><strong>Fecha:</strong> ${escapeHtml(meetingDate)}</p></div><p>Se adjunta la versión final con las firmas registradas.</p>`
  });

  const results = [];
  for (const recipient of recipients) {
    try {
      const result = await sendInstitutionalEmail({
        to: recipient,
        subject: `${minute.code} · Acta de reunión firmada`,
        text: `El acta ${minute.code}, con fecha ${meetingDate}, ha sido firmada por todos los participantes. Se adjunta la versión final.`,
        html,
        attachments: [attachment],
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

module.exports = { downloadWord, getConfig, getMinute, listMinutes, lookupParticipant, publicMinute, publish, requestCode, saveDraft, sendFinalMinute, sign, updateConfig };
