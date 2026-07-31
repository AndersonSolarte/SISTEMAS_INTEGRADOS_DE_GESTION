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

# No se ejecuta el .env como codigo shell: algunos valores institucionales
# contienen espacios y todos deben tratarse como datos privados literales.
BACKUP_DIR="$(read_env_value SIAC_BACKUP_DIR)"
PASSWORD_FILE="$(read_env_value SIAC_RECOVERY_KIT_PASSWORD_FILE)"

if [[ -z "$BACKUP_DIR" || "$BACKUP_DIR" != /* || "$BACKUP_DIR" == "/" || "$BACKUP_DIR" == "$PROJECT_DIR" ]]; then
  echo "SIAC_BACKUP_DIR debe ser una ruta absoluta y exclusiva para respaldos." >&2
  exit 1
fi
if [[ -z "$PASSWORD_FILE" || "$PASSWORD_FILE" != /* || ! -f "$PASSWORD_FILE" ]]; then
  echo "Configure SIAC_RECOVERY_KIT_PASSWORD_FILE con un archivo privado fuera del proyecto." >&2
  exit 1
fi
if [[ ! -s "$PASSWORD_FILE" ]]; then
  echo "El archivo de clave del kit esta vacio." >&2
  exit 1
fi

install -d -m 700 -- "$BACKUP_DIR"
STAMP="$(TZ=America/Bogota date +'%Y-%m-%d_%H-%M-%S')"
FINAL_PATH="$BACKUP_DIR/siac_recovery_kit_${STAMP}.enc"
PARTIAL_PATH="${FINAL_PATH}.partial"
KIT_WORK_DIR="$(mktemp -d)"
MANIFEST_PATH="$KIT_WORK_DIR/recovery-manifest.txt"
SOURCE_ARCHIVE="$KIT_WORK_DIR/source-code.tar.gz"
trap 'rm -f -- "$PARTIAL_PATH" "$MANIFEST_PATH" "$SOURCE_ARCHIVE"; rmdir -- "$KIT_WORK_DIR" 2>/dev/null || true' EXIT
umask 077

git -C "$PROJECT_DIR" archive --format=tar.gz --output="$SOURCE_ARCHIVE" HEAD

{
  printf 'format=siac-encrypted-recovery-kit\n'
  printf 'version=1\n'
  printf 'created_at=%s\n' "$(TZ=America/Bogota date --iso-8601=seconds)"
  printf 'git_commit=%s\n' "$(git -C "$PROJECT_DIR" rev-parse HEAD 2>/dev/null || printf unknown)"
  printf 'included=source snapshot, .env, effective deployment configuration, backend/keys and TLS certificates\n'
} > "$MANIFEST_PATH"

kit_entries=(.env)
[[ -f "$PROJECT_DIR/docker-compose.yml" ]] && kit_entries+=(docker-compose.yml)
[[ -f "$PROJECT_DIR/frontend/nginx.conf" ]] && kit_entries+=(frontend/nginx.conf)
[[ -f "$PROJECT_DIR/deploy.sh" ]] && kit_entries+=(deploy.sh)
[[ -d "$PROJECT_DIR/backend/keys" ]] && kit_entries+=(backend/keys)
[[ -f "$PROJECT_DIR/fullchain.pem" ]] && kit_entries+=(fullchain.pem)
[[ -f "$PROJECT_DIR/Cert_planeacion.key" ]] && kit_entries+=(Cert_planeacion.key)

tar --transform 's,^,private/,' -cf - \
  -C "$PROJECT_DIR" "${kit_entries[@]}" \
  -C "$KIT_WORK_DIR" recovery-manifest.txt source-code.tar.gz \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 \
      -pass "file:$PASSWORD_FILE" -out "$PARTIAL_PATH"

mv -- "$PARTIAL_PATH" "$FINAL_PATH"
chmod 600 -- "$FINAL_PATH"
(cd "$BACKUP_DIR" && sha256sum "$(basename "$FINAL_PATH")" > "$(basename "$FINAL_PATH").sha256")
chmod 600 -- "${FINAL_PATH}.sha256"
install -m 700 -- "$SCRIPT_DIR/recover-siac-server.sh" "$BACKUP_DIR/recuperar-siac.sh"
(cd "$BACKUP_DIR" && sha256sum recuperar-siac.sh > recuperar-siac.sh.sha256)
chmod 600 -- "$BACKUP_DIR/recuperar-siac.sh.sha256"
echo "Kit privado cifrado creado: $(basename "$FINAL_PATH")"
