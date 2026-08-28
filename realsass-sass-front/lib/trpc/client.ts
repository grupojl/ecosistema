/**
 * lib/trpc/client.ts — realsass-sass-front
 *
 * Cliente tRPC React para el dashboard de dueños.
 * Conecta con realsass-sass-back en /api/v1/trpc.
 *
 * Auth: cookies HttpOnly (ADR-004).
 *   credentials: 'include' → la cookie __session viaja automáticamente.
 *   Sin Authorization header — el back lee la cookie directamente.
 *
 * x-organization-id: sigue siendo necesario para resolver el tenant.
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
        // credentials: 'include' → envía la cookie __session HttpOnly en cada request
        // Reemplaza el Bearer token del modelo anterior (ADR-004)
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
