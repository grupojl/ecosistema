'use client'

/**
 * «Eliminar mi cuenta» (derecho al borrado). Confirmación explícita (AlertDialog de @real/ui) y luego
 * `customer.deleteAccount`, que solo opera sobre el PROPIO cliente autenticado. Las órdenes se conservan (registro contable).
 * Tras borrar, se cierra la sesión local y el panel.
 */
import { useState } from 'react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Alert, Button,
} from '@real/ui'
import { trpc } from '@/lib/trpc/client'
import { useCommerce } from '@/components/commerce/commerce-provider'

export function DeleteAccount() {
  const { dict, signOut, setPanel } = useCommerce()
  const c = dict.commerce
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  const remove = trpc.customer.deleteAccount.useMutation()

  const confirm = async (event: React.MouseEvent) => {
    event.preventDefault() // el diálogo se cierra solo si salió bien
    setFailed(false)
    try {
      await remove.mutateAsync()
      setOpen(false)
      setPanel(false)
      await signOut()
    } catch {
      setFailed(true)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setFailed(false) }}>
      <Button type="button" variant="ghost" onClick={() => setOpen(true)} className="w-full justify-start px-3 font-normal text-destructive hover:text-destructive">
        {c.deleteAccount}
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{c.deleteAccountTitle}</AlertDialogTitle>
          <AlertDialogDescription>{c.deleteAccountBody}</AlertDialogDescription>
        </AlertDialogHeader>
        {failed && <Alert variant="destructive">{c.deleteAccountError}</Alert>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>{c.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={remove.isPending}>{c.deleteAccountConfirm}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
