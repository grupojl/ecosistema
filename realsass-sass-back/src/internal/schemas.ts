// realsass-sass-back/src/internal/schemas.ts
// Contratos Zod para los endpoints /internal/* consumidos por superadmin.
// Ref: .claude/contracts/superadmin-api.md
import { z } from 'zod';

// ── GET /internal/organizations ───────────────────────────────────────────────
export const InternalListOrgsSchema = z.object({
  ecosystemId: z.string().optional(),
  status:      z.enum(['ACTIVE', 'SUSPENDED', 'BLOCKED']).optional(),
  storeStatus: z.enum(['ACTIVE', 'PAUSED']).optional(),
  page:        z.coerce.number().int().positive().default(1),
  limit:       z.coerce.number().int().min(1).max(100).default(50),
  search:      z.string().optional(),
});
export type InternalListOrgsDto = z.infer<typeof InternalListOrgsSchema>;

// ── POST /internal/organizations/:id/suspend | /unsuspend ────────────────────
// ── POST /internal/organizations/:id/pause-store | /resume-store ─────────────
export const InternalOrgActionSchema = z.object({
  reason: z.string().min(10, 'reason must be at least 10 characters'),
});
export type InternalOrgActionDto = z.infer<typeof InternalOrgActionSchema>;
