# ADR-010: Internal API — endpoints /internal/organizations para superadmin

**Fecha:** 2026-09-07
**Estado:** Aceptado — implementado y verificado en XML 2026-09-07
**Repo:** grupojl/welver

---

## Contexto

El superadmin (grupojl/grupojl-control) tiene el `WelverClient` con los
endpoints `/internal/organizations/*` mockados (ADR-003 grupojl-control).
Para bajar el mock y conectar con datos reales, `realsass-sass-back` debe
exponer esos endpoints.

El contrato exacto está en `.claude/contracts/internal-api.md` del superadmin.

---

## Decisión

Agregar en `realsass-sass-back`:

1. **`InternalApiKeyGuard`** en `src/common/guards/internal-api-key.guard.ts`
   Verifica el header `x-internal-api-key` contra `INTERNAL_API_KEY`.
   Fail-secure: si la env var no está → rechaza todo (401).
   Diferente del `api-key.guard.ts` existente (ese es para tenants externos).

2. **`GET /api/v1/health/extended`** — sin auth, público.
   Shape idéntico al de ecosistema-ms para que el superadmin los consuma igual.
   El `/api/v1/health` original (Railway) no se modifica.

3. **`InternalModule`** en `src/internal/` con 4 endpoints:
   ```
   GET  /internal/organizations                         → lista con filtros
   GET  /internal/organizations/:id                     → detalle
   POST /internal/organizations/:id/suspend             → acción
   POST /internal/organizations/:id/unsuspend           → acción
   ```

4. **Campo `status` en modelo `Organization`** (Prisma):
   El schema actual no tiene `status`. El superadmin lo necesita para filtrar
   y mostrar ACTIVE / SUSPENDED / BLOCKED.
   Migración: `pnpm --filter realsass-sass-back prisma migrate dev --name add-org-status`

---

## Por qué InternalModule en sass-back y no en ecommerce-back

El superadmin gestiona organizaciones como entidades de identidad (quién puede
usar el sistema, plan, estado de suspensión). Esa lógica vive en sass-back.
ecommerce-back gestiona tienda — no sabe nada de planes ni suspensiones.

---

## Por qué no reutilizar OrganizationsService existente

`OrganizationsService` está diseñado para operaciones de la org propia del
usuario autenticado (Firebase). Los endpoints internos del superadmin necesitan
acceso cross-org sin Firebase. Usar `PrismaService` directamente en los
controllers internos es correcto — estos controllers no son de negocio de la org,
son de administración global. No viola Domain/Repository porque no son el dominio
del tenant.

---

## Relación con el esquema Organization

```prisma
model Organization {
  // ... campos existentes ...
  status  OrgStatus  @default(ACTIVE)  ← NUEVO
}

enum OrgStatus {
  ACTIVE
  SUSPENDED
  BLOCKED
}
```

La suspensión es reversible. El bloqueo es permanente (uso futuro).
El guard de auth del sass-back debe verificar `status !== SUSPENDED` en el
`TenantGuard` — agregar como DT-016 (deuda consciente, no bloquea este ADR).

---

## Auth del endpoint interno

```
Header:   x-internal-api-key: <INTERNAL_API_KEY>
Env var:  INTERNAL_API_KEY
Fallo:    401 Unauthorized
```

Misma clave que en ecosistema-ms — un único secreto compartido con el superadmin.
En Railway: configurar la misma clave en ambos proyectos.

---

## Variables de entorno nuevas

```
INTERNAL_API_KEY=<shared-with-superadmin>
```

En el superadmin:
```
WELVER_INTERNAL_URL=http://realsass-sass-back.railway.internal:3000
INTERNAL_API_KEY=<misma-clave>
```

---

## Consecuencias

**Ganancia:** WelverClient del superadmin puede conectarse a datos reales
configurando `WELVER_INTERNAL_URL` — sin tocar código.

**Deuda consciente (DT-016):** `TenantGuard` no verifica `org.status`.
Una org suspendida puede seguir autenticándose mientras no se agregue esa
verificación. Prioridad: S4 (antes de tener suspensiones reales en prod).

**Migración requerida:** el campo `status` en Organization requiere ejecutar
`prisma migrate dev` localmente y `prisma migrate deploy` en Railway.
