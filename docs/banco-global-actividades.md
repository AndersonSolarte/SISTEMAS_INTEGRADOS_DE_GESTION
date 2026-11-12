# Banco global de actividades

Al escribir una palabra clave en Actividad se consultan todas las dependencias y vigencias, tanto del aplicativo como del histórico no eliminado en plan_accion. Con el campo vacío se sugieren actividades de la dependencia actual.

Se comparan todas las palabras, permitiendo coincidencias parciales y diferencias de mayúsculas y tildes, sin requerir la extensión unaccent. Las consultas filtran en PostgreSQL; se devuelven hasta 35 sugerencias, priorizando el plan, la dependencia y los años recientes. Se mantienen variantes con diferentes indicadores o metas.

Escoger una opción llena contenido editable. Crear actividad genera un registro en el plan y vigencia de destino, con código incremental propio. No traslada el registro original ni copia responsables, fechas antiguas, avances, evidencias o valoraciones. No se realizan cargues automáticos del histórico a vigencias futuras.

El editor descarta respuestas de búsquedas anteriores y avisa si falla la consulta.

Validación local: ejecutar RUN_ACTIVITY_BANK_DB_TESTS=1 con backend/src/services/activitySuggestionService.test.js usando node --test --experimental-test-isolation=none. La prueba exige PostgreSQL local y limpia sus registros temporales. En frontend ejecutar las pruebas src/utils/activityTemplateValues.test.js y npm run build.

No requiere migraciones nuevas. La publicación y el despliegue siguen pendientes hasta la instrucción del usuario.
