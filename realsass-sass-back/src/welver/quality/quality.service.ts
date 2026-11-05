/**
 * quality.service.ts — calidad y seguridad de la IA (welver-domain.md §13.1 y §13.2).
 *
 * El equipo arma con el municipio, en el onboarding, un set de preguntas de prueba (calidad: 95%; seguridad: 100%) que se
 * amplía con los huecos de información. Acá viven las preguntas, el registro de cada corrida y el veredicto «¿se puede
 * publicar el asistente?». Quien EJECUTA la corrida contra la IA (chatia) llega con la integración y llama a `recordRun`.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { toJsonValue } from '@/common/prisma/json';
import { EntityAccessService } from '@/welver/entity-access/entity-access.service';
import { SubscriptionService } from '@/welver/subscription/subscription.service';
import {
  evaluateRun,
  readiness,
  type Readiness,
  type RunItem,
  type TestKind,
} from '@/welver/domain/quality-gates';
import type { WelverActor } from '@/welver/welver.types';

export interface CreateQuestionInput {
  kind: TestKind;
  question: string;
  expected?: string;
  entityId?: string | null;
}

export interface UpdateQuestionInput {
  question?: string;
  expected?: string | null;
  entityId?: string | null;
  active?: boolean;
}

@Injectable()
export class QualityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EntityAccessService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async listQuestions(actor: WelverActor, kind?: TestKind) {
    const access = await this.access.forActor(actor);
    const allowed = access.idsAllowing('view');
    const rows = await this.prisma
      .forTenant(actor.organizationId)
      .testQuestion.findMany({
        where: kind ? { kind } : {},
        orderBy: { createdAt: 'asc' },
      });
    // Un colaborador ve las de sus entes; las generales (sin ente) son del municipio entero.
    return allowed
      ? rows.filter((q) => q.entityId === null || allowed.has(q.entityId))
      : rows;
  }

  async createQuestion(
    actor: WelverActor,
    input: CreateQuestionInput,
    source = 'MANUAL',
  ) {
    await this.subscriptions.assertWritable(actor.organizationId);
    await this.assertCanManage(actor, input.entityId ?? null);
    return this.prisma.forTenant(actor.organizationId).testQuestion.create({
      data: {
        organizationId: actor.organizationId,
        kind: input.kind,
        question: input.question,
        expected: input.expected ?? null,
        entityId: input.entityId ?? null,
        source,
      },
    });
  }

  async updateQuestion(
    actor: WelverActor,
    id: string,
    input: UpdateQuestionInput,
  ) {
    await this.subscriptions.assertWritable(actor.organizationId);
    const tenant = this.prisma.forTenant(actor.organizationId);
    const current = await tenant.testQuestion.findFirst({ where: { id } });
    if (!current) throw new NotFoundException('Pregunta no encontrada');
    await this.assertCanManage(actor, current.entityId);
    if (input.entityId !== undefined)
      await this.assertCanManage(actor, input.entityId);
    return tenant.testQuestion.update({
      where: { id },
      data: {
        ...(input.question !== undefined && { question: input.question }),
        ...(input.expected !== undefined && { expected: input.expected }),
        ...(input.entityId !== undefined && { entityId: input.entityId }),
        ...(input.active !== undefined && { active: input.active }),
      },
    });
  }

  async removeQuestion(
    actor: WelverActor,
    id: string,
  ): Promise<{ removed: boolean }> {
    await this.subscriptions.assertWritable(actor.organizationId);
    const tenant = this.prisma.forTenant(actor.organizationId);
    const current = await tenant.testQuestion.findFirst({
      where: { id },
      select: { entityId: true },
    });
    if (!current) throw new NotFoundException('Pregunta no encontrada');
    await this.assertCanManage(actor, current.entityId);
    await tenant.testQuestion.delete({ where: { id } });
    return { removed: true };
  }

  /**
   * Guarda el resultado de una corrida y lo evalúa contra la meta. Las preguntas del resultado tienen que ser del
   * municipio (no se aceptan ids ajenos).
   */
  async recordRun(
    organizationId: string,
    kind: TestKind,
    items: readonly RunItem[],
    triggeredBy?: string,
  ) {
    const tenant = this.prisma.forTenant(organizationId);
    const ids = items.map((i) => i.questionId);
    const known = await tenant.testQuestion.count({
      where: { id: { in: ids }, kind },
    });
    if (known !== new Set(ids).size)
      throw new NotFoundException(
        'El resultado incluye preguntas que no son de este municipio o de otro tipo',
      );

    const evaluation = evaluateRun(kind, items);
    const run = await tenant.qualityRun.create({
      data: {
        organizationId,
        kind,
        total: evaluation.total,
        passed: evaluation.passed,
        covered: evaluation.covered,
        results: toJsonValue(items),
        triggeredBy: triggeredBy ?? null,
      },
      select: {
        id: true,
        kind: true,
        total: true,
        passed: true,
        covered: true,
        createdAt: true,
      },
    });
    return { run, evaluation };
  }

  async history(actor: WelverActor, kind?: TestKind, limit = 20) {
    return this.prisma.forTenant(actor.organizationId).qualityRun.findMany({
      where: kind ? { kind } : {},
      select: {
        id: true,
        kind: true,
        total: true,
        passed: true,
        covered: true,
        createdAt: true,
        triggeredBy: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** ¿Puede publicarse el asistente? Usa la última corrida de cada tipo y la última vez que cambió la base o el set. */
  async readiness(organizationId: string): Promise<Readiness> {
    const tenant = this.prisma.forTenant(organizationId);
    const pick = {
      total: true,
      passed: true,
      covered: true,
      createdAt: true,
    } as const;
    const [quality, security, lastVersion, lastQuestion] = await Promise.all([
      tenant.qualityRun.findFirst({
        where: { kind: 'QUALITY' },
        orderBy: { createdAt: 'desc' },
        select: pick,
      }),
      tenant.qualityRun.findFirst({
        where: { kind: 'SECURITY' },
        orderBy: { createdAt: 'desc' },
        select: pick,
      }),
      tenant.knowledgeVersion.aggregate({ _max: { publishedAt: true } }),
      tenant.testQuestion.aggregate({ _max: { updatedAt: true } }),
    ]);
    const dates = [
      lastVersion._max.publishedAt,
      lastQuestion._max.updatedAt,
    ].filter((d): d is Date => d !== null);
    const lastChangeAt =
      dates.length > 0
        ? new Date(Math.max(...dates.map((d) => d.getTime())))
        : null;
    return readiness(quality, security, lastChangeAt);
  }

  /** Las preguntas generales (sin ente) las gestiona el dueño; las de un ente, quien pueda editarlo. */
  private async assertCanManage(
    actor: WelverActor,
    entityId: string | null,
  ): Promise<void> {
    const access = await this.access.forActor(actor);
    if (entityId === null) access.assertOwner();
    else access.assert(entityId, 'edit');
  }
}
