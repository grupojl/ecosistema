import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TENANT_MODELS } from './tenant-scope';
import { setSystemContext } from './tenant-context';

const root = resolve(__dirname, '../../prisma');
const schema = readFileSync(resolve(root, 'schema.prisma'), 'utf8');
const enable = readFileSync(resolve(root, 'rls/enable-rls.sql'), 'utf8');
const disable = readFileSync(resolve(root, 'rls/disable-rls.sql'), 'utf8');

/** Nombre de tabla (@@map) de cada modelo con tenant. */
function tableOf(model: string): string {
  const body = new RegExp(`^model ${model} \\{([\\s\\S]*?)^\\}`, 'm').exec(schema)?.[1] ?? '';
  const table = /@@map\("(\w+)"\)/.exec(body)?.[1];
  if (!table) throw new Error(`Sin @@map para ${model}`);
  return table;
}

function tablesIn(sql: string): string[] {
  const list = /ARRAY\[([\s\S]*?)\]/.exec(sql)?.[1] ?? '';
  return [...list.matchAll(/'(\w+)'/g)].map((m) => m[1]!).sort();
}

describe('scripts de RLS (prisma/rls)', () => {
  const expected = TENANT_MODELS.map(tableOf).sort();

  it('enable-rls.sql cubre exactamente las tablas con tenant', () => {
    expect(tablesIn(enable)).toEqual(expected);
  });

  it('disable-rls.sql revierte exactamente las mismas tablas', () => {
    expect(tablesIn(disable)).toEqual(expected);
  });

  it('fuerza RLS (también para el dueño de la tabla) y la política cubre lectura y escritura', () => {
    expect(enable).toContain('FORCE ROW LEVEL SECURITY');
    expect(enable).toMatch(/USING\s+\(organization_id = current_setting\('app\.organization_id', true\)/);
    expect(enable).toMatch(/WITH CHECK\s+\(organization_id = current_setting\('app\.organization_id', true\)/);
  });

  it('falla cerrado: sin app.organization_id no se ve nada (current_setting con missing_ok → NULL)', () => {
    expect(enable).toContain("current_setting('app.organization_id', true)");
    expect(enable).not.toMatch(/COALESCE\(current_setting\('app\.organization_id'/);
  });

  it('avisa del superusuario y del rol de la app (un superusuario ignora RLS)', () => {
    expect(enable).toMatch(/superusuario/);
    expect(enable).toContain('NOBYPASSRLS');
  });

  it('NO está en prisma/migrations: `migrate deploy` no debe activarlo por su cuenta', () => {
    const migrationFiles = readdirSync(resolve(root, 'migrations'), { recursive: true }).map(String);
    expect(migrationFiles.some((f) => f.includes('rls'))).toBe(false);
    const allSql = migrationFiles
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(resolve(root, 'migrations', f), 'utf8'))
      .join('\n');
    expect(allSql).not.toMatch(/ROW LEVEL SECURITY/i);
  });
});

describe('setSystemContext', () => {
  it('fija app.bypass_rls solo para la transacción actual', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]) };
    await setSystemContext(tx as never);
    const sql = (tx.$queryRaw.mock.calls[0]![0] as TemplateStringsArray).join('?');
    expect(sql).toBe("SELECT set_config('app.bypass_rls', 'on', true)");
  });
});
