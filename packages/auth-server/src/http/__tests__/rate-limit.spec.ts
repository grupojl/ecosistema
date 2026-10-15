import type { Request, Response } from 'express';
import { createRateLimitMiddleware, MemoryRateLimitStore, type RateLimitStore } from '../rate-limit';

interface Result { passed: boolean; status: number; retryAfter?: unknown }

async function call(mw: ReturnType<typeof createRateLimitMiddleware>, path: string, req: Partial<Request> = {}): Promise<Result> {
  const headers: Record<string, unknown> = {};
  const res = {
    status(code: number) { out.status = code; return this; },
    setHeader(k: string, v: unknown) { headers[k] = v; },
    json() { return this; },
  } as unknown as Response;
  const out: Result = { passed: false, status: 200 };
  await mw({ path, ip: '1.1.1.1', ...req } as Request, res, () => { out.passed = true; });
  out.retryAfter = headers['Retry-After'];
  return out;
}

describe('rate limit del middleware tRPC', () => {
  const build = () => createRateLimitMiddleware({
    defaultRule: { limit: 5, windowMs: 1_000, by: 'ip' },
    rules: [{ procedures: ['customer.identify'], limit: 2, windowMs: 1_000, by: 'ip' }],
  });

  it('corta con 429 + Retry-After al exceder la regla estricta del procedure', async () => {
    const mw = build();
    expect((await call(mw, '/customer.identify')).passed).toBe(true);
    expect((await call(mw, '/customer.identify')).passed).toBe(true);
    const blocked = await call(mw, '/customer.identify');
    expect(blocked).toMatchObject({ passed: false, status: 429, retryAfter: 1 });
  });

  it('cada IP tiene su propio contador', async () => {
    const mw = build();
    await call(mw, '/customer.identify'); await call(mw, '/customer.identify');
    expect((await call(mw, '/customer.identify', { ip: '2.2.2.2' })).passed).toBe(true);
  });

  it('la regla estricta no afecta al resto de los procedures, que usan la regla por defecto', async () => {
    const mw = build();
    for (let i = 0; i < 5; i++) expect((await call(mw, '/customer.me')).passed).toBe(true);
    expect((await call(mw, '/customer.me')).status).toBe(429);
  });

  it('patrón con prefijo (auth.*)', async () => {
    const mw = createRateLimitMiddleware({
      defaultRule: { limit: 100, windowMs: 1_000 },
      rules: [{ procedures: ['auth.*'], limit: 1, windowMs: 1_000 }],
    });
    expect((await call(mw, '/auth.sync')).passed).toBe(true);
    expect((await call(mw, '/auth.refreshClaims')).status).toBe(429); // el presupuesto es de la regla auth.*, compartido entre sus procedures
  });

  it('batch: cada procedure del batch cuenta contra su propia regla', async () => {
    const mw = build();
    await call(mw, '/customer.identify'); await call(mw, '/customer.identify');
    const batch = await call(mw, '/customer.me,customer.identify');
    expect(batch.passed).toBe(false); // identify ya agotó su regla aunque customer.me esté libre
  });

  it('by: "user" cuenta por usuario autenticado; sin usuario cae a la IP', async () => {
    const mw = createRateLimitMiddleware({ defaultRule: { limit: 1, windowMs: 1_000, by: 'user' } });
    const ana = { user: { uid: 'ana' } } as Partial<Request>;
    expect((await call(mw, '/x', ana)).passed).toBe(true);
    expect((await call(mw, '/x', ana)).status).toBe(429);
    expect((await call(mw, '/x', { user: { uid: 'beto' } } as Partial<Request>)).passed).toBe(true);
    expect((await call(mw, '/x')).passed).toBe(true); // anónimo: cuenta por IP
  });

  it('la ventana vence y el contador se reinicia', async () => {
    jest.useFakeTimers();
    try {
      const mw = build();
      await call(mw, '/customer.identify'); await call(mw, '/customer.identify');
      expect((await call(mw, '/customer.identify')).status).toBe(429);
      jest.advanceTimersByTime(1_001);
      expect((await call(mw, '/customer.identify')).passed).toBe(true);
    } finally { jest.useRealTimers(); }
  });

  it('si el store falla (ej. Redis caído) no se tira el servicio PERO tampoco queda abierto: limita con un contador local', async () => {
    const broken: RateLimitStore = { hit: () => Promise.reject(new Error('redis caído')) };
    const mw = createRateLimitMiddleware({ defaultRule: { limit: 2, windowMs: 1_000 }, store: broken });

    expect((await call(mw, '/x')).passed).toBe(true);
    expect((await call(mw, '/x')).passed).toBe(true);
    expect((await call(mw, '/x')).passed).toBe(false); // el tercero se frena aunque el store esté caído
  });

  it('con el store caído cada regla sigue contando por su cuenta (identify es más estricto que el resto)', async () => {
    const broken: RateLimitStore = { hit: () => Promise.reject(new Error('redis caído')) };
    const mw = createRateLimitMiddleware({
      defaultRule: { limit: 100, windowMs: 1_000 },
      rules: [{ procedures: ['customer.identify'], limit: 1, windowMs: 1_000 }],
      store: broken,
    });

    expect((await call(mw, '/customer.identify')).passed).toBe(true);
    expect((await call(mw, '/customer.identify')).passed).toBe(false);
    expect((await call(mw, '/otra.cosa')).passed).toBe(true);
  });

  it('MemoryRateLimitStore cuenta y reinicia por ventana', async () => {
    const store = new MemoryRateLimitStore();
    expect(await store.hit('k', 1_000)).toBe(1);
    expect(await store.hit('k', 1_000)).toBe(2);
    expect(await store.hit('otra', 1_000)).toBe(1);
  });
});
