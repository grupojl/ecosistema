/**
 * gaps.service.ts — huecos de información (welver-domain.md §13.2 «Atención sin personas», §13.3).
 *
 * Cuando la IA no sabe, lo dice, indica el canal oficial y registra la pregunta acá. El admin ve una lista semanal con
 * las preguntas sin respuesta más repetidas y decide qué cargar: no es automático. Una pregunta puede promoverse a
 * pregunta de prueba para que la calidad se mida también sobre lo que la gente realmente pregunta.
 *
 * `record` lo llama la IA (integración) servicio-a-servicio. Lista semanal = huecos ABIERTOS vistos en los últimos 7 días,
 * ordenados por repeticiones (el conteo es el acumulado de la pregunta; no hay un contador por semana).
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { Prisma } from '@/generated/prisma';
import { EntityAccessService } from '@/welver/entity-access/entity-access.service';
import { QualityService } from '@/welver/quality/quality.service';
import {
  isRecordableQuestion,
  normalizeQuestion,
  weeklyWindowStart,
} from '@/welver/domain/gap-normalize';
import type { WelverActor } from '@/welver/welver.types';

export type GapStatusValue = 'OPEN' | 'RESOLVED' | 'DISMISSED';

@Injectable()
export class GapsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EntityAccessService,
    private readonly quality: QualityService,
  ) {}

  /** Registra (o suma una repetición a) una pregunta sin respuesta. Ignora lo que no es una pregunta real. */
  async record(
    organizationId: string,
    question: string,
    entityId?: string | null,
    now = new Date(),
  ) {
    const normalized = normalizeQuestion(question);
    if (!isRecordableQuestion(normalized)) return { recorded: false as const };
    const tenant = this.prisma.forTenant(organizationId);

    if (entityId) {
      const exists = await tenant.municipalEntity.count({
        where: { id: entityId },
      });
      if (exists === 0) entityId = null; // un ente inexistente no debe perder la pregunta
    }
    const gap = await tenant.informationGap.upsert({
      where: {
        organizationId_questionNormalized: {
          organizationId,
          questionNormalized: normalized,
        },
      },
      create: {
        organizationId,
        entityId: entityId ?? null,
        questionNormalized: normalized,
        sampleQuestion: question.trim().slice(0, 300),
        firstSeenAt: now,
        lastSeenAt: now,
      },
      update: {
        occurrences: { increment: 1 },
        lastSeenAt: now,
        // Si ya estaba resuelta o descartada y vuelve a aparecer, es señal de que el dato no alcanzó: se reabre.
        status: 'OPEN',
        resolvedAt: null,
        resolvedBy: null,
      },
      select: { id: true, occurrences: true },
    });
    return {
      recorded: true as const,
      id: gap.id,
      occurrences: gap.occurrences,
    };
  }

  /** La lista semanal: abiertos y vistos en los últimos 7 días, los más repetidos primero. */
  async weekly(actor: WelverActor, limit = 20, now = new Date()) {
    const where = await this.scopeWhere(actor, {
      status: 'OPEN',
      lastSeenAt: { gte: weeklyWindowStart(now) },
    });
    return this.prisma.forTenant(actor.organizationId).informationGap.findMany({
      where,
      orderBy: [{ occurrences: 'desc' }, { lastSeenAt: 'desc' }],
      take: limit,
    });
  }

  async list(
    actor: WelverActor,
    input: { status?: GapStatusValue; page: number; limit: number },
  ) {
    const where = await this.scopeWhere(
      actor,
      input.status ? { status: input.status } : {},
    );
    const tenant = this.prisma.forTenant(actor.organizationId);
    const [data, total] = await Promise.all([
      tenant.informationGap.findMany({
        where,
        orderBy: [{ occurrences: 'desc' }, { lastSeenAt: 'desc' }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      tenant.informationGap.count({ where }),
    ]);
    return { data, total };
  }

  async setStatus(actor: WelverActor, id: string, status: GapStatusValue) {
    const gap = await this.loadManageable(actor, id);
    return this.prisma.forTenant(actor.organizationId).informationGap.update({
      where: { id: gap.id },
      data:
        status === 'OPEN'
          ? { status, resolvedAt: null, resolvedBy: null }
          : { status, resolvedAt: new Date(), resolvedBy: actor.uid },
    });
  }

  /** Convierte el hueco en una pregunta de prueba de calidad (con la respuesta esperada que escribe el admin). */
  async promoteToQuestion(actor: WelverActor, id: string, expected: string) {
    const gap = await this.loadManageable(actor, id);
    return this.quality.createQuestion(
      actor,
      {
        kind: 'QUALITY',
        question: gap.sampleQuestion,
        expected,
        entityId: gap.entityId,
      },
      'GAP',
    );
  }

  // ── Interno ───────────────────────────────────────────────────────────────

  /** El dueño ve todos; un colaborador, los de los entes que puede ver (los generales, sin ente, son del dueño). */
  private async scopeWhere(
    actor: WelverActor,
    base: Prisma.InformationGapWhereInput,
  ): Promise<Prisma.InformationGapWhereInput> {
    const allowed = (await this.access.forActor(actor)).idsAllowing('view');
    return allowed ? { ...base, entityId: { in: [...allowed] } } : base;
  }

  private async loadManageable(actor: WelverActor, id: string) {
    const gap = await this.prisma
      .forTenant(actor.organizationId)
      .informationGap.findFirst({ where: { id } });
    if (!gap) throw new NotFoundException('Hueco no encontrado');
    const access = await this.access.forActor(actor);
    if (gap.entityId === null) access.assertOwner();
    else access.assert(gap.entityId, 'edit');
    return gap;
  }
}
