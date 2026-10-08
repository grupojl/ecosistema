// features/store/hooks.ts
// Hooks del módulo Tienda sobre el contrato tRPC de ecommerce-back (ADR-005).
// Optimistic updates con rollback — E11-04 Fase 4 Escalón 11.

import { ecommerceTrpc } from '@/lib/trpc/ecommerce-client';
import type { OrderFilters, ProductPatch } from '@/features/store/types';

type OrgId = string | null | undefined;

export function useProducts(orgId: OrgId) {
  return ecommerceTrpc.adminCatalog.list.useQuery(undefined, { enabled: !!orgId });
}

export function useCreateProduct() {
  const utils = ecommerceTrpc.useUtils();
  return ecommerceTrpc.adminCatalog.create.useMutation({
    onSuccess: () => utils.adminCatalog.list.invalidate(),
  });
}

/** Aplica solo los campos definidos del patch (un `undefined` no pisa el valor actual). */
function definedFields(patch: ProductPatch): ProductPatch {
  return Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  ) as ProductPatch;
}

export function useUpdateProduct() {
  const utils = ecommerceTrpc.useUtils();
  return ecommerceTrpc.adminCatalog.update.useMutation({
    onMutate: async ({ productId, data }) => {
      await utils.adminCatalog.list.cancel();
      const previous = utils.adminCatalog.list.getData();
      utils.adminCatalog.list.setData(undefined, (old) =>
        old?.map((p) => (p.id === productId ? { ...p, ...definedFields(data) } : p)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) utils.adminCatalog.list.setData(undefined, context.previous);
    },
    onSettled: () => utils.adminCatalog.list.invalidate(),
  });
}

/**
 * El back no expone delete: se archiva (status ARCHIVED = soft-delete).
 * El producto sale de la lista de forma optimista.
 */
export function useDeleteProduct() {
  const utils = ecommerceTrpc.useUtils();
  return ecommerceTrpc.adminCatalog.update.useMutation({
    onMutate: async ({ productId }) => {
      await utils.adminCatalog.list.cancel();
      const previous = utils.adminCatalog.list.getData();
      utils.adminCatalog.list.setData(undefined, (old) => old?.filter((p) => p.id !== productId));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) utils.adminCatalog.list.setData(undefined, context.previous);
    },
    onSettled: () => utils.adminCatalog.list.invalidate(),
  });
}

export function useUpdateInventory() {
  const utils = ecommerceTrpc.useUtils();
  return ecommerceTrpc.adminInventory.setStock.useMutation({
    onSuccess: () => utils.adminCatalog.list.invalidate(),
  });
}

/** El back lista todas las órdenes de la org; el filtro por estado se aplica en el cliente. */
export function useOrders(orgId: OrgId, filters: OrderFilters = {}) {
  const { status } = filters;
  return ecommerceTrpc.adminOrders.list.useQuery(undefined, {
    enabled: !!orgId,
    select:  (orders) => (status ? orders.filter((o) => o.status === status) : orders),
  });
}

export function useOrder(orgId: OrgId, orderId: string | undefined) {
  return ecommerceTrpc.adminOrders.get.useQuery(
    { orderId: orderId ?? '' },
    { enabled: !!orgId && !!orderId },
  );
}
