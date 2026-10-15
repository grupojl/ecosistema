import { CollaboratorsService } from '@/collaborators/collaborators.service';
import type { ICollaboratorsRepository } from '@/collaborators/repository/collaborators.repository.interface';
import type { PrismaService } from '@/prisma/prisma.service';

const ORG = { id: 'org-1' };
const DAY = 24 * 60 * 60 * 1000;

describe('CollaboratorsService', () => {
  const repo = { findAllByOrganization: jest.fn(), findByEmail: jest.fn(), findById: jest.fn(), update: jest.fn(), remove: jest.fn() };
  const prisma = {
    user: { findUnique: jest.fn() },
    collaborator: { create: jest.fn((a: unknown) => a), update: jest.fn((a: unknown) => a) },
    invitation: { create: jest.fn((a: unknown) => a), update: jest.fn((a: unknown) => a), upsert: jest.fn((a: unknown) => a), findUnique: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const service = new CollaboratorsService(repo as unknown as ICollaboratorsRepository, prisma as unknown as PrismaService);

  const owner = (orgs = [ORG]) => ({ id: 'u-owner', email: 'owner@ejemplo.com', organizations: orgs });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockResolvedValue([]);
    prisma.user.findUnique.mockResolvedValue(owner());
    repo.findByEmail.mockResolvedValue(null);
    repo.findById.mockResolvedValue({ id: 'col-1', organizationId: 'org-1', status: 'PENDING' });
  });

  describe('la organización sale del dueño autenticado (multi-tenant)', () => {
    it('prefiere la organización activa SI es del usuario; una ajena se ignora', async () => {
      prisma.user.findUnique.mockResolvedValue(owner([{ id: 'org-a' }, { id: 'org-b' }]));
      await service.listCollaborators('uid', 'org-b');
      expect(repo.findAllByOrganization).toHaveBeenLastCalledWith('org-b');

      await service.listCollaborators('uid', 'org-AJENA');
      expect(repo.findAllByOrganization).toHaveBeenLastCalledWith('org-a'); // cae a la más antigua, nunca a la ajena
    });

    it('sin organizaciones => NotFound', async () => {
      prisma.user.findUnique.mockResolvedValue(owner([]));
      await expect(service.listCollaborators('uid')).rejects.toMatchObject({ status: 404 });
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.listCollaborators('uid')).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('inviteCollaborator', () => {
    it('no se puede invitar a uno mismo', async () => {
      await expect(service.inviteCollaborator('uid', { email: 'owner@ejemplo.com' })).rejects.toMatchObject({ status: 400 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('no se invita a quien ya es colaborador activo', async () => {
      repo.findByEmail.mockResolvedValue({ id: 'col-9', status: 'ACTIVE' });
      await expect(service.inviteCollaborator('uid', { email: 'a@b.co' })).rejects.toMatchObject({ status: 400 });
    });

    it('crea colaborador + invitación en UNA transacción, con permisos mínimos por defecto y vigencia de 7 días', async () => {
      const antes = Date.now();
      const out = await service.inviteCollaborator('uid', { email: 'a@b.co', canEditListings: true });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const [created] = prisma.collaborator.create.mock.calls[0] as [{ data: Record<string, unknown> }];
      expect(created.data).toMatchObject({ organizationId: 'org-1', email: 'a@b.co', status: 'PENDING' });
      expect(created.data['permissions']).toEqual({
        canViewListings: true, canCreateListings: false, canEditListings: true, canDeleteListings: false,
        canViewStats: false, canManageLeads: false, canManageCollaborators: false,
      });
      const [inv] = prisma.invitation.create.mock.calls[0] as [{ data: { expiresAt: Date; token: string } }];
      expect(inv.data.expiresAt.getTime()).toBeGreaterThanOrEqual(antes + 7 * DAY - 1_000);
      expect(inv.data.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 7 * DAY + 1_000);
      expect(inv.data.token).toMatch(/^[0-9a-f-]{36}$/);
      expect(out.inviteLink).toMatch(/^\/invite\//);
    });

    it('un colaborador REMOVED se reactiva como PENDING con un token NUEVO (no reutiliza el viejo)', async () => {
      repo.findByEmail.mockResolvedValue({ id: 'col-9', status: 'REMOVED' });

      await service.inviteCollaborator('uid', { email: 'a@b.co' });

      expect(prisma.collaborator.update).toHaveBeenCalledWith({ where: { id: 'col-9' }, data: expect.objectContaining({ status: 'PENDING' }) });
      const [upsert] = prisma.invitation.upsert.mock.calls[0] as [{ update: { token: string; usedAt: null } }];
      expect(upsert.update.usedAt).toBeNull();
      expect(upsert.update.token).toMatch(/^[0-9a-f-]{36}$/);
      expect(prisma.collaborator.create).not.toHaveBeenCalled();
    });
  });

  describe('update / remove', () => {
    it('solo operan sobre colaboradores de la organización del dueño (NotFound si no)', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.updateCollaborator('uid', 'col-x', { canViewStats: true })).rejects.toMatchObject({ status: 404 });
      await expect(service.removeCollaborator('uid', 'col-x')).rejects.toMatchObject({ status: 404 });
      expect(repo.update).not.toHaveBeenCalled();
      expect(repo.remove).not.toHaveBeenCalled();
      expect(repo.findById).toHaveBeenCalledWith('col-x', 'org-1'); // acotado a SU organización
    });

    it('actualiza los permisos y quita', async () => {
      await service.updateCollaborator('uid', 'col-1', { canViewStats: true });
      expect(repo.update).toHaveBeenCalledWith('col-1', { permissions: { canViewStats: true } });
      await service.removeCollaborator('uid', 'col-1');
      expect(repo.remove).toHaveBeenCalledWith('col-1');
    });
  });

  describe('invitaciones', () => {
    const invitation = (over: Record<string, unknown> = {}) => ({
      id: 'inv-1', collaboratorId: 'col-1', expiresAt: new Date(Date.now() + DAY), usedAt: null,
      collaborator: { email: 'a@b.co', organization: ORG }, ...over,
    });

    it('token inexistente => NotFound; vencido => BadRequest', async () => {
      prisma.invitation.findUnique.mockResolvedValue(null);
      await expect(service.getInvitationInfo('x')).rejects.toMatchObject({ status: 404 });
      prisma.invitation.findUnique.mockResolvedValue(invitation({ expiresAt: new Date(Date.now() - 1) }));
      await expect(service.getInvitationInfo('x')).rejects.toMatchObject({ status: 400 });
    });

    it('info pública (sin auth): solo email, nombre de la organización y vigencia; nada interno', async () => {
      prisma.invitation.findUnique.mockResolvedValue(invitation({ collaborator: { email: 'a@b.co', organization: { id: 'org-1', name: 'Acme', ownerId: 'u-1' } } }));
      const info = await service.getPublicInvitationInfo('tok');
      expect(Object.keys(info).sort()).toEqual(['collaborator', 'expiresAt', 'used']);
      expect(info.collaborator).toEqual({ email: 'a@b.co', organization: { name: 'Acme' } });
      expect(JSON.stringify(info)).not.toMatch(/tok|inv-1|col-1|org-1|u-1/);
    });

    it('aceptar: exige que el email del usuario coincida con el de la invitación', async () => {
      prisma.invitation.findUnique.mockResolvedValue(invitation());
      prisma.user.findUnique.mockResolvedValue({ id: 'u-2', email: 'otro@ejemplo.com' });
      await expect(service.acceptInvitation('tok', 'uid')).rejects.toMatchObject({ status: 403 });
      expect(prisma.$transaction).not.toHaveBeenCalled();

      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.acceptInvitation('tok', 'uid')).rejects.toMatchObject({ status: 404 });
    });

    it('aceptar activa al colaborador y marca la invitación como usada, en una transacción', async () => {
      prisma.invitation.findUnique.mockResolvedValue(invitation());
      prisma.user.findUnique.mockResolvedValue({ id: 'u-2', email: 'a@b.co' });

      await service.acceptInvitation('tok', 'uid');

      expect(prisma.collaborator.update).toHaveBeenCalledWith({ where: { id: 'col-1' }, data: expect.objectContaining({ status: 'ACTIVE', userId: 'u-2' }) });
      expect(prisma.invitation.update).toHaveBeenCalledWith({ where: { id: 'inv-1' }, data: { usedAt: expect.any(Date) } });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    // Regresión de seguridad: un colaborador REMOVIDO conservaba el token (vigente 7 días) y podía volver a
    // aceptarlo, recuperando el acceso que el dueño le había quitado.
    it('una invitación YA USADA no se puede volver a aceptar (revocar acceso tiene que ser definitivo)', async () => {
      prisma.invitation.findUnique.mockResolvedValue(invitation({ usedAt: new Date(Date.now() - DAY) }));
      prisma.user.findUnique.mockResolvedValue({ id: 'u-2', email: 'a@b.co' });

      await expect(service.acceptInvitation('tok', 'uid')).rejects.toMatchObject({ status: 400 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.collaborator.update).not.toHaveBeenCalled();
    });
  });
});
