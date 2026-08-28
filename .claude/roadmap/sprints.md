# Roadmap de sprints

## S1: fusionar realsass-config-back → realsass-sass-back + adaptar tRPC

**Estado: ✅ CERRADO.**
- Schema de sass-back tiene todos los modelos de config fusionados
- TenantGuard local resuelve Prisma directo
- Módulos config-* completos con controllers/services propios
- auth.* router tRPC: ✅ me, sync, refreshClaims, selectRole

## S2: fusionar realsass-dashboard-back → realsass-ecommerce-back

**Estado: ✅ CERRADO.**
realsass-dashboard-back eliminado tras fusionarse en realsass-ecommerce-back.

## S3: implementar @real/auth-client, @real/ui + TanStack Query en fronts

**Estado: ✅ CERRADO.**

- `@real/auth-client`: ✅ completo en los 3 fronts
- `@real/ui`: ✅ 33 componentes shadcn — fuente única, components/ui/ eliminados
- `@real/auth-server`: ✅ SessionService + AuthSessionController (ADR-004)
- `@real/trpc`: ✅ SassAppRouter + EcommerceAppRouter tipados
- Auth cookies HttpOnly (ADR-004): ✅
- TanStack Query: ✅ en los 3 fronts
- Zustand: ✅ useShoppingBagStore + useSidebarStore + useUIStore
- auth.* router tRPC: ✅

## S4: tests 85% + OpenTelemetry

**Estado: ❌ no iniciado.**
Dependencias en catalog: `@opentelemetry/sdk-node`,
`@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-prometheus`.

## Deuda técnica resuelta en sesiones 2026-08-28

**Backend sass-back — Capas 3+4 Domain/Repository (11 módulos):**
- affiliate, collaborators, config-audit, config-flags, config-quotas
- config-secrets, config-templates, config-themes, config-webhooks
- organizations, users
Cada módulo tiene: domain/*.entity.ts + repository/interface + repository/prisma-impl
Los services inyectan su repository via @Inject(TOKEN) — sin this.prisma directo.

**Frontend:**
- components/ui/ eliminados de los 3 fronts → imports a @real/ui
- lib/utils.ts centralizado → cn() desde @real/ui
- stores/ creados en los 3 fronts (Zustand UI pura)
- use-config.ts tipado completo sin any
- app/profile/config/page.tsx migrado a TanStack Query
