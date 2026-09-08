# Deuda técnica — ecosistema-ms

**Última actualización:** 2026-09-07

<<<<<<< HEAD
---

## Escalón 1 — Código: lo que baja el puntaje de 8.5 a 10

### Domain/Repository pendiente en ecommerce-back (decisión consciente — S4)

Los 4 módulos siguen con `PrismaService` directo en el service.
La decisión fue diferirlos a S4 porque los tipos Output sin `as any` son
suficientes para Fase 1. Cuando se implementen, seguir el molde de `catalog/`.

| Módulo | Trigger para resolver | Molde |
|--------|----------------------|-------|
| `cart/` — `CartService` importa `PrismaService` | S4-E (tests de domain) | `catalog/` de ecommerce-back |
| `orders/` — `OrdersService` importa `PrismaService` | S4-E | `catalog/` de ecommerce-back |
| `customers/` — `CustomersService` importa `PrismaService` | S4-E | `catalog/` de ecommerce-back |
| `inventory/` — `InventoryService` importa `PrismaService` | S4-E | `catalog/` de ecommerce-back |

Comando de verificación cuando se resuelva:
```bash
grep -rn "PrismaService" realsass-ecommerce-back/src --include="*.service.ts" \
  | grep -v "catalog\|prisma.service\|prisma.module"
```
Done cuando: 0 resultados.

### collaborators.service.ts — PrismaService para transacciones

`collaborators.service.ts` mantiene `PrismaService` para la transacción
de invitación (`Collaborator + Invitation` atómico).
Eliminar cuando `ICollaboratorsRepository` soporte `tx?: Prisma.TransactionClient`.
→ `collaborators/repository/collaborators.repository.interface.ts`

### collaborators.service.ts — any en buildPermissionsPatch

`collaborators.service.ts` usa `any` en `buildPermissionsPatch`.
Pendiente tipar con Zod cuando se migre completamente a tRPC.
→ `decisions/ADR-001-permisos-jsonb.md`

### Páginas /tienda/[slug]/ con JSX inline

Las páginas del storefront canónico tienen JSX inline sin componentes de
presentación dedicados. Aceptable mientras el design system del storefront
no esté definido. Cuando se extraigan, usar tipos de `EcommerceAppRouter`.
→ `decisions/ADR-008-eliminar-componentes-legacy-storefront.md`

---

## Escalón 2 — Configuración: lo que baja el puntaje de 8.0 a 10

### .env.example ausente en todos los servicios

Ningún servicio tiene `.env.example`. Sin él, un desarrollador nuevo no sabe
qué variables configurar sin leer el código fuente o preguntar.

| Servicio | Variables requeridas a documentar |
|----------|----------------------------------|
| `realsass-sass-back` | `DATABASE_URL`, `REDIS_URL`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `ALLOWED_ORIGINS`, `INTERNAL_API_KEY` |
| `realsass-ecommerce-back` | `DATABASE_URL`, `REDIS_URL`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `SASS_BACK_URL`, `ALLOWED_ORIGINS` |
| `realsass-sass-front` | `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_SASS_BACK_URL` |
| `realsass-dashboard-front` | Mismas que sass-front + `NEXT_PUBLIC_ECOMMERCE_BACK_URL` |
| `real-ecommerce-front` | `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_ECOMMERCE_BACK_URL` |

Done cuando: cada servicio tiene `.env.example` con todas las variables y descripción.
Trigger: antes de onboardear al primer colaborador externo o antes de S4-C (CI).

### Validación de env vars al arranque en main.ts

Ningún `main.ts` valida que las variables requeridas existan al arrancar.
Si falta `DATABASE_URL`, el servicio arranca y falla en el primer query — no al inicio.

Patrón correcto a implementar en cada `main.ts`:
```ts
const REQUIRED = ['DATABASE_URL', 'FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL',
                  'FIREBASE_PRIVATE_KEY', 'ALLOWED_ORIGINS'];
for (const key of REQUIRED) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}
```

Done cuando: el servicio falla en arranque con mensaje claro si falta una variable.
Trigger: antes de S4-C (CI) — el workflow necesita saber qué variables configurar.

---

## Escalón 4 — Base de Datos: lo que baja el puntaje de 7.5 a 10

### Índices compuestos sin auditar en Prisma schemas

Los modelos de alta frecuencia de consulta pueden no tener `@@index([organizationId])`.
Sin índice, un query que tarda 2ms con 100 registros tarda 2s con 100.000.

Comando de auditoría:
```bash
# Ver modelos con organizationId sin indice explicito
grep -A5 "organizationId" realsass-sass-back/prisma/schema.prisma \
  | grep -v "@@index"
grep -A5 "organizationId" realsass-ecommerce-back/prisma/schema.prisma \
  | grep -v "@@index"
```

Done cuando: todo modelo con `organizationId` de alta frecuencia tiene
`@@index([organizationId])` o `@@index([organizationId, <campo_de_filtro>])`.
Trigger: antes de que cualquier ecosistema supere 10.000 registros por tabla.

### prisma migrate deploy antes del CMD en Dockerfiles sin confirmar

No se verificó que ambos Dockerfiles corran `prisma migrate deploy` antes del
`CMD` de arranque. Si no está, la app puede arrancar con schema desactualizado.

Verificación manual:
```bash
grep -A3 "migrate" realsass-sass-back/Dockerfile
grep -A3 "migrate" realsass-ecommerce-back/Dockerfile
```

Done cuando: ambos Dockerfiles tienen `RUN pnpm prisma migrate deploy` (o equivalente)
antes del `CMD` o `ENTRYPOINT` de la aplicación.
Trigger: antes del primer deploy a producción con datos reales.

### Pool de conexiones sin documentar por servicio

Prisma gestiona el pool automáticamente pero con límites por defecto que pueden
ser cuello de botella con múltiples réplicas en Railway.
Con N réplicas, el total de conexiones = N × pool_size.

Done cuando: cada servicio tiene documentado en `services/<servicio>.md`:
- Pool size actual (default Prisma o configurado explícitamente)
- Límite de conexiones de PostgreSQL en Railway
- Máximo de réplicas seguro antes de saturar el pool
Trigger: antes de configurar más de 1 réplica en Railway (Escalón 12).

### Política de backups Railway sin verificar formalmente

No se verificó ni documentó la política de backups de Railway PostgreSQL:
- ¿Cada cuánto hace backup automático?
- ¿Cuántos días de retención?
- ¿Se probó alguna restauración?

Done cuando: en este archivo existe:
- RPO documentado por servicio (ej: "Railway hace backup cada 24h → RPO = 24h")
- Al menos una restauración de backup probada en staging con resultado documentado
Trigger: antes de que cualquier ecosistema tenga datos de producción reales.

---

## Backend — pendiente (existente)
=======
## ✅ RESUELTOS

| ID | Deuda | Cómo quedó |
|----|-------|------------|
| ~~DT-001~~ | dto/ huérfanas (17 carpetas) | Eliminadas |
| ~~DT-002~~ | class-validator inline (9 archivos) | Migrado a Zod — 0 imports residuales |
| ~~DT-003~~ | AllExceptionsFilter no registrado | Registrado en chatia + workers main.ts |
| ~~DT-004~~ | ConversationsService → PrismaService directo | Migrado a IConversationsRepository |
| ~~DT-005~~ | PaymentsService → PrismaService directo | PrismaService + IPaymentsRepository coexisten (ver nota) |
| ~~DT-006~~ | reconciliation.service sin tenantId en where | ConfigService + tenantId dentro del where |
| ~~DT-007~~ | contacts/ sin Domain/Repository | Decidido: no aplicar — scope suficiente con organizationId |
| ~~DT-008~~ | projects/ sin Domain/Repository | Ídem — imports dto corregidos a schemas.ts |
| ~~DT-009~~ | campaigns/ sin Domain/Repository | Ídem |
| ~~DT-011~~ | notifications.service getStats() sin ecosystemId | ecosystemId en StatsQuery + where |
| ~~DT-012~~ | analytics getConversationsByDay() sin ecosystemId | ecosystemId en firma + controller |
| ~~DT-013~~ | Timeouts gRPC no definidos | channelOptions/keepalive en 5 módulos grpc-client |
| ~~DT-014~~ | preferences.service getPreferences() sin ecosystemId | ecosystemId en where |
| ~~DT-016~~ | contacts.service import roto class-validator | Reescrito usando schemas.ts |
| ~~DT-017~~ | OrgContext sin tenantId | tenantId agregado a la interface |
| ~~DT-018~~ | projects.service imports dto legacy rotos | Migrado a schemas.ts |
| ~~DT-019~~ | getFailedJobs() fuera del cierre de clase DlqService | Corregido manualmente 2026-09-07 — método dentro de la clase, un único `}` al final |
| ~~DT-A~~ | Sin ZodValidationPipe ni filtros de excepción | Resuelto |
| ~~DT-B~~ | Controllers con class-validator | Resuelto |
| ~~DT-C~~ | class-validator en package.json | Resuelto |
| ~~DT-D~~ | conversations/ sin domain+repository | Resuelto |
| ~~DT-E~~ | payments/ sin domain+repository | Resuelto |
| ~~DT-F~~ | Sin contratos gRPC documentados | Resuelto |
| ~~DT-G~~ | Sin auditoría multi-tenant | Resuelto |

### Nota de arquitectura — DT-005
>>>>>>> efe7f06e2d3e68c2c0a774de38ce5f87f5a5b862

`PaymentsService` inyecta tanto `PrismaService` como `IPaymentsRepository`:
- `IPaymentsRepository` → lecturas simples: `findById`, `findByIdempotencyKey`, `list`
- `PrismaService` directamente → operaciones que requieren `$transaction` multi-tabla

---

<<<<<<< HEAD
## Frontend — pendiente (existente)
=======
## 🔴 PENDIENTE — FASE 6 (bloquea integración real)
>>>>>>> efe7f06e2d3e68c2c0a774de38ce5f87f5a5b862

| ID | Deuda | Urgencia |
|----|-------|---------|
| DT-020 | `INTERNAL_API_KEY` no configurada en Railway en los 5 servicios | Sin esta variable los endpoints /internal/* rechazan todo (fail-secure) |
| DT-021 | `pnpm -r build` no verificado post-FASE 7 | Confirmar 0 errores TypeScript antes de deployar |

---

<<<<<<< HEAD
- [dashboard-front] `lib/chat-ia-client.ts` fetch manual hacia chat-ia-back
  — eliminar cuando chat-ia-back tenga router tRPC.

---

## Auth — gaps resueltos ✅

- Token Firebase sin refresh automático → resuelto con timer proactivo 55min
- Token en memoria/localStorage → resuelto con cookies HttpOnly (ADR-004)
- CORS con origin wildcard → resuelto con ALLOWED_ORIGINS en main.ts

## @real/ui — resuelto ✅

- 33 componentes shadcn instalados en packages/ui/src/components/
- components/ui/ eliminados de los 3 fronts
- imports migrados a @real/ui

## Backend Domain/Repository — resuelto ✅

- 11 módulos de sass-back con domain/ + repository/
- Services inyectan IRepository via @Inject(TOKEN)
- Molde: catalog/ en ecommerce-back (referencia canónica)

## ecommerce-front — migración a tRPC server caller — resuelto ✅

Resuelto en sesión 2026-09-02:
- `lib/store/client.ts` → ✅ usa `createStoreCaller().customer.*`
- `lib/store/resolver.ts` → ✅ usa `customer.resolveStore` procedure
- `context/customer-context.tsx` → ✅ `identifyCustomer()` usa `customer.identify` tRPC
- `lib/ecommerce/index.ts` → ✅ eliminado
- `app/categoria/[categoria]/page.tsx` → ✅ redirect 308
- `app/products/[handle]/page.tsx` → ✅ redirect 308

## dashboard-front — lib/firebase.ts — resuelto ✅

`realsass-dashboard-front/lib/firebase.ts` eliminado.
`app/auth/sso/page.tsx` migrado a `@real/auth-client`.

## ecommerce-front — componentes storefront legacy — resuelto ✅ (ADR-008)

10 componentes del dominio real-estate eliminados en 2026-09-02.
Pendiente consciente: páginas `/tienda/[slug]/` con JSX inline → ver Escalón 1 arriba.

## Testing / Observabilidad — S4 pendiente

- Sin tests (.spec.ts) — S4-E y S4-F no iniciados
- OpenTelemetry dependencias en catalog pero sin configuración activa — S4-C
=======
## 🟡 PENDIENTE — no urgente

| ID | Deuda | Archivo | Cuándo |
|----|-------|---------|--------|
| DT-015 | `Conversation` sin `ecosystemId` directo en schema | `chatia-backend/prisma/schema.prisma` | Antes de 2+ ecosistemas en prod |
| DT-010 | CircuitBreakerService en memoria (no distribuido) | chatia + pasarelapagos | Al escalar a múltiples instancias |

### DT-015 — cómo resolverlo cuando llegue el momento

```prisma
model Conversation {
  ecosystemId    String
  organizationId String
  @@index([ecosystemId, organizationId])
}
```

```bash
pnpm --filter chatia-backend prisma migrate dev --name add-ecosystemId-conversation
```
>>>>>>> efe7f06e2d3e68c2c0a774de38ce5f87f5a5b862
