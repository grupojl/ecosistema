import type { ThemeConfig, CreateThemeInput } from '../domain/theme.entity';

export const THEMES_REPOSITORY = Symbol('THEMES_REPOSITORY');

export interface IThemesRepository {
  findAllByOrg(organizationId: string): Promise<ThemeConfig[]>;
  findById(id: string): Promise<ThemeConfig | null>;
  findActive(organizationId: string): Promise<ThemeConfig | null>;
  findPublicByOrgId(organizationId: string): Promise<ThemeConfig | null>;
  create(input: CreateThemeInput): Promise<ThemeConfig>;
  activate(id: string, organizationId: string): Promise<void>;
  remove(id: string): Promise<void>;
}
