const { QueryTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { ROLES } = require('../constants/roles');

const PUBLIC_DOCUMENT_STATE = 'vigente';
const canViewAllDocumentStates = (user = {}) =>
  [ROLES.ADMINISTRADOR, ROLES.GESTION_PROCESOS].includes(user.role);
const isInactiveScope = (query = {}, user = {}) =>
  String(query.estado_scope || '').toLowerCase() === 'inactive'
  && String(query.include_inactive || '').toLowerCase() === 'true'
  && canViewAllDocumentStates(user);

const parseTextList = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const addTextCondition = (conditions, replacements, column, replacementKey, values) => {
  if (values.length === 1) {
    conditions.push(`${column} = :${replacementKey}`);
    replacements[replacementKey] = values[0];
    return;
  }
  conditions.push(`${column} IN (:${replacementKey})`);
  replacements[replacementKey] = values;
};

const addStateCondition = (conditions, replacements, query, user) => {
  replacements.publicState = PUBLIC_DOCUMENT_STATE;
  conditions.push(
    isInactiveScope(query, user)
      ? "COALESCE(d.estado, '') <> :publicState"
      : 'd.estado = :publicState'
  );
};

const addCommonFilters = (conditions, replacements, query, user, skipKey = '') => {
  addStateCondition(conditions, replacements, query, user);

  const filters = [
    ['macro_proceso_id', 'd.macroproceso', 'macroValues'],
    ['proceso_id', 'd.proceso', 'procesoValues'],
    ['subproceso_id', 'd.subproceso', 'subprocesoValues'],
    ['tipo_documentacion_id', 'd.tipo_documento', 'tipoValues']
  ];

  filters.forEach(([queryKey, column, replacementKey]) => {
    if (queryKey === skipKey) return;
    const values = parseTextList(query[queryKey]);
    if (!values.length) return;
    addTextCondition(conditions, replacements, column, replacementKey, values);
  });

  String(query.titulo || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .forEach((term, index) => {
      const key = `term${index}`;
      conditions.push(`(d.titulo ILIKE :${key} OR d.codigo ILIKE :${key})`);
      replacements[key] = `%${term}%`;
    });
};

const buildWhere = (req, skipKey = '') => {
  const conditions = [];
  const replacements = {};
  addCommonFilters(conditions, replacements, req.query, req.user, skipKey);
  return { whereSql: conditions.join(' AND '), replacements };
};

const getMacroProcesos = async (req, res) => {
  try {
    const { whereSql, replacements } = buildWhere(req, 'macro_proceso_id');
    const macroProcesos = await sequelize.query(
      `SELECT DISTINCT d.macroproceso AS id, d.macroproceso AS nombre
       FROM documentos d
       WHERE ${whereSql} AND NULLIF(TRIM(d.macroproceso), '') IS NOT NULL
       ORDER BY d.macroproceso ASC`,
      { replacements, type: QueryTypes.SELECT }
    );
    res.json({ success: true, data: { macroProcesos } });
  } catch (error) {
    console.error('Error al cargar macroprocesos:', error);
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const getProcesos = async (req, res) => {
  try {
    const { whereSql, replacements } = buildWhere(req, 'proceso_id');
    const procesos = await sequelize.query(
      `SELECT DISTINCT d.proceso AS id, d.proceso AS nombre, d.macroproceso AS macro_proceso_id
       FROM documentos d
       WHERE ${whereSql} AND NULLIF(TRIM(d.proceso), '') IS NOT NULL
       ORDER BY d.proceso ASC`,
      { replacements, type: QueryTypes.SELECT }
    );
    res.json({ success: true, data: { procesos } });
  } catch (error) {
    console.error('Error al cargar procesos:', error);
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const getSubProcesos = async (req, res) => {
  try {
    const { whereSql, replacements } = buildWhere(req, 'subproceso_id');
    const subprocesos = await sequelize.query(
      `SELECT DISTINCT d.subproceso AS id, d.subproceso AS nombre, d.proceso AS proceso_id, d.macroproceso AS macro_proceso_id
       FROM documentos d
       WHERE ${whereSql} AND NULLIF(TRIM(d.subproceso), '') IS NOT NULL
       ORDER BY d.subproceso ASC`,
      { replacements, type: QueryTypes.SELECT }
    );
    res.json({ success: true, data: { subprocesos } });
  } catch (error) {
    console.error('Error al cargar subprocesos:', error);
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const getTiposDocumentacion = async (req, res) => {
  try {
    const { whereSql, replacements } = buildWhere(req, 'tipo_documentacion_id');
    const tipos = await sequelize.query(
      `SELECT DISTINCT d.tipo_documento AS id, d.tipo_documento AS nombre
       FROM documentos d
       WHERE ${whereSql} AND NULLIF(TRIM(d.tipo_documento), '') IS NOT NULL
       ORDER BY d.tipo_documento ASC`,
      { replacements, type: QueryTypes.SELECT }
    );
    res.json({ success: true, data: { tipos } });
  } catch (error) {
    console.error('Error al cargar tipos:', error);
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const getFilterOptions = async (req, res) => {
  try {
    const load = async (facet, skipKey) => {
      const { whereSql, replacements } = buildWhere(req, skipKey);
      const columns = {
        macro: `d.macroproceso AS id, d.macroproceso AS nombre`,
        proceso: `d.proceso AS id, d.proceso AS nombre, d.macroproceso AS macro_proceso_id`,
        subproceso: `d.subproceso AS id, d.subproceso AS nombre, d.proceso AS proceso_id, d.macroproceso AS macro_proceso_id`,
        tipo: `d.tipo_documento AS id, d.tipo_documento AS nombre`
      };
      const notEmpty = {
        macro: 'd.macroproceso',
        proceso: 'd.proceso',
        subproceso: 'd.subproceso',
        tipo: 'd.tipo_documento'
      };
      return sequelize.query(
        `SELECT DISTINCT ${columns[facet]}
         FROM documentos d
         WHERE ${whereSql} AND NULLIF(TRIM(${notEmpty[facet]}), '') IS NOT NULL
         ORDER BY nombre ASC`,
        { replacements, type: QueryTypes.SELECT }
      );
    };

    const [macroProcesos, procesos, subprocesos, tipos] = await Promise.all([
      load('macro', 'macro_proceso_id'),
      load('proceso', 'proceso_id'),
      load('subproceso', 'subproceso_id'),
      load('tipo', 'tipo_documentacion_id')
    ]);

    res.json({ success: true, data: { macroProcesos, procesos, subprocesos, tipos } });
  } catch (error) {
    console.error('Error al cargar opciones de filtros:', error);
    res.status(500).json({ success: false, message: 'Error' });
  }
};

module.exports = { getMacroProcesos, getProcesos, getSubProcesos, getTiposDocumentacion, getFilterOptions };
