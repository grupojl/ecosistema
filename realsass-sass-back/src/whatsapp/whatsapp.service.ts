import {
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OrganizationsService } from '@/organizations/organizations.service';

/**
 * Conexión de WhatsApp de una organización (ADR-025). El dueño la autoriza desde sass-front (Embedded Signup);
 * el canje del `code`, el token del cliente y la suscripción de la WABA son de chatia-backend (ecosistema-ms, ADR-024).
 *
 * sass-back es quien decide QUIÉN puede (OWNER + step-up, en el router) y habla con chatia servicio-a-servicio con
 * `x-internal-api-key`. Acá nunca pasa un token de Meta hacia el navegador: la vista solo trae estado y número.
 */
export type WhatsappConnectionStatus = 'CONNECTED' | 'ERROR';

export interface WhatsappConnectionView {
  accountId:    string;
  status:       WhatsappConnectionStatus;
  displayPhone: string | null;
  errorMessage: string | null;
}

export interface WhatsappSignupInput {
  code:          string;
  wabaId:        string;
  phoneNumberId: string;
}

interface ChatiaCurrent {
  accountId:          string;
  displayPhoneNumber: string | null;
  connected?:         boolean;
  reason?:            string;
}

const TIMEOUT_MS = 20_000;

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private readonly orgs: OrganizationsService) {}

  /** null = la organización no tiene WhatsApp conectado. */
  async getConnection(organizationId: string): Promise<WhatsappConnectionView | null> {
    const res = await this.call<{ data: ChatiaCurrent | null }>('GET', `/${encodeURIComponent(organizationId)}`);
    return res.data ? this.toView(res.data) : null;
  }

  async connect(organizationId: string, input: WhatsappSignupInput): Promise<WhatsappConnectionView> {
    const org = await this.orgs.findByIdPublic(organizationId);
    if (!org) throw new NotFoundException('Organización no encontrada');

    await this.call('POST', `/${encodeURIComponent(organizationId)}/embedded-signup`, {
      ...input,
      organizationName: org.name ?? org.slug,
      organizationSlug: org.slug,
    });
    const view = await this.getConnection(organizationId);
    if (!view) throw new ServiceUnavailableException('El WhatsApp se conectó pero no se pudo leer su estado');
    return view;
  }

  async disconnect(organizationId: string, accountId: string): Promise<{ disconnected: true }> {
    await this.call('DELETE', `/${encodeURIComponent(organizationId)}/${encodeURIComponent(accountId)}`);
    return { disconnected: true };
  }

  private toView(c: ChatiaCurrent): WhatsappConnectionView {
    const connected = c.connected === true;
    return {
      accountId:    c.accountId,
      status:       connected ? 'CONNECTED' : 'ERROR',
      displayPhone: c.displayPhoneNumber,
      errorMessage: connected ? null : (c.reason ?? 'La conexión con Meta no está activa'),
    };
  }

  private async call<T = unknown>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
    const base = process.env['CHATIA_BACK_URL'];
    const key  = process.env['INTERNAL_API_KEY'];
    if (!base || !key) {
      throw new ServiceUnavailableException('El chat IA no está configurado en este entorno');
    }

    let res: Response;
    try {
      res = await fetch(`${base.replace(/\/+$/, '')}/internal/whatsapp${path}`, {
        method,
        headers: {
          'x-internal-api-key': key,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      this.logger.warn(`chatia-backend no responde (${method} ${path.split('/')[2] ?? ''})`);
      throw new ServiceUnavailableException('El chat IA no está disponible en este momento');
    }

    const json = (await res.json().catch(() => ({}))) as { message?: unknown };
    if (!res.ok) {
      // Los 4xx de chatia traen un mensaje pensado para el usuario; un 5xx no se reenvía tal cual.
      if (res.status >= 400 && res.status < 500) {
        const msg = Array.isArray(json.message) ? json.message.join(', ') : String(json.message ?? 'Solicitud rechazada');
        throw new HttpException(msg, res.status === 403 ? 502 : res.status);
      }
      this.logger.error(`chatia-backend respondió ${res.status} en ${method} ${path.split('/')[2] ?? ''}`);
      throw new ServiceUnavailableException('El chat IA no pudo completar la operación');
    }
    return json as T;
  }
}
