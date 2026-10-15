/**
 * Circuit breaker mínimo para llamadas entre servicios. Evita que un servicio lento o caído
 * deje colgado a todos los que lo consultan (agotamiento de conexiones / DoS en cascada).
 *
 *   closed    → pasa todo; cuenta fallos consecutivos
 *   open      → rechaza al instante durante `resetMs`
 *   half-open → deja pasar UNA llamada de prueba; si sale bien, vuelve a closed
 */
export class CircuitOpenError extends Error {
  constructor(name: string) { super(`Circuito abierto: ${name} no disponible temporalmente`); }
}

export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  private probing = false;

  constructor(
    private readonly name: string,
    private readonly opts: { failureThreshold?: number; resetMs?: number } = {},
  ) {}

  private get threshold() { return this.opts.failureThreshold ?? 5; }
  private get resetMs() { return this.opts.resetMs ?? 15_000; }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.failures >= this.threshold) {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed < this.resetMs || this.probing) throw new CircuitOpenError(this.name);
      this.probing = true; // half-open: una sola prueba
    }
    try {
      const result = await fn();
      this.failures = 0;
      return result;
    } catch (err) {
      this.failures += 1;
      if (this.failures >= this.threshold) this.openedAt = Date.now();
      throw err;
    } finally {
      this.probing = false;
    }
  }
}
