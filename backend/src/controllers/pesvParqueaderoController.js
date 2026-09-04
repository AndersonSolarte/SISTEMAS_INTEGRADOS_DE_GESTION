const fs = require('fs');
const crypto = require('crypto');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const {
  PesvParqueaderoRegistro, PesvRuntValidacion, PesvSoatHistorico, PesvRtmHistorico, User,
  RecursoHumanoDocente, RecursoHumanoAdministrativo, PoblacionalCaracterizacion, PoblacionalMatriculado
} = require('../models');
const { sequelize } = require('../config/database');
const { evaluateRtmStatus } = require('../services/pesvRtmRules');
const { sendPesvExpiryNotification, sendPesvRuntUpdateConfirmation, isBicycleVehicle } = require('../services/pesvExpiryNotificationScheduler');

const EXCEL_FIELDS = {
  IDENTIFICACION: 'identificacion', NOMBRES_Y_APELLIDOS: 'nombres_apellidos', CORREO: 'correo',
  VINCULACION: 'vinculacion', DEPENDENCIA_PROGRAMA: 'dependencia_programa', CAMPUS: 'campus',
  PARQUEADERO_INGRESO: 'parqueadero_ingreso',
  TIPO_VEHICULO: 'tipo_vehiculo', PLACA: 'placa',
  TIENE_LICENCIA: 'tiene_licencia', LICENCIA_CATEGORIAS: 'licencia_categorias',
  LICENCIA_EXPEDICION: 'licencia_expedicion', LICENCIA_VENCIMIENTO: 'licencia_vencimiento',
  VEHICULO_AUTORIZADO: 'vehiculo_autorizado',
  VEHICULO_ES_PROPIO: 'vehiculo_es_propio', PROPIETARIO_IDENTIFICACION: 'propietario_identificacion',
  OBSERVACIONES: 'observaciones',
  VEHICULO_CLASE: 'vehiculo_clase', VEHICULO_SERVICIO: 'vehiculo_servicio', VEHICULO_MODELO: 'vehiculo_modelo',
  FECHA_MATRICULA: 'vehiculo_fecha_matricula', SOAT_FECHA_EXPEDICION: 'soat_fecha_expedicion',
  SOAT_FECHA_INICIO: 'soat_fecha_inicio', SOAT_VIGENCIA: 'soat_vigencia', SOAT_NUMERO_POLIZA: 'soat_numero_poliza',
  SOAT_ENTIDAD: 'soat_entidad', RTM_ESTADO: 'rtm_estado', RTM_FECHA_EXPEDICION: 'rtm_fecha_expedicion',
  TECNOMECANICA_VIGENCIA: 'tecnomecanica_vigencia', RTM_FECHA_EXIGIBILIDAD: 'rtm_fecha_exigibilidad',
  RTM_NUMERO_CERTIFICADO: 'rtm_numero_certificado', RTM_CDA: 'rtm_cda'
};
const PESV_TEMPLATE_COLUMNS = [
  'IDENTIFICACION', 'NOMBRES_Y_APELLIDOS', 'CORREO', 'VINCULACION', 'DEPENDENCIA_PROGRAMA', 'CAMPUS',
  'PARQUEADERO_INGRESO', 'TIPO_VEHICULO', 'PLACA', 'TIENE_LICENCIA', 'LICENCIA_CATEGORIAS',
  'LICENCIA_EXPEDICION', 'LICENCIA_VENCIMIENTO',
  'VEHICULO_AUTORIZADO', 'VEHICULO_ES_PROPIO', 'PROPIETARIO_IDENTIFICACION',
  'VEHICULO_CLASE', 'VEHICULO_SERVICIO', 'VEHICULO_MODELO', 'FECHA_MATRICULA',
  'SOAT_FECHA_EXPEDICION', 'SOAT_FECHA_INICIO', 'SOAT_VIGENCIA', 'SOAT_NUMERO_POLIZA', 'SOAT_ENTIDAD',
  'RTM_ESTADO', 'RTM_FECHA_EXPEDICION', 'TECNOMECANICA_VIGENCIA', 'RTM_FECHA_EXIGIBILIDAD',
  'RTM_NUMERO_CERTIFICADO', 'RTM_CDA', 'OBSERVACIONES'
];
const RUNT_PUBLIC_URL = 'https://portalpublico.runt.gov.co/#/consulta-vehiculo/consulta/consulta-ciudadana';
const CATALOG_DEFAULTS = Object.freeze({
  vinculaciones: ['ADMINISTRATIVO', 'DOCENTE', 'ESTUDIANTE', 'CONTRATISTA', 'VISITANTE', 'EGRESADO', 'OTRO'],
  campus: ['CENTRO', 'SAN DAMIAN'],
  parqueaderos: ['PRINCIPAL', 'SAN DAMIAN', 'SAN FRANCISCO'],
  categoriasLicencia: ['A1', 'A2', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'],
  tiposVehiculo: ['Automóvil', 'Motocicleta', 'Camioneta', 'Campero', 'Microbús / Bus', 'Motocarro', 'Bicicleta', 'Patineta / Monopatín', 'Otro'],
  clasesVehiculo: ['AUTOMOVIL', 'MOTOCICLETA', 'CAMIONETA', 'CAMPERO', 'MOTOCARRO', 'BICICLETA'],
  serviciosVehiculo: ['Particular', 'Público', 'Oficial'],
  estadosRtm: ['VIGENTE', 'VENCIDO', 'NO_EXIGIBLE', 'SIN_REGISTRO_RUNT', 'NO_APLICA']
});
const CATALOG_FIELD_MAP = Object.freeze({
  vinculaciones: 'vinculacion', dependencias: 'dependencia_programa', campus: 'campus', parqueaderos: 'parqueadero_ingreso',
  categoriasLicencia: 'licencia_categorias', tiposVehiculo: 'tipo_vehiculo', clasesVehiculo: 'vehiculo_clase',
  serviciosVehiculo: 'vehiculo_servicio', aseguradoras: 'soat_entidad', centrosDiagnostico: 'rtm_cda'
});

const fetchSystemDependencias = async () => {
  try {
    const [userRows, docenteRows, adminRows] = await Promise.all([
      User ? User.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('dependencia')), 'dependencia']],
        where: { dependencia: { [Op.ne]: null } },
        raw: true
      }).catch(() => []) : [],
      RecursoHumanoDocente ? RecursoHumanoDocente.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('departamento_dependencia')), 'dependencia']],
        where: { departamento_dependencia: { [Op.ne]: null } },
        raw: true
      }).catch(() => []) : [],
      RecursoHumanoAdministrativo ? RecursoHumanoAdministrativo.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('dependencia')), 'dependencia']],
        where: { dependencia: { [Op.ne]: null } },
        raw: true
      }).catch(() => []) : []
    ]);
    const rawList = [...userRows, ...docenteRows, ...adminRows]
      .map((r) => r.dependencia)
      .filter((d) => d && String(d).trim());
    return [...new Set(rawList)];
  } catch (error) {
    console.error('Error obteniendo dependencias institucionales:', error);
    return [];
  }
};

const normalizeVinculacion = (value) => {
  const text = clean(value, 140);
  if (!text) return null;
  const upper = text.toUpperCase();
  if (['ADMIN', 'ADM UNICESMAG', 'ADMINISTRATIVO', 'ADMINISTRATIVA', 'UNI CESMAG'].includes(upper)) return 'ADMINISTRATIVO';
  if (upper === 'DOCENTE') return 'DOCENTE';
  if (upper === 'ESTUDIANTE') return 'ESTUDIANTE';
  if (upper === 'CONTRATISTA') return 'CONTRATISTA';
  if (upper === 'VISITANTE') return 'VISITANTE';
  if (upper === 'EGRESADO') return 'EGRESADO';
  return text;
};

const SPANISH_LOWER_WORDS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'o', 'u', 'en', 'para', 'por', 'con', 'sin', 'a']);
const toSpanishTitleCase = (str) => String(str).toLowerCase().replace(/[a-záéíóúñÁÉÍÓÚÑ]+/gi, (word, index) => {
  if (index > 0 && SPANISH_LOWER_WORDS.has(word)) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}).replace(/\b(musd)\b/gi, '(MUSD)').replace(/\b(cda)\b/gi, 'CDA').replace(/\b(pesv)\b/gi, 'PESV').replace(/\b(siac)\b/gi, 'SIAC');

const cleanIsoDate = (d) => {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
};

const stripAccentsKey = (str) => String(str || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();

const normalizeDependenciaName = (str) => {
  if (!str) return '';
  let norm = String(str).replace(/\s+/g, ' ').trim();
  const key = stripAccentsKey(norm);
  if (key.includes('EVANGELIZAC') || key.includes('EVANGENILIZAC')) return 'Vicerrectoría para la Evangelización de las Culturas';
  if (key.includes('FINANCIERA') && (key.includes('DESARROLLO') || key.includes('ADMINISTRATIVA'))) return 'Vicerrectoría Financiera y de Desarrollo Institucional';
  if (key.startsWith('VICERRECTORIA ACADEMIC') || key === 'VICERRECTORIA ACADEMICA') return 'Vicerrectoría Académica';
  if (key.includes('VICERRECTORIA') && (key.includes('INVESTIGAC') || key.includes('EXTENSION') || key.includes('POSGRADO'))) return 'Vicerrectoría de Investigaciones y Extensión';
  if (norm === norm.toUpperCase() || norm === norm.toLowerCase()) {
    norm = toSpanishTitleCase(norm);
  }
  norm = norm
    .replace(/\bArea\b/gi, 'Área')
    .replace(/\bBasicas\b/gi, 'Básicas')
    .replace(/\bAsesoria\b/gi, 'Asesoría')
    .replace(/\bInformacion\b/gi, 'Información')
    .replace(/\bJuridica\b/gi, 'Jurídica')
    .replace(/\bGestion\b/gi, 'Gestión')
    .replace(/\bPlaneacion\b/gi, 'Planeación')
    .replace(/\bEvaluacion\b/gi, 'Evaluación')
    .replace(/\bDireccion\b/gi, 'Dirección')
    .replace(/\bPosgrados\b/gi, 'Posgrados')
    .replace(/\bPublicas\b/gi, 'Públicas')
    .replace(/\bFisica\b/gi, 'Física');
  return norm;
};

const uniqueCatalog = (defaults, values) => {
  const rawList = [...(defaults || []), ...(values || [])]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  const deduppedMap = new Map();
  rawList.forEach((item) => {
    const normalizedItem = normalizeDependenciaName(item);
    const key = stripAccentsKey(normalizedItem);
    if (!key) return;
    if (!deduppedMap.has(key)) {
      deduppedMap.set(key, normalizedItem);
    } else {
      const existing = deduppedMap.get(key);
      const currentHasAccents = /[áéíóúÁÉÍÓÚñÑ]/.test(normalizedItem);
      const existingHasAccents = /[áéíóúÁÉÍÓÚñÑ]/.test(existing);
      if (currentHasAccents && !existingHasAccents) deduppedMap.set(key, normalizedItem);
    }
  });

  const result = Array.from(deduppedMap.values());
  const listWithoutOtro = result.filter((item) => item.toUpperCase() !== 'OTRO');
  const otroItem = result.find((item) => item.toUpperCase() === 'OTRO');
  listWithoutOtro.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  if (otroItem) listWithoutOtro.push(otroItem);
  return listWithoutOtro;
};
const buildPesvCatalogs = (rows = [], extraDependencias = []) => {
  const dependenciasList = extraDependencias.length
    ? uniqueCatalog(extraDependencias, [])
    : uniqueCatalog(CATALOG_DEFAULTS.dependencias, rows.map((row) => row.dependencia_programa));
  const validTiposVehiculoValues = rows.map((r) => r.tipo_vehiculo).filter((v) => v && !['ARQUITECTURA'].includes(String(v).trim().toUpperCase()));
  return {
    ...Object.fromEntries(Object.entries(CATALOG_FIELD_MAP).map(([key, field]) => [
      key,
      key === 'dependencias'
        ? dependenciasList
        : key === 'tiposVehiculo'
          ? uniqueCatalog(CATALOG_DEFAULTS.tiposVehiculo, validTiposVehiculoValues)
          : uniqueCatalog(CATALOG_DEFAULTS[key], rows.map((row) => row[field]))
    ])),
    estadosRtm: [...CATALOG_DEFAULTS.estadosRtm]
  };
};

const clean = (value, max = 500) => {
  const result = String(value ?? '').trim();
  return result ? result.slice(0, max) : null;
};
const normalizePlate = (value) => clean(value, 30)?.toUpperCase().replace(/[^A-Z0-9]/g, '') || null;
const parseOptionalBoolean = (value) => {
  if (value === true || value === false) return value;
  const normalized = String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  if (['SI', 'S', 'TRUE', '1'].includes(normalized)) return true;
  if (['NO', 'N', 'FALSE', '0'].includes(normalized)) return false;
  return null;
};
const parseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  let match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day)) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? text : null;
};
const daysUntil = (value) => {
  if (!value) return null;
  const today = new Date();
  const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(`${value}T00:00:00Z`).getTime();
  return Number.isNaN(target) ? null : Math.ceil((target - base) / 86400000);
};
const expiryStatus = (value) => {
  const days = daysUntil(value);
  if (days === null) return { code: 'sin_fecha', label: 'Sin fecha verificable', days: null, priority: 3 };
  if (days < 0) return { code: 'vencido', label: 'Vencido', days, priority: 0 };
  if (days <= 30) return { code: 'proximo', label: 'Próximo a vencer', days, priority: 1 };
  return { code: 'vigente', label: 'Vigente', days, priority: 2 };
};
const SEARCHABLE_FIELDS = Object.freeze([
  'identificacion', 'nombres_apellidos', 'correo', 'vinculacion', 'dependencia_programa', 'campus',
  'parqueadero_ingreso', 'tipo_vehiculo', 'placa', 'licencia_categorias',
  'propietario_identificacion',
  'vehiculo_clase', 'vehiculo_servicio', 'vehiculo_modelo', 'soat_numero_poliza', 'soat_entidad',
  'rtm_estado', 'rtm_numero_certificado', 'rtm_cda', 'observaciones'
]);
const normalizeSearchText = (value = '') => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9@.-]+/g, ' ').trim();
const getSearchScore = (row, rawQuery) => {
  const query = normalizeSearchText(rawQuery);
  if (!query) return 0;
  const values = Object.fromEntries(SEARCHABLE_FIELDS.map((field) => [field, normalizeSearchText(row[field])]));
  const combined = SEARCHABLE_FIELDS.map((field) => values[field]).filter(Boolean).join(' ');
  const tokens = query.split(/\s+/).filter(Boolean);
  const compactCombined = combined.replace(/[^a-z0-9]/g, '');
  if (!tokens.every((token) => combined.includes(token) || compactCombined.includes(token.replace(/[^a-z0-9]/g, '')))) return -1;

  let score = tokens.reduce((total, token) => total + SEARCHABLE_FIELDS.reduce((fieldScore, field) => fieldScore + (values[field].includes(token) ? 3 : 0), 0), 0);
  if (values.placa.replace(/[^a-z0-9]/g, '') === query.replace(/[^a-z0-9]/g, '')) score += 140;
  if (values.identificacion === query) score += 130;
  if (values.correo === query) score += 120;
  if (values.nombres_apellidos === query) score += 110;
  if (values.placa.startsWith(query)) score += 100;
  if (values.identificacion.startsWith(query)) score += 95;
  if (values.nombres_apellidos.startsWith(query)) score += 85;
  if (values.nombres_apellidos.includes(query)) score += 70;
  if (values.dependencia_programa.includes(query)) score += 55;
  if (combined.includes(query)) score += 35;
  return score;
};
const serialize = (row) => {
  const data = row.toJSON ? row.toJSON() : row;
  const tieneLic = data.tiene_licencia !== false;
  const licenciaStatus = !tieneLic
    ? { code: 'no_aplica', label: 'Sin licencia', days: null, priority: 3 }
    : expiryStatus(data.licencia_vencimiento);

  if (isBicycleVehicle(data)) {
    const noAplica = { code: 'no_aplica', label: 'No aplica · Bicicleta', days: null, priority: 2 };
    return { ...data, documentos_no_aplican: true, soat_estado: noAplica, tecnomecanica_estado: noAplica, licencia_estado: licenciaStatus };
  }
  const specialRtm = {
    NO_EXIGIBLE: { code: 'no_exigible', label: `RTM no exigible a la fecha${data.vehiculo_modelo ? ` · Modelo ${data.vehiculo_modelo}` : ''}`, days: daysUntil(data.rtm_fecha_exigibilidad), priority: 2 },
    SIN_REGISTRO_RUNT: { code: 'sin_registro', label: 'Sin registro en RUNT', days: null, priority: 1 },
    NO_APLICA: { code: 'no_aplica', label: 'No aplica', days: null, priority: 2 }
  }[data.rtm_estado];
  return {
    ...data,
    soat_estado: expiryStatus(data.soat_vigencia),
    tecnomecanica_estado: specialRtm || expiryStatus(data.tecnomecanica_vigencia),
    licencia_estado: licenciaStatus
  };
};
const payloadFromBody = (body = {}) => {
  const payload = {
    identificacion: clean(body.identificacion, 40), nombres_apellidos: clean(body.nombres_apellidos, 220),
    correo: clean(body.correo, 220)?.toLowerCase() || null, vinculacion: normalizeVinculacion(body.vinculacion),
    dependencia_programa: clean(body.dependencia_programa, 220), campus: clean(body.campus, 120),
    parqueadero_ingreso: clean(body.parqueadero_ingreso, 140),
    tipo_vehiculo: clean(body.tipo_vehiculo, 120), placa: normalizePlate(body.placa),
    tiene_licencia: parseOptionalBoolean(body.tiene_licencia) ?? true,
    licencia_categorias: clean(body.licencia_categorias, 120)?.toUpperCase() || null,
    licencia_expedicion: parseDate(body.licencia_expedicion),
    licencia_vencimiento: parseDate(body.licencia_vencimiento),
    soat_vigencia: parseDate(body.soat_vigencia),
    vehiculo_autorizado: parseOptionalBoolean(body.vehiculo_autorizado),
    vehiculo_es_propio: parseOptionalBoolean(body.vehiculo_es_propio) ?? true,
    propietario_identificacion: clean(body.propietario_identificacion, 40)?.replace(/[^a-zA-Z0-9]/g, '') || null,
    soat_vigencia_texto: clean(body.soat_vigencia || body.soat_vigencia_texto, 140),
    soat_fecha_expedicion: parseDate(body.soat_fecha_expedicion), soat_fecha_inicio: parseDate(body.soat_fecha_inicio),
    soat_numero_poliza: clean(body.soat_numero_poliza, 120), soat_entidad: clean(body.soat_entidad, 220),
    tecnomecanica_vigencia: parseDate(body.tecnomecanica_vigencia),
    tecnomecanica_vigencia_texto: clean(body.tecnomecanica_vigencia || body.tecnomecanica_vigencia_texto || (body.rtm_estado === 'NO_EXIGIBLE' ? 'RTM no exigible a la fecha' : null), 180),
    rtm_estado: clean(body.rtm_estado, 60)?.toUpperCase().replace(/\s+/g, '_') || null,
    rtm_fecha_expedicion: parseDate(body.rtm_fecha_expedicion), rtm_fecha_exigibilidad: parseDate(body.rtm_fecha_exigibilidad),
    rtm_numero_certificado: clean(body.rtm_numero_certificado, 140), rtm_cda: clean(body.rtm_cda, 220),
    vehiculo_fecha_matricula: parseDate(body.vehiculo_fecha_matricula), vehiculo_clase: clean(body.vehiculo_clase, 120),
    vehiculo_servicio: clean(body.vehiculo_servicio, 120), vehiculo_modelo: clean(body.vehiculo_modelo, 20),
    observaciones: clean(body.observaciones, 4000)
  };
  if (payload.vehiculo_es_propio !== false) payload.propietario_identificacion = null;
  if (payload.tipo_vehiculo && !payload.vehiculo_clase) {
    payload.vehiculo_clase = payload.tipo_vehiculo.trim().toUpperCase();
  } else if (payload.vehiculo_clase && !payload.tipo_vehiculo) {
    payload.tipo_vehiculo = toSpanishTitleCase(payload.vehiculo_clase);
  }
  if (payload.tiene_licencia === false) {
    payload.licencia_categorias = null;
    payload.licencia_expedicion = null;
    payload.licencia_vencimiento = null;
  }
  if (!isBicycleVehicle(payload)) return payload;
  return {
    ...payload,
    soat_vigencia: null, soat_vigencia_texto: 'No aplica para bicicleta', soat_fecha_expedicion: null,
    soat_fecha_inicio: null, soat_numero_poliza: null, soat_entidad: null,
    tecnomecanica_vigencia: null, tecnomecanica_vigencia_texto: 'No aplica para bicicleta', rtm_estado: 'NO_APLICA',
    rtm_fecha_expedicion: null, rtm_fecha_exigibilidad: null, rtm_numero_certificado: null, rtm_cda: null
  };
};
const checkLicenseVehicleCompatibility = (licenciaCategoriasRaw, tipoVehiculoRaw) => {
  if (!tipoVehiculoRaw || !licenciaCategoriasRaw) return { compatible: true };
  const normTipo = String(tipoVehiculoRaw).trim().toUpperCase();
  if (['BICICLETA', 'PATINETA', 'MONOPATIN'].some(b => normTipo.includes(b))) {
    return { compatible: true };
  }
  const matchedCategories = (String(licenciaCategoriasRaw || '').toUpperCase().match(/[A-C][1-3]/g) || []);
  if (!matchedCategories.length) return { compatible: true };

  const hasMotoCategory = matchedCategories.some(cat => ['A1', 'A2'].includes(cat));
  const hasCarCategory = matchedCategories.some(cat => ['B1', 'B2', 'B3', 'C1', 'C2', 'C3'].includes(cat));

  const isMotoVehicle = ['MOTO', 'MOTOCICLETA', 'MOTOCICLO', 'MOTOTRICICLO'].some(m => normTipo.includes(m));
  const isCarVehicle = ['AUTO', 'AUTOMOVIL', 'CAMIONETA', 'CAMPERO', 'MICROBUS', 'BUS', 'MOTOCARRO', 'CAMION'].some(c => normTipo.includes(c));

  if (isMotoVehicle && !hasMotoCategory) {
    return {
      compatible: false,
      reason: `Incompatibilidad: La categoría de licencia (${matchedCategories.join(', ')}) solo autoriza vehículos/automóviles y NO autoriza conducir motocicletas (requiere A1 o A2).`
    };
  }
  if (isCarVehicle && !hasCarCategory) {
    return {
      compatible: false,
      reason: `Incompatibilidad: La categoría de licencia (${matchedCategories.join(', ')}) solo autoriza motocicletas y NO autoriza conducir automóviles o camionetas (requiere B1, B2, B3, C1, C2 o C3).`
    };
  }
  return { compatible: true };
};

const validate = (payload) => {
  const errors = [];
  if (!payload.identificacion) errors.push('La cédula / identificación es obligatoria');
  if (!payload.nombres_apellidos) errors.push('Los nombres y apellidos son obligatorios');
  if (!payload.placa) errors.push('La placa del vehículo es obligatoria para registrar o actualizar el cupo');
  if (payload.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.correo)) errors.push('El correo no es válido');
  if (payload.vehiculo_es_propio === false && !payload.propietario_identificacion) errors.push('La identificación del propietario es obligatoria cuando el vehículo no es propio');
  if (payload.tiene_licencia !== false && payload.licencia_categorias && payload.tipo_vehiculo) {
    const compat = checkLicenseVehicleCompatibility(payload.licencia_categorias, payload.tipo_vehiculo);
    if (!compat.compatible) errors.push(compat.reason);
  }
  return errors;
};

const getFilteredRows = async (query = {}) => {
  const search = clean(query.search, 120);
  const where = {};
  if (query.campus && String(query.campus).trim()) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push(
      sequelize.where(sequelize.fn('UPPER', sequelize.col('campus')), String(query.campus).trim().toUpperCase())
    );
  }
  if (query.parqueadero && String(query.parqueadero).trim()) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push(
      sequelize.where(sequelize.fn('UPPER', sequelize.col('parqueadero_ingreso')), String(query.parqueadero).trim().toUpperCase())
    );
  }
  
  const estadoRegistro = clean(query.estado_registro, 30);
  if (estadoRegistro === 'inactivo') where.activo = false;
  else if (estadoRegistro === 'todos') { /* sin filtro activo */ }
  else where.activo = { [Op.ne]: false };

  const rows = await PesvParqueaderoRegistro.findAll({
    where,
    order: [['soat_vigencia', 'ASC NULLS LAST'], ['nombres_apellidos', 'ASC']]
  });
  let data = rows.map(serialize);
  if (search) data = data.map((row) => ({ ...row, _searchScore: getSearchScore(row, search) })).filter((row) => row._searchScore >= 0);

  const [totalActivos, totalInactivos] = await Promise.all([
    PesvParqueaderoRegistro.count({ where: { activo: { [Op.ne]: false } } }),
    PesvParqueaderoRegistro.count({ where: { activo: false } })
  ]);

  const summary = {
    total: data.length,
    total_activos: totalActivos,
    total_inactivos: totalInactivos,
    vehiculos: data.filter((r) => r.placa).length,
    vencidos: data.filter((r) => r.soat_estado.code === 'vencido' || r.tecnomecanica_estado.code === 'vencido' || r.licencia_estado?.code === 'vencido').length,
    proximos: data.filter((r) => (r.soat_estado.code === 'proximo' || r.tecnomecanica_estado.code === 'proximo' || r.licencia_estado?.code === 'proximo') && r.soat_estado.code !== 'vencido' && r.tecnomecanica_estado.code !== 'vencido' && r.licencia_estado?.code !== 'vencido').length,
    soat_vencidos: data.filter((r) => r.soat_estado.code === 'vencido').length,
    soat_proximos: data.filter((r) => r.soat_estado.code === 'proximo').length,
    tecnomecanica_vencidos: data.filter((r) => r.tecnomecanica_estado.code === 'vencido').length,
    tecnomecanica_proximos: data.filter((r) => r.tecnomecanica_estado.code === 'proximo').length,
    licencia_vencidos: data.filter((r) => r.licencia_estado?.code === 'vencido').length,
    licencia_proximos: data.filter((r) => r.licencia_estado?.code === 'proximo').length
  };
  const estado = clean(query.estado, 30);
  if (estado) data = data.filter((row) => row.soat_estado.code === estado || row.tecnomecanica_estado.code === estado || row.licencia_estado?.code === estado);
  const indicador = clean(query.indicador, 30);
  if (indicador === 'vencido') data = data.filter((row) => row.soat_estado.code === 'vencido' || row.tecnomecanica_estado.code === 'vencido' || row.licencia_estado?.code === 'vencido');
  if (indicador === 'proximo') data = data.filter((row) => row.soat_estado.code === 'proximo' || row.tecnomecanica_estado.code === 'proximo' || row.licencia_estado?.code === 'proximo');
  if (indicador === 'soat_vencido') data = data.filter((row) => row.soat_estado.code === 'vencido');
  if (indicador === 'soat_proximo') data = data.filter((row) => row.soat_estado.code === 'proximo');
  if (indicador === 'rtm_vencido') data = data.filter((row) => row.tecnomecanica_estado.code === 'vencido');
  if (indicador === 'rtm_proximo') data = data.filter((row) => row.tecnomecanica_estado.code === 'proximo');
  if (indicador === 'licencia_vencido') data = data.filter((row) => row.licencia_estado?.code === 'vencido');
  if (indicador === 'licencia_proximo') data = data.filter((row) => row.licencia_estado?.code === 'proximo');
  data.sort((a, b) => search
    ? b._searchScore - a._searchScore || String(a.nombres_apellidos || '').localeCompare(String(b.nombres_apellidos || ''), 'es')
    : Math.min(a.soat_estado.priority, a.tecnomecanica_estado.priority, a.licencia_estado?.priority ?? 3) - Math.min(b.soat_estado.priority, b.tecnomecanica_estado.priority, b.licencia_estado?.priority ?? 3) || (a.soat_estado.days ?? 99999) - (b.soat_estado.days ?? 99999));
  data = data.map(({ _searchScore, ...row }) => row);
  return { data, summary };
};

const list = async (req, res) => {
  try {
    const [{ data, summary }, catalogRows, systemDependencias] = await Promise.all([
      getFilteredRows(req.query),
      PesvParqueaderoRegistro.findAll({ attributes: [...new Set(Object.values(CATALOG_FIELD_MAP))], raw: true }),
      fetchSystemDependencias()
    ]);
    res.json({ success: true, data, summary, catalogs: buildPesvCatalogs(catalogRows, systemDependencias) });
  } catch (error) {
    console.error('Error consultando registros PESV:', error);
    res.status(500).json({ success: false, message: 'No se pudieron consultar los registros de parqueaderos' });
  }
};

const create = async (req, res) => {
  const payload = payloadFromBody(req.body);
  const errors = validate(payload);
  if (errors.length) return res.status(400).json({ success: false, message: errors.join('. ') });
  try {
    const normIdent = payload.identificacion ? payload.identificacion.trim().toUpperCase() : '';
    const normPlaca = payload.placa ? payload.placa.trim().toUpperCase() : '';
    const isGenericPlaca = !normPlaca || normPlaca.startsWith('SIN-PLACA');

    const existingRecords = normPlaca && !isGenericPlaca
      ? await PesvParqueaderoRegistro.findAll({
          where: {
            activo: { [Op.ne]: false },
            [Op.and]: [
              sequelize.where(sequelize.fn('UPPER', sequelize.fn('TRIM', sequelize.col('placa'))), normPlaca)
            ]
          },
          order: [['updated_at', 'DESC'], ['id', 'DESC']]
        })
      : [];

    let row;
    if (existingRecords.length > 0) {
      row = existingRecords[0];
      const notificationReset = {};
      if (cleanIsoDate(row.soat_vigencia) !== cleanIsoDate(payload.soat_vigencia)) notificationReset.ultima_notificacion_soat = null;
      if (cleanIsoDate(row.tecnomecanica_vigencia) !== cleanIsoDate(payload.tecnomecanica_vigencia)) notificationReset.ultima_notificacion_tecnomecanica = null;
      if (cleanIsoDate(row.licencia_vencimiento) !== cleanIsoDate(payload.licencia_vencimiento)) notificationReset.ultima_notificacion_licencia = null;

      await row.update({
        ...payload,
        ...notificationReset,
        activo: true,
        actualizado_por: req.user?.id
      });

      for (let i = 1; i < existingRecords.length; i++) {
        await existingRecords[i].update({ activo: false, actualizado_por: req.user?.id });
      }
    } else {
      row = await PesvParqueaderoRegistro.create({
        ...payload,
        activo: true,
        creado_por: req.user?.id,
        actualizado_por: req.user?.id
      });
    }

    return res.status(201).json({ success: true, data: serialize(row) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No se pudo crear o actualizar el registro: ' + error.message });
  }
};

const update = async (req, res) => {
  const payload = payloadFromBody(req.body);
  const errors = validate(payload);
  if (errors.length) return res.status(400).json({ success: false, message: errors.join('. ') });
  try {
    const row = await PesvParqueaderoRegistro.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Registro no encontrado' });

    const notificationReset = {};
    if (cleanIsoDate(row.soat_vigencia) !== cleanIsoDate(payload.soat_vigencia)) notificationReset.ultima_notificacion_soat = null;
    if (cleanIsoDate(row.tecnomecanica_vigencia) !== cleanIsoDate(payload.tecnomecanica_vigencia)) notificationReset.ultima_notificacion_tecnomecanica = null;
    if (cleanIsoDate(row.licencia_vencimiento) !== cleanIsoDate(payload.licencia_vencimiento)) notificationReset.ultima_notificacion_licencia = null;

    await row.update({ ...payload, ...notificationReset, activo: true, actualizado_por: req.user?.id });

    const normPlaca = payload.placa ? payload.placa.trim().toUpperCase() : '';
    const isGenericPlaca = !normPlaca || normPlaca.startsWith('SIN-PLACA');

    if (normPlaca && !isGenericPlaca) {
      const otherDuplicates = await PesvParqueaderoRegistro.findAll({
        where: {
          id: { [Op.ne]: row.id },
          activo: { [Op.ne]: false },
          [Op.and]: [
            sequelize.where(sequelize.fn('UPPER', sequelize.fn('TRIM', sequelize.col('placa'))), normPlaca)
          ]
        }
      });

      for (const dup of otherDuplicates) {
        await dup.update({ activo: false, actualizado_por: req.user?.id });
      }
    }

    return res.json({ success: true, data: serialize(row) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No se pudo actualizar el registro' });
  }
};
const remove = async (req, res) => {
  try {
    const row = await PesvParqueaderoRegistro.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    await row.update({ activo: false, actualizado_por: req.user?.id });
    return res.json({ success: true, message: `El cupo de ${row.nombres_apellidos} fue pasado a inactivo (los datos históricos se conservan)` });
  } catch (error) { return res.status(500).json({ success: false, message: 'No se pudo inactivar el registro' }); }
};
const reactivate = async (req, res) => {
  try {
    const row = await PesvParqueaderoRegistro.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    await row.update({ activo: true, actualizado_por: req.user?.id });
    return res.json({ success: true, message: `El cupo de ${row.nombres_apellidos} fue reactivado exitosamente.` });
  } catch (error) { return res.status(500).json({ success: false, message: 'No se pudo reactivar el registro' }); }
};

const isExpired = (session) => !session?.expira_en || new Date(session.expira_en).getTime() < Date.now();
const normalizeExternalStatus = (value, fallback = 'SIN_INFORMACION') => clean(value, 60)?.toUpperCase().replace(/\s+/g, '_') || fallback;
const sanitizeSourceRecord = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value).slice(0, 40).reduce((acc, [key, fieldValue]) => ({
    ...acc,
    [clean(key, 80) || 'campo']: clean(fieldValue, 500)
  }), {});
};
const normalizeRuntPayload = (body = {}) => {
  const soatInput = body.soat && typeof body.soat === 'object' ? body.soat : null;
  const rtmInput = body.rtm && typeof body.rtm === 'object' ? body.rtm : null;
  const soat = soatInput ? {
    estado: normalizeExternalStatus(soatInput.estado),
    fecha_expedicion: parseDate(soatInput.fecha_expedicion),
    fecha_inicio: parseDate(soatInput.fecha_inicio),
    fecha_fin: parseDate(soatInput.fecha_fin),
    numero_poliza: clean(soatInput.numero_poliza, 120),
    entidad: clean(soatInput.entidad, 220),
    codigo_tarifa: clean(soatInput.codigo_tarifa, 80),
    datos_fuente: sanitizeSourceRecord(soatInput.datos_fuente || soatInput)
  } : null;
  const rawVigente = rtmInput?.vigente;
  const rtm = rtmInput ? {
    estado: normalizeExternalStatus(rtmInput.estado || (rawVigente === true || String(rawVigente).toUpperCase() === 'SI' ? 'VIGENTE' : 'SIN_INFORMACION')),
    vigente: rawVigente === true || ['SI', 'SÍ', 'VIGENTE'].includes(String(rawVigente || '').trim().toUpperCase())
      ? true
      : rawVigente === false || ['NO', 'NO_VIGENTE', 'VENCIDO'].includes(String(rawVigente || '').trim().toUpperCase()) ? false : null,
    tipo_revision: clean(rtmInput.tipo_revision, 180),
    fecha_expedicion: parseDate(rtmInput.fecha_expedicion),
    fecha_vigencia: parseDate(rtmInput.fecha_vigencia),
    numero_certificado: clean(rtmInput.numero_certificado, 140),
    cda: clean(rtmInput.cda, 220),
    datos_fuente: sanitizeSourceRecord(rtmInput.datos_fuente || rtmInput)
  } : null;
  const vehicleInput = body.vehiculo && typeof body.vehiculo === 'object' ? body.vehiculo : {};
  const vehiculo = {
    fecha_matricula: parseDate(vehicleInput.fecha_matricula),
    clase: clean(vehicleInput.clase, 120),
    servicio: clean(vehicleInput.servicio, 120),
    modelo: clean(vehicleInput.modelo, 20),
    rtm_fecha_exigibilidad: parseDate(vehicleInput.rtm_fecha_exigibilidad)
  };
  return {
    soat, rtm, vehiculo,
    capturado_en: new Date().toISOString(),
    pagina_origen: clean(body.pagina_origen, 500)
  };
};
const assessRuntUpdate = (record, result = {}) => {
  const isLater = (nextValue, currentValue) => Boolean(nextValue) && (!currentValue || String(nextValue) > String(currentValue));
  const soat = result.soat || null;
  const rtm = result.rtm || null;
  const soatActualizado = isLater(soat?.fecha_fin, record?.soat_vigencia);
  const rtmFechaActualizada = isLater(rtm?.fecha_vigencia, record?.tecnomecanica_vigencia);
  const rtmSituacionActualizada = Boolean(rtm && !rtm.fecha_vigencia && rtm.estado && rtm.estado !== record?.rtm_estado);
  const rtmActualizada = rtmFechaActualizada || rtmSituacionActualizada;
  return {
    detectada: soatActualizado || rtmActualizada,
    soat_actualizado: soatActualizado,
    rtm_actualizada: rtmActualizada,
    mensaje: soatActualizado || rtmActualizada
      ? 'RUNT refleja una vigencia o situación documental nueva frente a la información registrada en SIAC.'
      : 'RUNT aún no refleja una vigencia posterior a la registrada. Si la persona informó una renovación, realice una nueva consulta cuando RUNT haya sido actualizado.'
  };
};
const getConsolidatedStatus = (soat, rtm) => {
  const soatOk = soat?.estado === 'VIGENTE';
  const soatBad = soat && ['VENCIDO', 'NO_VIGENTE'].includes(soat.estado);
  const rtmOk = rtm?.vigente === true || rtm?.estado === 'VIGENTE';
  const rtmBad = rtm?.vigente === false || ['VENCIDO', 'NO_VIGENTE'].includes(rtm?.estado);
  if (soatBad && rtmBad) return 'NO_CUMPLE_SOAT_RTM';
  if (soatBad) return 'NO_CUMPLE_SOAT';
  if (rtmBad) return 'NO_CUMPLE_RTM';
  if (soatOk && (rtmOk || ['NO_APLICA', 'NO_EXIGIBLE'].includes(rtm?.estado))) return 'CUMPLE';
  return 'REVISAR';
};

const startRuntValidation = async (req, res) => {
  try {
    const record = await PesvParqueaderoRegistro.findByPk(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    if (isBicycleVehicle(record)) return res.status(400).json({ success: false, message: 'Las bicicletas no requieren validación documental en RUNT' });
    const placaConsulta = normalizePlate(record.placa);
    const documentoConsulta = record.vehiculo_es_propio === false ? clean(record.propietario_identificacion, 40)?.replace(/[^a-zA-Z0-9]/g, '') : clean(record.identificacion, 40)?.replace(/[^a-zA-Z0-9]/g, '');
    if (!placaConsulta || !documentoConsulta) return res.status(400).json({ success: false, message: record.vehiculo_es_propio === false ? 'La consulta RUNT requiere la placa y la identificación del propietario' : 'La consulta RUNT requiere placa e identificación' });
    if (placaConsulta !== record.placa) await record.update({ placa: placaConsulta, actualizado_por: req.user.id });
    await PesvRuntValidacion.update({ estado: 'CANCELADA' }, {
      where: { parqueadero_registro_id: record.id, estado: { [Op.in]: ['PENDIENTE', 'ABIERTA'] } }
    });
    const session = await PesvRuntValidacion.create({
      parqueadero_registro_id: record.id,
      token_hash: crypto.randomBytes(32).toString('hex'),
      estado: 'PENDIENTE',
      expira_en: new Date(Date.now() + 20 * 60 * 1000),
      iniciada_por: req.user.id
    });
    const runtUrl = RUNT_PUBLIC_URL;
    return res.status(201).json({ success: true, data: { id: session.id, runtUrl, estado: session.estado, expira_en: session.expira_en, placaConsulta, documentoConsulta, usaDocumentoPropietario: record.vehiculo_es_propio === false } });
  } catch (error) {
    console.error('Error al iniciar validación RUNT:', error);
    return res.status(500).json({ success: false, message: 'No se pudo iniciar la validación RUNT' });
  }
};

const captureManualRuntResult = async (req, res) => {
  try {
    const session = await PesvRuntValidacion.findByPk(req.params.sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Validación no encontrada' });
    if (session.iniciada_por !== req.user.id && req.user.role !== 'administrador') return res.status(403).json({ success: false, message: 'No tienes acceso a esta validación' });
    if (!['PENDIENTE', 'ABIERTA'].includes(session.estado)) return res.status(409).json({ success: false, message: 'La validación no admite cambios' });
    if (isExpired(session)) { await session.update({ estado: 'CANCELADA', error_detalle: 'Sesión expirada' }); return res.status(410).json({ success: false, message: 'La sesión expiró. Inicia una nueva consulta.' }); }

    const soatDate = parseDate(req.body?.soat_fecha_fin);
    const rawRtmSituation = String(req.body?.rtm_aplica || 'SI').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    const rtmSituacion = rawRtmSituation.includes('NO_EXIGIBLE') ? 'NO_EXIGIBLE'
      : rawRtmSituation.includes('SIN_REGISTRO') ? 'SIN_REGISTRO_RUNT'
        : rawRtmSituation === 'NO' || rawRtmSituation.includes('NO_APLICA') ? 'NO_APLICA' : 'SI';
    const submittedRtmDate = parseDate(req.body?.rtm_fecha_vigencia);
    const rtmConVigencia = rtmSituacion === 'SI' || Boolean(submittedRtmDate);
    const rtmDate = rtmConVigencia ? submittedRtmDate : null;
    const rtmEvaluation = evaluateRtmStatus({
      registrationDate: parseDate(req.body?.vehiculo_fecha_matricula),
      vehicleClass: req.body?.vehiculo_clase,
      service: req.body?.vehiculo_servicio,
      latestCertificateExpiry: rtmDate
    });
    const verifiedRtmSituation = rtmConVigencia || rtmSituacion === 'NO_APLICA'
      ? rtmSituacion
      : ['NO_EXIGIBLE', 'SIN_REGISTRO_RUNT'].includes(rtmEvaluation.status) ? rtmEvaluation.status : rtmSituacion;
    if (!soatDate) return res.status(400).json({ success: false, message: 'Registra la fecha final de vigencia del SOAT consultada en RUNT' });
    if (rtmConVigencia && !rtmDate) return res.status(400).json({ success: false, message: 'Registra la vigencia de la tecnomecánica o selecciona la situación informada por RUNT' });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const statusFor = (date) => new Date(`${date}T00:00:00`).getTime() < today.getTime() ? 'VENCIDO' : 'VIGENTE';
    const result = normalizeRuntPayload({
      soat: {
        estado: statusFor(soatDate), fecha_fin: soatDate,
        numero_poliza: req.body?.soat_numero_poliza, entidad: req.body?.soat_entidad,
        datos_fuente: { metodo: 'REGISTRO_MANUAL', verificado_por: req.user.email || req.user.id }
      },
      rtm: rtmConVigencia ? {
        estado: statusFor(rtmDate), vigente: statusFor(rtmDate) === 'VIGENTE', fecha_vigencia: rtmDate,
        numero_certificado: req.body?.rtm_numero_certificado, cda: req.body?.rtm_cda,
        datos_fuente: { metodo: 'REGISTRO_MANUAL', verificado_por: req.user.email || req.user.id }
      } : {
        estado: verifiedRtmSituation, vigente: null,
        datos_fuente: { metodo: 'REGISTRO_MANUAL', verificado_por: req.user.email || req.user.id }
      },
      vehiculo: {
        fecha_matricula: req.body?.vehiculo_fecha_matricula,
        clase: req.body?.vehiculo_clase,
        servicio: req.body?.vehiculo_servicio,
        modelo: req.body?.vehiculo_modelo,
        rtm_fecha_exigibilidad: rtmEvaluation.firstDueDate || req.body?.rtm_fecha_exigibilidad
      },
      pagina_origen: 'REGISTRO_MANUAL_SIAC'
    });
    const currentRecord = await PesvParqueaderoRegistro.findByPk(session.parqueadero_registro_id);
    if (!currentRecord) return res.status(404).json({ success: false, message: 'Registro de parqueadero no encontrado' });
    result.comparacion_actualizacion = assessRuntUpdate(currentRecord, result);
    await session.update({ estado: 'CAPTURADA', resultado: result, pagina_origen: result.pagina_origen, capturada_en: new Date() });
    return res.json({ success: true, message: 'Fechas RUNT cargadas para revisión', data: { ...session.toJSON(), token_hash: undefined } });
  } catch (error) { return res.status(500).json({ success: false, message: 'No se pudo registrar el resultado consultado' }); }
};

const getRuntValidation = async (req, res) => {
  try {
    const session = await PesvRuntValidacion.findByPk(req.params.sessionId, { include: [{ model: PesvParqueaderoRegistro, as: 'registroParqueadero' }] });
    if (!session) return res.status(404).json({ success: false, message: 'Validación no encontrada' });
    if (session.iniciada_por !== req.user.id && req.user.role !== 'administrador') return res.status(403).json({ success: false, message: 'No tienes acceso a esta validación' });
    return res.json({ success: true, data: { ...session.toJSON(), token_hash: undefined } });
  } catch (error) { return res.status(500).json({ success: false, message: 'No se pudo consultar el estado de validación' }); }
};

const confirmRuntValidation = async (req, res) => {
  try {
    const session = await PesvRuntValidacion.findByPk(req.params.sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Validación no encontrada' });
    if (session.iniciada_por !== req.user.id && req.user.role !== 'administrador') return res.status(403).json({ success: false, message: 'No tienes acceso a esta validación' });
    if (session.estado !== 'CAPTURADA') return res.status(409).json({ success: false, message: 'La validación aún no tiene un resultado para confirmar' });
    const result = session.resultado || {}; const soat = result.soat; const rtm = result.rtm; const vehiculo = result.vehiculo || {};
    const currentRecord = await PesvParqueaderoRegistro.findByPk(session.parqueadero_registro_id);
    if (!currentRecord) return res.status(404).json({ success: false, message: 'Registro de parqueadero no encontrado' });
    const comparison = assessRuntUpdate(currentRecord, result);
    if (!comparison.detectada) return res.status(409).json({ success: false, code: 'RUNT_SIN_ACTUALIZACION', message: comparison.mensaje, data: comparison });
    const consolidated = getConsolidatedStatus(soat, rtm);
    await sequelize.transaction(async (transaction) => {
      const record = await PesvParqueaderoRegistro.findByPk(session.parqueadero_registro_id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!record) throw new Error('Registro de parqueadero no encontrado');
      if (soat) await PesvSoatHistorico.create({ validacion_id: session.id, parqueadero_registro_id: record.id, ...soat }, { transaction });
      if (rtm) await PesvRtmHistorico.create({ validacion_id: session.id, parqueadero_registro_id: record.id, ...rtm }, { transaction });
      await record.update({
        ...(soat ? { soat_estado: soat.estado, soat_fecha_expedicion: soat.fecha_expedicion, soat_fecha_inicio: soat.fecha_inicio, soat_vigencia: soat.fecha_fin, soat_vigencia_texto: soat.fecha_fin, soat_numero_poliza: soat.numero_poliza, soat_entidad: soat.entidad } : {}),
        ...(rtm ? { rtm_estado: rtm.estado, tecnomecanica_vigencia: rtm.fecha_vigencia, tecnomecanica_vigencia_texto: rtm.fecha_vigencia || (rtm.estado === 'NO_EXIGIBLE' ? 'RTM no exigible a la fecha' : rtm.estado === 'SIN_REGISTRO_RUNT' ? 'Sin registro en RUNT' : 'No aplica'), rtm_fecha_expedicion: rtm.fecha_expedicion, rtm_numero_certificado: rtm.numero_certificado, rtm_cda: rtm.cda } : {}),
        ...(soat ? { ultima_notificacion_soat: null } : {}),
        ...(rtm ? { ultima_notificacion_tecnomecanica: null } : {}),
        vehiculo_fecha_matricula: vehiculo.fecha_matricula, vehiculo_clase: vehiculo.clase,
        tipo_vehiculo: toSpanishTitleCase(vehiculo.clase) || record.tipo_vehiculo,
        vehiculo_servicio: vehiculo.servicio, vehiculo_modelo: vehiculo.modelo,
        rtm_fecha_exigibilidad: vehiculo.rtm_fecha_exigibilidad,
        ultima_consulta_runt: new Date(), estado_validacion_runt: consolidated, actualizado_por: req.user.id
      }, { transaction });
      await session.update({ estado: 'CONFIRMADA', confirmada_en: new Date(), confirmada_por: req.user.id }, { transaction });
    });
    const updatedRecord = await PesvParqueaderoRegistro.findByPk(session.parqueadero_registro_id);
    return res.json({
      success: true,
      message: 'Información RUNT confirmada y actualizada. Puede notificar manualmente a la persona.',
      data: { estado_validacion: consolidated, comparacion_actualizacion: comparison, confirmacion_enviada: false, updatedRecord: serialize(updatedRecord) }
    });
  } catch (error) { return res.status(500).json({ success: false, message: 'No se pudo confirmar la validación RUNT' }); }
};

const notifyRuntUpdate = async (req, res) => {
  try {
    const session = await PesvRuntValidacion.findByPk(req.params.sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Validación no encontrada' });
    if (session.iniciada_por !== req.user.id && req.user.role !== 'administrador') return res.status(403).json({ success: false, message: 'No tienes acceso a esta validación' });
    if (session.estado !== 'CONFIRMADA') return res.status(409).json({ success: false, message: 'Primero debe confirmar la actualización consultada en RUNT' });
    if (session.notificacion_actualizacion_en) return res.status(409).json({ success: false, alreadyNotified: true, message: 'La confirmación de esta actualización ya fue enviada' });
    const row = await PesvParqueaderoRegistro.findByPk(session.parqueadero_registro_id);
    if (!row) return res.status(404).json({ success: false, message: 'Registro de parqueadero no encontrado' });
    const claimAt = new Date();
    const [claimed] = await PesvRuntValidacion.update(
      { notificacion_actualizacion_en: claimAt, notificacion_actualizacion_por: req.user.id },
      { where: { id: session.id, estado: 'CONFIRMADA', notificacion_actualizacion_en: null } }
    );
    if (!claimed) return res.status(409).json({ success: false, alreadyNotified: true, message: 'La confirmación ya fue enviada o está siendo procesada' });
    const result = session.resultado || {};
    const notification = await sendPesvRuntUpdateConfirmation(row, { soat: result.soat, rtm: result.rtm });
    if (!notification.success) {
      await PesvRuntValidacion.update(
        { notificacion_actualizacion_en: null, notificacion_actualizacion_por: null },
        { where: { id: session.id, notificacion_actualizacion_en: claimAt } }
      );
      return res.status(503).json({ success: false, message: `La actualización está guardada, pero no se pudo enviar la confirmación: ${notification.error}` });
    }
    return res.json({ success: true, message: `Confirmación de actualización enviada a ${row.correo}`, data: { notificacion_actualizacion_en: claimAt } });
  } catch (error) {
    console.error('Error notificando actualización RUNT:', error);
    return res.status(500).json({ success: false, message: 'No se pudo enviar la confirmación de actualización' });
  }
};

const getRuntHistory = async (req, res) => {
  try {
    const rows = await PesvRuntValidacion.findAll({
      where: { parqueadero_registro_id: req.params.id, estado: 'CONFIRMADA' },
      attributes: { exclude: ['token_hash'] },
      include: [
        { model: PesvSoatHistorico, as: 'soat' }, { model: PesvRtmHistorico, as: 'rtm' },
        { model: User, as: 'usuarioConfirma', attributes: ['id', 'nombre', 'email'] }
      ],
      order: [['confirmada_en', 'DESC']]
    });
    return res.json({ success: true, data: rows });
  } catch (error) { return res.status(500).json({ success: false, message: 'No se pudo consultar el histórico RUNT' }); }
};

const buildPesvExcelWorkbook = async (dataRows = []) => {
    const [rows, systemDependencias] = await Promise.all([
      PesvParqueaderoRegistro.findAll({ attributes: [...new Set(Object.values(CATALOG_FIELD_MAP))], raw: true }),
      fetchSystemDependencias()
    ]);
    const catalogs = buildPesvCatalogs(rows, systemDependencias);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIAC UNICESMAG';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('BASE UNIFICADA', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = PESV_TEMPLATE_COLUMNS.map((header) => ({ header, key: header, width: Math.max(16, Math.min(30, header.length + 3)) }));
    sheet.autoFilter = { from: 'A1', to: `${sheet.getColumn(PESV_TEMPLATE_COLUMNS.length).letter}1` };
    sheet.getRow(1).height = 28;
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173B72' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });

    const listSheet = workbook.addWorksheet('LISTAS');
    const validationMap = {
      VINCULACION: catalogs.vinculaciones, DEPENDENCIA_PROGRAMA: catalogs.dependencias, CAMPUS: catalogs.campus,
      PARQUEADERO_INGRESO: catalogs.parqueaderos, LICENCIA_CATEGORIAS: catalogs.categoriasLicencia,
      TIPO_VEHICULO: catalogs.tiposVehiculo, VEHICULO_CLASE: catalogs.clasesVehiculo,
      VEHICULO_SERVICIO: catalogs.serviciosVehiculo, SOAT_ENTIDAD: catalogs.aseguradoras,
      VEHICULO_AUTORIZADO: ['SI', 'NO'], VEHICULO_ES_PROPIO: ['SI', 'NO'], TIENE_LICENCIA: ['SI', 'NO'],
      RTM_ESTADO: catalogs.estadosRtm, RTM_CDA: catalogs.centrosDiagnostico
    };
    Object.entries(validationMap).forEach(([header, options], listIndex) => {
      const listColumn = listIndex + 1;
      listSheet.getCell(1, listColumn).value = header;
      options.forEach((option, optionIndex) => { listSheet.getCell(optionIndex + 2, listColumn).value = option; });
      const dataColumn = PESV_TEMPLATE_COLUMNS.indexOf(header) + 1;
      if (!dataColumn || options.length === 0) return;
      const letter = listSheet.getColumn(listColumn).letter;
      const validationRowLimit = Math.max(1001, dataRows.length + 101);
      for (let rowIndex = 2; rowIndex <= validationRowLimit; rowIndex += 1) {
        sheet.getCell(rowIndex, dataColumn).dataValidation = {
          type: 'list', allowBlank: true, errorStyle: 'stop', showErrorMessage: true,
          errorTitle: 'Valor no permitido', error: 'Seleccione un valor de la lista desplegable.',
          formulae: [`LISTAS!$${letter}$2:$${letter}$${options.length + 1}`]
        };
      }
    });
    listSheet.state = 'veryHidden';

    ['FECHA_MATRICULA', 'LICENCIA_EXPEDICION', 'LICENCIA_VENCIMIENTO', 'SOAT_FECHA_EXPEDICION', 'SOAT_FECHA_INICIO', 'SOAT_VIGENCIA', 'RTM_FECHA_EXPEDICION', 'TECNOMECANICA_VIGENCIA', 'RTM_FECHA_EXIGIBILIDAD'].forEach((header) => {
      const columnIndex = PESV_TEMPLATE_COLUMNS.indexOf(header) + 1;
      if (columnIndex > 0) {
        const column = sheet.getColumn(columnIndex);
        column.numFmt = 'yyyy-mm-dd';
      }
    });

    dataRows.forEach((source, rowIndex) => {
      const row = sheet.getRow(rowIndex + 2);
      PESV_TEMPLATE_COLUMNS.forEach((header, columnIndex) => {
        const field = EXCEL_FIELDS[header];
        const value = source[field];
        row.getCell(columnIndex + 1).value = ['VEHICULO_AUTORIZADO', 'VEHICULO_ES_PROPIO', 'TIENE_LICENCIA'].includes(header) && value !== null && value !== undefined
          ? value ? 'SI' : 'NO'
          : value ?? null;
      });
    });

    const instructions = workbook.addWorksheet('INSTRUCCIONES');
    instructions.columns = [{ header: 'CAMPO', key: 'campo', width: 30 }, { header: 'INDICACIÓN', key: 'indicacion', width: 100 }];
    instructions.addRows([
      { campo: 'NOMBRES_Y_APELLIDOS', indicacion: 'Obligatorio. Nombre completo de la persona asignada al cupo.' },
      { campo: 'LISTAS DESPLEGABLES', indicacion: 'En las columnas categóricas seleccione uno de los valores disponibles.' },
      { campo: 'FECHAS', indicacion: 'Utilice el formato AAAA-MM-DD.' },
      { campo: 'TIENE_LICENCIA', indicacion: 'Seleccione SI o NO según posea licencia de conducción vigente.' },
      { campo: 'LICENCIA_CATEGORIAS', indicacion: 'Indique la(s) categoría(s) autorizadas (ej: A2, B1, C1).' },
      { campo: 'RTM_ESTADO', indicacion: 'Seleccione VIGENTE, VENCIDO, NO_EXIGIBLE, SIN_REGISTRO_RUNT o NO_APLICA.' },
      { campo: 'VEHICULO_ES_PROPIO', indicacion: 'Seleccione SI o NO. Si selecciona NO, diligencie PROPIETARIO_IDENTIFICACION para consultar el vehículo en RUNT.' },
      { campo: 'VEHICULO_AUTORIZADO', indicacion: 'Seleccione SI o NO según la autorización institucional del vehículo.' },
      { campo: 'PLACA', indicacion: 'Digite únicamente letras y números. SIAC elimina automáticamente guiones, espacios y otros caracteres.' },
      { campo: 'IMPORTACIÓN', indicacion: 'La importación reemplaza la base actual. Revise el archivo antes de cargarlo.' }
    ]);
    instructions.getRow(1).eachCell((cell) => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173B72' } }; });

    return workbook;
};

const sendExcelWorkbook = async (res, workbook, filename) => {
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(Buffer.from(buffer));
};

const downloadExcelTemplate = async (req, res) => {
  try {
    const workbook = await buildPesvExcelWorkbook();
    return sendExcelWorkbook(res, workbook, 'Plantilla_Parqueaderos_PESV_UNICESMAG.xlsx');
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No se pudo generar la plantilla Excel' });
  }
};

const exportExcelData = async (req, res) => {
  try {
    const { data } = await getFilteredRows(req.query);
    const workbook = await buildPesvExcelWorkbook(data);
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    return sendExcelWorkbook(res, workbook, `Base_Parqueaderos_PESV_UNICESMAG_${date}.xlsx`);
  } catch (error) {
    console.error('Error exportando registros PESV:', error);
    return res.status(500).json({ success: false, message: 'No se pudo descargar la base de datos de parqueaderos' });
  }
};

const importExcel = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Debes adjuntar el archivo Excel' });
  try {
    const workbook = XLSX.readFile(req.file.path, { cellDates: true });
    const sheet = workbook.Sheets['BASE UNIFICADA'] || workbook.Sheets[workbook.SheetNames[0]];
    const inputRows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
    const warnings = [];
    const rows = inputRows.map((source, index) => {
      const hasAnyValue = Object.values(source).some((v) => v !== null && v !== undefined && String(v).trim() !== '');
      if (!hasAnyValue) return null;

      const mapped = Object.entries(EXCEL_FIELDS).reduce((acc, [column, field]) => ({ ...acc, [field]: source[column] }), {});

      if (!mapped.identificacion || !String(mapped.identificacion).trim()) {
        mapped.identificacion = `SIN-ID-${index + 1}`;
        warnings.push({ fila: index + 2, campo: 'IDENTIFICACION', detalle: 'Identificación faltante en Excel (asignada identificación temporal)' });
      }

      if (!mapped.nombres_apellidos || !String(mapped.nombres_apellidos).trim()) {
        mapped.nombres_apellidos = 'SIN NOMBRE REGISTRADO';
        warnings.push({ fila: index + 2, campo: 'NOMBRES_Y_APELLIDOS', detalle: 'Registro conservado sin nombre en el archivo fuente' });
      }

      if (!mapped.placa || !String(mapped.placa).trim()) {
        mapped.placa = `SIN-PLACA-${index + 1}`;
        warnings.push({ fila: index + 2, campo: 'PLACA', detalle: 'Placa faltante en Excel (asignada placa temporal)' });
      }

      mapped.licencia_expedicion = source.LICENCIA_EXPEDICION;
      mapped.licencia_vencimiento = source.LICENCIA_VENCIMIENTO;
      mapped.soat_vigencia = source.SOAT_VIGENCIA; mapped.soat_vigencia_texto = source.SOAT_VIGENCIA;
      mapped.tecnomecanica_vigencia = source.TECNOMECANICA_VIGENCIA; mapped.tecnomecanica_vigencia_texto = source.TECNOMECANICA_VIGENCIA;

      const payload = payloadFromBody(mapped);
      if (source.SOAT_VIGENCIA && !payload.soat_vigencia) warnings.push({ fila: index + 2, campo: 'SOAT_VIGENCIA', valor: source.SOAT_VIGENCIA, detalle: 'Fecha no verificable' });
      if (source.TECNOMECANICA_VIGENCIA && !payload.tecnomecanica_vigencia) warnings.push({ fila: index + 2, campo: 'TECNOMECANICA_VIGENCIA', valor: source.TECNOMECANICA_VIGENCIA, detalle: 'Fecha no verificable' });
      if (source.LICENCIA_VENCIMIENTO && !payload.licencia_vencimiento) warnings.push({ fila: index + 2, campo: 'LICENCIA_VENCIMIENTO', valor: source.LICENCIA_VENCIMIENTO, detalle: 'Fecha de licencia no verificable' });

      return { ...payload, creado_por: req.user?.id, actualizado_por: req.user?.id };
    }).filter(Boolean);
    const existingDbRecords = await PesvParqueaderoRegistro.findAll();
    const existingByPlaca = new Map();
    const existingByIdent = new Map();
    existingDbRecords.forEach((r) => {
      if (r.placa && !r.placa.startsWith('SIN-PLACA')) {
        existingByPlaca.set(r.placa.trim().toUpperCase(), r);
      }
      if (r.identificacion) {
        existingByIdent.set(r.identificacion.trim().toUpperCase(), r);
      }
    });

    const rowsToCreate = [];
    const rowsToUpdate = [];

    rows.forEach((payload) => {
      const normPlaca = payload.placa ? payload.placa.trim().toUpperCase() : '';
      const normIdent = payload.identificacion ? payload.identificacion.trim().toUpperCase() : '';
      const existing = (normPlaca && !normPlaca.startsWith('SIN-PLACA') && existingByPlaca.get(normPlaca)) || existingByIdent.get(normIdent);

      if (existing) {
        const sameSoat = cleanIsoDate(existing.soat_vigencia) === cleanIsoDate(payload.soat_vigencia);
        const sameTecno = cleanIsoDate(existing.tecnomecanica_vigencia) === cleanIsoDate(payload.tecnomecanica_vigencia);
        const sameLicencia = cleanIsoDate(existing.licencia_vencimiento) === cleanIsoDate(payload.licencia_vencimiento);

        rowsToUpdate.push({
          id: existing.id,
          data: {
            ...payload,
            ultima_notificacion_soat: sameSoat ? existing.ultima_notificacion_soat : null,
            ultima_notificacion_tecnomecanica: sameTecno ? existing.ultima_notificacion_tecnomecanica : null,
            ultima_notificacion_licencia: sameLicencia ? existing.ultima_notificacion_licencia : null,
            ultima_consulta_runt: existing.ultima_consulta_runt,
            estado_validacion_runt: existing.estado_validacion_runt,
            creado_por: existing.creado_por || req.user?.id,
            actualizado_por: req.user?.id,
            activo: true
          }
        });
      } else {
        rowsToCreate.push({
          ...payload,
          activo: true,
          creado_por: req.user?.id,
          actualizado_por: req.user?.id
        });
      }
    });

    await sequelize.transaction(async (transaction) => {
      for (const item of rowsToUpdate) {
        await PesvParqueaderoRegistro.update(item.data, { where: { id: item.id }, transaction });
      }
      if (rowsToCreate.length) {
        await PesvParqueaderoRegistro.bulkCreate(rowsToCreate, { transaction });
      }
    });
    return res.json({ success: true, message: `${rows.length} registros procesados (${rowsToUpdate.length} actualizados, ${rowsToCreate.length} nuevos)`, data: { imported: rows.length, omitted: inputRows.length - rows.length, warnings: warnings.slice(0, 100), warningCount: warnings.length } });
  } catch (error) { return res.status(400).json({ success: false, message: `No se pudo importar el archivo: ${error.message}` }); }
  finally { if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => {}); }
};

const notifyExpiry = async (req, res) => {
  try {
    const row = await PesvParqueaderoRegistro.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Registro no encontrado' });

    const tipo = ['licencia', 'tecnomecanica', 'soat'].includes(req.body?.tipo) ? req.body.tipo : 'soat';
    const isLicencia = tipo === 'licencia';
    const isRtm = tipo === 'tecnomecanica';

    if (!isLicencia && isBicycleVehicle(row)) {
      return res.status(400).json({ success: false, message: 'SOAT y RTM no aplican para bicicletas; no se genera notificación' });
    }
    if (!row.correo) return res.status(400).json({ success: false, message: 'El registro no tiene correo electrónico' });

    const documentType = isLicencia ? 'Licencia de Conducción' : isRtm ? 'Tecnomecánica' : 'SOAT';
    const field = isLicencia ? 'licencia_vencimiento' : isRtm ? 'tecnomecanica_vigencia' : 'soat_vigencia';
    const notificationField = isLicencia ? 'ultima_notificacion_licencia' : isRtm ? 'ultima_notificacion_tecnomecanica' : 'ultima_notificacion_soat';

    const date = row[field];
    if (!date) return res.status(400).json({ success: false, message: `No existe una fecha verificable de ${documentType}` });
    const remainingDays = daysUntil(date);
    if (remainingDays > 30) {
      return res.status(409).json({
        success: false,
        message: `El aviso de ${documentType} estará disponible cuando falten 30 días o menos para su vencimiento`
      });
    }

    const force = req.body?.force === true;
    const formatNotificationDate = (value) => new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota', dateStyle: 'long', timeStyle: 'short'
    }).format(new Date(value)).replace(/\.$/, '');

    if (row[notificationField] && !force) {
      return res.status(409).json({
        success: false,
        alreadyNotified: true,
        notifiedAt: row[notificationField],
        message: `El aviso de ${documentType} ya fue registrado previamente el ${formatNotificationDate(row[notificationField])}.`
      });
    }

    const claimAt = new Date();
    await PesvParqueaderoRegistro.update(
      { [notificationField]: claimAt, actualizado_por: req.user?.id },
      { where: { id: row.id } }
    );

    const result = await sendPesvExpiryNotification(row, tipo);
    if (!result.success) {
      if (!force) await PesvParqueaderoRegistro.update({ [notificationField]: null }, { where: { id: row.id } });
      return res.status(503).json({ success: false, message: `No se pudo enviar el correo: ${result.error}` });
    }
    return res.json({ success: true, message: `Notificación de ${documentType} ${force ? 'reenviada' : 'enviada'} exitosamente a ${row.correo}` });
  } catch (error) { return res.status(500).json({ success: false, message: 'No se pudo enviar la notificación' }); }
};

const normalizeInstitutionalText = (value = '') => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
const institutionalPeriodRank = (value = '') => {
  const text = normalizeInstitutionalText(value);
  if (/(^|\s)(IIP|II|2|SEGUNDO)(\s|$)/.test(text)) return 2;
  if (/(^|\s)(IP|I|1|PRIMERO)(\s|$)/.test(text)) return 1;
  return Number.parseInt(text.replace(/\D/g, ''), 10) || 0;
};
const institutionalPeriodScore = (row, periodField = 'periodo') => (Number(row?.anio) || 0) * 10 + institutionalPeriodRank(row?.[periodField]);
const latestInstitutionalRow = (rows = [], periodField = 'periodo') => [...rows].sort((a, b) =>
  institutionalPeriodScore(b, periodField) - institutionalPeriodScore(a, periodField) || (Number(b.id) || 0) - (Number(a.id) || 0)
)[0] || null;
const matriculatedFullName = (row = {}) => [row.primer_nombre, row.segundo_nombre, row.primer_apellido, row.segundo_apellido]
  .map((value) => String(value || '').trim()).filter(Boolean).join(' ');

const lookupPersona = async (req, res) => {
  try {
    const rawIdentificacion = clean(req.query.identificacion, 60);
    if (!rawIdentificacion || rawIdentificacion.trim().length < 3) return res.json({ success: true, found: false, data: null });
    const cleanId = rawIdentificacion.replace(/[^a-zA-Z0-9]/g, '');
    const normalizedMatch = (column) => sequelize.where(sequelize.fn('REGEXP_REPLACE', sequelize.col(column), '[^a-zA-Z0-9]', 'g'), cleanId);

    const [pesvRow, userRows, docenteRows, adminRows, caracterizacionRows, matriculadoRows] = await Promise.all([
      PesvParqueaderoRegistro.findOne({
        where: {
          [Op.or]: [
            normalizedMatch('identificacion'),
            normalizedMatch('placa')
          ]
        },
        order: [['id', 'DESC']]
      }),
      User ? User.findAll({ where: normalizedMatch('username'), order: [['updated_at', 'DESC'], ['id', 'DESC']] }) : [],
      RecursoHumanoDocente ? RecursoHumanoDocente.findAll({ where: normalizedMatch('identificacion') }) : [],
      RecursoHumanoAdministrativo ? RecursoHumanoAdministrativo.findAll({ where: normalizedMatch('numero_cedula') }) : [],
      PoblacionalCaracterizacion ? PoblacionalCaracterizacion.findAll({ where: normalizedMatch('no_identificacion') }) : [],
      PoblacionalMatriculado ? PoblacionalMatriculado.findAll({ where: normalizedMatch('numero_documento') }) : []
    ]);

    const userRow = userRows[0] || null;
    const docenteRow = latestInstitutionalRow(docenteRows);
    const activeAdminRows = adminRows.filter((row) => !row.estado_laboral || normalizeInstitutionalText(row.estado_laboral).includes('ACTIVO'));
    const adminRow = latestInstitutionalRow(activeAdminRows.length ? activeAdminRows : adminRows);
    const caracterizacionRow = latestInstitutionalRow(caracterizacionRows);
    const matriculadoRow = latestInstitutionalRow(matriculadoRows, 'semestre');
    const cargoText = normalizeInstitutionalText(userRow?.cargo);
    const explicitUserType = cargoText.includes('DOCENTE') ? 'DOCENTE'
      : cargoText.includes('ESTUDIANTE') ? 'ESTUDIANTE'
        : cargoText ? 'ADMINISTRATIVO' : null;
    const docenteScore = institutionalPeriodScore(docenteRow);
    const adminScore = institutionalPeriodScore(adminRow);
    const employeeType = docenteScore >= adminScore && docenteRow ? 'DOCENTE' : adminRow ? 'ADMINISTRATIVO' : docenteRow ? 'DOCENTE' : null;
    const employeeScore = Math.max(docenteScore, adminScore);
    const studentScore = Math.max(institutionalPeriodScore(matriculadoRow, 'semestre'), institutionalPeriodScore(caracterizacionRow));
    const vinculacion = explicitUserType || (studentScore > employeeScore ? 'ESTUDIANTE' : employeeType) || (matriculadoRow || caracterizacionRow ? 'ESTUDIANTE' : userRow ? 'ADMINISTRATIVO' : null);

    const pesvFallback = pesvRow ? {
      identificacion: pesvRow.identificacion,
      nombres_apellidos: pesvRow.nombres_apellidos,
      correo: pesvRow.correo,
      vinculacion: pesvRow.vinculacion,
      dependencia_programa: pesvRow.dependencia_programa,
      campus: pesvRow.campus,
      parqueadero_ingreso: pesvRow.parqueadero_ingreso,
      tiene_licencia: pesvRow.tiene_licencia !== false ? 'SI' : 'NO',
      licencia_categorias: pesvRow.licencia_categorias,
      licencia_expedicion: pesvRow.licencia_expedicion,
      licencia_vencimiento: pesvRow.licencia_vencimiento,
      tipo_vehiculo: pesvRow.tipo_vehiculo,
      placa: pesvRow.placa,
      vehiculo_clase: pesvRow.vehiculo_clase,
      vehiculo_servicio: pesvRow.vehiculo_servicio,
      vehiculo_modelo: pesvRow.vehiculo_modelo,
      vehiculo_fecha_matricula: pesvRow.vehiculo_fecha_matricula,
      vehiculo_autorizado: pesvRow.vehiculo_autorizado === true ? 'SI' : pesvRow.vehiculo_autorizado === false ? 'NO' : '',
      vehiculo_es_propio: pesvRow.vehiculo_es_propio === false ? 'NO' : 'SI',
      propietario_identificacion: pesvRow.propietario_identificacion,
      soat_vigencia: pesvRow.soat_vigencia,
      soat_fecha_expedicion: pesvRow.soat_fecha_expedicion,
      soat_fecha_inicio: pesvRow.soat_fecha_inicio,
      soat_numero_poliza: pesvRow.soat_numero_poliza,
      soat_entidad: pesvRow.soat_entidad,
      tecnomecanica_vigencia: pesvRow.tecnomecanica_vigencia,
      rtm_estado: pesvRow.rtm_estado,
      rtm_fecha_expedicion: pesvRow.rtm_fecha_expedicion,
      rtm_fecha_exigibilidad: pesvRow.rtm_fecha_exigibilidad,
      rtm_numero_certificado: pesvRow.rtm_numero_certificado,
      rtm_cda: pesvRow.rtm_cda,
      observaciones: pesvRow.observaciones
    } : {};
    const commonFallback = {
      identificacion: userRow?.username || rawIdentificacion,
      nombres_apellidos: userRow?.nombre || pesvFallback.nombres_apellidos || '',
      correo: userRow?.email || caracterizacionRow?.correo_electronico || pesvFallback.correo || '',
      campus: pesvFallback.campus || ''
    };
    let data = null;
    let source = '';
    let sourcePeriod = '';

    if (vinculacion === 'DOCENTE') {
      data = {
        ...pesvFallback,
        ...commonFallback,
        identificacion: docenteRow?.identificacion || commonFallback.identificacion,
        nombres_apellidos: userRow?.nombre || docenteRow?.docente || commonFallback.nombres_apellidos,
        vinculacion: 'DOCENTE',
        dependencia_programa: docenteRow?.departamento_dependencia || docenteRow?.programa || userRow?.dependencia || pesvFallback.dependencia_programa || ''
      };
      source = docenteRow ? 'Base de Docentes' : 'Usuario SIAC · cargo docente';
      sourcePeriod = docenteRow ? `${docenteRow.anio || ''} ${docenteRow.periodo || ''}`.trim() : '';
    } else if (vinculacion === 'ADMINISTRATIVO') {
      data = {
        ...pesvFallback,
        ...commonFallback,
        identificacion: adminRow?.numero_cedula || commonFallback.identificacion,
        nombres_apellidos: userRow?.nombre || adminRow?.nombre_empleado || commonFallback.nombres_apellidos,
        vinculacion: 'ADMINISTRATIVO',
        dependencia_programa: adminRow?.dependencia || userRow?.dependencia || adminRow?.vicerectoria || pesvFallback.dependencia_programa || ''
      };
      source = adminRow ? 'Base de Administrativos' : 'Usuarios del Sistema SIAC';
      sourcePeriod = adminRow ? `${adminRow.anio || ''} ${adminRow.periodo || ''}`.trim() : '';
    } else if (vinculacion === 'ESTUDIANTE') {
      data = {
        ...pesvFallback,
        ...commonFallback,
        identificacion: matriculadoRow?.numero_documento || caracterizacionRow?.no_identificacion || commonFallback.identificacion,
        nombres_apellidos: matriculatedFullName(matriculadoRow) || caracterizacionRow?.apellidos_nombres || commonFallback.nombres_apellidos,
        correo: userRow?.email || caracterizacionRow?.correo_electronico || pesvFallback.correo || '',
        vinculacion: 'ESTUDIANTE',
        dependencia_programa: matriculadoRow?.programa || caracterizacionRow?.programa || matriculadoRow?.facultad || pesvFallback.dependencia_programa || ''
      };
      source = matriculadoRow ? 'Base de Matriculados' : 'Base de Caracterización Estudiantil';
      sourcePeriod = matriculadoRow ? `${matriculadoRow.anio || ''}-${matriculadoRow.semestre || ''}`.replace(/-$/, '') : `${caracterizacionRow?.anio || ''} ${caracterizacionRow?.periodo || ''}`.trim();
    } else if (pesvRow) {
      data = { ...pesvFallback, ...commonFallback, vinculacion: pesvRow.vinculacion || '', dependencia_programa: pesvFallback.dependencia_programa || '' };
      source = 'Registros PESV Parqueaderos (histórico de parqueaderos)';
    }

    if (!data) return res.json({ success: true, found: false, data: null });
    return res.json({ success: true, found: true, source: sourcePeriod ? `${source} · período ${sourcePeriod}` : source, data });
  } catch (error) {
    console.error('Error buscando persona por identificación:', error);
    return res.status(500).json({ success: false, message: 'No se pudo buscar la persona' });
  }
};

module.exports = {
  list, create, update, remove, reactivate, importExcel, downloadExcelTemplate, exportExcelData, notifyExpiry,
  startRuntValidation, captureManualRuntResult, getRuntValidation,
  confirmRuntValidation, notifyRuntUpdate, getRuntHistory, lookupPersona
};
