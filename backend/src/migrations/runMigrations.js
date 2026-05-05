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

const getTableCount = async (tableName) => {
  const rows = await sequelize.query(`SELECT COUNT(*)::int AS c FROM ${tableName}`, { type: QueryTypes.SELECT });
  return Number(rows?.[0]?.c || 0);
};

const ensureUserRoleEnumValues = async () => {
  const roleValues = [
    'planeacion_estrategica',
    'planeacion_efectividad',
    'autoevaluacion',
    'gestion_informacion',
    'gestion_por_procesos',
    'registros_calificados_acreditacion'
  ];

  for (const role of roleValues) {
    await sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_users_role')
          AND NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = 'enum_users_role' AND e.enumlabel = '${role}'
          )
        THEN
          ALTER TYPE "enum_users_role" ADD VALUE '${role}';
        END IF;
      END
      $$;
    `);
  }
};

const repairMatriculadosFromEstadisticas = async () => {
  const hasMatriculados = await getTableCount('poblacional_matriculados');
  if (hasMatriculados > 0) {
    console.log(`[migrate] poblacional_matriculados ya tiene datos (${hasMatriculados})`);
    return;
  }

  const sourceCountRows = await sequelize.query(
    `SELECT COUNT(*)::int AS c
     FROM estadisticas
     WHERE categoria = 'Poblacional' AND subcategoria = 'Matriculados'`,
    { type: QueryTypes.SELECT }
  );
  const sourceCount = Number(sourceCountRows?.[0]?.c || 0);
  if (sourceCount === 0) {
    console.log('[migrate] No hay filas fuente en estadisticas para Matriculados; se omite backfill');
    return;
  }

  console.log(`[migrate] Backfill Matriculados desde estadisticas (${sourceCount} filas fuente)...`);
  await sequelize.query(`
    INSERT INTO poblacional_matriculados (
      anio,
      semestre,
      programa,
      departamento,
      pais,
      fuente,
      fecha_ultimo_cargue,
      created_at,
      updated_at
    )
    SELECT
      e.anio,
      CASE
        WHEN COALESCE(e.observaciones, '') ~* '(periodo\\s*:\\s*(2|II|IIP|2P)|\\b(II|IIP|2)\\b)' THEN '2'
        ELSE '1'
      END AS semestre,
      NULLIF(TRIM(COALESCE(e.programa, '')), ''),
      NULLIF(TRIM(COALESCE(e.dependencia, '')), ''),
      'COLOMBIA',
      NULLIF(TRIM(COALESCE(e.fuente, '')), ''),
      TO_CHAR(NOW(), 'YYYY-MM-DD'),
      NOW(),
      NOW()
    FROM estadisticas e
    JOIN LATERAL generate_series(
      1,
      GREATEST(
        1,
        LEAST(200, ROUND(COALESCE(CAST(e.valor AS numeric), 1))::int)
      )
    ) AS gs(n) ON TRUE
    WHERE e.categoria = 'Poblacional'
      AND e.subcategoria = 'Matriculados'
      AND COALESCE(e.anio, 0) > 0
  `);

  const finalCount = await getTableCount('poblacional_matriculados');
  console.log(`[migrate] Matriculados restaurados: ${finalCount}`);
};

const repairGeorreferenciaFromDivipola = async () => {
  const geoDeptCount = await getTableCount('georreferencia_departamentos');
  const geoMuniCount = await getTableCount('georreferencia_municipios');
  if (geoDeptCount > 0 && geoMuniCount > 0) {
    console.log(`[migrate] georreferencia_* ya tiene datos (dept=${geoDeptCount}, muni=${geoMuniCount})`);
    return;
  }

  const refDeptCount = await getTableCount('ref_departamentos');
  const refMuniCount = await getTableCount('ref_municipios');
  if (refDeptCount === 0 || refMuniCount === 0) {
    console.log('[migrate] ref_departamentos/ref_municipios sin datos; se omite backfill de georreferencia');
    return;
  }

  console.log('[migrate] Backfill georreferencia_* desde ref_*...');

  if (geoDeptCount === 0) {
    await sequelize.query(`
      INSERT INTO georreferencia_departamentos (
        codigo_departamento,
        nombre_departamento,
        nombre_normalizado,
        latitud,
        longitud,
        fuente,
        vigente,
        created_at,
        updated_at
      )
      SELECT
        d.codigo_dane,
        d.nombre_oficial,
        d.nombre_normalizado,
        AVG(m.latitud)::numeric(10,6) AS latitud,
        AVG(m.longitud)::numeric(10,6) AS longitud,
        'REF_DIVIPOLA',
        true,
        NOW(),
        NOW()
      FROM ref_departamentos d
      LEFT JOIN ref_municipios m ON m.codigo_departamento = d.codigo_dane AND m.activo = true
      WHERE d.activo = true
      GROUP BY d.codigo_dane, d.nombre_oficial, d.nombre_normalizado
    `);
  }

  if (geoMuniCount === 0) {
    await sequelize.query(`
      INSERT INTO georreferencia_municipios (
        codigo_departamento,
        codigo_municipio,
        nombre_municipio,
        nombre_normalizado,
        latitud,
        longitud,
        fuente,
        vigente,
        created_at,
        updated_at
      )
      SELECT
        m.codigo_departamento,
        m.codigo_dane,
        m.nombre_oficial,
        m.nombre_normalizado,
        m.latitud,
        m.longitud,
        'REF_DIVIPOLA',
        true,
        NOW(),
        NOW()
      FROM ref_municipios m
      WHERE m.activo = true
    `);
  }

  const finalDept = await getTableCount('georreferencia_departamentos');
  const finalMuni = await getTableCount('georreferencia_municipios');
  console.log(`[migrate] Georreferencia restaurada: dept=${finalDept}, muni=${finalMuni}`);
};

const ensureDocumentTextColumns = async (qi) => {
  await ensureColumn(qi, 'documentos', 'macroproceso', { type: DataTypes.STRING(255), allowNull: true });
  await ensureColumn(qi, 'documentos', 'proceso', { type: DataTypes.STRING(255), allowNull: true });
  await ensureColumn(qi, 'documentos', 'subproceso', { type: DataTypes.STRING(255), allowNull: true });
  await ensureColumn(qi, 'documentos', 'tipo_documento', { type: DataTypes.STRING(200), allowNull: true });
  await ensureColumn(qi, 'documentos', 'observaciones', { type: DataTypes.TEXT, allowNull: true });
  await ensureColumn(qi, 'documentos', 'orden_origen', { type: DataTypes.INTEGER, allowNull: true });
  await ensureColumn(qi, 'documentos', 'fila_origen', { type: DataTypes.INTEGER, allowNull: true });
  await ensureColumn(qi, 'documentos', 'datos_originales', { type: DataTypes.JSONB, allowNull: true });

  await sequelize.query(`
    UPDATE documentos d
    SET
      macroproceso = COALESCE(d.macroproceso, x.macroproceso),
      proceso = COALESCE(d.proceso, x.proceso),
      subproceso = COALESCE(d.subproceso, x.subproceso),
      tipo_documento = COALESCE(d.tipo_documento, x.tipo_documento)
    FROM (
      SELECT
        doc.id,
        mp.nombre AS macroproceso,
        p.nombre AS proceso,
        sp.nombre AS subproceso,
        td.nombre AS tipo_documento
      FROM documentos doc
      LEFT JOIN subprocesos sp ON sp.id = doc.subproceso_id
      LEFT JOIN procesos p ON p.id = sp.proceso_id
      LEFT JOIN macro_procesos mp ON mp.id = p.macro_proceso_id
      LEFT JOIN tipos_documentacion td ON td.id = doc.tipo_documentacion_id
    ) x
    WHERE d.id = x.id
      AND (d.macroproceso IS NULL OR d.proceso IS NULL OR d.subproceso IS NULL OR d.tipo_documento IS NULL)
  `);
};

const ensureDocumentSheetsView = async () => {
  await sequelize.query(`
    CREATE OR REPLACE VIEW documentos_sheets AS
    SELECT
      d.macroproceso AS "MACROPROCESO",
      d.proceso AS "PROCESO",
      d.subproceso AS "SUBPROCESO",
      d.codigo AS "CODIGO",
      d.titulo AS "TITULO_DOCUMENTO",
      d.tipo_documento AS "TIPO_DOCUMENTO",
      d.version AS "VERSIÓN",
      d.fecha_creacion AS "FECHA_CREACION",
      d.revisa AS "REVISA",
      d.aprueba AS "APRUEBA",
      d.fecha_aprobacion AS "FECHA_APROBACION",
      d.autor AS "AUTOR",
      COALESCE(
        d.datos_originales ->> 'ESTADO',
        CASE d.estado
          WHEN 'vigente' THEN 'ACTIVOS'
          WHEN 'en_revision' THEN 'PENDIENTE APROBACIÓN'
          ELSE 'INACTIVO'
        END
      ) AS "ESTADO",
      d.link_acceso AS "LINK_ACCESO",
      d.observaciones AS "OBSERVACIONES"
    FROM documentos d
  `);
};

const runMigrations = async () => {
  try {
    console.log('[migrate] Ejecutando migraciones...');
    await testConnection();
    const qi = sequelize.getQueryInterface();

    await ensureUserRoleEnumValues();
    await models.User.sync();
    await models.UserModulePermission.sync();
    await models.DiccionarioCorreccionTexto.sync();
    await models.MacroProceso.sync();
    await models.Proceso.sync();
    await models.SubProceso.sync();
    await models.TipoDocumentacion.sync();
    await models.Documento.sync();
    await ensureDocumentTextColumns(qi);
    await ensureDocumentSheetsView();
    await models.DocumentoFavorito.sync();
    await models.Estadistica.sync();
    await models.PoblacionalInscrito.sync();
    await models.PoblacionalAdmitido.sync();
    await models.PoblacionalPrimerCurso.sync();
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
    await models.PlanAccion.sync();
    await models.Autoevaluacion.sync();
    await models.AutoevaluacionParticipante.sync();
    await models.AutoevaluacionPrograma.sync();
    await models.InstrumentForm.sync();
    await models.InstrumentSection.sync();
    await models.InstrumentQuestion.sync();
    await models.InstrumentCondition.sync();
    await models.InstrumentResponse.sync();
    await models.InstrumentAnswer.sync();
    await models.InstrumentAttachment.sync();
    await models.InstrumentQuestionBank.sync();
    await models.InstrumentBackup.sync();
    await models.SecurityScan.sync();
    await models.SecurityFinding.sync();
    await models.SecurityRemediationProposal.sync();
    await models.SecurityFindingComment.sync();
    await sequelize.query("CREATE INDEX IF NOT EXISTS instrument_forms_created_by_status_idx ON instrument_forms (created_by, status)");
    await sequelize.query("CREATE INDEX IF NOT EXISTS instrument_responses_form_submitted_idx ON instrument_responses (form_id, submitted_at)");
    await sequelize.query("CREATE INDEX IF NOT EXISTS security_findings_scan_severity_idx ON security_findings (scan_id, severity)");
    await sequelize.query("CREATE INDEX IF NOT EXISTS security_findings_status_component_idx ON security_findings (status, affected_component)");

    // Workflow plan_accion: agregar columnas no destructivas + backfill de filas legadas como 'Aprobado'.
    await ensureColumn(qi, 'plan_accion', 'dependencia', { type: DataTypes.STRING(400), allowNull: true });
    await ensureColumn(qi, 'plan_accion', 'plan_codigo', { type: DataTypes.STRING(80), allowNull: true });
    await ensureColumn(qi, 'plan_accion', 'estado_workflow', { type: DataTypes.STRING(40), allowNull: true });
    await ensureColumn(qi, 'plan_accion', 'revisor_estrategico_id', { type: DataTypes.INTEGER, allowNull: true });
    await ensureColumn(qi, 'plan_accion', 'responsable_id', { type: DataTypes.INTEGER, allowNull: true });
    await ensureColumn(qi, 'plan_accion', 'aprobado_por', { type: DataTypes.INTEGER, allowNull: true });
    await ensureColumn(qi, 'plan_accion', 'fecha_envio_estrategica', { type: DataTypes.DATE, allowNull: true });
    await ensureColumn(qi, 'plan_accion', 'fecha_revisado_estrategica', { type: DataTypes.DATE, allowNull: true });
    await ensureColumn(qi, 'plan_accion', 'fecha_envio_responsable', { type: DataTypes.DATE, allowNull: true });
    await ensureColumn(qi, 'plan_accion', 'fecha_revisado_responsable', { type: DataTypes.DATE, allowNull: true });
    await ensureColumn(qi, 'plan_accion', 'fecha_aprobado', { type: DataTypes.DATE, allowNull: true });
    await ensureColumn(qi, 'plan_accion', 'cabecera_plan', { type: DataTypes.JSONB, allowNull: true });
    await ensureColumn(qi, 'plan_accion', 'deleted_at', { type: DataTypes.DATE, allowNull: true });
    await sequelize.query("UPDATE plan_accion SET estado_workflow = 'Aprobado' WHERE estado_workflow IS NULL");
    await sequelize.query("CREATE INDEX IF NOT EXISTS plan_accion_plan_codigo_idx ON plan_accion (plan_codigo)");
    await sequelize.query("CREATE INDEX IF NOT EXISTS plan_accion_estado_idx ON plan_accion (estado_workflow)");
    await sequelize.query("CREATE INDEX IF NOT EXISTS plan_accion_responsable_idx ON plan_accion (responsable_id)");

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

    await repairMatriculadosFromEstadisticas();
    await repairGeorreferenciaFromDivipola();

    console.log('[migrate] Migraciones completadas');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('[migrate] Error:', error);
    process.exit(1);
  }
};

runMigrations();
