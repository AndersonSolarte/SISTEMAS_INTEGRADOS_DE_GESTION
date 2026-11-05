# Actualización de Plan de Mejoramiento

El usuario realiza el despliegue habitual con `./deploy.sh`. Las migraciones crean
`institutional_policies` y cargan las 13 políticas y 75 líneas distintas de
`POliticas_BD.xlsx` si el catálogo está vacío. Si ya existen políticas en el servidor,
se conservan; se pueden incorporar desde Centro de Bases de Datos → Importar
información → Políticas institucionales.

El catálogo inicial reproducible está en
`backend/src/data/institutionalPolicies.json`. Las altas posteriores desde la interfaz
se guardan en PostgreSQL; el JSON no sustituye los cambios del usuario.
La administración del catálogo se realiza en el Centro de Bases de Datos, con sus
permisos de importación y exportación. Mejoramiento consulta el mismo catálogo y
solo permite seleccionar políticas y líneas existentes.

La API compartida `GET /api/politicas-institucionales` permite consultar el catálogo
desde cualquier módulo autenticado de SIAC. El cliente reutilizable está en
`frontend/src/services/institutionalPolicyService.js`. La plantilla vacía, la carga
de Excel/CSV y la exportación Excel/CSV/JSON usan esta misma fuente.

Los tres indicadores de cada actividad se guardan en el contenido JSON existente
del plan. No requieren columnas adicionales. La hoja `INDICADORES` conserva los tres
textos al exportar e importar Excel y admite el formato anterior.

La integración de Drive reutiliza la conexión de Plan de Acción si no hay una
configuración propia de Mejoramiento. Las credenciales no se incluyen en Git.

La reparación de vínculos duplicados es independiente de las migraciones:
`node src/scripts/consolidateImprovementLinks.js` solo informa qué consolidaría.
La opción `--apply` crea un respaldo local y aplica los cambios en una transacción.
No se ejecuta automáticamente durante el despliegue.

## Actualización del catálogo compartido y campos dinámicos

El despliegue habitual con `./deploy.sh` reconstruye los servicios y ejecuta
`docker compose exec -T backend npm run migrate`. Esa migración ya incluye
la creación idempotente de `institutional_policies` y la carga inicial únicamente
si no contiene registros. No hace falta ejecutar un SQL adicional ni volver a
importar el archivo cuando el catálogo ya está completo.

La opción predefinida «Políticas institucionales» del constructor de campos está
disponible para cualquier PED. Al seleccionarla se agregan juntos Política y
Líneas de acción al PED elegido; la migración no modifica automáticamente la
configuración de los demás PED. Ambos campos consultan el catálogo central.

Las listas se refrescan al abrirlas, al volver a la ventana y cada 15 segundos.
Mejoramiento usa el PED del Plan de Acción vinculado; las actividades sin vínculo
utilizan el PED activo. Las selecciones y los metadatos estadísticos se guardan
en los JSON existentes: no requieren nuevas columnas ni tablas.
Véase `docs/estadisticas-politicas.md` para las reglas del reporte futuro.

## Indicadores opcionales, metas y fechas de entrega

Cada actividad conserva para Resultado, Logro e Impacto los campos
`indicadorResultado`, `metaResultado`, `fechaEntregaResultado` e
`indicadorResultadoActivo` (y los equivalentes Logro/Impacto). Las metas son texto,
las fechas usan `AAAA-MM-DD` y el estado activo es booleano. Se almacenan bajo
`planes_mejoramiento.contenido.objetivos[].actividades[]` en PostgreSQL JSONB.
La sincronización vinculada conserva los mismos campos en los valores personalizados
de la actividad del Plan de Acción. No se requiere alterar el esquema SQL.

La plantilla vacía y la exportación generan automáticamente la hoja `INDICADORES`
con 15 columnas: objetivo, posición de actividad, nombre, tres indicadores, tres
metas, tres fechas y tres estados activos. La importación recupera esos campos;
también admite los Excel anteriores sin estas columnas adicionales. Una fecha
ingresada como fecha de Excel o `DD/MM/AAAA` se convierte al formato ISO.
Quitar un indicador guarda su estado inactivo y conserva su información para
restaurarlo. Los indicadores inactivos no aparecen en el texto consolidado.
