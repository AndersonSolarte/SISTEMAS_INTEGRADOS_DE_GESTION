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
  PoblacionalInfraestructuraFisica,
  PoblacionalEdificacionReferencia,
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
  RecursoHumanoOnda,
  InternacionalizacionMovilidad,
  InternacionalizacionConvenio,
  PlanAccion,
  Autoevaluacion,
  AutoevaluacionParticipante,
  AutoevaluacionPrograma,
  RegistroCalificadoHistorico,
  MacroProceso,
  Proceso,
  SubProceso,
  TipoDocumentacion,
  Documento
} = require('../models');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const fs = require('fs');
const mammoth = require('mammoth');
const path = require('path');
const readline = require('readline');
const divipolaMatchService = require('../services/divipolaMatchService');
const { generatePlanAccionBuffer } = require('../services/planAccionExportService');
const { generateActaBuffer } = require('../services/actaExportService');
const { suggestIndicators } = require('../services/geminiIndicatorService');
const { listEvidenceFilesRecursive } = require('../services/googleDriveEvidenceService');

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
  recursoHumanoConfig = null,
  internacionalizacionConfig = null
}) => {
  const where = { categoria };
  if (subcategoria) where.subcategoria = subcategoria;

  const deleted = await Estadistica.destroy({ where });
  const deletedLogs = await GestionInformacionCarga.destroy({ where });

  if (categoria === 'Poblacional') {
    clearAllPoblacionalCaches();
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

  if (categoria === DATASET_CATEGORIES.internacionalizacion) {
    if (internacionalizacionConfig?.model) {
      await internacionalizacionConfig.model.destroy({ where: {} });
    } else if (Array.isArray(internacionalizacionConfig?.configs)) {
      const legacySubcategorias = internacionalizacionConfig.configs.map((config) => config.label).filter(Boolean);
      if (legacySubcategorias.length) {
        await Promise.all([
          Estadistica.destroy({ where: { categoria, subcategoria: { [Op.in]: legacySubcategorias } } }),
          GestionInformacionCarga.destroy({ where: { categoria, subcategoria: { [Op.in]: legacySubcategorias } } })
        ]);
      }
      await Promise.all(internacionalizacionConfig.configs.map((config) => config.model.destroy({ where: {} })));
    } else if (!subcategoria) {
      await Promise.all([
        InternacionalizacionMovilidad.destroy({ where: {} }),
        InternacionalizacionConvenio.destroy({ where: {} })
      ]);
    }
  }

  if (categoria === 'Georreferencia') {
    await Promise.all([
      GeorreferenciaDepartamento.destroy({ where: {} }),
      GeorreferenciaMunicipio.destroy({ where: {} })
    ]);
  }

  if (categoria === 'Plan de Acción') {
    await ensurePlanAccionTable();
    await PlanAccion.destroy({ where: {} });
  }

  if (categoria === 'Infraestructura Física') {
    await PoblacionalInfraestructuraFisica.destroy({ where: {} });
  }

  if (categoria === 'Autoevaluación') {
    await ensureAutoevaluacionTable();
    const subKey = normalizeCategoryToken(subcategoria);
    if (subKey === 'participantes') {
      await AutoevaluacionParticipante.destroy({ where: {} });
    } else if (subKey === 'informacion_programas' || subKey === 'informacion_programa' || subKey === 'programas') {
      await AutoevaluacionPrograma.destroy({ where: {} });
    } else if (subKey === 'autoevaluacion') {
      await Autoevaluacion.destroy({ where: {} });
    } else {
      await Promise.all([
        Autoevaluacion.destroy({ where: {} }),
        AutoevaluacionParticipante.destroy({ where: {} }),
        AutoevaluacionPrograma.destroy({ where: {} })
      ]);
    }
  }

  if (categoria === 'Registros Calificados y Acreditación') {
    await ensureRegistrosCalificadosTable();
    const subKey = normalizeCategoryToken(subcategoria);
    if (!subcategoria || subKey === 'historico_rc') {
      await RegistroCalificadoHistorico.destroy({ where: {} });
    }
  }

  if (categoria === 'Gestión por Procesos') {
    await Documento.destroy({ where: {} });
  }

  return { deleted, deletedLogs };
};

const DATASET_CATEGORIES = {
  poblacional: 'Poblacional',
  georreferencia: 'Georreferencia',
  georeferencia: 'Georreferencia',
  biblioteca: 'Biblioteca',
  medios_educativos: 'Medios Educativos',
  internacionalizacion: 'Internacionalización',
  investigacion: 'InvestigaciÃƒÆ’Ã‚Â³n',
  proyectos_convenios: 'Proyectos y Convenios',
  recurso_humano: 'Recurso Humano',
  gestion_procesos: 'Gestión por Procesos',
  gestion_por_procesos: 'Gestión por Procesos',
  saber_pro: 'Saber Pro',
  plan_accion: 'Plan de Acción',
  autoevaluacion: 'Autoevaluación',
  registros_calificados_acreditacion: 'Registros Calificados y Acreditación',
  registros_calificados_y_acreditacion: 'Registros Calificados y Acreditación',
  registros_calificados: 'Registros Calificados y Acreditación',
  acreditacion: 'Registros Calificados y Acreditación',
  infraestructura_fisica: 'Infraestructura Física'
};

const GESTION_PROCESOS_CATEGORY = 'Gestión por Procesos';
const GESTION_PROCESOS_TEMPLATE_SHEETS = [
  {
    sheetName: 'BD_SGD_UNICESMAG',
    headers: [
      'MACROPROCESO',
      'PROCESO',
      'SUBPROCESO',
      'CODIGO',
      'TITULO_DOCUMENTO',
      'TIPO_DOCUMENTO',
      'VERSIÓN',
      'FECHA_CREACION',
      'REVISA',
      'APRUEBA',
      'FECHA_APROBACION',
      'AUTOR',
      'ESTADO',
      'LINK_ACCESO',
      'OBSERVACIONES'
    ]
  },
  {
    sheetName: 'POLÍTICAS',
    headers: [
      'MACROPROCESO',
      'PROCESO',
      'SUBPROCESO',
      'CODIGO',
      'TITULO_DOCUMENTO',
      'ACUERDO DE APROBACIÓN',
      'TIPO_DOCUMENTO',
      'VERSIÓN',
      'FECHA_CREACION',
      'REVISA',
      'APRUEBA',
      'FECHA_APROBACION',
      'AUTOR',
      'ESTADO',
      'LINK_ACCESO',
      'OBSERVACIONES'
    ]
  },
  {
    sheetName: 'PLANTILLAS',
    headers: [
      'MACROPROCESO',
      'PROCESO',
      'SUBPROCESO',
      'CODIGO',
      'TITULO_DOCUMENTO',
      'TIPO_DOCUMENTO',
      'VERSIÓN',
      'FECHA_CREACION',
      'REVISA',
      'APRUEBA',
      'FECHA_APROBACION',
      'AUTOR',
      'ESTADO',
      'LINK_ACCESO',
      'OBSERVACIONES'
    ]
  }
];

const AUTOEVALUACION_TEMPLATE_HEADERS = [
  'Acuerdo MEN',
  'PROGRAMA',
  'FACTOR',
  'CARACTERÍSTICA',
  'ASPECTOS POR EVALUAR',
  'INDICADOR',
  'Instrumento',
  'SCRIT',
  'Componente Programa / Institución',
  'Calificación Indicador',
  'Evidencias',
  'Información para tener en cuenta'
];

const AUTOEVALUACION_ESTRUCTURA_ROWS = [
  ['Acuerdo MEN', 'Acuerdo o referente normativo asociado al proceso de autoevaluación.'],
  ['PROGRAMA', 'Programa académico o dependencia que reporta la información.'],
  ['FACTOR', 'Factor de autoevaluación al que pertenece el indicador.'],
  ['CARACTERÍSTICA', 'Característica evaluada dentro del factor.'],
  ['ASPECTOS POR EVALUAR', 'Aspecto específico que será valorado.'],
  ['INDICADOR', 'Indicador cualitativo o cuantitativo del aspecto evaluado.'],
  ['Instrumento', 'Instrumento, fuente o mecanismo de medición.'],
  ['SCRIT', 'Criterio o código SCRIT asociado, si aplica.'],
  ['Componente Programa / Institución', 'Componente de análisis del indicador: programa, institución o ambos.'],
  ['Calificación Indicador', 'Calificación numérica del indicador, si aplica.'],
  ['Evidencias', 'Evidencias que soportan la valoración.'],
  ['Información para tener en cuenta', 'Notas, contexto o información complementaria.']
];

const AUTOEVALUACION_PARTICIPANTES_TEMPLATE_HEADERS = [
  'PROGRAMA',
  'ALCANCE AUTOEVALUACIÓN',
  'ACTA INICIO PROCESO DE AUTOEVALUACIÓN',
  'CRONOGRAMA DE AUTOEVALUACIÓN',
  'NOMBRES COMPLETOS',
  'DOCUMENTO',
  'CARGO',
  'ROL EN EL PROCESO'
];

const AUTOEVALUACION_PARTICIPANTES_ESTRUCTURA_ROWS = [
  ['PROGRAMA', 'Programa académico que adelanta el proceso de autoevaluación.'],
  ['ALCANCE AUTOEVALUACIÓN', 'Renovación Registro Calificado o Acreditación Alta Calidad.'],
  ['ACTA INICIO PROCESO DE AUTOEVALUACIÓN', 'Enlace al acta de inicio del proceso.'],
  ['CRONOGRAMA DE AUTOEVALUACIÓN', 'Enlace al cronograma de autoevaluación.'],
  ['NOMBRES COMPLETOS', 'Nombre completo del integrante del comité o equipo.'],
  ['DOCUMENTO', 'Número de documento del integrante.'],
  ['CARGO', 'Cargo institucional del integrante.'],
  ['ROL EN EL PROCESO', 'Rol que cumple dentro del proceso de autoevaluación.']
];

const AUTOEVALUACION_PROGRAMAS_TEMPLATE_HEADERS = [
  'PROGRAMA',
  'PROCESO AUTOEVALUACIÓN',
  'FACULTAD A LA QUE ESTÁ ADSCRITO',
  'NIVEL DE FORMACIÓN',
  'RENOVACIÓN REGISTRO CALIFICADO',
  'CÓDIGO SNIES',
  'TÍTULO QUE OTORGA',
  'E-MAIL DEL PROGRAMA',
  'DURACIÓN DE FORMACIÓN',
  'NÚMERO DE CRÉDITOS',
  'NÚMERO DE ESTUDIANTES A ADMITIR A PRIMER CURSO'
];

const AUTOEVALUACION_PROGRAMAS_ESTRUCTURA_ROWS = [
  ['PROGRAMA', 'Nombre oficial del programa académico.'],
  ['PROCESO AUTOEVALUACIÓN', 'Proceso al que pertenece la información: Renovación Registro Calificado, Acreditación Alta Calidad u otro.'],
  ['FACULTAD A LA QUE ESTÁ ADSCRITO', 'Facultad o unidad académica responsable del programa.'],
  ['NIVEL DE FORMACIÓN', 'Pregrado, especialización, maestría, doctorado u otro nivel.'],
  ['RENOVACIÓN REGISTRO CALIFICADO', 'Estado, fecha, resolución o información relacionada con la renovación del registro calificado.'],
  ['CÓDIGO SNIES', 'Código SNIES del programa.'],
  ['TÍTULO QUE OTORGA', 'Título académico otorgado al graduado.'],
  ['E-MAIL DEL PROGRAMA', 'Correo institucional del programa.'],
  ['DURACIÓN DE FORMACIÓN', 'Duración del programa en semestres, periodos o años.'],
  ['NÚMERO DE CRÉDITOS', 'Total de créditos académicos del programa.'],
  ['NÚMERO DE ESTUDIANTES A ADMITIR A PRIMER CURSO', 'Cupo o número de estudiantes a admitir en primer curso.']
];

const AUTOEVALUACION_ROW_ALIASES = {
  acuerdo_men: ['Acuerdo MEN'],
  programa: ['PROGRAMA', 'Programa'],
  factor: ['FACTOR', 'Factor'],
  caracteristica: ['CARACTERÍSTICA', 'CARACTERISTICA'],
  aspectos_por_evaluar: ['ASPECTOS POR EVALUAR', 'Aspectos por evaluar'],
  indicador: ['INDICADOR', 'Indicador'],
  instrumento: ['Instrumento', 'INSTRUMENTO'],
  scrit: ['SCRIT'],
  componente: ['Componente Programa / Institución', 'Componente Programa / Institucion', 'Componente ', 'Componente', 'COMPONENTE'],
  calificacion_indicador: ['Calificación Indicador', 'Calificacion Indicador', 'CALIFICACIÓN INDICADOR'],
  evidencias: ['Evidencias', 'EVIDENCIAS'],
  informacion_para_tener_en_cuenta: ['Información para tener en cuenta', 'Informacion para tener en cuenta']
};

const AUTOEVALUACION_PARTICIPANTE_ROW_ALIASES = {
  programa: ['PROGRAMA', 'Programa'],
  alcance_autoevaluacion: ['ALCANCE AUTOEVALUACIÓN', 'ALCANCE AUTOEVALUACION', 'Alcance de la autoevaluación'],
  acta_inicio_url: ['ACTA INICIO PROCESO DE AUTOEVALUACIÓN', 'ACTA INICIO PROCESO DE AUTOEVALUACION', 'Acta inicio proceso de autoevaluación'],
  cronograma_url: ['CRONOGRAMA DE AUTOEVALUACIÓN', 'CRONOGRAMA DE AUTOEVALUACION', 'Cronograma de Autoevaluación'],
  nombres_completos: ['NOMBRES COMPLETOS', 'Nombres Completos', 'Integrantes del Comité/equipo de Autoevaluación'],
  documento: ['DOCUMENTO', 'Documento'],
  cargo: ['CARGO', 'Cargo'],
  rol_en_proceso: ['ROL EN EL PROCESO', 'Rol en el proceso']
};

const AUTOEVALUACION_PROGRAMA_ROW_ALIASES = {
  programa: ['PROGRAMA', 'Nombre del Programa', 'Nombre del programa'],
  proceso_autoevaluacion: ['PROCESO AUTOEVALUACIÓN', 'PROCESO AUTOEVALUACION', 'Proceso de autoevaluación', 'Proceso autoevaluacion'],
  facultad: ['FACULTAD A LA QUE ESTÁ ADSCRITO', 'FACULTAD A LA QUE ESTA ADSCRITO', 'Facultad a la que está adscrito'],
  nivel_formacion: ['NIVEL DE FORMACIÓN', 'NIVEL DE FORMACION', 'Nivel de Formación'],
  renovacion_registro_calificado: ['RENOVACIÓN REGISTRO CALIFICADO', 'RENOVACION REGISTRO CALIFICADO', 'Renovación Registro Calificado'],
  codigo_snies: ['CÓDIGO SNIES', 'CODIGO SNIES', 'Código SNIES:', 'Código SNIES'],
  titulo_otorga: ['TÍTULO QUE OTORGA', 'TITULO QUE OTORGA', 'Título que Otorga'],
  email_programa: ['E-MAIL DEL PROGRAMA', 'EMAIL DEL PROGRAMA', 'E-mail del Programa'],
  duracion_formacion: ['DURACIÓN DE FORMACIÓN', 'DURACION DE FORMACION', 'Duración de Formación'],
  numero_creditos: ['NÚMERO DE CRÉDITOS', 'NUMERO DE CREDITOS', 'Número de Créditos'],
  estudiantes_primer_curso: ['NÚMERO DE ESTUDIANTES A ADMITIR A PRIMER CURSO', 'NUMERO DE ESTUDIANTES A ADMITIR A PRIMER CURSO', 'Número de estudiantes a admitir a primer curso']
};

const REGISTROS_CALIFICADOS_SUBBASE = 'Historico_RC';
const REGISTROS_CALIFICADOS_DRIVE_FOLDER_URL = process.env.REGISTROS_CALIFICADOS_DRIVE_FOLDER_URL
  || 'https://drive.google.com/drive/folders/12h5VJ5WW_egGAvKovaMBARMZjmZnZD_z?usp=drive_link';

const REGISTROS_CALIFICADOS_TEMPLATE_HEADERS = [
  'Programa académico',
  'Nivel',
  'Tipo aprobación',
  'Resolución MEN',
  'Fecha Resolución',
  'Resolucion RC',
  'Plan de Estudios',
  'Enlace'
];

const REGISTROS_CALIFICADOS_ESTRUCTURA_ROWS = [
  ['Programa académico', 'Nombre oficial del programa académico.'],
  ['Nivel', 'Nivel de formación: Pregrado, Especialización, Maestría, etc.'],
  ['Tipo aprobación', 'Otorgamiento, renovación u otro tipo de acto asociado al registro calificado o acreditación.'],
  ['Resolución MEN', 'Número de resolución del Ministerio de Educación Nacional.'],
  ['Fecha Resolución', 'Fecha de expedición de la resolución en formato dd/mm/aaaa.'],
  ['Resolucion RC', 'Nombre exacto del archivo de resolución que debe existir en la carpeta de Drive.'],
  ['Plan de Estudios', 'Nombre exacto del archivo de plan de estudios que debe existir en la carpeta de Drive.'],
  ['Enlace', 'URL de la carpeta de Google Drive donde se buscarán únicamente los archivos coincidentes.']
];

const REGISTROS_CALIFICADOS_ROW_ALIASES = {
  programa_academico: ['Programa académico', 'Programa academico', 'Programa', 'PROGRAMA'],
  nivel: ['Nivel', 'NIVEL'],
  tipo_aprobacion: ['Tipo aprobación', 'Tipo aprobacion', 'Tipo de aprobación', 'Tipo de aprobacion'],
  resolucion_men: ['Resolución MEN', 'Resolucion MEN', 'Res', 'Resolución', 'Resolucion'],
  fecha_resolucion: ['Fecha Resolución', 'Fecha Resolucion', 'Fecha'],
  resolucion_rc: ['Resolucion RC', 'Resolución RC'],
  plan_estudios: ['Plan de Estudios', 'Plan Estudios', 'Plan de estudio'],
  enlace: ['Enlace', 'Link', 'URL', 'Carpeta Drive']
};

const INFRAESTRUCTURA_FISICA_TEMPLATE_HEADERS = [
  'CAMPUS',
  'COMPONENTE',
  'TIPO DE ÁREA',
  'TENENCIA',
  'UBICACIÓN',
  'Nomenclatura',
  'PISO No.',
  'TIPO DE ESPACIO',
  'ASIGNACIÓN',
  'DESCRIPCION',
  'Función Específica',
  'CAPACIDAD FÍSICA',
  'ÁREA (Metros2)',
  'Fecha Actualización',
  'Acceso Autónomo'
];

const pickInfraestructuraCell = (row = {}, aliases = []) => {
  const normalizedRow = Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [normalizeHeader(key), value])
  );
  for (const alias of aliases) {
    const value = normalizedRow[normalizeHeader(alias)];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
};

const toNullableInteger = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
};

const toSafeNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || String(value).trim() === '') return fallback;
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const PLAN_ACCION_TEMPLATE_HEADERS = [
  'AÑO',
  'PED',
  'OBJETIVOS ESTRATÉGICOS',
  'LINEAMIENTOS ESTRATÉGICOS',
  'MACROACTIVIDADES ESTRATEGICAS',
  'ACTIVIDADES',
  'TIPO DE INDICADOR',
  'FECHA INICIO',
  'FECHA FIN',
  'INDICADOR',
  'META',
  'RESPONSABLE DE EJECUCIÓN',
  'CORRESPONSABLE',
  'PORCENTAJE AVANCE IP',
  'OBSERVACIONES IP',
  'PORCENTAJE AVANCE IIP',
  'OBSERVACIONES IIP',
  'TOTAL EJECUCION'
];

const PLAN_ACCION_ESTRUCTURA_ROWS = [
  ['AÑO', 'Año de vigencia del plan (numérico, ej. 2026).'],
  ['PED', 'Plan Estratégico de Desarrollo al que pertenece la actividad.'],
  ['OBJETIVOS ESTRATÉGICOS', 'Objetivo estratégico institucional asociado.'],
  ['LINEAMIENTOS ESTRATÉGICOS', 'Lineamiento estratégico derivado del objetivo.'],
  ['MACROACTIVIDADES ESTRATEGICAS', 'Macroactividad estratégica del lineamiento.'],
  ['ACTIVIDADES', 'Actividad operativa concreta a ejecutar.'],
  ['TIPO DE INDICADOR', 'Tipo de indicador (Gestión / Resultado / Impacto / etc.).'],
  ['FECHA INICIO', 'Fecha planeada de inicio (dd/mm/aaaa).'],
  ['FECHA FIN', 'Fecha planeada de cierre (dd/mm/aaaa).'],
  ['INDICADOR', 'Nombre o fórmula del indicador.'],
  ['META', 'Meta cuantitativa o cualitativa planteada.'],
  ['RESPONSABLE DE EJECUCIÓN', 'Dependencia o cargo responsable principal.'],
  ['CORRESPONSABLE', 'Dependencia o cargo corresponsable (opcional).'],
  ['PORCENTAJE AVANCE IP', 'Avance reportado en el primer periodo (0-100).'],
  ['OBSERVACIONES IP', 'Observaciones cualitativas del primer periodo.'],
  ['PORCENTAJE AVANCE IIP', 'Avance reportado en el segundo periodo (0-100).'],
  ['OBSERVACIONES IIP', 'Observaciones cualitativas del segundo periodo.'],
  ['TOTAL EJECUCION', 'Porcentaje total de ejecución anual (0-100).']
];

const PLAN_ACCION_ROW_ALIASES = {
  anio: ['AÑO', 'ANIO', 'ANO', 'AÃ‘O'],
  ped: ['PED'],
  objetivo_estrategico: ['OBJETIVOS ESTRATÉGICOS', 'OBJETIVO ESTRATEGICO', 'OBJETIVOS ESTRATEGICOS'],
  lineamiento_estrategico: ['LINEAMIENTOS ESTRATÉGICOS', 'LINEAMIENTO ESTRATEGICO', 'LINEAMIENTOS ESTRATEGICOS'],
  macroactividad: ['MACROACTIVIDADES ESTRATEGICAS', 'MACROACTIVIDAD'],
  actividad: ['ACTIVIDADES', 'ACTIVIDAD'],
  tipo_indicador: ['TIPO DE INDICADOR'],
  fecha_inicio: ['FECHA INICIO', 'FECHA DE INICIO'],
  fecha_fin: ['FECHA FIN', 'FECHA DE FIN', 'FECHA FINAL'],
  indicador: ['INDICADOR'],
  meta: ['META'],
  responsable: ['RESPONSABLE DE EJECUCIÓN', 'RESPONSABLE DE EJECUCION', 'RESPONSABLE'],
  corresponsable: ['CORRESPONSABLE'],
  avance_ip: ['PORCENTAJE AVANCE IP', '% AVANCE IP', 'AVANCE IP'],
  observaciones_ip: ['OBSERVACIONES IP'],
  avance_iip: ['PORCENTAJE AVANCE IIP', '% AVANCE IIP', 'AVANCE IIP'],
  observaciones_iip: ['OBSERVACIONES IIP'],
  total_ejecucion: ['TOTAL EJECUCION', 'TOTAL EJECUCIÓN', '% EJECUCION', 'EJECUCION TOTAL']
};

const normalizeHeaderKey = (value = '') =>
  stripDiacritics(String(value || ''))
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

const pickPlanAccionCell = (row = {}, field) => {
  const aliases = PLAN_ACCION_ROW_ALIASES[field] || [];
  const keys = Object.keys(row);
  const normalizedRow = keys.reduce((acc, key) => {
    acc[normalizeHeaderKey(key)] = row[key];
    return acc;
  }, {});
  for (const alias of aliases) {
    const key = normalizeHeaderKey(alias);
    if (normalizedRow[key] !== undefined && normalizedRow[key] !== null && String(normalizedRow[key]).trim() !== '') {
      return normalizedRow[key];
    }
  }
  return null;
};

const pickAutoevaluacionCell = (row = {}, field) => {
  const aliases = AUTOEVALUACION_ROW_ALIASES[field] || [];
  const keys = Object.keys(row);
  const normalizedRow = keys.reduce((acc, key) => {
    acc[normalizeHeaderKey(key)] = row[key];
    return acc;
  }, {});
  for (const alias of aliases) {
    const key = normalizeHeaderKey(alias);
    if (normalizedRow[key] !== undefined && normalizedRow[key] !== null && String(normalizedRow[key]).trim() !== '') {
      return normalizedRow[key];
    }
  }
  return null;
};

const pickAutoevaluacionParticipanteCell = (row = {}, field) => {
  const aliases = AUTOEVALUACION_PARTICIPANTE_ROW_ALIASES[field] || [];
  const keys = Object.keys(row);
  const normalizedRow = keys.reduce((acc, key) => {
    acc[normalizeHeaderKey(key)] = row[key];
    return acc;
  }, {});
  for (const alias of aliases) {
    const key = normalizeHeaderKey(alias);
    if (normalizedRow[key] !== undefined && normalizedRow[key] !== null && String(normalizedRow[key]).trim() !== '') {
      return normalizedRow[key];
    }
  }
  return null;
};

const pickAutoevaluacionProgramaCell = (row = {}, field) => {
  const aliases = AUTOEVALUACION_PROGRAMA_ROW_ALIASES[field] || [];
  const keys = Object.keys(row);
  const normalizedRow = keys.reduce((acc, key) => {
    acc[normalizeHeaderKey(key)] = row[key];
    return acc;
  }, {});
  for (const alias of aliases) {
    const key = normalizeHeaderKey(alias);
    if (normalizedRow[key] !== undefined && normalizedRow[key] !== null && String(normalizedRow[key]).trim() !== '') {
      return normalizedRow[key];
    }
  }
  return null;
};

const pickRegistroCalificadoCell = (row = {}, field) => {
  const aliases = REGISTROS_CALIFICADOS_ROW_ALIASES[field] || [];
  const keys = Object.keys(row);
  const normalizedRow = keys.reduce((acc, key) => {
    acc[normalizeHeaderKey(key)] = row[key];
    return acc;
  }, {});
  for (const alias of aliases) {
    const key = normalizeHeaderKey(alias);
    if (normalizedRow[key] !== undefined && normalizedRow[key] !== null && String(normalizedRow[key]).trim() !== '') {
      return normalizedRow[key];
    }
  }
  return null;
};

const mapAutoevaluacionRow = (row) => ({
  acuerdo_men: normalizeText(pickAutoevaluacionCell(row, 'acuerdo_men')),
  programa: normalizeText(pickAutoevaluacionCell(row, 'programa')),
  factor: normalizeText(pickAutoevaluacionCell(row, 'factor')),
  caracteristica: normalizeText(pickAutoevaluacionCell(row, 'caracteristica')),
  aspectos_por_evaluar: normalizeText(pickAutoevaluacionCell(row, 'aspectos_por_evaluar')),
  indicador: normalizeText(pickAutoevaluacionCell(row, 'indicador')),
  instrumento: normalizeText(pickAutoevaluacionCell(row, 'instrumento')),
  scrit: normalizeText(pickAutoevaluacionCell(row, 'scrit')),
  componente: normalizeText(pickAutoevaluacionCell(row, 'componente')),
  calificacion_indicador: parsePlanAccionPorcentaje(pickAutoevaluacionCell(row, 'calificacion_indicador')),
  evidencias: normalizeText(pickAutoevaluacionCell(row, 'evidencias')),
  informacion_para_tener_en_cuenta: normalizeText(pickAutoevaluacionCell(row, 'informacion_para_tener_en_cuenta')),
  raw_data: row
});

const normalizeAutoevaluacionAlcance = (value) => {
  const text = normalizeText(value);
  if (!text) return null;
  const key = stripDiacritics(text).toUpperCase();
  if (key.includes('ACREDITACION')) return 'ACREDITACIÓN ALTA CALIDAD';
  if (key.includes('RENOVACION') || key.includes('REGISTRO')) return 'RENOVACIÓN REGISTRO CALIFICADO';
  return text;
};

const mapAutoevaluacionParticipanteRow = (row) => ({
  programa: normalizeText(pickAutoevaluacionParticipanteCell(row, 'programa')),
  alcance_autoevaluacion: normalizeAutoevaluacionAlcance(pickAutoevaluacionParticipanteCell(row, 'alcance_autoevaluacion')),
  acta_inicio_url: normalizeText(pickAutoevaluacionParticipanteCell(row, 'acta_inicio_url')),
  cronograma_url: normalizeText(pickAutoevaluacionParticipanteCell(row, 'cronograma_url')),
  nombres_completos: normalizeText(pickAutoevaluacionParticipanteCell(row, 'nombres_completos')),
  documento: normalizeText(pickAutoevaluacionParticipanteCell(row, 'documento')),
  cargo: normalizeText(pickAutoevaluacionParticipanteCell(row, 'cargo')),
  rol_en_proceso: normalizeText(pickAutoevaluacionParticipanteCell(row, 'rol_en_proceso')),
  raw_data: row
});

const mapAutoevaluacionProgramaRow = (row) => ({
  programa: normalizeText(pickAutoevaluacionProgramaCell(row, 'programa')),
  proceso_autoevaluacion: normalizeAutoevaluacionAlcance(pickAutoevaluacionProgramaCell(row, 'proceso_autoevaluacion')) || normalizeText(pickAutoevaluacionProgramaCell(row, 'proceso_autoevaluacion')),
  facultad: normalizeText(pickAutoevaluacionProgramaCell(row, 'facultad')),
  nivel_formacion: normalizeText(pickAutoevaluacionProgramaCell(row, 'nivel_formacion')),
  renovacion_registro_calificado: normalizeText(pickAutoevaluacionProgramaCell(row, 'renovacion_registro_calificado')),
  codigo_snies: normalizeText(pickAutoevaluacionProgramaCell(row, 'codigo_snies')),
  titulo_otorga: normalizeText(pickAutoevaluacionProgramaCell(row, 'titulo_otorga')),
  email_programa: normalizeText(pickAutoevaluacionProgramaCell(row, 'email_programa')),
  duracion_formacion: normalizeText(pickAutoevaluacionProgramaCell(row, 'duracion_formacion')),
  numero_creditos: normalizeText(pickAutoevaluacionProgramaCell(row, 'numero_creditos')),
  estudiantes_primer_curso: normalizeText(pickAutoevaluacionProgramaCell(row, 'estudiantes_primer_curso')),
  raw_data: row
});

const parseRegistroCalificadoDate = (value) => {
  const numericText = String(value ?? '').trim().replace(',', '.');
  const numeric = Number(numericText);
  if (Number.isFinite(numeric) && numeric > 20000 && numeric < 90000) {
    const parsed = XLSX.SSF.parse_date_code(numeric);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return `${String(parsed.y).padStart(4, '0')}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }
  const parsed = parseExcelDateString(value);
  const text = String(parsed || '').trim();
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return parsed;
};

const normalizeRegistroCalificadoDateForView = (value) => {
  const text = String(value || '').trim();
  const year = Number((text.match(/^(\d{4,5})-/) || [])[1]);
  if (year > 3000 && year < 90000) {
    return parseRegistroCalificadoDate(String(year));
  }
  return text || null;
};

const mapRegistroCalificadoRow = (row) => ({
  programa_academico: normalizeText(pickRegistroCalificadoCell(row, 'programa_academico')),
  nivel: normalizeText(pickRegistroCalificadoCell(row, 'nivel')),
  tipo_aprobacion: normalizeText(pickRegistroCalificadoCell(row, 'tipo_aprobacion')),
  resolucion_men: normalizeText(pickRegistroCalificadoCell(row, 'resolucion_men')),
  fecha_resolucion: parseRegistroCalificadoDate(pickRegistroCalificadoCell(row, 'fecha_resolucion')),
  resolucion_rc: normalizeText(pickRegistroCalificadoCell(row, 'resolucion_rc')),
  plan_estudios: normalizeText(pickRegistroCalificadoCell(row, 'plan_estudios')),
  enlace: normalizeText(pickRegistroCalificadoCell(row, 'enlace')),
  raw_data: row
});

const buildValidDateOnly = (year, month, day) => {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const candidate = new Date(Date.UTC(y, m - 1, d));
  if (
    candidate.getUTCFullYear() !== y
    || candidate.getUTCMonth() !== (m - 1)
    || candidate.getUTCDate() !== d
  ) {
    return null;
  }
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

const parsePlanAccionFecha = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value) && value > 20000 && value < 90000) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return buildValidDateOnly(parsed.y, parsed.m, parsed.d);
    }
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return buildValidDateOnly(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  const text = String(value).trim();
  if (!text) return null;
  const dmy = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    let y = dmy[3];
    if (y.length === 2) y = (Number(y) < 70 ? '20' : '19') + y;
    return buildValidDateOnly(y, dmy[2], dmy[1]);
  }
  const ymd = text.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (ymd) {
    return buildValidDateOnly(ymd[1], ymd[2], ymd[3]);
  }
  const iso = new Date(text);
  if (!Number.isNaN(iso.getTime())) {
    return buildValidDateOnly(iso.getUTCFullYear(), iso.getUTCMonth() + 1, iso.getUTCDate());
  }
  return null;
};

const parsePlanAccionPorcentaje = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value > 0 && value <= 1 ? Number((value * 100).toFixed(2)) : Number(value.toFixed(2));
  }
  const text = String(value).replace('%', '').replace(',', '.').trim();
  if (!text) return null;
  const numeric = Number(text);
  if (!Number.isFinite(numeric)) return null;
  return numeric > 0 && numeric <= 1 ? Number((numeric * 100).toFixed(2)) : Number(numeric.toFixed(2));
};

const mapPlanAccionRow = (row) => ({
  anio: parseAnio(pickPlanAccionCell(row, 'anio')),
  ped: normalizeText(pickPlanAccionCell(row, 'ped')),
  objetivo_estrategico: normalizeText(pickPlanAccionCell(row, 'objetivo_estrategico')),
  lineamiento_estrategico: normalizeText(pickPlanAccionCell(row, 'lineamiento_estrategico')),
  macroactividad: normalizeText(pickPlanAccionCell(row, 'macroactividad')),
  actividad: normalizeText(pickPlanAccionCell(row, 'actividad')),
  tipo_indicador: normalizeText(pickPlanAccionCell(row, 'tipo_indicador')),
  fecha_inicio: parsePlanAccionFecha(pickPlanAccionCell(row, 'fecha_inicio')),
  fecha_fin: parsePlanAccionFecha(pickPlanAccionCell(row, 'fecha_fin')),
  indicador: normalizeText(pickPlanAccionCell(row, 'indicador')),
  meta: normalizeText(pickPlanAccionCell(row, 'meta')),
  responsable: normalizeText(pickPlanAccionCell(row, 'responsable')),
  corresponsable: normalizeText(pickPlanAccionCell(row, 'corresponsable')),
  avance_ip: parsePlanAccionPorcentaje(pickPlanAccionCell(row, 'avance_ip')),
  observaciones_ip: normalizeText(pickPlanAccionCell(row, 'observaciones_ip')),
  avance_iip: parsePlanAccionPorcentaje(pickPlanAccionCell(row, 'avance_iip')),
  observaciones_iip: normalizeText(pickPlanAccionCell(row, 'observaciones_iip')),
  total_ejecucion: parsePlanAccionPorcentaje(pickPlanAccionCell(row, 'total_ejecucion'))
});

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
  Inscritos: ['AÑO', 'IES', 'DOCUMENTO', 'ID TIPO DOCUMENTO', 'PRIMER NOMBRE', 'SEGUNDO NOMBRE', 'PRIMER APELLIDO', 'SEGUNDO APELLIDO', 'PROGRAMA', 'GENERO BIOLOGICO', 'CONTEO', 'PERIODO', 'FACULTAD'],
  Admitidos: ['AÑO', 'NOMBRE IES', 'PROGRAMA', 'TIPO DOCUMENTO', 'NUMERO DOCUMENTO', 'GENERO BIOLOGICO', 'CONTEO', 'PERIODO', 'FACULTAD'],
  'Primer Curso': ['AÑO', 'NOMBRE IES', 'TIPO DOCUMENTO', 'NUMERO DOCUMENTO', 'PRIMER NOMBRE', 'SEGUNDO NOMBRE', 'PRIMER APELLIDO', 'SEGUNDO APELLIDO', 'PROGRAMA', 'GRUPO ETNICO', 'PUEBLO INDIGENA', 'COMUNIDAD NEGRA', 'CAPACIDAD EXCEPCIONAL', 'GENERO BIOLOGICO', 'CONTEO', 'PERIODO', 'FACULTAD'],
  Matriculados: [
    'AÑO',
    'NOMBRE IES',
    'TIPO DOCUMENTO',
    'NUMERO DOCUMENTO',
    'CODIGO ESTUDIANTE',
    'SEXO BIOLOGICO',
    'PRIMER NOMBRE',
    'SEGUNDO NOMBRE',
    'PRIMER APELLIDO',
    'SEGUNDO APELLIDO',
    'PROGRAMA',
    'FECHA NACIMIENTO',
    'EDAD',
    'PAIS',
    'DEPARTAMENTO NACIMIENTO',
    'MUNICIPIO NACIMIENTO',
    'ES_REINTEGRO_ESTD_ANTES_DE1998',
    'ESTRATO',
    'PERIODO',
    'FACULTAD'
  ],
  Graduados: ['AÑO', 'NOMBRE IES', 'TIPO DOCUMENTO', 'NUMERO DOCUMENTO', 'PRIMER NOMBRE', 'SEGUNDO NOMBRE', 'PRIMER APELLIDO', 'SEGUNDO APELLIDO', 'PROGRAMA', 'DEPARTAMENTO', 'MUNICIPIO', 'No ACTA GRADO', 'FECHA GRADO', 'FOLIO', 'VERIFICADO', 'GENERO BIOLOGICO', 'PERIODO', 'FACULTAD'],
  Caracterizacion: ['AÑO', 'PERIODO', 'No IDENTIFICACION', 'TIPO DOCUMENTACION', 'PROGRAMA', 'CODIGO', 'SEMESTRE', 'APELLIDOS NOMBRES', 'GENERO', 'VICTIMA DE CONFLICTO ARMADO', 'CORREO ELECTRONICO', 'PERSONAS A CARGO', 'ESTADO CIVIL', 'GRUPO ETNICO', 'EPS', 'MUNICIPIO_RESIDENCIA', 'DEPARTAMENTO_RESIDENCIA', 'PAIS_RESIDENCIA', 'DISCAPACIDAD', 'NUCLEO_FAMILIAR', 'ESTRATO', 'ingresos_familiares', 'INGRESOS_FAMILIARES', 'institucion', 'titulo_obtenido', 'TIPO_CREDITO', 'Edad', 'Zona procedencia'],
  'Cantidad Total Egresados': ['AÑOS', 'PROGRAMA', 'CANTIDAD', 'DETALLE'],
  'Desercion por periodo': ['PERIODO', 'DESERCION', 'DESERCION_NACIONAL', 'DESERCION_DEPARTAMENTAL', 'DESERCION_INSTITUCIONAL', 'DESERCION_DEL_PROGRAMA', 'PROGRAMA'],
  'Desercion por cohorte': ['PERIODOS', 'DESERCION', 'CORTE_INFORMACION', 'DESERCION_NACIONAL', 'DESERCION_DEPARTAMENTAL', 'DESERCION_INSTITUCIONAL', 'DESERCION_DEL_PROGRAMA', 'PROGRAMAS'],
  'Desercion anual': ['PERIODOS', 'DESERCION', 'DESERCION_NACIONAL', 'DESERCION_DEPARTAMENTAL', 'DESERCION_INSTITUCIONAL', 'DESERCION_DEL_PROGRAMA', 'PROGRAMAS'],
  Empleabilidad: ['AÑO', 'IES', 'EMPLEABILIDAD_PROGRAMA', 'EMPLEABILIDAD_NACIONAL', 'DENOMINACION_PROGRAMA']
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
  Docentes: ['AÑO', 'Identificación', 'DOCENTE', 'GENERO BIÓLOGICO', 'DEPARTAMENTO/DEPENDENCIA', 'PROGRAMA', 'NIVEL_CONTRATACIÓN', 'TIPOVINCULACIÓN', 'CONTRATO', 'HORAS INDIRECTAS', '% HORAS INDIRECTAS', 'Horas Administrativas', '% Horas Administrativas', 'Horas Investigación', '% Horas Investigación', 'Horas Proyección Institucional', '% Horas Proyección Institucional', 'Horas Academicas', '% Horas Academicas', 'Horas Aseguramiento de la Calidad', '% Horas Aseguramiento de la Calidad', 'Total Horas', 'PORCENTAJE TOTAL', 'FECHA_NACIMIENTO', 'EDAD', 'PAIS', 'MUNICIPIO_NACIMIENTO', 'NIVEL MAXIMO ESTUDIO', 'TITULO RECIBIDO', 'FECHA GRADO', 'PAIS INSTITUCION ESTUDIO', 'TITULO CONVALIDADO', 'NOMBRE INSTITUCION ESTUDIO', 'METODOLOGIA PROGRAMA', 'FECHA INGRESO', 'TOTAL TIEMPO', 'Total docentes', 'ESCALAFÓN', 'CARGO', 'PERIODO'],
  Administrativos: ['PERIODO', 'Nº Cédula', 'Activo /Retirado', 'Nombre Empleado', 'Cargo Especifico', 'Dependencia', 'GRADO', 'Vicerectoria', 'Tipo de cotizante', 'Clase de Contrato', 'FECHA INICIO', 'FECHA DE TERMINACION', 'Sueldo año 2023', 'Auxilio Transporte 2023', 'Dias Trabajados Septiembre 2023', 'Sueldo Mes Septiembre 2023', 'Dias Auxilio Transporte', 'Auxilio Transporte', 'CORTE INFORMACIÓN', 'GENERO BIÓLOGICO', 'AÑO'],
  Outsourcing: ['AÑO', 'CARGO', 'GENERO BIÓLOGICO', 'CANTIDAD'],
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

const streamExcelXlsxFile = async ({ filePath, onSheet }) => {
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    entries: 'emit',
    sharedStrings: 'cache',
    worksheets: 'emit'
  });

  for await (const worksheetReader of workbookReader) {
    const sheetName = worksheetReader.name;
    const matrix = [];
    for await (const row of worksheetReader) {
      const cells = (row.values || []).slice(1).map((val) => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') {
          if (val.result !== undefined) return String(val.result ?? '').trim();
          if (val.text !== undefined) return String(val.text ?? '').trim();
          if (val.richText) return val.richText.map((t) => t.text).join('').trim();
        }
        return String(val ?? '').trim();
      });
      matrix.push(cells);
    }
    if (matrix.length > 0) {
      await onSheet({ sheetName, matrix });
    }
  }
};

const POBLACIONAL_SUBCATEGORY_CONFIG = {
  INSCRITOS: {
    label: 'Inscritos',
    model: PoblacionalInscrito,
    headers: POBLACIONAL_TEMPLATE_HEADERS.Inscritos,
    map: {
      anio: ['AÑO', 'AÃƒÆ’Ã¢â‚¬ËœO', 'ANO', 'ANIO', 'aÃƒÆ’Ã‚Â±o', 'anio'],
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
      anio: ['AÑO', 'AÃƒÆ’Ã¢â‚¬ËœO', 'ANO', 'ANIO', 'aÃƒÆ’Ã‚Â±o', 'anio'],
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
      anio: ['AÑO', 'AÃƒÆ’Ã¢â‚¬ËœO', 'ANO', 'ANIO', 'aÃƒÆ’Ã‚Â±o', 'anio'],
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
    uniqueKeys: [],
    map: {
      anio: ['AÑO', 'ANO'],
      nombre_ies: ['NOMBRE IES'],
      tipo_documento: ['TIPO DOCUMENTO'],
      numero_documento: ['NUMERO DOCUMENTO'],
      codigo_estudiante: ['CODIGO ESTUDIANTE'],
      sexo_biologico: ['SEXO BIOLOGICO'],
      primer_nombre: ['PRIMER NOMBRE'],
      segundo_nombre: ['SEGUNDO NOMBRE'],
      primer_apellido: ['PRIMER APELLIDO'],
      segundo_apellido: ['SEGUNDO APELLIDO'],
      programa: ['PROGRAMA'],
      fecha_nacimiento: ['FECHA NACIMIENTO'],
      edad: ['EDAD'],
      pais: ['PAIS'],
      departamento_nacimiento: ['DEPARTAMENTO NACIMIENTO'],
      municipio_nacimiento: ['MUNICIPIO NACIMIENTO'],
      es_reintegro_estd_antes_de1998: ['ES_REINTEGRO_ESTD_ANTES_DE1998'],
      estrato: ['ESTRATO'],
      semestre: ['PERIODO', 'SEMESTRE'],
      facultad: ['FACULTAD']
    }
  },
  GRADUADOS: {
    label: 'Graduados',
    model: PoblacionalGraduado,
    headers: POBLACIONAL_TEMPLATE_HEADERS.Graduados,
    map: {
      anio: ['AÑO', 'AÃƒÆ’Ã¢â‚¬ËœO', 'ANO', 'ANIO', 'aÃƒÆ’Ã‚Â±o', 'anio'],
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
      anio: ['AÑO', 'AÃƒÆ’Ã¢â‚¬ËœO', 'ANO', 'ANIO', 'PERIODO'],
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
      anio: ['AÑOS', 'AÑO', 'AÃƒÆ’Ã¢â‚¬ËœOS', 'AÃƒÆ’Ã¢â‚¬ËœOS ', 'ANOS', 'AÃƒÆ’Ã¢â‚¬ËœO', 'ANO', 'ANIO'],
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
        desercion_departamental: ['DESERCION_DEPARTAMENTAL', 'DESERCIÃƒÆ’Ã¢â‚¬Å“N_DEPARTAMETAL', 'DESERCION_DEPARTAMETAL'],
        desercion_institucional: ['DESERCIÃƒÆ’Ã¢â‚¬Å“N_INSTITUCIONAL', 'DESERCION_INSTITUCIONAL'],
        desercion_programa: ['DESERCIÃƒÆ’Ã¢â‚¬Å“N_DEL_PROGRAMA', 'DESERCION_DEL_PROGRAMA'],
        programa: ['PROGRAMA']
      },
      cohorte: {
        periodo_referencia: ['PERIODOS'],
        tipo_desercion: ['DESERCION'],
        corte_informacion: ['CORTE_INFORMACION'],
        desercion_nacional: ['DESERCIÃƒÆ’Ã¢â‚¬Å“N_NACIONAL', 'DESERCION_NACIONAL'],
        desercion_departamental: ['DESERCION_DEPARTAMENTAL', 'DESERCIÃƒÆ’Ã¢â‚¬Å“N_DEPARTAMETAL', 'DESERCION_DEPARTAMETAL'],
        desercion_institucional: ['DESERCIÃƒÆ’Ã¢â‚¬Å“N_INSTITUCIONAL', 'DESERCION_INSTITUCIONAL'],
        desercion_programa: ['DESERCIÃƒÆ’Ã¢â‚¬Å“N_DEL_PROGRAMA', 'DESERCION_DEL_PROGRAMA'],
        programa: ['PROGRAMAS', 'PROGRAMA']
      },
      anual: {
        periodo_referencia: ['PERIODOS', 'PERIODO'],
        tipo_desercion: ['DESERCION'],
        desercion_nacional: ['DESERCION_NACIONAL', 'DESERCIÃƒÆ’Ã¢â‚¬Å“N_NACIONAL'],
        desercion_departamental: ['DESERCION_DEPARTAMENTAL', 'DESERCION_DEPARTAMETAL', 'DESERCIÃƒÆ’Ã¢â‚¬Å“N_DEPARTAMETAL'],
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
      anio: ['AÑO', 'AÃƒÆ’Ã¢â‚¬ËœO', 'ANO', 'ANIO'],
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

const isAutoevaluacionRole = (req) => String(req.user?.role || '').trim() === 'autoevaluacion';

const enforceAutoevaluacionDatasetScope = (req, res, categoria) => {
  if (
    !isAutoevaluacionRole(req)
    || categoria === 'Autoevaluación'
    || categoria === 'Registros Calificados y Acreditación'
  ) return true;
  res.status(403).json({
    success: false,
    message: 'El usuario de Autoevaluación solo puede gestionar Autoevaluación y Registros Calificados/Acreditación'
  });
  return false;
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
  const slot = /\b(2|3|II|IIP)\b/i.test(normalizedPeriodo) ? '2' : '1'; // SNIES: 3=segundo período
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
  const parseExcelSerialYear = (serial) => {
    if (!Number.isFinite(serial) || serial <= 20000 || serial >= 90000) return null;
    const parsedDate = XLSX.SSF.parse_date_code(serial);
    const year = Number(parsedDate?.y);
    return Number.isFinite(year) && year >= 1900 && year <= 2200 ? year : null;
  };
  if (typeof value === 'number') {
    if (Number.isFinite(value) && value >= 1900 && value <= 2200) return Math.trunc(value);
    return parseExcelSerialYear(value);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getFullYear();

  const text = String(value).trim();
  if (!text) return null;
  const match = text.match(/\b(19|20)\d{2}\b/);
  if (match) return Number(match[0]);
  const shortDateMatch = text.match(/\b\d{1,2}[/-]\d{1,2}[/-](\d{2})\b/);
  if (shortDateMatch) {
    const yy = Number(shortDateMatch[1]);
    return yy >= 50 ? 1900 + yy : 2000 + yy;
  }
  const asNumber = Number(text.replace(',', '.'));
  if (Number.isFinite(asNumber) && asNumber >= 1900 && asNumber <= 2200) return Math.trunc(asNumber);
  const serialYear = parseExcelSerialYear(asNumber);
  if (serialYear) return serialYear;
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
    dependencyColumn: 'facultad',
    genderColumn: 'genero_biologico'
  },
  Admitidos: {
    table: 'poblacional_admitidos',
    docColumn: 'numero_documento',
    sourcePeriodColumn: 'periodo',
    programColumn: 'programa',
    dependencyColumn: 'facultad',
    genderColumn: 'genero_biologico'
  },
  'Primer Curso': {
    table: 'poblacional_primer_curso',
    docColumn: 'numero_documento',
    sourcePeriodColumn: 'periodo',
    programColumn: 'programa',
    dependencyColumn: 'facultad',
    genderColumn: 'genero_biologico'
  },
  Matriculados: {
    table: 'poblacional_matriculados',
    docColumn: 'codigo_estudiante',
    sourcePeriodColumn: 'semestre',
    programColumn: 'programa',
    dependencyColumn: 'departamento',
    minValidYear: 2000,
    genderColumn: 'sexo_biologico'
  },
  Graduados: {
    table: 'poblacional_graduados',
    docColumn: 'numero_documento',
    sourcePeriodColumn: 'periodo',
    programColumn: 'programa',
    dependencyColumn: 'facultad',
    genderColumn: 'genero_biologico'
  }
};

const normalizeProgramAggregateKey = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const hasAggregateAccents = (value = '') => /[ÁÉÍÓÚáéíóúÑñÜü]/.test(String(value || ''));

const selectPreferredAggregateLabel = (current = '', incoming = '') => {
  const currentClean = String(current || '').replace(/\s+/g, ' ').trim();
  const incomingClean = String(incoming || '').replace(/\s+/g, ' ').trim();
  if (!currentClean) return incomingClean;
  if (!incomingClean) return currentClean;
  if (hasAggregateAccents(incomingClean) && !hasAggregateAccents(currentClean)) return incomingClean;
  if (!hasAggregateAccents(incomingClean) && hasAggregateAccents(currentClean)) return currentClean;
  return incomingClean.length > currentClean.length ? incomingClean : currentClean;
};

const poblacionalSeriesCache = new Map();
const POBLACIONAL_SERIES_CACHE_TTL_MS = 15 * 60 * 1000;

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

  const cacheKey = JSON.stringify({
    parsedSubcategorias,
    queryFilters,
    recentYearsNum,
    maxClosedYear
  });
  const now = Date.now();
  const cached = poblacionalSeriesCache.get(cacheKey);
  if (cached && (now - cached.ts) < POBLACIONAL_SERIES_CACHE_TTL_MS) {
    return cached.payload;
  }

  const replacements = {};
  const commonFilters = [];
  const maxYear = Number(maxClosedYear);
  if (Number.isFinite(maxYear) && maxYear > 0) {
    commonFilters.push('anio <= :maxClosedYear');
    replacements.maxClosedYear = maxYear;
  }

  if (Number.isFinite(recentYearsNum) && recentYearsNum > 0) {
    const referenceYear = Number.isFinite(maxYear) && maxYear > 0 ? maxYear : new Date().getFullYear();
    replacements.minYear = referenceYear - Math.trunc(recentYearsNum) + 1;
    commonFilters.push('anio >= :minYear');
  }

  const normalizedYearFilter = String(queryFilters.anio ?? '').trim();
  if (normalizedYearFilter !== '' && Number.isFinite(Number(normalizedYearFilter))) {
    replacements.filterYear = Number(normalizedYearFilter);
    commonFilters.push('anio = :filterYear');
  }

  if (queryFilters.programa) {
    replacements.filterPrograma = `%${String(queryFilters.programa).trim()}%`;
  }

  if (queryFilters.dependencia) {
    replacements.filterDependencia = `%${String(queryFilters.dependencia).trim()}%`;
  }

  if (queryFilters.search) {
    replacements.filterSearch = `%${String(queryFilters.search).trim()}%`;
  }

  const sql = selectedConfigs.map(({ subcategoria, config }) => {
    const itemFilters = [...commonFilters];
    if (Number.isFinite(Number(config.minValidYear))) {
      itemFilters.push(`anio >= ${Number(config.minValidYear)}`);
    }
    if (queryFilters.programa) {
      itemFilters.push(`${config.programColumn} ILIKE :filterPrograma`);
    }
    if (queryFilters.dependencia) {
      itemFilters.push(`${config.dependencyColumn} ILIKE :filterDependencia`);
    }
    if (queryFilters.search) {
      itemFilters.push(`(
        ${config.programColumn} ILIKE :filterSearch
        or ${config.dependencyColumn} ILIKE :filterSearch
        or ${config.docColumn} ILIKE :filterSearch
        or coalesce(${config.sourcePeriodColumn}, '') ILIKE :filterSearch
      )`);
    }
    const whereClause = itemFilters.length ? `where ${itemFilters.join(' and ')}` : '';
    const genderSelectExpr = config.genderColumn ? `coalesce(nullif(btrim(${config.genderColumn}), ''), 'MASCULINO')` : "'MASCULINO'";
    const genderGroupExpr = config.genderColumn ? `, coalesce(nullif(btrim(${config.genderColumn}), ''), 'MASCULINO')` : '';

    return `
      select
        '${subcategoria}' as subcategoria,
        anio,
        nullif(btrim(${config.programColumn}), '') as programa,
        nullif(btrim(${config.dependencyColumn}), '') as dependencia,
        btrim(coalesce(${config.sourcePeriodColumn}, '')) as periodo_normalizado,
        ${genderSelectExpr} as sexo_biologico,
        count(*) as total_count
      from ${config.table}
      ${whereClause}
      group by
        anio,
        nullif(btrim(${config.programColumn}), ''),
        nullif(btrim(${config.dependencyColumn}), ''),
        btrim(coalesce(${config.sourcePeriodColumn}, ''))${genderGroupExpr}
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
    const genderKey = String(row.sexo_biologico || 'MASCULINO').trim().toUpperCase();
    const count = Number(row.total_count || 1);
    const bucketKey = [
      row.subcategoria,
      Number(row.anio) || 0,
      row.periodo_normalizado || '',
      programKey,
      dependencyKey,
      genderKey
    ].join('||');

    const current = buckets.get(bucketKey) || {
      categoria: 'Poblacional',
      subcategoria: row.subcategoria,
      anio: Number(row.anio) || 0,
      programa: row.programa || null,
      dependencia: row.dependencia || null,
      indicador: row.subcategoria,
      unidad: 'registros',
      fuente: null,
      observaciones: row.periodo_normalizado ? `periodo: ${row.periodo_normalizado}` : null,
      sexo_biologico: genderKey,
      uniqueCount: 0
    };

    current.programa = selectPreferredAggregateLabel(current.programa, row.programa || '');
    current.dependencia = selectPreferredAggregateLabel(current.dependencia, row.dependencia || '');
    current.uniqueCount += count;
    buckets.set(bucketKey, current);
  });

  const payload = Array.from(buckets.values())
    .map((row) => ({
      categoria: row.categoria,
      subcategoria: row.subcategoria,
      anio: row.anio,
      programa: row.programa,
      dependencia: row.dependencia,
      indicador: row.indicador,
      valor: row.uniqueCount,
      unidad: row.unidad,
      fuente: row.fuente,
      observaciones: row.observaciones,
      sexo_biologico: row.sexo_biologico || null
    }))
    .sort((a, b) =>
      (a.anio - b.anio)
      || String(a.subcategoria || '').localeCompare(String(b.subcategoria || ''), 'es')
      || String(a.programa || '').localeCompare(String(b.programa || ''), 'es')
      || String(a.observaciones || '').localeCompare(String(b.observaciones || ''), 'es')
    );

  poblacionalSeriesCache.set(cacheKey, { ts: now, payload });
  return payload;
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
      anio: ['AÑO', 'AÃƒÆ’Ã¢â‚¬ËœO', 'ANO', 'ANIO'],
      identificacion: ['Identificación', 'IdentificaciÃƒÆ’Ã‚Â³n', 'IDENTIFICACION'],
      docente: ['DOCENTE'],
      genero_biologico: ['GENERO BIÓLOGICO', 'GENERO BIÃƒÆ’Ã¢â‚¬Å“LOGICO', 'GENERO BIOLOGICO'],
      departamento_dependencia: ['DEPARTAMENTO/DEPENDENCIA', 'DEPARTAMENTO DEPENDENCIA'],
      programa: ['PROGRAMA'],
      nivel_contratacion: ['NIVEL_CONTRATACIÓN', 'NIVEL CONTRATACIÓN', 'NIVEL_CONTRATACION', 'NIVEL CONTRATACION'],
      tipo_vinculacion: ['TIPOVINCULACIÓN', 'TIPOVINCULACIÃƒÆ’Ã¢â‚¬Å“N', 'TIPOVINCULACION', 'TIPO VINCULACION'],
      contrato: ['CONTRATO'],
      total_horas: ['Total Horas'],
      fecha_nacimiento: ['FECHA_NACIMIENTO', 'FECHA NACIMIENTO'],
      edad: ['EDAD'],
      fecha_ingreso: ['FECHA INGRESO'],
      total_docentes: ['Total docentes', 'TOTAL DOCENTES'],
      escalafon: ['ESCALAFÓN', 'ESCALAFÃƒÆ’Ã¢â‚¬Å“N', 'ESCALAFON'],
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
      numero_cedula: ['Nº Cédula', 'NÃƒâ€šÃ‚Âº CÃƒÆ’Ã‚Â©dula', 'No Cedula', 'NÃƒâ€šÃ‚Â° CÃƒÆ’Ã‚Â©dula', 'CEDULA'],
      estado_laboral: ['Activo /Retirado', 'ACTIVO /RETIRADO'],
      nombre_empleado: ['Nombre Empleado'],
      cargo_especifico: ['Cargo Especifico'],
      dependencia: ['Dependencia'],
      vicerectoria: ['Vicerectoria', 'Vicerrectoria'],
      tipo_cotizante: ['Tipo de cotizante'],
      clase_contrato: ['Clase de Contrato'],
      fecha_inicio: ['FECHA INICIO'],
      fecha_terminacion: ['FECHA DE TERMINACION'],
      sueldo_anual: ['Sueldo año 2023', 'Sueldo aÃƒÆ’Ã‚Â±o 2023', 'Sueldo ano 2023'],
      sueldo_mes: ['Sueldo Mes Septiembre 2023'],
      genero_biologico: ['GENERO BIÓLOGICO', 'GENERO BIÃƒÆ’Ã¢â‚¬Å“LOGICO', 'GENERO BIOLOGICO'],
      anio: ['AÑO', 'AÃƒÆ’Ã¢â‚¬ËœO', 'ANO', 'ANIO']
    }
  },
  OUTSOURCING: {
    key: 'OUTSOURCING',
    label: 'Outsourcing',
    model: RecursoHumanoOutsourcing,
    sheetNames: ['OUTSOURCING'],
    headers: RECURSO_HUMANO_TEMPLATE_HEADERS.Outsourcing,
    map: {
      anio: ['AÑO', 'AÃƒÆ’Ã¢â‚¬ËœO', 'ANO', 'ANIO'],
      cargo: ['CARGO'],
      genero_biologico: ['GENERO BIÓLOGICO', 'GENERO BIÃƒÆ’Ã¢â‚¬Å“LOGICO', 'GENERO BIOLOGICO'],
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

const INTERNACIONALIZACION_TEMPLATE_HEADERS = {
  Movilidad: [
    'PERIODO',
    'PROGRAMA O DEPENDENCIA',
    'TIPO PERSONA',
    'ALCANCE MOVILIDAD',
    'DIRECCION MOVILIDAD',
    'ACTIVIDAD MOVILIDAD',
    'DESCRIPCION',
    'TIPO DOCUMENTO',
    'NUMERO DOCUMENTO',
    'PRIMER NOMBRE',
    'SEGUNDO NOMBRE',
    'PRIMER APELLIDO',
    'SEGUNDO APELLIDO',
    'PAIS EXTRANJERO',
    'ESTADO PROVINCIA O DEPARTAMENTO',
    'CIUDAD O MUNICIPIO',
    'INSTITUCION EXTRANJERA',
    'TIPO MOVILIDAD',
    'NUMERO DIAS MOVILIDAD',
    'MOVILIDAD POR CONVENIO',
    'CODIGO CONVENIO',
    'FUENTE FINANCIACION NACIONAL',
    'VALOR FINANCIACION NACIONAL',
    'FUENTE FINANCIACION INTERNACIONAL',
    'PAIS FINANCIADOR',
    'VALOR FINANCIACION INTERNACIONAL',
    'FINANCIACION UNICESMAG',
    'VALOR FINANCIACION UNICESMAG',
    'FECHA SALIDA',
    'FECHA RETORNO',
    'MODALIDAD',
    'RESULTADO MOVILIDAD'
  ],
  'Convenios Internacionalizacion': [
    'ANIO',
    'CONVENIO ENTIDAD',
    'TIPO CONVENIO',
    'PROGRAMA GESTOR',
    'OBJETO CONVENIO',
    'FECHA INICIO',
    'FECHA TERMINACION',
    'LINK ANEXO'
  ]
};

const INTERNACIONALIZACION_ESTRUCTURA_ROWS = [
  ['ALCANCE MOVILIDAD', 'Reemplaza "NACIONAL O INTERNACIONAL". Use valores como Nacional o Internacional.'],
  ['DIRECCION MOVILIDAD', 'Reemplaza "TIPO MOVILIDAD ENTRANTE O SALIENTE". Use Entrante o Saliente.'],
  ['PAIS EXTRANJERO', 'Reemplaza el encabezado largo de pais extranjero para movilidad internacional.'],
  ['INSTITUCION EXTRANJERA', 'Reemplaza el encabezado largo de institucion extranjera para movilidad internacional.'],
  ['NUMERO DIAS MOVILIDAD', 'Reemplaza "NUM DIAS MOVILIDAD" para mantener una lectura consistente.'],
  ['VALOR FINANCIACION UNICESMAG', 'Aclara el valor asociado a FINANCIACION UNICESMAG y evita duplicar "VALOR FINANCIACION".'],
  ['ANIO', 'Reemplaza "AÑO" para evitar problemas de codificacion en cargues CSV/Excel.']
];

const INTERNACIONALIZACION_SUBBASE_LABEL = 'Internacionalización';

const INTERNACIONALIZACION_SUBCATEGORY_CONFIG = {
  MOVILIDAD: {
    key: 'MOVILIDAD',
    label: 'Movilidad',
    model: InternacionalizacionMovilidad,
    sheetNames: ['MOVILIDAD'],
    headers: INTERNACIONALIZACION_TEMPLATE_HEADERS.Movilidad,
    map: {
      periodo: ['PERIODO'],
      programa_dependencia: ['PROGRAMA O DEPENDENCIA', 'PROGRAMA Y/O DEPENDENCIA', 'PROGRAMA DEPENDENCIA'],
      tipo_persona: ['TIPO PERSONA', 'TIPO DE PERSONA'],
      alcance_movilidad: ['ALCANCE MOVILIDAD', 'NACIONAL O INTERNACIONAL'],
      direccion_movilidad: ['DIRECCION MOVILIDAD', 'TIPO MOVILIDAD ENTRANTE O SALIENTE'],
      actividad_movilidad: ['ACTIVIDAD MOVILIDAD', 'ACTIVIDAD DE MOVILIDAD'],
      descripcion: ['DESCRIPCION', 'DESCRIPCIÓN'],
      tipo_documento: ['TIPO DOCUMENTO'],
      numero_documento: ['NUMERO DOCUMENTO', 'Nº DOCUMENTO', 'N DOCUMENTO', 'NO DOCUMENTO'],
      primer_nombre: ['PRIMER NOMBRE'],
      segundo_nombre: ['SEGUNDO NOMBRE'],
      primer_apellido: ['PRIMER APELLIDO'],
      segundo_apellido: ['SEGUNDO APELLIDO'],
      pais_extranjero: ['PAIS EXTRANJERO', 'PAIS EXTRANJERO SI ES MOVILIDAD INTERNACIONAL INGRESE EL PAIS', 'PAIS EXTRANJERO (Si es Movilidad Internacional Ingrese el Pais)'],
      estado_provincia_departamento: ['ESTADO PROVINCIA O DEPARTAMENTO', 'ESTADO PROVICIA O DEPARTAMENTO', 'ESTADO, PROVICIA O DEPARTAMENTO'],
      ciudad_municipio: ['CIUDAD O MUNICIPIO'],
      institucion_extranjera: ['INSTITUCION EXTRANJERA', 'INSTITUCIÓN EXTRANJERA', 'INSTITUCION EXTRANJERA SI ES MOVILIDAD INTERNACIONAL INGRESE EL INSTITUCION', 'INSTITUCIÓN EXTRANJERA  (Si es Movilidad Internacional Ingrese el Institución)'],
      tipo_movilidad: ['TIPO MOVILIDAD'],
      num_dias_movilidad: ['NUMERO DIAS MOVILIDAD', 'NUM DIAS MOVILIDAD'],
      movilidad_por_convenio: ['MOVILIDAD POR CONVENIO'],
      codigo_convenio: ['CODIGO CONVENIO', 'CÓDIGO CONVENIO'],
      fuente_financiacion_nacional: ['FUENTE FINANCIACION NACIONAL', 'FUENTE FINANCIACIÓN NACIONAL'],
      valor_financiacion_nacional: ['VALOR FINANCIACION NACIONAL', 'VALOR FINANCIACIÓN NACIONAL'],
      fuente_financiacion_internacional: ['FUENTE FINANCIACION INTERNACIONAL', 'FUENTE FINANCIACIÓN INTERNACIONAL'],
      pais_financiador: ['PAIS FINANCIADOR', 'PAÍS FINANCIADOR'],
      valor_financiacion_internacional: ['VALOR FINANCIACION INTERNACIONAL', 'VALOR FINANCIACIÓN INTERNACIONAL'],
      financiacion_unicesmag: ['FINANCIACION UNICESMAG', 'FINANCIACIÓN UNICESMAG'],
      valor_financiacion_unicesmag: ['VALOR FINANCIACION UNICESMAG', 'VALOR FINANCIACION', 'VALOR FINANCIACIÓN'],
      fecha_salida: ['FECHA SALIDA'],
      fecha_retorno: ['FECHA RETORNO'],
      modalidad: ['MODALIDAD'],
      resultado_movilidad: ['RESULTADO MOVILIDAD', 'RESULTADO DE MOVILIDAD']
    }
  },
  CONVENIOS_INTERNACIONALIZACION: {
    key: 'CONVENIOS_INTERNACIONALIZACION',
    label: 'Convenios Internacionalizacion',
    model: InternacionalizacionConvenio,
    sheetNames: ['CONVENIOS', 'CONVENIOS INTERNACIONALIZACION', 'CONVENIOS INTERNACIONALIZACIÓN'],
    headers: INTERNACIONALIZACION_TEMPLATE_HEADERS['Convenios Internacionalizacion'],
    map: {
      anio: ['ANIO', 'AÑO', 'ANO'],
      convenio_entidad: ['CONVENIO ENTIDAD'],
      tipo_convenio: ['TIPO CONVENIO', 'TIPO DE CONVENIO'],
      programa_gestor: ['PROGRAMA GESTOR'],
      objeto_convenio: ['OBJETO CONVENIO', 'OBJETO DEL CONVENIO'],
      fecha_inicio: ['FECHA INICIO'],
      fecha_terminacion: ['FECHA TERMINACION', 'FECHA TERMINACIÓN'],
      link_anexo: ['LINK ANEXO']
    }
  }
};

const resolveInternacionalizacionConfig = (subcategoria = '') => {
  const key = normalizeHeader(subcategoria);
  if (!key) return null;
  if (key === normalizeHeader(INTERNACIONALIZACION_SUBBASE_LABEL) || key === 'INTERNACIONALIZACION_COMPLETA') {
    return {
      key: 'INTERNACIONALIZACION',
      label: INTERNACIONALIZACION_SUBBASE_LABEL,
      configs: Object.values(INTERNACIONALIZACION_SUBCATEGORY_CONFIG)
    };
  }
  return INTERNACIONALIZACION_SUBCATEGORY_CONFIG[key] || null;
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

const CONTEXTO_EXTERNO_USER_TEMPLATE_BASE_HEADERS = [
  'CÓDIGO_INSTITUCIÓN_PADRE',
  'CÓDIGO_INSTITUCIÓN',
  'Institución de Educación Superior (IES)',
  'Principal o Seccional',
  'ID Sector IES',
  'Sector IES',
  'IES Acreditada',
  'ID Caracter',
  'Caracter IES',
  'Código del departamento (IES)',
  'Departamento de domicilio de la IES',
  'Código del Municipio (IES)',
  'Municipio de domicilio de la IES',
  'Código SNIES del programa',
  'Programa Académico',
  'Programa Acreditado',
  'ID Nivel Académico',
  'Nivel Académico',
  'ID Nivel de Formación',
  'Nivel de Formación',
  'ID Metodología',
  'Metodología',
  'ID Área',
  'Área de Conocimiento',
  'Id_Nucleo',
  'Núcleo Básico del Conocimiento (NBC)',
  'ID CINE CAMPO AMPLIO',
  'DESC CINE CAMPO AMPLIO',
  'ID CINE CAMPO ESPECIFICO',
  'DESC CINE CAMPO ESPECIFICO',
  'ID CINE CODIGO DETALLADO',
  'DESC CINE CODIGO DETALLADO',
  'Código del Departamento (Programa)',
  'Departamento de oferta del programa',
  'Código del Municipio (Programa)',
  'Municipio de oferta del programa',
  'ID Sexo',
  'Sexo',
  'Año',
  'Semestre'
];

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
  ...CONTEXTO_EXTERNO_USER_TEMPLATE_BASE_HEADERS,
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
    'TIPO_CUBRIMIENTO',
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
  if (/\b(2|3|II|IIP)\b/.test(text)) return '2'; // SNIES: 3 = segundo período
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

const parseDateOnlyOrNull = (value) => {
  const parsed = parseExcelDateString(value);
  if (!parsed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(parsed)) return parsed;
  const date = new Date(parsed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const toDbText = (value, maxLength = null) => {
  const text = normalizeText(value);
  if (!text) return '';
  if (!maxLength || text.length <= maxLength) return text;
  return text.slice(0, maxLength);
};

const normalizeAcademicPeriodo = (value, fallbackAnio = null) => {
  if (value === null || value === undefined || value === '') return '';

  const fromDateParts = (year, month) => {
    if (!Number.isFinite(year) || !Number.isFinite(month)) return '';
    return month <= 6 ? 'IP' : 'IIP';
  };

  if (typeof value === 'number' && Number.isFinite(value) && value > 20000 && value < 90000) {
    const parsed = XLSX.SSF.parse_date_code(value);
    return fromDateParts(Number(parsed?.y), Number(parsed?.m));
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return fromDateParts(value.getFullYear(), value.getMonth() + 1);
  }

  const text = normalizeText(value);
  const upper = text.toUpperCase();
  const numeric = Number(text.replace(',', '.'));
  if (Number.isFinite(numeric) && numeric > 20000 && numeric < 90000) {
    const parsed = XLSX.SSF.parse_date_code(numeric);
    return fromDateParts(Number(parsed?.y), Number(parsed?.m));
  }

  if (/\b(IIP|II|2)\b/.test(upper)) return 'IIP';
  if (/\b(IP|I|1)\b/.test(upper)) return 'IP';

  const dateMatch = upper.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (dateMatch) {
    return fromDateParts(Number(dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]), Number(dateMatch[2]));
  }

  if (fallbackAnio && /\b(19|20)\d{2}\b/.test(upper)) return '';
  return toDbText(text, 40);
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

const CARACTERIZACION_DASHBOARD_CACHE_TTL_MS = 60 * 1000;
const caracterizacionDashboardCache = new Map();
const CARACTERIZACION_CATALOG_CACHE_TTL_MS = 15 * 60 * 1000;
let caracterizacionCatalogCache = null;
let caracterizacionActiveLoadScopeCache = null;

const getCaracterizacionDashboardCache = (key) => {
  const cached = caracterizacionDashboardCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.createdAt > CARACTERIZACION_DASHBOARD_CACHE_TTL_MS) {
    caracterizacionDashboardCache.delete(key);
    return null;
  }
  return cached.data;
};

const setCaracterizacionDashboardCache = (key, data) => {
  if (caracterizacionDashboardCache.size >= 60) {
    const oldestKey = caracterizacionDashboardCache.keys().next().value;
    if (oldestKey) caracterizacionDashboardCache.delete(oldestKey);
  }
  caracterizacionDashboardCache.set(key, { createdAt: Date.now(), data });
};

const clearCaracterizacionCaches = () => {
  caracterizacionDashboardCache.clear();
  caracterizacionCatalogCache = null;
  caracterizacionActiveLoadScopeCache = null;
};

const getCaracterizacionActiveLoadScope = async () => {
  const now = Date.now();
  if (
    caracterizacionActiveLoadScopeCache
    && (now - caracterizacionActiveLoadScopeCache.createdAt) < CARACTERIZACION_DASHBOARD_CACHE_TTL_MS
  ) {
    return caracterizacionActiveLoadScopeCache.data;
  }

  const latestLoads = await PoblacionalCaracterizacion.sequelize.query(`
    SELECT total_cargados
    FROM gestion_informacion_cargas
    WHERE categoria = 'Poblacional'
      AND subcategoria = 'Caracterizacion'
      AND estado IN ('exitoso', 'parcial')
      AND total_cargados > 0
    ORDER BY id DESC
    LIMIT 1
  `, { type: QueryTypes.SELECT });
  const latestLoadSize = Number(latestLoads[0]?.total_cargados || 0);
  if (!latestLoadSize) {
    const data = { minId: null, totalCargados: 0 };
    caracterizacionActiveLoadScopeCache = { createdAt: now, data };
    return data;
  }

  const thresholdRows = await PoblacionalCaracterizacion.sequelize.query(`
    SELECT MIN(id)::integer AS min_id
    FROM (
      SELECT id
      FROM poblacional_caracterizacion
      ORDER BY id DESC
      LIMIT :latestLoadSize
    ) latest_rows
  `, { replacements: { latestLoadSize }, type: QueryTypes.SELECT });
  const data = {
    minId: Number(thresholdRows[0]?.min_id || 0) || null,
    totalCargados: latestLoadSize
  };
  caracterizacionActiveLoadScopeCache = { createdAt: now, data };
  return data;
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

const parseDateText = (text) => {
  const clean = String(text || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  const match = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (match) {
    let [, p1, p2, y] = match;
    const year = y.length === 2 ? `20${y}` : y;
    let day = parseInt(p1, 10);
    let month = parseInt(p2, 10);

    if (day <= 12 && month > 12) {
      const temp = day;
      day = month;
      month = temp;
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return null;
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

const normalizeGestionProcesosEstado = (value) => {
  const estado = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (['activo', 'activos', 'activa', 'activas', 'vigente', 'vigentes'].includes(estado)) return 'vigente';
  if (['revision', 'en revision', 'en_revision', 'pendiente aprobacion', 'pendiente de aprobacion'].includes(estado)) return 'en_revision';
  return 'obsoleto';
};

const gestionProcesosDateToISO = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed?.y || !parsed?.m || !parsed?.d) return null;
    return `${String(parsed.y).padStart(4, '0')}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  const text = normalizeText(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, d, m, y] = slashMatch;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const dashMatch = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, d, m, y] = dashMatch;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const parsedDate = new Date(text);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString().slice(0, 10);
};

const GESTION_PROCESOS_HEADER_ALIASES = {
  macroproceso: 'macro_proceso',
  macro_proceso: 'macro_proceso',
  proceso: 'proceso',
  subproceso: 'subproceso',
  codigo: 'codigo',
  titulo_documento: 'titulo',
  titulo: 'titulo',
  acuerdo_de_aprobacion: 'acuerdo_aprobacion',
  tipo_documento: 'tipo_documentacion',
  tipo_documentacion: 'tipo_documentacion',
  version: 'version',
  fecha_creacion: 'fecha_creacion',
  revisa: 'revisa',
  aprueba: 'aprueba',
  fecha_aprobacion: 'fecha_aprobacion',
  autor: 'autor',
  estado: 'estado',
  link_acceso: 'link_acceso',
  observaciones: 'observaciones'
};

const mapGestionProcesosRow = (row = {}) => {
  const mapped = {};
  Object.entries(row).forEach(([key, value]) => {
    const normalized = normalizeCategoryToken(key);
    const target = GESTION_PROCESOS_HEADER_ALIASES[normalized] || normalized;
    mapped[target] = value;
  });
  return mapped;
};

const getGestionProcesosDocumentKey = (codigo, version) =>
  `${normalizeText(codigo) || ''}::${normalizeText(version) || ''}`;

const buildGestionProcesosDocumentBuckets = async () => {
  const buckets = new Map();
  const documents = await Documento.findAll({ order: [['id', 'ASC']] });
  documents.forEach((doc) => {
    const key = getGestionProcesosDocumentKey(doc.codigo, doc.version);
    if (key.startsWith('::')) return;
    const bucket = buckets.get(key) || [];
    bucket.push(doc);
    buckets.set(key, bucket);
  });
  return buckets;
};

const importGestionProcesosFromWorkbook = async ({ workbook, fileName, userId }) => {
  const workbookSheetsByKey = Object.fromEntries(
    (workbook.SheetNames || []).map((name) => [normalizeCategoryToken(name), name])
  );
  const result = { total: 0, importados: 0, actualizados: 0, errores: [], hojasProcesadas: [] };
  const existingDocumentBuckets = await buildGestionProcesosDocumentBuckets();
  const occurrenceIndexes = new Map();

  for (const template of GESTION_PROCESOS_TEMPLATE_SHEETS) {
    const matchedSheetName = workbookSheetsByKey[normalizeCategoryToken(template.sheetName)];
    if (!matchedSheetName) {
      result.errores.push({ hoja: template.sheetName, fila: 1, error: `No se encontro la hoja ${template.sheetName}` });
      continue;
    }

    const worksheet = workbook.Sheets[matchedSheetName];
    const { rows, headerRowIndex } = matrixToRows(worksheet, template.headers, true);
    result.total += rows.length;
    const sheetResult = { hoja: matchedSheetName, total: rows.length, importados: 0, actualizados: 0, errores: [] };

    for (let i = 0; i < rows.length; i += 1) {
      const rawRow = rows[i];
      const row = mapGestionProcesosRow(rawRow);
      const fila = headerRowIndex + i + 2;

      try {
        const codigo = toDbText(row.codigo, 50);
        const titulo = toDbText(row.titulo, 300);
        if (!codigo && !titulo) {
          sheetResult.errores.push({ fila, error: 'Faltan campos requeridos: CODIGO o TITULO_DOCUMENTO' });
          continue;
        }

        const macroNombre = toDbText(row.macro_proceso, 255) || 'SIN DEFINIR';
        const procesoNombre = toDbText(row.proceso, 255) || 'SIN DEFINIR';
        const subprocesoNombre = toDbText(row.subproceso, 255) || 'SIN DEFINIR';
        const tipoNombre = toDbText(row.tipo_documentacion, 200) || 'SIN TIPO';
        const codigoFinal = codigo || `SIN-CODIGO-${fila}`;
        const tituloFinal = titulo || codigoFinal;

        const [macroProceso] = await MacroProceso.findOrCreate({
          where: { nombre: macroNombre },
          defaults: { nombre: macroNombre }
        });
        const [proceso] = await Proceso.findOrCreate({
          where: { nombre: procesoNombre, macro_proceso_id: macroProceso.id },
          defaults: { nombre: procesoNombre, macro_proceso_id: macroProceso.id }
        });
        const [subproceso] = await SubProceso.findOrCreate({
          where: { nombre: subprocesoNombre, proceso_id: proceso.id },
          defaults: { nombre: subprocesoNombre, proceso_id: proceso.id }
        });
        const [tipoDoc] = await TipoDocumentacion.findOrCreate({
          where: { nombre: tipoNombre },
          defaults: { nombre: tipoNombre }
        });

        const documentoData = {
          subproceso_id: subproceso.id,
          tipo_documentacion_id: tipoDoc.id,
          macroproceso: macroNombre,
          proceso_texto: procesoNombre,
          subproceso_texto: subprocesoNombre,
          tipo_documento: tipoNombre,
          codigo: codigoFinal,
          titulo: tituloFinal,
          version: toDbText(row.version, 20),
          fecha_creacion: gestionProcesosDateToISO(row.fecha_creacion),
          revisa: toDbText(row.revisa, 200),
          aprueba: toDbText(row.aprueba, 200),
          fecha_aprobacion: gestionProcesosDateToISO(row.fecha_aprobacion),
          autor: toDbText(row.autor, 200),
          estado: normalizeGestionProcesosEstado(row.estado),
          link_acceso: toDbText(row.link_acceso),
          observaciones: toDbText(row.observaciones),
          orden_origen: result.total - rows.length + i + 1,
          fila_origen: fila,
          datos_originales: { hoja: matchedSheetName, ...rawRow }
        };

        const documentKey = getGestionProcesosDocumentKey(documentoData.codigo, documentoData.version);
        const occurrenceIndex = occurrenceIndexes.get(documentKey) || 0;
        occurrenceIndexes.set(documentKey, occurrenceIndex + 1);
        const existente = existingDocumentBuckets.get(documentKey)?.[occurrenceIndex] || null;

        if (existente) {
          await existente.update(documentoData);
          result.actualizados += 1;
          sheetResult.actualizados += 1;
        } else {
          const nuevoDocumento = await Documento.create(documentoData);
          const bucket = existingDocumentBuckets.get(documentKey) || [];
          bucket.push(nuevoDocumento);
          existingDocumentBuckets.set(documentKey, bucket);
          result.importados += 1;
          sheetResult.importados += 1;
        }
      } catch (error) {
        sheetResult.errores.push({ fila, error: error.message });
      }
    }

    result.errores.push(...sheetResult.errores.map((error) => ({ hoja: matchedSheetName, ...error })));
    result.hojasProcesadas.push(sheetResult);
  }

  const totalProcesados = Number(result.importados || 0) + Number(result.actualizados || 0);
  const porcentaje = result.total > 0 ? Number(((totalProcesados / result.total) * 100).toFixed(2)) : 0;
  await GestionInformacionCarga.create({
    categoria: GESTION_PROCESOS_CATEGORY,
    subcategoria: 'Base documental',
    variable: 'Documentos SGC',
    archivo_nombre: fileName || null,
    total_plantilla: result.total,
    total_cargados: totalProcesados,
    total_omitidos: Number(result.errores.length || 0),
    porcentaje_cargado: porcentaje,
    estado: porcentaje === 100 ? 'exitoso' : (totalProcesados > 0 ? 'parcial' : 'fallido'),
    detalle: result.errores.length ? JSON.stringify(result.errores.slice(0, 50)) : null,
    creado_por: userId || null
  });

  return result;
};

const resolveDefaultImportSheetName = (workbook, categoria) => {
  const sheetNames = Array.isArray(workbook?.SheetNames) ? workbook.SheetNames : [];
  if (!sheetNames.length) return null;

  const validSheetNames = sheetNames.filter((name) => {
    const sheet = workbook?.Sheets?.[name];
    return Boolean(sheet && sheet['!ref']);
  });

  if (!validSheetNames.length) return null;

  if (categoria === 'Plan de Acción') {
    const exactPlanSheet = validSheetNames.find((name) => normalizeHeader(name) === 'PLAN DE ACCION');
    if (exactPlanSheet) return exactPlanSheet;
  }

  const firstDataSheet = validSheetNames.find((name) => !normalizeHeader(name).includes('ESTRUCTURA'));
  return firstDataSheet || validSheetNames[0];
};

let georreferenciaSyncPromise = null;
let planAccionSyncPromise = null;
let autoevaluacionSyncPromise = null;
let registrosCalificadosSyncPromise = null;

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

const ensurePlanAccionTable = async () => {
  if (!planAccionSyncPromise) {
    planAccionSyncPromise = PlanAccion.sync().catch((error) => {
      planAccionSyncPromise = null;
      throw error;
    });
  }
  return planAccionSyncPromise;
};

const ensureAutoevaluacionTable = async () => {
  if (!autoevaluacionSyncPromise) {
    autoevaluacionSyncPromise = Promise.all([
      Autoevaluacion.sync(),
      AutoevaluacionParticipante.sync(),
      AutoevaluacionPrograma.sync()
    ]).catch((error) => {
      autoevaluacionSyncPromise = null;
      throw error;
    });
  }
  return autoevaluacionSyncPromise;
};

const ensureRegistrosCalificadosTable = async () => {
  if (!registrosCalificadosSyncPromise) {
    registrosCalificadosSyncPromise = RegistroCalificadoHistorico.sync().catch((error) => {
      registrosCalificadosSyncPromise = null;
      throw error;
    });
  }
  return registrosCalificadosSyncPromise;
};

const parseAutoevaluacionPrefix = (value = '', fallbackPrefix = '') => {
  const text = String(value || '').trim();
  const match = text.match(/^([A-Z]+)\s*0*([0-9]+)/i);
  if (!match) return { code: null, number: null, label: text };
  return {
    code: `${match[1].toUpperCase()}${Number(match[2])}`,
    number: Number(match[2]),
    label: text.replace(/^[A-Z]+\s*0*[0-9]+\.?\s*/i, '').trim() || `${fallbackPrefix}${Number(match[2])}`
  };
};

const getAutoevaluacionJudgement = (value) => {
  const score = Number(value);
  if (!Number.isFinite(score)) return { label: 'SIN CALIFICAR', tone: '#64748b' };
  if (score >= 4.6) return { label: 'SE CUMPLE PLENAMENTE', tone: '#047857' };
  if (score >= 4.0) return { label: 'SE CUMPLE EN ALTO GRADO', tone: '#2563eb' };
  if (score >= 3.0) return { label: 'SE CUMPLE ACEPTABLEMENTE', tone: '#d97706' };
  if (score >= 2.0) return { label: 'SE CUMPLE INSATISFACTORIAMENTE', tone: '#dc2626' };
  return { label: 'NO SE CUMPLE', tone: '#991b1b' };
};

const averageNumbers = (values = []) => {
  const nums = values.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (!nums.length) return null;
  return Number((nums.reduce((acc, item) => acc + item, 0) / nums.length).toFixed(2));
};

const isAutoevaluacionProgramasSubbase = (subcategoria = '') => {
  const key = normalizeCategoryToken(subcategoria);
  return key === 'informacion_programas' || key === 'informacion_programa' || key === 'programas';
};

const buildAutoevaluacionDashboardPayload = ({ aspectosRows = [], participantesRows = [], programasRows = [], programasCatalogRows = [], programa = '' }) => {
  const normalizedPrograma = normalizeHeader(programa);
  const rows = normalizedPrograma
    ? aspectosRows.filter((row) => normalizeHeader(row.programa).includes(normalizedPrograma))
    : aspectosRows;
  const participantes = normalizedPrograma
    ? participantesRows.filter((row) => normalizeHeader(row.programa).includes(normalizedPrograma))
    : participantesRows;
  const programasInfo = normalizedPrograma
    ? programasRows.filter((row) => normalizeHeader(row.programa).includes(normalizedPrograma))
    : programasRows;

  const programasDisponibles = Array.from(new Set([
    ...aspectosRows.map((row) => row.programa).filter(Boolean),
    ...participantesRows.map((row) => row.programa).filter(Boolean),
    ...programasRows.map((row) => row.programa).filter(Boolean),
    ...programasCatalogRows.map((row) => row.programa).filter(Boolean)
  ])).sort((a, b) => String(a).localeCompare(String(b), 'es'));

  const factorMap = new Map();
  const caracteristicaMap = new Map();
  const instrumentoMap = new Map();
  const componenteMap = new Map();
  const judgementMap = new Map();

  rows.forEach((row) => {
    const factorInfo = parseAutoevaluacionPrefix(row.factor, 'F');
    const factorKey = factorInfo.code || row.factor || 'SIN FACTOR';
    if (!factorMap.has(factorKey)) {
      factorMap.set(factorKey, {
        factor: factorKey,
        factorNumero: factorInfo.number || 999,
        nombre: factorInfo.label || factorKey,
        calificaciones: [],
        aspectos: 0,
        indicadores: new Set(),
        evidencias: 0
      });
    }
    const factorData = factorMap.get(factorKey);
    factorData.aspectos += 1;
    if (row.indicador) factorData.indicadores.add(row.indicador);
    if (row.evidencias) factorData.evidencias += 1;
    const score = Number(row.calificacion_indicador);
    if (Number.isFinite(score)) factorData.calificaciones.push(score);

    const carInfo = parseAutoevaluacionPrefix(row.caracteristica, 'C');
    const carKey = carInfo.code || row.caracteristica || 'SIN CARACTERISTICA';
    if (!caracteristicaMap.has(carKey)) {
      caracteristicaMap.set(carKey, {
        caracteristica: carKey,
        factor: factorKey,
        nombre: carInfo.label || carKey,
        calificaciones: [],
        aspectos: 0
      });
    }
    const carData = caracteristicaMap.get(carKey);
    carData.aspectos += 1;
    if (Number.isFinite(score)) carData.calificaciones.push(score);

    const instrumento = normalizeText(row.instrumento) || 'Sin instrumento';
    instrumentoMap.set(instrumento, (instrumentoMap.get(instrumento) || 0) + 1);
    const componente = normalizeText(row.componente) || 'Sin componente';
    componenteMap.set(componente, (componenteMap.get(componente) || 0) + 1);
    const judgement = getAutoevaluacionJudgement(score).label;
    judgementMap.set(judgement, (judgementMap.get(judgement) || 0) + 1);
  });

  const factores = Array.from(factorMap.values())
    .map((item) => {
      const promedio = averageNumbers(item.calificaciones);
      return {
        factor: item.factor,
        nombre: item.nombre,
        aspectos: item.aspectos,
        indicadores: item.indicadores.size,
        evidencias: item.evidencias,
        calificacion: promedio,
        cumplimiento: getAutoevaluacionJudgement(promedio)
      };
    })
    .sort((a, b) => {
      const aNum = Number(String(a.factor).replace(/[^0-9]/g, '')) || 999;
      const bNum = Number(String(b.factor).replace(/[^0-9]/g, '')) || 999;
      return aNum - bNum;
    });

  const caracteristicas = Array.from(caracteristicaMap.values())
    .map((item) => ({
      caracteristica: item.caracteristica,
      factor: item.factor,
      nombre: item.nombre,
      aspectos: item.aspectos,
      calificacion: averageNumbers(item.calificaciones),
      cumplimiento: getAutoevaluacionJudgement(averageNumbers(item.calificaciones))
    }))
    .sort((a, b) => {
      const aNum = Number(String(a.caracteristica).replace(/[^0-9]/g, '')) || 999;
      const bNum = Number(String(b.caracteristica).replace(/[^0-9]/g, '')) || 999;
      return aNum - bNum;
    });

  const calificaciones = rows.map((row) => Number(row.calificacion_indicador)).filter((v) => Number.isFinite(v));
  const promedioGeneral = averageNumbers(calificaciones);
  const evidencias = rows.filter((row) => normalizeText(row.evidencias)).length;
  const indicadores = new Set(rows.map((row) => normalizeText(row.indicador)).filter(Boolean)).size;
  const aspectos = rows.length;

  return {
    filtros: { programa: programa || null },
    programasDisponibles,
    resumen: {
      programaActivo: programa || programasDisponibles[0] || null,
      promedioGeneral,
      cumplimientoGeneral: getAutoevaluacionJudgement(promedioGeneral),
      factores: factores.length,
      caracteristicas: caracteristicas.length,
      aspectos,
      indicadores,
      evidencias,
      coberturaEvidencias: aspectos ? Number(((evidencias / aspectos) * 100).toFixed(2)) : 0,
      participantes: participantes.length
    },
    factores,
    caracteristicas,
    aspectos: rows.map((row) => ({
      id: row.id,
      acuerdoMen: row.acuerdo_men,
      programa: row.programa,
      factor: row.factor,
      caracteristica: row.caracteristica,
      aspecto: row.aspectos_por_evaluar,
      indicador: row.indicador,
      instrumento: row.instrumento,
      scrit: row.scrit,
      componente: row.componente,
      calificacion: Number(row.calificacion_indicador),
      evidencia: row.evidencias,
      informacion: row.informacion_para_tener_en_cuenta,
      cumplimiento: getAutoevaluacionJudgement(row.calificacion_indicador)
    })),
    instrumentos: Array.from(instrumentoMap.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
    componentes: Array.from(componenteMap.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
    cumplimiento: Array.from(judgementMap.entries()).map(([name, total]) => ({ name, total })),
    participantes: participantes.map((row) => ({
      id: row.id,
      programa: row.programa,
      alcance: row.alcance_autoevaluacion,
      nombres: row.nombres_completos,
      documento: row.documento,
      cargo: row.cargo,
      rol: row.rol_en_proceso,
      actaInicio: row.acta_inicio_url,
      cronograma: row.cronograma_url
    })),
    programasInfo: programasInfo.map((row) => ({
      id: row.id,
      programa: row.programa,
      procesoAutoevaluacion: row.proceso_autoevaluacion,
      facultad: row.facultad,
      nivelFormacion: row.nivel_formacion,
      renovacionRegistroCalificado: row.renovacion_registro_calificado,
      codigoSnies: row.codigo_snies,
      tituloOtorga: row.titulo_otorga,
      emailPrograma: row.email_programa,
      duracionFormacion: row.duracion_formacion,
      numeroCreditos: row.numero_creditos,
      estudiantesPrimerCurso: row.estudiantes_primer_curso
    }))
  };
};

const normalizeDriveComparableName = (value = '') =>
  stripDiacritics(String(value || ''))
    .replace(/\.[A-Za-z0-9]{2,8}$/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isRegistroCalificadoActiveRow = (row = {}, latestDateByProgram = new Map()) => {
  const key = normalizeHeader(row.programa_academico);
  const dateValue = normalizeRegistroCalificadoDateForView(row.fecha_resolucion) || '';
  return Boolean(key && dateValue && latestDateByProgram.get(key) === dateValue);
};

const buildRegistrosCalificadosDashboardPayload = ({ rows = [], programa = '', estado = 'activos' }) => {
  const normalizedPrograma = normalizeHeader(programa);
  const baseRows = normalizedPrograma
    ? rows.filter((row) => normalizeHeader(row.programa_academico).includes(normalizedPrograma))
    : rows;

  const latestDateByProgram = new Map();
  rows.forEach((row) => {
    const key = normalizeHeader(row.programa_academico);
    const dateValue = normalizeRegistroCalificadoDateForView(row.fecha_resolucion) || '';
    if (!key || !dateValue) return;
    if (!latestDateByProgram.has(key) || dateValue > latestDateByProgram.get(key)) {
      latestDateByProgram.set(key, dateValue);
    }
  });

  const estadoToken = normalizeCategoryToken(estado || 'activos');
  const filteredRows = baseRows.filter((row) => {
    const active = isRegistroCalificadoActiveRow(row, latestDateByProgram);
    if (estadoToken === 'todos' || estadoToken === 'general') return true;
    if (estadoToken === 'inactivos') return !active;
    return active;
  });

  const programasDisponibles = Array.from(new Set(rows.map((row) => row.programa_academico).filter(Boolean)))
    .sort((a, b) => String(a).localeCompare(String(b), 'es'));
  const niveles = Array.from(new Set(filteredRows.map((row) => row.nivel).filter(Boolean)));
  const tipos = Array.from(new Set(filteredRows.map((row) => row.tipo_aprobacion).filter(Boolean)));
  const activeRows = rows.filter((row) => isRegistroCalificadoActiveRow(row, latestDateByProgram));

  const sortedRows = [...filteredRows].sort((a, b) => {
    const dateA = normalizeRegistroCalificadoDateForView(a.fecha_resolucion) || '';
    const dateB = normalizeRegistroCalificadoDateForView(b.fecha_resolucion) || '';
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return String(a.programa_academico || '').localeCompare(String(b.programa_academico || ''), 'es');
  });

  return {
    filtros: { programa: programa || null, estado: estadoToken || 'activos' },
    programasDisponibles,
    resumen: {
      total: filteredRows.length,
      totalHistorico: rows.length,
      activos: activeRows.length,
      inactivos: Math.max(0, rows.length - activeRows.length),
      programas: programasDisponibles.length,
      niveles: niveles.length,
      tipos: tipos.length
    },
    registros: sortedRows.map((row) => ({
      id: row.id,
      programaAcademico: row.programa_academico,
      nivel: row.nivel,
      tipoAprobacion: row.tipo_aprobacion,
      resolucionMen: row.resolucion_men,
      fechaResolucion: normalizeRegistroCalificadoDateForView(row.fecha_resolucion),
      resolucionRc: row.resolucion_rc,
      planEstudios: row.plan_estudios,
      enlace: row.enlace,
      estado: isRegistroCalificadoActiveRow(row, latestDateByProgram) ? 'Activo' : 'Inactivo'
    }))
  };
};

const getRegistrosCalificadosEvidencias = async (req, res) => {
  try {
    await ensureRegistrosCalificadosTable();
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Id de registro invalido' });
    }
    const row = await RegistroCalificadoHistorico.findByPk(id, { raw: true });
    if (!row) return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    const expected = [row.resolucion_rc, row.plan_estudios].filter(Boolean);
    const expectedSet = new Set(expected.map((name) => normalizeDriveComparableName(name)).filter(Boolean));
    const matchFiles = (files = []) => files.filter((file) => expectedSet.has(normalizeDriveComparableName(file.name)));

    let matchedFiles = [];
    const searchedFolders = [];
    if (row.enlace) {
      searchedFolders.push(row.enlace);
      matchedFiles = matchFiles(await listEvidenceFilesRecursive(row.enlace, { maxDepth: 2 }));
    }

    if (!matchedFiles.length && REGISTROS_CALIFICADOS_DRIVE_FOLDER_URL) {
      searchedFolders.push(REGISTROS_CALIFICADOS_DRIVE_FOLDER_URL);
      matchedFiles = matchFiles(await listEvidenceFilesRecursive(REGISTROS_CALIFICADOS_DRIVE_FOLDER_URL, { maxDepth: 4 }));
    }

    const uniqueFiles = Array.from(new Map(matchedFiles.map((file) => [file.id || file.webViewLink || file.name, file])).values());

    return res.json({
      success: true,
      data: {
        expected,
        files: uniqueFiles,
        searchedFolders
      }
    });
  } catch (error) {
    const status = Number(error?.statusCode || error?.code || error?.response?.status || 500);
    const googleMessage = error?.response?.data?.error?.message;
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      success: false,
      message: googleMessage || error.message || 'No se pudieron cargar las evidencias de Google Drive'
    });
  }
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

const MATRICULADOS_GEO_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const MATRICULADOS_MIN_DASHBOARD_YEAR = 2000;
const matriculadosGeoDashboardCache = new Map();

let divipolaRefCache = null;
let divipolaRefCacheTs = 0;
const DIVIPOLA_CACHE_TTL_MS = 60 * 60 * 1000;

const getDivipolaReferenceData = async () => {
  const now = Date.now();
  if (divipolaRefCache && (now - divipolaRefCacheTs) < DIVIPOLA_CACHE_TTL_MS) {
    return divipolaRefCache;
  }
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
  divipolaRefCache = { refDeptRows, refMuniRows };
  divipolaRefCacheTs = now;
  return divipolaRefCache;
};

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
  const selectedPrograms = new Set((programas || []).map((item) => normalizeGeoJoinKey(item)));
  const selectedYears = new Set((anios || []).map((item) => String(Number(item))));
  const selectedPeriods = new Set(normalizedPeriodos);
  const selectedSexos = new Set(normalizedSexos);
  const selectedNiveles = new Set(normalizedNiveles);
  const cacheKey = buildMatriculadosGeoCacheKey({ programas, anios, periodos: normalizedPeriodos, sexos: normalizedSexos, niveles: normalizedNiveles });
  const now = Date.now();
  const cached = matriculadosGeoDashboardCache.get(cacheKey);
  if (cached && (now - cached.ts) < MATRICULADOS_GEO_CACHE_TTL_MS) {
    return cached.payload;
  }

  const dbWhere = {
    anio: { [Op.gte]: MATRICULADOS_MIN_DASHBOARD_YEAR }
  };
  const dbProgramFilters = (programas || [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .map((programa) => ({ programa: { [Op.iLike]: programa } }));
  if (dbProgramFilters.length > 0) {
    dbWhere[Op.or] = dbProgramFilters;
  }

  if (anios && anios.length > 0) {
    const numericAnios = anios.map(Number).filter((year) => Number.isFinite(year) && year >= MATRICULADOS_MIN_DASHBOARD_YEAR);
    if (numericAnios.length > 0) dbWhere.anio = { [Op.in]: numericAnios };
  }

  // Agregación nativa SQL GROUP BY para evitar descargar cientos de miles de filas individuales
  const allRows = await PoblacionalMatriculado.findAll({
    attributes: [
      'anio', 'semestre', 'programa', 'sexo_biologico', 'pais',
      'departamento', 'municipio', 'codigo_departamento', 'codigo_dane',
      'departamento_nacimiento', 'municipio_nacimiento', 'codigo_departamento_nacimiento', 'codigo_dane_nacimiento',
      [fn('COUNT', col('id')), 'total_count']
    ],
    where: Object.keys(dbWhere).length > 0 ? dbWhere : undefined,
    group: [
      'anio', 'semestre', 'programa', 'sexo_biologico', 'pais',
      'departamento', 'municipio', 'codigo_departamento', 'codigo_dane',
      'departamento_nacimiento', 'municipio_nacimiento', 'codigo_departamento_nacimiento', 'codigo_dane_nacimiento'
    ],
    raw: true
  });

  // ── DIVIPOLA reference tables — authoritative name resolution ─────────────
  const { refDeptRows, refMuniRows } = await getDivipolaReferenceData();

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

  let totalFilteredRecords = 0;
  const filteredRows = allRows.filter((row) => {
    const programOk = !selectedPrograms.size || selectedPrograms.has(normalizeGeoJoinKey(row.programa));
    const yearOk = !selectedYears.size || selectedYears.has(String(Number(row.anio || 0)));
    const periodToken = /\b(2|3|II|IIP)\b/i.test(String(row.semestre || '')) ? '2' : '1';
    const periodOk = !selectedPeriods.size || selectedPeriods.has(periodToken);
    const sexoOk = !selectedSexos.size || selectedSexos.has(normalizeGenero(row.sexo_biologico));
    const nivelOk = !selectedNiveles.size || selectedNiveles.has(classifyMatriculadosProgramLevel(row.programa));
    const pass = programOk && yearOk && periodOk && sexoOk && nivelOk;
    if (pass) {
      totalFilteredRecords += Number(row.total_count || 1);
    }
    return pass;
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
      municipio_nacimiento: null,
      total_count: Number(row.total_count || 1)
    }));

    const fallbackRawRows = await PoblacionalCaracterizacion.findAll({
      where: Object.keys(fallbackWhere).length ? fallbackWhere : undefined,
      attributes: [
        'anio', 'periodo', 'programa', 'genero', 'pais_residencia', 'departamento_residencia', 'municipio_residencia',
        [fn('COUNT', col('id')), 'total_count']
      ],
      group: ['anio', 'periodo', 'programa', 'genero', 'pais_residencia', 'departamento_residencia', 'municipio_residencia'],
      raw: true
    });

    let fallbackFilteredRows = buildFallbackRows(fallbackRawRows, false);

    if (fallbackFilteredRows.length === 0 && selectedYears.size > 0) {
      const fallbackRawRowsNoYear = await PoblacionalCaracterizacion.findAll({
        attributes: [
          'anio', 'periodo', 'programa', 'genero', 'pais_residencia', 'departamento_residencia', 'municipio_residencia',
          [fn('COUNT', col('id')), 'total_count']
        ],
        group: ['anio', 'periodo', 'programa', 'genero', 'pais_residencia', 'departamento_residencia', 'municipio_residencia'],
        raw: true
      });
      fallbackFilteredRows = buildFallbackRows(fallbackRawRowsNoYear, true);
    }

    if (fallbackFilteredRows.length > 0) {
      // Ajustar pesos proporcionales para no romper porcentajes respecto a Matriculados
      const fallbackSum = fallbackFilteredRows.reduce((acc, r) => acc + Number(r.total_count || 1), 0);
      if (totalFilteredRecords > 0 && fallbackSum > 0 && fallbackSum !== totalFilteredRecords) {
        const scale = totalFilteredRecords / fallbackSum;
        fallbackFilteredRows.forEach((r) => {
          r.total_count = (Number(r.total_count || 1) * scale);
        });
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

  // El histórico principal siempre debe salir de Matriculados filtrado (fuente base)
  filteredRows.forEach((row) => {
    const periodLabel = buildPeriodLabel(row.anio, row.semestre);
    if (!periodLabel) return;
    const count = Number(row.total_count || 1);
    historicoMap.set(periodLabel, {
      periodLabel,
      anio: Number(row.anio || 0),
      semestre: periodLabel.split('-')[1] || '1',
      total: (historicoMap.get(periodLabel)?.total || 0) + count
    });
  });

  dimensionalRows.forEach((row) => {
    const count = Number(row.total_count || 1);
    const pais = getGeoDisplayName(row.pais, 'COLOMBIA') || 'COLOMBIA';
    const sexo = normalizeGenero(row.sexo_biologico);
    sexoMap.set(sexo, (sexoMap.get(sexo) || 0) + count);
    const countryKey = normalizeGeoJoinKey(pais);
    const existingCountry = countriesMap.get(countryKey) || { name: pais.toUpperCase(), total: 0, programasMap: new Map(), sexoMap: new Map() };
    existingCountry.total += count;
    if (sexo) existingCountry.sexoMap.set(sexo, (existingCountry.sexoMap.get(sexo) || 0) + count);
    if (row.programa) {
      const progKey = String(row.programa).trim();
      const existingProg = existingCountry.programasMap.get(progKey) || { programa: progKey, total: 0, sexoMap: new Map() };
      existingProg.total += count;
      if (sexo) existingProg.sexoMap.set(sexo, (existingProg.sexoMap.get(sexo) || 0) + count);
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
        total: (incidenciasMap.get(issueKey)?.total || 0) + count,
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
        total: (incidenciasMap.get(issueKey)?.total || 0) + count,
        motivo: 'Municipio sin coincidencia DIVIPOLA'
      });
    }

    matchedDepartments += count;
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
    deptEntry.total += count;
    deptEntry.sexoMap.set(sexo, (deptEntry.sexoMap.get(sexo) || 0) + count);
    if (periodLabel) {
      const currentPeriod = deptEntry.historicoMap.get(periodLabel) || {
        periodLabel,
        anio: Number(row.anio || 0),
        semestre: periodLabel.split('-')[1] || '1',
        total: 0
      };
      currentPeriod.total += count;
      deptEntry.historicoMap.set(periodLabel, currentPeriod);
    }
    departmentMap.set(deptDaneCode, deptEntry);

    if (refMuni) matchedMunicipios += count;
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
    muniEntry.total += count;
    muniEntry.sexoMap.set(sexo, (muniEntry.sexoMap.get(sexo) || 0) + count);
    if (periodLabel) {
      const currentPeriod = muniEntry.historicoMap.get(periodLabel) || {
        periodLabel,
        anio: Number(row.anio || 0),
        semestre: periodLabel.split('-')[1] || '1',
        total: 0
      };
      currentPeriod.total += count;
      muniEntry.historicoMap.set(periodLabel, currentPeriod);
    }
    deptEntry.municipiosMap.set(muniMapKey, muniEntry);
  });

  // Garantia de salida: si hay registros pero no se lograron armar departamentos,
  // reconstruimos desde texto crudo para evitar mapa vacio.
  if (departmentMap.size === 0 && dimensionalRows.length > 0) {
    dimensionalRows.forEach((row) => {
      const count = Number(row.total_count || 1);
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
      deptEntry.total += count;
      deptEntry.sexoMap.set(sexo, (deptEntry.sexoMap.get(sexo) || 0) + count);
      if (periodLabel) {
        const currentPeriod = deptEntry.historicoMap.get(periodLabel) || {
          periodLabel,
          anio: Number(row.anio || 0),
          semestre: periodLabel.split('-')[1] || '1',
          total: 0
        };
        currentPeriod.total += count;
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
      muniEntry.total += count;
      muniEntry.sexoMap.set(sexo, (muniEntry.sexoMap.get(sexo) || 0) + count);
      if (periodLabel) {
        const currentPeriod = muniEntry.historicoMap.get(periodLabel) || {
          periodLabel,
          anio: Number(row.anio || 0),
          semestre: periodLabel.split('-')[1] || '1',
          total: 0
        };
        currentPeriod.total += count;
        muniEntry.historicoMap.set(periodLabel, currentPeriod);
      }
      deptEntry.municipiosMap.set(muniCode, muniEntry);
    });
  }

  const dimensionalRowsTotalCount = dimensionalRows.reduce((acc, r) => acc + Number(r.total_count || 1), 0);

  const payload = {
    totalRegistros: Math.round(totalFilteredRecords),
    geography: {
      departments: Array.from(departmentMap.values()).map((item) => ({
        code: item.code,
        codigo_departamento_divipola: item.code,
        name: item.name,
        departamento_normalizado: item.name,
        total: Math.round(item.total),
        lat: Number.isFinite(item.lat) ? item.lat : null,
        lon: Number.isFinite(item.lon) ? item.lon : null,
        sexo: Array.from(item.sexoMap instanceof Map ? item.sexoMap.entries() : []).map(([name, total]) => ({ name, total: Math.round(total) })).sort((a, b) => b.total - a.total),
        historico: Array.from(item.historicoMap instanceof Map ? item.historicoMap.values() : []).map((h) => ({ ...h, total: Math.round(h.total) })).sort((a, b) => a.periodLabel.localeCompare(b.periodLabel, 'es')),
        municipios: Array.from(item.municipiosMap.values()).map((muni) => ({
          codigo: muni.codigo,
          codigo_municipio_divipola: muni.codigo,
          municipio: muni.municipio,
          municipio_normalizado: muni.municipio,
          total: Math.round(muni.total),
          lat: Number.isFinite(muni.lat) ? muni.lat : null,
          lon: Number.isFinite(muni.lon) ? muni.lon : null,
          sexo: Array.from(muni.sexoMap instanceof Map ? muni.sexoMap.entries() : []).map(([name, total]) => ({ name, total: Math.round(total) })).sort((a, b) => b.total - a.total),
          historico: Array.from(muni.historicoMap instanceof Map ? muni.historicoMap.values() : []).map((h) => ({ ...h, total: Math.round(h.total) })).sort((a, b) => a.periodLabel.localeCompare(b.periodLabel, 'es'))
        })).sort((a, b) => b.total - a.total)
      })).sort((a, b) => b.total - a.total),
      countries: Array.from(countriesMap.values()).sort((a, b) => b.total - a.total).map((c) => ({
        name: c.name,
        total: Math.round(c.total),
        sexo: Array.from(c.sexoMap instanceof Map ? c.sexoMap.entries() : []).map(([name, total]) => ({ name, total: Math.round(total) })).sort((a, b) => b.total - a.total),
        programas: Array.from(c.programasMap instanceof Map ? c.programasMap.values() : []).map((p) => ({
          programa: p.programa,
          total: Math.round(p.total),
          sexo: Array.from(p.sexoMap instanceof Map ? p.sexoMap.entries() : []).map(([name, total]) => ({ name, total: Math.round(total) })).sort((a, b) => b.total - a.total)
        })).sort((a, b) => b.total - a.total)
      }))
    },
    sexo: Array.from(sexoMap.entries()).map(([name, total]) => ({ name, total: Math.round(total) })).sort((a, b) => b.total - a.total),
    programasPorSexo: (() => {
      const map = {};
      dimensionalRows.forEach((row) => {
        const count = Number(row.total_count || 1);
        const sexo = normalizeGenero(row.sexo_biologico);
        if (!sexo) return;
        const prog = String(row.programa || '').trim();
        if (!prog) return;
        if (!map[sexo]) map[sexo] = new Map();
        map[sexo].set(prog, (map[sexo].get(prog) || 0) + count);
      });
      return Object.fromEntries(
        Object.entries(map).map(([sexo, progMap]) => [
          sexo,
          Array.from(progMap.entries())
            .map(([programa, total]) => ({ programa, total: Math.round(total) }))
            .sort((a, b) => b.total - a.total)
        ])
      );
    })(),
    historico: Array.from(historicoMap.values()).map((h) => ({ ...h, total: Math.round(h.total) })).sort((a, b) => a.periodLabel.localeCompare(b.periodLabel, 'es')),
    nivelesFormacion: (() => {
      const nivelMap = { TECNOLOGICO: { total: 0, programas: new Set() }, PROFESIONAL: { total: 0, programas: new Set() }, ESPECIALIZACION: { total: 0, programas: new Set() }, MAESTRIA: { total: 0, programas: new Set() } };
      filteredRows.forEach((row) => {
        const count = Number(row.total_count || 1);
        const nivel = classifyMatriculadosProgramLevel(row.programa);
        if (nivel === 'SIN INFORMACION') return;
        nivelMap[nivel].total += count;
        nivelMap[nivel].programas.add(row.programa);
      });
      return Object.entries(nivelMap).map(([nivel, data]) => ({ nivel, total: Math.round(data.total), programas: data.programas.size }));
    })(),
    semestres: (() => {
      const s1Map = new Map(); const s2Map = new Map();
      filteredRows.forEach((row) => {
        const count = Number(row.total_count || 1);
        const yr = String(Number(row.anio || 0));
        if (!yr || yr === '0') return;
        const isS2 = /\b(2|3|II|IIP)\b/i.test(String(row.semestre || ''));
        if (isS2) { s2Map.set(yr, (s2Map.get(yr) || 0) + count); }
        else { s1Map.set(yr, (s1Map.get(yr) || 0) + count); }
      });
      const years = Array.from(new Set([...s1Map.keys(), ...s2Map.keys()])).sort();
      return years.map((yr) => ({ anio: yr, semestre1: Math.round(s1Map.get(yr) || 0), semestre2: Math.round(s2Map.get(yr) || 0) }));
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

const normalizePlanAccionPercent = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const normalized = numeric > 0 && numeric <= 1 ? numeric * 100 : numeric;
  return Number(normalized.toFixed(2));
};

const resolvePlanAccionEstado = (value) => {
  const percent = normalizePlanAccionPercent(value);
  if (percent === null) return 'Sin dato';
  if (percent <= 0) return 'Sin iniciar';
  if (percent >= 100) return 'Completado';
  return 'En ejecución';
};

const buildPlanAccionDashboardPayload = (rows = []) => {
  const mappedRows = (Array.isArray(rows) ? rows : []).map((row) => {
    const avanceIp = normalizePlanAccionPercent(row.avance_ip);
    const avanceIip = normalizePlanAccionPercent(row.avance_iip);
    const avanceTotal = normalizePlanAccionPercent(row.total_ejecucion);
    return {
      id: row.id,
      anio: Number(row.anio || 0) || null,
      ped: normalizeText(row.ped),
      objetivo_estrategico: normalizeText(row.objetivo_estrategico),
      lineamiento_estrategico: normalizeText(row.lineamiento_estrategico),
      macroactividad: normalizeText(row.macroactividad),
      actividad: normalizeText(row.actividad),
      tipo_indicador: normalizeText(row.tipo_indicador),
      fecha_inicio: row.fecha_inicio || null,
      fecha_fin: row.fecha_fin || null,
      indicador: normalizeText(row.indicador),
      meta: normalizeText(row.meta),
      responsable: normalizeText(row.responsable),
      corresponsable: normalizeText(row.corresponsable),
      avance_ip: avanceIp,
      observaciones_ip: normalizeText(row.observaciones_ip),
      avance_iip: avanceIip,
      observaciones_iip: normalizeText(row.observaciones_iip),
      avance_total: avanceTotal,
      estado: resolvePlanAccionEstado(avanceTotal),
      creado_en: row.createdAt || row.created_at || null,
      actualizado_en: row.updatedAt || row.updated_at || null
    };
  });

  const uniqueSorted = (selector, formatter = (value) => value) =>
    Array.from(
      new Set(
        mappedRows
          .map(selector)
          .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
      )
    )
      .sort((a, b) => String(a).localeCompare(String(b), 'es'))
      .map(formatter);

  return {
    rows: mappedRows,
    filters: {
      anios: Array.from(new Set(mappedRows.map((row) => row.anio).filter((value) => Number.isFinite(value)))).sort((a, b) => a - b),
      peds: uniqueSorted((row) => row.ped),
      responsables: uniqueSorted((row) => row.responsable),
      tiposIndicador: uniqueSorted((row) => row.tipo_indicador),
      estados: ['Sin iniciar', 'En ejecución', 'Completado', 'Sin dato']
    },
    meta: {
      totalRows: mappedRows.length,
      totalAnios: new Set(mappedRows.map((row) => row.anio).filter((value) => Number.isFinite(value))).size,
      totalResponsables: new Set(mappedRows.map((row) => row.responsable).filter(Boolean)).size
    }
  };
};

const GRADUADOS_HISTORICO_DETAIL = '\uD83D\uDCCC 1984 HASTA 2019 INSTITUCION UNIVERSITARIA CENTRO DE ESTUDIOS SUPERIORES MARIA GORETTI CESMAG';

const parseGraduadoDateValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = String(value).trim();
  if (!text) return null;
  const serial = Number(text.replace(',', '.'));
  if (Number.isFinite(serial) && serial > 20000 && serial < 90000) {
    const parsed = XLSX.SSF.parse_date_code(serial);
    if (parsed?.y && parsed?.m && parsed?.d) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const iso = text.match(/\b((19|20)\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[3]) - 1, Number(iso[4])));
  const slash = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/]((19|20)\d{2})\b/);
  if (slash) return new Date(Date.UTC(Number(slash[3]), Number(slash[2]) - 1, Number(slash[1])));
  return null;
};

const getGraduadoPeriodToken = (row = {}, parsedDate = null) => {
  const raw = String(row.periodo || '').toUpperCase();
  if (/\b(II|IIP|2)\b/.test(raw)) return 'IIP';
  if (/\b(I|IP|1)\b/.test(raw)) return 'IP';
  if (parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime())) {
    return parsedDate.getUTCMonth() + 1 <= 6 ? 'IP' : 'IIP';
  }
  return 'IP';
};

const formatGraduadoShortDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()] || ''}`.trim();
};

const buildGraduadosGeneralDashboardPayload = async (anioFilter = null) => {
  const rawYears = Array.isArray(anioFilter)
    ? anioFilter.flatMap((v) => String(v).split(','))
    : (anioFilter && anioFilter !== 'todos' ? String(anioFilter).split(',') : []);
  const anioValues = rawYears.map((v) => Number(v)).filter((n) => !Number.isNaN(n) && n > 0);
  const hasYearFilter = anioValues.length > 0;

  const [aniosHistRaw, aniosDinRaw, historicoRawRows, graduadosRawRows] = await Promise.all([
    PoblacionalCantidadTotalEgresado.findAll({
      attributes: ['anio'],
      where: { anio: { [Op.not]: null } },
      group: ['anio'],
      order: [['anio', 'ASC']],
      raw: true
    }),
    PoblacionalGraduado.findAll({
      attributes: ['anio'],
      where: { anio: { [Op.not]: null, [Op.gte]: 2020 } },
      group: ['anio'],
      order: [['anio', 'ASC']],
      raw: true
    }),
    hasYearFilter && anioValues.every((y) => y >= 2020)
      ? Promise.resolve([])
      : PoblacionalCantidadTotalEgresado.findAll({
          attributes: ['id', 'anio', 'programa', 'cantidad', 'detalle'],
          where: hasYearFilter ? { anio: { [Op.in]: anioValues } } : {},
          order: [['programa', 'ASC'], ['id', 'ASC']],
          raw: true
        }),
    hasYearFilter && anioValues.every((y) => y <= 2019)
      ? Promise.resolve([])
      : PoblacionalGraduado.findAll({
          attributes: ['id', 'anio', 'periodo', 'programa', 'numero_documento', 'fecha_grado'],
          where: hasYearFilter ? { anio: { [Op.in]: anioValues } } : { anio: { [Op.gte]: 2020 } },
          order: [['anio', 'ASC'], ['periodo', 'ASC'], ['programa', 'ASC'], ['id', 'ASC']],
          raw: true
        })
  ]);

  const aniosDisponibles = [
    ...aniosHistRaw.map((r) => Number(r.anio)),
    ...aniosDinRaw.map((r) => Number(r.anio))
  ].filter((v, i, a) => !Number.isNaN(v) && a.indexOf(v) === i).sort((a, b) => a - b);

  const historicoRows = historicoRawRows
    .filter((row) => {
      const anio = Number(row.anio || 0);
      const text = normalizeProgramAggregateKey(`${row.anio || ''} ${row.detalle || ''}`);
      return anio <= 2019 || /1984.*2019/.test(text);
    })
    .map((row) => ({
      programa: normalizeText(row.programa) || 'Sin informacion',
      cantidad: Number(row.cantidad || 0),
      detalle: GRADUADOS_HISTORICO_DETAIL
    }))
    .filter((row) => row.cantidad > 0);

  // Rows from cantidad_total_egresados for 2020+ (available when no year filter or year <= 2019)
  const egresadoDinamicoRows = historicoRawRows
    .filter((row) => Number(row.anio || 0) >= 2020)
    .map((row) => ({
      programa: normalizeText(row.programa) || 'Sin informacion',
      cantidad: Number(row.cantidad || 0),
      detalle: row.detalle
    }))
    .filter((row) => row.cantidad > 0)
    .sort((a, b) => b.cantidad - a.cantidad || String(a.programa).localeCompare(String(b.programa), 'es'));

  // Detect latest period from poblacional_graduados (for label only)
  let latest = null;
  graduadosRawRows.forEach((row) => {
    const parsedDate = parseGraduadoDateValue(row.fecha_grado);
    const period = getGraduadoPeriodToken(row, parsedDate);
    const year = parsedDate ? parsedDate.getUTCFullYear() : Number(row.anio || 0);
    const score = parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime())
      ? parsedDate.getTime()
      : (year * 10 + (period === 'IIP' ? 2 : 1));
    if (!latest || score >= latest.score) {
      latest = {
        score,
        year,
        period,
        dateLabel: parsedDate ? formatGraduadoShortDate(parsedDate) : ''
      };
    }
  });

  // When no year filter (or year <= 2019), use cantidad_total_egresados for 2020+ totals
  // (authoritative pre-aggregated source). For specific year >= 2020, fall back to
  // poblacional_graduados unique-doc count so the per-year breakdown still works.
  let dinamicoRows;
  let dinamicoDetalle;
  if (egresadoDinamicoRows.length > 0) {
    dinamicoRows = egresadoDinamicoRows;
    const srcDetalle = egresadoDinamicoRows[0]?.detalle || '';
    dinamicoDetalle = srcDetalle ? `\uD83D\uDCCC ${srcDetalle}` : `\uD83D\uDCCC GRADUADOS UNIVERSIDAD CESMAG 2020+`;
  } else {
    const dynamicBuckets = new Map();
    graduadosRawRows.forEach((row) => {
      const programa = normalizeText(row.programa) || 'Sin informacion';
      const programKey = normalizeProgramAggregateKey(programa) || 'SIN_PROGRAMA';
      const current = dynamicBuckets.get(programKey) || { programa, docs: new Set() };
      current.programa = selectPreferredAggregateLabel(current.programa, programa);
      const doc = normalizeText(row.numero_documento);
      current.docs.add(doc ? `${programKey}||${doc}` : `${programKey}||__row__${row.id}`);
      dynamicBuckets.set(programKey, current);
    });
    dinamicoRows = Array.from(dynamicBuckets.values())
      .map((row) => ({ programa: row.programa || 'Sin informacion', cantidad: row.docs.size }))
      .filter((row) => row.cantidad > 0)
      .sort((a, b) => b.cantidad - a.cantidad || String(a.programa).localeCompare(String(b.programa), 'es'));
    const latestLabel = latest?.year
      ? `${latest.year} ${latest.period || ''}${latest.dateLabel ? ` ${latest.dateLabel}` : ''}`.trim()
      : 'ULTIMO REPORTE';
    dinamicoDetalle = `\uD83D\uDCCC GRADUADOS UNIVERSIDAD CESMAG 2020 - ${latestLabel}`;
  }

  const historicoTotal = historicoRows.reduce((acc, row) => acc + Number(row.cantidad || 0), 0);
  const dinamicoTotal = dinamicoRows.reduce((acc, row) => acc + Number(row.cantidad || 0), 0);

  const programaMap = new Map();
  historicoRows.forEach((row) => {
    const key = normalizeProgramAggregateKey(row.programa) || 'SIN_PROGRAMA';
    const current = programaMap.get(key) || { programa: row.programa, historico: 0, dinamico: 0 };
    current.programa = selectPreferredAggregateLabel(current.programa, row.programa);
    current.historico += Number(row.cantidad || 0);
    programaMap.set(key, current);
  });
  dinamicoRows.forEach((row) => {
    const key = normalizeProgramAggregateKey(row.programa) || 'SIN_PROGRAMA';
    const current = programaMap.get(key) || { programa: row.programa, historico: 0, dinamico: 0 };
    current.programa = selectPreferredAggregateLabel(current.programa, row.programa);
    current.dinamico += Number(row.cantidad || 0);
    programaMap.set(key, current);
  });

  const programas = Array.from(programaMap.values())
    .map((row) => ({ ...row, total: row.historico + row.dinamico }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total || String(a.programa).localeCompare(String(b.programa), 'es'));

  return {
    historico: {
      label: '1984 hasta 2019',
      detalle: GRADUADOS_HISTORICO_DETAIL,
      total: historicoTotal,
      programas: historicoRows
    },
    dinamico: {
      label: 'Graduados Universidad CESMAG',
      detalle: dinamicoDetalle,
      total: dinamicoTotal,
      latest: latest ? { year: latest.year, period: latest.period, dateLabel: latest.dateLabel } : null,
      programas: dinamicoRows
    },
    totalGeneral: historicoTotal + dinamicoTotal,
    programas,
    aniosDisponibles
  };
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
      exclude_current_year = '',
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

    if (aggregate === 'plan_accion_dashboard' && (!where.categoria || where.categoria === 'Plan de Acción')) {
      await ensurePlanAccionTable();
      const rows = await PlanAccion.findAll({
        where: {
          [Op.or]: [
            { estado_workflow: 'Aprobado' },
            { estado_workflow: null }
          ],
          deleted_at: null
        },
        order: [['anio', 'DESC'], ['objetivo_estrategico', 'ASC'], ['lineamiento_estrategico', 'ASC'], ['actividad', 'ASC'], ['id', 'ASC']],
        raw: true
      });
      return res.json({
        success: true,
        data: buildPlanAccionDashboardPayload(rows)
      });
    }

    if (aggregate === 'graduados_general_dashboard' && (!where.categoria || where.categoria === 'Poblacional')) {
      const payload = await buildGraduadosGeneralDashboardPayload(req.query.anio || null);
      return res.json({ success: true, data: payload });
    }

    if (aggregate === 'autoevaluacion_dashboard') {
      await ensureAutoevaluacionTable();
      const normalizedPrograma = normalizeHeader(programa);
      const scopedWhere = normalizedPrograma
        ? { programa: { [Op.iLike]: `%${String(programa).trim()}%` } }
        : {};
      const aspectosAttrs = [
        'id',
        'acuerdo_men',
        'programa',
        'factor',
        'caracteristica',
        'aspectos_por_evaluar',
        'indicador',
        'instrumento',
        'scrit',
        'componente',
        'calificacion_indicador',
        'evidencias',
        'informacion_para_tener_en_cuenta'
      ];
      const participantesAttrs = ['id', 'programa', 'alcance_autoevaluacion', 'nombres_completos', 'documento', 'cargo', 'rol_en_proceso', 'acta_inicio_url', 'cronograma_url'];
      const programasAttrs = ['id', 'programa', 'proceso_autoevaluacion', 'facultad', 'nivel_formacion', 'renovacion_registro_calificado', 'codigo_snies', 'titulo_otorga', 'email_programa', 'duracion_formacion', 'numero_creditos', 'estudiantes_primer_curso'];
      const [aspectosRows, participantesRows, programasRows, programasCatalogRows] = await Promise.all([
        Autoevaluacion.findAll({ attributes: aspectosAttrs, where: scopedWhere, order: [['programa', 'ASC'], ['factor', 'ASC'], ['caracteristica', 'ASC'], ['id', 'ASC']], raw: true }),
        AutoevaluacionParticipante.findAll({ attributes: participantesAttrs, where: scopedWhere, order: [['programa', 'ASC'], ['nombres_completos', 'ASC'], ['id', 'ASC']], raw: true }),
        AutoevaluacionPrograma.findAll({ attributes: programasAttrs, where: scopedWhere, order: [['programa', 'ASC'], ['id', 'ASC']], raw: true }),
        Autoevaluacion.findAll({ attributes: ['programa'], group: ['programa'], raw: true })
      ]);
      return res.json({
        success: true,
        data: buildAutoevaluacionDashboardPayload({
          aspectosRows,
          participantesRows,
          programasRows,
          programasCatalogRows,
          programa
        })
      });
    }

    if (aggregate === 'registros_calificados_dashboard') {
      await ensureRegistrosCalificadosTable();
      const registrosRows = await RegistroCalificadoHistorico.findAll({
        order: [['programa_academico', 'ASC'], ['fecha_resolucion', 'DESC'], ['id', 'DESC']],
        raw: true
      });
      return res.json({
        success: true,
        data: buildRegistrosCalificadosDashboardPayload({
          rows: registrosRows,
          programa,
          estado: req.query.estado || 'activos'
        })
      });
    }

    if (aggregate === 'movilidad_dashboard') {
      const {
        periodo: periodoFilter = '',
        alcance = '',
        direccion = '',
        tipo_persona: tipoPersonaFilter = '',
        pais = '',
        programa: programaFilter = ''
      } = req.query;

      const mov_where = {};
      const normalizeFilterKey = (value = '') => String(value || '')
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const COUNTRY_FILTER_ALIASES = {
        COLOMBIA: ['Colombia', 'COLOMBIA'],
        ECUADOR: ['Ecuador', 'ECUADOR'],
        MEXICO: ['Mexico', 'MEXICO', 'México', 'MÉXICO'],
        PERU: ['Peru', 'PERU', 'Perú', 'PERÚ'],
        CHILE: ['Chile', 'CHILE'],
        'EL SALVADOR': ['El Salvador', 'EL SALVADOR'],
        BRASIL: ['Brasil', 'BRASIL', 'Brazil', 'BRAZIL'],
        ARGENTINA: ['Argentina', 'ARGENTINA'],
        PANAMA: ['Panama', 'PANAMA', 'Panamá', 'PANAMÁ'],
        CANADA: ['Canada', 'CANADA', 'Canadá', 'CANADÁ'],
        ESPANA: ['Espana', 'ESPANA', 'España', 'ESPAÑA'],
        'ESTADOS UNIDOS': ['Estados Unidos', 'ESTADOS UNIDOS', 'USA']
      };
      const COUNTRY_DISPLAY_NAMES = {
        COLOMBIA: 'Colombia',
        ECUADOR: 'Ecuador',
        MEXICO: 'México',
        PERU: 'Perú',
        CHILE: 'Chile',
        'EL SALVADOR': 'El Salvador',
        BRASIL: 'Brasil',
        ARGENTINA: 'Argentina',
        PANAMA: 'Panamá',
        CANADA: 'Canadá',
        ESPANA: 'España',
        'ESTADOS UNIDOS': 'Estados Unidos'
      };
      const COUNTRY_VALUE_OVERRIDES = {
        NARINO: 'Colombia',
        NO: 'Colombia',
        'UNIVERSIDAD DEL VALLE': 'Colombia',
        'INFOTEC SOLUCIONES S A S': 'Colombia',
        'UNIVERSIDAD CATOLICA': 'Colombia',
        'COLOMBIA PERU': 'Colombia',
        'MEXICO ECUADOR BRASIL': 'México',
        'ECUADOR PERU MEXICO': 'Ecuador',
        ESCUADOR: 'Ecuador',
        SALVADOR: 'El Salvador',
        '32 ARGENTINA': 'Argentina',
        '862 VEN': 'Venezuela',
        '840 ESTADOS UNIDOS': 'Estados Unidos',
        'E E U U': 'Estados Unidos',
        '484 MEX': 'México',
        'CHILE 152': 'Chile'
      };
      const COUNTRY_MATCHERS = [
        { name: 'Colombia', patterns: [/COLOMBIA/, /170\s*COL$/, /^COL$/, /^CO$/, /^170$/] },
        { name: 'Ecuador', patterns: [/ECUADOR/, /ESCUADOR/, /(^|[^A-Z])ECU([^A-Z]|$)/, /218\s*ECU/, /^EC$/, /^218$/] },
        { name: 'México', patterns: [/MEXICO/, /(^|[^A-Z])MEX([^A-Z]|$)/, /484\s*MEX/, /^484$/] },
        { name: 'Perú', patterns: [/PERU/, /604\s*PER/, /^604$/] },
        { name: 'Chile', patterns: [/CHILE/, /152\s*CHI/, /^152$/, /^CL$/] },
        { name: 'El Salvador', patterns: [/EL SALVADOR/, /^SALVADOR$/] },
        { name: 'Brasil', patterns: [/BRASIL/, /BRAZIL/, /^76$/] },
        { name: 'Argentina', patterns: [/ARGENTINA/, /^32$/] },
        { name: 'Honduras', patterns: [/HONDURAS/, /^340$/] },
        { name: 'Uruguay', patterns: [/URUGUAY/, /^858$/] },
        { name: 'España', patterns: [/ESPANA/, /724\s*ESP/, /^724$/] },
        { name: 'Estados Unidos', patterns: [/ESTADOS UNIDOS/, /^E E U U$/, /^EEUU$/, /^USA$/, /840\s*ESTADOS UNIDOS/, /^840$/] },
        { name: 'Venezuela', patterns: [/VENEZUELA/, /862\s*VEN$/, /^VEN$/, /^862$/] },
        { name: 'Italia', patterns: [/ITALIA/, /^380$/] },
        { name: 'Costa Rica', patterns: [/COSTA RICA/, /^188$/] },
        { name: 'Cuba', patterns: [/CUBA/, /^192$/] },
        { name: 'Guatemala', patterns: [/GUATEMALA/, /^320$/] },
        { name: 'Panamá', patterns: [/PANAMA/, /^591$/] },
        { name: 'Alemania', patterns: [/ALEMANIA/, /^276$/] },
        { name: 'Marruecos', patterns: [/MARRUECOS/, /^504$/] }
      ];
      const toFilterValues = (value) => {
        const values = Array.isArray(value) ? value : String(value || '').split(',');
        return values.map((item) => String(item || '').trim()).filter(Boolean);
      };
      const expandCountryValues = (values) => [...new Set(values.flatMap((item) => COUNTRY_FILTER_ALIASES[normalizeFilterKey(item)] || [item]))];
      const applyILikeFilter = (field, value, expandValues = null) => {
        const values = expandValues ? expandValues(toFilterValues(value)) : toFilterValues(value);
        if (!values.length) return;
        mov_where[field] = values.length === 1
          ? { [Op.iLike]: `%${values[0]}%` }
          : { [Op.or]: values.map((item) => ({ [Op.iLike]: `%${item}%` })) };
      };

      applyILikeFilter('periodo', periodoFilter);
      applyILikeFilter('alcance_movilidad', alcance);
      applyILikeFilter('direccion_movilidad', direccion);
      applyILikeFilter('tipo_persona', tipoPersonaFilter);
      applyILikeFilter('pais_extranjero', pais, expandCountryValues);
      applyILikeFilter('programa_dependencia', programaFilter);

      const rows = await InternacionalizacionMovilidad.findAll({ where: mov_where, raw: true, order: [['periodo', 'ASC'], ['id', 'ASC']] });

      const count = (rows, key) => rows.reduce((acc, r) => {
        const k = r[key] || 'Sin dato';
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});

      const toArr = (obj) => Object.entries(obj).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
      const normalizeCountryName = (value = '') => {
        const key = normalizeFilterKey(value);
        if (!key || ['N A', 'NA', 'N/A', 'SIN DATO', 'REGIONAL', 'OTRO', 'OTROS', 'NO APLICA'].includes(key)) return 'Sin dato';
        if (COUNTRY_VALUE_OVERRIDES[key]) return COUNTRY_VALUE_OVERRIDES[key];
        const matches = COUNTRY_MATCHERS
          .filter((country) => country.patterns.some((pattern) => pattern.test(key)))
          .map((country) => country.name);
        const uniqueMatches = [...new Set(matches)];
        if (uniqueMatches.length === 1) return uniqueMatches[0];
        if (uniqueMatches.length > 1) return 'Sin dato';
        return COUNTRY_DISPLAY_NAMES[key] || 'Sin dato';
      };
      const cleanMobilityTypeKey = (value = '') => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/^\s*\d+\s*\.?\s*/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
      const MOBILITY_TYPE_NAMES = {
        'ASISTENCIA A EVENTOS': 'Asistencia a eventos',
        'ASISTENCIA EVENTOS': 'Asistencia a eventos',
        'CURSO CORTO': 'Curso corto',
        'PASANTIA O PRACTICA': 'Pasantía o práctica',
        PASANTIA: 'Pasantía',
        MISION: 'Misión',
        'SECTOR EMPRESARIAL': 'Sector empresarial',
        'EDUCACION CONTINUADA': 'Educación continuada',
        SEMINARIOS: 'Seminarios',
        SIMPOSIOS: 'Simposios',
        CONGRESOS: 'Congresos',
        'GESTION DE CONVENIOS': 'Gestión de convenios',
        'SEMESTRE ACADEMICO DE INTERCAMBIO': 'Semestre académico de intercambio',
        'PAR ACADEMICO': 'Par académico',
        PONENCIA: 'Ponencia',
        'VISITA EMPRESARIAL': 'Visita empresarial',
        ACADEMICA: 'Académica',
        ENTRANTE: 'Entrante',
        SALIENTE: 'Saliente'
      };
      const normalizeMobilityType = (value = '') => {
        const key = cleanMobilityTypeKey(value);
        if (!key || ['N A', 'NA', 'N/A', 'SIN DATO'].includes(key)) return 'Sin dato';
        return MOBILITY_TYPE_NAMES[key] || key.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
      };
      const countNormalized = (items, field, normalizer) => items.reduce((acc, row) => {
        const key = normalizer(row[field]);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const crossCount = (rows, rowKey, colKey) => rows.reduce((acc, r) => {
        const row = r[rowKey] || 'Sin dato';
        const col = r[colKey] || 'Sin dato';
        if (!acc[row]) acc[row] = {};
        acc[row][col] = (acc[row][col] || 0) + 1;
        return acc;
      }, {});
      const classifyPerson = (value = '') => {
        const key = normalizeFilterKey(value);
        if (key.includes('ESTUD')) return 'estudiantes';
        if (key.includes('DOCEN') || key.includes('PROFES')) return 'docentes';
        if (key.includes('ADMIN')) return 'administrativos';
        return 'otros';
      };
      const classifyDirection = (value = '') => {
        const key = normalizeFilterKey(value);
        if (key.includes('ENTR')) return 'entrantes';
        if (key.includes('SAL')) return 'salientes';
        return 'sin_direccion';
      };
      const sniesPersonDirection = rows.reduce((acc, row) => {
        const person = classifyPerson(row.tipo_persona);
        const direction = classifyDirection(row.direccion_movilidad);
        if (!acc[person]) acc[person] = { entrantes: 0, salientes: 0, sin_direccion: 0, total: 0 };
        acc[person][direction] = (acc[person][direction] || 0) + 1;
        acc[person].total += 1;
        return acc;
      }, {
        estudiantes: { entrantes: 0, salientes: 0, sin_direccion: 0, total: 0 },
        docentes: { entrantes: 0, salientes: 0, sin_direccion: 0, total: 0 },
        administrativos: { entrantes: 0, salientes: 0, sin_direccion: 0, total: 0 },
        otros: { entrantes: 0, salientes: 0, sin_direccion: 0, total: 0 }
      });
      const initPopulationProfile = () => ({
        total: 0,
        entrantes: { total: 0, entidades: {}, convenios: {}, actividades: {}, tiposMovilidad: {}, paises: {}, departamentos: {}, municipios: {} },
        salientes: { total: 0, entidades: {}, convenios: {}, actividades: {}, tiposMovilidad: {}, paises: {}, departamentos: {}, municipios: {} },
        sin_direccion: { total: 0, entidades: {}, convenios: {}, actividades: {}, tiposMovilidad: {}, paises: {}, departamentos: {}, municipios: {} }
      });
      const addCount = (target, key, fallback = 'Sin dato') => {
        const value = String(key || '').trim() || fallback;
        if (['Sin dato', 'N/A', 'NA', 'N A'].includes(value)) return;
        target[value] = (target[value] || 0) + 1;
      };
      const topFromObject = (obj = {}, limit = 6) => Object.entries(obj)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value || String(a.name).localeCompare(String(b.name), 'es'))
        .slice(0, limit);
      const populationProfilesRaw = {
        estudiantes: initPopulationProfile(),
        docentes: initPopulationProfile(),
        administrativos: initPopulationProfile()
      };
      rows.forEach((row) => {
        const person = classifyPerson(row.tipo_persona);
        if (!populationProfilesRaw[person]) return;
        const direction = classifyDirection(row.direccion_movilidad);
        const bucket = populationProfilesRaw[person][direction] || populationProfilesRaw[person].sin_direccion;
        populationProfilesRaw[person].total += 1;
        bucket.total += 1;
        addCount(bucket.entidades, row.institucion_extranjera);
        addCount(bucket.convenios, row.codigo_convenio || row.movilidad_por_convenio);
        addCount(bucket.actividades, row.actividad_movilidad);
        addCount(bucket.tiposMovilidad, normalizeMobilityType(row.tipo_movilidad));
        addCount(bucket.paises, normalizeCountryName(row.pais_extranjero));
        addCount(bucket.departamentos, row.estado_provincia_departamento);
        addCount(bucket.municipios, row.ciudad_municipio);
      });
      const populationProfiles = Object.fromEntries(Object.entries(populationProfilesRaw).map(([key, value]) => [
        key,
        {
          total: value.total,
          entrantes: {
            total: value.entrantes.total,
            entidades: topFromObject(value.entrantes.entidades),
            convenios: topFromObject(value.entrantes.convenios),
            actividades: topFromObject(value.entrantes.actividades),
            tiposMovilidad: topFromObject(value.entrantes.tiposMovilidad),
            paises: topFromObject(value.entrantes.paises),
            departamentos: topFromObject(value.entrantes.departamentos),
            municipios: topFromObject(value.entrantes.municipios)
          },
          salientes: {
            total: value.salientes.total,
            entidades: topFromObject(value.salientes.entidades),
            convenios: topFromObject(value.salientes.convenios),
            actividades: topFromObject(value.salientes.actividades),
            tiposMovilidad: topFromObject(value.salientes.tiposMovilidad),
            paises: topFromObject(value.salientes.paises),
            departamentos: topFromObject(value.salientes.departamentos),
            municipios: topFromObject(value.salientes.municipios)
          }
        }
      ]));

      const byPeriodo = toArr(count(rows, 'periodo'));
      const byAlcance = toArr(count(rows, 'alcance_movilidad'));
      const byDireccion = toArr(count(rows, 'direccion_movilidad'));
      const byTipoPersona = toArr(count(rows, 'tipo_persona'));
      const byPais = toArr(countNormalized(rows, 'pais_extranjero', normalizeCountryName)).filter((row) => row.name !== 'Sin dato');
      const byActividad = toArr(count(rows, 'actividad_movilidad'));
      const byTipoMovilidad = toArr(countNormalized(rows, 'tipo_movilidad', normalizeMobilityType));
      const byPrograma = toArr(count(rows, 'programa_dependencia')).slice(0, 20);
      const byModalidad = toArr(count(rows, 'modalidad'));
      const heatmapPeriodoDireccion = crossCount(rows, 'direccion_movilidad', 'periodo');
      const institucionesMovilidad = [...new Set(rows.map((r) => String(r.institucion_extranjera || '').trim()).filter(Boolean))].sort();

      const catalogos = {
        periodos: [...new Set(rows.map((r) => r.periodo).filter(Boolean))].sort(),
        alcances: [...new Set(rows.map((r) => r.alcance_movilidad).filter(Boolean))].sort(),
        direcciones: [...new Set(rows.map((r) => r.direccion_movilidad).filter(Boolean))].sort(),
        tiposPersona: [...new Set(rows.map((r) => r.tipo_persona).filter(Boolean))].sort(),
        paises: [...new Set(rows.map((r) => normalizeCountryName(r.pais_extranjero)).filter((item) => item && item !== 'Sin dato'))].sort(),
        programas: [...new Set(rows.map((r) => r.programa_dependencia).filter(Boolean))].sort()
      };

      return res.json({
        success: true,
        data: {
          total: rows.length,
          byPeriodo,
          byAlcance,
          byDireccion,
          byTipoPersona,
          byPais,
          byActividad,
          byTipoMovilidad,
          byPrograma,
          byModalidad,
          heatmapPeriodoDireccion,
          sniesPersonDirection,
          populationProfiles,
          institucionesMovilidad,
          catalogos
        }
      });
    }

    if (aggregate === 'convenios_dashboard') {
      const {
        search: searchConv = '',
        tipo_convenio: tipoConvenioFilter = '',
        anio: anioConvFilter = '',
        programa: programaConvFilter = ''
      } = req.query;

      const conv_where = {};
      if (tipoConvenioFilter) conv_where.tipo_convenio = { [Op.iLike]: `%${tipoConvenioFilter}%` };
      if (anioConvFilter) conv_where.anio = Number(anioConvFilter);
      if (programaConvFilter) conv_where.programa_gestor = { [Op.iLike]: `%${programaConvFilter}%` };
      if (searchConv) {
        conv_where[Op.or] = [
          { convenio_entidad: { [Op.iLike]: `%${searchConv}%` } },
          { tipo_convenio: { [Op.iLike]: `%${searchConv}%` } },
          { programa_gestor: { [Op.iLike]: `%${searchConv}%` } },
          { objeto_convenio: { [Op.iLike]: `%${searchConv}%` } }
        ];
      }

      const rows = await InternacionalizacionConvenio.findAll({
        where: conv_where,
        raw: true,
        order: [['anio', 'DESC'], ['convenio_entidad', 'ASC'], ['id', 'ASC']]
      });

      const catalogos = {
        anios: [...new Set(rows.map((r) => r.anio).filter(Boolean))].sort((a, b) => b - a).map(String),
        tiposConvenio: [...new Set(rows.map((r) => r.tipo_convenio).filter(Boolean))].sort(),
        programas: [...new Set(rows.map((r) => r.programa_gestor).filter(Boolean))].sort()
      };

      return res.json({
        success: true,
        data: { total: rows.length, rows, catalogos }
      });
    }

    if (aggregate === 'poblacional_series' && where.categoria === 'Poblacional') {
      const currentYear = new Date().getFullYear();
      const shouldExcludeCurrentYear = ['1', 'true', 'si', 'sí', 'yes'].includes(
        String(exclude_current_year || '').trim().toLowerCase()
      );
      const maxClosedYear = shouldExcludeCurrentYear ? currentYear - 1 : null;
      const recentYearsNum = Number(recent_years);
      if (shouldExcludeCurrentYear) {
        where[Op.and] = [...(where[Op.and] || []), { anio: { [Op.lte]: maxClosedYear } }];
      }
      if (Number.isFinite(recentYearsNum) && recentYearsNum > 0) {
        const referenceYear = maxClosedYear || currentYear;
        const minYear = referenceYear - Math.trunc(recentYearsNum) + 1;
        where[Op.and] = [...(where[Op.and] || [])];
        where[Op.and].push({ anio: { [Op.gte]: minYear } });
      }

      const useRecordCountMetric = parsedSubcategorias.length > 0
        && parsedSubcategorias.every((sub) => RECORD_COUNT_SUBCATEGORIES.has(sub));
      const useUniqueDetailAggregate = parsedSubcategorias.length > 0
        && parsedSubcategorias.every((sub) => Object.prototype.hasOwnProperty.call(POBLACIONAL_SERIES_UNIQUE_COUNT_CONFIG, sub));
      const uniqueDetailSubcategorias = parsedSubcategorias.filter((sub) => Object.prototype.hasOwnProperty.call(POBLACIONAL_SERIES_UNIQUE_COUNT_CONFIG, sub));
      const genericSubcategorias = parsedSubcategorias.filter((sub) => !Object.prototype.hasOwnProperty.call(POBLACIONAL_SERIES_UNIQUE_COUNT_CONFIG, sub));

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

      if (uniqueDetailSubcategorias.length > 0 && genericSubcategorias.length > 0) {
        const uniqueRows = await buildPoblacionalSeriesUniqueCountRows({
          parsedSubcategorias: uniqueDetailSubcategorias,
          queryFilters: { anio, programa, dependencia, search },
          recentYearsNum,
          maxClosedYear
        });

        const fetchGenericRows = async (subcategories, aggregateMetric) => {
          if (!subcategories.length) return [];
          const scopedWhere = {
            ...where,
            subcategoria: { [Op.in]: subcategories }
          };
          const rows = await Estadistica.findAll({
            where: scopedWhere,
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
          return rows.map((row) => ({
            ...row,
            valor: Number(row.valor || 0)
          }));
        };

        const recordCountSubcategorias = genericSubcategorias.filter((sub) => RECORD_COUNT_SUBCATEGORIES.has(sub));
        const valueSumSubcategorias = genericSubcategorias.filter((sub) => !RECORD_COUNT_SUBCATEGORIES.has(sub));
        const [recordRows, valueRows] = await Promise.all([
          fetchGenericRows(recordCountSubcategorias, fn('COUNT', literal('*'))),
          fetchGenericRows(valueSumSubcategorias, fn('COALESCE', fn('SUM', col('valor')), 0))
        ]);
        const rows = [...uniqueRows, ...recordRows, ...valueRows].sort((a, b) =>
          (Number(a.anio) - Number(b.anio))
          || String(a.subcategoria || '').localeCompare(String(b.subcategoria || ''), 'es')
          || String(a.programa || '').localeCompare(String(b.programa || ''), 'es')
          || String(a.observaciones || '').localeCompare(String(b.observaciones || ''), 'es')
        );

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

    if (aggregate === 'caracterizacion_catalogos' && where.categoria === 'Poblacional') {
      const now = Date.now();
      if (
        caracterizacionCatalogCache
        && (now - caracterizacionCatalogCache.createdAt) < CARACTERIZACION_CATALOG_CACHE_TTL_MS
      ) {
        return res.json({ success: true, data: caracterizacionCatalogCache.data });
      }
      const activeLoadScope = await getCaracterizacionActiveLoadScope();
      const catalogReplacements = {};
      const activeLoadWhere = activeLoadScope.minId ? 'WHERE id >= :activeLoadMinId' : '';
      if (activeLoadScope.minId) catalogReplacements.activeLoadMinId = activeLoadScope.minId;

      const catalogRows = await PoblacionalCaracterizacion.sequelize.query(`
        SELECT
          COALESCE(
            NULLIF(SUBSTRING(COALESCE(periodo, '') FROM '19[0-9]{2}|20[0-9]{2}'), '')::integer,
            anio,
            0
          ) AS derived_anio,
          CASE
            WHEN UPPER(COALESCE(periodo, '')) ~ '(^|[^A-Z0-9])(IIP|II|2)($|[^A-Z0-9])' THEN 2
            ELSE 1
          END AS period_order,
          NULLIF(BTRIM(programa), '') AS programa,
          COUNT(*)::bigint AS total
        FROM poblacional_caracterizacion
        ${activeLoadWhere}
        GROUP BY derived_anio, period_order, NULLIF(BTRIM(programa), '')
        ORDER BY derived_anio, period_order, programa
      `, { replacements: catalogReplacements, type: QueryTypes.SELECT });

      const programLabels = new Map();
      const periodMap = new Map();
      const years = new Set();
      catalogRows.forEach((row) => {
        const anioValue = Number(row.derived_anio) || 0;
        const periodOrder = Number(row.period_order) || 1;
        if (anioValue > 0) {
          years.add(anioValue);
          const label = `${anioValue}-${periodOrder}`;
          periodMap.set(label, { label, anio: anioValue, order: anioValue * 10 + periodOrder });
        }
        const rawProgram = String(row.programa || '').replace(/\s+/g, ' ').trim();
        const programKey = normalizeProgramAggregateKey(rawProgram);
        if (programKey) {
          programLabels.set(programKey, selectPreferredAggregateLabel(programLabels.get(programKey), rawProgram));
        }
      });

      const data = {
        anios: Array.from(years).sort((a, b) => a - b),
        periodos: Array.from(periodMap.values()).sort((a, b) => a.order - b.order),
        programas: Array.from(programLabels.values()).sort((a, b) => a.localeCompare(b, 'es')),
        registrosActivos: activeLoadScope.totalCargados
      };
      caracterizacionCatalogCache = { createdAt: now, data };
      return res.json({ success: true, data });
    }

    if (aggregate === 'caracterizacion_dashboard' && where.categoria === 'Poblacional') {
      const programas = parseQueryListParam(req.query, 'programas');
      const aniosList = parseQueryListParam(req.query, 'anios').map((x) => Number(x)).filter((x) => Number.isFinite(x));
      const periodos = parseQueryListParam(req.query, 'periodos');
      const replacements = {};
      const activeLoadScope = await getCaracterizacionActiveLoadScope();
      const normalizedProgramas = Array.from(new Set(programas.map((item) => normalizeComparableText(item)).filter(Boolean)));
      const cacheKey = JSON.stringify({
        mode: 'latest-active-load-v3',
        activeLoadMinId: activeLoadScope.minId,
        programas: [...normalizedProgramas].sort(),
        anios: [...aniosList].sort((a, b) => a - b),
        periodos: [...periodos].sort()
      });
      const cachedDashboard = getCaracterizacionDashboardCache(cacheKey);
      if (cachedDashboard) {
        return res.json({ success: true, data: cachedDashboard });
      }
      const normalizedFilters = [];
      const derivedAnioSql = `COALESCE(
        NULLIF(SUBSTRING(COALESCE(periodo, '') FROM '19[0-9]{2}|20[0-9]{2}'), '')::integer,
        anio,
        0
      )`;
      const periodOrderSql = `CASE
        WHEN UPPER(COALESCE(periodo, '')) ~ '(^|[^A-Z0-9])(IIP|II|2)($|[^A-Z0-9])' THEN 2
        ELSE 1
      END`;

      if (activeLoadScope.minId) {
        replacements.activeLoadMinId = activeLoadScope.minId;
        normalizedFilters.push('id >= :activeLoadMinId');
      }

      if (normalizedProgramas.length) {
        replacements.programas = normalizedProgramas;
        normalizedFilters.push(`
          BTRIM(REGEXP_REPLACE(
            TRANSLATE(UPPER(COALESCE(programa, '')), 'ÁÉÍÓÚÜÑ', 'AEIOUUN'),
            '[^A-Z0-9]+', ' ', 'g'
          )) IN (:programas)
        `);
      }
      if (aniosList.length) {
        replacements.anios = aniosList;
        normalizedFilters.push('anio IN (:anios)');
      }
      if (periodos.length) {
        replacements.rawPeriodos = periodos.map((periodLabel) => {
          const [year, slot] = String(periodLabel || '').split('-');
          return `${year} ${slot === '2' ? 'IIP' : 'IP'}`.trim().toUpperCase();
        });
        normalizedFilters.push("UPPER(BTRIM(COALESCE(periodo, ''))) IN (:rawPeriodos)");
      }

      // PostgreSQL devuelve solamente los agregados. Antes se transferían las 118.886 filas
      // a Node para contarlas en memoria, aumentando el tiempo y el consumo por solicitud.
      const aggregateRows = await PoblacionalCaracterizacion.sequelize.query(`
        WITH normalized AS MATERIALIZED (
          SELECT
            ${derivedAnioSql} AS derived_anio,
            ${periodOrderSql} AS period_order,
            CASE
              WHEN UPPER(BTRIM(COALESCE(genero, ''))) LIKE '%NO BIN%' THEN 'NO BINARIO'
              WHEN UPPER(BTRIM(COALESCE(genero, ''))) = 'F' OR UPPER(BTRIM(COALESCE(genero, ''))) LIKE '%FEM%' THEN 'FEMENINO'
              WHEN UPPER(BTRIM(COALESCE(genero, ''))) = 'M' OR UPPER(BTRIM(COALESCE(genero, ''))) LIKE '%MAS%' THEN 'MASCULINO'
              ELSE COALESCE(NULLIF(UPPER(BTRIM(genero)), ''), 'SIN INFORMACION')
            END AS genero_label,
            CASE
              WHEN UPPER(BTRIM(COALESCE(victima_conflicto_armado, ''))) IN ('SI', 'SÍ', 'YES') THEN 'SI'
              WHEN UPPER(BTRIM(COALESCE(victima_conflicto_armado, ''))) IN ('NO', 'N') THEN 'NO'
              ELSE COALESCE(NULLIF(UPPER(BTRIM(victima_conflicto_armado)), ''), 'SIN INFORMACION')
            END AS victima_label,
            COALESCE(NULLIF(BTRIM(estrato), ''), 'Sin informacion') AS estrato_label,
            COALESCE(NULLIF(UPPER(BTRIM(municipio_residencia)), ''), 'SIN INFORMACION') AS municipio_residencia_label,
            COALESCE(NULLIF(UPPER(BTRIM(grupo_etnico)), ''), 'SIN INFORMACION') AS grupo_etnico_label
          FROM poblacional_caracterizacion
          ${normalizedFilters.length ? `WHERE ${normalizedFilters.join(' AND ')}` : ''}
        ),
        scoped AS MATERIALIZED (
          SELECT * FROM normalized
        )
        SELECT 'total'::text AS dimension, 'TOTAL'::text AS label, COUNT(*)::bigint AS total, NULL::integer AS anio, NULL::integer AS period_order
        FROM scoped
        UNION ALL
        SELECT 'periodo', derived_anio::text || '-' || period_order::text, COUNT(*)::bigint, derived_anio, period_order
        FROM scoped GROUP BY derived_anio, period_order
        UNION ALL
        SELECT 'victimas_distribucion', victima_label, COUNT(*)::bigint, NULL::integer, NULL::integer
        FROM scoped GROUP BY victima_label
        UNION ALL
        SELECT 'victimas_genero', genero_label, COUNT(*)::bigint, NULL::integer, NULL::integer
        FROM scoped WHERE victima_label = 'SI' GROUP BY genero_label
        UNION ALL
        SELECT 'victimas_estrato', estrato_label, COUNT(*)::bigint, NULL::integer, NULL::integer
        FROM scoped WHERE victima_label = 'SI' GROUP BY estrato_label
        UNION ALL
        SELECT 'victimas_municipio_residencia', municipio_residencia_label, COUNT(*)::bigint, NULL::integer, NULL::integer
        FROM scoped WHERE victima_label = 'SI' GROUP BY municipio_residencia_label
        UNION ALL
        SELECT 'afro_genero', genero_label, COUNT(*)::bigint, NULL::integer, NULL::integer
        FROM scoped WHERE grupo_etnico_label ~ '(AFRO|NEGRA|PALENQ|RAIZAL)' GROUP BY genero_label
        UNION ALL
        SELECT 'genero_general', genero_label, COUNT(*)::bigint, NULL::integer, NULL::integer
        FROM scoped GROUP BY genero_label
        UNION ALL
        SELECT 'estratos', estrato_label, COUNT(*)::bigint, NULL::integer, NULL::integer
        FROM scoped GROUP BY estrato_label
        UNION ALL
        SELECT 'grupos_etnicos', grupo_etnico_label, COUNT(*)::bigint, NULL::integer, NULL::integer
        FROM scoped GROUP BY grupo_etnico_label
      `, { replacements, type: QueryTypes.SELECT });

      const byDimension = (dimension) => aggregateRows
        .filter((row) => row.dimension === dimension)
        .map((row) => ({ label: row.label, total: Number(row.total || 0) }))
        .sort((a, b) => b.total - a.total);
      const totalRegistros = Number(aggregateRows.find((row) => row.dimension === 'total')?.total || 0);
      const victimasDistribucion = byDimension('victimas_distribucion');
      const victimasGenero = byDimension('victimas_genero');
      const victimasEstrato = byDimension('victimas_estrato');
      const victimasMunicipioResidencia = byDimension('victimas_municipio_residencia');
      const afroGenero = byDimension('afro_genero');
      const victimasTotal = Number(victimasDistribucion.find((row) => row.label === 'SI')?.total || 0);
      const afroTotal = afroGenero.reduce((sum, row) => sum + row.total, 0);
      const periodSeries = aggregateRows
        .filter((row) => row.dimension === 'periodo')
        .map((row) => ({
          periodLabel: row.label,
          anio: Number(row.anio) || 0,
          periodOrder: (Number(row.anio) || 0) * 10 + (Number(row.period_order) || 1),
          total: Number(row.total || 0)
        }))
        .sort((a, b) => a.periodOrder - b.periodOrder);

      const dashboardData = {
        totalRegistros,
        registrosBaseActiva: activeLoadScope.totalCargados,
        periodSeries,
        victimas: {
          total: victimasTotal,
          distribucion: victimasDistribucion,
          genero: victimasGenero,
          estratos: victimasEstrato,
          municipiosResidencia: victimasMunicipioResidencia
        },
        afrodescendientes: {
          total: afroTotal,
          genero: afroGenero
        },
        generoGeneral: {
          distribucion: byDimension('genero_general')
        },
        estratos: {
          distribucion: byDimension('estratos')
        },
        gruposEtnicos: {
          distribucion: byDimension('grupos_etnicos')
        }
      };
      setCaracterizacionDashboardCache(cacheKey, dashboardData);
      return res.json({ success: true, data: dashboardData });
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
      const scope = normalizeText(req.query.scope).toLowerCase();
      const includeDocentes = !scope || ['docentes', 'profesores'].includes(scope);
      const includeAdministrativos = !scope || ['administrativos', 'directivos', 'admin'].includes(scope);
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
        includeDocentes ? RecursoHumanoDocente.findAll({
          attributes: [
            'anio', 'periodo', 'docente', 'genero_biologico', 'departamento_dependencia', 'programa',
            'nivel_contratacion', 'tipo_vinculacion', 'contrato', 'cargo', 'escalafon', 'total_horas', 'total_docentes', 'edad',
            [literal(`COALESCE("raw_data"->>'NIVEL MAXIMO ESTUDIO', "raw_data"->>'NIVEL_MAXIMO_ESTUDIO', "raw_data"->>'nivel_maximo_estudio')`), 'nivel_maximo_estudio']
          ],
          raw: true
        }) : Promise.resolve([]),
        includeAdministrativos ? RecursoHumanoAdministrativo.findAll({
          attributes: [
            'anio', 'periodo', 'estado_laboral', 'nombre_empleado', 'cargo_especifico', 'dependencia',
            'vicerectoria', 'clase_contrato', 'genero_biologico', 'sueldo_anual', 'sueldo_mes',
            [literal(`COALESCE("raw_data"->>'GRADO', "raw_data"->>'grado')`), 'grado']
          ],
          raw: true
        }) : Promise.resolve([]),
        includeAdministrativos ? RecursoHumanoOutsourcing.findAll({
          attributes: ['anio', 'periodo', 'cargo', 'genero_biologico', 'cantidad'],
          raw: true
        }) : Promise.resolve([]),
        includeAdministrativos ? RecursoHumanoOnda.findAll({
          attributes: ['anio', 'periodo', 'nombre', 'genero'],
          raw: true
        }) : Promise.resolve([])
      ]);

      const docentes = docentesRows.map((row) => ({
        ...row,
        genero: normalizeGenero(row.genero_biologico),
        nivel_maximo_estudio: normalizeText(row.nivel_maximo_estudio),
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
              nivelesContratacion: uniq(docentes, 'nivel_contratacion'),
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
            porNivelContratacion: asList(docentes, 'nivel_contratacion', 'peso'),
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

const exportCaracterizacionRegistros = async (req, res) => {
  try {
    const programas = parseQueryListParam(req.query, 'programas');
    const anios = parseQueryListParam(req.query, 'anios')
      .map((value) => Number(value))
      .filter(Number.isFinite);
    const periodos = parseQueryListParam(req.query, 'periodos');
    const dimension = String(req.query.dimension || 'total').trim().toLowerCase();

    if (anios.length !== 1 || periodos.length !== 1) {
      return res.status(400).json({
        success: false,
        message: 'Selecciona exactamente un ano y un periodo antes de exportar.'
      });
    }

    const dimensionFilters = {
      total: '',
      genero: '',
      estratos: '',
      grupos_etnicos: '',
      victimas: "UPPER(BTRIM(COALESCE(victima_conflicto_armado, ''))) IN ('SI', 'SÃ', 'YES')",
      victimas_genero: "UPPER(BTRIM(COALESCE(victima_conflicto_armado, ''))) IN ('SI', 'SÃ', 'YES')",
      victimas_estratos: "UPPER(BTRIM(COALESCE(victima_conflicto_armado, ''))) IN ('SI', 'SÃ', 'YES')",
      victimas_municipios: "UPPER(BTRIM(COALESCE(victima_conflicto_armado, ''))) IN ('SI', 'SÃ', 'YES')",
      afrodescendientes: "UPPER(BTRIM(COALESCE(grupo_etnico, ''))) ~ '(AFRO|NEGRA|PALENQ|RAIZAL)'",
      afro_genero: "UPPER(BTRIM(COALESCE(grupo_etnico, ''))) ~ '(AFRO|NEGRA|PALENQ|RAIZAL)'",
      pertenencia_etnica: `
        UPPER(BTRIM(COALESCE(grupo_etnico, ''))) NOT LIKE '%NO APLICA%'
        AND UPPER(BTRIM(COALESCE(grupo_etnico, ''))) NOT LIKE '%SIN INFORMACION%'
        AND UPPER(BTRIM(COALESCE(grupo_etnico, ''))) NOT LIKE '%SIN INFORMACIÃ“N%'
        AND BTRIM(COALESCE(grupo_etnico, '')) <> ''
      `
    };

    if (!Object.prototype.hasOwnProperty.call(dimensionFilters, dimension)) {
      return res.status(400).json({ success: false, message: 'Dimension de exportacion no valida.' });
    }

    const activeLoadScope = await getCaracterizacionActiveLoadScope();
    const [periodYear, periodSlot] = String(periodos[0] || '').split('-');
    const replacements = {
      anio: anios[0],
      periodo: `${periodYear} ${periodSlot === '2' ? 'IIP' : 'IP'}`.trim().toUpperCase()
    };
    const filters = [
      'anio = :anio',
      "UPPER(BTRIM(COALESCE(periodo, ''))) = :periodo"
    ];

    if (activeLoadScope.minId) {
      replacements.activeLoadMinId = activeLoadScope.minId;
      filters.push('id >= :activeLoadMinId');
    }

    const normalizedProgramas = Array.from(new Set(
      programas.map((item) => normalizeComparableText(item)).filter(Boolean)
    ));
    if (normalizedProgramas.length) {
      replacements.programas = normalizedProgramas;
      filters.push(`
        BTRIM(REGEXP_REPLACE(
          TRANSLATE(UPPER(COALESCE(programa, '')), 'ÃÃ‰ÃÃ“ÃšÃœÃ‘', 'AEIOUUN'),
          '[^A-Z0-9]+', ' ', 'g'
        )) IN (:programas)
      `);
    }

    if (dimensionFilters[dimension]) filters.push(dimensionFilters[dimension]);

    const records = await PoblacionalCaracterizacion.sequelize.query(`
      SELECT *
      FROM poblacional_caracterizacion
      WHERE ${filters.join(' AND ')}
      ORDER BY id ASC
    `, { replacements, type: QueryTypes.SELECT });

    const exportRows = records.map((row) => ({
      ID_REGISTRO: row.id,
      ANO: row.anio,
      PERIODO: row.periodo,
      NUMERO_IDENTIFICACION: row.no_identificacion,
      TIPO_DOCUMENTACION: row.tipo_documentacion,
      PROGRAMA: row.programa,
      CODIGO: row.codigo,
      SEMESTRE: row.semestre,
      APELLIDOS_NOMBRES: row.apellidos_nombres,
      GENERO: row.genero,
      VICTIMA_CONFLICTO_ARMADO: row.victima_conflicto_armado,
      CORREO_ELECTRONICO: row.correo_electronico,
      PERSONAS_A_CARGO: row.personas_a_cargo,
      ESTADO_CIVIL: row.estado_civil,
      GRUPO_ETNICO: row.grupo_etnico,
      EPS: row.eps,
      MUNICIPIO_RESIDENCIA: row.municipio_residencia,
      DEPARTAMENTO_RESIDENCIA: row.departamento_residencia,
      PAIS_RESIDENCIA: row.pais_residencia,
      DISCAPACIDAD: row.discapacidad,
      NUCLEO_FAMILIAR: row.nucleo_familiar,
      ESTRATO: row.estrato,
      INGRESOS_FAMILIARES: row.ingresos_familiares,
      INGRESOS_FAMILIARES_2: row.ingresos_familiares_2,
      INSTITUCION: row.institucion,
      TITULO_OBTENIDO: row.titulo_obtenido,
      TIPO_CREDITO: row.tipo_credito,
      EDAD: row.edad,
      ZONA_PROCEDENCIA: row.zona_procedencia,
      FECHA_CARGA: row.created_at
    }));

    const workbook = XLSX.utils.book_new();
    const contextSheet = XLSX.utils.aoa_to_sheet([
      ['EXPORTACION DE EVIDENCIA - CARACTERIZACION ESTUDIANTIL'],
      ['Fecha de generacion', new Date().toLocaleString('es-CO')],
      ['Ano', anios[0]],
      ['Periodo', replacements.periodo],
      ['Programas', programas.length ? programas.join(', ') : 'TODOS'],
      ['Dimension', dimension],
      ['Registros exportados', exportRows.length],
      ['Usuario', req.user?.email || req.user?.id || '']
    ]);
    contextSheet['!cols'] = [{ wch: 26 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(workbook, contextSheet, 'CONTEXTO');

    const dataSheet = exportRows.length
      ? XLSX.utils.json_to_sheet(exportRows)
      : XLSX.utils.aoa_to_sheet([['SIN REGISTROS PARA LOS FILTROS SELECCIONADOS']]);
    if (exportRows.length) {
      dataSheet['!autofilter'] = { ref: dataSheet['!ref'] };
      dataSheet['!cols'] = Object.keys(exportRows[0]).map((key) => ({
        wch: Math.max(14, Math.min(38, key.length + 4))
      }));
    }
    XLSX.utils.book_append_sheet(workbook, dataSheet, 'REGISTROS_COMPLETOS');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const safeDimension = dimension.replace(/[^a-z0-9_-]+/g, '_');
    const filename = `evidencia_caracterizacion_${safeDimension}_${anios[0]}_${periodos[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error) {
    console.error('Error al exportar evidencia de caracterizacion:', error);
    return res.status(500).json({ success: false, message: 'No fue posible exportar la evidencia de caracterizacion.' });
  }
};

const getResumen = async (req, res) => {
  try {
    const { anio = '' } = req.query;
    const where = {};
    if (isAutoevaluacionRole(req)) where.categoria = 'Autoevaluación';
    if (anio) where.anio = Number(anio);

    const [totalRegistros, totalCategorias, aniosActivos, totalValor, infraCount, rcCount] = await Promise.all([
      Estadistica.count({ where }),
      Estadistica.count({ where, distinct: true, col: 'categoria' }),
      Estadistica.count({ where, distinct: true, col: 'anio' }),
      Estadistica.findOne({
        where,
        attributes: [[fn('COALESCE', fn('SUM', col('valor')), 0), 'sumValor']],
        raw: true
      }),
      PoblacionalInfraestructuraFisica.count().catch(() => 0),
      RegistroCalificadoHistorico.count().catch(() => 0)
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

    const finalTopCategorias = topCategorias.map((item) => ({
      categoria: item.categoria,
      total: Number(item.total || 0),
      valorTotal: Number(item.valorTotal || 0)
    }));

    if (!where.categoria || where.categoria === 'Infraestructura Física') {
      finalTopCategorias.push({
        categoria: 'Infraestructura Física',
        total: infraCount,
        valorTotal: 0
      });
    }

    if (!where.categoria || where.categoria === 'Registros Calificados y Acreditación') {
      finalTopCategorias.push({
        categoria: 'Registros Calificados y Acreditación',
        total: rcCount,
        valorTotal: 0
      });
    }

    return res.json({
      success: true,
      data: {
        totales: {
          registros: totalRegistros + (where.categoria ? 0 : (infraCount + rcCount)),
          categorias: totalCategorias + (where.categoria ? 0 : 2),
          anios: aniosActivos,
          valorAcumulado: Number(totalValor?.sumValor || 0)
        },
        topCategorias: finalTopCategorias
      }
    });
  } catch (error) {
    console.error('Error al obtener resumen estadístico:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener resumen estadístico' });
  }
};

const getCargues = async (req, res) => {
  try {
    const { categoria = '', subcategoria = '', page = 1, limit = 50 } = req.query;
    const where = {};
    if (categoria) where.categoria = categoria;
    if (subcategoria) where.subcategoria = subcategoria;
    if (isAutoevaluacionRole(req)) where.categoria = 'Autoevaluación';

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
    if (isAutoevaluacionRole(req)) fallbackWhere.categoria = 'Autoevaluación';

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

const AUTOEVALUACION_EDITABLE_FIELDS = [
  'acuerdo_men',
  'programa',
  'factor',
  'caracteristica',
  'aspectos_por_evaluar',
  'indicador',
  'instrumento',
  'scrit',
  'componente',
  'evidencias',
  'informacion_para_tener_en_cuenta'
];

const AUTOEVALUACION_PARTICIPANTE_EDITABLE_FIELDS = [
  'programa',
  'alcance_autoevaluacion',
  'acta_inicio_url',
  'cronograma_url',
  'nombres_completos',
  'documento',
  'cargo',
  'rol_en_proceso'
];

const AUTOEVALUACION_PROGRAMA_EDITABLE_FIELDS = [
  'programa',
  'proceso_autoevaluacion',
  'facultad',
  'nivel_formacion',
  'renovacion_registro_calificado',
  'codigo_snies',
  'titulo_otorga',
  'email_programa',
  'duracion_formacion',
  'numero_creditos',
  'estudiantes_primer_curso'
];

const pickEditableAutoevaluacionFields = (body = {}, allowedFields = []) => (
  allowedFields.reduce((acc, field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      acc[field] = normalizeText(body[field]);
    }
    return acc;
  }, {})
);

const updateAutoevaluacionAspecto = async (req, res) => {
  try {
    const row = await Autoevaluacion.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Aspecto de autoevaluaciÃƒÆ’Ã‚Â³n no encontrado' });
    }

    const nextData = {
      ...pickEditableAutoevaluacionFields(req.body, AUTOEVALUACION_EDITABLE_FIELDS),
      actualizado_por: req.user?.id || null
    };

    await row.update(nextData);
    return res.json({
      success: true,
      message: 'Texto de autoevaluaciÃƒÆ’Ã‚Â³n actualizado',
      data: { aspecto: row }
    });
  } catch (error) {
    console.error('Error al actualizar aspecto de autoevaluaciÃƒÆ’Ã‚Â³n:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar aspecto de autoevaluaciÃƒÆ’Ã‚Â³n' });
  }
};

const updateAutoevaluacionParticipante = async (req, res) => {
  try {
    const row = await AutoevaluacionParticipante.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Participante de autoevaluaciÃƒÆ’Ã‚Â³n no encontrado' });
    }

    const nextData = {
      ...pickEditableAutoevaluacionFields(req.body, AUTOEVALUACION_PARTICIPANTE_EDITABLE_FIELDS),
      actualizado_por: req.user?.id || null
    };

    await row.update(nextData);
    return res.json({
      success: true,
      message: 'Participante de autoevaluaciÃƒÆ’Ã‚Â³n actualizado',
      data: { participante: row }
    });
  } catch (error) {
    console.error('Error al actualizar participante de autoevaluaciÃƒÆ’Ã‚Â³n:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar participante de autoevaluaciÃƒÆ’Ã‚Â³n' });
  }
};

const deleteAutoevaluacionParticipante = async (req, res) => {
  try {
    const row = await AutoevaluacionParticipante.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Participante de autoevaluación no encontrado' });
    }

    await row.destroy();
    return res.json({
      success: true,
      message: 'Participante eliminado del equipo de autoevaluación'
    });
  } catch (error) {
    console.error('Error al eliminar participante de autoevaluación:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar participante de autoevaluación' });
  }
};

const createAutoevaluacionParticipante = async (req, res) => {
  try {
    await ensureAutoevaluacionTable();
    const payload = pickEditableAutoevaluacionFields(req.body, AUTOEVALUACION_PARTICIPANTE_EDITABLE_FIELDS);
    if (!payload.programa || !payload.alcance_autoevaluacion || !payload.nombres_completos) {
      return res.status(400).json({
        success: false,
        message: 'Campos obligatorios: programa, alcance y nombres completos'
      });
    }

    const row = await AutoevaluacionParticipante.create({
      ...payload,
      creado_por: req.user?.id || null,
      actualizado_por: req.user?.id || null
    });

    return res.status(201).json({
      success: true,
      message: 'Participante de autoevaluaciÃƒÆ’Ã‚Â³n creado',
      data: { participante: row }
    });
  } catch (error) {
    console.error('Error al crear participante de autoevaluaciÃƒÆ’Ã‚Â³n:', error);
    return res.status(500).json({ success: false, message: 'Error al crear participante de autoevaluaciÃƒÆ’Ã‚Â³n' });
  }
};

const updateAutoevaluacionPrograma = async (req, res) => {
  try {
    const row = await AutoevaluacionPrograma.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Información del programa no encontrada' });
    }

    const nextData = {
      ...pickEditableAutoevaluacionFields(req.body, AUTOEVALUACION_PROGRAMA_EDITABLE_FIELDS),
      actualizado_por: req.user?.id || null
    };

    await row.update(nextData);
    return res.json({
      success: true,
      message: 'Información del programa actualizada',
      data: { programa: row }
    });
  } catch (error) {
    console.error('Error al actualizar información del programa:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar información del programa' });
  }
};

const createAutoevaluacionPrograma = async (req, res) => {
  try {
    await ensureAutoevaluacionTable();
    const payload = pickEditableAutoevaluacionFields(req.body, AUTOEVALUACION_PROGRAMA_EDITABLE_FIELDS);
    if (!payload.programa) {
      return res.status(400).json({
        success: false,
        message: 'Campo obligatorio: programa'
      });
    }

    const row = await AutoevaluacionPrograma.create({
      ...payload,
      creado_por: req.user?.id || null,
      actualizado_por: req.user?.id || null
    });

    return res.status(201).json({
      success: true,
      message: 'Información del programa creada',
      data: { programa: row }
    });
  } catch (error) {
    console.error('Error al crear información del programa:', error);
    return res.status(500).json({ success: false, message: 'Error al crear información del programa' });
  }
};

const deleteEstadistica = async (req, res) => {
  try {
    const { id } = req.params;
    const estadistica = await Estadistica.findByPk(id);
    if (!estadistica) {
      return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    }

    if (estadistica.categoria === 'Poblacional') {
      clearAllPoblacionalCaches();
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
    const internacionalizacionConfig = categoria === DATASET_CATEGORIES.internacionalizacion ? resolveInternacionalizacionConfig(req.query.subcategoria) : null;
    const contextoTemplateHeaders = (categoria === 'Poblacional' && poblacionalConfig?.customImport === 'contexto_externo')
      ? resolveContextoExternoTemplateHeaders(fixedSubSubcategoria)
      : null;
    if (!categoria) {
      return res.status(400).json({ success: false, message: 'Debes enviar la categoria de la base de datos' });
    }
    if (!enforceAutoevaluacionDatasetScope(req, res, categoria)) return null;

    if (categoria === 'Infraestructura Física') {
      const worksheet = buildHeaderOnlyWorksheet(INFRAESTRUCTURA_FISICA_TEMPLATE_HEADERS);
      worksheet['!cols'] = INFRAESTRUCTURA_FISICA_TEMPLATE_HEADERS.map((header) => ({ wch: Math.max(16, String(header).length + 4) }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'INFRAESTRUCTURA');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', 'attachment; filename=plantilla_infraestructura_fisica.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
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

    if (categoria === 'Plan de Acción') {
      const workbook = XLSX.utils.book_new();

      const estructuraSheet = XLSX.utils.aoa_to_sheet([['Nombre de campo', 'Contenido'], ...PLAN_ACCION_ESTRUCTURA_ROWS]);
      estructuraSheet['!cols'] = [{ wch: 32 }, { wch: 70 }];
      XLSX.utils.book_append_sheet(workbook, estructuraSheet, 'ESTRUCTURA');

      const dataSheet = buildHeaderOnlyWorksheet(PLAN_ACCION_TEMPLATE_HEADERS);
      dataSheet['!cols'] = PLAN_ACCION_TEMPLATE_HEADERS.map((header) => ({
        wch: Math.max(16, Math.min(42, String(header).length + 6))
      }));
      XLSX.utils.book_append_sheet(workbook, dataSheet, 'PLAN DE ACCION');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', 'attachment; filename=plantilla_plan_de_accion.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    if (categoria === 'Autoevaluación') {
      const workbook = XLSX.utils.book_new();
      const subbaseToken = normalizeCategoryToken(subcategoriaRaw);
      const autoevaluacionSubbase = subbaseToken === 'participantes'
        ? 'participantes'
        : isAutoevaluacionProgramasSubbase(subcategoriaRaw)
          ? 'informacion_programas'
        : 'autoevaluacion';

      const structureRows = autoevaluacionSubbase === 'participantes'
        ? AUTOEVALUACION_PARTICIPANTES_ESTRUCTURA_ROWS
        : autoevaluacionSubbase === 'informacion_programas'
          ? AUTOEVALUACION_PROGRAMAS_ESTRUCTURA_ROWS
          : AUTOEVALUACION_ESTRUCTURA_ROWS;
      const headers = autoevaluacionSubbase === 'participantes'
        ? AUTOEVALUACION_PARTICIPANTES_TEMPLATE_HEADERS
        : autoevaluacionSubbase === 'informacion_programas'
          ? AUTOEVALUACION_PROGRAMAS_TEMPLATE_HEADERS
          : AUTOEVALUACION_TEMPLATE_HEADERS;
      const dataSheetName = autoevaluacionSubbase === 'participantes'
        ? 'PARTICIPANTES'
        : autoevaluacionSubbase === 'informacion_programas'
          ? 'INFORMACION_PROGRAMAS'
          : 'AUTOEVALUACION';

      const estructuraSheet = XLSX.utils.aoa_to_sheet([['Nombre de campo', 'Contenido'], ...structureRows]);
      estructuraSheet['!cols'] = [{ wch: 36 }, { wch: 78 }];
      XLSX.utils.book_append_sheet(workbook, estructuraSheet, 'ESTRUCTURA');

      const dataSheet = buildHeaderOnlyWorksheet(headers);
      dataSheet['!cols'] = headers.map((header) => ({
        wch: Math.max(16, Math.min(48, String(header).length + 8))
      }));
      XLSX.utils.book_append_sheet(workbook, dataSheet, dataSheetName);

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const filename = autoevaluacionSubbase === 'participantes'
        ? 'plantilla_autoevaluacion_participantes.xlsx'
        : autoevaluacionSubbase === 'informacion_programas'
          ? 'plantilla_autoevaluacion_informacion_programas.xlsx'
          : 'plantilla_autoevaluacion.xlsx';
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    if (categoria === 'Registros Calificados y Acreditación') {
      const workbook = XLSX.utils.book_new();
      const estructuraSheet = XLSX.utils.aoa_to_sheet([['Nombre de campo', 'Contenido'], ...REGISTROS_CALIFICADOS_ESTRUCTURA_ROWS]);
      estructuraSheet['!cols'] = [{ wch: 34 }, { wch: 86 }];
      XLSX.utils.book_append_sheet(workbook, estructuraSheet, 'ESTRUCTURA');

      const dataSheet = buildHeaderOnlyWorksheet(REGISTROS_CALIFICADOS_TEMPLATE_HEADERS);
      dataSheet['!cols'] = REGISTROS_CALIFICADOS_TEMPLATE_HEADERS.map((header) => ({
        wch: Math.max(16, Math.min(52, String(header).length + 10))
      }));
      XLSX.utils.book_append_sheet(workbook, dataSheet, REGISTROS_CALIFICADOS_SUBBASE);

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', 'attachment; filename=plantilla_registros_calificados_historico_rc.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    if (categoria === GESTION_PROCESOS_CATEGORY) {
      const workbook = XLSX.utils.book_new();
      GESTION_PROCESOS_TEMPLATE_SHEETS.forEach((sheet) => {
        const worksheet = buildHeaderOnlyWorksheet(sheet.headers);
        worksheet['!cols'] = sheet.headers.map((header) => ({
          wch: Math.max(14, Math.min(42, String(header).length + 8))
        }));
        XLSX.utils.book_append_sheet(workbook, worksheet, sheet.sheetName);
      });
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', 'attachment; filename=plantilla_gestion_procesos.xlsx');
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

    if (categoria === DATASET_CATEGORIES.internacionalizacion) {
      if (subcategoriaRaw && !internacionalizacionConfig) {
        return res.status(400).json({ success: false, message: 'Subbase de Internacionalizacion no valida' });
      }

      const workbook = XLSX.utils.book_new();
      const estructuraSheet = XLSX.utils.aoa_to_sheet([
        ['Campo plantilla', 'Comentario / equivalente original'],
        ...INTERNACIONALIZACION_ESTRUCTURA_ROWS
      ]);
      estructuraSheet['!cols'] = [{ wch: 34 }, { wch: 90 }];
      XLSX.utils.book_append_sheet(workbook, estructuraSheet, 'ESTRUCTURA');

      const configs = Array.isArray(internacionalizacionConfig?.configs)
        ? internacionalizacionConfig.configs
        : internacionalizacionConfig
          ? [internacionalizacionConfig]
          : Object.values(INTERNACIONALIZACION_SUBCATEGORY_CONFIG);
      configs.forEach((config) => {
        const headers = config.headers || [];
        const worksheet = buildHeaderOnlyWorksheet(headers);
        worksheet['!cols'] = headers.map((header) => ({ wch: Math.max(16, Math.min(42, String(header).length + 8)) }));
        const sheetName = (config.sheetNames?.[0] || config.label || 'DATA').slice(0, 31);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      });

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const suffix = internacionalizacionConfig ? `_${normalizeHeader(internacionalizacionConfig.label).toLowerCase()}` : '_completa';
      res.setHeader('Content-Disposition', `attachment; filename=plantilla_internacionalizacion${suffix}.xlsx`);
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
    const internacionalizacionConfig = categoria === DATASET_CATEGORIES.internacionalizacion ? resolveInternacionalizacionConfig(fixedSubcategoria) : null;
    const contextoCargaConfig = (categoria === 'Poblacional' && (poblacionalConfig?.customImport === 'contexto_externo'))
      ? resolveContextoExternoCargaConfig(fixedSubSubcategoria)
      : null;
    if (!categoria) {
      return res.status(400).json({ success: false, message: 'Debes seleccionar la base de datos destino' });
    }
    if (!enforceAutoevaluacionDatasetScope(req, res, categoria)) return null;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se proporciono archivo Excel o CSV' });
    }

    const uploadFileName = String(req.file?.originalname || req.file?.filename || '').trim();
    const uploadExt = path.extname(uploadFileName).toLowerCase();
    const isCsvUpload = uploadExt === '.csv';
    const allowsCsvStreaming = (
      categoria === 'Georreferencia'
      || categoria === 'Autoevaluación'
      || categoria === 'Registros Calificados y Acreditación'
      || categoria === 'Recurso Humano'
      || categoria === DATASET_CATEGORIES.internacionalizacion
      || (categoria === 'Poblacional' && poblacionalConfig?.label === 'Matriculados')
      || (categoria === 'Poblacional'
        && poblacionalConfig?.customImport === 'contexto_externo'
        && contextoCargaConfig?.onlyType === 'serie')
    );
    let workbook = null;

    if (isCsvUpload && !allowsCsvStreaming) {
      return res.status(400).json({
        success: false,
        message: 'El formato CSV solo esta habilitado para Georreferencia, Autoevaluacion, Recurso Humano, Internacionalizacion, Matriculados y Contexto Externo (listas de series).'
      });
    }

    if (!isCsvUpload) {
      try {
        workbook = XLSX.readFile(req.file.path, { cellDates: false, cellStyles: false, cellFormulas: false, cellHTML: false, cellText: false });
      } catch (_) {
        workbook = { SheetNames: [] };
      }
      let sheetNames = (workbook?.SheetNames || []).filter((name) => Boolean(workbook?.Sheets?.[name] && workbook?.Sheets?.[name]['!ref']));
      if (!sheetNames.length) {
        try {
          const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(req.file.path, { entries: 'emit' });
          sheetNames = [];
          for await (const worksheetReader of workbookReader) {
            if (worksheetReader.name) sheetNames.push(worksheetReader.name);
          }
        } catch (_) {}
      }
      if (!sheetNames.length) {
        return res.status(400).json({
          success: false,
          message: 'El archivo Excel no contiene hojas validas para procesar (posible archivo corrupto o plantilla incompleta).'
        });
      }
      workbook = { SheetNames: sheetNames, Sheets: workbook?.Sheets || {} };
    }

    if (categoria === 'Saber Pro' && saberProConfig?.label === 'Resultados individuales' && isCsvUpload) {
      return res.status(400).json({
        success: false,
        message: 'Resultados individuales solo acepta un libro Excel con dos hojas: SABER PRO y TYT.'
      });
    }

    if (categoria === GESTION_PROCESOS_CATEGORY) {
      if (isCsvUpload) {
        return res.status(400).json({
          success: false,
          message: 'Gestión por Procesos requiere un libro Excel con las hojas BD_SGD_UNICESMAG, POLÍTICAS y PLANTILLAS.'
        });
      }
      const result = await importGestionProcesosFromWorkbook({
        workbook,
        fileName: uploadFileName,
        userId: req.user?.id || null
      });
      const totalProcesados = Number(result.importados || 0) + Number(result.actualizados || 0);
      if (!result.total) {
        return res.status(400).json({
          success: false,
          message: 'No se encontraron filas válidas en las hojas de Gestión por Procesos.',
          data: result
        });
      }
      return res.json({
        success: true,
        message: `Importación finalizada para Gestión por Procesos: ${result.importados} nuevos, ${result.actualizados} actualizados de ${result.total} registros`,
        data: { ...result, totalProcesados }
      });
    }

    if (categoria === 'Infraestructura Física') {
      const sheetName = workbook.SheetNames.find(name => {
        const norm = normalizeHeader(name);
        return norm === normalizeHeader('Tabla_ Infra_ Física') || norm.includes('infraestructura') || norm.includes('fisica') || norm.includes('infra');
      });
      const matchedSheetName = sheetName || workbook.SheetNames[0];
      if (!matchedSheetName) {
        return res.status(400).json({ success: false, message: 'El archivo Excel no contiene hojas válidas' });
      }

      const allRows = XLSX.utils.sheet_to_json(workbook.Sheets[matchedSheetName], { header: 1 });
      let headerRowIndex = -1;
      for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i];
        const normalizedRow = (row || []).map((cell) => normalizeHeader(cell));
        if (row && normalizedRow.includes('COMPONENTE') &&
                  normalizedRow.some((cell) => cell === 'TIPO DE AREA' || cell === 'TIPO AREA')) {
          headerRowIndex = i;
          break;
        }
        if (row && row.some(cell => String(cell || '').trim().toUpperCase() === 'COMPONENTE') &&
                  row.some(cell => String(cell || '').trim().toUpperCase() === 'TIPO DE ÁREA')) {
          headerRowIndex = i;
          break;
        }
      }

      const headers = headerRowIndex >= 0 
        ? allRows[headerRowIndex].map(h => String(h || '').trim())
        : INFRAESTRUCTURA_FISICA_TEMPLATE_HEADERS;
      const dataRows = headerRowIndex >= 0 ? allRows.slice(headerRowIndex + 1) : allRows;

      await clearDatasetStorage({ categoria: 'Infraestructura Física' });

      let importados = 0;
      let totalFilas = 0;
      const errores = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const fila = (headerRowIndex >= 0 ? headerRowIndex : 0) + i + 2;

        if (!row || !row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')) {
          continue;
        }

        totalFilas++;

        const record = {};
        headers.forEach((header, colIdx) => {
          if (!header) return;
          record[header] = colIdx < row.length ? row[colIdx] : null;
        });

        const componente = pickInfraestructuraCell(record, ['COMPONENTE', 'BLOQUE', 'EDIFICIO', 'ESPACIO']);
        const tipoEspacio = pickInfraestructuraCell(record, ['TIPO DE ESPACIO', 'TIPO ESPACIO', 'ESPACIO FISICO', 'ESPACIO FÍSICO']);
        const tipoArea = pickInfraestructuraCell(record, ['TIPO DE ÁREA', 'TIPO DE AREA', 'TIPO ÁREA', 'TIPO AREA']);
        const tenencia = pickInfraestructuraCell(record, ['TENENCIA']);
        const ubicacion = pickInfraestructuraCell(record, ['UBICACIÓN', 'UBICACION', 'LOCALIZACION', 'LOCALIZACIÓN']);
        const nomenclatura = pickInfraestructuraCell(record, ['Nomenclatura', 'NOMENCLATURA', 'CODIGO ESPACIO', 'CÓDIGO ESPACIO']);
        const pisoNo = pickInfraestructuraCell(record, ['PISO No.', 'PISO NO.', 'PISO No', 'PISO NO', 'PISO', 'NIVEL']);
        const asignacion = pickInfraestructuraCell(record, ['ASIGNACIÓN', 'ASIGNACION', 'USO', 'DEPENDENCIA']);
        const descripcion = pickInfraestructuraCell(record, ['DESCRIPCION', 'DESCRIPCIÓN', 'DESCRIPCION GENERAL']);
        const funcionEspecifica = pickInfraestructuraCell(record, ['Función Específica', 'Funcion Especifica', 'FUNCIÓN ESPECÍFICA', 'FUNCION ESPECIFICA']);
        const capacidadFisica = pickInfraestructuraCell(record, ['CAPACIDAD FÍSICA', 'CAPACIDAD FISICA', 'CAPACIDAD', 'AFORO']);
        const areaMetros2 = pickInfraestructuraCell(record, ['ÁREA (Metros2)', 'AREA (Metros2)', 'ÁREA (M2)', 'AREA (M2)', 'ÁREA M2', 'AREA M2', 'ÁREA', 'AREA']);
        const fechaActualizacion = pickInfraestructuraCell(record, ['Fecha Actualización', 'Fecha Actualizacion', 'FECHA ACTUALIZACIÓN', 'FECHA ACTUALIZACION', 'FECHA']);
        const accesoAutonomo = pickInfraestructuraCell(record, ['Acceso Autónomo', 'Acceso Autonomo', 'ACCESO AUTÓNOMO', 'ACCESO AUTONOMO']);

        if (!componente && !tipoEspacio) {
          errores.push({ fila, error: 'Fila omitida: Componente o Tipo de Espacio vacío' });
          continue;
        }

        // Determinar Campus
        let parsedCampus = 'Campus Centro';
        const rawCampus = String(pickInfraestructuraCell(record, ['CAMPUS', 'Campus', 'SEDE', 'Sede']) || '').trim();
        const rawUbicacion = String(ubicacion || '').trim();

        if (rawCampus) {
          const normCampus = rawCampus.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
          if (normCampus.includes('SANTIAGO')) {
            parsedCampus = 'Campus Santiago';
          } else if (normCampus.includes('DAMIAN') || normCampus.includes('MUSD')) {
            parsedCampus = 'Campus San Damián';
          } else {
            parsedCampus = 'Campus Centro';
          }
        } else if (rawUbicacion) {
          const normUbi = rawUbicacion.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
          if (normUbi.includes('SANTIAGO')) {
            parsedCampus = 'Campus Santiago';
          } else if (normUbi.includes('DAMIAN') || normUbi.includes('MUSD')) {
            parsedCampus = 'Campus San Damián';
          }
        }

        try {
          await PoblacionalInfraestructuraFisica.create({
            campus: parsedCampus,
            componente: toDbText(componente, 200),
            tipo_area: toDbText(tipoArea, 120),
            tenencia: toDbText(tenencia, 120),
            ubicacion: toDbText(ubicacion, 255),
            nomenclatura: toDbText(nomenclatura, 120),
            piso_no: toNullableInteger(pisoNo),
            tipo_espacio: toDbText(tipoEspacio, 200),
            asignacion: toDbText(asignacion, 255),
            descripcion: toDbText(descripcion),
            funcion_especifica: toDbText(funcionEspecifica, 255),
            capacidad_fisica: toNullableInteger(capacidadFisica) || 0,
            area_metros2: toSafeNumber(areaMetros2, 0),
            fecha_actualizacion: toDbText(fechaActualizacion, 120),
            acceso_autonomo: toDbText(accesoAutonomo, 20),
            creado_por: req.user?.id || null,
            actualizado_por: req.user?.id || null
          });
          importados++;
        } catch (err) {
          console.error(`Error al importar fila ${fila} de Infraestructura Física:`, err);
          errores.push({ fila, error: err.message || 'Error al guardar fila' });
        }
      }

      const porcentaje = totalFilas > 0 ? Number(((importados / totalFilas) * 100).toFixed(2)) : 0;
      await GestionInformacionCarga.create({
        categoria: 'Infraestructura Física',
        subcategoria: 'Infraestructura Física',
        variable: 'Infraestructura Física',
        archivo_nombre: uploadFileName,
        total_plantilla: totalFilas,
        total_cargados: importados,
        total_omitidos: totalFilas - importados,
        porcentaje_cargado: porcentaje,
        estado: porcentaje === 100 ? 'exitoso' : 'parcial',
        detalle: errores.length ? JSON.stringify(errores.slice(0, 50)) : null,
        creado_por: req.user?.id || null
      });

      return res.json({
        success: true,
        message: `Importación finalizada para Infraestructura Física: ${importados}/${totalFilas} registros`,
        data: { total: totalFilas, importados, errores }
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
      if (isCsvUpload && !recursoHumanoConfig) {
        return res.status(400).json({ success: false, message: 'Para CSV de Recurso Humano debes seleccionar una subbase especifica.' });
      }

      const configs = recursoHumanoConfig ? [recursoHumanoConfig] : Object.values(RECURSO_HUMANO_SUBCATEGORY_CONFIG);
      const result = { total: 0, importados: 0, importadosValor: 0, errores: [], hojasProcesadas: [] };
      const csvData = isCsvUpload ? await readCsvRows(req.file.path) : null;
      const workbookSheetsByKey = isCsvUpload
        ? {}
        : Object.fromEntries(workbook.SheetNames.map((name) => [normalizeHeader(name), name]));

      for (const config of configs) {
        const matchedSheetName = isCsvUpload
          ? (config.sheetNames?.[0] || config.label)
          : (config.sheetNames || [])
            .map((name) => workbookSheetsByKey[normalizeHeader(name)])
            .find(Boolean);

        if (!matchedSheetName) {
          if (recursoHumanoConfig) {
            return res.status(400).json({ success: false, message: `No se encontro la hoja ${config.sheetNames?.[0] || config.label} en el archivo Excel` });
          }
          continue;
        }

        const rowsRH = isCsvUpload
          ? (csvData?.rows || [])
          : matrixToRows(workbook.Sheets[matchedSheetName], config.headers, true).rows;
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
            const anio = parseAnio(payload.anio || payload.periodo || row.PERIODO || row['AÑO'] || row['AÃƒÆ’Ã¢â‚¬ËœO']);
            const periodo = normalizeAcademicPeriodo(payload.anio || payload.periodo, anio);

            if (config.key === 'DOCENTES') {
              if (!anio || !periodo || !normalizeText(payload.docente) || !normalizeText(payload.genero_biologico)) {
                sheetResult.errores.push({ fila, error: 'Fila omitida: registro docente incompleto o periodo inválido' });
                result.errores.push({ hoja: matchedSheetName, fila, error: 'Fila omitida: registro docente incompleto o periodo inválido' });
                continue;
              }
              await config.model.create({
                anio,
                periodo: toDbText(periodo, 40),
                identificacion: toDbText(payload.identificacion, 80),
                docente: toDbText(payload.docente, 220),
                genero_biologico: toDbText(normalizeGenero(payload.genero_biologico), 60),
                departamento_dependencia: toDbText(payload.departamento_dependencia, 220),
                programa: toDbText(payload.programa, 220),
                nivel_contratacion: toDbText(payload.nivel_contratacion, 120),
                tipo_vinculacion: toDbText(payload.tipo_vinculacion, 120),
                contrato: toDbText(payload.contrato, 120),
                cargo: toDbText(payload.cargo || 'DOCENTE', 180),
                escalafon: toDbText(payload.escalafon, 120),
                total_horas: toNumber(payload.total_horas),
                total_docentes: toNumber(payload.total_docentes),
                fecha_ingreso: toDbText(parseExcelDateString(payload.fecha_ingreso), 80),
                fecha_nacimiento: toDbText(parseExcelDateString(payload.fecha_nacimiento), 80),
                edad: toNumber(payload.edad) ? Math.trunc(Number(payload.edad)) : null,
                raw_data: row,
                creado_por: req.user?.id || null,
                actualizado_por: req.user?.id || null
              });
            } else if (config.key === 'ADMINISTRATIVOS') {
              await config.model.create({
                anio,
                periodo: toDbText(periodo, 40),
                numero_cedula: toDbText(payload.numero_cedula, 80),
                estado_laboral: toDbText(payload.estado_laboral, 40),
                nombre_empleado: toDbText(payload.nombre_empleado, 220),
                cargo_especifico: toDbText(payload.cargo_especifico, 220),
                dependencia: toDbText(payload.dependencia, 220),
                vicerectoria: toDbText(payload.vicerectoria, 220),
                clase_contrato: toDbText(payload.clase_contrato, 120),
                genero_biologico: toDbText(normalizeGenero(payload.genero_biologico), 60),
                tipo_cotizante: toDbText(payload.tipo_cotizante, 120),
                fecha_inicio: toDbText(parseExcelDateString(payload.fecha_inicio), 80),
                fecha_terminacion: toDbText(parseExcelDateString(payload.fecha_terminacion), 80),
                sueldo_anual: toNumber(payload.sueldo_anual),
                sueldo_mes: toNumber(payload.sueldo_mes),
                raw_data: row,
                creado_por: req.user?.id || null,
                actualizado_por: req.user?.id || null
              });
            } else if (config.key === 'OUTSOURCING') {
              await config.model.create({
                anio,
                periodo: toDbText(normalizeAcademicPeriodo(payload.periodo || payload.anio, anio), 40),
                cargo: toDbText(payload.cargo, 180),
                genero_biologico: toDbText(normalizeGenero(payload.genero_biologico), 60),
                cantidad: toNumber(payload.cantidad),
                raw_data: row,
                creado_por: req.user?.id || null,
                actualizado_por: req.user?.id || null
              });
            } else if (config.key === 'ONDAS') {
              await config.model.create({
                anio,
                periodo: toDbText(periodo, 40),
                nombre: toDbText(payload.nombre, 220),
                genero: toDbText(normalizeGenero(payload.genero), 60),
                fecha_corte: toDbText(parseExcelDateString(payload.fecha_corte), 80),
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
                periodo ? `periodo: ${periodo}` : ''
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

    if (categoria === DATASET_CATEGORIES.internacionalizacion) {
      if (fixedSubcategoria && !internacionalizacionConfig) {
        return res.status(400).json({ success: false, message: 'Subbase de Internacionalizacion no valida' });
      }
      if (isCsvUpload) {
        return res.status(400).json({ success: false, message: 'Internacionalizacion debe cargarse en Excel XLSX para conservar las hojas MOVILIDAD y CONVENIOS.' });
      }

      const configs = Array.isArray(internacionalizacionConfig?.configs)
        ? internacionalizacionConfig.configs
        : internacionalizacionConfig
          ? [internacionalizacionConfig]
          : Object.values(INTERNACIONALIZACION_SUBCATEGORY_CONFIG);
      const result = { total: 0, importados: 0, errores: [], hojasProcesadas: [] };
      const csvData = isCsvUpload ? await readCsvRows(req.file.path) : null;
      const workbookSheetsByKey = isCsvUpload
        ? {}
        : Object.fromEntries(workbook.SheetNames.map((name) => [normalizeHeader(name), name]));

      await clearDatasetStorage({
        categoria: DATASET_CATEGORIES.internacionalizacion,
        subcategoria: INTERNACIONALIZACION_SUBBASE_LABEL,
        internacionalizacionConfig: { configs }
      });

      for (const config of configs) {
        const matchedSheetName = isCsvUpload
          ? (config.sheetNames?.[0] || config.label)
          : (config.sheetNames || [])
            .map((name) => workbookSheetsByKey[normalizeHeader(name)])
            .find(Boolean);

        if (!matchedSheetName) {
          if (internacionalizacionConfig) {
            return res.status(400).json({ success: false, message: `No se encontro la hoja ${config.sheetNames?.[0] || config.label} en el archivo Excel` });
          }
          continue;
        }

        const rowsInternacionalizacion = isCsvUpload
          ? (csvData?.rows || [])
          : matrixToRows(workbook.Sheets[matchedSheetName], config.headers, true).rows;
        if (!rowsInternacionalizacion.length) continue;

        const sheetResult = { total: rowsInternacionalizacion.length, importados: 0, errores: [] };
        for (let i = 0; i < rowsInternacionalizacion.length; i += 1) {
          const row = rowsInternacionalizacion[i];
          const fila = Number(row.__rowNumber || i + 2);
          try {
            const payload = mapPoblacionalRecord(row, { map: config.map });

            if (config.key === 'MOVILIDAD') {
              const periodo = normalizeText(payload.periodo);
              const nombreCompleto = [
                payload.primer_nombre,
                payload.segundo_nombre,
                payload.primer_apellido,
                payload.segundo_apellido
              ].map(normalizeText).filter(Boolean).join(' ');

              if (!periodo && !normalizeText(payload.numero_documento) && !nombreCompleto) {
                sheetResult.errores.push({ fila, error: 'Fila omitida: movilidad sin periodo, documento ni nombre' });
                result.errores.push({ hoja: matchedSheetName, fila, error: 'Fila omitida: movilidad sin periodo, documento ni nombre' });
                continue;
              }

              await config.model.create({
                periodo: toDbText(periodo, 40),
                programa_dependencia: toDbText(payload.programa_dependencia, 300),
                tipo_persona: toDbText(payload.tipo_persona, 120),
                alcance_movilidad: toDbText(payload.alcance_movilidad, 80),
                direccion_movilidad: toDbText(payload.direccion_movilidad, 80),
                actividad_movilidad: toDbText(payload.actividad_movilidad, 300),
                descripcion: toDbText(payload.descripcion),
                tipo_documento: toDbText(payload.tipo_documento, 80),
                numero_documento: toDbText(payload.numero_documento, 80),
                primer_nombre: toDbText(payload.primer_nombre, 160),
                segundo_nombre: toDbText(payload.segundo_nombre, 160),
                primer_apellido: toDbText(payload.primer_apellido, 160),
                segundo_apellido: toDbText(payload.segundo_apellido, 160),
                pais_extranjero: toDbText(payload.pais_extranjero, 180),
                estado_provincia_departamento: toDbText(payload.estado_provincia_departamento, 180),
                ciudad_municipio: toDbText(payload.ciudad_municipio, 180),
                institucion_extranjera: toDbText(payload.institucion_extranjera, 300),
                tipo_movilidad: toDbText(payload.tipo_movilidad, 160),
                num_dias_movilidad: toNumber(payload.num_dias_movilidad),
                movilidad_por_convenio: toDbText(payload.movilidad_por_convenio, 80),
                codigo_convenio: toDbText(payload.codigo_convenio, 120),
                fuente_financiacion_nacional: toDbText(payload.fuente_financiacion_nacional, 220),
                valor_financiacion_nacional: toPesosNumber(payload.valor_financiacion_nacional),
                fuente_financiacion_internacional: toDbText(payload.fuente_financiacion_internacional, 220),
                pais_financiador: toDbText(payload.pais_financiador, 180),
                valor_financiacion_internacional: toPesosNumber(payload.valor_financiacion_internacional),
                financiacion_unicesmag: toDbText(payload.financiacion_unicesmag, 80),
                valor_financiacion_unicesmag: toPesosNumber(payload.valor_financiacion_unicesmag),
                fecha_salida: parseDateOnlyOrNull(payload.fecha_salida),
                fecha_retorno: parseDateOnlyOrNull(payload.fecha_retorno),
                modalidad: toDbText(payload.modalidad, 120),
                resultado_movilidad: toDbText(payload.resultado_movilidad),
                raw_data: row,
                creado_por: req.user?.id || null,
                actualizado_por: req.user?.id || null
              });

              await Estadistica.create({
                categoria: DATASET_CATEGORIES.internacionalizacion,
                subcategoria: INTERNACIONALIZACION_SUBBASE_LABEL,
                anio: parseAnio(periodo || payload.fecha_salida) || 0,
                programa: normalizeText(payload.programa_dependencia),
                dependencia: normalizeText(payload.tipo_persona),
                indicador: config.label,
                valor: 1,
                unidad: 'registros',
                fuente: `Carga Excel Internacionalizacion - ${config.label}`,
                observaciones: [
                  normalizeText(payload.alcance_movilidad) ? `alcance: ${normalizeText(payload.alcance_movilidad)}` : '',
                  normalizeText(payload.direccion_movilidad) ? `direccion: ${normalizeText(payload.direccion_movilidad)}` : '',
                  normalizeText(payload.modalidad) ? `modalidad: ${normalizeText(payload.modalidad)}` : '',
                  periodo ? `periodo: ${periodo}` : ''
                ].filter(Boolean).join(' | ') || null,
                creado_por: req.user?.id || null,
                actualizado_por: req.user?.id || null
              });
            } else if (config.key === 'CONVENIOS_INTERNACIONALIZACION') {
              const anio = parseAnio(payload.anio || payload.fecha_inicio || payload.fecha_terminacion);
              if (!anio && !normalizeText(payload.convenio_entidad)) {
                sheetResult.errores.push({ fila, error: 'Fila omitida: convenio sin anio ni entidad' });
                result.errores.push({ hoja: matchedSheetName, fila, error: 'Fila omitida: convenio sin anio ni entidad' });
                continue;
              }

              await config.model.create({
                anio,
                convenio_entidad: toDbText(payload.convenio_entidad, 400),
                tipo_convenio: toDbText(payload.tipo_convenio, 180),
                programa_gestor: toDbText(payload.programa_gestor, 300),
                objeto_convenio: toDbText(payload.objeto_convenio),
                fecha_inicio: parseDateOnlyOrNull(payload.fecha_inicio),
                fecha_terminacion: parseDateOnlyOrNull(payload.fecha_terminacion),
                link_anexo: toDbText(payload.link_anexo),
                raw_data: row,
                creado_por: req.user?.id || null,
                actualizado_por: req.user?.id || null
              });

              await Estadistica.create({
                categoria: DATASET_CATEGORIES.internacionalizacion,
                subcategoria: INTERNACIONALIZACION_SUBBASE_LABEL,
                anio: anio || 0,
                programa: normalizeText(payload.programa_gestor),
                dependencia: normalizeText(payload.tipo_convenio),
                indicador: config.label,
                valor: 1,
                unidad: 'convenios',
                fuente: `Carga Excel Internacionalizacion - ${config.label}`,
                observaciones: normalizeText(payload.convenio_entidad) || null,
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
        result.hojasProcesadas.push({ hoja: matchedSheetName, subcategoria: INTERNACIONALIZACION_SUBBASE_LABEL, variable: config.label, ...sheetResult });

        const porcentaje = sheetResult.total > 0 ? Number(((sheetResult.importados / sheetResult.total) * 100).toFixed(2)) : 0;
        await GestionInformacionCarga.create({
          categoria: DATASET_CATEGORIES.internacionalizacion,
          subcategoria: INTERNACIONALIZACION_SUBBASE_LABEL,
          variable: config.label,
          archivo_nombre: uploadFileName,
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
        return res.status(400).json({ success: false, message: 'No se encontraron hojas validas de Internacionalizacion en el archivo' });
      }

      return res.json({
        success: true,
        message: `Importacion finalizada para Internacionalizacion: ${result.importados}/${result.total} registros`,
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
            const hasInstCode = normalizedHeaders.includes('CODIGO_INSTITUCION')
              || normalizedHeaders.includes('CODIGO_DE_LA_INSTITUCION')
              || normalizedHeaders.includes('CODIGO_INSTITUCION_PADRE');
            const hasIesName = normalizedHeaders.includes('INSTITUCION_DE_EDUCACION_SUPERIOR_IES')
              || normalizedHeaders.includes('INSTITUCION_DE_EDUCACION_SUPERIOR')
              || normalizedHeaders.includes('IES');
            const hasProg = normalizedHeaders.includes('PROGRAMA_ACADEMICO')
              || normalizedHeaders.includes('PROGRAMA');
            const hasAno = normalizedHeaders.includes('ANO')
              || normalizedHeaders.includes('ANIO');
            const hasSem = normalizedHeaders.includes('SEMESTRE');

            const hasTabularHeader = hasInstCode && hasIesName && hasProg && hasAno && hasSem;
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
              const semestreSlot = /\b(2|3|II|IIP)\b/.test(semestreToken) ? 2 : 1;
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
        await streamExcelXlsxFile({
          filePath: req.file.path,
          onSheet: async ({ sheetName, matrix }) => {
            if (normalizeHeader(sheetName) === 'REPORTE_NORMALIZACION') return;
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
          ['CÓDIGO_INSTITUCIÓN_PADRE', 'CÓDIGO_INSTITUCIÓN', 'CÓDIGO DE LA INSTITUCIÓN', 'INSTITUCIÓN DE EDUCACIÓN SUPERIOR (IES)', 'PROGRAMA ACADÉMICO', 'AÑO', 'SEMESTRE']
        );
        const tabularHeadersNormalized = ((matrix[tabularHeaderRowCandidate] || []).map((cell) => normalizeHeader(cell)).filter(Boolean));
        const metricAliases = getContextoExternoTabularMetricAliases(baseIndicador);
        const hasInstCodeTabular = tabularHeadersNormalized.includes('CODIGO_INSTITUCION')
          || tabularHeadersNormalized.includes('CODIGO_DE_LA_INSTITUCION')
          || tabularHeadersNormalized.includes('CODIGO_INSTITUCION_PADRE');
        const hasIesNameTabular = tabularHeadersNormalized.includes('INSTITUCION_DE_EDUCACION_SUPERIOR_IES')
          || tabularHeadersNormalized.includes('INSTITUCION_DE_EDUCACION_SUPERIOR')
          || tabularHeadersNormalized.includes('IES');
        const hasProgTabular = tabularHeadersNormalized.includes('PROGRAMA_ACADEMICO')
          || tabularHeadersNormalized.includes('PROGRAMA');
        const hasAnoTabular = tabularHeadersNormalized.includes('ANO')
          || tabularHeadersNormalized.includes('ANIO');
        const hasSemTabular = tabularHeadersNormalized.includes('SEMESTRE');

        const hasTabularHeader = hasInstCodeTabular && hasIesNameTabular && hasProgTabular && hasAnoTabular && hasSemTabular;
        const tabularHeaderRowIndex = hasTabularHeader ? tabularHeaderRowCandidate : -1;
        const isOfertaLike = ofertaSectorHeaderRowIndex >= 0 || programasHeaderRowIndex >= 0;
        const isSeriesLike = seriesHeaderRowIndex >= 0 || tabularHeaderRowIndex >= 0;

        if (contextoCargaConfig?.onlyType === 'oferta' && !isOfertaLike) return;
        if (contextoCargaConfig?.onlyType === 'serie' && !isSeriesLike) return;

        if (ofertaSectorHeaderRowIndex >= 0) {
          const headerRowIndex = ofertaSectorHeaderRowIndex;
          if (headerRowIndex < 0) return;
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

          const detailsBatch = [];
          const statsBatch = [];
          const flushTabularBatches = async () => {
            if (detailsBatch.length > 0) {
              await PoblacionalContextoExterno.bulkCreate(detailsBatch, { validate: false, hooks: false });
              detailsBatch.length = 0;
            }
            if (statsBatch.length > 0) {
              await Estadistica.bulkCreate(statsBatch, { validate: false, hooks: false });
              statsBatch.length = 0;
            }
          };

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
              const semestreSlot = /\b(2|3|II|IIP)\b/.test(semestreToken) ? 2 : 1;
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

              detailsBatch.push(detail);
              statsBatch.push({
                categoria: 'Poblacional',
                subcategoria: 'Contexto Externo',
                indicador: baseIndicador,
                variable: baseIndicador,
                valor: Number(valueNum),
                unidad: 'estudiantes',
                fuente: `Contexto Externo - ${baseIndicador}`,
                anio: detail.anio,
                periodo_referencia: periodoLabel,
                programa: detail.programa_comparado,
                ies: detail.ies,
                meta_json: JSON.stringify({
                  baseIndicador,
                  alcance,
                  hoja: sheetName,
                  periodoRef: periodoLabel,
                  sector: detail.sector,
                  corte: sheetMeta.corte,
                  programaObjetivo: programaObjetivoStd,
                  tipoRegistro: 'serie'
                })
              });

              if (detailsBatch.length >= 2000) {
                await flushTabularBatches();
              }

              sheetResult.importados += 1;
              result.importados += 1;
              result.importadosValor += Number(detail.valor || 0);
            } catch (sheetErr) {
              sheetResult.errores.push({ fila, error: sheetErr.message });
              result.errores.push({ hoja: sheetName, fila, error: sheetErr.message });
            }
          }

          await flushTabularBatches();
        } else {
          const headerRowIndex = seriesHeaderRowIndex;
          if (headerRowIndex < 0) return;
          const periodHeaders = (matrix[headerRowIndex] || []).slice(1).map((v) => String(v || '').trim()).filter(Boolean);
          if (!periodHeaders.length) return;

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
      });
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
      const sheetName = resolveDefaultImportSheetName(workbook, categoria);
      if (!sheetName) {
        return res.status(400).json({ success: false, message: 'El archivo Excel no contiene hojas con datos válidos' });
      }
      const worksheet = workbook.Sheets[sheetName];
      const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, blankrows: false });

      let headerRowIndex = categoria === 'Poblacional' && poblacionalConfig
        ? detectHeaderRowIndex(matrix, poblacionalConfig.headers)
        : 0;

      if (categoria === 'Autoevaluación') {
        const expectedAutoHeaders = normalizeCategoryToken(fixedSubcategoria) === 'participantes'
          ? AUTOEVALUACION_PARTICIPANTES_TEMPLATE_HEADERS
          : isAutoevaluacionProgramasSubbase(fixedSubcategoria)
            ? AUTOEVALUACION_PROGRAMAS_TEMPLATE_HEADERS
            : AUTOEVALUACION_TEMPLATE_HEADERS;
        headerRowIndex = detectHeaderRowIndex(matrix, expectedAutoHeaders);
      }
      if (categoria === 'Registros Calificados y Acreditación') {
        headerRowIndex = detectHeaderRowIndex(matrix, REGISTROS_CALIFICADOS_TEMPLATE_HEADERS);
      }

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
    if (categoria === 'Plan de Acción') {
      await clearDatasetStorage({ categoria: 'Plan de Acción' });
    }
    if (categoria === 'Autoevaluación') {
      await clearDatasetStorage({ categoria: 'Autoevaluación', subcategoria: fixedSubcategoria });
    }
    if (categoria === 'Registros Calificados y Acreditación') {
      await clearDatasetStorage({ categoria: 'Registros Calificados y Acreditación', subcategoria: fixedSubcategoria || REGISTROS_CALIFICADOS_SUBBASE });
    }

    // Deduplicación en-memoria para subcategorías con uniqueKeys definidos (ej. Matriculados: codigo_estudiante+periodo)
    const seenUniqueKeys = new Set();

    // ── DIVIPOLA: configuración previa al bucle para MATRICULADOS ───────────
    const isMatriculadosImport = categoria === 'Poblacional' && poblacionalConfig?.label === 'Matriculados';
    const matriculadosIncidencias = [];
    const matriculadosDetailBatch = [];
    const matriculadosIncidenceDraftBatch = [];
    const matriculadosStatsBatch = [];
    const matriculadosResolveCache = new Map();
    const MATRICULADOS_IMPORT_BATCH_SIZE = 3000;
    const resolveMatriculadosUbicacionCached = async (params = {}) => {
      const cacheKey = JSON.stringify({
        pais: normalizeText(params.pais),
        departamento: normalizeText(params.departamento),
        municipio: normalizeText(params.municipio),
        codigoDaneMuni: params.codigoDaneMuni || null,
        codigoDaneDepto: params.codigoDaneDepto || null
      });
      if (matriculadosResolveCache.has(cacheKey)) return matriculadosResolveCache.get(cacheKey);
      const resolved = await divipolaMatchService.resolveUbicacion(params);
      matriculadosResolveCache.set(cacheKey, resolved);
      return resolved;
    };
    const flushMatriculadosImportBatches = async () => {
      if (!isMatriculadosImport) return;
      if (matriculadosDetailBatch.length > 0) {
        const createdRows = await poblacionalConfig.model.bulkCreate(matriculadosDetailBatch, {
          validate: false,
          hooks: false,
          returning: true
        });
        matriculadosIncidenceDraftBatch.forEach((draft, index) => {
          if (!draft) return;
          const createdId = createdRows?.[index]?.id || createdRows?.[index]?.get?.('id') || null;
          if (!createdId) return;
          matriculadosIncidencias.push({ ...draft, matriculado_id: createdId });
        });
        matriculadosDetailBatch.length = 0;
        matriculadosIncidenceDraftBatch.length = 0;
      }
      if (matriculadosStatsBatch.length > 0) {
        await Estadistica.bulkCreate(matriculadosStatsBatch, {
          validate: false,
          hooks: false
        });
        matriculadosStatsBatch.length = 0;
      }
    };
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

          const resolvedActual = await resolveMatriculadosUbicacionCached({
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

          const resolvedNacimiento = await resolveMatriculadosUbicacionCached({
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

        // Normaliza PERIODO "IP"/"IIP"/"1"/"2"/"3" → "1" o "2"
        // SNIES usa código 1=primer período, 3=segundo período (salta el 2)
        if (payload.semestre) {
          const rawSem = String(payload.semestre);
          payload.semestre = /\b(2|3|II|IIP)\b/i.test(rawSem) ? '2' : '1';
        }
        const anio = parseAnio(payload.anio || row['AÑO']);
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
          edad: toNumber(payload.edad),
          cantidad: toNumber(payload.cantidad),
          conteo,
          numero_materias_inscritas: toNumber(payload.numero_materias_inscritas),
          numero_materias_aprobadas: toNumber(payload.numero_materias_aprobadas),
          anio_primer_curso: parseAnio(payload.anio_primer_curso),
          valor_derechos_matricula: toNumber(payload.valor_derechos_matricula),
          creado_por: req.user?.id || null,
          actualizado_por: req.user?.id || null
        };
        if (poblacionalConfig.label === 'Cantidad Total Egresados' && anio <= 2019) {
          detailPayload.detalle = GRADUADOS_HISTORICO_DETAIL;
          payload.detalle = GRADUADOS_HISTORICO_DETAIL;
        }

        if (isMatriculadosImport) {
          let incidenceDraft = null;
          const conf = detailPayload.match_confianza_ubicacion;
          if (conf === 'sin_match' || conf === 'baja') {
            incidenceDraft = {
              anio: detailPayload.anio,
              periodo: buildPeriodLabel(detailPayload.anio, detailPayload.semestre),
              departamento_fuente: matriculadoDeptoFuente,
              municipio_fuente: matriculadoMuniFuente,
              codigo_departamento_sugerido: detailPayload.codigo_departamento || null,
              codigo_municipio_sugerido: detailPayload.codigo_dane || null,
              confianza: conf,
              metodo: detailPayload.match_metodo_ubicacion || 'sin_match',
              score: detailPayload.match_score_ubicacion || null,
              estado: 'pendiente',
              observacion: conf === 'sin_match'
                ? 'Sin match automático con catálogo DIVIPOLA'
                : 'Match parcial: requiere revisión manual'
            };
          }
          matriculadosDetailBatch.push(detailPayload);
          matriculadosIncidenceDraftBatch.push(incidenceDraft);
          matriculadosStatsBatch.push({
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
          if (matriculadosDetailBatch.length >= MATRICULADOS_IMPORT_BATCH_SIZE) {
            await flushMatriculadosImportBatches();
          }
          continue;
        }

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

      if (categoria === 'Plan de Acción') {
        await ensurePlanAccionTable();
        const payload = mapPlanAccionRow(row);
        if (!payload.anio) {
          result.errores.push({ fila, error: 'Campo obligatorio inválido: AÑO' });
          continue;
        }
        await PlanAccion.create({
          ...payload,
          estado_workflow: 'Aprobado',
          creado_por: req.user?.id || null,
          actualizado_por: req.user?.id || null
        });
        result.importados += 1;
        continue;
      }

      if (categoria === 'Autoevaluación') {
        await ensureAutoevaluacionTable();
        const isParticipantesSubbase = normalizeCategoryToken(fixedSubcategoria) === 'participantes';
        const isProgramasSubbase = isAutoevaluacionProgramasSubbase(fixedSubcategoria);
        const payload = isParticipantesSubbase
          ? mapAutoevaluacionParticipanteRow(row)
          : isProgramasSubbase
            ? mapAutoevaluacionProgramaRow(row)
          : mapAutoevaluacionRow(row);
        if (isParticipantesSubbase) {
          if (!payload.programa || !payload.alcance_autoevaluacion || !payload.nombres_completos) {
            result.errores.push({ fila, error: 'Campos obligatorios: PROGRAMA, ALCANCE AUTOEVALUACIÓN y NOMBRES COMPLETOS' });
            continue;
          }
          await AutoevaluacionParticipante.create({
            ...payload,
            creado_por: req.user?.id || null,
            actualizado_por: req.user?.id || null
          });
          result.importados += 1;
          continue;
        }
        if (isProgramasSubbase) {
          if (!payload.programa) {
            result.errores.push({ fila, error: 'Campo obligatorio: PROGRAMA' });
            continue;
          }
          await AutoevaluacionPrograma.create({
            ...payload,
            creado_por: req.user?.id || null,
            actualizado_por: req.user?.id || null
          });
          result.importados += 1;
          continue;
        }
        if (!payload.programa && !payload.factor && !payload.caracteristica && !payload.indicador) {
          result.errores.push({ fila, error: 'Fila sin información mínima: PROGRAMA, FACTOR, CARACTERÍSTICA o INDICADOR' });
          continue;
        }
        await Autoevaluacion.create({
          ...payload,
          creado_por: req.user?.id || null,
          actualizado_por: req.user?.id || null
        });
        result.importados += 1;
        continue;
      }

      if (categoria === 'Registros Calificados y Acreditación') {
        await ensureRegistrosCalificadosTable();
        const payload = mapRegistroCalificadoRow(row);
        if (!payload.programa_academico) {
          result.errores.push({ fila, error: 'Campo obligatorio: Programa académico' });
          continue;
        }
        await RegistroCalificadoHistorico.create({
          ...payload,
          creado_por: req.user?.id || null,
          actualizado_por: req.user?.id || null
        });
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
      await flushMatriculadosImportBatches();
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
    if (categoria === 'Poblacional') {
      poblacionalSeriesCache.clear();
      if (poblacionalConfig?.label === 'Caracterizacion') {
        clearCaracterizacionCaches();
      }
    }

    const porcentaje = result.total > 0 ? Number(((result.importados / result.total) * 100).toFixed(2)) : 0;
    const estado = porcentaje === 100 ? 'exitoso' : (result.importados > 0 ? 'parcial' : 'fallido');
    const variable = categoria === 'Poblacional' && poblacionalConfig
      ? poblacionalConfig.label
      : (fixedSubcategoria || categoria);
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
    const internacionalizacionConfig = categoria === DATASET_CATEGORIES.internacionalizacion && subcategoria ? resolveInternacionalizacionConfig(subcategoria) : null;
    if (!categoria) {
      return res.status(400).json({ success: false, message: 'Debes seleccionar la base de datos destino' });
    }
    if (!enforceAutoevaluacionDatasetScope(req, res, categoria)) return null;

    const { deleted, deletedLogs } = await clearDatasetStorage({
      categoria,
      subcategoria,
      poblacionalConfig,
      saberProConfig,
      recursoHumanoConfig,
      internacionalizacionConfig
    });
    if (categoria === 'Poblacional' && (!subcategoria || poblacionalConfig?.label === 'Caracterizacion')) {
      clearCaracterizacionCaches();
    }
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
    if (isAutoevaluacionRole(req) && categoria && resolveCategoria(categoria) !== 'Autoevaluación') {
      return res.status(403).json({ success: false, message: 'El usuario de Autoevaluación solo puede exportar errores de su base' });
    }
    if (id) {
      cargue = await GestionInformacionCarga.findByPk(id, { raw: true });
    }
    if (isAutoevaluacionRole(req) && cargue && resolveCategoria(cargue.categoria) !== 'Autoevaluación') {
      return res.status(403).json({ success: false, message: 'El usuario de Autoevaluación solo puede exportar errores de su base' });
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
    if (isAutoevaluacionRole(req) && categoria && resolveCategoria(categoria) !== 'Autoevaluación') {
      return res.status(403).json({ success: false, message: 'El usuario de Autoevaluación solo puede exportar su base' });
    }
    if (id) {
      cargue = await GestionInformacionCarga.findByPk(id, { raw: true });
    }
    if (isAutoevaluacionRole(req) && cargue && resolveCategoria(cargue.categoria) !== 'Autoevaluación') {
      return res.status(403).json({ success: false, message: 'El usuario de Autoevaluación solo puede exportar su base' });
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
    } else if (categoriaResolved === DATASET_CATEGORIES.internacionalizacion) {
      const intConfig = resolveInternacionalizacionConfig(variableEffective) || resolveInternacionalizacionConfig(subcategoriaResolved);
      if (intConfig?.model) {
        const rows = await intConfig.model.findAll({ order: [['id', 'ASC']], raw: true });
        records = rows.map((row) => normalizeExcelRecordKeys(row));
        sheetName = normalizeHeader(variableEffective || subcategoriaResolved || 'INTERNACIONALIZACION').slice(0, 31);
      }
    } else if (categoriaResolved === 'Plan de Acción') {
      await ensurePlanAccionTable();
      const rows = await PlanAccion.findAll({ order: [['anio', 'ASC'], ['id', 'ASC']], raw: true });
      records = rows.map((row) => ({
        'AÑO': row.anio,
        'PED': row.ped,
        'OBJETIVOS ESTRATÉGICOS': row.objetivo_estrategico,
        'LINEAMIENTOS ESTRATÉGICOS': row.lineamiento_estrategico,
        'MACROACTIVIDADES ESTRATEGICAS': row.macroactividad,
        'ACTIVIDADES': row.actividad,
        'TIPO DE INDICADOR': row.tipo_indicador,
        'FECHA INICIO': row.fecha_inicio,
        'FECHA FIN': row.fecha_fin,
        'INDICADOR': row.indicador,
        'META': row.meta,
        'RESPONSABLE DE EJECUCIÓN': row.responsable,
        'CORRESPONSABLE': row.corresponsable,
        'PORCENTAJE AVANCE IP': row.avance_ip,
        'OBSERVACIONES IP': row.observaciones_ip,
        'PORCENTAJE AVANCE IIP': row.avance_iip,
        'OBSERVACIONES IIP': row.observaciones_iip,
        'TOTAL EJECUCION': row.total_ejecucion
      }));
      sheetName = 'PLAN_DE_ACCION';
    } else if (categoriaResolved === 'Autoevaluación') {
      await ensureAutoevaluacionTable();
      if (normalizeCategoryToken(subcategoriaResolved) === 'participantes') {
        const rows = await AutoevaluacionParticipante.findAll({ order: [['programa', 'ASC'], ['nombres_completos', 'ASC'], ['id', 'ASC']], raw: true });
        records = rows.map((row) => ({
          'PROGRAMA': row.programa,
          'ALCANCE AUTOEVALUACIÓN': row.alcance_autoevaluacion,
          'ACTA INICIO PROCESO DE AUTOEVALUACIÓN': row.acta_inicio_url,
          'CRONOGRAMA DE AUTOEVALUACIÓN': row.cronograma_url,
          'NOMBRES COMPLETOS': row.nombres_completos,
          'DOCUMENTO': row.documento,
          'CARGO': row.cargo,
          'ROL EN EL PROCESO': row.rol_en_proceso
        }));
        sheetName = 'PARTICIPANTES';
      } else if (isAutoevaluacionProgramasSubbase(subcategoriaResolved)) {
        const rows = await AutoevaluacionPrograma.findAll({ order: [['programa', 'ASC'], ['id', 'ASC']], raw: true });
        records = rows.map((row) => ({
          'PROGRAMA': row.programa,
          'PROCESO AUTOEVALUACIÓN': row.proceso_autoevaluacion,
          'FACULTAD A LA QUE ESTÁ ADSCRITO': row.facultad,
          'NIVEL DE FORMACIÓN': row.nivel_formacion,
          'RENOVACIÓN REGISTRO CALIFICADO': row.renovacion_registro_calificado,
          'CÓDIGO SNIES': row.codigo_snies,
          'TÍTULO QUE OTORGA': row.titulo_otorga,
          'E-MAIL DEL PROGRAMA': row.email_programa,
          'DURACIÓN DE FORMACIÓN': row.duracion_formacion,
          'NÚMERO DE CRÉDITOS': row.numero_creditos,
          'NÚMERO DE ESTUDIANTES A ADMITIR A PRIMER CURSO': row.estudiantes_primer_curso
        }));
        sheetName = 'INFORMACION_PROGRAMAS';
      } else {
        const rows = await Autoevaluacion.findAll({ order: [['id', 'ASC']], raw: true });
        records = rows.map((row) => ({
          'Acuerdo MEN': row.acuerdo_men,
          'PROGRAMA': row.programa,
          'FACTOR': row.factor,
          'CARACTERÍSTICA': row.caracteristica,
          'ASPECTOS POR EVALUAR': row.aspectos_por_evaluar,
          'INDICADOR': row.indicador,
          'Instrumento': row.instrumento,
          'SCRIT': row.scrit,
          'Componente Programa / Institución': row.componente,
          'Calificación Indicador': row.calificacion_indicador,
          'Evidencias': row.evidencias,
          'Información para tener en cuenta': row.informacion_para_tener_en_cuenta
        }));
        sheetName = 'AUTOEVALUACION';
      }
    } else if (categoriaResolved === 'Registros Calificados y Acreditación') {
      await ensureRegistrosCalificadosTable();
      const rows = await RegistroCalificadoHistorico.findAll({
        order: [['programa_academico', 'ASC'], ['fecha_resolucion', 'DESC'], ['id', 'ASC']],
        raw: true
      });
      records = rows.map((row) => ({
        'Programa académico': row.programa_academico,
        'Nivel': row.nivel,
        'Tipo aprobación': row.tipo_aprobacion,
        'Resolución MEN': row.resolucion_men,
        'Fecha Resolución': row.fecha_resolucion,
        'Resolucion RC': row.resolucion_rc,
        'Plan de Estudios': row.plan_estudios,
        'Enlace': row.enlace
      }));
      sheetName = REGISTROS_CALIFICADOS_SUBBASE;
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

const safeFilenameFragment = (value, fallback = 'plan') => {
  const base = String(value || fallback)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return base || fallback;
};

const exportPlanAccionInstitucional = async (req, res) => {
  try {
    const { planData = {}, actividades = [], corresponsabilidades = [] } = req.body || {};
    if (!Array.isArray(actividades) || actividades.length === 0) {
      return res.status(400).json({ success: false, message: 'Debes enviar al menos una actividad del plan.' });
    }
    const buffer = await generatePlanAccionBuffer({ planData, actividades, corresponsabilidades });
    const year = planData.anio || new Date().getFullYear();
    const fragment = safeFilenameFragment(planData.codigoPlan || planData.nombrePlan || 'plan_accion');
    const filename = `plan_accion_${fragment}_${year}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (error) {
    console.error('Error al exportar Plan de Acción institucional:', error);
    return res.status(500).json({ success: false, message: 'No se pudo generar la plantilla institucional del Plan de Acción.' });
  }
};

const exportActaInstitucional = async (req, res) => {
  try {
    const payload = req.body || {};
    const buffer = await generateActaBuffer(payload);
    const year = payload.anio || new Date().getFullYear();
    const fragment = safeFilenameFragment(payload.codigoPlan || payload.dependencia || 'acta_reunion');
    const filename = `acta_asistencia_reunion_${fragment}_${year}.docx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    return res.send(buffer);
  } catch (error) {
    console.error('Error al exportar acta institucional:', error);
    return res.status(500).json({ success: false, message: 'No se pudo generar el acta institucional.' });
  }
};

const sugerirIndicadorPlanAccion = async (req, res) => {
  try {
    const actividad = String(req.body?.actividad || '').trim();
    if (!actividad) {
      return res.status(400).json({ success: false, message: 'La actividad es obligatoria.' });
    }
    const result = await suggestIndicators(actividad);
    return res.json({ success: true, data: result });
  } catch (error) {
    const status = error?.status || 500;
    const payload = {
      success: false,
      message: error?.message || 'No fue posible generar indicadores con IA.',
      code: error?.code || 'GEMINI_ERROR'
    };
    if (status >= 500) {
      console.error('Error al sugerir indicadores con Gemini:', error);
    }
    return res.status(status).json(payload);
  }
};

const getInfraestructuras = async (req, res) => {
  try {
    const { page = 1, limit = 50, campus, ubicacion, tipo_espacio, acceso_autonomo, search } = req.query;
    const where = {};
    
    if (campus) where.campus = campus;
    if (ubicacion) where.ubicacion = ubicacion;
    if (tipo_espacio) where.tipo_espacio = tipo_espacio;
    if (acceso_autonomo) where.acceso_autonomo = acceso_autonomo;
    
    if (search) {
      where[Op.or] = [
        { nomenclatura: { [Op.iLike]: `%${search}%` } },
        { asignacion: { [Op.iLike]: `%${search}%` } },
        { descripcion: { [Op.iLike]: `%${search}%` } },
        { tipo_espacio: { [Op.iLike]: `%${search}%` } },
        { ubicacion: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 50, 1), 5000);
    const offset = (currentPage - 1) * currentLimit;
    
    const { count, rows } = await PoblacionalInfraestructuraFisica.findAndCountAll({
      where,
      order: [['campus', 'ASC'], ['ubicacion', 'ASC'], ['nomenclatura', 'ASC'], ['id', 'ASC']],
      limit: currentLimit,
      offset,
      raw: true
    });
    
    return res.json({
      success: true,
      data: {
        registros: rows,
        pagination: {
          total: count,
          page: currentPage,
          limit: currentLimit,
          totalPages: Math.ceil(count / currentLimit)
        }
      }
    });
  } catch (error) {
    console.error('Error al listar infraestructuras:', error);
    return res.status(500).json({ success: false, message: 'Error al listar infraestructuras físicas' });
  }
};

const createInfraestructura = async (req, res) => {
  try {
    const payload = {
      campus: normalizeText(req.body.campus),
      componente: normalizeText(req.body.componente),
      tipo_area: normalizeText(req.body.tipo_area),
      tenencia: normalizeText(req.body.tenencia),
      ubicacion: normalizeText(req.body.ubicacion),
      nomenclatura: normalizeText(req.body.nomenclatura),
      piso_no: req.body.piso_no !== null && req.body.piso_no !== undefined ? Math.trunc(Number(req.body.piso_no)) : null,
      tipo_espacio: normalizeText(req.body.tipo_espacio),
      asignacion: normalizeText(req.body.asignacion),
      descripcion: normalizeText(req.body.descripcion),
      funcion_especifica: normalizeText(req.body.funcion_especifica),
      capacidad_fisica: req.body.capacidad_fisica !== null && req.body.capacidad_fisica !== undefined ? Math.trunc(Number(req.body.capacidad_fisica)) : 0,
      area_metros2: req.body.area_metros2 !== null && req.body.area_metros2 !== undefined ? Number(req.body.area_metros2) : 0,
      fecha_actualizacion: normalizeText(req.body.fecha_actualizacion),
      acceso_autonomo: normalizeText(req.body.acceso_autonomo),
      creado_por: req.user?.id || null,
      actualizado_por: req.user?.id || null
    };
    
    if (!payload.campus || !payload.componente || !payload.tipo_espacio) {
      return res.status(400).json({ success: false, message: 'Campos obligatorios: campus, componente, tipo_espacio' });
    }
    
    const registro = await PoblacionalInfraestructuraFisica.create(payload);
    return res.status(201).json({ success: true, message: 'Espacio físico creado exitosamente', data: registro });
  } catch (error) {
    console.error('Error al crear infraestructura:', error);
    return res.status(500).json({ success: false, message: 'Error al crear espacio físico' });
  }
};

const updateInfraestructura = async (req, res) => {
  try {
    const { id } = req.params;
    const registro = await PoblacionalInfraestructuraFisica.findByPk(id);
    if (!registro) {
      return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    }
    
    const payload = {
      campus: normalizeText(req.body.campus) || registro.campus,
      componente: normalizeText(req.body.componente) || registro.componente,
      tipo_area: normalizeText(req.body.tipo_area) || registro.tipo_area,
      tenencia: normalizeText(req.body.tenencia) || registro.tenencia,
      ubicacion: normalizeText(req.body.ubicacion) || registro.ubicacion,
      nomenclatura: normalizeText(req.body.nomenclatura) || registro.nomenclatura,
      piso_no: req.body.piso_no !== null && req.body.piso_no !== undefined ? Math.trunc(Number(req.body.piso_no)) : registro.piso_no,
      tipo_espacio: normalizeText(req.body.tipo_espacio) || registro.tipo_espacio,
      asignacion: normalizeText(req.body.asignacion) || registro.asignacion,
      descripcion: normalizeText(req.body.descripcion) || registro.descripcion,
      funcion_especifica: normalizeText(req.body.funcion_especifica) || registro.funcion_especifica,
      capacidad_fisica: req.body.capacidad_fisica !== null && req.body.capacidad_fisica !== undefined ? Math.trunc(Number(req.body.capacidad_fisica)) : registro.capacidad_fisica,
      area_metros2: req.body.area_metros2 !== null && req.body.area_metros2 !== undefined ? Number(req.body.area_metros2) : registro.area_metros2,
      fecha_actualizacion: normalizeText(req.body.fecha_actualizacion) || registro.fecha_actualizacion,
      acceso_autonomo: normalizeText(req.body.acceso_autonomo) || registro.acceso_autonomo,
      actualizado_por: req.user?.id || null
    };
    
    await registro.update(payload);
    return res.json({ success: true, message: 'Espacio físico actualizado exitosamente', data: registro });
  } catch (error) {
    console.error('Error al actualizar infraestructura:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar espacio físico' });
  }
};

const deleteInfraestructura = async (req, res) => {
  try {
    const { id } = req.params;
    const registro = await PoblacionalInfraestructuraFisica.findByPk(id);
    if (!registro) {
      return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    }
    await registro.destroy();
    return res.json({ success: true, message: 'Espacio físico eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar infraestructura:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar espacio físico' });
  }
};

const uploadInfraestructuraTemplate = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se ha subido ningún archivo' });
    }

    const result = await mammoth.convertToHtml({ path: req.file.path });
    const html = result.value;
    const messages = result.messages;

    try {
      fs.unlinkSync(req.file.path);
    } catch (err) {
      console.error('Error al eliminar archivo temporal de plantilla:', err);
    }

    return res.json({
      success: true,
      data: {
        html,
        messages
      }
    });
  } catch (error) {
    console.error('Error al procesar plantilla docx:', error);
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}
    }
    return res.status(500).json({ success: false, message: 'Error al procesar el archivo Word. Asegúrese de que sea un archivo .docx válido.' });
  }
};

const getEdificacionesReferencia = async (req, res) => {
  try {
    const edificaciones = await PoblacionalEdificacionReferencia.findAll({
      order: [['ubicacion', 'ASC'], ['espacio', 'ASC'], ['id', 'ASC']]
    });
    return res.json({
      success: true,
      data: edificaciones
    });
  } catch (error) {
    console.error('Error al listar edificaciones de referencia:', error);
    return res.status(500).json({ success: false, message: 'Error al listar edificaciones de referencia' });
  }
};

const createEdificacionReferencia = async (req, res) => {
  try {
    const { espacio, ubicacion, direccion, calidad } = req.body;
    if (!espacio) {
      return res.status(400).json({ success: false, message: 'El nombre de la edificación/bloque (espacio) es obligatorio' });
    }

    const existing = await PoblacionalEdificacionReferencia.findOne({
      where: { espacio: { [Op.iLike]: espacio.trim() } }
    });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Ya existe una edificación o bloque con este nombre' });
    }

    const nuevo = await PoblacionalEdificacionReferencia.create({
      espacio: espacio.trim(),
      ubicacion: ubicacion ? ubicacion.trim() : null,
      direccion: direccion ? direccion.trim() : null,
      calidad: calidad ? calidad.trim() : null
    });

    return res.status(201).json({
      success: true,
      message: 'Edificación de referencia creada exitosamente',
      data: nuevo
    });
  } catch (error) {
    console.error('Error al crear edificación de referencia:', error);
    return res.status(500).json({ success: false, message: 'Error al crear edificación de referencia' });
  }
};

const updateEdificacionReferencia = async (req, res) => {
  try {
    const { id } = req.params;
    const { espacio, ubicacion, direccion, calidad } = req.body;

    const registro = await PoblacionalEdificacionReferencia.findByPk(id);
    if (!registro) {
      return res.status(404).json({ success: false, message: 'Edificación de referencia no encontrada' });
    }

    if (espacio && espacio.trim() !== registro.espacio) {
      const existing = await PoblacionalEdificacionReferencia.findOne({
        where: {
          espacio: { [Op.iLike]: espacio.trim() },
          id: { [Op.ne]: id }
        }
      });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Ya existe otra edificación o bloque con este nombre' });
      }
      registro.espacio = espacio.trim();
    }

    if (ubicacion !== undefined) registro.ubicacion = ubicacion ? ubicacion.trim() : null;
    if (direccion !== undefined) registro.direccion = direccion ? direccion.trim() : null;
    if (calidad !== undefined) registro.calidad = calidad ? calidad.trim() : null;

    await registro.save();

    return res.json({
      success: true,
      message: 'Edificación de referencia actualizada exitosamente',
      data: registro
    });
  } catch (error) {
    console.error('Error al actualizar edificación de referencia:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar edificación de referencia' });
  }
};

const deleteEdificacionReferencia = async (req, res) => {
  try {
    const { id } = req.params;
    const registro = await PoblacionalEdificacionReferencia.findByPk(id);
    if (!registro) {
      return res.status(404).json({ success: false, message: 'Edificación de referencia no encontrada' });
    }

    await registro.destroy();

    return res.json({
      success: true,
      message: 'Edificación de referencia eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar edificación de referencia:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar edificación de referencia' });
  }
};

const uploadAuditorioFoto = async (req, res) => {
  try {
    const { groupKey } = req.body;
    if (!groupKey) {
      return res.status(400).json({ success: false, message: 'Falta la clave del grupo del auditorio.' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se ha subido ningún archivo de imagen.' });
    }

    const relativePath = `/uploads/auditorios/${req.file.filename}`;

    // Determine query condition based on groupKey
    let condition = {};
    if (groupKey === 'aemg') {
      condition = { asignacion: 'AEMG', tipo_espacio: 'Auditorios' };
    } else if (groupKey === 'san_francisco') {
      condition = { descripcion: { [Op.iLike]: '%SAN FRANCISCO%' }, tipo_espacio: 'Auditorios' };
    } else if (groupKey === 'santa_clara') {
      condition = { descripcion: { [Op.iLike]: '%Santa Clara%' }, tipo_espacio: 'Auditorios' };
    } else if (groupKey === 'vaf') {
      condition = { asignacion: 'Vicerrectoría Administrativa Financiera', tipo_espacio: 'Auditorios' };
    } else {
      return res.status(400).json({ success: false, message: 'Clave de grupo de auditorio inválida.' });
    }

    const [updatedCount] = await PoblacionalInfraestructuraFisica.update(
      { foto_url: relativePath },
      { where: condition }
    );

    return res.json({
      success: true,
      message: 'Imagen del auditorio actualizada exitosamente.',
      data: {
        foto_url: relativePath,
        updatedCount
      }
    });
  } catch (error) {
    console.error('Error al subir foto del auditorio:', error);
    return res.status(500).json({ success: false, message: 'Error interno al subir la foto del auditorio.' });
  }
};

module.exports = {
  uploadAuditorioFoto,
  getEstadisticas,
  exportCaracterizacionRegistros,
  getMatriculadosIncidencias,
  getResumen,
  getCargues,
  createEstadistica,
  updateEstadistica,
  createAutoevaluacionParticipante,
  createAutoevaluacionPrograma,
  updateAutoevaluacionAspecto,
  updateAutoevaluacionParticipante,
  updateAutoevaluacionPrograma,
  deleteAutoevaluacionParticipante,
  deleteEstadistica,
  downloadTemplate,
  downloadContextoExternoNormalizado,
  downloadCargueErrores,
  downloadCargueBase,
  getRegistrosCalificadosEvidencias,
  getDivipolaIncidencias,
  resolveDivipolaIncidencia,
  importFromExcel,
  clearByCategoria,
  exportPlanAccionInstitucional,
  exportActaInstitucional,
  sugerirIndicadorPlanAccion,
  DATASET_CATEGORIES,
  getInfraestructuras,
  createInfraestructura,
  updateInfraestructura,
  deleteInfraestructura,
  uploadInfraestructuraTemplate,
  getEdificacionesReferencia,
  createEdificacionReferencia,
  updateEdificacionReferencia,
  deleteEdificacionReferencia
};



