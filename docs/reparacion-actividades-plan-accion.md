# Reparación de actividades históricas del Plan de Acción

El despliegue y los comandos en producción los ejecuta exclusivamente el usuario.

## Causa y corrección

La importación del Excel reemplaza `plan_accion` y genera nuevos IDs numéricos. El puente al PED usaba `LEGACY-ID` como única identidad y agregaba otra copia en cada importación. También usaba valores iniciales que no completaban campos faltantes después de crear la actividad.

La reconciliación ahora reconoce actividades por actividad e indicador dentro del mismo plan, verifica metas y fechas cuando están presentes y conserva datos ya diligenciados. Completa objetivos, lineamientos y macroactividad, incluidos los nombres de campos generados desde el Excel. No inventa información de políticas institucionales o seguimiento de políticas que el origen histórico no contiene.

Las copias se archivan con `deleted_at` y `custom_values.legacy_duplicate_of`; la actividad conservada registra `legacy_merged_item_ids`. Las actividades manuales permanecen. Se trasladan evidencias, movimientos presupuestales y resultados de periodos sin conflicto. Si hay resultados del mismo periodo, se prioriza el resultado diligenciado sobre el importado; los demás resultados e historiales de versiones permanecen en la fila archivada para revisión. Los bloqueos transaccionales evitan duplicados entre procesos concurrentes.

## Despliegue y reparación manual

La migración del despliegue ahora ejecuta `repairLegacyActionPlanScope`: corrige actividades cruzadas, concilia exclusivamente 2022–2026 y unifica planes históricos de la misma dependencia y vigencia. Sustituye la limpieza anterior, que agrupaba también actividades manuales y elegía responsables mediante un `UPDATE FROM` ambiguo. Los errores de la reparación hacen fallar la migración para evitar informar un despliegue exitoso con la conciliación pendiente.

Después del despliegue habitual ejecutado por el usuario y con un respaldo vigente de la base:

```bash
# Auditoría de todas las actividades históricas: solo lectura.
docker compose exec -T backend npm run audit:legacy-action-plans
```

El resultado esperado es `misplaced: []`, `differences: []` y `futureImported: 0`. Las actividades manuales se cuentan aparte. Si un usuario cambió o retiró expresamente un dato importado, la auditoría puede mostrar la diferencia para revisión; no debe borrarse trabajo de la interfaz para forzar el contador.

La reparación también puede repetirse manualmente sin reimportar el Excel:

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

El comando reconoce tanto `2026-R74` como `LEGACY-2026-R74`. Si el código no tiene origen histórico, termina sin aplicar cambios. El reporte cuenta posibles copias y sirve de diagnóstico; la reparación verifica compatibilidad y multiplicidad de las filas originales antes de archivarlas. `--plan` limita la conciliación al responsable indicado; la reparación completa de planes se ejecuta con `--apply` sin `--plan`.

Para reconciliar todos los planes históricos, ejecutar expresamente:

```bash
docker compose exec -T backend npm run repair:legacy-action-plans -- --apply
```

Cada plan se procesa en su propia transacción. Si se interrumpe la ejecución, puede repetirse. No es necesario reimportar el Excel ni borrar actividades para esta reparación.

## Validación local

El R74 local tenía 11 actividades: diez importadas (dos copias de cinco actividades) y una manual, “Crear Caracterizaciones”. Después de la reparación quedan cinco importadas y una manual; cinco copias quedan archivadas. Las cinco importadas conservan objetivos y lineamientos. Repetir la reconciliación no crea nuevas actividades.

La prueba de regresión simula quince filas (tres copias de cinco), nuevas importaciones con IDs diferentes y llamadas simultáneas. Comprueba que sobrevivan cinco importadas y una manual, con fechas, datos estratégicos, evidencias, resultados y vínculos presupuestales conservados.

## Regla de origen y anualidad

La base de Gestión de la Información solo alimenta 2022–2026. La importación rechaza años fuera del rango, responsables sin código oficial Rxx y actividades sin texto o indicador, antes de reemplazar datos. Desde 2027 los planes se generan sin actividades de esta base; sus registros se crean en el aplicativo. El banco de actividades puede ayudar a formular una actividad nueva, pero no debe copiar la identidad histórica ni los avances y observaciones de otro año.

Los códigos R2 y R02 representan la misma dependencia; R2 y R21 representan dependencias diferentes. Se prioriza el código oficial sobre el nombre. Una dependencia retirada conserva su identidad histórica sin reactivarse para nuevas vigencias. No se asignan líderes por fragmentos de nombres ni por usuarios de otras vigencias: se usan únicamente responsabilidades activas del mismo año, dependencia y tipo, con prioridad del líder explícito del plan.

## Contraste con el archivo proporcionado

Archivo revisado: `plantilla_plan_de_accion (3).xlsx`, hoja `PLAN DE ACCION`.

| Vigencia | Filas |
| --- | ---: |
| 2023 | 417 |
| 2024 | 545 |
| 2025 | 474 |
| 2026 | 380 |
| Total | 1816 |

No hay filas de 2022 en este archivo. R74 en 2026 contiene cinco actividades. Se verificó localmente la multiplicidad por año, responsable, actividad, indicador y meta: 1816 filas del Excel, 1816 filas históricas de base y 1816 actividades importadas activas, sin diferencias y sin cruces de dependencia. Las cinco actividades nativas activas se conservaron aparte. Se unificaron tres planes históricos duplicados y se archivaron dos actividades históricas vacías fuera del rango (2027 y 2029). Una segunda reparación no agregó registros ni volvió a fusionar planes.

Para repetir el contraste del Excel en local (el archivo permanece fuera del repositorio):

```powershell
cd backend
npm run audit:legacy-action-plans -- "E:\Documentos Usuario\Downloads\plantilla_plan_de_accion (3).xlsx"
```

La auditoría devuelve código 2 si encuentra diferencias de identidad, asignación o importaciones fuera del rango. Compara identidad y multiplicidad; no certifica por sí sola las firmas, los archivos remotos de Drive ni todos los campos de avance del Excel.
