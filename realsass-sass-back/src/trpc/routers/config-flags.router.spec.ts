import { createConfigFlagsRouter } from './config-flags.router';
import { router } from '@/trpc';

const FLAG = '11111111-1111-4111-8111-111111111111';
const req = { headers: {}, cookies: {} };
const caller = (role: 'OWNER' | 'COLLABORATOR') => {
  const flags = { list: jest.fn(), update: jest.fn().mockResolvedValue({ ok: true }) };
  const c = router({ configFlags: createConfigFlagsRouter(flags as never) }).createCaller({
    req,
    uid: 'u',
    organizationId: 'org-1',
    role,
  } as never);
  return { c, flags };
};

describe('configFlags.update: rollout solo para el dueño', () => {
  it('un colaborador puede hacer toggle', async () => {
    const { c, flags } = caller('COLLABORATOR');
    await c.configFlags.update({ flagId: FLAG, enabled: true });
    expect(flags.update).toHaveBeenCalledWith('org-1', 'u', FLAG, { enabled: true });
  });

  it('un colaborador NO puede cambiar el rollout (403) y no se escribe nada', async () => {
    const { c, flags } = caller('COLLABORATOR');
    await expect(c.configFlags.update({ flagId: FLAG, rolloutPercentage: 100 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(c.configFlags.update({ flagId: FLAG, enabled: true, rolloutPercentage: 0 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(flags.update).not.toHaveBeenCalled();
  });

  it('el dueño sí puede cambiar el rollout', async () => {
    const { c, flags } = caller('OWNER');
    await c.configFlags.update({ flagId: FLAG, rolloutPercentage: 25 });
    expect(flags.update).toHaveBeenCalledWith('org-1', 'u', FLAG, { rolloutPercentage: 25 });
  });
});
