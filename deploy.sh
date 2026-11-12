#!/usr/bin/env bash
# Ejecutado exclusivamente por el usuario en el servidor. Nunca restaura datos.
set -Eeuo pipefail

main() {
  local project_dir="${SIAC_PROJECT_DIR:-/var/www/SISTEMAS_INTEGRADOS_DE_GESTION}"
  cd -- "$project_dir"
  project_dir="$(pwd -P)"
  command -v git >/dev/null
  command -v docker >/dev/null
  docker compose version >/dev/null
  if [[ "$(git branch --show-current)" != main ]]; then
    echo 'El despliegue requiere la rama main; no se cambia de rama automaticamente.' >&2
    return 1
  fi
  if [[ -n "$(git status --porcelain --untracked-files=normal)" ]]; then
    echo 'Hay cambios locales pendientes. Se conserva la instalacion y no se sobrescribe el trabajo.' >&2
    return 1
  fi
  umask 077
  local stamp state_dir rollback_file nginx_preflight_file previous_id service
  stamp="$(date -u +%Y%m%dT%H%M%SZ)-$$"
  state_dir="$project_dir/.deployment-state/$stamp"
  mkdir -p -- "$state_dir"
  git rev-parse HEAD > "$state_dir/previous-commit.txt"
  cp -- docker-compose.yml "$state_dir/docker-compose.previous.yml"
  rollback_file="$state_dir/rollback-images.yml"
  printf 'services:\n' > "$rollback_file"
  for service in backend frontend python-service; do
    previous_id="$(docker compose images -q "$service" | head -n 1)"
    if [[ -z "$previous_id" ]]; then
      echo "No se encontro imagen anterior de $service. Este procedimiento requiere una instalacion existente." >&2
      return 1
    fi
    docker image tag "$previous_id" "siac/$service:rollback-$stamp"
    printf '  %s:\n    image: siac/%s:rollback-%s\n    pull_policy: never\n' "$service" "$service" "$stamp" >> "$rollback_file"
  done
  echo 'Actualizando codigo sin descartar cambios ni reescribir historia...'
  git fetch origin main
  git merge --ff-only origin/main
  git rev-parse HEAD > "$state_dir/target-commit.txt"
  docker compose config --quiet
  echo 'Construyendo y comprobando las imagenes mientras siguen activos los servicios anteriores...'
  docker compose build --pull
  docker compose run --rm --no-deps backend node src/config/productionPreflight.js --database
  # nginx -t valida configuracion y certificados, pero tambien resuelve los
  # upstreams. El backend puede estar detenido en una recuperacion; este alias
  # solo existe en el contenedor temporal y no modifica el proxy de produccion.
  nginx_preflight_file="$state_dir/nginx-preflight.yml"
  printf 'services:\n  frontend:\n    extra_hosts:\n      - "backend:127.0.0.1"\n' > "$nginx_preflight_file"
  docker compose --project-directory "$project_dir" -f docker-compose.yml -f "$nginx_preflight_file" config --quiet
  docker compose --project-directory "$project_dir" -f docker-compose.yml -f "$nginx_preflight_file" run --rm --no-deps frontend nginx -t
  echo 'Iniciando las imagenes comprobadas y esperando sus verificaciones de salud...'
  if ! docker compose up -d --no-build --pull never --wait --wait-timeout 240; then
    echo 'Fallo el arranque. Intentando recuperar las imagenes anteriores, sin restaurar la base de datos...' >&2
    if ! docker compose --project-directory "$project_dir" -f "$state_dir/docker-compose.previous.yml" -f "$rollback_file" up -d --no-build --pull never --wait --wait-timeout 240; then
      echo "La recuperacion de imagenes necesita revision manual. Evidencia: $state_dir" >&2
    fi
    return 1
  fi
  if ! docker compose exec -T backend npm run migrate; then
    echo "Fallo la migracion. No se restaura automaticamente la base ni se descartan registros. Revisar: $state_dir" >&2
    return 1
  fi
  docker compose exec -T backend node -e 'fetch("http://127.0.0.1:5000/api/health").then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))'
  echo "Despliegue completado. Version anterior y recuperacion de imagenes conservadas en: $state_dir"
}
# La funcion se analiza completa antes de actualizar este archivo desde Git.
main "$@"
