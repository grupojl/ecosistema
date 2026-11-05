/**
 * api-access.ts — perfiles y claves de API (v2, welver-domain.md §13.3).
 *
 * Dominio puro.
 *  - Clave: se muestra UNA sola vez; en la base solo vive su hash SHA-256 (la clave tiene 256 bits de entropía,
 *    por lo que un hash rápido es suficiente: no hay contraseña que adivinar).
 *  - Perfiles en jerarquía: el del municipio es la base y cada secretaría crea uno propio que HEREDA y RESTRINGE
 *    los entes visibles. Una lista vacía significa «hereda todo lo del padre».
 */
import { createHash, randomBytes } from 'node:crypto';

export const API_KEY_PREFIX = 'wlv_';
const KEY_BYTES = 32;
const DISPLAY_PREFIX_LENGTH = 12;

export interface GeneratedApiKey {
  /** Clave en claro: se devuelve una vez y no se guarda. */
  plain: string;
  /** Primeros caracteres, para reconocerla en listados. */
  prefix: string;
  hash: string;
}

export function hashApiKey(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}

export function generateApiKey(): GeneratedApiKey {
  const plain = `${API_KEY_PREFIX}${randomBytes(KEY_BYTES).toString('base64url')}`;
  return {
    plain,
    prefix: plain.slice(0, DISPLAY_PREFIX_LENGTH),
    hash: hashApiKey(plain),
  };
}

/** Forma válida de una clave (descarta basura antes de ir a la base). */
export function looksLikeApiKey(value: string): boolean {
  return (
    value.startsWith(API_KEY_PREFIX) &&
    /^[A-Za-z0-9_-]{40,80}$/.test(value.slice(API_KEY_PREFIX.length))
  );
}

export interface ProfileNode {
  id: string;
  parentId: string | null;
  /** Vacío = hereda. */
  visibleEntityIds: readonly string[];
  isActive: boolean;
}

export class ProfileScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileScopeError';
  }
}

/**
 * Entes visibles de un perfil: la intersección de su lista con la de cada ancestro. Una lista vacía no restringe.
 * `null` = sin restricción (ve todo el organigrama).
 */
export function effectiveVisibleEntities(
  profileId: string,
  profiles: ReadonlyMap<string, ProfileNode>,
): Set<string> | null {
  const chain: ProfileNode[] = [];
  const seen = new Set<string>();
  let current = profiles.get(profileId);
  while (current && !seen.has(current.id)) {
    chain.push(current);
    seen.add(current.id);
    current = current.parentId ? profiles.get(current.parentId) : undefined;
  }
  // De la raíz hacia el perfil: cada lista no vacía restringe a la anterior.
  const restrictions = chain
    .reverse()
    .filter((n) => n.visibleEntityIds.length > 0);
  const [first, ...rest] = restrictions;
  if (!first) return null;
  return rest.reduce<Set<string>>((acc, node) => {
    const own = new Set(node.visibleEntityIds);
    return new Set([...acc].filter((id) => own.has(id)));
  }, new Set(first.visibleEntityIds));
}

/** El hijo no puede ver más que su padre: valida que su lista sea subconjunto de lo que ve el padre. */
export function assertWithinParent(
  childVisible: readonly string[],
  parentEffective: Set<string> | null,
): void {
  if (parentEffective === null || childVisible.length === 0) return;
  const extra = childVisible.filter((id) => !parentEffective.has(id));
  if (extra.length > 0) {
    throw new ProfileScopeError(
      'El perfil no puede ver entes que su perfil padre no ve',
    );
  }
}

/** ¿`candidateParentId` es el propio perfil o uno de sus descendientes? (evita ciclos al mover un perfil) */
export function profileWouldCycle(
  profileId: string,
  candidateParentId: string | null,
  profiles: readonly { id: string; parentId: string | null }[],
): boolean {
  if (candidateParentId === null) return false;
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const seen = new Set<string>();
  let current: string | null = candidateParentId;
  while (current !== null && !seen.has(current)) {
    if (current === profileId) return true;
    seen.add(current);
    current = byId.get(current)?.parentId ?? null;
  }
  return false;
}
