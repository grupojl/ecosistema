import {
  currentTenantScope,
  isUuid,
  runAsSystem,
  runInTenant,
  sessionSettingsFor,
} from '@/prisma/tenant-context';

const ORG_A = '00000000-0000-4000-8000-00000000000a';
const ORG_B = '00000000-0000-4000-8000-00000000000b';

/** Imita a PrismaPromise: no ejecuta nada hasta que alguien llama a `.then`. */
function lazy<T>(work: () => T): PromiseLike<T> {
  return {
    then(onFulfilled, onRejected) {
      return Promise.resolve().then(work).then(onFulfilled, onRejected);
    },
  };
}

describe('tenant-context (ADR-027)', () => {
  it('fuera de un alcance no hay tenant', () => {
    expect(currentTenantScope()).toBeNull();
  });

  describe('runInTenant', () => {
    it('expone la organización a todo lo que corre adentro, también tras un await', async () => {
      const seen = await runInTenant(ORG_A, async () => {
        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 1));
        return currentTenantScope();
      });

      expect(seen).toEqual({ kind: 'tenant', organizationId: ORG_A });
      expect(currentTenantScope()).toBeNull();
    });

    it('dos alcances concurrentes no se mezclan', async () => {
      const [a, b] = await Promise.all([
        runInTenant(ORG_A, async () => { await new Promise((r) => setTimeout(r, 5)); return currentTenantScope(); }),
        runInTenant(ORG_B, async () => currentTenantScope()),
      ]);

      expect(a).toEqual({ kind: 'tenant', organizationId: ORG_A });
      expect(b).toEqual({ kind: 'tenant', organizationId: ORG_B });
    });

    it('un alcance anidado reemplaza al externo y al salir se restaura el anterior', async () => {
      await runInTenant(ORG_A, async () => {
        await runInTenant(ORG_B, async () => {
          expect(currentTenantScope()).toEqual({ kind: 'tenant', organizationId: ORG_B });
        });
        expect(currentTenantScope()).toEqual({ kind: 'tenant', organizationId: ORG_A });
      });
    });

    it('LAS PROMESAS PEREZOSAS (Prisma) SE EJECUTAN ADENTRO: si se devolvieran sin disparar, la consulta correría fuera del alcance', async () => {
      const seen = await runInTenant(ORG_A, () => lazy(() => currentTenantScope()));

      expect(seen).toEqual({ kind: 'tenant', organizationId: ORG_A });
    });

    it('propaga el rechazo de la promesa perezosa', async () => {
      await expect(runInTenant(ORG_A, () => lazy(() => { throw new Error('falló la consulta'); }))).rejects.toThrow('falló la consulta');
    });

    it('un valor sincrónico se devuelve tal cual', () => {
      expect(runInTenant(ORG_A, () => 42)).toBe(42);
    });

    it.each(['', 'no-es-uuid', '1', `${ORG_A}x`, "'; DROP TABLE orders; --"])('rechaza el organizationId inválido %j', (bad) => {
      expect(() => runInTenant(bad, () => 1)).toThrow(/inválido/);
    });
  });

  describe('runAsSystem', () => {
    it('abre un alcance de sistema', async () => {
      expect(await runAsSystem('prueba', async () => currentTenantScope())).toEqual({ kind: 'system', reason: 'prueba' });
    });

    it('exige una razón', () => {
      expect(() => runAsSystem('', () => 1)).toThrow(/razón/);
      expect(() => runAsSystem('   ', () => 1)).toThrow(/razón/);
    });

    it('las promesas perezosas también se ejecutan adentro', async () => {
      expect(await runAsSystem('prueba', () => lazy(() => currentTenantScope()))).toEqual({ kind: 'system', reason: 'prueba' });
    });
  });

  describe('sessionSettingsFor', () => {
    it('sin alcance => todo vacío (default-deny)', () => {
      expect(sessionSettingsFor(null)).toEqual({ organizationId: '', bypass: '' });
    });

    it('tenant => su organización y sin bypass', () => {
      expect(sessionSettingsFor({ kind: 'tenant', organizationId: ORG_A })).toEqual({ organizationId: ORG_A, bypass: '' });
    });

    it('sistema => bypass explícito y sin organización', () => {
      expect(sessionSettingsFor({ kind: 'system', reason: 'x' })).toEqual({ organizationId: '', bypass: 'on' });
    });
  });

  describe('isUuid', () => {
    it('acepta un UUID y rechaza lo demás', () => {
      expect(isUuid(ORG_A)).toBe(true);
      expect(isUuid('org-1')).toBe(false);
      expect(isUuid('')).toBe(false);
    });
  });
});
