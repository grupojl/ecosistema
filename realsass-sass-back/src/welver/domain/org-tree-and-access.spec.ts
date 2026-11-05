import {
  ancestorsOf,
  depthOf,
  descendantsOf,
  flattenTree,
  indexById,
  siblingKey,
  subtreeHeight,
  wouldCreateCycle,
  type TreeNode,
} from '@/welver/domain/org-tree';
import { allows, effectiveGrant, entityIdsAllowing, normalizeGrant, type EntityGrant } from '@/welver/domain/entity-access';
import {
  ORG_CHART_TEMPLATES,
  TEMPLATE_KEYS,
  flattenTemplate,
  isTemplateKey,
  suggestedTemplateForTier,
  validateTemplate,
} from '@/welver/domain/org-chart-templates';

//  salud ─ hospital ─ guardia
//        └ vacunacion
//  obras
const nodes: (TreeNode & { name: string })[] = [
  { id: 'salud', parentId: null, name: 'Salud' },
  { id: 'hospital', parentId: 'salud', name: 'Hospital' },
  { id: 'guardia', parentId: 'hospital', name: 'Guardia' },
  { id: 'vacunacion', parentId: 'salud', name: 'Vacunación' },
  { id: 'obras', parentId: null, name: 'Obras' },
];
const byId = indexById(nodes);

describe('org-tree', () => {
  it('ancestros, nivel y descendientes', () => {
    expect(ancestorsOf('guardia', byId)).toEqual(['hospital', 'salud']);
    expect(depthOf('salud', byId)).toBe(1);
    expect(depthOf('guardia', byId)).toBe(3);
    expect(descendantsOf('salud', nodes).sort()).toEqual(['guardia', 'hospital', 'vacunacion']);
    expect(descendantsOf('obras', nodes)).toEqual([]);
  });

  it('detecta ciclos al mover', () => {
    expect(wouldCreateCycle('salud', 'guardia', nodes)).toBe(true); // bajo su propio nieto
    expect(wouldCreateCycle('salud', 'salud', nodes)).toBe(true);
    expect(wouldCreateCycle('hospital', 'obras', nodes)).toBe(false);
    expect(wouldCreateCycle('hospital', null, nodes)).toBe(false);
  });

  it('un árbol dañado con ciclo no cuelga el recorrido', () => {
    const cyclic: TreeNode[] = [
      { id: 'a', parentId: 'b' },
      { id: 'b', parentId: 'a' },
    ];
    expect(ancestorsOf('a', indexById(cyclic))).toEqual(['b']);
    expect(descendantsOf('a', cyclic)).toEqual(['b']);
  });

  it('altura del subárbol', () => {
    expect(subtreeHeight('salud', nodes)).toBe(3);
    expect(subtreeHeight('obras', nodes)).toBe(1);
  });

  it('flattenTree: padres antes que hijos, con nivel y camino', () => {
    const flat = flattenTree(nodes, (n) => n.name, (a, b) => a.name.localeCompare(b.name));
    expect(flat.map((e) => e.node.id)).toEqual(['obras', 'salud', 'hospital', 'guardia', 'vacunacion']);
    const guardia = flat.find((e) => e.node.id === 'guardia');
    expect(guardia?.depth).toBe(3);
    expect(guardia?.path).toBe('Salud › Hospital › Guardia');
  });

  it('flattenTree: un ente cuyo padre no está en el conjunto se muestra como raíz', () => {
    const flat = flattenTree([{ id: 'x', parentId: 'archivado', name: 'X' }], (n) => n.name);
    expect(flat).toHaveLength(1);
    expect(flat[0]?.depth).toBe(1);
  });

  it('siblingKey ignora mayúsculas, tildes y espacios', () => {
    expect(siblingKey('  Vacunación  ')).toBe(siblingKey('vacunacion'));
    expect(siblingKey('Obras   Públicas')).toBe('obras publicas');
  });
});

describe('permisos por ente', () => {
  const grant = (entityId: string, g: Partial<EntityGrant> = {}): [string, EntityGrant] => [
    entityId,
    { entityId, canView: true, canEdit: false, canApprove: false, canPublish: false, ...g },
  ];

  it('quien edita, aprueba o publica también ve', () => {
    expect(normalizeGrant({ entityId: 'x', canView: false, canEdit: true, canApprove: false, canPublish: false }).view).toBe(true);
    expect(normalizeGrant({ entityId: 'x', canView: false, canEdit: false, canApprove: false, canPublish: false }).view).toBe(false);
  });

  it('el permiso de un ente alcanza a sus descendientes', () => {
    const grants = new Map([grant('salud', { canEdit: true })]);
    expect(allows(effectiveGrant('guardia', byId, grants), 'edit')).toBe(true);
    expect(allows(effectiveGrant('obras', byId, grants), 'view')).toBe(false);
  });

  it('el permiso más cercano manda sobre el heredado', () => {
    const grants = new Map([grant('salud', { canEdit: true }), grant('hospital')]); // en hospital solo ve
    expect(allows(effectiveGrant('hospital', byId, grants), 'edit')).toBe(false);
    expect(allows(effectiveGrant('guardia', byId, grants), 'edit')).toBe(false);
    expect(allows(effectiveGrant('vacunacion', byId, grants), 'edit')).toBe(true);
  });

  it('sin permisos no hay acceso a nada', () => {
    expect(entityIdsAllowing('view', byId, new Map()).size).toBe(0);
  });

  it('entityIdsAllowing devuelve el subárbol', () => {
    const grants = new Map([grant('hospital', { canPublish: true })]);
    expect([...entityIdsAllowing('publish', byId, grants)].sort()).toEqual(['guardia', 'hospital']);
  });
});

describe('plantillas de organigrama', () => {
  it.each(TEMPLATE_KEYS)('la plantilla %s es válida (sin hermanos repetidos ni exceso de niveles)', (key) => {
    expect(validateTemplate(ORG_CHART_TEMPLATES[key])).toEqual([]);
  });

  it('flattenTemplate pone padres antes que hijos y asigna orden entre hermanos', () => {
    const flat = flattenTemplate(ORG_CHART_TEMPLATES.medium);
    for (const n of flat) if (n.parentIndex !== null) expect(n.parentIndex).toBeLessThan(n.index);
    const roots = flat.filter((n) => n.parentIndex === null);
    expect(roots.map((r) => r.sortOrder)).toEqual(roots.map((_, i) => i));
  });

  it('la plantilla sugerida sale del tramo', () => {
    expect(suggestedTemplateForTier(1)).toBe('small');
    expect(suggestedTemplateForTier(2)).toBe('medium');
    expect(suggestedTemplateForTier(3)).toBe('large');
    expect(suggestedTemplateForTier(4)).toBe('large');
    expect(isTemplateKey('large')).toBe(true);
    expect(isTemplateKey('enorme')).toBe(false);
  });

  it('validateTemplate detecta hermanos repetidos', () => {
    const bad = { key: 'small' as const, label: 'x', description: 'x', nodes: [{ name: 'Salud' }, { name: 'salud ' }] };
    expect(validateTemplate(bad)).toHaveLength(1);
  });
});
