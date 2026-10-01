# Fase 1 — Desarrollo
## Escalones 1, 2, 4 — La base que hace cosmético todo lo demás

**Estado:** ✅ COMPLETA — cerrada 2026-09-02
**Cuándo:** Completado antes de pasar a Fase 2
**Referentes:** Stripe (código) · Twelve-Factor App (config) · PlanetScale (DB)

---

## Escalón 1 — Código: Arquitectura y Calidad ✅

| Ítem | Estado | Detalle |
|------|--------|---------|
| TypeScript strict | ✅ | ADR-007 — `toEntity()` en 11 repositories de sass-back |
| Domain/Repository sass-back | ✅ | 11 módulos con domain/ + repository/ |
| Domain/Repository ecommerce-back | ✅ | cart, orders, customers, inventory migrados (ADR-012) |
| tRPC exclusivo sass-back | ✅ | 11 routers, Zod inline, sin DTOs class-validator |
| tRPC exclusivo ecommerce-back | ✅ | Controllers REST eliminados — solo app.controller.ts (hello) |
| DTOs class-validator | ✅ | Eliminados en ambos backs |
| Multi-tenant organizationId | ✅ | Respetado en todos los modelos y queries |
| Sin cross-service imports | ✅ | Dockerfile de cada servicio solo copia su carpeta + packages/ |
| Sin `as any` repositories | ✅ | ADR-007 implementado |
| ecommerce-front tRPC server caller | ✅ | lib/store/client.ts usa createStoreCaller() tRPC |
| 0 fetch REST de negocio en fronts | ✅ | Excepción documentada: POST/DELETE /auth/session |

---

## Escalón 2 — Configuración y Entorno ✅

| Ítem | Estado | Detalle |
|------|--------|---------|
| Catalog único pnpm | ✅ | `catalog:` default — sin named catalogs (ADR-002) |
| Variables por Dockerfile | ✅ | `ARG`/`ENV` declarados en cada Dockerfile |
| Sin `.env` compartido | ✅ | Cada servicio declara sus propias vars |
| CORS explícito | ✅ | `ALLOWED_ORIGINS` sin wildcard — sass-back no arranca sin él |
| Secretos fuera del código | ✅ | Firebase private key via Railway env vars |
| pnpm 10 + Node 24 | ✅ | Documentado en conventions/entorno.md |
| `.env.example` en 5 servicios | ✅ | Completado en sesión 2026-09-30 (apply-fase2.sh) |

### Pendiente diferido a S4
- [ ] Validación de env vars al arranque en `main.ts` — falla con mensaje claro si falta una var

---

## Escalón 4 — Base de Datos ✅

| Ítem | Estado | Detalle |
|------|--------|---------|
| Prisma ORM | ✅ | Schema declarativo, dos DBs separadas |
| Migraciones versionadas | ✅ | `prisma/migrations/` en cada back |
| DB separada por back | ✅ | `DATABASE_URL` propia por servicio |
| Multi-tenant `organizationId` | ✅ | En todos los modelos con datos de negocio |
| Índices en `organizationId` | ✅ | Confirmados en ambos schemas — ADR-011 |
| `prisma migrate deploy` en Dockerfile | ✅ | entrypoint.sh en ambos backends |
| Backups documentados | ✅ | roadmap/deuda-tecnica.md — DB-01 |
| Pool de conexiones documentado | ✅ | roadmap/deuda-tecnica.md — DB-02 |

---

## Criterios de cierre cumplidos

- ✅ 0 fetch REST de negocio en real-ecommerce-front
- ✅ lib/ecommerce/index.ts eliminado
- ✅ Controllers REST legacy de ecommerce-back eliminados
- ✅ customer.router.ts completo (resolveStore, identify, getProducts, getProduct, cart.*, checkout)
- ✅ lib/store/client.ts y resolver.ts usando tRPC server caller
- ✅ `.env.example` en los 5 servicios
- ✅ Índices Prisma auditados
- ✅ Deuda técnica DB documentada

---

**→ Fase 2 — Estabilización:** ✅ COMPLETA — ver `02-fase-estabilizacion.md`
