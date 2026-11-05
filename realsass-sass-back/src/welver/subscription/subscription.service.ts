/**
 * subscription.service.ts — paquete único del municipio (welver-domain.md §5, §13.1, §15.2).
 *
 * v1 cobra por transferencia y la plataforma verifica el pago a mano (`markInvoicePaid`, solo servicio-a-servicio).
 * El estado real se calcula con la fecha (domain/subscription-lifecycle.ts); el guardado se actualiza al sincronizar
 * (`syncStatuses`, pensado para un cron) o al renovar. Al suspender, los canales se pausan; al renovar, se reanudan
 * solo los que pausó la suspensión (no los que pausó el dueño a mano).
 */
import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigAuditService } from '@/config-audit/config-audit.service';
import {
  isValidPopulation,
  tierForPopulation,
  toTier,
  type Tier,
} from '@/welver/domain/tiers';
import {
  GRACE_DAYS_DEFAULT,
  daysUntilPeriodEnd,
  effectiveStatus,
  graceEndsAt,
  isPanelWritable,
  isServiceEnabled,
  renewalPeriod,
  addPeriod,
  type BillingPeriod,
  type SubscriptionStatus,
} from '@/welver/domain/subscription-lifecycle';

export interface SubscriptionView {
  id: string;
  tier: Tier;
  period: BillingPeriod;
  billingMode: 'MANUAL' | 'ONLINE';
  status: SubscriptionStatus;
  storedStatus: SubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  graceEndsAt: Date | null;
  daysUntilPeriodEnd: number | null;
  messageCap: number | null;
  isPilot: boolean;
  serviceEnabled: boolean;
  panelWritable: boolean;
  /** La población actual del municipio corresponde a otro tramo que el contratado: avisar, no cambiar solo. */
  tierMismatch: boolean;
}

export interface CreateSubscriptionInput {
  period: BillingPeriod;
}

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: ConfigAuditService,
  ) {}

  async get(
    organizationId: string,
    now = new Date(),
  ): Promise<SubscriptionView | null> {
    const [sub, org] = await Promise.all([
      this.prisma
        .forTenant(organizationId)
        .subscription.findUnique({ where: { organizationId } }),
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { population: true },
      }),
    ]);
    if (!sub) return null;
    const tier = toTier(sub.tier);
    const status = effectiveStatus(sub, now);
    return {
      id: sub.id,
      tier,
      period: sub.period,
      billingMode: sub.billingMode,
      status,
      storedStatus: sub.status,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      graceEndsAt: graceEndsAt(sub),
      daysUntilPeriodEnd: daysUntilPeriodEnd(sub.currentPeriodEnd, now),
      messageCap: sub.messageCap,
      isPilot: sub.isPilot,
      serviceEnabled: isServiceEnabled(status),
      panelWritable: isPanelWritable(status),
      tierMismatch: isValidPopulation(org?.population)
        ? tierForPopulation(org.population) !== tier
        : false,
    };
  }

  /** Alta del paquete (flujo 7.1): el tramo sale de la población ya cargada. Queda PENDING hasta verificar el primer pago. */
  async create(
    organizationId: string,
    uid: string,
    input: CreateSubscriptionInput,
    now = new Date(),
  ): Promise<SubscriptionView> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { population: true },
    });
    if (!org) throw new NotFoundException('Organización no encontrada');
    if (!isValidPopulation(org.population)) {
      throw new BadRequestException(
        'Cargá primero la población del municipio: define el tramo del paquete',
      );
    }
    const tenant = this.prisma.forTenant(organizationId);
    if (
      await tenant.subscription.findUnique({
        where: { organizationId },
        select: { id: true },
      })
    ) {
      throw new ConflictException(
        'El municipio ya tiene un paquete contratado',
      );
    }

    const tier = tierForPopulation(org.population);
    const subscriptionId = randomUUID();
    await tenant.$transaction([
      tenant.subscription.create({
        data: {
          id: subscriptionId,
          organizationId,
          tier,
          period: input.period,
          billingMode: 'MANUAL',
          graceDays: GRACE_DAYS_DEFAULT,
        },
      }),
      tenant.subscriptionInvoice.create({
        data: {
          organizationId,
          subscriptionId,
          periodStart: now,
          periodEnd: addPeriod(now, input.period),
        },
      }),
    ]);
    this.audit.log({
      organizationId,
      userId: uid,
      configType: 'subscription',
      configKey: 'create',
      action: 'create',
      diff: { tier, period: input.period },
    });
    const created = await this.get(organizationId, now);
    if (!created) throw new NotFoundException('Paquete no encontrado');
    return created;
  }

  async invoices(organizationId: string) {
    return this.prisma
      .forTenant(organizationId)
      .subscriptionInvoice.findMany({ orderBy: { periodStart: 'desc' } });
  }

  /**
   * Verificación manual del pago (solo servicio-a-servicio). Idempotente: marcar dos veces la misma factura no extiende
   * el período dos veces. Abre el período siguiente, deja lista la factura que sigue y reanuda los canales.
   */
  async markInvoicePaid(
    organizationId: string,
    invoiceId: string,
    markedBy: string,
    reference?: string,
    now = new Date(),
  ): Promise<SubscriptionView> {
    const tenant = this.prisma.forTenant(organizationId);
    const invoice = await tenant.subscriptionInvoice.findFirst({
      where: { id: invoiceId },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    if (invoice.status === 'VOID')
      throw new ConflictException('La factura está anulada');
    const sub = await tenant.subscription.findUnique({
      where: { organizationId },
    });
    if (!sub) throw new NotFoundException('Paquete no encontrado');

    if (invoice.status === 'PENDING') {
      const period = renewalPeriod(sub, sub.period, now);
      await tenant.$transaction([
        tenant.subscriptionInvoice.update({
          where: { id: invoice.id },
          data: {
            status: 'PAID',
            paidAt: now,
            markedPaidBy: markedBy,
            reference: reference ?? null,
          },
        }),
        tenant.subscription.update({
          where: { organizationId },
          data: {
            status: 'ACTIVE',
            currentPeriodStart: period.start,
            currentPeriodEnd: period.end,
          },
        }),
        tenant.subscriptionInvoice.create({
          data: {
            organizationId,
            subscriptionId: sub.id,
            periodStart: period.end,
            periodEnd: addPeriod(period.end, sub.period),
          },
        }),
        // Reanuda solo lo que pausó la suspensión: lo ya conectado vuelve a CONNECTED, el resto a PENDING.
        tenant.entityChannel.updateMany({
          where: {
            status: 'PAUSED',
            pausedReason: 'SUBSCRIPTION',
            connectedAt: { not: null },
          },
          data: { status: 'CONNECTED', pausedAt: null, pausedReason: null },
        }),
        tenant.entityChannel.updateMany({
          where: {
            status: 'PAUSED',
            pausedReason: 'SUBSCRIPTION',
            connectedAt: null,
          },
          data: { status: 'PENDING', pausedAt: null, pausedReason: null },
        }),
      ]);
      this.audit.log({
        organizationId,
        userId: markedBy,
        configType: 'subscription',
        configKey: invoice.id,
        action: 'invoice_paid',
        diff: {
          periodEnd: period.end.toISOString(),
          reference: reference ?? null,
        },
      });
    }
    const view = await this.get(organizationId, now);
    if (!view) throw new NotFoundException('Paquete no encontrado');
    return view;
  }

  /** Tope mensual de mensajes (3× el uso medio del piloto). Solo servicio-a-servicio. */
  async setMessageCap(
    organizationId: string,
    cap: number | null,
    by: string,
  ): Promise<SubscriptionView> {
    const tenant = this.prisma.forTenant(organizationId);
    const sub = await tenant.subscription.findUnique({
      where: { organizationId },
      select: { id: true },
    });
    if (!sub) throw new NotFoundException('Paquete no encontrado');
    await tenant.subscription.update({
      where: { organizationId },
      data: { messageCap: cap },
    });
    this.audit.log({
      organizationId,
      userId: by,
      configType: 'subscription',
      configKey: 'messageCap',
      action: 'update',
      diff: { cap },
    });
    const view = await this.get(organizationId);
    if (!view) throw new NotFoundException('Paquete no encontrado');
    return view;
  }

  /**
   * Pasa el estado guardado al real para TODOS los municipios y pausa los canales de los que se suspenden.
   * Opera sobre varias organizaciones a propósito: con RLS activo debe correr en contexto de sistema (setSystemContext).
   */
  async syncStatuses(
    now = new Date(),
  ): Promise<{ checked: number; changed: number; suspended: number }> {
    const subs = await this.prisma.subscription.findMany({
      where: { status: { in: ['ACTIVE', 'GRACE'] } },
    });
    let changed = 0;
    let suspended = 0;
    for (const sub of subs) {
      const next = effectiveStatus(sub, now);
      if (next === sub.status) continue;
      changed++;
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: next },
      });
      if (next === 'SUSPENDED') {
        suspended++;
        await this.prisma.entityChannel.updateMany({
          where: {
            organizationId: sub.organizationId,
            status: { in: ['CONNECTED', 'PENDING'] },
          },
          data: {
            status: 'PAUSED',
            pausedAt: now,
            pausedReason: 'SUBSCRIPTION',
          },
        });
        this.audit.log({
          organizationId: sub.organizationId,
          configType: 'subscription',
          configKey: sub.id,
          action: 'suspended',
        });
      }
    }
    return { checked: subs.length, changed, suspended };
  }

  /**
   * Compuerta de escritura del panel: suspendido o sin primer pago = solo lectura (welver-domain.md §13.1).
   * DECISIÓN ABIERTA: un municipio SIN fila de paquete todavía puede escribir (alta/prueba, antes de contratar). Si el
   * negocio exige pagar antes de tocar el panel, se cierra acá con una línea.
   */
  async assertWritable(
    organizationId: string,
    now = new Date(),
  ): Promise<void> {
    const sub = await this.prisma
      .forTenant(organizationId)
      .subscription.findUnique({
        where: { organizationId },
        select: { status: true, currentPeriodEnd: true, graceDays: true },
      });
    if (!sub) return;
    if (!isPanelWritable(effectiveStatus(sub, now))) {
      throw new ForbiddenException(
        'El paquete del municipio está suspendido o sin pago verificado: el panel está en solo lectura',
      );
    }
  }
}
