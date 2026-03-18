const { MacroProceso, Proceso, SubProceso, TipoDocumentacion, Documento } = require('../models');
const { Op } = require('sequelize');

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
      include: [{
        model: Proceso,
        as: 'procesos',
        attributes: [],
        required: true,
        include: [{
          model: SubProceso,
          as: 'subprocesos',
          attributes: [],
          required: true,
          include: [{
            model: Documento,
            as: 'documentos',
            attributes: [],
            required: true
          }]
        }]
      }],
      order: [['nombre', 'ASC']],
      distinct: true
    });
    res.json({ success: true, data: { macroProcesos } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const getProcesos = async (req, res) => {
  try {
    const { macro_proceso_id } = req.query;
    const where = macro_proceso_id ? { macro_proceso_id } : {};
    const procesos = await Proceso.findAll({
      where,
      include: [{
        model: SubProceso,
        as: 'subprocesos',
        attributes: [],
        required: true,
        include: [{
          model: Documento,
          as: 'documentos',
          attributes: [],
          required: true
        }]
      }],
      order: [['nombre', 'ASC']],
      distinct: true
    });
    res.json({ success: true, data: { procesos } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const getSubProcesos = async (req, res) => {
  try {
    const { proceso_id } = req.query;
    const where = proceso_id ? { proceso_id } : {};
    const subprocesos = await SubProceso.findAll({
      where,
      include: [{
        model: Documento,
        as: 'documentos',
        attributes: [],
        required: true
      }],
      order: [['nombre', 'ASC']],
      distinct: true
    });
    res.json({ success: true, data: { subprocesos } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const getTiposDocumentacion = async (req, res) => {
  try {
    const tipos = await TipoDocumentacion.findAll({
      include: [{
        model: Documento,
        as: 'documentos',
        attributes: [],
        required: true
      }],
      order: [['nombre', 'ASC']],
      distinct: true
    });
    res.json({ success: true, data: { tipos } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const getFilterOptions = async (req, res) => {
  try {
    const { macro_proceso_id, proceso_id, subproceso_id, tipo_documentacion_id, titulo } = req.query;

    const documentoWhere = {};
    if (tipo_documentacion_id) documentoWhere.tipo_documentacion_id = tipo_documentacion_id;
    if (titulo) {
      const searchWhere = buildSearchWhere(titulo);
      if (searchWhere) Object.assign(documentoWhere, searchWhere);
    }

    const macroWhere = macro_proceso_id ? { id: macro_proceso_id } : {};
    const procesoWhere = proceso_id ? { id: proceso_id } : {};
    const subWhere = subproceso_id ? { id: subproceso_id } : {};

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
