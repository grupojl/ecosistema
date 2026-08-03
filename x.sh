#!/usr/bin/env bash
set -euo pipefail

# fix-dashboard-trpc-provider-import.sh
# Corrige el import roto en realsass-dashboard-front/lib/trpc/provider.tsx
# Bug: importa '@/context/auth-context' (patrón de sass-front) en vez de
# '@/features/auth/context/auth-context' (patrón real de dashboard-front).
#
# Ejecutar desde la raíz del monorepo (welver/).

REPO_ROOT="$(pwd)"
TARGET_APP="realsass-dashboard-front"
TARGET_FILE="${TARGET_APP}/lib/trpc/provider.tsx"

if [ ! -f "$TARGET_FILE" ]; then
  echo "ERROR: no se encontró $TARGET_FILE. Ejecutá este script desde la raíz del monorepo." >&2
  exit 1
fi

echo "== Antes =="
grep -n "@/context/auth-context" "$TARGET_FILE" || echo "(sin coincidencias — revisar manualmente el contenido del import)"

# Reemplazo del import roto
sed -i.bak "s|@/context/auth-context|@/features/auth/context/auth-context|g" "$TARGET_FILE"
rm -f "${TARGET_FILE}.bak"

echo ""
echo "== Después =="
grep -n "@/features/auth/context/auth-context" "$TARGET_FILE" || echo "(no se aplicó el reemplazo — revisar el archivo manualmente)"

# Verificación: buscar otros archivos en dashboard-front que repitan el mismo
# patrón roto (mismo bug copiado en otro lado).
echo ""
echo "== Buscando otras referencias rotas a '@/context/auth-context' en ${TARGET_APP} =="
OTHER_HITS=$(grep -rl "@/context/auth-context" "${TARGET_APP}" --include="*.ts" --include="*.tsx" || true)

if [ -n "${OTHER_HITS}" ]; then
  echo "Se encontraron más referencias rotas:"
  echo "${OTHER_HITS}"
  echo ""
  echo "Corrigiendo automáticamente..."
  while IFS= read -r f; do
    sed -i.bak "s|@/context/auth-context|@/features/auth/context/auth-context|g" "$f"
    rm -f "${f}.bak"
    echo "  fixed: $f"
  done <<< "${OTHER_HITS}"
else
  echo "No se encontraron más referencias rotas."
fi

# Verificación: confirmar que el archivo destino del import realmente existe.
AUTH_CTX_FILE="${TARGET_APP}/features/auth/context/auth-context.tsx"
if [ ! -f "$AUTH_CTX_FILE" ]; then
  echo ""
  echo "ADVERTENCIA: ${AUTH_CTX_FILE} no existe en el filesystem actual."
  echo "Verificá manualmente la ruta real del AuthProvider en ${TARGET_APP}/features/auth/."
fi

echo ""
echo "Listo. Corré 'pnpm --filter ${TARGET_APP} typecheck' o el build de Docker de nuevo para confirmar."