# Backend Capas 3+4 — Domain/Application + Repository
# Checklist 10/10

**Score actual: 9/10 — nivel Stripe/Linear internos**
**Score objetivo: 10/10 — nivel plataforma Shopify**

## ✅ Completado

- [ ] 11 módulos sass-back con `domain/` + `repository/`
  - affiliate, collaborators, config-audit, config-flags, config-quotas
  - config-secrets, config-templates, config-themes, config-webhooks
  - organizations, users
- [ ] Services inyectan `IRepository` via `@Inject(TOKEN)` — sin `this.prisma` directo
- [ ] `catalog/` en ecommerce-back como molde vivo (Domain + Repository completo)
- [ ] Entidades de dominio puras — sin imports de NestJS ni Prisma

## ⏳ Pendiente para 10/10

### Domain + Repository en ecommerce-back (S4)
- [ ] `cart/` — domain + repository (hoy service llama Prisma directo)
- [ ] `orders/` — domain + repository
- [ ] `customers/` — domain + repository
- [ ] `inventory/` — ya tiene molde en catalog, aplicar mismo patrón

### Tests de domain (S4 — cobertura mínima 85%)
- [ ] Unit tests de `domain/*.entity.ts` — sin mocks, funciones puras
- [ ] Un test de domain que importe `@nestjs/*` es un bug — configurar Jest para detectarlo
- [ ] Unit tests de services mockeando solo el repository (no Prisma)

### Enforcement CI (S4)
- [ ] `dependency-cruiser` rule `no-prisma-in-service`
  → Falla si `*.service.ts` importa `PrismaService` directamente
  → Excepción documentada: `collaborators.service.ts` para tx atómicas

## Excepción documentada

`collaborators.service.ts` mantiene `PrismaService` para transacciones de invitación
(`Collaborator + Invitation` atómico). Eliminar cuando `ICollaboratorsRepository`
soporte `tx?: Prisma.TransactionClient`.

## Patrón de referencia (molde)

```
modulo/
├── domain/
│   ├── entidad.entity.ts     # tipos puros — sin NestJS, sin Prisma
│   └── entidad.errors.ts     # DomainError tipados
├── repository/
│   ├── modulo.repository.interface.ts  # puerto (símbolo + interface)
│   └── prisma-modulo.repository.ts     # adaptador (único lugar con Prisma)
├── modulo.service.ts         # inyecta IRepository via @Inject(TOKEN)
└── modulo.module.ts          # binding: { provide: TOKEN, useClass: PrismaRepo }
```

## ADR-007 — Eliminar as any / as unknown as (pendiente implementar)

- [ ] Agregar `toEntity()` en los 11 repositories de sass-back
  - prisma-organizations.repository.ts
  - prisma-collaborators.repository.ts
  - prisma-feature-flags.repository.ts
  - prisma-quotas.repository.ts
  - prisma-themes.repository.ts
  - prisma-webhooks.repository.ts
  - prisma-secrets.repository.ts
  - prisma-templates.repository.ts
  - prisma-audit.repository.ts
  - prisma-affiliate.repository.ts
  - prisma-users.repository.ts
- [ ] Tipar retornos de OrdersService.listOrders() y CustomersService.findById()
- [ ] lib/store/types.ts eliminado → inferRouterOutputs<AppRouter>
- [ ] JSONB casts marcados con // @real/jsonb-cast
