import type { AccessSummary, AccountPatch, CreateAccountInput, User, UserAccount, UserProfile } from '@/domain/user.entity';
import type { OrganizationAccessResult }           from '@real/auth-server';

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

export interface IUsersRepository {
  findByFirebaseUid(firebaseUid: string): Promise<User | null>;
  buildProfile(firebaseUid: string): Promise<UserProfile | null>;

  // ── Cuenta (alta / sync de AuthService) ──
  findAccountByFirebaseUid(firebaseUid: string): Promise<UserAccount | null>;
  createAccount(input: CreateAccountInput): Promise<UserAccount>;
  updateAccount(id: string, patch: AccountPatch): Promise<void>;
  /** Solo colaboraciones ACTIVAS cuentan como acceso (un colaborador removido o pendiente no entra). */
  findAccessSummary(firebaseUid: string): Promise<AccessSummary | null>;
  getOrganizationAccess(firebaseUid: string, organizationId: string): Promise<OrganizationAccessResult>;
}
