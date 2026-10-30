import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryCacheAdapter } from './memory-cache.adapter';

describe('MemoryCacheAdapter', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-30T12:00:00Z')); });
  afterEach(() => vi.useRealTimers());

  it('guarda y devuelve un valor', async () => {
    const c = new MemoryCacheAdapter();
    await c.set('k', { a: 1 }, 60);
    await expect(c.get('k')).resolves.toEqual({ a: 1 });
  });

  it('devuelve null si la clave no existe', async () => {
    await expect(new MemoryCacheAdapter().get('nada')).resolves.toBeNull();
  });

  it('expira pasado el TTL y libera la entrada', async () => {
    const c = new MemoryCacheAdapter();
    await c.set('k', 'v', 10);
    vi.advanceTimersByTime(9_000);
    await expect(c.get('k')).resolves.toBe('v');
    vi.advanceTimersByTime(2_000);
    await expect(c.get('k')).resolves.toBeNull();
  });

  it('del elimina la clave', async () => {
    const c = new MemoryCacheAdapter();
    await c.set('k', 'v', 60);
    await c.del('k');
    await expect(c.get('k')).resolves.toBeNull();
  });

  it('set sobre una clave existente renueva valor y TTL', async () => {
    const c = new MemoryCacheAdapter();
    await c.set('k', 'v1', 5);
    vi.advanceTimersByTime(4_000);
    await c.set('k', 'v2', 5);
    vi.advanceTimersByTime(4_000);
    await expect(c.get('k')).resolves.toBe('v2');
  });
});
