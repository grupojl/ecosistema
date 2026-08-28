import type { ContentTemplate, CreateTemplateInput } from '../domain/template.entity';

export const TEMPLATES_REPOSITORY = Symbol('TEMPLATES_REPOSITORY');

export interface ITemplatesRepository {
  findAllByOrg(organizationId: string): Promise<ContentTemplate[]>;
  findByKey(organizationId: string, key: string): Promise<ContentTemplate | null>;
  create(input: CreateTemplateInput): Promise<ContentTemplate>;
}
