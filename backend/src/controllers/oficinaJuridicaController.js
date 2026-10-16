const crypto = require('crypto');
const ExcelJS = require('exceljs');
const { Op, fn, col, Sequelize } = require('sequelize');
const { JuridicaCaso, JuridicaHistorial, JuridicaAdjunto, User, UserModulePermission } = require('../models');
const { sendInstitutionalEmail, renderInstitutionalTemplate, escapeHtml } = require('../services/emailService');

const USER_FIELDS = ['id', 'nombre', 'email', 'cargo', 'dependencia'];
const CLOSED = ['entregado', 'cerrado', 'cancelado'];
const VALID_STATES = [
  'pendiente_clasificacion', 'asignado', 'en_estudio', 'devuelto_informacion',
  'respuesta_revision', 'aprobado_jefatura', 'pendiente_radicacion_salida',
  'entregado', 'cerrado', 'cancelado'
];

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const normalize = (value) => clean(value, 500).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const parseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number' && value > 20000) {
    const excelDate = new Date(Math.round((value - 25569) * 86400000));
    return Number.isNaN(excelDate.getTime()) ? null : excelDate.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const latam = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  return latam ? `${latam[3]}-${latam[2].padStart(2, '0')}-${latam[1].padStart(2, '0')}` : null;
};
// Helper: Resolver el actor efectivo (permite al SuperAdmin simular perspectivas en pruebas)
const resolveActor = (reqOrUser) => {
  if (reqOrUser?.user) {
    if (reqOrUser.user?.email === 'sgc@unicesmag.edu.co' && reqOrUser.simulatedUser) {
      return reqOrUser.simulatedUser;
    }
    return reqOrUser.user;
  }
  return reqOrUser;
};

const roleFor = (user) => {
  if (user?.email === 'sgc@unicesmag.edu.co') return 'administrador';
  if (user?.role === 'administrador') return 'administrador';

  // 1. Prioridad absoluta: Permiso modular explícito asignado en Gestión de Usuarios
  const perms = (user?.juridicaPermissions || []).map((p) => (typeof p === 'string' ? p : p.module_key));
  if (perms.includes('oficina_juridica.jefatura')) return 'jefatura';
  if (perms.includes('oficina_juridica.secretaria')) return 'secretaria';
  if (perms.includes('oficina_juridica.asesor')) return 'asesor';

  const cargo = normalize(user?.cargo);
  const dep = normalize(user?.dependencia);

  // 2. Fallback institucional: Secretaría
  if (cargo.includes('secretari')) return 'secretaria';

  // 3. Fallback institucional: Jefatura / Asesora Jurídica titular
  if (
    (cargo.includes('asesor') || cargo.includes('jefe') || cargo.includes('director') || cargo.includes('lider')) &&
    !cargo.includes('asistente') &&
    !cargo.includes('auxiliar') &&
    (cargo.includes('jurid') || dep.includes('jurid'))
  ) {
    return 'jefatura';
  }

  // 4. Asistentes y Abogados ejecutores
  return 'asesor';
};
const userSnapshot = (user) => user ? ({ id: user.id, nombre: user.nombre, email: user.email, cargo: user.cargo, dependencia: user.dependencia }) : null;
const addHistory = (caso, userId, evento, previous, next, comentario, datos = {}) =>
  JuridicaHistorial.create({ caso_id: caso.id, usuario_id: userId, evento, estado_anterior: previous, estado_nuevo: next, comentario: clean(comentario, 5000) || null, datos });

// Helper: Extraer los adjuntos del caso en buffers para enviarlos como anexos al correo
const getCaseEmailAttachments = async (casoId, maxBytes = 25 * 1024 * 1024) => {
  try {
    const adjuntos = await JuridicaAdjunto.findAll({
      where: { caso_id: casoId },
      attributes: ['id', 'nombre_original', 'mime_type', 'contenido', 'tamano_bytes'],
      order: [['created_at', 'ASC']]
    });

    let totalBytes = 0;
    const emailAttachments = [];

    for (const adj of adjuntos) {
      if (!adj.contenido) continue;
      const size = Number(adj.tamano_bytes) || adj.contenido.length;
      if (totalBytes + size > maxBytes) {
        console.warn(`[juridicaEmail] Adjunto ${adj.nombre_original} excede límite de tamaño para correo.`);
        continue;
      }
      totalBytes += size;
      emailAttachments.push({
        filename: adj.nombre_original,
        content: adj.contenido,
        contentType: adj.mime_type
      });
    }

    return emailAttachments;
  } catch (err) {
    console.error('[juridicaEmail] Error obteniendo adjuntos del caso:', err);
    return [];
  }
};

// Helper: Obtener dinámicamente todo el personal ACTIVO adscrito a Oficina Jurídica o con permisos explícitos
// Si se crea un nuevo usuario activo o se le asigna permiso, aparece de inmediato. Si se inactiva o elimina, desaparece.
const getJuridicaActiveUsers = async () => {
  const users = await User.findAll({
    attributes: USER_FIELDS,
    where: {
      estado: 'activo',
      [Op.or]: [
        {
          dependencia: { [Op.iLike]: '%JURID%' },
          [Op.and]: [{ dependencia: { [Op.notILike]: '%CONSULTOR%' } }]
        },
        {
          cargo: { [Op.iLike]: '%JURID%' },
          [Op.and]: [{ cargo: { [Op.notILike]: '%CONSULTOR%' } }]
        },
        {
          cargo: { [Op.iLike]: '%ABOGAD%' },
          [Op.and]: [{ cargo: { [Op.notILike]: '%CONSULTOR%' } }]
        }
      ]
    },
    order: [['nombre', 'ASC']]
  });

  // Consultar también usuarios activos con permisos explícitos de oficina_juridica
  const permittedRows = await UserModulePermission.findAll({
    where: {
      can_view: true,
      module_key: {
        [Op.in]: ['oficina_juridica', 'oficina_juridica.jefatura', 'oficina_juridica.secretaria', 'oficina_juridica.asesor']
      }
    },
    attributes: ['user_id', 'module_key']
  });

  const permMap = {};
  const permUserIds = [];
  permittedRows.forEach((r) => {
    if (!permMap[r.user_id]) permMap[r.user_id] = [];
    permMap[r.user_id].push(r.module_key);
    permUserIds.push(r.user_id);
  });

  const existingIds = new Set(users.map((u) => u.id));
  const missingIds = Array.from(new Set(permUserIds)).filter((id) => !existingIds.has(id));

  let allUsers = [...users];
  if (missingIds.length > 0) {
    const extraUsers = await User.findAll({
      attributes: USER_FIELDS,
      where: { id: missingIds, estado: 'activo' },
      order: [['nombre', 'ASC']]
    });
    allUsers.push(...extraUsers);
  }

  allUsers.forEach((u) => {
    u.juridicaPermissions = permMap[u.id] || u.juridicaPermissions || [];
  });

  return allUsers;
};

// Helper: Obtener personal activo agrupado de la Oficina Jurídica
const getJuridicaCoreStaff = async () => {
  try {
    const staff = await getJuridicaActiveUsers();
    const jefatura = staff.filter((u) => roleFor(u) === 'jefatura');
    const secretaria = staff.filter((u) => roleFor(u) === 'secretaria');
    const asesores = staff.filter((u) => roleFor(u) === 'asesor');
    return { all: staff, jefatura, secretaria, asesores };
  } catch (err) {
    console.error('[juridicaEmail] Error obteniendo personal clave:', err);
    return { all: [], jefatura: [], secretaria: [], asesores: [] };
  }
};

// Helper: Enviar notificación institucional por correo con plantilla, anexos y conservación de hilo (Email Threading)
const sendJuridicaNotification = async ({
  caso,
  recipients = [],
  subject,
  title,
  intro,
  badgeText,
  badgeColor = '#0b3a6f',
  details = [],
  actionUrl = '',
  includeAttachments = true,
  isRootEmail = false
}) => {
  try {
    const targetEmails = Array.from(new Set(
      recipients
        .map((r) => (typeof r === 'string' ? r : r?.email))
        .filter((e) => Boolean(e) && String(e).includes('@'))
        .map((e) => String(e).trim().toLowerCase())
    ));

    if (!targetEmails.length) return;

    let attachments = [];
    if (includeAttachments && caso?.id) {
      attachments = await getCaseEmailAttachments(caso.id);
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const linkUrl = actionUrl || `${frontendUrl}/gestion-informacion`;

    // Configuración estricta de Hilo de Conversación (Email Threading RFC 2822 / RFC 5322):
    // Todos los correos de un mismo caso comparten el mismo rootMessageId determinístico e In-Reply-To/References
    const threadDomain = 'unicesmag.edu.co';
    const rootMessageId = `<juridica-expediente-${caso.id}-${caso.anio || new Date().getFullYear()}@${threadDomain}>`;
    const currentMessageId = isRootEmail
      ? rootMessageId
      : `<juridica-notif-${caso.id}-${Date.now()}@${threadDomain}>`;

    // Asunto canónico con prefijo "Re:" para agrupar todas las respuestas en el mismo hilo de Gmail/Outlook
    const canonicalThreadSubject = `[Oficina Jurídica] NRI ${caso.nri} · ${clean(caso.asunto, 55)}`;
    const finalSubject = isRootEmail
      ? canonicalThreadSubject
      : `Re: ${canonicalThreadSubject}`;

    const mailHeaders = isRootEmail
      ? {}
      : {
          'In-Reply-To': rootMessageId,
          'References': rootMessageId
        };

    const detailRows = details
      .filter((d) => d && d.label && d.value)
      .map((d) => `
        <tr>
          <td style="padding: 7px 12px; font-weight: 700; color: #475569; width: 190px; border-bottom: 1px solid #f1f5f9; vertical-align: top;">${escapeHtml(d.label)}</td>
          <td style="padding: 7px 12px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${escapeHtml(d.value)}</td>
        </tr>
      `)
      .join('');

    const attachmentsNote = attachments.length > 0
      ? `<p style="margin: 14px 0 0; color: #047857; font-weight: 700; font-size: 0.9rem; padding: 10px 14px; background: #ecfdf5; border-radius: 8px; border: 1px solid #a7f3d0;">
          📎 Se han adjuntado directamente a este correo ${attachments.length} archivo(s) del expediente para su consulta inmediata sin descargas adicionales.
        </p>`
      : '';

    const bodyHtml = `
      <div style="margin: 14px 0; border: 1px solid #d6e4f5; border-radius: 12px; overflow: hidden; background: #ffffff; box-shadow: 0 4px 14px rgba(11, 58, 111, 0.05);">
        <div style="background: linear-gradient(135deg, #eff6ff 0%, #f8fbff 100%); border-bottom: 1px solid #d6e4f5; padding: 12px 18px;">
          <span style="display: inline-block; background: ${badgeColor}; color: #ffffff; padding: 3px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em;">
            ${escapeHtml(badgeText || 'Oficina Jurídica')}
          </span>
          <p style="margin: 8px 0 0; font-weight: 800; color: #0b3a6f; font-size: 1.08rem;">
            NRI: ${escapeHtml(caso.nri)} — Radicado: ${escapeHtml(caso.radicado || 'Sin radicar')}
          </p>
        </div>
        <div style="padding: 14px 18px;">
          <table role="presentation" style="width: 100%; border-collapse: collapse; font-size: 0.92rem;">
            ${detailRows}
          </table>
          ${attachmentsNote}
        </div>
      </div>
      <div style="text-align: center; margin-top: 18px;">
        <a href="${linkUrl}" style="display: inline-block; min-width: 250px; background: #0b3a6f; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 700; text-align: center; font-size: 0.95rem;">
          Consultar expediente en SIAC UNICESMAG
        </a>
      </div>
      <p style="margin: 16px 0 0; color: #64748b; font-size: 0.82rem; text-align: center;">
        Oficina Jurídica · Universidad CESMAG · Sistema Interno de Aseguramiento de la Calidad
      </p>
    `;

    const html = renderInstitutionalTemplate({
      title: title || 'Notificación Oficina Jurídica',
      introHtml: intro || `<p>Cordial Saludo de Paz y Bien,</p><p>Se notifica novedad sobre el expediente jurídico <strong>NRI ${escapeHtml(caso.nri)}</strong>:</p>`,
      bodyHtml
    });

    const text = `${title || 'Notificación Oficina Jurídica'}\n\nNRI: ${caso.nri}\nAsunto: ${caso.asunto}\nInteresado: ${caso.interesado}\nEstado: ${caso.estado}\n\nIngresar: ${linkUrl}`;

    sendInstitutionalEmail({
      to: targetEmails,
      subject: finalSubject,
      text,
      html,
      attachments,
      messageId: currentMessageId,
      inReplyTo: isRootEmail ? undefined : rootMessageId,
      references: isRootEmail ? undefined : rootMessageId,
      headers: mailHeaders
    }).then((res) => {
      if (res?.success) {
        console.log(`[juridicaEmail] ✅ Correo entregado a [${targetEmails.join(', ')}] en hilo para NRI ${caso.nri} con ${attachments.length} adjuntos.`);
      } else {
        console.warn(`[juridicaEmail] ⚠️ No se pudo entregar a [${targetEmails.join(', ')}]:`, res?.error);
      }
    }).catch((err) => {
      console.error('[juridicaEmail] ❌ Error en sendJuridicaNotification:', err);
    });
  } catch (outerErr) {
    console.error('[juridicaEmail] Excepción en sendJuridicaNotification:', outerErr);
  }
};

const includeCase = (withAttachments = true) => [
  { model: User, as: 'solicitante', attributes: USER_FIELDS },
  { model: User, as: 'responsable', attributes: USER_FIELDS },
  { model: User, as: 'secretario', attributes: USER_FIELDS },
  ...(withAttachments
    ? [
        {
          model: JuridicaAdjunto,
          as: 'adjuntos',
          attributes: ['id', 'tipo', 'nombre_original', 'mime_type', 'tamano_bytes', 'created_at', 'usuario_id'],
          include: [{ model: User, as: 'usuario', attributes: ['id', 'nombre', 'cargo'] }]
        }
      ]
    : [])
];

const accessWhere = (user) => {
  const role = roleFor(user);
  if (['administrador', 'jefatura', 'secretaria'].includes(role)) return {};
  if (role === 'asesor') {
    return {
      [Op.or]: [
        { responsable_id: user.id },
        { solicitante_id: user.id },
        Sequelize.literal(`("juridica_casos"."metadata"->'responsables_ids' @> '[${Number(user.id)}]')`)
      ]
    };
  }
  return { solicitante_id: user.id };
};

const getProfile = async (req, res) => {
  const actor = resolveActor(req);
  if (actor && (!actor.juridicaPermissions || actor.juridicaPermissions.length === 0)) {
    try {
      const actorPerms = await UserModulePermission.findAll({
        where: {
          user_id: actor.id,
          can_view: true,
          module_key: {
            [Op.in]: ['oficina_juridica', 'oficina_juridica.jefatura', 'oficina_juridica.secretaria', 'oficina_juridica.asesor']
          }
        },
        attributes: ['module_key']
      });
      actor.juridicaPermissions = actorPerms.map((p) => p.module_key);
    } catch (err) {
      console.warn('Error cargando permisos del actor:', err);
    }
  }

  const juridica = await getJuridicaActiveUsers();
  const team = juridica.map((u) => ({
    ...(u.toJSON ? u.toJSON() : u),
    juridica_rol: roleFor(u),
    juridica_permissions: u.juridicaPermissions || []
  }));

  res.json({
    success: true,
    data: {
      role: roleFor(actor),
      actor: userSnapshot(actor),
      isSimulation: Boolean(req.simulatedUser),
      simulatedUser: req.simulatedUser ? userSnapshot(req.simulatedUser) : null,
      team,
      states: VALID_STATES
    }
  });
};

const listCases = async (req, res) => {
  const actor = resolveActor(req);
  const where = accessWhere(actor);
  if (req.query.estado && VALID_STATES.includes(req.query.estado)) where.estado = req.query.estado;
  if (req.query.responsable_id) where.responsable_id = req.query.responsable_id;
  if (req.query.anio) where.anio = Number(req.query.anio);
  if (req.query.search) {
    const term = `%${clean(req.query.search, 100)}%`;
    where[Op.and] = [{ [Op.or]: [
      { nri: { [Op.iLike]: term } }, { radicado: { [Op.iLike]: term } },
      { asunto: { [Op.iLike]: term } }, { interesado: { [Op.iLike]: term }, },
      { dependencia_solicitante: { [Op.iLike]: term } }
    ] }];
  }
  const rows = await JuridicaCaso.findAll({
    where,
    attributes: [
      'id', 'anio', 'nri', 'radicado', 'fecha_ingreso', 'asunto', 'grupo', 'clase',
      'interesado', 'nivel', 'dependencia_solicitante', 'fecha_limite', 'estado',
      'solicitante_id', 'responsable_id', 'secretario_id', 'metadata', 'created_at', 'updated_at'
    ],
    include: includeCase(false),
    order: [['fecha_ingreso', 'DESC'], ['id', 'DESC']],
    limit: 5000
  });
  res.json({ success: true, data: rows });
};

const getCase = async (req, res) => {
  const actor = resolveActor(req);
  const caso = await JuridicaCaso.findOne({
    where: { id: req.params.id, ...accessWhere(actor) },
    include: [...includeCase(), { model: JuridicaHistorial, as: 'historial', include: [{ model: User, as: 'usuario', attributes: USER_FIELDS }] }],
    order: [[{ model: JuridicaHistorial, as: 'historial' }, 'created_at', 'ASC']]
  });
  if (!caso) return res.status(404).json({ success: false, message: 'Caso no encontrado.' });
  res.json({ success: true, data: caso });
};

const nextNri = async (year) => {
  const rows = await JuridicaCaso.findAll({ attributes: ['nri'], where: { anio: year } });
  return String(rows.reduce((max, row) => Math.max(max, Number(String(row.nri).match(/\d+/)?.[0]) || 0), 0) + 1);
};

const createCase = async (req, res) => {
  const year = Number(req.body.anio) || new Date().getFullYear();
  const caso = await JuridicaCaso.create({
    anio: year,
    nri: clean(req.body.nri, 80) || await nextNri(year),
    radicado: clean(req.body.radicado, 120) || null,
    fecha_ingreso: parseDate(req.body.fecha_ingreso) || new Date().toISOString().slice(0, 10),
    asunto: clean(req.body.asunto, 10000),
    interesado: clean(req.body.interesado, 300) || req.user.nombre,
    descripcion: clean(req.body.descripcion, 20000) || null,
    grupo: clean(req.body.grupo, 180) || null,
    clase: clean(req.body.clase, 180) || null,
    nivel: clean(req.body.nivel, 60) || 'Media',
    dependencia_solicitante: clean(req.body.dependencia_solicitante, 300) || req.user.dependencia,
    oficina: clean(req.body.oficina, 300) || null,
    forma_recepcion: clean(req.body.forma_recepcion, 80) || 'Aplicativo',
    fecha_limite: parseDate(req.body.fecha_limite),
    solicitante_id: req.user.id,
    creado_por: req.user.id,
    actualizado_por: req.user.id,
    origen: 'Aplicativo',
    metadata: { solicitante_snapshot: userSnapshot(req.user) }
  });

  // Guardar archivos adjuntos iniciales si se recibieron
  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    for (const file of req.files) {
      await JuridicaAdjunto.create({
        caso_id: caso.id,
        usuario_id: req.user.id,
        tipo: 'anexo_inicial',
        nombre_original: clean(file.originalname, 500),
        mime_type: clean(file.mimetype, 150),
        tamano_bytes: file.size,
        sha256: crypto.createHash('sha256').update(file.buffer).digest('hex'),
        contenido: file.buffer
      });
    }
    await addHistory(caso, req.user.id, 'adjunto', null, caso.estado, `${req.files.length} archivo(s) anexo(s) cargado(s) durante la radicación.`);
  }

  await addHistory(caso, req.user.id, 'radicacion', null, caso.estado, 'Solicitud radicada en el aplicativo.');

  // Notificar por correo a la Jefatura Jurídica y a la Secretaría
  const staff = await getJuridicaCoreStaff();
  const notifyRecipients = Array.from(new Set([
    ...staff.jefatura.map((u) => u.email),
    ...staff.secretaria.map((u) => u.email),
    req.user.email
  ]));

  sendJuridicaNotification({
    caso,
    recipients: notifyRecipients,
    subject: `[Oficina Jurídica] Nuevo Asunto Radicado - NRI ${caso.nri} (${caso.grupo || 'General'})`,
    title: 'Nuevo asunto radicado en Oficina Jurídica',
    intro: `<p>Cordial Saludo de Paz y Bien,</p><p>Se ha registrado un nuevo asunto jurídico en el sistema <strong>pendiente de asignación y clasificación</strong> por parte de la Asesora Jurídica:</p>`,
    badgeText: 'Nuevo Asunto',
    badgeColor: '#b45309',
    details: [
      { label: 'Asunto', value: caso.asunto },
      { label: 'Interesado / Peticionario', value: caso.interesado },
      { label: 'Dependencia Solicitante', value: caso.dependencia_solicitante || 'No registrada' },
      { label: 'Grupo / Tipo', value: caso.grupo || 'Sin clasificar' },
      { label: 'Radicado externo', value: caso.radicado || 'Sin radicar' },
      { label: 'Fecha límite sugerida', value: caso.fecha_limite ? `${caso.fecha_limite}` : 'Por definir por jefatura' },
      { label: 'Registrado por', value: `${req.user.nombre} (${req.user.cargo || 'Funcionario'})` }
    ],
    includeAttachments: true,
    isRootEmail: true
  });

  res.status(201).json({ success: true, data: await JuridicaCaso.findByPk(caso.id, { include: includeCase() }) });
};

const assignCase = async (req, res) => {
  const actor = resolveActor(req);
  const role = roleFor(actor);
  const email = String(actor?.email || '').trim().toLowerCase();
  const isSuperAdmin = email === 'sgc@unicesmag.edu.co';
  const isJefatura = role === 'jefatura';

  // Seguridad: La secretaría solo transcribe, NO puede asignar expedientes
  if (!isSuperAdmin && !isJefatura) {
    return res.status(403).json({
      success: false,
      message: 'Solo la Asesora Jurídica (jefatura) o la administración SGC pueden asignar expedientes. La secretaría solo sistematiza solicitudes y radica salidas.'
    });
  }
  const caso = await JuridicaCaso.findByPk(req.params.id);
  if (!caso) return res.status(404).json({ success: false, message: 'Caso no encontrado.' });

  // Soportar responsable único o array de múltiples responsables
  let rawIds = req.body.responsables_ids;
  if (!rawIds && req.body.responsable_id) {
    rawIds = [req.body.responsable_id];
  }
  if (!Array.isArray(rawIds)) rawIds = [rawIds];
  const ids = rawIds.map(Number).filter(Boolean);
  if (!ids.length) {
    return res.status(400).json({ success: false, message: 'Debe seleccionar al menos un asesor responsable.' });
  }

  const assignees = await User.findAll({
    where: { id: ids },
    attributes: USER_FIELDS
  });
  if (!assignees.length) {
    return res.status(404).json({ success: false, message: 'No se encontraron los usuarios asignados.' });
  }

  const primaryResponsible = assignees[0];
  const secretary = req.body.secretario_id ? await User.findByPk(req.body.secretario_id) : null;
  const previous = caso.estado;

  // Inicializar o preservar vistos buenos
  const existingVb = caso.metadata?.vistos_buenos || {};
  const vistos_buenos = {};
  assignees.forEach((u) => {
    vistos_buenos[u.id] = existingVb[u.id] || {
      aprobado: false,
      fecha: null,
      comentario: null,
      usuario_id: u.id,
      nombre: u.nombre,
      cargo: u.cargo
    };
  });

  const co_responsables = assignees.map((u) => userSnapshot(u));
  const asignacionMultiple = assignees.length > 1;

  await caso.update({
    responsable_id: primaryResponsible.id,
    secretario_id: req.body.secretario_id || caso.secretario_id || null,
    nivel: clean(req.body.nivel, 60) || caso.nivel,
    fecha_limite: parseDate(req.body.fecha_limite) || caso.fecha_limite,
    estado: 'asignado',
    fecha_asignacion: new Date(),
    actualizado_por: actor.id,
    metadata: {
      ...(caso.metadata || {}),
      responsables_ids: ids,
      co_responsables,
      vistos_buenos,
      asignacion_multiple: asignacionMultiple,
      todos_vistos_buenos: false,
      responsable_snapshot: userSnapshot(primaryResponsible),
      secretario_snapshot: userSnapshot(secretary)
    }
  });

  // Auto-activación de permiso en SIAC: al asignarle un expediente a los asistentes,
  // el sistema les habilita automáticamente el módulo de Oficina Jurídica con rol asesor si aún no lo tenían activo
  for (const assignee of assignees) {
    try {
      const [perm, created] = await UserModulePermission.findOrCreate({
        where: { user_id: assignee.id, module_key: 'oficina_juridica' },
        defaults: { user_id: assignee.id, module_key: 'oficina_juridica', can_view: true, can_create: true, can_edit: true, can_delete: false }
      });
      if (!created && !perm.can_view) {
        await perm.update({ can_view: true });
      }

      const hasSubRole = await UserModulePermission.count({
        where: {
          user_id: assignee.id,
          module_key: { [Op.in]: ['oficina_juridica.jefatura', 'oficina_juridica.secretaria', 'oficina_juridica.asesor'] },
          can_view: true
        }
      });
      if (hasSubRole === 0) {
        await UserModulePermission.findOrCreate({
          where: { user_id: assignee.id, module_key: 'oficina_juridica.asesor' },
          defaults: { user_id: assignee.id, module_key: 'oficina_juridica.asesor', can_view: true, can_create: true, can_edit: true, can_delete: false }
        });
      }
    } catch (permErr) {
      console.warn('Error auto-activando permiso a asesor asignado:', permErr);
    }
  }

  const nombresAsignados = assignees.map((u) => u.nombre).join(', ');
  await addHistory(
    caso,
    actor.id,
    'asignacion',
    previous,
    'asignado',
    req.body.comentario || (asignacionMultiple ? `Asignación colectiva a ${assignees.length} asesores: ${nombresAsignados}` : `Asignado a ${primaryResponsible.nombre}`),
    {
      responsables_ids: ids,
      responsables_nombres: nombresAsignados,
      multiple: asignacionMultiple
    }
  );

  // Notificar por correo con todos los documentos adjuntos del caso a los asesores asignados, jefatura y secretaría
  const staff = await getJuridicaCoreStaff();
  const assigneeEmails = assignees.map((u) => u.email);
  const notifyRecipients = Array.from(new Set([
    ...assigneeEmails,
    ...staff.jefatura.map((u) => u.email),
    ...staff.secretaria.map((u) => u.email),
    actor.email
  ]));

  sendJuridicaNotification({
    caso,
    recipients: notifyRecipients,
    subject: `[Oficina Jurídica] Asignación de Caso - NRI ${caso.nri}: ${caso.asunto.slice(0, 45)}...`,
    title: 'Asignación de expediente jurídico',
    intro: `<p>Cordial Saludo de Paz y Bien,</p><p>La Asesora Jurídica ha asignado el expediente <strong>NRI ${escapeHtml(caso.nri)}</strong> para su estudio, proyección de respuesta y trámite:</p>`,
    badgeText: asignacionMultiple ? `Asignación Colectiva (${assignees.length} Asesores)` : 'Expediente Asignado',
    badgeColor: '#1d4ed8',
    details: [
      { label: 'Asignado a', value: nombresAsignados },
      { label: 'Término legal / Fecha límite', value: caso.fecha_limite ? `${caso.fecha_limite} (Improrrogable)` : 'Por definir' },
      { label: 'Nivel de prioridad', value: caso.nivel || 'Media' },
      { label: 'Asunto', value: caso.asunto },
      { label: 'Interesado / Peticionario', value: caso.interesado },
      { label: 'Dependencia solicitante', value: caso.dependencia_solicitante || 'No registrada' },
      { label: 'Instrucciones / Observación', value: req.body.comentario || 'Favor estudiar antecedentes, proyectar respuesta jurídica y registrar visto bueno en el sistema.' }
    ],
    includeAttachments: true
  });

  res.json({ success: true, data: await JuridicaCaso.findByPk(caso.id, { include: includeCase() }) });
};

const vistoBuenoCase = async (req, res) => {
  const actor = resolveActor(req);
  const caso = await JuridicaCaso.findOne({ where: { id: req.params.id, ...accessWhere(actor) } });
  if (!caso) return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });

  const role = roleFor(actor);
  const ids = caso.metadata?.responsables_ids || (caso.responsable_id ? [caso.responsable_id] : []);
  const isAssigned = ids.some((id) => Number(id) === Number(actor.id));
  const isPrivileged = ['administrador', 'jefatura'].includes(role);

  if (!isAssigned && !isPrivileged) {
    return res.status(403).json({
      success: false,
      message: 'Solo los asesores asignados al expediente o la jefatura pueden emitir visto bueno.'
    });
  }

  const targetUserId = actor.id;
  const currentVb = { ...(caso.metadata?.vistos_buenos || {}) };

  currentVb[targetUserId] = {
    aprobado: true,
    fecha: new Date().toISOString(),
    comentario: clean(req.body.comentario, 2000) || 'Visto bueno favorable emitido sin observaciones.',
    usuario_id: targetUserId,
    nombre: actor.nombre,
    cargo: actor.cargo
  };

  const checkIds = ids.length ? ids : [targetUserId];
  const allApproved = checkIds.every((id) => currentVb[id]?.aprobado === true);
  const totalApproved = checkIds.filter((id) => currentVb[id]?.aprobado === true).length;

  const previousState = caso.estado;
  let nextState = caso.estado;
  if (allApproved && ['asignado', 'en_estudio'].includes(caso.estado)) {
    nextState = 'respuesta_revision';
  }

  await caso.update({
    estado: nextState,
    actualizado_por: actor.id,
    metadata: {
      ...(caso.metadata || {}),
      vistos_buenos: currentVb,
      todos_vistos_buenos: allApproved
    }
  });

  await addHistory(
    caso,
    actor.id,
    'visto_bueno',
    previousState,
    nextState,
    req.body.comentario || `Visto bueno emitido por ${actor.nombre}. Progreso: ${totalApproved}/${checkIds.length} asesores.`,
    {
      usuario_nombre: actor.nombre,
      progreso_vistos_buenos: `${totalApproved}/${checkIds.length}`,
      todos_aprobados: allApproved
    }
  );

  // Si todos los asesores dieron visto bueno y pasa a revisión de jefatura, notificar por correo con adjuntos
  if (allApproved && nextState === 'respuesta_revision') {
    const staff = await getJuridicaCoreStaff();
    const notifyRecipients = Array.from(new Set([
      ...staff.jefatura.map((u) => u.email),
      ...staff.secretaria.map((u) => u.email),
      actor.email
    ]));

    sendJuridicaNotification({
      caso,
      recipients: notifyRecipients,
      subject: `[Oficina Jurídica] Respuesta en Revisión de Jefatura - NRI ${caso.nri}`,
      title: 'Propuesta de respuesta lista para revisión de Jefatura',
      intro: `<p>Cordial Saludo de Paz y Bien,</p><p>El expediente <strong>NRI ${escapeHtml(caso.nri)}</strong> cuenta con visto bueno unánime de los asesores asignados (${totalApproved}/${checkIds.length}) y ha pasado a <strong>Revisión de Jefatura</strong>:</p>`,
      badgeText: 'Respuesta en Revisión',
      badgeColor: '#7c3aed',
      details: [
        { label: 'Asunto', value: caso.asunto },
        { label: 'Interesado', value: caso.interesado },
        { label: 'Vistos buenos emitidos', value: `${totalApproved}/${checkIds.length} asesores` },
        { label: 'Último visto bueno por', value: `${actor.nombre} (${actor.cargo || 'Asesor Jurídico'})` },
        { label: 'Observaciones del asesor', value: req.body.comentario || 'Se adjuntan los documentos de respuesta para revisión y aprobación final.' }
      ],
      includeAttachments: true
    });
  }

  res.json({
    success: true,
    message: allApproved
      ? `¡Visto bueno unánime registrado (${totalApproved}/${checkIds.length})! El expediente cuenta con la aprobación de todos los asesores y pasó a revisión de jefatura.`
      : `Visto bueno registrado (${totalApproved}/${checkIds.length}). Pendiente la aprobación de los demás co-responsables.`,
    data: await JuridicaCaso.findByPk(caso.id, { include: includeCase() })
  });
};

const transitionCase = async (req, res) => {
  const actor = resolveActor(req);
  const next = clean(req.body.estado, 60);
  if (!VALID_STATES.includes(next)) return res.status(400).json({ success: false, message: 'Estado no válido.' });
  const caso = await JuridicaCaso.findOne({ where: { id: req.params.id, ...accessWhere(actor) } });
  if (!caso) return res.status(404).json({ success: false, message: 'Caso no encontrado.' });
  const role = roleFor(actor);

  // Restricciones de roles según el flujo operativo legal de Unicesmag:
  // - Asesor: inicia estudio, puede enviar a revisión de jefatura
  // - Jefatura: revisa borrador, devuelve con observaciones o aprueba la respuesta
  // - Secretaría: radica salida y marca entregado/cerrado una vez aprobado
  const allowed = {
    administrador: VALID_STATES,
    jefatura: VALID_STATES,
    asesor: ['en_estudio', 'respuesta_revision'],
    secretaria: ['pendiente_radicacion_salida', 'entregado', 'cerrado'],
    solicitante: []
  }[role];
  if (!allowed.includes(next)) {
    return res.status(403).json({
      success: false,
      message: role === 'secretaria'
        ? 'La secretaría no puede cambiar este estado hasta que la Asesora Jurídica apruebe la respuesta final.'
        : role === 'asesor'
        ? 'Como asesor jurídico, debe enviar la respuesta a revisión de jefatura para su aprobación.'
        : 'Tu rol no tiene permitido realizar esta transición de estado.'
    });
  }

  // REGLA CLAVE: Si se intenta entregar o cerrar y hay múltiples asesores asignados, TODOS deben haber dado visto bueno
  if (['entregado', 'cerrado'].includes(next)) {
    const ids = caso.metadata?.responsables_ids || (caso.responsable_id ? [caso.responsable_id] : []);
    if (ids.length > 1) {
      const vb = caso.metadata?.vistos_buenos || {};
      const faltantes = ids.filter((id) => !vb[id]?.aprobado);
      if (faltantes.length > 0) {
        const coList = caso.metadata?.co_responsables || [];
        const nombresFaltantes = faltantes
          .map((id) => coList.find((c) => Number(c.id) === Number(id))?.nombre || `Asesor ID ${id}`)
          .join(', ');
        return res.status(400).json({
          success: false,
          message: `No es posible entregar ni cerrar el expediente. Aún están pendientes los vistos buenos de: ${nombresFaltantes}. Cada asesor asignado debe ingresar desde su usuario y registrar su visto bueno.`
        });
      }
    }
  }

  const previous = caso.estado;
  const changes = { estado: next, actualizado_por: actor.id };
  if (next === 'respuesta_revision') changes.fecha_entrega_asesor = new Date();
  if (next === 'entregado') changes.fecha_atencion = new Date();
  if (next === 'cerrado') changes.fecha_cierre = new Date();
  ['radicado', 'despacho', 'acta', 'resultado', 'devolucion', 'observaciones'].forEach((key) => {
    if (req.body[key] !== undefined) changes[key] = clean(req.body[key], key === 'resultado' || key === 'observaciones' ? 20000 : 5000) || null;
  });
  await caso.update(changes);
  await addHistory(caso, actor.id, 'cambio_estado', previous, next, req.body.comentario);

  // Disparar notificaciones por correo institucional según el nuevo estado
  const staff = await getJuridicaCoreStaff();
  const ids = caso.metadata?.responsables_ids || (caso.responsable_id ? [caso.responsable_id] : []);
  const assignedUsers = staff.all.filter((u) => ids.some((id) => Number(id) === Number(u.id)));
  const assignedEmails = assignedUsers.map((u) => u.email);

  if (next === 'respuesta_revision') {
    // Notificar a la Jefatura para su revisión
    const notifyRecipients = Array.from(new Set([
      ...staff.jefatura.map((u) => u.email),
      ...staff.secretaria.map((u) => u.email),
      ...assignedEmails,
      actor.email
    ]));

    sendJuridicaNotification({
      caso,
      recipients: notifyRecipients,
      subject: `[Oficina Jurídica] Respuesta en Revisión de Jefatura - NRI ${caso.nri}`,
      title: 'Respuesta jurídica enviada a revisión de Jefatura',
      intro: `<p>Cordial Saludo de Paz y Bien,</p><p>El expediente <strong>NRI ${escapeHtml(caso.nri)}</strong> ha sido remitido a <strong>Revisión de Jefatura</strong> por parte de <strong>${escapeHtml(actor.nombre)}</strong>:</p>`,
      badgeText: 'Respuesta en Revisión',
      badgeColor: '#7c3aed',
      details: [
        { label: 'Asunto', value: caso.asunto },
        { label: 'Interesado', value: caso.interesado },
        { label: 'Observaciones / Justificación', value: req.body.comentario || req.body.observaciones || 'Se adjunta propuesta de respuesta jurídica para revisión.' }
      ],
      includeAttachments: true
    });
  } else if (next === 'devuelto_informacion') {
    // Notificar a los asesores asignados con las observaciones/retroalimentación de Jefatura
    const notifyRecipients = Array.from(new Set([
      ...assignedEmails,
      ...staff.jefatura.map((u) => u.email),
      actor.email
    ]));

    sendJuridicaNotification({
      caso,
      recipients: notifyRecipients,
      subject: `[Oficina Jurídica] Caso Devuelto con Retroalimentación - NRI ${caso.nri}`,
      title: 'Expediente devuelto para ajustes por la Jefatura',
      intro: `<p>Cordial Saludo de Paz y Bien,</p><p>La Asesora Jurídica ha revisado la propuesta del expediente <strong>NRI ${escapeHtml(caso.nri)}</strong> y ha solicitado <strong>ajustes y correcciones</strong>:</p>`,
      badgeText: 'Devuelto para Ajustes',
      badgeColor: '#be123c',
      details: [
        { label: 'Asunto', value: caso.asunto },
        { label: 'Interesado', value: caso.interesado },
        { label: 'Retroalimentación de Jefatura', value: req.body.comentario || req.body.observaciones || 'Favor revisar antecedentes y ajustar los documentos según indicaciones.' }
      ],
      includeAttachments: true
    });
  } else if (next === 'aprobado_jefatura') {
    // Notificar a la Secretaría para proceder al despacho al peticionario
    const notifyRecipients = Array.from(new Set([
      ...staff.secretaria.map((u) => u.email),
      ...assignedEmails,
      ...staff.jefatura.map((u) => u.email),
      actor.email
    ]));

    sendJuridicaNotification({
      caso,
      recipients: notifyRecipients,
      subject: `[Oficina Jurídica] Respuesta Aprobada por Jefatura - NRI ${caso.nri} (Listo para Despacho)`,
      title: 'Respuesta jurídica aprobada por Jefatura',
      intro: `<p>Cordial Saludo de Paz y Bien,</p><p>La Asesora Jurídica ha <strong>APROBADO</strong> la respuesta final del expediente <strong>NRI ${escapeHtml(caso.nri)}</strong>. Se solicita a la Secretaría proceder con la radicación de salida y entrega formal al peticionario:</p>`,
      badgeText: 'Aprobado por Jefatura',
      badgeColor: '#047857',
      details: [
        { label: 'Asunto', value: caso.asunto },
        { label: 'Interesado / Peticionario', value: caso.interesado },
        { label: 'Dependencia solicitante', value: caso.dependencia_solicitante || 'No registrada' },
        { label: 'Observaciones de aprobación', value: req.body.comentario || req.body.observaciones || 'Respuesta revisada y conforme. Proceder al despacho formal.' }
      ],
      includeAttachments: true
    });
  } else if (['entregado', 'cerrado'].includes(next)) {
    // Notificar finalización a todo el equipo
    const notifyRecipients = Array.from(new Set([
      ...staff.jefatura.map((u) => u.email),
      ...staff.secretaria.map((u) => u.email),
      ...assignedEmails,
      actor.email
    ]));

    sendJuridicaNotification({
      caso,
      recipients: notifyRecipients,
      subject: `[Oficina Jurídica] Trámite Entregado y Finalizado - NRI ${caso.nri}`,
      title: 'Trámite jurídico finalizado exitosamente',
      intro: `<p>Cordial Saludo de Paz y Bien,</p><p>Se confirma que el expediente <strong>NRI ${escapeHtml(caso.nri)}</strong> ha sido formalmente entregado al peticionario y registrado como <strong>${next.toUpperCase()}</strong>:</p>`,
      badgeText: next === 'cerrado' ? 'Cerrado' : 'Entregado al Peticionario',
      badgeColor: '#15803d',
      details: [
        { label: 'Asunto', value: caso.asunto },
        { label: 'Interesado / Peticionario', value: caso.interesado },
        { label: 'Medio de Despacho', value: caso.despacho || req.body.despacho || 'Despachado por secretaría' },
        { label: 'Radicado de salida', value: caso.radicado || req.body.radicado || 'Registrado' },
        { label: 'Observación de entrega', value: req.body.comentario || req.body.observaciones || 'Trámite concluido a satisfacción.' }
      ],
      includeAttachments: false
    });

    // Depuración automática de documentos temporales del servidor:
    // Los documentos quedan respaldados exclusivamente en los correos institucionales de los funcionarios.
    try {
      const currentAdjuntos = await JuridicaAdjunto.findAll({
        where: { caso_id: caso.id },
        attributes: ['id', 'nombre_original', 'tipo', 'tamano_bytes', 'mime_type']
      });

      if (currentAdjuntos.length > 0) {
        const depuradosList = currentAdjuntos.map((a) => ({
          id: String(a.id),
          nombre_original: a.nombre_original,
          tipo: a.tipo,
          tamano_bytes: a.tamano_bytes,
          mime_type: a.mime_type,
          fecha_depuracion: new Date().toISOString()
        }));

        // Eliminar BLOBs físicos para liberar almacenamiento en servidor
        await JuridicaAdjunto.destroy({ where: { caso_id: caso.id } });

        const updatedMetadata = {
          ...(caso.metadata || {}),
          adjuntos_depurados: depuradosList,
          adjuntos_purgados: true,
          fecha_depuracion_adjuntos: new Date().toISOString()
        };
        await caso.update({ metadata: updatedMetadata });

        await addHistory(
          caso,
          actor.id,
          'depuracion_adjuntos',
          previous,
          next,
          `Depuración automática de ${currentAdjuntos.length} documento(s) del servidor tras el cierre formal. Los archivos se conservan en el hilo de correos institucionales.`
        );
      }
    } catch (depErr) {
      console.error('[depuracionAdjuntos] Error al depurar adjuntos:', depErr);
    }
  }

  res.json({ success: true, data: await JuridicaCaso.findByPk(caso.id, { include: includeCase() }) });
};

const updateCase = async (req, res) => {
  const actor = resolveActor(req);
  const caso = await JuridicaCaso.findOne({ where: { id: req.params.id, ...accessWhere(actor) } });
  if (!caso) return res.status(404).json({ success: false, message: 'Caso no encontrado.' });
  const allowed = ['fecha_ingreso', 'radicado', 'accion', 'detalle', 'asunto', 'grupo', 'clase', 'interesado', 'descripcion', 'nivel', 'dependencia_solicitante', 'oficina', 'forma_recepcion', 'fecha_limite', 'despacho', 'acta', 'observaciones', 'resultado', 'devolucion'];
  const changes = { actualizado_por: actor.id };
  allowed.forEach((key) => { if (req.body[key] !== undefined) changes[key] = key.startsWith('fecha_') ? parseDate(req.body[key]) : clean(req.body[key], 20000) || null; });
  await caso.update(changes);
  await addHistory(caso, actor.id, 'actualizacion', caso.estado, caso.estado, req.body.comentario || 'Información del expediente actualizada.');
  res.json({ success: true, data: await JuridicaCaso.findByPk(caso.id, { include: includeCase() }) });
};

const uploadAttachment = async (req, res) => {
  const actor = resolveActor(req);
  if (!req.file) return res.status(400).json({ success: false, message: 'Seleccione un archivo.' });
  const caso = await JuridicaCaso.findOne({ where: { id: req.params.id, ...accessWhere(actor) } });
  if (!caso) return res.status(404).json({ success: false, message: 'Caso no encontrado.' });

  // Seguridad y política temporal: No permitir cargas a expedientes cerrados/entregados
  if (['entregado', 'cerrado', 'cancelado'].includes(caso.estado)) {
    return res.status(400).json({
      success: false,
      message: 'No es posible adjuntar archivos a un expediente entregado o cerrado. Los documentos de esta solicitud fueron depurados del servidor.'
    });
  }

  const adjunto = await JuridicaAdjunto.create({
    caso_id: caso.id, usuario_id: actor.id, tipo: clean(req.body.tipo, 60) || 'soporte',
    nombre_original: clean(req.file.originalname, 500), mime_type: clean(req.file.mimetype, 150),
    tamano_bytes: req.file.size, sha256: crypto.createHash('sha256').update(req.file.buffer).digest('hex'), contenido: req.file.buffer
  });
  await addHistory(caso, actor.id, 'adjunto', caso.estado, caso.estado, `Archivo adjunto: ${adjunto.nombre_original}`, { adjunto_id: String(adjunto.id) });
  res.status(201).json({ success: true, data: { id: adjunto.id, nombre_original: adjunto.nombre_original, tipo: adjunto.tipo } });
};

const downloadAttachment = async (req, res) => {
  const adjunto = await JuridicaAdjunto.findByPk(req.params.adjuntoId, { include: [{ model: JuridicaCaso, as: 'caso', attributes: ['id', 'solicitante_id', 'responsable_id'] }] });
  if (!adjunto) {
    return res.status(404).json({
      success: false,
      message: 'El archivo ya fue depurado del servidor tras el cierre del caso. Por favor consulte el archivo directamente en su correo institucional.'
    });
  }
  res.setHeader('Content-Type', adjunto.mime_type);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(adjunto.nombre_original)}`);
  res.send(adjunto.contenido);
};

const stats = async (req, res) => {
  const actor = resolveActor(req);
  const where = accessWhere(actor);
  if (req.query.anio) where.anio = Number(req.query.anio);
  const rows = await JuridicaCaso.findAll({
    where,
    attributes: ['estado', 'grupo', 'dependencia_solicitante', 'fecha_limite'],
    include: [{ model: User, as: 'responsable', attributes: ['id', 'nombre'] }]
  });
  const countBy = (key) => Object.entries(rows.reduce((acc, row) => { const value = row[key] || 'Sin registrar'; acc[value] = (acc[value] || 0) + 1; return acc; }, {})).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fiveDaysLater = new Date(today);
  fiveDaysLater.setDate(fiveDaysLater.getDate() + 5);

  const activeRows = rows.filter((r) => !CLOSED.includes(r.estado));
  const overdue = activeRows.filter((row) => row.fecha_limite && new Date(`${row.fecha_limite}T00:00:00`) < today).length;
  const porVencer = activeRows.filter((row) => {
    if (!row.fecha_limite) return false;
    const limit = new Date(`${row.fecha_limite}T00:00:00`);
    return limit >= today && limit <= fiveDaysLater;
  }).length;

  res.json({
    success: true,
    data: {
      total: rows.length,
      abiertos: activeRows.length,
      cerrados: rows.filter((r) => CLOSED.includes(r.estado)).length,
      vencidos: overdue,
      por_vencer: porVencer,
      estados: countBy('estado'),
      grupos: countBy('grupo'),
      dependencias: countBy('dependencia_solicitante'),
      responsables: Object.entries(rows.reduce((acc, r) => { const n = r.responsable?.nombre || 'Sin asignar'; acc[n] = (acc[n] || 0) + 1; return acc; }, {})).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
    }
  });
};

const exportExcel = async (req, res) => {
  const actor = resolveActor(req);
  const rows = await JuridicaCaso.findAll({ where: accessWhere(actor), include: includeCase(), order: [['anio', 'DESC'], ['nri', 'DESC']] });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('GENERAL', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    ['ORD', 8], ['AÑO', 9], ['NRI', 12], ['RADICADO', 18], ['F_INGRESO', 14], ['ACCIÓN', 22], ['DETALLE', 22], ['DISCRIMINADO REGLAMENTOS', 22], ['ASUNTO', 35], ['GRUPO', 22], ['CLASE', 22], ['INTERESADO', 30], ['F_INICIO', 14], ['F_TERMINA', 14], ['VALOR', 14], ['DESCRIPCIÓN', 45], ['NIVEL', 12], ['DEPENDENCIA', 28], ['OFICINAS', 25], ['NOMBRE', 25], ['FORMA', 14], ['F_ENTREGA ABOGADO', 19], ['RESPONSABLE', 30], ['DIAS TRAMITE', 14], ['ATENCION', 16], ['DESPACHO', 24], ['ACTA', 16], ['OBSERVACIONES', 40], ['ESTADO', 25], ['ORIGEN', 16], ['RESULTADO', 40], ['TIEMPO DE ENTREGA', 20], ['DEVOLUCIÓN', 35]
  ].map(([header, width], index) => ({ header, key: `c${index}`, width }));
  rows.forEach((r, index) => {
    const days = Math.max(0, Math.floor(((r.fecha_cierre ? new Date(r.fecha_cierre) : new Date()) - new Date(r.fecha_ingreso)) / 86400000));
    ws.addRow([index + 1, r.anio, r.nri, r.radicado, r.fecha_ingreso, r.accion, r.detalle, '', r.asunto, r.grupo, r.clase, r.interesado, r.fecha_asignacion, r.fecha_cierre, '', r.descripcion, r.nivel, r.dependencia_solicitante, r.oficina, '', r.forma_recepcion, r.fecha_entrega_asesor, r.responsable?.nombre, days, r.fecha_atencion, r.despacho, r.acta, r.observaciones, r.estado, r.origen, r.resultado, days, r.devolucion]);
  });
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173B7A' } };
  ws.autoFilter = { from: 'A1', to: 'AG1' };
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="seguimiento_juridico_${new Date().toISOString().slice(0, 10)}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
};

const cellValue = (cell) => {
  const value = cell?.value;
  if (value && typeof value === 'object') return value.text || value.result || value.richText?.map((x) => x.text).join('') || '';
  return value ?? '';
};
const importExcel = async (req, res) => {
  const actor = resolveActor(req);
  if (!['administrador', 'jefatura', 'secretaria'].includes(roleFor(actor))) return res.status(403).json({ success: false, message: 'No autorizado para importar.' });
  if (!req.file) return res.status(400).json({ success: false, message: 'Seleccione el Excel de seguimiento.' });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(req.file.buffer);
  const ws = wb.getWorksheet('GENERAL') || wb.worksheets[0];
  let imported = 0; let updated = 0; let skipped = 0;
  for (let rowNumber = 2; rowNumber <= ws.rowCount; rowNumber += 1) {
    const row = ws.getRow(rowNumber);
    const year = Number(cellValue(row.getCell(2))) || Number(parseDate(cellValue(row.getCell(5)))?.slice(0, 4));
    const nri = clean(cellValue(row.getCell(3)), 80);
    const asunto = clean(cellValue(row.getCell(9)), 10000);
    if (!year || !nri || !asunto) { skipped += 1; continue; }
    const responsibleName = clean(cellValue(row.getCell(23)), 300);
    const responsible = responsibleName ? await User.findOne({ where: { nombre: { [Op.iLike]: `%${responsibleName.split(' ')[0]}%` }, dependencia: { [Op.iLike]: '%JURID%' } } }) : null;
    const importedState = normalize(cellValue(row.getCell(29)));
    const importedAttention = parseDate(cellValue(row.getCell(25)));
    const inferredState = importedState.includes('cancel') ? 'cancelado'
      : (importedState.includes('cerr') || importedState.includes('final')) ? 'cerrado'
        : (importedState.includes('entreg') || importedAttention) ? 'entregado'
          : responsible ? 'asignado' : 'pendiente_clasificacion';
    const payload = {
      anio: year, nri, radicado: clean(cellValue(row.getCell(4)), 120) || null,
      fecha_ingreso: parseDate(cellValue(row.getCell(5))) || `${year}-01-01`, accion: clean(cellValue(row.getCell(6)), 250) || null,
      detalle: clean(cellValue(row.getCell(7)), 250) || null, asunto, grupo: clean(cellValue(row.getCell(10)), 180) || null,
      clase: clean(cellValue(row.getCell(11)), 180) || null, interesado: clean(cellValue(row.getCell(12)), 300) || 'Sin registrar',
      descripcion: clean(cellValue(row.getCell(16)), 20000) || null, nivel: clean(cellValue(row.getCell(17)), 60) || 'Media',
      dependencia_solicitante: clean(cellValue(row.getCell(18)), 300) || null, oficina: clean(cellValue(row.getCell(19)), 300) || null,
      forma_recepcion: clean(cellValue(row.getCell(21)), 80) || null, fecha_entrega_asesor: parseDate(cellValue(row.getCell(22))),
      responsable_id: responsible?.id || null, fecha_atencion: importedAttention, despacho: clean(cellValue(row.getCell(26)), 300) || null,
      acta: clean(cellValue(row.getCell(27)), 180) || null, observaciones: clean(cellValue(row.getCell(28)), 20000) || null,
      estado: inferredState,
      origen: clean(cellValue(row.getCell(30)), 120) || 'Importación histórica', resultado: clean(cellValue(row.getCell(31)), 20000) || null,
      devolucion: clean(cellValue(row.getCell(33)), 5000) || null, actualizado_por: actor.id,
      metadata: { importado_desde_excel: true, fila_origen: rowNumber, responsable_snapshot: responsible ? userSnapshot(responsible) : (responsibleName ? { nombre: responsibleName } : null) }
    };
    const [caso, created] = await JuridicaCaso.findOrCreate({ where: { anio: year, nri }, defaults: { ...payload, creado_por: actor.id } });
    if (created) { imported += 1; await addHistory(caso, actor.id, 'importacion', null, caso.estado, `Importado desde fila ${rowNumber}.`); }
    else { await caso.update(payload); updated += 1; }
  }
  res.json({ success: true, data: { imported, updated, skipped, total: imported + updated } });
};

const getInternalUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'nombre', 'username', 'email', 'dependencia', 'cargo'],
      where: { estado: 'activo' },
      order: [['nombre', 'ASC']]
    });
    res.json({ success: true, data: users });
  } catch (err) {
    console.error('Error al obtener usuarios internos:', err);
    res.status(500).json({ success: false, message: 'Error al obtener usuarios internos.' });
  }
};

module.exports = {
  getProfile,
  getInternalUsers,
  listCases,
  getCase,
  createCase,
  assignCase,
  vistoBuenoCase,
  transitionCase,
  updateCase,
  uploadAttachment,
  downloadAttachment,
  stats,
  exportExcel,
  importExcel
};
