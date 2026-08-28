// realsass-dashboard-front/types/api.ts
//
// ESTADO DE MIGRACIÓN:
// Los tipos canónicos de paginación y respuesta ya viven (o vivirán)
// en @real/trpc al implementar Capa 5 (AppRouter tipado).
//
// Por ahora este archivo re-exporta desde @real/trpc los que existan
// y define localmente los que todavía no. Cuando Capa 5 esté completa,
// este archivo se reduce a solo re-exports y eventualmente se elimina.
//
// TODO(S-capa5): cuando @real/trpc exporte PaginatedResponse y PaginationMeta,
//   reemplazar las definiciones locales por:
//   export type { PaginatedResponse, PaginationMeta } from '@real/trpc';

// ─── Paginación (canónico — mover a @real/trpc en Capa 5) ────────────────────

export interface PaginationMeta {
  total:       number;
  page:        number;
  limit:       number;
  totalPages:  number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta:  PaginationMeta;
}

export interface FilterParams {
  page?:   number;
  limit?:  number;
  search?: string;
  sortBy?: string;
  order?:  'asc' | 'desc';
}

// ─── Errores (canónico — usar AppError de @real/auth-client en código nuevo) ──
// Mantener para compatibilidad con código existente que hace `catch (e: ApiError)`.
// En código nuevo: usar AppError de @real/auth-client.

export interface ApiError {
  message:     string;
  statusCode?: number;
}

// ─── Wrapper genérico (legacy — no usar en código nuevo) ─────────────────────
// tRPC no wrappea en { success, data }. Este tipo existe solo para
// compatibilidad con respuestas REST todavía no migradas.

export interface ApiResponse<T> {
  success:  boolean;
  data:     T;
  message?: string;
}