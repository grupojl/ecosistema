/**
 * subscription-lifecycle.ts — ciclo de vida del paquete (welver-domain.md §13.1 «Vencimiento»).
 *
 *   PENDING ──pago verificado──▶ ACTIVE ──vence──▶ GRACE (7–14 días) ──vence la gracia──▶ SUSPENDED
 *                                   ▲                                                         │
 *                                   └─────────────────────── pago verificado ────────────────┘
 *
 * En GRACE el servicio sigue funcionando (hay aviso). En SUSPENDED la IA deja de responder, los canales se pausan y el
 * panel queda en solo lectura; los datos se conservan SIEMPRE.
 *
 * Dominio puro: el estado «efectivo» se calcula con la fecha; el guardado solo se actualiza al sincronizar o renovar.
 */
export type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'GRACE' | 'SUSPENDED';
export type BillingPeriod = 'MONTHLY' | 'ANNUAL';

export const GRACE_DAYS_MIN = 7;
export const GRACE_DAYS_MAX = 14;
export const GRACE_DAYS_DEFAULT = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface LifecycleInput {
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  graceDays: number;
}

export function clampGraceDays(days: number): number {
  if (!Number.isFinite(days)) return GRACE_DAYS_DEFAULT;
  return Math.min(GRACE_DAYS_MAX, Math.max(GRACE_DAYS_MIN, Math.round(days)));
}

/** Fin de la gracia: fin del período + días de gracia. Null si todavía no hay período. */
export function graceEndsAt(
  input: Pick<LifecycleInput, 'currentPeriodEnd' | 'graceDays'>,
): Date | null {
  if (!input.currentPeriodEnd) return null;
  return new Date(
    input.currentPeriodEnd.getTime() + clampGraceDays(input.graceDays) * DAY_MS,
  );
}

/**
 * Estado real en `now`. PENDING y SUSPENDED solo salen con un pago verificado (renovación explícita), nunca por el reloj.
 */
export function effectiveStatus(
  input: LifecycleInput,
  now: Date,
): SubscriptionStatus {
  if (input.status === 'PENDING' || input.status === 'SUSPENDED')
    return input.status;
  if (!input.currentPeriodEnd) return input.status;
  if (now.getTime() <= input.currentPeriodEnd.getTime()) return 'ACTIVE';
  const grace = graceEndsAt(input);
  if (grace && now.getTime() <= grace.getTime()) return 'GRACE';
  return 'SUSPENDED';
}

/** ¿La IA responde y los canales están activos? */
export function isServiceEnabled(status: SubscriptionStatus): boolean {
  return status === 'ACTIVE' || status === 'GRACE';
}

/** ¿Se puede escribir en el panel? Suspendida o sin primer pago = solo lectura. */
export function isPanelWritable(status: SubscriptionStatus): boolean {
  return status === 'ACTIVE' || status === 'GRACE';
}

/** Suma períodos de calendario sin desbordar el mes (31/ene + 1 mes = 28 o 29/feb, no 3/mar). */
export function addPeriod(start: Date, period: BillingPeriod): Date {
  const months = period === 'ANNUAL' ? 12 : 1;
  const result = new Date(start.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export interface RenewalPeriod {
  start: Date;
  end: Date;
}

/**
 * Período que abre un pago verificado en `now`.
 * - Si el período anterior sigue vigente (o en gracia), el nuevo continúa desde su fin: pagar antes o en gracia no regala ni quita días.
 * - Si estaba suspendido o es el primero, arranca hoy.
 */
export function renewalPeriod(
  input: Pick<LifecycleInput, 'status' | 'currentPeriodEnd' | 'graceDays'>,
  period: BillingPeriod,
  now: Date,
): RenewalPeriod {
  const previousEnd = input.currentPeriodEnd;
  const effective = effectiveStatus(input, now);
  const start =
    previousEnd !== null && isServiceEnabled(effective) ? previousEnd : now;
  return { start, end: addPeriod(start, period) };
}

/** Días hasta el fin del período (negativo si ya venció). Null si no hay período. */
export function daysUntilPeriodEnd(
  currentPeriodEnd: Date | null,
  now: Date,
): number | null {
  if (!currentPeriodEnd) return null;
  return Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / DAY_MS);
}

/**
 * Aviso de uso del tope mensual de mensajes: al 80% se avisa al admin; NUNCA se corta (se renegocia en el contrato).
 */
export function messageCapState(
  used: number,
  cap: number | null,
  alertAtPercent = 80,
): 'unlimited' | 'ok' | 'warn' | 'over' {
  if (cap === null || cap <= 0) return 'unlimited';
  if (used >= cap) return 'over';
  return used * 100 >= cap * alertAtPercent ? 'warn' : 'ok';
}
