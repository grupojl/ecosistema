'use client'
import { useTRPC } from '@/lib/trpc/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrganizationId } from '@/hooks/use-organization-id'

// Lista de países LATAM soportados
const SUPPORTED_COUNTRIES: Record<string, string> = {
  AR: '🇦🇷 Argentina',
  CO: '🇨🇴 Colombia',
  MX: '🇲🇽 México',
  BR: '🇧🇷 Brasil',
  CL: '🇨🇱 Chile',
  UY: '🇺🇾 Uruguay',
  PE: '🇵🇪 Perú',
  EC: '🇪🇨 Ecuador',
  BO: '🇧🇴 Bolivia',
  PY: '🇵🇾 Paraguay',
}

export function MarketsManager() {
  const trpc          = useTRPC()
  const orgId         = useOrganizationId()
  const queryClient   = useQueryClient()

  const { data: markets = [], isLoading } = useQuery(
    trpc.markets.list.queryOptions({ organizationId: orgId })
  )

  const setDefault = useMutation(trpc.markets.setDefault.mutationOptions({
    onSuccess: () => queryClient.invalidateQueries(trpc.markets.list.queryOptions({ organizationId: orgId })),
  }))

  const toggleActive = useMutation(trpc.markets.update.mutationOptions({
    onSuccess: () => queryClient.invalidateQueries(trpc.markets.list.queryOptions({ organizationId: orgId })),
  }))

  if (isLoading) return <p className="text-muted-foreground text-sm">Cargando mercados...</p>

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-3 font-medium">País</th>
            <th className="text-left p-3 font-medium">Estado</th>
            <th className="text-left p-3 font-medium">Proveedor</th>
            <th className="text-left p-3 font-medium">Default</th>
          </tr>
        </thead>
        <tbody>
          {markets.map(market => (
            <tr key={market.id} className="border-t hover:bg-muted/20">
              <td className="p-3 font-medium">
                {SUPPORTED_COUNTRIES[market.countryCode] ?? market.countryCode}
              </td>
              <td className="p-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  market.isActive
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {market.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td className="p-3 text-muted-foreground">
                {market.fulfillmentConfig?.provider ?? (
                  <span className="text-amber-600 text-xs">⚠ Sin configurar</span>
                )}
              </td>
              <td className="p-3">
                {market.isDefault ? (
                  <span className="text-xs text-muted-foreground">Default</span>
                ) : (
                  <button
                    onClick={() => setDefault.mutate({ id: market.id })}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Hacer default
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
