require('dotenv').config();
const { sequelize, testConnection } = require('../config/database');
const { DataTypes } = require('sequelize');
const models = require('../models');

const ensureColumn = async (qi, table, column, definition) => {
  const description = await qi.describeTable(table);
  if (!Object.prototype.hasOwnProperty.call(description, column)) {
    await qi.addColumn(table, column, definition);
  }
};

const runMigrations = async () => {
  try {
    console.log('[migrate] Ejecutando migraciones...');
    await testConnection();
    const qi = sequelize.getQueryInterface();

    await models.User.sync();
    await models.UserModulePermission.sync();
    await models.DiccionarioCorreccionTexto.sync();
    await models.MacroProceso.sync();
    await models.Proceso.sync();
    await models.SubProceso.sync();
    await models.TipoDocumentacion.sync();
    await models.Documento.sync();
    await models.DocumentoFavorito.sync();
    await models.Estadistica.sync();
    await models.PoblacionalInscrito.sync();
    await models.PoblacionalAdmitido.sync();
    await models.PoblacionalPrimerCurso.sync();
    await qi.dropTable('poblacional_matriculados').catch(() => {});
    await models.PoblacionalMatriculado.sync();
    await models.PoblacionalGraduado.sync();
    await models.PoblacionalCaracterizacion.sync();
    await models.PoblacionalCantidadTotalEgresado.sync();
    await models.PoblacionalDesercionPeriodo.sync();
    await models.PoblacionalDesercionCohorte.sync();
    await models.PoblacionalDesercionAnual.sync();
    await models.PoblacionalContextoExterno.sync();
    await models.PoblacionalEmpleabilidad.sync();
    await models.SaberProResultadoIndividual.sync();
    await models.SaberProResultadoAgregado.sync();
    await models.RecursoHumanoDocente.sync();
    await models.RecursoHumanoAdministrativo.sync();
    await models.RecursoHumanoOutsourcing.sync();
    await models.RecursoHumanoOnda.sync();
    await models.RefDepartamento.sync();
    await models.RefMunicipio.sync();
    await models.RefDivipolaCarga.sync();
    await models.MatriculadosUbicacionIncidencia.sync();
    await models.GestionInformacionCarga.sync();
    await models.GeorreferenciaDepartamento.sync();
    await models.GeorreferenciaMunicipio.sync();
    await models.UserActivityLog.sync();

    await qi.changeColumn('estadisticas', 'programa', { type: DataTypes.STRING(500), allowNull: true });
    await qi.changeColumn('estadisticas', 'dependencia', { type: DataTypes.STRING(500), allowNull: true });
    await qi.changeColumn('estadisticas', 'indicador', { type: DataTypes.STRING(500), allowNull: false });
    await qi.changeColumn('estadisticas', 'fuente', { type: DataTypes.STRING(500), allowNull: true });
    await qi.changeColumn('gestion_informacion_cargas', 'variable', { type: DataTypes.STRING(500), allowNull: false });

    await ensureColumn(qi, 'poblacional_matriculados', 'codigo_departamento', { type: DataTypes.STRING(2), allowNull: true });
    await ensureColumn(qi, 'poblacional_matriculados', 'codigo_dane', { type: DataTypes.STRING(5), allowNull: true });
    await ensureColumn(qi, 'poblacional_matriculados', 'codigo_departamento_nacimiento', { type: DataTypes.STRING(2), allowNull: true });
    await ensureColumn(qi, 'poblacional_matriculados', 'codigo_dane_nacimiento', { type: DataTypes.STRING(5), allowNull: true });
    await ensureColumn(qi, 'poblacional_matriculados', 'match_confianza_ubicacion', { type: DataTypes.STRING(20), allowNull: true });
    await ensureColumn(qi, 'poblacional_matriculados', 'match_metodo_ubicacion', { type: DataTypes.STRING(40), allowNull: true });
    await ensureColumn(qi, 'poblacional_matriculados', 'match_score_ubicacion', { type: DataTypes.DECIMAL(6, 3), allowNull: true });
    await ensureColumn(qi, 'poblacional_matriculados', 'match_actualizado_en', { type: DataTypes.DATE, allowNull: true });
    await ensureColumn(qi, 'poblacional_matriculados', 'fuente', { type: DataTypes.STRING(120), allowNull: true });
    await ensureColumn(qi, 'poblacional_matriculados', 'fecha_ultimo_cargue', { type: DataTypes.STRING(40), allowNull: true });
    await ensureColumn(qi, 'saber_pro_resultados_individuales', 'tipo_prueba', { type: DataTypes.STRING(30), allowNull: true });
    await ensureColumn(qi, 'saber_pro_resultados_individuales', 'periodo_icfes', { type: DataTypes.STRING(40), allowNull: true });
    await ensureColumn(qi, 'saber_pro_resultados_individuales', 'lugar_presentacion', { type: DataTypes.STRING(180), allowNull: true });
    await ensureColumn(qi, 'saber_pro_resultados_individuales', 'modalidad', { type: DataTypes.STRING(120), allowNull: true });

    await qi.addIndex('ref_departamentos', ['nombre_normalizado'], { name: 'idx_ref_departamentos_nombre_normalizado' }).catch(() => {});
    await qi.addIndex('ref_municipios', ['codigo_departamento', 'nombre_normalizado'], { name: 'idx_ref_municipios_depto_nombre_norm' }).catch(() => {});
    await qi.addIndex('poblacional_matriculados', ['codigo_dane'], { name: 'idx_poblacional_matriculados_codigo_municipio' }).catch(() => {});
    await qi.addIndex('poblacional_matriculados', ['codigo_departamento'], { name: 'idx_poblacional_matriculados_codigo_departamento' }).catch(() => {});
    await qi.addIndex('poblacional_matriculados', ['codigo_dane_nacimiento'], { name: 'idx_poblacional_matriculados_codigo_municipio_nacimiento' }).catch(() => {});
    await qi.addIndex('poblacional_matriculados', ['codigo_departamento_nacimiento'], { name: 'idx_poblacional_matriculados_codigo_departamento_nacimiento' }).catch(() => {});

    console.log('[migrate] Migraciones completadas');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('[migrate] Error:', error);
    process.exit(1);
  }
};

runMigrations();
