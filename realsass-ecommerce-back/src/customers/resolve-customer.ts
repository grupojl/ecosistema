/**
 * resolve-customer.ts — realsass-ecommerce-back (ADR-021)
 *
 * Del usuario de Firebase ya verificado por el middleware a un cliente de UNA organización.
 * PURO: la creación/búsqueda real se inyecta (`identify`), así se testea sin base de datos.
 */
export interface VerifiedUser {
  readonly email:          string;
  readonly emailVerified?: boolean;
  readonly displayName:    string | null;
}

export type IdentifyFn = (
  organizationId: string,
  email:          string,
  displayName?:   string,
) => Promise<{ customerId: string }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Devuelve el customerId, o null si no corresponde:
 *  - sin sesión, sin email, o email NO verificado por Firebase (si no, cualquiera podría registrar el de otro);
 *  - sin organización, con un id que no es un UUID, o que no existe / no tiene ecommerce (evita clientes huérfanos).
 */
export async function resolveCustomerFromUser(
  user:           VerifiedUser | undefined | null,
  organizationId: string | null,
  identify:       IdentifyFn,
  organizationIsEnabled: (organizationId: string) => Promise<boolean> = async () => true,
): Promise<string | null> {
  if (!user || !user.email || user.emailVerified !== true) return null;
  if (!organizationId || !UUID.test(organizationId)) return null;
  // Un UUID bien formado pero inexistente (o sin ecommerce) tampoco crea clientes huérfanos.
  if (!(await organizationIsEnabled(organizationId))) return null;
  const { customerId } = await identify(organizationId, user.email, user.displayName ?? undefined);
  return customerId;
}
