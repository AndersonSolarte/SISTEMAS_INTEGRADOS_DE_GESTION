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

## Formulario vigente compartido con Plan de Acción

El formulario oficial y la vinculación de Mejoramiento consultan
`liveActionPlanSchemaService.readLiveActionPlanSchema`. Ambos parten de los
campos, listas, elementos y niveles vigentes del PED de la vigencia destino.
Los campos desactivados no reaparecen desde capturas históricas. La captura
guardada no reemplaza la configuración actual ni se usa como alternativa
silenciosa ante un fallo de consulta.

La vinculación conserva el orden y obligatoriedad del esquema, comparte los
componentes de indicadores y políticas, y admite catálogos simples y múltiples.
No genera un formulario fijo cuando falta el esquema. Consulta los cambios cada
15 segundos y al volver a la ventana, sin borrar los datos en edición. Al enviar,
el servidor obtiene de nuevo la estructura vigente y valida sus obligatorios.
Las relaciones de objetivos y lineamientos del diálogo se calculan a partir
del mismo esquema del Plan de Acción de destino.

Al vincular una actividad, su fecha de inicio en el Plan de Acción corresponde
al inicio más temprano de sus indicadores activos; la fecha fin corresponde
al fin más tardío. Los indicadores retirados no afectan este rango. El servidor
recalcula las fechas usando la actividad almacenada y conserva las fechas de
cada indicador en los datos de la actividad vinculada. No requiere migración:
se utilizan las columnas de fechas y los campos JSON existentes.

El editor oficial y la vinculación comparten `actionPlanFormFields` para obtener
los campos de captura, su orden y obligatoriedad. La vinculación no oculta el
tipo de indicador configurado. Precarga las equivalencias de actividad/nombre,
descripción y referencias institucionales usando las claves del esquema destino;
el indicador y la meta simples provienen del indicador activo, conservando
además el bloque completo de indicadores. Los campos adicionales configurados
permanecen disponibles para diligenciarse en la vinculación.

### Seguimiento por indicador

Cada actividad muestra únicamente sus indicadores activos. Cada indicador
conserva porcentaje, fecha de corte, observaciones y una lista de evidencias
propia en `contenido.objetivos[].actividades[].seguimientoIndicadores`.
El cumplimiento de la actividad es el promedio de todos sus indicadores
activos; un indicador sin evidencia aporta cero. Las actividades tienen el
mismo peso dentro del objetivo. Las fechas indican por iniciar, en plazo,
vencido o cumplido fuera de plazo, sin producir cumplimiento automático.

El servidor valida porcentajes y fechas de corte y conserva la asociación
de cada archivo con Resultado, Logro o Impacto. Los datos históricos generales
se conservan; no se atribuyen retrospectivamente a un indicador específico.
La sincronización usa `monitoring_indicators` del Plan de Acción y etiqueta
las evidencias por indicador. Excel incluye `SEGUIMIENTO_INDICADORES` para
exportar y recuperar estos datos. No se agregan tablas: se utiliza el JSONB
existente y las columnas de evidencias del Plan de Acción.

En formulación, la información del objetivo permanece siempre visible y cada
actividad dispone de su propio acordeón, identificado por número y nombre.
Las actividades nuevas se abren automáticamente. Cerrar un acordeón no elimina
los valores del formulario ni modifica los datos almacenados.

El ojo abre automáticamente la evidencia seleccionada. Para Word `.docx`, la
consulta autenticada con `preview=1` convierte el contenido a HTML y lo muestra
en un visor aislado, sin scripts ni recursos externos. La descarga solicita
siempre el archivo original. PDF e imágenes conservan su visor existente.

Las evidencias se identifican como `[Evidencia de resultado] archivo.ext`,
`[Evidencia de logro] archivo.ext` o `[Evidencia de impacto] archivo.ext`.
Dentro de `ACTIVIDAD/EVIDENCIAS` se crean las carpetas de indicadores activos
`01 - Evidencias de resultado`, `02 - Evidencias de logro` y
`03 - Evidencias de impacto`. Se reutilizan mediante claves estables de Drive.
Los archivos existentes que tengan una asociación explícita a un indicador
se trasladan desde la carpeta general sin cambiar su ID; los no clasificados
se conservan. El visor consulta las subcarpetas y comprueba que pertenecen a
la actividad antes de servir sus archivos. Copiar URL usa la subcarpeta del
indicador. La copia vinculada en Plan de Acción recibe el mismo tipo de indicador.

### Desvincular, ajustar y volver a vincular

La desvinculación conserva indicadores, programación y evidencias en
Mejoramiento. Marca el registro del Plan de Acción como retirado y actualiza
ambos registros en una transacción. La recuperación automática no restaura
vínculos retirados deliberadamente. Al volver a vincular al mismo destino,
se reutilizan el ID y código del registro retirado explícitamente, manteniendo
sus relaciones y evidencias; las bajas administrativas no se restauran.
La ventana usa el formulario vigente y mantiene los controles de acceso y
vigencia. El frontend interpreta los IDs de la respuesta anidada del servidor
para mostrar correctamente la acción Desvincular.
