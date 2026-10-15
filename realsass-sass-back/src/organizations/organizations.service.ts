import { Injectable, NotFoundException, ForbiddenException, Logger, Inject } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { QuotaExceededException } from '@/common/exceptions/quota-exceeded.exception';
import { Prisma } from '@/generated/prisma';
import { MarketsService } from '@/markets/markets.service';
import { runInTenant } from '@/prisma/tenant-context';
import type { UpdateOrganizationInput, StoreInfo } from '@/organizations/domain/organization.entity';
import { ORGANIZATIONS_REPOSITORY, type IOrganizationsRepository } from '@/organizations/repository/organizations.repository.interface';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @Inject(ORGANIZATIONS_REPOSITORY)
    private readonly repo: IOrganizationsRepository,
    private readonly marketsService: MarketsService,
  ) {}

  async createForUser(userId: string, tx?: Prisma.TransactionClient, name?: string, countryCode?: string) {
    const slug = await this.generateSlug(name);
    return this.repo.create({ userId, firebaseUid: '', slug, ...(name ? { name } : {}), ...(countryCode ? { countryCode } : {}) }, tx);
  }

  /** Tope de organizaciones propias por usuario (D3). Configurable por plan; hoy un único valor. */
  private get maxOrgsPerUser(): number {
    const n = Number(process.env['MAX_ORGS_PER_USER'] ?? 3);
    return Number.isFinite(n) && n > 0 ? n : 3;
  }

  /** Slug legible + sufijo aleatorio: único y no derivable del id del usuario. */
  private async generateSlug(name?: string): Promise<string> {
    const base = (name ?? 'tienda')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'tienda';
    for (let i = 0; i < 5; i++) {
      const slug = base + '-' + randomBytes(2).toString('hex');
      if (!(await this.repo.slugExists(slug))) return slug;
    }
    return base + '-' + randomBytes(4).toString('hex');
  }

  /** D3: todas las organizaciones que posee el usuario. */
  async listMine(firebaseUid: string) {
    return this.repo.listByFirebaseUid(firebaseUid);
  }

  /** D3: crea una organización adicional, respetando el tope del plan. */
  async createMine(firebaseUid: string, dto: { name: string; countryCode?: string }) {
    const userId = await this.repo.resolveUserId(firebaseUid);
    if (!userId) throw new NotFoundException('User not found');
    const current = await this.repo.countByUserId(userId);
    if (current >= this.maxOrgsPerUser) {
      throw new QuotaExceededException('organizations', this.maxOrgsPerUser, current);
    }
    return this.createForUserWithDefaultMarket(userId, dto.countryCode ?? 'AR', dto.name);
  }

  /** D1: garantiza que el usuario tenga al menos una organización. Devuelve la que existe o la creada. */
  async ensureDefaultOrganization(user: { id: string; displayName?: string | null; email?: string | null }) {
    const existing = await this.repo.findByUserId(user.id);
    if (existing) return { organization: existing, created: false as const };
    const owner = (user.displayName ?? user.email?.split('@')[0] ?? '').trim();
    const name  = owner ? 'Tienda de ' + owner : 'Mi tienda';
    const organization = await this.createForUserWithDefaultMarket(user.id, 'AR', name);
    return { organization, created: true as const };
  }

  /**
   * ADR-014 — crea la org y siembra su Market default.
   * Antes estaba declarado FUERA de la clase (error de sintaxis) y sin
   * MarketsService inyectado: sass-back no compilaba.
   */
  async createForUserWithDefaultMarket(userId: string, countryCode = 'AR', name?: string) {
    const org = await this.createForUser(userId, undefined, name, countryCode);
    // ADR-027: la organización recién creada es el único tenant visible mientras se siembra su Market default.
    await runInTenant(org.id, () => this.marketsService.seedDefaultMarket(org.id, countryCode));
    return org;
  }

  /** Organización activa si se indica y es propia; si no, la más antigua. */
  async getMyOrganization(firebaseUid: string, activeOrganizationId?: string | null) {
    const all = await this.repo.listByFirebaseUid(firebaseUid);
    const org = (activeOrganizationId ? all.find(o => o.id === activeOrganizationId) : undefined) ?? all[0];
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async updateMyOrganization(firebaseUid: string, dto: UpdateOrganizationInput, activeOrganizationId?: string | null) {
    const org = await this.getMyOrganization(firebaseUid, activeOrganizationId);
    return this.repo.update(org.id, dto);
  }

  async findByUserId(userId: string) {
    return this.repo.findByUserId(userId);
  }

  /**
   * StoreInfo público por slug. storeStatus PAUSED → ecommerceEnabled: false
   * (ADR-013); StoreService de ecommerce-back lo traduce a 404.
   */
  async findBySlugPublic(slug: string): Promise<StoreInfo | null> {
    return this.repo.findBySlug(slug);
  }

  /** Alias para TenantGuard de sass-back (verifica ownership) */
  async getOrganizationWithOwner(organizationId: string, firebaseUid: string) {
    const all = await this.repo.listByFirebaseUid(firebaseUid);
    if (all.length === 0) throw new NotFoundException('Organization not found');
    const org = all.find(o => o.id === organizationId);
    if (!org) throw new ForbiddenException('Not owner');
    return org;
  }
}
