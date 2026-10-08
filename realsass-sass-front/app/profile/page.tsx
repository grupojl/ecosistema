/**
 * app/profile/page.tsx — realsass-sass-front
 *
 * Server Component con HydrationBoundary.
 * Prefetchea el perfil del usuario para eliminar loading flash.
 * S4-D — HydrationBoundary / Fase 4 Escalón 11
 */
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { cookies }                                    from 'next/headers';
import { createTRPCClient, httpBatchLink }            from '@trpc/client';
import type { AppRouter }                             from '@/lib/trpc/router-type';

function getSassBackUrl(): string {
  return (process.env['SASS_BACK_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? '')
    .replace(/\/+$/, '');
}

function createSassServerCaller(sessionCookie?: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${getSassBackUrl()}/api/v1/trpc`,
        headers() {
          return sessionCookie ? { cookie: `__session=${sessionCookie}` } : {};
        },
      }),
    ],
  });
}

export default async function ProfilePage() {
  const queryClient   = new QueryClient();
  const cookieStore   = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;

  if (sessionCookie) {
    const caller = createSassServerCaller(sessionCookie);
    await queryClient.prefetchQuery({
      queryKey: ['auth', 'me'],
      queryFn:  () => caller.auth.me.query(),
    }).catch(() => {
      // Prefetch falla silenciosamente — el Client Component fetcha en mount
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {/* ProfileView es el Client Component con 'use client' */}
      {/* Importar: import { ProfileView } from '@/components/profile/profile-view' */}
    </HydrationBoundary>
  );
}
