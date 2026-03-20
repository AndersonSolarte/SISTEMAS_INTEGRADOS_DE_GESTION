require('dotenv').config();
const { sequelize, testConnection } = require('../config/database');
const { DataTypes, QueryTypes } = require('sequelize');
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
    await models.Saber11Resultado.sync();
    await models.VaEquivalenciaConfig.sync();
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

    // Nuevas columnas Saber 11 para tipos de examen adicionales
    await ensureColumn(qi, 'resultados_saber11', 'espanol_y_literatura',    { type: DataTypes.DECIMAL(10, 2), allowNull: true });
    await ensureColumn(qi, 'resultados_saber11', 'conocimiento_matematico', { type: DataTypes.DECIMAL(10, 2), allowNull: true });
    await ensureColumn(qi, 'resultados_saber11', 'aptitud_matematica',      { type: DataTypes.DECIMAL(10, 2), allowNull: true });
    await ensureColumn(qi, 'resultados_saber11', 'electiva',                { type: DataTypes.DECIMAL(10, 2), allowNull: true });
    await ensureColumn(qi, 'resultados_saber11', 'ciencias_naturales',      { type: DataTypes.DECIMAL(10, 2), allowNull: true });
    await ensureColumn(qi, 'resultados_saber11', 'razonamiento_cuantitativo', { type: DataTypes.DECIMAL(10, 2), allowNull: true });
    await ensureColumn(qi, 'resultados_saber11', 'competencias_ciudadanas', { type: DataTypes.DECIMAL(10, 2), allowNull: true });
    await ensureColumn(qi, 'resultados_saber11', 'sociales_y_ciudadana',    { type: DataTypes.DECIMAL(10, 2), allowNull: true });

    // Sembrar los 7 tipos de equivalencias si la tabla está vacía
    const countRows = await sequelize.query('SELECT COUNT(*) AS cnt FROM va_equivalencias_config', { type: QueryTypes.SELECT });
    if (Number(countRows[0]?.cnt || 0) === 0) {
      const TIPOS = [
        {
          tipo_numero: 1, nombre: 'TIPO_1', orden_deteccion: 1,
          detector_col: 'espanol_y_literatura', detector_extra: null,
          descripcion: 'Saber 11 con Español y Literatura, Conocimiento Matemático, Física, Química, Sociales, Electiva',
          reglas: {
            lectura_critica:           ['espanol_y_literatura'],
            razonamiento_cuantitativo: ['conocimiento_matematico', 'fisica', 'quimica'],
            competencias_ciudadanas:   ['sociales'],
            comunicacion_escrita:      ['espanol_y_literatura'],
            ingles:                    ['electiva']
          }
        },
        {
          tipo_numero: 2, nombre: 'TIPO_2', orden_deteccion: 2,
          detector_col: 'aptitud_matematica', detector_extra: null,
          descripcion: 'Saber 11 con Aptitud Matemática, Biología, Conocimiento Matemático, Física, Química, Lenguaje, Sociales, Electiva',
          reglas: {
            lectura_critica:           ['lenguaje'],
            razonamiento_cuantitativo: ['aptitud_matematica', 'biologia', 'conocimiento_matematico', 'fisica', 'quimica'],
            competencias_ciudadanas:   ['sociales'],
            comunicacion_escrita:      ['lenguaje'],
            ingles:                    ['electiva']
          }
        },
        {
          tipo_numero: 3, nombre: 'TIPO_3', orden_deteccion: 3,
          detector_col: 'filosofia', detector_extra: 'geografia',
          descripcion: 'Saber 11 con Filosofía, Lenguaje, Biología, Física, Matemáticas, Química, Geografía, Historia, Inglés',
          reglas: {
            lectura_critica:           ['filosofia', 'lenguaje'],
            razonamiento_cuantitativo: ['biologia', 'fisica', 'matematicas', 'quimica'],
            competencias_ciudadanas:   ['geografia', 'historia'],
            comunicacion_escrita:      ['lenguaje'],
            ingles:                    ['ingles']
          }
        },
        {
          tipo_numero: 4, nombre: 'TIPO_4', orden_deteccion: 4,
          detector_col: 'filosofia', detector_extra: null,
          descripcion: 'Saber 11 con Filosofía, Lenguaje, Biología, Física, Matemáticas, Química, Sociales, Inglés',
          reglas: {
            lectura_critica:           ['filosofia', 'lenguaje'],
            razonamiento_cuantitativo: ['biologia', 'fisica', 'matematicas', 'quimica'],
            competencias_ciudadanas:   ['sociales'],
            comunicacion_escrita:      ['lenguaje'],
            ingles:                    ['ingles']
          }
        },
        {
          tipo_numero: 5, nombre: 'TIPO_5', orden_deteccion: 5,
          detector_col: 'razonamiento_cuantitativo', detector_extra: 'competencias_ciudadanas',
          descripcion: 'Saber 11 moderno con Lectura Crítica, Ciencias Naturales, Matemáticas, Razonamiento Cuantitativo, Competencias Ciudadanas, Sociales y Ciudadana, Inglés',
          reglas: {
            lectura_critica:           ['lectura_critica'],
            razonamiento_cuantitativo: ['ciencias_naturales', 'matematicas', 'razonamiento_cuantitativo'],
            competencias_ciudadanas:   ['competencias_ciudadanas', 'sociales_y_ciudadana'],
            comunicacion_escrita:      ['lectura_critica'],
            ingles:                    ['ingles']
          }
        },
        {
          tipo_numero: 6, nombre: 'TIPO_6', orden_deteccion: 6,
          detector_col: 'ciencias_naturales', detector_extra: null,
          descripcion: 'Saber 11 moderno con Lectura Crítica, Ciencias Naturales, Matemáticas, Sociales y Ciudadana, Inglés',
          reglas: {
            lectura_critica:           ['lectura_critica'],
            razonamiento_cuantitativo: ['ciencias_naturales', 'matematicas'],
            competencias_ciudadanas:   ['sociales_y_ciudadana'],
            comunicacion_escrita:      ['lectura_critica'],
            ingles:                    ['ingles']
          }
        },
        {
          tipo_numero: 7, nombre: 'TIPO_7', orden_deteccion: 7,
          detector_col: 'lectura_critica', detector_extra: 'matematicas',
          descripcion: 'Saber 11 con Lectura Crítica, Ciencias Naturales, Matemáticas, Sociales y Ciudadana, Inglés (variante)',
          reglas: {
            lectura_critica:           ['lectura_critica'],
            razonamiento_cuantitativo: ['ciencias_naturales', 'matematicas'],
            competencias_ciudadanas:   ['sociales_y_ciudadana'],
            comunicacion_escrita:      ['lectura_critica'],
            ingles:                    ['ingles']
          }
        }
      ];
      for (const t of TIPOS) {
        await sequelize.query(
          `INSERT INTO va_equivalencias_config
            (tipo_numero, nombre, descripcion, detector_col, detector_extra, reglas, activo, orden_deteccion, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?::jsonb, true, ?, NOW(), NOW())`,
          { replacements: [t.tipo_numero, t.nombre, t.descripcion, t.detector_col, t.detector_extra, JSON.stringify(t.reglas), t.orden_deteccion], type: QueryTypes.INSERT }
        );
      }
      console.log('[migrate] Sembrados 7 tipos de equivalencias VA');
    }

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
