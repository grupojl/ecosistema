/**
 * cross-tenant.spec.ts — el aislamiento entre organizaciones NO es opcional en ningún repositorio.
 *
 * Los casos de aislamiento (org A no lee, modifica ni revoca lo de org B aunque conozca el id) viven en
 * `repositories.integration.spec.ts` (Postgres real, ≥2 organizaciones) y la autorización por llamante en
 * `trpc/access-matrix.spec.ts`. Este spec evita que se rompa la cobertura sin darse cuenta: cada repositorio Prisma
 * tiene que estar ejercitado en la suite de integración, y esa suite tiene que declarar el invariante cross-tenant.
 * Si agregás un repositorio y este test falla, agregale su caso de aislamiento a la suite de integración.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');
const integration = readFileSync(join(__dirname, 'repositories.integration.spec.ts'), 'utf8');

const repositories = readdirSync(SRC, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((d) => {
    const dir = join(SRC, d.name, 'repository');
    try {
      return readdirSync(dir)
        .filter((f) => /^prisma-.*\.repository\.ts$/.test(f))
        .map((f) => ({ file: `${d.name}/repository/${f}`, cls: /export class (\w+)/.exec(readFileSync(join(dir, f), 'utf8'))?.[1] }));
    } catch {
      return [];
    }
  });

describe('cross-tenant — cobertura de aislamiento', () => {
  it('hay repositorios que cubrir', () => {
    expect(repositories.length).toBeGreaterThanOrEqual(12);
  });

  it.each(repositories)('$file está ejercitado en la suite de integración con 2 organizaciones', ({ cls }) => {
    expect(cls).toBeDefined();
    expect(integration).toContain(`new ${cls}(`);
  });

  it('la suite de integración declara el invariante y usa dos organizaciones distintas', () => {
    expect(integration).toMatch(/una organización nunca lee, modifica ni revoca/);
    expect(integration).toMatch(/orgA/);
    expect(integration).toMatch(/orgB/);
  });
});
