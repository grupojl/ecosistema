# Fase 1 — Desarrollo
## Escalones 1, 2, 4 — La base que hace cosmético todo lo demás

**Estado:** ✅ Completo (ADR-011, 2026-09-08)
**Cuándo:** Completado — pasar a Fase 2
**Referentes:** Stripe (código) · Twelve-Factor App (config) · PlanetScale (DB)

---

## Escalón 1 — Código: Arquitectura y Calidad

### Estado actual — 10/10

| Ítem | Estado | Detalle |
|------|--------|---------|
| TypeScript strict completo | ✅ | `noImplicitAny: true` en TODOS los tsconfig — ADR-011 |
| Domain/Repository sass-back | ✅ | 11 módulos con domain/ + repository/ |
| Domain/Repository ecommerce-back | ✅ | catalog/ molde + cart, orders, customers, inventory migrados (ADR-011) |
| tRPC exclusivo sass-back | ✅ | 11 routers, Zod inline, sin DTOs class-validator |
| tRPC exclusivo ecommerce-back | ✅ | Controllers REST legacy eliminados (ADR-011) |
| DTOs class-validator | ✅ | Eliminados de ambos backends |
| Multi-tenant organizationId | ✅ | Respetado en todos los modelos |
| Sin cross-service imports | ✅ | Dockerfile de cada servicio solo copia su carpeta + packages/ |
| Sin `as any` repositories | ✅ | ADR-007 implementado, toEntity() en 11 repositories |
| ecommerce-front tRPC server caller | ✅ | lib/store/client.ts migrado (ADR-011) |

### Cómo verificar

```bash
grep -r "noImplicitAny.*false" */tsconfig.json          # → 0 resultados
grep -r "class-validator" realsass-ecommerce-back/src    # → 0 resultados
grep -r "class-validator" realsass-sass-back/src         # → 0 resultados
tsc --noEmit                                             # → 0 errores
```

---

## Escalón 2 — Configuración y Entorno

### Estado actual — 10/10

| Ítem | Estado | Detalle |
|------|--------|---------|
| Catalog único pnpm | ✅ | `catalog:` default — sin named catalogs (ADR-002) |
| Variables por Dockerfile | ✅ | `ARG`/`ENV` declarados en cada Dockerfile |
| Sin `.env` compartido | ✅ | Cada servicio declara sus propias vars |
| CORS explícito | ✅ | `ALLOWED_ORIGINS` sin wildcard |
| `.env.example` por servicio | ✅ | Creados en ADR-011 |
| Validación de env al arranque | ✅ | main.ts falla con mensaje claro si falta var — ADR-011 |
| Secretos fuera del código | ✅ | Firebase private key via Railway env vars |

### Cómo verificar

```bash
ls realsass-sass-back/.env.example        # debe existir
ls realsass-ecommerce-back/.env.example   # debe existir
# Arrancar sin DATABASE_URL → debe fallar con mensaje claro
```

---

## Escalón 4 — Base de Datos y Almacenamiento

### Estado actual — 9/10

| Ítem | Estado | Detalle |
|------|--------|---------|
| Prisma ORM | ✅ | Schema declarativo, dos DBs separadas |
| Migraciones versionadas | ✅ | `prisma/migrations/` en cada back |
| DB separada por back | ✅ | DATABASE_URL propia por servicio |
| Multi-tenant `organizationId` | ✅ | En todos los modelos con datos de negocio |
| Índices en `organizationId` | ✅ | Verificados y agregados — ADR-011 |
| `prisma migrate deploy` en Dockerfile | ✅ | Corre antes del CMD — ADR-011 |
| Backups automáticos | ⚠️ Railway | Verificar política de backups y RPO |
| Pool de conexiones | ⚠️ Documentar | Con múltiples réplicas Railway, documentar límite |

### Pendiente para 10/10

- [ ] Confirmar política de backups Railway y documentar RPO
- [ ] Documentar límite de pool de conexiones por servicio en `services/*.md`

### Cómo verificar

```bash
grep "migrate deploy" realsass-sass-back/Dockerfile        # debe aparecer
grep "migrate deploy" realsass-ecommerce-back/Dockerfile   # debe aparecer
grep "organizationId" realsass-sass-back/prisma/schema.prisma | grep "@@index"
```
