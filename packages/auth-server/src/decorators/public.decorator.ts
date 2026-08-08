import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** @Public() — marca una ruta como publica. FirebaseAuthGuard la deja pasar. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
