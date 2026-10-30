import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cn } from '../src/utils/cn';
import { THEME_COLOR } from '../src/utils/theme-color';

describe('cn', () => {
  it('une clases y descarta valores falsos', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
    expect(cn({ a: true, b: false }, ['c'])).toBe('a c');
  });

  it('resuelve conflictos de Tailwind: gana la última', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-sm text-muted-foreground', 'text-lg')).toBe('text-muted-foreground text-lg');
  });

  it('no mezcla variantes distintas', () => {
    expect(cn('p-2', 'medium:p-4')).toBe('p-2 medium:p-4');
  });
});

describe('THEME_COLOR', () => {
  /** hsl(42 30% 98%) → [r, g, b] */
  function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    const sat = s / 100;
    const lig = l / 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = sat * Math.min(lig, 1 - lig);
    const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }
  const hexToRgb = (hex: string): [number, number, number] =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

  const css = readFileSync(resolve(__dirname, '../src/styles/welver.css'), 'utf8');
  const backgrounds = [...css.matchAll(/--background:\s*hsl\((\d+) (\d+)% (\d+)%\)/g)].map((m) =>
    hslToRgb(Number(m[1]), Number(m[2]), Number(m[3])),
  );

  it('define un color para el modo claro y otro para el oscuro', () => {
    expect(THEME_COLOR.map((t) => t.media)).toEqual([
      '(prefers-color-scheme: light)',
      '(prefers-color-scheme: dark)',
    ]);
  });

  it('coincide con --background de welver.css (claro y oscuro): si cambia uno, hay que cambiar el otro', () => {
    expect(backgrounds).toHaveLength(2);
    THEME_COLOR.forEach((t, i) => {
      const got = hexToRgb(t.color);
      backgrounds[i]!.forEach((channel, c) => expect(Math.abs(channel - got[c]!)).toBeLessThanOrEqual(1));
    });
  });
});

describe('client-errors', () => {
  type Listener = (e: unknown) => void;

  async function load() {
    vi.resetModules();
    const listeners = new Map<string, Listener[]>();
    vi.stubGlobal('window', {
      addEventListener: (type: string, fn: Listener) => listeners.set(type, [...(listeners.get(type) ?? []), fn]),
    });
    const mod = await import('../src/utils/client-errors');
    const fire = (type: string, e: unknown) => (listeners.get(type) ?? []).forEach((fn) => fn(e));
    return { ...mod, fire, listeners };
  }

  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it('sin window (servidor) no hace nada ni lanza', async () => {
    vi.resetModules();
    const { captureClientErrors, getRecentClientErrors } = await import('../src/utils/client-errors');
    expect(() => captureClientErrors()).not.toThrow();
    expect(getRecentClientErrors()).toEqual([]);
  });

  it('es idempotente: instalarlo dos veces no duplica los oyentes', async () => {
    const { captureClientErrors, listeners } = await load();
    captureClientErrors();
    captureClientErrors();
    expect(listeners.get('error')).toHaveLength(1);
    expect(listeners.get('unhandledrejection')).toHaveLength(1);
  });

  it('guarda errores de script y rechazos de promesa', async () => {
    const { captureClientErrors, getRecentClientErrors, fire } = await load();
    captureClientErrors();
    fire('error', { message: 'x is not a function' });
    fire('error', { message: '' });
    fire('unhandledrejection', { reason: new Error('falló el fetch') });
    fire('unhandledrejection', { reason: 'texto suelto' });
    expect(getRecentClientErrors()).toEqual([
      'x is not a function',
      'Error de script',
      'falló el fetch',
      'Promesa rechazada: texto suelto',
    ]);
  });

  it('recorta cada texto a 300 caracteres y conserva solo los últimos 20', async () => {
    const { captureClientErrors, getRecentClientErrors, fire } = await load();
    captureClientErrors();
    fire('error', { message: 'x'.repeat(1000) });
    expect(getRecentClientErrors()[0]).toHaveLength(300);
    for (let i = 0; i < 30; i++) fire('error', { message: `e${i}` });
    const all = getRecentClientErrors();
    expect(all).toHaveLength(20);
    expect(all[0]).toBe('e10');
    expect(all.at(-1)).toBe('e29');
  });

  it('devuelve una copia: modificarla no altera el buffer', async () => {
    const { captureClientErrors, getRecentClientErrors, fire } = await load();
    captureClientErrors();
    fire('error', { message: 'a' });
    getRecentClientErrors().push('intruso');
    expect(getRecentClientErrors()).toEqual(['a']);
  });
});
