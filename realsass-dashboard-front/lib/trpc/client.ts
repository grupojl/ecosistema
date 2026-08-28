/**
 * lib/trpc/client.ts — realsass-dashboard-front
 *
 * Cliente tRPC React para el dashboard de colaboradores.
 * Conecta con realsass-sass-back en /api/v1/trpc.
 *
 * Auth: cookies HttpOnly (ADR-004).
 *   credentials: 'include' → la cookie __session viaja automáticamente.
 *   Sin Authorization header — el back lee la cookie directamente.
 */
import { createTRPCReact }  from '@trpc/react-query';
import { httpBatchLink }    from '@trpc/client';
import type { AppRouter }   from './router-type';

export const trpc = createTRPCReact<AppRouter>();

export function makeTrpcClient(
  url:               string,
  getOrganizationId: () => string | null = () => null,
) {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url,
        fetch: (input, init) => fetch(input, { ...init, credentials: 'include' }),
        async headers() {
          const orgId = getOrganizationId();
          return {
            ...(orgId ? { 'x-organization-id': orgId } : {}),
          };
        },
      }),
    ],
  });
}
