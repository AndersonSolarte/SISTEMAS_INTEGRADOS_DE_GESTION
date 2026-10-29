const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sequelize } = require('../../config/database');
const { ViaticosLegalizacion, ViaticosLegalizacionAdjunto, DesplazamientoViaticosSolicitud } = require('../../models');
const { getDesplazamientoViaticosRecipients, normalizeEmail } = require('../../config/desplazamientoViaticosConfig');
const { canValidateLegalizacion, canReviewAccounting, canAccessSolicitud } = require('./accessScope');
const { enqueueWorkflowEmail, kickSubmissionEmails } = require('./legalizacionSubmissionQueue');
const { sendInstitutionalEmail, renderInstitutionalTemplate, escapeHtml } = require('../emailService');
const { buildLegalizacionPdfBuffer } = require('./legalizacionPdfService');

const include = [{ model: DesplazamientoViaticosSolicitud, as: 'solicitud', required: true }];
const fail = (status, message) => { const error = new Error(message); error.status = status; throw error; };
const actorOf = (user) => ({ id: user.id, nombre: user.nombre || user.name, email: user.email });
const trace = (row, event, actor, detail = {}) => [...(row.trazabilidad || []), { event, actor, detail, at: new Date().toISOString() }];
const clean = (value) => String(value || '').trim().slice(0, 2000);
const findLocked = async (id, transaction) => {
  const row = await ViaticosLegalizacion.findByPk(id, { include, transaction, lock: { level: transaction.LOCK.UPDATE, of: ViaticosLegalizacion } });
  if (!row) fail(404, 'Legalización no encontrada.');
  return row;
};

const validateTechnician = async ({ id, user, body = {}, file }) => {
  if (!canValidateLegalizacion(user)) fail(403, 'Esta actuación corresponde al Técnico Contable.');
  if (!file || file.mimetype !== 'application/pdf' || path.extname(file.originalname || '').toLowerCase() !== '.pdf') fail(400, 'Debe adjuntar el documento Legalización de viáticos SEVEN en PDF.');
  const content = await fs.promises.readFile(file.path);
  if (content.subarray(0, 5).toString() !== '%PDF-') fail(400, 'El documento SEVEN no contiene un PDF válido.');
  let submitted;
  try { submitted = typeof body.detalles === 'string' ? JSON.parse(body.detalles) : body.detalles; }
  catch (_) { fail(400, 'El detalle de la legalización no es válido.'); }
  if (!Array.isArray(submitted)) fail(400, 'Debe indicar los conceptos revisados.');
  let finalState;
  await sequelize.transaction(async (transaction) => {
    const row = await findLocked(id, transaction);
    if (!canAccessSolicitud(user, { ...row.solicitud.toJSON(), legalizacion: row })) fail(403, 'No tiene acceso a esta legalización.');
    if (row.estado !== 'en_revision') fail(409, 'Esta legalización no está pendiente de validación técnica.');
    const details = (row.detalles || []).map((item) => {
      const received = submitted.find((input) => input.id === item.id);
      if (!received || received.valorLegalizado === '' || received.valorLegalizado == null || !Number.isFinite(Number(received.valorLegalizado)) || Number(received.valorLegalizado) < 0) fail(400, `Ingrese un valor válido para ${item.detalle}.`);
      return { ...item, valorLegalizado: Number(received.valorLegalizado), diferencia: Number(item.valorAnticipo || 0) - Number(received.valorLegalizado) };
    });
    const stored = await ViaticosLegalizacionAdjunto.create({
      legalizacion_id: row.id, concepto_id: 'seven', detalle: 'Legalización de viáticos SEVEN',
      storage_key: file.filename, nombre_original: path.basename(file.originalname), mime_type: 'application/pdf', extension: '.pdf',
      tamano_bytes: content.length, sha256: crypto.createHash('sha256').update(content).digest('hex'), contenido: content,
      metadata: { clase: 'seven', cargado_por: user.id, temporal: true }
    }, { transaction });
    const oldSeven = (row.adjuntos || []).filter((item) => item.clase === 'seven');
    const attachments = [...(row.adjuntos || []).map((item) => item.clase === 'seven' ? { ...item, clase: 'seven_historial', detalle: 'Versión anterior de legalización SEVEN' } : item), {
      id: String(stored.id), clase: 'seven', conceptoId: 'seven', detalle: 'Legalización de viáticos SEVEN',
      originalName: stored.nombre_original, filename: stored.storage_key, mimetype: stored.mime_type,
      size: Number(stored.tamano_bytes), sha256: stored.sha256, persistidoEnBaseDatos: true
    }];
    const actor = actorOf(user);
    const signedTrace = trace(row, 'legalizacion_validada', actor, { observaciones: clean(body.observaciones), seven: { nombre: stored.nombre_original, sha256: stored.sha256 }, sustituye: oldSeven.map((item) => ({ nombre: item.originalName, sha256: item.sha256 })) });
    const nextState = 'en_revision_contabilidad';
    finalState = nextState;
    await row.update({
      detalles: details, observaciones: clean(body.observaciones || row.observaciones), adjuntos: attachments,
      estado: nextState, revisado_at: new Date(), revisado_por: user.id,
      trazabilidad: trace({ trazabilidad: signedTrace }, 'legalizacion_remitida_contabilidad', actor, { observaciones: clean(body.observaciones) })
    }, { transaction });
    await enqueueWorkflowEmail(row.id, 'review', { transaction });
  });
  kickSubmissionEmails();
  return finalState;
};

const completeExternalAdjustments = async ({ id, user }) => {
  if (!canValidateLegalizacion(user)) fail(403, 'Esta actuación corresponde al Técnico Contable.');
  await sequelize.transaction(async (transaction) => {
    const row = await findLocked(id, transaction);
    if (!canAccessSolicitud(user, { ...row.solicitud.toJSON(), legalizacion: row })) fail(403, 'No tiene acceso a esta legalización.');
    if (row.estado !== 'devuelta_tecnico') fail(409, 'Esta legalización ya fue procesada o no tiene ajustes pendientes.');
    const deliveredReview = [...(row.trazabilidad || [])].reverse().find((entry) => entry.event === 'correo_flujo_enviado' && entry.detail?.kind === 'review');
    await row.update({
      estado: 'finalizada', finalizado_at: new Date(),
      trazabilidad: trace(row, 'ajustes_realizados', actorOf(user), { ajustes_en_sistema_externo: true, genera_correo: false }),
      ...(deliveredReview ? { adjuntos: (row.adjuntos || []).map(({ path: _path, ...file }) => ({ ...file, persistidoEnBaseDatos: false, disponibleEnCorreo: true, enviadoPorCorreoAt: deliveredReview.at })) } : {})
    }, { transaction });
    await row.solicitud.update({ estado: 'legalizacion_finalizada' }, { transaction });
    // Retirar únicamente copias temporales cuya entrega anterior ya fue confirmada.
    if (deliveredReview) await ViaticosLegalizacionAdjunto.destroy({ where: { legalizacion_id: id }, transaction });
  });
};

const reviewAccounting = async ({ id, user, body = {} }) => {
  if (!canReviewAccounting(user)) fail(403, 'Esta actuación corresponde a la Oficina de Contabilidad.');
  if (!['correcta', 'errores'].includes(body.decision)) fail(400, 'Seleccione información correcta o errores en las cuentas asociadas.');
  if (body.decision === 'errores' && !clean(body.observaciones)) fail(400, 'Describa los errores de las cuentas y los ajustes requeridos.');
  await sequelize.transaction(async (transaction) => {
    const row = await findLocked(id, transaction);
    if (!canAccessSolicitud(user, { ...row.solicitud.toJSON(), legalizacion: row })) fail(403, 'No tiene acceso a esta legalización.');
    if (row.estado !== 'en_revision_contabilidad') fail(409, 'La legalización ya no está pendiente de Contabilidad.');
    const correct = body.decision === 'correcta';
    await row.update({ estado: correct ? 'finalizada' : 'devuelta_tecnico', ...(correct ? { finalizado_at: new Date() } : {}),
      trazabilidad: trace(row, correct ? 'contabilidad_validada' : 'contabilidad_observaciones', actorOf(user), { observaciones: clean(body.observaciones) })
    }, { transaction });
    if (correct) await row.solicitud.update({ estado: 'legalizacion_finalizada' }, { transaction });
    await enqueueWorkflowEmail(row.id, correct ? 'final' : 'feedback', { transaction, context: { observaciones: clean(body.observaciones) } });
  });
  kickSubmissionEmails();
};

const sendQueuedNotification = async (id, kind, context = {}, jobKey = crypto.randomUUID()) => {
  // Compatibilidad con cierres de ajustes encolados por la versión anterior.
  if (kind === 'final' && context.correcting) return { success: true, skipped: true };
  const row = await ViaticosLegalizacion.findByPk(id, { include });
  if (!row) return { success: true, skipped: true };
  if (kind === 'review' && row.estado !== 'en_revision_contabilidad') return { success: true, skipped: true };
  if (kind === 'final' && row.estado !== 'finalizada') throw new Error('El expediente aún no está finalizado.');
  if ((row.trazabilidad || []).some((entry) => entry.event === 'correo_flujo_enviado' && entry.detail?.jobKey === jobKey)) return { success: true, skipped: true };
  const config = getDesplazamientoViaticosRecipients();
  const collaborator = row.solicitud.solicitante_snapshot || {};
  const targets = kind === 'review' ? [config.contabilidad, config.tecnicoContable]
    : kind === 'feedback' ? [config.tecnicoContable] : [config.tecnicoContable, config.contabilidad, collaborator.email || collaborator.correo];
  const testRecipients = row.solicitud.datos_viaticos?.pruebaControlada ? row.solicitud.datos_viaticos.correosPrueba : null;
  const recipients = [...new Set((testRecipients || targets).filter(Boolean).map(normalizeEmail))];
  const root = `<legalizacion-${row.id}-${row.codigo_verificacion}@siac.unicesmag.edu.co>`;
  const previous = [...(row.trazabilidad || [])].reverse().find((entry) => entry.detail?.messageId)?.detail.messageId || root;
  const title = kind === 'review' ? 'Legalización pendiente de verificación por Contabilidad' : kind === 'feedback' ? 'Errores en cuentas asociadas: ajustes requeridos' : 'Legalización finalizada satisfactoriamente';
  const collaboratorName = collaborator.nombre || 'colaborador(a)';
  const technicianName = [...(row.trazabilidad || [])].reverse().find((entry) => entry.event === 'legalizacion_validada')?.actor?.nombre;
  const greeting = kind === 'review' ? 'Apreciado equipo de la Oficina de Contabilidad y Técnico Contable:'
    : kind === 'feedback' ? (technicianName ? `Apreciado(a) ${technicianName}, Técnico Contable:` : 'Apreciado Técnico Contable:')
      : `Apreciado(a) ${collaboratorName} y equipos de Contabilidad y Gestión de Viáticos:`;
  const message = kind === 'review'
    ? 'De manera atenta, remitimos el formato de legalización firmado electrónicamente, el documento de legalización de viáticos SEVEN y los soportes correspondientes, para que la Oficina de Contabilidad verifique la información registrada y las cuentas asociadas.'
    : kind === 'feedback'
      ? 'La Oficina de Contabilidad ha revisado la documentación y ha identificado aspectos que requieren ajuste en las cuentas asociadas. Agradecemos atender las observaciones relacionadas a continuación en el sistema correspondiente y, una vez realizados los ajustes, seleccionar “Ajustes realizados” en el SIAC para actualizar el estado del trámite.'
      : 'Nos permitimos informar que la Oficina de Contabilidad verificó la información y las cuentas asociadas, y que el proceso de legalización de viáticos ha finalizado satisfactoriamente. Se adjuntan el formato firmado, el documento SEVEN y los soportes correspondientes para su conocimiento y conservación en el correo institucional.';
  const summary = [
    ['Solicitud', row.solicitud.consecutivo], ['Colaborador(a)', collaboratorName],
    ['Programa / Dependencia', row.solicitud.datos_laborales?.dependencia],
    ['Lugar de la comisión', row.solicitud.datos_viaticos?.lugarVisitar || row.solicitud.datos_salida?.municipio]
  ].filter(([, value]) => value);
  const summaryHtml = `<table role="presentation" style="width:100%;border-collapse:collapse;margin:18px 0;background:#f8fafc">${summary.map(([label, value]) => `<tr><td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;color:#475569;font-weight:bold">${escapeHtml(label)}</td><td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;color:#0b3a6f">${escapeHtml(value)}</td></tr>`).join('')}</table>`;
  const url = `${String(process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '')}/dashboard/gestion-informacion?tab=estadistica&module=vicerrectoria_financiera&panel=viaticos&solicitud=${encodeURIComponent(row.solicitud.id)}&revision=${kind === 'review' ? 'contabilidad' : 'ajustes'}`;
  const files = kind === 'feedback' ? [] : await ViaticosLegalizacionAdjunto.findAll({ where: { legalizacion_id: id }, order: [['id', 'ASC']] });
  const pdf = kind === 'feedback' ? null : await buildLegalizacionPdfBuffer(row, row.solicitud);
  const result = await sendInstitutionalEmail({
    to: recipients, subject: `${testRecipients ? 'PRUEBA CONTROLADA | ' : ''}Legalización de viáticos | ${row.solicitud.consecutivo}`,
    messageId: `<${jobKey}@siac.unicesmag.edu.co>`, inReplyTo: previous, references: [...new Set([root, previous])].join(' '),
    text: `Saludo de Paz y Bien. ${greeting}\n\n${message}\n\n${summary.map(([label, value]) => `${label}: ${value}`).join('\n')}\n${context.observaciones ? `Observaciones de Contabilidad: ${context.observaciones}\n` : ''}${kind === 'final' ? 'No requiere realizar nuevas actuaciones para esta legalización.' : `Ingrese a SIAC para continuar la gestión: ${url}`}\n\nAgradecemos su atención y el compromiso con la gestión oportuna de los procesos institucionales.\nFraternalmente,\nSIAC UNICESMAG`,
    html: renderInstitutionalTemplate({ title,
      introHtml: `<p style="margin:0 0 12px">Saludo de Paz y Bien,</p><p style="margin:0 0 16px"><strong>${escapeHtml(greeting)}</strong></p>`,
      bodyHtml: `<p>${escapeHtml(message)}</p>${summaryHtml}${context.observaciones ? `<div style="padding:14px 16px;margin:16px 0;border-left:4px solid #2563eb;background:#eff6ff"><strong>Observaciones de Contabilidad:</strong><p style="margin:8px 0 0;white-space:pre-line">${escapeHtml(context.observaciones)}</p></div>` : ''}${kind !== 'final' ? `<p style="text-align:center;margin:24px"><a href="${escapeHtml(url)}" style="background:#0b3a6f;color:white;padding:14px 24px;border-radius:8px;text-decoration:none">${kind === 'review' ? 'Verificar información y cuentas' : 'Confirmar ajustes realizados'}</a></p><p>Para continuar, ingrese al SIAC con su cuenta institucional y los permisos correspondientes.</p>` : '<p>No requiere realizar nuevas actuaciones para esta legalización.</p>'}<p>Agradecemos su atención y el compromiso con la gestión oportuna de los procesos institucionales.</p>` }),
    attachments: [...(pdf ? [{ filename: `LEGALIZACION-VIATICOS-${row.solicitud.consecutivo}.pdf`, content: pdf, contentType: 'application/pdf' }] : []), ...files.map((file) => ({ filename: file.nombre_original, content: Buffer.from(file.contenido), contentType: file.mime_type }))]
  });
  if (!result.success || result.suppressed) throw new Error(result.error || 'El envío de correo no fue confirmado.');
  await sequelize.transaction(async (transaction) => {
    const current = await findLocked(id, transaction);
    await current.update({ trazabilidad: trace(current, 'correo_flujo_enviado', { nombre: 'SIAC', role: 'sistema' }, { kind, jobKey, destinatarios: recipients, messageId: result.messageId || null }),
      ...(kind === 'final' ? { adjuntos: (current.adjuntos || []).map(({ path: _path, ...file }) => ({ ...file, sha256: files.find((stored) => String(stored.id) === String(file.id))?.sha256 || file.sha256, persistidoEnBaseDatos: false, disponibleEnCorreo: true, enviadoPorCorreoAt: new Date().toISOString() })) } : {})
    }, { transaction });
    if (kind === 'final') await ViaticosLegalizacionAdjunto.destroy({ where: { legalizacion_id: id }, transaction });
  });
  return result;
};

module.exports = { validateTechnician, completeExternalAdjustments, reviewAccounting, sendQueuedNotification };
