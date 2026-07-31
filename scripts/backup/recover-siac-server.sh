#!/usr/bin/env bash
set -Eeuo pipefail

DEFAULT_TARGET="/var/www/SISTEMAS_INTEGRADOS_DE_GESTION"
KIT_FILE=""
PASSWORD_FILE=""
DATA_BACKUP=""
TARGET_DIR="$DEFAULT_TARGET"
MODE=""
WORK_DIR=""

usage() {
  cat <<'EOF'
Uso:
  recuperar-siac.sh --kit KIT.enc --key backup-kit.key --backup COPIA.siacbackup \
    [--target /var/www/SISTEMAS_INTEGRADOS_DE_GESTION] --verify-only

  recuperar-siac.sh --kit KIT.enc --key backup-kit.key --backup COPIA.siacbackup \
    [--target /var/www/SISTEMAS_INTEGRADOS_DE_GESTION] --confirm-new-server

--verify-only          Valida cifrado, manifiestos, huellas y archivos sin modificar el servidor.
--confirm-new-server   Recupera únicamente sobre una carpeta de aplicación nueva o vacía.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --kit) KIT_FILE="${2:-}"; shift 2 ;;
    --key) PASSWORD_FILE="${2:-}"; shift 2 ;;
    --backup) DATA_BACKUP="${2:-}"; shift 2 ;;
    --target) TARGET_DIR="${2:-}"; shift 2 ;;
    --verify-only) MODE="verify"; shift ;;
    --confirm-new-server) MODE="recover"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Opción no reconocida: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ -n "$KIT_FILE" && -f "$KIT_FILE" ]] || { echo "No existe el kit privado cifrado." >&2; exit 1; }
[[ -n "$PASSWORD_FILE" && -s "$PASSWORD_FILE" ]] || { echo "No existe la llave del kit o está vacía." >&2; exit 1; }
[[ -n "$DATA_BACKUP" && -f "$DATA_BACKUP" ]] || { echo "No existe la copia integral de datos." >&2; exit 1; }
[[ "$TARGET_DIR" == /* && "$TARGET_DIR" != "/" ]] || { echo "El destino debe ser una ruta absoluta segura." >&2; exit 1; }
[[ "$MODE" == "verify" || "$MODE" == "recover" ]] || { echo "Seleccione --verify-only o --confirm-new-server." >&2; exit 2; }

for command_name in openssl tar sha256sum python3; do
  command -v "$command_name" >/dev/null 2>&1 || { echo "Falta la herramienta requerida: $command_name" >&2; exit 1; }
done
if [[ "$MODE" == "recover" ]]; then
  command -v docker >/dev/null 2>&1 || { echo "Docker no está instalado." >&2; exit 1; }
  docker compose version >/dev/null 2>&1 || { echo "Docker Compose no está disponible." >&2; exit 1; }
fi

umask 077
WORK_DIR="$(mktemp -d)"
cleanup() {
  [[ -n "$WORK_DIR" && "$WORK_DIR" == /tmp/* && -d "$WORK_DIR" ]] && rm -rf -- "$WORK_DIR"
}
trap cleanup EXIT

assert_safe_archive() {
  local archive="$1"
  local compressed="${2:-false}"
  local list_flag="-tf"
  local verbose_flag="-tvf"
  [[ "$compressed" == "true" ]] && { list_flag="-tzf"; verbose_flag="-tvzf"; }

  local archive_entry normalized segment
  while IFS= read -r archive_entry; do
    normalized="${archive_entry#./}"
    normalized="${normalized%/}"
    [[ -z "$normalized" ]] && continue
    [[ "$normalized" != /* && "$normalized" != *\\* ]] || { echo "El archivo contiene una ruta absoluta o no permitida." >&2; exit 1; }
    IFS='/' read -r -a path_segments <<< "$normalized"
    for segment in "${path_segments[@]}"; do
      [[ "$segment" != ".." ]] || { echo "El archivo contiene una ruta ascendente no permitida." >&2; exit 1; }
    done
  done < <(tar "$list_flag" "$archive")

  tar "$verbose_flag" "$archive" | awk 'NF && substr($0, 1, 1) != "-" && substr($0, 1, 1) != "d" { exit 1 }' \
    || { echo "El archivo contiene enlaces o tipos especiales no permitidos." >&2; exit 1; }
}

echo "[1/7] Descifrando y validando el kit privado..."
DECRYPTED_KIT="$WORK_DIR/private-kit.tar"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -pass "file:$PASSWORD_FILE" -in "$KIT_FILE" -out "$DECRYPTED_KIT"
assert_safe_archive "$DECRYPTED_KIT"
PRIVATE_ROOT="$WORK_DIR/recovered-private"
mkdir -p "$PRIVATE_ROOT"
tar -xf "$DECRYPTED_KIT" --no-same-owner --no-same-permissions -C "$PRIVATE_ROOT"
PRIVATE_DIR="$PRIVATE_ROOT/private"
for required_path in .env recovery-manifest.txt source-code.tar.gz; do
  [[ -f "$PRIVATE_DIR/$required_path" ]] || { echo "Al kit privado le falta $required_path." >&2; exit 1; }
done
assert_safe_archive "$PRIVATE_DIR/source-code.tar.gz" true

echo "[2/7] Validando la copia integral de datos..."
assert_safe_archive "$DATA_BACKUP"
mapfile -t bundle_entries < <(tar -tf "$DATA_BACKUP")
expected_entries=$'database.dump\nmanifest.json\nuploads.tar.gz'
actual_entries="$(printf '%s\n' "${bundle_entries[@]}" | sed '/^$/d' | sort)"
[[ "$actual_entries" == "$expected_entries" ]] || { echo "La estructura del .siacbackup no es válida." >&2; exit 1; }

DATA_ROOT="$WORK_DIR/integral-data"
mkdir -p "$DATA_ROOT"
tar -xf "$DATA_BACKUP" --no-same-owner --no-same-permissions -C "$DATA_ROOT"
[[ "$(head -c 5 "$DATA_ROOT/database.dump")" == "PGDMP" ]] || { echo "El dump PostgreSQL no tiene firma válida." >&2; exit 1; }
assert_safe_archive "$DATA_ROOT/uploads.tar.gz" true

python3 - "$DATA_ROOT/manifest.json" "$DATA_ROOT/database.dump" "$DATA_ROOT/uploads.tar.gz" <<'PY'
import hashlib
import json
import pathlib
import sys

manifest_path, database_path, uploads_path = map(pathlib.Path, sys.argv[1:])
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
if manifest.get("format") != "siac-integral-backup" or int(manifest.get("version", 0)) != 1:
    raise SystemExit("Formato o versión del paquete integral no compatible.")

def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()

if digest(database_path) != manifest.get("database", {}).get("sha256"):
    raise SystemExit("La huella de database.dump no coincide.")
if digest(uploads_path) != manifest.get("uploads", {}).get("sha256"):
    raise SystemExit("La huella de uploads.tar.gz no coincide.")
print("Huellas internas verificadas.")
PY

if [[ "$MODE" == "verify" ]]; then
  echo "VERIFICACIÓN COMPLETADA: kit privado, código, PostgreSQL y archivos son legibles e íntegros."
  exit 0
fi

if [[ -e "$TARGET_DIR" ]] && find "$TARGET_DIR" -mindepth 1 -maxdepth 1 -print -quit | grep -q .; then
  echo "El destino no está vacío. Use la interfaz para una instalación existente; este asistente no sobrescribe servidores activos." >&2
  exit 1
fi

run_privileged() {
  if [[ "$(id -u)" -eq 0 ]]; then "$@"; else sudo "$@"; fi
}

echo "[3/7] Recuperando código y configuración privada..."
if [[ ! -d "$TARGET_DIR" ]]; then
  run_privileged install -d -m 750 -o "$(id -un)" -g "$(id -gn)" "$TARGET_DIR"
fi
run_privileged chown "$(id -un):$(id -gn)" "$TARGET_DIR"
tar -xzf "$PRIVATE_DIR/source-code.tar.gz" --no-same-owner --no-same-permissions -C "$TARGET_DIR"
install -m 600 "$PRIVATE_DIR/.env" "$TARGET_DIR/.env"
for effective_file in docker-compose.yml deploy.sh; do
  [[ -f "$PRIVATE_DIR/$effective_file" ]] && cp -f -- "$PRIVATE_DIR/$effective_file" "$TARGET_DIR/$effective_file"
done
if [[ -f "$PRIVATE_DIR/frontend/nginx.conf" ]]; then
  install -d -m 750 "$TARGET_DIR/frontend"
  cp -f -- "$PRIVATE_DIR/frontend/nginx.conf" "$TARGET_DIR/frontend/nginx.conf"
fi
if [[ -d "$PRIVATE_DIR/backend/keys" ]]; then
  install -d -m 700 "$TARGET_DIR/backend/keys"
  cp -a -- "$PRIVATE_DIR/backend/keys/." "$TARGET_DIR/backend/keys/"
fi
for certificate in fullchain.pem Cert_planeacion.key; do
  [[ -f "$PRIVATE_DIR/$certificate" ]] && install -m 600 "$PRIVATE_DIR/$certificate" "$TARGET_DIR/$certificate"
done

run_privileged install -d -m 700 -o "$(id -un)" -g "$(id -gn)" /etc/siac
if [[ "$(readlink -f "$PASSWORD_FILE")" != "/etc/siac/backup-kit.key" ]]; then
  install -m 600 "$PASSWORD_FILE" /etc/siac/backup-kit.key
fi

set_env_value() {
  local key="$1" value="$2" env_file="$TARGET_DIR/.env"
  if grep -q "^${key}=" "$env_file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$env_file"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$env_file"
  fi
}
set_env_value SIAC_RECOVERY_KIT_PASSWORD_FILE /etc/siac/backup-kit.key
set_env_value HOST_DB_HOST db
set_env_value HOST_DB_PORT 5432
set_env_value COMPOSE_PROFILES docker-db

recovered_backup_dir="$(sed -n 's/^SIAC_BACKUP_DIR=//p' "$TARGET_DIR/.env" | tail -n 1)"
if [[ -n "$recovered_backup_dir" ]]; then
  [[ "$recovered_backup_dir" == /* && "$recovered_backup_dir" != "/" && "$recovered_backup_dir" != "$TARGET_DIR" ]] \
    || { echo "SIAC_BACKUP_DIR recuperado no es una ruta segura." >&2; exit 1; }
  run_privileged install -d -m 700 -o "$(id -un)" -g "$(id -gn)" "$recovered_backup_dir"
fi

cd "$TARGET_DIR"
docker compose --profile docker-db config --quiet

echo "[4/7] Construyendo servicios y preparando PostgreSQL..."
docker compose --profile docker-db build backend python-service frontend
docker compose --profile docker-db up -d db
for _attempt in $(seq 1 60); do
  if docker compose --profile docker-db exec -T db sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker compose --profile docker-db exec -T db sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null

echo "[5/7] Restaurando PostgreSQL en una transacción..."
docker compose --profile docker-db exec -T db sh -lc \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore --list >/dev/null' \
  < "$DATA_ROOT/database.dump"
docker compose --profile docker-db exec -T db sh -lc \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error --single-transaction --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' \
  < "$DATA_ROOT/database.dump"

echo "[6/7] Restaurando documentos y archivos institucionales..."
if docker compose --profile docker-db run --rm --no-deps -T backend sh -lc \
  'find /app/uploads -mindepth 1 -maxdepth 1 ! -name temp -print -quit | grep -q .'; then
  echo "El volumen backend_uploads no está vacío; se detuvo para no sobrescribir archivos." >&2
  exit 1
fi
if ! docker compose --profile docker-db run --rm --no-deps -T backend sh -lc \
  'mkdir -p /app/uploads && tar -xzf - --no-same-owner --no-same-permissions -C /app/uploads' \
  < "$DATA_ROOT/uploads.tar.gz"; then
  docker compose --profile docker-db run --rm --no-deps -T backend sh -lc \
    'find /app/uploads -mindepth 1 -maxdepth 1 ! -name temp -exec rm -rf -- {} +'
  echo "Falló la restauración de archivos; se retiraron los archivos parciales." >&2
  exit 1
fi

echo "[7/7] Iniciando SIAC y aplicando migraciones..."
docker compose --profile docker-db up -d
docker compose --profile docker-db exec -T backend npm run migrate

for _attempt in $(seq 1 60); do
  backend_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' sgc-backend 2>/dev/null || true)"
  [[ "$backend_health" == "healthy" ]] && break
  sleep 2
done
backend_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' sgc-backend 2>/dev/null || true)"
[[ "$backend_health" == "healthy" ]] || { echo "La restauración terminó, pero el backend no alcanzó estado saludable. Revise docker compose logs backend." >&2; exit 1; }

touch "$TARGET_DIR/.siac-recovery-complete"
chmod 600 "$TARGET_DIR/.siac-recovery-complete"
echo "RECUPERACIÓN INTEGRAL COMPLETADA. Ingrese con la cuenta administradora y realice las verificaciones funcionales."
