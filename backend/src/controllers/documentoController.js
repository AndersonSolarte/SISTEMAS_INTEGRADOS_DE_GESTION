const { Op, literal } = require('sequelize');
const path = require('path');
const fs = require('fs');
const {
  Documento,
  SubProceso,
  Proceso,
  MacroProceso,
  TipoDocumentacion
} = require('../models');
const { ROLES } = require('../constants/roles');
const { encryptPayload, decryptPayload } = require('../utils/secureUrlToken');

const LOCAL_UPLOAD_PREFIX = '/uploads/';
const PUBLIC_DOCUMENT_STATE = 'vigente';
const canViewAllDocumentStates = (user = {}) =>
  [ROLES.ADMINISTRADOR, ROLES.GESTION_PROCESOS].includes(user.role);

const isLocalUploadLink = (value = '') => String(value || '').trim().startsWith(LOCAL_UPLOAD_PREFIX);

const getSignedDocumentUrl = (req, documento) => {
  const link = String(documento?.link_acceso || '').trim();
  if (!isLocalUploadLink(link)) return link;

  const ttlSeconds = Number(process.env.DOCUMENT_URL_TTL_SECONDS || 600);
  const token = encryptPayload({
    purpose: 'document_file',
    documentoId: documento.id
  }, ttlSeconds);

  return `/api/documentos/archivo/${encodeURIComponent(token)}`;
};

const serializeDocumento = (req, documento) => {
  if (!documento) return documento;
  const data = typeof documento.toJSON === 'function' ? documento.toJSON() : { ...documento };
  if (isLocalUploadLink(data.link_acceso)) {
    data.link_acceso = getSignedDocumentUrl(req, data);
    data.url_segura = true;
  }
  return data;
};

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

const toInOrEq = (ids) => (ids.length === 1 ? ids[0] : { [Op.in]: ids });

const resolveSubprocesoIds = async ({ subIds, procIds, macroIds }) => {
  if (!subIds && !procIds && !macroIds) return null;

  const where = {};
  const include = [];

  if (subIds) where.id = toInOrEq(subIds);
  if (procIds) where.proceso_id = toInOrEq(procIds);
  if (macroIds) {
    include.push({
      model: Proceso,
      as: 'proceso',
      required: true,
      attributes: [],
      where: { macro_proceso_id: toInOrEq(macroIds) }
    });
  }

  const rows = await SubProceso.findAll({
    where,
    include,
    attributes: ['id'],
    raw: true
  });

  return rows.map((row) => Number(row.id)).filter(Number.isFinite);
};

const getDocumentos = async (req, res) => {
  try {
    const {
      macro_proceso_id,
      proceso_id,
      subproceso_id,
      tipo_documentacion_id,
      titulo,
      include_inactive,
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

    // Parsea IDs separados por coma → array de enteros
    const parseIds = (val) => {
      if (!val) return null;
      const ids = String(val).split(',').map(Number).filter(Number.isFinite);
      return ids.length ? ids : null;
    };

    const subIds   = parseIds(subproceso_id);
    const tipoIds  = parseIds(tipo_documentacion_id);
    const procIds  = parseIds(proceso_id);
    const macroIds = parseIds(macro_proceso_id);

    if (tipoIds) where.tipo_documentacion_id = toInOrEq(tipoIds);

    const resolvedSubprocesoIds = await resolveSubprocesoIds({ subIds, procIds, macroIds });
    if (Array.isArray(resolvedSubprocesoIds)) {
      if (resolvedSubprocesoIds.length === 0) {
        return res.json({
          success: true,
          data: {
            documentos: [],
            pagination: {
              total: 0,
              page: parseInt(page),
              limit: parseInt(limit),
              totalPages: 0
            }
          }
        });
      }
      where.subproceso_id = toInOrEq(resolvedSubprocesoIds);
    }

    if (titulo) {
      const searchWhere = buildSearchWhere(titulo);
      if (searchWhere) Object.assign(where, searchWhere);
    }

    const includeInactive = String(include_inactive || '').toLowerCase() === 'true';
    if (!includeInactive || !canViewAllDocumentStates(req.user)) {
      where.estado = PUBLIC_DOCUMENT_STATE;
    }

    const { count, rows } = await Documento.findAndCountAll({
      where,
      include,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [literal('fecha_creacion DESC NULLS LAST'), ['created_at', 'DESC']],
      distinct: true
    });

    res.json({
      success: true,
      data: {
        documentos: rows.map((doc) => serializeDocumento(req, doc)),
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

const getDocumentoArchivoSeguro = async (req, res) => {
  try {
    const payload = decryptPayload(req.params.token);
    if (payload?.purpose !== 'document_file' || !payload?.documentoId) {
      return res.status(403).json({ success: false, message: 'Enlace no autorizado' });
    }

    const documento = await Documento.findOne({
      where: { id: payload.documentoId, eliminado: false }
    });

    if (!documento || !isLocalUploadLink(documento.link_acceso)) {
      return res.status(404).json({ success: false, message: 'Documento no encontrado' });
    }

    const uploadsRoot = path.resolve(__dirname, '../../uploads');
    const relativePath = String(documento.link_acceso).replace(/^\/uploads\/?/, '');
    const filePath = path.resolve(uploadsRoot, relativePath);

    if (!filePath.startsWith(`${uploadsRoot}${path.sep}`) || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Archivo no encontrado' });
    }

    const filename = `${documento.codigo || 'documento'}_${documento.titulo || 'archivo'}.pdf`
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');

    if (String(req.query.download || '').toLowerCase() === '1') {
      return res.download(filePath, filename);
    }

    return res.sendFile(filePath, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`
      }
    });
  } catch (_error) {
    return res.status(403).json({ success: false, message: 'Enlace expirado o invalido' });
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

module.exports = { getDocumentos, getEstadisticaDocumental, getDocumentoArchivoSeguro, serializeDocumento };
