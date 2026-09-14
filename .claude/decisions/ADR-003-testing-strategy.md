# ADR-003: Estrategia de tests — cobertura mínima en paths críticos

**Fecha:** 2026-09-12
**Estado:** Aceptado
**Aplica a:** grupojl-control-backend + grupojl-control-frontend

## Contexto

El repositorio tiene Jest configurado en el backend y Vitest disponible, pero
cero specs implementados. Para un sistema de administración con acciones
destructivas sobre entidades de negocio (suspend org, block user, payment retry),
la ausencia de tests es un riesgo de producción, no solo deuda técnica.

## Decisión

### Backend — Jest + Supertest

**Cobertura mínima obligatoria (85%) en:**
- `audit/audit.service.ts` — toda lógica de audit trail
- `common/guards/admin.guard.ts` — toda lógica de allowlist
- `common/guards/firebase-auth.guard.ts` — validación de tokens
- `common/integrations/base.client.ts` — fetchWithCache, manejo de errores

**Integration tests obligatorios por módulo nuevo:**
- `GET /health` → 200 con db:true, redis:true
- `GET /ecosystems` sin token → 401
- `GET /ecosystems` con UID no autorizado → 403
- `GET /ecosystems` con UID autorizado → 200

### Frontend — Vitest + React Testing Library

**Unit tests obligatorios:**
- `hooks/use-command-center.ts` — buildAlerts, ordenamiento por severidad
- `components/shared/confirm-dialog.tsx` — reason validation, botón disabled < 10 chars

**Playwright E2E (smoke):**
- Login con Google → redirige a /dashboard
- Dashboard con 0 alertas → muestra EmptyState "Todo operativo"

### Estructura de tests

```
grupojl-control-backend/src/
  audit/
    audit.service.spec.ts       ← unit
    audit.controller.spec.ts    ← integration (Supertest)
  common/
    guards/
      admin.guard.spec.ts       ← unit
    integrations/
      base.client.spec.ts       ← unit con Redis mock
```

## Reglas permanentes

1. Todo módulo nuevo incluye: spec de service (unit) + spec de controller (integration)
2. PR que baja cobertura de paths críticos por debajo de 85% → bloqueado en CI
3. Los mocks de Integration Clients van en `__mocks__/` al nivel del módulo
4. Tests de guards sin Firebase real — mock de `firebase-admin` en jest.config

## Consecuencias

**Ganancia:** AdminGuard con bug detectado en CI, no en producción.
**Costo:** ~2 sesiones para llevar cobertura a 85% en paths críticos actuales.
