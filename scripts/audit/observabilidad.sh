#!/usr/bin/env bash
# Audit D — Observabilidad (welver)
set -euo pipefail
BUGS=0; DEBTS=0
BUG()  { echo "  ❌ [$1] $2"; BUGS=$((BUGS+1)); }
DEBT() { echo "  ⚠️  [$1] $2"; DEBTS=$((DEBTS+1)); }
OK()   { echo "  ✅ [$1] $2"; }

BACKENDS="realsass-sass-back realsass-ecommerce-back"
FRONTENDS="real-ecommerce-front realsass-dashboard-front realsass-sass-front"

echo "=== Audit D — Observabilidad (welver) ==="
echo ""

# D1 — /health con Prisma + Redis en backends
echo "D1 — /health con DB y Redis en backends..."
D1_BUGS=0
for SVC in $BACKENDS; do
  HEALTH=$(find "$SVC/src/health" -name "health.controller.ts" 2>/dev/null | head -1 || true)
  [[ -z "$HEALTH" ]] && { BUG "D1" "[$SVC] health.controller.ts no encontrado"; D1_BUGS=$((D1_BUGS+1)); continue; }
  HAS_DB=$(grep -c "prisma\|Prisma\|database\|db\b" "$HEALTH" 2>/dev/null || echo 0)
  HAS_REDIS=$(grep -c "redis\|Redis" "$HEALTH" 2>/dev/null || echo 0)
  if [[ $HAS_DB -eq 0 || $HAS_REDIS -eq 0 ]]; then
    echo "     → [$SVC] /health sin DB($HAS_DB) o Redis($HAS_REDIS)"
    D1_BUGS=$((D1_BUGS+1))
  fi
done
[[ $D1_BUGS -eq 0 ]] && OK "D1" "/health reporta estado de DB y Redis en ambos backends" \
                       || BUG "D1" "$D1_BUGS backend(s) con /health incompleto"

# D2 — nestjs-pino (logging JSON) en backends
echo "D2 — nestjs-pino logging JSON en backends..."
D2_BUGS=0
for SVC in $BACKENDS; do
  MAIN="$SVC/src/main.ts"
  APP_MODULE="$SVC/src/app.module.ts"
  HAS_PINO=0
  [[ -f "$MAIN" ]] && grep -q "pino\|LoggerModule" "$MAIN" 2>/dev/null && HAS_PINO=1
  [[ -f "$APP_MODULE" ]] && grep -q "pino\|LoggerModule" "$APP_MODULE" 2>/dev/null && HAS_PINO=1
  if [[ $HAS_PINO -eq 0 ]]; then
    echo "     → [$SVC] nestjs-pino no detectado"
    D2_BUGS=$((D2_BUGS+1))
  fi
done
[[ $D2_BUGS -eq 0 ]] && OK "D2" "nestjs-pino (logging JSON) activo en backends" \
                       || DEBT "D2" "$D2_BUGS backend(s) sin nestjs-pino"

# D3 — Prometheus /metrics en backends
echo "D3 — Prometheus /metrics en backends..."
D3_BUGS=0
for SVC in $BACKENDS; do
  HAS_METRICS=$(grep -rn "PrometheusModule\|prometheus\|prom-client\|/metrics" \
    "$SVC/src" --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
  if [[ $HAS_METRICS -eq 0 ]]; then
    echo "     → [$SVC] sin /metrics Prometheus"
    D3_BUGS=$((D3_BUGS+1))
  fi
done
[[ $D3_BUGS -eq 0 ]] && OK "D3" "Prometheus /metrics activo en ambos backends" \
                       || BUG "D3" "$D3_BUGS backend(s) sin /metrics"

# D4 — CorrelationIdMiddleware en backends
echo "D4 — CorrelationIdMiddleware (x-correlation-id o x-request-id) en backends..."
D4_BUGS=0
for SVC in $BACKENDS; do
  HAS_CORRID=$(find "$SVC/src" -name "*correlation*" -o -name "*request-id*" 2>/dev/null | wc -l | tr -d ' ')
  HAS_APPLIED=$(grep -rn "CorrelationId\|RequestId\|correlation-id\|request-id" \
    "$SVC/src/app.module.ts" 2>/dev/null | wc -l | tr -d ' ')
  if [[ $HAS_CORRID -eq 0 ]]; then
    echo "     → [$SVC] sin middleware de Correlation ID"
    D4_BUGS=$((D4_BUGS+1))
  elif [[ $HAS_APPLIED -eq 0 ]]; then
    echo "     → [$SVC] CorrelationId middleware existe pero no está en app.module.ts"
    D4_BUGS=$((D4_BUGS+1))
  fi
done
[[ $D4_BUGS -eq 0 ]] && OK "D4" "CorrelationIdMiddleware registrado en ambos backends" \
                       || BUG "D4" "$D4_BUGS backend(s) sin Correlation ID propagado"

# D5 — SITE_URL leído de env en SEO (no hardcodeado)
echo "D5 — SITE_URL desde env en storefront SEO (no hardcodeado)..."
SEO_SITE="real-ecommerce-front/lib/seo/site.ts"
if [[ -f "$SEO_SITE" ]]; then
  if grep -q "process\.env.*SITE_URL\|SITE_URL.*process\.env" "$SEO_SITE" 2>/dev/null; then
    # Verificar que NO está hardcodeado
    HARDCODED_URL=$(grep -n "https://\|http://" "$SEO_SITE" \
      | grep -v "//.*https://\|console\.\|example\." 2>/dev/null || true)
    if [[ -z "$HARDCODED_URL" ]]; then
      OK "D5" "SITE_URL leído de process.env — sin hardcoding de URL base"
    else
      echo "$HARDCODED_URL" | head -2
      DEBT "D5" "Posible URL hardcodeada en lib/seo/site.ts — verificar"
    fi
  else
    BUG "D5" "SITE_URL no leído de process.env en lib/seo/site.ts — canonical/hreflang rotos si falta"
  fi
fi

# D6 — console.log con datos sensibles en frontends (deuda)
echo "D6 — Sin console.log con datos sensibles en frontends..."
D6=$(grep -rn "console\.log\|console\.error" \
  realsass-sass-front realsass-dashboard-front real-ecommerce-front \
  --include="*.ts" --include="*.tsx" \
  | grep -iv "//.*console\|\[v0\]\|adapter\|stub" \
  | grep -i "token\|password\|secret\|key\|uid\|email" 2>/dev/null || true)
[[ -z "$D6" ]] && OK "D6" "Sin console.log con datos sensibles en frontends" \
               || DEBT "D6" "$(echo $D6 | wc -w) console.log con posibles datos sensibles — revisar para prod"

# D7 — /health en ambos backends responde 200 (check básico de existencia)
echo "D7 — /health endpoint existe en ambos backends..."
D7_BUGS=0
for SVC in $BACKENDS; do
  HEALTH_CTRL=$(find "$SVC/src/health" -name "health.controller.ts" 2>/dev/null | head -1 || true)
  HEALTH_MODULE=$(find "$SVC/src/health" -name "health.module.ts" 2>/dev/null | head -1 || true)
  if [[ -z "$HEALTH_CTRL" || -z "$HEALTH_MODULE" ]]; then
    echo "     → [$SVC] health.controller.ts o health.module.ts ausente"
    D7_BUGS=$((D7_BUGS+1))
  fi
done
[[ $D7_BUGS -eq 0 ]] && OK "D7" "health.controller.ts + health.module.ts en ambos backends" \
                       || BUG "D7" "$D7_BUGS backend(s) sin módulo de health completo"

echo ""
echo "────────────────────────────────────────"
if [[ $BUGS -eq 0 && $DEBTS -eq 0 ]]; then echo "  ✅  Sin hallazgos"
elif [[ $BUGS -eq 0 ]]; then echo "  ⚠️   0 bugs — $DEBTS deudas"
else echo "  ❌  $BUGS bug(s) — $DEBTS deuda(s)"; fi
echo "────────────────────────────────────────"
[[ $BUGS -eq 0 ]] && exit 0 || exit 1
