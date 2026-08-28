import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { ConfigCacheService }   from '../config-cache/config-cache.service';
import { ConfigAuditService }   from '../config-audit/config-audit.service';
import { CreateTemplateDto }    from './dto/create-template.dto';
import { TEMPLATES_REPOSITORY, type ITemplatesRepository } from './repository/templates.repository.interface';

@Injectable()
export class ConfigTemplatesService {
  constructor(
    @Inject(TEMPLATES_REPOSITORY)
    private readonly repo:   ITemplatesRepository,
    private readonly cache:  ConfigCacheService,
    private readonly audit:  ConfigAuditService,
  ) {}

  async list(organizationId: string) {
    return this.repo.findAllByOrg(organizationId);
  }

  async resolve(organizationId: string, key: string) {
    const tpl = await this.repo.findByKey(organizationId, key);
    if (!tpl) throw new NotFoundException(`Template '${key}' not found`);
    return tpl;
  }

  renderTemplate(content: string, variables: Record<string, string>): string {
    return content.replace(/\{\{(\w+)\}\}/g, (_, k) => variables[k] ?? `{{${k}}}`);
  }

  async renderByKey(organizationId: string, key: string, vars: Record<string, string>) {
    const tpl = await this.resolve(organizationId, key);
    return { key: tpl.key, rendered: this.renderTemplate(tpl.content, vars) };
  }

  async create(organizationId: string, userId: string, dto: CreateTemplateDto) {
    const template = await this.repo.create({
      organizationId,
      key:         dto.key,
      content:     dto.content,
      description: dto.description,
    });
    this.audit.log({ organizationId, userId, configType: 'template', configKey: dto.key, action: 'create' });
    return template;
  }
}
