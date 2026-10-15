/**
 * Falla cerrado al arrancar: un servicio sin su configuración de seguridad NO levanta
 * (en vez de levantar degradado y abierto).
 */
export function requireEnv(name: string, opts: { minLength?: number } = {}): string {
  const value = (process.env[name] ?? '').trim();
  if (!value) throw new Error(`${name} no está definida — el servicio no puede arrancar sin ella`);
  if (opts.minLength && value.length < opts.minLength) {
    throw new Error(`${name} es demasiado corta (mínimo ${opts.minLength} caracteres)`);
  }
  return value;
}

/** ALLOWED_ORIGINS: lista explícita separada por coma. Nunca un comodín ni "reflejar el Origin". */
export function parseAllowedOrigins(): string[] {
  const origins = requireEnv('ALLOWED_ORIGINS').split(',').map((o) => o.trim()).filter(Boolean);
  if (origins.includes('*')) throw new Error('ALLOWED_ORIGINS no puede ser "*" (se usan cookies con credentials)');
  return origins;
}

/**
 * `trust proxy`: sin esto, detrás de Railway todos los clientes comparten la IP del proxy y el
 * rate limit es inútil. TRUST_PROXY=<n saltos> (default 1 en producción, 0 en local).
 */
export function trustProxyHops(): number {
  const raw = process.env['TRUST_PROXY'];
  if (raw !== undefined && raw !== '') {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) throw new Error('TRUST_PROXY debe ser un entero >= 0');
    return n;
  }
  return process.env['NODE_ENV'] === 'production' ? 1 : 0;
}
