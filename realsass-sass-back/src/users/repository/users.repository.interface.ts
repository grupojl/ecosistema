import type { User, UserProfile, UpsertUserInput } from '../domain/user.entity';
import type { Prisma } from '@prisma/client';

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

export interface IUsersRepository {
  findByFirebaseUid(firebaseUid: string): Promise<User | null>;
  upsert(input: UpsertUserInput, tx?: Prisma.TransactionClient): Promise<User>;
  buildProfile(firebaseUid: string): Promise<UserProfile | null>;
  getOrganizationAccess(firebaseUid: string, organizationId: string): Promise<{
    canAccess: boolean;
    userId?: string;
    organizationId?: string;
    role?: string;
    permissions?: Record<string, boolean>;
    reason?: string;
  }>;
}
