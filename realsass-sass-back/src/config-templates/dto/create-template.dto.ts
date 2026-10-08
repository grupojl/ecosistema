import type { CreateTemplateInput } from '@/config-templates/domain/template.entity';
// organizationId lo inyecta el service desde el contexto de tenant, no viene del cliente.
export type CreateTemplateDto = Omit<CreateTemplateInput, 'organizationId'>;
