'use client'
/**
 * organization-switcher.tsx — realsass-sass-front
 *
 * D3 (domain/flows/owner-organizacion.md): el usuario puede ser dueño de varias organizaciones.
 * Lista las propias, marca la activa, permite cambiar de una a otra y crear una nueva.
 *
 * D4: cambiar de organización NO reemite la cookie; solo cambia el header x-organization-id
 * de los próximos requests, y se invalidan las consultas cacheadas de la organización anterior.
 */
import { useState }                from 'react'
import { Building2, Check, Loader2, Plus } from 'lucide-react'
import { Button, Input, Card } from '@real/ui'
import { useAuth }                 from '@/context/auth-context'
import { trpc }                    from '@/lib/trpc/client'
import { getErrorMessage }         from '@/lib/errors'

interface QuotaData { appCode?: string | null; quota?: { limit: number } | null }

export function OrganizationSwitcher() {
  const { profile, activeOrganizationId, switchOrganization, refreshProfile } = useAuth()
  const utils = trpc.useUtils()

  const [creating, setCreating] = useState(false)
  const [name,     setName]     = useState('')
  const [error,    setError]    = useState<string | null>(null)

  const create = trpc.organizations.create.useMutation()

  const orgs = profile?.organizations ?? []

  const handleSwitch = (id: string) => {
    if (id === activeOrganizationId) return
    switchOrganization(id)
    void utils.invalidate() // los datos cacheados son de la organización anterior
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const org = await create.mutateAsync({ name })
      await refreshProfile()
      switchOrganization(org.id)
      void utils.invalidate()
      setName('')
      setCreating(false)
    } catch (err) {
      const data = (err as { data?: QuotaData }).data
      if (data?.appCode === 'QUOTA_EXCEEDED') {
        setError(`Alcanzaste el máximo de organizaciones de tu plan${data.quota ? ` (${data.quota.limit})` : ''}.`)
      } else {
        setError(getErrorMessage(err, 'No pudimos crear la organización.'))
      }
    }
  }

  if (orgs.length === 0) return null

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" /> Mis organizaciones
        </p>
        {!creating && (
          <Button size="sm" variant="ghost" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nueva
          </Button>
        )}
      </div>

      <ul className="space-y-1">
        {orgs.map(o => {
          const active = o.id === activeOrganizationId
          return (
            <li key={o.id}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleSwitch(o.id)}
                aria-current={active ? 'true' : undefined}
                className="w-full justify-between font-normal"
              >
                <span className="truncate">{o.name ?? o.slug ?? 'Sin nombre'}</span>
                {active && <Check className="h-4 w-4 shrink-0 text-primary" aria-label="Organización activa" />}
              </Button>
            </li>
          )
        })}
      </ul>

      {creating && (
        <form onSubmit={handleCreate} className="space-y-2">
          <Input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nombre de la organización"
            minLength={2}
            maxLength={100}
            required
          />
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={create.isPending || name.trim().length < 2}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setCreating(false); setError(null) }}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}
