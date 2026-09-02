// real-ecommerce-front/lib/ecommerce/index.ts
//
// MIGRACIÓN COMPLETADA: lib/ecommerce/ → lib/store/
//
// lib/store/ es el cliente canónico:
//   - Usa organizationId dinámico (multi-tenant real)
//   - Server Components safe
//   - Sin NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID hardcodeado
//
// Este archivo re-exporta desde lib/store/ para no romper las páginas
// bajo app/categoria/ y app/products/ que todavía importan de @/lib/ecommerce.
//
// TODO: migrar app/categoria/[categoria]/page.tsx y app/products/[handle]/page.tsx
//       a importar directamente de @/lib/store/ y eliminar lib/ecommerce/ completo.

export {
  getProducts,
  getProductByHandle,
  getCategories,
  getCategoryByHandle,
} from '@/lib/store/client';

export type {
  StoreProduct  as Product,
  StoreCategory as Category,
  PaginatedResponse,
} from '@/lib/trpc/types';

// formatPrice vive en lib/ecommerce/utils.ts — se mantiene acá hasta
// que las páginas migren a importarla directamente.
export { formatPrice } from './utils';

// getProductById es alias de getProductByHandle (el back usa handle como id público)
export { getProductByHandle as getProductById } from '@/lib/store/client';

// getAllProducts: lib/store/client no tiene equivalente directo sin organizationId.
// Las páginas que lo llaman (app/products/[handle]/page.tsx) son rutas legacy
// sin contexto de tienda. Devuelve array vacío hasta que esas páginas migren
// a la ruta /tienda/[slug]/productos/ que sí tiene organizationId.
export async function getAllProducts() {
  return [];
}

// getProductsByCategory: alias con firma legacy (solo handle, sin organizationId).
// Solo funciona desde páginas bajo /tienda/[slug]/ donde el organizationId
// viene del StoreContext. Las páginas bajo /categoria/ deben migrar.
export { getProducts as getProductsByCategory } from '@/lib/store/client';