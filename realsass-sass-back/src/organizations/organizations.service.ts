import { Injectable, NotFoundException, ForbiddenException, Logger, Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MarketsService } from '../markets/markets.service';
import type { UpdateOrganizationInput, StoreInfo } from './domain/organization.entity';
import { ORGANIZATIONS_REPOSITORY, type IOrganizationsRepository } from './repository/organizations.repository.interface';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @Inject(ORGANIZATIONS_REPOSITORY)
    private readonly repo: IOrganizationsRepository,
    private readonly marketsService: MarketsService,
  ) {}

  async createForUser(userId: string, tx?: Prisma.TransactionClient) {
    return this.repo.create({ userId, firebaseUid: '' }, tx);
  }

  /**
   * ADR-014 — crea la org y siembra su Market default.
   * Antes estaba declarado FUERA de la clase (error de sintaxis) y sin
   * MarketsService inyectado: sass-back no compilaba.
   */
  async createForUserWithDefaultMarket(userId: string, countryCode = 'AR') {
    const org = await this.createForUser(userId);
    await this.marketsService.seedDefaultMarket(org.id, countryCode);
    return org;
  }

  async getMyOrganization(firebaseUid: string) {
    const org = await this.repo.findByFirebaseUid(firebaseUid);
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async updateMyOrganization(firebaseUid: string, dto: UpdateOrganizationInput) {
    const org = await this.repo.findByFirebaseUid(firebaseUid);
    if (!org) throw new NotFoundException('Organization not found');
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
    const org = await this.repo.findByFirebaseUid(firebaseUid);
    if (!org) throw new NotFoundException('Organization not found');
    if (org.id !== organizationId) throw new ForbiddenException('Not owner');
    return org;
  }
}
