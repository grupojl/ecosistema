# ADR-007: Eliminar todos los `as any` y `as unknown as` del monorepo

**Fecha:** 2026-08-29
**Estado:** Implementado — COMPLETO

## Contexto

El monorepo tiene TypeScript strict activado. Sin embargo, hay tres fuentes
de `as any` / `as unknown as` que anulan esa protección en los lugares más
críticos — los repositories, que son la única capa con acceso a la base de datos.

### Inventario completo de casts en el monorepo

#### Categoría A — `as unknown as TipoEntidad` en repositories (CRÍTICO)

**Origen:** cuando creamos los repositories de sass-back (ADR-004/S3), usamos
`as unknown as` para convertir el tipo Prisma al tipo de dominio en lugar de
mapear explícitamente campo por campo.

**Afectados — sass-back:**
- `prisma-organizations.repository.ts` — `as unknown as Organization`
- `prisma-collaborators.repository.ts` — `as unknown as Collaborator`
- `prisma-feature-flags.repository.ts` — `as unknown as FeatureFlag`
- `prisma-quotas.repository.ts` — `as unknown as QuotaConfig`
- `prisma-themes.repository.ts` — `as unknown as ThemeConfig`
- `prisma-webhooks.repository.ts` — `as unknown as WebhookEndpoint | WebhookDeliveryLog`
- `prisma-secrets.repository.ts` — `as unknown as SecretConfig`
- `prisma-templates.repository.ts` — `as unknown as ContentTemplate`
- `prisma-audit.repository.ts` — `as unknown as AuditLog`
- `prisma-affiliate.repository.ts` — `as unknown as AffiliateProfile`
- `prisma-users.repository.ts` — `as unknown as User | UserProfile`

**Por qué es crítico:** si Prisma cambia un campo (rename, nuevo campo nullable,
tipo distinto), TypeScript no avisa — el cast silencia el error. Es exactamente
el tipo de bug que la arquitectura Domain/Repository debería prevenir.

**Molde correcto** (ya implementado en `prisma-catalog.repository.ts` de ecommerce-back):
```ts
// ❌ Cast que silencia errores
return this.prisma.organization.update({ ... }) as unknown as Organization;

// ✅ Mapper explícito que TypeScript verifica campo por campo
private toOrganization(row: Prisma.OrganizationGetPayload<{}>): Organization {
  return {
    id:          row.id,
    name:        row.name,
    slug:        row.slug,
    // ...cada campo — si Prisma cambia algo, TypeScript lo detecta aquí
  };
}
```

#### Categoría B — `as any` en services y routers (MODERADO)

- `collaborators.service.ts` — permisos JSONB: `dto as Partial<CollaboratorPermissions>`
- `customer.router.ts` — `o.customerId === ctx.customerId` (falta tipar el retorno de `listOrders`)
- `profile/page.tsx` — `(me as any)?.organization` (falta tipar el retorno de `auth.me`)
- `collaborators-section.tsx` — `collab as any` (falta tipar el tipo de collaborator)

#### Categoría C — `as unknown as` en ecommerce-front (TRANSITORIO)

- `lib/store/client.ts` — `result as unknown as StoreProduct[]`
  Causa: los tipos de retorno de `customer.getProducts` no coinciden con
  `StoreProduct` definido en `lib/store/types.ts`.
  Solución: usar los tipos inferidos de `EcommerceAppRouter` directamente,
  eliminar `lib/store/types.ts`.

#### Categoría D — `as any` justificados (ACEPTABLES — documentados)

- `collaborators.service.ts` — permisos JSONB en Prisma: `Json` no tiene tipo específico.
  Solución ideal: Zod parse en runtime. Hasta implementar: aceptable con comentario.
- `customer.router.ts` — `o as any` al filtrar órdenes por customerId:
  el tipo de `ordersService.listOrders()` retorna el tipo Prisma, no el de dominio.
  Solución: tipar el retorno de `OrdersService.listOrders()` con la entidad de dominio.

---

## Decisión

**Eliminar todos los casts `as any` y `as unknown as` del monorepo.**

La única excepción aceptada es el parseo de campos JSONB de Prisma cuando
no hay alternativa sin Zod — pero documentados con `// @real/jsonb-cast` para
que el linter los detecte y diferencie de casts descuidados.

### Plan de implementación por categoría

#### Categoría A — repositories (11 archivos en sass-back)

Agregar función `toEntity()` privada en cada repository que mapee
el tipo Prisma → tipo de dominio campo por campo.

Patrón a seguir (molde de `prisma-catalog.repository.ts` en ecommerce-back):

```ts
// Importar el tipo generado por Prisma
import type { Organization as PrismaOrg } from '@prisma/client';

export class PrismaOrganizationsRepository implements IOrganizationsRepository {

  // ── Mapper privado — el único lugar que conoce ambos tipos ──────────────
  private toEntity(row: PrismaOrg): Organization {
    return {
      id:               row.id,
      firebaseUid:      '', // viene del join con User — ver findByFirebaseUid
      slug:             row.slug,
      name:             row.name,
      description:      row.description,
      logoUrl:          row.logoUrl,
      website:          row.website,
      enabledProducts:  row.enabledProducts as Record<string, unknown>,
      plan:             row.plan,
      createdAt:        row.createdAt,
      updatedAt:        row.updatedAt,
    };
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const row = await this.prisma.organization.findFirst({ where: { slug } });
    return row ? this.toEntity(row) : null;  // ← sin cast
  }
}
```

**Qué garantiza:** si Prisma renombra `logoUrl` a `logo_url`, TypeScript
falla en `toEntity()` — no en runtime en producción.

#### Categoría B — services y routers

Tipar los retornos de los methods de service que hoy retornan `any`:

```ts
// ❌ Hoy
async listOrders(organizationId: string) {
  return this.prisma.order.findMany({ ... }); // tipo inferido por Prisma
}

// ✅ Correcto
async listOrders(organizationId: string): Promise<Order[]> {
  const rows = await this.prisma.order.findMany({ ... });
  return rows.map(this.toOrder); // Order es la entidad de dominio
}
```

#### Categoría C — ecommerce-front lib/store/types.ts

Eliminar `lib/store/types.ts` y usar los tipos inferidos de `EcommerceAppRouter`:

```ts
// ❌ Hoy — tipo duplicado que diverge del back
import type { StoreProduct } from '@/lib/store/types'

// ✅ Correcto — tipo inferido end-to-end desde el router
import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter }          from '@/lib/trpc/router-type'

type RouterOutput = inferRouterOutputs<AppRouter>
type StoreProduct = RouterOutput['customer']['getProducts'][number]
```

#### Categoría D — JSONB Prisma

Usar `// @real/jsonb-cast` como comentario marcador para que ESLint
los diferencie de casts descuidados:

```ts
// @real/jsonb-cast — Prisma devuelve JsonValue, necesitamos el tipo específico
const perms = row.permissions as CollaboratorPermissions;
```

Regla ESLint en S4: `no-as-any` con excepción `@real/jsonb-cast`.

---

## Alternativas descartadas

**Alternativa 1: Usar `satisfies` en lugar de `as`**
`satisfies` verifica que el tipo es compatible pero no fuerza la conversión.
No resuelve el problema cuando los tipos Prisma y dominio tienen diferencias
estructurales reales (ej: campos computed, relaciones opcionales).

**Alternativa 2: Compartir tipos entre Prisma y dominio (usar Prisma como dominio)**
Haría que la capa de dominio dependa de Prisma — viola el principio de inversión
de dependencias. Si migramos de Prisma a otro ORM, el dominio cambia también.

**Alternativa 3: Mantener los casts y cubrir con tests**
Los tests cubren el comportamiento, no la integridad de tipos. Un rename en
Prisma con cast existente no falla en tests — falla en runtime. TypeScript
es la primera línea de defensa, no los tests.

**Alternativa 4: `zod.parse()` en cada repository**
Overhead de validación en runtime para datos que ya están en la DB y son
confiables. Correcto para entrada externa (API, usuario), incorrecto para
datos de Prisma que ya pasaron por nuestro schema.

---

## Consecuencias

**Ganancia:**
- TypeScript strict real — sin agujeros. Un cambio en el schema de Prisma
  falla en compile time, no en runtime en producción.
- Los `toEntity()` son la documentación viva del mapeo Prisma → dominio.
- Los tests de unit de los repositories son simples — mockear Prisma devuelve
  el tipo correcto y el mapper se verifica automáticamente.
- Sin `as any` en ningún service o router — los tipos fluyen end-to-end.

**Costo:**
- ~11 archivos de repository a actualizar en sass-back (agregar `toEntity()`).
- ~4 archivos de service/router a tipar correctamente.
- `lib/store/types.ts` a eliminar en ecommerce-front.
- Trabajo estimado: 1 sesión de desarrollo.

**Regla permanente:**
Un `as any` o `as unknown as` nuevo en un repository es un bug de arquitectura.
Se bloquea en code review sin excepción. Los `// @real/jsonb-cast` son la
única excepción documentada.

---

## Orden de ejecución

1. Agregar `toEntity()` en los 11 repositories de sass-back
2. Tipar retornos de `OrdersService.listOrders()` y `CustomersService.findById()`
3. Eliminar `lib/store/types.ts` y usar `inferRouterOutputs<AppRouter>`
4. Marcar JSONB casts con `// @real/jsonb-cast`
5. Actualizar checklists de Capas 3+4

## Referencias

- `realsass-ecommerce-back/src/catalog/repository/prisma-catalog.repository.ts`
  — molde correcto sin casts (implementado desde S1)
- `architecture/01-backend-capas.md` — Capa 3 Domain, Capa 4 Repository
- `checklists/backend-capas-3-4-domain-repo.md`
- `decisions/ADR-001-permisos-jsonb.md` — contexto del JSONB en permisos
