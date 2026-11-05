import {
  KnowledgeWorkflowError,
  isServed,
  requiredPermission,
  transition,
  type KnowledgeAction,
  type KnowledgeStatus,
} from '@/welver/domain/knowledge-workflow';
import { MAX_IMPORT_ROWS, CsvError, parseCsv, parseKnowledgeCsv } from '@/welver/domain/csv';
import {
  MandateSnapshotSchema,
  buildSnapshot,
  orderParentsFirst,
  planRestore,
  summarizeSnapshot,
  type EntityRow,
  type PublishedVersionRow,
} from '@/welver/domain/mandate-snapshot';

const direct = { requiresApproval: false };
const reviewed = { requiresApproval: true };

describe('flujo de publicación', () => {
  it('sin aprobación: DRAFT → PUBLISHED directo, y no se envía a revisión', () => {
    expect(transition('DRAFT', 'publish', direct)).toBe('PUBLISHED');
    expect(() => transition('DRAFT', 'submit', direct)).toThrow(KnowledgeWorkflowError);
  });

  it('con aprobación: DRAFT → IN_REVIEW → PUBLISHED, y no se publica sin revisar', () => {
    expect(transition('DRAFT', 'submit', reviewed)).toBe('IN_REVIEW');
    expect(transition('IN_REVIEW', 'publish', reviewed)).toBe('PUBLISHED');
    expect(() => transition('DRAFT', 'publish', reviewed)).toThrow('revisión');
  });

  it('rechazar devuelve a DRAFT; solo desde IN_REVIEW', () => {
    expect(transition('IN_REVIEW', 'reject', reviewed)).toBe('DRAFT');
    expect(() => transition('DRAFT', 'reject', reviewed)).toThrow(KnowledgeWorkflowError);
  });

  it('editar un dato publicado lo vuelve a DRAFT; un archivado no se edita', () => {
    expect(transition('PUBLISHED', 'edit', direct)).toBe('DRAFT');
    expect(transition('IN_REVIEW', 'edit', reviewed)).toBe('DRAFT');
    expect(() => transition('ARCHIVED', 'edit', direct)).toThrow('archivado');
  });

  it('archivar y restaurar', () => {
    expect(transition('PUBLISHED', 'archive', direct)).toBe('ARCHIVED');
    expect(() => transition('ARCHIVED', 'archive', direct)).toThrow(KnowledgeWorkflowError);
    expect(transition('ARCHIVED', 'unarchive', direct)).toBe('DRAFT');
    expect(() => transition('DRAFT', 'unarchive', direct)).toThrow(KnowledgeWorkflowError);
  });

  it('no queda ninguna transición silenciosa: todas las combinaciones o devuelven un estado o lanzan el error tipado', () => {
    const statuses: KnowledgeStatus[] = ['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED'];
    const actions: KnowledgeAction[] = ['edit', 'submit', 'reject', 'publish', 'archive', 'unarchive'];
    for (const s of statuses) {
      for (const a of actions) {
        for (const ctx of [direct, reviewed]) {
          try {
            expect(statuses).toContain(transition(s, a, ctx));
          } catch (e) {
            expect(e).toBeInstanceOf(KnowledgeWorkflowError);
          }
        }
      }
    }
  });

  it('permisos: publicar exige «publicar» sin aprobación y «aprobar» con aprobación', () => {
    expect(requiredPermission('publish', direct)).toBe('publish');
    expect(requiredPermission('publish', reviewed)).toBe('approve');
    expect(requiredPermission('reject', reviewed)).toBe('approve');
    expect(requiredPermission('edit', direct)).toBe('edit');
    expect(requiredPermission('submit', reviewed)).toBe('edit');
  });

  it('la IA solo usa datos con al menos una versión publicada y no archivados', () => {
    expect(isServed('DRAFT', 0)).toBe(false); // nunca publicado
    expect(isServed('DRAFT', 2)).toBe(true); // edición en curso: sigue sirviendo la última publicada
    expect(isServed('ARCHIVED', 2)).toBe(false);
  });
});

describe('CSV', () => {
  it('parsea comillas, comas y saltos de línea dentro de un campo, y CRLF', () => {
    const rows = parseCsv('a,b\r\n"x, y","línea 1\nlínea 2"\r\n"dice ""hola""",z\r\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['x, y', 'línea 1\nlínea 2'],
      ['dice "hola"', 'z'],
    ]);
  });

  it('detecta el punto y coma de Excel y quita el BOM', () => {
    expect(parseCsv('\uFEFFente;titulo;contenido\nSalud;Horarios;Lunes a viernes')).toEqual([
      ['ente', 'titulo', 'contenido'],
      ['Salud', 'Horarios', 'Lunes a viernes'],
    ]);
  });

  it('comillas sin cerrar es un error, no datos truncados', () => {
    expect(() => parseCsv('a,b\n"abierta,x')).toThrow(CsvError);
  });

  it('parseKnowledgeCsv reconoce encabezados con tildes y distinto orden', () => {
    const r = parseKnowledgeCsv('Contenido,Título,Área\nLunes a viernes,Horarios,Salud');
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([{ line: 2, entity: 'Salud', title: 'Horarios', content: 'Lunes a viernes' }]);
  });

  it('informa por línea lo que falta, sin cortar las filas buenas', () => {
    const r = parseKnowledgeCsv('ente,titulo,contenido\nSalud,Horarios,ok\n,Sin ente,x\nObras,,x\nObras,Sin texto,');
    expect(r.rows).toHaveLength(1);
    expect(r.errors.map((e) => [e.line, e.message])).toEqual([
      [3, 'Falta el ente'],
      [4, 'Falta el título'],
      [5, 'Falta el contenido'],
    ]);
  });

  it('exige las tres columnas y avisa cuáles faltan', () => {
    expect(parseKnowledgeCsv('ente,titulo\nSalud,x').errors[0]?.message).toContain('contenido');
    expect(parseKnowledgeCsv('').errors[0]?.message).toContain('vacío');
  });

  it('limita las filas por archivo', () => {
    const body = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `Salud,T${i},x`).join('\n');
    const r = parseKnowledgeCsv(`ente,titulo,contenido\n${body}`);
    expect(r.rows).toEqual([]);
    expect(r.errors[0]?.message).toContain(String(MAX_IMPORT_ROWS));
  });
});

describe('mandatos (snapshot y restauración)', () => {
  const now = new Date('2026-11-05T10:00:00Z');
  const entity = (id: string, parentId: string | null, archivedAt: Date | null = null): EntityRow => ({
    id,
    parentId,
    name: id,
    description: null,
    sortOrder: 0,
    requiresApproval: false,
    archivedAt,
  });
  const version = (itemId: string, entityId: string, v: number, content = `c${v}`): PublishedVersionRow => ({
    itemId,
    entityId,
    version: v,
    title: itemId,
    kind: 'TEXT',
    content,
    fileName: null,
    fileUrl: null,
  });

  const snapshot = buildSnapshot(
    {
      entities: [entity('salud', null), entity('hospital', 'salud'), entity('viejo', null, now)],
      links: [{ fromEntityId: 'salud', toEntityId: 'viejo', label: 'programa' }],
      versions: [version('i1', 'salud', 1), version('i1', 'salud', 3, 'última'), version('i1', 'salud', 2), version('i2', 'hospital', 1)],
    },
    now,
  );

  it('el snapshot es válido según su esquema y conserva solo la última versión publicada de cada dato', () => {
    expect(MandateSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    const i1 = snapshot.knowledge.find((k) => k.itemId === 'i1');
    expect(i1?.version).toBe(3);
    expect(i1?.content).toBe('última');
    expect(snapshot.knowledge).toHaveLength(2);
    expect(snapshot.entities.find((e) => e.id === 'viejo')?.archived).toBe(true);
  });

  it('el esquema rechaza un documento de otra versión o dañado', () => {
    expect(MandateSnapshotSchema.safeParse({ ...snapshot, schemaVersion: 2 }).success).toBe(false);
    expect(MandateSnapshotSchema.safeParse({ nada: true }).success).toBe(false);
  });

  it('orderParentsFirst nunca pone un hijo antes que su padre y no pierde entes', () => {
    const shuffled = [entity('c', 'b'), entity('b', 'a'), entity('a', null)];
    const ordered = orderParentsFirst(shuffled).map((e) => e.id);
    expect(ordered).toEqual(['a', 'b', 'c']);
    expect(orderParentsFirst([entity('x', 'ausente')])).toHaveLength(1);
    expect(orderParentsFirst([entity('p', 'q'), entity('q', 'p')])).toHaveLength(2); // ciclo dañado
  });

  it('planRestore: archiva lo que no está en el snapshot y restaura lo que sí', () => {
    const plan = planRestore(snapshot, {
      entityIds: ['salud', 'hospital', 'nuevo'],
      knowledgeItemIds: ['i1', 'i-nuevo'],
    });
    expect(plan.entitiesToUpsert.map((e) => e.id)).toEqual(['salud', 'hospital', 'viejo']);
    expect(plan.entitiesToArchive).toEqual(['nuevo']);
    expect(plan.knowledgeToRestore.map((k) => k.itemId).sort()).toEqual(['i1', 'i2']);
    expect(plan.knowledgeToArchive).toEqual(['i-nuevo']);
  });

  it('planRestore: no restaura vínculos ni datos que apunten a un ente fuera del snapshot', () => {
    const broken = { ...snapshot, links: [...snapshot.links, { fromEntityId: 'salud', toEntityId: 'fantasma', label: null }], knowledge: [...snapshot.knowledge, { ...snapshot.knowledge[0]!, itemId: 'i3', entityId: 'fantasma' }] };
    const plan = planRestore(broken, { entityIds: [], knowledgeItemIds: [] });
    expect(plan.linksToCreate).toHaveLength(1);
    expect(plan.knowledgeToRestore.map((k) => k.itemId)).not.toContain('i3');
  });

  it('summarizeSnapshot no cuenta los entes archivados', () => {
    expect(summarizeSnapshot(snapshot)).toEqual({ entities: 2, links: 1, knowledge: 2, takenAt: now.toISOString() });
  });
});
