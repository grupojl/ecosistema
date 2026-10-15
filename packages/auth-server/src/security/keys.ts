import { timingSafeEqual, createHash } from 'node:crypto';

/**
 * Claves de servicio rotables y por servicio.
 *
 * Una variable puede contener varias entradas separadas por coma. Cada entrada es una clave simple o una
 * clave NOMBRADA (`nombre=clave`):
 *
 *     INTERNAL_API_KEY=ecommerce=k1k1k1…,superadmin=k2k2k2…           ← una clave por servicio
 *     INTERNAL_API_KEY=nueva,vieja                                     ← rotación sin caída
 *
 *   - Quien RECIBE acepta cualquiera de las entradas y sabe QUIÉN llama (identifyCaller): se audita y se
 *     puede revocar a un solo servicio borrando su entrada, sin tocar a los demás.
 *   - Quien ENVÍA usa siempre la primera (y manda solo la clave, sin el nombre).
 *
 * Una entrada se interpreta como nombrada solo si es `[a-z][a-z0-9_-]{0,31}=` seguido de ≥ 16 caracteres:
 * así una clave base64 con padding ("…==") nunca se confunde con un nombre.
 */
export interface KeyEntry { name: string; key: string }

const NAMED = /^([a-z][a-z0-9_-]{0,31})=(.{16,})$/;
const DEFAULT_CALLER = 'default';

export function parseKeyEntries(raw: string | undefined): KeyEntry[] {
  return (raw ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
    .map((entry) => {
      const named = NAMED.exec(entry);
      return named ? { name: named[1]!, key: named[2]! } : { name: DEFAULT_CALLER, key: entry };
    });
}

/** Solo las claves (sin nombres). */
export function parseKeys(raw: string | undefined): string[] {
  return parseKeyEntries(raw).map((e) => e.key);
}

/** Primera clave configurada (la que se envía). Falla cerrado: sin clave no hay llamada. */
export function firstKey(raw: string | undefined, name: string): string {
  const [first] = parseKeys(raw);
  if (!first) throw new Error(`${name} no está definida`);
  return first;
}

/** Comparación en tiempo constante (hasheamos antes: timingSafeEqual exige largos iguales). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * ¿Quién llama? Devuelve el nombre de la entrada cuya clave coincide, o null.
 * Sin claves configuradas => null (falla cerrado). Recorre TODAS las entradas, sin cortocircuito, para no
 * filtrar por tiempo cuál coincidió.
 */
export function identifyCaller(provided: string | undefined, configured: string | undefined): string | null {
  if (!provided) return null;
  let caller: string | null = null;
  for (const entry of parseKeyEntries(configured)) {
    if (safeEqual(provided, entry.key) && caller === null) caller = entry.name;
  }
  return caller;
}

/** ¿La clave recibida coincide con alguna de las configuradas? */
export function matchesAnyKey(provided: string | undefined, configured: string | undefined): boolean {
  return identifyCaller(provided, configured) !== null;
}
