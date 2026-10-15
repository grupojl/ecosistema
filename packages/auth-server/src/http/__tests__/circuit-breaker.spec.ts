import { CircuitBreaker, CircuitOpenError } from '../circuit-breaker';

describe('CircuitBreaker', () => {
  const boom = () => Promise.reject(new Error('caído'));
  const ok = <T>(v: T) => () => Promise.resolve(v);

  it('cerrado: deja pasar y devuelve el resultado', async () => {
    const cb = new CircuitBreaker('t');
    await expect(cb.run(ok(7))).resolves.toBe(7);
  });

  it('abre tras N fallos seguidos y falla RÁPIDO sin llamar al servicio', async () => {
    const cb = new CircuitBreaker('t', { failureThreshold: 3, resetMs: 10_000 });
    for (let i = 0; i < 3; i++) await expect(cb.run(boom)).rejects.toThrow('caído');

    const spy = jest.fn(ok(1));
    await expect(cb.run(spy)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(spy).not.toHaveBeenCalled();
  });

  it('un éxito reinicia el conteo de fallos (los fallos deben ser consecutivos)', async () => {
    const cb = new CircuitBreaker('t', { failureThreshold: 3, resetMs: 10_000 });
    await expect(cb.run(boom)).rejects.toThrow();
    await expect(cb.run(boom)).rejects.toThrow();
    await cb.run(ok(1));
    await expect(cb.run(boom)).rejects.toThrow();
    await expect(cb.run(boom)).rejects.toThrow();
    await expect(cb.run(ok(2))).resolves.toBe(2); // todavía cerrado
  });

  it('half-open: pasada la espera deja pasar UNA prueba; si sale bien, cierra', async () => {
    jest.useFakeTimers();
    try {
      const cb = new CircuitBreaker('t', { failureThreshold: 2, resetMs: 1_000 });
      await expect(cb.run(boom)).rejects.toThrow();
      await expect(cb.run(boom)).rejects.toThrow();
      await expect(cb.run(ok(1))).rejects.toBeInstanceOf(CircuitOpenError);

      jest.advanceTimersByTime(1_001);
      await expect(cb.run(ok('prueba'))).resolves.toBe('prueba');
      await expect(cb.run(ok('normal'))).resolves.toBe('normal');
    } finally { jest.useRealTimers(); }
  });

  it('half-open: si la prueba falla, vuelve a abrir', async () => {
    jest.useFakeTimers();
    try {
      const cb = new CircuitBreaker('t', { failureThreshold: 1, resetMs: 1_000 });
      await expect(cb.run(boom)).rejects.toThrow();
      jest.advanceTimersByTime(1_001);
      await expect(cb.run(boom)).rejects.toThrow('caído'); // la prueba falla
      await expect(cb.run(ok(1))).rejects.toBeInstanceOf(CircuitOpenError);
    } finally { jest.useRealTimers(); }
  });
});
