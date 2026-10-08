'use client';
// realsass-dashboard-front/app/dashboard/tienda/productos/productos-view.tsx
// Client Component — toda la lógica interactiva de productos.
// La page.tsx (Server Component) hace el prefetch y pasa el estado hidratado aquí.
import { useState } from 'react';
import { Archive, CircleAlert, Loader2, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useProducts, useDeleteProduct } from '@/features/store/hooks';
import {
  PRODUCT_STATUS_BADGE, PRODUCT_STATUS_LABEL, formatMoney,
} from '@/features/store/format';
import type { Product, ProductStatus } from '@/features/store/types';
import { ProductSheet } from '@/components/dashboard/product-sheet';
import { ArchiveProductDialog } from '@/components/dashboard/delete-product-dialog';
import { Badge } from '@real/ui';
import { Button } from '@real/ui';
import { Input } from '@real/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@real/ui';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@real/ui';

type StatusFilter = 'ACTIVE' | ProductStatus;

const stockOf = (p: Product) =>
  p.variants.reduce((acc, v) => acc + (v.inventory?.quantityAvailable ?? 0), 0);

function priceRange(p: Product): string {
  if (p.variants.length === 0) return '—';
  const prices   = p.variants.map((v) => v.priceCents);
  const currency = p.variants[0]!.currency;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max
    ? formatMoney(min, currency)
    : `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
}

export function ProductosView() {
  const { organizationId } = useAuth();
  const { data: products, isLoading, error } = useProducts(organizationId);
  const archiveProduct = useDeleteProduct();

  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE');
  const [sheet, setSheet]               = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });
  const [archiving, setArchiving]       = useState<Product | null>(null);

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

  const q = search.trim().toLowerCase();
  const filtered = (products ?? []).filter((p) =>
    (statusFilter === 'ACTIVE' ? p.status !== 'ARCHIVED' : p.status === statusFilter) &&
    (!q || p.name.toLowerCase().includes(q) || p.handle.includes(q) || p.variants.some((v) => v.sku.toLowerCase().includes(q))),
  );

  const handleArchive = async () => {
    if (!archiving) return;
    try {
      // El back no expone delete: se archiva (soft-delete)
      await archiveProduct.mutateAsync({ productId: archiving.id, data: { status: 'ARCHIVED' } });
      toast.success('Producto archivado');
      setArchiving(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo archivar el producto');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Input
            placeholder="Buscar por nombre, handle o SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Activos</SelectItem>
              {(Object.keys(PRODUCT_STATUS_LABEL) as ProductStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{PRODUCT_STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setSheet({ open: true, product: null })}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo producto
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Variantes</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                Sin productos para mostrar
              </TableCell>
            </TableRow>
          )}
          {filtered.map((product) => (
            <TableRow key={product.id}>
              <TableCell>
                <p className="font-medium">{product.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{product.handle}</p>
              </TableCell>
              <TableCell>
                <Badge variant={PRODUCT_STATUS_BADGE[product.status]}>{PRODUCT_STATUS_LABEL[product.status]}</Badge>
              </TableCell>
              <TableCell className="text-right">{product.variants.length}</TableCell>
              <TableCell className="text-right font-mono">{stockOf(product)}</TableCell>
              <TableCell className="text-right font-mono text-sm">{priceRange(product)}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" title="Editar"
                    onClick={() => setSheet({ open: true, product })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {product.status !== 'ARCHIVED' && (
                    <Button variant="ghost" size="icon" title="Archivar" onClick={() => setArchiving(product)}>
                      <Archive className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ProductSheet
        open={sheet.open}
        product={sheet.product}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
      />
      <ArchiveProductDialog
        open={!!archiving}
        productName={archiving?.name}
        isArchiving={archiveProduct.isPending}
        onClose={() => setArchiving(null)}
        onConfirm={handleArchive}
      />
    </div>
  );
}
