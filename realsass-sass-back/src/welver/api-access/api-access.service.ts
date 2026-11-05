/**
 * api-access.service.ts — perfiles y claves de API (v2, welver-domain.md §13.3, §15.2).
 *
 * Detrás del flag `welver.api`. Solo el dueño crea perfiles y claves. La API pública es solo de consulta. Los perfiles
 * forman una jerarquía (municipio → secretaría) que hereda y restringe los entes visibles. La clave en claro se devuelve
 * una sola vez al crearla o rotarla; en la base solo queda su hash.
 *
 * Pendiente (integración): el endpoint público REST de consulta que usa `verifyKey`, y el límite por minuto por clave.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { toJsonValue } from '@/common/prisma/json';
import { z } from 'zod';
import { EntityAccessService } from '@/welver/entity-access/entity-access.service';
import { SubscriptionService } from '@/welver/subscription/subscription.service';
import {
  ProfileScopeError,
  assertWithinParent,
  effectiveVisibleEntities,
  generateApiKey,
  hashApiKey,
  looksLikeApiKey,
  profileWouldCycle,
  type ProfileNode,
} from '@/welver/domain/api-access';
import { WELVER_FLAGS, type WelverActor } from '@/welver/welver.types';

const StringList = z.array(z.string());
const KEY_TOUCH_INTERVAL_MS = 60_000;

export interface ProfileInput {
  name: string;
  parentId?: string | null;
  instructions?: string | null;
  tone?: string | null;
  language?: string | null;
  visibleEntityIds?: string[];
  allowedChannels?: string[];
  rateLimitPerMinute?: number | null;
  isActive?: boolean;
}

export interface VerifiedKey {
  organizationId: string;
  profileId: string;
  keyId: string;
  /** null = ve todo el organigrama. */
  visibleEntityIds: string[] | null;
  allowedChannels: string[];
  rateLimitPerMinute: number | null;
}

@Injectable()
export class ApiAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EntityAccessService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  // ── Perfiles ──────────────────────────────────────────────────────────────

  async listProfiles(actor: WelverActor) {
    (await this.access.forActor(actor)).assertOwner();
    return this.prisma
      .forTenant(actor.organizationId)
      .apiProfile.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async createProfile(actor: WelverActor, input: ProfileInput) {
    await this.guard(actor);
    const tenant = this.prisma.forTenant(actor.organizationId);
    const profiles = await tenant.apiProfile.findMany();
    const parentId = input.parentId ?? null;
    const visible = input.visibleEntityIds ?? [];

    await this.assertScope(actor.organizationId, profiles, parentId, visible);
    return tenant.apiProfile.create({
      data: {
        organizationId: actor.organizationId,
        parentId,
        name: input.name,
        instructions: input.instructions ?? null,
        tone: input.tone ?? null,
        language: input.language ?? null,
        visibleEntityIds: toJsonValue(visible),
        allowedChannels: toJsonValue(input.allowedChannels ?? []),
        rateLimitPerMinute: input.rateLimitPerMinute ?? null,
        isActive: input.isActive ?? true,
      },
    });
  }

  async updateProfile(
    actor: WelverActor,
    id: string,
    input: Partial<ProfileInput>,
  ) {
    await this.guard(actor);
    const tenant = this.prisma.forTenant(actor.organizationId);
    const profiles = await tenant.apiProfile.findMany();
    const current = profiles.find((p) => p.id === id);
    if (!current) throw new NotFoundException('Perfil no encontrado');

    const parentId =
      input.parentId === undefined ? current.parentId : input.parentId;
    const visible =
      input.visibleEntityIds ??
      StringList.catch([]).parse(current.visibleEntityIds);
    if (
      input.parentId !== undefined &&
      profileWouldCycle(id, input.parentId, profiles)
    ) {
      throw new BadRequestException(
        'Un perfil no puede quedar dentro de sí mismo ni de sus descendientes',
      );
    }
    if (input.parentId !== undefined || input.visibleEntityIds !== undefined) {
      await this.assertScope(
        actor.organizationId,
        profiles,
        parentId,
        visible,
        id,
      );
    }
    return tenant.apiProfile.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.parentId !== undefined && { parentId: input.parentId }),
        ...(input.instructions !== undefined && {
          instructions: input.instructions,
        }),
        ...(input.tone !== undefined && { tone: input.tone }),
        ...(input.language !== undefined && { language: input.language }),
        ...(input.visibleEntityIds !== undefined && {
          visibleEntityIds: toJsonValue(input.visibleEntityIds),
        }),
        ...(input.allowedChannels !== undefined && {
          allowedChannels: toJsonValue(input.allowedChannels),
        }),
        ...(input.rateLimitPerMinute !== undefined && {
          rateLimitPerMinute: input.rateLimitPerMinute,
        }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
  }

  /** Un perfil con hijos o claves no se borra: se desactiva (sus claves dejan de valer). */
  async removeProfile(
    actor: WelverActor,
    id: string,
  ): Promise<{ removed: boolean; deactivated: boolean }> {
    await this.guard(actor);
    const tenant = this.prisma.forTenant(actor.organizationId);
    const profile = await tenant.apiProfile.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('Perfil no encontrado');
    const [children, keys] = await Promise.all([
      tenant.apiProfile.count({ where: { parentId: id } }),
      tenant.apiKey.count({ where: { profileId: id } }),
    ]);
    if (children > 0 || keys > 0) {
      await tenant.apiProfile.update({
        where: { id },
        data: { isActive: false },
      });
      return { removed: false, deactivated: true };
    }
    await tenant.apiProfile.delete({ where: { id } });
    return { removed: true, deactivated: false };
  }

  // ── Claves ────────────────────────────────────────────────────────────────

  async listKeys(actor: WelverActor, profileId?: string) {
    (await this.access.forActor(actor)).assertOwner();
    return this.prisma.forTenant(actor.organizationId).apiKey.findMany({
      where: profileId ? { profileId } : {},
      select: {
        id: true,
        profileId: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Devuelve la clave en claro UNA vez. */
  async createKey(actor: WelverActor, profileId: string, name: string) {
    await this.guard(actor);
    const tenant = this.prisma.forTenant(actor.organizationId);
    const profile = await tenant.apiProfile.findFirst({
      where: { id: profileId },
      select: { isActive: true },
    });
    if (!profile) throw new NotFoundException('Perfil no encontrado');
    if (!profile.isActive)
      throw new BadRequestException('El perfil está desactivado');

    const key = generateApiKey();
    const row = await tenant.apiKey.create({
      data: {
        organizationId: actor.organizationId,
        profileId,
        name,
        prefix: key.prefix,
        keyHash: key.hash,
        createdBy: actor.uid,
      },
      select: {
        id: true,
        profileId: true,
        name: true,
        prefix: true,
        createdAt: true,
      },
    });
    return { ...row, key: key.plain };
  }

  async revokeKey(
    actor: WelverActor,
    id: string,
  ): Promise<{ revoked: boolean }> {
    await this.guard(actor);
    const { count } = await this.prisma
      .forTenant(actor.organizationId)
      .apiKey.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    if (count === 0)
      throw new NotFoundException('Clave no encontrada o ya revocada');
    return { revoked: true };
  }

  /** Rotación: revoca la clave y emite otra del mismo perfil y nombre. */
  async rotateKey(actor: WelverActor, id: string) {
    await this.guard(actor);
    const tenant = this.prisma.forTenant(actor.organizationId);
    const old = await tenant.apiKey.findFirst({
      where: { id, revokedAt: null },
      select: { profileId: true, name: true },
    });
    if (!old) throw new NotFoundException('Clave no encontrada o ya revocada');
    await tenant.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    return this.createKey(actor, old.profileId, old.name);
  }

  /**
   * Valida una clave recibida en una request pública y devuelve su alcance. Cruza organizaciones a propósito (todavía no
   * se sabe de quién es la clave): con RLS activo corre en contexto de sistema. Null = inválida, revocada o inactiva.
   */
  async verifyKey(
    plain: string,
    now = new Date(),
  ): Promise<VerifiedKey | null> {
    if (!looksLikeApiKey(plain)) return null;
    const row = await this.prisma.apiKey.findUnique({
      where: { keyHash: hashApiKey(plain) },
      include: { profile: true },
    });
    if (!row || row.revokedAt || !row.profile.isActive) return null;
    if (!(await this.isEnabled(row.organizationId))) return null;

    if (
      !row.lastUsedAt ||
      now.getTime() - row.lastUsedAt.getTime() > KEY_TOUCH_INTERVAL_MS
    ) {
      await this.prisma.apiKey.update({
        where: { id: row.id },
        data: { lastUsedAt: now },
      });
    }
    const profiles = await this.prisma.apiProfile.findMany({
      where: { organizationId: row.organizationId },
    });
    const visible = effectiveVisibleEntities(row.profileId, toNodes(profiles));
    return {
      organizationId: row.organizationId,
      profileId: row.profileId,
      keyId: row.id,
      visibleEntityIds: visible ? [...visible] : null,
      allowedChannels: StringList.catch([]).parse(row.profile.allowedChannels),
      rateLimitPerMinute: row.profile.rateLimitPerMinute,
    };
  }

  // ── Interno ───────────────────────────────────────────────────────────────

  async isEnabled(organizationId: string): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findFirst({
      where: {
        key: WELVER_FLAGS.api,
        enabled: true,
        OR: [{ organizationId }, { organizationId: null }],
      },
      select: { id: true },
    });
    return flag !== null;
  }

  private async guard(actor: WelverActor): Promise<void> {
    (await this.access.forActor(actor)).assertOwner();
    if (!(await this.isEnabled(actor.organizationId))) {
      throw new ForbiddenException(
        'La API de Welver no está habilitada para este municipio',
      );
    }
    await this.subscriptions.assertWritable(actor.organizationId);
  }

  private async assertScope(
    organizationId: string,
    profiles: readonly {
      id: string;
      parentId: string | null;
      visibleEntityIds: unknown;
      isActive: boolean;
    }[],
    parentId: string | null,
    visible: readonly string[],
    selfId?: string,
  ): Promise<void> {
    if (visible.length > 0) {
      const known = await this.prisma
        .forTenant(organizationId)
        .municipalEntity.count({ where: { id: { in: [...visible] } } });
      if (known !== new Set(visible).size)
        throw new BadRequestException(
          'Hay entes que no existen en este municipio',
        );
    }
    if (parentId === null) return;
    const parent = profiles.find((p) => p.id === parentId);
    if (!parent || parent.id === selfId)
      throw new NotFoundException('El perfil padre no existe');
    try {
      assertWithinParent(
        visible,
        effectiveVisibleEntities(parentId, toNodes(profiles)),
      );
    } catch (e) {
      if (e instanceof ProfileScopeError)
        throw new BadRequestException(e.message);
      throw e;
    }
  }
}

function toNodes(
  profiles: readonly {
    id: string;
    parentId: string | null;
    visibleEntityIds: unknown;
    isActive: boolean;
  }[],
): Map<string, ProfileNode> {
  return new Map(
    profiles.map((p) => [
      p.id,
      {
        id: p.id,
        parentId: p.parentId,
        visibleEntityIds: StringList.catch([]).parse(p.visibleEntityIds),
        isActive: p.isActive,
      },
    ]),
  );
}
