const { Documento, SubProceso, Proceso, MacroProceso, TipoDocumentacion } = require('../models');
const { Op } = require('sequelize');

const getDocumentos = async (req, res) => {
  try {
    const { macro_proceso_id, proceso_id, subproceso_id, tipo_documentacion_id, titulo, estado, page = 1, limit = 10 } = req.query;
    
    const hasFilters = macro_proceso_id || proceso_id || subproceso_id || tipo_documentacion_id || titulo || estado;
    
    if (!hasFilters) {
      return res.json({
        success: true,
        message: 'Por favor aplique al menos un filtro',
        data: { documentos: [], pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 } }
      });
    }
    
    const offset = (page - 1) * limit;
    const where = {};
    const include = [
      {
        model: SubProceso, as: 'subproceso',
        include: [{ model: Proceso, as: 'proceso', include: [{ model: MacroProceso, as: 'macroProceso' }] }]
      },
      { model: TipoDocumentacion, as: 'tipoDocumentacion' }
    ];
    
    if (subproceso_id) where.subproceso_id = subproceso_id;
    if (tipo_documentacion_id) where.tipo_documentacion_id = tipo_documentacion_id;
    if (titulo) where.titulo = { [Op.iLike]: `%${titulo}%` };
    if (estado) where.estado = estado;
    if (proceso_id && !subproceso_id) { include[0].where = { proceso_id }; include[0].required = true; }
    if (macro_proceso_id && !proceso_id) {
      include[0].include[0].where = { macro_proceso_id };
      include[0].include[0].required = true;
      include[0].required = true;
    }
    
    const { count, rows } = await Documento.findAndCountAll({
      where, include, limit: parseInt(limit), offset, order: [['created_at', 'DESC']], distinct: true
    });
    
    res.json({
      success: true,
      data: { documentos: rows, pagination: { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / limit) } }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al listar documentos' });
  }
};

module.exports = { getDocumentos };