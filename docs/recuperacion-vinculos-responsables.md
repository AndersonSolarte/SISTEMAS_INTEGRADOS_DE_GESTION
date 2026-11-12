# Responsables guardados en planes oficiales y tarjetas legacy sin lider

El reporte del servidor muestra 64 planes activos de 2026: 56 con responsable y 8 sin responsable. Seis vacios coexisten con un oficial del mismo codigo anual: R05, R28, R32, R51, R75 y R93. R02 y R03 requieren revisar los candidatos de planes archivados.

La dependencia del plan oficial puede utilizar un codigo generico DEP mientras el duplicado usa LEG-Rxx. La resolucion anterior priorizaba el catalogo LEG sobre la evidencia del plan oficial, impidiendo su unificacion.

La correccion utiliza el plan oficial de la misma vigencia, PED y codigo Rxx como evidencia prioritaria, siempre que el catalogo no contradiga ese codigo. La reparacion existente unifica sus registros relacionados, conserva el responsable oficial y reconstruye su responsabilidad especifica si la interfaz antigua no la habia creado. No deduce un nuevo responsable a partir de nombres parecidos.

Vista previa de lectura, disponible despues de publicar estos cambios:

```bash
docker compose exec -T backend node src/scripts/previewActionPlanLeaderRecovery.js
```

Las propuestas con responsables distintos o sin un oficial unico necesitan revision. El script nunca aplica cambios. La ejecucion de migraciones y el despliegue pertenecen exclusivamente al usuario. No se ha publicado esta correccion en main.
