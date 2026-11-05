/**
 * org-tree.ts — operaciones sobre el organigrama (árbol con un solo padre por ente). welver-domain.md §13.2.
 *
 * Dominio puro. Reglas: un solo padre, sin ciclos, sin límite duro de profundidad (se sugiere hasta 5 niveles).
 */
export const SUGGESTED_MAX_DEPTH = 5;

export interface TreeNode {
  id: string;
  parentId: string | null;
}

export function indexById<T extends TreeNode>(
  nodes: readonly T[],
): Map<string, T> {
  return new Map(nodes.map((n) => [n.id, n]));
}

export function childrenMap<T extends TreeNode>(
  nodes: readonly T[],
): Map<string | null, T[]> {
  const map = new Map<string | null, T[]>();
  for (const n of nodes) {
    const list = map.get(n.parentId);
    if (list) list.push(n);
    else map.set(n.parentId, [n]);
  }
  return map;
}

/** Ancestros de `id`, del padre inmediato hacia la raíz. Corta si detecta un ciclo (datos dañados). */
export function ancestorsOf(
  id: string,
  byId: ReadonlyMap<string, TreeNode>,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>([id]);
  let current = byId.get(id)?.parentId ?? null;
  while (current !== null && !seen.has(current)) {
    result.push(current);
    seen.add(current);
    current = byId.get(current)?.parentId ?? null;
  }
  return result;
}

/** Nivel del nodo: 1 = raíz. */
export function depthOf(
  id: string,
  byId: ReadonlyMap<string, TreeNode>,
): number {
  return ancestorsOf(id, byId).length + 1;
}

/** Todos los descendientes de `id` (sin incluirlo), en orden de anchura. */
export function descendantsOf(
  id: string,
  nodes: readonly TreeNode[],
): string[] {
  const kids = childrenMap(nodes);
  const result: string[] = [];
  const seen = new Set<string>([id]);
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const child of kids.get(current) ?? []) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      result.push(child.id);
      queue.push(child.id);
    }
  }
  return result;
}

/** ¿Mover `id` bajo `newParentId` crearía un ciclo? (un ente no puede ser hijo de sí mismo ni de sus descendientes) */
export function wouldCreateCycle(
  id: string,
  newParentId: string | null,
  nodes: readonly TreeNode[],
): boolean {
  if (newParentId === null) return false;
  if (newParentId === id) return true;
  return descendantsOf(id, nodes).includes(newParentId);
}

/** Altura del subárbol de `id` (1 = solo el nodo). Sirve para avisar si mover un ente supera la profundidad sugerida. */
export function subtreeHeight(id: string, nodes: readonly TreeNode[]): number {
  const kids = childrenMap(nodes);
  const walk = (current: string, seen: Set<string>): number => {
    let max = 0;
    for (const child of kids.get(current) ?? []) {
      if (seen.has(child.id)) continue;
      max = Math.max(max, walk(child.id, new Set(seen).add(child.id)));
    }
    return max + 1;
  };
  return walk(id, new Set([id]));
}

export interface TreeEntry<T extends TreeNode> {
  node: T;
  depth: number;
  /** Camino de nombres desde la raíz, p. ej. «Salud › Hospital». */
  path: string;
}

/** Recorrido en profundidad (padres antes que hijos) con nivel y camino; `label` da el nombre de cada nodo. */
export function flattenTree<T extends TreeNode>(
  nodes: readonly T[],
  label: (node: T) => string,
  order: (a: T, b: T) => number = () => 0,
): TreeEntry<T>[] {
  const kids = childrenMap(nodes);
  const ids = new Set(nodes.map((n) => n.id));
  const result: TreeEntry<T>[] = [];
  const seen = new Set<string>();
  const visit = (node: T, depth: number, parentPath: string): void => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    const path = parentPath ? `${parentPath} › ${label(node)}` : label(node);
    result.push({ node, depth, path });
    for (const child of [...(kids.get(node.id) ?? [])].sort(order))
      visit(child, depth + 1, path);
  };
  // Raíces reales y huérfanos (padre fuera del conjunto, p. ej. padre archivado y filtrado): se tratan como raíz.
  const roots = nodes
    .filter((n) => n.parentId === null || !ids.has(n.parentId))
    .sort(order);
  for (const root of roots) visit(root, 1, '');
  return result;
}

/** Nombre normalizado para comparar hermanos: sin mayúsculas, tildes ni espacios sobrantes. */
export function siblingKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
