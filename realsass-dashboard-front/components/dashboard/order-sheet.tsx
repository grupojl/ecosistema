'use client';
// components/dashboard/order-sheet.tsx
// Detalle de un pedido (adminOrders.get). Solo lectura: el contrato de ecommerce-back
// todavía no expone cambios de estado desde el panel.
import { CircleAlert, Loader2 } from 'lucide-react';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@real/ui';
import { Badge } from '@real/ui';
import { Skeleton } from '@real/ui';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@real/ui';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useOrder } from '@/features/store/hooks';
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABEL, formatMoney } from '@/features/store/format';

interface OrderSheetProps {
  orderId:      string | null;
  onOpenChange: (open: boolean) => void;
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

export function OrderSheet({ orderId, onOpenChange }: OrderSheetProps) {
  const { organizationId } = useAuth();
  const { data: order, isLoading, error } = useOrder(organizationId, orderId ?? undefined);

  return (
    <Sheet open={!!orderId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Pedido</SheetTitle>
          <SheetDescription className="font-mono text-xs">{orderId}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6">
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-24 w-full" />
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <CircleAlert className="h-4 w-4" />
              No se pudo cargar el pedido.
            </div>
          )}

          {!isLoading && !error && !order && (
            <p className="text-sm text-muted-foreground">El pedido no existe o pertenece a otra organización.</p>
          )}

          {order && (
            <>
              <div className="space-y-2">
                <Row label="Estado" value={
                  <Badge variant={ORDER_STATUS_BADGE[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge>
                } />
                <Row label="Fecha" value={new Date(order.createdAt).toLocaleString('es-AR')} />
                <Row label="Cliente" value={<span className="font-mono text-xs">{order.customerId}</span>} />
                {order.paymentIntentId && (
                  <Row label="Pago" value={<span className="font-mono text-xs">{order.paymentIntentId}</span>} />
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Productos</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">Unitario</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p className="text-sm font-medium">{item.variant.product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.variant.title} · <span className="font-mono">{item.variant.sku}</span>
                          </p>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatMoney(item.unitPriceCentsSnapshot, order.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <Row label="Subtotal" value={formatMoney(order.subtotalCents, order.currency)} />
                <Row label="Envío" value={formatMoney(order.shippingCents, order.currency)} />
                <Row label={<span className="font-semibold text-foreground">Total</span>}
                  value={<span className="font-semibold">{formatMoney(order.totalCents, order.currency)}</span>} />
              </div>

              {order.shippingAddress && Object.keys(order.shippingAddress).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dirección de envío</p>
                  <div className="rounded-lg border border-border p-3 space-y-1">
                    {Object.entries(order.shippingAddress).map(([key, value]) => (
                      <Row key={key} label={key} value={String(value ?? '—')} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
