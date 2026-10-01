#!/usr/bin/env bash
# Audit A — Arquitectura (welver)
set -euo pipefail
BUGS=0; DEBTS=0
BUG()  { echo "  ❌ [$1] $2"; BUGS=$((BUGS+1)); }
DEBT() { echo "  ⚠️  [$1] $2"; DEBTS=$((DEBTS+1)); }
OK()   { echo "  ✅ [$1] $2"; }

BACKENDS="realsass-sass-back realsass-ecommerce-back"
FRONTENDS="realsass-sass-front realsass-dashboard-front real-ecommerce-front"

echo "=== Audit A — Arquitectura de capas (welver) ==="
echo ""

# A1 — Domain/Repository: services sin PrismaService directo
echo "A1 — Services usan IRepository (no PrismaService directo)..."
A1_BUGS=0
for SVC in $BACKENDS; do
  for f in $(find "$SVC/src" -name "*.service.ts" \
    | grep -v "prisma.service\|app.service\|store.service\|organizations-client.service\|market-resolver.service" 2>/dev/null || true); do
    [[ ! -f "$f" ]] && continue
    BASENAME=$(basename "$f")
    # Excepciones conocidas y documentadas
    case "$BASENAME" in
      orders.service.ts|inventory.service.ts|activity.service.ts) continue ;;
    esac
    if grep -q "PrismaService\|this\.prisma\." "$f" 2>/dev/null; then
      # Verificar si tiene IRepository — si no, es bug
      if ! grep -q "IRepository\|REPOSITORY\|@Inject.*REPOSITORY\|Repository" "$f" 2>/dev/null; then
        echo "     → [$SVC] PrismaService directo sin IRepository: $BASENAME"
        A1_BUGS=$((A1_BUGS+1))
      fi
    fi
  done
done
[[ $A1_BUGS -eq 0 ]] && OK "A1" "Services usan IRepository — sin PrismaService directo" \
                       || BUG "A1" "$A1_BUGS service(s) con PrismaService directo sin IRepository"

# A2 — tRPC procedures sin lógica de negocio (deben delegar al Service)
echo "A2 — tRPC procedures como thin controllers (sin lógica inline)..."
A2_BUGS=0
for SVC in $BACKENDS; do
  for f in $(find "$SVC/src/trpc/routers" -name "*.router.ts" 2>/dev/null || true); do
    [[ ! -f "$f" ]] && continue
    # Busca lógica inline: if/try/catch más allá de la llamada al service
    LOGIC=$(grep -c "^\s*if\s*(\|^\s*try\s*{\|prisma\.\|findMany\|findFirst\|create(" "$f" 2>/dev/null || echo 0)
    if [[ $LOGIC -gt 2 ]]; then
      echo "     → [$SVC] posible lógica en procedure ($LOGIC líneas): $(basename $f)"
      A2_BUGS=$((A2_BUGS+1))
    fi
  done
done
[[ $A2_BUGS -eq 0 ]] && OK "A2" "tRPC procedures delegan al Service sin lógica inline" \
                       || BUG "A2" "$A2_BUGS router(s) con lógica de negocio en la procedure"

# A3 — @real/auth-server para toda auth — sin firebase-admin reimplementado
echo "A3 — Auth via @real/auth-server, sin reimplementación de firebase-admin..."
A3_BUGS=0
for SVC in $BACKENDS; do
  # Busca import directo de firebase-admin fuera de @real/auth-server
  FB_DIRECT=$(grep -rn "from 'firebase-admin\|require.*firebase-admin" \
    "$SVC/src" --include="*.ts" \
    | grep -v "//.*firebase-admin" 2>/dev/null || true)
  if [[ -n "$FB_DIRECT" ]]; then
    echo "     → [$SVC] firebase-admin importado directamente (usar @real/auth-server):"
    echo "$FB_DIRECT" | head -3 | sed 's/^/        /'
    A3_BUGS=$((A3_BUGS+1))
  fi
done
# Packages: @real/auth-server SÍ puede tener firebase-admin directo
[[ $A3_BUGS -eq 0 ]] && OK "A3" "Auth via @real/auth-server — sin reimplementación de firebase-admin" \
                       || BUG "A3" "$A3_BUGS servicio(s) con firebase-admin directo — usar @real/auth-server"

# A4 — Sin imports cruzados entre sass-back y ecommerce-back
echo "A4 — Sin imports cruzados entre backends..."
A4_BUGS=0
CROSS_SASS=$(grep -rn "realsass-ecommerce-back\|@/.*ecommerce" \
  realsass-sass-back/src --include="*.ts" 2>/dev/null || true)
CROSS_ECO=$(grep -rn "realsass-sass-back\|@/.*sass-back" \
  realsass-ecommerce-back/src --include="*.ts" 2>/dev/null || true)
if [[ -n "$CROSS_SASS" ]]; then
  echo "     → sass-back importa de ecommerce-back"
  echo "$CROSS_SASS" | head -2 | sed 's/^/        /'
  A4_BUGS=$((A4_BUGS+1))
fi
if [[ -n "$CROSS_ECO" ]]; then
  echo "     → ecommerce-back importa de sass-back"
  echo "$CROSS_ECO" | head -2 | sed 's/^/        /'
  A4_BUGS=$((A4_BUGS+1))
fi
[[ $A4_BUGS -eq 0 ]] && OK "A4" "Sin imports cruzados entre sass-back y ecommerce-back" \
                       || BUG "A4" "$A4_BUGS caso(s) de imports cruzados entre backends"

# A5 — Frontends: sin fetch() directo en componentes (usar tRPC hooks)
echo "A5 — Frontends sin fetch() directo en componentes..."
A5_BUGS=0
for FE in $FRONTENDS; do
  DIRECT_FETCH=$(grep -rn "^\s*fetch(\|=\s*fetch(" \
    "$FE/app" "$FE/components" "$FE/features" \
    --include="*.tsx" --include="*.ts" \
    2>/dev/null \
    | grep -v "apiFetch\|api-fetch\|lib/market/api-fetch\|//.*fetch\|'use client'" || true)
  if [[ -n "$DIRECT_FETCH" ]]; then
    COUNT=$(echo "$DIRECT_FETCH" | wc -l | tr -d ' ')
    echo "     → [$FE] $COUNT fetch() directo(s) en componentes"
    echo "$DIRECT_FETCH" | head -2 | sed 's/^/        /'
    A5_BUGS=$((A5_BUGS+1))
  fi
done
[[ $A5_BUGS -eq 0 ]] && OK "A5" "Sin fetch() directo en componentes — todo via tRPC hooks o lib/" \
                       || BUG "A5" "$A5_BUGS frontend(s) con fetch() directo en componentes"

# A6 — tRPC procedures con Zod en todos los inputs
echo "A6 — Zod en todos los inputs de procedures tRPC..."
A6_BUGS=0
for SVC in $BACKENDS; do
  for f in $(find "$SVC/src/trpc/routers" -name "*.router.ts" 2>/dev/null || true); do
    [[ ! -f "$f" ]] && continue
    # Procedures con .input() sin z.
    INPUT_WITHOUT_ZOD=$(grep -n "\.input(" "$f" 2>/dev/null | grep -v "z\." || true)
    if [[ -n "$INPUT_WITHOUT_ZOD" ]]; then
      echo "     → [$SVC] .input() sin z. en $(basename $f):"
      echo "$INPUT_WITHOUT_ZOD" | head -2 | sed 's/^/        /'
      A6_BUGS=$((A6_BUGS+1))
    fi
  done
done
[[ $A6_BUGS -eq 0 ]] && OK "A6" "Todos los inputs tRPC validados con Zod" \
                       || BUG "A6" "$A6_BUGS router(s) con .input() sin Zod"

# A7 — Domain errors tipados (no string throws en domain/)
echo "A7 — Domain errors son clases tipadas (no string throws)..."
A7_DEBTS=0
for SVC in $BACKENDS; do
  for f in $(find "$SVC/src" -path "*/domain/*.ts" 2>/dev/null || true); do
    [[ ! -f "$f" ]] && continue
    if grep -q "throw new Error(['\"]" "$f" 2>/dev/null; then
      echo "     → [$SVC] throw de Error genérico en domain/: $(basename $f)"
      A7_DEBTS=$((A7_DEBTS+1))
    fi
  done
done
[[ $A7_DEBTS -eq 0 ]] && OK "A7" "Domain errors son clases tipadas en domain/" \
                         || DEBT "A7" "$A7_DEBTS archivo(s) de domain/ con Error genérico — usar DomainError tipado"

echo ""
echo "────────────────────────────────────────"
if [[ $BUGS -eq 0 && $DEBTS -eq 0 ]]; then echo "  ✅  Sin hallazgos"
elif [[ $BUGS -eq 0 ]]; then echo "  ⚠️   0 bugs — $DEBTS deudas"
else echo "  ❌  $BUGS bug(s) — $DEBTS deuda(s)"; fi
echo "────────────────────────────────────────"
[[ $BUGS -eq 0 ]] && exit 0 || exit 1
