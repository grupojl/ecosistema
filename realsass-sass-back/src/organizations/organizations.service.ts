import { Injectable, NotFoundException, ForbiddenException, Logger, Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ORGANIZATIONS_REPOSITORY, type IOrganizationsRepository } from './repository/organizations.repository.interface';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

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

  async updateMyOrganization(firebaseUid: string, dto: UpdateOrganizationDto) {
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
