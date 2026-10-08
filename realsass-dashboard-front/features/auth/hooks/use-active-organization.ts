'use client';
import { useAuth } from '@real/auth-client';

/**
 * Organización activa del usuario, resuelta desde `user.tenants` y el
 * `organizationId` del contexto de auth (@real/auth-client).
 */
export function useActiveOrganization() {
  const { user, organizationId } = useAuth();
  const tenant = user?.tenants.find((t) => t.organizationId === organizationId) ?? null;
  return {
    organization: tenant?.organization ?? null,
    role:         tenant?.role ?? null,
  };
}
