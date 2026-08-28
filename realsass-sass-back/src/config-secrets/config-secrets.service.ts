import {
  Injectable, NotFoundException, ConflictException, Logger, Inject,
} from '@nestjs/common';
import { CryptoService }        from './crypto.service';
import { ConfigAuditService }   from '../config-audit/config-audit.service';
import { CreateSecretDto }      from './dto/create-secret.dto';
import { SECRETS_REPOSITORY, type ISecretsRepository } from './repository/secrets.repository.interface';

@Injectable()
export class ConfigSecretsService {
  private readonly logger = new Logger(ConfigSecretsService.name);

  constructor(
    @Inject(SECRETS_REPOSITORY)
    private readonly repo:   ISecretsRepository,
    private readonly crypto: CryptoService,
    private readonly audit:  ConfigAuditService,
  ) {}

  async list(organizationId: string) {
    return this.repo.findAllByOrg(organizationId);
  }

  async create(organizationId: string, userId: string, dto: CreateSecretDto, ip?: string) {
    const valueEncrypted = this.crypto.encrypt(dto.value);
    const secret = await this.repo.create({
      organizationId, key: dto.key, valueEncrypted, description: dto.description,
    });
    this.audit.log({ organizationId, userId, configType: 'secret', configKey: dto.key, action: 'create', ipAddress: ip });
    return secret;
  }

  async rotate(organizationId: string, userId: string, id: string, newValue: string, ip?: string) {
    const existing = await this.repo.findByIdWithValue(id);
    if (!existing) throw new NotFoundException(`Secret ${id} not found`);
    const valueEncrypted = this.crypto.encrypt(newValue);
    const updated = await this.repo.updateValue(id, valueEncrypted);
    this.audit.log({ organizationId, userId, configType: 'secret', configKey: existing.key, action: 'rotate', ipAddress: ip });
    return updated;
  }

  async revoke(organizationId: string, userId: string, id: string, ip?: string) {
    const existing = await this.repo.findByIdWithValue(id);
    if (!existing) throw new NotFoundException(`Secret ${id} not found`);
    await this.repo.revoke(id);
    this.audit.log({ organizationId, userId, configType: 'secret', configKey: existing.key, action: 'revoke', ipAddress: ip });
  }
}
