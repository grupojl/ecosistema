// Re-exportar desde @real/auth-server para garantizar compatibilidad de tipos.
// El OrganizationAccessResult local era incompatible porque role: string
// no es asignable a TenantRole del middleware.
export type { OrganizationAccessResult } from '@real/auth-server';
