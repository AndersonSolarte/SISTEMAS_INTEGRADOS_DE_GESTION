require('dotenv').config();
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const models = require('../models');

const normalizeDbText = (value = '') => {
  let text = String(value ?? '').trim();
  if (!text) return text;

  const replacements = [
    ['Ã¡', 'á'], ['Ã©', 'é'], ['Ã­', 'í'], ['Ã³', 'ó'], ['Ãº', 'ú'], ['Ã', 'Á'],
    ['Ã‰', 'É'], ['Ã', 'Í'], ['Ã“', 'Ó'], ['Ãš', 'Ú'], ['Ã±', 'ñ'], ['Ã‘', 'Ñ'],
    ['Ã¼', 'ü'], ['Ãœ', 'Ü'], ['â€œ', '"'], ['â€', '"'], ['â€˜', "'"], ['â€™', "'"],
    ['â€“', '-'], ['â€”', '-'], ['Â°', '°'], ['Â', ''], ['ðŸ“', ''], ['ðŸš©', '']
  ];
  replacements.forEach(([from, to]) => {
    text = text.split(from).join(to);
  });

  if (/[ÃÂâð]/.test(text)) {
    try {
      const repaired = Buffer.from(text, 'latin1').toString('utf8');
      if (repaired && repaired !== text && !/\uFFFD/.test(repaired)) {
        text = repaired;
      }
    } catch (_) {
      // noop
    }
  }

  return text.replace(/\s+/g, ' ').trim();
};

const TARGETS = [
  { model: models.GestionInformacionCarga, fields: ['categoria', 'subcategoria', 'variable', 'archivo_nombre', 'detalle'] },
  { model: models.Estadistica, fields: ['categoria', 'subcategoria', 'programa', 'dependencia', 'indicador', 'unidad', 'fuente', 'observaciones'] },
  { model: models.PoblacionalMatriculado, fields: ['nombre_ies', 'participante', 'tipo_documento', 'otros_documentos', 'sexo_biologico', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'programa', 'departamento', 'municipio', 'pais', 'departamento_nacimiento', 'municipio_nacimiento', 'zona_residencia', 'semestre', 'semestre_primer_curso', 'fuente'] },
  { model: models.PoblacionalInscrito, fields: ['nombre_ies', 'tipo_documento', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'programa', 'genero_biologico', 'periodo', 'facultad'] },
  { model: models.PoblacionalAdmitido, fields: ['nombre_ies', 'programa', 'tipo_documento', 'genero_biologico', 'periodo', 'facultad'] },
  { model: models.PoblacionalPrimerCurso, fields: ['nombre_ies', 'tipo_documento', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'programa', 'grupo_etnico', 'pueblo_indigena', 'comunidad_negra', 'capacidad_excepcional', 'genero_biologico', 'periodo', 'facultad'] },
  { model: models.PoblacionalGraduado, fields: ['nombre_ies', 'tipo_documento', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'programa', 'departamento', 'municipio', 'verificado', 'genero_biologico', 'periodo', 'facultad'] },
  { model: models.PoblacionalCaracterizacion, fields: ['periodo', 'tipo_documentacion', 'programa', 'apellidos_nombres', 'genero', 'victima_conflicto_armado', 'correo_electronico', 'estado_civil', 'grupo_etnico', 'eps', 'municipio_residencia', 'departamento_residencia', 'pais_residencia', 'discapacidad', 'nucleo_familiar', 'ingresos_familiares', 'ingresos_familiares_2', 'institucion', 'titulo_obtenido', 'tipo_credito', 'zona_procedencia'] },
  { model: models.PoblacionalCantidadTotalEgresado, fields: ['programa', 'detalle'] },
  { model: models.PoblacionalDesercionPeriodo, fields: ['periodo_referencia', 'tipo_desercion', 'programa'] },
  { model: models.PoblacionalDesercionCohorte, fields: ['periodo_referencia', 'tipo_desercion', 'programa', 'corte_informacion'] },
  { model: models.PoblacionalDesercionAnual, fields: ['periodo_referencia', 'tipo_desercion', 'programa'] },
  { model: models.PoblacionalContextoExterno, fields: ['tipo_registro', 'base_indicador', 'alcance', 'hoja_fuente', 'periodo_referencia', 'sector', 'ies', 'programa_comparado', 'programa_objetivo', 'departamento', 'municipio', 'modalidad', 'periodicidad', 'fecha_registro_snies', 'oferta_tag', 'raw_data'] },
  { model: models.PoblacionalEmpleabilidad, fields: ['ies', 'denominacion_programa'] },
  { model: models.SaberProResultadoIndividual, fields: ['tipo_prueba', 'tipo_documento', 'nombre', 'tipo_evaluado', 'programa', 'ciudad', 'grupo_referencia', 'modulo', 'nivel_desempeno', 'novedades', 'periodo', 'periodo_icfes', 'lugar_presentacion', 'modalidad', 'competencias'] },
  { model: models.SaberProResultadoAgregado, fields: ['programa', 'competencia', 'tipo_prueba'] },
  { model: models.RecursoHumanoDocente, fields: ['periodo', 'docente', 'genero_biologico', 'departamento_dependencia', 'programa', 'tipo_vinculacion', 'contrato', 'cargo', 'escalafon', 'pais', 'municipio_nacimiento', 'nivel_maximo_estudio', 'titulo_recibido', 'pais_institucion_estudio', 'titulo_convalidado', 'nombre_institucion_estudio', 'metodologia_programa'] },
  { model: models.RecursoHumanoAdministrativo, fields: ['periodo', 'estado_laboral', 'nombre_empleado', 'cargo_especifico', 'dependencia', 'vicerectoria', 'tipo_cotizante', 'clase_contrato', 'corte_informacion', 'genero_biologico'] },
  { model: models.RecursoHumanoOutsourcing, fields: ['periodo', 'cargo', 'genero_biologico'] },
  { model: models.RecursoHumanoOnda, fields: ['periodo', 'nombre', 'genero'] }
];

const sanitizeTarget = async ({ model, fields }) => {
  let updated = 0;
  const rows = await model.findAll({ where: { id: { [Op.ne]: null } } });
  for (const row of rows) {
    const patch = {};
    fields.forEach((field) => {
      const current = row.get(field);
      if (typeof current !== 'string') return;
      const next = normalizeDbText(current);
      if (next && next !== current) patch[field] = next;
    });
    if (Object.keys(patch).length > 0) {
      await row.update(patch, { silent: true });
      updated += 1;
    }
  }
  return updated;
};

const run = async () => {
  try {
    let totalUpdated = 0;
    for (const target of TARGETS) {
      totalUpdated += await sanitizeTarget(target);
    }
    console.log(`Registros saneados: ${totalUpdated}`);
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Error saneando textos:', error);
    process.exit(1);
  }
};

run();
