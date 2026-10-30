"use client"

/**
 * Dialog — el primitivo único de modal (welver.html → «Modales adaptables»).
 *
 * Cada modal declara su TIPO con `preset` (form, selection, detail, filters, longForm, search) y el sistema elige la
 * presentación según la clase de tamaño: hoja inferior en compact, centrado en medium, panel lateral, etc.
 * Radix aporta el focus trap, Esc, fondo inerte y retorno de foco. Siempre hay un botón visible para cerrar.
 *
 *   <Dialog>
 *     <DialogContent preset="form">
 *       <DialogHeader><DialogTitle>…</DialogTitle></DialogHeader>
 *       …contenido…
 *       <DialogFooter>…acciones…</DialogFooter>
 *     </DialogContent>
 *   </Dialog>
 *
 * Los estilos de presentación viven en `styles/welver.css` (selectores `[data-slot="modal"]`).
 */
import * as React from "react"
import { quietRefocus } from "../utils/focus"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@real/ui/utils"
import { useSizeClass } from "../hooks/use-size-class"
import { ModalGrip, resolveModal, type ModalPresentationProps } from "./modal-presentation"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-slot="modal-overlay"
    className={className}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    ModalPresentationProps {
  /** Oculta el botón de cerrar. Solo para modales que ya traen su propia salida visible. */
  hideClose?: boolean
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, preset, presentation, size, tall, hideClose = false, ...props }, ref) => {
  const sizeClass = useSizeClass()
  const modal = resolveModal({ preset, presentation, size, tall }, sizeClass)
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        data-slot="modal"
        data-pres={modal.pres}
        data-size={sizeClass}
        data-psize={modal.size}
        data-tall={modal.tall ? "" : undefined}
        className={className}
        {...props}
        onCloseAutoFocus={(e) => { props.onCloseAutoFocus?.(e); quietRefocus() }}
      >
        {modal.pres === "sheet" && <ModalGrip />}
        {children}
        {!hideClose && (
          <DialogPrimitive.Close data-slot="modal-close">
            <X className="h-4 w-4" />
            <span className="sr-only">Cerrar</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div data-slot="modal-header" className={className} {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div data-slot="modal-footer" className={className} {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("font-display text-lg font-semibold leading-tight tracking-tight", className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
