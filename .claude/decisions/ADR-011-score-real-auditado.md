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
