#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 3 ]]; then
  echo "Uso: $0 ARCHIVO.enc ARCHIVO_CLAVE DIRECTORIO_VACIO" >&2
  exit 1
fi

KIT_FILE="$1"
PASSWORD_FILE="$2"
DESTINATION="$3"

[[ -f "$KIT_FILE" ]] || { echo "No existe el kit cifrado." >&2; exit 1; }
[[ -s "$PASSWORD_FILE" ]] || { echo "No existe el archivo de clave o esta vacio." >&2; exit 1; }
[[ "$DESTINATION" == /* && "$DESTINATION" != "/" ]] || { echo "El destino debe ser absoluto y seguro." >&2; exit 1; }

install -d -m 700 -- "$DESTINATION"
if find "$DESTINATION" -mindepth 1 -maxdepth 1 | read -r; then
  echo "El directorio de destino debe estar vacio." >&2
  exit 1
fi

DECRYPTED_ARCHIVE="$(mktemp)"
trap 'rm -f -- "$DECRYPTED_ARCHIVE"' EXIT
chmod 600 -- "$DECRYPTED_ARCHIVE"

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -pass "file:$PASSWORD_FILE" -in "$KIT_FILE" -out "$DECRYPTED_ARCHIVE"

while IFS= read -r archive_entry; do
  normalized="${archive_entry#./}"
  normalized="${normalized%/}"
  [[ -z "$normalized" ]] && continue
  if [[ "$normalized" == /* || "$normalized" == *\\* ]]; then
    echo "El kit contiene una ruta no permitida." >&2
    exit 1
  fi
  IFS='/' read -r -a path_segments <<< "$normalized"
  for segment in "${path_segments[@]}"; do
    [[ "$segment" == ".." ]] && { echo "El kit contiene una ruta no permitida." >&2; exit 1; }
  done
done < <(tar -tf "$DECRYPTED_ARCHIVE")

if tar -tvf "$DECRYPTED_ARCHIVE" | awk 'NF && substr($0, 1, 1) != "-" && substr($0, 1, 1) != "d" { exit 1 }'; then
  :
else
  echo "El kit contiene enlaces o tipos de archivo no permitidos." >&2
  exit 1
fi

archive_entries="$(tar -tf "$DECRYPTED_ARCHIVE")"
grep -qx 'private/.env' <<< "$archive_entries" || { echo "Al kit le falta la configuracion privada." >&2; exit 1; }
grep -qx 'private/recovery-manifest.txt' <<< "$archive_entries" || { echo "Al kit le falta el manifiesto." >&2; exit 1; }
grep -qx 'private/source-code.tar.gz' <<< "$archive_entries" || { echo "Al kit le falta la copia del codigo fuente." >&2; exit 1; }

tar -xf "$DECRYPTED_ARCHIVE" --no-same-owner --no-same-permissions -C "$DESTINATION"

echo "Kit recuperado en un directorio aislado. Revise su contenido antes de instalarlo."
