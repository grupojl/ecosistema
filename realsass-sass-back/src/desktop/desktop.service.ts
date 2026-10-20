import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@/redis/redis.service';

/**
 * App de escritorio (ADR-023, norte de desktop pilares 3 y 6).
 *
 *   · Política de versiones: versión mínima soportada y versiones bloqueadas. Es el "rollback" posible con un updater que solo
 *     sube de versión: una release rota se bloquea y los usuarios son llevados a la corregida (el panel muestra el aviso).
 *   · Telemetría CON CONSENTIMIENTO (el consentimiento lo gestiona el panel; sin él, el cliente no llama acá): versiones
 *     instaladas y errores del panel dentro de la app. Se cuenta por versión/día en Redis y se deja una línea de log.
 *     No se guarda ningún dato personal ni identificador de usuario.
 */
export interface DesktopPolicy {
  minVersion:      string | null;
  blockedVersions: string[];
  downloadUrl:     string | null;
}

export type TelemetryKind = 'ping' | 'error';
export type TelemetryOs   = 'windows' | 'macos' | 'linux' | 'unknown';

export interface TelemetryInput {
  kind:    TelemetryKind;
  version: string;
  os:      TelemetryOs;
  message?: string;
}

const RETENTION_SECONDS = 90 * 24 * 60 * 60;
const RATE_LIMIT_PER_MINUTE = 30;

@Injectable()
export class DesktopService {
  private readonly logger = new Logger(DesktopService.name);

  constructor(private readonly redis: RedisService) {}

  getPolicy(env: Record<string, string | undefined> = process.env): DesktopPolicy {
    const list = (env['DESKTOP_BLOCKED_VERSIONS'] ?? '')
      .split(',').map((v) => v.trim()).filter((v) => /^\d+\.\d+\.\d+$/.test(v));
    const min = env['DESKTOP_MIN_VERSION']?.trim();
    return {
      minVersion:      min && /^\d+\.\d+\.\d+$/.test(min) ? min : null,
      blockedVersions: list,
      downloadUrl:     env['DESKTOP_DOWNLOAD_URL']?.trim() || null,
    };
  }

  /** Devuelve false si el origen superó el límite (se descarta sin error: es telemetría, no debe romper nada). */
  async record(input: TelemetryInput, ip: string | undefined): Promise<boolean> {
    if (!(await this.allow(ip ?? 'unknown'))) return false;

    const day = new Date().toISOString().slice(0, 10);
    // El mensaje de un error viene del cliente: se recorta y se limpia de saltos de línea (log injection).
    const message = (input.message ?? '').replace(/[\r\n\t]+/g, ' ').slice(0, 300);

    await this.redis.incr(`desktop:${input.kind}:${input.version}:${input.os}:${day}`, RETENTION_SECONDS);
    this.logger.log(JSON.stringify({ event: 'desktop-telemetry', kind: input.kind, version: input.version, os: input.os, ...(message && { message }) }));
    return true;
  }

  private async allow(ip: string): Promise<boolean> {
    const minute = Math.floor(Date.now() / 60_000);
    const count = await this.redis.incr(`desktop:rl:${ip}:${minute}`, 120);
    return count <= RATE_LIMIT_PER_MINUTE;
  }
}
