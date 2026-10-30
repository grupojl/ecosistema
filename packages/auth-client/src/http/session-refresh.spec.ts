import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSessionRefreshed, markSessionRefreshed, sessionRefreshDue } from './session-refresh';

const KEY = 'real_session_refreshed_at';
const MIN = 60_000;

function stubStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
  return store;
}

describe('session-refresh', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-30T12:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('nunca se renovó → hay que renovar', () => {
    stubStorage();
    expect(sessionRefreshDue()).toBe(true);
  });

  it('renovada hace poco → no hace falta (evita el límite 10/min de POST /auth/session)', () => {
    stubStorage({ [KEY]: String(Date.now() - 5 * MIN) });
    expect(sessionRefreshDue()).toBe(false);
  });

  it('pasaron más de 30 min → renovar; justo antes del límite, no', () => {
    stubStorage({ [KEY]: String(Date.now() - 31 * MIN) });
    expect(sessionRefreshDue()).toBe(true);
    stubStorage({ [KEY]: String(Date.now() - 29 * MIN) });
    expect(sessionRefreshDue()).toBe(false);
  });

  it('un valor en el futuro (reloj desfasado) se trata como vencido', () => {
    stubStorage({ [KEY]: String(Date.now() + 10 * MIN) });
    expect(sessionRefreshDue()).toBe(true);
  });

  it('un valor corrupto se trata como "nunca renovada"', () => {
    stubStorage({ [KEY]: 'basura' });
    expect(sessionRefreshDue()).toBe(true);
  });

  it('con el storage bloqueado siempre renueva y ninguna función lanza', () => {
    vi.stubGlobal('window', {
      get localStorage(): never { throw new Error('SecurityError'); },
    });
    expect(sessionRefreshDue()).toBe(true);
    expect(() => markSessionRefreshed()).not.toThrow();
    expect(() => clearSessionRefreshed()).not.toThrow();
  });

  it('mark guarda la hora actual y clear la borra', () => {
    const store = stubStorage();
    markSessionRefreshed();
    expect(store.get(KEY)).toBe(String(Date.now()));
    expect(sessionRefreshDue()).toBe(false);
    clearSessionRefreshed();
    expect(store.has(KEY)).toBe(false);
    expect(sessionRefreshDue()).toBe(true);
  });
});
