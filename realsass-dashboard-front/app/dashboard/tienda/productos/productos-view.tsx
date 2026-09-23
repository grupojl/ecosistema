'use client';
// realsass-dashboard-front/app/dashboard/tienda/productos/productos-view.tsx
// Client Component — toda la lógica interactiva de productos.
// La page.tsx (Server Component) hace el prefetch y pasa el estado hidratado aquí.
import { useState } from 'react';
import { Loader2, Plus, CircleAlert, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useProducts, useDeleteProduct } from '@/features/store/hooks';
import { Button } from '@real/ui';
import { Input } from '@real/ui';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@real/ui';

export function ProductosView() {
  const { organizationId } = useAuth();
  const { data: products, isLoading, error } = useProducts(organizationId);
  const deleteProduct = useDeleteProduct();
  const [search, setSearch] = useState('');

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-2 text-destructive p-4">
      <CircleAlert className="h-4 w-4" />
      <span>Error al cargar productos</span>
    </div>
  );

  const filtered = (products ?? []).filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct.mutateAsync({ id, organizationId });
      toast.success('Producto eliminado');
    } catch {
      toast.error('No se pudo eliminar el producto');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Input
          placeholder="Buscar productos..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo producto
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map(product => (
            <TableRow key={product.id}>
              <TableCell className="font-medium">{product.name}</TableCell>
              <TableCell>{product.status}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(product.id)}
                    disabled={deleteProduct.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
