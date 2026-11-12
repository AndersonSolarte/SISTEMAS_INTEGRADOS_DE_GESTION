# Asignacion de responsables de planes existentes

El editor del Plan de Accion guardaba solo `responsible_user_id`, sin sincronizar `responsibility_id` ni los registros anuales y especificos de liderazgo. Una conciliacion posterior podia restaurar una asignacion anterior. Ademas, cambiar el codigo de un plan legacy por otro ya utilizado provocaba un error de unicidad sin una explicacion util.

La actualizacion ahora:

1. Valida el codigo, el titulo y el usuario activo.
2. Conserva el codigo cuando no se solicita cambiarlo. El formulario envia un codigo solo si el usuario lo modifica.
3. Devuelve HTTP 409 si otro plan, incluso archivado, utiliza el codigo solicitado. No modifica al responsable ni ningun dato cuando falla.
4. Actualiza en una sola transaccion el responsable, su asignacion del plan y la referencia anual de esa dependencia y vigencia.
5. Conserva como transferidas las asignaciones anteriores y reutiliza las actuales si se repite el guardado.
6. Conserva el esquema de captura del plan y registra la auditoria en la misma transaccion.

No se modifican actividades, firmas ni actas existentes. No requiere migraciones.

Prueba local con registros temporales aislados y limpieza posterior:

```powershell
$env:RUN_PLAN_METADATA_DB_TESTS='1'
node --test --experimental-test-isolation=none backend/src/services/actionPlanMetadataService.test.js
```

La prueba incluye colision de codigo, responsable vacio o inexistente, idempotencia, cambio de lider con historico, proteccion de esquema, conciliacion posterior y rollback ante un fallo de auditoria.
