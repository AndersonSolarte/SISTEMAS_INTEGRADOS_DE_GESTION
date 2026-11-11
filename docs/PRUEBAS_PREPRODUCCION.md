# Pruebas antes de publicar

Estado: procedimiento preparado; pruebas Linux y proveedores reales pendientes.
Este documento no autoriza ni ejecuta operaciones en produccion.

## Diagnostico del equipo local

Comprobacion de solo lectura del 2026-11-11:

- Windows 10 Enterprise LTSC, build 19044, arquitectura AMD64.
- RAM total 15,9 GB; libre aproximadamente 5,8 GB al comprobar.
- Espacio libre: C aproximadamente 233 GB, D aproximadamente 849 GB.
- Virtualizacion habilitada en firmware y soporte SLAT presentes.
- Sin hipervisor activo ni Docker Desktop instalado; WSL no disponible para uso
  en esta comprobacion.

La documentacion actual de Docker Desktop exige Windows 10 22H2/build 19045 para
esa rama de Windows. Este LTSC/build 19044 no cumple ese requisito. No instalar
una version antigua de Docker para eludirlo ni actualizar el Windows corporativo
como parte de la entrega del aplicativo.

Ruta propuesta para este equipo: una VM Linux independiente, creada por el operador
o soporte TI con un hipervisor compatible y autorizado para este Windows. Como
configuracion inicial de prueba: 4 CPU virtuales, 8 GB de RAM y 80 GB de disco.
Antes de iniciarla, liberar memoria: actualmente no hay 8 GB disponibles. Estos
valores son una propuesta para el ensayo, no una capacidad productiva medida.

Solicitar a TI: VM Linux con Docker Engine y Compose, acceso administrativo de
pruebas, acceso saliente a registros y proveedores, y un hostname HTTPS de pruebas.
Sin acceso a bases, volumenes ni claves de produccion. Al entregar la VM, continuar
con el paso 1 de esta guia. No se instalo software, activo un hipervisor ni reinicio
Windows durante este diagnostico.

Referencia de compatibilidad:
https://docs.docker.com/desktop/setup/install/windows-install/

## 1. Entorno separado

Usar una VM Linux o un equipo con Docker Desktop en modo contenedores Linux,
separado del servidor y del motor Docker de produccion. El equipo Windows revisado
no tiene un motor Docker disponible. Instalarlo y habilitar virtualizacion requiere
configuracion del sistema; no se ha hecho automaticamente.

No basta con `-p siac-preproduction` en el servidor actual: el Compose del proyecto
fija nombres `sgc-*`, la red `sgc-network` y una subred. No ejecutar estos comandos
en el host ni en un contexto Docker que apunte a produccion.

Necesitamos:

- Copia del candidato revisado, con sus cambios sin confirmar incluidos. Un clone
  del commit base solo NO contiene todo el candidato. El paquete tiene manifiesto
  y SHA-256; las notas nuevas de preproduccion se entregan por separado.
- Docker Engine/Compose o Docker Desktop con motor Linux y acceso al registro.
- Un nombre HTTPS de pruebas y certificado valido para ese nombre. El nombre se
  elige con el responsable de infraestructura; no se ha creado DNS ni certificado.
- Datos ficticios o una copia anonimizada, sin destinos de correo reales, tokens
  de firma/recuperacion, sesiones, colas pendientes ni credenciales institucionales.
  No arrancar el aplicativo con una copia bruta de datos de produccion.
- Credenciales propias de pruebas para Google y Turnstile; correo de pruebas en
  una fase posterior. Nunca pegarlas en chat, Git, logs o capturas.

En el equipo de pruebas, verificar manualmente el contexto y el motor:

```bash
docker context show
docker context inspect
docker info --format '{{.OSType}}'
docker compose version
```

El motor debe indicar `linux`. Si el endpoint/contexto no pertenece al equipo de
pruebas, detenerse. No cambiar ni usar el contexto de produccion.

## 2. Configuracion privada de pruebas

Crear `.env.preproduction` desde `.env.docker.example`, en la copia de pruebas.
Mantenerlo fuera de Git y con permisos privados. No copiar `.env` de produccion.
Sustituir todos los valores de ejemplo. Valores clave:

| Variable | Configuracion de pruebas |
| --- | --- |
| PUBLIC_APP_URL | Origen HTTPS exacto de pruebas, sin ruta |
| HOST_DB_HOST | db |
| HOST_DB_PORT | 5432 |
| DB_NAME | siac_preproduction |
| DB_USER / DB_PASSWORD | Usuario exclusivo y clave nueva |
| JWT_SECRET | Clave aleatoria nueva de al menos 32 caracteres |
| DB_PORT_HOST | Puerto libre local, por ejemplo 55433 |
| BACKEND_PORT_HOST | Puerto libre local, por ejemplo 55000 |
| FRONTEND_PORT_HOST | 8080, en este equipo separado |
| FRONTEND_SSL_PORT_HOST | 443, en este equipo separado |
| SIAC_BACKUP_DIR | ./backups-preproduction |
| SIAC_AUTOMATIC_BACKUP_ENABLED | false durante el arranque inicial |
| EMAIL_DELIVERY_ENABLED | false durante todas las pruebas iniciales |
| GOOGLE_CLIENT_ID | ID de cliente web de pruebas |
| TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY | Pareja real para el hostname de pruebas |
| AUTH_GOOGLE_ONLY | true |

Dejar vacias las credenciales SMTP/PLAN_ACTION, institucionales, IA, Calendar,
Drive y cuentas de servicio hasta evaluar la integracion correspondiente. Las
llamadas de esas funciones pueden fallar mientras no se configuren; no cuentan
como integraciones aprobadas. No montar las claves de servicio de produccion.

Preparar `backend/keys/` como directorio vacio, `backups-preproduction/` con permisos
para el usuario del contenedor y los dos archivos TLS del Compose: `fullchain.pem`
y `Cert_planeacion.key`. Aunque el segundo nombre sea historico, el contenido debe
ser la clave del certificado DE PRUEBAS, no el certificado/clave de produccion.
El frontal se compila con las claves publicas de esta configuracion.

## 3. Construccion y arranque Linux

Estos comandos los ejecuta el operador UNICAMENTE en la copia y maquina de pruebas.
No utilizar `deploy.sh` para crear preproduccion: exige una instalacion existente.

```bash
docker compose --env-file .env.preproduction --profile docker-db -p siac-preproduction config --quiet
docker compose --env-file .env.preproduction --profile docker-db -p siac-preproduction build --pull
docker compose --env-file .env.preproduction --profile docker-db -p siac-preproduction up -d --wait db python-service
docker compose --env-file .env.preproduction --profile docker-db -p siac-preproduction run --rm --no-deps backend node src/config/productionPreflight.js --database
docker compose --env-file .env.preproduction --profile docker-db -p siac-preproduction run --rm --no-deps frontend nginx -t
```

Antes de iniciar backend, cargar en `db` un conjunto ficticio compatible con las
migraciones y usuarios de pruebas. Si se emplea un dump anonimizado, debe prepararse
y revisarse antes del arranque. `pg_restore` recibe dumps PostgreSQL compatibles;
un `.siacbackup` integral no se pasa directamente a `pg_restore`. El ensayo anterior
de restauracion no reemplaza preparar un juego de datos seguro para estos proveedores.

```bash
docker compose --env-file .env.preproduction --profile docker-db -p siac-preproduction run --rm --no-deps backend npm run migrate
docker compose --env-file .env.preproduction --profile docker-db -p siac-preproduction up -d --no-build --wait --wait-timeout 240
docker compose --env-file .env.preproduction --profile docker-db -p siac-preproduction ps
docker compose --env-file .env.preproduction --profile docker-db -p siac-preproduction exec -T backend node -e 'fetch("http://127.0.0.1:5000/api/health").then(r=>{console.log(r.status);if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))'
```

Exigir construccion aprobada, servicios sanos y respuesta 200. Abrir el HTTPS real
de pruebas, entrar, navegar, leer un PDF, importar una plantilla y crear un registro.
Comprobar que `.env`, `/.git/config`, `/backend/src/server.js` y mapas `.map` no se
entreguen por HTTP. Revisar logs localmente, con acceso restringido, sin pegarlos
integros en canales publicos. No ejecutar `down -v` ni borrar volumenes.

## 4. Google y Turnstile reales

En Google Cloud, registrar el origen HTTPS de pruebas en los origenes JavaScript
autorizados del cliente web. Usar el mismo Client ID en backend y build frontend.
No confundir login con Calendar/Gmail: esas integraciones tienen otros permisos
y URI de retorno y deben probarse por separado si se van a utilizar.

En Cloudflare Turnstile, crear/configurar el widget para el hostname de pruebas.
La site key es publica; la secret key queda solo en backend. No usar claves dummy
para declarar aprobada una prueba real.

Con cuentas ficticias autorizadas para pruebas:

1. Resolver Turnstile e ingresar con Google: sesion y perfil correctos, rol esperado.
2. Rechazar una cuenta de otro dominio y comprobar permisos con un rol de consulta.
3. Comprobar rechazo de desafio ausente/invalido/reutilizado y credencial Google
   invalida, sin incluir los tokens en capturas ni informes.
4. Cerrar sesion y confirmar que las rutas privadas vuelvan a exigir acceso.
5. Revisar la consola del navegador: sin bloqueo CSP de Google/Turnstile.

Registrar fecha, hostname, version/manifiesto, casos y resultados; no registrar tokens.

## 5. Correo real controlado

Mantener inicialmente `EMAIL_DELIVERY_ENABLED=false`. Para la prueba real usar una
cuenta emisora exclusiva de pruebas y un buzon destinatario bajo control del operador.
Antes de habilitar envio, comprobar que datos, participantes y colas SOLO contienen
ese destinatario. Mantener bloqueadas las salidas de correo no autorizadas en la VM
si la infraestructura permite esa restriccion.

NO confiar en `EMAIL_SANDBOX_RECIPIENT` como aislamiento: el servicio de correo de
Planes de Accion lo ignora cuando NODE_ENV=production. El Compose usa ese modo.

Configurar SMTP general y, si se usa, el transporte independiente PLAN_ACTION con
su cuenta, modo password/relay/oauth2 y credenciales correspondientes. No mezclar
el usuario de una cuenta con la clave de otra. En oauth2 validar autorizacion Gmail;
una conexion SMTP verificada no prueba ese transporte.

Solo con el operador presente, habilitar `EMAIL_DELIVERY_ENABLED=true`, recrear el
backend con el mismo comando `up` de pruebas y ejecutar una accion dirigida a ese
buzon desde cada flujo de correo que se vaya a publicar. Verificar recepcion real,
remitente, asunto, adjuntos y enlaces al hostname DE PRUEBAS. Un messageId, un MIME
generado o una respuesta de envio suprimido no prueban entrega. Registrar el ID sin
credenciales. Al terminar, volver a false y recrear backend.

No se envio ningun mensaje real como parte de la preparacion de esta guia.

## 6. Avisos y decision de publicacion

Consultar `EVALUACION_DEPENDENCIAS_DESARROLLO.md`: evaluacion actual de 19 paquetes
senalados (6 altos, 1 moderado, 12 bajos); incluye avisos propagados por dependencia.
No son 19 fallos independientes del aplicativo. Siguen abiertos.

En el candidato: auditar backend/frontend con `npm audit --omit=dev`; revisar por
separado `npm audit` completo. No usar `npm audit fix --force` ni publicar el servidor
de desarrollo. La imagen final frontend debe contener nginx y estaticos, sin npm,
node_modules ni servidor de desarrollo. Confirmarlo al ejecutar las imagenes Linux.

La decision final exige evidencias Linux, acceso y correo reales, respaldo recuperable,
revision de avisos abiertos y plan de vuelta atras. Pruebas pendientes no son aprobadas.
El despliegue de produccion sigue siendo manual y exclusivo del usuario.

## Referencias oficiales

- https://docs.docker.com/compose/how-tos/project-name/
- https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/
- https://react.dev/blog/2025/02/14/sunsetting-create-react-app
