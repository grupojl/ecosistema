#!/usr/bin/env bash
# audit-c.sh — Seguridad (welver/ecosistema)
# v3: fix C1 (authProcedure/tenantProcedure/ownerProcedure son válidos en sass-back)
#     fix C4 (organizations repository + affiliate son datos de plataforma, no tenant)
set -euo pipefail

BUGS=0; DEBTS=0
BACKENDS="realsass-sass-back realsass-ecommerce-back"
FRONTENDS="realsass-sass-front realsass-dashboard-front real-ecommerce-front"

BUG()  { echo "  ❌ [$1] $2"; BUGS=$((BUGS+1)); }
DEBT() { echo "  ⚠️  [$1] $2"; DEBTS=$((DEBTS+1)); }
OK()   { echo "  ✅ [$1] $2"; }

echo "=== Audit C — Seguridad (welver) ==="
echo ""

# C1 — tRPC procedures con auth en routers con mutation
# FIX v3: sass-back usa authProcedure / tenantProcedure / ownerProcedure
#         ecommerce-back usa adminProcedure / ownerOnlyProcedure / customerProcedure
#         publicProcedure es válido en routers con mutation para rutas públicas
#         (ej: customer.identify, collaborators.getInvitationInfo)
echo "C1 — Procedures con auth en tRPC routers con mutation..."
C1_BUGS=0
for SVC in $BACKENDS; do
  ROUTERS=$(find "$SVC/src/trpc/routers" -name "*.router.ts" 2>/dev/null || true)
  for f in $ROUTERS; do
    [[ ! -f "$f" ]] && continue
    HAS_MUTATION=$(grep -c "\.mutation(" "$f" 2>/dev/null | tr -d '\r\n' || echo 0)
    # Todos los tipos válidos de procedure en welver:
    HAS_AUTH=$(grep -c \
      "adminProcedure\|ownerOnlyProcedure\|customerProcedure\|authProcedure\|tenantProcedure\|ownerProcedure\|publicProcedure" \
      "$f" 2>/dev/null | tr -d '\r\n' || echo 0)
    if [[ "$HAS_MUTATION" =~ ^[0-9]+$ && "$HAS_AUTH" =~ ^[0-9]+$ ]] \
       && [[ $HAS_MUTATION -gt 0 && $HAS_AUTH -eq 0 ]]; then
      echo "     → [$SVC] router con mutation SIN ninguna procedure: $(basename $f)"
      C1_BUGS=$((C1_BUGS+1))
    fi
  done
done
[[ $C1_BUGS -eq 0 ]] && OK "C1" "Todos los routers tRPC con mutation usan procedure tipada" \
                       || BUG "C1" "$C1_BUGS router(s) con mutation sin ninguna procedure (bug real)"

# C2 — CORS sin wildcard en backends (excluir comentarios)
echo "C2 — CORS sin wildcard en backends..."
C2_BUGS=0
for SVC in $BACKENDS; do
  MAIN="$SVC/src/main.ts"
  [[ ! -f "$MAIN" ]] && { BUG "C2" "[$SVC] main.ts no encontrado"; C2_BUGS=$((C2_BUGS+1)); continue; }
  WILDCARD=$(grep -n "origin.*['\"]\\*['\"]" "$MAIN" \
    | grep -v "^\s*//\|^\s*\*\|//.*origin" || true)
  if [[ -n "$WILDCARD" ]]; then
    echo "     → [$SVC] CORS con origin: '*' en código (no comentario):"
    echo "$WILDCARD" | sed 's/^/        /'
    C2_BUGS=$((C2_BUGS+1))
  fi
done
[[ $C2_BUGS -eq 0 ]] && OK "C2" "CORS sin wildcard — ALLOWED_ORIGINS controlado en ambos backends" \
                       || BUG "C2" "$C2_BUGS backend(s) con CORS wildcard activo"

# C3 — Sin tokens de auth en localStorage
echo "C3 — Sin tokens de auth en localStorage (cookies HttpOnly, ADR-004)..."
C3=$(grep -rn "localStorage.*token\|localStorage.*session\|localStorage.*auth\|sessionStorage.*token" \
  $FRONTENDS \
  --include="*.ts" --include="*.tsx" \
  | grep -v "//.*localStorage\|use-locale-store\|use-market-store\|use-shopping-bag\|visitor-market\|sidebar\|cartId" \
  2>/dev/null || true)
[[ -z "$C3" ]] && OK "C3" "Sin tokens de auth en localStorage — cookies HttpOnly (ADR-004)" \
               || { echo "$C3" | head -5; BUG "C3" "Token de auth en localStorage detectado — viola ADR-004"; }

# C4 — organizationId en queries de negocio (multi-tenant)
# FIX v3: excluir archivos que son lógica de PLATAFORMA (no de tenant):
#   - prisma-organizations.repository.ts → gestiona la tabla Organization en sí
#   - internal-organizations.service.ts  → endpoint de plataforma para ecommerce-back
#   - prisma-internal-organizations.repository.ts → su repositorio (cross-tenant por diseño, InternalApiKeyGuard)
#   - prisma-affiliate.repository.ts     → programa de afiliados es global
#   - store.service.ts                   → resuelve la store pública por slug (sin org scope)
echo "C4 — organizationId en queries Prisma de negocio..."
C4_BUGS=0
for SVC in $BACKENDS; do
  FILES=$(find "$SVC/src" \
    -name "*.service.ts" -o -name "prisma-*.repository.ts" \
    2>/dev/null || true)
  for f in $FILES; do
    [[ ! -f "$f" ]] && continue
    BASENAME=$(basename "$f")
    # Excluir: infraestructura Prisma, health, archivos de plataforma documentados
    case "$BASENAME" in
      prisma.service.ts|health*|activity.service.ts|app.service.ts) continue ;;
      # Lógica de plataforma — organizationId no aplica por diseño
      prisma-organizations.repository.ts) continue ;;
      internal-organizations.service.ts)  continue ;;
      prisma-internal-organizations.repository.ts) continue ;;
      prisma-affiliate.repository.ts)     continue ;;
      store.service.ts)                   continue ;;
      organizations-client.service.ts)    continue ;;
    esac
    HAS_QUERY=$(grep -c "prisma\.\w\+\.\(findMany\|findFirst\|findUnique\|update\|delete\|create\)" \
      "$f" 2>/dev/null | tr -d '\r\n' || echo 0)
    HAS_ORG=$(grep -c "organizationId" "$f" 2>/dev/null | tr -d '\r\n' || echo 0)
    if [[ "$HAS_QUERY" =~ ^[0-9]+$ && "$HAS_ORG" =~ ^[0-9]+$ ]] \
       && [[ $HAS_QUERY -gt 2 && $HAS_ORG -eq 0 ]]; then
      echo "     → [$SVC] queries sin organizationId: $BASENAME"
      C4_BUGS=$((C4_BUGS+1))
    fi
  done
done
[[ $C4_BUGS -eq 0 ]] && OK "C4" "organizationId presente en archivos con queries de negocio" \
                       || BUG "C4" "$C4_BUGS archivo(s) con queries sin organizationId"

# C5 — Sin secretos hardcodeados
echo "C5 — Sin secretos hardcodeados..."
C5=$(grep -rn \
  "FIREBASE_API_KEY\s*=\s*['\"][A-Za-z0-9]\|DATABASE_URL\s*=\s*['\"]postgres\|SECRET\s*=\s*['\"][A-Za-z0-9]" \
  $BACKENDS packages \
  --include="*.ts" --exclude="*.spec.ts" --exclude="*-spec.ts" \
  | grep -v "process\.env\|config\.\|getOrThrow\|\.env\|// \|process\.env\[" \
  2>/dev/null || true)
[[ -z "$C5" ]] && OK "C5" "Sin secretos hardcodeados en código" \
               || { echo "$C5" | head -3; BUG "C5" "Posibles secretos hardcodeados — CRÍTICO"; }

# C6 — JSON-LD via serializeJsonLd() (anti-XSS)
echo "C6 — JSON-LD serializado con serializeJsonLd() (anti-XSS)..."
C6_BUGS=0
RAW_JSONLD=$(grep -rn "JSON\.stringify\|dangerouslySetInnerHTML" \
  real-ecommerce-front/app real-ecommerce-front/components \
  --include="*.tsx" --include="*.ts" \
  | grep -v "serializeJsonLd\|//.*JSON\|json-ld\.ts\|//.*dangerous" \
  2>/dev/null || true)
if [[ -n "$RAW_JSONLD" ]]; then
  echo "$RAW_JSONLD" | head -3
  C6_BUGS=$((C6_BUGS+1))
fi
[[ $C6_BUGS -eq 0 ]] && OK "C6" "JSON-LD usa serializeJsonLd() — XSS de tenant bloqueado" \
                       || BUG "C6" "JSON.stringify/dangerouslySetInnerHTML en storefront — riesgo XSS"

# C7 — Helmet activo en backends
echo "C7 — Helmet activo en backends..."
C7_BUGS=0
for SVC in $BACKENDS; do
  MAIN="$SVC/src/main.ts"
  [[ ! -f "$MAIN" ]] && continue
  grep -q "helmet" "$MAIN" 2>/dev/null \
    || { echo "     → [$SVC] Helmet no encontrado"; C7_BUGS=$((C7_BUGS+1)); }
done
[[ $C7_BUGS -eq 0 ]] && OK "C7" "Helmet activo en ambos backends" \
                       || BUG "C7" "$C7_BUGS backend(s) sin Helmet"

# C8 — @Public() solo en rutas públicas (solo decorador real, no comentarios)
echo "C8 — @Public() solo en rutas públicas..."
PUBLIC_USES=$(grep -rn "^\s*@Public()" \
  $BACKENDS \
  --include="*.ts" \
  | grep -v "//.*@Public\|auth\.\|health\.\|store\.\|webhook\.\|checkout\.\|session\.\|invite\." \
  2>/dev/null || true)
if [[ -z "$PUBLIC_USES" ]]; then
  OK "C8" "@Public() solo en rutas auth/health/store/webhooks/checkout/invite"
else
  COUNT=$(echo "$PUBLIC_USES" | wc -l | tr -d ' \r\n')
  if [[ "$COUNT" =~ ^[0-9]+$ ]] && [[ $COUNT -le 5 ]]; then
    OK "C8" "@Public() en $COUNT ruta(s) — dentro de lo esperado"
    echo "$PUBLIC_USES" | sed 's/^/       /'
  else
    DEBT "C8" "@Public() en $COUNT ruta(s) no esperadas — verificar"
    echo "$PUBLIC_USES" | head -5 | sed 's/^/       /'
  fi
fi

# ── ADR-023 — norte de seguridad ────────────────────────────────────────────
# "Nada que el cliente pueda fabricar es una credencial · todo falla cerrado · todo secreto es rotable"
SRC_EXCL="--include=*.ts --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=generated --exclude=*.spec.ts"

# S1 — La identidad del cliente sale de una sesión firmada, no de un id que mande el cliente
echo "S1 — Sin identidad del cliente tomada de un header sin firma..."
S1=$(grep -rnE $SRC_EXCL "headers\[['\"]x-customer-(id|token)['\"]\]|get\('x-customer-(id|token)'\)" realsass-ecommerce-back/src 2>/dev/null || true)
[[ -z "$S1" ]] && OK "S1" "El customerId sale de la cookie HttpOnly firmada, no de un header que arma el cliente" \
               || { BUG "S1" "se lee x-customer-id como credencial:"; echo "$S1" | head -3 | sed 's/^/        /'; }

# S2 — CORS cerrado: nunca reflejar el Origin ni usar comodín con credenciales
echo "S2 — CORS sin 'origin: true' ni comodín..."
S2=$(grep -rnE "origin:\s*(true|'\*'|\"\*\")" $SRC_EXCL realsass-sass-back/src realsass-ecommerce-back/src 2>/dev/null || true)
[[ -z "$S2" ]] && OK "S2" "CORS con lista explícita (parseAllowedOrigins), sin reflejar el Origin" \
               || { BUG "S2" "CORS abierto:"; echo "$S2" | head -3 | sed 's/^/        /'; }

# S3 — Claves de servicio: comparación en tiempo constante y nunca una clave vacía
echo "S3 — Claves de servicio con matchesAnyKey/firstKey (sin !== ni ?? '')..."
S3=$(grep -rnE "(apiKey|key|provided)\s*[!=]==?\s*(validKey|expected)|INTERNAL_API_KEY'\]\s*\?\?\s*''" $SRC_EXCL realsass-sass-back/src realsass-ecommerce-back/src packages/auth-server/src 2>/dev/null || true)
[[ -z "$S3" ]] && OK "S3" "Comparación en tiempo constante y sin fallback a clave vacía" \
               || { BUG "S3" "comparación insegura o clave vacía:"; echo "$S3" | head -3 | sed 's/^/        /'; }

# S4 — /trpc con rate limit (los guards de Nest no cubren los middlewares de Express)
echo "S4 — Rate limit en el middleware tRPC de ambos backs..."
S4_BAD=0
for SVC in $BACKENDS; do
  grep -q "createRateLimitMiddleware" "$SVC/src/trpc/trpc.module.ts" 2>/dev/null || { echo "     → $SVC: /trpc sin rate limit"; S4_BAD=$((S4_BAD+1)); }
done
[[ $S4_BAD -eq 0 ]] && OK "S4" "/trpc con rate limit por IP y por usuario en ambos backs" || BUG "S4" "$S4_BAD back(s) con /trpc sin rate limit"

# S5 — Todo servicio falla cerrado al arrancar (env obligatorio) y confía en el proxy bien configurado
echo "S5 — main.ts exige su configuración de seguridad y define trust proxy..."
S5_BAD=0
for SVC in $BACKENDS; do
  for needle in "parseAllowedOrigins" "requireEnv('INTERNAL_API_KEY'" "trustProxyHops"; do
    grep -q "$needle" "$SVC/src/main.ts" 2>/dev/null || { echo "     → $SVC/src/main.ts no usa $needle"; S5_BAD=$((S5_BAD+1)); }
  done
done
grep -q "requireEnv('CUSTOMER_SESSION_SECRET'" realsass-ecommerce-back/src/main.ts 2>/dev/null || { echo "     → ecommerce-back no exige CUSTOMER_SESSION_SECRET"; S5_BAD=$((S5_BAD+1)); }
[[ $S5_BAD -eq 0 ]] && OK "S5" "Los backs no arrancan sin ALLOWED_ORIGINS, INTERNAL_API_KEY ni CUSTOMER_SESSION_SECRET" || BUG "S5" "$S5_BAD requisito(s) de arranque sin verificar"

# S6 — Toda llamada entre servicios tiene timeout
echo "S6 — fetch entre servicios con timeout..."
S6_BAD=0
for f in $(grep -rlE "\bfetch\(" $SRC_EXCL realsass-sass-back/src realsass-ecommerce-back/src packages/auth-server/src 2>/dev/null || true); do
  grep -qE "AbortSignal\.timeout|AbortController" "$f" || { echo "     → sin timeout: $f"; S6_BAD=$((S6_BAD+1)); }
done
[[ $S6_BAD -eq 0 ]] && OK "S6" "Toda llamada fetch entre servicios tiene timeout" || BUG "S6" "$S6_BAD archivo(s) con fetch sin timeout"

# S7 — Los invariantes de seguridad están cubiertos por tests (se ejecutan en el CI: job "tests")
echo "S7 — Tests de los invariantes de seguridad presentes..."
S7_BAD=0
for spec in \
  packages/auth-server/src/security/__tests__/keys.spec.ts \
  packages/auth-server/src/security/__tests__/require-env.spec.ts \
  packages/auth-server/src/http/__tests__/circuit-breaker.spec.ts \
  packages/auth-server/src/http/__tests__/rate-limit.spec.ts \
  packages/auth-server/src/guards/tenant.guard.spec.ts \
  packages/auth-server/src/guards/roles.guard.spec.ts \
  packages/auth-server/src/guards/firebase-auth.guard.spec.ts \
  realsass-ecommerce-back/src/customers/customer-session.service.spec.ts \
  realsass-ecommerce-back/src/trpc/__tests__/storefront-session.integration.spec.ts \
  realsass-ecommerce-back/src/trpc/__tests__/trpc-mount.integration.spec.ts \
  realsass-ecommerce-back/src/organizations-client/organizations-client.service.spec.ts \
  realsass-sass-back/src/common/guards/api-key.guard.spec.ts \
  realsass-sass-back/src/common/security/assert-public-url.spec.ts \
  realsass-sass-back/src/config-webhooks/webhook-delivery.processor.spec.ts \
  realsass-sass-back/src/config-secrets/crypto.service.spec.ts \
  realsass-sass-back/src/prisma/tenant-context.spec.ts \
  realsass-ecommerce-back/src/prisma/tenant-context.spec.ts \
  realsass-sass-back/src/__tests__/integration/rls.int-spec.ts \
  realsass-ecommerce-back/src/__tests__/integration/rls.int-spec.ts \
  realsass-sass-back/src/markets/__tests__/markets.integration.spec.ts; do
  [[ -f "$spec" ]] || { echo "     → falta el test: $spec"; S7_BAD=$((S7_BAD+1)); }
done
[[ $S7_BAD -eq 0 ]] && OK "S7" "Sesión firmada, claves, rate limit, breaker, guards, SSRF y firma de webhooks tienen tests" \
                    || BUG "S7" "$S7_BAD test(s) de seguridad ausentes"

# ── ADR-027 — aislamiento por fila en la base (Row Level Security) ───────────

# S8 — runAsSystem() es la única puerta que ve todas las organizaciones: solo desde archivos autorizados
echo "S8 — runAsSystem() solo desde archivos autorizados (ADR-027)..."
S8_ALLOWED="src/prisma/tenant-context.ts src/config-webhooks/webhook-delivery.processor.ts"
S8_BAD=0
for SVC in $BACKENDS; do
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    rel="${f#"$SVC"/}"
    case " $S8_ALLOWED " in *" $rel "*) continue ;; esac
    echo "     → [$SVC] runAsSystem() fuera de la lista: $rel"
    S8_BAD=$((S8_BAD+1))
  done < <(grep -rln "runAsSystem(" "$SVC/src" --include="*.ts" 2>/dev/null \
            | grep -v "\.spec\.ts$\|\.int-spec\.ts$\|/generated/" || true)
done
[[ $S8_BAD -eq 0 ]] && OK "S8" "runAsSystem() solo en archivos autorizados ($S8_ALLOWED)" \
                    || BUG "S8" "$S8_BAD uso(s) de runAsSystem() fuera de la lista: ver ADR-027 antes de ampliarla"

# S9 — El código que fija el tenant en la sesión es idéntico en ambos backs y el PrismaService lo usa
echo "S9 — tenant-context / tenant-aware-pool idénticos y en uso..."
S9_BAD=0
for f in tenant-context.ts tenant-aware-pool.ts; do
  if ! cmp -s "realsass-sass-back/src/prisma/$f" "realsass-ecommerce-back/src/prisma/$f"; then
    echo "     → $f difiere entre sass-back y ecommerce-back (es código de seguridad: tiene que ser idéntico)"
    S9_BAD=$((S9_BAD+1))
  fi
done
for SVC in $BACKENDS; do
  grep -q "new TenantAwarePool(" "$SVC/src/prisma/prisma.service.ts" \
    || { echo "     → [$SVC] PrismaService no usa TenantAwarePool: RLS no recibe el tenant"; S9_BAD=$((S9_BAD+1)); }
  grep -q "assertRlsEffective" "$SVC/src/prisma/prisma.service.ts" \
    || { echo "     → [$SVC] PrismaService no verifica el rol de la base al arrancar"; S9_BAD=$((S9_BAD+1)); }
  grep -q "withTenantScope" "$SVC/src/trpc/trpc.ts" \
    || { echo "     → [$SVC] trpc.ts no abre el alcance de tenant en los procedures autenticados"; S9_BAD=$((S9_BAD+1)); }
  ls "$SVC"/prisma/migrations/*row_level_security*/migration.sql >/dev/null 2>&1 \
    || { echo "     → [$SVC] falta la migración de Row Level Security"; S9_BAD=$((S9_BAD+1)); }
done
[[ $S9_BAD -eq 0 ]] && OK "S9" "RLS cableado en ambos backs: pool, alcance en tRPC, chequeo de rol y migración" \
                    || BUG "S9" "$S9_BAD problema(s) en el cableado de Row Level Security"

# S10 — Toda mutación tRPC sin sesión está en una lista explícita (un publicProcedure.mutation es una decisión)
echo "S10 — Mutaciones tRPC públicas solo las de la lista..."
if S10_OUT=$(node scripts/audit/public-mutations.cjs 2>&1); then
  OK "S10" "Las mutaciones sin sesión son solo las de scripts/audit/public-mutations.allowlist"
else
  echo "$S10_OUT"
  BUG "S10" "mutación(es) pública(s) fuera de la lista (¿falta tenantProcedure/ownerProcedure?)"
fi

echo ""
echo "────────────────────────────────────────"
if [[ $BUGS -eq 0 && $DEBTS -eq 0 ]]; then
  echo "  ✅  Sin hallazgos"
elif [[ $BUGS -eq 0 ]]; then
  echo "  ⚠️   0 bugs — $DEBTS deudas documentadas"
else
  echo "  ❌  $BUGS bug(s) bloqueante(s) — $DEBTS deuda(s)"
fi
echo "────────────────────────────────────────"
[[ $BUGS -eq 0 ]] && exit 0 || exit 1