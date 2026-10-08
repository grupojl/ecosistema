'use client';
// realsass-dashboard-front/app/dashboard/tienda/pedidos/pedidos-view.tsx
// Client Component — lógica interactiva de pedidos.
import { useState } from 'react';
import { Loader2, CircleAlert } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useOrders } from '@/features/store/hooks';
import {
  ORDER_STATUSES, ORDER_STATUS_BADGE, ORDER_STATUS_LABEL, formatMoney,
} from '@/features/store/format';
import type { OrderStatus } from '@/features/store/types';
import { OrderSheet } from '@/components/dashboard/order-sheet';
import { Badge } from '@real/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@real/ui';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@real/ui';

type StatusFilter = 'ALL' | OrderStatus;

export function PedidosView() {
  const { organizationId } = useAuth();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const { data, isLoading, error } = useOrders(
    organizationId,
    statusFilter === 'ALL' ? {} : { status: statusFilter },
  );

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-2 text-destructive p-4">
      <CircleAlert className="h-4 w-4" />
      <span>Error al cargar pedidos</span>
    </div>
  );

  const orders = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{ORDER_STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {orders.length} pedido{orders.length !== 1 ? 's' : ''}
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Fecha</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-10">
                Sin pedidos para mostrar
              </TableCell>
            </TableRow>
          )}
          {orders.map((order) => (
            <TableRow
              key={order.id}
              className="cursor-pointer"
              tabIndex={0}
              onClick={() => setSelectedId(order.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') setSelectedId(order.id); }}
            >
              <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}</TableCell>
              <TableCell>
                <Badge variant={ORDER_STATUS_BADGE[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge>
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatMoney(order.totalCents, order.currency)}
              </TableCell>
              <TableCell>{new Date(order.createdAt).toLocaleDateString('es-AR')}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <OrderSheet
        orderId={selectedId}
        onOpenChange={(open) => { if (!open) setSelectedId(null); }}
      />
    </div>
  );
}
