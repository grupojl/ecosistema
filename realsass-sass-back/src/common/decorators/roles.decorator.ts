import { SetMetadata } from '@nestjs/common';

export type TenantRole = 'OWNER' | 'COLLABORATOR';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: TenantRole[]) => SetMetadata(ROLES_KEY, roles);
