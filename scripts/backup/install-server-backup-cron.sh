#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/create-server-backup.sh"
LOG_DIR="$PROJECT_DIR/logs"
MARKER_START="# SIAC_AUTOMATIC_BACKUP_START"
MARKER_END="# SIAC_AUTOMATIC_BACKUP_END"

chmod 700 -- "$BACKUP_SCRIPT"
install -d -m 700 -- "$LOG_DIR"

TMP_CRON="$(mktemp)"
trap 'rm -f -- "$TMP_CRON"' EXIT

(crontab -l 2>/dev/null || true) | awk -v start="$MARKER_START" -v end="$MARKER_END" '
  $0 == start { skip=1; next }
  $0 == end { skip=0; next }
  !skip { print }
' > "$TMP_CRON"

{
  printf '%s\n' "$MARKER_START"
  # Se evalua cada hora usando explicitamente la zona de Colombia. Asi no
  # depende de que el servidor este configurado en UTC u otra zona horaria.
  printf '0 * * * * [ "$(TZ=America/Bogota date +\%%H)" = "18" ] && %q >> %q 2>&1\n' "$BACKUP_SCRIPT" "$LOG_DIR/automatic-backup.log"
  printf '%s\n' "$MARKER_END"
} >> "$TMP_CRON"

crontab "$TMP_CRON"
echo "Respaldo diario instalado para las 18:00 (America/Bogota)."
