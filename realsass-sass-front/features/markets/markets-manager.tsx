'use client'
import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Card } from '@real/ui'
import { trpc } from '@/lib/trpc/client'
import { useOrganizationId } from '@/hooks/use-organization-id'
import { useAuth } from '@/context/auth-context'

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
  const orgId = useOrganizationId()
  const { sessionReady } = useAuth()
  const utils = trpc.useUtils()

  const { data: markets = [], isLoading } = trpc.markets.list.useQuery(
    { organizationId: orgId ?? '' },
    { enabled: !!orgId && sessionReady },
  )

  const setDefault = trpc.markets.setDefault.useMutation({
    onSuccess: () => utils.markets.list.invalidate(),
  })

  if (isLoading) return <p className="text-muted-foreground text-sm">Cargando mercados...</p>

  return (
    <Card className="overflow-hidden">
      <Table stack>
        <TableHeader>
          <TableRow>
            <TableHead>País</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Default</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {markets.map(market => (
            <TableRow key={market.id}>
              <TableCell data-label="País" className="font-medium">
                {SUPPORTED_COUNTRIES[market.countryCode] ?? market.countryCode}
              </TableCell>
              <TableCell data-label="Estado">
                <Badge variant={market.isActive ? "success" : "secondary"}>
                  {market.isActive ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell data-label="Proveedor" className="text-muted-foreground">
                {market.fulfillmentConfig?.provider ?? (
                  <Badge variant="warning">Sin configurar</Badge>
                )}
              </TableCell>
              <TableCell data-label="Default">
                {market.isDefault ? (
                  <span className="text-xs text-muted-foreground">Default</span>
                ) : (
                  <Button variant="link" size="sm" onClick={() => setDefault.mutate({ id: market.id })}>
                    Hacer default
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
