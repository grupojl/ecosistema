#!/usr/bin/env bash
# =============================================================================
# experience-setup.sh — Instala las 3 mejoras de experiencia en .claude/
#
# Ejecutar con el nombre del repo como argumento:
#   bash experience-setup.sh welver
#   bash experience-setup.sh ecosistema-ms
#   bash experience-setup.sh superadmin
#
# Crea en .claude/:
#   CONTEXT.md       → estado de la sesión activa (actualizar al cerrar)
#   DECISIONS-LOG.md → historial de decisiones pequeñas tomadas en chat
#
# Crea en la raíz del repo:
#   snapshot.sh      → actualiza el XML con repomix en un comando
# =============================================================================
set -e
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; RESET='\033[0m'
log()  { echo -e "${GREEN}[experience-setup]${RESET} $1"; }
step() { echo -e "\n${BOLD}${CYAN}══ $1${RESET}"; }
warn() { echo -e "${YELLOW}[warn]${RESET} $1"; }

REPO=${1:-""}
if [ -z "$REPO" ]; then
  echo "Uso: bash experience-setup.sh welver | ecosistema-ms | superadmin"
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# Configuración por repo
# ─────────────────────────────────────────────────────────────────────────────
case "$REPO" in
  welver)
    REPO_FULL="grupojl/welver"
    REPO_DESC="Monorepo SaaS multi-tenant — 2 backs NestJS + 3 fronts Next.js"
    XML_OUTPUT="../claude-context/welver.xml"
    XML_CONFIG="welver-repomix.config.json"
    SCORE="9.01/10"
    SPRINT_ACTIVO="S8 — Producción (tests + CI verificado)"
    OBJETIVO_SESION="Completar HydrationBoundary en storefront (S4-D)"
    PROXIMO_PASO="Implementar prefetchQuery + dehydrate en real-ecommerce-front/app/tienda/[slug]/page.tsx"
    ;;
  ecosistema-ms)
    REPO_FULL="grupojl/ecosistema-ms"
    REPO_DESC="5 microservicios NestJS — chatia, pagos, notificaciones, analytics, workers"
    XML_OUTPUT="../claude-context/ecosistema-ms.xml"
    XML_CONFIG="ecosistema-ms-repomix.config.json"
    SCORE="8.44/10"
    SPRINT_ACTIVO="Sprint Domain/Repository — contacts, messages, agents"
    OBJETIVO_SESION="Migrar contacts/ a Domain/Repository siguiendo molde de conversations/"
    PROXIMO_PASO="Crear chatia-backend/src/contacts/domain/contact.entity.ts"
    ;;
  superadmin)
    REPO_FULL="grupojl/grupojl-control"
    REPO_DESC="Superadmin panel — backend NestJS (4000) + frontend Next.js (3000)"
    XML_OUTPUT="../claude-context/superadmin.xml"
    XML_CONFIG="superadmin-repomix.config.json"
    SCORE="8.68/10"
    SPRINT_ACTIVO="S8 — Producción (variables Railway + tests + CI)"
    OBJETIVO_SESION="S8 [P-01]: .env.example + validación arranque + rate limiting auth"
    PROXIMO_PASO="Crear grupojl-control-backend/.env.example con todas las vars requeridas"
    ;;
  *)
    echo "Repo desconocido: $REPO"
    echo "Uso: bash experience-setup.sh welver | ecosistema-ms | superadmin"
    exit 1
    ;;
esac

step "Instalando mejoras de experiencia en $REPO_FULL"

# ─────────────────────────────────────────────────────────────────────────────
# 1. CONTEXT.md — estado de la sesión activa
# ─────────────────────────────────────────────────────────────────────────────
log "Creando .claude/CONTEXT.md"
cat > .claude/CONTEXT.md << HEREDOC
# CONTEXT.md — Estado de la sesión activa

**Repo:** $REPO_FULL
**Score actual:** $SCORE (ver AUDIT-LAST.md para detalle)
**Sprint activo:** $SPRINT_ACTIVO

---

## Sesión activa

**Objetivo de esta sesión:**
$OBJETIVO_SESION

**Bloqueante actual:**
Ninguno

**Última decisión tomada:**
_(actualizar al tomar decisiones en la sesión)_

**Próximo paso concreto:**
$PROXIMO_PASO

---

## Cómo usar este archivo

### Al INICIAR una sesión
Claude lee este archivo para saber exactamente dónde estamos.
No hace falta explicar el contexto — está acá.

### Al CERRAR una sesión
Actualizar las 4 líneas antes de cerrar:
- **Objetivo** → qué quedó pendiente para la próxima vez
- **Bloqueante** → qué impide avanzar (o "Ninguno")
- **Última decisión** → la decisión más importante que se tomó hoy
- **Próximo paso** → la primera acción concreta de la próxima sesión

Toma 2 minutos. Evita 20 minutos de calibración en la sesión siguiente.

---

## Historial de sesiones

| Fecha | Objetivo | Resultado |
|-------|----------|-----------|
| 2026-09-08 | Setup sistema de auditoría + x.sh código/estructura | ✅ AUDIT.md + AUDIT-LAST.md + CLAUDE.md instalados |

HEREDOC
log "  CONTEXT.md creado"

# ─────────────────────────────────────────────────────────────────────────────
# 2. DECISIONS-LOG.md — historial de decisiones pequeñas del chat
# ─────────────────────────────────────────────────────────────────────────────
log "Creando .claude/DECISIONS-LOG.md"

# Contenido específico por repo basado en decisiones reales ya tomadas
case "$REPO" in
  welver)
    DECISIONS_CONTENT='## 2026-09-08 — Sesión ADR-011 + ADR-012

- **tRPC exclusivo en ecommerce-back:** controllers REST legacy eliminados. Si un endpoint nuevo no puede ir por tRPC (ej: necesita Set-Cookie), va a REST con justificación en el ADR.
- **lib/store/client.ts usa tRPC server caller:** no fetch REST manual. Excepción documentada: POST /auth/session en auth-context.tsx (necesita Set-Cookie).
- **Cookie `__session` con `sameSite: strict`:** se eligió strict sobre lax porque los fronts están en subdominios propios, no en dominios de terceros. Si se integra un widget embeddable en otros dominios, revisar esta decisión.
- **Rate limiting en auth: 10 req/min por IP:** elegido sobre 5 (muy restrictivo para usuarios legítimos) y 20 (poco efectivo contra bots lentos).
- **Dockerfiles con `dumb-init`:** PID 1 correcto para Node.js en containers. No cambiar a `node dist/main` directo sin revisar manejo de señales.
- **`prisma migrate deploy` en CMD del Dockerfile:** se eligió sobre un script wrapper separado para mantener el Dockerfile simple. Riesgo aceptado: si la migration falla el container no levanta — esto es el comportamiento correcto.
- **Componentes legacy del storefront eliminados (ADR-008):** `catalog/` y `product/` — 0 importaciones activas confirmadas antes de eliminar. Si alguien reporta una página rota, revisar si había un import dinámico no detectado por grep estático.
- **`noImplicitAny: true` en tsconfig.base.json:** heredado por todos los tsconfig del monorepo. Si un servicio nuevo necesita flexibilidad temporal, puede sobrescribir en su tsconfig local con comentario que justifique y fecha de expiración.
- **Named catalogs pnpm PROHIBIDOS:** `catalog:backend`, `catalog:frontend`, etc. no funcionan en el entorno Windows + Git Bash actual. Solo `catalog:` default. No proponer named catalogs aunque parezca más organizado.'
    ;;
  ecosistema-ms)
    DECISIONS_CONTENT='## 2026-09-08 — Sesión ADR-009 + ADR-010

- **Cache keys: `eco:{ecosystemId}:org:{organizationId}:{type}:{key}`:** el ecosystemId va primero porque es el particionador más alto. No invertir el orden — rompería el patrón de `scan` por ecosistema.
- **AssistantChatService firma: `{ projectSlug, organizationId, userId, message, channel }`:** esta es la firma real que usan WidgetController y AssistantController. No cambiar sin actualizar ambos callers. La firma alternativa `{ conversationId, ecosystemId, message }` fue propuesta y descartada.
- **class-validator en notificaciones-backend no migrado en esta sesión:** decisión consciente — sprint dedicado. No agregar Zod a medias en el mismo archivo que tiene class-validator.
- **`tsconfig.base.json` sin `extends`:** un tsconfig.base.json que se extiende a sí mismo es una paradoja que TypeScript resuelve de forma impredecible. La raíz nunca tiene `extends`.
- **`strictBindCallApply: true` en tsconfig.base.json:** se activó junto con `noImplicitAny`. Si aparecen errores en decorators de NestJS, el fix es tipado explícito — no desactivar la flag.
- **opossum como catalog: default:** se eligió `"opossum": "catalog:"` sobre versión directa `"^8.1.4"` para mantener consistencia del monorepo. Si opossum no está en el catalog raíz, agregarlo ahí primero.
- **DlqModule conectado en QueueModule (no en AppModule):** se conecta en QueueModule porque el DLQ pertenece a la queue, no al módulo de aplicación. Si se mueve a AppModule, los endpoints /queue/dlq/* siguen funcionando pero la responsabilidad queda difusa.
- **`ecosystemId` en where de `dailyConversationSummary`:** bug de seguridad multi-tenant — dos orgs de distintos ecosistemas con el mismo organizationId podían ver datos mezclados. Siempre doble scope.
- **gRPC controllers sin lógica de negocio:** la regla es estricta — reciben proto, llaman service, retornan proto. Si un gRPC controller tiene un if de negocio, es un bug de capa.'
    ;;
  superadmin)
    DECISIONS_CONTENT='## 2026-09-08 — Sesión S0–S7

- **HTTP interno (no gRPC) para Integration Clients:** el superadmin es consumidor administrativo de baja frecuencia. gRPC agregaría complejidad (contratos .proto, codegen) sin beneficio de throughput. Si el superadmin necesita > 100 req/s a un MS, revisar esta decisión (ADR-001).
- **Sin Domain/Repository en ecosystems, microservices, railway, metrics:** son agregadores de estado externo sin escritura en DB propia. La excepción está documentada en DC-002. Si alguno empieza a escribir en DB, migrar al patrón.
- **EcosystemsService hardcodeado con 2 ecosistemas:** no justifica DB hasta 4 ecosistemas (DC-003). No crear tabla `ecosystems` hasta entonces.
- **MockDataProvider con switch por env var (no por feature flag):** elegido sobre feature flags porque es más simple y el switch es permanente hasta que el endpoint real exista. La variable de entorno vacía = mock, configurada = real.
- **`as AdminActionType` en prisma-audit.repository.ts (DC-005):** cast intencional — Prisma retorna `string` para campos `String` en el schema. La alternativa (Prisma enum) requiere migración. Documentado, no es `as any`.
- **Puerto 4000 para el backend:** evita colisión con frontend (3000) y con cualquier MS de ecosistema-ms que corra en local. No cambiar sin actualizar Makefile y docker-compose.
- **`reason: z.string().min(10)` en acciones destructivas:** 10 caracteres mínimo para forzar una justificación real. No bajar a menos — "ok" o "test" no son razones válidas para suspender una org.
- **DemoBadge en UI mientras USE_MOCK activo:** el operador debe saber que está viendo datos mock. Eliminar el badge solo cuando el client correspondiente esté usando el endpoint real, no antes.
- **Cookie `secure: process.env.NODE_ENV === "production"`:** en local sin HTTPS las cookies Secure no funcionan. El switch es intencional — no hardcodear `secure: false` en producción.'
    ;;
esac

cat > .claude/DECISIONS-LOG.md << HEREDOC
# DECISIONS-LOG.md — Historial de decisiones tomadas en sesiones de chat

**Repo:** $REPO_FULL

Decisiones pequeñas que no justifican un ADR pero que si se olvidan
generan conversaciones repetidas o propuestas que ya se descartaron.

**Formato:** al cerrar una sesión, agregar una sección con la fecha
y las 2-5 decisiones más importantes tomadas. Una línea por decisión,
en bold el tema, después el razonamiento en una oración.

---

$DECISIONS_CONTENT

---

## Template para nuevas sesiones

\`\`\`markdown
## YYYY-MM-DD — Sesión [descripción]

- **[Tema]:** [decisión tomada] porque [razón en una oración]. [Qué revisar si cambia el contexto].
\`\`\`
HEREDOC
log "  DECISIONS-LOG.md creado"

# ─────────────────────────────────────────────────────────────────────────────
# 3. snapshot.sh — actualiza el XML con repomix en un comando
# ─────────────────────────────────────────────────────────────────────────────
log "Creando snapshot.sh en la raíz del repo"

# Detectar si existe repomix config ya en el repo
REPOMIX_CONFIG=""
if [ -f "repomix.config.json" ]; then
  REPOMIX_CONFIG="--config repomix.config.json"
fi

cat > snapshot.sh << HEREDOC
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
log()  { echo -e "\${GREEN}[snapshot]\${RESET} \$1"; }
warn() { echo -e "\${YELLOW}[warn]\${RESET} \$1"; }

REPO="$REPO_FULL"
XML_OUT="$XML_OUTPUT"

# Crear directorio de output si no existe
mkdir -p "\$(dirname "\$XML_OUT")"

log "Generando snapshot de \$REPO..."
log "Output: \$XML_OUT"

# Correr repomix
if command -v repomix &> /dev/null; then
  repomix $REPOMIX_CONFIG --output "\$XML_OUT"
  log "✅ XML generado: \$XML_OUT"
else
  warn "repomix no encontrado. Instalar con:"
  warn "  npm install -g repomix"
  exit 1
fi

# Mostrar tamaño del archivo generado
SIZE=\$(wc -l < "\$XML_OUT" 2>/dev/null || echo "?")
log "Archivo: \$SIZE líneas"

# Score actual desde AUDIT-LAST.md
SCORE=\$(grep "^\\*\\*Score global" .claude/AUDIT-LAST.md 2>/dev/null | head -1 || echo "ver AUDIT-LAST.md")
log "Score actual: \$SCORE"

echo ""
echo -e "\${BOLD}Próximos pasos:\${RESET}"
echo "  1. Subir \$XML_OUT a la sesión de Claude"
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
HEREDOC
chmod +x snapshot.sh
log "  snapshot.sh creado"

# ─────────────────────────────────────────────────────────────────────────────
# Actualizar CLAUDE.md para incluir instrucciones de los nuevos archivos
# ─────────────────────────────────────────────────────────────────────────────
log "Actualizando .claude/CLAUDE.md con referencia a los nuevos archivos"

# Agregar sección al inicio de CLAUDE.md si no tiene ya la referencia
if ! grep -q "CONTEXT.md" .claude/CLAUDE.md 2>/dev/null; then
  # Crear archivo temporal con la sección nueva al inicio
  TMPFILE=$(mktemp)
  cat > "$TMPFILE" << 'INNEREOF'

## Archivos de sesión (leer en este orden)

| Archivo | Cuándo leerlo | Para qué |
|---|---|---|
| `.claude/CONTEXT.md` | **Siempre primero** | Saber exactamente dónde está la sesión |
| `.claude/AUDIT-LAST.md` | Siempre | Score actual, gaps, evidencia |
| `.claude/DECISIONS-LOG.md` | Antes de proponer algo | Verificar que no se descartó ya |
| `.claude/roadmap/sprints.md` | Al planificar trabajo | Sprint activo y tareas pendientes |

**Al cerrar cada sesión:** actualizar CONTEXT.md con el estado actual (2 minutos).

---

INNEREOF

  # Insertar después de la primera línea (el título # CLAUDE.md)
  FIRST_LINE=$(head -1 .claude/CLAUDE.md)
  REST=$(tail -n +2 .claude/CLAUDE.md)
  echo "$FIRST_LINE" > .claude/CLAUDE.md
  cat "$TMPFILE" >> .claude/CLAUDE.md
  echo "$REST" >> .claude/CLAUDE.md
  rm -f "$TMPFILE"
  log "  CLAUDE.md actualizado con tabla de archivos de sesión"
else
  log "  CLAUDE.md ya tiene referencia a CONTEXT.md — sin cambios"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Verificación final
# ─────────────────────────────────────────────────────────────────────────────
step "✅ Experience setup completado para $REPO_FULL"
echo ""
echo "Archivos creados/actualizados:"
echo "  .claude/CONTEXT.md       — estado de sesión activa"
echo "  .claude/DECISIONS-LOG.md — historial de decisiones del chat"
echo "  .claude/CLAUDE.md        — actualizado con tabla de archivos"
echo "  snapshot.sh              — genera el XML con repomix"
echo ""
echo -e "${BOLD}Flujo de trabajo recomendado:${RESET}"
echo ""
echo "  Antes de una sesión:"
echo "    bash snapshot.sh"
echo "    → subir XML a Claude"
echo "    → 'Lee .claude/CONTEXT.md y continuamos'"
echo ""
echo "  Al cerrar una sesión:"
echo "    → Actualizar .claude/CONTEXT.md (objetivo, decisión, próximo paso)"
echo "    → Agregar entrada en .claude/DECISIONS-LOG.md si hubo decisiones"
echo ""
echo "  Para auditar:"
echo "    bash snapshot.sh"
echo "    → subir XML a Claude"
echo "    → 'Ejecutá el protocolo de .claude/AUDIT.md'"