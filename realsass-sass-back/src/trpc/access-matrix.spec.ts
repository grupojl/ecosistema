/**
 * access-matrix.spec.ts — contrato de AUTORIZACIÓN de todo el appRouter (tRPC).
 *
 * Para CADA procedure se prueba, sin tocar base ni servicios reales, qué responde a cuatro llamantes:
 *   anon      sin sesión
 *   uidOnly   con sesión pero sin organización activa
 *   collab    COLABORADOR de una organización
 *   owner     DUEÑO de una organización
 * Se llama con input `undefined`: la autorización corre ANTES de validar el input, así que BAD_REQUEST significa
 * "pasó la autorización y falló el input", FORBIDDEN/UNAUTHORIZED significa "rechazado" y OK "ejecutó".
 *
 * Es un contrato congelado: si cambia la protección de un procedure, o se agrega uno sin clasificar, este test falla
 * y obliga a decidir a propósito. Un cambio de este archivo es un cambio de seguridad: revisarlo como tal.
 *
 * Nota: collaborators.invite/update/remove pasan la autorización de sesión a propósito; la propiedad de la organización
 * se exige dentro del servicio (getOrgForOwner), que tiene sus propios tests.
 */
import { TRPCError } from '@trpc/server';
import { createAppRouter } from './app-router';

const service = () => new Proxy({}, { get: () => jest.fn().mockResolvedValue(undefined) });
const deps = new Proxy({}, { get: () => service() }) as never;
const appRouter = createAppRouter(deps);

/** Busca "router.procedure" en el caller sin tipar a ciegas: cada paso se comprueba. */
function procedureOf(caller: object, path: string): (input: undefined) => Promise<unknown> {
  let node: unknown = caller;
  for (const key of path.split('.')) {
    if ((typeof node !== 'object' && typeof node !== 'function') || node === null) throw new Error(`ruta inválida: ${path}`);
    node = Reflect.get(node, key);
  }
  if (typeof node !== 'function') throw new Error(`no es un procedure: ${path}`);
  const fn = node;
  return (input) => Reflect.apply(fn, undefined, [input]);
}

const codeOf = (e: unknown): string => (e instanceof TRPCError ? e.code : 'UNKNOWN');

const req = { headers: {}, cookies: {} };
const CALLERS = {
  anon: { req, uid: null, organizationId: null, role: null },
  uidOnly: { req, uid: 'u', organizationId: null, role: null },
  collab: { req, uid: 'u', organizationId: 'o', role: 'COLLABORATOR' },
  owner: { req, uid: 'u', organizationId: 'o', role: 'OWNER' },
} as const;

const U = 'UNAUTHORIZED';
const B = 'BAD_REQUEST';
const F = 'FORBIDDEN';
const O = 'OK';
/** anon uidOnly collab owner */
const CONTRACT: Record<string, [string, string, string, string]> = {
  'affiliates.me': [U, O, O, O],
  'affiliates.myReferrals': [U, O, O, O],
  'auth.createDashboardSso': [U, O, O, O],
  'auth.issueDesktopLoginCode': [U, B, B, B],
  'auth.me': [U, O, O, O],
  'auth.ping': [U, O, O, O],
  'auth.redeemDesktopLogin': [B, B, B, B], // público: se canjea con un código de un solo uso
  'auth.refreshClaims': [U, O, O, O],
  'auth.selectRole': [U, B, B, B],
  'auth.sync': [U, B, B, B],
  'collaborators.acceptInvitation': [U, B, B, B],
  'collaborators.getInvitationInfo': [B, B, B, B], // público: el invitado aún no tiene cuenta
  'collaborators.invite': [U, B, B, B],
  'collaborators.list': [U, O, O, O],
  'collaborators.remove': [U, B, B, B],
  'collaborators.update': [U, B, B, B],
  'configAudit.list': [U, B, F, B],
  'configFlags.list': [U, B, O, O],
  'configFlags.update': [U, B, B, B],
  'configQuotas.list': [U, B, F, O],
  'configQuotas.updateLimit': [U, B, F, B],
  'configSecrets.create': [U, B, F, B],
  'configSecrets.list': [U, B, F, O],
  'configSecrets.revoke': [U, B, F, B],
  'configSecrets.rotate': [U, B, F, B],
  'configTemplates.create': [U, B, F, B],
  'configTemplates.list': [U, B, O, O],
  'configTemplates.render': [U, B, B, B],
  'configTemplates.resolve': [U, B, B, B],
  'configThemes.activate': [U, B, B, B],
  'configThemes.create': [U, B, F, B],
  'configThemes.getPublicTheme': [B, B, B, B], // público: lo consume el storefront
  'configThemes.list': [U, B, O, O],
  'configThemes.remove': [U, B, F, B],
  'configWebhooks.create': [U, B, F, B],
  'configWebhooks.getLogs': [U, B, F, B],
  'configWebhooks.list': [U, B, F, O],
  'configWebhooks.remove': [U, B, F, B],
  'configWebhooks.rotateSecret': [U, B, F, B],
  'configWebhooks.test': [U, B, F, B],
  'desktop.policy': [O, O, O, O], // público: la app de escritorio lo pide antes de iniciar sesión
  'desktop.telemetry': [B, B, B, B], // público, con consentimiento y límite por IP
  'feedback.create': [U, B, B, B],
  'feedback.getById': [U, B, B, B],
  'feedback.listMine': [U, B, O, O],
  'markets.create': [U, B, F, B],
  'markets.delete': [U, B, F, B],
  'markets.list': [U, B, O, O],
  'markets.setDefault': [U, B, F, B],
  'markets.update': [U, B, F, B],
  'organizations.create': [U, B, B, B],
  'organizations.list': [U, O, O, O],
  'organizations.me': [U, O, O, O],
  'organizations.update': [U, B, B, B],
  'sessions.list': [U, O, O, O],
  'sessions.revoke': [U, B, B, B],
  'sessions.revokeOthers': [U, O, O, O],
  'whatsapp.connect': [U, B, F, B],
  'whatsapp.disconnect': [U, B, F, B],
  'whatsapp.status': [U, B, F, O],
};

// markets.resolve queda fuera: lo protege la clave interna (INTERNAL_API_KEY), no la sesión. Se prueba aparte abajo.
const EXCLUDED = new Set(['markets.resolve']);

async function probe(path: string, ctx: (typeof CALLERS)[keyof typeof CALLERS]): Promise<string> {
  const fn = procedureOf(appRouter.createCaller(ctx), path);
  try {
    await fn(undefined);
    return 'OK';
  } catch (e) {
    return codeOf(e);
  }
}

describe('matriz de acceso del appRouter', () => {
  const paths = Object.keys(appRouter._def.procedures)
    .filter((p) => !EXCLUDED.has(p))
    .sort();

  it('todo procedure está clasificado en el contrato (y no sobran entradas)', () => {
    expect(paths).toEqual(Object.keys(CONTRACT).sort());
  });

  it.each(paths)('%s', async (path) => {
    const got = await Promise.all(Object.values(CALLERS).map((c) => probe(path, c)));
    expect(got).toEqual(CONTRACT[path]);
  });

  it('invariante: ningún procedure ejecuta (OK) sin sesión, salvo los públicos declarados', async () => {
    const PUBLIC_OK = new Set(['desktop.policy']);
    for (const path of paths) {
      if ((await probe(path, CALLERS.anon)) === 'OK') expect(PUBLIC_OK.has(path)).toBe(true);
    }
  });

  it('invariante: ningún procedure de configuración permite a un colaborador pasar a un procedure de secretos, webhooks, WhatsApp o Markets', async () => {
    const sensitive = paths.filter((p) => /^(configSecrets|configWebhooks|whatsapp|configAudit|configQuotas)\./.test(p) || /^markets\.(create|update|delete|setDefault)$/.test(p));
    expect(sensitive.length).toBeGreaterThan(10);
    for (const path of sensitive) expect(await probe(path, CALLERS.collab)).toBe('FORBIDDEN');
  });

  it('markets.resolve (clave interna): sin la clave correcta nunca ejecuta', async () => {
    process.env['INTERNAL_API_KEY'] = 'clave-interna';
    for (const ctx of Object.values(CALLERS)) {
      expect(await probe('markets.resolve', ctx)).not.toBe('OK');
    }
    delete process.env['INTERNAL_API_KEY'];
  });
});
