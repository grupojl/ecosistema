import * as pg from 'pg';
import { TenantAwarePool } from '@/prisma/tenant-aware-pool';
import { runAsSystem, runInTenant } from '@/prisma/tenant-context';

const ORG_A = '00000000-0000-4000-8000-00000000000a';
const ORG_B = '00000000-0000-4000-8000-00000000000b';

/** Cliente falso: registra las consultas. `queryImpl` permite simular fallas. */
function fakeClient(queryImpl: () => Promise<unknown> = () => Promise.resolve({ rows: [] })) {
  return { query: jest.fn(queryImpl), release: jest.fn() } as unknown as pg.PoolClient & { query: jest.Mock; release: jest.Mock };
}

const SET_SESSION = 'SELECT set_config($1, $2, false), set_config($3, $4, false)';
const settingsOf = (client: { query: jest.Mock }) => client.query.mock.calls[0]?.[1] as string[];

describe('TenantAwarePool (ADR-027)', () => {
  let connectSpy: jest.SpyInstance;
  const pool = new TenantAwarePool({ connectionString: 'postgresql://x:x@localhost:1/x' });

  afterEach(() => connectSpy?.mockRestore());

  describe('connect() con promesa (transacciones interactivas)', () => {
    it('fija la organización del alcance actual en la sesión antes de entregar la conexión', async () => {
      const client = fakeClient();
      connectSpy = jest.spyOn(pg.Pool.prototype, 'connect').mockResolvedValue(client as never);

      const got = await runInTenant(ORG_A, () => pool.connect());

      expect(got).toBe(client);
      expect(client.query).toHaveBeenCalledWith(SET_SESSION, ['app.organization_id', ORG_A, 'app.rls_bypass', '']);
    });

    it('en alcance de sistema fija el bypass y ninguna organización', async () => {
      const client = fakeClient();
      connectSpy = jest.spyOn(pg.Pool.prototype, 'connect').mockResolvedValue(client as never);

      await runAsSystem('prueba', () => pool.connect());

      expect(settingsOf(client)).toEqual(['app.organization_id', '', 'app.rls_bypass', 'on']);
    });

    it('SIN alcance fija todo vacío (default-deny): la conexión nunca arrastra el tenant anterior', async () => {
      const client = fakeClient();
      connectSpy = jest.spyOn(pg.Pool.prototype, 'connect').mockResolvedValue(client as never);

      await pool.connect();

      expect(settingsOf(client)).toEqual(['app.organization_id', '', 'app.rls_bypass', '']);
    });

    it('si no se puede fijar la sesión, libera la conexión con error y rechaza (nunca la entrega sin aislar)', async () => {
      const client = fakeClient(() => Promise.reject(new Error('set_config falló')));
      connectSpy = jest.spyOn(pg.Pool.prototype, 'connect').mockResolvedValue(client as never);

      await expect(runInTenant(ORG_A, () => pool.connect())).rejects.toThrow('set_config falló');
      expect(client.release).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('connect() con callback (pool.query() de Prisma)', () => {
    it('fija el alcance y recién después invoca el callback con el cliente', async () => {
      const client = fakeClient();
      const done = jest.fn();
      connectSpy = jest.spyOn(pg.Pool.prototype, 'connect').mockImplementation(((cb: (e: Error | undefined, c: unknown, d: () => void) => void) => {
        cb(undefined, client, done);
      }) as never);

      await runInTenant(ORG_B, () => new Promise<void>((resolve) => {
        pool.connect((err, c) => {
          expect(err).toBeUndefined();
          expect(c).toBe(client);
          expect(settingsOf(client)).toEqual(['app.organization_id', ORG_B, 'app.rls_bypass', '']);
          resolve();
        });
      }));
    });

    it('usa el alcance de QUIEN PIDIÓ la conexión aunque el pool la entregue después, desde otro contexto', async () => {
      // pg-pool encola el callback cuando está agotado y lo invoca desde la petición que libera una conexión.
      const client = fakeClient();
      let deliver: (() => void) | undefined;
      connectSpy = jest.spyOn(pg.Pool.prototype, 'connect').mockImplementation(((cb: (e: Error | undefined, c: unknown, d: () => void) => void) => {
        deliver = () => { cb(undefined, client, jest.fn()); };
      }) as never);

      const settled = new Promise<void>((resolve) => {
        runInTenant(ORG_A, () => { pool.connect(() => { resolve(); }); });
      });
      // La entrega ocurre dentro del alcance de OTRA organización (la petición que liberó la conexión).
      await runInTenant(ORG_B, async () => { deliver?.(); await settled; });

      expect(settingsOf(client)[1]).toBe(ORG_A);
    });

    it('un error del pool se propaga tal cual, sin tocar la sesión', () => {
      const failure = new Error('sin conexiones');
      const cb = jest.fn();
      connectSpy = jest.spyOn(pg.Pool.prototype, 'connect').mockImplementation(((c: (e: Error | undefined, cl: unknown, d: () => void) => void) => {
        c(failure, undefined, jest.fn());
      }) as never);

      pool.connect(cb);

      expect(cb).toHaveBeenCalledWith(failure, undefined, expect.any(Function));
    });

    it('si falla fijar la sesión, destruye la conexión (done(error)) y avisa por el callback', async () => {
      const client = fakeClient(() => Promise.reject(new Error('set_config falló')));
      const done = jest.fn();
      connectSpy = jest.spyOn(pg.Pool.prototype, 'connect').mockImplementation(((c: (e: Error | undefined, cl: unknown, d: () => void) => void) => {
        c(undefined, client, done);
      }) as never);

      const result = await new Promise<{ err: Error | undefined; client: unknown }>((resolve) => {
        pool.connect((err, c) => { resolve({ err, client: c }); });
      });

      expect(result.err?.message).toBe('set_config falló');
      expect(result.client).toBeUndefined();
      expect(done).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
