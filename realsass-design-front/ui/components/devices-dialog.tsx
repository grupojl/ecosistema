"use client"

/**
 * DevicesDialog — modal de dispositivos y sesiones activas (ADR-020).
 *
 * Presentacional: no sabe de tRPC. Cada front lo conecta a `sessions.list / revoke / revokeOthers`
 * del sass-back, así la UI vive en un solo lugar (@real/ui) y los tipos de dominio se infieren
 * en el front desde @real/trpc (ADR-019).
 */
import * as React from "react"
import { Loader2, Monitor, Smartphone, Tablet, CircleHelp, LogOut } from "lucide-react"

import { Button } from "./button"
import { Badge } from "./badge"
import { Skeleton } from "./skeleton"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "./dialog"

export interface DeviceSession {
  id: string
  deviceType: string
  browser: string | null
  os: string | null
  ipPrefix: string | null
  country: string | null
  lastSeenAt: Date | string
  isCurrent: boolean
}

export interface DevicesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessions: readonly DeviceSession[] | undefined
  isLoading: boolean
  /** Mensaje de error de la consulta, si falló. */
  error?: string | null
  /** Id de la sesión que se está cerrando (deshabilita su botón). */
  revokingId?: string | null
  isRevokingOthers?: boolean
  onRevoke: (sessionId: string) => void
  onRevokeOthers: () => void
  /** Si se pasa, la sesión actual muestra "Cerrar sesión" (cierra la sesión de este dispositivo). */
  onLogout?: () => void
  isLoggingOut?: boolean
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
}

/** "hace 5 min", "hace 3 h", "hace 2 d". La granularidad real es ~1 h (ADR-020). */
export function timeAgo(value: Date | string, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(value).getTime())
  const min = Math.floor(diff / 60_000)
  if (min < 2) return "recién"
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

function deviceTitle(s: DeviceSession): string {
  const parts = [s.browser, s.os].filter(Boolean)
  return parts.length > 0 ? parts.join(" en ") : "Dispositivo desconocido"
}

function deviceMeta(s: DeviceSession): string {
  const place = [s.country, s.ipPrefix && `IP ${s.ipPrefix}`].filter(Boolean).join(" · ")
  return [place, s.isCurrent ? "activo ahora" : timeAgo(s.lastSeenAt)].filter(Boolean).join(" · ")
}

export function DevicesDialog({
  open, onOpenChange, sessions, isLoading, error,
  revokingId, isRevokingOthers, onRevoke, onRevokeOthers, onLogout, isLoggingOut,
}: DevicesDialogProps) {
  const others = sessions?.filter((s) => !s.isCurrent).length ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dispositivos</DialogTitle>
          <DialogDescription>
            Los equipos donde iniciaste sesión. Si no reconocés uno, cerralo.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto" aria-live="polite">
          {isLoading && (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          )}

          {!isLoading && error && (
            <p className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</p>
          )}

          {!isLoading && !error && sessions?.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay sesiones registradas todavía. Las sesiones iniciadas antes de esta función no aparecen.
            </p>
          )}

          {!isLoading && sessions?.map((s) => {
            const Icon = ICONS[s.deviceType] ?? CircleHelp
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-lg border p-3">
                <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{deviceTitle(s)}</p>
                    {s.isCurrent && <Badge variant="secondary">Este dispositivo</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{deviceMeta(s)}</p>
                </div>
                {s.isCurrent && onLogout && (
                  <Button size="sm" variant="outline" disabled={isLoggingOut} onClick={onLogout}>
                    {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cerrar sesión"}
                  </Button>
                )}
                {!s.isCurrent && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={revokingId === s.id}
                    onClick={() => onRevoke(s.id)}
                  >
                    {revokingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cerrar"}
                  </Button>
                )}
              </div>
            )
          })}
        </div>

        {others > 0 && (
          <Button variant="outline" className="w-full gap-2" disabled={isRevokingOthers} onClick={onRevokeOthers}>
            {isRevokingOthers ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Cerrar las demás sesiones ({others})
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
