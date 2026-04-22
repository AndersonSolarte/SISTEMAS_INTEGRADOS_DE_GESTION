const { Op, fn, col, literal, QueryTypes } = require('sequelize');
const crypto = require('crypto');
const {
  User,
  DiccionarioCorreccionTexto,
  Estadistica,
  GestionInformacionCarga,
  PoblacionalInscrito,
  PoblacionalAdmitido,
  PoblacionalPrimerCurso,
  PoblacionalMatriculado,
  PoblacionalGraduado,
  PoblacionalCaracterizacion,
  PoblacionalCantidadTotalEgresado,
  PoblacionalDesercionPeriodo,
  PoblacionalDesercionCohorte,
  PoblacionalDesercionAnual,
  PoblacionalContextoExterno,
  PoblacionalEmpleabilidad,
  RefDepartamento,
  RefMunicipio,
  RefDivipolaCarga,
  MatriculadosUbicacionIncidencia,
  Saber11Resultado,
  SaberProResultadoIndividual,
  SaberProResultadoAgregado,
  GeorreferenciaDepartamento,
  GeorreferenciaMunicipio,
  RecursoHumanoDocente,
  RecursoHumanoAdministrativo,
  RecursoHumanoOutsourcing,
  RecursoHumanoOnda
} = require('../models');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const divipolaMatchService = require('../services/divipolaMatchService');

const validateAdminConfirmation = async (req, res) => {
  const { identifier, password } = req.body || {};

  if (!identifier || !password) {
    res.status(400).json({
      success: false,
      message: 'Debe enviar usuario/correo y contraseña de administrador'
    });
    return null;
  }

  const normalizedIdentifier = String(identifier).trim().toLowerCase();
  const currentEmail = String(req.user?.email || '').trim().toLowerCase();
  const currentUsername = String(req.user?.username || '').trim().toLowerCase();

  if (normalizedIdentifier !== currentEmail && normalizedIdentifier !== currentUsername) {
    res.status(403).json({
      success: false,
      message: 'El usuario de confirmación debe ser el administrador autenticado'
    });
    return null;
  }

  const admin = await User.findByPk(req.user?.id);
  if (!admin || admin.role !== 'administrador' || admin.estado !== 'activo') {
    res.status(403).json({
      success: false,
      message: 'No autorizado para esta operación'
    });
    return null;
  }

  const isMatch = await admin.comparePassword(password);
  if (!isMatch) {
    res.status(401).json({
      success: false,
      message: 'Credenciales de administrador inválidas'
    });
    return null;
  }

  return admin;
};

const clearDatasetStorage = async ({
  categoria,
  subcategoria,
  poblacionalConfig = null,
  saberProConfig = null,
  recursoHumanoConfig = null
}) => {
  const where = { categoria };
  if (subcategoria) where.subcategoria = subcategoria;

  const deleted = await Estadistica.destroy({ where });
  const deletedLogs = await GestionInformacionCarga.destroy({ where });

  if (categoria === 'Poblacional') {
    if (poblacionalConfig) {
      if (poblacionalConfig.model) {
        await poblacionalConfig.model.destroy({ where: {} });
      } else if (Array.isArray(poblacionalConfig.models) && poblacionalConfig.models.length > 0) {
        await Promise.all(poblacionalConfig.models.map((model) => model.destroy({ where: {} })));
      }
    } else if (!subcategoria) {
      await Promise.all([
        PoblacionalInscrito.destroy({ where: {} }),
        PoblacionalAdmitido.destroy({ where: {} }),
        PoblacionalPrimerCurso.destroy({ where: {} }),
        PoblacionalMatriculado.destroy({ where: {} }),
        PoblacionalGraduado.destroy({ where: {} }),
        PoblacionalCaracterizacion.destroy({ where: {} }),
        PoblacionalCantidadTotalEgresado.destroy({ where: {} }),
        PoblacionalDesercionPeriodo.destroy({ where: {} }),
        PoblacionalDesercionCohorte.destroy({ where: {} }),
        PoblacionalDesercionAnual.destroy({ where: {} }),
        PoblacionalContextoExterno.destroy({ where: {} }),
        PoblacionalEmpleabilidad.destroy({ where: {} })
      ]);
    }
  }

  if (categoria === 'Saber Pro') {
    if (saberProConfig?.label === 'Resultados Saber 11') {
      await Saber11Resultado.destroy({ where: {} });
    } else if (saberProConfig?.label === 'Resultados individuales') {
      await SaberProResultadoIndividual.destroy({ where: {} });
    } else if (saberProConfig?.label === 'Resultados agregados') {
      await SaberProResultadoAgregado.destroy({ where: {} });
    } else if (!subcategoria) {
      await Promise.all([
        Saber11Resultado.destroy({ where: {} }),
        SaberProResultadoIndividual.destroy({ where: {} }),
        SaberProResultadoAgregado.destroy({ where: {} })
      ]);
    }
  }

  if (categoria === 'Recurso Humano') {
    if (recursoHumanoConfig?.model) {
      await recursoHumanoConfig.model.destroy({ where: {} });
    } else if (!subcategoria) {
      await Promise.all([
        RecursoHumanoDocente.destroy({ where: {} }),
        RecursoHumanoAdministrativo.destroy({ where: {} }),
        RecursoHumanoOutsourcing.destroy({ where: {} }),
        RecursoHumanoOnda.destroy({ where: {} })
      ]);
    }
  }

  if (categoria === 'Georreferencia') {
    await Promise.all([
      GeorreferenciaDepartamento.destroy({ where: {} }),
      GeorreferenciaMunicipio.destroy({ where: {} })
    ]);
  }

  return { deleted, deletedLogs };
};

const DATASET_CATEGORIES = {
  poblacional: 'Poblacional',
  georreferencia: 'Georreferencia',
  georeferencia: 'Georreferencia',
  biblioteca: 'Biblioteca',
  medios_educativos: 'Medios Educativos',
  internacionalizacion: 'InternacionalizaciÃƒÆ’Ã‚Â³n',
  investigacion: 'InvestigaciÃƒÆ’Ã‚Â³n',
  proyectos_convenios: 'Proyectos y Convenios',
  recurso_humano: 'Recurso Humano',
  saber_pro: 'Saber Pro'
};

const GEOREFERENCIA_TEMPLATE_HEADERS = {
  'DIVIPOLA Departamento': {
    'Listado Vigentes': [
      'Codigo Departamento',
      'Codigo Municipio',
      'Codigo Centro Poblado',
      'Nombre Departamento',
      'Nombre Municipio',
      'Nombre Centro Poblado',
      'Tipo'
    ]
  }
};

const GEOREFERENCIA_CANONICAL_SUBCATEGORY = 'DIVIPOLA Departamento';
const GEOREFERENCIA_TEMPLATE_CONFIG = {
  [GEOREFERENCIA_CANONICAL_SUBCATEGORY]: {
    ESTRUCTURA: ['Nombre de campo', 'Contenido'],
    'Listado Vigentes': GEOREFERENCIA_TEMPLATE_HEADERS[GEOREFERENCIA_CANONICAL_SUBCATEGORY]['Listado Vigentes']
  }
};

const GEOREFERENCIA_STRUCTURE_ROWS = [
  ['Codigo Departamento', 'Codigo DANE del departamento (2 digitos). Obligatorio.'],
  ['Codigo Municipio', 'Codigo DANE del municipio (5 digitos). Recomendado para cruce municipal.'],
  ['Codigo Centro Poblado', 'Codigo DIVIPOLA del centro poblado (opcional).'],
  ['Nombre Departamento', 'Nombre oficial del departamento. Obligatorio.'],
  ['Nombre Municipio', 'Nombre oficial del municipio. Recomendado.'],
  ['Nombre Centro Poblado', 'Nombre oficial del centro poblado (opcional).'],
  ['Tipo', 'Tipo de registro segun fuente DIVIPOLA (opcional).']
];

const resolveGeorreferenciaSubcategory = () => GEOREFERENCIA_CANONICAL_SUBCATEGORY;

const POBLACIONAL_TEMPLATE_HEADERS = {
  Inscritos: ['AÃƒÆ’Ã¢â‚¬ËœO', 'IES', 'DOCUMENTO', 'ID TIPO DOCUMENTO', 'PRIMER NOMBRE', 'SEGUNDO NOMBRE', 'PRIMER APELLIDO', 'SEGUNDO APELLIDO', 'PROGRAMA', 'GENERO BIOLOGICO', 'CONTEO', 'PERIODO', 'FACULTAD'],
  Admitidos: ['AÃƒÆ’Ã¢â‚¬ËœO', 'NOMBRE IES', 'PROGRAMA', 'TIPO DOCUMENTO', 'NÃƒÆ’Ã…Â¡MERO DOCUMENTO', 'GENERO BIOLÃƒÆ’Ã¢â‚¬Å“GICO', 'CONTEO', 'PERIODO', 'FACULTAD'],
  'Primer Curso': ['AÃƒÆ’Ã¢â‚¬ËœO', 'NOMBRE IES', 'TIPO DOCUMENTO', 'NUMERO DOCUMENTO', 'PRIMER NOMBRE', 'SEGUNDO NOMBRE', 'PRIMER APELLIDO', 'SEGUNDO APELLIDO', 'PROGRAMA', 'GRUPO ÃƒÆ’Ã¢â‚¬Â°TNICO', 'PUEBLO INDIGENA', 'COMUNIDAD NEGRA', 'CAPACIDAD EXCEPCIONAL', 'GENERO BIOLÃƒÆ’Ã¢â‚¬Å“GICO', 'CONTEO', 'PERIODO', 'FACULTAD'],
  Matriculados: [
    'CÓDIGO IES',
    'NOMBRE IES',
    'AÑO',
    'SEMESTRE',
    'PARTICIPANTE',
    'TIPO DOCUMENTO',
    'NUMERO DOCUMENTO',
    'OTROS DOCUMENTOS',
    'CODIGO ESTUDIANTE',
    'SEXO BIOLOGICO',
    'PRIMER NOMBRE',
    'SEGUNDO NOMBRE',
    'PRIMER APELLIDO',
    'SEGUNDO APELLIDO',
    'PROGRAMA CONSECUTIVO',
    'PROGRAMA',
    'COD DANE',
    'DEPARTAMENTO',
    'MUNICIPIO',
    'FECHA NACIMIENTO',
    'ID PAIS',
    'PAIS',
    'COD DANE NACIMIENTO',
    'DEPARTAMENTO NACIMIENTO',
    'MUNICIPIO NACIMIENTO',
    'ID ZONA RESIDENCIA',
    'ZONA RESIDENCIA',
    'NUMERO MATERIAS INSCRITAS',
    'NUMERO MATERIAS APROBADAS',
    'ES_REINTEGRO_ESTD_ANTES_DE1998',
    'AÑO_PRIMER_CURSO',
    'SEMESTRE_PRIMER_CURSO',
    'VALOR_DERECHOS_MATRÍCULA',
    'ESTRATO',
    'FUENTE',
    'FECHA_ULTIMO_CARGUE'
  ],
  Graduados: ['AÃƒÆ’Ã¢â‚¬ËœO', 'NOMBRE IES', 'TIPO DOCUMENTO', 'NUMERO DOCUMENTO', 'PRIMER NOMBRE', 'SEGUNDO NOMBRE', 'PRIMER APELLIDO', 'SEGUNDO APELLIDO', 'PROGRAMA', 'DEPARTAMENTO', 'MUNICIPIO', 'No ACTA GRADO', 'FECHA GRADO', 'FOLIO', 'VERIFICADO', 'GENERO BIOLOGICO', 'PERIODO', 'FACULTAD']
  ,
  Caracterizacion: ['AÃƒÆ’Ã¢â‚¬ËœO', 'PERIODO', 'No IDENTIFICACION', 'TIPO DOCUMENTACION', 'PROGRAMA', 'CODIGO', 'SEMESTRE', 'APELLIDOS NOMBRES', 'GENERO', 'VICTIMA DE CONFLICTO ARMADO', 'CORREO ELECTRONICO', 'PERSONAS A CARGO', 'ESTADO CIVIL', 'GRUPO ETNICO', 'EPS', 'MUNICIPIO_RESIDENCIA', 'DEPARTAMENTO_RESIDENCIA', 'PAIS_RESIDENCIA', 'DISCAPACIDAD', 'NUCLEO_FAMILIAR', 'ESTRATO', 'ingresos_familiares', 'INGRESOS_FAMILIARES', 'institucion', 'titulo_obtenido', 'Tipo_CRÃƒÆ’Ã¢â‚¬Â°DITO', 'Edad', 'Zona procedencia'],
  'Cantidad Total Egresados': ['AÃƒÆ’Ã¢â‚¬ËœOS', 'PROGRAMA', 'CANTIDAD', 'DETALLE'],
  'Desercion por periodo': ['PERIODO', 'DESERCION', 'DESERCIÃƒÆ’Ã¢â‚¬Å“N_NACIONAL', 'DESERCIÃƒÆ’Ã¢â‚¬Å“N_DEPARTAMETAL', 'DESERCIÃƒÆ’Ã¢â‚¬Å“N_INSTITUCIONAL', 'DESERCIÃƒÆ’Ã¢â‚¬Å“N_DEL_PROGRAMA', 'PROGRAMA'],
  'Desercion por cohorte': ['PERIODOS', 'DESERCION', 'CORTE_INFORMACION', 'DESERCIÃƒÆ’Ã¢â‚¬Å“N_NACIONAL', 'DESERCIÃƒÆ’Ã¢â‚¬Å“N_DEPARTAMETAL', 'DESERCIÃƒÆ’Ã¢â‚¬Å“N_INSTITUCIONAL', 'DESERCIÃƒÆ’Ã¢â‚¬Å“N_DEL_PROGRAMA', 'PROGRAMAS'],
  'Desercion anual': ['PERIODOS', 'DESERCION', 'DESERCION_NACIONAL', 'DESERCION_DEPARTAMETAL', 'DESERCION_INSTITUCIONAL', 'DESERCION_DEL_PROGRAMA', 'PROGRAMAS'],
  Empleabilidad: ['AÃƒÆ’Ã¢â‚¬ËœO', 'IES', 'EMPLEABILIDAD_PROGRAMA', 'EMPLEABILIDAD_NACIONAL', 'DENOMINACIÃƒÆ’Ã¢â‚¬Å“N_PROGRAMA']
};

const SABER_PRO_TEMPLATE_HEADERS = {
  'Resultados individuales': [
    'Tipo de documento',
    'Documento',
    'Nombre',
    'Número de registro',
    'Tipo de evaluado',
    'SNIES programa académico',
    'Programa',
    'Ciudad',
    'Grupo de referencia',
    'Puntaje global',
    'Percentil nacional global',
    'Percentil grupo de referencia',
    'Módulo',
    'Puntaje módulo',
    'Nivel de desempeño',
    'Percentil nacional módulo',
    'Percentil grupo de referencia módulo',
    'Novedades',
    'AÑO',
    'PERIODO',
    'PERIODO ICFES',
    'LUEGAR_PRESENTACION ',
    'MODALIDAD'
  ],
  'Resultados agregados': [
    'AÑO',
    'PROGRAMA',
    'COMPETENCIA',
    'PUNTAJE PROGRAMA',
    'PUNTAJE INSTITUCIÓN',
    'PUNTAJE GRUPO DE REFERENCIA',
    'TIPO_PRUEBA'
  ]
};

const SABER11_TEMPLATE_HEADERS = {
  Tipo_1: [
    'AÑO',
    'PERIODO',
    'JORNADA',
    'PROGRAMA',
    'APELLIDOS',
    'NOMBRES',
    'IDENTIFICACION',
    'CODIGO',
    'TIPO',
    'CODIGO_ICFES',
    'GENERO',
    'APTITUD MATEMATICA',
    'APTITUD VERBAL',
    'BIOLOGIA',
    'CONOCIMIENTO MATEMATICO',
    'ELECTIVA',
    'ESPAÑOL Y LITERATURA',
    'FISICA',
    'QUIMICA',
    'SOCIALES'
  ],
  Tipo_2: [
    'AÑO',
    'PERIODO',
    'JORNADA',
    'PROGRAMA',
    'APELLIDOS',
    'NOMBRES',
    'IDENTIFICACION',
    'CODIGO',
    'TIPO',
    'CODIGO_ICFES',
    'GENERO',
    'APTITUD MATEMATICA',
    'BIOLOGIA',
    'CONOCIMIENTO MATEMATICO',
    'ELECTIVA',
    'FISICA',
    'LENGUAJE',
    'QUIMICA',
    'SOCIALES'
  ],
  Tipo_3: [
    'AÑO',
    'PERIODO',
    'JORNADA',
    'PROGRAMA',
    'APELLIDOS',
    'NOMBRES',
    'IDENTIFICACION',
    'CODIGO',
    'TIPO',
    'CODIGO_ICFES',
    'GENERO',
    'BIOLOGIA',
    'ELECTIVA',
    'FILOSOFIA',
    'FISICA',
    'GEOGRAFIA',
    'HISTORIA',
    'INGLES',
    'LENGUAJE',
    'MATEMATICAS',
    'QUIMICA'
  ],
  Tipo_4: [
    'AÑO',
    'PERIODO',
    'JORNADA',
    'PROGRAMA',
    'APELLIDOS',
    'NOMBRES',
    'IDENTIFICACION',
    'CODIGO',
    'TIPO',
    'CODIGO_ICFES',
    'GENERO',
    'BIOLOGIA',
    'ELECTIVA',
    'FILOSOFIA',
    'FISICA',
    'INGLES',
    'LENGUAJE',
    'MATEMATICAS',
    'QUIMICA',
    'SOCIALES'
  ],
  Tipo_5: [
    'AÑO',
    'PERIODO',
    'JORNADA',
    'PROGRAMA',
    'APELLIDOS',
    'NOMBRES',
    'IDENTIFICACION',
    'CODIGO',
    'TIPO',
    'CODIGO_ICFES',
    'GENERO',
    'CIENCIAS NATURALES',
    'COMPETENCIAS CIUDADANAS',
    'INGLES',
    'LECTURA CRITICA',
    'MATEMATICAS',
    'RAZONAMIENTO CUANTITATIVO',
    'SOCIALES Y CIUDADANA'
  ],
  Tipo_6: [
    'AÑO',
    'PERIODO',
    'JORNADA',
    'PROGRAMA',
    'APELLIDOS',
    'NOMBRES',
    'IDENTIFICACION',
    'CODIGO',
    'TIPO',
    'CODIGO_ICFES',
    'GENERO',
    'CIENCIAS NATURALES',
    'INGLES',
    'LECTURA CRITICA',
    'MATEMATICAS',
    'SOCIALES Y CIUDADANA'
  ],
  Tipo_7: [
    'AÑO',
    'PERIODO',
    'JORNADA',
    'PROGRAMA',
    'APELLIDOS',
    'NOMBRES',
    'IDENTIFICACION',
    'CODIGO',
    'TIPO',
    'CODIGO_ICFES',
    'GENERO',
    'ABSTRACTA',
    'LOGICA',
    'VERBAL'
  ]
};
const SABER11_SHEET_NAMES = Object.keys(SABER11_TEMPLATE_HEADERS);
const SABER11_FIELD_MAP = {
  documento: ['documento', 'Documento', 'IDENTIFICACION'],
  anio: ['anio', 'AÑO', 'ANO', 'ANIO', 'Ano'],
  tipo_examen: ['tipo_examen', 'Tipo examen', 'TIPO'],
  lectura_critica: ['lectura_critica', 'LECTURA CRITICA', 'APTITUD VERBAL', 'VERBAL'],
  matematicas: ['matematicas', 'MATEMATICAS', 'LOGICA'],
  sociales: ['sociales', 'SOCIALES'],
  biologia: ['biologia', 'BIOLOGIA'],
  fisica: ['fisica', 'FISICA'],
  quimica: ['quimica', 'QUIMICA'],
  lenguaje: ['lenguaje', 'LENGUAJE'],
  filosofia: ['filosofia', 'FILOSOFIA'],
  historia: ['historia', 'HISTORIA'],
  geografia: ['geografia', 'GEOGRAFIA'],
  ingles: ['ingles', 'INGLES'],
  espanol_y_literatura: ['espanol_y_literatura', 'ESPAÑOL Y LITERATURA', 'ESPANOL Y LITERATURA'],
  conocimiento_matematico: ['conocimiento_matematico', 'CONOCIMIENTO MATEMATICO'],
  aptitud_matematica: ['aptitud_matematica', 'APTITUD MATEMATICA'],
  electiva: ['electiva', 'ELECTIVA'],
  ciencias_naturales: ['ciencias_naturales', 'CIENCIAS NATURALES', 'CIENCIAS_NATURALES'],
  razonamiento_cuantitativo: ['razonamiento_cuantitativo', 'RAZONAMIENTO CUANTITATIVO', 'RAZONAMIENTO_CUANTITATIVO'],
  competencias_ciudadanas: ['competencias_ciudadanas', 'COMPETENCIAS CIUDADADANAS', 'COMPETENCIAS CIUDADANAS'],
  sociales_y_ciudadana: ['sociales_y_ciudadana', 'SOCIALES Y CIUDADADANA', 'SOCIALES Y CIUDADANA', 'SOCIALES_Y_CIUDADANA'],
  global: ['global', 'GLOBAL'],
  tipo_prueba: ['tipo_prueba', 'Tipo prueba', 'TIPO PRUEBA']
};

const RECURSO_HUMANO_TEMPLATE_HEADERS = {
  Docentes: ['AÃƒÆ’Ã¢â‚¬ËœO', 'IdentificaciÃƒÆ’Ã‚Â³n', 'DOCENTE', 'GENERO BIÃƒÆ’Ã¢â‚¬Å“LOGICO', 'DEPARTAMENTO/DEPENDENCIA', 'PROGRAMA', 'TIPOVINCULACIÃƒÆ’Ã¢â‚¬Å“N', 'CONTRATO', 'HORAS INDIRECTAS', '% HORAS INDIRECTAS', 'Horas Administrativas', '% Horas Administrativas', 'Horas InvestigaciÃƒÆ’Ã‚Â³n', '% Horas InvestigaciÃƒÆ’Ã‚Â³n', 'Horas ProyecciÃƒÆ’Ã‚Â³n Institucional', '% Horas ProyecciÃƒÆ’Ã‚Â³n Institucional', 'Horas Academicas', '% Horas Academicas', 'Horas Aseguramiento de la Calidad', '% Horas Aseguramiento de la Calidad', 'Total Horas', 'PORCENTAJE TOTAL', 'FECHA_NACIMIENTO', 'EDAD', 'PAIS', 'MUNICIPIO_NACIMIENTO', 'NIVEL MAXIMO ESTUDIO', 'TITULO RECIBIDO', 'FECHA GRADO', 'PAIS INSTITUCION ESTUDIO', 'TITULO CONVALIDADO', 'NOMBRE INSTITUCION ESTUDIO', 'METODOLOGIA PROGRAMA', 'FECHA INGRESO', 'TOTAL TIEMPO', 'Total docentes', 'ESCALAFÃƒÆ’Ã¢â‚¬Å“N', 'CARGO', 'PERIODO'],
  Administrativos: ['PERIODO', 'NÃƒâ€šÃ‚Âº CÃƒÆ’Ã‚Â©dula', 'Activo /Retirado', 'Nombre Empleado', 'Cargo Especifico', 'Dependencia', 'GRADO', 'Vicerectoria', 'Tipo de cotizante', 'Clase de Contrato', 'FECHA INICIO', 'FECHA DE TERMINACION', 'Sueldo aÃƒÆ’Ã‚Â±o 2023', 'Auxilio Transporte 2023', 'Dias Trabajados Septiembre 2023', 'Sueldo Mes Septiembre 2023', 'Dias Auxilio Transporte', 'Auxilio Transporte', 'CORTE INFORMACIÃƒÆ’Ã¢â‚¬Å“N', 'GENERO BIÃƒÆ’Ã¢â‚¬Å“LOGICO', 'AÃƒÆ’Ã¢â‚¬ËœO'],
  Outsourcing: ['AÃƒÆ’Ã¢â‚¬ËœO', 'CARGO', 'GENERO BIÃƒÆ’Ã¢â‚¬Å“LOGICO', 'CANTIDAD'],
  Ondas: ['PERIODO', 'NOMBRE', 'GENERO', 'FECHA DE CORTE']
};

const GEOREFERENCIA_SUBCATEGORIA_DIVIPOLA = 'DIVIPOLA Departamento';
// Columnas UNIFICADAS: plantilla descarga = exportación de vigentes = reimportación sin edición
const DIVIPOLA_TEMPLATE_HEADERS = [
  'Codigo Departamento',
  'Nombre Departamento',
  'Codigo Municipio',
  'Nombre Municipio',
  'Latitud',
  'Longitud'
];

const normalizeHeader = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

const detectCsvDelimiter = (line = '') => {
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestScore = -1;
  for (const token of candidates) {
    const score = String(line || '').split(token).length - 1;
    if (score > bestScore) {
      best = token;
      bestScore = score;
    }
  }
  return best;
};

const parseCsvLine = (line = '', delimiter = ',') => {
  const out = [];
  let cur = '';
  let inQuotes = false;
  const text = String(line ?? '');

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
};

const streamCsvFile = async ({ filePath, onHeader, onRow }) => {
  const input = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let lineNumber = 0;
  let delimiter = ',';
  let headers = null;

  for await (let line of rl) {
    lineNumber += 1;
    if (lineNumber === 1) {
      line = String(line || '').replace(/^\uFEFF/, '');
      delimiter = detectCsvDelimiter(line);
      headers = parseCsvLine(line, delimiter);
      if (typeof onHeader === 'function') {
        await onHeader({ headers, delimiter, lineNumber });
      }
      continue;
    }

    if (!String(line || '').trim()) continue;
    const cells = parseCsvLine(line, delimiter);
    if (typeof onRow === 'function') {
      await onRow({ cells, lineNumber, delimiter, headers });
    }
    // Cede control periodicamente para evitar bloquear el event loop
    if (lineNumber % 2000 === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }
};

const POBLACIONAL_SUBCATEGORY_CONFIG = {
  INSCRITOS: {
    label: 'Inscritos',
    model: PoblacionalInscrito,
    headers: POBLACIONAL_TEMPLATE_HEADERS.Inscritos,
    map: {
      anio: ['AÃƒÆ’Ã¢â‚¬ËœO', 'ANO', 'ANIO', 'aÃƒÆ’Ã‚Â±o', 'anio'],
      ies: ['IES', 'NOMBRE IES'],
      documento: ['DOCUMENTO'],
      id_tipo_documento: ['ID TIPO DOCUMENTO'],
      primer_nombre: ['PRIMER NOMBRE'],
      segundo_nombre: ['SEGUNDO NOMBRE'],
      primer_apellido: ['PRIMER APELLIDO'],
      segundo_apellido: ['SEGUNDO APELLIDO'],
      programa: ['PROGRAMA'],
      genero_biologico: ['GENERO BIOLOGICO', 'GENERO BIOLÃƒÆ’Ã¢â‚¬Å“GICO'],
      conteo: ['CONTEO'],
      periodo: ['PERIODO'],
      facultad: ['FACULTAD']
    }
  },
  ADMITIDOS: {
    label: 'Admitidos',
    model: PoblacionalAdmitido,
    headers: POBLACIONAL_TEMPLATE_HEADERS.Admitidos,
    map: {
      anio: ['AÃƒÆ’Ã¢â‚¬ËœO', 'ANO', 'ANIO', 'aÃƒÆ’Ã‚Â±o', 'anio'],
      nombre_ies: ['NOMBRE IES', 'IES'],
      programa: ['PROGRAMA'],
      tipo_documento: ['TIPO DOCUMENTO'],
      numero_documento: ['NÃƒÆ’Ã…Â¡MERO DOCUMENTO', 'NUMERO DOCUMENTO'],
      genero_biologico: ['GENERO BIOLÃƒÆ’Ã¢â‚¬Å“GICO', 'GENERO BIOLOGICO'],
      conteo: ['CONTEO'],
      periodo: ['PERIODO'],
      facultad: ['FACULTAD']
    }
  },
  PRIMER_CURSO: {
    label: 'Primer Curso',
    model: PoblacionalPrimerCurso,
    headers: POBLACIONAL_TEMPLATE_HEADERS['Primer Curso'],
    map: {
      anio: ['AÃƒÆ’Ã¢â‚¬ËœO', 'ANO', 'ANIO', 'aÃƒÆ’Ã‚Â±o', 'anio'],
      nombre_ies: ['NOMBRE IES', 'IES'],
      tipo_documento: ['TIPO DOCUMENTO'],
      numero_documento: ['NUMERO DOCUMENTO', 'NÃƒÆ’Ã…Â¡MERO DOCUMENTO'],
      primer_nombre: ['PRIMER NOMBRE'],
      segundo_nombre: ['SEGUNDO NOMBRE'],
      primer_apellido: ['PRIMER APELLIDO'],
      segundo_apellido: ['SEGUNDO APELLIDO'],
      programa: ['PROGRAMA'],
      grupo_etnico: ['GRUPO ÃƒÆ’Ã¢â‚¬Â°TNICO', 'GRUPO ETNICO'],
      pueblo_indigena: ['PUEBLO INDIGENA'],
      comunidad_negra: ['COMUNIDAD NEGRA'],
      capacidad_excepcional: ['CAPACIDAD EXCEPCIONAL'],
      genero_biologico: ['GENERO BIOLÃƒÆ’Ã¢â‚¬Å“GICO', 'GENERO BIOLOGICO'],
      conteo: ['CONTEO'],
      periodo: ['PERIODO'],
      facultad: ['FACULTAD']
    }
  },
  MATRICULADOS: {
    label: 'Matriculados',
    model: PoblacionalMatriculado,
    headers: POBLACIONAL_TEMPLATE_HEADERS.Matriculados,
    strictHeaders: true,
    uniqueKeys: ['codigo_estudiante', 'anio', 'semestre', 'programa_consecutivo'],
    map: {
      codigo_ies: ['CÓDIGO IES', 'CODIGO IES'],
      nombre_ies: ['NOMBRE IES'],
      anio: ['AÑO', 'ANO'],
      semestre: ['SEMESTRE'],
      participante: ['PARTICIPANTE'],
      tipo_documento: ['TIPO DOCUMENTO'],
      numero_documento: ['NUMERO DOCUMENTO'],
      otros_documentos: ['OTROS DOCUMENTOS'],
      codigo_estudiante: ['CODIGO ESTUDIANTE'],
      sexo_biologico: ['SEXO BIOLOGICO'],
      primer_nombre: ['PRIMER NOMBRE'],
      segundo_nombre: ['SEGUNDO NOMBRE'],
      primer_apellido: ['PRIMER APELLIDO'],
      segundo_apellido: ['SEGUNDO APELLIDO'],
      programa_consecutivo: ['PROGRAMA CONSECUTIVO'],
      programa: ['PROGRAMA'],
      codigo_dane: ['COD DANE'],
      departamento: ['DEPARTAMENTO'],
      municipio: ['MUNICIPIO'],
      fecha_nacimiento: ['FECHA NACIMIENTO'],
      id_pais: ['ID PAIS'],
      pais: ['PAIS'],
      codigo_dane_nacimiento: ['COD DANE NACIMIENTO'],
      departamento_nacimiento: ['DEPARTAMENTO NACIMIENTO'],
      municipio_nacimiento: ['MUNICIPIO NACIMIENTO'],
      id_zona_residencia: ['ID ZONA RESIDENCIA'],
      zona_residencia: ['ZONA RESIDENCIA'],
      numero_materias_inscritas: ['NUMERO MATERIAS INSCRITAS'],
      numero_materias_aprobadas: ['NUMERO MATERIAS APROBADAS'],
      es_reintegro_estd_antes_de1998: ['ES_REINTEGRO_ESTD_ANTES_DE1998'],
      anio_primer_curso: ['AÑO_PRIMER_CURSO', 'ANO_PRIMER_CURSO'],
      semestre_primer_curso: ['SEMESTRE_PRIMER_CURSO'],
      valor_derechos_matricula: ['VALOR_DERECHOS_MATRÍCULA', 'VALOR_DERECHOS_MATRICULA'],
      estrato: ['ESTRATO'],
      fuente: ['FUENTE'],
      fecha_ultimo_cargue: ['FECHA_ULTIMO_CARGUE'],
      codigo_departamento: ['COD DPTO', 'CODIGO DEPARTAMENTO'],
      codigo_departamento_nacimiento: [
        'COD DPTO NACIMIENTO',
        'CODIGO DEPARTAMENTO NACIMIENTO',
        'COD DEPARTAMENTO NACIMIENTO',
        'CODIGO DANE DEPARTAMENTO NACIMIENTO'
      ]
    }
  },
  GRADUADOS: {
    label: 'Graduados',
    model: PoblacionalGraduado,
    headers: POBLACIONAL_TEMPLATE_HEADERS.Graduados,
    map: {
      anio: ['AÃƒÆ’Ã¢â‚¬ËœO', 'ANO', 'ANIO', 'aÃƒÆ’Ã‚Â±o', 'anio'],
      nombre_ies: ['NOMBRE IES', 'IES'],
      tipo_documento: ['TIPO DOCUMENTO'],
      numero_documento: ['NUMERO DOCUMENTO', 'NÃƒÆ’Ã…Â¡MERO DOCUMENTO'],
      primer_nombre: ['PRIMER NOMBRE'],
      segundo_nombre: ['SEGUNDO NOMBRE'],
      primer_apellido: ['PRIMER APELLIDO'],
      segundo_apellido: ['SEGUNDO APELLIDO'],
      programa: ['PROGRAMA'],
      departamento: ['DEPARTAMENTO'],
      municipio: ['MUNICIPIO'],
      no_acta_grado: ['No ACTA GRADO', 'NO ACTA GRADO'],
      fecha_grado: ['FECHA GRADO'],
      folio: ['FOLIO'],
      verificado: ['VERIFICADO'],
      genero_biologico: ['GENERO BIOLOGICO', 'GENERO BIOLÃƒÆ’Ã¢â‚¬Å“GICO'],
      periodo: ['PERIODO'],
      facultad: ['FACULTAD']
    }
  },
  CARACTERIZACION: {
    label: 'Caracterizacion',
    model: PoblacionalCaracterizacion,
    headers: POBLACIONAL_TEMPLATE_HEADERS.Caracterizacion,
    map: {
      anio: ['AÃƒÆ’Ã¢â‚¬ËœO', 'ANO', 'ANIO', 'PERIODO'],
      periodo: ['PERIODO'],
      no_identificacion: ['No IDENTIFICACION', 'NO IDENTIFICACION'],
      tipo_documentacion: ['TIPO DOCUMENTACION'],
      programa: ['PROGRAMA'],
      codigo: ['CODIGO'],
      semestre: ['SEMESTRE'],
      apellidos_nombres: ['APELLIDOS NOMBRES'],
      genero: ['GENERO'],
      victima_conflicto_armado: ['VICTIMA DE CONFLICTO ARMADO'],
      correo_electronico: ['CORREO ELECTRONICO'],
      personas_a_cargo: ['PERSONAS A CARGO'],
      estado_civil: ['ESTADO CIVIL'],
      grupo_etnico: ['GRUPO ETNICO', 'GRUPO ÃƒÆ’Ã¢â‚¬Â°TNICO'],
      eps: ['EPS'],
      municipio_residencia: ['MUNICIPIO_RESIDENCIA'],
      departamento_residencia: ['DEPARTAMENTO_RESIDENCIA'],
      pais_residencia: ['PAIS_RESIDENCIA'],
      discapacidad: ['DISCAPACIDAD'],
      nucleo_familiar: ['NUCLEO_FAMILIAR'],
      estrato: ['ESTRATO'],
      ingresos_familiares: ['ingresos_familiares'],
      ingresos_familiares_2: ['INGRESOS_FAMILIARES'],
      institucion: ['institucion', 'INSTITUCION'],
      titulo_obtenido: ['titulo_obtenido', 'TITULO_OBTENIDO'],
      tipo_credito: ['Tipo_CRÃƒÆ’Ã¢â‚¬Â°DITO', 'TIPO CREDITO', 'TIPO_CREDITO'],
      edad: ['Edad', 'EDAD'],
      zona_procedencia: ['Zona procedencia', 'ZONA PROCEDENCIA']
    }
  },
  CANTIDAD_TOTAL_EGRESADOS: {
    label: 'Cantidad Total Egresados',
    model: PoblacionalCantidadTotalEgresado,
    headers: POBLACIONAL_TEMPLATE_HEADERS['Cantidad Total Egresados'],
    map: {
      anio: ['AÃƒÆ’Ã¢â‚¬ËœOS', 'AÃƒÆ’Ã¢â‚¬ËœOS ', 'ANOS', 'AÃƒÆ’Ã¢â‚¬ËœO', 'ANO', 'ANIO'],
      programa: ['PROGRAMA'],
      cantidad: ['CANTIDAD', 'CANTIDAD '],
      detalle: ['DETALLE']
    }
  },
  CONTEXTO_EXTERNO: {
    label: 'Contexto Externo',
    headers: [],
    model: PoblacionalContextoExterno,
    customImport: 'contexto_externo'
  },
  DESERCION: {
    label: 'Desercion',
    headers: [],
    models: [PoblacionalDesercionPeriodo, PoblacionalDesercionCohorte, PoblacionalDesercionAnual],
    sheetTemplates: [
      { sheetName: 'DESERCION_POR_PERIODO', headers: POBLACIONAL_TEMPLATE_HEADERS['Desercion por periodo'], kind: 'periodo' },
      { sheetName: 'DESERCION_POR_COHORTE', headers: POBLACIONAL_TEMPLATE_HEADERS['Desercion por cohorte'], kind: 'cohorte' },
      { sheetName: 'DESERCION_ANUAL', headers: POBLACIONAL_TEMPLATE_HEADERS['Desercion anual'], kind: 'anual' }
    ],
    maps: {
      periodo: {
        periodo_referencia: ['PERIODO'],
        tipo_desercion: ['DESERCION'],
        desercion_nacional: ['DESERCIÃƒÆ’Ã¢â‚¬Å“N_NACIONAL', 'DESERCION_NACIONAL'],
        desercion_departamental: ['DESERCIÃƒÆ’Ã¢â‚¬Å“N_DEPARTAMETAL', 'DESERCION_DEPARTAMETAL'],
        desercion_institucional: ['DESERCIÃƒÆ’Ã¢â‚¬Å“N_INSTITUCIONAL', 'DESERCION_INSTITUCIONAL'],
        desercion_programa: ['DESERCIÃƒÆ’Ã¢â‚¬Å“N_DEL_PROGRAMA', 'DESERCION_DEL_PROGRAMA'],
        programa: ['PROGRAMA']
      },
      cohorte: {
        periodo_referencia: ['PERIODOS'],
        tipo_desercion: ['DESERCION'],
        corte_informacion: ['CORTE_INFORMACION'],
        desercion_nacional: ['DESERCIÃƒÆ’Ã¢â‚¬Å“N_NACIONAL', 'DESERCION_NACIONAL'],
        desercion_departamental: ['DESERCIÃƒÆ’Ã¢â‚¬Å“N_DEPARTAMETAL', 'DESERCION_DEPARTAMETAL'],
        desercion_institucional: ['DESERCIÃƒÆ’Ã¢â‚¬Å“N_INSTITUCIONAL', 'DESERCION_INSTITUCIONAL'],
        desercion_programa: ['DESERCIÃƒÆ’Ã¢â‚¬Å“N_DEL_PROGRAMA', 'DESERCION_DEL_PROGRAMA'],
        programa: ['PROGRAMAS', 'PROGRAMA']
      },
      anual: {
        periodo_referencia: ['PERIODOS', 'PERIODO'],
        tipo_desercion: ['DESERCION'],
        desercion_nacional: ['DESERCION_NACIONAL', 'DESERCIÃƒÆ’Ã¢â‚¬Å“N_NACIONAL'],
        desercion_departamental: ['DESERCION_DEPARTAMETAL', 'DESERCIÃƒÆ’Ã¢â‚¬Å“N_DEPARTAMETAL'],
        desercion_institucional: ['DESERCION_INSTITUCIONAL', 'DESERCIÃƒÆ’Ã¢â‚¬Å“N_INSTITUCIONAL'],
        desercion_programa: ['DESERCION_DEL_PROGRAMA', 'DESERCIÃƒÆ’Ã¢â‚¬Å“N_DEL_PROGRAMA'],
        programa: ['PROGRAMAS', 'PROGRAMA']
      }
    }
  },
  EMPLEABILIDAD: {
    label: 'Empleabilidad',
    headers: POBLACIONAL_TEMPLATE_HEADERS.Empleabilidad,
    model: PoblacionalEmpleabilidad,
    map: {
      anio: ['AÃƒÆ’Ã¢â‚¬ËœO', 'ANO', 'ANIO'],
      ies: ['IES'],
      empleabilidad_programa: ['EMPLEABILIDAD_PROGRAMA'],
      empleabilidad_nacional: ['EMPLEABILIDAD_NACIONAL'],
      denominacion_programa: ['DENOMINACIÃƒÆ’Ã¢â‚¬Å“N_PROGRAMA', 'DENOMINACION_PROGRAMA']
    }
  }
};

const normalizeCategoryToken = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const CATEGORY_BY_NORMALIZED = Object.entries(DATASET_CATEGORIES).reduce((acc, [key, label]) => {
  acc[normalizeCategoryToken(key)] = label;
  acc[normalizeCategoryToken(label)] = label;
  return acc;
}, {});

const resolveCategoria = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const normalized = normalizeCategoryToken(raw);
  return DATASET_CATEGORIES[raw] || DATASET_CATEGORIES[raw.toLowerCase()] || CATEGORY_BY_NORMALIZED[normalized] || raw;
};

const repairImportedText = (value = '') => {
  const text = String(value ?? '');
  if (!text) return text;
  if (!/[ÃÂ]/.test(text)) return text;
  try {
    const repaired = Buffer.from(text, 'latin1').toString('utf8');
    const currentNoise = (text.match(/[ÃÂ]/g) || []).length;
    const repairedNoise = (repaired.match(/[ÃÂ]/g) || []).length;
    if (repaired && repairedNoise < currentNoise && !/\uFFFD/.test(repaired)) {
      return repaired;
    }
  } catch (_) {
    // noop
  }
  return text;
};

const normalizeText = (value) => {
  const text = repairImportedText(String(value || '')).trim();
  return text || null;
};

const toCode = (value, len) => {
  const digits = String(value ?? '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  return digits.padStart(len, '0').slice(-len);
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value).trim().replace(/\s+/g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

const normalizeDivipolaText = (value = '') => {
  const repaired = repairMojibakeText(String(value || ''));
  return repaired
    .toLocaleUpperCase('es-CO')
    .replace(/[^\p{L}\p{N},.\-\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeDivipolaMatch = (value = '') =>
  stripDiacritics(normalizeDivipolaText(value))
    .replace(/[^A-Z0-9,.\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const collapseSpaces = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();

const stripDiacritics = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizeGeoJoinKey = (value = '') =>
  stripDiacritics(repairMojibakeText(value || ''))
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const GEO_HEADER_ALIASES = {
  // Código departamento (2 dígitos DANE)
  codigo_departamento: [
    'CODIGO_DEPARTAMENTO', 'CODIGO DEPARTAMENTO', 'CODIGO_DEPARTAMENTO_DANE',
    'COD_DPTO', 'COD_DEPTO', 'CODIGO_DPTO', 'DEPARTAMENTO_CODIGO',
    'C_DIGO_DEPARTAMENTO', 'COD_DEPARTAMENTO', 'DEPARTAMENTO_COD',
    'CODIGO_AREA_GEOGRAFICA', 'C_DIGO_AREA_GEOGR_FICA'
  ],
  // Nombre departamento
  nombre_departamento: [
    'NOMBRE_DEPARTAMENTO', 'NOMBRE DEPARTAMENTO', 'NOMBRE_DPTO', 'NOMBRE_DEPTO',
    'DEPARTAMENTO', 'DPTO_NOMBRE', 'NOM_DPTO', 'NOM_DEPTO',
    'NOMBRE_DEL_DEPARTAMENTO', 'NOMBRE_AREA_GEOGRAFICA', 'NOMBRE_DEL_AREA_GEOGR_FICA'
  ],
  // Código municipio (5 dígitos DANE — puede llegar sin cero inicial desde Excel)
  codigo_municipio: [
    'CODIGO_MUNICIPIO', 'CODIGO MUNICIPIO', 'CODIGO_MUNICIPIO_DANE',
    'COD_MUNICIPIO', 'COD_MPIO', 'MUNICIPIO_CODIGO', 'CODIGO_DANE',
    'C_DIGO_MUNICIPIO', 'COD_MUNICIPIO_DANE', 'CODIGO_MPIO',
    'CODIGO_DIVIPOLA', 'COD_DIVIPOLA'
  ],
  // Nombre municipio
  nombre_municipio: [
    'NOMBRE_MUNICIPIO', 'NOMBRE MUNICIPIO', 'MUNICIPIO', 'NOMBRE_MPIO',
    'NOMBRE_MUNIC', 'NOM_MPIO', 'NOM_MUNICIPIO', 'NOMBRE_DEL_MUNICIPIO'
  ],
  // Centro poblado (opcional)
  codigo_centro_poblado: [
    'CODIGO_CENTRO_POBLADO', 'CODIGO CENTRO POBLADO', 'DIVIPOLA',
    'COD_CENTRO_POBLADO', 'CODIGO_POBLADO'
  ],
  nombre_centro_poblado: [
    'NOMBRE_CENTRO_POBLADO', 'NOMBRE CENTRO POBLADO', 'NOM_POBLAD',
    'CENTRO POBLADO', 'NOMBRE POBLADO', 'NOMBRE_POBLADO'
  ],
  tipo: [
    'TIPO', 'CLASE', 'TIPO_DE_TERRITORIO', 'TIPO DE TERRITORIO',
    'TIPOLOGIA', 'TIPO_TERRITORIO', 'TIPO_ENTIDAD'
  ],
  latitud: [
    'LATITUD', 'LAT', 'LATITUD_CENTROIDE', 'CENTROID_LATITUDE', 'LATITUDE',
    'LATITUD_Y', 'COORD_LAT'
  ],
  longitud: [
    'LONGITUD', 'LON', 'LONG', 'LONGITUD_CENTROIDE', 'CENTROID_LONGITUDE', 'LONGITUDE',
    'LONGITUD_X', 'COORD_LON', 'COORD_LONG'
  ]
};

const pickGeoCell = (row = {}, aliases = []) => {
  const normalizedRow = Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [normalizeHeader(key), value])
  );
  for (const alias of aliases) {
    const value = normalizedRow[normalizeHeader(alias)];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
};

const toNullableCoordinate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const toCodeText = (value, length = 5) => {
  const raw = String(value ?? '').trim().replace(/\D+/g, '');
  if (!raw) return null;
  // Remove leading zeros then re-pad to exactly `length` digits
  return raw.replace(/^0+/, '').padStart(length, '0').slice(-length);
};

const getGeoDisplayName = (value = '', fallback = '') => {
  const raw = collapseSpaces(repairMojibakeText(value || fallback || ''));
  return raw || null;
};

const calculateFallbackCoordinates = (code = '', name = '', axis = 'lat') => {
  const seed = `${code}|${normalizeGeoJoinKey(name)}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = ((hash * 31) + seed.charCodeAt(i)) >>> 0;
  if (axis === 'lat') return Number((4 + ((hash % 9000) / 1000) / 10).toFixed(6));
  return Number((-79 + ((hash % 14000) / 1000) / 10).toFixed(6));
};

const buildPeriodLabel = (anio, periodo) => {
  const parsedYear = Number(anio || 0);
  const normalizedPeriodo = String(periodo || '').trim();
  if (!parsedYear) return normalizedPeriodo || null;
  const slot = /\b(2|II|IIP)\b/i.test(normalizedPeriodo) ? '2' : '1';
  return `${parsedYear}-${slot}`;
};

const toDictionaryKey = (value = '') =>
  stripDiacritics(String(value || ''))
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const repairMojibakeText = (value = '') => {
  let text = String(value || '');
  const replacements = [
    ['ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â', 'Á'], ['ÃƒÆ’Ã†â€™Á¢Ã¢â€šÂ¬Ã‚Â°', 'Ãƒâ€°'], ['ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â', 'Á'], ['ÃƒÆ’Ã†â€™Á¢Ã¢â€šÂ¬Ã…â€œ', 'Ãƒâ€œ'], ['ÃƒÆ’Ã†â€™Ãƒâ€¦Ã‚Â¡', 'ÃƒÅ¡'],
    ['ÃƒÆ’Ã†â€™Á¢Ã¢â€šÂ¬Ã‹Å“', 'Ãƒâ€˜'], ['ÃƒÆ’Ã†â€™Ãƒâ€¦Ã¢â‚¬Å“', 'ÃƒÅ“'], ['ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡', 'á'], ['ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©', 'é'], ['ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­', 'í'],
    ['ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³', 'ó'], ['ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº', 'ú'], ['ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±', 'ñ'], ['ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼', 'Á¼'],
    ['ÃƒÆ’Ã¢â‚¬Å¡', ''], ['Á¯Ã‚Â¿Ã‚Â½', '']
  ];
  replacements.forEach(([from, to]) => { text = text.split(from).join(to); });

  // Heuristica: si la cadena tiene secuencias tipicas de UTF-8 mal decodificado, intentar recodificar.
  if (/[ÃƒÆ’Ã†â€™ÃƒÆ’Ã¢â‚¬Å¡]/.test(text)) {
    try {
      const repaired = Buffer.from(text, 'latin1').toString('utf8');
      if (repaired && repaired !== text && !/Á¯Ã‚Â¿Ã‚Â½/.test(repaired)) text = repaired;
    } catch (_) { /* noop */ }
  }

  // Casos frecuentes observados en programas SNIES con caracteres rotos.
  text = text
    .replace(/DISE[Ã‚Â¿?]O/gi, 'DISENO')
    .replace(/GR[Ã‚Â¿?]FIC/gi, 'GRAFIC')
    .replace(/COMUNICACI[Ã‚Â¿?]N/gi, 'COMUNICACION')
    .replace(/ADMINISTRACI[Ã‚Â¿?]N/gi, 'ADMINISTRACION')
    .replace(/INGENIER[Ã‚Â¿?]A/gi, 'INGENIERIA')
    .replace(/TECNOLOG[Ã‚Â¿?]A/gi, 'TECNOLOGIA')
    .replace(/POLIT[Ã‚Â¿?]LOG/gi, 'POLITOLOG');

  return text;
};
const normalizeContextTextTech = (value) => {
  const raw = normalizeText(value);
  if (!raw) return null;
  let text = repairMojibakeText(raw);
  text = collapseSpaces(text);
  text = text.toUpperCase();
  return text || null;
};

const countAccentChars = (value = '') =>
  String(value || '')
    .split('')
    .reduce((acc, ch) => (stripDiacritics(ch) !== ch ? acc + 1 : acc), 0);

const toAccentOnlyKey = (value = '') => stripDiacritics(normalizeContextTextTech(value) || '');

const buildCorrectionRuleIndex = (rows = []) => {
  const index = new Map();
  rows
    .slice()
    .sort((a, b) => Number(a.prioridad || 100) - Number(b.prioridad || 100))
    .forEach((row) => {
      const ambito = String(row.ambito || 'GENERAL').trim().toUpperCase();
      const columna = String(row.columna || '*').trim().toUpperCase();
      const key = `${ambito}||${columna}||${toDictionaryKey(row.valor_detectado)}`;
      const candidate = String(row.valor_estandar || '').trim();
      if (!index.has(key)) {
        index.set(key, candidate);
        return;
      }
      const current = String(index.get(key) || '').trim();
      if (countAccentChars(candidate) > countAccentChars(current)) {
        index.set(key, candidate);
      }
    });
  return index;
};

const standardizeTextWithDictionary = ({
  value,
  ambito = 'GENERAL',
  columna = '*',
  ruleIndex = null,
  summary = null
}) => {
  const original = normalizeText(value);
  if (!original) return { original: null, normalized: null, changed: false };

  let normalized = normalizeContextTextTech(original);
  if (!normalized) return { original, normalized: null, changed: true };

  const beforeDictionary = normalized;
  const ambitoUpper = String(ambito || 'GENERAL').trim().toUpperCase();
  const columnaUpper = String(columna || '*').trim().toUpperCase();
  const keyNorm = toDictionaryKey(normalized);
  const candidates = [
    `${ambitoUpper}||${columnaUpper}||${keyNorm}`,
    `${ambitoUpper}||*||${keyNorm}`,
    `GENERAL||${columnaUpper}||${keyNorm}`,
    `GENERAL||*||${keyNorm}`
  ];
  for (const key of candidates) {
    const mapped = ruleIndex?.get(key);
    if (mapped) {
      normalized = normalizeContextTextTech(mapped);
      if (summary) summary.diccionario = (summary.diccionario || 0) + 1;
      break;
    }
  }

  // CatÃƒÆ’Ã‚Â¡logos cortos y seguros
  if (columnaUpper === 'SECTOR') {
    if (/^PUBLIC/.test(toDictionaryKey(normalized))) normalized = 'PÃƒÆ’Ã…Â¡BLICO';
    if (/^PRIVAD/.test(toDictionaryKey(normalized))) normalized = 'PRIVADO';
  }
  if (columnaUpper === 'ALCANCE') {
    if (toDictionaryKey(normalized).includes('NACIONAL') || toDictionaryKey(normalized).includes('COLOMBIA')) normalized = 'Nacional';
    if (toDictionaryKey(normalized).includes('REGIONAL')) normalized = 'Regional';
  }

  const changed = normalized !== original;
  if (summary && changed) {
    summary.total = (summary.total || 0) + 1;
    if (beforeDictionary !== normalized || beforeDictionary !== normalizeContextTextTech(original)) {
      summary.diccionario = summary.diccionario || 0;
    } else {
      summary.tecnica = (summary.tecnica || 0) + 1;
    }
    if (Array.isArray(summary.ejemplos) && summary.ejemplos.length < 20) {
      summary.ejemplos.push({ columna: columnaUpper, original, normalizado: normalized });
    }
  }

  return { original, normalized, changed };
};

const registerContextoNovedad = ({
  novedadesMap,
  ambito = 'CONTEXTO_EXTERNO',
  columna = '*',
  original,
  normalized
}) => {
  const originalText = normalizeText(original);
  const normalizedText = normalizeText(normalized);
  if (!originalText || !normalizedText) return;
  if (normalizeContextTextTech(originalText) === normalizeContextTextTech(normalizedText)) return;

  const key = [
    String(ambito || 'CONTEXTO_EXTERNO').toUpperCase(),
    String(columna || '*').toUpperCase(),
    toDictionaryKey(originalText),
    toDictionaryKey(normalizedText)
  ].join('||');
  if (!novedadesMap.has(key)) {
    novedadesMap.set(key, {
      ambito: String(ambito || 'CONTEXTO_EXTERNO').toUpperCase(),
      columna: String(columna || '*').toUpperCase(),
      valor_detectado: originalText,
      valor_estandar: normalizedText
    });
  }
};

const persistContextoNovedades = async ({ novedadesMap, userId = null, limit = 500 }) => {
  const items = Array.from(novedadesMap.values()).slice(0, limit);
  if (!items.length) return 0;

  let inserted = 0;
  for (const item of items) {
    const exists = await DiccionarioCorreccionTexto.findOne({
      where: {
        ambito: item.ambito,
        columna: item.columna,
        valor_detectado: item.valor_detectado,
        valor_estandar: item.valor_estandar
      },
      attributes: ['id'],
      raw: true
    });
    if (exists) continue;

    await DiccionarioCorreccionTexto.create({
      ambito: item.ambito,
      columna: item.columna,
      valor_detectado: item.valor_detectado,
      valor_estandar: item.valor_estandar,
      activo: true,
      prioridad: 150,
      observacion: 'AUTO_GENERADA_IMPORTACION_CONTEXTO_EXTERNO',
      creado_por: userId,
      actualizado_por: userId
    });
    inserted += 1;
  }
  return inserted;
};

const upperContextValue = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return normalizeContextTextTech(value);
  return value;
};

const normalizeContextoRowCells = ({
  headers = [],
  row = [],
  ruleIndex = null,
  summary = null,
  novedadesMap = null
}) => {
  const dateColumns = new Set(['FECHA_DE_RESOLUCION', 'FECHA_EJECUTORIA', 'FECHA_DE_REGISTRO_EN_SNIES']);
  const keyColumns = new Set([
    'CODIGO_INSTITUCION_PADRE',
    'CODIGO_INSTITUCION',
    'CODIGO_SNIES_DEL_PROGRAMA',
    'CODIGO_ANTERIOR_ICFES',
    'CODIGO_IES',
    'REGISTRO_UNICO'
  ]);
  const pesosColumns = new Set([
    'COSTO_MATRICULA_ESTUD_NUEVOS',
    'VALOR_MATRICULA',
    'VALOR_DE_MATRICULA',
    'COSTO_MATRICULA'
  ]);

  const normalizedCells = headers.map((header, idx) => {
    const rawCell = row[idx];
    if (rawCell === null || rawCell === undefined || String(rawCell).trim() === '') return rawCell;
    const columnaHeader = normalizeHeader(header || `COL_${idx + 1}`);

    if (dateColumns.has(columnaHeader)) return parseExcelDateString(rawCell);
    if (keyColumns.has(columnaHeader)) return String(rawCell).trim().replace(/\.0+$/, '') || null;
    if (pesosColumns.has(columnaHeader)) return toPesosNumber(rawCell);

    const standardized = standardizeTextWithDictionary({
      value: rawCell,
      ambito: 'CONTEXTO_EXTERNO',
      columna: columnaHeader,
      ruleIndex,
      summary
    });
    if (novedadesMap) {
      registerContextoNovedad({
        novedadesMap,
        ambito: 'CONTEXTO_EXTERNO',
        columna: columnaHeader,
        original: rawCell,
        normalized: standardized.normalized
      });
    }
    return standardized.normalized ?? rawCell;
  });
  const normalizedByHeader = Object.fromEntries(headers.map((h, idx) => [h || `COL_${idx + 1}`, normalizedCells[idx]]));
  const normalizedByKey = Object.fromEntries(headers.map((h, idx) => [normalizeHeader(h || `COL_${idx + 1}`), normalizedCells[idx]]));
  return { normalizedByHeader, normalizedByKey };
};

const hasLetters = (value = '') => /[A-Za-z]/.test(stripDiacritics(String(value || '')));
const isNumericLike = (value) => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'number') return Number.isFinite(value);
  const text = String(value).trim();
  if (!text) return false;
  return /^-?\d+([.,]\d+)?$/.test(text);
};

const canonicalizeAccentOnlyValue = ({
  column = '',
  value,
  accentCanonicalMap = new Map()
}) => {
  if (value === null || value === undefined) return value;
  if (isNumericLike(value)) return value;
  if (!hasLetters(value)) return value;

  const normalizedUpper = normalizeContextTextTech(value);
  const accentOnlyKey = toAccentOnlyKey(normalizedUpper);
  if (!accentOnlyKey) return normalizedUpper;

  const mapKey = `${normalizeHeader(column)}||${accentOnlyKey}`;
  const currentCanonical = accentCanonicalMap.get(mapKey);
  const candidate = normalizedUpper;
  if (!currentCanonical) {
    accentCanonicalMap.set(mapKey, candidate);
    return candidate;
  }
  const currentScore = countAccentChars(currentCanonical);
  const candidateScore = countAccentChars(candidate);
  const chosen = candidateScore > currentScore ? candidate : currentCanonical;
  accentCanonicalMap.set(mapKey, chosen);
  return chosen;
};

const applyAccentCanonicalization = ({
  headers = [],
  normalizedByHeader = {},
  accentCanonicalMap = new Map()
}) => {
  const output = { ...normalizedByHeader };
  headers.forEach((header) => {
    const key = header || '';
    const value = output[key];
    if (value === null || value === undefined) return;
    if (isNumericLike(value)) return;
    if (!hasLetters(value)) return;

    output[key] = canonicalizeAccentOnlyValue({
      column: key,
      value,
      accentCanonicalMap
    });
  });
  return output;
};
const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const toPesosNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Number(value) : null;
  const text = String(value).trim();
  if (!text) return null;
  const cleaned = text
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
};

const parseAnio = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (Number.isFinite(value) && value >= 1900 && value <= 2200) return Math.trunc(value);
    if (Number.isFinite(value) && value > 20000 && value < 90000) {
      const parsedDate = XLSX.SSF.parse_date_code(value);
      if (parsedDate?.y) return Number(parsedDate.y);
    }
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getFullYear();

  const text = String(value).trim();
  if (!text) return null;
  const asNumber = Number(text);
  if (Number.isFinite(asNumber) && asNumber >= 1900 && asNumber <= 2200) return Math.trunc(asNumber);
  const match = text.match(/\b(19|20)\d{2}\b/);
  if (match) return Number(match[0]);
  return null;
};

const normalizeSaber11SheetName = (value = '') => {
  const match = normalizeHeader(value).match(/^TIPO[_ ]?([1-7])$/);
  return match ? `Tipo_${match[1]}` : null;
};

const normalizeDocumentoKey = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().replace(/\.0+$/, '');
  return text || null;
};

const resolveSaber11ScoreRange = (field) => (field === 'global'
  ? { min: 0, max: 500 }
  : { min: 0, max: 100 });

const parseSaber11Score = (value, field, label) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const numeric = toNumber(value);
  if (numeric === null) {
    throw new Error(`Valor inválido en ${label}`);
  }
  const { min, max } = resolveSaber11ScoreRange(field);
  if (numeric < min || numeric > max) {
    throw new Error(`Puntaje fuera de rango en ${label} (${min}-${max})`);
  }
  return numeric;
};

const readSaber11SheetRows = (worksheet) =>
  XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: false });

const parsePeriodoLabelToAnio = (value) => {
  const text = String(value || '').trim();
  const match = text.match(/\b(19|20)\d{2}\b/);
  if (match) return Number(match[0]);
  return parseAnio(value);
};

const parsePeriodoLabelToSort = (value) => {
  const text = String(value || '').toUpperCase();
  const year = parsePeriodoLabelToAnio(text) || 0;
  const slot = /\b(II|2)\b/.test(text) ? 2 : 1;
  return year * 10 + slot;
};

const normalizeContextoBaseFromSheetName = (sheetName = '') => {
  const text = normalizeHeader(sheetName);
  if (text.includes('OFERTA')) return 'Oferta';
  if (text.includes('INSCRITOS')) return 'Inscritos';
  if (text.includes('ADMITIDOS')) return 'Admitidos';
  if (text.includes('PRIEMR_CURSO') || text.includes('PRIMER_CURSO')) return 'Primer Curso';
  if (text.includes('MATRICULADOS')) return 'Matriculados';
  if (text.includes('GRADUADOS')) return 'Graduados';
  return sheetName;
};

const normalizeContextoAlcanceFromSheetName = (sheetName = '') => {
  const text = normalizeHeader(sheetName);
  if (text.includes('REGIONAL')) return 'Regional';
  if (text.includes('COLOMBIA') || text.includes('NACIONAL')) return 'Nacional';
  return null;
};

const RECORD_COUNT_SUBCATEGORIES = new Set([
  'Inscritos',
  'Admitidos',
  'Primer Curso',
  'Matriculados',
  'Graduados',
  'Caracterizacion'
]);

const POBLACIONAL_SERIES_UNIQUE_COUNT_CONFIG = {
  Inscritos: {
    table: 'poblacional_inscritos',
    docColumn: 'documento',
    sourcePeriodColumn: 'periodo',
    programColumn: 'programa',
    dependencyColumn: 'facultad'
  },
  Admitidos: {
    table: 'poblacional_admitidos',
    docColumn: 'numero_documento',
    sourcePeriodColumn: 'periodo',
    programColumn: 'programa',
    dependencyColumn: 'facultad'
  },
  'Primer Curso': {
    table: 'poblacional_primer_curso',
    docColumn: 'numero_documento',
    sourcePeriodColumn: 'periodo',
    programColumn: 'programa',
    dependencyColumn: 'facultad'
  }
};

const normalizeProgramAggregateKey = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const hasAggregateAccents = (value = '') => /[ÃÃ‰ÃÃ“ÃšÃ¡Ã©Ã­Ã³ÃºÃ‘Ã±ÃœÃ¼]/.test(String(value || ''));

const selectPreferredAggregateLabel = (current = '', incoming = '') => {
  const currentClean = String(current || '').replace(/\s+/g, ' ').trim();
  const incomingClean = String(incoming || '').replace(/\s+/g, ' ').trim();
  if (!currentClean) return incomingClean;
  if (!incomingClean) return currentClean;
  if (hasAggregateAccents(incomingClean) && !hasAggregateAccents(currentClean)) return incomingClean;
  if (!hasAggregateAccents(incomingClean) && hasAggregateAccents(currentClean)) return currentClean;
  return incomingClean.length > currentClean.length ? incomingClean : currentClean;
};

const buildPoblacionalSeriesUniqueCountRows = async ({
  parsedSubcategorias = [],
  queryFilters = {},
  recentYearsNum = null,
  maxClosedYear = null
}) => {
  const selectedConfigs = parsedSubcategorias
    .map((subcategoria) => ({ subcategoria, config: POBLACIONAL_SERIES_UNIQUE_COUNT_CONFIG[subcategoria] }))
    .filter((item) => item.config);

  if (!selectedConfigs.length) return [];

  const replacements = {};
  const commonFilters = [];
  commonFilters.push('anio <= :maxClosedYear');
  replacements.maxClosedYear = Number(maxClosedYear) || new Date().getFullYear() - 1;

  if (Number.isFinite(recentYearsNum) && recentYearsNum > 0) {
    replacements.minYear = replacements.maxClosedYear - Math.trunc(recentYearsNum) + 1;
    commonFilters.push('anio >= :minYear');
  }

  const normalizedYearFilter = String(queryFilters.anio ?? '').trim();
  if (normalizedYearFilter !== '' && Number.isFinite(Number(normalizedYearFilter))) {
    replacements.filterYear = Number(normalizedYearFilter);
    commonFilters.push('anio = :filterYear');
  }

  if (queryFilters.programa) {
    replacements.filterPrograma = `%${String(queryFilters.programa).trim()}%`;
    commonFilters.push('programa ILIKE :filterPrograma');
  }

  if (queryFilters.dependencia) {
    replacements.filterDependencia = `%${String(queryFilters.dependencia).trim()}%`;
    commonFilters.push('facultad ILIKE :filterDependencia');
  }

  if (queryFilters.search) {
    replacements.filterSearch = `%${String(queryFilters.search).trim()}%`;
  }

  const sql = selectedConfigs.map(({ subcategoria, config }) => {
    const itemFilters = [...commonFilters];
    if (queryFilters.search) {
      itemFilters.push(`(
        ${config.programColumn} ILIKE :filterSearch
        or ${config.dependencyColumn} ILIKE :filterSearch
        or ${config.docColumn} ILIKE :filterSearch
        or coalesce(${config.sourcePeriodColumn}, '') ILIKE :filterSearch
      )`);
    }
    const whereClause = itemFilters.length ? `where ${itemFilters.join(' and ')}` : '';

    return `
      select
        '${subcategoria}' as subcategoria,
        id,
        anio,
        nullif(btrim(${config.programColumn}), '') as programa,
        nullif(btrim(${config.dependencyColumn}), '') as dependencia,
        btrim(coalesce(${config.sourcePeriodColumn}, '')) as periodo_normalizado,
        coalesce(nullif(btrim(${config.docColumn}), ''), concat('__row__', id::text)) as documento_normalizado
      from ${config.table}
      ${whereClause}
    `;
  }).join(' union all ');

  const detailRows = await Estadistica.sequelize.query(sql, {
    replacements,
    type: QueryTypes.SELECT
  });

  const buckets = new Map();
  detailRows.forEach((row) => {
    const programKey = normalizeProgramAggregateKey(row.programa);
    const dependencyKey = normalizeProgramAggregateKey(row.dependencia);
    const bucketKey = [
      row.subcategoria,
      Number(row.anio) || 0,
      row.periodo_normalizado || '',
      programKey,
      dependencyKey
    ].join('||');

    const current = buckets.get(bucketKey) || {
      categoria: 'Poblacional',
      subcategoria: row.subcategoria,
      anio: Number(row.anio) || 0,
      programa: row.programa || null,
      dependencia: row.dependencia || null,
      indicador: row.subcategoria,
      unidad: 'personas',
      fuente: null,
      observaciones: row.periodo_normalizado ? `periodo: ${row.periodo_normalizado}` : null,
      uniqueDocs: new Set()
    };

    current.programa = selectPreferredAggregateLabel(current.programa, row.programa || '');
    current.dependencia = selectPreferredAggregateLabel(current.dependencia, row.dependencia || '');
    current.uniqueDocs.add(String(row.documento_normalizado || `__row__${row.id || ''}`));
    buckets.set(bucketKey, current);
  });

  return Array.from(buckets.values())
    .map((row) => ({
      categoria: row.categoria,
      subcategoria: row.subcategoria,
      anio: row.anio,
      programa: row.programa,
      dependencia: row.dependencia,
      indicador: row.indicador,
      valor: row.uniqueDocs.size,
      unidad: row.unidad,
      fuente: row.fuente,
      observaciones: row.observaciones
    }))
    .sort((a, b) =>
      (a.anio - b.anio)
      || String(a.subcategoria || '').localeCompare(String(b.subcategoria || ''), 'es')
      || String(a.programa || '').localeCompare(String(b.programa || ''), 'es')
      || String(a.observaciones || '').localeCompare(String(b.observaciones || ''), 'es')
    );
};

const findRowIndexByFirstCell = (matrix = [], patterns = []) => {
  const normalizedPatterns = patterns.map((p) => normalizeHeader(p));
  for (let i = 0; i < Math.min(60, matrix.length); i += 1) {
    const first = normalizeHeader((matrix[i] || [])[0]);
    if (!first) continue;
    if (normalizedPatterns.includes(first)) return i;
  }
  return -1;
};

const readContextoMeta = (matrix = []) => {
  const firstCol = matrix.map((row) => String((row || [])[0] || '').trim());
  const programaObjetivo = firstCol.find((v) => /ESPECIALIZ|MAESTR|DOCTOR|TECNOLOG|PROFESIONAL/i.test(v)) || null;
  const corteLine = firstCol.find((v) => /^CORTE\b/i.test(v)) || '';
  const corte = corteLine || null;
  return { programaObjetivo, corte };
};

const resolvePoblacionalConfig = (subcategoria = '') => {
  const key = normalizeHeader(subcategoria);
  return POBLACIONAL_SUBCATEGORY_CONFIG[key] || null;
};

const SABER_PRO_SUBCATEGORY_CONFIG = {
  RESULTADOS_SABER_11: {
    label: 'Resultados Saber 11',
    model: Saber11Resultado,
    headers: SABER11_TEMPLATE_HEADERS.Tipo_1,
    sheetTemplates: SABER11_SHEET_NAMES.map((sheetName) => ({
      sheetName,
      headers: SABER11_TEMPLATE_HEADERS[sheetName],
      tipoPrueba: sheetName
    })),
    map: SABER11_FIELD_MAP
  },
  RESULTADOS_INDIVIDUALES: {
    label: 'Resultados individuales',
    model: SaberProResultadoIndividual,
    headers: SABER_PRO_TEMPLATE_HEADERS['Resultados individuales'],
    strictHeaders: true,
    sheetTemplates: [
      { sheetName: 'SABER PRO', headers: SABER_PRO_TEMPLATE_HEADERS['Resultados individuales'], tipoPrueba: 'saber_pro' },
      { sheetName: 'TYT', headers: SABER_PRO_TEMPLATE_HEADERS['Resultados individuales'], tipoPrueba: 'tyt' }
    ],
    map: {
      tipo_documento: ['Tipo de documento'],
      documento: ['Documento'],
      nombre: ['Nombre'],
      numero_registro: ['Número de registro', 'Numero de registro'],
      tipo_evaluado: ['Tipo de evaluado'],
      snies_programa_academico: ['SNIES programa académico', 'SNIES programa academico'],
      programa: ['Programa'],
      ciudad: ['Ciudad'],
      grupo_referencia: ['Grupo de referencia'],
      puntaje_global: ['Puntaje global'],
      percentil_nacional_global: ['Percentil nacional global'],
      percentil_grupo_referencia: ['Percentil grupo de referencia'],
      modulo: ['Módulo', 'Modulo'],
      puntaje_modulo: ['Puntaje módulo', 'Puntaje modulo'],
      nivel_desempeno: ['Nivel de desempeño', 'Nivel de desempeno'],
      percentil_nacional_modulo: ['Percentil nacional módulo', 'Percentil nacional modulo'],
      percentil_grupo_referencia_modulo: ['Percentil grupo de referencia módulo', 'Percentil grupo de referencia modulo'],
      novedades: ['Novedades'],
      anio: ['AÑO', 'Año', 'Ano', 'ANIO'],
      periodo: ['Periodo', 'PERIODO'],
      periodo_icfes: ['PERIODO ICFES'],
      lugar_presentacion: ['LUEGAR_PRESENTACION', 'LUEGAR_PRESENTACION ', 'LUGAR_PRESENTACION', 'LUGAR PRESENTACION'],
      modalidad: ['MODALIDAD']
    }
  },
  RESULTADOS_AGREGADOS: {
    label: 'Resultados agregados',
    model: SaberProResultadoAgregado,
    headers: SABER_PRO_TEMPLATE_HEADERS['Resultados agregados'],
    strictHeaders: true,
    map: {
      anio: ['AÑO', 'Año', 'ANO', 'ANIO', 'Ano'],
      programa: ['PROGRAMA', 'Programa'],
      competencia: ['COMPETENCIA', 'Competencia'],
      puntaje_programa: ['PUNTAJE PROGRAMA', 'Puntaje programa'],
      puntaje_institucion: ['PUNTAJE INSTITUCIÓN', 'PUNTAJE INSTITUCION', 'Puntaje institución', 'Puntaje institucion'],
      puntaje_grupo_referencia: ['PUNTAJE GRUPO DE REFERENCIA', 'Puntaje grupo de referencia'],
      tipo_prueba: ['TIPO_PRUEBA', 'TIPO PRUEBA', 'Tipo_prueba', 'Tipo prueba']
    }
  }
};

const resolveSaberProConfig = (subcategoria = '') => {
  const key = normalizeHeader(subcategoria);
  return SABER_PRO_SUBCATEGORY_CONFIG[key] || null;
};

const RECURSO_HUMANO_SUBCATEGORY_CONFIG = {
  DOCENTES: {
    key: 'DOCENTES',
    label: 'Docentes',
    model: RecursoHumanoDocente,
    sheetNames: ['DOCENTES'],
    headers: RECURSO_HUMANO_TEMPLATE_HEADERS.Docentes,
    map: {
      anio: ['AÃƒÆ’Ã¢â‚¬ËœO', 'ANO', 'ANIO'],
      identificacion: ['IdentificaciÃƒÆ’Ã‚Â³n', 'IDENTIFICACION'],
      docente: ['DOCENTE'],
      genero_biologico: ['GENERO BIÃƒÆ’Ã¢â‚¬Å“LOGICO', 'GENERO BIOLOGICO'],
      departamento_dependencia: ['DEPARTAMENTO/DEPENDENCIA', 'DEPARTAMENTO DEPENDENCIA'],
      programa: ['PROGRAMA'],
      tipo_vinculacion: ['TIPOVINCULACIÃƒÆ’Ã¢â‚¬Å“N', 'TIPOVINCULACION'],
      contrato: ['CONTRATO'],
      total_horas: ['Total Horas'],
      fecha_nacimiento: ['FECHA_NACIMIENTO', 'FECHA NACIMIENTO'],
      edad: ['EDAD'],
      fecha_ingreso: ['FECHA INGRESO'],
      total_docentes: ['Total docentes', 'TOTAL DOCENTES'],
      escalafon: ['ESCALAFÃƒÆ’Ã¢â‚¬Å“N', 'ESCALAFON'],
      cargo: ['CARGO'],
      periodo: ['PERIODO']
    }
  },
  ADMINISTRATIVOS: {
    key: 'ADMINISTRATIVOS',
    label: 'Administrativos',
    model: RecursoHumanoAdministrativo,
    sheetNames: ['ADMINISTRATIVOS'],
    headers: RECURSO_HUMANO_TEMPLATE_HEADERS.Administrativos,
    map: {
      periodo: ['PERIODO'],
      numero_cedula: ['NÃƒâ€šÃ‚Âº CÃƒÆ’Ã‚Â©dula', 'No Cedula', 'NÃƒâ€šÃ‚Â° CÃƒÆ’Ã‚Â©dula', 'CEDULA'],
      estado_laboral: ['Activo /Retirado', 'ACTIVO /RETIRADO'],
      nombre_empleado: ['Nombre Empleado'],
      cargo_especifico: ['Cargo Especifico'],
      dependencia: ['Dependencia'],
      vicerectoria: ['Vicerectoria', 'Vicerrectoria'],
      tipo_cotizante: ['Tipo de cotizante'],
      clase_contrato: ['Clase de Contrato'],
      fecha_inicio: ['FECHA INICIO'],
      fecha_terminacion: ['FECHA DE TERMINACION'],
      sueldo_anual: ['Sueldo aÃƒÆ’Ã‚Â±o 2023', 'Sueldo ano 2023'],
      sueldo_mes: ['Sueldo Mes Septiembre 2023'],
      genero_biologico: ['GENERO BIÃƒÆ’Ã¢â‚¬Å“LOGICO', 'GENERO BIOLOGICO'],
      anio: ['AÃƒÆ’Ã¢â‚¬ËœO', 'ANO', 'ANIO']
    }
  },
  OUTSOURCING: {
    key: 'OUTSOURCING',
    label: 'Outsourcing',
    model: RecursoHumanoOutsourcing,
    sheetNames: ['OUTSOURCING'],
    headers: RECURSO_HUMANO_TEMPLATE_HEADERS.Outsourcing,
    map: {
      anio: ['AÃƒÆ’Ã¢â‚¬ËœO', 'ANO', 'ANIO'],
      cargo: ['CARGO'],
      genero_biologico: ['GENERO BIÃƒÆ’Ã¢â‚¬Å“LOGICO', 'GENERO BIOLOGICO'],
      cantidad: ['CANTIDAD']
    }
  },
  ONDAS: {
    key: 'ONDAS',
    label: 'Ondas',
    model: RecursoHumanoOnda,
    sheetNames: ['ONDAS'],
    headers: RECURSO_HUMANO_TEMPLATE_HEADERS.Ondas,
    map: {
      periodo: ['PERIODO'],
      nombre: ['NOMBRE'],
      genero: ['GENERO', 'GENERO BIÃƒÆ’Ã¢â‚¬Å“LOGICO', 'GENERO BIOLOGICO'],
      fecha_corte: ['FECHA DE CORTE']
    }
  }
};

const resolveRecursoHumanoConfig = (subcategoria = '') => {
  const key = normalizeHeader(subcategoria);
  return RECURSO_HUMANO_SUBCATEGORY_CONFIG[key] || null;
};

const CONTEXTO_EXTERNO_CARGA_MAP = {
  PROGRAMAS_CONTEXTO_EXTERNO: { baseIndicador: 'Oferta', onlyType: 'oferta' },
  INSCRITOS_CONTEXTO_EXTERNO: { baseIndicador: 'Inscritos', onlyType: 'serie' },
  ADMITIDOS_CONTEXTO_EXTERNO: { baseIndicador: 'Admitidos', onlyType: 'serie' },
  PRIMER_CURSO_CONTEXTO_EXTERNO: { baseIndicador: 'Primer Curso', onlyType: 'serie' },
  MATRICULADOS_CONTEXTO_EXTERNO: { baseIndicador: 'Matriculados', onlyType: 'serie' },
  GRADUADOS_CONTEXTO_EXTERNO: { baseIndicador: 'Graduados', onlyType: 'serie' }
};

const resolveContextoExternoCargaConfig = (value = '') => {
  const key = normalizeHeader(value);
  return CONTEXTO_EXTERNO_CARGA_MAP[key] || null;
};

const CONTEXTO_EXTERNO_TABULAR_BASE_HEADERS = [
  'CODIGO DE LA INSTITUCION',
  'IES PADRE',
  'INSTITUCION DE EDUCACION SUPERIOR (IES)',
  'TIPO IES',
  'ID SECTOR IES',
  'SECTOR IES',
  'ID CARACTER IES',
  'CARACTER IES',
  'CODIGO DEL DEPARTAMENTO (IES)',
  'DEPARTAMENTO DE DOMICILIO DE LA IES',
  'CODIGO DEL MUNICIPIO IES',
  'MUNICIPIO DE DOMICILIO DE LA IES',
  'IES ACREDITADA',
  'CODIGO SNIES DEL PROGRAMA',
  'PROGRAMA ACADEMICO',
  'PROGRAMA ACREDITADO',
  'ID NIVEL ACADEMICO',
  'NIVEL ACADEMICO',
  'ID NIVEL DE FORMACION',
  'NIVEL DE FORMACION',
  'ID MODALIDAD',
  'MODALIDAD',
  'ID AREA',
  'AREA DE CONOCIMIENTO',
  'ID NUCLEO',
  'NUCLEO BASICO DEL CONOCIMIENTO (NBC)',
  'ID CINE CAMPO AMPLIO',
  'DESC CINE CAMPO AMPLIO',
  'ID CINE CAMPO ESPECIFICO',
  'DESC CINE CAMPO ESPECIFICO',
  'ID CINE CAMPO DETALLADO',
  'DESC CINE CAMPO DETALLADO',
  'CODIGO DEL DEPARTAMENTO (PROGRAMA)',
  'DEPARTAMENTO DE OFERTA DEL PROGRAMA',
  'CODIGO DEL MUNICIPIO (PROGRAMA)',
  'MUNICIPIO DE OFERTA DEL PROGRAMA',
  'ID SEXO',
  'SEXO',
  'ANO',
  'SEMESTRE'
];

const buildContextoExternoTabularHeaders = (metricColumn) => [
  ...CONTEXTO_EXTERNO_TABULAR_BASE_HEADERS,
  metricColumn
];

const CONTEXTO_EXTERNO_TEMPLATE_HEADERS = {
  PROGRAMAS_CONTEXTO_EXTERNO: [
    'CODIGO_INSTITUCION_PADRE',
    'CODIGO_INSTITUCION',
    'NOMBRE_INSTITUCION',
    'ESTADO_INSTITUCION',
    'CARACTER_ACADEMICO',
    'SECTOR',
    'REGISTRO_UNICO',
    'CODIGO_SNIES_DEL_PROGRAMA',
    'CODIGO_ANTERIOR_ICFES',
    'NOMBRE_DEL_PROGRAMA',
    'TITULO_OTORGADO',
    'ESTADO_PROGRAMA',
    'JUSTIFICACION',
    'JUSTIFICACION_DETALLADA',
    'RECONOCIMIENTO_DEL_MINISTERIO',
    'RESOLUCION_DE_APROBACION',
    'FECHA_DE_RESOLUCION',
    'FECHA_EJECUTORIA',
    'VIGENCIA_ANOS',
    'FECHA_DE_REGISTRO_EN_SNIES',
    'CINE_F_2013_AC_CAMPO_AMPLIO',
    'CINE_F_2013_AC_CAMPO_ESPECIFIC',
    'CINE_F_2013_AC_CAMPO_DETALLADO',
    'AREA_DE_CONOCIMIENTO',
    'NUCLEO_BASICO_DEL_CONOCIMIENTO',
    'NIVEL_ACADEMICO',
    'NIVEL_DE_FORMACION',
    'MODALIDAD',
    'NUMERO_CREDITOS',
    'NUMERO_PERIODOS_DE_DURACION',
    'PERIODICIDAD',
    'SE_OFRECE_POR_CICLOS_PROPEDUT',
    'PERIODICIDAD_ADMISIONES',
    'PROGRAMA_EN_CONVENIO',
    'DEPARTAMENTO_OFERTA_PROGRAMA',
    'MUNICIPIO_OFERTA_PROGRAMA',
    'COSTO_MATRICULA_ESTUD_NUEVOS',
    'VIGENCIA_TRANSITORIA',
    'OBSERVACION_DECRETO_1174_23'
  ],
  INSCRITOS_CONTEXTO_EXTERNO: buildContextoExternoTabularHeaders('INSCRITOS'),
  ADMITIDOS_CONTEXTO_EXTERNO: buildContextoExternoTabularHeaders('ADMITIDOS'),
  PRIMER_CURSO_CONTEXTO_EXTERNO: buildContextoExternoTabularHeaders('PRIMER CURSO'),
  MATRICULADOS_CONTEXTO_EXTERNO: buildContextoExternoTabularHeaders('MATRICULADOS'),
  GRADUADOS_CONTEXTO_EXTERNO: buildContextoExternoTabularHeaders('GRADUADOS')
};

const getContextoExternoTabularMetricAliases = (baseIndicador = '') => {
  const key = normalizeHeader(baseIndicador);
  if (key === 'INSCRITOS') return ['INSCRITOS'];
  if (key === 'ADMITIDOS') return ['ADMITIDOS'];
  if (key === 'PRIMER_CURSO') return ['PRIMER_CURSO', 'PRIMER CURSO'];
  if (key === 'MATRICULADOS') return ['MATRICULADOS'];
  if (key === 'GRADUADOS') return ['GRADUADOS'];
  return ['INSCRITOS', 'ADMITIDOS', 'PRIMER_CURSO', 'MATRICULADOS', 'GRADUADOS', 'VALOR'];
};

const getContextoExternoMetricKeyRegex = (baseIndicador = '') => {
  const key = normalizeHeader(baseIndicador);
  if (key === 'INSCRITOS') return /^INSCRIT/;
  if (key === 'ADMITIDOS') return /^ADMIT/;
  if (key === 'PRIMER_CURSO') return /^PRIMER.*CURSO|^PRIMERCURSO/;
  if (key === 'MATRICULADOS') return /^MATRICUL/;
  if (key === 'GRADUADOS') return /^GRADUAD/;
  return /^(INSCRIT|ADMIT|PRIMER.*CURSO|MATRICUL|GRADUAD|VALOR)/;
};

const hasContextoExternoTabularMetricHeader = (headerKeys = [], baseIndicador = '') => {
  const keys = Array.isArray(headerKeys) ? headerKeys : [];
  const directAliases = getContextoExternoTabularMetricAliases(baseIndicador).map((alias) => normalizeHeader(alias));
  if (directAliases.some((alias) => keys.includes(alias))) return true;
  const metricRegex = getContextoExternoMetricKeyRegex(baseIndicador);
  return keys.some((key) => metricRegex.test(String(key || '')));
};

const pickContextoExternoTabularMetricValue = (normalizedRowByKey = {}, baseIndicador = '') => {
  const direct = pickValue(normalizedRowByKey, getContextoExternoTabularMetricAliases(baseIndicador));
  if (direct !== null && direct !== undefined && String(direct).trim() !== '') return direct;
  const metricRegex = getContextoExternoMetricKeyRegex(baseIndicador);
  const dynamicEntry = Object.entries(normalizedRowByKey || {}).find(([k, v]) =>
    metricRegex.test(String(k || ''))
    && v !== null
    && v !== undefined
    && String(v).trim() !== ''
  );
  return dynamicEntry ? dynamicEntry[1] : null;
};

const resolveContextoExternoTemplateHeaders = (value = '') => {
  const key = normalizeHeader(value);
  return CONTEXTO_EXTERNO_TEMPLATE_HEADERS[key] || null;
};

const normalizeRowObject = (row = {}) => {
  const output = {};
  Object.entries(row || {}).forEach(([key, value]) => {
    output[normalizeHeader(repairImportedText(key))] = repairImportedText(value);
  });
  return output;
};

const pickValue = (row, aliases = []) => {
  for (const alias of aliases) {
    const value = row[normalizeHeader(alias)];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
};

const parseCsvList = (value) => {
  if (Array.isArray(value)) {
    return value.map((x) => String(x || '').trim()).filter(Boolean);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).map((x) => String(x || '').trim()).filter(Boolean);
  }
  if (value === null || value === undefined) return [];
  const raw = String(value).trim();
  if (!raw) return [];
  if ((raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('"[') && raw.endsWith(']"'))) {
    try {
      const parsed = JSON.parse(raw.startsWith('"[') ? JSON.parse(raw) : raw);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x || '').trim()).filter(Boolean);
      }
    } catch (_) {
      // fallback to csv parser
    }
  }
  return raw
    .split(',')
    .map((x) => String(x || '').trim())
    .filter(Boolean);
};

const parseQueryListParam = (query = {}, key = '') => {
  if (!query || !key) return [];

  if (Object.prototype.hasOwnProperty.call(query, key)) {
    return parseCsvList(query[key]);
  }

  const bracketKey = `${key}[]`;
  if (Object.prototype.hasOwnProperty.call(query, bracketKey)) {
    return parseCsvList(query[bracketKey]);
  }

  const indexedKeys = Object.keys(query)
    .filter((queryKey) => queryKey.startsWith(`${key}[`) && queryKey.endsWith(']'))
    .sort((a, b) => {
      const ai = Number((a.match(/\[(\d+)\]/) || [])[1]);
      const bi = Number((b.match(/\[(\d+)\]/) || [])[1]);
      if (Number.isFinite(ai) && Number.isFinite(bi)) return ai - bi;
      return a.localeCompare(b, 'es');
    });

  if (!indexedKeys.length) return [];
  return indexedKeys
    .map((queryKey) => query[queryKey])
    .flatMap((value) => parseCsvList(value));
};

const normalizeSemesterToken = (value = '') => {
  const text = String(value || '').toUpperCase();
  if (!text) return '';
  if (/\b(2|II|IIP)\b/.test(text)) return '2';
  if (/\b(1|I|IP)\b/.test(text)) return '1';
  return '';
};

const normalizeComparableText = (value = '') =>
  stripDiacritics(String(value || ''))
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toProgramComparable = (value = '') => normalizeComparableText(value);

const normalizeCountryLabel = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return 'SIN INFORMACION';
  return raw.replace(/\s+/g, ' ').toUpperCase();
};

const isColombiaCountry = (value = '') => {
  const token = normalizeComparableText(value);
  return token === 'COLOMBIA' || token === 'COLOMBIA REPUBLICA DE' || token === 'REPUBLICA DE COLOMBIA';
};

const normalizeDepartmentLabel = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return 'SIN INFORMACION';
  return raw.replace(/\s+/g, ' ').toUpperCase();
};

const normalizeMunicipalityLabel = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return 'SIN INFORMACION';
  return raw.replace(/\s+/g, ' ').toUpperCase();
};

const getSemesterSlot = (value = '') => {
  const token = normalizeComparableText(value);
  if (!token) return '1';
  if (
    /\b(IIP|II|SEMESTRE 2|SEM 2|PERIODO 2|P2|S2|BIMESTRE 2|2)\b/.test(token)
    || /(^|[^0-9])2($|[^0-9])/.test(String(value || ''))
    || /-\s*2\b/.test(String(value || ''))
  ) return '2';
  if (/\b(IP|I|SEMESTRE 1|SEM 1|PERIODO 1|P1|S1|1)\b/.test(token)) return '1';
  return '1';
};

const normalizeSexoBiologicoLabel = (value = '') => {
  const token = normalizeComparableText(value);
  if (!token) return 'SIN INFORMACION';
  if (token.includes('FEM')) return 'Femenino';
  if (token.includes('MAS')) return 'Masculino';
  if (token.includes('NO BIN')) return 'No binario';
  return String(value || '').trim() || 'Sin informacion';
};

const classifyProgramLevel = (programa = '') => {
  const token = normalizeComparableText(programa);
  if (!token) return 'Sin informacion';
  if (token.includes('DOCTOR')) return 'Doctorado';
  if (token.includes('MEDICO QUIRURG')) return 'Especializacion medico quirurgica';
  if (token.includes('MAESTRIA')) return 'Maestria';
  if (
    token.includes('ESPECIALIZACION')
    || token === 'ESP'
    || token.includes(' ESP ')
    || token.includes('ESPECI')
    || token.includes('ESPECIALIA')
    || token.includes('ESPCIALIZACON UNIVERSITARIA')
  ) return 'Especializacion universitaria';
  if (token.includes('TECNOLOGO') || token.includes('TECNOLOGIA') || token.includes('TECNO')) return 'Tecnologico';
  if (token.includes('TECNICO') || token.includes('TECNICA') || token === 'TEC') return 'Formacion tecnica profesional';
  return 'Universitario';
};

const normalizeGenero = (value) => {
  const text = String(value || '').trim().toUpperCase();
  if (!text) return 'SIN INFORMACION';
  if (text.includes('NO BIN')) return 'NO BINARIO';
  if (text === 'F') return 'FEMENINO';
  if (text === 'M') return 'MASCULINO';
  if (text.includes('FEM')) return 'FEMENINO';
  if (text.includes('MAS')) return 'MASCULINO';
  return text;
};

const normalizeSiNo = (value) => {
  const text = String(value || '').trim().toUpperCase();
  if (!text) return 'SIN INFORMACION';
  if (['SI', 'SÃƒÆ’Ã‚Â', 'YES'].includes(text)) return 'SI';
  if (['NO', 'N'].includes(text)) return 'NO';
  return text;
};

const parseExcelDateString = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value) && value > 20000 && value < 90000) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      const y = String(parsed.y).padStart(4, '0');
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return normalizeText(value);
};

const normalizeGrupoEtnico = (value) => {
  const text = String(value || '').trim();
  if (!text) return 'SIN INFORMACION';
  return text.toUpperCase();
};

const isAfrodescendiente = (grupo) => {
  const text = normalizeGrupoEtnico(grupo);
  return /(AFRO|NEGRA|PALENQ|RAIZAL)/.test(text);
};

const getPeriodoTokenSort = (value = '') => {
  const text = String(value || '').toUpperCase();
  if (/\b(IIP|II|2)\b/.test(text)) return 2;
  return 1;
};

const getRawPeriodLabel = (row) => {
  // En caracterizacion puede haber inconsistencias en la columna anio.
  // Priorizamos el anio derivado desde "periodo" (ej. "2025 IIP") para filtros exactos.
  const anio = parseAnio(row.periodo) || Number(row.anio) || 0;
  const sort = getPeriodoTokenSort(row.periodo);
  return `${anio}-${sort}`;
};

const mapPoblacionalRecord = (row, config) => {
  const normalizedRow = normalizeRowObject(row);
  const payload = {};
  Object.entries(config.map).forEach(([field, aliases]) => {
    payload[field] = pickValue(normalizedRow, aliases);
  });
  return payload;
};

const readCsvRows = async (filePath) => {
  const rows = [];
  let headers = [];
  await streamCsvFile({
    filePath,
    onHeader: async ({ headers: csvHeaders }) => {
      headers = (csvHeaders || []).map((header) => repairImportedText(String(header || '')).trim());
    },
    onRow: async ({ cells, lineNumber }) => {
      const row = {};
      headers.forEach((header, index) => {
        if (!header) return;
        row[header] = repairImportedText(cells[index]);
      });
      if (Object.keys(row).length) {
        rows.push({ ...row, __rowNumber: lineNumber });
      }
    }
  });
  return { headers, rows };
};

const detectHeaderRowIndex = (matrix = [], expectedHeaders = []) => {
  const expected = new Set(expectedHeaders.map((header) => normalizeHeader(header)));
  for (let i = 0; i < Math.min(30, matrix.length); i += 1) {
    const row = matrix[i] || [];
    const normalizedRow = row.map((cell) => normalizeHeader(cell)).filter(Boolean);
    if (!normalizedRow.length) continue;
    let score = 0;
    normalizedRow.forEach((cell) => {
      if (expected.has(cell)) score += 1;
    });
    if (score >= 3 && (normalizedRow.includes('ANO') || normalizedRow.includes('ANOS'))) return i;
  }
  return 0;
};

const findExactHeaderRowIndex = (matrix = [], expectedHeaders = []) => {
  const expected = expectedHeaders.map((header) => normalizeHeader(header));
  for (let i = 0; i < Math.min(30, matrix.length); i += 1) {
    const row = matrix[i] || [];
    const normalizedRow = row.map((cell) => normalizeHeader(cell)).filter(Boolean);
    if (!normalizedRow.length) continue;
    if (normalizedRow.length !== expected.length) continue;
    if (normalizedRow.every((cell, index) => cell === expected[index])) return i;
  }
  return -1;
};

const getStrictHeaderMismatch = (actualHeaders = [], expectedHeaders = [], optionalHeaders = []) => {
  const actualNormalized   = actualHeaders.map((header) => normalizeHeader(header)).filter(Boolean);
  const expectedNormalized = expectedHeaders.map((header) => normalizeHeader(header));
  const optionalSet        = new Set((optionalHeaders || []).map((h) => normalizeHeader(h)));

  const missing = expectedHeaders.filter((header) => !actualNormalized.includes(normalizeHeader(header)));

  const unexpected = actualHeaders.filter((header) => {
    const normalized = normalizeHeader(header);
    return normalized && !expectedNormalized.includes(normalized) && !optionalSet.has(normalized);
  });

  // orderedMatch: verifica solo las cabeceras requeridas (ignora opcionales)
  const actualRequiredOnly = actualNormalized.filter((h) => !optionalSet.has(h));
  const orderedMatch = actualRequiredOnly.length === expectedNormalized.length
    && actualRequiredOnly.every((header, index) => header === expectedNormalized[index]);

  return { missing, unexpected, orderedMatch };
};

const buildStrictHeaderErrorMessage = (label = 'la base seleccionada', expectedHeaders = [], actualHeaders = []) => {
  const mismatch = getStrictHeaderMismatch(actualHeaders, expectedHeaders);
  const details = [];
  if (mismatch.missing.length) details.push(`faltan columnas: ${mismatch.missing.join(', ')}`);
  if (mismatch.unexpected.length) details.push(`columnas no permitidas: ${mismatch.unexpected.join(', ')}`);
  if (!mismatch.orderedMatch && !mismatch.missing.length && !mismatch.unexpected.length) {
    details.push('el orden de columnas no coincide con la plantilla obligatoria');
  }
  const suffix = details.length ? ` (${details.join(' | ')})` : '';
  return `La estructura del archivo para ${label} es invalida. Debe coincidir exactamente con la nueva plantilla.${suffix}`;
};

const readWorkbookRowsWithStrictHeaders = (worksheet, expectedHeaders = [], label = 'la hoja') => {
  const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, blankrows: false });
  const strictIndex = findExactHeaderRowIndex(matrix, expectedHeaders);
  if (strictIndex < 0) {
    const candidateIndex = detectHeaderRowIndexLoose(matrix, expectedHeaders);
    const actualHeaders = (matrix[candidateIndex] || []).map((header) => repairImportedText(String(header || '')).trim()).filter(Boolean);
    throw new Error(buildStrictHeaderErrorMessage(label, expectedHeaders, actualHeaders));
  }

  const headers = (matrix[strictIndex] || []).map((header) => repairImportedText(String(header || '')).trim());
  const rows = matrix
    .slice(strictIndex + 1)
    .map((cells) => {
      const row = {};
      headers.forEach((header, index) => {
        if (!header) return;
        row[header] = repairImportedText(cells[index]);
      });
      return row;
    })
    .filter((row) => Object.values(row).some((value) => value !== null && value !== undefined && String(value).trim() !== ''));

  return { headers, rows };
};

const detectHeaderRowIndexLoose = (matrix = [], expectedHeaders = []) => {
  const expected = new Set(expectedHeaders.map((header) => normalizeHeader(header)));
  for (let i = 0; i < Math.min(30, matrix.length); i += 1) {
    const row = matrix[i] || [];
    const normalizedRow = row.map((cell) => normalizeHeader(cell)).filter(Boolean);
    if (!normalizedRow.length) continue;
    let score = 0;
    normalizedRow.forEach((cell) => {
      if (expected.has(cell)) score += 1;
    });
    if (score >= 2) return i;
  }
  return 0;
};

const matrixToRows = (worksheet, expectedHeaders = [], loose = false) => {
  const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, blankrows: false });
  const headerRowIndex = loose ? detectHeaderRowIndexLoose(matrix, expectedHeaders) : detectHeaderRowIndex(matrix, expectedHeaders);
  const headers = (matrix[headerRowIndex] || []).map((header) => String(header || '').trim());
  const rows = matrix
    .slice(headerRowIndex + 1)
    .map((cells) => {
      const row = {};
      headers.forEach((header, index) => {
        if (!header) return;
        row[header] = cells[index];
      });
      return row;
    })
    .filter((row) => Object.values(row).some((value) => value !== null && value !== undefined && String(value).trim() !== ''));
  return { rows, headerRowIndex };
};

let georreferenciaSyncPromise = null;

const isMissingRelationError = (error) => {
  const errorCode = String(error?.original?.code || error?.parent?.code || '');
  const msg = String(error?.original?.message || error?.parent?.message || error?.message || '').toLowerCase();
  return errorCode === '42P01' || msg.includes('no existe la relacion') || (msg.includes('relation') && msg.includes('does not exist'));
};

const ensureGeorreferenciaTables = async () => {
  if (!georreferenciaSyncPromise) {
    georreferenciaSyncPromise = Promise.all([
      GeorreferenciaDepartamento.sync(),
      GeorreferenciaMunicipio.sync()
    ]).catch((error) => {
      georreferenciaSyncPromise = null;
      throw error;
    });
  }
  return georreferenciaSyncPromise;
};

const importGeorreferenciaRows = async ({ rows = [], fileName = '', userId = null, sourceLabel = 'archivo' }) => {
  await ensureGeorreferenciaTables();
  const departamentosMap = new Map();
  const municipiosMap = new Map();
  const errores = [];
  const safeRows = Array.isArray(rows) ? rows : [];

  safeRows.forEach((rawRow, index) => {
    const hoja = String(rawRow?.__sheetName || sourceLabel || 'hoja');
    const fila = Number(rawRow?.__rowNumber || (index + 2));
    const codigoMunicipioRaw = pickGeoCell(rawRow, GEO_HEADER_ALIASES.codigo_municipio);
    const codigoDepartamentoDirecto = toCodeText(pickGeoCell(rawRow, GEO_HEADER_ALIASES.codigo_departamento), 2);
    const codigoMunicipio = toCodeText(codigoMunicipioRaw, 5);
    const codigoDepartamento = codigoDepartamentoDirecto || (codigoMunicipio ? codigoMunicipio.slice(0, 2) : null);
    const nombreDepartamento = getGeoDisplayName(pickGeoCell(rawRow, GEO_HEADER_ALIASES.nombre_departamento));
    const nombreMunicipio = getGeoDisplayName(pickGeoCell(rawRow, GEO_HEADER_ALIASES.nombre_municipio));
    const codigoCentroPoblado = toCodeText(pickGeoCell(rawRow, GEO_HEADER_ALIASES.codigo_centro_poblado), 8);
    const nombreCentroPoblado = getGeoDisplayName(pickGeoCell(rawRow, GEO_HEADER_ALIASES.nombre_centro_poblado));
    const tipo = getGeoDisplayName(pickGeoCell(rawRow, GEO_HEADER_ALIASES.tipo));
    const latitud = toNullableCoordinate(pickGeoCell(rawRow, GEO_HEADER_ALIASES.latitud));
    const longitud = toNullableCoordinate(pickGeoCell(rawRow, GEO_HEADER_ALIASES.longitud));

    if (!codigoDepartamento || !nombreDepartamento) {
      errores.push({ hoja, fila, error: 'Faltan codigo o nombre de departamento.' });
      return;
    }

    if (!departamentosMap.has(codigoDepartamento)) {
      departamentosMap.set(codigoDepartamento, {
        codigo_departamento: codigoDepartamento,
        nombre_departamento: nombreDepartamento,
        nombre_normalizado: normalizeGeoJoinKey(nombreDepartamento),
        latitud: latitud ?? calculateFallbackCoordinates(codigoDepartamento, nombreDepartamento, 'lat'),
        longitud: longitud ?? calculateFallbackCoordinates(codigoDepartamento, nombreDepartamento, 'lon'),
        fuente: 'DIVIPOLA:' + (fileName || 'archivo'),
        vigente: true,
        creado_por: userId,
        actualizado_por: userId
      });
    }

    if (codigoMunicipio && nombreMunicipio) {
      municipiosMap.set(`${codigoDepartamento}-${codigoMunicipio}`, {
        codigo_departamento: codigoDepartamento,
        codigo_municipio: codigoMunicipio,
        nombre_municipio: nombreMunicipio,
        nombre_normalizado: normalizeGeoJoinKey(nombreMunicipio),
        latitud: latitud ?? calculateFallbackCoordinates(codigoMunicipio, nombreMunicipio, 'lat'),
        longitud: longitud ?? calculateFallbackCoordinates(codigoMunicipio, nombreMunicipio, 'lon'),
        fuente: 'DIVIPOLA:' + (fileName || 'archivo'),
        vigente: true,
        creado_por: userId,
        actualizado_por: userId
      });
    }

    if (!codigoMunicipio && codigoCentroPoblado && nombreCentroPoblado) {
      const municipioDerivado = codigoCentroPoblado.slice(0, 5);
      municipiosMap.set(`${codigoDepartamento}-${municipioDerivado}`, {
        codigo_departamento: codigoDepartamento,
        codigo_municipio: municipioDerivado,
        nombre_municipio: nombreMunicipio || nombreCentroPoblado,
        nombre_normalizado: normalizeGeoJoinKey(nombreMunicipio || nombreCentroPoblado),
        latitud: latitud ?? calculateFallbackCoordinates(municipioDerivado, nombreMunicipio || nombreCentroPoblado, 'lat'),
        longitud: longitud ?? calculateFallbackCoordinates(municipioDerivado, nombreMunicipio || nombreCentroPoblado, 'lon'),
        fuente: 'DIVIPOLA:' + (fileName || 'archivo') + (tipo ? ':' + tipo : ''),
        vigente: true,
        creado_por: userId,
        actualizado_por: userId
      });
    }
  });

  if (!departamentosMap.size) {
    throw new Error('No se detectaron departamentos validos en la fuente DIVIPOLA.');
  }

  await GeorreferenciaDepartamento.destroy({ where: {} });
  await GeorreferenciaMunicipio.destroy({ where: {} });
  await GeorreferenciaDepartamento.bulkCreate(Array.from(departamentosMap.values()));
  if (municipiosMap.size) {
    await GeorreferenciaMunicipio.bulkCreate(Array.from(municipiosMap.values()));
  }

  return {
    total: safeRows.length,
    importados: departamentosMap.size + municipiosMap.size,
    totalDepartamentos: departamentosMap.size,
    totalMunicipios: municipiosMap.size,
    errores
  };
};

const importGeorreferenciaFromWorkbook = async ({ workbook, fileName = '', userId = null }) => {
  const sheetNames = Array.isArray(workbook?.SheetNames) ? workbook.SheetNames : [];
  if (!sheetNames.length) throw new Error('El archivo de georreferencia no contiene hojas validas.');

  const rows = [];
  const expectedGeoHeaders = GEOREFERENCIA_TEMPLATE_HEADERS[GEOREFERENCIA_CANONICAL_SUBCATEGORY]['Listado Vigentes'];
  sheetNames.forEach((sheetName) => {
    if (normalizeHeader(sheetName).includes('ESTRUCTURA')) return;
    const worksheet = workbook.Sheets[sheetName];
    const { rows: sheetRows, headerRowIndex } = matrixToRows(worksheet, expectedGeoHeaders, true);
    sheetRows.forEach((row, idx) => rows.push({ ...row, __sheetName: sheetName, __rowNumber: headerRowIndex + idx + 2 }));
  });

  return importGeorreferenciaRows({
    rows,
    fileName,
    userId,
    sourceLabel: 'excel'
  });
};

const importGeorreferenciaFromCsv = async ({ filePath, fileName = '', userId = null }) => {
  const rows = [];
  await streamCsvFile({
    filePath,
    onRow: async ({ cells, headers, lineNumber }) => {
      const row = {};
      (headers || []).forEach((header, index) => {
        if (!header) return;
        row[header] = cells[index];
      });
      if (Object.keys(row).length) rows.push({ ...row, __sheetName: 'CSV', __rowNumber: lineNumber });
    }
  });

  return importGeorreferenciaRows({
    rows,
    fileName,
    userId,
    sourceLabel: 'csv'
  });
};
const MATRICULADOS_GEO_CACHE_TTL_MS = 45 * 1000;
const matriculadosGeoDashboardCache = new Map();
const classifyMatriculadosProgramLevel = (programa = '') => {
  // Normalizar: quitar tildes para comparación robusta con datos con/sin acento
  const prog = String(programa || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!prog) return 'SIN INFORMACION';
  // Usar \b para que solo coincida cuando el token está al inicio de palabra
  if (/\bMAESTR/.test(prog)) return 'MAESTRIA';
  if (/\bESPEC/.test(prog)) return 'ESPECIALIZACION';
  // \bTECNOL evita falsos positivos como "BIOTECNOLOGIA"
  if (/\bTECNOL/.test(prog)) return 'TECNOLOGICO';
  return 'PROFESIONAL';
};

const buildMatriculadosGeoCacheKey = ({ programas = [], anios = [], periodos = [], sexos = [], niveles = [] } = {}) =>
  JSON.stringify({
    programas: [...(programas || [])].map((x) => String(x || '').trim()).filter(Boolean).sort(),
    anios: [...(anios || [])].map((x) => String(Number(x) || '')).filter(Boolean).sort(),
    periodos: [...(periodos || [])].map((x) => String(x || '').trim()).filter(Boolean).sort(),
    sexos: [...(sexos || [])].map((x) => normalizeGenero(x)).filter(Boolean).sort(),
    niveles: [...(niveles || [])].map((x) => String(x || '').trim().toUpperCase()).filter(Boolean).sort()
  });

const buildMatriculadosGeoDashboard = async ({ programas = [], anios = [], periodos = [], sexos = [], niveles = [] }) => {
  const normalizedPeriodos = Array.from(
    new Set((periodos || []).map((item) => normalizeSemesterToken(item)).filter(Boolean))
  );
  const normalizedSexos = Array.from(new Set((sexos || []).map((item) => normalizeGenero(item)).filter(Boolean)));
  const normalizedNiveles = Array.from(new Set((niveles || []).map((item) => String(item || '').trim().toUpperCase()).filter(Boolean)));
  const cacheKey = buildMatriculadosGeoCacheKey({ programas, anios, periodos: normalizedPeriodos, sexos: normalizedSexos, niveles: normalizedNiveles });
  const now = Date.now();
  const cached = matriculadosGeoDashboardCache.get(cacheKey);
  if (cached && (now - cached.ts) < MATRICULADOS_GEO_CACHE_TTL_MS) {
    return cached.payload;
  }

  const dbWhere = {};

  if (anios && anios.length > 0) {
    const numericAnios = anios.map(Number).filter(Number.isFinite);
    if (numericAnios.length > 0) dbWhere.anio = { [Op.in]: numericAnios };
  }

  // No filtramos por periodo en SQL: en la base existen formatos como "2025 IP" y "2025 IIP",
  // por lo que filtros exactos tipo IN ('II','IIP') pueden dejar el conjunto en cero.
  // El filtro por semestre se aplica en memoria con deteccion robusta (periodToken 1/2).

  const allRows = await PoblacionalMatriculado.findAll({
    attributes: ['anio', 'semestre', 'programa', 'sexo_biologico', 'pais',
      'departamento', 'municipio', 'codigo_departamento', 'codigo_dane',
      'departamento_nacimiento', 'municipio_nacimiento', 'codigo_departamento_nacimiento', 'codigo_dane_nacimiento'],
    where: Object.keys(dbWhere).length > 0 ? dbWhere : undefined,
    raw: true
  });

  // ── DIVIPOLA reference tables — authoritative name resolution ─────────────
  let refDeptRows = [];
  let refMuniRows = [];
  try {
    [refDeptRows, refMuniRows] = await Promise.all([
      RefDepartamento.findAll({
        where: { activo: true },
        attributes: ['codigo_dane', 'nombre_oficial', 'nombre_normalizado'],
        raw: true
      }),
      RefMunicipio.findAll({
        where: { activo: true },
        attributes: ['codigo_dane', 'codigo_departamento', 'nombre_oficial', 'nombre_normalizado', 'latitud', 'longitud'],
        raw: true
      })
    ]);
  } catch (_refErr) { /* non-critical: fallbacks will apply */ }

  const refDeptByCode = new Map(refDeptRows.map((d) => [d.codigo_dane, d]));
  const refMuniByCode = new Map(refMuniRows.map((m) => [m.codigo_dane, m]));

  // Name-based fallback for rows without DANE codes (older imports)
  const refDeptByNormName = new Map();
  for (const d of refDeptRows) {
    const key = normalizeGeoJoinKey(d.nombre_normalizado || d.nombre_oficial || '');
    if (key) refDeptByNormName.set(key, d);
  }
  for (const [alias, code] of [['BOGOTA', '11'], ['BOGOTA DC', '11'], ['BOGOTA D C', '11']]) {
    const ref = refDeptByCode.get(code);
    if (ref && !refDeptByNormName.has(alias)) refDeptByNormName.set(alias, ref);
  }
  const getDashboardDepartmentRef = (departmentRef = null) => {
    if (!departmentRef) return null;
    if (String(departmentRef.codigo_dane || '') !== '11') return departmentRef;
    return refDeptByCode.get('25') || departmentRef;
  };

  const refMuniByDeptAndName = new Map();
  for (const m of refMuniRows) {
    const key = `${m.codigo_departamento}|${normalizeGeoJoinKey(m.nombre_normalizado || m.nombre_oficial || '')}`;
    if (key) refMuniByDeptAndName.set(key, m);
  }
  // Municipality aliases (e.g. CALI → SANTIAGO DE CALI, BOGOTA variants → BOGOTA D C)
  for (const [rawKey, resolvedName] of [
    ['76|CALI', 'SANTIAGO DE CALI'],
    ['11|BOGOTA', 'BOGOTA D C'],
    ['11|BOGOTA DC', 'BOGOTA D C'],
    ['11|BOGOTA D C', 'BOGOTA D C']
  ]) {
    const [depCode, munAlias] = rawKey.split('|');
    const aliasKey = `${depCode}|${normalizeGeoJoinKey(munAlias)}`;
    if (!refMuniByDeptAndName.has(aliasKey)) {
      const target = refMuniByDeptAndName.get(`${depCode}|${normalizeGeoJoinKey(resolvedName)}`);
      if (target) refMuniByDeptAndName.set(aliasKey, target);
    }
  }

  // ── Georreferencia tables — department coordinates only ───────────────────
  let deptRows = [];
  let georreferenciaStatus = 'ok';

  try {
    await ensureGeorreferenciaTables();
    deptRows = await GeorreferenciaDepartamento.findAll({
      where: { vigente: true },
      attributes: ['codigo_departamento', 'latitud', 'longitud'],
      raw: true
    });
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
    georreferenciaStatus = 'missing_tables';
  }

  // Map: 2-digit DANE code → { lat, lon }
  const geoCoordsByDeptCode = new Map();
  for (const row of deptRows) {
    const code = String(row.codigo_departamento || '').trim();
    if (code) geoCoordsByDeptCode.set(code, { lat: Number(row.latitud), lon: Number(row.longitud) });
  }
  const selectedPrograms = new Set((programas || []).map((item) => normalizeGeoJoinKey(item)));
  const selectedYears = new Set((anios || []).map((item) => String(Number(item))));
  const selectedPeriods = new Set(normalizedPeriodos);
  const selectedSexos = new Set(normalizedSexos);
  const selectedNiveles = new Set(normalizedNiveles);

  const filteredRows = allRows.filter((row) => {
    const programOk = !selectedPrograms.size || selectedPrograms.has(normalizeGeoJoinKey(row.programa));
    const yearOk = !selectedYears.size || selectedYears.has(String(Number(row.anio || 0)));
    const periodToken = /\b(2|II|IIP)\b/i.test(String(row.semestre || '')) ? '2' : '1';
    const periodOk = !selectedPeriods.size || selectedPeriods.has(periodToken);
    const sexoOk = !selectedSexos.size || selectedSexos.has(normalizeGenero(row.sexo_biologico));
    const nivelOk = !selectedNiveles.size || selectedNiveles.has(classifyMatriculadosProgramLevel(row.programa));
    return programOk && yearOk && periodOk && sexoOk && nivelOk;
  });

  // Fallback dimensional: cuando Matriculados fue cargado en modo agregado (sin sexo/territorio),
  // usamos Caracterización para poblar sexo, internacional y mapa geográfico.
  let dimensionalRows = filteredRows;
  let dimensionalSource = 'matriculados';
  const hasSexoInfo = filteredRows.some((row) => normalizeGenero(row.sexo_biologico) !== 'SIN INFORMACION');
  const hasMunicipioInfo = filteredRows.some((row) => normalizeGeoJoinKey(row.municipio_nacimiento || row.municipio));
  const hasInternationalInfo = filteredRows.some((row) => {
    const paisKey = normalizeGeoJoinKey(getGeoDisplayName(row.pais, ''));
    return paisKey && paisKey !== 'COLOMBIA' && paisKey !== 'SIN INFORMACION' && paisKey !== '0';
  });
  const needsDimensionalFallback = filteredRows.length > 0 && (!hasSexoInfo || !hasMunicipioInfo || !hasInternationalInfo);

  if (needsDimensionalFallback) {
    const fallbackWhere = {};
    if (selectedYears.size > 0) {
      const years = Array.from(selectedYears).map((item) => Number(item)).filter(Number.isFinite);
      if (years.length > 0) fallbackWhere.anio = { [Op.in]: years };
    }
    const buildFallbackRows = (rows, ignoreYear = false) => rows.filter((row) => {
      const programOk = !selectedPrograms.size || selectedPrograms.has(normalizeGeoJoinKey(row.programa));
      const yearOk = ignoreYear || !selectedYears.size || selectedYears.has(String(Number(row.anio || 0)));
      const periodToken = normalizeSemesterToken(row.periodo) || '1';
      const periodOk = !selectedPeriods.size || selectedPeriods.has(periodToken);
      const sexoOk = !selectedSexos.size || selectedSexos.has(normalizeGenero(row.genero));
      const nivelOk = !selectedNiveles.size || selectedNiveles.has(classifyMatriculadosProgramLevel(row.programa));
      return programOk && yearOk && periodOk && sexoOk && nivelOk;
    }).map((row) => ({
      anio: row.anio,
      semestre: normalizeSemesterToken(row.periodo) || '1',
      programa: row.programa,
      sexo_biologico: row.genero,
      pais: row.pais_residencia,
      departamento: row.departamento_residencia,
      municipio: row.municipio_residencia,
      codigo_departamento: null,
      codigo_dane: null,
      codigo_departamento_nacimiento: null,
      codigo_dane_nacimiento: null,
      departamento_nacimiento: null,
      municipio_nacimiento: null
    }));

    const fallbackRawRows = await PoblacionalCaracterizacion.findAll({
      where: Object.keys(fallbackWhere).length ? fallbackWhere : undefined,
      attributes: ['anio', 'periodo', 'programa', 'genero', 'pais_residencia', 'departamento_residencia', 'municipio_residencia'],
      raw: true
    });

    let fallbackFilteredRows = buildFallbackRows(fallbackRawRows, false);

    if (fallbackFilteredRows.length === 0 && selectedYears.size > 0) {
      const fallbackRawRowsNoYear = await PoblacionalCaracterizacion.findAll({
        attributes: ['anio', 'periodo', 'programa', 'genero', 'pais_residencia', 'departamento_residencia', 'municipio_residencia'],
        raw: true
      });
      fallbackFilteredRows = buildFallbackRows(fallbackRawRowsNoYear, true);
    }

    if (fallbackFilteredRows.length > 0) {
      // Mantener consistencia visual: cuando Matriculados tiene total filtrado,
      // ajustamos la muestra auxiliar al mismo tamaño para no romper porcentajes.
      const targetSize = filteredRows.length;
      if (targetSize > 0 && fallbackFilteredRows.length !== targetSize) {
        const resized = [];
        if (fallbackFilteredRows.length > targetSize) {
          const step = fallbackFilteredRows.length / targetSize;
          for (let i = 0; i < targetSize; i += 1) {
            resized.push(fallbackFilteredRows[Math.floor(i * step)]);
          }
        } else {
          for (let i = 0; i < targetSize; i += 1) {
            resized.push(fallbackFilteredRows[i % fallbackFilteredRows.length]);
          }
        }
        fallbackFilteredRows = resized;
      }
      dimensionalRows = fallbackFilteredRows;
      dimensionalSource = 'caracterizacion';
    }
  }

  const departmentMap = new Map();
  const countriesMap = new Map();
  const sexoMap = new Map();
  const historicoMap = new Map();
  const incidenciasMap = new Map();
  let matchedDepartments = 0;
  let matchedMunicipios = 0;

  // El histórico principal siempre debe salir de Matriculados filtrado (fuente base),
  // no de la fuente auxiliar de dimensiones.
  filteredRows.forEach((row) => {
    const periodLabel = buildPeriodLabel(row.anio, row.semestre);
    if (!periodLabel) return;
    historicoMap.set(periodLabel, {
      periodLabel,
      anio: Number(row.anio || 0),
      semestre: periodLabel.split('-')[1] || '1',
      total: (historicoMap.get(periodLabel)?.total || 0) + 1
    });
  });

  dimensionalRows.forEach((row) => {
    const pais = getGeoDisplayName(row.pais, 'COLOMBIA') || 'COLOMBIA';
    const sexo = normalizeGenero(row.sexo_biologico);
    sexoMap.set(sexo, (sexoMap.get(sexo) || 0) + 1);
    const countryKey = normalizeGeoJoinKey(pais);
    const existingCountry = countriesMap.get(countryKey) || { name: pais.toUpperCase(), total: 0, programasMap: new Map(), sexoMap: new Map() };
    existingCountry.total += 1;
    if (sexo) existingCountry.sexoMap.set(sexo, (existingCountry.sexoMap.get(sexo) || 0) + 1);
    if (row.programa) {
      const progKey = String(row.programa).trim();
      const existingProg = existingCountry.programasMap.get(progKey) || { programa: progKey, total: 0, sexoMap: new Map() };
      existingProg.total += 1;
      if (sexo) existingProg.sexoMap.set(sexo, (existingProg.sexoMap.get(sexo) || 0) + 1);
      existingCountry.programasMap.set(progKey, existingProg);
    }
    countriesMap.set(countryKey, existingCountry);

    const periodLabel = buildPeriodLabel(row.anio, row.semestre);

    // --- Geo matching: DANE code (primary) then normalized name (fallback) ---
    const deptCodeSource = String(
      row.codigo_departamento_nacimiento || row.codigo_departamento || ''
    ).trim();
    const muniCodeSource = String(
      row.codigo_dane_nacimiento || row.codigo_dane || ''
    ).trim();
    const deptSourceRaw = getGeoDisplayName(row.departamento_nacimiento || row.departamento);
    const muniSourceRaw = getGeoDisplayName(row.municipio_nacimiento || row.municipio);
    const deptNormKey = normalizeGeoJoinKey(deptSourceRaw);
    const muniNormKey = normalizeGeoJoinKey(muniSourceRaw);

    if (!deptCodeSource && !deptNormKey) return; // nothing to match on

    // 1. Resolve department: DANE code (authoritative) → normalized name (fallback)
    let refDept = deptCodeSource ? refDeptByCode.get(deptCodeSource) : null;
    if (!refDept && deptNormKey) refDept = refDeptByNormName.get(deptNormKey) || null;
    if (!refDept) {
      const issueKey = `DEPT|${deptNormKey || deptCodeSource}`;
      incidenciasMap.set(issueKey, {
        departamento_fuente: deptSourceRaw,
        municipio_fuente: muniSourceRaw,
        codigo_departamento_sugerido: null,
        codigo_municipio_sugerido: null,
        estado: 'pendiente',
        total: (incidenciasMap.get(issueKey)?.total || 0) + 1,
        motivo: 'Departamento sin coincidencia DIVIPOLA'
      });
      return;
    }
    refDept = getDashboardDepartmentRef(refDept);

    // 2. Resolve municipality: DANE code (authoritative) → normalized name (fallback)
    let refMuni = muniCodeSource ? refMuniByCode.get(muniCodeSource) : null;
    if (!refMuni && muniNormKey) {
      refMuni = refMuniByDeptAndName.get(`${refDept.codigo_dane}|${muniNormKey}`) || null;
    }
    if (muniSourceRaw && !refMuni) {
      const issueKey = `MUNI|${refDept.codigo_dane}|${muniNormKey}`;
      incidenciasMap.set(issueKey, {
        departamento_fuente: refDept.nombre_oficial,
        municipio_fuente: muniSourceRaw,
        codigo_departamento_sugerido: refDept.codigo_dane,
        codigo_municipio_sugerido: null,
        estado: 'pendiente',
        total: (incidenciasMap.get(issueKey)?.total || 0) + 1,
        motivo: 'Municipio sin coincidencia DIVIPOLA'
      });
    }

    matchedDepartments += 1;
    const deptDaneCode = refDept.codigo_dane;
    const deptName = refDept.nombre_oficial;
    const deptCoords = geoCoordsByDeptCode.get(deptDaneCode);
    const deptEntry = departmentMap.get(deptDaneCode) || {
      code: deptDaneCode,
      name: deptName,
      total: 0,
      lat: deptCoords?.lat ?? null,
      lon: deptCoords?.lon ?? null,
      municipiosMap: new Map(),
      sexoMap: new Map(),
      historicoMap: new Map()
    };
    deptEntry.total += 1;
    deptEntry.sexoMap.set(sexo, (deptEntry.sexoMap.get(sexo) || 0) + 1);
    if (periodLabel) {
      const currentPeriod = deptEntry.historicoMap.get(periodLabel) || {
        periodLabel,
        anio: Number(row.anio || 0),
        semestre: periodLabel.split('-')[1] || '1',
        total: 0
      };
      currentPeriod.total += 1;
      deptEntry.historicoMap.set(periodLabel, currentPeriod);
    }
    departmentMap.set(deptDaneCode, deptEntry);

    if (refMuni) matchedMunicipios += 1;
    const muniDaneCode = refMuni?.codigo_dane || null;
    const muniName = refMuni?.nombre_oficial || muniSourceRaw || null;
    if (!muniDaneCode && !muniName) {
      departmentMap.set(deptDaneCode, deptEntry);
      return;
    }
    const muniMapKey = muniDaneCode || `TXT-${normalizeGeoJoinKey(muniName || '').slice(0, 22)}`;
    const muniEntry = deptEntry.municipiosMap.get(muniMapKey) || {
      codigo: muniMapKey,
      municipio: muniName || muniMapKey,
      total: 0,
      lat: refMuni?.latitud != null ? Number(refMuni.latitud) : calculateFallbackCoordinates(muniMapKey, muniName || '', 'lat'),
      lon: refMuni?.longitud != null ? Number(refMuni.longitud) : calculateFallbackCoordinates(muniMapKey, muniName || '', 'lon'),
      sexoMap: new Map(),
      historicoMap: new Map()
    };
    muniEntry.total += 1;
    muniEntry.sexoMap.set(sexo, (muniEntry.sexoMap.get(sexo) || 0) + 1);
    if (periodLabel) {
      const currentPeriod = muniEntry.historicoMap.get(periodLabel) || {
        periodLabel,
        anio: Number(row.anio || 0),
        semestre: periodLabel.split('-')[1] || '1',
        total: 0
      };
      currentPeriod.total += 1;
      muniEntry.historicoMap.set(periodLabel, currentPeriod);
    }
    deptEntry.municipiosMap.set(muniMapKey, muniEntry);
  });

  // Garantia de salida: si hay registros pero no se lograron armar departamentos,
  // reconstruimos desde texto crudo para evitar mapa vacio.
  if (departmentMap.size === 0 && dimensionalRows.length > 0) {
    dimensionalRows.forEach((row) => {
      const deptNameRaw = String(row?.departamento || '').trim();
      if (!deptNameRaw) return;
      const sexo = normalizeGenero(row.sexo_biologico);
      const periodLabel = buildPeriodLabel(row.anio, row.semestre);
      const deptKey = normalizeGeoJoinKey(deptNameRaw) || 'SIN INFORMACION';
      const deptCode = `TXT-${deptKey.slice(0, 18)}`;
      const muniNameRaw = String(row?.municipio || '').trim() || 'SIN INFORMACION';
      const muniKey = normalizeGeoJoinKey(muniNameRaw) || 'SIN-INFORMACION';
      const muniCode = `TXT-${muniKey.slice(0, 22)}`;

      const deptEntry = departmentMap.get(deptCode) || {
        code: deptCode,
        name: deptNameRaw,
        total: 0,
        lat: null,
        lon: null,
        municipiosMap: new Map(),
        sexoMap: new Map(),
        historicoMap: new Map()
      };
      deptEntry.total += 1;
      deptEntry.sexoMap.set(sexo, (deptEntry.sexoMap.get(sexo) || 0) + 1);
      if (periodLabel) {
        const currentPeriod = deptEntry.historicoMap.get(periodLabel) || {
          periodLabel,
          anio: Number(row.anio || 0),
          semestre: periodLabel.split('-')[1] || '1',
          total: 0
        };
        currentPeriod.total += 1;
        deptEntry.historicoMap.set(periodLabel, currentPeriod);
      }
      departmentMap.set(deptCode, deptEntry);

      const muniEntry = deptEntry.municipiosMap.get(muniCode) || {
        codigo: muniCode,
        municipio: muniNameRaw,
        total: 0,
        lat: null,
        lon: null,
        sexoMap: new Map(),
        historicoMap: new Map()
      };
      muniEntry.total += 1;
      muniEntry.sexoMap.set(sexo, (muniEntry.sexoMap.get(sexo) || 0) + 1);
      if (periodLabel) {
        const currentPeriod = muniEntry.historicoMap.get(periodLabel) || {
          periodLabel,
          anio: Number(row.anio || 0),
          semestre: periodLabel.split('-')[1] || '1',
          total: 0
        };
        currentPeriod.total += 1;
        muniEntry.historicoMap.set(periodLabel, currentPeriod);
      }
      deptEntry.municipiosMap.set(muniCode, muniEntry);
    });
  }

  const payload = {
    totalRegistros: filteredRows.length,
    geography: {
      departments: Array.from(departmentMap.values()).map((item) => ({
        code: item.code,
        codigo_departamento_divipola: item.code,
        name: item.name,
        departamento_normalizado: item.name,
        total: item.total,
        lat: Number.isFinite(item.lat) ? item.lat : null,
        lon: Number.isFinite(item.lon) ? item.lon : null,
        sexo: Array.from(item.sexoMap instanceof Map ? item.sexoMap.entries() : []).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
        historico: Array.from(item.historicoMap instanceof Map ? item.historicoMap.values() : []).sort((a, b) => a.periodLabel.localeCompare(b.periodLabel, 'es')),
        municipios: Array.from(item.municipiosMap.values()).map((muni) => ({
          codigo: muni.codigo,
          codigo_municipio_divipola: muni.codigo,
          municipio: muni.municipio,
          municipio_normalizado: muni.municipio,
          total: muni.total,
          lat: Number.isFinite(muni.lat) ? muni.lat : null,
          lon: Number.isFinite(muni.lon) ? muni.lon : null,
          sexo: Array.from(muni.sexoMap instanceof Map ? muni.sexoMap.entries() : []).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
          historico: Array.from(muni.historicoMap instanceof Map ? muni.historicoMap.values() : []).sort((a, b) => a.periodLabel.localeCompare(b.periodLabel, 'es'))
        })).sort((a, b) => b.total - a.total)
      })).sort((a, b) => b.total - a.total),
      countries: Array.from(countriesMap.values()).sort((a, b) => b.total - a.total).map((c) => ({
        name: c.name,
        total: c.total,
        sexo: Array.from(c.sexoMap instanceof Map ? c.sexoMap.entries() : []).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
        programas: Array.from(c.programasMap instanceof Map ? c.programasMap.values() : []).map((p) => ({
          programa: p.programa,
          total: p.total,
          sexo: Array.from(p.sexoMap instanceof Map ? p.sexoMap.entries() : []).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total)
        })).sort((a, b) => b.total - a.total)
      }))
    },
    sexo: Array.from(sexoMap.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
    programasPorSexo: (() => {
      const map = {};
      dimensionalRows.forEach((row) => {
        const sexo = normalizeGenero(row.sexo_biologico);
        if (!sexo) return;
        const prog = String(row.programa || '').trim();
        if (!prog) return;
        if (!map[sexo]) map[sexo] = new Map();
        map[sexo].set(prog, (map[sexo].get(prog) || 0) + 1);
      });
      return Object.fromEntries(
        Object.entries(map).map(([sexo, progMap]) => [
          sexo,
          Array.from(progMap.entries())
            .map(([programa, total]) => ({ programa, total }))
            .sort((a, b) => b.total - a.total)
        ])
      );
    })(),
    historico: Array.from(historicoMap.values()).sort((a, b) => a.periodLabel.localeCompare(b.periodLabel, 'es')),
    nivelesFormacion: (() => {
      const nivelMap = { TECNOLOGICO: { total: 0, programas: new Set() }, PROFESIONAL: { total: 0, programas: new Set() }, ESPECIALIZACION: { total: 0, programas: new Set() }, MAESTRIA: { total: 0, programas: new Set() } };
      filteredRows.forEach((row) => {
        const nivel = classifyMatriculadosProgramLevel(row.programa);
        if (nivel === 'SIN INFORMACION') return;
        nivelMap[nivel].total += 1;
        nivelMap[nivel].programas.add(row.programa);
      });
      return Object.entries(nivelMap).map(([nivel, data]) => ({ nivel, total: data.total, programas: data.programas.size }));
    })(),
    semestres: (() => {
      const s1Map = new Map(); const s2Map = new Map();
      filteredRows.forEach((row) => {
        const yr = String(Number(row.anio || 0));
        if (!yr || yr === '0') return;
        const isS2 = /\b(2|II|IIP)\b/i.test(String(row.semestre || ''));
        if (isS2) { s2Map.set(yr, (s2Map.get(yr) || 0) + 1); }
        else { s1Map.set(yr, (s1Map.get(yr) || 0) + 1); }
      });
      const years = Array.from(new Set([...s1Map.keys(), ...s2Map.keys()])).sort();
      return years.map((yr) => ({ anio: yr, semestre1: s1Map.get(yr) || 0, semestre2: s2Map.get(yr) || 0 }));
    })(),
    filtrosAplicados: {
      programas: programas || [],
      anios: (anios || []).map((item) => String(item)),
      periodos: normalizedPeriodos,
      sexos: normalizedSexos,
      niveles: normalizedNiveles
    },
    programasDisponibles: Array.from(new Set(allRows.map((r) => r.programa).filter(Boolean))).sort(),
    sexosDisponibles: Array.from(
      new Set([
        ...allRows.map((r) => normalizeGenero(r.sexo_biologico)),
        ...dimensionalRows.map((r) => normalizeGenero(r.sexo_biologico))
      ].filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, 'es')),
    nivelesDisponibles: Array.from(new Set(allRows.map((r) => classifyMatriculadosProgramLevel(r.programa)).filter((x) => x && x !== 'SIN INFORMACION'))).sort((a, b) => a.localeCompare(b, 'es')),
    aniosDisponibles: Array.from(new Set(allRows.map((r) => String(Number(r.anio || 0))).filter((yr) => yr !== '0'))).sort(),
    calidadCruce: {
      coberturaDepartamento: dimensionalRows.length ? Number(((matchedDepartments / dimensionalRows.length) * 100).toFixed(2)) : 0,
      coberturaMunicipio: dimensionalRows.length ? Number(((matchedMunicipios / dimensionalRows.length) * 100).toFixed(2)) : 0,
      incidenciasPendientes: Array.from(incidenciasMap.values()).reduce((acc, item) => acc + Number(item.total || 0), 0)
    },
    georreferencia: {
      status: georreferenciaStatus,
      message: georreferenciaStatus === 'missing_tables'
        ? 'Las tablas de Georreferencia no existen en esta base de datos; el cruce geográfico se entrega en modo degradado.'
        : (dimensionalSource === 'caracterizacion'
          ? 'Cruce geográfico activo (sexo/territorio complementado desde Caracterización).'
          : 'Cruce geográfico activo.')
    },
    incidencias: Array.from(incidenciasMap.values()).sort((a, b) => b.total - a.total)
  };
  matriculadosGeoDashboardCache.set(cacheKey, { ts: now, payload });
  if (matriculadosGeoDashboardCache.size > 40) {
    const firstKey = matriculadosGeoDashboardCache.keys().next().value;
    if (firstKey) matriculadosGeoDashboardCache.delete(firstKey);
  }
  return payload;
};

const getMatriculadosIncidencias = async (req, res) => {
  try {
    const page = Math.max(Number(req.query?.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query?.limit || 10), 1), 100);
    const estado = normalizeText(req.query?.estado);
    const search = normalizeGeoJoinKey(req.query?.search || '');
    const payload = await buildMatriculadosGeoDashboard({ programas: [], anios: [], periodos: [] });
    let rows = payload.incidencias || [];
    if (estado) rows = rows.filter((item) => String(item.estado || '').toLowerCase() === String(estado).toLowerCase());
    if (search) {
      rows = rows.filter((item) =>
        normalizeGeoJoinKey(item.departamento_fuente).includes(search)
        || normalizeGeoJoinKey(item.municipio_fuente).includes(search)
      );
    }
    const offset = (page - 1) * limit;
    return res.json({
      success: true,
      data: {
        rows: rows.slice(offset, offset + limit),
        pagination: {
          total: rows.length,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(rows.length / limit))
        }
      }
    });
  } catch (error) {
    console.error('Error al consultar incidencias de matriculados:', error);
    return res.status(500).json({ success: false, message: 'Error al consultar incidencias de ubicación' });
  }
};

const buildHeaderOnlyWorksheet = (headers = []) => {
  const safeHeaders = Array.isArray(headers) ? headers : [];
  return XLSX.utils.aoa_to_sheet([safeHeaders]);
};

const getEstadisticas = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      aggregate = '',
      categoria = '',
      subcategoria = '',
      subcategorias = '',
      recent_years = '',
      anio = '',
      programa = '',
      dependencia = '',
      search = ''
    } = req.query;

    const where = {};
    if (categoria) where.categoria = categoria;
    if (subcategoria) where.subcategoria = subcategoria;
    const parsedSubcategorias = subcategorias
      ? String(subcategorias)
        .split(',')
        .map((item) => String(item || '').trim())
        .filter(Boolean)
      : [];
    if (parsedSubcategorias.length > 0) {
      where.subcategoria = { [Op.in]: parsedSubcategorias };
    }
    if (anio) where.anio = Number(anio);
    if (programa) where.programa = { [Op.iLike]: `%${programa}%` };
    if (dependencia) where.dependencia = { [Op.iLike]: `%${dependencia}%` };
    if (search) {
      where[Op.or] = [
        { indicador: { [Op.iLike]: `%${search}%` } },
        { subcategoria: { [Op.iLike]: `%${search}%` } },
        { fuente: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (aggregate === 'poblacional_series' && where.categoria === 'Poblacional') {
      const currentYear = new Date().getFullYear();
      const maxClosedYear = currentYear - 1;
      const recentYearsNum = Number(recent_years);
      where[Op.and] = [...(where[Op.and] || []), { anio: { [Op.lte]: maxClosedYear } }];
      if (Number.isFinite(recentYearsNum) && recentYearsNum > 0) {
        const minYear = currentYear - Math.trunc(recentYearsNum) + 1;
        where[Op.and].push({ anio: { [Op.gte]: minYear } });
      }

      const useRecordCountMetric = parsedSubcategorias.length > 0
        && parsedSubcategorias.every((sub) => RECORD_COUNT_SUBCATEGORIES.has(sub));
      const useUniqueDetailAggregate = parsedSubcategorias.length > 0
        && parsedSubcategorias.every((sub) => Object.prototype.hasOwnProperty.call(POBLACIONAL_SERIES_UNIQUE_COUNT_CONFIG, sub));

      if (useUniqueDetailAggregate) {
        const rows = await buildPoblacionalSeriesUniqueCountRows({
          parsedSubcategorias,
          queryFilters: { anio, programa, dependencia, search },
          recentYearsNum,
          maxClosedYear
        });

        return res.json({
          success: true,
          data: {
            estadisticas: rows,
            pagination: {
              total: rows.length,
              page: 1,
              limit: rows.length,
              totalPages: 1
            }
          }
        });
      }

      const aggregateMetric = useRecordCountMetric
        ? fn('COUNT', literal('*'))
        : fn('COALESCE', fn('SUM', col('valor')), 0);

      const rows = await Estadistica.findAll({
        where,
        attributes: [
          'categoria',
          'subcategoria',
          'anio',
          'programa',
          'dependencia',
          'indicador',
          'unidad',
          'fuente',
          'observaciones',
          [aggregateMetric, 'valor']
        ],
        group: ['categoria', 'subcategoria', 'anio', 'programa', 'dependencia', 'indicador', 'unidad', 'fuente', 'observaciones'],
        order: [['anio', 'ASC'], ['subcategoria', 'ASC'], ['programa', 'ASC'], ['observaciones', 'ASC']],
        raw: true
      });

      return res.json({
        success: true,
        data: {
          estadisticas: rows.map((row) => ({
            ...row,
            valor: Number(row.valor || 0)
          })),
          pagination: {
            total: rows.length,
            page: 1,
            limit: rows.length,
            totalPages: 1
          }
        }
      });
    }

    if (aggregate === 'caracterizacion_dashboard' && where.categoria === 'Poblacional') {
      const programas = parseQueryListParam(req.query, 'programas');
      const aniosList = parseQueryListParam(req.query, 'anios').map((x) => Number(x)).filter((x) => Number.isFinite(x));
      const periodos = parseQueryListParam(req.query, 'periodos');
      const rawWhere = {};
      if (programas.length) rawWhere.programa = { [Op.in]: programas };
      // No filtramos por columna "anio" en SQL cuando se usa este agregado:
      // en caracterizacion el periodo puede ser la fuente mas confiable (ej. "2025 IIP")
      // y existen filas con inconsistencias entre anio y periodo. El filtro por anio se aplica
      // despues usando anio derivado desde periodo para mantener los recuentos exactos.

      let rows = await PoblacionalCaracterizacion.findAll({
        where: rawWhere,
        attributes: ['anio', 'periodo', 'programa', 'genero', 'victima_conflicto_armado', 'estrato', 'grupo_etnico'],
        raw: true
      });

      if (periodos.length) {
        rows = rows.filter((row) => periodos.includes(getRawPeriodLabel(row)));
      }
      if (aniosList.length) {
        rows = rows.filter((row) => {
          const derivedAnio = parseAnio(row.periodo) || Number(row.anio) || 0;
          return aniosList.includes(derivedAnio);
        });
      }

      const countBy = (list, getter) => {
        const map = new Map();
        list.forEach((item) => {
          const key = getter(item);
          map.set(key, (map.get(key) || 0) + 1);
        });
        return Array.from(map.entries()).map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total);
      };

      const victimasRows = rows.filter((row) => normalizeSiNo(row.victima_conflicto_armado) === 'SI');
      const afroRows = rows.filter((row) => isAfrodescendiente(row.grupo_etnico));

      const periodSeries = countBy(rows, (row) => getRawPeriodLabel(row))
        .map((item) => {
          const [anioLabel, p] = item.label.split('-');
          return { periodLabel: item.label, anio: Number(anioLabel) || 0, periodOrder: (Number(anioLabel) || 0) * 10 + (Number(p) || 1), total: item.total };
        })
        .sort((a, b) => a.periodOrder - b.periodOrder);

      return res.json({
        success: true,
        data: {
          totalRegistros: rows.length,
          periodSeries,
          victimas: {
            total: victimasRows.length,
            distribucion: countBy(rows, (row) => normalizeSiNo(row.victima_conflicto_armado)),
            genero: countBy(victimasRows, (row) => normalizeGenero(row.genero))
          },
          afrodescendientes: {
            total: afroRows.length,
            genero: countBy(afroRows, (row) => normalizeGenero(row.genero))
          },
          generoGeneral: {
            distribucion: countBy(rows, (row) => normalizeGenero(row.genero))
          },
          estratos: {
            distribucion: countBy(rows, (row) => String(row.estrato || 'Sin informacion').trim() || 'Sin informacion')
          },
          gruposEtnicos: {
            distribucion: countBy(rows, (row) => normalizeGrupoEtnico(row.grupo_etnico))
          }
        }
      });
    }

    if (aggregate === 'matriculados_geo_dashboard' && where.categoria === 'Poblacional') {
      const programas = parseQueryListParam(req.query, 'programas');
      const anios = parseQueryListParam(req.query, 'anios').map((x) => Number(x)).filter((x) => Number.isFinite(x));
      const periodos = parseQueryListParam(req.query, 'periodos');
      const sexos = parseQueryListParam(req.query, 'sexos');
      const niveles = parseQueryListParam(req.query, 'niveles');
      const payload = await buildMatriculadosGeoDashboard({ programas, anios, periodos, sexos, niveles });
      return res.json({ success: true, data: payload });
    }

    if (aggregate === 'recurso_humano_dashboard' && (!where.categoria || where.categoria === 'Recurso Humano')) {
      const asList = (rows, key, valueKey = null, fallback = 'Sin informaciÃƒÆ’Ã‚Â³n') => {
        const map = new Map();
        rows.forEach((row) => {
          const label = String((typeof key === 'function' ? key(row) : row[key]) || '').trim() || fallback;
          const amount = valueKey ? Number(row[valueKey] || 0) : 1;
          map.set(label, (map.get(label) || 0) + amount);
        });
        return Array.from(map.entries())
          .map(([label, total]) => ({ label, total: Number(total || 0) }))
          .sort((a, b) => b.total - a.total);
      };

      const byYear = (rows, valueKey = null) => {
        const map = new Map();
        rows.forEach((row) => {
          const anio = Number(row.anio || 0);
          if (!anio) return;
          const amount = valueKey ? Number(row[valueKey] || 0) : 1;
          map.set(anio, (map.get(anio) || 0) + amount);
        });
        return Array.from(map.entries())
          .map(([anio, total]) => ({ anio: Number(anio), total: Number(total || 0) }))
          .sort((a, b) => a.anio - b.anio);
      };

      const sumNum = (rows, key) => rows.reduce((acc, row) => acc + (Number(row[key] || 0) || 0), 0);
      const avgNum = (rows, key) => {
        const nums = rows.map((row) => Number(row[key] || 0)).filter((x) => Number.isFinite(x) && x > 0);
        if (!nums.length) return 0;
        return Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2));
      };
      const top = (list, limit = 8) => list.slice(0, limit);
      const uniq = (rows, key) =>
        Array.from(new Set(rows.map((row) => String(row[key] || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));

      const [docentesRows, administrativosRows, outsourcingRows, ondasRows] = await Promise.all([
        RecursoHumanoDocente.findAll({
          attributes: ['anio', 'periodo', 'docente', 'genero_biologico', 'departamento_dependencia', 'programa', 'tipo_vinculacion', 'contrato', 'cargo', 'escalafon', 'total_horas', 'total_docentes', 'edad'],
          raw: true
        }),
        RecursoHumanoAdministrativo.findAll({
          attributes: ['anio', 'periodo', 'estado_laboral', 'nombre_empleado', 'dependencia', 'vicerectoria', 'clase_contrato', 'genero_biologico', 'sueldo_anual', 'sueldo_mes'],
          raw: true
        }),
        RecursoHumanoOutsourcing.findAll({
          attributes: ['anio', 'periodo', 'cargo', 'genero_biologico', 'cantidad'],
          raw: true
        }),
        RecursoHumanoOnda.findAll({
          attributes: ['anio', 'periodo', 'nombre', 'genero'],
          raw: true
        })
      ]);

      const docentes = docentesRows.map((row) => ({
        ...row,
        genero: normalizeGenero(row.genero_biologico),
        peso: Number(row.total_docentes || 0) > 0 ? Number(row.total_docentes) : 1
      }));
      const administrativos = administrativosRows.map((row) => ({
        ...row,
        genero: normalizeGenero(row.genero_biologico)
      }));
      const outsourcing = outsourcingRows.map((row) => ({
        ...row,
        genero: normalizeGenero(row.genero_biologico),
        cantidad: Number(row.cantidad || 0) || 0
      }));
      const ondas = ondasRows.map((row) => ({
        ...row,
        genero: normalizeGenero(row.genero)
      }));

      const docentesTotal = docentes.reduce((acc, row) => acc + (Number(row.peso || 0) || 0), 0);
      const administrativosTotal = administrativos.length;
      const outsourcingTotal = outsourcing.reduce((acc, row) => acc + (Number(row.cantidad || 0) || 0), 0);
      const ondasTotal = ondas.length;

      return res.json({
        success: true,
        data: {
          generatedAt: new Date().toISOString(),
          overview: {
            totalRegistros:
              docentes.length +
              administrativos.length +
              outsourcing.length +
              ondas.length,
            totalPersonas: docentesTotal + administrativosTotal + outsourcingTotal + ondasTotal,
            porSubbase: [
              { key: 'Docentes', total: docentesTotal, registros: docentes.length },
              { key: 'Administrativos', total: administrativosTotal, registros: administrativos.length },
              { key: 'Outsourcing', total: outsourcingTotal, registros: outsourcing.length },
              { key: 'Ondas', total: ondasTotal, registros: ondas.length }
            ]
          },
          catalogs: {
            anios: Array.from(
              new Set(
                [...docentes, ...administrativos, ...outsourcing, ...ondas]
                  .map((row) => Number(row.anio || 0))
                  .filter((x) => Number.isFinite(x) && x > 0)
              )
            ).sort((a, b) => a - b),
            docentes: {
              dependencias: uniq(docentes, 'departamento_dependencia'),
              programas: uniq(docentes, 'programa'),
              vinculaciones: uniq(docentes, 'tipo_vinculacion')
            },
            administrativos: {
              dependencias: uniq(administrativos, 'dependencia'),
              vicerectorias: uniq(administrativos, 'vicerectoria'),
              contratos: uniq(administrativos, 'clase_contrato')
            }
          },
          docentes: {
            rows: docentes,
            totalPersonas: docentesTotal,
            totalRegistros: docentes.length,
            promedioEdad: avgNum(docentes, 'edad'),
            promedioHoras: avgNum(docentes, 'total_horas'),
            porAnio: byYear(docentes, 'peso'),
            porGenero: asList(docentes, (row) => row.genero, 'peso'),
            porVinculacion: asList(docentes, 'tipo_vinculacion', 'peso'),
            porContrato: asList(docentes, 'contrato', 'peso'),
            porDependencia: top(asList(docentes, 'departamento_dependencia', 'peso'), 12),
            porPrograma: top(asList(docentes, 'programa', 'peso'), 12),
            porCargo: top(asList(docentes, 'cargo', 'peso'), 10)
          },
          administrativos: {
            rows: administrativos,
            totalPersonas: administrativosTotal,
            totalRegistros: administrativos.length,
            nominaMes: sumNum(administrativos, 'sueldo_mes'),
            nominaAnual: sumNum(administrativos, 'sueldo_anual'),
            porAnio: byYear(administrativos),
            porGenero: asList(administrativos, 'genero'),
            porDependencia: top(asList(administrativos, 'dependencia'), 12),
            porVicerectoria: top(asList(administrativos, 'vicerectoria'), 10),
            porContrato: top(asList(administrativos, 'clase_contrato'), 10),
            porEstadoLaboral: asList(administrativos, 'estado_laboral')
          },
          outsourcing: {
            rows: outsourcing,
            totalPersonas: outsourcingTotal,
            totalRegistros: outsourcing.length,
            porAnio: byYear(outsourcing, 'cantidad'),
            porGenero: asList(outsourcing, 'genero', 'cantidad'),
            porCargo: top(asList(outsourcing, 'cargo', 'cantidad'), 12)
          },
          ondas: {
            rows: ondas,
            totalPersonas: ondasTotal,
            totalRegistros: ondas.length,
            porAnio: byYear(ondas),
            porGenero: asList(ondas, 'genero'),
            porPeriodo: top(asList(ondas, 'periodo'), 12)
          }
        }
      });
    }

    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 20, 1), 50000);
    const offset = (currentPage - 1) * currentLimit;

    const { count, rows } = await Estadistica.findAndCountAll({
      where,
      order: [['anio', 'DESC'], ['categoria', 'ASC'], ['indicador', 'ASC']],
      limit: currentLimit,
      offset
    });

    return res.json({
      success: true,
      data: {
        estadisticas: rows,
        pagination: {
          total: count,
          page: currentPage,
          limit: currentLimit,
          totalPages: Math.ceil(count / currentLimit)
        }
      }
    });
  } catch (error) {
    console.error('Error al listar estadisticas:', error);
    return res.status(500).json({ success: false, message: 'Error al listar estadisticas' });
  }
};

const getResumen = async (req, res) => {
  try {
    const { anio = '' } = req.query;
    const where = {};
    if (anio) where.anio = Number(anio);

    const [totalRegistros, totalCategorias, aniosActivos, totalValor] = await Promise.all([
      Estadistica.count({ where }),
      Estadistica.count({ where, distinct: true, col: 'categoria' }),
      Estadistica.count({ where, distinct: true, col: 'anio' }),
      Estadistica.findOne({
        where,
        attributes: [[fn('COALESCE', fn('SUM', col('valor')), 0), 'sumValor']],
        raw: true
      })
    ]);

    const topCategorias = await Estadistica.findAll({
      where,
      attributes: [
        'categoria',
        [fn('COUNT', col('id')), 'total'],
        [fn('COALESCE', fn('SUM', col('valor')), 0), 'valorTotal']
      ],
      group: ['categoria'],
      order: [[literal('total'), 'DESC']],
      limit: 8,
      raw: true
    });

    return res.json({
      success: true,
      data: {
        totales: {
          registros: totalRegistros,
          categorias: totalCategorias,
          anios: aniosActivos,
          valorAcumulado: Number(totalValor?.sumValor || 0)
        },
        topCategorias: topCategorias.map((item) => ({
          categoria: item.categoria,
          total: Number(item.total || 0),
          valorTotal: Number(item.valorTotal || 0)
        }))
      }
    });
  } catch (error) {
    console.error('Error al obtener resumen estadÃƒÆ’Ã‚Â­stico:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener resumen estadÃƒÆ’Ã‚Â­stico' });
  }
};

const getCargues = async (req, res) => {
  try {
    const { categoria = '', subcategoria = '', page = 1, limit = 50 } = req.query;
    const where = {};
    if (categoria) where.categoria = categoria;
    if (subcategoria) where.subcategoria = subcategoria;

    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const allRows = await GestionInformacionCarga.findAll({
      where,
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      raw: true
    });

    const toCargaKey = (row = {}) => {
      const categoriaKey = normalizeHeader(String(row.categoria || ''));
      const subcategoriaRaw = String(row.subcategoria || row.variable || row.categoria || '');
      const subcategoriaKey = normalizeHeader(subcategoriaRaw);
      return `${categoriaKey}||${subcategoriaKey}`;
    };

    // Mantener solo el último cargue por combinación categoría/subcategoría normalizadas.
    const latestByKey = new Map();
    allRows.forEach((row) => {
      const key = toCargaKey(row);
      if (!latestByKey.has(key)) {
        latestByKey.set(key, row);
      }
    });
    const rows = Array.from(latestByKey.values());
    const fallbackWhere = {};
    if (categoria) fallbackWhere.categoria = categoria;
    if (subcategoria) fallbackWhere.subcategoria = subcategoria;

    const agregados = await Estadistica.findAll({
      where: fallbackWhere,
      attributes: [
        'categoria',
        'subcategoria',
        [fn('COUNT', col('id')), 'totalCargados'],
        [fn('MAX', col('updated_at')), 'ultimaActualizacion']
      ],
      group: ['categoria', 'subcategoria'],
      order: [[literal('"totalCargados"'), 'DESC']],
      raw: true
    });

    const keysConLog = new Set(rows.map((item) => toCargaKey(item)));

    const carguesFallback = agregados
      .filter((row) => !keysConLog.has(toCargaKey(row)))
      .map((row, index) => {
        const total = Number(row.totalCargados || 0);
        return {
          id: `fallback-${index + 1}`,
          categoria: row.categoria,
          subcategoria: row.subcategoria,
          variable: row.subcategoria || row.categoria,
          archivo_nombre: 'Historico sin log de importacion',
          total_plantilla: total,
          total_cargados: total,
          total_omitidos: 0,
          porcentaje_cargado: 100,
          estado: 'exitoso',
          created_at: row.ultimaActualizacion,
          createdAt: row.ultimaActualizacion
        };
      });

    const merged = [...rows, ...carguesFallback];
    const mergedSorted = merged.sort((a, b) => {
      const da = new Date(a.createdAt || a.created_at || 0).getTime();
      const db = new Date(b.createdAt || b.created_at || 0).getTime();
      return db - da;
    });
    const totalMerged = mergedSorted.length;
    const offset = (currentPage - 1) * currentLimit;
    const paged = mergedSorted.slice(offset, offset + currentLimit);

    return res.json({
      success: true,
      data: {
        cargues: paged,
        pagination: {
          total: totalMerged,
          page: currentPage,
          limit: currentLimit,
          totalPages: Math.ceil(totalMerged / currentLimit)
        }
      }
    });
  } catch (error) {
    console.error('Error al listar cargues:', error);
    return res.status(500).json({ success: false, message: 'Error al listar historial de cargues' });
  }
};

const createEstadistica = async (req, res) => {
  try {
    const payload = {
      categoria: normalizeText(req.body.categoria),
      subcategoria: normalizeText(req.body.subcategoria),
      anio: Number(req.body.anio),
      programa: normalizeText(req.body.programa),
      dependencia: normalizeText(req.body.dependencia),
      indicador: normalizeText(req.body.indicador),
      valor: toNumber(req.body.valor),
      unidad: normalizeText(req.body.unidad),
      fuente: normalizeText(req.body.fuente),
      observaciones: normalizeText(req.body.observaciones),
      creado_por: req.user?.id || null,
      actualizado_por: req.user?.id || null
    };

    if (!payload.categoria || !payload.anio || !payload.indicador || payload.valor === null) {
      return res.status(400).json({
        success: false,
        message: 'Campos obligatorios: categoria, anio, indicador, valor'
      });
    }

    const estadistica = await Estadistica.create(payload);
    return res.status(201).json({
      success: true,
      message: 'Registro estadÃƒÆ’Ã‚Â­stico creado exitosamente',
      data: { estadistica }
    });
  } catch (error) {
    console.error('Error al crear estadÃƒÆ’Ã‚Â­stica:', error);
    return res.status(500).json({ success: false, message: 'Error al crear estadÃƒÆ’Ã‚Â­stica' });
  }
};

const updateEstadistica = async (req, res) => {
  try {
    const { id } = req.params;
    const estadistica = await Estadistica.findByPk(id);
    if (!estadistica) {
      return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    }

    const nextData = {
      categoria: normalizeText(req.body.categoria) || estadistica.categoria,
      subcategoria: normalizeText(req.body.subcategoria),
      anio: Number(req.body.anio) || estadistica.anio,
      programa: normalizeText(req.body.programa),
      dependencia: normalizeText(req.body.dependencia),
      indicador: normalizeText(req.body.indicador) || estadistica.indicador,
      valor: toNumber(req.body.valor) ?? Number(estadistica.valor),
      unidad: normalizeText(req.body.unidad),
      fuente: normalizeText(req.body.fuente),
      observaciones: normalizeText(req.body.observaciones),
      actualizado_por: req.user?.id || null
    };

    await estadistica.update(nextData);
    return res.json({
      success: true,
      message: 'Registro estadÃƒÆ’Ã‚Â­stico actualizado',
      data: { estadistica }
    });
  } catch (error) {
    console.error('Error al actualizar estadÃƒÆ’Ã‚Â­stica:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar estadÃƒÆ’Ã‚Â­stica' });
  }
};

const deleteEstadistica = async (req, res) => {
  try {
    const { id } = req.params;
    const estadistica = await Estadistica.findByPk(id);
    if (!estadistica) {
      return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    }

    await estadistica.destroy();
    return res.json({
      success: true,
      message: 'Registro estadÃƒÆ’Ã‚Â­stico eliminado'
    });
  } catch (error) {
    console.error('Error al eliminar estadÃƒÆ’Ã‚Â­stica:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar estadÃƒÆ’Ã‚Â­stica' });
  }
};

const downloadTemplate = async (req, res) => {
  try {
    const categoriaRaw = String(req.query.categoria || '').trim();
    const subcategoriaRaw = String(req.query.subcategoria || '').trim();
    const subcategoriaToken = normalizeHeader(subcategoriaRaw);
    const forceGeorreferenciaTemplate = subcategoriaToken === normalizeHeader(GEOREFERENCIA_CANONICAL_SUBCATEGORY)
      || subcategoriaToken.includes('DIVIPOLA');
    const categoria = forceGeorreferenciaTemplate ? 'Georreferencia' : resolveCategoria(categoriaRaw);
    const georreferenciaSubcategoria = resolveGeorreferenciaSubcategory(req.query.subcategoria);
    const fixedSubSubcategoria = normalizeText(req.query.subsubcategoria);
    const poblacionalConfig = categoria === 'Poblacional' ? resolvePoblacionalConfig(req.query.subcategoria) : null;
    const saberProConfig = categoria === 'Saber Pro' ? resolveSaberProConfig(req.query.subcategoria) : null;
    const recursoHumanoConfig = categoria === 'Recurso Humano' ? resolveRecursoHumanoConfig(req.query.subcategoria) : null;
    const contextoTemplateHeaders = (categoria === 'Poblacional' && poblacionalConfig?.customImport === 'contexto_externo')
      ? resolveContextoExternoTemplateHeaders(fixedSubSubcategoria)
      : null;
    if (!categoria) {
      return res.status(400).json({ success: false, message: 'Debes enviar la categoria de la base de datos' });
    }

    if (categoria === 'Georreferencia') {
      const worksheet = buildHeaderOnlyWorksheet(DIVIPOLA_TEMPLATE_HEADERS);
      worksheet['!cols'] = DIVIPOLA_TEMPLATE_HEADERS.map((header) => ({ wch: Math.max(16, String(header).length + 6) }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'DIVIPOLA');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', 'attachment; filename=plantilla_georreferencia_divipola.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    if (categoria === 'Georreferencia') {
      const templateConfig = GEOREFERENCIA_TEMPLATE_CONFIG[georreferenciaSubcategoria];
      if (!templateConfig) {
        return res.status(400).json({ success: false, message: 'Subbase de Georreferencia no valida' });
      }
      const workbook = XLSX.utils.book_new();
      const headers = templateConfig['Listado Vigentes'] || [];
      const worksheet = buildHeaderOnlyWorksheet(headers);
      worksheet['!cols'] = headers.map((header) => ({ wch: Math.max(16, Math.min(34, String(header).length + 6)) }));
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Listado Vigentes');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', 'attachment; filename=plantilla_georreferencia_divipola.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    if (categoria === 'Poblacional' && !poblacionalConfig) {
      return res.status(400).json({
        success: false,
        message: 'Para Poblacional debes seleccionar subcategoría: Inscritos, Admitidos, Primer Curso, Matriculados, Graduados o Caracterización'
      });
    }

    if (categoria === 'Poblacional' && poblacionalConfig?.customImport === 'contexto_externo' && !contextoTemplateHeaders) {
      return res.status(400).json({
        success: false,
        message: 'Para Contexto Externo debes seleccionar una lista antes de descargar la plantilla'
      });
    }

    if (categoria === 'Saber Pro' && (!saberProConfig || !saberProConfig.headers)) {
      return res.status(400).json({
        success: false,
        message: 'Para Saber Pro selecciona una subcategoría válida con plantilla disponible.'
      });
    }

    if (categoria === 'Saber Pro' && Array.isArray(saberProConfig?.sheetTemplates) && saberProConfig.sheetTemplates.length > 0) {
      const workbook = XLSX.utils.book_new();
      saberProConfig.sheetTemplates.forEach((sheet) => {
        const headers = sheet.headers || [];
        const worksheet = buildHeaderOnlyWorksheet(headers);
        worksheet['!cols'] = headers.map((header) => ({ wch: Math.max(16, Math.min(42, String(header).length + 6)) }));
        XLSX.utils.book_append_sheet(workbook, worksheet, String(sheet.sheetName || 'DATA').slice(0, 31));
      });
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const suffix = `_${normalizeHeader(saberProConfig.label).toLowerCase()}`;
      res.setHeader('Content-Disposition', `attachment; filename=plantilla_saber_pro${suffix}.xlsx`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    if (categoria === 'Recurso Humano') {
      const workbook = XLSX.utils.book_new();
      const configs = recursoHumanoConfig ? [recursoHumanoConfig] : Object.values(RECURSO_HUMANO_SUBCATEGORY_CONFIG);
      configs.forEach((config) => {
        const headers = config.headers || [];
        const worksheet = buildHeaderOnlyWorksheet(headers);
        worksheet['!cols'] = headers.map((header) => ({ wch: Math.max(14, Math.min(40, String(header).length + 6)) }));
        const sheetName = (config.sheetNames?.[0] || config.label || 'DATA').slice(0, 31);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      });
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const suffix = recursoHumanoConfig ? `_${normalizeHeader(recursoHumanoConfig.label).toLowerCase()}` : '_completo';
      res.setHeader('Content-Disposition', `attachment; filename=plantilla_recurso_humano${suffix}.xlsx`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    if (categoria === 'Poblacional' && Array.isArray(poblacionalConfig?.sheetTemplates) && poblacionalConfig.sheetTemplates.length > 0) {
      const workbook = XLSX.utils.book_new();
      poblacionalConfig.sheetTemplates.forEach((sheet) => {
        const headers = sheet.headers || [];
        const worksheet = buildHeaderOnlyWorksheet(headers);
        worksheet['!cols'] = headers.map((header) => ({ wch: Math.max(14, Math.min(42, String(header).length + 8)) }));
        XLSX.utils.book_append_sheet(workbook, worksheet, String(sheet.sheetName || 'DATA').slice(0, 31));
      });
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const suffix = `_${normalizeHeader(poblacionalConfig.label).toLowerCase()}`;
      res.setHeader('Content-Disposition', `attachment; filename=plantilla_poblacional${suffix}.xlsx`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    const headers = (categoria === 'Poblacional' && poblacionalConfig?.customImport === 'contexto_externo')
      ? contextoTemplateHeaders
      : categoria === 'Poblacional'
        ? poblacionalConfig.headers
      : categoria === 'Saber Pro'
        ? saberProConfig.headers
      : ['subcategoria', 'anio', 'programa', 'dependencia', 'indicador', 'valor', 'unidad', 'fuente', 'observaciones'];

    const worksheet = buildHeaderOnlyWorksheet(headers);
    worksheet['!cols'] = headers.map((header) => ({ wch: Math.max(14, Math.min(40, String(header).length + 8)) }));

    const workbook = XLSX.utils.book_new();
    const sheetName = categoria === 'Poblacional' ? `POB_${poblacionalConfig.label}` : (categoria === 'Saber Pro' ? `SABER_${saberProConfig.label}` : categoria);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const suffix = categoria === 'Poblacional'
      ? `_${normalizeHeader(poblacionalConfig.label).toLowerCase()}`
      : categoria === 'Saber Pro'
        ? `_${normalizeHeader(saberProConfig.label).toLowerCase()}`
        : '';
    const strictTemplateSuffix = categoria === 'Poblacional' && poblacionalConfig?.strictHeaders ? '_estructura_nueva' : '';
    res.setHeader('Content-Disposition', `attachment; filename=plantilla_${categoria.toLowerCase().replace(/\s+/g, '_')}${suffix}${strictTemplateSuffix}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (error) {
    console.error('Error al descargar plantilla de gestión de información:', error);
    return res.status(500).json({ success: false, message: 'Error al generar plantilla' });
  }
};

const importFromExcel = async (req, res) => {
  try {
    const categoria = resolveCategoria(req.body?.categoria || req.query?.categoria);
    const fixedSubcategoriaRaw = normalizeText(req.body?.subcategoria || req.query?.subcategoria);
    const fixedSubcategoria = categoria === 'Georreferencia'
      ? resolveGeorreferenciaSubcategory(fixedSubcategoriaRaw)
      : fixedSubcategoriaRaw;
    const fixedSubSubcategoria = normalizeText(req.body?.subsubcategoria || req.query?.subsubcategoria);
    const poblacionalConfig = categoria === 'Poblacional' ? resolvePoblacionalConfig(fixedSubcategoria) : null;
    const saberProConfig = categoria === 'Saber Pro' ? resolveSaberProConfig(fixedSubcategoria) : null;
    const recursoHumanoConfig = categoria === 'Recurso Humano' ? resolveRecursoHumanoConfig(fixedSubcategoria) : null;
    const contextoCargaConfig = (categoria === 'Poblacional' && (poblacionalConfig?.customImport === 'contexto_externo'))
      ? resolveContextoExternoCargaConfig(fixedSubSubcategoria)
      : null;
    if (!categoria) {
      return res.status(400).json({ success: false, message: 'Debes seleccionar la base de datos destino' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se proporciono archivo Excel o CSV' });
    }

    const uploadFileName = String(req.file?.originalname || req.file?.filename || '').trim();
    const uploadExt = path.extname(uploadFileName).toLowerCase();
    const isCsvUpload = uploadExt === '.csv';
    const allowsCsvStreaming = (
      categoria === 'Georreferencia'
      || (categoria === 'Poblacional' && poblacionalConfig?.label === 'Matriculados')
      || (categoria === 'Poblacional'
        && poblacionalConfig?.customImport === 'contexto_externo'
        && contextoCargaConfig?.onlyType === 'serie')
    );
    let workbook = null;

    if (isCsvUpload && !allowsCsvStreaming) {
      return res.status(400).json({
        success: false,
        message: 'El formato CSV solo esta habilitado para Georreferencia, Matriculados y Contexto Externo (listas de series).'
      });
    }

    if (!isCsvUpload) {
      workbook = XLSX.readFile(req.file.path);
      const validSheetCount = (workbook.SheetNames || [])
        .map((name) => workbook.Sheets[name])
        .filter((sheet) => Boolean(sheet && sheet['!ref']))
        .length;
      if (!validSheetCount) {
        const isContextoSerieUpload = categoria === 'Poblacional'
          && poblacionalConfig?.customImport === 'contexto_externo'
          && contextoCargaConfig?.onlyType === 'serie';
        return res.status(400).json({
          success: false,
          message: isContextoSerieUpload
            ? 'No se pudo leer la hoja del archivo XLSX (archivo demasiado grande o no compatible). Para cargas masivas usa CSV UTF-8.'
            : 'El archivo Excel no contiene hojas validas para procesar (posible archivo corrupto o plantilla incompleta).'
        });
      }
    }

    if (categoria === 'Saber Pro' && saberProConfig?.label === 'Resultados individuales' && isCsvUpload) {
      return res.status(400).json({
        success: false,
        message: 'Resultados individuales solo acepta un libro Excel con dos hojas: SABER PRO y TYT.'
      });
    }

    if (categoria === 'Georreferencia') {
      const result = isCsvUpload
        ? await importGeorreferenciaFromCsv({
          filePath: req.file.path,
          fileName: uploadFileName,
          userId: req.user?.id || null
        })
        : await importGeorreferenciaFromWorkbook({
          workbook,
          fileName: uploadFileName,
          userId: req.user?.id || null
        });
      const porcentaje = result.total > 0 ? Number((((result.total - result.errores.length) / result.total) * 100).toFixed(2)) : 0;
      await GestionInformacionCarga.create({
        categoria: 'Georreferencia',
        subcategoria: GEOREFERENCIA_CANONICAL_SUBCATEGORY,
        variable: GEOREFERENCIA_CANONICAL_SUBCATEGORY,
        archivo_nombre: uploadFileName,
        total_plantilla: result.total,
        total_cargados: result.importados,
        total_omitidos: result.errores.length,
        porcentaje_cargado: porcentaje,
        estado: porcentaje === 100 ? 'exitoso' : 'parcial',
        detalle: JSON.stringify({
          totalDepartamentos: result.totalDepartamentos,
          totalMunicipios: result.totalMunicipios,
          errores: result.errores.slice(0, 50)
        }),
        creado_por: req.user?.id || null
      });
      return res.json({
        success: true,
        message: `Importacion finalizada para Georreferencia: ${result.totalDepartamentos} departamentos y ${result.totalMunicipios} municipios`,
        data: result
      });
    }

    if (categoria === 'Recurso Humano') {
      if (fixedSubcategoria && !recursoHumanoConfig) {
        return res.status(400).json({ success: false, message: 'Subcategoria de Recurso Humano no valida' });
      }

      const configs = recursoHumanoConfig ? [recursoHumanoConfig] : Object.values(RECURSO_HUMANO_SUBCATEGORY_CONFIG);
      const result = { total: 0, importados: 0, importadosValor: 0, errores: [], hojasProcesadas: [] };
      const workbookSheetsByKey = Object.fromEntries(
        workbook.SheetNames.map((name) => [normalizeHeader(name), name])
      );

      for (const config of configs) {
        const matchedSheetName = (config.sheetNames || [])
          .map((name) => workbookSheetsByKey[normalizeHeader(name)])
          .find(Boolean);

        if (!matchedSheetName) {
          if (recursoHumanoConfig) {
            return res.status(400).json({ success: false, message: `No se encontro la hoja ${config.sheetNames?.[0] || config.label} en el archivo Excel` });
          }
          continue;
        }

        const worksheetRH = workbook.Sheets[matchedSheetName];
        const { rows: rowsRH } = matrixToRows(worksheetRH, config.headers, true);
        if (!rowsRH.length) continue;
        await clearDatasetStorage({
          categoria: 'Recurso Humano',
          subcategoria: config.label,
          recursoHumanoConfig: config
        });

        const sheetResult = { total: rowsRH.length, importados: 0, errores: [] };
        for (let i = 0; i < rowsRH.length; i += 1) {
          const row = rowsRH[i];
          const fila = i + 2;
          try {
            const payload = mapPoblacionalRecord(row, { map: config.map });
            const anio = parseAnio(payload.anio || payload.periodo || row.PERIODO || row['AÃƒÆ’Ã¢â‚¬ËœO']);

            if (config.key === 'DOCENTES') {
              await config.model.create({
                anio,
                periodo: normalizeText(payload.periodo),
                identificacion: normalizeText(payload.identificacion),
                docente: normalizeText(payload.docente),
                genero_biologico: normalizeGenero(payload.genero_biologico),
                departamento_dependencia: normalizeText(payload.departamento_dependencia),
                programa: normalizeText(payload.programa),
                tipo_vinculacion: normalizeText(payload.tipo_vinculacion),
                contrato: normalizeText(payload.contrato),
                cargo: normalizeText(payload.cargo),
                escalafon: normalizeText(payload.escalafon),
                total_horas: toNumber(payload.total_horas),
                total_docentes: toNumber(payload.total_docentes),
                fecha_ingreso: parseExcelDateString(payload.fecha_ingreso),
                fecha_nacimiento: parseExcelDateString(payload.fecha_nacimiento),
                edad: toNumber(payload.edad) ? Math.trunc(Number(payload.edad)) : null,
                raw_data: row,
                creado_por: req.user?.id || null,
                actualizado_por: req.user?.id || null
              });
            } else if (config.key === 'ADMINISTRATIVOS') {
              await config.model.create({
                anio,
                periodo: normalizeText(payload.periodo),
                numero_cedula: normalizeText(payload.numero_cedula),
                estado_laboral: normalizeText(payload.estado_laboral),
                nombre_empleado: normalizeText(payload.nombre_empleado),
                cargo_especifico: normalizeText(payload.cargo_especifico),
                dependencia: normalizeText(payload.dependencia),
                vicerectoria: normalizeText(payload.vicerectoria),
                clase_contrato: normalizeText(payload.clase_contrato),
                genero_biologico: normalizeGenero(payload.genero_biologico),
                tipo_cotizante: normalizeText(payload.tipo_cotizante),
                fecha_inicio: parseExcelDateString(payload.fecha_inicio),
                fecha_terminacion: parseExcelDateString(payload.fecha_terminacion),
                sueldo_anual: toNumber(payload.sueldo_anual),
                sueldo_mes: toNumber(payload.sueldo_mes),
                raw_data: row,
                creado_por: req.user?.id || null,
                actualizado_por: req.user?.id || null
              });
            } else if (config.key === 'OUTSOURCING') {
              await config.model.create({
                anio,
                periodo: normalizeText(payload.anio),
                cargo: normalizeText(payload.cargo),
                genero_biologico: normalizeGenero(payload.genero_biologico),
                cantidad: toNumber(payload.cantidad),
                raw_data: row,
                creado_por: req.user?.id || null,
                actualizado_por: req.user?.id || null
              });
            } else if (config.key === 'ONDAS') {
              await config.model.create({
                anio,
                periodo: normalizeText(payload.periodo),
                nombre: normalizeText(payload.nombre),
                genero: normalizeGenero(payload.genero),
                fecha_corte: parseExcelDateString(payload.fecha_corte),
                raw_data: row,
                creado_por: req.user?.id || null,
                actualizado_por: req.user?.id || null
              });
            }

            const valor = config.key === 'OUTSOURCING'
              ? (toNumber(payload.cantidad) ?? 1)
              : (toNumber(payload.total_docentes) ?? 1);

            await Estadistica.create({
              categoria: 'Recurso Humano',
              subcategoria: config.label,
              anio: anio || 0,
              programa: normalizeText(payload.programa),
              dependencia: normalizeText(
                payload.departamento_dependencia ||
                payload.dependencia ||
                payload.vicerectoria ||
                payload.cargo
              ),
              indicador: config.label,
              valor,
              unidad: 'personas',
              fuente: `Carga Excel Recurso Humano - ${config.label}`,
              observaciones: [
                normalizeText(payload.genero_biologico || payload.genero) ? `genero: ${normalizeGenero(payload.genero_biologico || payload.genero)}` : '',
                normalizeText(payload.periodo) ? `periodo: ${normalizeText(payload.periodo)}` : ''
              ].filter(Boolean).join(' | ') || null,
              creado_por: req.user?.id || null,
              actualizado_por: req.user?.id || null
            });

            sheetResult.importados += 1;
            result.importados += 1;
          } catch (sheetErr) {
            sheetResult.errores.push({ fila, error: sheetErr.message });
            result.errores.push({ hoja: matchedSheetName, fila, error: sheetErr.message });
          }
        }

        result.total += sheetResult.total;
        result.hojasProcesadas.push({ hoja: matchedSheetName, subcategoria: config.label, ...sheetResult });

        const porcentaje = sheetResult.total > 0 ? Number(((sheetResult.importados / sheetResult.total) * 100).toFixed(2)) : 0;
        await GestionInformacionCarga.create({
          categoria: 'Recurso Humano',
          subcategoria: config.label,
          variable: config.label,
          archivo_nombre: req.file?.originalname || null,
          total_plantilla: sheetResult.total,
          total_cargados: sheetResult.importados,
          total_omitidos: sheetResult.total - sheetResult.importados,
          porcentaje_cargado: porcentaje,
          estado: porcentaje === 100 ? 'exitoso' : (sheetResult.importados > 0 ? 'parcial' : 'fallido'),
          detalle: sheetResult.errores.length ? JSON.stringify(sheetResult.errores.slice(0, 20)) : null,
          creado_por: req.user?.id || null
        });
      }

      if (!result.total) {
        return res.status(400).json({ success: false, message: 'No se encontraron hojas validas de Recurso Humano en el archivo' });
      }

      return res.json({
        success: true,
        message: `Importacion finalizada para Recurso Humano: ${result.importados}/${result.total} registros`,
        data: result
      });
    }

    if (categoria === 'Poblacional' && poblacionalConfig?.customImport === 'contexto_externo') {
      if (!contextoCargaConfig) {
        return res.status(400).json({
          success: false,
          message: 'Debes seleccionar una lista de Contexto Externo antes de importar'
        });
      }

      // Reemplazo por lista seleccionada (evita mezclar historicos entre cargues).
      await Promise.all([
        Estadistica.destroy({
          where: {
            categoria: 'Poblacional',
            subcategoria: 'Contexto Externo',
            fuente: `Contexto Externo - ${contextoCargaConfig.baseIndicador}`
          }
        }),
        GestionInformacionCarga.destroy({
          where: {
            categoria: 'Poblacional',
            subcategoria: 'Contexto Externo',
            variable: fixedSubSubcategoria || 'Contexto Externo'
          }
        }),
        PoblacionalContextoExterno.destroy({
          where: {
            tipo_registro: contextoCargaConfig.onlyType,
            base_indicador: contextoCargaConfig.baseIndicador
          }
        })
      ]);

      const result = { total: 0, importados: 0, errores: [], hojasProcesadas: [] };
      const cleaningSummary = { total: 0, tecnica: 0, diccionario: 0, ejemplos: [] };
      const contextoNovedades = new Map();
      const activeRules = await DiccionarioCorreccionTexto.findAll({
        where: { activo: true, ambito: { [Op.in]: ['GENERAL', 'CONTEXTO_EXTERNO'] } },
        order: [['prioridad', 'ASC'], ['id', 'ASC']],
        raw: true
      });
      const correctionRuleIndex = buildCorrectionRuleIndex(activeRules);
      const workbookSheetsByKey = isCsvUpload
        ? {}
        : Object.fromEntries(workbook.SheetNames.map((name) => [normalizeHeader(name), name]));

      const createContextoStat = async ({
        anio,
        programaComparado,
        ies,
        indicador,
        valor,
        unidad,
        baseIndicador,
        alcance,
        hoja,
        periodoRef = null,
        sector = null,
        corte = null,
        programaObjetivo = null,
        tipoRegistro = null
      }) => {
        await Estadistica.create({
          categoria: 'Poblacional',
          subcategoria: 'Contexto Externo',
          anio: Number(anio) || 0,
          programa: normalizeText(programaComparado),
          dependencia: normalizeText(ies),
          indicador,
          valor,
          unidad,
          fuente: `Contexto Externo - ${baseIndicador}`,
          observaciones: [
            'tipo: CONTEXTO_EXTERNO',
            baseIndicador ? `base: ${baseIndicador}` : '',
            alcance ? `alcance: ${alcance}` : '',
            periodoRef ? `periodo_ref: ${periodoRef}` : '',
            hoja ? `hoja: ${hoja}` : '',
            sector ? `sector: ${sector}` : '',
            corte ? `corte: ${corte}` : '',
            programaObjetivo ? `programa_objetivo: ${programaObjetivo}` : '',
            tipoRegistro ? `tipo_registro: ${tipoRegistro}` : ''
          ].filter(Boolean).join(' | '),
          creado_por: req.user?.id || null,
          actualizado_por: req.user?.id || null
        });
      };

      const accentCanonicalMap = new Map();

      if (isCsvUpload) {
        if (contextoCargaConfig?.onlyType !== 'serie') {
          return res.status(400).json({
            success: false,
            message: 'Para esta lista de Contexto Externo debes cargar archivo Excel (.xlsx).'
          });
        }

        const baseIndicadorCsv = contextoCargaConfig?.baseIndicador || normalizeContextoBaseFromSheetName(uploadFileName);
        const metricAliasesCsv = getContextoExternoTabularMetricAliases(baseIndicadorCsv);
        const metricRegexCsv = getContextoExternoMetricKeyRegex(metricAliasesCsv);
        const sheetNameCsv = fixedSubSubcategoria || 'CONTEXTO_EXTERNO_CSV';
        const alcanceCsv = standardizeTextWithDictionary({
          value: normalizeContextoAlcanceFromSheetName(uploadFileName),
          ambito: 'CONTEXTO_EXTERNO',
          columna: 'ALCANCE',
          ruleIndex: correctionRuleIndex,
          summary: cleaningSummary
        }).normalized;
        const sheetResult = { total: 0, importados: 0, errores: [] };
        let csvHeaders = [];
        let csvReady = false;

        const detailsBatch = [];
        const statsBatch = [];
        const BATCH_SIZE = 2000;
        let processedCsvRows = 0;
        const flushBatches = async () => {
          if (detailsBatch.length) {
            await PoblacionalContextoExterno.bulkCreate(detailsBatch);
            detailsBatch.length = 0;
          }
          if (statsBatch.length) {
            await Estadistica.bulkCreate(statsBatch);
            statsBatch.length = 0;
          }
        };

        try {
          await streamCsvFile({
            filePath: req.file.path,
            onHeader: async ({ headers }) => {
            csvHeaders = (headers || []).map((h) => String(h || '').trim());
            const normalizedHeaders = csvHeaders.map((h) => normalizeHeader(h)).filter(Boolean);
            const hasTabularHeader = normalizedHeaders.includes('CODIGO_DE_LA_INSTITUCION')
              && normalizedHeaders.includes('INSTITUCION_DE_EDUCACION_SUPERIOR_IES')
              && normalizedHeaders.includes('PROGRAMA_ACADEMICO')
              && normalizedHeaders.includes('ANO')
              && normalizedHeaders.includes('SEMESTRE');
            const hasMetric = normalizedHeaders.some((key) => metricRegexCsv.test(key));
            if (!hasTabularHeader || !hasMetric) {
              throw new Error('CSV no valido para Contexto Externo: faltan columnas obligatorias o la columna de metrica.');
            }
            csvReady = true;
            },
            onRow: async ({ cells, lineNumber }) => {
            if (!csvReady) return;
            const row = csvHeaders.map((_, idx) => (idx < cells.length ? cells[idx] : null));
            if (!row.some((cell) => String(cell || '').trim() !== '')) return;

            const fila = lineNumber;
            try {
              const { normalizedByHeader } = normalizeContextoRowCells({
                headers: csvHeaders,
                row,
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary,
                novedadesMap: contextoNovedades
              });
              const normalizedAccentByHeader = applyAccentCanonicalization({
                headers: csvHeaders,
                normalizedByHeader,
                accentCanonicalMap
              });
              const normalizedRowByKey = Object.fromEntries(
                csvHeaders.map((h) => [normalizeHeader(h || ''), normalizedAccentByHeader[h || '']])
              );
              const metricRaw = pickContextoExternoTabularMetricValue(normalizedRowByKey, baseIndicadorCsv);
              const valueNum = toNumber(metricRaw) ?? toPesosNumber(metricRaw);

              sheetResult.total += 1;
              result.total += 1;
              processedCsvRows += 1;
              if (valueNum === null) return;

              const anio = parseAnio(normalizedRowByKey.ANO);
              const semestreRaw = normalizeText(normalizedRowByKey.SEMESTRE);
              const semestreToken = String(semestreRaw || '').toUpperCase();
              const semestreSlot = /\b(2|II|IIP)\b/.test(semestreToken) ? 2 : 1;
              const periodoLabel = anio ? `${anio}-${semestreSlot}` : semestreRaw;

              const programaStd = standardizeTextWithDictionary({
                value: normalizedRowByKey.PROGRAMA_ACADEMICO,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'PROGRAMA',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized || normalizedRowByKey.PROGRAMA_ACADEMICO;
              const programaComparado = canonicalizeAccentOnlyValue({
                column: 'PROGRAMA',
                value: programaStd,
                accentCanonicalMap
              });
              if (!programaComparado) return;

              const iesStd = standardizeTextWithDictionary({
                value: normalizedRowByKey.INSTITUCION_DE_EDUCACION_SUPERIOR_IES || normalizedRowByKey.IES_PADRE,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'IES',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized;
              const ies = canonicalizeAccentOnlyValue({
                column: 'IES',
                value: iesStd,
                accentCanonicalMap
              });
              const sector = standardizeTextWithDictionary({
                value: normalizedRowByKey.SECTOR_IES,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'SECTOR',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized;
              const departamento = standardizeTextWithDictionary({
                value: normalizedRowByKey.DEPARTAMENTO_DE_OFERTA_DEL_PROGRAMA,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'DEPARTAMENTO',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized;
              const municipio = standardizeTextWithDictionary({
                value: normalizedRowByKey.MUNICIPIO_DE_OFERTA_DEL_PROGRAMA,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'MUNICIPIO',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized;
              const modalidad = standardizeTextWithDictionary({
                value: normalizedRowByKey.MODALIDAD,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'MODALIDAD',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized;

              detailsBatch.push({
                anio,
                periodo_referencia: periodoLabel,
                tipo_registro: 'serie',
                base_indicador: baseIndicadorCsv,
                alcance: alcanceCsv,
                hoja_fuente: sheetNameCsv,
                sector: normalizeText(sector),
                ies: normalizeText(ies),
                programa_comparado: normalizeText(programaComparado),
                programa_objetivo: null,
                departamento: normalizeText(departamento),
                municipio: normalizeText(municipio),
                modalidad: normalizeText(modalidad),
                periodicidad: null,
                creditos: null,
                semestres: null,
                costo_matricula: null,
                fecha_registro_snies: null,
                oferta_tag: alcanceCsv ? alcanceCsv.toUpperCase() : null,
                valor: valueNum,
                raw_data: JSON.stringify({
                  original: Object.fromEntries(csvHeaders.map((h, idx) => [h || `COL_${idx + 1}`, row[idx]])),
                  normalizado: normalizedAccentByHeader
                }),
                creado_por: req.user?.id || null,
                actualizado_por: req.user?.id || null
              });

              statsBatch.push({
                categoria: 'Poblacional',
                subcategoria: 'Contexto Externo',
                anio: Number(anio) || 0,
                programa: normalizeText(programaComparado),
                dependencia: normalizeText(ies),
                indicador: baseIndicadorCsv,
                valor: Number(valueNum),
                unidad: 'estudiantes',
                fuente: `Contexto Externo - ${baseIndicadorCsv}`,
                observaciones: [
                  'tipo: CONTEXTO_EXTERNO',
                  baseIndicadorCsv ? `base: ${baseIndicadorCsv}` : '',
                  alcanceCsv ? `alcance: ${alcanceCsv}` : '',
                  periodoLabel ? `periodo_ref: ${periodoLabel}` : '',
                  sheetNameCsv ? `hoja: ${sheetNameCsv}` : '',
                  sector ? `sector: ${sector}` : '',
                  'tipo_registro: serie'
                ].filter(Boolean).join(' | '),
                creado_por: req.user?.id || null,
                actualizado_por: req.user?.id || null
              });

              sheetResult.importados += 1;
              result.importados += 1;
              result.importadosValor += Number(valueNum || 0);
              if (detailsBatch.length >= BATCH_SIZE) {
                await flushBatches();
              }
              if (processedCsvRows % 2000 === 0) {
                await new Promise((resolve) => setImmediate(resolve));
              }
            } catch (sheetErr) {
              sheetResult.errores.push({ fila, error: sheetErr.message });
              result.errores.push({ hoja: sheetNameCsv, fila, error: sheetErr.message });
            }
            }
          });
        } catch (csvErr) {
          return res.status(400).json({
            success: false,
            message: String(csvErr?.message || 'CSV invalido para Contexto Externo')
          });
        }

        await flushBatches();
        if (sheetResult.total > 0) {
          result.hojasProcesadas.push({ hoja: sheetNameCsv, ...sheetResult });
        }
      } else {
        for (const sheetName of Object.values(workbookSheetsByKey)) {
        const worksheetCx = workbook.Sheets[sheetName];
        if (!worksheetCx || !worksheetCx['!ref']) continue;
        const matrix = XLSX.utils.sheet_to_json(worksheetCx, { header: 1, defval: null, blankrows: false });
        const sheetMeta = readContextoMeta(matrix);
        const programaObjetivoStd = standardizeTextWithDictionary({
          value: sheetMeta.programaObjetivo,
          ambito: 'CONTEXTO_EXTERNO',
          columna: 'PROGRAMA_OBJETIVO',
          ruleIndex: correctionRuleIndex,
          summary: cleaningSummary
        }).normalized;
        const normalizedSheet = normalizeHeader(sheetName);
        const inferredBaseIndicador = normalizeContextoBaseFromSheetName(sheetName);
        const baseIndicador = contextoCargaConfig?.baseIndicador || inferredBaseIndicador;
        const alcance = standardizeTextWithDictionary({
          value: normalizeContextoAlcanceFromSheetName(sheetName),
          ambito: 'CONTEXTO_EXTERNO',
          columna: 'ALCANCE',
          ruleIndex: correctionRuleIndex,
          summary: cleaningSummary
        }).normalized;
        const sheetResult = { total: 0, importados: 0, errores: [] };

        const ofertaSectorHeaderRowIndex = findRowIndexByFirstCell(matrix, ['SECTOR']);
        const programasHeaderRowCandidate = detectHeaderRowIndexLoose(matrix, ['CÃƒÆ’Ã¢â‚¬Å“DIGO_SNIES_DEL_PROGRAMA', 'NOMBRE_DEL_PROGRAMA', 'NOMBRE_INSTITUCIÃƒÆ’Ã¢â‚¬Å“N', 'NOMBRE_IES']);
        const programasHeadersNormalized = ((matrix[programasHeaderRowCandidate] || []).map((cell) => normalizeHeader(cell)).filter(Boolean));
        const hasProgramaNameHeader = programasHeadersNormalized.includes('NOMBRE_DEL_PROGRAMA');
        const hasIesHeader = programasHeadersNormalized.includes('NOMBRE_INSTITUCION') || programasHeadersNormalized.includes('NOMBRE_IES');
        const programasHeaderRowIndex = (hasProgramaNameHeader && hasIesHeader) ? programasHeaderRowCandidate : -1;
        const seriesHeaderRowIndex = findRowIndexByFirstCell(matrix, ['Sector/Universidad/Programa']);
        const tabularHeaderRowCandidate = detectHeaderRowIndexLoose(
          matrix,
          ['CÃƒâ€œDIGO DE LA INSTITUCIÃƒâ€œN', 'INSTITUCIÃƒâ€œN DE EDUCACIÃƒâ€œN SUPERIOR (IES)', 'PROGRAMA ACADÃƒâ€°MICO', 'AÃƒâ€˜O', 'SEMESTRE']
        );
        const tabularHeadersNormalized = ((matrix[tabularHeaderRowCandidate] || []).map((cell) => normalizeHeader(cell)).filter(Boolean));
        const metricAliases = getContextoExternoTabularMetricAliases(baseIndicador);
        const hasTabularHeader = tabularHeadersNormalized.includes('CODIGO_DE_LA_INSTITUCION')
          && tabularHeadersNormalized.includes('INSTITUCION_DE_EDUCACION_SUPERIOR_IES')
          && tabularHeadersNormalized.includes('PROGRAMA_ACADEMICO')
          && tabularHeadersNormalized.includes('ANO')
          && tabularHeadersNormalized.includes('SEMESTRE');
        const tabularHeaderRowIndex = hasTabularHeader ? tabularHeaderRowCandidate : -1;
        const isOfertaLike = ofertaSectorHeaderRowIndex >= 0 || programasHeaderRowIndex >= 0;
        const isSeriesLike = seriesHeaderRowIndex >= 0 || tabularHeaderRowIndex >= 0;

        if (contextoCargaConfig?.onlyType === 'oferta' && !isOfertaLike) continue;
        if (contextoCargaConfig?.onlyType === 'serie' && !isSeriesLike) continue;

        if (ofertaSectorHeaderRowIndex >= 0) {
          const headerRowIndex = ofertaSectorHeaderRowIndex;
          if (headerRowIndex < 0) continue;
          const headers = (matrix[headerRowIndex] || []).map((h) => String(h || '').trim());
          const headerIndex = headers.reduce((acc, h, i) => ({ ...acc, [normalizeHeader(h)]: i }), {});
          const rows = matrix.slice(headerRowIndex + 1);
          const preparedRows = [];
          for (let i = 0; i < rows.length; i += 1) {
            const row = rows[i] || [];
            if (!row.some((cell) => String(cell || '').trim() !== '')) continue;
            const fila = headerRowIndex + i + 2;
            try {
              const { normalizedByHeader } = normalizeContextoRowCells({
                headers,
                row,
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary,
                novedadesMap: contextoNovedades
              });
              preparedRows.push({
                fila,
                originalRow: row,
                normalizedRowByHeader: normalizedByHeader
              });
            } catch (sheetErr) {
              sheetResult.errores.push({ fila, error: sheetErr.message });
              result.errores.push({ hoja: sheetName, fila, error: sheetErr.message });
            }
            sheetResult.total += 1;
            result.total += 1;
          }

          preparedRows.forEach((prepared) => {
            applyAccentCanonicalization({
              headers,
              normalizedByHeader: prepared.normalizedRowByHeader,
              accentCanonicalMap
            });
          });

          for (let i = 0; i < preparedRows.length; i += 1) {
            const { fila, originalRow, normalizedRowByHeader } = preparedRows[i];
            try {
              const normalizedAccentByHeader = applyAccentCanonicalization({
                headers,
                normalizedByHeader: normalizedRowByHeader,
                accentCanonicalMap
              });
              const normalizedRowByKey = Object.fromEntries(headers.map((h) => [normalizeHeader(h || ''), normalizedAccentByHeader[h || '']]));

              const programaComparado = standardizeTextWithDictionary({
                value: normalizedRowByKey.NOMBRE_DEL_PROGRAMA,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'PROGRAMA',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized;
              const ies = standardizeTextWithDictionary({
                value: normalizedRowByKey.NOMBRE_INSTITUCION || normalizedRowByKey.NOMBRE_IES,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'IES',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized;
              if (!programaComparado && !ies) continue;

              const sector = standardizeTextWithDictionary({
                value: normalizedRowByKey.SECTOR,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'SECTOR',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized;
              const departamento = standardizeTextWithDictionary({
                value: normalizedRowByKey.DEPARTAMENTO || normalizedRowByKey.DEPARTAMENTO_OFERTA_PROGRAMA,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'DEPARTAMENTO',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized;
              const municipio = standardizeTextWithDictionary({
                value: normalizedRowByKey.MUNICIPIO_OFERTA_PROGRAMA,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'MUNICIPIO',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized;
              const modalidad = standardizeTextWithDictionary({
                value: normalizedRowByKey.MODALIDAD,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'MODALIDAD',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized;
              const periodicidad = standardizeTextWithDictionary({
                value: normalizedRowByKey.PERIODO || normalizedRowByKey.PERIODICIDAD,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'PERIODICIDAD',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized;
              const ofertaTag = standardizeTextWithDictionary({
                value: normalizedRowByKey.OFERTA || normalizedRowByKey.TIPO_CUBRIMIENTO,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'ALCANCE',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized;

              const detail = {
                anio: parseAnio(normalizedRowByKey.FECHA_DE_REGISTRO_EN_SNIES) || null,
                periodo_referencia: null,
                tipo_registro: 'oferta',
                base_indicador: baseIndicador,
                alcance,
                hoja_fuente: sheetName,
                sector,
                ies,
                programa_comparado: programaComparado,
                programa_objetivo: programaObjetivoStd,
                departamento,
                municipio,
                modalidad,
                periodicidad,
                creditos: toNumber(normalizedRowByKey.NUMERO_CREDITOS || normalizedRowByKey.NUMERO_DE_CREDITOS),
                semestres: toNumber(normalizedRowByKey.NUMERO_SEMESTRES || normalizedRowByKey.NUMERO_DE_PERIODOS),
                costo_matricula: toPesosNumber(normalizedRowByKey.COSTO_MATRICULA || normalizedRowByKey.VALOR_MATRICULA || normalizedRowByKey.COSTO_MATRICULA_ESTUD_NUEVOS),
                fecha_registro_snies: normalizeText(normalizedRowByKey.FECHA_DE_REGISTRO_EN_SNIES),
                oferta_tag: ofertaTag,
                valor: 1,
                raw_data: JSON.stringify({
                  original: Object.fromEntries(headers.map((h, idx) => [h || `COL_${idx + 1}`, originalRow[idx]])),
                  normalizado: normalizedAccentByHeader
                }),
                creado_por: req.user?.id || null,
                actualizado_por: req.user?.id || null
              };

              await PoblacionalContextoExterno.create(detail);
              await createContextoStat({
                anio: detail.anio,
                programaComparado: detail.programa_comparado,
                ies: detail.ies,
                indicador: 'Oferta programas',
                valor: 1,
                unidad: 'programas',
                baseIndicador,
                alcance,
                hoja: sheetName,
                sector: detail.sector,
                corte: sheetMeta.corte,
                programaObjetivo: programaObjetivoStd,
                tipoRegistro: 'oferta'
              });

              sheetResult.importados += 1;
              result.importados += 1;
              result.importadosValor += Number(detail.valor || 0);
            } catch (sheetErr) {
              sheetResult.errores.push({ fila, error: sheetErr.message });
              result.errores.push({ hoja: sheetName, fila, error: sheetErr.message });
            }
          }
        } else if (programasHeaderRowIndex >= 0) {
          const headerRowIndex = programasHeaderRowIndex;
          const headers = (matrix[headerRowIndex] || []).map((h) => String(h || '').trim());
          const rows = matrix.slice(headerRowIndex + 1);
          const preparedRows = [];

          for (let i = 0; i < rows.length; i += 1) {
            const row = rows[i] || [];
            if (!row.some((cell) => String(cell || '').trim() !== '')) continue;
            try {
              const { normalizedByHeader } = normalizeContextoRowCells({
                headers,
                row,
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary,
                novedadesMap: contextoNovedades
              });
              preparedRows.push({
                fila: headerRowIndex + i + 2,
                originalRow: row,
                normalizedRowByHeader: normalizedByHeader
              });
            } catch (sheetErr) {
              const fila = headerRowIndex + i + 2;
              sheetResult.errores.push({ fila, error: sheetErr.message });
              result.errores.push({ hoja: sheetName, fila, error: sheetErr.message });
            }
            sheetResult.total += 1;
            result.total += 1;
          }

          preparedRows.forEach((prepared) => {
            applyAccentCanonicalization({
              headers,
              normalizedByHeader: prepared.normalizedRowByHeader,
              accentCanonicalMap
            });
          });

          for (let i = 0; i < preparedRows.length; i += 1) {
            const { fila, originalRow, normalizedRowByHeader } = preparedRows[i];
            try {
              const normalizedAccentByHeader = applyAccentCanonicalization({
                headers,
                normalizedByHeader: normalizedRowByHeader,
                accentCanonicalMap
              });
              const normalizedRowByKey = Object.fromEntries(headers.map((h) => [normalizeHeader(h || ''), normalizedAccentByHeader[h || '']]));
              const programaComparadoStd = standardizeTextWithDictionary({
                value: normalizedRowByKey.NOMBRE_DEL_PROGRAMA,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'PROGRAMA',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              });
              registerContextoNovedad({
                novedadesMap: contextoNovedades,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'PROGRAMA',
                original: normalizedRowByKey.NOMBRE_DEL_PROGRAMA,
                normalized: programaComparadoStd.normalized
              });
              const programaComparado = programaComparadoStd.normalized;

              const iesStd = standardizeTextWithDictionary({
                value: normalizedRowByKey.NOMBRE_INSTITUCION || normalizedRowByKey.NOMBRE_IES,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'IES',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              });
              registerContextoNovedad({
                novedadesMap: contextoNovedades,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'IES',
                original: normalizedRowByKey.NOMBRE_INSTITUCION || normalizedRowByKey.NOMBRE_IES,
                normalized: iesStd.normalized
              });
              const ies = iesStd.normalized;
              if (!programaComparado && !ies) continue;

              const sector = standardizeTextWithDictionary({
                value: normalizedRowByKey.SECTOR,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'SECTOR',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized;
              const modalidad = standardizeTextWithDictionary({
                value: normalizedRowByKey.MODALIDAD,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'MODALIDAD',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized;
              const departamento = standardizeTextWithDictionary({
                value: normalizedRowByKey.DEPARTAMENTO || normalizedRowByKey.DEPARTAMENTO_OFERTA_PROGRAMA,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'DEPARTAMENTO',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized;
              const municipio = standardizeTextWithDictionary({
                value: normalizedRowByKey.MUNICIPIO || normalizedRowByKey.MUNICIPIO_OFERTA_PROGRAMA,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'MUNICIPIO',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized;

              const detail = {
                anio: parseAnio(normalizedRowByKey.FECHA_DE_REGISTRO_EN_SNIES) || null,
                periodo_referencia: null,
                tipo_registro: 'oferta',
                base_indicador: baseIndicador,
                alcance,
                hoja_fuente: sheetName,
                sector,
                ies,
                programa_comparado: programaComparado,
                programa_objetivo: programaObjetivoStd,
                departamento,
                municipio,
                modalidad,
                periodicidad: normalizeText(
                  normalizedRowByKey.PERIODICIDAD
                  || normalizedRowByKey.PERIODICIDAD_ADMISIONES
                  || normalizedRowByKey.TIPO_CUBRIMIENTO
                ),
                creditos: toNumber(
                  normalizedRowByKey.NUMERO_DE_CREDITOS
                  || normalizedRowByKey.NUMERO_CREDITOS
                  || normalizedRowByKey.NUMERO_DE_CREDITO
                ),
                semestres: toNumber(
                  normalizedRowByKey.NUMERO_DE_PERIODOS
                  || normalizedRowByKey.NUMERO_SEMESTRES
                  || normalizedRowByKey.NUMERO_PERIODOS_DE_DURACION
                ),
                costo_matricula: toPesosNumber(
                  normalizedRowByKey.VALOR_DE_MATRICULA
                  || normalizedRowByKey.VALOR_MATRICULA
                  || normalizedRowByKey.COSTO_MATRICULA_ESTUD_NUEVOS
                ),
                fecha_registro_snies: normalizeText(normalizedRowByKey.FECHA_DE_REGISTRO_EN_SNIES),
                oferta_tag: alcance ? alcance.toUpperCase() : null,
                valor: 1,
                raw_data: JSON.stringify({
                  original: Object.fromEntries(headers.map((h, idx) => [h || `COL_${idx + 1}`, originalRow[idx]])),
                  normalizado: normalizedAccentByHeader
                }),
                creado_por: req.user?.id || null,
                actualizado_por: req.user?.id || null
              };

              await PoblacionalContextoExterno.create(detail);
              await createContextoStat({
                anio: detail.anio,
                programaComparado: detail.programa_comparado,
                ies: detail.ies,
                indicador: 'Oferta programas',
                valor: 1,
                unidad: 'programas',
                baseIndicador,
                alcance,
                hoja: sheetName,
                sector: detail.sector,
                corte: sheetMeta.corte,
                programaObjetivo: programaObjetivoStd,
                tipoRegistro: 'oferta'
              });

              sheetResult.importados += 1;
              result.importados += 1;
              result.importadosValor += Number(detail.valor || 0);
            } catch (sheetErr) {
              sheetResult.errores.push({ fila, error: sheetErr.message });
              result.errores.push({ hoja: sheetName, fila, error: sheetErr.message });
            }
          }
        } else if (tabularHeaderRowIndex >= 0) {
          const headerRowIndex = tabularHeaderRowIndex;
          const headers = (matrix[headerRowIndex] || []).map((h) => String(h || '').trim());
          const rows = matrix.slice(headerRowIndex + 1);
          const preparedRows = [];

          for (let i = 0; i < rows.length; i += 1) {
            const row = rows[i] || [];
            if (!row.some((cell) => String(cell || '').trim() !== '')) continue;
            const fila = headerRowIndex + i + 2;
            try {
              const { normalizedByHeader } = normalizeContextoRowCells({
                headers,
                row,
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary,
                novedadesMap: contextoNovedades
              });
              preparedRows.push({
                fila,
                originalRow: row,
                normalizedRowByHeader: normalizedByHeader
              });
            } catch (sheetErr) {
              sheetResult.errores.push({ fila, error: sheetErr.message });
              result.errores.push({ hoja: sheetName, fila, error: sheetErr.message });
            }
            sheetResult.total += 1;
            result.total += 1;
          }

          preparedRows.forEach((prepared) => {
            applyAccentCanonicalization({
              headers,
              normalizedByHeader: prepared.normalizedRowByHeader,
              accentCanonicalMap
            });
          });

          for (let i = 0; i < preparedRows.length; i += 1) {
            const { fila, originalRow, normalizedRowByHeader } = preparedRows[i];
            try {
              const normalizedAccentByHeader = applyAccentCanonicalization({
                headers,
                normalizedByHeader: normalizedRowByHeader,
                accentCanonicalMap
              });
              const normalizedRowByKey = Object.fromEntries(headers.map((h) => [normalizeHeader(h || ''), normalizedAccentByHeader[h || '']]));
              const metricRaw = pickContextoExternoTabularMetricValue(normalizedRowByKey, baseIndicador);
              const valueNum = toNumber(metricRaw) ?? toPesosNumber(metricRaw);
              if (valueNum === null) continue;

              const anio = parseAnio(normalizedRowByKey.ANO);
              const semestreRaw = normalizeText(normalizedRowByKey.SEMESTRE);
              const semestreToken = String(semestreRaw || '').toUpperCase();
              const semestreSlot = /\b(2|II|IIP)\b/.test(semestreToken) ? 2 : 1;
              const periodoLabel = anio ? `${anio}-${semestreSlot}` : semestreRaw;

              const programaStd = standardizeTextWithDictionary({
                value: normalizedRowByKey.PROGRAMA_ACADEMICO,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'PROGRAMA',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized || normalizedRowByKey.PROGRAMA_ACADEMICO;
              const programaComparado = canonicalizeAccentOnlyValue({
                column: 'PROGRAMA',
                value: programaStd,
                accentCanonicalMap
              });
              if (!programaComparado) continue;

              const iesStd = standardizeTextWithDictionary({
                value: normalizedRowByKey.INSTITUCION_DE_EDUCACION_SUPERIOR_IES || normalizedRowByKey.IES_PADRE,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'IES',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized;
              const ies = canonicalizeAccentOnlyValue({
                column: 'IES',
                value: iesStd,
                accentCanonicalMap
              });
              const sector = standardizeTextWithDictionary({
                value: normalizedRowByKey.SECTOR_IES,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'SECTOR',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized;
              const departamento = standardizeTextWithDictionary({
                value: normalizedRowByKey.DEPARTAMENTO_DE_OFERTA_DEL_PROGRAMA,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'DEPARTAMENTO',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized;
              const municipio = standardizeTextWithDictionary({
                value: normalizedRowByKey.MUNICIPIO_DE_OFERTA_DEL_PROGRAMA,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'MUNICIPIO',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized;
              const modalidad = standardizeTextWithDictionary({
                value: normalizedRowByKey.MODALIDAD,
                ambito: 'CONTEXTO_EXTERNO',
                columna: 'MODALIDAD',
                ruleIndex: correctionRuleIndex,
                summary: cleaningSummary
              }).normalized;

              const detail = {
                anio,
                periodo_referencia: periodoLabel,
                tipo_registro: 'serie',
                base_indicador: baseIndicador,
                alcance,
                hoja_fuente: sheetName,
                sector: normalizeText(sector),
                ies: normalizeText(ies),
                programa_comparado: normalizeText(programaComparado),
                programa_objetivo: programaObjetivoStd,
                departamento: normalizeText(departamento),
                municipio: normalizeText(municipio),
                modalidad: normalizeText(modalidad),
                periodicidad: null,
                creditos: null,
                semestres: null,
                costo_matricula: null,
                fecha_registro_snies: null,
                oferta_tag: alcance ? alcance.toUpperCase() : null,
                valor: valueNum,
                raw_data: JSON.stringify({
                  original: Object.fromEntries(headers.map((h, idx) => [h || `COL_${idx + 1}`, originalRow[idx]])),
                  normalizado: normalizedAccentByHeader
                }),
                creado_por: req.user?.id || null,
                actualizado_por: req.user?.id || null
              };

              await PoblacionalContextoExterno.create(detail);
              await createContextoStat({
                anio: detail.anio,
                programaComparado: detail.programa_comparado,
                ies: detail.ies,
                indicador: baseIndicador,
                valor: Number(valueNum),
                unidad: 'estudiantes',
                baseIndicador,
                alcance,
                hoja: sheetName,
                periodoRef: periodoLabel,
                sector: detail.sector,
                corte: sheetMeta.corte,
                programaObjetivo: programaObjetivoStd,
                tipoRegistro: 'serie'
              });

              sheetResult.importados += 1;
              result.importados += 1;
              result.importadosValor += Number(detail.valor || 0);
            } catch (sheetErr) {
              sheetResult.errores.push({ fila, error: sheetErr.message });
              result.errores.push({ hoja: sheetName, fila, error: sheetErr.message });
            }
          }
        } else {
          const headerRowIndex = seriesHeaderRowIndex;
          if (headerRowIndex < 0) continue;
          const periodHeaders = (matrix[headerRowIndex] || []).slice(1).map((v) => String(v || '').trim()).filter(Boolean);
          if (!periodHeaders.length) continue;

          let currentSector = null;
          let currentIes = null;
          const rows = matrix.slice(headerRowIndex + 1);

          for (let i = 0; i < rows.length; i += 1) {
            const row = rows[i] || [];
            const fila = headerRowIndex + i + 2;
            const firstCell = String(row[0] || '').trim();
            if (!firstCell) continue;
            if (/^total\s+general$/i.test(firstCell)) continue;

            const values = row.slice(1, 1 + periodHeaders.length).map((v) => String(v ?? '').trim());
            const hasNumbers = values.some((v) => v !== '' && Number.isFinite(Number(v)));
            const hasAnyValues = values.some((v) => v !== '');

            if (!hasAnyValues) {
              if (/^(OFICIAL|PRIVADO|PRIVADA|PUBLICO|PÃƒÆ’Ã…Â¡BLICO)$/i.test(firstCell)) {
                const sectorStd = standardizeTextWithDictionary({
                  value: firstCell,
                  ambito: 'CONTEXTO_EXTERNO',
                  columna: 'SECTOR',
                  ruleIndex: correctionRuleIndex,
                  summary: cleaningSummary
                }).normalized || firstCell;
                currentSector = canonicalizeAccentOnlyValue({
                  column: 'SECTOR',
                  value: sectorStd,
                  accentCanonicalMap
                });
                currentIes = null;
              } else {
                const iesStd = standardizeTextWithDictionary({
                  value: firstCell,
                  ambito: 'CONTEXTO_EXTERNO',
                  columna: 'IES',
                  ruleIndex: correctionRuleIndex,
                  summary: cleaningSummary
                }).normalized || firstCell;
                currentIes = canonicalizeAccentOnlyValue({
                  column: 'IES',
                  value: iesStd,
                  accentCanonicalMap
                });
              }
              continue;
            }

            if (!hasNumbers) continue;
            const programaStd = standardizeTextWithDictionary({
              value: firstCell,
              ambito: 'CONTEXTO_EXTERNO',
              columna: 'PROGRAMA',
              ruleIndex: correctionRuleIndex,
              summary: cleaningSummary
            }).normalized || firstCell;
            const programaComparado = canonicalizeAccentOnlyValue({
              column: 'PROGRAMA',
              value: programaStd,
              accentCanonicalMap
            });

            for (let c = 0; c < periodHeaders.length; c += 1) {
              const periodLabel = periodHeaders[c];
              const rawValue = row[c + 1];
              const valueNum = toNumber(rawValue);
              if (valueNum === null) continue;
              try {
                const anio = parsePeriodoLabelToAnio(periodLabel);
                const detail = {
                  anio,
                  periodo_referencia: periodLabel,
                  tipo_registro: 'serie',
                  base_indicador: baseIndicador,
                  alcance,
                  hoja_fuente: sheetName,
                  sector: normalizeText(currentSector),
                  ies: normalizeText(currentIes),
                  programa_comparado: normalizeText(programaComparado),
                  programa_objetivo: programaObjetivoStd,
                  departamento: null,
                  municipio: null,
                  modalidad: null,
                  periodicidad: null,
                  creditos: null,
                  semestres: null,
                  costo_matricula: null,
                  fecha_registro_snies: null,
                  oferta_tag: alcance ? alcance.toUpperCase() : null,
                  valor: valueNum,
                  raw_data: JSON.stringify({
                    hoja: sheetName,
                    periodo: periodLabel,
                    valor: rawValue,
                    sector: currentSector,
                    ies: currentIes,
                    programa: programaComparado
                  }),
                  creado_por: req.user?.id || null,
                  actualizado_por: req.user?.id || null
                };

                await PoblacionalContextoExterno.create(detail);
                await createContextoStat({
                  anio,
                  programaComparado: detail.programa_comparado,
                  ies: detail.ies,
                  indicador: baseIndicador,
                  valor: Number(valueNum),
                  unidad: 'estudiantes',
                  baseIndicador,
                  alcance,
                  hoja: sheetName,
                  periodoRef: periodLabel,
                  sector: detail.sector,
                  corte: sheetMeta.corte,
                  programaObjetivo: programaObjetivoStd,
                  tipoRegistro: 'serie'
                });

                sheetResult.importados += 1;
                result.importados += 1;
                result.importadosValor += Number(detail.valor || 0);
              } catch (sheetErr) {
                sheetResult.errores.push({ fila, error: sheetErr.message, periodo: periodLabel });
                result.errores.push({ hoja: sheetName, fila, error: sheetErr.message, periodo: periodLabel });
              }
              sheetResult.total += 1;
              result.total += 1;
            }
          }
        }

          if (sheetResult.total > 0) {
            result.hojasProcesadas.push({ hoja: sheetName, ...sheetResult });
          }
        }
      }

      if (!result.total) {
        return res.status(400).json({ success: false, message: 'No se detectaron tablas validas para Contexto Externo en el archivo' });
      }

      const novedadesGuardadas = await persistContextoNovedades({
        novedadesMap: contextoNovedades,
        userId: req.user?.id || null,
        limit: 500
      });

      const useValorAsTotals = result.errores.length === 0 && Number(result.importadosValor || 0) > Number(result.importados || 0);
      const totalPlantilla = useValorAsTotals ? Number(result.importadosValor || 0) : Number(result.total || 0);
      const totalCargados = useValorAsTotals ? Number(result.importadosValor || 0) : Number(result.importados || 0);
      const totalOmitidos = Math.max(0, totalPlantilla - totalCargados);
      const porcentaje = totalPlantilla > 0 ? Number(((totalCargados / totalPlantilla) * 100).toFixed(2)) : 0;
      const limpieza = {
        totalCorrecciones: cleaningSummary.total || 0,
        tecnicas: cleaningSummary.tecnica || 0,
        diccionario: cleaningSummary.diccionario || 0,
        novedadesGuardadas: novedadesGuardadas || 0,
        ejemplos: cleaningSummary.ejemplos || []
      };
      const detalleCarga = JSON.stringify({
        errores: result.errores || [],
        limpieza,
        hojasProcesadas: (result.hojasProcesadas || []).map((h) => ({
          hoja: h.hoja,
          total: h.total || 0,
          importados: h.importados || 0,
          errores: (h.errores || []).length
        }))
      });
      await GestionInformacionCarga.create({
        categoria: 'Poblacional',
        subcategoria: 'Contexto Externo',
        variable: fixedSubSubcategoria || 'Contexto Externo',
        archivo_nombre: req.file?.originalname || null,
        total_plantilla: totalPlantilla,
        total_cargados: totalCargados,
        total_omitidos: totalOmitidos,
        porcentaje_cargado: porcentaje,
        estado: porcentaje === 100 ? 'exitoso' : (result.importados > 0 ? 'parcial' : 'fallido'),
        detalle: detalleCarga,
        creado_por: req.user?.id || null
      });

      return res.json({
        success: true,
        message: `Importacion finalizada para Contexto Externo${fixedSubSubcategoria ? ` / ${fixedSubSubcategoria}` : ''}: ${totalCargados}/${totalPlantilla} registros`,
        data: {
          ...result,
          total_plantilla: totalPlantilla,
          total_cargados: totalCargados,
          total_omitidos: totalOmitidos,
          limpieza
        }
      });
    }

    if (categoria === 'Poblacional' && poblacionalConfig?.label === 'Desercion') {
      const result = { total: 0, importados: 0, errores: [], hojasProcesadas: [] };
      const workbookSheetsByKey = Object.fromEntries(workbook.SheetNames.map((name) => [normalizeHeader(name), name]));

      await clearDatasetStorage({
        categoria: 'Poblacional',
        subcategoria: poblacionalConfig.label,
        poblacionalConfig
      });

      for (const template of (poblacionalConfig.sheetTemplates || [])) {
        const matchedSheetName = workbookSheetsByKey[normalizeHeader(template.sheetName)];
        if (!matchedSheetName) continue;

        const worksheetDes = workbook.Sheets[matchedSheetName];
        const { rows: rowsDes } = matrixToRows(worksheetDes, template.headers || [], true);
        if (!rowsDes.length) continue;

        const sheetResult = { total: rowsDes.length, importados: 0, errores: [] };
        const mapConfig = { map: (poblacionalConfig.maps || {})[template.kind] || {} };

        for (let i = 0; i < rowsDes.length; i += 1) {
          const row = rowsDes[i];
          const fila = i + 2;
          try {
            const payload = mapPoblacionalRecord(row, mapConfig);
            const anio = parseAnio(payload.periodo_referencia);
            const programa = normalizeText(payload.programa);
            const tipoDesercion = normalizeText(payload.tipo_desercion)
              || (template.kind === 'cohorte' ? 'COHORTE' : template.kind === 'anual' ? 'ANUAL' : 'PERIODO');
            const periodoReferencia = normalizeText(payload.periodo_referencia);
            const corteInformacion = normalizeText(payload.corte_informacion);

            if (!anio) {
              sheetResult.errores.push({ fila, error: 'No se pudo derivar AÃƒÆ’Ã¢â‚¬ËœO desde PERIODO/PERIODOS' });
              result.errores.push({ hoja: matchedSheetName, fila, error: 'No se pudo derivar AÃƒÆ’Ã¢â‚¬ËœO desde PERIODO/PERIODOS' });
              continue;
            }

            const detailBase = {
              anio,
              periodo_referencia: periodoReferencia,
              tipo_desercion: tipoDesercion,
              programa,
              desercion_nacional: toNumber(payload.desercion_nacional),
              desercion_departamental: toNumber(payload.desercion_departamental),
              desercion_institucional: toNumber(payload.desercion_institucional),
              desercion_programa: toNumber(payload.desercion_programa),
              creado_por: req.user?.id || null,
              actualizado_por: req.user?.id || null
            };

            if (template.kind === 'cohorte') {
              await PoblacionalDesercionCohorte.create({
                ...detailBase,
                corte_informacion: corteInformacion
              });
            } else if (template.kind === 'anual') {
              await PoblacionalDesercionAnual.create(detailBase);
            } else {
              await PoblacionalDesercionPeriodo.create(detailBase);
            }

            const metrics = [
              { indicador: 'Desercion nacional', valor: toNumber(payload.desercion_nacional) },
              { indicador: 'Desercion departamental', valor: toNumber(payload.desercion_departamental) },
              { indicador: 'Desercion institucional', valor: toNumber(payload.desercion_institucional) },
              { indicador: 'Desercion del programa', valor: toNumber(payload.desercion_programa) }
            ].filter((m) => m.valor !== null);

            for (const metric of metrics) {
              await Estadistica.create({
                categoria: 'Poblacional',
                subcategoria: 'Desercion',
                anio,
                programa,
                dependencia: null,
                indicador: metric.indicador,
                valor: metric.valor,
                unidad: 'tasa',
                fuente: `Carga Excel poblacional - Desercion (${template.kind})`,
                observaciones: [
                  tipoDesercion ? `tipo: ${tipoDesercion}` : '',
                  periodoReferencia ? `periodo_ref: ${periodoReferencia}` : '',
                  corteInformacion ? `corte: ${corteInformacion}` : ''
                ].filter(Boolean).join(' | ') || null,
                creado_por: req.user?.id || null,
                actualizado_por: req.user?.id || null
              });
            }

            sheetResult.importados += 1;
            result.importados += 1;
          } catch (sheetErr) {
            sheetResult.errores.push({ fila, error: sheetErr.message });
            result.errores.push({ hoja: matchedSheetName, fila, error: sheetErr.message });
          }
        }

        result.total += sheetResult.total;
        result.hojasProcesadas.push({ hoja: matchedSheetName, subcategoria: 'Desercion', tipo: template.kind, ...sheetResult });
      }

      if (!result.total) {
        return res.status(400).json({ success: false, message: 'No se encontraron hojas válidas de Deserción en el archivo' });
      }


      const porcentaje = result.total > 0 ? Number(((result.importados / result.total) * 100).toFixed(2)) : 0;
      await GestionInformacionCarga.create({
        categoria: 'Poblacional',
        subcategoria: 'Desercion',
        variable: 'Desercion',
        archivo_nombre: req.file?.originalname || null,
        total_plantilla: result.total,
        total_cargados: result.importados,
        total_omitidos: result.total - result.importados,
        porcentaje_cargado: porcentaje,
        estado: porcentaje === 100 ? 'exitoso' : (result.importados > 0 ? 'parcial' : 'fallido'),
        detalle: result.errores.length ? JSON.stringify(result.errores.slice(0, 20)) : null,
        creado_por: req.user?.id || null
      });

      return res.json({
        success: true,
        message: `Importación finalizada para Deserción: ${result.importados}/${result.total} registros`,
        data: result
      });
    }

    if (categoria === 'Saber Pro' && saberProConfig?.label === 'Resultados Saber 11') {
      if (isCsvUpload) {
        return res.status(400).json({
          success: false,
          message: 'Resultados Saber 11 solo acepta un libro Excel con siete hojas: Tipo_1 a Tipo_7.'
        });
      }

      const result = { total: 0, importados: 0, errores: [], hojasProcesadas: [] };
      const workbookSheetsByKey = Object.fromEntries(
        workbook.SheetNames.map((name) => [normalizeHeader(name), name])
      );
      const sheetTemplates = saberProConfig.sheetTemplates || [];
      const seenDocumentYear = new Set();
      const usuarioCarga = normalizeText(req.user?.email || req.user?.username || req.user?.name) || null;

      await clearDatasetStorage({
        categoria: 'Saber Pro',
        subcategoria: saberProConfig.label,
        saberProConfig
      });

      for (const template of sheetTemplates) {
        const matchedSheetName = workbookSheetsByKey[normalizeHeader(template.sheetName)];
        if (!matchedSheetName) {
          return res.status(400).json({
            success: false,
            message: `No se encontro la hoja ${template.sheetName} en el archivo Excel`
          });
        }

        const worksheet = workbook.Sheets[matchedSheetName];
        const sheetRows = readSaber11SheetRows(worksheet);
        const sheetResult = {
          hoja: matchedSheetName,
          tipo_prueba: template.tipoPrueba,
          total: sheetRows.length,
          importados: 0,
          errores: []
        };

        for (let i = 0; i < sheetRows.length; i += 1) {
          const row = sheetRows[i];
          const fila = Number.isFinite(row?.__rowNum__) ? Number(row.__rowNum__) + 1 : i + 2;

          try {
            const payload = mapPoblacionalRecord(row, { map: saberProConfig.map });
            const documento = normalizeDocumentoKey(payload.documento);
            const anio = parseAnio(payload.anio);
            const tipoPrueba = normalizeSaber11SheetName(payload.tipo_prueba) || normalizeSaber11SheetName(template.tipoPrueba);
            const tipoExamen = normalizeText(payload.tipo_examen) || tipoPrueba;

            if (!documento || !anio) {
              const error = 'Campos obligatorios faltantes: documento y anio';
              sheetResult.errores.push({ fila, error });
              result.errores.push({ hoja: matchedSheetName, fila, error });
              continue;
            }

            const duplicateKey = `${documento}|${anio}`;
            if (seenDocumentYear.has(duplicateKey)) {
              const error = `Registro duplicado para documento ${documento} y anio ${anio}`;
              sheetResult.errores.push({ fila, error });
              result.errores.push({ hoja: matchedSheetName, fila, error });
              continue;
            }

            const record = {
              documento,
              anio,
              tipo_examen: tipoExamen,
              lectura_critica: parseSaber11Score(payload.lectura_critica, 'lectura_critica', 'lectura_critica'),
              matematicas: parseSaber11Score(payload.matematicas, 'matematicas', 'matematicas'),
              sociales: parseSaber11Score(payload.sociales, 'sociales', 'sociales'),
              biologia: parseSaber11Score(payload.biologia, 'biologia', 'biologia'),
              fisica: parseSaber11Score(payload.fisica, 'fisica', 'fisica'),
              quimica: parseSaber11Score(payload.quimica, 'quimica', 'quimica'),
              lenguaje: parseSaber11Score(payload.lenguaje, 'lenguaje', 'lenguaje'),
              filosofia: parseSaber11Score(payload.filosofia, 'filosofia', 'filosofia'),
              historia: parseSaber11Score(payload.historia, 'historia', 'historia'),
              geografia: parseSaber11Score(payload.geografia, 'geografia', 'geografia'),
              ingles: parseSaber11Score(payload.ingles, 'ingles', 'ingles'),
              espanol_y_literatura: parseSaber11Score(payload.espanol_y_literatura, 'espanol_y_literatura', 'espanol_y_literatura'),
              conocimiento_matematico: parseSaber11Score(payload.conocimiento_matematico, 'conocimiento_matematico', 'conocimiento_matematico'),
              aptitud_matematica: parseSaber11Score(payload.aptitud_matematica, 'aptitud_matematica', 'aptitud_matematica'),
              electiva: parseSaber11Score(payload.electiva, 'electiva', 'electiva'),
              ciencias_naturales: parseSaber11Score(payload.ciencias_naturales, 'ciencias_naturales', 'ciencias_naturales'),
              razonamiento_cuantitativo: parseSaber11Score(payload.razonamiento_cuantitativo, 'razonamiento_cuantitativo', 'razonamiento_cuantitativo'),
              competencias_ciudadanas: parseSaber11Score(payload.competencias_ciudadanas, 'competencias_ciudadanas', 'competencias_ciudadanas'),
              sociales_y_ciudadana: parseSaber11Score(payload.sociales_y_ciudadana, 'sociales_y_ciudadana', 'sociales_y_ciudadana'),
              global: parseSaber11Score(payload.global, 'global', 'global'),
              tipo_prueba: tipoPrueba,
              fecha_carga: new Date(),
              usuario: usuarioCarga,
              nombre_archivo: req.file?.originalname || null,
              creado_por: req.user?.id || null,
              actualizado_por: req.user?.id || null
            };

            await saberProConfig.model.create(record);
            seenDocumentYear.add(duplicateKey);
            sheetResult.importados += 1;
            result.importados += 1;
          } catch (sheetErr) {
            const error = sheetErr?.name === 'SequelizeUniqueConstraintError'
              ? 'Registro duplicado para documento + anio'
              : sheetErr.message;
            sheetResult.errores.push({ fila, error });
            result.errores.push({ hoja: matchedSheetName, fila, error });
          }
        }

        result.total += sheetResult.total;
        result.hojasProcesadas.push(sheetResult);
      }

      if (!result.total) {
        return res.status(400).json({ success: false, message: 'El archivo está vacío' });
      }

      const porcentaje = result.total > 0 ? Number(((result.importados / result.total) * 100).toFixed(2)) : 0;
      const estado = porcentaje === 100 ? 'exitoso' : (result.importados > 0 ? 'parcial' : 'fallido');

      await GestionInformacionCarga.create({
        categoria: 'Saber Pro',
        subcategoria: saberProConfig.label,
        variable: saberProConfig.label,
        archivo_nombre: req.file?.originalname || null,
        total_plantilla: result.total,
        total_cargados: result.importados,
        total_omitidos: result.total - result.importados,
        porcentaje_cargado: porcentaje,
        estado,
        detalle: result.errores.length ? JSON.stringify(result.errores.slice(0, 100)) : null,
        creado_por: req.user?.id || null
      });

      return res.json({
        success: true,
        message: `Importación finalizada para Resultados Saber 11: ${result.importados}/${result.total} registros`,
        data: result
      });
    }

    if (categoria === 'Saber Pro' && saberProConfig?.label === 'Resultados individuales') {
      const result = { total: 0, importados: 0, errores: [], hojasProcesadas: [] };
      const workbookSheetsByKey = Object.fromEntries(
        workbook.SheetNames.map((name) => [normalizeHeader(name), name])
      );
      const sheetTemplates = saberProConfig.sheetTemplates || [];

      await clearDatasetStorage({
        categoria: 'Saber Pro',
        subcategoria: saberProConfig.label,
        saberProConfig
      });

      for (const template of sheetTemplates) {
        const matchedSheetName = workbookSheetsByKey[normalizeHeader(template.sheetName)];
        if (!matchedSheetName) {
          return res.status(400).json({
            success: false,
            message: `No se encontro la hoja ${template.sheetName} en el archivo Excel`
          });
        }

        const worksheet = workbook.Sheets[matchedSheetName];
        const sheetData = readWorkbookRowsWithStrictHeaders(worksheet, template.headers || [], `Resultados individuales / ${template.sheetName}`);
        const sheetResult = { hoja: matchedSheetName, tipo_prueba: template.tipoPrueba, total: sheetData.rows.length, importados: 0, errores: [] };

        for (let i = 0; i < sheetData.rows.length; i += 1) {
          const row = sheetData.rows[i];
          const fila = i + 2;
          try {
            const payload = mapPoblacionalRecord(row, { map: saberProConfig.map });
            const anio = parseAnio(payload.anio);
            const puntajeModulo = toNumber(payload.puntaje_modulo);
            const puntajeGlobal = toNumber(payload.puntaje_global);

            if (!anio) {
              const error = 'Campo obligatorio inválido: AÑO';
              sheetResult.errores.push({ fila, error });
              result.errores.push({ hoja: matchedSheetName, fila, error });
              continue;
            }

            await saberProConfig.model.create({
              tipo_prueba: template.tipoPrueba,
              ...payload,
              anio,
              puntaje_global: puntajeGlobal,
              percentil_nacional_global: toNumber(payload.percentil_nacional_global),
              percentil_grupo_referencia: toNumber(payload.percentil_grupo_referencia),
              puntaje_modulo: puntajeModulo,
              percentil_nacional_modulo: toNumber(payload.percentil_nacional_modulo),
              percentil_grupo_referencia_modulo: toNumber(payload.percentil_grupo_referencia_modulo),
              creado_por: req.user?.id || null,
              actualizado_por: req.user?.id || null
            });

            await Estadistica.create({
              categoria: 'Saber Pro',
              subcategoria: saberProConfig.label,
              anio,
              programa: normalizeText(payload.programa),
              dependencia: normalizeText(payload.grupo_referencia),
              indicador: normalizeText(payload.modulo) || 'Puntaje global',
              valor: puntajeModulo ?? puntajeGlobal ?? 0,
              unidad: puntajeModulo !== null ? 'puntaje_modulo' : 'puntaje_global',
              fuente: `Carga Excel Saber Pro (${template.tipoPrueba})`,
              observaciones: [
                normalizeText(payload.periodo) ? `periodo: ${normalizeText(payload.periodo)}` : '',
                normalizeText(payload.periodo_icfes) ? `periodo_icfes: ${normalizeText(payload.periodo_icfes)}` : '',
                normalizeText(payload.modalidad) ? `modalidad: ${normalizeText(payload.modalidad)}` : '',
                normalizeText(payload.lugar_presentacion) ? `lugar_presentacion: ${normalizeText(payload.lugar_presentacion)}` : '',
                `tipo_prueba: ${template.tipoPrueba}`
              ].filter(Boolean).join(' | '),
              creado_por: req.user?.id || null,
              actualizado_por: req.user?.id || null
            });

            sheetResult.importados += 1;
            result.importados += 1;
          } catch (sheetErr) {
            sheetResult.errores.push({ fila, error: sheetErr.message });
            result.errores.push({ hoja: matchedSheetName, fila, error: sheetErr.message });
          }
        }

        result.total += sheetResult.total;
        result.hojasProcesadas.push(sheetResult);
      }

      if (!result.total) {
        return res.status(400).json({ success: false, message: 'El archivo está vacío' });
      }

      const porcentaje = result.total > 0 ? Number(((result.importados / result.total) * 100).toFixed(2)) : 0;
      const estado = porcentaje === 100 ? 'exitoso' : (result.importados > 0 ? 'parcial' : 'fallido');
      await GestionInformacionCarga.create({
        categoria: 'Saber Pro',
        subcategoria: saberProConfig.label,
        variable: saberProConfig.label,
        archivo_nombre: req.file?.originalname || null,
        total_plantilla: result.total,
        total_cargados: result.importados,
        total_omitidos: result.total - result.importados,
        porcentaje_cargado: porcentaje,
        estado,
        detalle: result.errores.length ? JSON.stringify(result.errores.slice(0, 20)) : null,
        creado_por: req.user?.id || null
      });

      return res.json({
        success: true,
        message: `Importación finalizada para Resultados individuales: ${result.importados}/${result.total} registros`,
        data: result
      });
    }

    let headers = [];
    let rows = [];

    if (isCsvUpload) {
      const csvData = await readCsvRows(req.file.path);
      headers = csvData.headers;
      rows = csvData.rows.map((row) => {
        const cleanRow = { ...row };
        delete cleanRow.__rowNumber;
        return cleanRow;
      });
    } else {
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, blankrows: false });

      let headerRowIndex = categoria === 'Poblacional' && poblacionalConfig
        ? detectHeaderRowIndex(matrix, poblacionalConfig.headers)
        : 0;

      if ((categoria === 'Poblacional' && poblacionalConfig?.strictHeaders) || (categoria === 'Saber Pro' && saberProConfig?.strictHeaders)) {
        const strictHeaders = categoria === 'Poblacional' ? poblacionalConfig.headers : saberProConfig.headers;
        const strictLabel = categoria === 'Poblacional' ? poblacionalConfig.label : saberProConfig.label;
        const strictIndex = findExactHeaderRowIndex(matrix, strictHeaders);
        if (strictIndex < 0) {
          const candidateIndex = detectHeaderRowIndexLoose(matrix, strictHeaders);
          const actualHeaders = (matrix[candidateIndex] || []).map((header) => String(header || '').trim()).filter(Boolean);
          return res.status(400).json({
            success: false,
            message: buildStrictHeaderErrorMessage(strictLabel, strictHeaders, actualHeaders)
          });
        }
        headerRowIndex = strictIndex;
      }

      headers = (matrix[headerRowIndex] || []).map((header) => repairImportedText(String(header || '')).trim());
      rows = matrix
        .slice(headerRowIndex + 1)
        .map((cells) => {
          const row = {};
          headers.forEach((header, index) => {
            if (!header) return;
            row[header] = repairImportedText(cells[index]);
          });
          return row;
        })
        .filter((row) => Object.values(row).some((value) => value !== null && value !== undefined && String(value).trim() !== ''));
    }

    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'El archivo está vacío' });
    }

    const result = { total: rows.length, importados: 0, errores: [] };

    if (categoria === 'Poblacional' && !poblacionalConfig) {
      return res.status(400).json({
        success: false,
        message: 'Selecciona una subcategoría poblacional válida antes de importar'
      });
    }
    if (categoria === 'Poblacional' && poblacionalConfig?.strictHeaders) {
      const strictMismatch = getStrictHeaderMismatch(headers, poblacionalConfig.headers, poblacionalConfig.optionalHeaders || []);
      if (strictMismatch.missing.length || strictMismatch.unexpected.length || !strictMismatch.orderedMatch) {
        return res.status(400).json({
          success: false,
          message: buildStrictHeaderErrorMessage(poblacionalConfig.label, poblacionalConfig.headers, headers)
        });
      }
    }
    if (categoria === 'Poblacional' && poblacionalConfig?.pending) {
      return res.status(400).json({
        success: false,
        message: `La importación para ${poblacionalConfig.label} aún no está implementada. Ya puedes descargar la plantilla base.`
      });
    }
    if (categoria === 'Saber Pro' && (!saberProConfig || !saberProConfig.model || !saberProConfig.map)) {
      const sub = String(fixedSubcategoria || '').trim() || 'la subcategoría seleccionada';
      return res.status(400).json({
        success: false,
        message: `La importación para ${sub} aún no está implementada.`
      });
    }

    if (categoria === 'Poblacional' && poblacionalConfig) {
      await clearDatasetStorage({
        categoria: 'Poblacional',
        subcategoria: poblacionalConfig.label,
        poblacionalConfig
      });
    }
    if (categoria === 'Saber Pro' && saberProConfig?.label) {
      await clearDatasetStorage({
        categoria: 'Saber Pro',
        subcategoria: saberProConfig.label,
        saberProConfig
      });
    }

    // Deduplicación en-memoria para subcategorías con uniqueKeys definidos (ej. Matriculados: codigo_estudiante+periodo)
    const seenUniqueKeys = new Set();

    // ── DIVIPOLA: configuración previa al bucle para MATRICULADOS ───────────
    const isMatriculadosImport = categoria === 'Poblacional' && poblacionalConfig?.label === 'Matriculados';
    const matriculadosIncidencias = [];
    if (isMatriculadosImport) {
      // Limpiar incidencias anteriores (el clearDatasetStorage ya borró los registros)
      await MatriculadosUbicacionIncidencia.destroy({ where: {} });
      // Pre-calentar el catálogo DIVIPOLA (una sola consulta a BD para todo el lote)
      await divipolaMatchService.loadCatalog();
    }

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const fila = i + 2;
      if (categoria === 'Poblacional') {
        const payload = mapPoblacionalRecord(row, poblacionalConfig);

        // Deduplicar por uniqueKeys si la subbase los define (ej. Matriculados: codigo_estudiante+periodo)
        if (Array.isArray(poblacionalConfig.uniqueKeys) && poblacionalConfig.uniqueKeys.length > 0) {
          const uniqueKey = poblacionalConfig.uniqueKeys.map((k) => normalizeText(payload[k]) || '').join('|');
          if (uniqueKey && seenUniqueKeys.has(uniqueKey)) {
            result.omitidos = (result.omitidos || 0) + 1;
            continue;
          }
          if (uniqueKey) seenUniqueKeys.add(uniqueKey);
        }

        // ── DIVIPOLA: normalización territorial inline para MATRICULADOS ───
        let matriculadoDeptoFuente = null;
        let matriculadoMuniFuente  = null;
        if (isMatriculadosImport) {
          payload.codigo_dane = toCode(payload.codigo_dane, 5);
          payload.codigo_departamento = toCode(payload.codigo_departamento, 2) || (payload.codigo_dane ? String(payload.codigo_dane).slice(0, 2) : null);
          payload.codigo_dane_nacimiento = toCode(payload.codigo_dane_nacimiento, 5);
          payload.codigo_departamento_nacimiento = toCode(payload.codigo_departamento_nacimiento, 2) || (payload.codigo_dane_nacimiento ? String(payload.codigo_dane_nacimiento).slice(0, 2) : null);

          matriculadoDeptoFuente = String(payload.departamento || '').trim() || null;
          matriculadoMuniFuente = String(payload.municipio || '').trim() || null;

          const resolvedActual = await divipolaMatchService.resolveUbicacion({
            pais: 'COLOMBIA',
            departamento: payload.departamento,
            municipio: payload.municipio,
            codigoDaneMuni: payload.codigo_dane,
            codigoDaneDepto: payload.codigo_departamento
          });

          if ((resolvedActual.confianza === 'alta' || resolvedActual.confianza === 'media') && resolvedActual.nombreDepto) {
            payload.departamento = resolvedActual.nombreDepto;
          }
          if ((resolvedActual.confianza === 'alta' || resolvedActual.confianza === 'media') && resolvedActual.nombreMuni) {
            payload.municipio = resolvedActual.nombreMuni;
          }

          payload.codigo_departamento = resolvedActual.codigoDepto || payload.codigo_departamento;
          payload.codigo_dane = resolvedActual.codigoMuni || payload.codigo_dane;
          payload.match_confianza_ubicacion = resolvedActual.confianza;
          payload.match_metodo_ubicacion = resolvedActual.metodo;
          payload.match_score_ubicacion = resolvedActual.score;
          payload.match_actualizado_en = new Date();

          const resolvedNacimiento = await divipolaMatchService.resolveUbicacion({
            pais: payload.pais,
            departamento: payload.departamento_nacimiento,
            municipio: payload.municipio_nacimiento,
            codigoDaneMuni: payload.codigo_dane_nacimiento,
            codigoDaneDepto: payload.codigo_departamento_nacimiento
          });

          if ((resolvedNacimiento.confianza === 'alta' || resolvedNacimiento.confianza === 'media') && resolvedNacimiento.nombreDepto) {
            payload.departamento_nacimiento = resolvedNacimiento.nombreDepto;
          }
          if ((resolvedNacimiento.confianza === 'alta' || resolvedNacimiento.confianza === 'media') && resolvedNacimiento.nombreMuni) {
            payload.municipio_nacimiento = resolvedNacimiento.nombreMuni;
          }
          payload.codigo_departamento_nacimiento = resolvedNacimiento.codigoDepto || payload.codigo_departamento_nacimiento;
          payload.codigo_dane_nacimiento = resolvedNacimiento.codigoMuni || payload.codigo_dane_nacimiento;
        }

        if (poblacionalConfig.label === 'Empleabilidad') {
          const anio = parseAnio(payload.anio);
          const ies = normalizeText(payload.ies);
          const programa = normalizeText(payload.denominacion_programa);
          const empleabilidadPrograma = toNumber(payload.empleabilidad_programa);
          const empleabilidadNacional = toNumber(payload.empleabilidad_nacional);

          if (!anio) {
            result.errores.push({ fila, error: 'Campo obligatorio inválido: AÑO' });
            continue;
          }

          await poblacionalConfig.model.create({
            anio,
            ies,
            empleabilidad_programa: empleabilidadPrograma,
            empleabilidad_nacional: empleabilidadNacional,
            denominacion_programa: programa,
            creado_por: req.user?.id || null,
            actualizado_por: req.user?.id || null
          });

          const metrics = [
            { indicador: 'Empleabilidad programa', valor: empleabilidadPrograma },
            { indicador: 'Empleabilidad nacional', valor: empleabilidadNacional }
          ].filter((m) => m.valor !== null);

          for (const metric of metrics) {
            await Estadistica.create({
              categoria: 'Poblacional',
              subcategoria: 'Empleabilidad',
              anio,
              programa,
              dependencia: null,
              indicador: metric.indicador,
              valor: metric.valor,
              unidad: 'porcentaje',
              fuente: ies || 'Carga Excel poblacional - Empleabilidad',
              observaciones: ies ? `ies: ${ies}` : null,
              creado_por: req.user?.id || null,
              actualizado_por: req.user?.id || null
            });
          }

          result.importados += 1;
          continue;
        }

        const anio = parseAnio(payload.anio || payload.semestre || row.SEMESTRE || row['AÑO']);
        const periodo = normalizeText(payload.semestre);
        const programa = normalizeText(payload.programa);
        const conteo = toNumber(payload.conteo ?? payload.cantidad);
        const valor = conteo === null ? 1 : conteo;

        if (!anio) {
          result.errores.push({ fila, error: 'Campo obligatorio inválido: AÑO' });
          continue;
        }

        const detailPayload = {
          ...payload,
          anio,
          cantidad: toNumber(payload.cantidad),
          conteo,
          numero_materias_inscritas: toNumber(payload.numero_materias_inscritas),
          numero_materias_aprobadas: toNumber(payload.numero_materias_aprobadas),
          anio_primer_curso: parseAnio(payload.anio_primer_curso),
          valor_derechos_matricula: toNumber(payload.valor_derechos_matricula),
          creado_por: req.user?.id || null,
          actualizado_por: req.user?.id || null
        };

        const createdRecord = await poblacionalConfig.model.create(detailPayload);

        // ── MATRICULADOS: acumular incidencias de baja confianza ───────────
        if (isMatriculadosImport && createdRecord) {
          const conf = detailPayload.match_confianza_ubicacion;
          if (conf === 'sin_match' || conf === 'baja') {
            matriculadosIncidencias.push({
              matriculado_id:              createdRecord.id,
              anio:                        detailPayload.anio,
              periodo:                     buildPeriodLabel(detailPayload.anio, detailPayload.semestre),
              departamento_fuente:         matriculadoDeptoFuente,
              municipio_fuente:            matriculadoMuniFuente,
              codigo_departamento_sugerido: detailPayload.codigo_departamento || null,
              codigo_municipio_sugerido:   detailPayload.codigo_dane || null,
              confianza:                   conf,
              metodo:                      detailPayload.match_metodo_ubicacion || 'sin_match',
              score:                       detailPayload.match_score_ubicacion  || null,
              estado:                      'pendiente',
              observacion:                 conf === 'sin_match'
                ? 'Sin match automático con catálogo DIVIPOLA'
                : 'Match parcial: requiere revisión manual'
            });
          }
        }

        await Estadistica.create({
          categoria: 'Poblacional',
          subcategoria: poblacionalConfig.label,
          anio,
          programa,
          dependencia: normalizeText(payload.departamento),
          indicador: normalizeText(payload.detalle) || poblacionalConfig.label,
          valor,
          unidad: 'personas',
          fuente: normalizeText(payload.nombre_ies || payload.ies) || 'Carga Excel poblacional',
          observaciones: [
            periodo ? `periodo: ${periodo}` : '',
            normalizeText(payload.detalle) ? `detalle: ${normalizeText(payload.detalle)}` : ''
          ].filter(Boolean).join(' | ') || null,
          creado_por: req.user?.id || null,
          actualizado_por: req.user?.id || null
        });
        result.importados += 1;
        continue;
      }
      if (categoria === 'Saber Pro') {
        const payload = mapPoblacionalRecord(row, { map: saberProConfig.map }); // reuse alias picker helper
        const anio = parseAnio(payload.anio);

        if (!anio) {
          result.errores.push({ fila, error: 'Campo obligatorio inválido: Año' });
          continue;
        }

        if (saberProConfig.label === 'Resultados agregados') {
          const programa = normalizeText(payload.programa);
          const competencia = normalizeText(payload.competencia);
          const tipoPrueba = normalizeText(payload.tipo_prueba);
          const puntajePrograma = toNumber(payload.puntaje_programa);
          const puntajeInstitucion = toNumber(payload.puntaje_institucion);
          const puntajeGrupoReferencia = toNumber(payload.puntaje_grupo_referencia);

          if (!programa || !competencia) {
            result.errores.push({ fila, error: 'Campos obligatorios faltantes: PROGRAMA y COMPETENCIA' });
            continue;
          }

          await saberProConfig.model.create({
            anio,
            programa,
            competencia,
            puntaje_programa: puntajePrograma,
            puntaje_institucion: puntajeInstitucion,
            puntaje_grupo_referencia: puntajeGrupoReferencia,
            tipo_prueba: tipoPrueba,
            creado_por: req.user?.id || null,
            actualizado_por: req.user?.id || null
          });

          await Estadistica.create({
            categoria: 'Saber Pro',
            subcategoria: saberProConfig.label,
            anio,
            programa,
            dependencia: null,
            indicador: competencia,
            valor: puntajePrograma ?? 0,
            unidad: 'puntaje_programa',
            fuente: 'Carga Excel Saber Pro agregados',
            observaciones: [
              puntajeInstitucion !== null ? `puntaje_institucion: ${puntajeInstitucion}` : '',
              puntajeGrupoReferencia !== null ? `puntaje_grupo_referencia: ${puntajeGrupoReferencia}` : '',
              tipoPrueba ? `tipo_prueba: ${tipoPrueba}` : ''
            ].filter(Boolean).join(' | ') || null,
            creado_por: req.user?.id || null,
            actualizado_por: req.user?.id || null
          });
        } else {
          const periodo = normalizeText(payload.periodo);
          const programa = normalizeText(payload.programa);
          const modulo = normalizeText(payload.modulo);
          const competencias = normalizeText(payload.competencias);
          const puntajeModulo = toNumber(payload.puntaje_modulo);
          const puntajeGlobal = toNumber(payload.puntaje_global);

          await saberProConfig.model.create({
            ...payload,
            anio,
            puntaje_global: puntajeGlobal,
            percentil_nacional_global: toNumber(payload.percentil_nacional_global),
            percentil_grupo_referencia: toNumber(payload.percentil_grupo_referencia),
            puntaje_modulo: puntajeModulo,
            percentil_nacional_modulo: toNumber(payload.percentil_nacional_modulo),
            percentil_grupo_referencia_modulo: toNumber(payload.percentil_grupo_referencia_modulo),
            creado_por: req.user?.id || null,
            actualizado_por: req.user?.id || null
          });

          await Estadistica.create({
            categoria: 'Saber Pro',
            subcategoria: saberProConfig.label,
            anio,
            programa,
            dependencia: normalizeText(payload.grupo_referencia),
            indicador: modulo || 'Puntaje global',
            valor: puntajeModulo ?? puntajeGlobal ?? 0,
            unidad: puntajeModulo !== null ? 'puntaje_modulo' : 'puntaje_global',
            fuente: 'Carga Excel Saber Pro',
            observaciones: [periodo ? `periodo: ${periodo}` : '', competencias ? `competencias: ${competencias}` : ''].filter(Boolean).join(' | ') || null,
            creado_por: req.user?.id || null,
            actualizado_por: req.user?.id || null
          });
        }
        result.importados += 1;
        continue;
      }

      const anio = Number(row.anio);
      const indicador = normalizeText(row.indicador);
      const valor = toNumber(row.valor);
      if (!anio || !indicador || valor === null) {
        result.errores.push({ fila, error: 'Campos obligatorios: anio, indicador, valor' });
        continue;
      }
      await Estadistica.create({
        categoria,
        subcategoria: normalizeText(row.subcategoria) || fixedSubcategoria,
        anio,
        programa: normalizeText(row.programa),
        dependencia: normalizeText(row.dependencia),
        indicador,
        valor,
        unidad: normalizeText(row.unidad),
        fuente: normalizeText(row.fuente),
        observaciones: normalizeText(row.observaciones),
        creado_por: req.user?.id || null,
        actualizado_por: req.user?.id || null
      });
      result.importados += 1;
    }

    // ── MATRICULADOS: bulk-insert incidencias + limpieza de caché ──────────
    if (isMatriculadosImport) {
      if (matriculadosIncidencias.length > 0) {
        const BATCH = 500;
        for (let b = 0; b < matriculadosIncidencias.length; b += BATCH) {
          await MatriculadosUbicacionIncidencia.bulkCreate(
            matriculadosIncidencias.slice(b, b + BATCH)
          );
        }
      }
      // Invalidar el catálogo en memoria para que la siguiente importación
      // siempre lea el estado más reciente de ref_departamentos / ref_municipios
      divipolaMatchService.invalidateCatalog();
      // Limpiar caché del dashboard geo
      matriculadosGeoDashboardCache.clear();
    }

    const porcentaje = result.total > 0 ? Number(((result.importados / result.total) * 100).toFixed(2)) : 0;
    const estado = porcentaje === 100 ? 'exitoso' : (result.importados > 0 ? 'parcial' : 'fallido');
    const variable = categoria === 'Poblacional' && poblacionalConfig ? poblacionalConfig.label : (fixedSubcategoria || categoria);
    const detalle = result.errores.length ? JSON.stringify(result.errores.slice(0, 20)) : null;

    await GestionInformacionCarga.create({
      categoria,
      subcategoria: fixedSubcategoria,
      variable,
      archivo_nombre: req.file?.originalname || null,
      total_plantilla: result.total,
      total_cargados: result.importados,
      total_omitidos: result.total - result.importados,
      porcentaje_cargado: porcentaje,
      estado,
      detalle,
      creado_por: req.user?.id || null
    });

    return res.json({
      success: true,
      message: `Importación finalizada para ${categoria}: ${result.importados}/${result.total} registros`,
      data: result
    });
  } catch (error) {
    console.error('Error al importar base de gestión de información:', error);
    const detail =
      error?.original?.detail ||
      error?.original?.message ||
      error?.parent?.detail ||
      error?.parent?.message ||
      error?.message ||
      'Error interno al importar archivo';
    return res.status(500).json({ success: false, message: `Error al importar archivo: ${detail}` });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn(`No se pudo eliminar archivo temporal: ${req.file.path}`, cleanupError?.message || cleanupError);
      }
    }
  }
};

const clearByCategoria = async (req, res) => {
  try {
    const validatedAdmin = await validateAdminConfirmation(req, res);
    if (!validatedAdmin) return;

    const categoria = resolveCategoria(req.body?.categoria || req.query?.categoria);
    const subcategoria = normalizeText(req.body?.subcategoria || req.query?.subcategoria);
    const poblacionalConfig = categoria === 'Poblacional' && subcategoria ? resolvePoblacionalConfig(subcategoria) : null;
    const saberProConfig = categoria === 'Saber Pro' && subcategoria ? resolveSaberProConfig(subcategoria) : null;
    const recursoHumanoConfig = categoria === 'Recurso Humano' && subcategoria ? resolveRecursoHumanoConfig(subcategoria) : null;
    if (!categoria) {
      return res.status(400).json({ success: false, message: 'Debes seleccionar la base de datos destino' });
    }

    const { deleted, deletedLogs } = await clearDatasetStorage({
      categoria,
      subcategoria,
      poblacionalConfig,
      saberProConfig,
      recursoHumanoConfig
    });
    return res.json({
      success: true,
      message: `Se eliminaron ${deleted} registros de la base ${categoria}${subcategoria ? ` / ${subcategoria}` : ''}`,
      data: { deleted, deletedLogs }
    });
  } catch (error) {
    console.error('Error al limpiar base por categoría:', error);
    return res.status(500).json({ success: false, message: 'Error al limpiar datos' });
  }
};

const downloadContextoExternoNormalizado = async (req, res) => {
  try {
    const categoria = resolveCategoria(req.query?.categoria || 'poblacional');
    const subcategoria = normalizeText(req.query?.subcategoria || 'Contexto Externo');
    const variable = normalizeText(req.query?.variable || '');
    const poblacionalConfig = categoria === 'Poblacional' ? resolvePoblacionalConfig(subcategoria) : null;
    const contextoCargaConfig = resolveContextoExternoCargaConfig(variable);

    if (categoria !== 'Poblacional' || !poblacionalConfig || poblacionalConfig?.customImport !== 'contexto_externo') {
      return res.status(400).json({ success: false, message: 'Exportacion disponible solo para Poblacional / Contexto Externo' });
    }
    if (!contextoCargaConfig) {
      return res.status(400).json({ success: false, message: 'Lista de Contexto Externo invalida para exportacion' });
    }

    const rows = await PoblacionalContextoExterno.findAll({
      where: {
        tipo_registro: contextoCargaConfig.onlyType,
        base_indicador: contextoCargaConfig.baseIndicador
      },
      order: [['anio', 'ASC'], ['periodo_referencia', 'ASC'], ['ies', 'ASC'], ['programa_comparado', 'ASC']],
      raw: true
    });

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: `No hay datos normalizados para ${variable}`
      });
    }

    const variableKey = normalizeHeader(variable);
    const contextoTemplateHeaders = resolveContextoExternoTemplateHeaders(variable) || [];
    const records = rows.map((row) => {
      let normalizedFromRaw = {};
      try {
        const parsed = JSON.parse(String(row.raw_data || '{}'));
        normalizedFromRaw = parsed?.normalizado && typeof parsed.normalizado === 'object'
          ? parsed.normalizado
          : {};
      } catch (_) {
        normalizedFromRaw = {};
      }
      const normalizedByKey = Object.fromEntries(
        Object.entries(normalizedFromRaw).map(([k, v]) => [normalizeHeader(k), v])
      );

      const normalizedRecord = {};
      contextoTemplateHeaders.forEach((header) => {
        const key = normalizeHeader(header);
        normalizedRecord[header] = upperContextValue(normalizedByKey[key]);
      });

      if (Object.keys(normalizedRecord).length > 0) return normalizedRecord;

      return {
        ANIO: row.anio,
        PERIODO_REFERENCIA: upperContextValue(row.periodo_referencia),
        TIPO_REGISTRO: upperContextValue(row.tipo_registro),
        BASE_INDICADOR: upperContextValue(row.base_indicador),
        ALCANCE: upperContextValue(row.alcance),
        HOJA_FUENTE: upperContextValue(row.hoja_fuente),
        SECTOR: upperContextValue(row.sector),
        IES: upperContextValue(row.ies),
        PROGRAMA_COMPARADO: upperContextValue(row.programa_comparado),
        PROGRAMA_OBJETIVO: upperContextValue(row.programa_objetivo),
        DEPARTAMENTO: upperContextValue(row.departamento),
        MUNICIPIO: upperContextValue(row.municipio),
        MODALIDAD: upperContextValue(row.modalidad),
        PERIODICIDAD: upperContextValue(row.periodicidad),
        CREDITOS: row.creditos,
        SEMESTRES: row.semestres,
        COSTO_MATRICULA: row.costo_matricula,
        FECHA_REGISTRO_SNIES: upperContextValue(row.fecha_registro_snies),
        OFERTA_TAG: upperContextValue(row.oferta_tag),
        VALOR: row.valor
      };
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(records);
    worksheet['!cols'] = Object.keys(records[0] || {}).map((header) => ({ wch: Math.max(14, Math.min(42, String(header).length + 6)) }));
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Normalizados');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const file = `contexto_externo_normalizado_${normalizeHeader(variable).toLowerCase()}_${ts}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename=${file}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (error) {
    console.error('Error al exportar contexto externo normalizado:', error);
    return res.status(500).json({ success: false, message: 'Error al exportar datos normalizados de Contexto Externo' });
  }
};

const downloadCargueErrores = async (req, res) => {
  try {
    const id = req.query?.id ? Number(req.query.id) : null;
    const categoria = normalizeText(req.query?.categoria);
    const subcategoria = normalizeText(req.query?.subcategoria);
    const variable = normalizeText(req.query?.variable);

    let cargue = null;
    if (id) {
      cargue = await GestionInformacionCarga.findByPk(id, { raw: true });
    }
    if (!cargue) {
      const categoriaResolved = categoria ? resolveCategoria(categoria) : null;
      const whereCandidates = [
        { categoria: categoriaResolved, subcategoria, variable },
        { categoria: categoriaResolved, subcategoria },
        { categoria: categoriaResolved }
      ].map((w) =>
        Object.fromEntries(Object.entries(w).filter(([, v]) => v))
      );

      for (const where of whereCandidates) {
        if (!Object.keys(where).length) continue;
        // Fallback progresivo para registros heredados o filas "fallback-*".
        cargue = await GestionInformacionCarga.findOne({
          where,
          order: [['createdAt', 'DESC'], ['id', 'DESC']],
          raw: true
        });
        if (cargue) break;
      }
    }

    if (!cargue) {
      return res.status(404).json({ success: false, message: 'No se encontro registro de cargue para exportar errores' });
    }

    let errores = [];
    try {
      const parsed = JSON.parse(String(cargue.detalle || '[]'));
      if (Array.isArray(parsed)) {
        errores = parsed;
      } else if (parsed && Array.isArray(parsed.errores)) {
        errores = parsed.errores;
      } else {
        errores = [];
      }
    } catch (_) {
      errores = [];
    }

    if (!errores.length) {
      return res.status(404).json({ success: false, message: 'El cargue seleccionado no tiene errores registrados' });
    }

    const records = errores.map((err, idx) => ({
      ITEM: idx + 1,
      CARGUE_ID: cargue.id,
      CATEGORIA: upperContextValue(cargue.categoria),
      SUBCATEGORIA: upperContextValue(cargue.subcategoria),
      VARIABLE: upperContextValue(cargue.variable),
      HOJA: upperContextValue(err.hoja),
      FILA: err.fila ?? null,
      PERIODO: upperContextValue(err.periodo),
      ERROR: upperContextValue(err.error)
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(records);
    worksheet['!cols'] = Object.keys(records[0] || {}).map((header) => ({ wch: Math.max(14, Math.min(42, String(header).length + 6)) }));
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Errores');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const file = `errores_cargue_${cargue.id}_${ts}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename=${file}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (error) {
    console.error('Error al exportar errores de cargue:', error);
    return res.status(500).json({ success: false, message: 'Error al exportar errores de cargue' });
  }
};

const normalizeExcelRecordKeys = (row = {}) =>
  Object.fromEntries(
    Object.entries(row || {}).map(([k, v]) => [normalizeHeader(k), v])
  );

const downloadCargueBase = async (req, res) => {
  try {
    const id = req.query?.id ? Number(req.query.id) : null;
    const categoria = normalizeText(req.query?.categoria);
    const subcategoria = normalizeText(req.query?.subcategoria);
    const variable = normalizeText(req.query?.variable);

    let cargue = null;
    if (id) {
      cargue = await GestionInformacionCarga.findByPk(id, { raw: true });
    }
    if (!cargue) {
      const categoriaResolved = categoria ? resolveCategoria(categoria) : null;
      const whereCandidates = [
        { categoria: categoriaResolved, subcategoria, variable },
        { categoria: categoriaResolved, subcategoria },
        { categoria: categoriaResolved }
      ].map((w) =>
        Object.fromEntries(Object.entries(w).filter(([, v]) => v))
      );

      for (const where of whereCandidates) {
        if (!Object.keys(where).length) continue;
        // Fallback progresivo para registros heredados o filas "fallback-*".
        cargue = await GestionInformacionCarga.findOne({
          where,
          order: [['createdAt', 'DESC'], ['id', 'DESC']],
          raw: true
        });
        if (cargue) break;
      }
    }

    if (!cargue) {
      return res.status(404).json({ success: false, message: 'No se encontro cargue para exportar base' });
    }

    const categoriaResolved = resolveCategoria(cargue.categoria);
    const subcategoriaResolved = normalizeText(cargue.subcategoria);
    const variableResolved = normalizeText(cargue.variable);
    const variableEffective = variableResolved || variable;

    let records = [];
    let sheetName = 'BASE_CARGADA';

    if (categoriaResolved === 'Poblacional' && subcategoriaResolved === 'Contexto Externo') {
      const contextoConfig = resolveContextoExternoCargaConfig(variableEffective);
      if (!contextoConfig) {
        return res.status(400).json({ success: false, message: 'Variable de Contexto Externo invalida para exportacion de base' });
      }
      const contextoHeaders = resolveContextoExternoTemplateHeaders(variableEffective) || [];
      const rows = await PoblacionalContextoExterno.findAll({
        where: { tipo_registro: contextoConfig.onlyType, base_indicador: contextoConfig.baseIndicador },
        order: [['anio', 'ASC'], ['periodo_referencia', 'ASC'], ['ies', 'ASC'], ['programa_comparado', 'ASC']],
        raw: true
      });
      records = rows.map((row) => {
        let originalFromRaw = {};
        try {
          const parsed = JSON.parse(String(row.raw_data || '{}'));
          originalFromRaw = parsed?.original && typeof parsed.original === 'object' ? parsed.original : {};
        } catch (_) {
          originalFromRaw = {};
        }
        if (Object.keys(originalFromRaw).length && contextoHeaders.length) {
          const byKey = Object.fromEntries(
            Object.entries(originalFromRaw).map(([k, v]) => [normalizeHeader(k), v])
          );
          const record = {};
          contextoHeaders.forEach((h) => {
            record[h] = byKey[normalizeHeader(h)] ?? null;
          });
          return record;
        }
        return normalizeExcelRecordKeys(row);
      });
      sheetName = normalizeHeader(variableEffective || 'CONTEXTO_EXTERNO').slice(0, 31);
    } else if (categoriaResolved === 'Poblacional') {
      const poblacionalConfig = resolvePoblacionalConfig(subcategoriaResolved);
      if (poblacionalConfig?.model) {
        const rows = await poblacionalConfig.model.findAll({ order: [['id', 'ASC']], raw: true });
        records = rows.map((row) => normalizeExcelRecordKeys(row));
        sheetName = normalizeHeader(subcategoriaResolved || 'POBLACIONAL').slice(0, 31);
      } else if (Array.isArray(poblacionalConfig?.models) && poblacionalConfig.models.length > 0) {
        for (const model of poblacionalConfig.models) {
          const rows = await model.findAll({ order: [['id', 'ASC']], raw: true });
          records.push(...rows.map((row) => ({ ORIGEN_TABLA: String(model.tableName || model.name).toUpperCase(), ...normalizeExcelRecordKeys(row) })));
        }
        sheetName = normalizeHeader(subcategoriaResolved || 'POBLACIONAL').slice(0, 31);
      }
    } else if (categoriaResolved === 'Saber Pro') {
      const saberConfig = resolveSaberProConfig(subcategoriaResolved);
      if (saberConfig?.model) {
        const rows = await saberConfig.model.findAll({ order: [['id', 'ASC']], raw: true });
        records = rows.map((row) => normalizeExcelRecordKeys(row));
        sheetName = normalizeHeader(subcategoriaResolved || 'SABER_PRO').slice(0, 31);
      }
    } else if (categoriaResolved === 'Recurso Humano') {
      const rhConfig = resolveRecursoHumanoConfig(subcategoriaResolved);
      if (rhConfig?.model) {
        const rows = await rhConfig.model.findAll({ order: [['id', 'ASC']], raw: true });
        records = rows.map((row) => normalizeExcelRecordKeys(row));
        sheetName = normalizeHeader(subcategoriaResolved || 'RECURSO_HUMANO').slice(0, 31);
      }
    } else if (categoriaResolved === 'Georreferencia') {
      const [deptRows, muniRows] = await Promise.all([
        GeorreferenciaDepartamento.findAll({ order: [['codigo_departamento', 'ASC']], raw: true }),
        GeorreferenciaMunicipio.findAll({ order: [['codigo_departamento', 'ASC'], ['codigo_municipio', 'ASC']], raw: true })
      ]);
      // Use SAME column names as DIVIPOLA_TEMPLATE_HEADERS so exported file = re-importable
      const deptByCode = new Map(deptRows.map((r) => [r.codigo_departamento, r]));
      records = muniRows.map((row) => {
        const dept = deptByCode.get(row.codigo_departamento);
        return {
          'Codigo Departamento': row.codigo_departamento,
          'Nombre Departamento': dept?.nombre_departamento || null,
          'Codigo Municipio': row.codigo_municipio,
          'Nombre Municipio': row.nombre_municipio,
          'Latitud': row.latitud ?? null,
          'Longitud': row.longitud ?? null
        };
      });
      if (!records.length) {
        records = deptRows.map((row) => ({
          'Codigo Departamento': row.codigo_departamento,
          'Nombre Departamento': row.nombre_departamento,
          'Codigo Municipio': null,
          'Nombre Municipio': null,
          'Latitud': row.latitud ?? null,
          'Longitud': row.longitud ?? null
        }));
      }
      sheetName = 'DIVIPOLA';
    }

    if (!records.length) {
      const whereStats = { categoria: categoriaResolved };
      if (subcategoriaResolved) whereStats.subcategoria = subcategoriaResolved;
      const statsRows = await Estadistica.findAll({ where: whereStats, order: [['id', 'ASC']], raw: true });
      records = statsRows.map((row) => normalizeExcelRecordKeys(row));
      sheetName = normalizeHeader(`${categoriaResolved || 'BASE'}_${subcategoriaResolved || 'GENERAL'}`).slice(0, 31);
    }

    if (!records.length) {
      return res.status(404).json({ success: false, message: 'No hay registros para exportar en la base seleccionada' });
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(records);
    worksheet['!cols'] = Object.keys(records[0] || {}).map((header) => ({ wch: Math.max(14, Math.min(42, String(header).length + 6)) }));
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'BASE_CARGADA');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const file = `base_cargada_${normalizeHeader(variableEffective || subcategoriaResolved || categoriaResolved).toLowerCase()}_${ts}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename=${file}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (error) {
    console.error('Error al exportar base cargada:', error);
    return res.status(500).json({ success: false, message: 'Error al exportar base cargada' });
  }
};

const getDivipolaIncidencias = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
    const estado = normalizeText(req.query.estado);
    const search = normalizeText(req.query.search);
    const offset = (page - 1) * limit;
    const where = {};
    if (estado && estado !== 'Todos') where.estado = estado;
    if (search) {
      where[Op.or] = [
        { departamento_fuente: { [Op.iLike]: `%${search}%` } },
        { municipio_fuente: { [Op.iLike]: `%${search}%` } },
        { codigo_departamento_sugerido: { [Op.iLike]: `%${search}%` } },
        { codigo_municipio_sugerido: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await MatriculadosUbicacionIncidencia.findAndCountAll({
      where,
      order: [['id', 'DESC']],
      offset,
      limit,
      raw: true
    });

    return res.json({
      success: true,
      data: {
        rows,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(count / limit))
        }
      }
    });
  } catch (error) {
    console.error('Error al consultar incidencias DIVIPOLA:', error);
    return res.status(500).json({ success: false, message: 'Error al consultar incidencias DIVIPOLA' });
  }
};

const resolveDivipolaIncidencia = async (req, res) => {
  const tx = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      await tx.rollback();
      return res.status(400).json({ success: false, message: 'Id de incidencia invalido' });
    }

    const incidencia = await MatriculadosUbicacionIncidencia.findByPk(id, { transaction: tx });
    if (!incidencia) {
      await tx.rollback();
      return res.status(404).json({ success: false, message: 'Incidencia no encontrada' });
    }

    const action = String(req.body.action || 'apply_suggested').trim().toLowerCase();
    const observacion = normalizeText(req.body.observacion);
    let codigoDepto = normalizeText(req.body.codigo_departamento || req.body.codigo_departamento_nacimiento) || incidencia.codigo_departamento_sugerido || null;
    let codigoMuni = normalizeText(req.body.codigo_dane || req.body.codigo_municipio_nacimiento) || incidencia.codigo_municipio_sugerido || null;

    if (action === 'mark_ignored') {
      await incidencia.update({
        estado: 'ignorado',
        observacion: observacion || 'Marcado como ignorado en revision manual',
        resuelto_por: req.user?.id || null
      }, { transaction: tx });
      await tx.commit();
      return res.json({ success: true, message: 'Incidencia marcada como ignorada' });
    }

    if (codigoDepto) codigoDepto = String(codigoDepto).replace(/[^0-9]/g, '').padStart(2, '0').slice(-2);
    if (codigoMuni) codigoMuni = String(codigoMuni).replace(/[^0-9]/g, '').padStart(5, '0').slice(-5);

    if (codigoDepto) {
      const deptExists = await RefDepartamento.findOne({ where: { codigo_dane: codigoDepto, activo: true }, transaction: tx, attributes: ['codigo_dane'] });
      if (!deptExists) {
        await tx.rollback();
        return res.status(400).json({ success: false, message: 'Codigo de departamento no existe en catalogo activo' });
      }
    }
    if (codigoMuni) {
      const muni = await RefMunicipio.findOne({ where: { codigo_dane: codigoMuni, activo: true }, transaction: tx, attributes: ['codigo_dane', 'codigo_departamento'] });
      if (!muni) {
        await tx.rollback();
        return res.status(400).json({ success: false, message: 'Codigo de municipio no existe en catalogo activo' });
      }
      if (codigoDepto && String(muni.codigo_departamento) !== codigoDepto) {
        await tx.rollback();
        return res.status(400).json({ success: false, message: 'Municipio no pertenece al departamento seleccionado' });
      }
      if (!codigoDepto) codigoDepto = String(muni.codigo_departamento);
    }

    const [departamentoRef, municipioRef] = await Promise.all([
      codigoDepto
        ? RefDepartamento.findOne({ where: { codigo_dane: codigoDepto, activo: true }, transaction: tx, attributes: ['nombre_oficial'] })
        : Promise.resolve(null),
      codigoMuni
        ? RefMunicipio.findOne({ where: { codigo_dane: codigoMuni, activo: true }, transaction: tx, attributes: ['nombre_oficial'] })
        : Promise.resolve(null)
    ]);

    await PoblacionalMatriculado.update({
      codigo_departamento: codigoDepto,
      codigo_dane: codigoMuni,
      departamento: departamentoRef?.nombre_oficial || null,
      municipio: municipioRef?.nombre_oficial || null,
      match_confianza_ubicacion: codigoMuni ? 'manual_alta' : 'manual_media',
      match_metodo_ubicacion: action === 'manual_assign' ? 'manual_assign' : 'manual_apply_suggested',
      match_score_ubicacion: null,
      match_actualizado_en: new Date()
    }, { where: { id: incidencia.matriculado_id }, transaction: tx });

    await incidencia.update({
      codigo_departamento_sugerido: codigoDepto,
      codigo_municipio_sugerido: codigoMuni,
      estado: 'resuelto',
      confianza: codigoMuni ? 'manual_alta' : 'manual_media',
      metodo: action === 'manual_assign' ? 'manual_assign' : 'manual_apply_suggested',
      observacion: observacion || 'Resuelto manualmente',
      resuelto_por: req.user?.id || null
    }, { transaction: tx });

    await tx.commit();
    return res.json({ success: true, message: 'Incidencia resuelta correctamente' });
  } catch (error) {
    await tx.rollback();
    console.error('Error al resolver incidencia DIVIPOLA:', error);
    return res.status(500).json({ success: false, message: 'Error al resolver incidencia DIVIPOLA' });
  }
};

module.exports = {
  getEstadisticas,
  getMatriculadosIncidencias,
  getResumen,
  getCargues,
  createEstadistica,
  updateEstadistica,
  deleteEstadistica,
  downloadTemplate,
  downloadContextoExternoNormalizado,
  downloadCargueErrores,
  downloadCargueBase,
  getDivipolaIncidencias,
  resolveDivipolaIncidencia,
  importFromExcel,
  clearByCategoria,
  DATASET_CATEGORIES
};


