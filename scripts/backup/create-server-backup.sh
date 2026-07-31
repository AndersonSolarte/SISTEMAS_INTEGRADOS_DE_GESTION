#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "No existe la configuracion privada del servidor." >&2
  exit 1
fi

read_env_value() {
  local key="$1"
  local value
  value="$(sed -n "s/^${key}=//p" "$ENV_FILE" | tail -n 1)"
  value="${value%$'\r'}"
  if [[ ${#value} -ge 2 && "${value:0:1}" == '"' && "${value: -1}" == '"' ]]; then
    value="${value:1:${#value}-2}"
  elif [[ ${#value} -ge 2 && "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf '%s' "$value"
}

SIAC_AUTOMATIC_BACKUP_ENABLED="$(read_env_value SIAC_AUTOMATIC_BACKUP_ENABLED)"
SIAC_ALLOW_LEGACY_BACKUP_SCRIPT="$(read_env_value SIAC_ALLOW_LEGACY_BACKUP_SCRIPT)"
SIAC_BACKUP_DIR="$(read_env_value SIAC_BACKUP_DIR)"
SIAC_BACKUP_RETENTION_DAYS="$(read_env_value SIAC_BACKUP_RETENTION_DAYS)"

# El programador integrado registra avance, validacion e historial en la
# interfaz. Este respaldo legado queda solo como mecanismo de emergencia y no
# debe ejecutarse en paralelo con el monitor de la aplicacion.
if [[ "${SIAC_AUTOMATIC_BACKUP_ENABLED:-true}" == "true" && "${SIAC_ALLOW_LEGACY_BACKUP_SCRIPT:-false}" != "true" ]]; then
  echo "La copia automatica esta administrada por el Centro de Respaldo de SIAC."
  exit 0
fi

BACKUP_DIR="${SIAC_BACKUP_DIR:-}"
RETENTION_DAYS="${SIAC_BACKUP_RETENTION_DAYS:-0}"

if [[ -z "$BACKUP_DIR" || "$BACKUP_DIR" != /* || "$BACKUP_DIR" == "/" || "$BACKUP_DIR" == "$PROJECT_DIR" ]]; then
  echo "SIAC_BACKUP_DIR debe ser una ruta absoluta, privada y exclusiva para respaldos." >&2
  exit 1
fi

install -d -m 700 -- "$BACKUP_DIR"
cd "$PROJECT_DIR"

STAMP="$(TZ=America/Bogota date +'%Y-%m-%d_%H-%M-%S')"
FILENAME="sgc_completo_${STAMP}.dump"
PARTIAL_PATH="$BACKUP_DIR/.${FILENAME}.partial"
FINAL_PATH="$BACKUP_DIR/$FILENAME"

cleanup() {
  [[ -f "$PARTIAL_PATH" ]] && rm -f -- "$PARTIAL_PATH"
}
trap cleanup EXIT
umask 077

docker compose exec -T backend sh -c '
  PGPASSWORD="$DB_PASSWORD" exec pg_dump \
    --format=custom --compress=6 --no-owner --no-privileges \
    --host="$DB_HOST" --port="$DB_PORT" \
    --username="$DB_USER" --dbname="$DB_NAME"
' > "$PARTIAL_PATH"

if [[ "$(head -c 5 -- "$PARTIAL_PATH")" != "PGDMP" ]]; then
  echo "La copia generada no tiene una firma PostgreSQL valida." >&2
  exit 1
fi

docker compose exec -T backend pg_restore --list < "$PARTIAL_PATH" > /dev/null
mv -- "$PARTIAL_PATH" "$FINAL_PATH"
chmod 600 -- "$FINAL_PATH"

{
  printf 'file=%s\n' "$FILENAME"
  printf 'created_at=%s\n' "$(TZ=America/Bogota date --iso-8601=seconds)"
  printf 'size_bytes=%s\n' "$(stat -c '%s' -- "$FINAL_PATH")"
} > "$BACKUP_DIR/.last-success"
chmod 600 -- "$BACKUP_DIR/.last-success"

if [[ "$RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]]; then
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'sgc_completo_*.dump' -mtime "+$RETENTION_DAYS" -delete
fi

echo "Copia PostgreSQL verificada: $FILENAME"
