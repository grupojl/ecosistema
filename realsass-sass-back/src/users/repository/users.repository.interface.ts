import type { User, UserProfile, UpsertUserInput } from '@/domain/user.entity';
import type { OrganizationAccessResult }           from '@real/auth-server';
import type { Prisma }                             from '@/generated/prisma';

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

export interface IUsersRepository {
  findByFirebaseUid(firebaseUid: string): Promise<User | null>;
  upsert(input: UpsertUserInput, tx?: Prisma.TransactionClient): Promise<User>;
  buildProfile(firebaseUid: string): Promise<UserProfile | null>;
  getOrganizationAccess(firebaseUid: string, organizationId: string): Promise<OrganizationAccessResult>;
}
