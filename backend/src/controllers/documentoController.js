const { Op, col, fn, literal, where: sequelizeWhere } = require('sequelize');
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
const isInactiveScope = (query = {}, user = {}) =>
  String(query.estado_scope || '').toLowerCase() === 'inactive'
  && String(query.include_inactive || '').toLowerCase() === 'true'
  && canViewAllDocumentStates(user);

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
  if (data.tipo_documento) {
    data.tipoDocumentacion = {
      ...(data.tipoDocumentacion || {}),
      nombre: data.tipo_documento
    };
  }
  if (data.subproceso_texto || data.proceso_texto || data.macroproceso) {
    data.subproceso = {
      ...(typeof data.subproceso === 'object' ? data.subproceso : {}),
      nombre: data.subproceso_texto || data.subproceso?.nombre,
      proceso: {
        ...((typeof data.subproceso === 'object' && data.subproceso?.proceso) || {}),
        nombre: data.proceso_texto || data.subproceso?.proceso?.nombre,
        macroProceso: {
          ...((typeof data.subproceso === 'object' && data.subproceso?.proceso?.macroProceso) || {}),
          nombre: data.macroproceso || data.subproceso?.proceso?.macroProceso?.nombre
        }
      }
    };
  }
  return data;
};

const getPeriodoFromDate = (value) => {
  if (!value) return null;
  const raw = String(value || '').trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const year = isoMatch ? Number(isoMatch[1]) : new Date(value).getFullYear();
  const month = isoMatch ? Number(isoMatch[2]) : new Date(value).getMonth() + 1;
  if (!year || !month || Number.isNaN(year) || Number.isNaN(month)) return null;
  // Periodos academicos institucionales: enero-junio = I, julio-diciembre = II.
  const semester = month <= 6 ? 'I' : 'II';
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

const normalizeStatFilterValue = (value = '') => String(value || '').trim().toLowerCase();

const matchesStatFilter = (row, key, value) => {
  const needle = normalizeStatFilterValue(value);
  if (!needle) return true;
  const candidates = {
    macro: [row.macroId, row.macroNombre],
    proceso: [row.procesoId, row.procesoNombre],
    subproceso: [row.subprocesoId, row.subprocesoNombre],
    tipo: [row.tipoId, row.tipoNombre],
    periodo: [row.periodo]
  }[key] || [];
  return candidates.some((candidate) => normalizeStatFilterValue(candidate) === needle);
};

const countStatOptions = (rows, { idKey, nameKey, valueKey = nameKey, labelKey = nameKey }) => {
  const map = new Map();
  rows.forEach((row) => {
    const label = String(row[labelKey] || '').trim();
    const value = String(row[valueKey] || label).trim();
    if (!label || !value) return;
    const id = row[idKey] || value;
    const key = `${id}::${value}`;
    const current = map.get(key) || { id, value, label, cantidad: 0 };
    current.cantidad += 1;
    map.set(key, current);
  });
  return Array.from(map.values()).sort((a, b) => b.cantidad - a.cantidad || String(a.label).localeCompare(String(b.label), 'es'));
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
      estado_scope,
      sort,
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

    const parseTextList = (val) => String(val || '').split(',').map((item) => item.trim()).filter(Boolean);
    const andConditions = [];
    const addTrimmedTextFilter = (column, values) => {
      if (!values.length) return;
      andConditions.push(sequelizeWhere(
        fn('TRIM', col(`documentos.${column}`)),
        values.length === 1 ? values[0] : { [Op.in]: values }
      ));
    };

    const macroValues = parseTextList(macro_proceso_id);
    const procesoValues = parseTextList(proceso_id);
    const subprocesoValues = parseTextList(subproceso_id);
    const tipoValues = parseTextList(tipo_documentacion_id);

    addTrimmedTextFilter('macroproceso', macroValues);
    addTrimmedTextFilter('proceso', procesoValues);
    addTrimmedTextFilter('subproceso', subprocesoValues);
    addTrimmedTextFilter('tipo_documento', tipoValues);

    if (titulo) {
      const searchWhere = buildSearchWhere(titulo);
      if (searchWhere?.[Op.and]) andConditions.push(...searchWhere[Op.and]);
    }

    if (andConditions.length) where[Op.and] = andConditions;

    if (isInactiveScope({ include_inactive, estado_scope }, req.user)) {
      where[Op.or] = [
        { estado: { [Op.ne]: PUBLIC_DOCUMENT_STATE } },
        { estado: null }
      ];
    } else {
      where.estado = PUBLIC_DOCUMENT_STATE;
    }

    const { count, rows } = await Documento.findAndCountAll({
      where,
      include,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [
        literal('fecha_creacion DESC NULLS LAST'),
        literal('orden_origen ASC NULLS LAST'),
        ['id', 'ASC']
      ],
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
    const {
      macro_proceso_id,
      proceso,
      proceso_id,
      subproceso,
      subproceso_id,
      tipo_documentacion_id,
      periodo
    } = req.query;
    const normalizedPeriodo = normalizePeriodoFilter(periodo);
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

    const docs = await Documento.findAll({
      where: { estado: PUBLIC_DOCUMENT_STATE },
      include,
      attributes: [
        'id',
        'fecha_creacion',
        'created_at',
        'estado',
        'macroproceso',
        'proceso_texto',
        'subproceso_texto',
        'tipo_documento',
        'tipo_documentacion_id',
        'subproceso_id'
      ],
      order: [
        [literal('fecha_creacion DESC NULLS LAST')],
        ['created_at', 'DESC']
      ]
    });

    const baseRows = docs.map((doc) => {
      const periodoValue = getPeriodoFromDate(doc.fecha_creacion || doc.created_at);
      const subprocesoModel = doc.subproceso || null;
      const procesoModel = subprocesoModel?.proceso || null;
      const macroModel = procesoModel?.macroProceso || null;
      return {
        id: doc.id,
        periodo: periodoValue,
        tipoId: doc.tipoDocumentacion?.id || doc.tipo_documentacion_id || null,
        tipoNombre: String(doc.tipo_documento || doc.tipoDocumentacion?.nombre || 'SIN TIPO').trim(),
        macroId: macroModel?.id || null,
        macroNombre: String(doc.macroproceso || macroModel?.nombre || 'SIN MACROPROCESO').trim(),
        procesoId: procesoModel?.id || null,
        procesoNombre: String(doc.proceso_texto || procesoModel?.nombre || 'SIN PROCESO').trim(),
        subprocesoId: subprocesoModel?.id || doc.subproceso_id || null,
        subprocesoNombre: String(doc.subproceso_texto || subprocesoModel?.nombre || 'SIN SUBPROCESO').trim()
      };
    });

    const currentFilters = {
      macro: macro_proceso_id,
      proceso: proceso_id || proceso,
      subproceso: subproceso_id || subproceso,
      tipo: tipo_documentacion_id,
      periodo: normalizedPeriodo
    };

    const applyStatFilters = (rows, excludeKey = '') =>
      rows.filter((row) =>
        Object.entries(currentFilters).every(([key, value]) =>
          key === excludeKey ? true : matchesStatFilter(row, key, value)
        )
      );

    const rowsForDashboard = applyStatFilters(baseRows);

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

    const periodosCruzadosMap = applyStatFilters(baseRows, 'periodo').reduce((acc, row) => {
      if (!row.periodo) return acc;
      acc[row.periodo] = (acc[row.periodo] || 0) + 1;
      return acc;
    }, {});

    const periodosCruzados = Object.entries(periodosCruzadosMap)
      .sort(([a], [b]) => b.localeCompare(a, 'es'))
      .map(([value, cantidad]) => ({
        value,
        label: formatPeriodoLabel(value),
        cantidad
      }));

    const byTipoMap = rowsForDashboard.reduce((acc, row) => {
      const key = `${row.tipoId || 'na'}::${row.tipoNombre}`;
      if (!acc[key]) {
        acc[key] = { tipo_documentacion_id: row.tipoId, tipo_documento: row.tipoNombre, cantidad: 0 };
      }
      acc[key].cantidad += 1;
      return acc;
    }, {});

    const byMacroMap = rowsForDashboard.reduce((acc, row) => {
      const key = `${row.macroId || 'na'}::${row.macroNombre}`;
      if (!acc[key]) {
        acc[key] = { macro_proceso_id: row.macroId, macro_proceso: row.macroNombre, cantidad: 0 };
      }
      acc[key].cantidad += 1;
      return acc;
    }, {});

    const byProcesoMap = rowsForDashboard.reduce((acc, row) => {
      const key = `${row.procesoId || 'na'}::${row.procesoNombre}`;
      if (!acc[key]) {
        acc[key] = { proceso_id: row.procesoId, proceso: row.procesoNombre, cantidad: 0 };
      }
      acc[key].cantidad += 1;
      return acc;
    }, {});

    const bySubprocesoMap = rowsForDashboard.reduce((acc, row) => {
      const key = `${row.subprocesoId || 'na'}::${row.subprocesoNombre}`;
      if (!acc[key]) {
        acc[key] = { subproceso_id: row.subprocesoId, subproceso: row.subprocesoNombre, cantidad: 0 };
      }
      acc[key].cantidad += 1;
      return acc;
    }, {});

    const byTipo = Object.values(byTipoMap).sort((a, b) => b.cantidad - a.cantidad);
    const byMacroProceso = Object.values(byMacroMap).sort((a, b) => b.cantidad - a.cantidad);
    const byProceso = Object.values(byProcesoMap).sort((a, b) => b.cantidad - a.cantidad);
    const bySubproceso = Object.values(bySubprocesoMap).sort((a, b) => b.cantidad - a.cantidad);

    return res.json({
      success: true,
      data: {
        filtrosAplicados: {
          macro_proceso_id: macro_proceso_id || '',
          proceso: proceso_id || proceso || '',
          subproceso: subproceso_id || subproceso || '',
          tipo_documentacion_id: tipo_documentacion_id || '',
          periodo: normalizedPeriodo || ''
        },
        periodosDisponibles,
        filtrosDisponibles: {
          macroProcesos: countStatOptions(applyStatFilters(baseRows, 'macro'), {
            idKey: 'macroId',
            nameKey: 'macroNombre'
          }),
          procesos: countStatOptions(applyStatFilters(baseRows, 'proceso'), {
            idKey: 'procesoId',
            nameKey: 'procesoNombre'
          }),
          subprocesos: countStatOptions(applyStatFilters(baseRows, 'subproceso'), {
            idKey: 'subprocesoId',
            nameKey: 'subprocesoNombre'
          }),
          tiposDocumentacion: countStatOptions(applyStatFilters(baseRows, 'tipo'), {
            idKey: 'tipoId',
            nameKey: 'tipoNombre'
          }),
          periodos: periodosCruzados
        },
        resumen: {
          totalDocumentos: rowsForDashboard.length,
          totalTipos: byTipo.length,
          totalMacroProcesos: byMacroProceso.length,
          totalProcesos: byProceso.length,
          totalSubprocesos: bySubproceso.length,
          periodoSeleccionado: normalizedPeriodo ? formatPeriodoLabel(normalizedPeriodo) : 'Todos',
          tipoMasFrecuente: byTipo[0] || null,
          macroMasFrecuente: byMacroProceso[0] || null,
          procesoMasFrecuente: byProceso[0] || null,
          subprocesoMasFrecuente: bySubproceso[0] || null
        },
        distribucion: {
          porTipoDocumento: byTipo,
          porMacroProceso: byMacroProceso,
          porProceso: byProceso,
          porSubproceso: bySubproceso
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
