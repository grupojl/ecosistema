# Fase 1 — Desarrollo
## Escalones 1, 2, 4 — La base que hace cosmético todo lo demás

**Estado:** 🟡 Avanzado — bloqueantes activos en Escalón 1
**Cuándo:** Ahora — resolver bloqueantes antes de pasar a Fase 2
**Referentes:** Stripe (código) · Twelve-Factor App (config) · PlanetScale (DB)

---

## Escalón 1 — Código: Arquitectura y Calidad

### Estado actual — 9/10

| Ítem | Estado | Detalle |
|------|--------|---------|
| TypeScript strict | ✅ | ADR-007 implementado — `toEntity()` en 11 repositories de sass-back |
| Domain/Repository sass-back | ✅ | 11 módulos con domain/ + repository/ |
| Domain/Repository ecommerce-back | ⚠️ Parcial | Solo `catalog/` — cart, orders, customers, inventory pendientes |
| tRPC exclusivo sass-back | ✅ | 11 routers, Zod inline, sin DTOs class-validator nuevos |
| tRPC exclusivo ecommerce-back | ⚠️ BLOQUEANTE | Controllers REST legacy pendientes de eliminar (ADR-005) |
| DTOs class-validator sass-back | ⚠️ Pendiente | Sobreviven en controllers REST legacy a eliminar |
| Multi-tenant organizationId | ✅ | Respetado en todos los modelos |
| Sin cross-service imports | ✅ | Dockerfile de cada servicio solo copia su carpeta + packages/ |
| Sin `as any` repositories | ✅ | ADR-007 implementado |
| ecommerce-front tRPC server caller | ⚠️ BLOQUEANTE | lib/store/client.ts usa fetch REST (ADR-006) |

### Bloqueantes activos

**[BLOQUEANTE-1] Eliminar controllers REST de ecommerce-back** (ADR-005)
Los controllers REST de catalog, inventory, orders, cart, customers, store
deben eliminarse — los routers tRPC ya existen y los reemplazan.
→ Ver `.claude/checklists/backend-capa-2-router.md`
→ Ver `.claude/decisions/ADR-005-rest-to-trpc.md`

**[BLOQUEANTE-2] ecommerce-front → tRPC server caller** (ADR-006)
`lib/store/client.ts`, `lib/store/resolver.ts`, `context/customer-context.tsx`
usan fetch REST manual donde debe ir tRPC server caller.
→ Ver `.claude/checklists/frontend-capa-1-fetch.md`

### Pendiente no bloqueante

- Domain/Repository en ecommerce-back: `cart/`, `orders/`, `customers/`, `inventory/`
  → Ver `.claude/checklists/backend-capas-3-4-domain-repo.md`

### Cómo saber que este escalón está completo

- `grep -r "class-validator" realsass-ecommerce-back/src` → 0 resultados
- `grep -r "class-validator" realsass-sass-back/src` → 0 resultados
- `lib/store/client.ts` eliminado — reemplazado por tRPC server caller
- `cart/`, `orders/`, `customers/` tienen domain/ + repository/
- `tsc --noEmit` pasa en los 2 backs y los 3 fronts sin errores

### Referente: por qué Stripe

La API de Stripe es el estándar de ergonomía y tipado. Cada method retorna
un tipo explícito, cada error está tipado, cada input validado con schema.
En welver, el equivalente es: un ingeniero nuevo puede leer cualquier router
tRPC y saber exactamente qué acepta, qué valida y qué retorna — sin preguntar.

---

## Escalón 2 — Configuración y Entorno

### Estado actual — 9.5/10

| Ítem | Estado | Detalle |
|------|--------|---------|
| Catalog único pnpm | ✅ | `catalog:` default — sin named catalogs (ADR-002) |
| Variables por Dockerfile | ✅ | `ARG`/`ENV` declarados en cada Dockerfile |
| Sin `.env` compartido | ✅ | Cada servicio declara sus propias vars |
| CORS explícito | ✅ | `ALLOWED_ORIGINS` sin wildcard — sass-back no arranca sin él |
| Secretos fuera del código | ✅ | Firebase private key via Railway env vars |
| pnpm 10 + Node 24 | ✅ | Documentado en conventions/entorno.md |

### Pendiente mínimo

- [ ] Verificar que `.env.example` existe en cada servicio con todas las vars requeridas
- [ ] Validación de env vars al arranque en cada `main.ts` — falla con mensaje claro si falta una var

### Cómo saber que este escalón está completo

- Cada servicio tiene `.env.example` completo y actualizado
- El servicio falla en arranque con mensaje claro si falta una var obligatoria
- `git grep -r "PRIVATE_KEY\|-----BEGIN" --include="*.ts"` → 0 resultados con valores reales

---

## Escalón 4 — Base de Datos y Almacenamiento

### Estado actual — 8/10

| Ítem | Estado | Detalle |
|------|--------|---------|
| Prisma ORM | ✅ | Schema declarativo, dos DBs separadas (sass + ecommerce) |
| Migraciones versionadas | ✅ | `prisma/migrations/` en cada back |
| DB separada por back | ✅ | `realsass-sass-back` y `realsass-ecommerce-back` tienen `DATABASE_URL` propia |
| Multi-tenant `organizationId` | ✅ | En todos los modelos con datos de negocio |
| Índices en `organizationId` | ⚠️ Verificar | Confirmar `@@index([organizationId])` en modelos de alta frecuencia |
| Backups automáticos | ⚠️ Railway | Verificar política de backups y RPO resultante |
| Pool de conexiones | ⚠️ Verificar | Con múltiples réplicas Railway, el pool puede ser cuello de botella |
| `prisma migrate deploy` en Dockerfile | ⚠️ Verificar | Confirmar que migra antes del start, no después |

### Qué hay que hacer

1. **Verificar índices** — todo modelo con `organizationId` de alta frecuencia de consulta
   debe tener `@@index([organizationId])`. Sin índice = query lento a escala.

2. **Confirmar política de backups Railway** — documentar RPO resultante.

3. **Confirmar orden en Dockerfile** — `prisma migrate deploy` antes del `CMD`.

4. **Pool de conexiones** — documentar límite por servicio. Con N réplicas Railway
   de cada back, el límite de conexiones de PostgreSQL es `N × pool_size`.

### Cómo saber que este escalón está completo

- Índices en `organizationId` confirmados en ambos schemas
- `prisma migrate deploy` antes del `CMD` en los 2 Dockerfiles de backs
- Backups automáticos confirmados con RPO documentado
- Límites de pool documentados en `services/realsass-sass-back.md` y `services/realsass-ecommerce-back.md`
