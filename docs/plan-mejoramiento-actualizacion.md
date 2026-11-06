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

## Cierre de sincronización con Plan de Acción

La vinculación desde Mejoramiento y los envíos automáticos de seguimiento y
evidencias comprueban el cronograma efectivo del destino en el servidor.
Se reutiliza la resolución de plazos del Plan de Acción: prevalece el mayor
plazo entre la fecha general y la última prórroga individual formal.
Una vigencia o plan cerrado, inactivo o archivado bloquea los envíos aunque
su fecha de cierre todavía sea futura. Tampoco se admiten envíos antes del
inicio ni después del vencimiento. Esta validación no tiene excepción por rol.
Mejoramiento conserva su propio guardado; no modifica el destino bloqueado.

## Retiro de fechas generales de actividad

Mejoramiento ya no recopila ni persiste `fechaInicio` y `fechaFin` en las
actividades. Las solicitudes antiguas también se limpian antes de guardar.
`npm run migrate` retira ambas claves de los JSONB existentes, en una transacción
idempotente, conservando los demás datos. No elimina las fechas de entrega de
los indicadores ni los plazos propios del Plan de Acción.

La exportación deja vacías y ocultas las columnas históricas M/N de la matriz PM
para conservar sus coordenadas y fórmulas. La importación ignora esas columnas.
Las fechas de entrega se recopilan en la hoja INDICADORES. Al vincular se solicitan
las fechas que el formulario del Plan de Acción tenga configuradas como obligatorias;
esas fechas pertenecen al destino y no se copian a la actividad de Mejoramiento.

## Inicio y fin obligatorios por indicador

Cada indicador activo requiere texto, meta alfanumérica, `fechaInicioResultado`
y `fechaFinResultado` (o sus equivalentes Logro/Impacto). La fecha fin no puede
ser anterior al inicio. El cliente bloquea guardados automáticos incompletos
y muestra errores en los campos; el servidor responde 422 si se intenta guardar,
importar o vincular un indicador activo incompleto. Los indicadores inactivos
conservan su información y no están sujetos a estos requisitos.

La anterior fecha de entrega se interpreta como fecha fin sin inventar una
fecha de inicio. Los registros anteriores deberán completar el inicio para
volver a guardarse. La hoja INDICADORES incorpora las tres fechas de inicio;
las antiguas columnas de entrega pasan a ser FIN. Se conservan los índices
de los estados activos y se admiten archivos anteriores con ENTREGA.
Los campos siguen almacenándose en el JSONB de cada actividad, sin columnas SQL
adicionales y sin recuperar las fechas generales retiradas de la actividad.

## Fuente de objetivos y lineamientos en Mejoramiento

Para actividades vinculadas se respeta la jerarquía capturada en
`Plan de Acción.metadata.form_schema`, cuando contiene una estructura utilizable;
en su defecto se consulta su PED. Para actividades sin vínculo se utiliza el PED
institucional configurado. Se admiten los elementos importados y las opciones
definidas directamente en los campos del Plan de Acción.

La pertenencia de lineamientos se obtiene de `parent_id`. Cuando el objetivo fue
versionado, una referencia a su versión anterior se resuelve por el mismo código
dentro del mismo PED. Solo el PED histórico 2022–2029 admite la agrupación heredada
de la plantilla cuando no tiene padre configurado: OE1 (LE-001 a LE-004), OE2
(LE-005 a LE-010) y OE3 (LE-011 a LE-013). En otros PED no se inventan relaciones.
La migración publicada completa exclusivamente esos padres históricos faltantes;
no sobrescribe vínculos existentes ni cruza elementos entre PED.
