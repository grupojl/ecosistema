// realsass-sass-back/src/internal/internal-organizations.controller.ts
// ADR-010 — endpoints de organizaciones para superadmin (GrupoJL).
//
// Por qué PrismaService directo y no OrganizationsService:
//   OrganizationsService opera en el contexto de un usuario autenticado Firebase
//   (busca por firebaseUid, filtra por userId). Los endpoints internos del
//   superadmin necesitan acceso cross-org sin Firebase. El domain layer del
//   tenant no aplica aquí — estos son endpoints de administración global.
//
// Shapes exactos: ver .claude/contracts/internal-api.md (grupojl-control)
import {
  Controller, Get, Post, Param, Query, Body,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags }               from '@nestjs/swagger';
import { InternalApiKeyGuard }   from '../common/guards/internal-api-key.guard';
import { PrismaService }         from '../prisma/prisma.service';
import { ZodValidationPipe }     from '../common/pipes/zod-validation.pipe';
import { z }                     from 'zod';

// ── Schemas de validación ──────────────────────────────────────────────────

const ListOrgsSchema = z.object({
  // welver tiene un único ecosistema — el parámetro se acepta pero no filtra
  // (en el futuro, si welver tiene multi-ecosistema, filtrar aquí)
  ecosystemId: z.string().optional(),
  status:      z.enum(['ACTIVE', 'SUSPENDED', 'BLOCKED']).optional(),
  plan:        z.string().optional(),
  page:        z.coerce.number().int().positive().default(1),
  limit:       z.coerce.number().int().positive().max(100).default(20),
});
type ListOrgsInput = z.infer<typeof ListOrgsSchema>;

const SuspendSchema = z.object({
  reason: z.string().min(10, 'El motivo debe tener al menos 10 caracteres'),
});
type SuspendInput = z.infer<typeof SuspendSchema>;

// ── Controller ─────────────────────────────────────────────────────────────

@ApiTags('internal')
@UseGuards(InternalApiKeyGuard)
@Controller('internal/organizations')
export class InternalOrganizationsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /internal/organizations
   * Lista paginada con filtros opcionales por status y plan.
   * El superadmin usa esto en /organizations con filtros de ecosistema.
   */
  @Get()
  async list(
    @Query(new ZodValidationPipe(ListOrgsSchema)) q: ListOrgsInput,
  ) {
    const skip = (q.page - 1) * q.limit;

    const where: Record<string, unknown> = {};
    if (q.status) where['status'] = q.status;
    // plan no existe como campo en el schema — usar enabledProducts como proxy
    // cuando se agregue un campo plan real, actualizar este filtro

    const [orgs, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        select: {
          id:              true,
          name:            true,
          slug:            true,
          status:          true,
          enabledProducts: true,
          createdAt:       true,
          updatedAt:       true,
          user: {
            select: {
              email:       true,
              displayName: true,
            },
          },
          collaborators: {
            select: { _count: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take:    q.limit,
        skip,
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      data: orgs.map(org => ({
        id:                 org.id,
        name:               org.name,
        slug:               org.slug,
        ecosystemId:        'welver',     // identificador del ecosistema en el superadmin
        plan:               'STANDARD',   // DT: agregar campo plan al schema
        status:             org.status,
        ownerEmail:         org.user?.email ?? null,
        ownerName:          org.user?.displayName ?? null,
        collaboratorsCount: org.collaborators.length,
        enabledProducts:    org.enabledProducts,
        createdAt:          org.createdAt.toISOString(),
        updatedAt:          org.updatedAt.toISOString(),
        // lastPaymentAt no existe en el schema actual — deuda pendiente
        lastPaymentAt:      null,
        activeConversations: 0, // vendrá de chatia-backend cuando se integre
      })),
      meta: {
        total,
        page:  q.page,
        limit: q.limit,
        pages: Math.ceil(total / q.limit),
      },
    };
  }

  /**
   * GET /internal/organizations/:id
   * Detalle de una organización. El superadmin lo usa en Organization View.
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id },
      include: {
        user: {
          select: {
            id:          true,
            email:       true,
            displayName: true,
            photoUrl:    true,
          },
        },
        collaborators: {
          select: {
            id:          true,
            email:       true,
            status:      true,
            permissions: true,
            invitedAt:   true,
            acceptedAt:  true,
          },
        },
        themes: {
          where:  { isActive: true },
          select: { name: true, primaryColor: true, isActive: true },
          take:   1,
        },
        webhooks: {
          where:  { isActive: true },
          select: { id: true, url: true, events: true, isActive: true, failureCount: true },
        },
      },
    });

    return {
      id:              org.id,
      name:            org.name,
      slug:            org.slug,
      ecosystemId:     'welver',
      plan:            'STANDARD',
      status:          org.status,
      ownerEmail:      org.user?.email ?? null,
      ownerName:       org.user?.displayName ?? null,
      ownerPhotoUrl:   org.user?.photoUrl ?? null,
      enabledProducts: org.enabledProducts,
      createdAt:       org.createdAt.toISOString(),
      updatedAt:       org.updatedAt.toISOString(),
      collaborators:   org.collaborators,
      activeTheme:     org.themes[0] ?? null,
      webhooks:        org.webhooks,
      // Datos de chatia/pagos vendrán de los otros clientes del superadmin
      lastPaymentAt:       null,
      activeConversations: 0,
    };
  }

  /**
   * POST /internal/organizations/:id/suspend
   * Suspende una organización. Requiere reason de al menos 10 caracteres.
   * El superadmin registra un AdminAction antes de llamar este endpoint.
   */
  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspend(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SuspendSchema)) body: SuspendInput,
  ) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id } });

    if (org.status === 'SUSPENDED') {
      return { success: false, message: 'La organización ya está suspendida' };
    }

    await this.prisma.organization.update({
      where: { id },
      data:  { status: 'SUSPENDED' },
    });

    return {
      success:        true,
      organizationId: id,
      previousStatus: org.status,
      newStatus:      'SUSPENDED',
      reason:         body.reason,
    };
  }

  /**
   * POST /internal/organizations/:id/unsuspend
   * Reactiva una organización suspendida.
   */
  @Post(':id/unsuspend')
  @HttpCode(HttpStatus.OK)
  async unsuspend(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SuspendSchema)) body: SuspendInput,
  ) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id } });

    if (org.status === 'ACTIVE') {
      return { success: false, message: 'La organización ya está activa' };
    }

    if (org.status === 'BLOCKED') {
      return {
        success: false,
        message: 'Una organización bloqueada no puede ser reactivada desde el superadmin',
      };
    }

    await this.prisma.organization.update({
      where: { id },
      data:  { status: 'ACTIVE' },
    });

    return {
      success:        true,
      organizationId: id,
      previousStatus: org.status,
      newStatus:      'ACTIVE',
      reason:         body.reason,
    };
  }
}
