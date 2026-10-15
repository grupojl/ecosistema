/**
 * authorization.spec.ts — barrera de autorización de TODOS los routers de config, con los routers REALES.
 *
 * Cubre lo que decía el checklist de seguridad: "colaborador sin permiso recibe 403", "sin sesión 401" y
 * "la organización sale del contexto, no del input". Los services son dobles que EXPLOTAN si se los toca:
 * si una barrera falla, el test lo ve porque el service fue alcanzado.
 */
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { router } from '@/trpc';
import type { TrpcContext } from '@/trpc/trpc';
import { createConfigFlagsRouter } from '@/trpc/routers/config-flags.router';
import { createConfigThemesRouter } from '@/trpc/routers/config-themes.router';
import { createConfigWebhooksRouter } from '@/trpc/routers/config-webhooks.router';
import { createConfigSecretsRouter } from '@/trpc/routers/config-secrets.router';
import { createConfigQuotasRouter } from '@/trpc/routers/config-quotas.router';
import { createConfigTemplatesRouter } from '@/trpc/routers/config-templates.router';
import { createConfigAuditRouter } from '@/trpc/routers/config-audit.router';
import { createCollaboratorsRouter } from '@/trpc/routers/collaborators.router';
import { createOrganizationsRouter } from '@/trpc/routers/organizations.router';
import type { ConfigFlagsService } from '@/config-flags/config-flags.service';
import type { ConfigThemesService } from '@/config-themes/config-themes.service';
import type { ConfigWebhooksService } from '@/config-webhooks/config-webhooks.service';
import type { ConfigSecretsService } from '@/config-secrets/config-secrets.service';
import type { ConfigQuotasService } from '@/config-quotas/config-quotas.service';
import type { ConfigTemplatesService } from '@/config-templates/config-templates.service';
import type { ConfigAuditService } from '@/config-audit/config-audit.service';
import type { CollaboratorsService } from '@/collaborators/collaborators.service';
import type { OrganizationsService } from '@/organizations/organizations.service';

// ADR-027: runInTenant exige un UUID (la organización abre el alcance de Row Level Security).
const ORG_1 = '00000000-0000-4000-8000-000000000001';

/** Service que falla si se lo toca: prueba que la barrera frenó la llamada ANTES de la lógica de negocio. */
const untouchable = <T>(name: string): T =>
  new Proxy({}, { get: (_t, prop) => { throw new Error(`${name}.${String(prop)} fue alcanzado: la barrera no frenó la llamada`); } }) as T;

const live = {
  flags:  { list: jest.fn(), update: jest.fn() },
  quotas: { getForOrg: jest.fn() },
};

const appRouter = router({
  configFlags:     createConfigFlagsRouter(live.flags as unknown as ConfigFlagsService),
  configThemes:    createConfigThemesRouter(untouchable<ConfigThemesService>('themes'), untouchable<OrganizationsService>('orgs-themes')),
  configWebhooks:  createConfigWebhooksRouter(untouchable<ConfigWebhooksService>('webhooks')),
  configSecrets:   createConfigSecretsRouter(untouchable<ConfigSecretsService>('secrets')),
  configQuotas:    createConfigQuotasRouter(live.quotas as unknown as ConfigQuotasService),
  configTemplates: createConfigTemplatesRouter(untouchable<ConfigTemplatesService>('templates')),
  configAudit:     createConfigAuditRouter(untouchable<ConfigAuditService>('audit')),
  collaborators:   createCollaboratorsRouter(untouchable<CollaboratorsService>('collaborators')),
  organizations:   createOrganizationsRouter(untouchable<OrganizationsService>('orgs')),
});

type Caller = Record<string, Record<string, (input?: unknown) => Promise<unknown>>>;
const callerFor = (ctx: Partial<TrpcContext>): Caller =>
  appRouter.createCaller({ req: {} as Request, uid: null, organizationId: null, role: null, ...ctx }) as unknown as Caller;

const ANON = {};
const SIN_ORG = { uid: 'u1' };
const SIN_ROL = { uid: 'u1', organizationId: ORG_1 };            // llegó el header de org pero NO es miembro
const COLABORADOR = { uid: 'u1', organizationId: ORG_1, role: 'COLLABORATOR' as const };

// [router, procedure]
const SOLO_DUENO: Array<[string, string]> = [
  ['configWebhooks', 'list'], ['configWebhooks', 'create'], ['configWebhooks', 'rotateSecret'],
  ['configWebhooks', 'remove'], ['configWebhooks', 'test'], ['configWebhooks', 'getLogs'],
  ['configSecrets', 'list'], ['configSecrets', 'create'], ['configSecrets', 'rotate'], ['configSecrets', 'revoke'],
  ['configThemes', 'create'], ['configThemes', 'remove'],
  ['configQuotas', 'list'], ['configQuotas', 'updateLimit'],
  ['configTemplates', 'create'],
  ['configAudit', 'list'],
];
const MIEMBRO: Array<[string, string]> = [
  ['configFlags', 'list'], ['configFlags', 'update'],
  ['configThemes', 'list'], ['configThemes', 'activate'],
  ['configTemplates', 'list'], ['configTemplates', 'resolve'], ['configTemplates', 'render'],
];
const SESION: Array<[string, string]> = [
  ['collaborators', 'list'], ['collaborators', 'invite'], ['collaborators', 'update'],
  ['collaborators', 'remove'], ['collaborators', 'acceptInvitation'],
  ['organizations', 'me'], ['organizations', 'list'], ['organizations', 'create'], ['organizations', 'update'],
];

const codeOf = async (p: Promise<unknown>) => (await p.then(() => null, (e: { code?: string }) => e.code)) ?? 'OK';

describe('Autorización de los routers de config (routers reales)', () => {
  describe('sin sesión => UNAUTHORIZED en todo lo que no es público', () => {
    it.each([...SOLO_DUENO, ...MIEMBRO, ...SESION])('%s.%s', async (r, p) => {
      expect(await codeOf(callerFor(ANON)[r]![p]!())).toBe('UNAUTHORIZED');
    });
  });

  describe('con sesión pero sin organización activa', () => {
    it.each([...SOLO_DUENO, ...MIEMBRO])('%s.%s => BAD_REQUEST', async (r, p) => {
      expect(await codeOf(callerFor(SIN_ORG)[r]![p]!())).toBe('BAD_REQUEST');
    });
  });

  describe('un header x-organization-id SIN membresía no concede nada (rol null)', () => {
    it.each(MIEMBRO)('%s.%s => FORBIDDEN', async (r, p) => {
      expect(await codeOf(callerFor(SIN_ROL)[r]![p]!())).toBe('FORBIDDEN');
    });

    it.each(SOLO_DUENO)('%s.%s => FORBIDDEN', async (r, p) => {
      expect(await codeOf(callerFor(SIN_ROL)[r]![p]!())).toBe('FORBIDDEN');
    });
  });

  describe('un colaborador NO puede lo que es solo del dueño', () => {
    it.each(SOLO_DUENO)('%s.%s => FORBIDDEN y el service no se toca', async (r, p) => {
      expect(await codeOf(callerFor(COLABORADOR)[r]![p]!())).toBe('FORBIDDEN');
    });
  });

  describe('control positivo: el dueño SÍ pasa (si no, los 403 de arriba podrían ser un falso verde)', () => {
    it('configQuotas.list con OWNER llega al service con la organización del contexto', async () => {
      live.quotas.getForOrg.mockResolvedValue([{ resource: 'members' }]);

      const out = await callerFor({ uid: 'u1', organizationId: ORG_1, role: 'OWNER' }).configQuotas!.list!();

      expect(out).toEqual([{ resource: 'members' }]);
      expect(live.quotas.getForOrg).toHaveBeenCalledWith(ORG_1);
    });
  });

  describe('los procedures de miembro sí admiten al colaborador y toman la organización del CONTEXTO', () => {
    beforeEach(() => jest.clearAllMocks());

    it('configFlags.list con colaborador llega al service con la org del contexto', async () => {
      live.flags.list.mockResolvedValue([]);

      await callerFor(COLABORADOR).configFlags!.list!();

      expect(live.flags.list).toHaveBeenCalledWith(ORG_1);
    });

    it('un organizationId mandado en el input se descarta: manda el del contexto', async () => {
      live.flags.update.mockResolvedValue({ id: 'f' });

      await callerFor(COLABORADOR).configFlags!.update!({ flagId: '11111111-1111-4111-8111-111111111111', enabled: true, organizationId: 'org-AJENA' });

      expect(live.flags.update).toHaveBeenCalledWith(ORG_1, 'u1', '11111111-1111-4111-8111-111111111111', { enabled: true });
    });

    it('input inválido => BAD_REQUEST (Zod), sin llegar al service', async () => {
      const code = await codeOf(callerFor(COLABORADOR).configFlags!.update!({ flagId: 'no-es-uuid' }));

      expect(code).toBe('BAD_REQUEST');
      expect(live.flags.update).not.toHaveBeenCalled();
    });
  });

  describe('traducción de errores de negocio (mapNestErrors)', () => {
    beforeEach(() => jest.clearAllMocks());
    const input = { flagId: '11111111-1111-4111-8111-111111111111', enabled: true };

    it.each([
      ['NotFoundException', new NotFoundException('x'), 'NOT_FOUND'],
      ['ConflictException', new ConflictException('x'), 'CONFLICT'],
    ])('%s => %s', async (_n, error, expected) => {
      live.flags.update.mockRejectedValue(error);

      expect(await codeOf(callerFor(COLABORADOR).configFlags!.update!(input))).toBe(expected);
    });

    it('un error inesperado queda como INTERNAL_SERVER_ERROR (no se disfraza)', async () => {
      live.flags.update.mockRejectedValue(new Error('boom'));

      expect(await codeOf(callerFor(COLABORADOR).configFlags!.update!(input))).toBe('INTERNAL_SERVER_ERROR');
    });
  });
});
