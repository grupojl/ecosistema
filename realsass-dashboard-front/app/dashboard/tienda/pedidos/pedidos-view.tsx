'use client';
// realsass-dashboard-front/app/dashboard/tienda/pedidos/pedidos-view.tsx
// Client Component — lógica interactiva de pedidos.
import { useState } from 'react';
import { Loader2, CircleAlert } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useOrders } from '@/features/store/hooks';
import type { OrderStatus } from '@/features/store/types';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@real/ui';

function formatCurrency(minor: number, currency: string) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(minor / 100);
}

export function PedidosView() {
  const { organizationId } = useAuth();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | undefined>();
  const { data, isLoading, error } = useOrders(organizationId, { status: statusFilter });

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

  const orders = data?.items ?? [];

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Fecha</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map(order => (
            <TableRow key={order.id}>
              <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}</TableCell>
              <TableCell>{order.status}</TableCell>
              <TableCell>{formatCurrency(order.totalCents, order.currency)}</TableCell>
              <TableCell>{new Date(order.createdAt).toLocaleDateString('es-AR')}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
