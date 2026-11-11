# Validación funcional local del refuerzo de seguridad

Fecha: 11 de noviembre de 2026. No se hizo push, despliegue, SSH ni conexión al servidor
de producción. Las copias originales y la clave externa se usaron solo para lectura.

**Estado del ensayo integral: APROBADO LOCALMENTE.** Se completó la restauración por API
y se verificaron los valores originales de una tabla, un registro y un archivo nuevos.
El clúster temporal se cerró y sus datos se eliminaron al terminar.

## Comprobaciones realizadas

| Área | Evidencia local | Alcance |
|---|---|---|
| Backend | 378 pruebas aprobadas con Node 24.22.2 y dos nuevas pruebas de seguridad aprobadas | 380 pruebas; no equivalen a revisar todos los posibles escenarios |
| Frontend | 128 pruebas en 34 suites con Node 24, más compilación optimizada | Conserva advertencias anteriores de lint y de handles de Jest; terminó con código 0 |
| Python | Cuatro pruebas funcionales aprobadas en la revisión previa | Ejecutadas con Python 3.14; árbol de dependencias de producción 3.11 resuelto y auditado, no contenedor Linux ejecutado |
| Navegador | Chrome headless con perfil nuevo: pantalla real de acceso, imagen blob y vista previa iframe renderizadas | Google y demás destinos externos bloqueados por la prueba; no se usaron cuentas reales |
| CSP | Sin violaciones para recursos necesarios; conexión a dominio ajeno rechazada por connect-src | Prueba real de aplicación de la política en el navegador |
| Nginx 1.30.6 | Sintaxis correcta; TLS 1.2 y 1.3; index y bundle servidos; cabeceras verificadas | Ejecutable Windows portátil, certificado temporal y puertos loopback |
| Archivos privados | Peticiones a .env, .git, package.json, src, backend y mapas devuelven 403/404 | No se publica el backend ni los archivos originales del repositorio por esas rutas |
| Docker Compose | Configuración de producción validada con variables ficticias | Sin iniciar servicios ni imprimir configuración privada |
| Imágenes | Etiquetas oficiales Node, Nginx, Python y PostgreSQL disponibles para linux/amd64 | Consulta de manifiestos, no construcción/ejecución de imágenes |
| Base y adjuntos | Copia integral del 10 de noviembre restaurada: 120 tablas base y 3.183 archivos | PostgreSQL 18 local; no PostgreSQL habitual ni producción |
| Arranque | Backend real iniciado con Node 24 contra la base restaurada | Escucha forzada en 127.0.0.1, procesos automáticos y salidas de red restringidos |
| Acceso y permisos | Login interno, perfil, JWT alterado rechazado, dominio ajeno rechazado y usuario consulta sin capacidad administrativa | Solo respuestas de Google y Turnstile simuladas; controladores, JWT, permisos y base reales |
| Documentos | Catálogo autenticado y descarga de un PDF restaurado con SHA-256 idéntico al archivo | No se descargaron documentos desde servicios externos |
| Importación/exportación | XLSX interoperable SheetJS/ExcelJS, plantilla generada por API y archivo ejecutable rechazado con 415 | No certifica cada variante de importación empresarial masiva |
| Correo | Generación MIME real con Nodemailer 10 y adjunto XLSX | Sin entrega SMTP ni correo real; credenciales y permisos del proveedor requieren prueba posterior |
| Nuevas estructuras | Copia integral real generada después de crear tabla, registro y archivo ficticios | Se usó el generador actual, sin lista fija de tablas |
| Restauración por API | Respuesta 200; tabla y archivo recuperaron el marcador original después de modificarlos | Paquete integral completo, no un respaldo reducido a una tabla |
| Kit de recuperación | SHA-256 correcto, descifrado con clave local, código y configuración presentes | No se imprimieron secretos; contenido temporal descifrado eliminado |
| HTTPS del kit | Certificado vigente y clave privada coincidente | No certifica revocación, DNS ni el certificado que esté sirviendo producción en este instante |

## Correcciones surgidas de la validación

1. La CSP aplicada a index.html bloqueaba Google GSI por connect-src, imágenes blob,
   iframes locales/blob y los visores de Google Maps/Office utilizados por la interfaz.
   Se reprodujeron seis bloqueos en Chrome y se ajustaron las directivas a esos recursos
   existentes. También se admitieron los orígenes de las fuentes usadas por el tema.
   La política sigue rechazando conexiones a orígenes no autorizados. No se permitió
   unsafe-inline en scripts ni se abrió connect-src a cualquier HTTPS.
2. El controlador de restauración devolvía errores internos y rutas en detail también
   en producción. Ahora los omite en producción y conserva el diagnóstico en desarrollo.
   Dos pruebas verifican además que un paquete inválido no inicia PostgreSQL y libera
   el bloqueo de operación.
3. El servidor estático respeta SIAC_UPLOADS_DIR, igual que el servicio de respaldo.
   Su valor por defecto sigue siendo backend/uploads. Esto permitió probar los archivos
   restaurados sin mezclar sus rutas con los adjuntos del entorno habitual.

## Cómo se aisló el ensayo

- Clúster creado con initdb en tmp/release-isolated-*, con puerto nuevo, base validation_db
  y escucha exclusiva en loopback. No se reutilizó una base existente.
- Se recreó la identidad postgres sin acceso de login dentro de ese clúster porque los
  roles globales no forman parte de pg_dump. El kit conserva la configuración del rol
  de conexión; esa preparación debe existir también al recuperar un servidor nuevo.
- Antes de cargar el aplicativo se anularon las variables de los archivos privados y se
  asignaron credenciales ficticias, secretos aleatorios, rutas y destinos temporales.
- El preload de pruebas exige comprobar la carpeta del clúster y su puerto. No se copia
  a la imagen del backend y no debe usarse como comando de arranque del aplicativo.
- El backend de prueba solo puede abrir conexiones al puerto de su PostgreSQL temporal.
  Se deshabilitaron notificaciones y workers que pudieran tener efectos externos.
- El navegador usó un perfil temporal y un proxy que rechaza tráfico externo. La confianza
  del certificado de prueba se limitó a su clave pública; no se instaló una CA en Windows.
- El kit se descifró solo dentro de una carpeta temporal controlada y luego se eliminó
  todo el texto plano. No se modificó ni se imprimió la clave original.

El último ensayo usa opciones rápidas de WAL/fsync solo en el clúster desechable. Se
comprueba recuperación funcional, no durabilidad ante cortes de energía ni rendimiento
de producción. Ensayos anteriores restauraron la copia con opciones normales.

Los intentos iniciales revelaron problemas del validador en Windows (manejo de pg_ctl,
configuración de OpenSSL, directorios de Nginx y conexión Sequelize). Se corrigieron.
La primera solicitud larga de restauración también alcanzó el límite del cliente fetch;
el validador ahora transmite desde disco con http.request y una espera explícita de veinte
minutos. La interfaz existente usa timeout 0 y Nginx tiene espera de 3.600 segundos para API.

## Repetir las comprobaciones

```powershell
# Requiere los ejecutables portatiles indicados o rutas equivalentes configuradas.
$env:VALIDATION_BROWSER_SMOKE='true'
& tmp/validation-tools/node-v24.22.2-win-x64/node.exe scripts/validation/run-nginx-preflight.cjs

powershell.exe -NoProfile -File scripts/validation/Test-RecoveryKit.ps1

& tmp/validation-tools/node-v24.22.2-win-x64/node.exe scripts/validation/validate-release.cjs 'RUTA_LOCAL_AL_RESPALDO.siacbackup'
```

La ejecución normal del ensayo no habilita las opciones rápidas de PostgreSQL; solo se
usan si se define explícitamente VALIDATION_FAST_CLUSTER=true. Los resultados detallados
se conservan localmente en tmp/release-validation, excluido de Git.

## Límites para autorizar producción

Queda pendiente construir y arrancar las imágenes Linux en Docker y verificar el acceso
Google/Turnstile y SMTP con la configuración real en preproducción. No se comprobó una
importación masiva de cada categoría ni una caída eléctrica durante la restauración.

Siguen los 19 avisos conocidos de las herramientas de desarrollo del frontend descritos
en PREPARACION_PRODUCCION_SEGURA_2026-11-11.md; estas pruebas no los eliminan. Las auditorías
previas de dependencias de producción dieron cero avisos conocidos, con el alcance allí
descrito. La clasificación y autorización de todos los adjuntos, el cifrado propio del
integral y la segunda copia inmutable siguen pendientes de la evaluación de seguridad.

## Vuelta a la versión anterior

Para el despliegue manual, el usuario debe conservar previamente el commit instalado y
las imágenes que estén funcionando. El asistente no obtuvo esos datos del servidor.
Las correcciones de esta entrega no añaden una migración de esquema propia.

Ejemplo de preparación **que ejecuta el usuario**, antes de reconstruir imágenes:

```bash
git rev-parse HEAD > ../siac-before-security.commit
docker image tag "$(docker compose images -q backend)" siac/backend:before-security
docker image tag "$(docker compose images -q frontend)" siac/frontend:before-security
docker image tag "$(docker compose images -q python-service)" siac/python-service:before-security
```

Para volver a esas imágenes se puede usar un override con sus tres etiquetas y ejecutar
compose up --no-build --pull never. Ejemplo de rollback-images.yml:

```yaml
services:
  backend:
    image: siac/backend:before-security
    pull_policy: never
  frontend:
    image: siac/frontend:before-security
    pull_policy: never
  python-service:
    image: siac/python-service:before-security
    pull_policy: never
```

```bash
docker compose -f docker-compose.yml -f rollback-images.yml up -d --no-build --pull never
```

No restaurar automáticamente una base anterior para
revertir solo imágenes: eso podría descartar datos registrados después del despliegue.
Conservar el respaldo y su clave en todo caso, y revisar diferencias del compose antes
de cualquier vuelta atrás. No se ejecutó ni se ensayó esta operación en producción.

## Referencias de compatibilidad CSP

- Google Identity Services: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- Cloudflare Turnstile: https://developers.cloudflare.com/turnstile/reference/content-security-policy/
