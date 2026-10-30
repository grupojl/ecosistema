/**
 * feedback.service.ts — realsass-sass-back (ADR-027)
 *
 * Dueño del modelo FeedbackReport. El front crea y lee por tRPC (`feedback.*`); superadmin lee y actualiza por
 * `/internal/feedback*`. La organización sale siempre del contexto validado, nunca del input. El OWNER ve los
 * reportes de toda su organización; un colaborador, solo los suyos.
 */
import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@/generated/prisma';
import type { Request } from 'express';
import { PrismaService } from '@/prisma/prisma.service';
import type {
  CreateFeedbackInput,
  ListFeedbackInput,
  InternalListFeedbackDto,
  InternalUpdateFeedbackDto,
} from '@/feedback/feedback.schemas';
import {
  sanitizeConsoleErrors,
  stripSecrets,
} from '@/feedback/feedback.sanitize';

const MAX_REPORTS_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

/** Lo que ve el usuario: nunca incluye `context` ni `internalNote`. */
const USER_SELECT = {
  id: true,
  module: true,
  route: true,
  message: true,
  expected: true,
  status: true,
  createdAt: true,
} satisfies Prisma.FeedbackReportSelect;

export interface FeedbackActor {
  organizationId: string;
  uid: string;
  role: 'OWNER' | 'COLLABORATOR';
}

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(actor: FeedbackActor, input: CreateFeedbackInput, req: Request) {
    const since = new Date(Date.now() - HOUR_MS);
    const recent = await this.prisma.feedbackReport.count({
      where: { userUid: actor.uid, createdAt: { gte: since } },
    });
    if (recent >= MAX_REPORTS_PER_HOUR) {
      throw new HttpException(
        'Enviaste muchos reportes seguidos. Probá de nuevo en un rato.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const header = (name: string): string | undefined => {
      const v = req.headers[name];
      return typeof v === 'string' ? v.slice(0, 300) : undefined;
    };
    const context = stripSecrets({
      release:
        process.env['RELEASE'] ?? process.env['RAILWAY_GIT_COMMIT_SHA'] ?? null,
      traceId: header('x-request-id') ?? header('traceparent') ?? null,
      userAgent: header('user-agent') ?? null,
      consoleErrors: input.diagnostics?.consoleErrors
        ? sanitizeConsoleErrors(input.diagnostics.consoleErrors)
        : undefined,
    }) as Prisma.InputJsonObject;

    return this.prisma.feedbackReport.create({
      data: {
        organizationId: actor.organizationId,
        userUid: actor.uid,
        role: actor.role,
        module: input.module,
        route: input.route,
        message: input.message,
        expected: input.expected,
        context,
      },
      select: { id: true, status: true },
    });
  }

  async listMine(actor: FeedbackActor, { page, limit }: ListFeedbackInput) {
    const where = this.scope(actor);
    const [data, total] = await Promise.all([
      this.prisma.feedbackReport.findMany({
        where,
        select: USER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.feedbackReport.count({ where }),
    ]);
    return { data, total };
  }

  async getById(actor: FeedbackActor, id: string) {
    const report = await this.prisma.feedbackReport.findFirst({
      where: { id, ...this.scope(actor) },
      select: USER_SELECT,
    });
    if (!report) throw new NotFoundException('Reporte no encontrado');
    return report;
  }

  // ── Superadmin (/internal/feedback) ────────────────────────────────────────

  async internalList(dto: InternalListFeedbackDto) {
    const where: Prisma.FeedbackReportWhereInput = {
      ...(dto.status && { status: dto.status }),
      ...(dto.organizationId && { organizationId: dto.organizationId }),
      ...(dto.module && { module: dto.module }),
      ...(dto.search && {
        message: { contains: dto.search, mode: 'insensitive' },
      }),
    };
    const [data, total] = await Promise.all([
      this.prisma.feedbackReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
      }),
      this.prisma.feedbackReport.count({ where }),
    ]);
    return { data, total };
  }

  async internalGet(id: string) {
    const report = await this.prisma.feedbackReport.findUnique({
      where: { id },
    });
    if (!report) throw new NotFoundException('Reporte no encontrado');
    return report;
  }

  async internalUpdate(id: string, dto: InternalUpdateFeedbackDto) {
    await this.internalGet(id);
    return this.prisma.feedbackReport.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.internalNote !== undefined && {
          internalNote: dto.internalNote,
        }),
      },
    });
  }

  /** OWNER: toda la organización. Colaborador: solo lo que reportó él. */
  private scope(actor: FeedbackActor): Prisma.FeedbackReportWhereInput {
    return actor.role === 'OWNER'
      ? { organizationId: actor.organizationId }
      : { organizationId: actor.organizationId, userUid: actor.uid };
  }
}
