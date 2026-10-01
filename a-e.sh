#!/usr/bin/env bash
# Audit E — Testing (welver)
set -euo pipefail
BUGS=0; DEBTS=0
BUG()  { echo "  ❌ [$1] $2"; BUGS=$((BUGS+1)); }
DEBT() { echo "  ⚠️  [$1] $2"; DEBTS=$((DEBTS+1)); }
OK()   { echo "  ✅ [$1] $2"; }

BACKENDS="realsass-sass-back realsass-ecommerce-back"

echo "=== Audit E — Testing (welver) ==="
echo ""

# E1 — Domain layer testeable: archivos en domain/ tienen spec
echo "E1 — domain/ con spec tests..."
E1_BUGS=0
for SVC in $BACKENDS; do
  for domain_file in $(find "$SVC/src" -path "*/domain/*.ts" \
    | grep -v "\.spec\.\|\.module\." 2>/dev/null || true); do
    SPEC="${domain_file%.ts}.spec.ts"
    BASENAME=$(basename "$domain_file")
    # Solo verificar archivos con lógica real (errors, entity — no types.ts)
    case "$BASENAME" in
      *.types.ts|index.ts) continue ;;
    esac
    if [[ ! -f "$SPEC" ]]; then
      echo "     → [$SVC] sin spec para domain/: $BASENAME"
      E1_BUGS=$((E1_BUGS+1))
    fi
  done
done
[[ $E1_BUGS -eq 0 ]] && OK "E1" "Todos los archivos de domain/ tienen spec" \
                       || BUG "E1" "$E1_BUGS archivo(s) de domain/ sin spec — testear invariantes sin Prisma"

# E2 — Módulos críticos con service spec
echo "E2 — service.spec.ts en módulos críticos..."
E2_BUGS=0
declare -A CRITICAL_SVCS
CRITICAL_SVCS["realsass-sass-back"]="auth/auth collaborators/collaborators organizations/organizations markets/markets"
CRITICAL_SVCS["realsass-ecommerce-back"]="catalog/catalog orders/orders inventory/inventory customers/customers cart/cart"

for SVC in $BACKENDS; do
  MODS=${CRITICAL_SVCS[$SVC]:-}
  for MOD_PATH in $MODS; do
    SVC_FILE="$SVC/src/$MOD_PATH.service.ts"
    SPEC_FILE="$SVC/src/$MOD_PATH.service.spec.ts"
    SPEC_ALT="$SVC/test/$(basename $MOD_PATH).service.spec.ts"
    [[ ! -f "$SVC_FILE" ]] && continue
    if [[ ! -f "$SPEC_FILE" && ! -f "$SPEC_ALT" ]]; then
      echo "     → [$SVC] sin spec: $(basename $MOD_PATH).service.ts"
      E2_BUGS=$((E2_BUGS+1))
    fi
  done
done
[[ $E2_BUGS -eq 0 ]] && OK "E2" "Módulos críticos tienen service.spec.ts" \
                       || BUG "E2" "$E2_BUGS módulo(s) crítico(s) sin spec"

# E3 — Guards de @real/auth-server con spec
echo "E3 — Guards con spec en @real/auth-server..."
E3_BUGS=0
for GUARD in "tenant.guard" "roles.guard" "firebase-auth.guard"; do
  GUARD_FILE=$(find "packages/auth-server/src" -name "${GUARD}.ts" 2>/dev/null | head -1 || true)
  [[ -z "$GUARD_FILE" ]] && continue
  SPEC_FILE="${GUARD_FILE%.ts}.spec.ts"
  SPEC_ALT="packages/auth-server/test/$(basename $GUARD_FILE .ts).spec.ts"
  if [[ ! -f "$SPEC_FILE" && ! -f "$SPEC_ALT" ]]; then
    echo "     → [@real/auth-server] sin spec: $GUARD"
    E3_BUGS=$((E3_BUGS+1))
  fi
done
[[ $E3_BUGS -eq 0 ]] && OK "E3" "Guards de @real/auth-server tienen spec" \
                       || BUG "E3" "$E3_BUGS guard(s) de @real/auth-server sin spec — cobertura 100% requerida"

# E4 — assertValidOrderTransition spec (máquina de estados de órdenes)
echo "E4 — order.errors.spec.ts (assertValidOrderTransition)..."
ORDER_ERR="realsass-ecommerce-back/src/orders/domain/order.errors.ts"
ORDER_SPEC="realsass-ecommerce-back/src/orders/domain/order.errors.spec.ts"
ORDER_SPEC_ALT="realsass-ecommerce-back/test/order.errors.spec.ts"
if [[ -f "$ORDER_ERR" ]]; then
  if [[ -f "$ORDER_SPEC" || -f "$ORDER_SPEC_ALT" ]]; then
    OK "E4" "order.errors.spec.ts presente — transiciones de orden cubiertas"
  else
    BUG "E4" "order.errors.ts sin spec — assertValidOrderTransition sin cobertura (PENDING→CONFIRMED→PAID→...)"
  fi
fi

# E5 — lib/i18n y lib/seo de real-ecommerce-front con spec (ADR-016: 99 tests)
echo "E5 — lib/i18n y lib/seo de real-ecommerce-front con spec (ADR-016)..."
E5_BUGS=0
for LIB_DIR in "real-ecommerce-front/lib/i18n" "real-ecommerce-front/lib/seo" "real-ecommerce-front/lib/catalog"; do
  [[ ! -d "$LIB_DIR" ]] && continue
  TS_FILES=$(find "$LIB_DIR" -name "*.ts" | grep -v "\.spec\.\|dictionaries\|types\|index" | wc -l | tr -d ' ')
  SPEC_FILES=$(find "$LIB_DIR" -name "*.spec.ts" 2>/dev/null | wc -l | tr -d ' ')
  if [[ $TS_FILES -gt 0 && $SPEC_FILES -eq 0 ]]; then
    echo "     → sin specs en: $LIB_DIR ($TS_FILES archivos)"
    E5_BUGS=$((E5_BUGS+1))
  else
    echo "  ✅ [E5] $LIB_DIR: $SPEC_FILES spec(s) para $TS_FILES archivo(s)"
  fi
done
[[ $E5_BUGS -eq 0 ]] || BUG "E5" "$E5_BUGS directorio(s) de lib/ sin specs — ADR-016 exige 99 tests"

# E6 — resolveCheckoutLocale spec (función pura crítica)
echo "E6 — resolveCheckoutLocale.spec.ts..."
RCL="real-ecommerce-front/lib/checkout/resolve-checkout-locale.ts"
RCL_SPEC="real-ecommerce-front/lib/checkout/resolve-checkout-locale.spec.ts"
if [[ -f "$RCL" ]]; then
  [[ -f "$RCL_SPEC" ]] && OK "E6" "resolveCheckoutLocale.spec.ts presente" \
                          || DEBT "E6" "resolveCheckoutLocale.ts sin spec — función pura crítica para invoice en idioma correcto (ADR-017)"
fi

# E7 — Sin snapshots (frágiles, sin señal)
echo "E7 — Sin snapshots en tests..."
E7=$(find . \
  -not -path "*/node_modules/*" \
  -not -path "*/.next/*" \
  -not -path "*/.git/*" \
  \( -name "*.spec.ts" -o -name "*.test.ts" \) \
  | xargs grep -l "toMatchSnapshot\|toMatchInlineSnapshot" 2>/dev/null || true)
[[ -z "$E7" ]] && OK "E7" "Sin snapshots en tests" \
               || DEBT "E7" "Snapshots detectados — reemplazar con aserciones específicas"

# E8 — Cantidad mínima de specs por backend
echo "E8 — Cantidad mínima de specs por backend..."
E8_BUGS=0
declare -A MIN_SPECS_MAP
MIN_SPECS_MAP["realsass-sass-back"]=5
MIN_SPECS_MAP["realsass-ecommerce-back"]=4

for SVC in $BACKENDS; do
  SPEC_COUNT=$(find "$SVC" -name "*.spec.ts" -not -path "*/node_modules/*" 2>/dev/null | wc -l | tr -d ' ')
  MIN=${MIN_SPECS_MAP[$SVC]:-3}
  if [[ $SPEC_COUNT -lt $MIN ]]; then
    echo "     → [$SVC] solo $SPEC_COUNT spec(s) — mínimo: $MIN"
    E8_BUGS=$((E8_BUGS+1))
  else
    echo "  ✅ [E8] [$SVC] $SPEC_COUNT spec(s) ≥ $MIN"
  fi
done
[[ $E8_BUGS -eq 0 ]] || BUG "E8" "$E8_BUGS backend(s) por debajo del mínimo de specs"

echo ""
echo "────────────────────────────────────────"
if [[ $BUGS -eq 0 && $DEBTS -eq 0 ]]; then echo "  ✅  Sin hallazgos"
elif [[ $BUGS -eq 0 ]]; then echo "  ⚠️   0 bugs — $DEBTS deudas"
else echo "  ❌  $BUGS bug(s) — $DEBTS deuda(s)"; fi
echo "────────────────────────────────────────"
[[ $BUGS -eq 0 ]] && exit 0 || exit 1
