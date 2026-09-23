# sass-back — SEO + idioma (ADR-016)

**Rol:** OWNER de `Organization.countryCode` → define el idioma primario
indexable de cada tienda. Contrato: `.claude/contracts/seo-i18n.md` §3.

## Bounded context e invariantes

- Sin `slug` no hay tienda pública → `null`.
- `ecommerceEnabled` depende **solo** de `storeStatus === 'ACTIVE'` (ADR-013).
- `countryCode` siempre ISO alpha-2 válido: dato corrupto → `'AR'`, nunca 500.
- El endpoint público nunca expone `userId`, `enabledProducts` ni `plan`.

## Checklist

- [x] **SEO-SB-01** — `organizations.service.ts`: mover `createForUserWithDefaultMarket`
      dentro de la clase (hoy está fuera → no compila).
- [x] **SEO-SB-02** — Inyectar `MarketsService` en el constructor e importar `MarketsModule`
      en `OrganizationsModule` (sin ciclo: MarketsModule solo importa PrismaModule).
- [x] **SEO-SB-03** — `domain/organization.entity.ts`: `StoreInfo.countryCode` +
      función pura `toPublicStoreInfo(row)` con las invariantes de arriba.
- [x] **SEO-SB-04** — `prisma-organizations.repository.ts → findBySlug`:
      `findUnique({ where: { slug } })` (slug es `@unique`) con select explícito
      que **incluye** `storeStatus` y `countryCode`; mapear con `toPublicStoreInfo`.
- [x] **SEO-SB-05** — `domain/organization.entity.spec.ts`: ACTIVE, PAUSED, sin slug,
      normalización a mayúsculas, país corrupto → default.

## Verificación

```bash
pnpm --filter realsass-sass-back exec tsc --noEmit
pnpm --filter realsass-sass-back test -- organization.entity
```

## Deploy

Primero de los tres. Contrato aditivo: ecommerce-back viejo ignora `countryCode`.
