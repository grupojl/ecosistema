/**
 * security-logger.ts — realsass-ecommerce-back
 *
 * Wrapper de logging para eventos de seguridad.
 * securityEvent: true permite filtrar en dashboard de observabilidad.
 *
 * Filtrar en Railway logs: securityEvent:true
 * E7-04 — Fase 3 Hardening
 */
import { Logger } from '@nestjs/common';

export interface SecurityEventBase {
  securityEvent: true;
  service:       'realsass-ecommerce-back';
  timestamp:     string;
}

export interface TenantAccessDeniedEvent extends SecurityEventBase {
  event:          'auth.tenant_denied';
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

export interface SuspiciousRequestEvent extends SecurityEventBase {
  event:  'request.suspicious';
  ip?:    string;
  path:   string;
  reason: string;
}

type SecurityEvent =
  | TenantAccessDeniedEvent
  | RateLimitHitEvent
  | SuspiciousRequestEvent;

function base(): SecurityEventBase {
  return {
    securityEvent: true,
    service:       'realsass-ecommerce-back',
    timestamp:     new Date().toISOString(),
  };
}

export class SecurityLogger {
  static tenantAccessDenied(
    logger: Logger,
    data: Omit<TenantAccessDeniedEvent, keyof SecurityEventBase | 'event'>,
  ): void {
    const event: TenantAccessDeniedEvent = { ...base(), event: 'auth.tenant_denied', ...data };
    logger.warn(event);
  }

  static rateLimitHit(
    logger: Logger,
    data: Omit<RateLimitHitEvent, keyof SecurityEventBase | 'event'>,
  ): void {
    const event: RateLimitHitEvent = { ...base(), event: 'rate_limit.hit', ...data };
    logger.warn(event);
  }

  static suspiciousRequest(
    logger: Logger,
    data: Omit<SuspiciousRequestEvent, keyof SecurityEventBase | 'event'>,
  ): void {
    const event: SuspiciousRequestEvent = { ...base(), event: 'request.suspicious', ...data };
    logger.warn(event);
  }
}
