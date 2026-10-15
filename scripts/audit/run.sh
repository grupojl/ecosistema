#!/usr/bin/env bash
# Corre las auditorías del monorepo desde la raíz.
#   bash scripts/audit/run.sh              → todas
#   bash scripts/audit/run.sh seguridad    → una sola
#   bash scripts/audit/run.sh --ci         → todas, exit 1 si alguna falla
set -uo pipefail

cd "$(dirname "$0")/../.."

AUDITS=(contratos-tipado arquitectura seguridad observabilidad testing dependencias deploy)
CI=false
SELECTED=()

for arg in "$@"; do
  if [[ "$arg" == "--ci" ]]; then CI=true; else SELECTED+=("$arg"); fi
done
[[ ${#SELECTED[@]} -eq 0 ]] && SELECTED=("${AUDITS[@]}")

FAILED=()
for name in "${SELECTED[@]}"; do
  script="scripts/audit/${name}.sh"
  if [[ ! -f "$script" ]]; then echo "No existe $script"; exit 2; fi
  echo ""
  echo "################ ${name} ################"
  if [[ "$CI" == true ]]; then bash "$script" --ci || FAILED+=("$name"); else bash "$script" ecosistema || true; fi
done

if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo ""
  echo "Auditorías con hallazgos: ${FAILED[*]}"
  exit 1
fi
