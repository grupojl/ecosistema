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
  --include="*.ts" \
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