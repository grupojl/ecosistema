# Deuda técnica — ecosistema-ms

**Última actualización:** 2026-09-07

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

`PaymentsService` inyecta tanto `PrismaService` como `IPaymentsRepository`:
- `IPaymentsRepository` → lecturas simples: `findById`, `findByIdempotencyKey`, `list`
- `PrismaService` directamente → operaciones que requieren `$transaction` multi-tabla

---

## 🔴 PENDIENTE — FASE 6 (bloquea integración real)

| ID | Deuda | Urgencia |
|----|-------|---------|
| DT-020 | `INTERNAL_API_KEY` no configurada en Railway en los 5 servicios | Sin esta variable los endpoints /internal/* rechazan todo (fail-secure) |
| DT-021 | `pnpm -r build` no verificado post-FASE 7 | Confirmar 0 errores TypeScript antes de deployar |

---

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
