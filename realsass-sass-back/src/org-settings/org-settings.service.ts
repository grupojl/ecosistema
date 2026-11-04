import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigAuditService } from '@/config-audit/config-audit.service';
import {
  ORG_SETTINGS_REPOSITORY,
  type IOrgSettingsRepository,
} from '@/org-settings/repository/org-settings.repository.interface';
import {
  GeneralSettingsSchema,
  StorefrontSettingsSchema,
  type GeneralSettings,
  type PublicStorefrontSettings,
  type StorefrontSettings,
} from '@/org-settings/org-settings.schema';

export interface OrgSettings {
  general: GeneralSettings;
  storefront: StorefrontSettings;
  /** null = la organización todavía no guardó nada (se devuelven los valores por defecto). */
  updatedAt: Date | null;
}

/** Claves de primer nivel cuyo valor cambió: va al registro de auditoría sin copiar el contenido. */
function changedSections(before: object, after: object): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter(
    (k) => JSON.stringify(Reflect.get(before, k)) !== JSON.stringify(Reflect.get(after, k)),
  );
}

@Injectable()
export class OrgSettingsService {
  private readonly logger = new Logger(OrgSettingsService.name);

  constructor(
    @Inject(ORG_SETTINGS_REPOSITORY)
    private readonly repo: IOrgSettingsRepository,
    private readonly audit: ConfigAuditService,
  ) {}

  /** Lo guardado se valida de nuevo: un documento dañado o de una versión vieja cae a los valores por defecto. */
  private parseGeneral(raw: unknown): GeneralSettings {
    const parsed = GeneralSettingsSchema.safeParse(raw ?? {});
    if (parsed.success) return parsed.data;
    this.logger.warn('Configuración general guardada inválida: se usan los valores por defecto');
    return GeneralSettingsSchema.parse({});
  }

  private parseStorefront(raw: unknown): StorefrontSettings {
    const parsed = StorefrontSettingsSchema.safeParse(raw ?? {});
    if (parsed.success) return parsed.data;
    this.logger.warn('Configuración del storefront guardada inválida: se usan los valores por defecto');
    return StorefrontSettingsSchema.parse({});
  }

  async get(organizationId: string): Promise<OrgSettings> {
    const row = await this.repo.findByOrg(organizationId);
    return {
      general: this.parseGeneral(row?.general),
      storefront: this.parseStorefront(row?.storefront),
      updatedAt: row?.updatedAt ?? null,
    };
  }

  async updateGeneral(
    organizationId: string,
    userId: string,
    input: unknown,
  ): Promise<GeneralSettings> {
    const next = GeneralSettingsSchema.parse(input);
    const before = (await this.get(organizationId)).general;
    await this.repo.saveGeneral(organizationId, next, userId);
    this.audit.log({
      organizationId,
      userId,
      configType: 'settings',
      configKey: 'general',
      action: 'update',
      diff: { sections: changedSections(before, next) },
    });
    return next;
  }

  async updateStorefront(
    organizationId: string,
    userId: string,
    input: unknown,
  ): Promise<StorefrontSettings> {
    const next = StorefrontSettingsSchema.parse(input);
    const before = (await this.get(organizationId)).storefront;
    await this.repo.saveStorefront(organizationId, next, userId);
    this.audit.log({
      organizationId,
      userId,
      configType: 'settings',
      configKey: 'storefront',
      action: 'update',
      diff: { sections: changedSections(before, next) },
    });
    return next;
  }

  /**
   * Lo público del storefront. Respeta `display`: el correo, el teléfono de emergencia y el horario solo salen si la
   * organización decidió mostrarlos. No incluye los dominios autorizados ni los mensajes internos del asistente.
   */
  async getPublicStorefront(organizationId: string): Promise<PublicStorefrontSettings> {
    const { general, storefront } = await this.get(organizationId);
    const { display, webChat, announcement } = storefront;
    return {
      brand: storefront.brand,
      seo: storefront.seo,
      social: storefront.social,
      legal: storefront.legal,
      announcement: announcement.enabled ? announcement : null,
      display,
      webChat: { enabled: webChat.enabled, position: webChat.position, greeting: webChat.greeting },
      contact: {
        email: display.showEmail ? general.contact.publicEmail : '',
        emergencyPhone: display.showEmergencyPhone ? general.contact.emergencyPhone : '',
        hours: display.showHours ? general.hours : null,
      },
      locale: general.defaultLocale,
      timezone: general.timezone,
    };
  }

  /** ¿Puede este sitio incrustar el chat web de la organización? (el chat web lo consulta antes de responder) */
  async isChatOriginAllowed(organizationId: string, origin: string): Promise<boolean> {
    const { storefront } = await this.get(organizationId);
    if (!storefront.webChat.enabled) return false;
    return storefront.webChat.allowedOrigins.includes(origin.trim().toLowerCase());
  }
}
