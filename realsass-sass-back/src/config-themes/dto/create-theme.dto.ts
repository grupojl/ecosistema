import type { CreateThemeInput } from '@/config-themes/domain/theme.entity';
// organizationId lo inyecta el service desde el contexto de tenant, no viene del cliente.
export type CreateThemeDto = Omit<CreateThemeInput, 'organizationId'>;
