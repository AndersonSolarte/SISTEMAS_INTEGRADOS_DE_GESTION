-- Fusiona datos de la BD del trabajo (work_src) hacia la BD destino (public)
-- sin perder información. Prioriza registros mas recientes cuando existe
-- la misma entidad de negocio.
--
-- Uso esperado:
-- 1) Ejecutar este script conectado a la BD destino final (ej: sgc_merge).
-- 2) Ajustar host/port/dbname/user/password del SERVER/MAPPING.
-- 3) Revisar resultado de los SELECT de conteo al final.

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgres_fdw;

DROP SCHEMA IF EXISTS work_src CASCADE;
CREATE SCHEMA work_src;

DROP SERVER IF EXISTS work_server CASCADE;
CREATE SERVER work_server
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (host '127.0.0.1', port '5433', dbname 'sgc_work_raw');

-- Reemplaza user/password por los de PostgreSQL en tu equipo.
CREATE USER MAPPING FOR CURRENT_USER
  SERVER work_server
  OPTIONS (user 'postgres', password 'CAMBIAR_PASSWORD');

IMPORT FOREIGN SCHEMA public
  FROM SERVER work_server
  INTO work_src;

-- -------------------------------------------------------------------------
-- 1) Catalogos base
-- -------------------------------------------------------------------------
INSERT INTO macro_procesos (nombre)
SELECT DISTINCT TRIM(w.nombre)
FROM work_src.macro_procesos w
WHERE TRIM(COALESCE(w.nombre, '')) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM macro_procesos t
    WHERE LOWER(TRIM(t.nombre)) = LOWER(TRIM(w.nombre))
  );

INSERT INTO tipos_documentacion (nombre)
SELECT DISTINCT TRIM(w.nombre)
FROM work_src.tipos_documentacion w
WHERE TRIM(COALESCE(w.nombre, '')) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM tipos_documentacion t
    WHERE LOWER(TRIM(t.nombre)) = LOWER(TRIM(w.nombre))
  );

INSERT INTO procesos (macro_proceso_id, nombre)
SELECT DISTINCT mp_t.id, TRIM(wp.nombre)
FROM work_src.procesos wp
JOIN work_src.macro_procesos wmp ON wmp.id = wp.macro_proceso_id
JOIN macro_procesos mp_t
  ON LOWER(TRIM(mp_t.nombre)) = LOWER(TRIM(wmp.nombre))
LEFT JOIN procesos p_t
  ON p_t.macro_proceso_id = mp_t.id
 AND LOWER(TRIM(p_t.nombre)) = LOWER(TRIM(wp.nombre))
WHERE p_t.id IS NULL
  AND TRIM(COALESCE(wp.nombre, '')) <> '';

INSERT INTO subprocesos (proceso_id, nombre)
SELECT DISTINCT p_t.id, TRIM(wsp.nombre)
FROM work_src.subprocesos wsp
JOIN work_src.procesos wp ON wp.id = wsp.proceso_id
JOIN work_src.macro_procesos wmp ON wmp.id = wp.macro_proceso_id
JOIN macro_procesos mp_t
  ON LOWER(TRIM(mp_t.nombre)) = LOWER(TRIM(wmp.nombre))
JOIN procesos p_t
  ON p_t.macro_proceso_id = mp_t.id
 AND LOWER(TRIM(p_t.nombre)) = LOWER(TRIM(wp.nombre))
LEFT JOIN subprocesos sp_t
  ON sp_t.proceso_id = p_t.id
 AND LOWER(TRIM(sp_t.nombre)) = LOWER(TRIM(wsp.nombre))
WHERE sp_t.id IS NULL
  AND TRIM(COALESCE(wsp.nombre, '')) <> '';

-- -------------------------------------------------------------------------
-- 2) Usuarios (clave de negocio: email)
-- -------------------------------------------------------------------------
INSERT INTO users (
  nombre, email, password, role, estado, created_at, updated_at,
  username, reset_token, reset_token_expiry, last_login, must_change_password
)
SELECT
  wu.nombre,
  LOWER(TRIM(wu.email)) AS email,
  wu.password,
  wu.role,
  wu.estado,
  wu.created_at,
  wu.updated_at,
  NULLIF(TRIM(wu.username), ''),
  wu.reset_token,
  wu.reset_token_expiry,
  wu.last_login,
  COALESCE(wu.must_change_password, false)
FROM work_src.users wu
WHERE TRIM(COALESCE(wu.email, '')) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM users u
    WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(wu.email))
  );

UPDATE users u
SET
  nombre = wu.nombre,
  password = wu.password,
  role = wu.role,
  estado = wu.estado,
  username = NULLIF(TRIM(wu.username), ''),
  reset_token = wu.reset_token,
  reset_token_expiry = wu.reset_token_expiry,
  last_login = GREATEST(COALESCE(u.last_login, wu.last_login), COALESCE(wu.last_login, u.last_login)),
  must_change_password = COALESCE(wu.must_change_password, u.must_change_password),
  updated_at = GREATEST(COALESCE(u.updated_at, wu.updated_at), COALESCE(wu.updated_at, u.updated_at))
FROM work_src.users wu
WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(wu.email))
  AND COALESCE(wu.updated_at, wu.created_at, NOW()) > COALESCE(u.updated_at, u.created_at, TIMESTAMP '1900-01-01');

CREATE TEMP TABLE tmp_user_map AS
SELECT wu.id AS work_user_id, u.id AS target_user_id
FROM work_src.users wu
JOIN users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(wu.email));

-- -------------------------------------------------------------------------
-- 3) Documentos (clave de negocio: codigo)
-- -------------------------------------------------------------------------
WITH mapped_work_docs AS (
  SELECT
    wd.id,
    wd.codigo,
    wd.titulo,
    wd.version,
    wd.fecha_creacion,
    wd.revisa,
    wd.aprueba,
    wd.fecha_aprobacion,
    wd.autor,
    wd.estado,
    wd.link_acceso,
    wd.created_at,
    wd.updated_at,
    wd.eliminado,
    wd.eliminado_por,
    wd.eliminado_en,
    creator.target_user_id AS creado_por_mapped,
    updater.target_user_id AS actualizado_por_mapped,
    deleter.target_user_id AS eliminado_por_mapped,
    td_t.id AS tipo_documentacion_id_mapped,
    sp_t.id AS subproceso_id_mapped
  FROM work_src.documentos wd
  JOIN work_src.tipos_documentacion wtd ON wtd.id = wd.tipo_documentacion_id
  JOIN tipos_documentacion td_t ON LOWER(TRIM(td_t.nombre)) = LOWER(TRIM(wtd.nombre))
  JOIN work_src.subprocesos wsp ON wsp.id = wd.subproceso_id
  JOIN work_src.procesos wp ON wp.id = wsp.proceso_id
  JOIN work_src.macro_procesos wmp ON wmp.id = wp.macro_proceso_id
  JOIN macro_procesos mp_t ON LOWER(TRIM(mp_t.nombre)) = LOWER(TRIM(wmp.nombre))
  JOIN procesos p_t ON p_t.macro_proceso_id = mp_t.id AND LOWER(TRIM(p_t.nombre)) = LOWER(TRIM(wp.nombre))
  JOIN subprocesos sp_t ON sp_t.proceso_id = p_t.id AND LOWER(TRIM(sp_t.nombre)) = LOWER(TRIM(wsp.nombre))
  LEFT JOIN tmp_user_map creator ON creator.work_user_id = wd.creado_por
  LEFT JOIN tmp_user_map updater ON updater.work_user_id = wd.actualizado_por
  LEFT JOIN tmp_user_map deleter ON deleter.work_user_id = wd.eliminado_por
  WHERE TRIM(COALESCE(wd.codigo, '')) <> ''
)
INSERT INTO documentos (
  subproceso_id, tipo_documentacion_id, codigo, titulo, version, fecha_creacion,
  revisa, aprueba, fecha_aprobacion, autor, estado, link_acceso, created_at, updated_at,
  creado_por, actualizado_por, eliminado, eliminado_por, eliminado_en
)
SELECT
  m.subproceso_id_mapped,
  m.tipo_documentacion_id_mapped,
  m.codigo,
  m.titulo,
  m.version,
  m.fecha_creacion,
  m.revisa,
  m.aprueba,
  m.fecha_aprobacion,
  m.autor,
  m.estado,
  m.link_acceso,
  m.created_at,
  m.updated_at,
  m.creado_por_mapped,
  m.actualizado_por_mapped,
  m.eliminado,
  m.eliminado_por_mapped,
  m.eliminado_en
FROM mapped_work_docs m
WHERE NOT EXISTS (
  SELECT 1
  FROM documentos d
  WHERE UPPER(TRIM(d.codigo)) = UPPER(TRIM(m.codigo))
);

WITH mapped_work_docs AS (
  SELECT
    wd.codigo,
    wd.titulo,
    wd.version,
    wd.fecha_creacion,
    wd.revisa,
    wd.aprueba,
    wd.fecha_aprobacion,
    wd.autor,
    wd.estado,
    wd.link_acceso,
    wd.updated_at,
    wd.eliminado,
    wd.eliminado_en,
    creator.target_user_id AS creado_por_mapped,
    updater.target_user_id AS actualizado_por_mapped,
    deleter.target_user_id AS eliminado_por_mapped,
    td_t.id AS tipo_documentacion_id_mapped,
    sp_t.id AS subproceso_id_mapped
  FROM work_src.documentos wd
  JOIN work_src.tipos_documentacion wtd ON wtd.id = wd.tipo_documentacion_id
  JOIN tipos_documentacion td_t ON LOWER(TRIM(td_t.nombre)) = LOWER(TRIM(wtd.nombre))
  JOIN work_src.subprocesos wsp ON wsp.id = wd.subproceso_id
  JOIN work_src.procesos wp ON wp.id = wsp.proceso_id
  JOIN work_src.macro_procesos wmp ON wmp.id = wp.macro_proceso_id
  JOIN macro_procesos mp_t ON LOWER(TRIM(mp_t.nombre)) = LOWER(TRIM(wmp.nombre))
  JOIN procesos p_t ON p_t.macro_proceso_id = mp_t.id AND LOWER(TRIM(p_t.nombre)) = LOWER(TRIM(wp.nombre))
  JOIN subprocesos sp_t ON sp_t.proceso_id = p_t.id AND LOWER(TRIM(sp_t.nombre)) = LOWER(TRIM(wsp.nombre))
  LEFT JOIN tmp_user_map creator ON creator.work_user_id = wd.creado_por
  LEFT JOIN tmp_user_map updater ON updater.work_user_id = wd.actualizado_por
  LEFT JOIN tmp_user_map deleter ON deleter.work_user_id = wd.eliminado_por
  WHERE TRIM(COALESCE(wd.codigo, '')) <> ''
)
UPDATE documentos d
SET
  subproceso_id = m.subproceso_id_mapped,
  tipo_documentacion_id = m.tipo_documentacion_id_mapped,
  titulo = m.titulo,
  version = m.version,
  fecha_creacion = m.fecha_creacion,
  revisa = m.revisa,
  aprueba = m.aprueba,
  fecha_aprobacion = m.fecha_aprobacion,
  autor = m.autor,
  estado = m.estado,
  link_acceso = m.link_acceso,
  creado_por = COALESCE(m.creado_por_mapped, d.creado_por),
  actualizado_por = COALESCE(m.actualizado_por_mapped, d.actualizado_por),
  eliminado = COALESCE(m.eliminado, d.eliminado),
  eliminado_por = COALESCE(m.eliminado_por_mapped, d.eliminado_por),
  eliminado_en = COALESCE(m.eliminado_en, d.eliminado_en),
  updated_at = GREATEST(COALESCE(d.updated_at, m.updated_at), COALESCE(m.updated_at, d.updated_at))
FROM mapped_work_docs m
WHERE UPPER(TRIM(d.codigo)) = UPPER(TRIM(m.codigo))
  AND COALESCE(m.updated_at, NOW()) > COALESCE(d.updated_at, TIMESTAMP '1900-01-01');

-- -------------------------------------------------------------------------
-- 4) Permisos y favoritos
-- -------------------------------------------------------------------------
INSERT INTO user_module_permissions (user_id, module_key, can_view, can_manage, created_at, updated_at)
SELECT
  u.id,
  wump.module_key,
  COALESCE(wump.can_view, true),
  COALESCE(wump.can_manage, false),
  wump.created_at,
  wump.updated_at
FROM work_src.user_module_permissions wump
JOIN work_src.users wu ON wu.id = wump.user_id
JOIN users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(wu.email))
WHERE NOT EXISTS (
  SELECT 1
  FROM user_module_permissions ump
  WHERE ump.user_id = u.id
    AND ump.module_key = wump.module_key
);

UPDATE user_module_permissions ump
SET
  can_view = COALESCE(ump.can_view, false) OR COALESCE(wump.can_view, false),
  can_manage = COALESCE(ump.can_manage, false) OR COALESCE(wump.can_manage, false),
  updated_at = GREATEST(COALESCE(ump.updated_at, wump.updated_at), COALESCE(wump.updated_at, ump.updated_at))
FROM work_src.user_module_permissions wump
JOIN work_src.users wu ON wu.id = wump.user_id
JOIN users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(wu.email))
WHERE ump.user_id = u.id
  AND ump.module_key = wump.module_key;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'work_src'
      AND table_name = 'documento_favoritos'
  ) THEN
    INSERT INTO documento_favoritos (user_id, documento_id, created_at, updated_at)
    SELECT DISTINCT
      u.id,
      d.id,
      wdf.created_at,
      wdf.updated_at
    FROM work_src.documento_favoritos wdf
    JOIN work_src.users wu ON wu.id = wdf.user_id
    JOIN users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(wu.email))
    JOIN work_src.documentos wd ON wd.id = wdf.documento_id
    JOIN documentos d ON UPPER(TRIM(d.codigo)) = UPPER(TRIM(wd.codigo))
    WHERE NOT EXISTS (
      SELECT 1
      FROM documento_favoritos df
      WHERE df.user_id = u.id
        AND df.documento_id = d.id
    );
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- 5) Datos masivos: agregar filas que no existan EXACTAMENTE
--    (no elimina ni sobrescribe; evita perdida de datos)
-- -------------------------------------------------------------------------
INSERT INTO estadisticas (
  categoria, subcategoria, anio, programa, dependencia, indicador, valor, unidad,
  fuente, observaciones, creado_por, actualizado_por, created_at, updated_at
)
SELECT
  w.categoria, w.subcategoria, w.anio, w.programa, w.dependencia, w.indicador, w.valor, w.unidad,
  w.fuente, w.observaciones, c.target_user_id, u.target_user_id, w.created_at, w.updated_at
FROM work_src.estadisticas w
LEFT JOIN tmp_user_map c ON c.work_user_id = w.creado_por
LEFT JOIN tmp_user_map u ON u.work_user_id = w.actualizado_por
EXCEPT
SELECT
  t.categoria, t.subcategoria, t.anio, t.programa, t.dependencia, t.indicador, t.valor, t.unidad,
  t.fuente, t.observaciones, t.creado_por, t.actualizado_por, t.created_at, t.updated_at
FROM estadisticas t;

INSERT INTO gestion_informacion_cargas (
  categoria, subcategoria, variable, archivo_nombre, total_plantilla, total_cargados,
  total_omitidos, porcentaje_cargado, estado, detalle, creado_por, created_at, updated_at
)
SELECT
  w.categoria, w.subcategoria, w.variable, w.archivo_nombre, w.total_plantilla, w.total_cargados,
  w.total_omitidos, w.porcentaje_cargado, w.estado, w.detalle, c.target_user_id, w.created_at, w.updated_at
FROM work_src.gestion_informacion_cargas w
LEFT JOIN tmp_user_map c ON c.work_user_id = w.creado_por
EXCEPT
SELECT
  t.categoria, t.subcategoria, t.variable, t.archivo_nombre, t.total_plantilla, t.total_cargados,
  t.total_omitidos, t.porcentaje_cargado, t.estado, t.detalle, t.creado_por, t.created_at, t.updated_at
FROM gestion_informacion_cargas t;

-- Fusion automatica del resto de tablas (sin perder datos)
-- Regla: inserta filas no existentes exactas comparando todas las columnas excepto "id".
DO $$
DECLARE
  r RECORD;
  cols TEXT;
BEGIN
  FOR r IN
    SELECT t.table_name
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND EXISTS (
        SELECT 1
        FROM information_schema.tables w
        WHERE w.table_schema = 'work_src'
          AND w.table_name = t.table_name
      )
      AND t.table_name NOT IN (
        'macro_procesos',
        'tipos_documentacion',
        'procesos',
        'subprocesos',
        'users',
        'documentos',
        'user_module_permissions',
        'documento_favoritos',
        'estadisticas',
        'gestion_informacion_cargas'
      )
  LOOP
    SELECT string_agg(format('%I', c.column_name), ', ' ORDER BY c.ordinal_position)
    INTO cols
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = r.table_name
      AND c.column_name <> 'id';

    IF cols IS NULL OR cols = '' THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'INSERT INTO %I (%s) SELECT %s FROM work_src.%I EXCEPT SELECT %s FROM %I',
      r.table_name,
      cols,
      cols,
      r.table_name,
      cols,
      r.table_name
    );
  END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- 6) Secuencias
-- -------------------------------------------------------------------------
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1), true);
SELECT setval('macro_procesos_id_seq', COALESCE((SELECT MAX(id) FROM macro_procesos), 1), true);
SELECT setval('procesos_id_seq', COALESCE((SELECT MAX(id) FROM procesos), 1), true);
SELECT setval('subprocesos_id_seq', COALESCE((SELECT MAX(id) FROM subprocesos), 1), true);
SELECT setval('tipos_documentacion_id_seq', COALESCE((SELECT MAX(id) FROM tipos_documentacion), 1), true);
SELECT setval('documentos_id_seq', COALESCE((SELECT MAX(id) FROM documentos), 1), true);
SELECT setval('user_module_permissions_id_seq', COALESCE((SELECT MAX(id) FROM user_module_permissions), 1), true);
SELECT setval('documento_favoritos_id_seq', COALESCE((SELECT MAX(id) FROM documento_favoritos), 1), true);

COMMIT;

-- Validacion rapida post-merge
SELECT 'users' AS tabla, COUNT(*) AS total FROM users
UNION ALL SELECT 'documentos', COUNT(*) FROM documentos
UNION ALL SELECT 'macro_procesos', COUNT(*) FROM macro_procesos
UNION ALL SELECT 'procesos', COUNT(*) FROM procesos
UNION ALL SELECT 'subprocesos', COUNT(*) FROM subprocesos
UNION ALL SELECT 'tipos_documentacion', COUNT(*) FROM tipos_documentacion
UNION ALL SELECT 'user_module_permissions', COUNT(*) FROM user_module_permissions
UNION ALL SELECT 'documento_favoritos', COUNT(*) FROM documento_favoritos
UNION ALL SELECT 'estadisticas', COUNT(*) FROM estadisticas
UNION ALL SELECT 'gestion_informacion_cargas', COUNT(*) FROM gestion_informacion_cargas;
