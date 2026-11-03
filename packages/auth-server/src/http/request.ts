/**
 * Lectura TIPADA de la request HTTP (norte de tipos, ADR-030).
 *
 * Express tipa `req.cookies` como `any` y `req.headers[x]` como `string | string[] | undefined`: leerlos con `as string`
 * es mentirle al compilador (un header repetido llega como arreglo). Estos helpers hacen la comprobación de verdad, sin
 * ningún `as`, y son los que usan los guards, los middleware y los backs.
 */

/** Lo mínimo que se necesita de una request: sirve para la de Express y para dobles de test. */
export interface HeaderSource {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
}
export interface CookieSource {
  readonly cookies?: unknown;
}

/** Primer valor del header (los repetidos llegan como arreglo), o undefined. */
export function headerOf(req: HeaderSource, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

/** Valor de una cookie, o undefined si no hay jar (cookie-parser ausente) o no es un texto. */
export function cookieOf(req: CookieSource, name: string): string | undefined {
  const jar = req.cookies;
  if (typeof jar !== 'object' || jar === null) return undefined;
  const value: unknown = Reflect.get(jar, name);
  return typeof value === 'string' ? value : undefined;
}

/** Token de un header `Authorization: Bearer <token>`, o undefined. */
export function bearerOf(req: HeaderSource): string | undefined {
  const [type, token] = headerOf(req, 'authorization')?.split(' ') ?? [];
  return type === 'Bearer' ? token : undefined;
}

/** Mensaje de cualquier cosa que se haya lanzado (no solo `Error`). Reemplaza a `(err as Error).message`. */
export function errorMessage(error: unknown, fallback = 'error desconocido'): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}

/** `message` de un cuerpo de error de forma desconocida (HttpException, respuesta JSON), o undefined. */
export function messageOf(body: unknown): unknown {
  if (typeof body !== 'object' || body === null) return undefined;
  return 'message' in body ? body.message : undefined;
}
