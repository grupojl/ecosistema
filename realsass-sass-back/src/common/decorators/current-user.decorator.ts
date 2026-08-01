import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserPayload {
  uid: string;
  email: string;
  emailVerified: boolean;
}

/**
 * Extrae el usuario autenticado del request.
 *
 * Uso:
 *   @Get('profile')
 *   getProfile(@CurrentUser() user: CurrentUserPayload) { ... }
 *
 *   @Get('uid-only')
 *   getUid(@CurrentUser('uid') uid: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (field: keyof CurrentUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: CurrentUserPayload = request.user;

    return field ? user?.[field] : user;
  },
);