const { MacroProceso, Proceso, SubProceso, TipoDocumentacion, Documento } = require('../models');
const { Op, literal } = require('sequelize');

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
    const macroProcesos = await MacroProceso.findAll({
      where: literal(`EXISTS (
        SELECT 1 FROM procesos p
        JOIN subprocesos sp ON sp.proceso_id = p.id
        JOIN documentos d ON d.subproceso_id = sp.id
        WHERE p.macro_proceso_id = "macro_procesos"."id"
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
    const { macro_proceso_id, proceso_id, subproceso_id, tipo_documentacion_id, titulo, estado } = req.query;
    const macroIds = parseIdList(macro_proceso_id);
    const procesoIds = parseIdList(proceso_id);
    const subprocesoIds = parseIdList(subproceso_id);
    const tipoIds = parseIdList(tipo_documentacion_id);

    const documentoWhere = {};
    if (tipoIds) documentoWhere.tipo_documentacion_id = toInOrEq(tipoIds);
    if (estado) documentoWhere.estado = estado;
    if (titulo) {
      const searchWhere = buildSearchWhere(titulo);
      if (searchWhere) Object.assign(documentoWhere, searchWhere);
    }

    const macroWhere = macroIds ? { id: toInOrEq(macroIds) } : {};
    const procesoWhere = procesoIds ? { id: toInOrEq(procesoIds) } : {};
    const subWhere = subprocesoIds ? { id: toInOrEq(subprocesoIds) } : {};

    const documentos = await Documento.findAll({
      where: documentoWhere,
      attributes: ['id'],
      include: [
        {
          model: TipoDocumentacion,
          as: 'tipoDocumentacion',
          required: true,
          attributes: ['id', 'nombre']
        },
        {
          model: SubProceso,
          as: 'subproceso',
          required: true,
          attributes: ['id', 'nombre'],
          where: subWhere,
          include: [
            {
              model: Proceso,
              as: 'proceso',
              required: true,
              attributes: ['id', 'nombre'],
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

    const macroMap = new Map();
    const procesoMap = new Map();
    const subMap = new Map();
    const tipoMap = new Map();

    documentos.forEach((doc) => {
      const macro = doc?.subproceso?.proceso?.macroProceso;
      const proceso = doc?.subproceso?.proceso;
      const sub = doc?.subproceso;
      const tipo = doc?.tipoDocumentacion;

      if (macro) macroMap.set(String(macro.id), macro);
      if (proceso) procesoMap.set(String(proceso.id), proceso);
      if (sub) subMap.set(String(sub.id), sub);
      if (tipo) tipoMap.set(String(tipo.id), tipo);
    });

    const macroProcesos = Array.from(macroMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
    const procesos = Array.from(procesoMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
    const subprocesos = Array.from(subMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
    const tipos = Array.from(tipoMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));

    res.json({
      success: true,
      data: {
        macroProcesos,
        procesos,
        subprocesos,
        tipos
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

module.exports = { getMacroProcesos, getProcesos, getSubProcesos, getTiposDocumentacion, getFilterOptions };
