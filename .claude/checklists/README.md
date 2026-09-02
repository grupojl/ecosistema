# Checklists 10/10 por capa

Cada archivo es la guía para llevar esa capa al máximo nivel.
Estado actual y nivel empresarial comparativo incluidos.

**Última actualización:** 2026-09-02

## Backend

| Capa | Archivo | Score actual | Nivel |
|---|---|---|---|
| 1 — Auth/Tenant | `backend-capa-1-auth.md` | 9/10 | Shopify plataforma+ |
| 2 — Router/Zod | `backend-capa-2-router.md` | 9/10 | Stripe |
| 3+4 — Domain/Repo | `backend-capas-3-4-domain-repo.md` | 9/10 | Stripe/Linear internos |
| 5 — AppRouter tipado | `backend-capa-5-approuter.md` | 9.5/10 | Vercel/PlanetScale |
| 6 — Multi-tenant | `backend-capa-6-multitenant.md` | 9/10 | Shopify multi-tenant |

## Frontend

| Capa | Archivo | Score actual | Nivel |
|---|---|---|---|
| 1 — Fetch tRPC | `frontend-capa-1-fetch.md` | 9.5/10 | Vercel |
| 2 — TanStack Query | `frontend-capa-2-tanstack.md` | 9/10 | Linear/Vercel |
| 3 — Zustand | `frontend-capa-3-zustand.md` | 8.5/10 | Notion/Figma |
| 4 — Presentación | `frontend-capa-4-presentacion.md` | 6/10 | Startup madura |
| 5 — Auth compartido | `frontend-capa-5-auth.md` | 9.5/10 | Stripe/Auth0 |

## Historial de scores

| Capa | Score base | Score actual | Delta |
|---|---|---|---|
| Backend 1 — Auth/Tenant | 8.5 | 9.0 | ⬆️ +0.5 |
| Backend 2 — Router/Zod | 7.0 | 9.0 | ⬆️ +2.0 |
| Backend 3+4 — Domain/Repo | 9.0 | 9.0 | — |
| Backend 5 — AppRouter | 9.5 | 9.5 | — |
| Backend 6 — Multi-tenant | 9.0 | 9.0 | — |
| Frontend 1 — Fetch tRPC | 7.5 | 9.5 | ⬆️ +2.0 |
| Frontend 2 — TanStack Query | 9.0 | 9.0 | — |
| Frontend 3 — Zustand | 8.5 | 8.5 | — |
| Frontend 4 — Presentación | 6.0 | 6.0 | — |
| Frontend 5 — Auth | 9.5 | 9.5 | — |

## Cómo usar estos archivos

1. Al iniciar una sesión de trabajo, leer el checklist de la capa que se va a trabajar
2. Los ítems `- [ ]` son tareas concretas para llegar a 10/10
3. Los ítems `- [x]` están completos — no retroceder
4. Los marcados con `S4` van al sprint S4 (tests + enforcement CI)

## Progreso hacia 10/10 — qué falta

Lo único que mueve el score en todas las capas de 9→10 es la misma cosa:

1. **Tests 85% cobertura** — todas las capas suben +0.5 con esto
2. **Enforcement CI (ESLint rules + dependency-cruiser)** — todas las capas +0.5
3. **HydrationBoundary en Server Components** — Frontend 2: 9→10
4. **Presentación** — Frontend 4: bloqueado por pagos-back y APIs courier externos

El techo actual sin tests es ~9.5/10 en las capas mejores. Tests y CI son el único camino al 10/10.

---

## Roadmap S4 — Plan hacia 10/10

Ver: `decisions/ADR-009-s4-tests-ci-hydration.md`

### Lo que mueve cada capa de 9 → 10

| Lo que falta | Capas que sube | Fase S4 |
|---|---|---|
| Tests 85% cobertura paths críticos | 1, 2, 3+4, 5, 6 backend + 1, 2, 4, 5 frontend | S4-E + S4-F |
| GitHub Actions CI gate | 5 backend + todas | S4-C |
| HydrationBoundary Server/Client | 1 + 2 frontend | S4-D |
| ESLint rules custom | 2, 3, 4, 6 | S4-G |
| dependency-cruiser rules | 1, 2, 3+4 | S4-G |
| conventions/state.md | 3 frontend | S4-B ✅ |
| Decisiones de degradación | 1 backend | S4-A |

### Sesiones estimadas por fase

```
S4-A: ✅ done  → 00-principios.md (2026-09-02)
S4-B: ✅ done   → conventions/state.md creado
S4-C: 1-2 ses   → .github/workflows/ (7 archivos)
S4-D: 1-2 ses   → HydrationBoundary en 4 páginas
S4-E: 2-3 ses   → ~25 tests backend
S4-F: 1-2 ses   → ~15 tests frontend + Playwright
S4-G: 1 sesión  → ESLint + dependency-cruiser config
Total: 8-12 sesiones
```
