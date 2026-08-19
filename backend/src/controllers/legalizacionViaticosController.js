const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  DesplazamientoViaticosSolicitud,
  ViaticosLegalizacion,
  ViaticosLegalizacionAdjunto,
  UserModulePermission
} = require('../models');
const { ROLES } = require('../constants/roles');
const { getDesplazamientoViaticosRecipients, normalizeEmail } = require('../config/desplazamientoViaticosConfig');
const { sendInstitutionalEmail, renderInstitutionalTemplate, escapeHtml } = require('../services/emailService');
const { buildLegalizacionPdfBuffer } = require('../services/desplazamientoViaticos/legalizacionPdfService');

const MANAGEMENT_PERMISSION = 'vicerrectoria_financiera.viaticos.gestion';
const STATS_PERMISSION = 'vicerrectoria_financiera.viaticos.estadistica';
const uploadRoot = path.resolve(__dirname, '../../uploads/legalizaciones_viaticos');
const today = () => new Date().toISOString().slice(0, 10);
const clean = (value, max = 2000) => String(value || '').trim().slice(0, max);
const currency = (value) => `$${Number(value || 0).toLocaleString('es-CO')}`;
const removeUploadedFiles = (files = []) => files.forEach((file) => {
  const resolved = file?.path ? path.resolve(file.path) : '';
  if (!resolved.startsWith(uploadRoot)) return;
  try { if (fs.existsSync(resolved)) fs.unlinkSync(resolved); } catch (_) { /* Limpieza de carga fallida. */ }
});
const trace = (legalizacion, event, actor = {}, detail = {}) => [
  ...(legalizacion.trazabilidad || []),
  { event, actor, detail, at: new Date().toISOString() }
];

const controlledTestRecipients = (solicitud) => {
  if (!solicitud?.datos_viaticos?.pruebaControlada) return null;
  const configured = Array.isArray(solicitud.datos_viaticos.correosPrueba)
    ? solicitud.datos_viaticos.correosPrueba
    : [];
  return [...new Set(configured.map(normalizeEmail).filter(Boolean))];
};

const legalizationRecipients = (solicitud, fallbackCollaboratorEmail) => {
  const testRecipients = controlledTestRecipients(solicitud);
  if (testRecipients) return testRecipients;
  return [
    normalizeEmail(solicitud?.solicitante_snapshot?.email || fallbackCollaboratorEmail),
    getDesplazamientoViaticosRecipients().tecnicoContable
  ].filter(Boolean);
};

const legalizationMailThread = (legalizacion, solicitud) => {
  const testPrefix = controlledTestRecipients(solicitud) ? 'PRUEBA CONTROLADA | ' : '';
  const rootMessageId = `<legalizacion-${legalizacion.id}-${legalizacion.codigo_verificacion}@siac.unicesmag.edu.co>`;
  return {
    subject: `${testPrefix}Legalización de viáticos | ${solicitud.consecutivo}`,
    rootMessageId,
    finalMessageId: `<legalizacion-${legalizacion.id}-${legalizacion.codigo_verificacion}-validada@siac.unicesmag.edu.co>`
  };
};

const legalizationEmailSummary = (legalizacion, solicitud, statusLabel) => {
  const details = legalizacion.detalles || [];
  const totalAnticipo = details.reduce((sum, row) => sum + Number(row.valorAnticipo || 0), 0);
  const totalLegalizado = details.reduce((sum, row) => sum + Number(row.valorLegalizado || 0), 0);
  const difference = totalAnticipo - totalLegalizado;
  const isFavorUni = difference >= 0;

  const detailRows = details.map((row) => `
    <tr>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #1e293b;">
        <strong>${escapeHtml(row.detalle)}</strong>
      </td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 13px; color: #475569;">
        ${escapeHtml(currency(row.valorAnticipo))}
      </td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 13px; font-weight: 700; color: #0b3a6f;">
        ${escapeHtml(currency(row.valorLegalizado))}
      </td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 13px; font-weight: 700; color: ${Number(row.diferencia ?? (Number(row.valorAnticipo) - Number(row.valorLegalizado))) < 0 ? '#b91c1c' : '#15803d'};">
        ${escapeHtml(currency(row.diferencia ?? (Number(row.valorAnticipo) - Number(row.valorLegalizado))))}
      </td>
    </tr>
  `).join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: separate; border: 1px solid #dce6f2; border-radius: 12px; overflow: hidden; background-color: #ffffff; margin: 16px 0 20px 0; box-shadow: 0 4px 14px rgba(11, 58, 111, 0.05); font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
      <!-- Header -->
      <tr>
        <td style="padding: 16px 20px; background-color: #0b3a6f; color: #ffffff;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td valign="middle">
                <div style="font-size: 10.5px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #bfdbfe; margin-bottom: 3px;">LEGALIZACIÓN DE VIÁTICOS Y GASTOS DE VIAJE</div>
                <div style="font-size: 17px; font-weight: 800; color: #ffffff;">${escapeHtml(solicitud.consecutivo)}</div>
              </td>
              <td align="right" valign="middle">
                <span style="display: inline-block; padding: 5px 12px; background-color: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.35); border-radius: 16px; font-size: 12px; font-weight: 700; color: #ffffff;">
                  ${escapeHtml(statusLabel)}
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Datos del Solicitante -->
      <tr>
        <td style="padding: 14px 18px; background-color: #f8fbff; border-bottom: 1px solid #e8eef5;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="50%" valign="top" style="padding-right: 10px;">
                <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 3px;">COLABORADOR</div>
                <div style="font-size: 13.5px; font-weight: 700; color: #1e293b;">${escapeHtml(solicitud.solicitante_snapshot?.nombre || '')}</div>
              </td>
              <td width="50%" valign="top">
                <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 3px;">DEPENDENCIA</div>
                <div style="font-size: 13px; font-weight: 600; color: #334155;">${escapeHtml(solicitud.datos_laborales?.dependencia || '')}</div>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top: 10px;">
                <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 3px;">DESTINO</div>
                <div style="font-size: 13px; font-weight: 700; color: #0b3a6f;">${escapeHtml(solicitud.datos_viaticos?.lugarVisitar || solicitud.datos_salida?.municipio || '')}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Tabla de Conceptos -->
      <tr>
        <td style="padding: 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
            <thead>
              <tr style="background-color: #e8eef6;">
                <th align="left" style="padding: 10px 14px; font-size: 11px; font-weight: 800; color: #24364b; text-transform: uppercase;">Concepto</th>
                <th align="right" style="padding: 10px 14px; font-size: 11px; font-weight: 800; color: #24364b; text-transform: uppercase;">Anticipo</th>
                <th align="right" style="padding: 10px 14px; font-size: 11px; font-weight: 800; color: #24364b; text-transform: uppercase;">Legalizado</th>
                <th align="right" style="padding: 10px 14px; font-size: 11px; font-weight: 800; color: #24364b; text-transform: uppercase;">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              ${detailRows}
            </tbody>
            <tfoot>
              <tr style="background-color: #eff6ff; font-weight: 800;">
                <td style="padding: 12px 14px; font-size: 13px; color: #0b3a6f;">TOTALES</td>
                <td align="right" style="padding: 12px 14px; font-size: 13px; color: #0b3a6f;">${escapeHtml(currency(totalAnticipo))}</td>
                <td align="right" style="padding: 12px 14px; font-size: 13px; color: #0b3a6f;">${escapeHtml(currency(totalLegalizado))}</td>
                <td align="right" style="padding: 12px 14px; font-size: 13px; color: ${difference < 0 ? '#b91c1c' : '#15803d'};">${escapeHtml(currency(difference))}</td>
              </tr>
            </tfoot>
          </table>
        </td>
      </tr>

      <!-- Saldo Final -->
      <tr>
        <td style="padding: 14px 18px; background-color: ${isFavorUni ? '#f0fdf4' : '#fffbeb'}; border-top: 1px solid ${isFavorUni ? '#bbf7d0' : '#fed7aa'};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <div style="font-size: 10.5px; font-weight: 800; text-transform: uppercase; color: ${isFavorUni ? '#166534' : '#9a3412'}; margin-bottom: 2px;">
                  ${isFavorUni ? 'SALDO A REINTEGRAR A LA UNIVERSIDAD' : 'SALDO A FAVOR DEL COLABORADOR'}
                </div>
                <div style="font-size: 18px; font-weight: 800; color: ${isFavorUni ? '#15803d' : '#c2410c'};">
                  ${escapeHtml(currency(Math.abs(difference)))} COP
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
};

const canAccess = async (user, permission) => {
  if (user?.role === ROLES.ADMINISTRADOR) return true;
  return Boolean(await UserModulePermission.count({ where: { user_id: user.id, module_key: permission, can_view: true } }));
};

const effectiveState = (legalizacion) => {
  if (!legalizacion) return null;
  if (['finalizada', 'en_revision'].includes(legalizacion.estado)) return legalizacion.estado;
  const current = today();
  if (current < legalizacion.fecha_habilitacion) return 'pendiente_habilitacion';
  if (current > legalizacion.fecha_limite) return 'legalizacion_vencida';
  return legalizacion.estado === 'presentada' ? 'en_revision' : 'pendiente_legalizacion';
};

const safeLegalizacion = (legalizacion) => {
  if (!legalizacion) return null;
  const data = legalizacion.toJSON ? legalizacion.toJSON() : legalizacion;
  return {
    ...data,
    estado: effectiveState(data),
    adjuntos: (data.adjuntos || []).map(({ path: _path, ...file }) => file)
  };
};

const includeLegalizacion = [{ model: ViaticosLegalizacion, as: 'legalizacion', required: false }];

const listarPropias = async (req, res) => {
  try {
    const solicitudes = await DesplazamientoViaticosSolicitud.findAll({
      where: { user_id: req.user.id },
      include: [{ model: ViaticosLegalizacion, as: 'legalizacion', required: true }],
      order: [['created_at', 'DESC']]
    });
    const rows = solicitudes.filter((row) => row.legalizacion).map((row) => ({
      solicitud: row.toJSON(),
      legalizacion: safeLegalizacion(row.legalizacion)
    }));
    return res.json({ success: true, total: rows.length, data: rows });
  } catch (error) {
    console.error('Error en listarPropias:', error);
    return res.json({ success: true, total: 0, data: [] });
  }
};

const estadoPropio = async (req, res) => {
  try {
    const legalizaciones = await ViaticosLegalizacion.findAll({ where: { user_id: req.user.id } });
    const active = legalizaciones.map(safeLegalizacion).filter((item) => !['finalizada', 'en_revision'].includes(item.estado));
    return res.json({ success: true, active: active.length, overdue: active.filter((item) => item.estado === 'legalizacion_vencida').length });
  } catch (error) {
    console.error('Error en estadoPropio:', error);
    return res.json({ success: true, active: 0, overdue: 0 });
  }
};

const presentar = async (req, res) => {
  const rejectUpload = (status, message) => {
    removeUploadedFiles(req.files);
    return res.status(status).json({ success: false, message });
  };
  const legalizacion = await ViaticosLegalizacion.findOne({
    where: { id: req.params.id, user_id: req.user.id },
    include: [{ model: DesplazamientoViaticosSolicitud, as: 'solicitud', required: true }]
  });
  if (!legalizacion) return rejectUpload(404, 'Legalización no encontrada.');
  if (['en_revision', 'finalizada'].includes(effectiveState(legalizacion))) return rejectUpload(409, 'La legalización ya fue enviada o finalizada.');

  let submitted;
  try {
    submitted = JSON.parse(req.body.detalles || '[]');
  } catch (_) {
    return rejectUpload(400, 'El detalle de la legalización no es válido.');
  }
  const expected = legalizacion.detalles || [];
  if (!Array.isArray(submitted) || submitted.length !== expected.length) return rejectUpload(400, 'Debe legalizar todos los conceptos autorizados.');
  const files = Array.isArray(req.files) ? req.files : [];
  const result = [];
  const attachments = [];
  const storedAttachmentIds = [];
  for (const concept of expected) {
    const received = submitted.find((item) => item.id === concept.id);
    const legalized = Number(received?.valorLegalizado);
    if (!Number.isFinite(legalized) || legalized < 0) {
      return rejectUpload(400, `Ingrese un valor legalizado válido para ${concept.detalle}.`);
    }
  }
  for (const concept of expected) {
    const received = submitted.find((item) => item.id === concept.id);
    const legalized = Number(received?.valorLegalizado);
    if (!Number.isFinite(legalized) || legalized < 0) return rejectUpload(400, `Ingrese un valor legalizado válido para ${concept.detalle}.`);
    const support = files.find((file) => file.fieldname === `soporte_${concept.id}`);
    result.push({ ...concept, valorLegalizado: legalized, diferencia: Number(concept.valorAnticipo || 0) - legalized });
    if (support) {
      try {
        const contenido = await fs.promises.readFile(support.path);
        const stored = await ViaticosLegalizacionAdjunto.create({
          legalizacion_id: legalizacion.id,
          concepto_id: clean(concept.id, 120),
          detalle: clean(concept.detalle, 500),
          storage_key: support.filename,
          nombre_original: path.basename(clean(support.originalname, 500)),
          mime_type: clean(support.mimetype || 'application/octet-stream', 120),
          extension: path.extname(support.originalname || support.filename).toLowerCase().slice(0, 20),
          tamano_bytes: contenido.length,
          sha256: crypto.createHash('sha256').update(contenido).digest('hex'),
          contenido,
          metadata: { persistido_en_base_datos: true, cargado_por: req.user.id }
        });
        storedAttachmentIds.push(stored.id);
        attachments.push({
          id: String(stored.id),
          conceptoId: concept.id,
          detalle: concept.detalle,
          originalName: stored.nombre_original,
          filename: stored.storage_key,
          mimetype: stored.mime_type,
          size: Number(stored.tamano_bytes),
          persistidoEnBaseDatos: true
        });
      } catch (error) {
        if (storedAttachmentIds.length) {
          await ViaticosLegalizacionAdjunto.destroy({ where: { id: storedAttachmentIds } }).catch(() => null);
        }
        return rejectUpload(500, `No fue posible guardar en la base de datos el soporte de ${concept.detalle}.`);
      }
    }
  }
  const actor = { id: req.user.id, nombre: req.user.nombre || req.user.name, email: req.user.email };
  try {
    await legalizacion.update({
      estado: 'en_revision',
      detalles: result,
      observaciones: clean(req.body.observaciones),
      adjuntos: attachments,
      presentado_at: new Date(),
      trazabilidad: trace(legalizacion, 'legalizacion_presentada', actor)
    });
  } catch (error) {
    if (storedAttachmentIds.length) {
      await ViaticosLegalizacionAdjunto.destroy({ where: { id: storedAttachmentIds } }).catch(() => null);
    }
    return rejectUpload(500, 'No fue posible registrar la legalización en la base de datos.');
  }
  const mailThread = legalizationMailThread(legalizacion, legalizacion.solicitud);
  const mailResult = await sendInstitutionalEmail({
    to: legalizationRecipients(legalizacion.solicitud, req.user.email),
    subject: mailThread.subject,
    messageId: mailThread.rootMessageId,
    text: 'La legalización fue presentada y quedó pendiente de revisión del Técnico Contable.',
    html: renderInstitutionalTemplate({
      title: 'Legalización de viáticos presentada',
      introHtml: `<p style="margin: 0 0 10px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 14px 0;">El colaborador <strong>${escapeHtml(legalizacion.solicitud?.solicitante_snapshot?.nombre || '')}</strong> ha presentado y firmado electrónicamente la legalización de viáticos de la comisión <strong>${escapeHtml(legalizacion.solicitud.consecutivo)}</strong>. La actuación pasa a revisión y validación por parte del Técnico Contable.</p>`,
      bodyHtml: `${legalizationEmailSummary(legalizacion, legalizacion.solicitud, 'Pendiente de revisión del Técnico Contable')}<p style="margin: 12px 0 4px; font-size: 13.5px;"><strong>Soportes adjuntos archivados:</strong> ${attachments.length}</p><p style="color:#64748b; font-size: 12px; margin: 0;">Los anexos y comprobantes quedaron debidamente respaldados en la base de datos institucional.</p>`
    }),
    attachments: await Promise.all(attachments.map(async (file) => {
      const stored = await ViaticosLegalizacionAdjunto.findByPk(file.id);
      return {
        filename: file.originalName,
        content: Buffer.from(stored.contenido),
        contentType: stored.mime_type
      };
    }))
  });
  removeUploadedFiles(files);
  return res.status(201).json({ success: true, message: 'Legalización enviada al Técnico Contable.', emailSent: mailResult.success });
};

const listarGestion = async (req, res) => {
  if (!(await canAccess(req.user, MANAGEMENT_PERMISSION))) return res.status(403).json({ success: false, message: 'No tiene permiso para Gestión de Viáticos.' });
  const where = {};
  if (req.query.estado && req.query.estado !== 'todas') where.estado = req.query.estado;
  if (req.query.search) {
    where[Op.or] = [
      { consecutivo: { [Op.iLike]: `%${clean(req.query.search, 120)}%` } },
      { solicitante_snapshot: { [Op.contains]: { nombre: clean(req.query.search, 120) } } }
    ];
  }
  const solicitudes = await DesplazamientoViaticosSolicitud.findAll({ where, include: includeLegalizacion, order: [['created_at', 'DESC']], limit: 500 });
  return res.json({ success: true, data: solicitudes.map((row) => ({ ...row.toJSON(), legalizacion: safeLegalizacion(row.legalizacion) })) });
};

const obtenerGestion = async (req, res) => {
  if (!(await canAccess(req.user, MANAGEMENT_PERMISSION))) return res.status(403).json({ success: false, message: 'No tiene permiso para Gestión de Viáticos.' });
  const solicitud = await DesplazamientoViaticosSolicitud.findByPk(req.params.solicitudId, { include: includeLegalizacion });
  if (!solicitud) return res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
  return res.json({ success: true, data: { ...solicitud.toJSON(), legalizacion: safeLegalizacion(solicitud.legalizacion) } });
};

const verAdjunto = async (req, res) => {
  const legalizacion = await ViaticosLegalizacion.findByPk(req.params.id);
  if (!legalizacion) return res.status(404).json({ success: false, message: 'Legalización no encontrada.' });
  const owner = Number(legalizacion.user_id) === Number(req.user.id);
  if (!owner && !(await canAccess(req.user, MANAGEMENT_PERMISSION))) return res.status(403).json({ success: false, message: 'No autorizado.' });
  const attachment = (legalizacion.adjuntos || []).find((file) => file.id === req.params.fileId);
  if (attachment) {
    const stored = await ViaticosLegalizacionAdjunto.findOne({
      where: { id: attachment.id, legalizacion_id: legalizacion.id }
    });
    if (stored?.contenido) {
      res.setHeader('Content-Type', stored.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(stored.nombre_original)}"`);
      return res.send(Buffer.from(stored.contenido));
    }
  }
  const resolved = attachment?.path ? path.resolve(attachment.path) : '';
  if (!attachment || !resolved.startsWith(uploadRoot) || !fs.existsSync(resolved)) return res.status(404).json({ success: false, message: 'El soporte temporal ya no está disponible.' });
  res.setHeader('Content-Type', attachment.mimetype || 'application/octet-stream');
  return res.sendFile(resolved);
};

const validar = async (req, res) => {
  if (!(await canAccess(req.user, MANAGEMENT_PERMISSION))) return res.status(403).json({ success: false, message: 'No tiene permiso para validar legalizaciones.' });
  const legalizacion = await ViaticosLegalizacion.findByPk(req.params.id, { include: [{ model: DesplazamientoViaticosSolicitud, as: 'solicitud', required: true }] });
  if (!legalizacion) return res.status(404).json({ success: false, message: 'Legalización no encontrada.' });
  if (legalizacion.estado === 'finalizada') return res.status(409).json({ success: false, message: 'La legalización ya fue finalizada.' });
  if (legalizacion.estado !== 'en_revision') return res.status(409).json({ success: false, message: 'La legalización todavía no fue presentada.' });
  let details = legalizacion.detalles || [];
  if (req.body.detalles) {
    const edited = Array.isArray(req.body.detalles) ? req.body.detalles : JSON.parse(req.body.detalles);
    details = details.map((row) => {
      const update = edited.find((item) => item.id === row.id);
      const legalized = Number(update?.valorLegalizado ?? row.valorLegalizado);
      if (!Number.isFinite(legalized) || legalized < 0) throw new Error(`Valor inválido para ${row.detalle}.`);
      return { ...row, valorLegalizado: legalized, diferencia: Number(row.valorAnticipo) - legalized };
    });
  }
  const actor = { id: req.user.id, nombre: req.user.nombre || req.user.name, email: req.user.email };
  const finalTrace = trace(legalizacion, 'legalizacion_validada', actor, { observaciones: clean(req.body.observaciones) });
  await legalizacion.update({ detalles: details, observaciones: clean(req.body.observaciones || legalizacion.observaciones), trazabilidad: finalTrace });
  const pdf = await buildLegalizacionPdfBuffer(legalizacion, legalizacion.solicitud);
  const storedAttachments = await ViaticosLegalizacionAdjunto.findAll({
    where: { legalizacion_id: legalizacion.id },
    order: [['id', 'ASC']]
  });
  const mailThread = legalizationMailThread(legalizacion, legalizacion.solicitud);
  const result = await sendInstitutionalEmail({
    to: legalizationRecipients(legalizacion.solicitud),
    subject: mailThread.subject,
    messageId: mailThread.finalMessageId,
    inReplyTo: mailThread.rootMessageId,
    references: mailThread.rootMessageId,
    text: 'La legalización de viáticos fue revisada y validada por el Técnico Contable.',
    html: renderInstitutionalTemplate({
      title: 'Legalización de viáticos validada',
      introHtml: `<p style="margin: 0 0 10px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 14px 0;">La legalización de viáticos correspondiente a la solicitud <strong>${escapeHtml(legalizacion.solicitud.consecutivo)}</strong> fue revisada, validada y firmada electrónicamente por el Técnico Contable. Se adjuntan el formato oficial en PDF y sus respectivos soportes.</p>`,
      bodyHtml: `${legalizationEmailSummary(legalizacion, legalizacion.solicitud, 'Legalización validada y finalizada')}<p style="color:#64748b; font-size: 12px; margin-top: 12px;">El documento PDF incorpora las firmas electrónicas del colaborador y del Técnico Contable, la trazabilidad completa, el código QR y el enlace institucional de verificación.</p>`
    }),
    attachments: [
      { filename: `LEGALIZACION-VIATICOS-${legalizacion.solicitud.consecutivo}.pdf`, content: pdf, contentType: 'application/pdf' },
      ...storedAttachments.map((file) => ({
        filename: file.nombre_original,
        content: Buffer.from(file.contenido),
        contentType: file.mime_type
      }))
    ]
  });
  if (!result.success) return res.status(502).json({ success: false, message: 'No fue posible enviar los documentos finales. Los soportes se conservaron para reintentar.', error: result.error });
  await legalizacion.update({
    estado: 'finalizada',
    revisado_at: new Date(),
    revisado_por: req.user.id,
    finalizado_at: new Date(),
    adjuntos: (legalizacion.adjuntos || []).map(({ path: _path, ...file }) => ({ ...file, persistidoEnBaseDatos: true }))
  });
  await legalizacion.solicitud.update({ estado: 'legalizacion_finalizada' });
  return res.json({ success: true, message: 'Legalización validada y enviada. Los soportes permanecen respaldados en la base de datos.' });
};

const estadisticas = async (req, res) => {
  if (!(await canAccess(req.user, STATS_PERMISSION))) return res.status(403).json({ success: false, message: 'No tiene permiso para Estadística de Viáticos.' });
  const solicitudes = await DesplazamientoViaticosSolicitud.findAll({ include: includeLegalizacion, order: [['created_at', 'DESC']] });
  const totals = { solicitudes: solicitudes.length, liquidado: 0, pagoAutorizado: 0, legalizado: 0, pendienteLegalizar: 0, rechazadas: 0 };
  const rubros = {};
  const actividades = {};
  const dependencias = {};
  const destinos = {};
  solicitudes.forEach((solicitud) => {
    if (solicitud.estado === 'no_aprobada') totals.rechazadas += 1;
    (solicitud.liquidacion?.detalles || []).forEach((row) => {
      const amount = Number(row.valorTotal || 0);
      totals.liquidado += amount;
      rubros[row.detalle] = (rubros[row.detalle] || 0) + amount;
    });
    const totalSolicitud = Number(solicitud.liquidacion?.totalAnticipo || 0);
    if (['pago_autorizado_pendiente_legalizacion', 'legalizacion_finalizada'].includes(solicitud.estado)) totals.pagoAutorizado += totalSolicitud;
    (solicitud.legalizacion?.detalles || []).forEach((row) => { totals.legalizado += Number(row.valorLegalizado || 0); });
    if (solicitud.estado === 'pago_autorizado_pendiente_legalizacion') totals.pendienteLegalizar += 1;
    const activity = solicitud.datos_salida?.motivo || solicitud.datos_viaticos?.objetoComision || 'Sin clasificar';
    actividades[activity] = (actividades[activity] || 0) + totalSolicitud;
    const dependencia = solicitud.datos_laborales?.dependencia || 'Sin clasificar';
    const destino = solicitud.datos_viaticos?.lugarVisitar || solicitud.datos_salida?.municipio || 'Sin clasificar';
    dependencias[dependencia] = (dependencias[dependencia] || 0) + totalSolicitud;
    destinos[destino] = (destinos[destino] || 0) + totalSolicitud;
  });
  const rows = (record) => Object.entries(record).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  return res.json({ success: true, data: { totals, rubros: rows(rubros), actividades: rows(actividades), dependencias: rows(dependencias), destinos: rows(destinos) } });
};

const verificar = async (req, res) => {
  const legalizacion = await ViaticosLegalizacion.findOne({ where: { codigo_verificacion: req.params.codigo }, include: [{ model: DesplazamientoViaticosSolicitud, as: 'solicitud', required: true }] });
  if (!legalizacion) return res.status(404).json({ success: false, message: 'Documento no encontrado.' });
  const transactionCode = String(legalizacion.codigo_verificacion || '').toUpperCase();
  const payload = { success: true, documento: 'ADF-PP-FR-005 - Legalización de viáticos', consecutivo: legalizacion.solicitud.consecutivo, codigoValidacionTransaccional: transactionCode, estado: effectiveState(legalizacion), finalizadoAt: legalizacion.finalizado_at };
  if (req.query.format === 'json' || String(req.headers.accept || '').includes('application/json')) return res.json(payload);
  const status = effectiveState(legalizacion);
  return res.send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Validación de legalización</title><style>body{margin:0;padding:24px;background:#eef4fa;font-family:Arial,sans-serif;color:#24364b}.card{max-width:760px;margin:auto;background:#fff;border-radius:18px;box-shadow:0 18px 45px #0f172a24;overflow:hidden}.header{width:100%;max-height:150px;object-fit:contain}.bar{padding:18px 28px;background:#0b3a6f;color:#fff}.body{padding:30px}.status{display:inline-block;padding:8px 13px;border-radius:999px;background:#dcfce7;color:#166534;font-weight:800}.row{padding:13px 0;border-bottom:1px solid #e2e8f0}.row span{display:block;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase}.row strong{display:block;margin-top:4px;font-size:16px;overflow-wrap:anywhere}</style></head><body><main class="card"><img class="header" src="/api/desplazamientos-viaticos/assets/encabezado-correos.png" alt="Universidad CESMAG"><div class="bar"><strong>SIAC UNICESMAG</strong><div>Validación institucional de documentos</div></div><section class="body"><h1>Legalización de viáticos</h1><p class="status">Documento encontrado</p><div class="row"><span>Formato</span><strong>ADF-PP-FR-005</strong></div><div class="row"><span>Consecutivo</span><strong>${escapeHtml(legalizacion.solicitud.consecutivo)}</strong></div><div class="row"><span>Código de validación transaccional</span><strong>${escapeHtml(transactionCode)}</strong></div><div class="row"><span>Estado</span><strong>${escapeHtml(status.replaceAll('_', ' '))}</strong></div><div class="row"><span>Finalizado</span><strong>${escapeHtml(legalizacion.finalizado_at ? new Date(legalizacion.finalizado_at).toLocaleString('es-CO') : 'Pendiente')}</strong></div></section></main></body></html>`);
};

const descargarPdf = async (req, res) => {
  const legalizacion = await ViaticosLegalizacion.findByPk(req.params.id, { include: [{ model: DesplazamientoViaticosSolicitud, as: 'solicitud', required: true }] });
  if (!legalizacion) return res.status(404).json({ success: false, message: 'Legalización no encontrada.' });
  const owner = Number(legalizacion.user_id) === Number(req.user.id);
  if (!owner && !(await canAccess(req.user, MANAGEMENT_PERMISSION))) return res.status(403).json({ success: false, message: 'No autorizado.' });
  if (legalizacion.estado !== 'finalizada') return res.status(409).json({ success: false, message: 'El PDF final aún no está disponible.' });
  const pdf = await buildLegalizacionPdfBuffer(legalizacion, legalizacion.solicitud);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="LEGALIZACION-VIATICOS-${legalizacion.solicitud.consecutivo}.pdf"`);
  return res.send(pdf);
};

module.exports = { descargarPdf, estadoPropio, estadisticas, listarGestion, listarPropias, obtenerGestion, presentar, validar, verAdjunto, verificar };
