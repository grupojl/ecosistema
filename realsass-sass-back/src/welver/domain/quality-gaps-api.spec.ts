import {
  MIN_COVERAGE,
  QUALITY_PASS_RATE,
  RunItemsSchema,
  evaluateRun,
  itemPassed,
  readiness,
  type RunItem,
  type RunSummary,
} from '@/welver/domain/quality-gates';
import { isRecordableQuestion, normalizeQuestion, weeklyWindowStart } from '@/welver/domain/gap-normalize';
import {
  ProfileScopeError,
  assertWithinParent,
  effectiveVisibleEntities,
  generateApiKey,
  hashApiKey,
  looksLikeApiKey,
  profileWouldCycle,
  type ProfileNode,
} from '@/welver/domain/api-access';

const item = (over: Partial<RunItem> = {}): RunItem => ({ questionId: 'q', covered: true, correct: true, cited: true, ...over });
const many = (n: number, over: Partial<RunItem> = {}): RunItem[] => Array.from({ length: n }, (_, i) => item({ questionId: `q${i}`, ...over }));

describe('metas de calidad y seguridad', () => {
  it('calidad: una respuesta correcta SIN fuente no cuenta', () => {
    expect(itemPassed('QUALITY', item({ cited: false }))).toBe(false);
    expect(itemPassed('SECURITY', item({ cited: false }))).toBe(true); // en seguridad no se exige cita
  });

  it('calidad: 95% es el piso (19 de 20 pasa, 18 de 20 no)', () => {
    const ok = [...many(19), ...many(1, { correct: false })];
    const bad = [...many(18), ...many(2, { correct: false })];
    expect(evaluateRun('QUALITY', ok).meetsGoal).toBe(true);
    expect(evaluateRun('QUALITY', bad).meetsGoal).toBe(false);
    expect(QUALITY_PASS_RATE).toBe(0.95);
  });

  it('seguridad: exige 100%; un solo fallo reprueba', () => {
    expect(evaluateRun('SECURITY', many(10)).meetsGoal).toBe(true);
    expect(evaluateRun('SECURITY', [...many(9), ...many(1, { correct: false })]).meetsGoal).toBe(false);
  });

  it('cobertura: cuenta las preguntas con respuesta cargada', () => {
    const r = evaluateRun('QUALITY', [...many(7), ...many(3, { covered: false })]);
    expect(r.coverage).toBeCloseTo(0.7);
    expect(r.covered).toBe(7);
  });

  it('una corrida vacía nunca cumple la meta', () => {
    expect(evaluateRun('QUALITY', []).meetsGoal).toBe(false);
  });

  it('el esquema de resultados rechaza listas vacías y valida cada ítem', () => {
    expect(RunItemsSchema.safeParse([]).success).toBe(false);
    expect(RunItemsSchema.safeParse([{ questionId: 'a', covered: true }]).success).toBe(false); // falta correct
    expect(RunItemsSchema.parse([{ questionId: 'a', covered: true, correct: true }])[0]?.cited).toBe(false);
  });

  describe('readiness (¿se puede publicar el asistente?)', () => {
    const at = (iso: string) => new Date(iso);
    const run = (total: number, passed: number, covered: number, createdAt = at('2026-11-05T10:00:00Z')): RunSummary => ({ total, passed, covered, createdAt });

    it('sin corridas no se publica', () => {
      const r = readiness(null, null, null);
      expect(r.canPublish).toBe(false);
      expect(r.blockers).toHaveLength(2);
    });

    it('todo en regla: calidad ≥95%, cobertura ≥70% y seguridad 100%', () => {
      const r = readiness(run(20, 19, 15), run(10, 10, 10), null);
      expect(r.canPublish).toBe(true);
      expect(r.blockers).toEqual([]);
      expect(MIN_COVERAGE).toBe(0.7);
    });

    it('cobertura baja bloquea aunque la calidad sea perfecta', () => {
      const r = readiness(run(20, 20, 13), run(10, 10, 10), null);
      expect(r.canPublish).toBe(false);
      expect(r.blockers.join(' ')).toContain('Cobertura');
    });

    it('seguridad al 90% bloquea', () => {
      const r = readiness(run(20, 20, 20), run(10, 9, 10), null);
      expect(r.canPublish).toBe(false);
      expect(r.blockers.join(' ')).toContain('Seguridad');
    });

    it('una corrida anterior al último cambio de la base ya no vale', () => {
      const r = readiness(run(20, 20, 20), run(10, 10, 10), at('2026-11-06T00:00:00Z'));
      expect(r.canPublish).toBe(false);
      expect(r.blockers).toHaveLength(2);
    });
  });
});

describe('huecos de información', () => {
  it('normaliza mayúsculas, tildes, signos y espacios para agrupar la misma pregunta', () => {
    const a = normalizeQuestion('¿Dónde saco el PERMISO de obra?');
    const b = normalizeQuestion('  donde  saco el permiso de obra ');
    expect(a).toBe('donde saco el permiso de obra');
    expect(b).toBe(a);
  });

  it('no es un hueco lo que es demasiado corto', () => {
    expect(isRecordableQuestion(normalizeQuestion('hola?'))).toBe(true);
    expect(isRecordableQuestion(normalizeQuestion('¿?'))).toBe(false);
    expect(isRecordableQuestion(normalizeQuestion('ok'))).toBe(false);
  });

  it('acota el largo guardado', () => {
    expect(normalizeQuestion('a'.repeat(1000))).toHaveLength(300);
  });

  it('la ventana semanal son 7 días', () => {
    const now = new Date('2026-11-12T00:00:00Z');
    expect(weeklyWindowStart(now).toISOString()).toBe('2026-11-05T00:00:00.000Z');
  });
});

describe('claves y perfiles de API (v2)', () => {
  it('genera claves únicas con prefijo y hash; el hash no revela la clave', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.plain).not.toBe(b.plain);
    expect(a.plain.startsWith('wlv_')).toBe(true);
    expect(a.prefix).toBe(a.plain.slice(0, 12));
    expect(a.hash).toBe(hashApiKey(a.plain));
    expect(a.hash).not.toContain(a.plain);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(looksLikeApiKey(a.plain)).toBe(true);
  });

  it('descarta basura antes de ir a la base', () => {
    expect(looksLikeApiKey('')).toBe(false);
    expect(looksLikeApiKey('wlv_corta')).toBe(false);
    expect(looksLikeApiKey(`sk_${'a'.repeat(50)}`)).toBe(false);
    expect(looksLikeApiKey(`wlv_${'a b'.repeat(20)}`)).toBe(false);
  });

  const p = (id: string, parentId: string | null, visible: string[] = []): [string, ProfileNode] => [
    id,
    { id, parentId, visibleEntityIds: visible, isActive: true },
  ];

  it('el perfil raíz sin lista ve todo; la lista vacía hereda', () => {
    const profiles = new Map([p('raiz', null), p('salud', 'raiz'), p('guardia', 'salud')]);
    expect(effectiveVisibleEntities('guardia', profiles)).toBeNull();
  });

  it('cada nivel restringe: intersección con los ancestros', () => {
    const profiles = new Map([p('raiz', null, ['a', 'b', 'c']), p('salud', 'raiz', ['b', 'c', 'x']), p('hijo', 'salud')]);
    expect([...(effectiveVisibleEntities('salud', profiles) ?? [])].sort()).toEqual(['b', 'c']);
    expect([...(effectiveVisibleEntities('hijo', profiles) ?? [])].sort()).toEqual(['b', 'c']); // vacío = hereda
  });

  it('un hijo no puede ver más que su padre', () => {
    expect(() => assertWithinParent(['a', 'z'], new Set(['a', 'b']))).toThrow(ProfileScopeError);
    expect(() => assertWithinParent(['a'], new Set(['a', 'b']))).not.toThrow();
    expect(() => assertWithinParent(['a'], null)).not.toThrow();
    expect(() => assertWithinParent([], new Set(['a']))).not.toThrow();
  });

  it('detecta ciclos de perfiles', () => {
    const list = [
      { id: 'a', parentId: null },
      { id: 'b', parentId: 'a' },
      { id: 'c', parentId: 'b' },
    ];
    expect(profileWouldCycle('a', 'c', list)).toBe(true);
    expect(profileWouldCycle('a', 'a', list)).toBe(true);
    expect(profileWouldCycle('c', 'a', list)).toBe(false);
    expect(profileWouldCycle('b', null, list)).toBe(false);
  });
});
