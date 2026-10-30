import type {
  Organization,
  UpdateOrganizationInput,
  CreateOrganizationInput,
  StoreInfo,
} from '@/domain/organization.entity';
import type { Prisma } from '@/generated/prisma';

export const ORGANIZATIONS_REPOSITORY = Symbol('ORGANIZATIONS_REPOSITORY');

export interface IOrganizationsRepository {
  findByFirebaseUid(firebaseUid: string): Promise<Organization | null>;
  findByUserId(userId: string): Promise<Organization | null>;
  /** D3: todas las organizaciones que posee el usuario, la más antigua primero. */
  listByFirebaseUid(firebaseUid: string): Promise<Organization[]>;
  countByUserId(userId: string): Promise<number>;
  slugExists(slug: string): Promise<boolean>;
  resolveUserId(firebaseUid: string): Promise<string | null>;
  findBySlug(slug: string): Promise<StoreInfo | null>;
  findPublicById(id: string): Promise<StoreInfo | null>;
  /** Tiendas ACTIVAS para el sitemap: solo slug, país y fecha. Nunca datos del dueño. */
  listPublicStores(
    limit: number,
  ): Promise<Array<{ slug: string; countryCode: string; updatedAt: Date }>>;
  create(
    input: CreateOrganizationInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Organization>;
  update(id: string, input: UpdateOrganizationInput): Promise<Organization>;
}
