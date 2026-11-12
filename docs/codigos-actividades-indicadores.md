# Códigos oficiales de actividades e indicadores

Una actividad se identifica como `AÑO-DEPENDENCIA-CONSECUTIVO`, por ejemplo `2026-R76-001`. El consecutivo corresponde a la actividad, no a cada indicador. En otro año o plan la numeración empieza en `001`. Los códigos ya asignados no cambian al editar y no se reutilizan números de actividades retiradas.

| Elemento | Ejemplo |
| --- | --- |
| Actividad | `2026-R76-001` |
| Indicador de resultado | `R-2026-R76-001 Descripción del resultado` |
| Indicador de logro | `L-2026-R76-001 Descripción del logro` |
| Indicador de impacto | `I-2026-R76-001 Descripción del impacto` |

El texto descriptivo y la meta se conservan. Los prefijos anteriores se sustituyen, sin acumular códigos. En los indicadores históricos principales se respeta Logro o Impacto cuando el tipo lo indica; los demás tipos históricos usan el prefijo Resultado. No se infiere una clasificación nueva por el significado del texto.

## Actualización y trazabilidad

La migración del despliegue ejecuta la reparación histórica y después `backfillOfficialActivityCodes`. Actualiza las actividades activas que tienen una dependencia Rxx identificable, conservando sus UUID, evidencias, seguimientos, observaciones y vínculos. Guarda los códigos anteriores en `custom_values.previous_activity_codes` y registra los códigos de indicadores en `custom_values.indicator_codes`.

La numeración se aplica a formularios, importaciones, réplicas y vínculos de Plan de Mejoramiento desde el modelo común. Cada alta bloquea la fila de su plan dentro de una transacción, para evitar que dos solicitudes reciban el mismo número. Las descripciones que se editen posteriormente recuperan el prefijo correspondiente al guardar.

Si una dependencia no tiene código Rxx identificable, la migración la informa en `pending`; conserva sus registros y no inventa un código oficial. Debe configurarse ese código antes de crear nuevas actividades en ese plan.

La conciliación reconoce el origen histórico por sus metadatos, aunque el código visible ya no sea `LEGACY-ID`. La auditoría compara contenido y multiplicidad sin considerar los prefijos como actividades nuevas.

## Comprobación local

Se verificaron la conversión de R76 a `2026-R76-001`, `002` y `003`, la repetición de la migración sin cambios y la conservación de 1816 actividades importadas, sin diferencias ni cruces frente al Excel de origen.

También se simuló una reimportación con IDs de origen distintos: no creó actividades ni cambió sus UUID o códigos. La prueba del modelo real comprueba ediciones, conservación de seguimientos y dos altas simultáneas; sus datos temporales se revierten o eliminan al finalizar.

Prueba optativa, exclusivamente en la base local:

```powershell
cd backend
$env:SIAC_TEST_LOCAL_DB='1'
node src/services/actionItemCodingLocal.test.js
Remove-Item Env:SIAC_TEST_LOCAL_DB
```

El despliegue en producción lo ejecuta exclusivamente el usuario mediante su procedimiento habitual. Después puede ejecutar `docker compose exec -T backend npm run audit:legacy-action-plans` para verificar el origen histórico.
