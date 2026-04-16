const { MacroProceso, Proceso, SubProceso, TipoDocumentacion, Documento } = require('../models');
const { Op, literal } = require('sequelize');
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
const documentStateWhere = (query = {}, user = {}) =>
  isInactiveScope(query, user)
    ? { [Op.or]: [{ estado: { [Op.ne]: PUBLIC_DOCUMENT_STATE } }, { estado: null }] }
    : { estado: PUBLIC_DOCUMENT_STATE };

const parseIdList = (value) => {
  const ids = String(value || '')
    .split(',')
    .map((item) => Number(item))
    .filter(Number.isFinite);
  return ids.length ? ids : null;
};

const toInOrEq = (ids) => (ids.length === 1 ? ids[0] : { [Op.in]: ids });

const buildSearchWhere = (search = '') => {
  const terms = String(search).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return null;
  return {
    [Op.and]: terms.map((term) => ({
      [Op.or]: [
        { titulo: { [Op.iLike]: `%${term}%` } },
        { codigo: { [Op.iLike]: `%${term}%` } }
      ]
    }))
  };
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
    const filters = {
      macroIds: parseIdList(req.query.macro_proceso_id),
      procesoIds: parseIdList(req.query.proceso_id),
      subprocesoIds: parseIdList(req.query.subproceso_id),
      tipoIds: parseIdList(req.query.tipo_documentacion_id),
      titulo: req.query.titulo,
      estadoWhere: documentStateWhere(req.query, req.user)
    };

    const fetchDocumentsForFacet = async () => {
      const documentoWhere = { ...filters.estadoWhere };
      if (filters.tipoIds) {
        documentoWhere.tipo_documentacion_id = toInOrEq(filters.tipoIds);
      }
      if (filters.titulo) {
        const searchWhere = buildSearchWhere(filters.titulo);
        if (searchWhere) Object.assign(documentoWhere, searchWhere);
      }

      const macroWhere = filters.macroIds
        ? { id: toInOrEq(filters.macroIds) }
        : {};
      const procesoWhere = filters.procesoIds
        ? { id: toInOrEq(filters.procesoIds) }
        : {};
      const subWhere = filters.subprocesoIds
        ? { id: toInOrEq(filters.subprocesoIds) }
        : {};

      // TipoDocumentacion: LEFT JOIN (no requerido) para no excluir documentos
      // sin tipo al calcular facetas de macro/proceso/subproceso.
      // Solo los documentos con tipo válido contribuyen a la faceta 'tipo'.
      const tipoRequired = Boolean(filters.tipoIds);

      return Documento.findAll({
        where: documentoWhere,
        attributes: ['id'],
        include: [
          {
            model: TipoDocumentacion,
            as: 'tipoDocumentacion',
            required: tipoRequired,
            attributes: ['id', 'nombre']
          },
          {
            model: SubProceso,
            as: 'subproceso',
            required: true,
            attributes: ['id', 'nombre', 'proceso_id'],
            where: subWhere,
            include: [
              {
                model: Proceso,
                as: 'proceso',
                required: true,
                attributes: ['id', 'nombre', 'macro_proceso_id'],
                where: procesoWhere,
                include: [
                  {
                    model: MacroProceso,
                    as: 'macroProceso',
                    required: true,
                    attributes: ['id', 'nombre'],
                    where: macroWhere
                  }
                ]
              }
            ]
          }
        ]
      });
    };

    const toPlain = (value) => (typeof value?.toJSON === 'function' ? value.toJSON() : value);
    const sortByName = (a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''));
    const collectFacet = (documents, facet) => {
      const map = new Map();
      documents.forEach((doc) => {
        const macro = toPlain(doc?.subproceso?.proceso?.macroProceso);
        const proceso = toPlain(doc?.subproceso?.proceso);
        const subproceso = toPlain(doc?.subproceso);
        const tipo = toPlain(doc?.tipoDocumentacion);

        if (facet === 'macro' && macro?.id) map.set(String(macro.id), macro);
        if (facet === 'proceso' && proceso?.id) map.set(String(proceso.id), proceso);
        if (facet === 'subproceso' && subproceso?.id) map.set(String(subproceso.id), subproceso);
        if (facet === 'tipo' && tipo?.id) map.set(String(tipo.id), tipo);
      });
      return Array.from(map.values()).sort(sortByName);
    };

    const filteredDocs = await fetchDocumentsForFacet();

    res.json({
      success: true,
      data: {
        macroProcesos: collectFacet(filteredDocs, 'macro'),
        procesos: collectFacet(filteredDocs, 'proceso'),
        subprocesos: collectFacet(filteredDocs, 'subproceso'),
        tipos: collectFacet(filteredDocs, 'tipo')
      }
    });
  } catch (error) {
    console.error('Error al cargar opciones de filtros:', error);
    res.status(500).json({ success: false, message: 'Error' });
  }
};

module.exports = { getMacroProcesos, getProcesos, getSubProcesos, getTiposDocumentacion, getFilterOptions };
