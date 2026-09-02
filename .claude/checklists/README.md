# Checklists 10/10 por capa

Cada archivo es la guía para llevar esa capa al máximo nivel.
Estado actual y nivel empresarial comparativo incluidos.

## Backend

| Capa | Archivo | Score actual | Nivel |
|---|---|---|---|
| 1 — Auth/Tenant | `backend-capa-1-auth.md` | 8.5/10 | Shopify plataforma |
| 2 — Router/Zod | `backend-capa-2-router.md` | 7/10 | Rappi/MercadoLibre |
| 3+4 — Domain/Repo | `backend-capas-3-4-domain-repo.md` | 9/10 | Stripe/Linear internos |
| 5 — AppRouter tipado | `backend-capa-5-approuter.md` | 9.5/10 | Vercel/PlanetScale |
| 6 — Multi-tenant | `backend-capa-6-multitenant.md` | 9/10 | Shopify multi-tenant |

## Frontend

| Capa | Archivo | Score actual | Nivel |
|---|---|---|---|
| 1 — Fetch tRPC | `frontend-capa-1-fetch.md` | 7.5/10 | Notion/Linear |
| 2 — TanStack Query | `frontend-capa-2-tanstack.md` | 9/10 | Linear/Vercel |
| 3 — Zustand | `frontend-capa-3-zustand.md` | 8.5/10 | Notion/Figma |
| 4 — Presentación | `frontend-capa-4-presentacion.md` | 6/10 | Startup madura |
| 5 — Auth compartido | `frontend-capa-5-auth.md` | 9.5/10 | Stripe/Auth0 |

## Cómo usar estos archivos

1. Al iniciar una sesión de trabajo, leer el checklist de la capa que se va a trabajar
2. Los ítems `- [ ]` son tareas concretas para llegar a 10/10
3. Los ítems `- [x]` están completos — no retroceder
4. Los marcados con `S4` van al sprint S4 (tests + enforcement CI)
5. Los marcados como `BLOQUEANTE` deben resolverse antes que cualquier S4

## Progreso hacia 10/10

Las tareas que más impacto tienen en el score global (en orden):

1. **Eliminar controllers REST ecommerce-back** (Capa 2 back: 7→9)
2. **ecommerce-front tRPC server caller** (Capa 1 front: 7.5→9.5)
3. **Tests 85% cobertura** (todas las capas: +0.5 cada una)
4. **Enforcement CI (dependency-cruiser + ESLint)** (todas: +0.5 cada una)
5. **HydrationBoundary en Server Components** (Capa 2 front: 9→10)
