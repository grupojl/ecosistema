import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { Prisma }              from '@prisma/client';
import { USERS_REPOSITORY, type IUsersRepository } from './repository/users.repository.interface';
import type { OrganizationAccessResult }            from '@real/auth-server';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly repo: IUsersRepository,
  ) {}

  async buildProfile(firebaseUid: string) {
    const profile = await this.repo.buildProfile(firebaseUid);
    if (!profile) throw new NotFoundException('User not found');
    return profile;
  }

  async getMyProfile(firebaseUid: string) {
    return this.buildProfile(firebaseUid);
  }

  async getOrganizationAccess(
    firebaseUid:    string,
    organizationId: string,
  ): Promise<OrganizationAccessResult> {
    return this.repo.getOrganizationAccess(firebaseUid, organizationId);
  }

  async getDashboardAccess(firebaseUid: string) {
    const profile = await this.repo.buildProfile(firebaseUid);
    if (!profile) throw new NotFoundException('User not found');
    return {
      organization:   profile.organization,
      collaborations: profile.collaborations,
    };
  }

  async selectRole(
    firebaseUid: string,
    dto: { role: 'owner' | 'affiliate'; organizationId?: string },
  ) {
    const profile = await this.repo.buildProfile(firebaseUid);
    if (!profile) throw new NotFoundException('User not found');
    return { ok: true, role: dto.role };
  }

  /** Upsert de usuario — llamado desde AuthService.syncUser() */
  async upsertUser(
    firebaseUid:  string,
    email?:       string,
    displayName?: string,
    photoUrl?:    string,
    referredByCode?: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.repo.upsert({ firebaseUid, email, displayName, photoUrl, referredByCode }, tx);
  }
}
