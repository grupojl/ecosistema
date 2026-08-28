import type { Organization, UpdateOrganizationInput, CreateOrganizationInput, StoreInfo } from '../domain/organization.entity';
import type { Prisma } from '@prisma/client';

export const ORGANIZATIONS_REPOSITORY = Symbol('ORGANIZATIONS_REPOSITORY');

export interface IOrganizationsRepository {
  findByFirebaseUid(firebaseUid: string): Promise<Organization | null>;
  findByUserId(userId: string): Promise<Organization | null>;
  findBySlug(slug: string): Promise<StoreInfo | null>;
  create(input: CreateOrganizationInput, tx?: Prisma.TransactionClient): Promise<Organization>;
  update(id: string, input: UpdateOrganizationInput): Promise<Organization>;
}
