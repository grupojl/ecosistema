/**
 * tenant-context.ts — copia IDÉNTICA en ambos backs (la vigila la auditoría S9) (ADR-027, Row Level Security)
 *
 * Alcance de tenant de la petición en curso. Lo lee el TenantAwarePool al entregar cada conexión
 * y lo vuelca en la sesión de Postgres (`app.organization_id` / `app.rls_bypass`); las políticas RLS
 * deciden con eso qué filas existen para la consulta.
 *
 * Sin alcance => la sesión queda vacía => las políticas devuelven 0 filas y rechazan escrituras.
 * Olvidarse de abrir un alcance rompe fuerte, nunca filtra datos.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export type TenantScope =
  | { readonly kind: 'tenant'; readonly organizationId: string }
  | { readonly kind: 'system'; readonly reason: string };

const storage = new AsyncLocalStorage<TenantScope>();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/**
 * Las promesas de Prisma son PEREZOSAS: `prisma.x.findMany()` no consulta hasta que alguien llama a `.then`.
 * Si fn devolviera esa promesa sin ejecutar, la consulta correría al hacer `await` FUERA del alcance
 * (y vería 0 filas). Por eso, si fn devuelve algo "thenable", se lo dispara acá adentro, de forma sincrónica.
 */
function inScope(scope: TenantScope, fn: () => unknown): unknown {
  return storage.run(scope, () => {
    const value = fn();
    if (isThenable(value)) {
      return new Promise((resolve, reject) => { value.then(resolve, reject); });
    }
    return value;
  });
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && 'then' in value && typeof value.then === 'function';
}

/** Ejecuta `fn` (y todo lo que éste dispare) con visibilidad limitada a UNA organización. */
export function runInTenant<T>(organizationId: string, fn: () => PromiseLike<T>): Promise<T>;
export function runInTenant<T>(organizationId: string, fn: () => T): T;
export function runInTenant(organizationId: string, fn: () => unknown): unknown {
  if (!UUID.test(organizationId)) {
    throw new Error('runInTenant: organizationId inválido');
  }
  return inScope({ kind: 'tenant', organizationId }, fn);
}

/**
 * Ejecuta `fn` viendo TODAS las organizaciones. Es la única puerta de salida del aislamiento por fila:
 * exige una razón (queda en el código y en la auditoría `seguridad.sh` S8, que limita dónde puede usarse).
 */
export function runAsSystem<T>(reason: string, fn: () => PromiseLike<T>): Promise<T>;
export function runAsSystem<T>(reason: string, fn: () => T): T;
export function runAsSystem(reason: string, fn: () => unknown): unknown {
  if (reason.trim().length === 0) {
    throw new Error('runAsSystem: la razón es obligatoria');
  }
  return inScope({ kind: 'system', reason }, fn);
}

export function currentTenantScope(): TenantScope | null {
  return storage.getStore() ?? null;
}

/** Valores de las dos variables de sesión para un alcance (vacío = sin visibilidad). */
export function sessionSettingsFor(scope: TenantScope | null): { organizationId: string; bypass: string } {
  if (scope === null) return { organizationId: '', bypass: '' };
  if (scope.kind === 'system') return { organizationId: '', bypass: 'on' };
  return { organizationId: scope.organizationId, bypass: '' };
}
