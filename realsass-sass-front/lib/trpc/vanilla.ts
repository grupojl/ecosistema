/**
 * lib/trpc/vanilla.ts — realsass-sass-front
 *
 * Cliente tRPC "vanilla" (sin React) para código que corre FUERA del ciclo de React: el AuthContext,
 * durante el login. Es la versión tipada de lo que antes se armaba a mano con fetch + ?input=.
 *
 * Durante el login todavía no existe la cookie __session (se crea después de auth.sync), así que
 * estas llamadas se autentican con el Bearer idToken de Firebase. Los componentes usan los hooks de
 * lib/trpc/client.ts + use-auth-trpc.ts.
 */
import { createTRPCClient, httpBatchLink, TRPCClientError } from '@trpc/client';
import type { AppRouter } from '@/lib/trpc/router-type';

export function createBearerCaller(baseUrl: string, idToken: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${baseUrl}/api/v1/trpc`,
        // credentials: 'include' → si ya hay cookie __session viaja; el Bearer cubre el primer sync.
        fetch: (input, init) => fetch(input, { ...init, credentials: 'include' }),
        headers: () => ({ Authorization: `Bearer ${idToken}` }),
      }),
    ],
  });
}

/** HTTP status de un error de tRPC (o undefined si no lo es). */
export function trpcHttpStatus(err: unknown): number | undefined {
  if (!(err instanceof TRPCClientError)) return undefined;
  const data: unknown = err.data;
  return typeof data === 'object' && data !== null && 'httpStatus' in data && typeof data.httpStatus === 'number'
    ? data.httpStatus
    : undefined;
}
