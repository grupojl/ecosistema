#!/usr/bin/env bash
# Stack local del ecosistema COMPLETO en Docker (5 servicios + Postgres + Redis), descartable y sin tocar Railway.
# Sirve para validar lo que el CI no ve: que cada Dockerfile construye, que la imagen arranca desde el layout real
# del runtime (usuario no-root, node_modules sin hoisting, entrypoint con `prisma migrate deploy`) y que los
# servicios se hablan entre sí por la red de Docker.
#
#   bash scripts/docker/stack.sh build [servicio…]   construye las imágenes (todas si no se indica)
#   bash scripts/docker/stack.sh up                  red + bases + los 5 contenedores
#   bash scripts/docker/stack.sh smoke               pruebas de humo contra lo que está corriendo
#   bash scripts/docker/stack.sh status | logs <servicio> | down | all
#
# Requisitos: Docker, y los contenedores eco-test-pg (Postgres 16) y eco-test-redis (Redis 7) ya creados
# (ver .claude/roadmap/deuda-tecnica.md, "Cómo correr la integración en local").
# Puertos del rango de este repo (puertos.md): sass-back 3020 · sass-front 3021 · dashboard 3022 · storefront 3023 · ecommerce-back 3025.
set -uo pipefail
cd "$(dirname "$0")/../.."

NET=eco-net
PG=eco-test-pg
REDIS=eco-test-redis
ENV_FILE=scripts/docker/.stack.env      # secretos generados, ignorado por git
LOG_DIR=scripts/docker/.logs            # ignorado por git

SERVICES=(sass-back ecommerce-back sass-front dashboard-front ecommerce-front)
declare -A DIR=( [sass-back]=realsass-sass-back [ecommerce-back]=realsass-ecommerce-back [sass-front]=realsass-sass-front [dashboard-front]=realsass-dashboard-front [ecommerce-front]=real-ecommerce-front )
declare -A HOST_PORT=( [sass-back]=3020 [ecommerce-back]=3025 [sass-front]=3021 [dashboard-front]=3022 [ecommerce-front]=3023 )
declare -A CONT_PORT=( [sass-back]=3000 [ecommerce-back]=3025 [sass-front]=3000 [dashboard-front]=3000 [ecommerce-front]=3000 )

say()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; FAILS=$((FAILS+1)); }
FAILS=0

ensure_env() {
  [[ -f "$ENV_FILE" ]] && return
  {
    echo "INTERNAL_API_KEY=$(openssl rand -hex 24)"          # 48 caracteres (producción exige ≥ 32)
    echo "CONFIG_MASTER_KEY=$(openssl rand -hex 32)"         # 64 hex = 32 bytes
    echo "CUSTOMER_SESSION_SECRET=$(openssl rand -hex 32)"
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
}

# ── red y bases ──────────────────────────────────────────────────────────────
net() {
  say "Red y bases"
  for c in "$PG" "$REDIS"; do
    docker inspect "$c" >/dev/null 2>&1 || { echo "Falta el contenedor $c (ver el encabezado de este script)"; exit 2; }
  done
  docker network inspect "$NET" >/dev/null 2>&1 || docker network create "$NET" >/dev/null
  for c in "$PG" "$REDIS"; do docker network connect "$NET" "$c" 2>/dev/null || true; done
  # Bases propias del stack (no las de los tests de integración): el entrypoint corre `migrate deploy` sobre una base NUEVA.
  for db in sass_stack ecommerce_stack; do
    docker exec "$PG" psql -U test -tAc "select 1 from pg_database where datname='$db'" | grep -q 1 \
      || docker exec "$PG" psql -U test -c "create database $db" >/dev/null
  done
  ok "red $NET con $PG y $REDIS · bases sass_stack y ecommerce_stack"
}

# ── build ────────────────────────────────────────────────────────────────────
FIREBASE_ARGS=(
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=local-dummy
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=local.firebaseapp.com
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID=local-project
  --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=local.appspot.com
  --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:local
)
build_args() {
  case "$1" in
    sass-front)      echo "${FIREBASE_ARGS[@]} --build-arg NEXT_PUBLIC_SASS_BACK_URL=http://localhost:3020 --build-arg NEXT_PUBLIC_DASHBOARD_FRONT_URL=http://localhost:3022" ;;
    dashboard-front) echo "${FIREBASE_ARGS[@]} --build-arg NEXT_PUBLIC_SASS_BACK_URL=http://localhost:3020 --build-arg NEXT_PUBLIC_ECOMMERCE_API_URL=http://localhost:3025 --build-arg NEXT_PUBLIC_STORE_FRONT_URL=http://localhost:3023 --build-arg NEXT_PUBLIC_SASS_FRONT_URL=http://localhost:3021 --build-arg NEXT_PUBLIC_CHAT_IA_URL=http://localhost:3026 --build-arg NEXT_PUBLIC_CAMPANAS_URL=http://localhost:3027 --build-arg NEXT_PUBLIC_PAGOS_URL=http://localhost:3028" ;;
    ecommerce-front) echo "${FIREBASE_ARGS[@]} --build-arg NEXT_PUBLIC_ECOMMERCE_API_URL=http://localhost:3025 --build-arg NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID=00000000-0000-4000-8000-000000000001 --build-arg SITE_URL=http://localhost:3023" ;;
    *) echo "" ;;
  esac
}

build() {
  local targets=("$@"); [[ ${#targets[@]} -eq 0 ]] && targets=("${SERVICES[@]}")
  mkdir -p "$LOG_DIR"
  for s in "${targets[@]}"; do
    say "docker build · $s"
    local start=$SECONDS
    # shellcheck disable=SC2046
    if docker build --progress=plain -f "${DIR[$s]}/Dockerfile" $(build_args "$s") -t "eco/$s:local" . >"$LOG_DIR/build-$s.log" 2>&1; then
      ok "$s construida en $((SECONDS-start)) s  ($(docker image inspect "eco/$s:local" --format '{{.Size}}' | awk '{printf "%.0f MB", $1/1048576}'))"
    else
      bad "$s FALLÓ — últimas líneas de $LOG_DIR/build-$s.log:"; tail -n 25 "$LOG_DIR/build-$s.log" | sed 's/^/      /'
    fi
  done
}

# ── run ──────────────────────────────────────────────────────────────────────
up() {
  ensure_env; net
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  local origins="http://localhost:3021,http://localhost:3022,http://localhost:3023"
  local pgurl="postgresql://test:test@$PG:5432"
  local redis="redis://$REDIS:6379"
  say "Contenedores"
  for s in "${SERVICES[@]}"; do docker rm -f "eco-$s" >/dev/null 2>&1 || true; done

  docker run -d --name eco-sass-back --network "$NET" -p 3020:3000 \
    -e ALLOWED_ORIGINS="$origins" -e DATABASE_URL="$pgurl/sass_stack" \
    -e REDIS_ENABLED=true -e REDIS_URL="$redis" \
    -e INTERNAL_API_KEY="$INTERNAL_API_KEY" -e CONFIG_MASTER_KEY="$CONFIG_MASTER_KEY" \
    -e DASHBOARD_FRONT_URL=http://localhost:3022 \
    eco/sass-back:local >/dev/null && ok "eco-sass-back → :3020"

  docker run -d --name eco-ecommerce-back --network "$NET" -p 3025:3025 \
    -e ALLOWED_ORIGINS="$origins" -e DATABASE_URL="$pgurl/ecommerce_stack" \
    -e REDIS_ENABLED=true -e REDIS_URL="$redis" \
    -e INTERNAL_API_KEY="$INTERNAL_API_KEY" -e CUSTOMER_SESSION_SECRET="$CUSTOMER_SESSION_SECRET" \
    -e SASS_BACK_URL=http://eco-sass-back:3000 -e ORGANIZATIONS_SERVICE_URL=http://eco-sass-back:3000 -e ORGANIZATIONS_SERVICE_PREFIX=/api/v1 \
    eco/ecommerce-back:local >/dev/null && ok "eco-ecommerce-back → :3025"

  docker run -d --name eco-sass-front --network "$NET" -p 3021:3000 \
    -e SASS_BACK_URL=http://eco-sass-back:3000 \
    eco/sass-front:local >/dev/null && ok "eco-sass-front → :3021"

  docker run -d --name eco-dashboard-front --network "$NET" -p 3022:3000 \
    -e SASS_BACK_URL=http://eco-sass-back:3000 -e ECOMMERCE_BACK_URL=http://eco-ecommerce-back:3025 \
    eco/dashboard-front:local >/dev/null && ok "eco-dashboard-front → :3022"

  docker run -d --name eco-ecommerce-front --network "$NET" -p 3023:3000 \
    -e ECOMMERCE_BACK_URL=http://eco-ecommerce-back:3025 \
    eco/ecommerce-front:local >/dev/null && ok "eco-ecommerce-front → :3023"
}

down() {
  say "Bajando contenedores del stack (Postgres y Redis se conservan)"
  for s in "${SERVICES[@]}"; do docker rm -f "eco-$s" >/dev/null 2>&1 && ok "eco-$s"; done
}

status() {
  say "Estado"
  docker ps -a --filter "name=eco-" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
}

logs() { docker logs --tail "${2:-80}" "eco-${1:?uso: logs <servicio>}" 2>&1; }

# ── humo ─────────────────────────────────────────────────────────────────────
# code <método> <url> [header…]  → imprime el código HTTP
code() { local m=$1 u=$2; shift 2; curl -s -o /dev/null -w '%{http_code}' -X "$m" --max-time 15 "$@" "$u" 2>/dev/null || echo 000; }
body() { local u=$1; shift; curl -s --max-time 15 "$@" "$u" 2>/dev/null; }
expect() { # expect <descripción> <esperado> <obtenido>
  if [[ "$2" == "$3" ]]; then ok "$1 ($3)"; else bad "$1 — esperado $2, obtenido $3"; fi
}

wait_healthy() {
  say "Esperando que arranquen (hasta 120 s)"
  for s in "${SERVICES[@]}"; do
    local end=$((SECONDS+120)) st=""
    while (( SECONDS < end )); do
      st=$(docker inspect -f '{{.State.Status}}' "eco-$s" 2>/dev/null || echo ausente)
      [[ "$st" != "running" ]] && break
      [[ "$(code GET "http://localhost:${HOST_PORT[$s]}/")" != "000" ]] && break
      sleep 3
    done
    [[ "$st" == "running" ]] && ok "eco-$s corriendo" || bad "eco-$s está '$st' — docker logs eco-$s"
  done
}

smoke() {
  source "$ENV_FILE" 2>/dev/null || { echo "Falta $ENV_FILE: corré 'up' primero"; exit 2; }
  wait_healthy

  say "Healthchecks (los mismos que usa el HEALTHCHECK del Dockerfile)"
  expect "sass-back GET /health"       200 "$(code GET http://localhost:3020/health)"
  expect "ecommerce-back GET /health"  200 "$(code GET http://localhost:3025/health)"
  for s in "${SERVICES[@]}"; do
    h=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}sin-healthcheck{{end}}' "eco-$s" 2>/dev/null)
    echo "    estado de salud de Docker en eco-$s: $h"
  done

  say "Migraciones aplicadas por el entrypoint (prisma migrate deploy)"
  n_sass=$(docker exec "$PG" psql -U test -d sass_stack -tAc "select count(*) from _prisma_migrations where finished_at is not null")
  n_ecom=$(docker exec "$PG" psql -U test -d ecommerce_stack -tAc "select count(*) from _prisma_migrations where finished_at is not null")
  [[ "${n_sass:-0}" -ge 2 ]] && ok "sass-back: $n_sass migraciones" || bad "sass-back: ${n_sass:-0} migraciones (esperadas ≥ 2)"
  [[ "${n_ecom:-0}" -ge 1 ]] && ok "ecommerce-back: $n_ecom migraciones" || bad "ecommerce-back: ${n_ecom:-0} migraciones (esperadas ≥ 1)"

  say "Seguridad: /internal exige la clave de servicio (ADR-023)"
  expect "sin clave" 401 "$(code GET http://localhost:3020/internal/organizations)"
  expect "clave incorrecta" 401 "$(code GET http://localhost:3020/internal/organizations -H 'x-internal-api-key: incorrecta-incorrecta-incorrecta-123')"
  expect "clave correcta" 200 "$(code GET 'http://localhost:3020/internal/organizations' -H "x-internal-api-key: $INTERNAL_API_KEY")"

  say "tRPC montado en la ruta real (regresión del prefijo duplicado)"
  in='%7B%22slug%22%3A%22no-existe%22%7D'
  r=$(code GET "http://localhost:3025/api/v1/trpc/customer.resolveStore?input=$in")
  [[ "$r" == "404" || "$r" == "200" ]] && ok "ecommerce /api/v1/trpc responde ($r)" || bad "ecommerce /api/v1/trpc devolvió $r (404 = ruta no montada)"
  expect "ecommerce /api/v1/api/v1/trpc NO existe" 404 "$(code GET "http://localhost:3025/api/v1/api/v1/trpc/customer.resolveStore?input=$in")"
  r=$(code GET 'http://localhost:3020/api/v1/trpc/organizations.me')
  expect "sass-back: procedure autenticado sin sesión" 401 "$r"
  r=$(code GET 'http://localhost:3020/api/v1/trpc/configSecrets.list')
  expect "sass-back: procedure de dueño sin sesión" 401 "$r"
  r=$(code GET 'http://localhost:3025/api/v1/trpc/customer.me')
  expect "ecommerce: customer.me sin cookie de sesión" 401 "$r"

  say "CORS: lista explícita, nunca '*' ni reflejar el Origin"
  allowed=$(curl -s -o /dev/null -D - -X OPTIONS --max-time 15 http://localhost:3025/api/v1/trpc/customer.me -H 'Origin: http://localhost:3023' -H 'Access-Control-Request-Method: GET' | tr -d '\r' | grep -i '^access-control-allow-origin' || true)
  hostile=$(curl -s -o /dev/null -D - -X OPTIONS --max-time 15 http://localhost:3025/api/v1/trpc/customer.me -H 'Origin: https://evil.example' -H 'Access-Control-Request-Method: GET' | tr -d '\r' | grep -i '^access-control-allow-origin' || true)
  [[ "$allowed" == *"http://localhost:3023"* ]] && ok "origen permitido: $allowed" || bad "origen permitido sin cabecera CORS ($allowed)"
  [[ -z "$hostile" ]] && ok "origen hostil: sin Access-Control-Allow-Origin" || bad "origen hostil aceptado: $hostile"

  say "Cabeceras de seguridad (Helmet) y rate limit"
  hdrs=$(curl -s -o /dev/null -D - --max-time 15 http://localhost:3025/health | tr -d '\r')
  echo "$hdrs" | grep -qi '^x-content-type-options: nosniff' && ok "x-content-type-options: nosniff" || bad "falta x-content-type-options"
  echo "$hdrs" | grep -qi '^x-powered-by' && bad "expone x-powered-by" || ok "sin x-powered-by"

  say "Redis real conectado a los backs"
  docker exec "$REDIS" redis-cli ping | grep -q PONG && ok "Redis responde" || bad "Redis no responde"
  sleep 1; keys=$(docker exec "$REDIS" redis-cli --scan --pattern 'health:*' | wc -l)
  [[ "$keys" -ge 1 ]] && ok "sass-back escribió su ping de health en Redis" || bad "no se ve el ping de health en Redis"

  say "Fronts (Next.js standalone)"
  for pair in "sass-front:3021" "dashboard-front:3022" "ecommerce-front:3023"; do
    s=${pair%%:*}; p=${pair##*:}
    c=$(code GET "http://localhost:$p/")
    [[ "$c" =~ ^(200|301|302|307|308)$ ]] && ok "$s responde en / ($c)" || bad "$s devolvió $c en /"
    h=$(curl -s -o /dev/null -D - --max-time 15 "http://localhost:$p/" | tr -d '\r')
    echo "$h" | grep -qi '^x-content-type-options' && ok "$s: cabeceras de seguridad" || bad "$s: sin cabeceras de seguridad"
  done

  say "Usuario no-root y sin secretos en las imágenes"
  for s in "${SERVICES[@]}"; do
    u=$(docker exec "eco-$s" id -u 2>/dev/null)
    [[ "$u" != "0" && -n "$u" ]] && ok "eco-$s corre como uid $u" || bad "eco-$s corre como root"
  done
  for s in sass-back ecommerce-back; do
    docker image inspect "eco/$s:local" --format '{{json .Config.Env}}' | grep -qE 'PRIVATE_KEY|MASTER_KEY|SESSION_SECRET|INTERNAL_API_KEY' \
      && bad "eco/$s:local lleva secretos en ENV" || ok "eco/$s:local sin secretos horneados"
  done

  say "Resultado"
  if [[ $FAILS -eq 0 ]]; then printf '  \033[32mTodo en verde\033[0m\n'; else printf '  \033[31m%d chequeo(s) fallaron\033[0m\n' "$FAILS"; fi
  exit $(( FAILS > 0 ))
}

case "${1:-help}" in
  build)  shift; build "$@"; exit $(( FAILS > 0 )) ;;
  up)     up ;;
  smoke)  smoke ;;
  status) status ;;
  logs)   shift; logs "$@" ;;
  down)   down ;;
  all)    build; [[ $FAILS -eq 0 ]] && { up; smoke; } ;;
  *)      sed -n '2,13p' "$0" ;;
esac
