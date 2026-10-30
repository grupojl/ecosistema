"use client"

/**
 * FeedbackDialog — "Informar un problema" + lista de reportes propios (ADR-027, architecture/13-reportes-norte.md).
 *
 * Presentacional: no sabe de tRPC. Cada front lo conecta a `feedback.create / listMine` de sass-back.
 * El usuario cuenta qué pasó; el contexto técnico lo agrega el sistema. El diagnóstico adjunto se muestra antes de
 * enviar y solo viaja si el usuario lo deja marcado (consentimiento visible).
 */
import * as React from "react"
import { CircleAlert, Loader2 } from "lucide-react"

import { Button } from "./button"
import { Badge } from "./badge"
import { Checkbox } from "./checkbox"
import { Label } from "./label"
import { Skeleton } from "./skeleton"
import { Textarea } from "./textarea"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "./dialog"

export type FeedbackStatus = "RECEIVED" | "IN_PROGRESS" | "RESOLVED" | "WONT_FIX"

export interface FeedbackReportItem {
  id: string
  message: string
  status: FeedbackStatus
  createdAt: Date | string
}

export interface FeedbackSubmission {
  message: string
  expected?: string
  includeDiagnostics: boolean
}

export interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Devuelve true si se envió (el diálogo limpia el formulario). */
  onSubmit: (submission: FeedbackSubmission) => Promise<boolean>
  isSubmitting: boolean
  /** Mensaje de error del envío, si falló. */
  submitError?: string | null
  /** Errores de consola que se adjuntarían: se muestran antes de enviar. */
  diagnosticsPreview: readonly string[]
  reports: readonly FeedbackReportItem[] | undefined
  isLoadingReports: boolean
  reportsError?: string | null
  onRetryReports?: () => void
}

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  RECEIVED: "Recibido",
  IN_PROGRESS: "En curso",
  RESOLVED: "Resuelto",
  WONT_FIX: "No se corregirá",
}
const STATUS_VARIANT: Record<FeedbackStatus, "default" | "secondary" | "outline"> = {
  RECEIVED: "secondary",
  IN_PROGRESS: "default",
  RESOLVED: "outline",
  WONT_FIX: "outline",
}

const MIN_MESSAGE = 10

export function FeedbackDialog({
  open, onOpenChange, onSubmit, isSubmitting, submitError,
  diagnosticsPreview, reports, isLoadingReports, reportsError, onRetryReports,
}: FeedbackDialogProps) {
  const [message, setMessage] = React.useState("")
  const [expected, setExpected] = React.useState("")
  const [includeDiagnostics, setIncludeDiagnostics] = React.useState(true)
  const canSubmit = message.trim().length >= MIN_MESSAGE && !isSubmitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    const ok = await onSubmit({
      message: message.trim(),
      expected: expected.trim() || undefined,
      includeDiagnostics: includeDiagnostics && diagnosticsPreview.length > 0,
    })
    if (ok) {
      setMessage("")
      setExpected("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Informar un problema</DialogTitle>
          <DialogDescription>
            Contanos qué pasó. El módulo, la pantalla y la versión los agregamos nosotros.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="feedback-message">¿Qué pasó?</Label>
            <Textarea
              id="feedback-message" value={message} maxLength={2000} required
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Al guardar el producto aparece un error…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="feedback-expected">¿Qué esperabas que pasara? (opcional)</Label>
            <Textarea
              id="feedback-expected" value={expected} maxLength={1000}
              onChange={(e) => setExpected(e.target.value)}
            />
          </div>

          {diagnosticsPreview.length > 0 && (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="feedback-diagnostics" checked={includeDiagnostics}
                  onCheckedChange={(v) => setIncludeDiagnostics(v === true)}
                />
                <Label htmlFor="feedback-diagnostics" className="text-sm font-normal leading-snug">
                  Adjuntar los últimos errores de la pantalla (te mostramos qué se envía)
                </Label>
              </div>
              {includeDiagnostics && (
                <ul className="max-h-28 space-y-1 overflow-y-auto font-mono text-xs text-muted-foreground">
                  {diagnosticsPreview.map((line, i) => <li key={i} className="break-words">{line}</li>)}
                </ul>
              )}
            </div>
          )}

          {submitError && (
            <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              <CircleAlert className="h-4 w-4 shrink-0" /> {submitError}
            </div>
          )}

          <Button type="submit" className="min-h-11 w-full" disabled={!canSubmit}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar reporte
          </Button>
        </form>

        <section className="space-y-2 border-t pt-3">
          <h3 className="text-sm font-medium">Reportes enviados</h3>
          {isLoadingReports ? (
            <Skeleton className="h-16 rounded-lg" />
          ) : reportsError ? (
            <div role="alert" className="flex items-center gap-2 text-sm text-destructive">
              <CircleAlert className="h-4 w-4 shrink-0" />
              <span className="flex-1">{reportsError}</span>
              {onRetryReports && <Button variant="outline" size="sm" className="min-h-11" onClick={onRetryReports}>Reintentar</Button>}
            </div>
          ) : !reports || reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no enviaste ningún reporte.</p>
          ) : (
            <ul className="space-y-2">
              {reports.map((r) => (
                <li key={r.id} className="flex items-start gap-2 rounded-lg border p-3">
                  <p className="line-clamp-2 flex-1 text-sm">{r.message}</p>
                  <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </DialogContent>
    </Dialog>
  )
}
