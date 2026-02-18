const { MacroProceso, Proceso, SubProceso, TipoDocumentacion } = require('../models');

const getMacroProcesos = async (req, res) => {
  try {
    const macroProcesos = await MacroProceso.findAll({ order: [['nombre', 'ASC']] });
    res.json({ success: true, data: { macroProcesos } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const getProcesos = async (req, res) => {
  try {
    const { macro_proceso_id } = req.query;
    const where = macro_proceso_id ? { macro_proceso_id } : {};
    const procesos = await Proceso.findAll({ where, order: [['nombre', 'ASC']] });
    res.json({ success: true, data: { procesos } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const getSubProcesos = async (req, res) => {
  try {
    const { proceso_id } = req.query;
    const where = proceso_id ? { proceso_id } : {};
    const subprocesos = await SubProceso.findAll({ where, order: [['nombre', 'ASC']] });
    res.json({ success: true, data: { subprocesos } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const getTiposDocumentacion = async (req, res) => {
  try {
    const tipos = await TipoDocumentacion.findAll({ order: [['nombre', 'ASC']] });
    res.json({ success: true, data: { tipos } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

module.exports = { getMacroProcesos, getProcesos, getSubProcesos, getTiposDocumentacion };