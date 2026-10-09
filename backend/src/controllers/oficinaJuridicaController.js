const crypto = require('crypto');
const ExcelJS = require('exceljs');
const { Op, fn, col, Sequelize } = require('sequelize');
const { JuridicaCaso, JuridicaHistorial, JuridicaAdjunto, User } = require('../models');

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
const roleFor = (user) => {
  if (user?.role === 'administrador') return 'administrador';
  const cargo = normalize(user?.cargo);
  const dependencia = normalize(user?.dependencia);
  if (cargo.includes('secretari')) return 'secretaria';
  if ((cargo.includes('asesora juridica') || cargo.includes('asesor juridico')) && !cargo.includes('asistente')) return 'jefatura';
  if (dependencia.includes('oficina juridica') || cargo.includes('juridic') || cargo.includes('abogad')) return 'asesor';
  return 'solicitante';
};
const userSnapshot = (user) => user ? ({ id: user.id, nombre: user.nombre, email: user.email, cargo: user.cargo, dependencia: user.dependencia }) : null;
const addHistory = (caso, userId, evento, previous, next, comentario, datos = {}) =>
  JuridicaHistorial.create({ caso_id: caso.id, usuario_id: userId, evento, estado_anterior: previous, estado_nuevo: next, comentario: clean(comentario, 5000) || null, datos });

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
  const juridica = await User.findAll({
    attributes: USER_FIELDS,
    where: { estado: 'activo', dependencia: { [Op.iLike]: '%JURID%' } },
    order: [['nombre', 'ASC']]
  });
  const team = juridica.map((u) => ({ ...u.toJSON(), juridica_rol: roleFor(u) }));
  res.json({ success: true, data: { role: roleFor(req.user), team, states: VALID_STATES } });
};

const listCases = async (req, res) => {
  const where = accessWhere(req.user);
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
  const caso = await JuridicaCaso.findOne({
    where: { id: req.params.id, ...accessWhere(req.user) },
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
  await addHistory(caso, req.user.id, 'radicacion', null, caso.estado, 'Solicitud radicada en el aplicativo.');
  res.status(201).json({ success: true, data: await JuridicaCaso.findByPk(caso.id, { include: includeCase() }) });
};

const assignCase = async (req, res) => {
  const role = roleFor(req.user);
  if (!['administrador', 'jefatura'].includes(role)) {
    return res.status(403).json({ success: false, message: 'Solo la jefatura o administrador puede asignar asuntos.' });
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
    actualizado_por: req.user.id,
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

  const nombresAsignados = assignees.map((u) => u.nombre).join(', ');
  await addHistory(
    caso,
    req.user.id,
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

  res.json({ success: true, data: await JuridicaCaso.findByPk(caso.id, { include: includeCase() }) });
};

const vistoBuenoCase = async (req, res) => {
  const caso = await JuridicaCaso.findOne({ where: { id: req.params.id, ...accessWhere(req.user) } });
  if (!caso) return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });

  const role = roleFor(req.user);
  const ids = caso.metadata?.responsables_ids || (caso.responsable_id ? [caso.responsable_id] : []);
  const isAssigned = ids.some((id) => Number(id) === Number(req.user.id));
  const isPrivileged = ['administrador', 'jefatura'].includes(role);

  if (!isAssigned && !isPrivileged) {
    return res.status(403).json({
      success: false,
      message: 'Solo los asesores asignados al expediente o la jefatura pueden emitir visto bueno.'
    });
  }

  const targetUserId = req.user.id;
  const currentVb = { ...(caso.metadata?.vistos_buenos || {}) };

  currentVb[targetUserId] = {
    aprobado: true,
    fecha: new Date().toISOString(),
    comentario: clean(req.body.comentario, 2000) || 'Visto bueno favorable emitido sin observaciones.',
    usuario_id: targetUserId,
    nombre: req.user.nombre,
    cargo: req.user.cargo
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
    actualizado_por: req.user.id,
    metadata: {
      ...(caso.metadata || {}),
      vistos_buenos: currentVb,
      todos_vistos_buenos: allApproved
    }
  });

  await addHistory(
    caso,
    req.user.id,
    'visto_bueno',
    previousState,
    nextState,
    req.body.comentario || `Visto bueno emitido por ${req.user.nombre}. Progreso: ${totalApproved}/${checkIds.length} asesores.`,
    {
      usuario_nombre: req.user.nombre,
      progreso_vistos_buenos: `${totalApproved}/${checkIds.length}`,
      todos_aprobados: allApproved
    }
  );

  res.json({
    success: true,
    message: allApproved
      ? `¡Visto bueno unánime registrado (${totalApproved}/${checkIds.length})! El expediente cuenta con la aprobación de todos los asesores.`
      : `Visto bueno registrado (${totalApproved}/${checkIds.length}). Pendiente la aprobación de los demás co-responsables.`,
    data: await JuridicaCaso.findByPk(caso.id, { include: includeCase() })
  });
};

const transitionCase = async (req, res) => {
  const next = clean(req.body.estado, 60);
  if (!VALID_STATES.includes(next)) return res.status(400).json({ success: false, message: 'Estado no válido.' });
  const caso = await JuridicaCaso.findOne({ where: { id: req.params.id, ...accessWhere(req.user) } });
  if (!caso) return res.status(404).json({ success: false, message: 'Caso no encontrado.' });
  const role = roleFor(req.user);
  const allowed = {
    administrador: VALID_STATES,
    jefatura: VALID_STATES,
    asesor: ['en_estudio', 'devuelto_informacion', 'respuesta_revision', 'pendiente_radicacion_salida', 'entregado'],
    secretaria: ['pendiente_radicacion_salida', 'entregado', 'cerrado'],
    solicitante: []
  }[role];
  if (!allowed.includes(next)) return res.status(403).json({ success: false, message: 'Tu rol no puede realizar esta transición.' });

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
  const changes = { estado: next, actualizado_por: req.user.id };
  if (next === 'respuesta_revision') changes.fecha_entrega_asesor = new Date();
  if (next === 'entregado') changes.fecha_atencion = new Date();
  if (next === 'cerrado') changes.fecha_cierre = new Date();
  ['radicado', 'despacho', 'acta', 'resultado', 'devolucion', 'observaciones'].forEach((key) => {
    if (req.body[key] !== undefined) changes[key] = clean(req.body[key], key === 'resultado' || key === 'observaciones' ? 20000 : 5000) || null;
  });
  await caso.update(changes);
  await addHistory(caso, req.user.id, 'cambio_estado', previous, next, req.body.comentario);
  res.json({ success: true, data: await JuridicaCaso.findByPk(caso.id, { include: includeCase() }) });
};

const updateCase = async (req, res) => {
  const caso = await JuridicaCaso.findOne({ where: { id: req.params.id, ...accessWhere(req.user) } });
  if (!caso) return res.status(404).json({ success: false, message: 'Caso no encontrado.' });
  const allowed = ['fecha_ingreso', 'radicado', 'accion', 'detalle', 'asunto', 'grupo', 'clase', 'interesado', 'descripcion', 'nivel', 'dependencia_solicitante', 'oficina', 'forma_recepcion', 'fecha_limite', 'despacho', 'acta', 'observaciones', 'resultado', 'devolucion'];
  const changes = { actualizado_por: req.user.id };
  allowed.forEach((key) => { if (req.body[key] !== undefined) changes[key] = key.startsWith('fecha_') ? parseDate(req.body[key]) : clean(req.body[key], 20000) || null; });
  await caso.update(changes);
  await addHistory(caso, req.user.id, 'actualizacion', caso.estado, caso.estado, req.body.comentario || 'Información del expediente actualizada.');
  res.json({ success: true, data: await JuridicaCaso.findByPk(caso.id, { include: includeCase() }) });
};

const uploadAttachment = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Seleccione un archivo.' });
  const caso = await JuridicaCaso.findOne({ where: { id: req.params.id, ...accessWhere(req.user) } });
  if (!caso) return res.status(404).json({ success: false, message: 'Caso no encontrado.' });
  const adjunto = await JuridicaAdjunto.create({
    caso_id: caso.id, usuario_id: req.user.id, tipo: clean(req.body.tipo, 60) || 'soporte',
    nombre_original: clean(req.file.originalname, 500), mime_type: clean(req.file.mimetype, 150),
    tamano_bytes: req.file.size, sha256: crypto.createHash('sha256').update(req.file.buffer).digest('hex'), contenido: req.file.buffer
  });
  await addHistory(caso, req.user.id, 'adjunto', caso.estado, caso.estado, `Archivo adjunto: ${adjunto.nombre_original}`, { adjunto_id: String(adjunto.id) });
  res.status(201).json({ success: true, data: { id: adjunto.id, nombre_original: adjunto.nombre_original, tipo: adjunto.tipo } });
};

const downloadAttachment = async (req, res) => {
  const adjunto = await JuridicaAdjunto.findByPk(req.params.adjuntoId, { include: [{ model: JuridicaCaso, as: 'caso', attributes: ['id', 'solicitante_id', 'responsable_id'] }] });
  if (!adjunto) return res.status(404).json({ success: false, message: 'Archivo no encontrado.' });
  res.setHeader('Content-Type', adjunto.mime_type);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(adjunto.nombre_original)}`);
  res.send(adjunto.contenido);
};

const stats = async (req, res) => {
  const where = accessWhere(req.user);
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
  const rows = await JuridicaCaso.findAll({ where: accessWhere(req.user), include: includeCase(), order: [['anio', 'DESC'], ['nri', 'DESC']] });
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
  if (!['administrador', 'jefatura', 'secretaria'].includes(roleFor(req.user))) return res.status(403).json({ success: false, message: 'No autorizado para importar.' });
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
      devolucion: clean(cellValue(row.getCell(33)), 5000) || null, actualizado_por: req.user.id,
      metadata: { importado_desde_excel: true, fila_origen: rowNumber, responsable_snapshot: responsible ? userSnapshot(responsible) : (responsibleName ? { nombre: responsibleName } : null) }
    };
    const [caso, created] = await JuridicaCaso.findOrCreate({ where: { anio: year, nri }, defaults: { ...payload, creado_por: req.user.id } });
    if (created) { imported += 1; await addHistory(caso, req.user.id, 'importacion', null, caso.estado, `Importado desde fila ${rowNumber}.`); }
    else { await caso.update(payload); updated += 1; }
  }
  res.json({ success: true, data: { imported, updated, skipped, total: imported + updated } });
};

module.exports = {
  getProfile,
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
