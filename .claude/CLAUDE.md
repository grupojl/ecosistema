# CLAUDE.md — Punto de entrada de cada sesión en welver/

## Archivos de sesión (leer en este orden)

| Archivo | Cuándo leerlo | Para qué |
|---|---|---|
| `.claude/CONTEXT.md` | **Siempre primero** | Saber exactamente dónde está la sesión |
| `.claude/AUDIT-LAST.md` | Siempre | Score actual, gaps, evidencia |
| `.claude/DECISIONS-LOG.md` | Antes de proponer algo | Verificar que no se descartó ya |
| `.claude/roadmap/sprints.md` | Al planificar trabajo | Sprint activo y tareas pendientes |

**Al cerrar cada sesión:** actualizar CONTEXT.md con el estado actual (2 minutos).

---


## Leer SIEMPRE al inicio de una sesión

1. **`.claude/AUDIT-LAST.md`** — Estado actual del repo con scores y gaps
2. **`.claude/checklists/README.md`** — Scores por capa y pendientes
3. **El ADR más reciente en `.claude/decisions/`** — Último cambio de arquitectura

Estos tres archivos evitan que Claude asuma el estado del código. Sin leerlos,
cualquier recomendación parte de un estado que puede estar desactualizado.

---

## Contexto del proyecto

**Repo:** grupojl/welver
**Tipo:** Monorepo SaaS multi-tenant con storefront público

| Servicio | Rol | Puerto |
|---|---|---|
| `realsass-sass-back` | Identidad, orgs, config, auditoría | 3000 |
| `realsass-ecommerce-back` | Catálogo, stock, órdenes, carrito | 3001 |
| `realsass-sass-front` | Dashboard dueños (Next.js) | 3000 |
| `realsass-dashboard-front` | Dashboard colaboradores (Next.js) | 3000 |
| `real-ecommerce-front` | Storefront público (Next.js SSG/ISR) | 3000 |
| `packages/auth-server` | Guards, decorators, TenantContext (NestJS) | — |
| `packages/auth-client` | Firebase auth, apiFetch, AppError | — |
| `packages/trpc` | Contratos SassAppRouter + EcommerceAppRouter | — |
| `packages/ui` | shadcn/ui compartidos | — |

**Stack:** NestJS 11 · Prisma 7 · PostgreSQL · Redis · BullMQ · Firebase Admin
**Frontend:** Next.js 15 · React 19 · TailwindCSS 4 · TanStack Query · Zustand
**Auth:** Firebase Authentication (client) + Session Cookies HttpOnly (ADR-004)
**Inter-servicios:** tRPC 11 end-to-end tipado

---

## CRÍTICO — Entorno

- Windows + Git Bash · Node 24.14.0 · pnpm 10.30.3 · Deploy: Railway
- Named catalogs (`catalog:backend`, etc.) **NO funcionan** → usar solo `catalog:` default
- Build context de Docker = raíz del monorepo (siempre `/`)

---

## Convenciones irrenunciables

- `any` implícito = bug de diseño — pedir justificación antes de aceptar
- `class-validator` en código nuevo = prohibido — usar Zod inline
- Query Prisma sin `organizationId` en el `where` = bug de seguridad crítico
- `prisma migrate deploy` debe correr antes del servidor en Dockerfiles de backs
- Redis keys de negocio deben incluir `organizationId` como prefijo (ver `conventions/cache-keys.md`)
- Lógica de negocio en `domain/` + `application/`, nunca en controllers ni componentes UI

---

## Cómo auditar el repo

Decirle a Claude: **"Ejecutá el protocolo de .claude/AUDIT.md"**

El protocolo lee el código real (no la documentación) y produce scores con
evidencia concreta. Al terminar, actualiza `.claude/AUDIT-LAST.md`.

---

## Cómo generar un cambio production-ready

1. Claude lee `AUDIT-LAST.md` para saber el estado actual
2. Claude identifica el gap a resolver y crea/actualiza el ADR correspondiente
3. Claude genera el `.sh` con BLOQUE 1 (docs) + BLOQUE 2 (código)
4. Después de ejecutar el `.sh`, actualizar el XML con repomix y pedir nueva auditoría

---

## ADRs activos

| ADR | Decisión | Estado |
|---|---|---|
| ADR-001 | Permisos JSONB en Collaborator | ✅ Implementado |
| ADR-002 | Catalog único pnpm | ✅ Implementado |
| ADR-003 | Custom claims Firebase | ✅ Implementado |
| ADR-004 | Auth session cookies HttpOnly | ✅ Implementado |
| ADR-005 | REST → tRPC en ecommerce-back | ✅ Implementado |
| ADR-006 | Front cleanup — lib/store tRPC | ✅ Implementado |
| ADR-007 | Eliminar as any / toEntity() | ✅ Implementado |
| ADR-008 | Eliminar componentes legacy storefront | ✅ Implementado |
| ADR-009 | S4 — tests, CI, HydrationBoundary | 🟡 S4-C completado, S4-D+E pendientes |
| ADR-011 | Plan 10/10 código y estructura | ✅ Implementado |
| ADR-012 | Código definitivo — header fix, rate limiting, CI | ✅ Implementado |
