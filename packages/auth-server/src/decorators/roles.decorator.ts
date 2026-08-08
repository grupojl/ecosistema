import { SetMetadata } from '@nestjs/common';
import type { TenantRole } from '../types/tenant-context';

export const ROLES_KEY = 'roles';

/** @Roles('OWNER', 'ADMIN') — exige uno de los roles listados. Jerarquia: OWNER > ADMIN > MEMBER > VIEWER. */
export const Roles = (...roles: TenantRole[]) => SetMetadata(ROLES_KEY, roles);
