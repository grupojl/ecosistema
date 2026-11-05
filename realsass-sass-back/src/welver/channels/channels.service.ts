/**
 * channels.service.ts — canales de Meta y TikTok por ente (welver-domain.md §13.2 «Redes y canales», §15.2).
 *
 * Una cuenta por ente y por red, mapeada al organigrama; el admin del municipio conecta todas. Acá vive el REGISTRO y el
 * estado (PENDING → CONNECTED ⇄ PAUSED / ERROR). La conexión real (OAuth, Embedded Signup, webhooks de Meta, credenciales
 * en SecretConfig) es la integración que sigue: `markStatus` es el punto de entrada para que la complete.
 * Las credenciales NUNCA se guardan ni se devuelven acá (`secretKey` es solo una referencia a SecretConfig).
 */
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { EntityAccessService } from '@/welver/entity-access/entity-access.service';
import { SubscriptionService } from '@/welver/subscription/subscription.service';
import type { WelverActor } from '@/welver/welver.types';

export type ChannelProviderValue =
  'WHATSAPP' | 'INSTAGRAM' | 'MESSENGER' | 'TIKTOK';
export type ChannelStatusValue = 'PENDING' | 'CONNECTED' | 'PAUSED' | 'ERROR';

export interface RegisterChannelInput {
  entityId: string;
  provider: ChannelProviderValue;
  accountRef: string;
  displayName?: string;
}

const PUBLIC_SELECT = {
  id: true,
  entityId: true,
  provider: true,
  accountRef: true,
  displayName: true,
  status: true,
  lastError: true,
  connectedAt: true,
  pausedAt: true,
  pausedReason: true,
  createdAt: true,
} as const;

@Injectable()
export class ChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EntityAccessService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async list(actor: WelverActor) {
    const access = await this.access.forActor(actor);
    const allowed = access.idsAllowing('view');
    return this.prisma.forTenant(actor.organizationId).entityChannel.findMany({
      where: allowed ? { entityId: { in: [...allowed] } } : {},
      select: PUBLIC_SELECT,
      orderBy: [{ entityId: 'asc' }, { provider: 'asc' }],
    });
  }

  async register(actor: WelverActor, input: RegisterChannelInput) {
    await this.subscriptions.assertWritable(actor.organizationId);
    (await this.access.forActor(actor)).assertOwner();
    const tenant = this.prisma.forTenant(actor.organizationId);

    const entity = await tenant.municipalEntity.findFirst({
      where: { id: input.entityId },
      select: { archivedAt: true },
    });
    if (!entity) throw new NotFoundException('Ente no encontrado');
    if (entity.archivedAt)
      throw new ConflictException('El ente está archivado');

    const [sameEntity, sameAccount] = await Promise.all([
      tenant.entityChannel.findFirst({
        where: { entityId: input.entityId, provider: input.provider },
        select: { id: true },
      }),
      tenant.entityChannel.findFirst({
        where: { provider: input.provider, accountRef: input.accountRef },
        select: { entityId: true },
      }),
    ]);
    if (sameEntity)
      throw new ConflictException(
        'Este ente ya tiene una cuenta conectada en esa red (una por ente)',
      );
    if (sameAccount)
      throw new ConflictException(
        'Esa cuenta ya está asignada a otro ente del municipio',
      );

    return tenant.entityChannel.create({
      data: {
        organizationId: actor.organizationId,
        entityId: input.entityId,
        provider: input.provider,
        accountRef: input.accountRef,
        displayName: input.displayName ?? null,
      },
      select: PUBLIC_SELECT,
    });
  }

  async pause(actor: WelverActor, id: string) {
    await this.subscriptions.assertWritable(actor.organizationId);
    (await this.access.forActor(actor)).assertOwner();
    const channel = await this.load(actor.organizationId, id);
    if (channel.status === 'PAUSED') return channel;
    return this.prisma.forTenant(actor.organizationId).entityChannel.update({
      where: { id },
      data: { status: 'PAUSED', pausedAt: new Date(), pausedReason: 'MANUAL' },
      select: PUBLIC_SELECT,
    });
  }

  async resume(actor: WelverActor, id: string) {
    await this.subscriptions.assertWritable(actor.organizationId);
    (await this.access.forActor(actor)).assertOwner();
    const channel = await this.load(actor.organizationId, id);
    if (channel.status !== 'PAUSED') return channel;
    if (channel.pausedReason === 'SUBSCRIPTION') {
      throw new ConflictException(
        'El canal está pausado por la suscripción: se reanuda solo al verificar el pago',
      );
    }
    return this.prisma.forTenant(actor.organizationId).entityChannel.update({
      where: { id },
      data: {
        status: channel.connectedAt ? 'CONNECTED' : 'PENDING',
        pausedAt: null,
        pausedReason: null,
      },
      select: PUBLIC_SELECT,
    });
  }

  async remove(actor: WelverActor, id: string): Promise<{ removed: boolean }> {
    await this.subscriptions.assertWritable(actor.organizationId);
    (await this.access.forActor(actor)).assertOwner();
    await this.load(actor.organizationId, id);
    await this.prisma
      .forTenant(actor.organizationId)
      .entityChannel.delete({ where: { id } });
    return { removed: true };
  }

  /** Para la integración con Meta/TikTok: confirma la conexión, la marca con error o guarda la referencia al secreto. */
  async markStatus(
    organizationId: string,
    id: string,
    status: Exclude<ChannelStatusValue, 'PAUSED'>,
    detail: { error?: string; secretKey?: string } = {},
  ) {
    await this.load(organizationId, id);
    return this.prisma.forTenant(organizationId).entityChannel.update({
      where: { id },
      data: {
        status,
        lastError:
          status === 'ERROR' ? (detail.error ?? 'Error sin detalle') : null,
        ...(status === 'CONNECTED' && { connectedAt: new Date() }),
        ...(detail.secretKey !== undefined && { secretKey: detail.secretKey }),
      },
      select: PUBLIC_SELECT,
    });
  }

  private async load(organizationId: string, id: string) {
    const channel = await this.prisma
      .forTenant(organizationId)
      .entityChannel.findFirst({ where: { id }, select: PUBLIC_SELECT });
    if (!channel) throw new NotFoundException('Canal no encontrado');
    return channel;
  }
}
