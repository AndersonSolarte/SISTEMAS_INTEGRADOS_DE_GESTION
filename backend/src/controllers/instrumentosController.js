const crypto = require('crypto');
const XLSX = require('xlsx');
const { Op, fn, col } = require('sequelize');
const {
  User,
  UserModulePermission,
  InstrumentForm,
  InstrumentSection,
  InstrumentQuestion,
  InstrumentCondition,
  InstrumentResponse,
  InstrumentAnswer,
  InstrumentAttachment,
  InstrumentQuestionBank,
  InstrumentBackup
} = require('../models');
const { sequelize } = require('../config/database');
const { ROLES } = require('../constants/roles');

const PERMISSION_KEY = 'autoevaluacion.instrumentos.access';
const ADMIN_ROLES = new Set([ROLES.ADMINISTRADOR, ROLES.PLANEACION_ESTRATEGICA]);
const CREATOR_ROLES = new Set([ROLES.ADMINISTRADOR, ROLES.PLANEACION_ESTRATEGICA, ROLES.AUTOEVALUACION]);
const VALID_STATUS = new Set(['borrador', 'publicado', 'cerrado', 'archivado']);

const normalizeText = (value) => String(value || '').trim();
const asArray = (value) => (Array.isArray(value) ? value : []);
const isAdminUser = (user) => ADMIN_ROLES.has(user?.role);
const isCreatorRole = (user) => CREATOR_ROLES.has(user?.role);
const hasAnswerValue = (value) => {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.values(value).some((item) => hasAnswerValue(item));
  return true;
};

const makePublicCode = () => crypto.randomBytes(5).toString('hex');
const makeRespondentCode = () => `R-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;

const getBasePublicUrl = (req, code) => {
  const configured = normalizeText(process.env.PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL);
  if (!configured) return `/f/${code}`;
  return `${configured.replace(/\/$/, '')}/f/${code}`;
};

const hasIndividualPermission = async (userId) => {
  if (!userId) return false;
  const count = await UserModulePermission.count({
    where: { user_id: userId, module_key: PERMISSION_KEY, can_view: true }
  });
  return count > 0;
};

const ensureAccess = async (req, res, next) => {
  try {
    if (isAdminUser(req.user)) return next();
    if (await hasIndividualPermission(req.user?.id)) return next();
    return res.status(403).json({
      success: false,
      message: 'No tienes habilitado el permiso individual de Gestión de Instrumentos'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error validando permisos de instrumentos' });
  }
};

const canCreateInstrument = async (req, res, next) => {
  if (!isCreatorRole(req.user)) {
    return res.status(403).json({ success: false, message: 'Tu perfil no permite crear instrumentos' });
  }
  return ensureAccess(req, res, next);
};

const includeFullForm = [
  { model: InstrumentSection, as: 'sections', separate: true, order: [['order_index', 'ASC'], ['id', 'ASC']] },
  { model: InstrumentQuestion, as: 'questions', separate: true, order: [['order_index', 'ASC'], ['id', 'ASC']] },
  { model: InstrumentCondition, as: 'conditions', separate: true, order: [['id', 'ASC']] },
  { model: User, as: 'creator', attributes: ['id', 'nombre', 'email'] }
];

const scopedWhere = (user, extra = {}) => {
  if (isAdminUser(user)) return extra;
  return { ...extra, created_by: user.id };
};

const loadOwnedForm = async (id, user, options = {}) => {
  const where = scopedWhere(user, { id });
  return InstrumentForm.findOne({ where, ...options });
};

const serializeForm = (form, responseCount = null) => {
  if (!form) return null;
  const plain = typeof form.toJSON === 'function' ? form.toJSON() : form;
  return {
    ...plain,
    response_count: responseCount ?? plain.response_count ?? 0,
    public_url: plain.public_url || (plain.public_code ? `/f/${plain.public_code}` : null)
  };
};

const syncFormChildren = async (formId, payload, transaction) => {
  const sectionIdMap = new Map();
  const questionIdMap = new Map();

  if (payload.sections !== undefined) {
    await InstrumentSection.destroy({ where: { form_id: formId }, transaction });
    for (const [index, section] of asArray(payload.sections).entries()) {
      const savedSection = await InstrumentSection.create({
        form_id: formId,
        title: normalizeText(section.title) || `Seccion ${index + 1}`,
        description: normalizeText(section.description) || null,
        order_index: Number(section.order_index ?? index)
      }, { transaction });
      if (section.id) sectionIdMap.set(String(section.id), savedSection.id);
      if (section.temp_id) sectionIdMap.set(String(section.temp_id), savedSection.id);
      sectionIdMap.set(`index:${index}`, savedSection.id);
    }
  }

  if (payload.questions !== undefined) {
    await InstrumentQuestion.destroy({ where: { form_id: formId }, transaction });
    for (const [index, question] of asArray(payload.questions).entries()) {
      const incomingSectionId = question.section_id ? sectionIdMap.get(String(question.section_id)) || Number(question.section_id) : null;
      const tempSectionId = question.section_temp_id ? sectionIdMap.get(String(question.section_temp_id)) : null;
      const sectionIndexId = Number.isInteger(Number(question.section_index)) ? sectionIdMap.get(`index:${Number(question.section_index)}`) : null;
      const savedQuestion = await InstrumentQuestion.create({
        form_id: formId,
        section_id: tempSectionId || sectionIndexId || incomingSectionId || null,
        question_text: normalizeText(question.question_text || question.text) || `Pregunta ${index + 1}`,
        question_description: normalizeText(question.question_description || question.description) || null,
        question_type: normalizeText(question.question_type || question.type) || 'texto_corto',
        is_required: Boolean(question.is_required),
        order_index: Number(question.order_index ?? index),
        config: question.config || {},
        options: asArray(question.options),
        validation_rules: question.validation_rules || {}
      }, { transaction });
      if (question.id) questionIdMap.set(String(question.id), savedQuestion.id);
      if (question.temp_id) questionIdMap.set(String(question.temp_id), savedQuestion.id);
      questionIdMap.set(`index:${index}`, savedQuestion.id);
    }
  }

  if (payload.conditions !== undefined) {
    await InstrumentCondition.destroy({ where: { form_id: formId }, transaction });
    for (const condition of asArray(payload.conditions)) {
      const sourceQuestionId = questionIdMap.get(String(condition.source_question_id)) || Number(condition.source_question_id) || null;
      const targetId = condition.target_type === 'section'
        ? (sectionIdMap.get(String(condition.target_id)) || Number(condition.target_id) || null)
        : (questionIdMap.get(String(condition.target_id)) || Number(condition.target_id) || null);
      if (!sourceQuestionId || !targetId) continue;
      const conditionLogic = condition.condition_logic || {};
      const rules = Array.isArray(conditionLogic.rules) ? conditionLogic.rules : [];
      const nextConditionLogic = rules.length
        ? {
          ...conditionLogic,
          rules: rules.map((rule) => ({
            ...rule,
            source_question_id: questionIdMap.get(String(rule.source_question_id || rule.source)) || sourceQuestionId
          }))
        }
        : conditionLogic;
      await InstrumentCondition.create({
        form_id: formId,
        source_question_id: sourceQuestionId,
        target_type: normalizeText(condition.target_type) || 'question',
        target_id: targetId,
        condition_logic: nextConditionLogic,
        action: normalizeText(condition.action) || 'show'
      }, { transaction });
    }
  }
};

const buildFormPayload = (body, req, existing = null) => {
  const title = normalizeText(body.title);
  if (!title && !existing) {
    const error = new Error('El nombre del instrumento es obligatorio');
    error.status = 400;
    throw error;
  }

  const code = existing?.public_code || makePublicCode();
  const status = normalizeText(body.status || existing?.status || 'borrador').toLowerCase();

  return {
    title: title || existing.title,
    description: normalizeText(body.description) || null,
    objective: normalizeText(body.objective) || null,
    program_id: Number(body.program_id) || null,
    program_name: normalizeText(body.program_name || body.program) || null,
    area_id: Number(body.area_id) || null,
    area_name: normalizeText(body.area_name || body.area) || null,
    year: Number(body.year) || null,
    period: normalizeText(body.period) || null,
    type: normalizeText(body.type) || null,
    status: VALID_STATUS.has(status) ? status : 'borrador',
    version: Number(body.version || existing?.version || 1),
    is_anonymous: body.is_anonymous === undefined ? Boolean(existing?.is_anonymous ?? true) : Boolean(body.is_anonymous),
    allow_multiple_responses: body.allow_multiple_responses === undefined ? Boolean(existing?.allow_multiple_responses ?? true) : Boolean(body.allow_multiple_responses),
    response_limit: Number(body.response_limit) || null,
    opens_at: body.opens_at ? new Date(body.opens_at) : null,
    closes_at: body.closes_at ? new Date(body.closes_at) : null,
    public_code: code,
    public_url: getBasePublicUrl(req, code),
    theme_config: body.theme_config || {},
    personal_fields_config: body.personal_fields_config || {},
    attachment_config: body.attachment_config || {},
    thank_you_message: normalizeText(body.thank_you_message) || 'Gracias por responder este instrumento.',
    closed_message: normalizeText(body.closed_message) || 'Este instrumento no se encuentra disponible.',
    evidence_context: body.evidence_context || {},
    updated_by: req.user.id
  };
};

const getDashboard = async (req, res) => {
  try {
    const where = scopedWhere(req.user, {});
    const [forms, responsesTotal] = await Promise.all([
      InstrumentForm.findAll({
        where,
        attributes: ['id', 'title', 'status', 'type', 'year', 'period', 'created_at', 'published_at'],
        order: [['created_at', 'DESC']],
        limit: 8,
        raw: true
      }),
      InstrumentResponse.count({
        include: [{ model: InstrumentForm, as: 'form', required: true, where }]
      })
    ]);
    const counts = await InstrumentForm.findAll({
      where,
      attributes: ['status', [fn('COUNT', col('id')), 'total']],
      group: ['status'],
      raw: true
    });
    const byStatus = counts.reduce((acc, row) => ({ ...acc, [row.status]: Number(row.total || 0) }), {});
    return res.json({
      success: true,
      data: {
        total: Object.values(byStatus).reduce((acc, value) => acc + value, 0),
        activos: byStatus.publicado || 0,
        cerrados: byStatus.cerrado || 0,
        archivados: byStatus.archivado || 0,
        borradores: byStatus.borrador || 0,
        respuestas: responsesTotal,
        ultimos: forms
      }
    });
  } catch (error) {
    console.error('Error dashboard instrumentos:', error);
    return res.status(500).json({ success: false, message: 'Error consultando el panel de instrumentos' });
  }
};

const listForms = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const where = scopedWhere(req.user, {});
    if (req.query.status) where.status = req.query.status;
    if (req.query.type) where.type = { [Op.iLike]: `%${req.query.type}%` };
    if (req.query.program) where.program_name = { [Op.iLike]: `%${req.query.program}%` };
    if (req.query.area) where.area_name = { [Op.iLike]: `%${req.query.area}%` };
    if (req.query.year) where.year = Number(req.query.year);
    if (req.query.period) where.period = { [Op.iLike]: `%${req.query.period}%` };
    if (req.query.search) where[Op.or] = [
      { title: { [Op.iLike]: `%${req.query.search}%` } },
      { description: { [Op.iLike]: `%${req.query.search}%` } }
    ];
    if (!req.query.include_archived && !req.query.status) where.status = { [Op.ne]: 'archivado' };
    if (isAdminUser(req.user) && req.query.creator) where.created_by = Number(req.query.creator);

    const { rows, count } = await InstrumentForm.findAndCountAll({
      where,
      include: [{ model: User, as: 'creator', attributes: ['id', 'nombre', 'email'] }],
      order: [['created_at', 'DESC']],
      offset: (page - 1) * limit,
      limit
    });
    const ids = rows.map((row) => row.id);
    const responseCounts = ids.length
      ? await InstrumentResponse.findAll({
        where: { form_id: { [Op.in]: ids } },
        attributes: ['form_id', [fn('COUNT', col('id')), 'total']],
        group: ['form_id'],
        raw: true
      })
      : [];
    const countMap = new Map(responseCounts.map((row) => [Number(row.form_id), Number(row.total || 0)]));
    return res.json({
      success: true,
      data: {
        rows: rows.map((row) => serializeForm(row, countMap.get(row.id) || 0)),
        pagination: { total: count, page, limit, totalPages: Math.max(1, Math.ceil(count / limit)) }
      }
    });
  } catch (error) {
    console.error('Error listando instrumentos:', error);
    return res.status(500).json({ success: false, message: 'Error listando instrumentos' });
  }
};

const createForm = async (req, res) => {
  const tx = await sequelize.transaction();
  try {
    const payload = buildFormPayload(req.body || {}, req);
    const form = await InstrumentForm.create({ ...payload, created_by: req.user.id }, { transaction: tx });
    await syncFormChildren(form.id, req.body || {}, tx);
    await tx.commit();
    const saved = await InstrumentForm.findByPk(form.id, { include: includeFullForm });
    return res.status(201).json({ success: true, data: serializeForm(saved), message: 'Instrumento creado' });
  } catch (error) {
    await tx.rollback();
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Error creando instrumento' });
  }
};

const getForm = async (req, res) => {
  const form = await loadOwnedForm(req.params.id, req.user, { include: includeFullForm });
  if (!form) return res.status(404).json({ success: false, message: 'Instrumento no encontrado' });
  const responseCount = await InstrumentResponse.count({ where: { form_id: form.id } });
  return res.json({ success: true, data: serializeForm(form, responseCount) });
};

const getPreviewForm = async (req, res) => {
  const form = await loadOwnedForm(req.params.id, req.user, { include: includeFullForm });
  if (!form) return res.status(404).json({ success: false, message: 'Instrumento no encontrado' });
  return res.json({ success: true, data: { ...serializeForm(form), preview_mode: true } });
};

const updateForm = async (req, res) => {
  const tx = await sequelize.transaction();
  try {
    const form = await loadOwnedForm(req.params.id, req.user, { transaction: tx });
    if (!form) {
      await tx.rollback();
      return res.status(404).json({ success: false, message: 'Instrumento no encontrado' });
    }
    await form.update(buildFormPayload(req.body || {}, req, form), { transaction: tx });
    await syncFormChildren(form.id, req.body || {}, tx);
    await tx.commit();
    const saved = await InstrumentForm.findByPk(form.id, { include: includeFullForm });
    return res.json({ success: true, data: serializeForm(saved), message: 'Instrumento actualizado' });
  } catch (error) {
    await tx.rollback();
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Error actualizando instrumento' });
  }
};

const setFormStatus = (status) => async (req, res) => {
  const form = await loadOwnedForm(req.params.id, req.user, status === 'publicado' ? { include: includeFullForm } : {});
  if (!form) return res.status(404).json({ success: false, message: 'Instrumento no encontrado' });
  if (status === 'publicado') {
    if (!form.questions?.length) {
      return res.status(400).json({ success: false, message: 'No puedes publicar un instrumento sin preguntas configuradas.' });
    }
    if (form.closes_at && new Date(form.closes_at) <= new Date()) {
      return res.status(400).json({ success: false, message: 'La fecha de cierre ya vencio. Ajusta el cierre antes de publicar.' });
    }
  }
  const patch = { status, updated_by: req.user.id };
  if (status === 'publicado') patch.published_at = new Date();
  if (status === 'cerrado') patch.closed_at = new Date();
  if (status === 'archivado') patch.archived_at = new Date();
  if (status !== 'archivado') patch.archived_at = null;
  await form.update(patch);
  return res.json({ success: true, data: serializeForm(form), message: `Instrumento ${status}` });
};

const duplicateForm = async (req, res) => {
  const tx = await sequelize.transaction();
  try {
    const source = await loadOwnedForm(req.params.id, req.user, { include: includeFullForm, transaction: tx });
    if (!source) {
      await tx.rollback();
      return res.status(404).json({ success: false, message: 'Instrumento no encontrado' });
    }
    const code = makePublicCode();
    const clone = await InstrumentForm.create({
      ...source.toJSON(),
      id: undefined,
      title: `${source.title} (copia)`,
      status: 'borrador',
      version: Number(source.version || 1) + 1,
      public_code: code,
      public_url: getBasePublicUrl(req, code),
      published_at: null,
      closed_at: null,
      archived_at: null,
      created_by: req.user.id,
      updated_by: req.user.id,
      created_at: undefined,
      updated_at: undefined
    }, { transaction: tx });
    await syncFormChildren(clone.id, source.toJSON(), tx);
    await tx.commit();
    return res.status(201).json({ success: true, data: serializeForm(clone), message: 'Instrumento duplicado' });
  } catch (error) {
    await tx.rollback();
    console.error('Error duplicando instrumento:', error);
    return res.status(500).json({ success: false, message: 'Error duplicando instrumento' });
  }
};

const deleteForm = async (req, res) => {
  const tx = await sequelize.transaction();
  try {
    const form = await loadOwnedForm(req.params.id, req.user, { transaction: tx });
    if (!form) {
      await tx.rollback();
      return res.status(404).json({ success: false, message: 'Instrumento no encontrado' });
    }
    const responses = await InstrumentResponse.findAll({ where: { form_id: form.id }, attributes: ['id'], raw: true, transaction: tx });
    const responseIds = responses.map((row) => row.id);
    if (responseIds.length) {
      await InstrumentAttachment.destroy({ where: { response_id: { [Op.in]: responseIds } }, transaction: tx });
      await InstrumentAnswer.destroy({ where: { response_id: { [Op.in]: responseIds } }, transaction: tx });
    }
    await InstrumentResponse.destroy({ where: { form_id: form.id }, transaction: tx });
    await InstrumentCondition.destroy({ where: { form_id: form.id }, transaction: tx });
    await InstrumentQuestion.destroy({ where: { form_id: form.id }, transaction: tx });
    await InstrumentSection.destroy({ where: { form_id: form.id }, transaction: tx });
    await InstrumentBackup.destroy({ where: { form_id: form.id }, transaction: tx });
    await form.destroy({ transaction: tx });
    await tx.commit();
    return res.json({ success: true, message: 'Instrumento eliminado definitivamente' });
  } catch (error) {
    await tx.rollback();
    console.error('Error eliminando instrumento:', error);
    return res.status(500).json({ success: false, message: 'Error eliminando instrumento' });
  }
};

const getPublicForm = async (req, res) => {
  const form = await InstrumentForm.findOne({
    where: { public_code: req.params.code },
    include: includeFullForm
  });
  if (!form) return res.status(404).json({ success: false, message: 'Instrumento no encontrado' });
  const now = new Date();
  let unavailableMessage = '';
  if (form.status !== 'publicado') unavailableMessage = 'Este instrumento aun no esta publicado.';
  if (!unavailableMessage && form.opens_at && new Date(form.opens_at) > now) unavailableMessage = 'Este instrumento aun no ha abierto.';
  if (!unavailableMessage && form.closes_at && new Date(form.closes_at) < now) unavailableMessage = form.closed_message || 'Este instrumento ya se encuentra cerrado.';
  const unavailable = Boolean(unavailableMessage);
  if (unavailable) {
    return res.status(423).json({ success: false, message: unavailableMessage || 'Este instrumento no se encuentra disponible' });
  }
  return res.json({ success: true, data: serializeForm(form) });
};

const submitPublicResponse = async (req, res) => {
  const tx = await sequelize.transaction();
  try {
    const form = await InstrumentForm.findOne({ where: { public_code: req.params.code }, include: includeFullForm, transaction: tx });
    if (!form || form.status !== 'publicado') {
      await tx.rollback();
      return res.status(423).json({ success: false, message: form?.closed_message || 'Este instrumento no se encuentra disponible' });
    }
    const now = new Date();
    if (form.opens_at && new Date(form.opens_at) > now) {
      await tx.rollback();
      return res.status(423).json({ success: false, message: 'Este instrumento aun no ha abierto.' });
    }
    if (form.closes_at && new Date(form.closes_at) < now) {
      await tx.rollback();
      return res.status(423).json({ success: false, message: form.closed_message || 'Este instrumento ya se encuentra cerrado.' });
    }
    const responseCount = await InstrumentResponse.count({ where: { form_id: form.id }, transaction: tx });
    if (form.response_limit && responseCount >= form.response_limit) {
      await tx.rollback();
      return res.status(409).json({ success: false, message: 'El instrumento ya alcanzó el límite de respuestas' });
    }
    const answers = req.body?.answers || {};
    const response = await InstrumentResponse.create({
      form_id: form.id,
      respondent_code: makeRespondentCode(),
      respondent_data: form.is_anonymous ? {} : (req.body?.respondent_data || {}),
      is_anonymous: Boolean(form.is_anonymous),
      metadata: { userAgent: req.get('user-agent') || null, ip: req.ip || null }
    }, { transaction: tx });
    for (const question of form.questions || []) {
      const value = answers[String(question.id)] ?? answers[question.id] ?? null;
      if (question.is_required && !hasAnswerValue(value)) {
        await tx.rollback();
        return res.status(400).json({ success: false, message: `La pregunta "${question.question_text}" es obligatoria` });
      }
      await InstrumentAnswer.create({ response_id: response.id, question_id: question.id, answer_value: value }, { transaction: tx });
      if (question.question_type === 'url_archivo' && value) {
        await InstrumentAttachment.create({
          response_id: response.id,
          question_id: question.id,
          storage_type: 'external_url',
          external_url: String(value),
          metadata: { source: 'public_response' }
        }, { transaction: tx });
      }
      if (question.question_type === 'carga_archivo' && value && typeof value === 'object') {
        await InstrumentAttachment.create({
          response_id: response.id,
          question_id: question.id,
          file_name: value.file_name || null,
          file_type: value.file_type || null,
          file_size: Number(value.file_size) || null,
          storage_type: value.external_url ? 'external_url' : (value.storage_type || 'local_metadata'),
          external_url: value.external_url || null,
          metadata: {
            source: 'public_response',
            note: value.external_url ? 'external_url_registered' : 'file_metadata_only'
          }
        }, { transaction: tx });
      }
    }
    await tx.commit();
    return res.status(201).json({ success: true, message: form.thank_you_message || 'Respuesta registrada' });
  } catch (error) {
    await tx.rollback();
    console.error('Error guardando respuesta publica:', error);
    return res.status(500).json({ success: false, message: 'Error registrando la respuesta' });
  }
};

const getResults = async (req, res) => {
  const form = await loadOwnedForm(req.params.id, req.user);
  if (!form) return res.status(404).json({ success: false, message: 'Instrumento no encontrado' });
  const rows = await InstrumentResponse.findAll({
    where: { form_id: form.id },
    include: [
      { model: InstrumentAnswer, as: 'answers', include: [{ model: InstrumentQuestion, as: 'question' }] },
      { model: InstrumentAttachment, as: 'attachments' }
    ],
    order: [['submitted_at', 'DESC']]
  });
  return res.json({ success: true, data: rows });
};

const buildStatistics = async (formId) => {
  const form = await InstrumentForm.findByPk(formId, { include: includeFullForm });
  const responses = await InstrumentResponse.findAll({
    where: { form_id: formId },
    include: [{ model: InstrumentAnswer, as: 'answers' }],
    order: [['submitted_at', 'ASC']]
  });
  const total = responses.length;
  const answerBuckets = new Map();
  responses.forEach((response) => {
    response.answers.forEach((answer) => {
      const list = answerBuckets.get(answer.question_id) || [];
      list.push(answer.answer_value);
      answerBuckets.set(answer.question_id, list);
    });
  });
  const questions = (form?.questions || []).map((question) => {
    const values = answerBuckets.get(question.id) || [];
    const flat = values.flatMap((value) => Array.isArray(value) ? value : [value]).filter((value) => value !== null && value !== '');
    const counts = flat.reduce((acc, value) => {
      const key = String(value);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const numeric = flat.map(Number).filter(Number.isFinite);
    return {
      id: question.id,
      text: question.question_text,
      type: question.question_type,
      total_answers: flat.length,
      counts,
      distribution: Object.entries(counts).map(([name, value]) => ({ name, value, percentage: total ? Math.round((value / total) * 100) : 0 })),
      average: numeric.length ? Number((numeric.reduce((a, b) => a + b, 0) / numeric.length).toFixed(2)) : null,
      min: numeric.length ? Math.min(...numeric) : null,
      max: numeric.length ? Math.max(...numeric) : null,
      open_answers: ['texto_corto', 'texto_largo', 'correo', 'telefono'].includes(question.question_type) ? flat.slice(0, 30) : []
    };
  });
  return { total_responses: total, questions };
};

const getStatistics = async (req, res) => {
  const form = await loadOwnedForm(req.params.id, req.user);
  if (!form) return res.status(404).json({ success: false, message: 'Instrumento no encontrado' });
  return res.json({ success: true, data: await buildStatistics(form.id) });
};

const exportExcel = async (req, res) => {
  const form = await loadOwnedForm(req.params.id, req.user, { include: includeFullForm });
  if (!form) return res.status(404).json({ success: false, message: 'Instrumento no encontrado' });
  const responses = await InstrumentResponse.findAll({ where: { form_id: form.id }, include: [{ model: InstrumentAnswer, as: 'answers' }], raw: false });
  const questionMap = new Map((form.questions || []).map((q) => [q.id, q.question_text]));
  const records = responses.map((response) => {
    const base = { CODIGO: response.respondent_code, FECHA: response.submitted_at, ANONIMO: response.is_anonymous ? 'SI' : 'NO', ...response.respondent_data };
    response.answers.forEach((answer) => {
      base[questionMap.get(answer.question_id) || `Pregunta ${answer.question_id}`] = Array.isArray(answer.answer_value) ? answer.answer_value.join(', ') : answer.answer_value;
    });
    return base;
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(records.length ? records : [{ MENSAJE: 'Sin respuestas' }]), 'RESPUESTAS');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename="respuestas_instrumento_${form.id}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return res.send(buffer);
};

const exportPdf = async (req, res) => {
  const form = await loadOwnedForm(req.params.id, req.user, { include: includeFullForm });
  if (!form) return res.status(404).json({ success: false, message: 'Instrumento no encontrado' });
  const stats = await buildStatistics(form.id);
  return res.json({ success: true, data: { form: serializeForm(form), statistics: stats }, message: 'PDF preparado como resumen JSON; listo para conectar generador PDF institucional.' });
};

const createBackup = async (req, res) => {
  const form = await loadOwnedForm(req.params.id, req.user, { include: includeFullForm });
  if (!form) return res.status(404).json({ success: false, message: 'Instrumento no encontrado' });
  const [responses, statistics] = await Promise.all([
    InstrumentResponse.findAll({ where: { form_id: form.id }, include: [{ model: InstrumentAnswer, as: 'answers' }, { model: InstrumentAttachment, as: 'attachments' }] }),
    buildStatistics(form.id)
  ]);
  const backup = await InstrumentBackup.create({
    created_by: req.user.id,
    scope: isAdminUser(req.user) ? 'admin_form' : 'own_form',
    form_id: form.id,
    metadata: { form_id: form.id, title: form.title, generated_at: new Date().toISOString(), format: 'json-prezip' }
  });
  const payload = { backup_id: backup.id, form: serializeForm(form), responses, statistics };
  res.setHeader('Content-Disposition', `attachment; filename="backup_instrumento_${form.id}.json"`);
  res.setHeader('Content-Type', 'application/json');
  return res.send(JSON.stringify(payload, null, 2));
};

const listHistory = async (req, res) => listForms(req, res);

const listQuestionBank = async (req, res) => {
  const where = isAdminUser(req.user) ? {} : { [Op.or]: [{ created_by: req.user.id }, { is_public: true }] };
  if (req.query.type) where.question_type = req.query.type;
  if (req.query.category) where.category = { [Op.iLike]: `%${req.query.category}%` };
  const rows = await InstrumentQuestionBank.findAll({ where, order: [['created_at', 'DESC']], limit: 200 });
  return res.json({ success: true, data: rows });
};

const createQuestionBank = async (req, res) => {
  const row = await InstrumentQuestionBank.create({
    question_text: normalizeText(req.body.question_text),
    question_type: normalizeText(req.body.question_type) || 'texto_corto',
    category: normalizeText(req.body.category) || null,
    area_id: Number(req.body.area_id) || null,
    area_name: normalizeText(req.body.area_name) || null,
    program_id: Number(req.body.program_id) || null,
    program_name: normalizeText(req.body.program_name) || null,
    config: req.body.config || {},
    options: asArray(req.body.options),
    created_by: req.user.id,
    is_public: isAdminUser(req.user) ? Boolean(req.body.is_public) : false
  });
  return res.status(201).json({ success: true, data: row });
};

const updateQuestionBank = async (req, res) => {
  const where = isAdminUser(req.user) ? { id: req.params.id } : { id: req.params.id, created_by: req.user.id };
  const row = await InstrumentQuestionBank.findOne({ where });
  if (!row) return res.status(404).json({ success: false, message: 'Pregunta no encontrada' });
  await row.update({
    question_text: normalizeText(req.body.question_text) || row.question_text,
    question_type: normalizeText(req.body.question_type) || row.question_type,
    category: normalizeText(req.body.category) || row.category,
    config: req.body.config || row.config,
    options: req.body.options !== undefined ? asArray(req.body.options) : row.options,
    is_public: isAdminUser(req.user) ? Boolean(req.body.is_public) : row.is_public
  });
  return res.json({ success: true, data: row });
};

const getQr = async (req, res) => {
  const form = await loadOwnedForm(req.params.id, req.user);
  if (!form) return res.status(404).json({ success: false, message: 'Instrumento no encontrado' });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><rect width="220" height="220" fill="#fff"/><rect x="18" y="18" width="184" height="184" fill="none" stroke="#0f172a" stroke-width="8"/><text x="110" y="104" text-anchor="middle" font-size="18" font-family="Arial" fill="#0f172a">${form.public_code}</text><text x="110" y="132" text-anchor="middle" font-size="10" font-family="Arial" fill="#475569">QR pendiente</text></svg>`;
  return res.json({ success: true, data: { public_url: form.public_url, svg } });
};

const listPermissions = async (req, res) => {
  if (!isAdminUser(req.user)) return res.status(403).json({ success: false, message: 'Solo administrador' });
  const rows = await UserModulePermission.findAll({
    where: { module_key: PERMISSION_KEY },
    include: [{ model: User, as: 'user', attributes: ['id', 'nombre', 'email', 'role'] }],
    order: [['updated_at', 'DESC']]
  });
  return res.json({ success: true, data: rows });
};

const assignPermission = async (req, res) => {
  if (!isAdminUser(req.user)) return res.status(403).json({ success: false, message: 'Solo administrador' });
  const userId = Number(req.body.user_id);
  let user = userId ? await User.findByPk(userId) : null;
  if (!user && req.body.email) {
    user = await User.findOne({ where: { email: String(req.body.email).trim().toLowerCase() } });
  }
  if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
  const [row] = await UserModulePermission.findOrCreate({
    where: { user_id: user.id, module_key: PERMISSION_KEY },
    defaults: { can_view: Boolean(req.body.enabled ?? true), can_manage: Boolean(req.body.can_manage) }
  });
  await row.update({ can_view: Boolean(req.body.enabled ?? true), can_manage: Boolean(req.body.can_manage) });
  return res.json({ success: true, data: row, message: 'Permiso actualizado' });
};

module.exports = {
  PERMISSION_KEY,
  ensureAccess,
  canCreateInstrument,
  getDashboard,
  listForms,
  createForm,
  getForm,
  getPreviewForm,
  updateForm,
  archiveForm: setFormStatus('archivado'),
  restoreForm: setFormStatus('borrador'),
  publishForm: setFormStatus('publicado'),
  closeForm: setFormStatus('cerrado'),
  duplicateForm,
  deleteForm,
  getResults,
  getStatistics,
  exportExcel,
  exportPdf,
  createBackup,
  listHistory,
  listQuestionBank,
  createQuestionBank,
  updateQuestionBank,
  getPublicForm,
  submitPublicResponse,
  getQr,
  listPermissions,
  assignPermission
};
