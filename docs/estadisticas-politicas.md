# Base para reportes de cumplimiento por políticas

Cada guardado de una actividad de Plan de Acción conserva `custom_values.policy_statistics`.
En Plan de Mejoramiento se conserva `policyStatistics` dentro de cada actividad.
Ambas estructuras utilizan la misma resolución del catálogo central, versión 1:

- ID de política institucional, nombre seleccionado y nombre vigente del catálogo.
- Clave normalizada de política y de cada línea, sin diferencias de acentos, mayúsculas o espacios.
- Estado de correspondencia con el catálogo y líneas pendientes de clasificación.
- Las selecciones manuales o retiradas del catálogo permanecen identificadas; no se descartan.

La identidad de política se mantiene por ID cuando cambia su nombre. Las líneas actuales
del catálogo son textos sin ID: un cambio de redacción de una línea requiere conciliación
en el futuro reporte y nunca debe fusionarse silenciosamente con otra línea.

## Reglas de los futuros reportes

Los porcentajes deben consultarse en los seguimientos oficiales, no en una copia dentro
de los metadatos de política. Utilizar cumplimiento de actividad con las reglas actuales
de S1/S2 en Plan de Acción y el corte correspondiente en Mejoramiento. No sumar porcentajes
de actividades diferentes. El promedio simple se identificará como tal; una ponderación
solo se aplicará si existe un peso definido explícitamente.

Exponer por política y línea: actividades asociadas, actividades con seguimiento,
pendientes sin seguimiento, completadas, cumplimiento, fecha de corte y denominador.
No confundir ausencia de seguimiento con cumplimiento cero confirmado.
Separar módulo, PED, vigencia, plan, programa/dependencia y responsable.
Una actividad con varias políticas cuenta una vez en cada grupo, pero los grupos
no se suman para producir un total institucional.

Para reportes conjuntos, deduplicar las actividades vinculadas usando
`linkedActionItemId` de Mejoramiento y el ID de actividad de Acción; mantener vistas
separadas por módulo. La sincronización de Mejoramiento propaga sus dimensiones
de política al Plan de Acción vinculado.

## Alcance de esta preparación

No se crean aún tableros ni endpoints de reportes. Los nuevos metadatos se completan
al crear/guardar actividades; no se ha ejecutado una migración masiva de registros
anteriores. El futuro reporte deberá resolver los registros antiguos desde sus
selecciones originales o realizar una migración controlada antes de contabilizarlos.
