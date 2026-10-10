import { useAuth } from '@/context/auth-context'

export function useOrganizationId(): string | null {
  const { activeOrganizationId } = useAuth()
  return activeOrganizationId
}
