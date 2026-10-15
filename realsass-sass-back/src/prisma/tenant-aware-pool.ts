/**
 * tenant-aware-pool.ts — copia IDÉNTICA en ambos backs (la vigila la auditoría S9) (ADR-027)
 *
 * Pool de `pg` que, al entregar CADA conexión, fija en la sesión de Postgres el alcance de tenant de quien la
 * pidió. Cubre las dos rutas del adaptador de Prisma: `pool.query()` (que internamente llama a `this.connect`)
 * y `pool.connect()` (transacciones interactivas).
 *
 * Por qué se captura el alcance ANTES de pedir la conexión: si el pool está agotado, pg-pool encola el callback y
 * lo invoca desde el contexto asíncrono de OTRA petición (la que libera). Leer el AsyncLocalStorage ahí mezclaría
 * tenants. `currentTenantScope()` se lee sincrónicamente, en el contexto del llamador.
 *
 * Cada entrega vuelve a fijar las variables (también cuando no hay alcance, con valores vacíos): una conexión
 * que volvió al pool nunca arrastra el tenant anterior.
 */
import * as pg from 'pg';
import { currentTenantScope, sessionSettingsFor, type TenantScope } from '@/prisma/tenant-context';

type ConnectCallback = (
  err: Error | undefined,
  client: pg.PoolClient | undefined,
  done: (release?: Error | boolean) => void,
) => void;

async function applyScope(client: pg.PoolClient, scope: TenantScope | null): Promise<void> {
  const { organizationId, bypass } = sessionSettingsFor(scope);
  await client.query(
    'SELECT set_config($1, $2, false), set_config($3, $4, false)',
    ['app.organization_id', organizationId, 'app.rls_bypass', bypass],
  );
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export class TenantAwarePool extends pg.Pool {
  override connect(): Promise<pg.PoolClient>;
  override connect(callback: ConnectCallback): void;
  override connect(callback?: ConnectCallback): Promise<pg.PoolClient> | void {
    const scope = currentTenantScope();

    if (callback === undefined) {
      return super.connect().then(async (client) => {
        try {
          await applyScope(client, scope);
          return client;
        } catch (err) {
          client.release(toError(err));
          throw err;
        }
      });
    }

    super.connect((err, client, done) => {
      if (err !== undefined || client === undefined) {
        callback(err, client, done);
        return;
      }
      applyScope(client, scope).then(
        () => { callback(undefined, client, done); },
        (applyErr: unknown) => {
          const error = toError(applyErr);
          done(error);
          callback(error, undefined, done);
        },
      );
    });
  }
}
