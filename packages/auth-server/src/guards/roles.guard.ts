import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable,
} from '@nestjs/common';
import { Reflector }  from '@nestjs/core';
import { ROLES_KEY }  from '../decorators/roles.decorator';
import type { TenantContext, TenantRole } from '../types/tenant-context';

const HIERARCHY: Record<TenantRole, number> = {
  OWNER: 4, ADMIN: 3, MEMBER: 2, VIEWER: 1,
};

/** RolesGuard — aplica RBAC jerarquico. Requiere TenantContext en req.tenant. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<TenantRole[]>(ROLES_KEY, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const { tenant } = ctx.switchToHttp().getRequest() as { tenant?: TenantContext };
    if (!tenant) {
      throw new ForbiddenException('TenantContext no disponible. Registra TenantGuard antes de RolesGuard.');
    }

    const userLevel = HIERARCHY[tenant.role] ?? 0;
    const minLevel  = Math.min(...required.map(r => HIERARCHY[r] ?? 0));

    if (userLevel < minLevel) {
      throw new ForbiddenException(
        `Rol insuficiente. Requerido: ${required.join(' o ')}. Tu rol: ${tenant.role}`,
      );
    }
    return true;
  }
}
