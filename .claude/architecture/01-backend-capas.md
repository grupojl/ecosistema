# Backend — 6 microservicios (estado objetivo: 2 hoy, 4 más en roadmap)

| # | Capa | Ideal terminado | Regla dura | Estado hoy |
|---|------|-----------------|------------|------------|
| 1 | Auth/Tenant resolution | Una sola implementación en `@real/auth-server`, consumida igual por todos los backs vía `createTrpcAuthMiddleware` + guards globales (`APP_GUARD`). | Ningún back reimplementa `firebaseAuth`/`tenantContext` a mano. | ✅ completo — cookies HttpOnly (ADR-004) + SessionService |
| 2 | Router/Contrato de entrada | Zod puro en cada input de `procedure` tRPC. class-validator solo sobrevive en controllers REST legacy. | Cero DTOs nuevos con `class-validator`. Todo input nuevo = schema Zod. | ✅ tRPC usa Zod · ⚠️ class-validator sobrevive en REST legacy |
| 3 | Domain / Application | `domain/` = reglas de negocio puras sin Prisma ni NestJS. `application/` = orquesta domain + repository. | Un test de domain nunca importa `@nestjs/*` ni `@prisma/client`. | ✅ 11 módulos sass-back + catalog ecommerce-back |
| 4 | Repository | Capa entre Application y Prisma. El Service llama `this.xRepository.find(...)`, nunca `this.prisma.x`. | Ningún `*.service.ts` importa `PrismaService` directamente (excepción: collaborators.service.ts para tx). | ✅ 11 módulos sass-back + catalog ecommerce-back |
| 5 | Contrato compartido (AppRouter) | `@real/trpc` exporta el tipo real del router — nunca `AnyRouter`. | Cambiar un procedure sin romper el build de los fronts es la señal de que el contrato está bien tipado. | ✅ SassAppRouter + EcommerceAppRouter — sin casts as any |
| 6 | Multi-tenant como invariante transversal | Todo modelo con datos de negocio lleva `organizationId`. | Un query sin `organizationId` en el `where` es bug crítico. | ✅ respetado en todos los modelos |

## Servicios backend en el roadmap (hoy 2, meta 6)

- `realsass-sass-back` — identidad, orgs, colaboradores, config, auditoría
- `realsass-ecommerce-back` — catálogo, stock, carrito, órdenes, clientes
- **Pendientes**: `chat-ia-back`, `pagos-back` — cuando existan, deben nacer
  ya con capas 1-5 aplicadas, no migrar después.

## Módulo de referencia: catalog (capas 1-4 aplicadas)

`src/catalog/` en `realsass-ecommerce-back` es el **MOLDE VIVO**.
Todos los módulos de sass-back siguen la misma estructura.
