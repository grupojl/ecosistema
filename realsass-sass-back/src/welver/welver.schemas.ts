/**
 * welver.schemas.ts — contratos Zod de entrada de los routers de Welver. Los límites de largo existen para que nadie
 * pueda guardar un texto ilimitado en la base; los de contenido salen de domain/csv.ts (una sola fuente).
 */
import { z } from 'zod';
import { MAX_CONTENT_CHARS, MAX_TITLE_CHARS } from '@/welver/domain/csv';
import { MAX_POPULATION } from '@/welver/domain/tiers';
import { TEMPLATE_KEYS } from '@/welver/domain/org-chart-templates';
import {
  RETENTION_DAYS_MAX,
  RETENTION_DAYS_MIN,
} from '@/welver/municipality/municipality.service';
import { RunItemsSchema } from '@/welver/domain/quality-gates';

export const IdSchema = z.string().min(1).max(64);
const Name = z.string().trim().min(1).max(120);
const ShortText = z.string().trim().max(1000);

const TemplateKeySchema = z.enum(TEMPLATE_KEYS);
const BillingPeriodSchema = z.enum(['MONTHLY', 'ANNUAL']);
const KnowledgeStatusSchema = z.enum([
  'DRAFT',
  'IN_REVIEW',
  'PUBLISHED',
  'ARCHIVED',
]);
const TestKindSchema = z.enum(['QUALITY', 'SECURITY']);

// ── Municipio y suscripción ──────────────────────────────────────────────────
export const UpdateMunicipalitySchema = z
  .object({
    population: z.number().int().min(1).max(MAX_POPULATION),
    orgChartTemplate: TemplateKeySchema,
    dataRetentionDays: z
      .number()
      .int()
      .min(RETENTION_DAYS_MIN)
      .max(RETENTION_DAYS_MAX),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nada que actualizar' });

export const CreateSubscriptionSchema = z.object({
  period: BillingPeriodSchema,
});

export const InternalMarkPaidSchema = z.object({
  organizationId: IdSchema,
  invoiceId: IdSchema,
  markedBy: z.string().min(1).max(120),
  reference: z.string().trim().max(200).optional(),
});
export const InternalMessageCapSchema = z.object({
  organizationId: IdSchema,
  cap: z.number().int().positive().nullable(),
  by: z.string().min(1).max(120),
});

// ── Organigrama ──────────────────────────────────────────────────────────────
export const CreateEntitySchema = z.object({
  name: Name,
  description: ShortText.optional(),
  parentId: IdSchema.nullable().optional(),
});
export const UpdateEntitySchema = z.object({
  id: IdSchema,
  name: Name.optional(),
  description: ShortText.nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  requiresApproval: z.boolean().optional(),
  parentId: IdSchema.nullable().optional(),
});
export const ListEntitiesSchema = z.object({
  includeArchived: z.boolean().default(false),
});
export const LinkEntitiesSchema = z.object({
  fromEntityId: IdSchema,
  toEntityId: IdSchema,
  label: Name.optional(),
});
export const ApplyTemplateSchema = z.object({ template: TemplateKeySchema });

export const SetPermissionSchema = z.object({
  collaboratorId: IdSchema,
  entityId: IdSchema,
  canView: z.boolean().optional(),
  canEdit: z.boolean().optional(),
  canApprove: z.boolean().optional(),
  canPublish: z.boolean().optional(),
});
export const RemovePermissionSchema = z.object({
  collaboratorId: IdSchema,
  entityId: IdSchema,
});

// ── Conocimiento ─────────────────────────────────────────────────────────────
const Title = z.string().trim().min(1).max(MAX_TITLE_CHARS);
const Content = z.string().max(MAX_CONTENT_CHARS);
export const CreateKnowledgeSchema = z.object({
  entityId: IdSchema,
  title: Title,
  kind: z.enum(['TEXT', 'PDF']).default('TEXT'),
  content: Content.optional(),
  fileName: z.string().trim().max(255).optional(),
  fileUrl: z.string().trim().url().max(2048).optional(),
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(50 * 1024 * 1024)
    .optional(),
});
export const UpdateKnowledgeSchema = z.object({
  id: IdSchema,
  title: Title.optional(),
  content: Content.optional(),
  fileName: z.string().trim().max(255).nullable().optional(),
  fileUrl: z.string().trim().url().max(2048).nullable().optional(),
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(50 * 1024 * 1024)
    .nullable()
    .optional(),
});
export const ListKnowledgeSchema = z.object({
  entityId: IdSchema.optional(),
  status: KnowledgeStatusSchema.optional(),
  search: z.string().trim().max(200).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(20),
});
export const KnowledgeIdSchema = z.object({ id: IdSchema });
export const RejectKnowledgeSchema = z.object({
  id: IdSchema,
  note: z.string().trim().max(1000).optional(),
});
export const RestoreVersionSchema = z.object({
  id: IdSchema,
  version: z.number().int().positive(),
});
export const ImportCsvSchema = z.object({
  // 500 filas × 50.000 caracteres sería enorme: el tope de entrada es de 5 MB de texto.
  csv: z.string().min(1).max(5_000_000),
  dryRun: z.boolean().default(true),
});

// ── Mandatos ─────────────────────────────────────────────────────────────────
export const CreateMandateSchema = z.object({
  name: Name,
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
});
export const DuplicateMandateSchema = z.object({ id: IdSchema, name: Name });
export const RenameMandateSchema = z.object({ id: IdSchema, name: Name });
export const MandateIdSchema = z.object({ id: IdSchema });

// ── Canales ──────────────────────────────────────────────────────────────────
export const RegisterChannelSchema = z.object({
  entityId: IdSchema,
  provider: z.enum(['WHATSAPP', 'INSTAGRAM', 'MESSENGER', 'TIKTOK']),
  accountRef: z.string().trim().min(1).max(200),
  displayName: Name.optional(),
});
export const ChannelIdSchema = z.object({ id: IdSchema });

// ── Calidad y huecos ─────────────────────────────────────────────────────────
export const ListQuestionsSchema = z.object({
  kind: TestKindSchema.optional(),
});
export const CreateQuestionSchema = z.object({
  kind: TestKindSchema,
  question: z.string().trim().min(5).max(500),
  expected: z.string().trim().max(1000).optional(),
  entityId: IdSchema.nullable().optional(),
});
export const UpdateQuestionSchema = z.object({
  id: IdSchema,
  question: z.string().trim().min(5).max(500).optional(),
  expected: z.string().trim().max(1000).nullable().optional(),
  entityId: IdSchema.nullable().optional(),
  active: z.boolean().optional(),
});
export const QuestionIdSchema = z.object({ id: IdSchema });
export const HistorySchema = z.object({
  kind: TestKindSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
});
export const InternalRecordRunSchema = z.object({
  organizationId: IdSchema,
  kind: TestKindSchema,
  items: RunItemsSchema,
  triggeredBy: z.string().max(120).optional(),
});

export const WeeklyGapsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
});
export const ListGapsSchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED', 'DISMISSED']).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(20),
});
export const SetGapStatusSchema = z.object({
  id: IdSchema,
  status: z.enum(['OPEN', 'RESOLVED', 'DISMISSED']),
});
export const PromoteGapSchema = z.object({
  id: IdSchema,
  expected: z.string().trim().min(1).max(1000),
});
export const InternalRecordGapSchema = z.object({
  organizationId: IdSchema,
  question: z.string().trim().min(1).max(1000),
  entityId: IdSchema.nullable().optional(),
});

// ── API (v2) ─────────────────────────────────────────────────────────────────
export const CreateProfileSchema = z.object({
  name: Name,
  parentId: IdSchema.nullable().optional(),
  instructions: z.string().trim().max(4000).nullable().optional(),
  tone: z.string().trim().max(200).nullable().optional(),
  language: z.string().trim().min(2).max(10).nullable().optional(),
  visibleEntityIds: z.array(IdSchema).max(500).optional(),
  allowedChannels: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  rateLimitPerMinute: z
    .number()
    .int()
    .positive()
    .max(100_000)
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
});
export const UpdateProfileSchema = CreateProfileSchema.partial().extend({
  id: IdSchema,
});
export const ProfileIdSchema = z.object({ id: IdSchema });
export const ListKeysSchema = z.object({ profileId: IdSchema.optional() });
export const CreateKeySchema = z.object({ profileId: IdSchema, name: Name });
export const KeyIdSchema = z.object({ id: IdSchema });
export const InternalVerifyKeySchema = z.object({
  key: z.string().min(1).max(200),
});
