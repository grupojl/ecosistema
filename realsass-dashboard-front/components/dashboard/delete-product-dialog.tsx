'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@real/ui';
import { Loader2 } from 'lucide-react';

interface ArchiveProductDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isArchiving: boolean;
  productName?: string;
}

/** El back no borra productos: se archivan (status ARCHIVED) y se pueden restaurar editándolos. */
export function ArchiveProductDialog({
  open,
  onClose,
  onConfirm,
  isArchiving,
  productName,
}: ArchiveProductDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Archivar producto?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground">{productName}</span>{' '}
            deja de mostrarse en la tienda. Podés restaurarlo después cambiando su estado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isArchiving}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isArchiving}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isArchiving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Archivando...
              </>
            ) : (
              'Archivar'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
