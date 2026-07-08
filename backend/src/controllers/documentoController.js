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
const { buildDriveClient } = require('../services/googleDriveEvidenceService');

const LOCAL_UPLOAD_PREFIX = '/uploads/';
const PUBLIC_DOCUMENT_STATE = 'vigente';
const MIME_TYPES_BY_EXTENSION = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};
const canViewAllDocumentStates = (user = {}) =>
  [ROLES.ADMINISTRADOR, ROLES.GESTION_PROCESOS].includes(user.role);
const isInactiveScope = (query = {}, user = {}) =>
  String(query.estado_scope || '').toLowerCase() === 'inactive'
  && String(query.include_inactive || '').toLowerCase() === 'true'
  && canViewAllDocumentStates(user);

const normalizeDocumentScope = (value = '') => {
  const scope = String(value || '').trim().toLowerCase();
  if (['politicas', 'politicas_institucionales', 'políticas', 'politicas-institucionales'].includes(scope)) return 'politicas';
  if (['plantillas', 'plantillas_institucionales', 'plantillas-institucionales'].includes(scope)) return 'plantillas';
  return 'documentos';
};

const documentScopeLiteral = (scope = 'documentos', alias = 'documentos') => {
  const prefix = alias ? `"${alias}".` : '';
  const sheetExpr = `UPPER(COALESCE(${prefix}"datos_originales"->>'hoja', ''))`;

  if (scope === 'politicas') {
    return literal(`(${sheetExpr} = 'POLÍTICAS' OR ${sheetExpr} = 'POLITICAS')`);
  }
  if (scope === 'plantillas') {
    return literal(`${sheetExpr} = 'PLANTILLAS'`);
  }
  return literal(`(${sheetExpr} = '' OR ${sheetExpr} = 'BD_SGD_UNICESMAG' OR ${sheetExpr} = 'DOCUMENTOS')`);
};

const isLocalUploadLink = (value = '') => {
  const val = String(value || '').trim();
  return val.startsWith(LOCAL_UPLOAD_PREFIX) || val.includes('/uploads/');
};

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
    const extension = path.extname(String(data.link_acceso)).replace('.', '').toLowerCase();
    data.archivo_extension = extension || null;
    data.archivo_mime = MIME_TYPES_BY_EXTENSION[extension] || 'application/octet-stream';
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
  // Periodos academicos para estadistica documental: enero-junio = IP, julio-diciembre = IIP.
  const semester = month <= 6 ? 'IP' : 'IIP';
  return `${year}-${semester}`;
};

const formatPeriodoLabel = (periodo = '') => {
  const [year, semester] = String(periodo || '').split('-');
  if (!year || !semester) return '';
  return `${year} ${semester}`;
};

const formatPeriodoSelectionLabel = (value = '') => {
  const labels = normalizeStatFilterValues(value).map(formatPeriodoLabel).filter(Boolean);
  if (!labels.length) return 'Todos';
  return labels.join(', ');
};

const normalizePeriodoFilter = (value = '') => {
  const match = String(value || '').trim().toUpperCase().match(/^(\d{4})\s*[- ]?\s*(IP|IIP|I|II)$/);
  if (!match) return '';
  const semester = match[2] === 'I' ? 'IP' : match[2] === 'II' ? 'IIP' : match[2];
  return `${match[1]}-${semester}`;
};

const normalizeStatFilterValue = (value = '') => String(value || '').trim().toLowerCase();

const normalizeStatFilterValues = (value = '') => {
  const rawValues = Array.isArray(value) ? value : String(value || '').split(',');
  return rawValues
    .map((item) => String(item || '').trim())
    .filter(Boolean);
};

const normalizeStatLabel = (value = '', fallback = 'No clasificado') => {
  const label = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  return label || fallback;
};

const buildStatDistribution = (rows, config = {}) => {
  const {
    idKey,
    nameKey,
    outputIdKey,
    outputNameKey,
    fallback = 'No clasificado'
  } = config;
  const map = new Map();

  rows.forEach((row) => {
    const rawId = row[idKey];
    const id = rawId === undefined || rawId === null || rawId === '' ? null : rawId;
    const label = normalizeStatLabel(row[nameKey], fallback);
    const normalizedLabel = normalizeStatFilterValue(label);
    const key = id ? `id:${id}` : `label:${normalizedLabel}`;
    const current = map.get(key) || {
      [outputIdKey]: id,
      [outputNameKey]: label,
      cantidad: 0
    };
    current.cantidad += 1;
    map.set(key, current);
  });

  const total = rows.length || 0;
  return Array.from(map.values())
    .map((item) => ({
      ...item,
      porcentaje: total > 0 ? Number(((Number(item.cantidad || 0) / total) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) =>
      b.cantidad - a.cantidad
      || String(a[outputNameKey]).localeCompare(String(b[outputNameKey]), 'es', { sensitivity: 'base' })
    );
};

const matchesStatFilter = (row, key, value) => {
  const needles = normalizeStatFilterValues(value).map(normalizeStatFilterValue);
  if (!needles.length) return true;
  const candidates = {
    macro: [row.macroId, row.macroNombre],
    proceso: [row.procesoId, row.procesoNombre],
    subproceso: [row.subprocesoId, row.subprocesoNombre],
    tipo: [row.tipoId, row.tipoNombre],
    periodo: [row.periodo]
  }[key] || [];
  return candidates.some((candidate) => needles.includes(normalizeStatFilterValue(candidate)));
};

const countStatOptions = (rows, { idKey, nameKey, valueKey = nameKey, labelKey = nameKey }) => {
  const map = new Map();
  rows.forEach((row) => {
    const label = normalizeStatLabel(row[labelKey], '');
    const rawValue = row[valueKey];
    const value = String(rawValue === undefined || rawValue === null || rawValue === '' ? label : rawValue).trim();
    if (!label || !value) return;
    const id = row[idKey] || value;
    const key = row[idKey] ? `id:${row[idKey]}` : `value:${normalizeStatFilterValue(value)}`;
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
        { codigo: { [Op.iLike]: `%${term}%` } },
        { autor: { [Op.iLike]: `%${term}%` } },
        { revisa: { [Op.iLike]: `%${term}%` } },
        { aprueba: { [Op.iLike]: `%${term}%` } },
        { macroproceso: { [Op.iLike]: `%${term}%` } },
        { proceso_texto: { [Op.iLike]: `%${term}%` } },
        { subproceso_texto: { [Op.iLike]: `%${term}%` } },
        { tipo_documento: { [Op.iLike]: `%${term}%` } },
        { observaciones: { [Op.iLike]: `%${term}%` } },
        sequelizeWhere(literal(`CAST("documentos"."datos_originales" AS TEXT)`), { [Op.iLike]: `%${term}%` })
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
      periodo,
      titulo,
      include_inactive,
      estado_scope,
      document_scope,
      formatos_digitales,
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

    if (String(formatos_digitales) === 'true') {
      // Arreglo de códigos de formatos digitales habilitados (comenzando por Reporte de Salida)
      const digitalCodes = ['THM-DP-FR-002'];
      andConditions.push({ codigo: { [Op.in]: digitalCodes } });
    }

    const periodoValues = parseTextList(periodo).map(normalizePeriodoFilter).filter(Boolean);
    if (periodoValues.length) {
      const periodoRanges = periodoValues.map((p) => {
        const [year, sem] = p.split('-');
        return sem === 'IP'
          ? { fecha_creacion: { [Op.between]: [`${year}-01-01`, `${year}-06-30`] } }
          : { fecha_creacion: { [Op.between]: [`${year}-07-01`, `${year}-12-31`] } };
      });
      andConditions.push(periodoRanges.length === 1 ? periodoRanges[0] : { [Op.or]: periodoRanges });
    }

    if (andConditions.length) where[Op.and] = andConditions;
    const scopeCondition = documentScopeLiteral(normalizeDocumentScope(document_scope), 'documentos');
    where[Op.and] = [...(where[Op.and] || []), scopeCondition];

    const estadoScopeStr = String(estado_scope || '').toLowerCase().trim();
    if (estadoScopeStr === 'en_revision') {
      where.estado = 'en_revision';
    } else if (estadoScopeStr === 'obsoleto') {
      where.estado = 'obsoleto';
    } else if (isInactiveScope({ include_inactive, estado_scope }, req.user)) {
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
        literal(`CASE WHEN fecha_creacion <= CURRENT_DATE THEN fecha_creacion ELSE NULL END DESC NULLS LAST`),
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

    const extension = path.extname(filePath).replace('.', '').toLowerCase();
    const mimeType = MIME_TYPES_BY_EXTENSION[extension] || 'application/octet-stream';
    const baseFilename = `${documento.codigo || 'documento'}_${documento.titulo || 'archivo'}`
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
    const filename = extension ? `${baseFilename}.${extension}` : baseFilename;

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'private, max-age=300');

    if (String(req.query.download || '').toLowerCase() === '1') {
      return res.download(filePath, filename);
    }

    return res.sendFile(filePath, {
      headers: {
        'Content-Type': mimeType,
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
      periodo,
      document_scope
    } = req.query;
    const normalizedPeriodo = normalizeStatFilterValues(periodo).map(normalizePeriodoFilter).filter(Boolean).join(',');
    const scopeCondition = documentScopeLiteral(normalizeDocumentScope(document_scope), 'documentos');
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
      where: { [Op.and]: [{ estado: PUBLIC_DOCUMENT_STATE }, scopeCondition] },
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
      const periodoValue = getPeriodoFromDate(doc.fecha_creacion);
      const subprocesoModel = doc.subproceso || null;
      const procesoModel = subprocesoModel?.proceso || null;
      const macroModel = procesoModel?.macroProceso || null;
      return {
        id: doc.id,
        periodo: periodoValue,
        tipoId: doc.tipoDocumentacion?.id || doc.tipo_documentacion_id || null,
        tipoNombre: normalizeStatLabel(doc.tipo_documento || doc.tipoDocumentacion?.nombre, 'No clasificado'),
        macroId: macroModel?.id || null,
        macroNombre: normalizeStatLabel(macroModel?.nombre || doc.macroproceso, 'No clasificado'),
        procesoId: procesoModel?.id || null,
        procesoNombre: normalizeStatLabel(procesoModel?.nombre || doc.proceso_texto, 'No clasificado'),
        subprocesoId: subprocesoModel?.id || doc.subproceso_id || null,
        subprocesoNombre: normalizeStatLabel(subprocesoModel?.nombre || doc.subproceso_texto, 'No clasificado')
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

    const byTipo = buildStatDistribution(rowsForDashboard, {
      idKey: 'tipoId',
      nameKey: 'tipoNombre',
      outputIdKey: 'tipo_documentacion_id',
      outputNameKey: 'tipo_documento'
    });
    const byMacroProceso = buildStatDistribution(rowsForDashboard, {
      idKey: 'macroId',
      nameKey: 'macroNombre',
      outputIdKey: 'macro_proceso_id',
      outputNameKey: 'macro_proceso'
    });
    const byProceso = buildStatDistribution(rowsForDashboard, {
      idKey: 'procesoId',
      nameKey: 'procesoNombre',
      outputIdKey: 'proceso_id',
      outputNameKey: 'proceso'
    });
    const bySubproceso = buildStatDistribution(rowsForDashboard, {
      idKey: 'subprocesoId',
      nameKey: 'subprocesoNombre',
      outputIdKey: 'subproceso_id',
      outputNameKey: 'subproceso'
    });

    const totalDocs = rowsForDashboard.length;
    const topTipo = byTipo[0] || null;
    const topMacro = byMacroProceso[0] || null;
    const topProceso = byProceso[0] || null;
    const topSubproceso = bySubproceso[0] || null;
    const avg = (denominator) => totalDocs > 0 && denominator > 0 ? Number((totalDocs / denominator).toFixed(1)) : 0;

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
          totalDocumentos: totalDocs,
          totalTipos: byTipo.length,
          totalMacroProcesos: byMacroProceso.length,
          totalProcesos: byProceso.length,
          totalSubprocesos: bySubproceso.length,
          periodoSeleccionado: formatPeriodoSelectionLabel(normalizedPeriodo),
          tipoMasFrecuente: topTipo,
          macroMasFrecuente: topMacro,
          procesoMasFrecuente: topProceso,
          subprocesoMasFrecuente: topSubproceso,
          promedioPorTipo: avg(byTipo.length),
          promedioPorMacroProceso: avg(byMacroProceso.length),
          promedioPorProceso: avg(byProceso.length),
          promedioPorSubproceso: avg(bySubproceso.length),
          concentracionTipoPrincipal: topTipo?.porcentaje || 0,
          concentracionMacroPrincipal: topMacro?.porcentaje || 0,
          concentracionProcesoPrincipal: topProceso?.porcentaje || 0,
          concentracionSubprocesoPrincipal: topSubproceso?.porcentaje || 0
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

const extractGoogleDriveMeta = (rawUrl) => {
  if (!rawUrl) return null;
  const url = String(rawUrl).trim();
  const patterns = [
    /\/file\/d\/([^/?#]+)/,
    /\/document\/d\/([^/?#]+)/,
    /\/spreadsheets\/d\/([^/?#]+)/,
    /\/presentation\/d\/([^/?#]+)/,
    /[?&]id=([^&#]+)/,
    /\/d\/([^/?#]+)(?:\/|$)/,
  ];
  
  let fileId = null;
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      fileId = match[1];
      break;
    }
  }

  if (!fileId) return null;

  let kind = 'drive-file';
  if (url.includes('docs.google.com')) {
    if (url.includes('/document/')) kind = 'google-doc';
    else if (url.includes('/spreadsheets/')) kind = 'google-sheet';
    else if (url.includes('/presentation/')) kind = 'google-slide';
  }
  
  return { fileId, kind };
};



const descargarDocumentoDirecto = async (req, res) => {
  try {
    const { id } = req.params;
    const documento = await Documento.findOne({
      where: { id, eliminado: false }
    });

    if (!documento) {
      return res.status(404).json({ success: false, message: 'Documento no encontrado' });
    }

    const { link_acceso } = documento;
    if (!link_acceso) {
      return res.status(404).json({ success: false, message: 'El documento no tiene un enlace de acceso' });
    }

    // 1. Si es subida local
    const isLocal = isLocalUploadLink(link_acceso);
    if (isLocal) {
      const uploadsRoot = path.resolve(__dirname, '../../uploads');
      const relativePath = String(link_acceso).replace(/^\/uploads\/?/, '');
      const filePath = path.resolve(uploadsRoot, relativePath);

      if (!filePath.startsWith(`${uploadsRoot}${path.sep}`) || !fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'Archivo local no encontrado' });
      }

      const extension = path.extname(filePath).replace('.', '').toLowerCase();
      const mimeType = MIME_TYPES_BY_EXTENSION[extension] || 'application/octet-stream';
      const baseFilename = `${documento.codigo || 'documento'}_${documento.titulo || 'archivo'}`
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/\s+/g, ' ')
        .trim();
      const filename = extension ? `${baseFilename}.${extension}` : baseFilename;

      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      return res.download(filePath, filename);
    }

    // 2. Si es de Google Drive
    const meta = extractGoogleDriveMeta(link_acceso);
    if (!meta) {
      // Si no es un enlace de Drive ni local, redirige al enlace
      return res.redirect(link_acceso);
    }

    const { fileId, kind } = meta;
    const drive = buildDriveClient();

    // Helper para generar el enlace de descarga directa en Google Drive
    const getDirectDriveUrl = (fId, fKind) => {
      if (fKind === 'google-doc') {
        return `https://docs.google.com/document/d/${fId}/export?format=docx`;
      } else if (fKind === 'google-sheet') {
        return `https://docs.google.com/spreadsheets/d/${fId}/export?format=xlsx`;
      } else if (fKind === 'google-slide') {
        return `https://docs.google.com/presentation/d/${fId}/export?format=pptx`;
      } else {
        return `https://drive.google.com/uc?id=${fId}&export=download`;
      }
    };

    // Obtener metadatos del archivo para saber el nombre y tipo original
    let driveFile = null;
    try {
      const fileMetadata = await drive.files.get({
        fileId: fileId,
        fields: 'name, mimeType, fileExtension'
      });
      driveFile = fileMetadata.data;
    } catch (e) {
      console.warn('Error al obtener metadatos de Google Drive (redirigiendo al enlace directo):', e.message);
      return res.redirect(getDirectDriveUrl(fileId, kind));
    }

    const cleanTitle = `${documento.codigo || 'documento'}_${documento.titulo || 'archivo'}`
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();

    let streamResponse;
    let filename = cleanTitle;
    let contentType = 'application/octet-stream';

    try {
      if (kind === 'google-doc') {
        filename = `${cleanTitle}.docx`;
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        streamResponse = await drive.files.export(
          {
            fileId: fileId,
            mimeType: contentType
          },
          { responseType: 'stream' }
        );
      } else if (kind === 'google-sheet') {
        filename = `${cleanTitle}.xlsx`;
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        streamResponse = await drive.files.export(
          {
            fileId: fileId,
            mimeType: contentType
          },
          { responseType: 'stream' }
        );
      } else if (kind === 'google-slide') {
        filename = `${cleanTitle}.pptx`;
        contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        streamResponse = await drive.files.export(
          {
            fileId: fileId,
            mimeType: contentType
          },
          { responseType: 'stream' }
        );
      } else {
        // Para archivos normales subidos a Drive (PDF, Word, Excel etc.)
        const extension = driveFile?.fileExtension || driveFile?.name?.split('.').pop() || 'pdf';
        filename = `${cleanTitle}.${extension}`;
        contentType = driveFile?.mimeType || MIME_TYPES_BY_EXTENSION[extension] || 'application/octet-stream';
        
        streamResponse = await drive.files.get(
          {
            fileId: fileId,
            alt: 'media'
          },
          { responseType: 'stream' }
        );
      }
    } catch (streamErr) {
      console.warn('Error al iniciar stream de Google Drive (redirigiendo al enlace directo):', streamErr.message);
      return res.redirect(getDirectDriveUrl(fileId, kind));
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    streamResponse.data
      .on('error', (err) => {
        console.error('Error en el streaming desde Google Drive:', err);
        if (!res.headersSent) {
          res.status(500).send('Error durante la descarga del archivo');
        }
      })
      .pipe(res);

  } catch (error) {
    console.error('Error al descargar documento:', error);
    return res.status(500).json({ success: false, message: 'Error interno al procesar la descarga' });
  }
};

module.exports = {
  getDocumentos,
  getEstadisticaDocumental,
  getDocumentoArchivoSeguro,
  descargarDocumentoDirecto,
  serializeDocumento
};
