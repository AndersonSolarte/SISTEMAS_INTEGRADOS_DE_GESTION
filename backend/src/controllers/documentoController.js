const { Op } = require('sequelize');
const {
  Documento,
  SubProceso,
  Proceso,
  MacroProceso,
  TipoDocumentacion
} = require('../models');

const getPeriodoFromDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const semester = date.getMonth() < 6 ? 'I' : 'II';
  return `${year}-${semester}`;
};

const formatPeriodoLabel = (periodo = '') => {
  const [year, semester] = String(periodo || '').split('-');
  if (!year || !semester) return '';
  return `${year} ${semester}`;
};

const normalizePeriodoFilter = (value = '') => {
  const match = String(value || '').trim().toUpperCase().match(/^(\d{4})\s*[- ]?\s*(I|II)$/);
  if (!match) return '';
  return `${match[1]}-${match[2]}`;
};

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

const getDocumentos = async (req, res) => {
  try {
    const {
      macro_proceso_id,
      proceso_id,
      subproceso_id,
      tipo_documentacion_id,
      titulo,
      estado,
      page = 1,
      limit = 10
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};
    const include = [
      {
        model: SubProceso,
        as: 'subproceso',
        attributes: ['id', 'nombre'],
        include: [
          {
            model: Proceso,
            as: 'proceso',
            attributes: ['id', 'nombre'],
            include: [
              {
                model: MacroProceso,
                as: 'macroProceso',
                attributes: ['id', 'nombre']
              }
            ]
          }
        ]
      },
      {
        model: TipoDocumentacion,
        as: 'tipoDocumentacion',
        attributes: ['id', 'nombre']
      }
    ];

    // Aplicar filtros solo si existen
    if (subproceso_id) {
      where.subproceso_id = subproceso_id;
    }

    if (tipo_documentacion_id) {
      where.tipo_documentacion_id = tipo_documentacion_id;
    }

    if (titulo) {
      const searchWhere = buildSearchWhere(titulo);
      if (searchWhere) Object.assign(where, searchWhere);
    }

    if (estado) {
      where.estado = estado;
    }

    if (proceso_id && !subproceso_id) {
      include[0].where = { proceso_id };
      include[0].required = true;
    }

    if (macro_proceso_id && !proceso_id && !subproceso_id) {
      include[0].include[0].where = { macro_proceso_id };
      include[0].include[0].required = true;
      include[0].required = true;
    }

    const { count, rows } = await Documento.findAndCountAll({
      where,
      include,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
      distinct: true
    });

    res.json({
      success: true,
      data: {
        documentos: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error al listar documentos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar documentos'
    });
  }
};

const getEstadisticaDocumental = async (req, res) => {
  try {
    const { macro_proceso_id, tipo_documentacion_id, periodo } = req.query;
    const normalizedPeriodo = normalizePeriodoFilter(periodo);
    const where = {};
    const include = [
      {
        model: SubProceso,
        as: 'subproceso',
        attributes: ['id', 'nombre'],
        include: [
          {
            model: Proceso,
            as: 'proceso',
            attributes: ['id', 'nombre'],
            include: [
              {
                model: MacroProceso,
                as: 'macroProceso',
                attributes: ['id', 'nombre']
              }
            ]
          }
        ]
      },
      {
        model: TipoDocumentacion,
        as: 'tipoDocumentacion',
        attributes: ['id', 'nombre']
      }
    ];

    if (tipo_documentacion_id) {
      where.tipo_documentacion_id = tipo_documentacion_id;
    }

    if (macro_proceso_id) {
      include[0].include[0].where = { macro_proceso_id };
      include[0].include[0].required = true;
      include[0].required = true;
    }

    const docs = await Documento.findAll({
      where,
      include,
      attributes: ['id', 'fecha_creacion', 'created_at'],
      order: [['created_at', 'DESC']]
    });

    const baseRows = docs.map((doc) => {
      const periodoValue = getPeriodoFromDate(doc.fecha_creacion || doc.created_at);
      return {
        id: doc.id,
        periodo: periodoValue,
        tipoId: doc.tipoDocumentacion?.id || null,
        tipoNombre: String(doc.tipoDocumentacion?.nombre || 'SIN TIPO'),
        macroId: doc.subproceso?.proceso?.macroProceso?.id || null,
        macroNombre: String(doc.subproceso?.proceso?.macroProceso?.nombre || 'SIN MACROPROCESO')
      };
    });

    const periodosMap = baseRows.reduce((acc, row) => {
      if (!row.periodo) return acc;
      acc[row.periodo] = (acc[row.periodo] || 0) + 1;
      return acc;
    }, {});

    const periodosDisponibles = Object.entries(periodosMap)
      .sort(([a], [b]) => b.localeCompare(a, 'es'))
      .map(([value, cantidad]) => ({
        value,
        label: formatPeriodoLabel(value),
        cantidad
      }));

    const filteredRows = normalizedPeriodo
      ? baseRows.filter((row) => row.periodo === normalizedPeriodo)
      : baseRows;

    const byTipoMap = filteredRows.reduce((acc, row) => {
      const key = `${row.tipoId || 'na'}::${row.tipoNombre}`;
      if (!acc[key]) {
        acc[key] = { tipo_documentacion_id: row.tipoId, tipo_documento: row.tipoNombre, cantidad: 0 };
      }
      acc[key].cantidad += 1;
      return acc;
    }, {});

    const byMacroMap = filteredRows.reduce((acc, row) => {
      const key = `${row.macroId || 'na'}::${row.macroNombre}`;
      if (!acc[key]) {
        acc[key] = { macro_proceso_id: row.macroId, macro_proceso: row.macroNombre, cantidad: 0 };
      }
      acc[key].cantidad += 1;
      return acc;
    }, {});

    const byTipo = Object.values(byTipoMap).sort((a, b) => b.cantidad - a.cantidad);
    const byMacroProceso = Object.values(byMacroMap).sort((a, b) => b.cantidad - a.cantidad);

    return res.json({
      success: true,
      data: {
        filtrosAplicados: {
          macro_proceso_id: macro_proceso_id || '',
          tipo_documentacion_id: tipo_documentacion_id || '',
          periodo: normalizedPeriodo || ''
        },
        periodosDisponibles,
        resumen: {
          totalDocumentos: filteredRows.length,
          totalTipos: byTipo.length,
          totalMacroProcesos: byMacroProceso.length,
          periodoSeleccionado: normalizedPeriodo ? formatPeriodoLabel(normalizedPeriodo) : 'Todos',
          tipoMasFrecuente: byTipo[0] || null,
          macroMasFrecuente: byMacroProceso[0] || null
        },
        distribucion: {
          porTipoDocumento: byTipo,
          porMacroProceso: byMacroProceso
        }
      }
    });
  } catch (error) {
    console.error('Error al obtener estadística documental:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener estadística documental'
    });
  }
};

module.exports = { getDocumentos, getEstadisticaDocumental };
