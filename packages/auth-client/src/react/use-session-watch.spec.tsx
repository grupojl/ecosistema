// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionWatch } from './use-session-watch';

let visibility: 'visible' | 'hidden';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-03T12:00:00Z'));
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const flush = () => act(async () => { await Promise.resolve(); });

describe('useSessionWatch', () => {
  it('revalida al volver a la pestaña, al enfocar y al reconectar', async () => {
    const revalidate = vi.fn();
    renderHook(() => useSessionWatch(revalidate));
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await flush();
    expect(revalidate).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2100);
    act(() => { window.dispatchEvent(new Event('focus')); });
    await flush();
    vi.advanceTimersByTime(2100);
    act(() => { window.dispatchEvent(new Event('online')); });
    await flush();
    expect(revalidate).toHaveBeenCalledTimes(3);
  });

  it('no revalida con la pestaña oculta', async () => {
    visibility = 'hidden';
    const revalidate = vi.fn();
    renderHook(() => useSessionWatch(revalidate));
    act(() => { window.dispatchEvent(new Event('focus')); });
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(revalidate).not.toHaveBeenCalled();
  });

  it('respeta una separación mínima de 2 s entre revalidaciones (no se satura el back)', async () => {
    const revalidate = vi.fn();
    renderHook(() => useSessionWatch(revalidate));
    for (let i = 0; i < 5; i++) { act(() => { window.dispatchEvent(new Event('focus')); }); await flush(); }
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it('no se solapan: mientras una revalidación sigue en curso, las demás se ignoran', async () => {
    let release!: () => void;
    const revalidate = vi.fn(() => new Promise<void>((r) => { release = r; }));
    renderHook(() => useSessionWatch(revalidate));
    act(() => { window.dispatchEvent(new Event('focus')); });
    await flush();
    vi.advanceTimersByTime(3000);
    act(() => { window.dispatchEvent(new Event('focus')); });
    await flush();
    expect(revalidate).toHaveBeenCalledTimes(1);
    await act(async () => { release(); });
    vi.advanceTimersByTime(3000);
    act(() => { window.dispatchEvent(new Event('focus')); });
    await flush();
    expect(revalidate).toHaveBeenCalledTimes(2);
  });

  it('también revalida por intervalo (30 s por defecto)', async () => {
    const revalidate = vi.fn();
    renderHook(() => useSessionWatch(revalidate));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_100); });
    expect(revalidate).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(revalidate).toHaveBeenCalledTimes(2);
  });

  it('usa SIEMPRE la última función pasada (sin reiniciar el intervalo)', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ fn }) => useSessionWatch(fn, 1000), { initialProps: { fn: first } });
    rerender({ fn: second });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('al desmontar deja de escuchar', async () => {
    const revalidate = vi.fn();
    const { unmount } = renderHook(() => useSessionWatch(revalidate, 1000));
    unmount();
    act(() => { window.dispatchEvent(new Event('focus')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(revalidate).not.toHaveBeenCalled();
  });

  it('si la revalidación lanza, el hook sigue funcionando', async () => {
    const revalidate = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue(undefined);
    renderHook(() => useSessionWatch(revalidate, 1000));
    const run = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(2100); }); };
    await run();
    await run();
    expect(revalidate.mock.calls.length).toBeGreaterThanOrEqual(2); // siguió sondeando tras el fallo, sin promesas sin manejar
  });
});

describe('notifySessionChange', () => {
  it('avisa a las otras pestañas por BroadcastChannel (y no rompe si no existe)', async () => {
    const posted: unknown[] = [];
    class FakeChannel {
      static last: FakeChannel;
      constructor() { FakeChannel.last = this; }
      postMessage(m: unknown) { posted.push(m); }
      addEventListener() {}
      removeEventListener() {}
    }
    // El canal se guarda a nivel módulo: cada caso importa el módulo limpio.
    vi.stubGlobal('BroadcastChannel', FakeChannel);
    vi.resetModules();
    const withChannel = await import('./use-session-watch');
    expect(() => withChannel.notifySessionChange()).not.toThrow();
    expect(posted).toEqual(['changed']);

    vi.stubGlobal('BroadcastChannel', undefined);
    vi.resetModules();
    const without = await import('./use-session-watch');
    expect(() => without.notifySessionChange()).not.toThrow();
    vi.unstubAllGlobals();
  });
});
