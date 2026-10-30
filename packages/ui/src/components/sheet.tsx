"use client"

/**
 * Sheet — panel anclado a un borde, con la misma piel de modal que Dialog (welver.html → «Modales adaptables»).
 *
 *   right / left → «Panel lateral» (detalle sin salir de la lista)
 *   bottom       → «Hoja inferior» con agarre
 *   top          → «Superior»
 *
 * Los estilos y animaciones viven en `styles/welver.css` (selectores `[data-slot="modal"]`).
 */
import * as React from "react"
import { quietRefocus } from "../utils/focus"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@real/ui/utils"
import { useSizeClass } from "../hooks/use-size-class"
import { ModalGrip, type ModalPresentationName, type ModalSize } from "./modal-presentation"

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    data-slot="modal-overlay"
    className={className}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

type SheetSide = "top" | "bottom" | "left" | "right"

const PRESENTATION_BY_SIDE: Record<SheetSide, ModalPresentationName> = {
  top: "top",
  bottom: "sheet",
  left: "side",
  right: "side",
}

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> {
  side?: SheetSide
  /** Ancho del panel: sm 24rem · md 28rem · lg 40rem. */
  size?: ModalSize
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", size, className, children, ...props }, ref) => {
  const sizeClass = useSizeClass()
  const pres = PRESENTATION_BY_SIDE[side]
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={ref}
        data-slot="modal"
        data-pres={pres}
        data-side={side}
        data-size={sizeClass}
        data-psize={size}
        className={className}
        {...props}
        onCloseAutoFocus={(e) => { props.onCloseAutoFocus?.(e); quietRefocus() }}
      >
        {pres === "sheet" && <ModalGrip />}
        {children}
        <SheetPrimitive.Close data-slot="modal-close">
          <X className="h-4 w-4" />
          <span className="sr-only">Cerrar</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
})
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div data-slot="modal-header" className={className} {...props} />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div data-slot="modal-footer" className={className} {...props} />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("font-display text-lg font-semibold leading-tight tracking-tight text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
