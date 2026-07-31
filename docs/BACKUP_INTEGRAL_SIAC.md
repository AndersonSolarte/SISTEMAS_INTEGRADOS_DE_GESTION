# Respaldo integral y recuperación de SIAC

## Alcance

La recuperación se divide en dos paquetes complementarios para no exponer secretos:

1. `sgc_integral_*.siacbackup`: copia diaria de PostgreSQL y `backend_uploads`.
2. `siac_recovery_kit_*.enc`: código fuente, configuración privada, configuración efectiva de despliegue, certificados y claves de integración, todo cifrado.

El repositorio Git sigue siendo la vía normal de despliegue, pero el kit incluye además `source-code.tar.gz` para poder recuperar la versión exacta aun si el repositorio remoto no está disponible.

El paquete integral contiene:

- `database.dump`: estructura, relaciones, secuencias y registros PostgreSQL.
- `uploads.tar.gz`: documentos, fotos, adjuntos y archivos generados por el aplicativo.
- `manifest.json`: versión del formato, tamaños y huellas SHA-256.

El servidor genera además `sgc_integral_*.siacbackup.sha256`. El sincronizador de Windows compara esa huella después de descargar el paquete.

Las carpetas temporales se excluyen. Un paquete solo se publica después de validar las firmas, el catálogo de PostgreSQL, las rutas internas y las huellas criptográficas.

## Configuración privada del servidor

Genere una clave larga fuera del proyecto:

```bash
sudo install -d -m 700 -o "$(id -un)" -g "$(id -gn)" /etc/siac
umask 077
openssl rand -base64 48 > /etc/siac/backup-kit.key
chmod 600 /etc/siac/backup-kit.key
```

Agregue únicamente la ruta al `.env` privado:

```env
SIAC_RECOVERY_KIT_PASSWORD_FILE=/etc/siac/backup-kit.key
```

El archivo `/etc/siac/backup-kit.key` debe copiarse una sola vez a un medio seguro diferente del servidor. Si se pierde, el kit cifrado no se puede recuperar. No lo agregue a Git ni lo guarde junto al único ejemplar del kit.

Desde PowerShell, cree una carpeta privada distinta de la carpeta de copias y descargue la clave una sola vez:

```powershell
New-Item -ItemType Directory -Path 'D:\SIAC_CLAVE_DE_RECUPERACION' -Force
scp pcmud4000@SERVIDOR_SIAC:/etc/siac/backup-kit.key 'D:\SIAC_CLAVE_DE_RECUPERACION\backup-kit.key'
```

Conserve una segunda copia de `backup-kit.key` en una memoria USB cifrada o en un gestor institucional de contraseñas. Los paquetes `.enc` pueden permanecer en `D:\SIAC_COPIAS_DE_SEGURIDAD`, pero la única copia de su clave no debe quedar en esa misma carpeta.

Instale o actualice la programación:

```bash
cd /var/www/SISTEMAS_INTEGRADOS_DE_GESTION
chmod 700 scripts/backup/*.sh
./scripts/backup/install-server-backup-cron.sh
```

La aplicación genera la copia integral a las 18:00 y el cron genera el kit privado a las 18:20, hora de Colombia.

## Copia local en Windows

`Sync-ServerBackups.ps1` descarga paquetes integrales, dumps heredados, kits cifrados y huellas hacia la ruta configurada, por ejemplo `D:\SIAC_COPIAS_DE_SEGURIDAD`. La tarea local se programa a las 18:35, después de generar ambos respaldos. Nunca descarga el archivo de contraseña automáticamente.

## Restauración

La interfaz administrativa admite:

- `.siacbackup`: restaura PostgreSQL y archivos, comprobando primero el manifiesto.
- `.dump` o `.backup`: compatibilidad histórica; restaura solamente PostgreSQL.

La restauración integral conserva temporalmente los archivos actuales para poder devolverlos si PostgreSQL falla. Solo elimina esa reserva después de completar la transacción.

## Recuperación total de un servidor nuevo

Cada kit genera también `recuperar-siac.sh` y su huella SHA-256. El sincronizador los guarda junto a las copias locales.

Primero compruebe los archivos sin modificar el servidor:

```bash
chmod 700 recuperar-siac.sh
./recuperar-siac.sh \
  --kit /ruta/siac_recovery_kit_FECHA.enc \
  --key /ruta/backup-kit.key \
  --backup /ruta/sgc_integral_FECHA.siacbackup \
  --verify-only
```

En un servidor Ubuntu nuevo, con Docker instalado y la carpeta de destino vacía:

```bash
./recuperar-siac.sh \
  --kit /ruta/siac_recovery_kit_FECHA.enc \
  --key /ruta/backup-kit.key \
  --backup /ruta/sgc_integral_FECHA.siacbackup \
  --target /var/www/SISTEMAS_INTEGRADOS_DE_GESTION \
  --confirm-new-server
```

El asistente valida cifrado y huellas, recupera el código y la configuración, prepara Docker y PostgreSQL, restaura la base en una transacción, recupera `backend_uploads`, ejecuta migraciones y comprueba la salud del backend. Se niega a sobrescribir una instalación existente; para servidores activos se utiliza la interfaz administrativa.

Para recuperar la configuración privada en un servidor nuevo, use primero un directorio vacío:

```bash
./scripts/backup/restore-recovery-kit.sh \
  /ruta/siac_recovery_kit_FECHA.enc \
  /ruta/backup-kit.key \
  /ruta/temporal/vacia
```

Revise los archivos recuperados antes de instalarlos en el proyecto. `private/source-code.tar.gz` contiene el código versionado; los demás archivos de `private/` contienen la configuración efectiva. Después levante el aplicativo y restaure el `.siacbackup` desde el Centro de Respaldo.
