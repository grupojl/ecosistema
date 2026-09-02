# Fase 4 — Escala
## Escalones 9, 11, 12, 13 — 3 ecosistemas simultáneos

**Estado:** ⚪ Pendiente — iniciar cuando Fase 3 esté completa
**Cuándo:** Cuando welver, y otros ecosistemas operan simultáneamente
**Referentes:** AWS (DR) · Linear/Figma (UX) · Netflix (Chaos) · Airbnb/Uber (FinOps)

---

## Escalón 9 — Recuperación ante Desastres

### Qué hay que hacer

1. **Definir RTO y RPO por servicio**:

   | Servicio | RTO objetivo | RPO objetivo |
   |---|---|---|
   | `realsass-sass-back` | < 5 min | < 1 min |
   | `realsass-ecommerce-back` | < 5 min | < 1 min |
   | `realsass-sass-front` | < 2 min | N/A (stateless) |
   | `realsass-dashboard-front` | < 2 min | N/A (stateless) |
   | `real-ecommerce-front` | < 2 min | N/A (stateless) |

2. **Backups verificados** — probar restauración de backup en staging.
   Un backup que nunca se probó no existe.

3. **Redis con persistencia AOF** — confirmar que los datos de caché
   críticos (tenant context) se recuperan si Redis reinicia.

4. **Runbook de recuperación** — documentar paso a paso qué hacer cuando:
   - La DB de sass-back se corrompe
   - Railway tiene un incidente parcial
   - ecommerce-back queda en loop de crash

5. **Drill de recuperación** — simular la caída de sass-back y medir
   cómo afecta a ecommerce-back (que depende de él para validar tenants).

### Cómo saber que este escalón está completo

- RTO/RPO definidos y documentados
- Restauración de backup probada exitosamente en staging
- Runbooks escritos para los 3 escenarios más probables
- Drill de recuperación ejecutado y documentado

---

## Escalón 11 — Rendimiento Percibido y UX (Latency-Zero)

### Qué hay que hacer

1. **Medir latencias actuales** — `p50`, `p95`, `p99` por procedure tRPC.
   Antes de optimizar, medir.

2. **HydrationBoundary en Server Components** — todos los Server Components
   deben usar `<HydrationBoundary>` para pasar datos prefetcheados al client.
   Sin esto, el Client Component hace un refetch inicial innecesario.
   → Ver `.claude/checklists/frontend-capa-2-tanstack.md`

3. **Paginación en todos los listados** — `collaborators.list`, `catalog.list`,
   `orders.list` — ningún procedure devuelve un array sin límite.
   Sin paginación, el primer cliente con 10.000 productos rompe la API.

4. **Optimistic updates** — operaciones de baja criticidad (toggle de flag,
   cambio de tema) deben actualizarse en la UI antes de recibir confirmación
   del back. TanStack Query tiene soporte nativo para esto.

5. **ISR en ecommerce-front** — el catálogo público debe servirse desde caché
   CDN con revalidación, no en tiempo real por cada visita.

6. **Índices de DB optimizados** — medir queries lentas con `EXPLAIN ANALYZE`.
   Un query sin índice que tarda 2ms con 100 registros tarda 2s con 100.000.

### Cómo saber que este escalón está completo

- `p95` de latencia < 100ms en procedures principales con carga simulada
- Todos los listados tienen paginación
- HydrationBoundary en todos los Server Components que prefetchean datos
- ISR configurado en ecommerce-front para catálogo público

---

## Escalón 12 — Alta Disponibilidad y Chaos Engineering

### Qué hay que hacer

1. **Múltiples réplicas** — configurar 2+ réplicas de sass-back y ecommerce-back
   en Railway. El `MemoryCacheAdapter` no funciona entre réplicas — confirmar
   que Redis es el caché principal antes de escalar.

2. **Health check con 3 estados**:
   - `status: "ok"` — todo funciona
   - `status: "degraded"` — funciona pero con dependencias lentas (ej: Firebase tarda)
   - `status: "down"` — no puede servir requests

3. **Comportamiento de ecommerce-back si sass-back cae** — hoy:
   `OrganizationsClientService` rechaza con 503 si sass-back no responde (timeout 2s).
   ¿Es correcto para el checkout? ¿Para ver el catálogo público? Documentar.

4. **Chaos drill básico**:
   - Apagar sass-back → ¿cómo responde ecommerce-back?
   - Cortar Redis → ¿el `MemoryCacheAdapter` toma el relevo correctamente?
   - Saturar la queue de webhooks → ¿los deliveries fallan silenciosamente?

5. **Documentar resultados del chaos** — qué se rompió, qué funcionó,
   qué se arregló. El chaos drill sin documentación es solo un ejercicio.

### Cómo saber que este escalón está completo

- 2+ réplicas de sass-back y ecommerce-back en Railway
- Health check con 3 estados implementado en los 2 backs
- Chaos drill documentado con resultados
- Comportamientos de degradación documentados en `architecture/00-principios.md`

---

## Escalón 13 — Eficiencia Financiera (FinOps)

### Qué hay que hacer

1. **Costo por servicio** — Railway expone métricas de consumo por servicio.
   Medir cuánto cuesta cada servicio mensualmente y documentarlo.

2. **Costo marginal por organización nueva** — poder responder:
   "si agregamos 100 organizaciones nuevas, ¿cuánto sube la factura?"

3. **Escalado automático en Railway** — configurar:
   - Escalar hacia arriba cuando CPU > 70% sostenido 2 minutos
   - Escalar hacia abajo cuando CPU < 20% sostenido 5 minutos

4. **TTL de caché como palanca de costo** — documentar la decisión de TTL
   por tipo de dato: caché largo = menos queries = menos costo.
   Caché corto = datos más frescos = más costo. No hay respuesta única.

5. **ISR vs SSR en ecommerce-front** — cada visita SSR cuesta cómputo.
   Maximizar ISR para reducir costo de render por visita.

### Cómo saber que este escalón está completo

- Dashboard de costos por servicio configurado
- Escalado automático configurado en Railway
- Costo marginal documentado antes de cada campaña de adquisición
