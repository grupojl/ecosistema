import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { TenantContext } from '../guards/tenant.guard';

export const Tenant = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): TenantContext =>
    ctx.switchToHttp().getRequest().tenant,
);
