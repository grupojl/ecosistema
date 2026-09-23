/**
 * store.contract.ts — límite de sistema con realsass-sass-back.
 *
 * La respuesta HTTP de otro servicio es INPUT NO CONFIABLE: se valida con Zod
 * antes de entrar al dominio (antes era un `as StoreInfo`).
 *
 * Tolerant reader (ADR-016): `countryCode` es opcional upstream para soportar
 * rollback de sass-back sin romper el storefront. Default = país base histórico.
 */
import { z } from 'zod';

export const DEFAULT_STORE_COUNTRY = 'AR';

export const StoreInfoSchema = z.object({
  organizationId:   z.string().uuid(),
  slug:             z.string().min(1),
  name:             z.string().nullable(),
  description:      z.string().nullable(),
  logoUrl:          z.string().nullable(),
  website:          z.string().nullable(),
  countryCode:      z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .catch(DEFAULT_STORE_COUNTRY)
    .default(DEFAULT_STORE_COUNTRY),
  ecommerceEnabled: z.boolean(),
});

export type StoreInfo = z.infer<typeof StoreInfoSchema>;

/** sass-back puede envolver en { success, data } (interceptor) o devolver plano. */
export const SassBackStoreResponseSchema = z.union([
  z.object({ success: z.boolean(), data: StoreInfoSchema }),
  StoreInfoSchema,
]);

export function parseSassBackStoreResponse(body: unknown): StoreInfo | null {
  const parsed = SassBackStoreResponseSchema.safeParse(body);
  if (!parsed.success) return null;
  return 'data' in parsed.data ? parsed.data.data : parsed.data;
}
