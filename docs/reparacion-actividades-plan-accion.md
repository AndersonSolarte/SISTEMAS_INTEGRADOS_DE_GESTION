# Reparación de actividades históricas del Plan de Acción

El despliegue y los comandos en producción los ejecuta exclusivamente el usuario.

## Causa y corrección

La importación del Excel reemplaza `plan_accion` y genera nuevos IDs numéricos. El puente al PED usaba `LEGACY-ID` como única identidad y agregaba otra copia en cada importación. También usaba valores iniciales que no completaban campos faltantes después de crear la actividad.

La reconciliación ahora reconoce actividades por actividad e indicador dentro del mismo plan, verifica metas y fechas cuando están presentes y conserva datos ya diligenciados. Completa objetivos, lineamientos y macroactividad, incluidos los nombres de campos generados desde el Excel. No inventa información de políticas institucionales o seguimiento de políticas que el origen histórico no contiene.

Las copias se archivan con `deleted_at` y `custom_values.legacy_duplicate_of`; la actividad conservada registra `legacy_merged_item_ids`. Las actividades manuales permanecen. Se trasladan evidencias, movimientos presupuestales y resultados de periodos sin conflicto. Si hay resultados del mismo periodo, se prioriza el resultado diligenciado sobre el importado; los demás resultados e historiales de versiones permanecen en la fila archivada para revisión. Los bloqueos transaccionales evitan duplicados entre procesos concurrentes.

## Despliegue y reparación manual

Actualizar el código evita nuevas copias, pero **no basta para corregir las ya existentes**. Después del despliegue habitual y con un respaldo vigente de la base:

```bash
# Diagnóstico de todos los planes históricos. Solo lectura.
docker compose exec -T backend npm run repair:legacy-action-plans

# Diagnóstico del plan de la captura de producción.
docker compose exec -T backend npm run repair:legacy-action-plans -- --plan=2026-R74

# Aplicar la reparación exclusivamente a ese plan.
docker compose exec -T backend npm run repair:legacy-action-plans -- --plan=2026-R74 --apply

# Repetir el diagnóstico: no deben quedar copias adicionales.
docker compose exec -T backend npm run repair:legacy-action-plans -- --plan=2026-R74
```

Usar el código exacto que muestre el diagnóstico; algunas instalaciones usan `LEGACY-2026-R74`. Si el código no tiene origen histórico, el comando específico termina sin aplicar cambios. El reporte cuenta posibles copias y sirve de diagnóstico; la reparación verifica compatibilidad entre cada copia antes de archivarla.

Para reconciliar todos los planes históricos, ejecutar expresamente:

```bash
docker compose exec -T backend npm run repair:legacy-action-plans -- --apply
```

Cada plan se procesa en su propia transacción. Si se interrumpe la ejecución, puede repetirse. No es necesario reimportar el Excel ni borrar actividades para esta reparación.

## Validación local

El R74 local tenía 11 actividades: diez importadas (dos copias de cinco actividades) y una manual, “Crear Caracterizaciones”. Después de la reparación quedan cinco importadas y una manual; cinco copias quedan archivadas. Las cinco importadas conservan objetivos y lineamientos. Repetir la reconciliación no crea nuevas actividades.

La prueba de regresión simula quince filas (tres copias de cinco), nuevas importaciones con IDs diferentes y llamadas simultáneas. Comprueba que sobrevivan cinco importadas y una manual, con fechas, datos estratégicos, evidencias, resultados y vínculos presupuestales conservados.
