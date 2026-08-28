# Deuda técnica — lista viva

Actualizar este archivo cada vez que se deja algo pendiente a propósito.

## Backend — pendiente

- [collaborators] `collaborators.service.ts` mantiene `PrismaService` para
  transacciones de invitación (Collaborator + Invitation atómico).
  Eliminar cuando `ICollaboratorsRepository` soporte transacciones.
  → `collaborators/repository/collaborators.repository.interface.ts`

- [sass-back] `collaborators.service.ts` usa `any` en `buildPermissionsPatch`
  — pendiente tipar con Zod cuando se aplique Capa 2 completa al REST legacy.
  → `decisions/ADR-001-permisos-jsonb.md`

- [ecommerce-back] `OrdersService.checkout()` deja `paymentIntentId` en null
  — `pagos-back` no existe todavía.

- [todos] DTOs con class-validator sobreviven en controllers REST legacy
  — no se agrega class-validator a código nuevo (Capa 2 completa solo en tRPC).

## Frontend — pendiente

- [ecommerce-front] `checkout-flow.tsx` simula autenticación WebAuthn
  — bloqueado hasta integración real con pasarela de pagos.

- [ecommerce-front] Adapters de shipping (correo, envia, welivery) son stubs
  con pricing hardcodeado — bloqueado hasta APIs de courier disponibles.

- [ecommerce-front] Páginas legacy `/categoria/[categoria]` y `/products/[handle]`
  pendientes de migrar a `/tienda/[slug]/`. `lib/ecommerce/index.ts` es shim temporal.

- [dashboard-front] `lib/chat-ia-client.ts` fetch manual hacia chat-ia-back
  — eliminar cuando chat-ia-back tenga router tRPC.

## Auth — gaps resueltos ✅

- Token Firebase sin refresh automático → resuelto con timer proactivo 55min en auth-context.tsx
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

## Testing / Observabilidad — S4 pendiente

- Sin tests (.spec.ts) — S4 no iniciado
- OpenTelemetry en catalog pero sin configuración visible
