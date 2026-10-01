#!/usr/bin/env bash
# EVALUAR CALIDAD MODULO POR MODULO CON CAT DE BASH
# audit.sh — Audit B: Contratos / Tipado
# Uso: bash audit.sh       → corre todos los checks automáticamente
#      bash audit.sh --ci  → exit 1 si hay hallazgos reales
# Correr desde el root del repo

set -euo pipefail

CI_MODE=false
[[ "${1:-}" == "--ci" ]] && CI_MODE=true

TOTAL_FINDINGS=0
FAILED_CHECKS=()

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

header() {
  echo ""
  echo -e "${CYAN}${BOLD}══════════════════════════════════════════════════${RESET}"
  echo -e "${CYAN}${BOLD}  $1${RESET}"
  echo -e "${CYAN}${BOLD}══════════════════════════════════════════════════${RESET}"
}

run_check() {
  local id="$1" desc="$2"; shift 2
  header "${id} · ${desc}"
  local output
  output=$(bash -c "$*" 2>/dev/null || true)
  if [[ -z "$output" ]]; then
    echo -e "${GREEN}✓ Sin hallazgos${RESET}"
  else
    local count; count=$(echo "$output" | wc -l | tr -d ' ')
    echo -e "${RED}✗ ${count} hallazgo(s):${RESET}"
    echo "$output"
    TOTAL_FINDINGS=$((TOTAL_FINDINGS + count))
    FAILED_CHECKS+=("${id}: ${desc} — ${count} hallazgo(s)")
  fi
}

run_check_present() {
  local id="$1" desc="$2"; shift 2
  header "${id} · ${desc}"
  local output
  output=$(bash -c "$*" 2>/dev/null || true)
  if [[ -n "$output" ]]; then
    echo -e "${GREEN}✓ Presente:${RESET} $output"
  else
    echo -e "${RED}✗ NO encontrado${RESET}"
    TOTAL_FINDINGS=$((TOTAL_FINDINGS + 1))
    FAILED_CHECKS+=("${id}: ${desc} — NO encontrado")
  fi
}

run_info() {
  local id="$1" desc="$2"; shift 2
  header "${id} · ${desc}"
  local output
  output=$(bash -c "$*" 2>/dev/null || true)
  if [[ -z "$output" ]]; then
    echo -e "${GREEN}✓ Sin deuda en esta categoría${RESET}"
  else
    local count; count=$(echo "$output" | wc -l | tr -d ' ')
    echo -e "${YELLOW}⚠ ${count} ítem(s) de deuda documentada:${RESET}"
    echo "$output"
  fi
}

# ── Checks de calidad ─────────────────────────────────────────────────────────

run_check "B1" "as any sin @real/ — bugs reales" \
  'grep -rn " as any" --include="*.ts" --include="*.tsx" \
  | grep -v "node_modules" | grep -v ".next" | grep -v "dist" | grep -v "build" \
  | grep -v "@real/" | grep -v "@ecosistema-ms/" || true'

run_check "B1b" "parámetros tipados como any — excluye JSDoc" \
  'grep -rn ": any\b\|: any," --include="*.ts" --include="*.tsx" \
  | grep -v "node_modules" | grep -v "dist" \
  | grep -v ":[0-9]*:[[:space:]]*\*" \
  | grep -v ":[0-9]*:[[:space:]]*//" || true'

run_check "B2" "as unknown as sin @real/" \
  'grep -rn " as unknown as" --include="*.ts" --include="*.tsx" \
  | grep -v "node_modules" | grep -v "dist" \
  | grep -v "@real/" | grep -v "@ecosistema-ms/" || true'

run_check "B3" "@ts-ignore prohibido" \
  'grep -rn "@ts-ignore" --include="*.ts" --include="*.tsx" \
  | grep -v "node_modules" || true'

run_check "B4" "@ts-expect-error sin texto explicativo" \
  'grep -rn "@ts-expect-error" --include="*.ts" --include="*.tsx" \
  | grep -v "node_modules" || true'

run_check "B5" "class-validator prohibido — usar Zod" \
  'grep -rn "from '\''class-validator'\''\|from \"class-validator\"\|@IsString\b\|@IsEmail\b\|@IsEnum\b\|@IsOptional\b\|@IsNotEmpty\b" \
  --include="*.ts" --include="*.tsx" \
  | grep -v "node_modules" || true'

run_check_present "B6" "strictNullChecks activo en tsconfig" \
  'grep -E "strictNullChecks|\"strict\"" tsconfig.base.json'

# ── Deuda documentada ─────────────────────────────────────────────────────────

run_info "D1" "as any CON @real/ — casts documentados pendientes" \
  'grep -rn " as any" --include="*.ts" --include="*.tsx" \
  | grep -v "node_modules" | grep -v ".next" | grep -v "dist" | grep -v "build" \
  | grep "@real/" || true'

run_info "D2" "as unknown as CON @real/" \
  'grep -rn " as unknown as" --include="*.ts" --include="*.tsx" \
  | grep -v "node_modules" | grep -v "dist" \
  | grep "@real/" || true'

run_info "D3" "JSONB en repositories — necesitan Zod" \
  'grep -rn "@real/jsonb-cast" --include="*.ts" \
  | grep -v "node_modules" | grep -v "spec.ts" \
  | grep "repository/" || true'

run_info "D4" "JSONB fuera de repositories — tipado flojo" \
  'grep -rn "@real/jsonb-cast" --include="*.ts" \
  | grep -v "node_modules" | grep -v "spec.ts" \
  | grep -v "repository/" || true'

# ── Resumen ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}══════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  RESUMEN AUDIT B${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════${RESET}"

if [[ ${#FAILED_CHECKS[@]} -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}✓ Todos los checks pasaron — 0 hallazgos reales${RESET}"
else
  echo -e "${RED}${BOLD}✗ ${TOTAL_FINDINGS} hallazgo(s) en ${#FAILED_CHECKS[@]} check(s):${RESET}"
  for item in "${FAILED_CHECKS[@]}"; do
    echo -e "  ${RED}•${RESET} $item"
  done
fi
echo -e "${YELLOW}  ℹ  D1-D4 son deuda documentada — no bloquean CI${RESET}"
echo ""

if [[ "$CI_MODE" == true && $TOTAL_FINDINGS -gt 0 ]]; then
  exit 1
fi