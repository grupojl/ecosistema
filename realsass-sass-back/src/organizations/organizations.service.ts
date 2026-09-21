import { Injectable, NotFoundException, ForbiddenException, Logger, Inject } from '@nestjs/common';
import type { UpdateOrganizationInput } from './domain/organization.entity';
import { Prisma } from '@prisma/client';
import { ORGANIZATIONS_REPOSITORY, type IOrganizationsRepository } from './repository/organizations.repository.interface';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @Inject(ORGANIZATIONS_REPOSITORY)
    private readonly repo: IOrganizationsRepository,
  ) {}

  async createForUser(userId: string, tx?: Prisma.TransactionClient) {
    return this.repo.create({ userId, firebaseUid: '' }, tx);
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

  async findBySlugPublic(slug: string) {
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

// ─── INTEGRACIÓN SUPERADMIN — ADR-013 ────────────────────────────────────────
// Cuando storeStatus === 'PAUSED', el storefront debe devolver 404.
// StoreService en realsass-ecommerce-back llama a este back y lee ecommerceEnabled.
// Regla: en findBySlugPublic (o el método que devuelve StoreInfo),
// si organization.storeStatus === 'PAUSED' → devolver ecommerceEnabled: false.
//
// Ejemplo de aplicación en el método que resuelve el slug:
//
//   const org = await repo.findBySlug(slug);
//   if (!org) throw new NotFoundException();
//   return {
//     organizationId:   org.id,
//     slug:             org.slug,
//     name:             org.name,
//     ecommerceEnabled: org.storeStatus === 'ACTIVE',  // ← AGREGAR ESTA LÍNEA
//     ...
//   };
//
// StoreService ya maneja ecommerceEnabled: false con un NotFoundException.
// No hay cambios necesarios en realsass-ecommerce-back.
// ─────────────────────────────────────────────────────────────────────────────
