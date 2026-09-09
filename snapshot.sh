#!/usr/bin/env bash
# =============================================================================
# snapshot.sh — Actualiza el XML de contexto para Claude
#
# Ejecutar desde la RAÍZ del monorepo: bash snapshot.sh
#
# Prerequisito: repomix instalado globalmente
#   npm install -g repomix
# =============================================================================
set -e
GREEN='\033[0;32m'; YELLOW='\033[0;33m'; BOLD='\033[1m'; RESET='\033[0m'
log()  { echo -e "${GREEN}[snapshot]${RESET} $1"; }
warn() { echo -e "${YELLOW}[warn]${RESET} $1"; }

REPO="grupojl/welver"
XML_OUT="../claude-context/welver.xml"

# Crear directorio de output si no existe
mkdir -p "$(dirname "$XML_OUT")"

log "Generando snapshot de $REPO..."
log "Output: $XML_OUT"

# Correr repomix
if command -v repomix &> /dev/null; then
  repomix --config repomix.config.json --output "$XML_OUT"
  log "✅ XML generado: $XML_OUT"
else
  warn "repomix no encontrado. Instalar con:"
  warn "  npm install -g repomix"
  exit 1
fi

# Mostrar tamaño del archivo generado
SIZE=$(wc -l < "$XML_OUT" 2>/dev/null || echo "?")
log "Archivo: $SIZE líneas"

# Score actual desde AUDIT-LAST.md
SCORE=$(grep "^\*\*Score global" .claude/AUDIT-LAST.md 2>/dev/null | head -1 || echo "ver AUDIT-LAST.md")
log "Score actual: $SCORE"

echo ""
echo -e "${BOLD}Próximos pasos:${RESET}"
echo "  1. Subir $XML_OUT a la sesión de Claude"
echo "  2. Decirle a Claude una de las siguientes:"
echo ""
echo "     Auditoría completa:"
echo "     → 'Ejecutá el protocolo de .claude/AUDIT.md y actualizá AUDIT-LAST.md'"
echo ""
echo "     Continuar sesión anterior:"
echo "     → 'Lee .claude/CONTEXT.md y continuamos'"
echo ""
echo "     Nueva feature:"
echo "     → 'Lee .claude/AUDIT-LAST.md y .claude/CONTEXT.md. Quiero implementar [X]'"
echo ""
