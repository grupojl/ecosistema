/**
 * feedback.sanitize.ts — saneo del diagnóstico de un reporte (ADR-027).
 *
 * Lo que manda el navegador no es de fiar: se descarta toda clave que parezca un secreto y se acotan largos y
 * cantidades. Nunca se guardan tokens, cookies, Authorization, contraseñas ni cuerpos de request.
 */
const SECRET_KEY =
  /token|cookie|authorization|password|passwd|secret|api[-_]?key|session|bearer|credential/i;

const MAX_CONSOLE_ERRORS = 20;
const MAX_ERROR_LENGTH = 500;
const MAX_STRING = 2000;
const MAX_DEPTH = 4;

/** Quita claves sospechosas y recorta strings; descarta lo que pasa de la profundidad permitida. */
export function stripSecrets(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return undefined;
  if (typeof value === 'string') return value.slice(0, MAX_STRING);
  if (Array.isArray(value))
    return value
      .slice(0, MAX_CONSOLE_ERRORS)
      .map((v) => stripSecrets(v, depth + 1));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(k)) continue;
      const clean = stripSecrets(v, depth + 1);
      if (clean !== undefined) out[k] = clean;
    }
    return out;
  }
  return typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
    ? value
    : undefined;
}

/** Los errores de consola pueden traer un token en el texto: se enmascaran los patrones habituales. */
export function maskSecretsInText(text: string): string {
  return text
    .replace(/(bearer\s+)[a-z0-9._~+/=-]+/gi, '$1[redacted]')
    .replace(
      /\beyJ[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}\.[a-z0-9_-]{5,}/gi,
      '[redacted-jwt]',
    )
    .replace(
      /((?:token|key|secret|password|session)=)[^&\s]+/gi,
      '$1[redacted]',
    );
}

export function sanitizeConsoleErrors(
  errors: readonly string[] | undefined,
): string[] {
  return (errors ?? [])
    .slice(0, MAX_CONSOLE_ERRORS)
    .map((e) => maskSecretsInText(e.slice(0, MAX_ERROR_LENGTH)));
}
