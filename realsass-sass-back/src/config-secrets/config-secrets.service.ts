import {
  Injectable, NotFoundException, ConflictException, Logger, Inject,
} from '@nestjs/common';
import { CryptoService }        from '@/config-secrets/crypto.service';
import { ConfigAuditService }   from '@/config-audit/config-audit.service';
import { CreateSecretDto }      from '@/config-secrets/dto/create-secret.dto';
import { SECRETS_REPOSITORY, type ISecretsRepository } from '@/config-secrets/repository/secrets.repository.interface';

/** Pista segura para reconocer una clave: sus últimos 4 caracteres (nunca los primeros). */
function hintOf(value: string): string {
  return value.length > 8 ? value.slice(-4) : '';
}

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
    if (await this.repo.findActiveByKey(organizationId, dto.key)) {
      throw new ConflictException('Ya existe una clave llamada "' + dto.key + '". Rotala en vez de crearla de nuevo.');
    }
    const p = this.crypto.encrypt(dto.value);
    const secret = await this.repo.create({
      organizationId, key: dto.key,
      valueEncrypted: p.encrypted, valueIv: p.iv, valueTag: p.tag, hint: hintOf(dto.value),
      description: dto.description, systemTarget: dto.systemTarget,
      ...(dto.expiresAt ? { expiresAt: new Date(dto.expiresAt) } : {}),
    });
    // La auditoría registra quién y qué clave, nunca el valor.
    this.audit.log({ organizationId, userId, configType: 'secret', configKey: dto.key, action: 'create', ipAddress: ip });
    return secret;
  }

  async rotate(organizationId: string, userId: string, id: string, newValue: string, ip?: string) {
    const existing = await this.repo.findById(id, organizationId);
    if (!existing || !existing.isActive) throw new NotFoundException('Clave no encontrada');
    const p = this.crypto.encrypt(newValue);
    const updated = await this.repo.updateValue(id, organizationId, {
      valueEncrypted: p.encrypted, valueIv: p.iv, valueTag: p.tag, hint: hintOf(newValue),
    });
    if (!updated) throw new NotFoundException('Clave no encontrada');
    this.audit.log({ organizationId, userId, configType: 'secret', configKey: existing.key, action: 'rotate', ipAddress: ip });
    return updated;
  }

  async revoke(organizationId: string, userId: string, id: string, ip?: string) {
    const existing = await this.repo.findById(id, organizationId);
    if (!existing || !existing.isActive) throw new NotFoundException('Clave no encontrada');
    await this.repo.revoke(id, organizationId);
    this.audit.log({ organizationId, userId, configType: 'secret', configKey: existing.key, action: 'revoke', ipAddress: ip });
    return { ok: true };
  }
}
