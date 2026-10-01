/**
 * security-logger.ts — realsass-sass-back
 *
 * Wrapper de logging para eventos de seguridad.
 * Todos los eventos tienen securityEvent: true para poder filtrarlos
 * en el dashboard de observabilidad (Grafana, Datadog, Railway logs).
 *
 * Uso:
 *   import { SecurityLogger } from '@/common/logger/security-logger';
 *   SecurityLogger.authFailure(logger, { uid, reason, ip });
 *
 * Filtrar en Railway logs:
 *   securityEvent:true
 *
 * E7-04 — Fase 3 Hardening
 */
import { Logger } from '@nestjs/common';

export interface SecurityEventBase {
  securityEvent: true;
  service:       'realsass-sass-back';
  timestamp:     string;
}

export interface AuthFailureEvent extends SecurityEventBase {
  event:       'auth.failure';
  uid?:        string;
  reason:      string;
  ip?:         string;
  path?:       string;
}

export interface CrossTenantAttemptEvent extends SecurityEventBase {
  event:          'auth.cross_tenant';
  uid:            string;
  organizationId: string;
  reason:         string;
}

export interface RateLimitHitEvent extends SecurityEventBase {
  event:  'rate_limit.hit';
  ip?:    string;
  path:   string;
  limit:  number;
}

export interface SessionRevokedEvent extends SecurityEventBase {
  event:  'auth.session_revoked';
  uid:    string;
  reason: 'logout' | 'admin' | 'security';
}

type SecurityEvent =
  | AuthFailureEvent
  | CrossTenantAttemptEvent
  | RateLimitHitEvent
  | SessionRevokedEvent;

function base(): SecurityEventBase {
  return {
    securityEvent: true,
    service:       'realsass-sass-back',
    timestamp:     new Date().toISOString(),
  };
}

export class SecurityLogger {
  static authFailure(
    logger: Logger,
    data: Omit<AuthFailureEvent, keyof SecurityEventBase | 'event'>,
  ): void {
    const event: AuthFailureEvent = { ...base(), event: 'auth.failure', ...data };
    logger.warn(event);
  }

  static crossTenantAttempt(
    logger: Logger,
    data: Omit<CrossTenantAttemptEvent, keyof SecurityEventBase | 'event'>,
  ): void {
    const event: CrossTenantAttemptEvent = { ...base(), event: 'auth.cross_tenant', ...data };
    logger.warn(event);
  }

  static rateLimitHit(
    logger: Logger,
    data: Omit<RateLimitHitEvent, keyof SecurityEventBase | 'event'>,
  ): void {
    const event: RateLimitHitEvent = { ...base(), event: 'rate_limit.hit', ...data };
    logger.warn(event);
  }

  static sessionRevoked(
    logger: Logger,
    data: Omit<SessionRevokedEvent, keyof SecurityEventBase | 'event'>,
  ): void {
    const event: SessionRevokedEvent = { ...base(), event: 'auth.session_revoked', ...data };
    logger.log(event);
  }
}
