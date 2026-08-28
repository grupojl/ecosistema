import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { ConfigCacheService }   from '../config-cache/config-cache.service';
import { ConfigAuditService }   from '../config-audit/config-audit.service';
import { EventEmitter2 }        from '@nestjs/event-emitter';
import { UpdateFlagDto }        from './dto/update-flag.dto';
import { FEATURE_FLAGS_REPOSITORY, type IFeatureFlagsRepository } from './repository/feature-flags.repository.interface';

@Injectable()
export class ConfigFlagsService {
  constructor(
    @Inject(FEATURE_FLAGS_REPOSITORY)
    private readonly repo:   IFeatureFlagsRepository,
    private readonly cache:  ConfigCacheService,
    private readonly audit:  ConfigAuditService,
    private readonly events: EventEmitter2,
  ) {}

  /** Todos los flags de la org + globales (para gestión en el dashboard) */
  async list(organizationId: string) {
    return this.repo.findAllByOrg(organizationId);
  }

  /** Flags evaluados/filtrados según rol y plan */
  async getForOrg(organizationId: string, role?: string, plan?: string) {
    const flags = await this.repo.findAllByOrg(organizationId);
    return flags.filter(f => f.enabled);
  }

  async update(organizationId: string, userId: string, id: string, dto: UpdateFlagDto) {
    const flag = await this.repo.findById(id);
    if (!flag) throw new NotFoundException(`FeatureFlag ${id} not found`);

    const previous = JSON.stringify({ enabled: flag.enabled });
    const updated  = await this.repo.update(id, dto);

    this.audit.log({
      organizationId, userId,
      configType: 'feature_flag', configKey: flag.key,
      action: 'update',
      previousValue: previous,
      newValue: JSON.stringify({ enabled: updated.enabled }),
    });

    this.events.emit('config.flag.updated', { organizationId, flag: updated });
    return updated;
  }
}
