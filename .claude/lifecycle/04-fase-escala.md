# Fase 4 — Escala + S4
## Escalones 9, 11, 12, 13 + Tests/CI

**Estado:** 🔴 EN CURSO — código iniciado 2026-09-30
**Referentes:** AWS (DR) · Linear/Figma (UX) · Netflix (Chaos) · Airbnb/Uber (FinOps)

---

## Completado en sesión 2026-09-30

| Task | Estado | Detalle |
|------|--------|---------|
| E12-02 Health 3 estados | ✅ | ok/degraded/down + LATENCY_WARN_MS=200 en ambos backs |
| E11-05 ISR storefront | ✅ | revalidate=3600 layout, =1800 productos page |
| S4-D HydrationBoundary | ✅ | 4 páginas con prefetch real + server callers |
| E11-04 Optimistic updates | ✅ | onMutate+rollback en useUpdateProduct y useDeleteProduct |
| S4-G ESLint | ✅ | eslint.config.mjs en los 5 servicios |

---

## Escalón 9 — Disaster Recovery ⚪

Acciones manuales en Railway UI — no requieren código:

- [ ] **[E9-01]** Definir RTO/RPO por servicio y documentar
- [ ] **[E9-02]** Probar restauración de backup en staging → documentar resultado
- [ ] **[E9-03]** Confirmar Redis AOF activo en Railway → documentar
- [ ] **[E9-04]** Runbook de recuperación — ya existe en roadmap/runbook-incidente.md ✅

---

## Escalón 11 — Rendimiento ⏳

| Ítem | Estado | Detalle |
|------|--------|---------|
| HydrationBoundary 4 páginas | ✅ | S4-D completado 2026-09-30 |
| ISR ecommerce-front | ✅ | revalidate en layout + productos |
| Medir latencias p50/p95/p99 | ⏳ | Requiere tráfico real en producción |
| Paginación cursor adminCatalog | ⏳ | adminCatalog.list sin cursor pagination aún |
| Optimistic updates | ✅ | useUpdateProduct + useDeleteProduct |

---

## Escalón 12 — Alta Disponibilidad ⏳

| Ítem | Estado | Detalle |
|------|--------|---------|
| Health 3 estados | ✅ | ok/degraded/down en ambos backs 2026-09-30 |
| 2+ réplicas en Railway | ⏳ | Acción manual en Railway UI |
| Chaos drill sass-back | ⏳ | Requiere producción real |
| Chaos drill Redis | ⏳ | Requiere producción real |

---

## Escalón 13 — FinOps ⚪

Todo en Railway dashboard — acciones manuales:

- [ ] Dashboard de costos por servicio
- [ ] Escalado automático configurado
- [ ] Costo marginal documentado

---

## S4 — Tests 85% + CI (próxima prioridad de código)

| Fase | Estado |
|------|--------|
| S4-A Decisiones degradación | ✅ |
| S4-B conventions/state.md | ✅ |
| S4-C GitHub Actions | ✅ |
| S4-D HydrationBoundary | ✅ |
| S4-E Tests backend | ⏳ PRÓXIMA |
| S4-F Tests frontend | ⏳ |
| S4-G ESLint | ✅ |

### S4-E — orden de implementación

1. Cross-tenant: org A no retorna datos de org B
2. Domain entities: funciones puras sin mocks
3. Contracts HTTP/tRPC: Supertest input inválido → Zod error, sin cookie → 401
4. Auth guards: FirebaseAuthGuard mockeando Firebase Admin SDK

### Cómo saber que Fase 4 está completa

- Health check ok/degraded/down en producción con alertas Railway ✅ (código listo)
- Tests con 85% de cobertura en paths críticos (S4-E + S4-F)
- Latencias medidas con carga real
- Chaos drills documentados
