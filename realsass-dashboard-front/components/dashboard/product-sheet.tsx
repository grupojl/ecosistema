'use client';
// components/dashboard/product-sheet.tsx
// Alta y edición de productos de la tienda. Tipos y validaciones salen del contrato
// de adminCatalog (@real/trpc); el stock se edita por variante con adminInventory.setStock.
import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from '@real/ui';
import { Button } from '@real/ui';
import { Input } from '@real/ui';
import { Label } from '@real/ui';
import { Textarea } from '@real/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@real/ui';
import { useCreateProduct, useUpdateInventory, useUpdateProduct } from '@/features/store/hooks';
import {
  HANDLE_REGEX, PRODUCT_STATUS_LABEL, formatMoney, slugify, toCents,
} from '@/features/store/format';
import type { Product, ProductInput, ProductStatus } from '@/features/store/types';

interface ProductSheetProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  /** null = alta de producto nuevo */
  product:      Product | null;
}

export function ProductSheet({ open, onOpenChange, product }: ProductSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {/* key: el estado del form se reinicia al cambiar de producto */}
        {product
          ? <EditProductForm key={product.id} product={product} onDone={() => onOpenChange(false)} />
          : <CreateProductForm key="new" onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

// ── Alta ──────────────────────────────────────────────────────────────────────

interface VariantDraft { sku: string; title: string; price: string; currency: string }

const EMPTY_VARIANT: VariantDraft = { sku: '', title: '', price: '', currency: 'ARS' };

function CreateProductForm({ onDone }: { onDone: () => void }) {
  const createProduct = useCreateProduct();

  const [name, setName]               = useState('');
  const [handle, setHandle]           = useState('');
  const [handleTouched, setTouched]   = useState(false);
  const [description, setDescription] = useState('');
  const [status, setStatus]           = useState<Exclude<ProductStatus, 'ARCHIVED'>>('DRAFT');
  const [variants, setVariants]       = useState<VariantDraft[]>([{ ...EMPTY_VARIANT }]);
  const [formError, setFormError]     = useState<string | null>(null);

  const onNameChange = (value: string) => {
    setName(value);
    if (!handleTouched) setHandle(slugify(value));
  };

  const patchVariant = (index: number, patch: Partial<VariantDraft>) =>
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));

  const buildInput = (): ProductInput | string => {
    if (!name.trim()) return 'El nombre es requerido';
    if (!HANDLE_REGEX.test(handle)) return 'El handle solo admite minúsculas, números y guiones (ej: remera-negra)';
    if (variants.length === 0) return 'Agregá al menos una variante';

    const skus = new Set<string>();
    const parsed: ProductInput['variants'] = [];
    for (const [i, v] of variants.entries()) {
      const n = i + 1;
      const sku = v.sku.trim();
      if (!sku)              return `Variante ${n}: el SKU es requerido`;
      if (skus.has(sku))     return `Variante ${n}: el SKU "${sku}" está repetido`;
      if (!v.title.trim())   return `Variante ${n}: el título es requerido`;
      const priceCents = toCents(v.price);
      if (!Number.isInteger(priceCents) || priceCents <= 0) return `Variante ${n}: el precio debe ser mayor a 0`;
      skus.add(sku);
      parsed.push({ sku, title: v.title.trim(), priceCents, currency: v.currency.trim().toUpperCase() || 'ARS' });
    }

    return {
      name:        name.trim(),
      handle,
      status,
      variants:    parsed,
      ...(description.trim() ? { description: description.trim() } : {}),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = buildInput();
    if (typeof input === 'string') { setFormError(input); return; }
    setFormError(null);
    try {
      await createProduct.mutateAsync(input);
      toast.success('Producto creado');
      onDone();
    } catch (err) {
      setFormError(errorMessage(err, 'No se pudo crear el producto'));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <SheetHeader>
        <SheetTitle>Nuevo producto</SheetTitle>
        <SheetDescription>Se crea con sus variantes. El stock se carga después, desde la edición.</SheetDescription>
      </SheetHeader>

      <div className="space-y-4 px-4">
        <div className="space-y-1.5">
          <Label htmlFor="p-name">Nombre *</Label>
          <Input id="p-name" value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="ej: Remera básica" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-handle">Handle (URL) *</Label>
          <Input
            id="p-handle" value={handle} className="font-mono text-sm"
            onChange={(e) => { setTouched(true); setHandle(e.target.value); }}
            placeholder="remera-basica"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-desc">Descripción</Label>
          <Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
        <div className="space-y-1.5">
          <Label>Estado</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">{PRODUCT_STATUS_LABEL.DRAFT}</SelectItem>
              <SelectItem value="PUBLISHED">{PRODUCT_STATUS_LABEL.PUBLISHED}</SelectItem>
            </SelectContent>
          </Select>
          {status === 'PUBLISHED' && (
            <p className="text-xs text-muted-foreground">
              Para publicar, alguna variante necesita stock: si todavía no lo cargaste, guardalo como borrador.
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Variantes *</Label>
            <Button type="button" size="sm" variant="outline" className="gap-1.5"
              onClick={() => setVariants((p) => [...p, { ...EMPTY_VARIANT }])}>
              <Plus className="h-3.5 w-3.5" />Agregar
            </Button>
          </div>
          {variants.map((v, i) => (
            <div key={i} className="rounded-lg border border-border p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input value={v.sku} onChange={(e) => patchVariant(i, { sku: e.target.value })} placeholder="SKU" className="font-mono text-sm" />
                <Input value={v.title} onChange={(e) => patchVariant(i, { title: e.target.value })} placeholder="Título (ej: Talle M)" />
              </div>
              <div className="flex items-center gap-2">
                <Input value={v.price} inputMode="decimal" onChange={(e) => patchVariant(i, { price: e.target.value })} placeholder="Precio (ej: 12500)" />
                <Input value={v.currency} onChange={(e) => patchVariant(i, { currency: e.target.value })} className="w-24 uppercase" maxLength={3} />
                <Button type="button" size="icon" variant="ghost" className="shrink-0 text-destructive"
                  disabled={variants.length === 1}
                  onClick={() => setVariants((p) => p.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {formError && <p className="text-sm text-destructive">{formError}</p>}
      </div>

      <SheetFooter>
        <Button type="submit" disabled={createProduct.isPending} className="gap-2">
          {createProduct.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Crear producto
        </Button>
      </SheetFooter>
    </form>
  );
}

// ── Edición ───────────────────────────────────────────────────────────────────

function EditProductForm({ product, onDone }: { product: Product; onDone: () => void }) {
  const updateProduct = useUpdateProduct();
  const setStock      = useUpdateInventory();

  const [name, setName]               = useState(product.name);
  const [description, setDescription] = useState(product.description ?? '');
  const [status, setStatus]           = useState<ProductStatus>(product.status);
  const [formError, setFormError]     = useState<string | null>(null);
  const [stock, setStockDraft]        = useState<Record<string, string>>(
    () => Object.fromEntries(product.variants.map((v) => [v.id, String(v.inventory?.quantityAvailable ?? 0)])),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setFormError('El nombre es requerido'); return; }
    setFormError(null);
    try {
      await updateProduct.mutateAsync({
        productId: product.id,
        data:      { name: name.trim(), description, status },
      });
      toast.success('Producto actualizado');
      onDone();
    } catch (err) {
      // p. ej. publicar sin stock: el back responde con un mensaje de dominio
      setFormError(errorMessage(err, 'No se pudo actualizar el producto'));
    }
  };

  const saveStock = async (variantId: string) => {
    const quantityAvailable = Number(stock[variantId]);
    if (!Number.isInteger(quantityAvailable) || quantityAvailable < 0) {
      toast.error('El stock debe ser un entero mayor o igual a 0');
      return;
    }
    try {
      await setStock.mutateAsync({ variantId, quantityAvailable });
      toast.success('Stock actualizado');
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudo actualizar el stock'));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <SheetHeader>
        <SheetTitle>Editar producto</SheetTitle>
        <SheetDescription className="font-mono text-xs">{product.handle}</SheetDescription>
      </SheetHeader>

      <div className="space-y-4 px-4">
        <div className="space-y-1.5">
          <Label htmlFor="e-name">Nombre *</Label>
          <Input id="e-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-desc">Descripción</Label>
          <Textarea id="e-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
        <div className="space-y-1.5">
          <Label>Estado</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as ProductStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PRODUCT_STATUS_LABEL) as ProductStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{PRODUCT_STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {formError && <p className="text-sm text-destructive">{formError}</p>}

        <div className="space-y-2 pt-2">
          <Label>Variantes y stock</Label>
          <p className="text-xs text-muted-foreground">
            Las variantes (SKU y precio) no se editan desde acá; el stock se guarda por variante.
          </p>
          {product.variants.map((v) => {
            const saving = setStock.isPending && setStock.variables?.variantId === v.id;
            return (
              <div key={v.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{v.title}</p>
                    <p className="font-mono text-xs text-muted-foreground">{v.sku}</p>
                  </div>
                  <p className="text-sm font-mono shrink-0">{formatMoney(v.priceCents, v.currency)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min={0} step={1} value={stock[v.id] ?? '0'}
                    onChange={(e) => setStockDraft((p) => ({ ...p, [v.id]: e.target.value }))}
                    aria-label={`Stock de ${v.title}`}
                  />
                  <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => saveStock(v.id)}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Guardar stock'}
                  </Button>
                </div>
                {(v.inventory?.quantityReserved ?? 0) > 0 && (
                  <p className="text-xs text-muted-foreground">{v.inventory?.quantityReserved} reservadas por pedidos en curso</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <SheetFooter>
        <Button type="submit" disabled={updateProduct.isPending} className="gap-2">
          {updateProduct.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar cambios
        </Button>
      </SheetFooter>
    </form>
  );
}
