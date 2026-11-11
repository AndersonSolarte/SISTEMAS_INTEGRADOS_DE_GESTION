# Revisión local de respaldos — 11 de noviembre de 2026

Esta revisión inicial fue ampliada con un simulacro real y comprobación del kit cifrado:
[VALIDACION_LOCAL_2026-11-11.md](VALIDACION_LOCAL_2026-11-11.md).

## Resultado comprobado

Se revisaron los scripts del repositorio y las copias ya descargadas en
`D:\SIAC_COPIAS_DE_SEGURIDAD`, sin conexiones al servidor.

- Del 4 al 10 de noviembre existen los dos paquetes diarios: integral y kit cifrado.
- Los 14 paquetes coinciden con sus respectivas huellas SHA-256.
- El integral del día 10, generado a las 18:00:28 de Colombia, mide 915.077.120 bytes.
- Su base mide 631.475.256 bytes y su archivo comprimido de adjuntos 283.592.266 bytes.
- Se extrajo ese integral en un directorio temporal local: ambas huellas internas coinciden.
- PostgreSQL 18 `pg_restore --list` pudo leer su catálogo, con 120 entradas TABLE DATA.
- `tar` pudo listar el archivo de adjuntos; el manifiesto registra 3.273 entradas, incluyendo directorios.
- Se eliminaron los archivos temporales extraídos al finalizar.

Estas comprobaciones acreditan disponibilidad e integridad de esos archivos; no sustituyen
una restauración real. No se descifró el kit ni se comparó el contenido con la base activa
de producción. La consulta del Programador de tareas de Windows devolvió acceso denegado;
no se certifica su estado mediante esta revisión.

## Cómo funciona y qué ocurre al crecer el sistema

1. El backend revisa cada 30 segundos si ya llegó la hora configurada, por defecto
   18:00 en America/Bogota. Si se inicia después de esa hora, intenta la copia de ese día.
   Debe estar encendido, habilitado y sin pausa.
2. Ejecuta `pg_dump` en formato custom contra DB_NAME, sin filtros de tablas ni esquemas.
   Las nuevas tablas, columnas, relaciones, secuencias y registros de esa base entran
   automáticamente en las siguientes copias. No hay que editar una lista de tablas.
   Se guarda el estado visible a la instantánea del dump; los cambios posteriores
   corresponden a la siguiente copia. No abarca otras bases de datos ni roles globales;
   se omiten propietarios y permisos por diseño.
3. Empaqueta además los archivos de `/app/uploads` (volumen backend_uploads en Docker).
   Nuevas subcarpetas allí entran automáticamente. Excluye temp, .restore-* y .backup-*.
   Valida catálogo, rutas y huellas antes de publicar el integral.
4. Un cron separado ejecuta el kit a las 18:20. Incluye un `git archive HEAD`, .env,
   docker-compose.yml, nginx.conf, deploy.sh, backend/keys y los certificados previstos.
   El código nuevo entra cuando está confirmado en el HEAD del servidor. Cambios sin
   commit y archivos nuevos sin seguimiento no entran en ese archivo de código.
5. La tarea Windows está diseñada para descargar a las 18:35 y recuperar ejecuciones
   pendientes cuando el equipo esté disponible. Usa sesión interactiva: depende de que
   el usuario haya iniciado sesión y exista conectividad. Organiza por fecha y verifica
   las huellas que encuentra.

El cron de las 18:00 llama también al script legado, pero normalmente este sale sin
hacer nada porque el backend administra la copia. Si se habilita el legado, produce
solo un dump de base, no el respaldo integral de archivos.

## Cobertura que no debe darse por supuesta

- Los documentos que solo existen en Google Drive u otro servicio externo no se
  descargan con este mecanismo. La base puede guardar enlaces, pero eso no copia
  el contenido enlazado. La conexión institucional a otra base tampoco se respalda.
- Archivos persistentes fuera de uploads y de la lista privada del kit necesitan
  una decisión explícita de inclusión. Nuevos volúmenes Docker no entran automáticamente.
- La base y los adjuntos se capturan sucesivamente, no en una instantánea común.
  Una carga o eliminación concurrente puede dejar diferencias entre ambos.
- `release: main` del manifiesto no identifica por sí solo una versión exacta desplegada.
- La clave externa del kit debe conservarse fuera del servidor; el sincronizador no
  la descarga. Sin ella, el kit cifrado no permite recuperar código ni configuración.

## Mejoras propuestas, por prioridad

1. Reintentar fallos transitorios de la copia integral con espera y límite de intentos.
   Actualmente cualquier intento programado del día, incluso fallido o interrumpido,
   impide otro intento automático ese mismo día.
2. Emitir un resultado diario conjunto que exija integral + kit + huellas válidas y
   fecha reciente; alertar si falta alguno. Hoy el sincronizador puede terminar sin
   error cuando no hay copias nuevas o faltan huellas. Integrar esa comprobación al
   final de la descarga y reintentar cuando los paquetes aún no hayan terminado.
3. Registrar commit exacto e inventario de tablas y archivos en el manifiesto.
   Detectar cambios de código sin commit antes de crear el kit y hacer explícito
   cualquier archivo persistente nuevo que quede fuera de cobertura.
4. Probar periódicamente una recuperación completa en un entorno aislado: descifrar
   kit, restaurar base y adjuntos, iniciar aplicación y comprobar documentos y módulos.
   Verificar un catálogo no prueba que esa recuperación completa funcione.
5. Definir copia independiente de contenidos externos, retención según capacidad,
   supervisión de espacio y una segunda copia fuera del equipo y del servidor.
6. Coordinar escrituras o usar instantáneas adecuadas para consistencia entre base
   y adjuntos, y vincular ambos paquetes a la misma versión desplegada.

## Herramienta añadida y validación

`scripts/backup/Test-LocalBackupCoverage.ps1` es de solo lectura. Revisa días consecutivos,
exige ambos tipos de paquete y sus huellas, compara SHA-256 y devuelve código 1 ante
ausencias, archivos vacíos o diferencias. Por defecto revisa los siete días terminados
ayer en Colombia, para no marcar como perdida una copia de hoy aún no programada.

```powershell
powershell.exe -NoProfile -File scripts/backup/Test-LocalBackupCoverage.ps1
```

Se probó con las siete jornadas existentes (resultado OK y código 0) y con una carpeta
sin paquetes de la fecha indicada (resultado INCOMPLETO y código 1).

No se cambió la programación existente ni se desplegaron cambios. Las mejoras operativas
anteriores quedan propuestas para implementación y posterior instalación manual por el usuario.
