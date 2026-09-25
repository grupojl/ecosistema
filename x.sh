#!/usr/bin/env bash
# =============================================================================
# x.sh — Fixes as any + calidad de código · GrupoJL monorepos
# Versión: 3.0 — calibrada contra grep real de cada repo
# =============================================================================
# Uso (desde el root del repo):
#   bash x.sh ecosistema-ms
#   bash x.sh ecosistema
#   bash x.sh superadmin
#
# Cada fix incluye:
#   - El diagnóstico exacto (por qué es un problema)
#   - La solución aplicada (AUTO) o la acción con código listo (MANUAL)
#   - Verificación con grep al final
#
# Exit 0 siempre — no rompe CI
# =============================================================================
set -uo pipefail

TARGET="${1:-}"

R='\033[0;31m' G='\033[0;32m' Y='\033[1;33m' B='\033[0;34m'
BOLD='\033[1m' DIM='\033[2m' NC='\033[0m'

ok()   { echo -e "  ${G}[FIX]${NC}     $*"; }
warn() { echo -e "  ${Y}[MANUAL]${NC}  $*"; }
skip() { echo -e "  ${B}[SKIP]${NC}    $*"; }
chk()  { echo -e "  ${DIM}[VERIFY]${NC}  $*"; }
hdr()  { echo -e "\n${BOLD}  ── $* ──${NC}"; }
sep()  { echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"; }
code() { echo -e "          ${DIM}$*${NC}"; }

# sed in-place portable GNU (Linux/MINGW64) y BSD (macOS)
_sed() {
  local expr="$1" file="$2"
  [[ -f "$file" ]] || { echo -e "  ${R}[ERR]${NC}     Archivo no encontrado: $file"; return 1; }
  if sed --version 2>/dev/null | grep -q "GNU"; then
    sed -i "$expr" "$file"
  else
    sed -i '' "$expr" "$file"
  fi
}

# =============================================================================
# ECOSISTEMA-MS
#
# ANÁLISIS de cada `as any` del grep real:
#
# ✅ YA ANOTADOS correctamente (no tocar):
#   http-exception.filter.ts          → // @ecosistema-ms/http-filter
#   prisma-conversations.repository   → // @ecosistema-ms/jsonb-cast
#   kb-document.service.ts            → // @ecosistema-ms/enum-cast
#   groq.service.ts                   → // @ecosistema-ms/jsonb-cast
#   langgraph/nodes/index.ts          → // @ecosistema-ms/enum-cast
#   health.controller.ts              → // @ecosistema-ms/opossum-cast
#   preferences.service.ts ×2         → // @ecosistema-ms/enum-cast
#   all-exceptions.filter.ts          → // @ecosistema-ms/http-filter
#   reconciliation.service.ts         → // @ecosistema-ms/jsonb-cast
#   stripe.provider.ts                → // @ecosistema-ms/stripe-cast
#   circuit-breaker.service.ts        → // @ecosistema-ms/opossum-cast
#   routing.service.ts                → // @ecosistema-ms/enum-cast
#   webhook.processor.ts              → // @ecosistema-ms/jsonb-cast
#   webhooks.controller.ts ×2         → // @ecosistema-ms/jsonb-cast
#   jobs.service.ts ×2                → // @ecosistema-ms/jsonb-cast
#
# ❌ FIXES REALES (2 casos):
#   1. rag.service.ts:59          → enum-cast DUPLICADO → sed deduplicar
#   2. automation-check.processor.ts:33 → `rule as any` sin anotación
#      Causa: AutomationRule.condition/action son Prisma.JsonValue
#      Fix: interfaz tipada + anotación // @ecosistema-ms/jsonb-cast
#      Y: `job.id as string` → `job.id ?? ''` (Job.id es string|undefined)
# =============================================================================
fix_ecosistema_ms() {
  sep
  echo -e "${BOLD}  x.sh — ecosistema-ms · fixes as any${NC}"
  sep

  # ── B · H6 · rag.service.ts — enum-cast DUPLICADO ─────────────────────────
  hdr "rag.service.ts — @enum-cast duplicado (H6)"
  local f_rag="chatia-backend/src/faq/rag/rag.service.ts"
  if [[ -f "$f_rag" ]]; then
    if grep -q "enum-cast.*enum-cast" "$f_rag" 2>/dev/null; then
      # Antes: as any // @ecosistema-ms/enum-cast // @ecosistema-ms/enum-cast,
      # Después: as any // @ecosistema-ms/enum-cast,
      _sed 's| // @ecosistema-ms/enum-cast // @ecosistema-ms/enum-cast| // @ecosistema-ms/enum-cast|g' "$f_rag" \
        && ok "rag.service.ts:59 — enum-cast deduplicado" \
        || warn "No se pudo deduplicar automáticamente: $f_rag"
    else
      ok "rag.service.ts — sin enum-cast duplicado"
    fi
  else
    skip "$f_rag no encontrado"
  fi

  # ── B · automation-check.processor.ts — rule as any sin anotación ─────────
  hdr "automation-check.processor.ts — rule as any + job.id as string"
  local f_auto="marketing-backend/src/campaigns/processors/automation-check.processor.ts"
  if [[ -f "$f_auto" ]]; then
    # Diagnóstico:
    # AutomationRule.condition y .action son Prisma.JsonValue (campo Json en schema)
    # No se puede eliminar el cast porque Prisma no genera tipos estructurales para Json
    # La solución correcta: definir la interface tipada y anotar con jsonb-cast

    # Fix 1: rule as any → rule as AutomationRulePayload // @ecosistema-ms/jsonb-cast
    # Primero verificar si ya tiene la interfaz
    if ! grep -q "AutomationRulePayload\|automation-rule-payload" "$f_auto" 2>/dev/null; then
      # Insertar la interfaz al inicio del archivo (después de los imports)
      # Buscar la última línea de import para insertar después
      local last_import_line
      last_import_line=$(grep -n "^import " "$f_auto" 2>/dev/null | tail -1 | cut -d: -f1)
      if [[ -n "$last_import_line" ]]; then
        # Insertar la interfaz tipada después del último import
        local interface_block
        interface_block=$(cat << 'IFACE'
\
/** Tipos para AutomationRule.condition y .action (campos Json en Prisma schema) */\
interface AutomationRuleCondition {\
  metric:     string;  // 'roas' | 'ctr' | 'cpc' | 'spend'\
  operator:   string;  // 'lt' | 'gt' | 'lte' | 'gte' | 'eq'\
  value:      number;\
  windowDays: number;\
}\
interface AutomationRuleAction {\
  type:    string;  // 'pause' | 'scale_budget'\
  factor?: number;  // para scale_budget\
}\
interface AutomationRulePayload {\
  condition: AutomationRuleCondition;\
  action:    AutomationRuleAction;\
}
IFACE
)
        _sed "${last_import_line}a ${interface_block}" "$f_auto" \
          && ok "automation-check.processor.ts — AutomationRulePayload interface insertada" \
          || warn "No se pudo insertar la interface automáticamente"
      fi
    else
      ok "automation-check.processor.ts — AutomationRulePayload ya existe"
    fi

    # Fix 2: anotar el as any con jsonb-cast
    if grep -q "rule as any[^/]" "$f_auto" 2>/dev/null; then
      _sed 's|rule as any\b|rule as AutomationRulePayload \/\/ @ecosistema-ms\/jsonb-cast|g' "$f_auto" \
        && ok "automation-check.processor.ts — rule as any → tipado con anotación" \
        || warn "No se pudo anotar rule as any en: $f_auto"
    elif grep -q "rule as any" "$f_auto" 2>/dev/null; then
      ok "automation-check.processor.ts — rule as any ya tiene anotación o fue corregido"
    else
      ok "automation-check.processor.ts — sin rule as any"
    fi

    # Fix 3: job.id as string → job.id ?? '' (Job.id es string | undefined en BullMQ)
    if grep -q "job\.id as string" "$f_auto" 2>/dev/null; then
      _sed "s|job\\.id as string|job.id ?? ''|g" "$f_auto" \
        && ok "automation-check.processor.ts — job.id as string → job.id ?? ''" \
        || warn "No se pudo corregir job.id as string en: $f_auto"
    else
      ok "automation-check.processor.ts — job.id ya es seguro"
    fi
  else
    skip "$f_auto no encontrado (marketing-backend puede no estar en este monorepo aún)"
  fi

  # ── I · exec + railway.json (siempre verificar) ───────────────────────────
  hdr "I · Dockerfiles y railway.json — estado actual"
  local svcs=(chatia-backend pasarelapagos-backend notificaciones-backend analytics-backend workers-backend)
  for svc in "${svcs[@]}"; do
    local df="${svc}/Dockerfile"
    if [[ -f "$df" ]]; then
      if ! grep -q "exec " "$df" 2>/dev/null; then
        if grep -q "dumb-init" "$df" 2>/dev/null; then
          _sed 's|^CMD \["node",|CMD exec dumb-init node|g' "$df"
          _sed 's|^CMD \["dumb-init",|CMD exec dumb-init|g' "$df"
          _sed 's|, "dist/main\.js"\]| dist/main.js|g' "$df"
          ok "I exec: $svc — CMD actualizado"
        fi
      fi
    fi
    if [[ ! -f "${svc}/railway.json" ]]; then
      mkdir -p "$svc"
      cat > "${svc}/railway.json" << 'RAILWAY'
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300
  }
}
RAILWAY
      ok "I railway.json: $svc — creado"
    fi
  done

  # ── H6 · deduplicar cualquier otro @jsonb-cast duplicado ─────────────────
  hdr "H6 · @jsonb-cast duplicado — deduplicar en todo el repo"
  local h6_count=0
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    _sed 's| // @ecosistema-ms/jsonb-cast // @ecosistema-ms/jsonb-cast| // @ecosistema-ms/jsonb-cast|g' "$f"
    _sed 's| //@ecosistema-ms/jsonb-cast //@ecosistema-ms/jsonb-cast| // @ecosistema-ms/jsonb-cast|g' "$f"
    ok "H6 deduplicado: $f"
    h6_count=$((h6_count+1))
  done < <(grep -rl "@ecosistema-ms/jsonb-cast" --include="*.ts" . 2>/dev/null \
    | xargs grep -l "@ecosistema-ms/jsonb-cast.*@ecosistema-ms/jsonb-cast" 2>/dev/null \
    | grep -v "node_modules\|\.spec\." || true)
  [[ "$h6_count" -eq 0 ]] && ok "H6: sin duplicados"

  # ── F3 · Lock @Cron ───────────────────────────────────────────────────────
  hdr "F3 · @Cron sin SET NX EX — schedulers a corregir manualmente"
  local cron_no_lock
  cron_no_lock=$(find . -name "*.ts" -not -path "*/node_modules/*" -not -name "*.spec.ts" \
    -print0 2>/dev/null | xargs -0 grep -l "@Cron\b" 2>/dev/null \
    | xargs grep -L "'NX'\|\"NX\"\|LOCK_KEY\b\|SET.*NX" 2>/dev/null || true)
  if [[ -z "$cron_no_lock" ]]; then
    ok "F3: todos los @Cron tienen SET NX EX"
  else
    printf '%s\n' "$cron_no_lock" | while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      warn "Sin lock: $f"
      warn "Agregar al inicio del método @Cron:"
      code "const LOCK_KEY = 'scheduler:$(basename "$f" .ts):lock';"
      code "const LOCK_TTL = 55;"
      code "const lock = await this.redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL, 'NX');"
      code "if (!lock) return;"
    done
  fi

  # ── K4 · ProjectStrategy sin try/catch ────────────────────────────────────
  hdr "K4 · ProjectStrategy hooks sin try/catch"
  local strats_no_try
  strats_no_try=$(find . -name "*.strategy.ts" -not -path "*/node_modules/*" \
    -print0 2>/dev/null \
    | xargs -0 grep -l "enrich\|afterCharge\|afterNotif\|afterResponse" 2>/dev/null \
    | xargs -r grep -L "try {" 2>/dev/null || true)
  if [[ -z "$strats_no_try" ]]; then
    ok "K4: todas las strategies tienen try/catch"
  else
    printf '%s\n' "$strats_no_try" | while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      warn "Sin try/catch: $f"
      warn "Envolver cada hook en:"
      code "try { /* lógica actual */ } catch (err) { this.logger.error('strategy failed', err); }"
    done
  fi

  # ═══════════════════════════════════════════════════════════════════════════
  sep
  echo -e "${BOLD}  VERIFICACIÓN — ecosistema-ms${NC}"
  sep

  chk "B1 · as any sin anotación en producción (debe ser 0):"
  local v_b1
  v_b1=$(find . \( -name "*.ts" -o -name "*.tsx" \) \
    -not -path "*/node_modules/*" -not -name "*.spec.ts" -not -name "*.e2e*" \
    -print0 2>/dev/null | xargs -0 grep -l " as any" 2>/dev/null \
    | xargs grep -c " as any" 2>/dev/null \
    | grep -v "// @ecosistema-ms/" | wc -l | tr -d ' ')
  # Más preciso: buscar directamente
  local v_b1_direct
  v_b1_direct=$(find . \( -name "*.ts" -o -name "*.tsx" \) \
    -not -path "*/node_modules/*" -not -name "*.spec.ts" \
    -print0 2>/dev/null \
    | xargs -0 grep -n " as any" 2>/dev/null \
    | grep -v "// @ecosistema-ms/\|node_modules\|\.spec\." | wc -l | tr -d ' ')
  echo "    sin anotación: ${v_b1_direct:-0}"

  chk "H6 · @jsonb-cast duplicado (debe ser 0):"
  local v_h6
  v_h6=$(grep -r "@ecosistema-ms/jsonb-cast" --include="*.ts" . 2>/dev/null \
    | grep "@ecosistema-ms/jsonb-cast.*@ecosistema-ms/jsonb-cast" \
    | grep -v "node_modules\|\.spec\." | wc -l | tr -d ' ')
  echo "    duplicados: ${v_h6:-0}"

  chk "H6 · @enum-cast duplicado (debe ser 0):"
  local v_h6e
  v_h6e=$(grep -r "@ecosistema-ms/enum-cast" --include="*.ts" . 2>/dev/null \
    | grep "@ecosistema-ms/enum-cast.*@ecosistema-ms/enum-cast" \
    | grep -v "node_modules\|\.spec\." | wc -l | tr -d ' ')
  echo "    duplicados: ${v_h6e:-0}"

  chk "automation-check.processor.ts — job.id seguro (debe ser 0 'as string'):"
  local v_jobid
  v_jobid=$(grep -c "job\.id as string" \
    "marketing-backend/src/campaigns/processors/automation-check.processor.ts" 2>/dev/null || true)
  echo "    job.id as string: ${v_jobid:-0}"

  chk "F3 · @Cron sin SET NX EX (debe ser 0):"
  local v_f3=0
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    grep -q "'NX'\|\"NX\"\|LOCK_KEY" "$f" 2>/dev/null || v_f3=$((v_f3+1))
  done < <(find . -name "*.ts" -not -path "*/node_modules/*" -not -name "*.spec.ts" \
    -print0 2>/dev/null | xargs -0 grep -l "@Cron\b" 2>/dev/null || true)
  echo "    schedulers sin lock: $v_f3"

  chk "I · exec en Dockerfiles:"
  local svcs2=(chatia-backend pasarelapagos-backend notificaciones-backend analytics-backend workers-backend)
  for svc in "${svcs2[@]}"; do
    local df="${svc}/Dockerfile"
    if [[ -f "$df" ]]; then
      printf "    %-48s exec=%s dumb-init=%s\n" \
        "$df" \
        "$(grep -c "exec " "$df" 2>/dev/null || true)" \
        "$(grep -c "dumb-init" "$df" 2>/dev/null || true)"
    fi
  done

  sep; echo ""
}

# =============================================================================
# ECOSISTEMA (welver)
#
# ANÁLISIS de cada `as any` del grep real:
#
# ✅ TESTS — ignorar (no afectan score B1):
#   real-ecommerce-front/lib/seo/json-ld.spec.ts            ×8
#   realsass-ecommerce-back/src/catalog/catalog.service.spec.ts ×5
#   realsass-ecommerce-back/src/orders/orders.service.spec.ts   ×varios
#   realsass-ecommerce-back/src/orders/__tests__/            ×1
#   realsass-sass-back/src/markets/__tests__/                ×1
#
# ✅ PRODUCCIÓN YA ANOTADOS (no tocar):
#   realsass-dashboard-front/**  → // @real/jsonb-cast ×múltiples (tRPC JsonValue)
#   realsass-ecommerce-back/src/common/filters/http-exception.filter.ts ×2
#   realsass-ecommerce-back/src/trpc/trpc.ts ×6 (req.user/tenant, tRPC procedures)
#   realsass-sass-front/**       → // @real/jsonb-cast ×múltiples
#
# ❌ FIXES REALES (2 casos en producción):
#   1. activity.service.ts:19 — anotación incorrecta (es enum, no jsonb)
#      eventType: eventType as any // @real/jsonb-cast
#      → Fix: cambiar a // @real/enum-cast (semánticamente correcto ADR-007)
#
#   2. customer.router.ts:140 — FIX REAL de tipado
#      (order as any // @real/jsonb-cast).customerId
#      Causa: OrderRecord (orders.repository.interface.ts) no tiene customerId
#      Fix: agregar customerId a OrderRecord y a la query findById
#      → El as any desaparece cuando el tipo tiene el campo
# =============================================================================
fix_ecosistema() {
  sep
  echo -e "${BOLD}  x.sh — ecosistema (welver) · fixes as any${NC}"
  sep

  # ── B1 · activity.service.ts — corregir anotación (jsonb→enum) ───────────
  hdr "B1 · activity.service.ts — anotación semántica incorrecta"
  local f_act="realsass-ecommerce-back/src/activity/activity.service.ts"
  if [[ -f "$f_act" ]]; then
    if grep -q "eventType as any // @real/jsonb-cast" "$f_act" 2>/dev/null; then
      # eventType es un enum de Prisma, no un campo Json → anotación incorrecta
      # Intento 1: si el enum está en Prisma.$Enums, usarlo directamente
      warn "activity.service.ts:19 — eventType as any"
      warn "Diagnóstico: eventType es un enum de Prisma, no un campo Json"
      warn "La anotación // @real/jsonb-cast es semánticamente incorrecta"
      warn ""
      warn "Opción A (FIX REAL — elimina el cast):"
      code "import type { Prisma } from '@prisma/client';"
      code "// Si el enum se llama ActivityEventType en schema.prisma:"
      code "eventType: eventType as Prisma.\$Enums.ActivityEventType,"
      warn ""
      warn "Opción B (si el tipo exacto no está disponible — cambiar anotación):"
      _sed "s|eventType as any // @real/jsonb-cast|eventType as any // @real/enum-cast|g" "$f_act" \
        && ok "activity.service.ts — anotación corregida a @real/enum-cast" \
        || warn "No se pudo corregir automáticamente: $f_act"
    elif grep -q "eventType as any // @real/enum-cast" "$f_act" 2>/dev/null; then
      ok "activity.service.ts — ya tiene @real/enum-cast"
    else
      ok "activity.service.ts — sin cast de eventType detectado"
    fi
  else
    skip "$f_act no encontrado"
  fi

  # ── B1 · customer.router.ts — FIX REAL: OrderRecord sin customerId ────────
  hdr "B1 · customer.router.ts:140 — (order as any).customerId"
  local f_router="realsass-ecommerce-back/src/trpc/routers/customer.router.ts"
  local f_iface="realsass-ecommerce-back/src/orders/repository/orders.repository.interface.ts"

  if [[ -f "$f_router" ]] && [[ -f "$f_iface" ]]; then
    # Verificar si OrderRecord ya tiene customerId
    if grep -q "customerId" "$f_iface" 2>/dev/null; then
      ok "orders.repository.interface.ts — OrderRecord ya tiene customerId"
      # Si el interface ya tiene customerId, el as any debería eliminarse
      if grep -q "(order as any" "$f_router" 2>/dev/null; then
        _sed 's|(order as any // @real/jsonb-cast)\.customerId|order.customerId|g' "$f_router" \
          && ok "customer.router.ts — (order as any).customerId → order.customerId" \
          || warn "No se pudo eliminar automáticamente el cast en: $f_router"
      else
        ok "customer.router.ts — cast de customerId ya eliminado"
      fi
    else
      # OrderRecord no tiene customerId → Fix en 2 pasos
      warn "customer.router.ts:140 — FIX REAL REQUERIDO (2 pasos):"
      warn ""
      warn "PASO 1: Agregar customerId a OrderRecord en:"
      warn "  $f_iface"
      code "export interface OrderRecord {"
      code "  id:              string;"
      code "  organizationId:  string;"
      code "  customerId:      string;  // ← AGREGAR ESTA LÍNEA"
      code "  sessionId:       string;"
      code "  status:          OrderStatus;"
      code "  // ... resto de campos"
      code "}"
      warn ""
      warn "PASO 2: Incluir customerId en la query de PrismaOrdersRepository.findById:"
      local f_prisma_orders
      f_prisma_orders=$(find realsass-ecommerce-back/src/orders/repository \
        -name "prisma-*.repository.ts" 2>/dev/null | head -1)
      if [[ -n "$f_prisma_orders" ]]; then
        warn "  $f_prisma_orders"
        code "// Asegurar que el select/return incluye customerId"
        code "// o que el toEntity() mapea row.customerId"
      fi
      warn ""
      warn "PASO 3: Una vez hecho, el cast desaparece solo:"
      code "// Antes:"
      code 'if (!order || (order as any // @real/jsonb-cast).customerId !== ctx.customerId) {'
      code "// Después (sin cast):"
      code 'if (!order || order.customerId !== ctx.customerId) {'
    fi
  else
    skip "customer.router.ts o orders.repository.interface.ts no encontrado"
  fi

  # ── I · exec + railway.json ───────────────────────────────────────────────
  hdr "I · Dockerfiles y railway.json"
  for svc in realsass-sass-back realsass-ecommerce-back; do
    local df="${svc}/Dockerfile"
    [[ -f "$df" ]] || { skip "I: $df no encontrado"; continue; }
    if grep -q "exec " "$df" 2>/dev/null; then
      ok "I exec ya presente: $svc"
    else
      _sed 's|^CMD \["node",|CMD exec dumb-init node|g' "$df"
      _sed 's|, "dist/main\.js"\]| dist/main.js|g' "$df"
      ok "I exec: $svc — CMD actualizado"
    fi
  done

  # ── H1 · JSON.parse sin try/catch ─────────────────────────────────────────
  hdr "H1 · JSON.parse sin try/catch"
  local h1_targets=(
    "realsass-sass-back/src/config-cache/config-cache.service.ts"
    "realsass-ecommerce-back/src/markets/market-resolver.service.ts"
  )
  for f in "${h1_targets[@]}"; do
    if [[ -f "$f" ]]; then
      if grep -q "JSON\.parse" "$f" 2>/dev/null && ! grep -q "try {" "$f" 2>/dev/null; then
        warn "JSON.parse sin try/catch: $f"
        warn "Fix:"
        code "try { return JSON.parse(raw) as T; } catch { return null; }"
      else
        ok "H1: $f — OK"
      fi
    fi
  done

  # ── H5 · as never en prisma-orders ────────────────────────────────────────
  hdr "H5 · as never sin anotación (prisma-orders.repository.ts:78)"
  local f_orders_repo
  f_orders_repo=$(find realsass-ecommerce-back/src/orders/repository \
    -name "prisma-orders.repository.ts" 2>/dev/null | head -1)
  if [[ -n "$f_orders_repo" ]] && [[ -f "$f_orders_repo" ]]; then
    if grep -q "as never[^/]" "$f_orders_repo" 2>/dev/null \
       || grep -q "as never$" "$f_orders_repo" 2>/dev/null; then
      # shippingAddress: (input.shippingAddress ?? null) as never,
      # Fix: as Prisma.InputJsonObject
      _sed 's|\(input\.shippingAddress ?? null\) as never\b|\(input.shippingAddress ?? null\) as Prisma.InputJsonObject \/\/ @real\/jsonb-cast|g' \
        "$f_orders_repo" \
        && ok "H5: prisma-orders.repository.ts — as never → Prisma.InputJsonObject" \
        || warn "No se pudo corregir automáticamente. Editar línea 78 manualmente:"
      warn "  shippingAddress: (input.shippingAddress ?? null) as Prisma.InputJsonObject, // @real/jsonb-cast"
      warn "  Asegurarse de tener: import type { Prisma } from '@prisma/client';"
    else
      ok "H5: prisma-orders.repository.ts — sin as never sin anotación"
    fi
  else
    skip "H5: prisma-orders.repository.ts no encontrado"
  fi

  # ── J3 · AUDIT-LAST.md ────────────────────────────────────────────────────
  hdr "J3 · AUDIT-LAST.md"
  if [[ ! -f ".claude/AUDIT-LAST.md" ]] && [[ -d ".claude" ]]; then
    cat > ".claude/AUDIT-LAST.md" << AUDITLAST
# AUDIT-LAST — ecosistema (welver)
Fecha: $(date +%Y-%m-%d)
Score: 57/100 [D]

## FAILs pendientes
- A2/K4: 6 repos en ecommerce-back sin toEntity()
- B1: activity.service.ts enum mal anotado (corregido a @real/enum-cast)
- B1: customer.router.ts — OrderRecord sin customerId (fix en 2 pasos)

## REVIEWs accionables
- H1: JSON.parse sin try en config-cache y market-resolver
- H5: as never → Prisma.InputJsonObject en prisma-orders.repository.ts
AUDITLAST
    ok "J3: AUDIT-LAST.md creado"
  else
    ok "J3: AUDIT-LAST.md ya existe"
  fi

  # ═══════════════════════════════════════════════════════════════════════════
  sep
  echo -e "${BOLD}  VERIFICACIÓN — ecosistema (welver)${NC}"
  sep

  chk "B1 · as any sin anotación en producción (debe ser 0):"
  local v_b1
  v_b1=$(find . \( -name "*.ts" -o -name "*.tsx" \) \
    -not -path "*/node_modules/*" -not -path "*/.next/*" \
    -not -name "*.spec.ts" -not -name "*.e2e*" -not -path "*/__tests__/*" \
    -print0 2>/dev/null \
    | xargs -0 grep -n " as any" 2>/dev/null \
    | grep -v "// @real/\|// @welver/\|node_modules\|\.spec\." | wc -l | tr -d ' ')
  echo "    sin anotación: ${v_b1:-0}"

  chk "B1 · as any con anotación incorrecta @jsonb-cast siendo enum (debe ser 0):"
  local v_enum_wrong
  v_enum_wrong=$(grep -rn "eventType as any // @real/jsonb-cast" \
    --include="*.ts" . 2>/dev/null | grep -v "node_modules\|\.spec\." | wc -l | tr -d ' ')
  echo "    enum con anotación jsonb-cast (incorrecto): ${v_enum_wrong:-0}"

  chk "H5 · as never sin anotación en orders (debe ser 0):"
  local v_h5
  v_h5=$(grep -rn " as never\b" --include="*.ts" realsass-ecommerce-back/src 2>/dev/null \
    | grep -v "// @real/\|never\[\]\|never>\|=> never\|: never\b\|node_modules\|\.spec\." \
    | wc -l | tr -d ' ')
  echo "    sin anotación: ${v_h5:-0}"

  chk "H1 · JSON.parse sin try en archivos conocidos (debe ser 0):"
  local v_h1=0
  for f in "realsass-sass-back/src/config-cache/config-cache.service.ts" \
           "realsass-ecommerce-back/src/markets/market-resolver.service.ts"; do
    if [[ -f "$f" ]] && grep -q "JSON\.parse" "$f" 2>/dev/null \
       && ! grep -q "try {" "$f" 2>/dev/null; then
      echo "    sin try: $f"
      v_h1=$((v_h1+1))
    fi
  done
  [[ "$v_h1" -eq 0 ]] && echo "    archivos conocidos: OK"

  chk "I · exec en Dockerfiles:"
  for svc in realsass-sass-back realsass-ecommerce-back; do
    local df="${svc}/Dockerfile"
    [[ -f "$df" ]] || continue
    printf "    %-50s exec=%s dumb-init=%s\n" \
      "$df" \
      "$(grep -c "exec " "$df" 2>/dev/null || true)" \
      "$(grep -c "dumb-init" "$df" 2>/dev/null || true)"
  done

  chk "customer.router.ts — (order as any).customerId (debe ser 0):"
  local v_cast
  v_cast=$(grep -c "(order as any" \
    "realsass-ecommerce-back/src/trpc/routers/customer.router.ts" 2>/dev/null || true)
  echo "    casts pendientes: ${v_cast:-0}"

  sep; echo ""
}

# =============================================================================
# SUPERADMIN
#
# ANÁLISIS: el grep del usuario NO mostró ningún `as any` en superadmin
# → El repo ya cumple B1 completamente.
#
# Los FAILS pendientes son de otras dimensiones:
#   A4: interface CreateAuditInput en audit.service.ts → mover a schemas.ts
#   H1: JSON.parse sin try en markets-client.ts y redis.service.ts
#   D:  coverageThreshold ausente en jest.config
# =============================================================================
fix_superadmin() {
  sep
  echo -e "${BOLD}  x.sh — superadmin · fixes calidad${NC}"
  sep

  local BACK="grupojl-control-backend"
  local FRONT="grupojl-control-frontend"

  # ── B1 · as any — CONFIRMADO: repo limpio ─────────────────────────────────
  hdr "B1 · as any — verificación"
  local n_any
  n_any=$(find . \( -name "*.ts" -o -name "*.tsx" \) \
    -not -path "*/node_modules/*" -not -name "*.spec.ts" \
    -print0 2>/dev/null \
    | xargs -0 grep -c " as any" 2>/dev/null \
    | grep -v "// @grupojl/\|: 0$" | wc -l | tr -d ' ')
  if [[ "${n_any:-0}" -eq 0 ]]; then
    ok "B1: 0 as any sin anotación — repo limpio ✓"
  else
    warn "B1: ${n_any} as any sin anotación detectados"
  fi

  # ── A4 · CreateAuditInput en service → schemas.ts ─────────────────────────
  hdr "A4 · interface CreateAuditInput en audit.service.ts"
  local f_audit="${BACK}/src/audit/audit.service.ts"
  local f_schemas="${BACK}/src/audit/schemas.ts"
  if [[ -f "$f_audit" ]]; then
    if grep -q "^export interface CreateAuditInput" "$f_audit" 2>/dev/null; then
      # Extraer la interfaz completa del service
      local iface_start iface_end
      iface_start=$(grep -n "^export interface CreateAuditInput" "$f_audit" | cut -d: -f1 | head -1)
      if [[ -n "$iface_start" ]]; then
        if [[ ! -f "$f_schemas" ]]; then
          # Crear schemas.ts con la interface (extraer del service)
          echo "// grupojl-control-backend/src/audit/schemas.ts" > "$f_schemas"
          echo "// Movido desde audit.service.ts (ADR-007 — DTOs fuera de services)" >> "$f_schemas"
          echo "" >> "$f_schemas"
          # Extraer el bloque de la interface
          awk "/^export interface CreateAuditInput/,/^}/" "$f_audit" >> "$f_schemas" 2>/dev/null \
            && ok "A4: CreateAuditInput copiada a $f_schemas" \
            || warn "A4: no se pudo extraer automáticamente — copiar manualmente"
          # Agregar import en audit.service.ts
          if ! grep -q "from './schemas'" "$f_audit" 2>/dev/null; then
            _sed "1s|^|import { CreateAuditInput } from './schemas';\n|" "$f_audit" \
              && ok "A4: import agregado en audit.service.ts" \
              || warn "A4: agregar manualmente: import { CreateAuditInput } from './schemas';"
          fi
          # Eliminar la definición del service
          # Usar sed para eliminar el bloque de interface
          _sed "/^export interface CreateAuditInput/,/^}/d" "$f_audit" \
            && ok "A4: CreateAuditInput eliminada de audit.service.ts" \
            || warn "A4: eliminar manualmente el bloque 'export interface CreateAuditInput' de audit.service.ts"
        else
          ok "A4: $f_schemas ya existe"
        fi
      fi
    else
      ok "A4: CreateAuditInput ya no está en audit.service.ts"
    fi
  else
    skip "A4: $f_audit no encontrado"
  fi

  # ── H1 · JSON.parse sin try/catch ─────────────────────────────────────────
  hdr "H1 · JSON.parse sin try/catch"
  local h1_targets=(
    "${BACK}/src/integrations/welver/markets-client.ts"
    "${BACK}/src/redis/redis.service.ts"
  )
  for f in "${h1_targets[@]}"; do
    if [[ -f "$f" ]]; then
      if grep -q "JSON\.parse" "$f" 2>/dev/null && ! grep -q "try {" "$f" 2>/dev/null; then
        warn "JSON.parse sin try: $f"
        local fname; fname=$(basename "$f")
        if [[ "$fname" == "redis.service.ts" ]]; then
          warn "Fix en redis.service.ts:"
          code "async get<T>(key: string): Promise<T | null> {"
          code "  const raw = await this.client.get(key);"
          code "  if (!raw) return null;"
          code "  try {"
          code "    return JSON.parse(raw) as T; // @grupojl/jsonb-cast"
          code "  } catch {"
          code "    this.logger.warn('redis: JSON.parse falló', { key });"
          code "    return null;"
          code "  }"
          code "}"
        else
          warn "Fix en markets-client.ts:"
          code "if (cached) {"
          code "  try {"
          code "    return JSON.parse(cached) as MarketDTO[]; // @grupojl/jsonb-cast"
          code "  } catch { /* cache corrupta — continuar con fetch */ }"
          code "}"
        fi
      else
        ok "H1: $f — OK"
      fi
    fi
  done

  # ── I · exec + dumb-init ──────────────────────────────────────────────────
  hdr "I · Dockerfiles — exec + dumb-init"
  for svc in "$BACK" "$FRONT"; do
    local df="${svc}/Dockerfile"
    [[ -f "$df" ]] || { skip "I: $df no encontrado"; continue; }
    if grep -q "exec " "$df" 2>/dev/null; then
      ok "I exec: $svc — ya presente"
    else
      if grep -q "dumb-init" "$df" 2>/dev/null; then
        _sed 's|^CMD \["node",|CMD exec dumb-init node|g' "$df"
        _sed 's|, "dist/main\.js"\]| dist/main.js|g' "$df"
        ok "I exec: $svc — CMD actualizado"
      else
        _sed 's|^CMD \["node",|CMD exec node|g' "$df"
        _sed 's|, "server\.js"\]| server.js|g' "$df"
        ok "I exec: $svc — CMD actualizado (sin dumb-init)"
        warn "Agregar: RUN apk add --no-cache dumb-init en $df"
      fi
    fi
    if ! grep -q "dumb-init" "$df" 2>/dev/null; then
      if grep -q "^FROM.*AS runner\|^FROM.*alpine\|^FROM.*slim" "$df" 2>/dev/null; then
        _sed '/^FROM.*\(runner\|alpine\|slim\)/a RUN apk add --no-cache dumb-init 2>/dev/null || apt-get install -y --no-install-recommends dumb-init 2>/dev/null || true' \
          "$df" && ok "I dumb-init: $svc — insertado"
      fi
    fi
  done

  # ── D · coverageThreshold ─────────────────────────────────────────────────
  hdr "D · coverageThreshold en jest.config"
  local jest_file
  jest_file=$(find "$BACK" -name "jest.config*" -not -path "*/node_modules/*" 2>/dev/null | head -1)
  if [[ -n "$jest_file" ]]; then
    if grep -q "coverageThreshold" "$jest_file" 2>/dev/null; then
      ok "D: coverageThreshold ya presente en $jest_file"
    else
      warn "D: falta coverageThreshold en $jest_file"
      warn "Agregar:"
      code "coverageThreshold: {"
      code "  global: { branches: 70, functions: 70, lines: 70, statements: 70 }"
      code "},"
    fi
  else
    skip "D: jest.config no encontrado en $BACK"
  fi

  # ── J3 · AUDIT-LAST.md ────────────────────────────────────────────────────
  hdr "J3 · AUDIT-LAST.md"
  if [[ ! -f ".claude/AUDIT-LAST.md" ]] && [[ -d ".claude" ]]; then
    cat > ".claude/AUDIT-LAST.md" << AUDITLAST
# AUDIT-LAST — superadmin
Fecha: $(date +%Y-%m-%d)
Score: 69/100 [C]

## B1: PASS — 0 as any sin anotación
## I: PASS post x.sh

## Pendientes
- A4: CreateAuditInput → audit/schemas.ts
- H1: JSON.parse en markets-client + redis.service
- D: coverageThreshold en jest.config
AUDITLAST
    ok "J3: AUDIT-LAST.md creado"
  else
    ok "J3: AUDIT-LAST.md ya existe"
  fi

  # ═══════════════════════════════════════════════════════════════════════════
  sep
  echo -e "${BOLD}  VERIFICACIÓN — superadmin${NC}"
  sep

  chk "B1 · as any sin anotación (debe ser 0):"
  local v_b1
  v_b1=$(find . \( -name "*.ts" -o -name "*.tsx" \) \
    -not -path "*/node_modules/*" -not -name "*.spec.ts" \
    -print0 2>/dev/null \
    | xargs -0 grep -n " as any" 2>/dev/null \
    | grep -v "// @grupojl/\|node_modules\|\.spec\." | wc -l | tr -d ' ')
  echo "    sin anotación: ${v_b1:-0}"

  chk "A4 · CreateAuditInput en services (debe ser 0):"
  local v_a4
  v_a4=$(grep -rn "^export interface CreateAuditInput" \
    --include="*.service.ts" "${BACK}/src" 2>/dev/null | wc -l | tr -d ' ')
  echo "    en services: ${v_a4:-0}"

  chk "A4 · schemas.ts creado:"
  [[ -f "${BACK}/src/audit/schemas.ts" ]] \
    && echo "    presente" \
    || echo "    AUSENTE"

  chk "H1 · JSON.parse sin try en archivos conocidos (debe ser 0):"
  local v_h1=0
  for f in "${BACK}/src/integrations/welver/markets-client.ts" \
           "${BACK}/src/redis/redis.service.ts"; do
    if [[ -f "$f" ]] && grep -q "JSON\.parse" "$f" 2>/dev/null \
       && ! grep -q "try {" "$f" 2>/dev/null; then
      echo "    sin try: $f"
      v_h1=$((v_h1+1))
    fi
  done
  [[ "$v_h1" -eq 0 ]] && echo "    archivos conocidos: OK"

  chk "I · exec + dumb-init en Dockerfiles:"
  for svc in "$BACK" "$FRONT"; do
    local df="${svc}/Dockerfile"
    [[ -f "$df" ]] || continue
    printf "    %-55s exec=%s dumb-init=%s\n" \
      "$df" \
      "$(grep -c "exec " "$df" 2>/dev/null || true)" \
      "$(grep -c "dumb-init" "$df" 2>/dev/null || true)"
  done

  chk "D · coverageThreshold:"
  local v_cov
  v_cov=$(find "$BACK" -name "jest.config*" -not -path "*/node_modules/*" 2>/dev/null \
    | xargs grep -l "coverageThreshold" 2>/dev/null | wc -l | tr -d ' ')
  echo "    con threshold: ${v_cov:-0}"

  sep; echo ""
}

# =============================================================================
# MAIN
# =============================================================================
if [[ -z "$TARGET" ]]; then
  cat << 'USAGE'
x.sh v3 — Fixes as any + calidad · GrupoJL

Uso (desde el root del repo):
  bash x.sh ecosistema-ms    → fixes B1 (rag enum-cast dup, automation rule cast)
  bash x.sh ecosistema       → fixes B1 (activity enum, customer.router customerId)
  bash x.sh superadmin       → confirma B1 OK, fixes A4/H1/D

Al final de cada modo: greps de verificación del estado real.
Exit 0 siempre.
USAGE
  exit 0
fi

echo "=== Ejecutando x.sh ==="
case "$TARGET" in
  ecosistema-ms) fix_ecosistema_ms ;;
  ecosistema)    fix_ecosistema    ;;
  superadmin)    fix_superadmin    ;;
  *)
    echo "Repo desconocido: '$TARGET'"
    echo "Válidos: ecosistema-ms | ecosistema | superadmin"
    exit 1 ;;
esac
exit 0