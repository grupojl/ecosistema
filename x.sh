#!/usr/bin/env bash
# =============================================================================
# fix-claude-docs-welver.sh
# Fix puntual:
#   1. deuda-tecnica.md — reemplazar sección "prisma migrate deploy sin confirmar"
#   2. ADR-010-codigo-10-10.md — marcar Gap C2 como resuelto + agregar tabla
# Sin python. Git Bash compatible.
# Ejecutar desde la raíz del monorepo welver/
# =============================================================================
set -euo pipefail

echo ""
echo "=== fix-claude-docs-welver.sh ==="
echo ""

# =============================================================================
# 1. roadmap/deuda-tecnica.md
#    Reemplazar el bloque "### prisma migrate deploy antes del CMD..."
#    El bloque empieza en la línea con ese título y termina antes del siguiente ###
# =============================================================================
echo "▶ .claude/roadmap/deuda-tecnica.md — cerrando gap Docker..."

TMPFILE=".claude/roadmap/deuda-tecnica.md.tmp"
IN_GAP=0
GAP_CLOSED=0

while IFS= read -r line; do

  # Detectar inicio del bloque a reemplazar
  if [ "$GAP_CLOSED" = "0" ] && echo "$line" | grep -q "prisma migrate deploy antes del CMD en Dockerfiles sin confirmar"; then
    IN_GAP=1
    # Escribir encabezado resuelto
    printf '%s\n' "### ~~prisma migrate deploy antes del CMD~~ — ✅ RESUELTO (2026-09-16)"
    printf '%s\n' ""
    printf '%s\n' "Ambos backends tienen \`entrypoint.sh\` con \`prisma migrate deploy\` + \`exec node dist/main.js\`."
    printf '%s\n' "CMD: \`[\"dumb-init\", \"/app/<servicio>/entrypoint.sh\"]\`. \`--platform=linux/amd64\` en cada FROM."
    printf '%s\n' "Auditado en ecosistema.xml — 10/10 en dimensión Docker."
    printf '%s\n' ""
    printf '%s\n' "Ver: \`realsass-sass-back/entrypoint.sh\`, \`realsass-ecommerce-back/entrypoint.sh\`"
    printf '%s\n' "Ver: \`architecture/05-dockerfile-backend.md\`"
    continue
  fi

  # Mientras estamos dentro del bloque, saltar líneas originales
  # hasta encontrar el siguiente ### o ---
  if [ "$IN_GAP" = "1" ]; then
    if echo "$line" | grep -qE "^(### |---)"; then
      IN_GAP=0
      GAP_CLOSED=1
      printf '%s\n' "$line"
    fi
    continue
  fi

  printf '%s\n' "$line"

done < ".claude/roadmap/deuda-tecnica.md" > "$TMPFILE"

mv "$TMPFILE" ".claude/roadmap/deuda-tecnica.md"
echo "  ✓ deuda-tecnica.md"

# =============================================================================
# 2. decisions/ADR-010-codigo-10-10.md
#    a) Reemplazar encabezado "### Gap C2 — Dockerfiles sin prisma migrate deploy"
#    b) Agregar tabla de estado al final
# =============================================================================
echo "▶ .claude/decisions/ADR-010-codigo-10-10.md — Gap C2 resuelto..."

TMPFILE=".claude/decisions/ADR-010-codigo-10-10.md.tmp"
IN_GAP=0
GAP_CLOSED=0

while IFS= read -r line; do

  if [ "$GAP_CLOSED" = "0" ] && echo "$line" | grep -q "### Gap C2 — Dockerfiles sin prisma migrate deploy"; then
    IN_GAP=1
    printf '%s\n' "### ~~Gap C2~~ — Dockerfiles sin prisma migrate deploy — ✅ RESUELTO (2026-09-16)"
    printf '%s\n' ""
    printf '%s\n' "Ambos Dockerfiles usan \`CMD [\"dumb-init\", \"/app/<servicio>/entrypoint.sh\"]\`."
    printf '%s\n' "Los \`entrypoint.sh\` ejecutan \`prisma migrate deploy\` + \`exec node dist/main.js\`."
    printf '%s\n' "\`--platform=linux/amd64\` en cada FROM. Auditado — score Docker 10/10."
    continue
  fi

  if [ "$IN_GAP" = "1" ]; then
    if echo "$line" | grep -qE "^(### |---)"; then
      IN_GAP=0
      GAP_CLOSED=1
      printf '%s\n' "$line"
    fi
    continue
  fi

  printf '%s\n' "$line"

done < ".claude/decisions/ADR-010-codigo-10-10.md" > "$TMPFILE"

mv "$TMPFILE" ".claude/decisions/ADR-010-codigo-10-10.md"

# Agregar tabla de estado al final
cat >> .claude/decisions/ADR-010-codigo-10-10.md << 'EOF'

---

## Estado de implementación (2026-09-16)

| Gap | Estado | Evidencia |
|-----|--------|-----------|
| C1 — class-validator en update-organization.dto.ts | ✅ RESUELTO | `grep class-validator realsass-sass-back/src` → 0 |
| C2 — Dockerfiles sin migrate deploy | ✅ RESUELTO | entrypoint.sh auditado en ecosistema.xml — 10/10 |
| C3 — .env.example ausente | ⏳ Pendiente Fase 2 | [E2-02] en lifecycle/05-tasks.md |

**Score Docker/Deploy actual:** 10/10
EOF

echo "  ✓ ADR-010-codigo-10-10.md"

# =============================================================================
# Verificación
# =============================================================================
echo ""
echo "=== Verificación ==="
grep "RESUELTO" .claude/roadmap/deuda-tecnica.md | head -1 | sed 's/^/  deuda-tecnica: /'
grep "RESUELTO" .claude/decisions/ADR-010-codigo-10-10.md | head -3 | sed 's/^/  ADR-010: /'
grep "Estado de implementación" .claude/decisions/ADR-010-codigo-10-10.md | sed 's/^/  ADR-010: /'

echo ""
echo "✅ Done — welver"
echo "   Commit: git add .claude && git commit -m 'docs(claude): fix deuda-tecnica + ADR-010 Gap C2 resuelto'"