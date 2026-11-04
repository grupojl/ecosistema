// realsass-sass-back/src/internal/schemas.ts
// Contratos Zod para los endpoints /internal/* consumidos por superadmin.
// Ref: .claude/contracts/superadmin-api.md
import { z } from 'zod';

// ── GET /internal/organizations ───────────────────────────────────────────────
export const InternalListOrgsSchema = z.object({
  ecosystemId: z.string().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BLOCKED']).optional(),
  storeStatus: z.enum(['ACTIVE', 'PAUSED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
});
export type InternalListOrgsDto = z.infer<typeof InternalListOrgsSchema>;

// ── POST /internal/organizations/:id/suspend | /unsuspend ────────────────────
// ── POST /internal/organizations/:id/pause-store | /resume-store ─────────────
export const InternalOrgActionSchema = z.object({
  reason: z.string().min(10, 'reason must be at least 10 characters'),
});
export type InternalOrgActionDto = z.infer<typeof InternalOrgActionSchema>;

// ── POST /internal/organizations/:id/events ──────────────────────────────────
// Evento de dominio de OTRO servicio (ecommerce-back, vía su outbox) para entregar a los webhooks salientes de la
// organización. `eventId` es la clave de idempotencia: el mismo evento reenviado no se encola dos veces.
export const InternalEventSchema = z.object({
  eventId: z.string().min(1).max(128),
  type: z.string().regex(/^[a-z]+(\.[a-z_]+)+$/, 'type debe ser tipo "order.created"'),
  payload: z.record(z.string(), z.unknown()),
});
export type InternalEventDto = z.infer<typeof InternalEventSchema>;
