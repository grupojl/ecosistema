/**
 * knowledge-workflow.ts — flujo de publicación del conocimiento (welver-domain.md §13.2 «Publicación»).
 *
 *   sin aprobación:   DRAFT ──publish──▶ PUBLISHED
 *   con aprobación:   DRAFT ──submit──▶ IN_REVIEW ──publish──▶ PUBLISHED
 *                                           └──reject──▶ DRAFT
 *   en cualquier momento: edit (vuelve a DRAFT), archive ──▶ ARCHIVED ──unarchive──▶ DRAFT
 *
 * La aprobación se activa por ente (`MunicipalEntity.requiresApproval`). Editar un dato PUBLISHED lo pasa a DRAFT,
 * pero la IA sigue usando la última versión publicada hasta que se publique la nueva (las KnowledgeVersion no cambian).
 *
 * Dominio puro.
 */
import type { EntityAction } from '@/welver/domain/entity-access';

export type KnowledgeStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'ARCHIVED';
export type KnowledgeAction =
  'edit' | 'submit' | 'reject' | 'publish' | 'archive' | 'unarchive';

export class KnowledgeWorkflowError extends Error {
  constructor(
    readonly status: KnowledgeStatus,
    readonly action: KnowledgeAction,
    detail?: string,
  ) {
    super(detail ?? `No se puede «${action}» un dato en estado ${status}`);
    this.name = 'KnowledgeWorkflowError';
  }
}

export interface WorkflowContext {
  /** El ente exige revisión antes de publicar. */
  requiresApproval: boolean;
}

/** Estado al que lleva `action` desde `status`, o lanza KnowledgeWorkflowError si la transición no existe. */
export function transition(
  status: KnowledgeStatus,
  action: KnowledgeAction,
  ctx: WorkflowContext,
): KnowledgeStatus {
  switch (action) {
    case 'edit':
      if (status === 'ARCHIVED')
        throw new KnowledgeWorkflowError(
          status,
          action,
          'Un dato archivado no se edita: restauralo primero',
        );
      return 'DRAFT';
    case 'submit':
      if (!ctx.requiresApproval)
        throw new KnowledgeWorkflowError(
          status,
          action,
          'Este ente publica sin revisión',
        );
      if (status !== 'DRAFT') throw new KnowledgeWorkflowError(status, action);
      return 'IN_REVIEW';
    case 'reject':
      if (status !== 'IN_REVIEW')
        throw new KnowledgeWorkflowError(status, action);
      return 'DRAFT';
    case 'publish':
      if (ctx.requiresApproval ? status !== 'IN_REVIEW' : status !== 'DRAFT') {
        throw new KnowledgeWorkflowError(
          status,
          action,
          ctx.requiresApproval
            ? 'Este ente exige enviar el dato a revisión antes de publicarlo'
            : undefined,
        );
      }
      return 'PUBLISHED';
    case 'archive':
      if (status === 'ARCHIVED')
        throw new KnowledgeWorkflowError(status, action);
      return 'ARCHIVED';
    case 'unarchive':
      if (status !== 'ARCHIVED')
        throw new KnowledgeWorkflowError(status, action);
      return 'DRAFT';
  }
}

/**
 * Permiso del ente que exige cada acción.
 * - Con aprobación, publicar desde IN_REVIEW ES aprobar: lo hace quien tiene `approve`.
 * - Sin aprobación, publicar exige `publish`.
 */
export function requiredPermission(
  action: KnowledgeAction,
  ctx: WorkflowContext,
): EntityAction {
  switch (action) {
    case 'edit':
    case 'submit':
    case 'archive':
    case 'unarchive':
      return 'edit';
    case 'reject':
      return 'approve';
    case 'publish':
      return ctx.requiresApproval ? 'approve' : 'publish';
  }
}

/** ¿El dato aporta contenido a la IA? Solo si tiene al menos una versión publicada y no está archivado. */
export function isServed(
  status: KnowledgeStatus,
  publishedVersion: number,
): boolean {
  return status !== 'ARCHIVED' && publishedVersion > 0;
}
