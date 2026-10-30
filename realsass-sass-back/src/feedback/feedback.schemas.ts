/**
 * feedback.schemas.ts — contratos Zod de los reportes de usuario (ADR-027, contracts/user-feedback.md).
 */
import { z } from 'zod';

export const FEEDBACK_STATUSES = [
  'RECEIVED',
  'IN_PROGRESS',
  'RESOLVED',
  'WONT_FIX',
] as const;
export const FeedbackStatusSchema = z.enum(FEEDBACK_STATUSES);

export const CreateFeedbackSchema = z.object({
  message: z.string().trim().min(10).max(2000),
  expected: z.string().trim().max(1000).optional(),
  module: z.string().trim().min(1).max(60),
  route: z.string().trim().min(1).max(300),
  // Solo con consentimiento visible del usuario (norte, pilar 2).
  diagnostics: z
    .object({
      consoleErrors: z.array(z.string().max(2000)).max(50).optional(),
    })
    .optional(),
});
export type CreateFeedbackInput = z.infer<typeof CreateFeedbackSchema>;

export const ListFeedbackSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(20),
});
export type ListFeedbackInput = z.infer<typeof ListFeedbackSchema>;

// ── /internal/feedback (superadmin) ──────────────────────────────────────────
export const InternalListFeedbackSchema = z.object({
  status: FeedbackStatusSchema.optional(),
  organizationId: z.string().optional(),
  module: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type InternalListFeedbackDto = z.infer<
  typeof InternalListFeedbackSchema
>;

export const InternalUpdateFeedbackSchema = z
  .object({
    status: FeedbackStatusSchema.optional(),
    internalNote: z.string().max(5000).optional(),
  })
  .refine((v) => v.status !== undefined || v.internalNote !== undefined, {
    message: 'Nada que actualizar',
  });
export type InternalUpdateFeedbackDto = z.infer<
  typeof InternalUpdateFeedbackSchema
>;
