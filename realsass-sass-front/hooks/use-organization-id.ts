import { useAuth } from '@/context/auth-context'

export function useOrganizationId(): string | null {
  const { profile } = useAuth()
  return profile?.organization?.id ?? null
}
