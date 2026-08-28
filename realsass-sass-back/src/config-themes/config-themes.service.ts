import {
  Injectable, NotFoundException, ConflictException, ForbiddenException, Inject,
} from '@nestjs/common';
import { ConfigCacheService }   from '../config-cache/config-cache.service';
import { ConfigAuditService }   from '../config-audit/config-audit.service';
import { EventEmitter2 }        from '@nestjs/event-emitter';
import { CreateThemeDto }       from './dto/create-theme.dto';
import { THEMES_REPOSITORY, type IThemesRepository } from './repository/themes.repository.interface';

@Injectable()
export class ConfigThemesService {
  constructor(
    @Inject(THEMES_REPOSITORY)
    private readonly repo:   IThemesRepository,
    private readonly cache:  ConfigCacheService,
    private readonly audit:  ConfigAuditService,
    private readonly events: EventEmitter2,
  ) {}

  async getPublicTheme(organizationId: string) {
    return this.repo.findPublicByOrgId(organizationId);
  }

  async list(organizationId: string) {
    return this.repo.findAllByOrg(organizationId);
  }

  async create(organizationId: string, userId: string, dto: CreateThemeDto) {
    const theme = await this.repo.create({ ...dto, organizationId });
    this.audit.log({ organizationId, userId, configType: 'theme', action: 'create', newValue: theme.name });
    return theme;
  }

  async activate(organizationId: string, userId: string, id: string) {
    const theme = await this.repo.findById(id);
    if (!theme) throw new NotFoundException(`Theme ${id} not found`);
    if (theme.organizationId !== organizationId) throw new ForbiddenException();
    if (theme.isSystemDefault) throw new ConflictException('Cannot activate system default theme directly');

    await this.repo.activate(id, organizationId);
    this.audit.log({ organizationId, userId, configType: 'theme', action: 'activate', newValue: id });
    this.events.emit('config.theme.activated', { organizationId, themeId: id });
  }

  async remove(organizationId: string, userId: string, id: string) {
    const theme = await this.repo.findById(id);
    if (!theme) throw new NotFoundException(`Theme ${id} not found`);
    if (theme.organizationId !== organizationId) throw new ForbiddenException();
    if (theme.isActive) throw new ConflictException('Cannot remove active theme');
    if (theme.isSystemDefault) throw new ConflictException('Cannot remove system default theme');

    await this.repo.remove(id);
    this.audit.log({ organizationId, userId, configType: 'theme', action: 'delete', previousValue: id });
  }
}
