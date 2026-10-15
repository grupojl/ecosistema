---
name: nuevo-modulo-nest
description: Usar al crear un módulo de negocio nuevo (o migrar uno existente) en realsass-sass-back o realsass-ecommerce-back con las capas domain, repository, service y module. Garantiza aislamiento por organización, mapeo sin casts y tests desde el inicio.
---

# Nuevo módulo NestJS (capas 3 + 4)

## Molde

```
modulo/
├── domain/
│   ├── entidad.entity.ts        # tipos puros: sin NestJS, sin Prisma
│   └── entidad.errors.ts        # DomainError tipados (solo si hay reglas)
├── repository/
│   ├── modulo.repository.interface.ts   # export const TOKEN = Symbol(...) + interface
│   └── prisma-modulo.repository.ts      # ÚNICO lugar que importa PrismaService
├── modulo.service.ts            # @Inject(TOKEN) del repository; sin Prisma
├── modulo.service.spec.ts       # al lado del archivo
└── modulo.module.ts             # { provide: TOKEN, useClass: PrismaModuloRepository }
```

Referencias vivas: `realsass-ecommerce-back/src/catalog/` (molde sin un solo cast) y `realsass-sass-back/src/config-flags/`.

## Reglas

1. **Todo método del repository recibe `organizationId` obligatorio** y lo usa en el `where`. Un query sin scope es filtración entre clientes (🔴).
   Si el repository opera por `id` (como flags/themes), el **service** debe comparar `organizationId` del registro antes de mutar.
2. **Mapeo con `toEntity()` privado**, campo por campo. Sin `as any` ni `as unknown as`. JSONB: validar con Zod; si hace falta un cast, `// @real/jsonb-cast`.
3. El domain no importa `@nestjs/*` ni `@prisma/client`. Si hay lógica real (invariantes, estados) va en `domain/` con funciones puras.
   **No crear specs con `it.todo`**: las entidades que son solo interfaces no necesitan spec (se borraron 10 stubs así el 2026-10-15).
4. Zod es la única validación; sin class-validator.
5. Transacciones atómicas: pasar `PrismaTransactionClient` (tipo propio de `prisma.service.ts`), no castear el cliente.

## Pasos

1. Si hay tablas nuevas → skill `nueva-migracion`.
2. Crear entity, interface+token, repository Prisma, service, module.
3. Registrar el módulo en `AppModule` y exponerlo por tRPC (skill `nuevo-procedure-trpc`).
4. Tests (sin ellos el módulo está **bloqueado**): service con repository fake (no mockear Prisma), domain puro si lo hay, y el caso de tenant en
   integración (skill `test-integracion-tenant`).
5. Subir el umbral de cobertura de `jest.config.js` al valor medido.

## Verificación final

- [ ] `pnpm --filter <back> lint` · `typecheck` · `test:cov`
- [ ] `bash scripts/audit/run.sh arquitectura` (services → repository, sin Prisma directo) y `testing`
- [ ] Un test de integración demuestra que otra organización no ve ni modifica los datos
- [ ] Ningún import cruza de un back al otro

## Mantenimiento

Depende de `architecture/01-backend-capas.md`, `checklists/backend-capas-3-4-domain-repo.md`, `checklists/backend-capa-6-multitenant.md`, ADR-007, ADR-022.
