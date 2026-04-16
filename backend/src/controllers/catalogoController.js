const { MacroProceso, Proceso, SubProceso, TipoDocumentacion, Documento } = require('../models');
const { literal, QueryTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { ROLES } = require('../constants/roles');

const PUBLIC_DOCUMENT_STATE = 'vigente';
const publicDocumentStateSql = (alias = 'd') =>
  `${alias}.estado = '${PUBLIC_DOCUMENT_STATE}'`;
const inactiveDocumentStateSql = (alias = 'd') =>
  `COALESCE(${alias}.estado, '') <> '${PUBLIC_DOCUMENT_STATE}'`;
const canViewAllDocumentStates = (user = {}) =>
  [ROLES.ADMINISTRADOR, ROLES.GESTION_PROCESOS].includes(user.role);
const isInactiveScope = (query = {}, user = {}) =>
  String(query.estado_scope || '').toLowerCase() === 'inactive'
  && String(query.include_inactive || '').toLowerCase() === 'true'
  && canViewAllDocumentStates(user);
const documentStateSql = (query = {}, user = {}, alias = 'd') =>
  isInactiveScope(query, user) ? inactiveDocumentStateSql(alias) : publicDocumentStateSql(alias);
const parseIdList = (value) => {
  const ids = String(value || '')
    .split(',')
    .map((item) => Number(item))
    .filter(Number.isFinite);
  return ids.length ? ids : null;
};

const getMacroProcesos = async (req, res) => {
  try {
    const estadoSql = documentStateSql(req.query, req.user, 'd');
    const macroProcesos = await MacroProceso.findAll({
      where: literal(`EXISTS (
        SELECT 1 FROM procesos p
        JOIN subprocesos sp ON sp.proceso_id = p.id
        JOIN documentos d ON d.subproceso_id = sp.id
        WHERE p.macro_proceso_id = "macro_procesos"."id"
        AND ${estadoSql}
      )`),
      order: [['nombre', 'ASC']]
    });
    res.json({ success: true, data: { macroProcesos } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const getProcesos = async (req, res) => {
  try {
    const { macro_proceso_id } = req.query;
    const estadoSql = documentStateSql(req.query, req.user, 'd');
    const ids = macro_proceso_id
      ? String(macro_proceso_id).split(',').map(Number).filter(Number.isFinite)
      : [];
    const macroWhere = ids.length
      ? { macro_proceso_id: ids.length === 1 ? ids[0] : { [Op.in]: ids } }
      : {};
    const procesos = await Proceso.findAll({
      where: {
        ...macroWhere,
        [Op.and]: literal(`EXISTS (
          SELECT 1 FROM subprocesos sp
          JOIN documentos d ON d.subproceso_id = sp.id
          WHERE sp.proceso_id = "procesos"."id"
          AND ${estadoSql}
        )`)
      },
      order: [['nombre', 'ASC']]
    });
    res.json({ success: true, data: { procesos } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const getSubProcesos = async (req, res) => {
  try {
    const { proceso_id } = req.query;
    const estadoSql = documentStateSql(req.query, req.user, 'd');
    const ids = proceso_id
      ? String(proceso_id).split(',').map(Number).filter(Number.isFinite)
      : [];
    const procWhere = ids.length
      ? { proceso_id: ids.length === 1 ? ids[0] : { [Op.in]: ids } }
      : {};
    const subprocesos = await SubProceso.findAll({
      where: {
        ...procWhere,
        [Op.and]: literal(`EXISTS (
          SELECT 1 FROM documentos d
          WHERE d.subproceso_id = "subprocesos"."id"
          AND ${estadoSql}
        )`)
      },
      order: [['nombre', 'ASC']]
    });
    res.json({ success: true, data: { subprocesos } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const getTiposDocumentacion = async (req, res) => {
  try {
    const { macro_proceso_id, proceso_id, subproceso_id } = req.query;
    const estadoSql = documentStateSql(req.query, req.user, 'd');
    const macroIds = macro_proceso_id ? String(macro_proceso_id).split(',').map(Number).filter(Number.isFinite) : [];
    const procIds  = proceso_id     ? String(proceso_id).split(',').map(Number).filter(Number.isFinite) : [];
    const subIds   = subproceso_id  ? String(subproceso_id).split(',').map(Number).filter(Number.isFinite) : [];

    let subFilter = '';
    if (subIds.length) {
      subFilter = `AND d.subproceso_id IN (${subIds.join(',')})`;
    } else if (procIds.length) {
      subFilter = `AND d.subproceso_id IN (SELECT id FROM subprocesos WHERE proceso_id IN (${procIds.join(',')}))`;
    } else if (macroIds.length) {
      subFilter = `AND d.subproceso_id IN (SELECT sp.id FROM subprocesos sp JOIN procesos p ON sp.proceso_id = p.id WHERE p.macro_proceso_id IN (${macroIds.join(',')}))`;
    }

    const tipos = await TipoDocumentacion.findAll({
      where: literal(`EXISTS (
        SELECT 1 FROM documentos d
        WHERE d.tipo_documentacion_id = "tipos_documentacion"."id"
        AND ${estadoSql}
        ${subFilter}
      )`),
      order: [['nombre', 'ASC']]
    });
    res.json({ success: true, data: { tipos } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const getFilterOptions = async (req, res) => {
  try {
    const macroIds = parseIdList(req.query.macro_proceso_id);
    const procesoIds = parseIdList(req.query.proceso_id);
    const subprocesoIds = parseIdList(req.query.subproceso_id);
    const tipoIds = parseIdList(req.query.tipo_documentacion_id);
    const replacements = { publicState: PUBLIC_DOCUMENT_STATE };
    const conditions = [
      isInactiveScope(req.query, req.user)
        ? "COALESCE(d.estado, '') <> :publicState"
        : 'd.estado = :publicState'
    ];

    if (macroIds) {
      conditions.push('mp.id IN (:macroIds)');
      replacements.macroIds = macroIds;
    }
    if (procesoIds) {
      conditions.push('p.id IN (:procesoIds)');
      replacements.procesoIds = procesoIds;
    }
    if (subprocesoIds) {
      conditions.push('sp.id IN (:subprocesoIds)');
      replacements.subprocesoIds = subprocesoIds;
    }
    if (tipoIds) {
      conditions.push('td.id IN (:tipoIds)');
      replacements.tipoIds = tipoIds;
    }

    String(req.query.titulo || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .forEach((term, index) => {
        const key = `term${index}`;
        conditions.push(`(d.titulo ILIKE :${key} OR d.codigo ILIKE :${key})`);
        replacements[key] = `%${term}%`;
      });

    const rows = await sequelize.query(
      `
        SELECT DISTINCT
          mp.id AS macro_id,
          mp.nombre AS macro_nombre,
          p.id AS proceso_id,
          p.nombre AS proceso_nombre,
          sp.id AS subproceso_id,
          sp.nombre AS subproceso_nombre,
          td.id AS tipo_id,
          td.nombre AS tipo_nombre
        FROM documentos d
        JOIN subprocesos sp ON sp.id = d.subproceso_id
        JOIN procesos p ON p.id = sp.proceso_id
        JOIN macro_procesos mp ON mp.id = p.macro_proceso_id
        JOIN tipos_documentacion td ON td.id = d.tipo_documentacion_id
        WHERE ${conditions.join(' AND ')}
      `,
      { replacements, type: QueryTypes.SELECT }
    );

    const sortByName = (a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
    const collectFacet = (facet) => {
      const map = new Map();
      rows.forEach((row) => {
        if (facet === 'macro' && row.macro_id) map.set(String(row.macro_id), { id: row.macro_id, nombre: row.macro_nombre });
        if (facet === 'proceso' && row.proceso_id) map.set(String(row.proceso_id), { id: row.proceso_id, nombre: row.proceso_nombre, macro_proceso_id: row.macro_id });
        if (facet === 'subproceso' && row.subproceso_id) map.set(String(row.subproceso_id), { id: row.subproceso_id, nombre: row.subproceso_nombre, proceso_id: row.proceso_id });
        if (facet === 'tipo' && row.tipo_id) map.set(String(row.tipo_id), { id: row.tipo_id, nombre: row.tipo_nombre });
      });
      return Array.from(map.values()).sort(sortByName);
    };

    res.json({
      success: true,
      data: {
        macroProcesos: collectFacet('macro'),
        procesos: collectFacet('proceso'),
        subprocesos: collectFacet('subproceso'),
        tipos: collectFacet('tipo')
      }
    });
  } catch (error) {
    console.error('Error al cargar opciones de filtros:', error);
    res.status(500).json({ success: false, message: 'Error' });
  }
};
module.exports = { getMacroProcesos, getProcesos, getSubProcesos, getTiposDocumentacion, getFilterOptions };
