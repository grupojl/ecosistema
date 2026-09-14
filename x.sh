#!/usr/bin/env bash
# =============================================================================
# x.sh — welver/ — Sincronizar scores en .claude/
#
# Problema: el score 9.1/10 registrado en ADR-009-s4 viene de ecosistema-ms
# (chatia/gRPC), no de welver. La auditoría real del código fuente da 8.8/10.
#
# Este script solo toca .claude/ — no modifica código fuente.
#
# BLOQUES:
#   BLOQUE 1 — Crea ADR-011 documentando la desincronización y el score real
#   BLOQUE 2 — Actualiza los archivos .claude/ con los scores correctos
#   BLOQUE 3 — Registra en .claude/roadmap/ el estado post-sincronización
#
# USO:
#   bash x.sh              → los 3 bloques
#   bash x.sh --bloque 1   → solo el ADR
#   bash x.sh --bloque 2   → solo actualizar scores
#   bash x.sh --bloque 3   → solo registrar estado
# =============================================================================

set -eo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()    { echo -e "${BLUE}[x.sh]${NC} $*"; }
ok()     { echo -e "${GREEN}[✓]${NC} $*"; }
warn()   { echo -e "${YELLOW}[!]${NC} $*"; }
header() {
  echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  $*${NC}"
  echo -e "${BOLD}${CYAN}══════════════════════════════════════════${NC}\n"
}

ARG1="${1:-}"
ARG2="${2:-}"
RUN_BLOQUE="${ARG1:-all}"
if [[ "$ARG1" == "--bloque" && -n "$ARG2" ]]; then
  RUN_BLOQUE="$ARG2"
fi

[[ -f "pnpm-workspace.yaml" ]] || { echo "Ejecutar desde la raíz del monorepo (welver/)"; exit 1; }

# =============================================================================
# BLOQUE 1 — Crear ADR-011 documentando la desincronización
# =============================================================================
bloque_1() {
  header "BLOQUE 1 — Creando ADR-011: score real auditado"

  mkdir -p .claude/decisions

  cat > .claude/decisions/ADR-011-score-real-auditado.md << 'EOF'
# ADR-011: Score real auditado — welver/ (2026-09-12)

**Fecha:** 2026-09-12
**Estado:** Aceptado

---

## Problema detectado

El score 9.1/10 registrado en `ADR-009-s4-tests-ci-hydration.md` y en
`ADR-009-hacia-9-5-codigo.md` **no corresponde a welver/**.

`ADR-009-hacia-9-5-codigo.md` menciona `getAgentMetrics`, `ConversationsService`,
`gRPC`, `LoggerModule`, `DT-023`, `DT-029` — esas entidades pertenecen a
**ecosistema-ms** (chatia, analytics, workers). El ADR fue pegado en welver/
por error y su score de 9.1 quedó como referencia del promedio de este repo.

`checklists/README.md` tiene la tabla de scores por capa correcta pero el
"promedio de 9.1" en `ADR-009-s4` la contradice.

---

## Auditoría real — código fuente (2026-09-12)

Basada en lectura directa del XML del repositorio. Excluyendo tests, CI y observabilidad.

| Dimensión | Evidencia en código | Score |
|-----------|--------------------|----|
| **Arquitectura/Capas** | 11 módulos sass-back con domain+repository+toEntity() ✅. catalog ecommerce-back ídem ✅. cart/orders/customers/inventory de ecommerce-back sin domain ni repository — usan PrismaService directo en el service ⚠️ | **8.5** |
| **Contratos/Tipado** | SassAppRouter + EcommerceAppRouter sin `as any` ✅. class-validator eliminado del código fuente ✅. DTOs internos (UpdateFlagDto, CreateSecretDto, etc.) no incluidos en el XML — estado no confirmado ⚠️ | **8.5** |
| **Multi-tenancy** | organizationId en todos los modelos, todos los where, todos los repository methods. @@index([organizationId]) en todos los modelos de alta frecuencia ✅ | **9.5** |
| **Calidad de código** | toEntity() en todos los repositories confirmados. @real/jsonb-cast marcado. Sin as any verificado en archivos presentes ✅ | **9.0** |
| **Auth/Seguridad** | HttpOnly cookies, TenantGuard, RolesGuard, StepUpGuard, ApiKeyGuard, CORS sin wildcard, Helmet ✅ | **9.0** |
| **Comunicación inter-servicio** | OrganizationsClientService: HTTP + Redis cache, timeout 2s, degradación documentada ✅ | **8.5** |
| **Config/Entorno** | pnpm catalog único ✅. Dockerfiles multi-stage ✅. .env.example creado (ADR-010 C3) ✅. prisma migrate deploy en entrypoint.sh (ADR-010 C2) ✅ | **8.5** |
| **Frontend** | tRPC end-to-end, TanStack Query, Zustand UI-only ✅. Presentación (Frontend 4) bloqueada estructuralmente por pagos-back y APIs courier ⚠️ | **8.5** |
| **Documentación .claude/** | Estructura completa, ADRs, checklists, contratos, convenciones ✅. ADR-009-hacia-9-5 de ecosistema-ms mezclado ⚠️ (este ADR lo corrige) | **9.0** |

**Promedio auditado: 8.8 / 10**

---

## Por qué 8.8 y no el 9.1 anterior

| Gap real | Impacto |
|----------|---------|
| cart/orders/customers/inventory sin domain+repository en ecommerce-back | Arquitectura baja de 9 a 8.5 |
| DTOs internos (UpdateFlagDto, CreateSecretDto, etc.) no confirmados en XML | Tipado baja de 9 a 8.5 |
| Frontend 4 (Presentación) estructuralmente en 6/10 | Arrastra el promedio frontend |
| ADR-009-hacia-9-5-codigo no pertenece a welver | Distorsionaba el score de referencia |

---

## Score por capa — tabla corregida

| Capa | Score anterior (checklists/README) | Score auditado real |
|------|------------------------------------|---------------------|
| Backend 1 — Auth/Tenant | 9.0 | **9.0** ✓ |
| Backend 2 — Router/Zod | 9.0 | **8.5** ↓ (DTOs internos sin confirmar) |
| Backend 3+4 — Domain/Repo | 9.0 | **8.5** ↓ (ecommerce-back parcial) |
| Backend 5 — AppRouter | 9.5 | **9.5** ✓ |
| Backend 6 — Multi-tenant | 9.0 | **9.5** ↑ (índices confirmados) |
| Frontend 1 — Fetch tRPC | 9.5 | **9.5** ✓ |
| Frontend 2 — TanStack Query | 9.0 | **9.0** ✓ |
| Frontend 3 — Zustand | 8.5 | **8.5** ✓ |
| Frontend 4 — Presentación | 6.0 | **6.0** ✓ |
| Frontend 5 — Auth | 9.5 | **9.5** ✓ |
| **Promedio** | **(9.1 — incorrecto, de ecosistema-ms)** | **8.8** |

---

## Qué se corrige en este x.sh

1. `checklists/README.md` — tabla de scores y promedio actualizados
2. `lifecycle/01-fase-desarrollo.md` — Escalón 1 estado corregido
3. `decisions/ADR-009-hacia-9-5-codigo.md` — marcado como "NO PERTENECE A WELVER"
4. `decisions/ADR-009-s4-tests-ci-hydration.md` — promedio corregido de 9.1 a 8.8
5. `roadmap/deuda-tecnica.md` — agregar gap de ecommerce-back domain/repo

## Lo que NO cambia

Los scores de las capas que están correctos se mantienen igual.
Este ADR no sube ni baja capas de forma arbitraria — documenta lo que el código dice.

## Próximo hito real

Para llegar a 9.1 **real** en welver, el trabajo concreto es:
- cart/orders/customers/inventory → domain + repository en ecommerce-back
- Confirmar DTOs internos (UpdateFlagDto, etc.) — si tienen class-validator, migrar a Zod inline

Para llegar a 9.5+:
- Lo anterior + S4 (tests 85%, enforcement CI, HydrationBoundary)
EOF

  ok "ADR-011 creado"
}

# =============================================================================
# BLOQUE 2 — Actualizar scores en los archivos .claude/ existentes
# =============================================================================
bloque_2() {
  header "BLOQUE 2 — Actualizando scores en .claude/"

  # ── 2a: checklists/README.md — corregir tabla y promedio ─────────────────
  README=".claude/checklists/README.md"
  if [[ -f "$README" ]]; then
    log "Actualizando $README ..."

    # Corregir Backend 2 — 9.0 → 8.5
    sed -i 's/| 2 — Router\/Zod | `backend-capa-2-router.md` | 9\/10 | Stripe |/| 2 — Router\/Zod | `backend-capa-2-router.md` | 8.5\/10 | Stripe |/' "$README" 2>/dev/null || true

    # Corregir Backend 3+4 — 9.0 → 8.5
    sed -i 's/| 3+4 — Domain\/Repo | `backend-capas-3-4-domain-repo.md` | 9\/10 | Stripe\/Linear internos |/| 3+4 — Domain\/Repo | `backend-capas-3-4-domain-repo.md` | 8.5\/10 | Stripe\/Linear internos |/' "$README" 2>/dev/null || true

    # Corregir Backend 6 multi-tenant — 9.0 → 9.5 (índices confirmados)
    sed -i 's/| 6 — Multi-tenant | `backend-capa-6-multitenant.md` | 9\/10 | Shopify multi-tenant |/| 6 — Multi-tenant | `backend-capa-6-multitenant.md` | 9.5\/10 | Shopify multi-tenant |/' "$README" 2>/dev/null || true

    # Corregir historial — Backend 2
    sed -i 's/| Backend 2 — Router\/Zod | 7.0 | 9.0 | ⬆️ +2.0 |/| Backend 2 — Router\/Zod | 7.0 | 8.5 | ⬆️ +1.5 |/' "$README" 2>/dev/null || true

    # Corregir historial — Backend 3+4
    sed -i 's/| Backend 3+4 — Domain\/Repo | 9.0 | 9.0 | — |/| Backend 3+4 — Domain\/Repo | 9.0 | 8.5 | ⬇️ -0.5 (ecommerce-back parcial) |/' "$README" 2>/dev/null || true

    # Corregir historial — Backend 6
    sed -i 's/| Backend 6 — Multi-tenant | 9.0 | 9.0 | — |/| Backend 6 — Multi-tenant | 9.0 | 9.5 | ⬆️ +0.5 (índices confirmados) |/' "$README" 2>/dev/null || true

    # Reemplazar el párrafo del techo actual
    sed -i 's/El techo actual sin tests es ~9\.5\/10 en las capas mejores\. Tests y CI son el único camino al 10\/10\./El promedio auditado real es 8.8\/10 (2026-09-12, ver ADR-011). El techo sin tests\/CI es ~9.5\/10 en capas individuales. El camino a 9.1 real: domain+repo en cart\/orders\/customers\/inventory (ecommerce-back)./' "$README" 2>/dev/null || true

    ok "$README actualizado"
  else
    warn "$README no encontrado"
  fi

  # ── 2b: backend-capa-2-router.md — corregir score ────────────────────────
  CAPA2=".claude/checklists/backend-capa-2-router.md"
  if [[ -f "$CAPA2" ]]; then
    log "Actualizando $CAPA2 ..."
    sed -i 's/\*\*Score actual: 9\/10 — nivel Stripe\*\*/\*\*Score actual: 8.5\/10 — nivel Stripe\*\*/' "$CAPA2" 2>/dev/null || true
    # Agregar nota de auditoría si no existe
    if ! grep -q "ADR-011" "$CAPA2" 2>/dev/null; then
      echo "" >> "$CAPA2"
      echo "## Nota de auditoría (ADR-011 — 2026-09-12)" >> "$CAPA2"
      echo "" >> "$CAPA2"
      echo "Score bajado de 9.0 a 8.5: DTOs internos (UpdateFlagDto, CreateSecretDto, CreateThemeDto," >> "$CAPA2"
      echo "CreateTemplateDto, CreateWebhookDto) no están en el XML auditado — no se puede confirmar" >> "$CAPA2"
      echo "si tienen class-validator o son interfaces puras. Hasta confirmarlo, el score refleja la duda." >> "$CAPA2"
      echo "Verificar: \`grep -r \"class-validator\" realsass-sass-back/src --include=\"*.ts\"\`" >> "$CAPA2"
    fi
    ok "$CAPA2 actualizado"
  else
    warn "$CAPA2 no encontrado"
  fi

  # ── 2c: backend-capas-3-4-domain-repo.md — corregir score ────────────────
  CAPA34=".claude/checklists/backend-capas-3-4-domain-repo.md"
  if [[ -f "$CAPA34" ]]; then
    log "Actualizando $CAPA34 ..."
    sed -i 's/\*\*Score actual: 9\/10 — nivel Stripe\/Linear internos\*\*/\*\*Score actual: 8.5\/10 — nivel Stripe\/Linear internos\*\*/' "$CAPA34" 2>/dev/null || true
    if ! grep -q "ADR-011" "$CAPA34" 2>/dev/null; then
      echo "" >> "$CAPA34"
      echo "## Nota de auditoría (ADR-011 — 2026-09-12)" >> "$CAPA34"
      echo "" >> "$CAPA34"
      echo "Score bajado de 9.0 a 8.5: cart, orders, customers, inventory en ecommerce-back" >> "$CAPA34"
      echo "usan PrismaService directo en el service — sin domain/ ni repository/." >> "$CAPA34"
      echo "Confirmado en código fuente: CartService, OrdersService, CustomersService importan" >> "$CAPA34"
      echo "\`PrismaService\` directamente. Solo catalog/ tiene el molde completo." >> "$CAPA34"
    fi
    ok "$CAPA34 actualizado"
  else
    warn "$CAPA34 no encontrado"
  fi

  # ── 2d: backend-capa-6-multitenant.md — subir score a 9.5 ───────────────
  CAPA6=".claude/checklists/backend-capa-6-multitenant.md"
  if [[ -f "$CAPA6" ]]; then
    log "Actualizando $CAPA6 ..."
    sed -i 's/\*\*Score actual: 9\/10 — nivel Shopify multi-tenant\*\*/\*\*Score actual: 9.5\/10 — nivel Shopify multi-tenant\*\*/' "$CAPA6" 2>/dev/null || true
    if ! grep -q "ADR-011" "$CAPA6" 2>/dev/null; then
      echo "" >> "$CAPA6"
      echo "## Nota de auditoría (ADR-011 — 2026-09-12)" >> "$CAPA6"
      echo "" >> "$CAPA6"
      echo "Score subido de 9.0 a 9.5: auditoría del schema Prisma confirma @@index([organizationId])" >> "$CAPA6"
      echo "en todos los modelos de alta frecuencia de ambos backends. No era un gap pendiente." >> "$CAPA6"
    fi
    ok "$CAPA6 actualizado"
  else
    warn "$CAPA6 no encontrado"
  fi

  # ── 2e: lifecycle/01-fase-desarrollo.md — corregir estado Escalón 1 ──────
  FASE1=".claude/lifecycle/01-fase-desarrollo.md"
  if [[ -f "$FASE1" ]]; then
    log "Actualizando $FASE1 ..."

    # Escalón 1 — el estado decía 9/10 pero tenía bloqueantes activos que ya se resolvieron
    sed -i 's/### Estado actual — 9\/10/### Estado actual — 8.5\/10/' "$FASE1" 2>/dev/null || true

    # Corregir los bloqueantes que ya no existen según el código real
    sed -i 's/| tRPC exclusivo ecommerce-back | ⚠️ BLOQUEANTE | Controllers REST legacy pendientes de eliminar (ADR-005) |/| tRPC exclusivo ecommerce-back | ✅ | Controllers REST eliminados — solo app.controller.ts (hello) |/' "$FASE1" 2>/dev/null || true
    sed -i 's/| DTOs class-validator sass-back | ⚠️ Pendiente | Sobreviven en controllers REST legacy a eliminar |/| DTOs class-validator sass-back | ✅ | Eliminados — organizations.service usa UpdateOrganizationInput (ADR-010 C1) |/' "$FASE1" 2>/dev/null || true
    sed -i 's/| ecommerce-front tRPC server caller | ⚠️ BLOQUEANTE | lib\/store\/client.ts usa fetch REST (ADR-006) |/| ecommerce-front tRPC server caller | ✅ | lib\/store\/client.ts usa createStoreCaller() tRPC (ADR-006 resuelto) |/' "$FASE1" 2>/dev/null || true

    # Actualizar prisma migrate deploy e índices que ya se resolvieron
    sed -i 's/| Índices en `organizationId` | ⚠️ Verificar | Confirmar `@@index(\[organizationId\])` en modelos de alta frecuencia |/| Índices en `organizationId` | ✅ | Confirmados en ambos schemas — ADR-011 |/' "$FASE1" 2>/dev/null || true
    sed -i 's/| `prisma migrate deploy` en Dockerfile | ⚠️ Verificar | Confirmar que migra antes del start, no después |/| `prisma migrate deploy` en Dockerfile | ✅ | entrypoint.sh en ambos backends — ADR-010 C2 |/' "$FASE1" 2>/dev/null || true

    ok "$FASE1 actualizado"
  else
    warn "$FASE1 no encontrado"
  fi

  # ── 2f: ADR-009-hacia-9-5-codigo.md — marcar como NO pertenece a welver ──
  ADR009V1=".claude/decisions/ADR-009-hacia-9-5-codigo.md"
  if [[ -f "$ADR009V1" ]]; then
    log "Marcando $ADR009V1 como perteneciente a ecosistema-ms ..."
    # Insertar aviso al inicio del archivo
    TMPFILE=$(mktemp)
    cat > "$TMPFILE" << 'ENDWARN'
> ⚠️ **ESTE ADR NO PERTENECE A WELVER/**
> Fue pegado por error desde `ecosistema-ms`. Las entidades que menciona
> (`getAgentMetrics`, `ConversationsService`, `gRPC`, `DT-023`, `DT-029`,
> `LoggerModule`) no existen en welver/. El score 9.1 que proyecta es el
> de ecosistema-ms, no el de este repositorio.
> Score real de welver/ auditado: **8.8/10** — ver `ADR-011-score-real-auditado.md`

---

ENDWARN
    cat "$ADR009V1" >> "$TMPFILE"
    mv "$TMPFILE" "$ADR009V1"
    ok "$ADR009V1 marcado con aviso"
  else
    warn "$ADR009V1 no encontrado"
  fi

  # ── 2g: ADR-009-s4 — corregir la línea del 9.1 ───────────────────────────
  ADR009S4=".claude/decisions/ADR-009-s4-tests-ci-hydration.md"
  if [[ -f "$ADR009S4" ]]; then
    log "Corrigiendo promedio en $ADR009S4 ..."
    sed -i 's/el código base en un promedio de 9\.1\/10 sobre 10 capas,/el código base en un promedio auditado de 8.8\/10 sobre 10 capas (ver ADR-011 — el 9.1 era de ecosistema-ms),/' "$ADR009S4" 2>/dev/null || true
    ok "$ADR009S4 corregido"
  else
    warn "$ADR009S4 no encontrado"
  fi

  # ── 2h: roadmap/deuda-tecnica.md — agregar el gap de domain/repo ─────────
  DEUDA=".claude/roadmap/deuda-tecnica.md"
  if [[ -f "$DEUDA" ]]; then
    log "Agregando gap domain/repo ecommerce-back en $DEUDA ..."
    if ! grep -q "DT-ECO-01" "$DEUDA" 2>/dev/null; then
      cat >> "$DEUDA" << 'ENDDEUDA'

---

## Gap identificado en auditoría ADR-011 (2026-09-12)

| ID | Gap | Módulos afectados | Impacto en score |
|----|-----|-------------------|-----------------|
| DT-ECO-01 | cart, orders, customers, inventory sin domain/ ni repository/ | realsass-ecommerce-back | Arquitectura: 8.5 → 9.0 cuando se resuelva |
| DT-ECO-02 | DTOs internos no auditados (UpdateFlagDto, CreateSecretDto, etc.) | realsass-sass-back | Contratos/Tipado: 8.5 → 9.0 si no tienen class-validator |

### DT-ECO-01 — Cómo resolverlo

Seguir el molde de `src/catalog/` (el único módulo con patrón completo en ecommerce-back):

```
cart/
├── domain/
│   ├── cart.entity.ts       # tipos puros, sin Prisma
│   └── cart.errors.ts
├── repository/
│   ├── cart.repository.interface.ts
│   └── prisma-cart.repository.ts   # único lugar con PrismaService + toEntity()
├── cart.service.ts          # inyecta ICartRepository via @Inject(TOKEN)
└── cart.module.ts           # binding { provide: TOKEN, useClass: PrismaCartRepo }
```

Ídem para orders, customers, inventory.

### DT-ECO-02 — Cómo verificarlo

```bash
grep -r "class-validator" realsass-sass-back/src --include="*.ts"
# Si da 0: los DTOs son interfaces puras → score sube a 9.0
# Si da N: migrar esos DTOs a Zod inline en los routers
```
ENDDEUDA
      ok "$DEUDA actualizado con DT-ECO-01 y DT-ECO-02"
    else
      warn "DT-ECO-01 ya existe en $DEUDA"
    fi
  else
    warn "$DEUDA no encontrado"
  fi

  ok "BLOQUE 2 completado"
}

# =============================================================================
# BLOQUE 3 — Registrar estado post-sincronización
# =============================================================================
bloque_3() {
  header "BLOQUE 3 — Registrando estado post-sincronización"

  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  mkdir -p .claude/roadmap

  # Detectar qué se aplicó
  ADR011=$( [[ -f ".claude/decisions/ADR-011-score-real-auditado.md" ]] && echo "✅" || echo "❌" )
  README_OK=$( grep -q "8\.5\/10" ".claude/checklists/README.md" 2>/dev/null && echo "✅" || echo "❌" )
  ADR009_WARN=$( grep -q "NO PERTENECE A WELVER" ".claude/decisions/ADR-009-hacia-9-5-codigo.md" 2>/dev/null && echo "✅" || echo "❌" )
  ADR009S4_OK=$( grep -q "8\.8\/10" ".claude/decisions/ADR-009-s4-tests-ci-hydration.md" 2>/dev/null && echo "✅" || echo "❌" )
  DEUDA_OK=$( grep -q "DT-ECO-01" ".claude/roadmap/deuda-tecnica.md" 2>/dev/null && echo "✅" || echo "❌" )

  cat > .claude/roadmap/sincronizacion-scores-2026-09-12.md << ENDSYNC
# Sincronización de scores — welver/
# Ejecutado: ${TIMESTAMP}

## Problema resuelto

El score 9.1/10 que aparecía en ADR-009-s4 y ADR-009-hacia-9-5-codigo
pertenecía a **ecosistema-ms**, no a welver/. Se pegó por error.

## Score correcto post-auditoría

| Capa | Score anterior (en .claude/) | Score auditado real |
|------|------------------------------|---------------------|
| Backend 1 — Auth/Tenant | 9.0 | **9.0** |
| Backend 2 — Router/Zod | 9.0 | **8.5** |
| Backend 3+4 — Domain/Repo | 9.0 | **8.5** |
| Backend 5 — AppRouter | 9.5 | **9.5** |
| Backend 6 — Multi-tenant | 9.0 | **9.5** |
| Frontend 1 — Fetch tRPC | 9.5 | **9.5** |
| Frontend 2 — TanStack Query | 9.0 | **9.0** |
| Frontend 3 — Zustand | 8.5 | **8.5** |
| Frontend 4 — Presentación | 6.0 | **6.0** |
| Frontend 5 — Auth | 9.5 | **9.5** |
| **Promedio** | **9.1 (incorrecto)** | **8.8** |

## Archivos actualizados

| Archivo | Estado |
|---------|--------|
| .claude/decisions/ADR-011-score-real-auditado.md (nuevo) | ${ADR011} |
| .claude/checklists/README.md | ${README_OK} |
| .claude/decisions/ADR-009-hacia-9-5-codigo.md (aviso) | ${ADR009_WARN} |
| .claude/decisions/ADR-009-s4-tests-ci-hydration.md | ${ADR009S4_OK} |
| .claude/roadmap/deuda-tecnica.md | ${DEUDA_OK} |

## Qué hace falta para llegar al 9.1 real

1. **DT-ECO-01** — domain+repository en cart, orders, customers, inventory
   → sube Backend 3+4 de 8.5 a 9.0
2. **DT-ECO-02** — confirmar/migrar DTOs internos (UpdateFlagDto, etc.)
   → sube Backend 2 de 8.5 a 9.0
3. Con esos dos: promedio sería ~9.05/10

## Para el 9.5 real

Lo anterior + S4: tests 85%, GitHub Actions CI gate, HydrationBoundary.
ENDSYNC

  ok ".claude/roadmap/sincronizacion-scores-2026-09-12.md creado"

  # Resumen final
  echo ""
  header "RESUMEN FINAL"
  echo ""
  echo -e "  Score anterior en .claude/: ${RED}9.1/10${NC} (de ecosistema-ms — incorrecto)"
  echo -e "  Score real auditado:        ${GREEN}8.8/10${NC} (welver/ — código fuente real)"
  echo ""
  echo -e "  ${ADR011} ADR-011 creado"
  echo -e "  ${README_OK} checklists/README.md actualizado"
  echo -e "  ${ADR009_WARN} ADR-009-hacia-9-5 marcado como ecosistema-ms"
  echo -e "  ${ADR009S4_OK} ADR-009-s4 corregido (9.1 → 8.8)"
  echo -e "  ${DEUDA_OK} deuda-tecnica.md con DT-ECO-01 y DT-ECO-02"
  echo ""
  echo -e "  ${YELLOW}→ Para llegar a 9.1 real: DT-ECO-01 + DT-ECO-02${NC}"
  echo ""
  ok "BLOQUE 3 completado"
}

# =============================================================================
# EJECUTAR
# =============================================================================
case "$RUN_BLOQUE" in
  "1") bloque_1 ;;
  "2") bloque_2 ;;
  "3") bloque_3 ;;
  "all"|*)
    bloque_1
    echo ""
    bloque_2
    echo ""
    bloque_3
    ;;
esac 