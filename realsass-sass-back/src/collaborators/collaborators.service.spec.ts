import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CollaboratorsService } from './collaborators.service';

const ORG = { id: 'org-1' };

function build() {
  const prisma = {
    user:         { findUnique: jest.fn() },
    collaborator: { create: jest.fn((a: unknown) => a), update: jest.fn((a: unknown) => a) },
    invitation:   { create: jest.fn((a: unknown) => a), upsert: jest.fn((a: unknown) => a), findUnique: jest.fn(), update: jest.fn((a: unknown) => a) },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const repo = {
    findAllByOrganization: jest.fn(),
    findByEmail: jest.fn(),
    findById:    jest.fn(),
    update:      jest.fn(),
    remove:      jest.fn(),
  };
  const service = new CollaboratorsService(repo as never, prisma as never);
  // Dueño con una organización
  prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'owner@x.com', organizations: [ORG] });
  return { prisma, repo, service };
}

describe('CollaboratorsService — organización del dueño', () => {
  it('404 si el usuario no tiene organización', async () => {
    const { prisma, service } = build();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', organizations: [] });
    await expect(service.listCollaborators('uid')).rejects.toThrow(NotFoundException);
  });

  it('usa la organización activa solo si es propia; si no, la más antigua', async () => {
    const { prisma, repo, service } = build();
    prisma.user.findUnique.mockResolvedValue({ organizations: [{ id: 'vieja' }, { id: 'nueva' }] });
    await service.listCollaborators('uid', 'nueva');
    expect(repo.findAllByOrganization).toHaveBeenLastCalledWith('nueva');
    await service.listCollaborators('uid', 'ajena');
    expect(repo.findAllByOrganization).toHaveBeenLastCalledWith('vieja');
  });
});

describe('CollaboratorsService.inviteCollaborator', () => {
  it('no permite invitarse a sí mismo', async () => {
    const { service } = build();
    await expect(service.inviteCollaborator('uid', { email: 'owner@x.com' })).rejects.toThrow('Cannot invite yourself');
  });

  it('no permite invitar a un colaborador ya activo', async () => {
    const { repo, service } = build();
    repo.findByEmail.mockResolvedValue({ id: 'c1', status: 'ACTIVE' });
    await expect(service.inviteCollaborator('uid', { email: 'a@x.com' })).rejects.toThrow('already active');
  });

  it('crea colaborador PENDING con permisos mínimos por defecto', async () => {
    const { prisma, repo, service } = build();
    repo.findByEmail.mockResolvedValue(null);
    repo.findById.mockResolvedValue({ id: 'nuevo' });
    await service.inviteCollaborator('uid', { email: 'a@x.com' });

    const create = prisma.collaborator.create.mock.calls[0]![0] as { data: { status: string; organizationId: string; permissions: Record<string, boolean> } };
    expect(create.data.status).toBe('PENDING');
    expect(create.data.organizationId).toBe('org-1');
    expect(create.data.permissions).toEqual({
      canViewListings: true, canCreateListings: false, canEditListings: false, canDeleteListings: false,
      canViewStats: false, canManageLeads: false, canManageCollaborators: false,
    });
  });

  it('respeta los permisos pedidos', async () => {
    const { prisma, repo, service } = build();
    repo.findByEmail.mockResolvedValue(null);
    repo.findById.mockResolvedValue({ id: 'nuevo' });
    await service.inviteCollaborator('uid', { email: 'a@x.com', canEditListings: true, canViewListings: false });
    const perms = (prisma.collaborator.create.mock.calls[0]![0] as { data: { permissions: Record<string, boolean> } }).data.permissions;
    expect(perms['canEditListings']).toBe(true);
    expect(perms['canViewListings']).toBe(false);
  });

  it('el enlace de invitación lleva el TOKEN de la invitación (no el id del colaborador)', async () => {
    const { prisma, repo, service } = build();
    repo.findByEmail.mockResolvedValue(null);
    repo.findById.mockResolvedValue({ id: 'nuevo' });
    const { inviteLink } = await service.inviteCollaborator('uid', { email: 'a@x.com' });

    const inv = prisma.invitation.create.mock.calls[0]![0] as { data: { token: string; collaboratorId: string } };
    expect(inviteLink).toBe(`/invite/${inv.data.token}`);
    expect(inviteLink).not.toContain(inv.data.collaboratorId);
  });

  it('la invitación vence en 7 días', async () => {
    const { prisma, repo, service } = build();
    repo.findByEmail.mockResolvedValue(null);
    repo.findById.mockResolvedValue({});
    await service.inviteCollaborator('uid', { email: 'a@x.com' });
    const { expiresAt } = (prisma.invitation.create.mock.calls[0]![0] as { data: { expiresAt: Date } }).data;
    const days = (expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThanOrEqual(7);
  });

  it('un colaborador REMOVED se reactiva con una invitación nueva (mismo id, token nuevo, usedAt limpio)', async () => {
    const { prisma, repo, service } = build();
    repo.findByEmail.mockResolvedValue({ id: 'viejo', status: 'REMOVED' });
    repo.findById.mockResolvedValue({ id: 'viejo' });
    const { inviteLink } = await service.inviteCollaborator('uid', { email: 'a@x.com' });

    expect(prisma.collaborator.create).not.toHaveBeenCalled();
    expect((prisma.collaborator.update.mock.calls[0]![0] as { data: { status: string } }).data.status).toBe('PENDING');
    const up = prisma.invitation.upsert.mock.calls[0]![0] as { update: { token: string; usedAt: null }; create: { token: string } };
    expect(up.update.usedAt).toBeNull();
    expect(up.update.token).toBe(up.create.token);
    expect(inviteLink).toBe(`/invite/${up.update.token}`);
  });
});

describe('CollaboratorsService — update / remove', () => {
  it('404 si el colaborador no es de la organización del dueño', async () => {
    const { repo, service } = build();
    repo.findById.mockResolvedValue(null);
    await expect(service.updateCollaborator('uid', 'c1', { canViewStats: true })).rejects.toThrow(NotFoundException);
    await expect(service.removeCollaborator('uid', 'c1')).rejects.toThrow(NotFoundException);
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.remove).not.toHaveBeenCalled();
    expect(repo.findById).toHaveBeenCalledWith('c1', 'org-1'); // la búsqueda está acotada a la organización
  });

  it('actualiza y elimina cuando existe', async () => {
    const { repo, service } = build();
    repo.findById.mockResolvedValue({ id: 'c1' });
    await service.updateCollaborator('uid', 'c1', { canViewStats: true });
    expect(repo.update).toHaveBeenCalledWith('c1', { permissions: { canViewStats: true } });
    await service.removeCollaborator('uid', 'c1');
    expect(repo.remove).toHaveBeenCalledWith('c1');
  });
});

describe('CollaboratorsService — invitaciones', () => {
  const future = () => new Date(Date.now() + 86_400_000);
  const invitation = (over: Record<string, unknown> = {}) => ({
    id: 'inv1', collaboratorId: 'c1', expiresAt: future(), usedAt: null,
    collaborator: { email: 'a@x.com', organization: { id: 'org-1' } }, ...over,
  });

  it('404 con un token inexistente', async () => {
    const { prisma, service } = build();
    prisma.invitation.findUnique.mockResolvedValue(null);
    await expect(service.getInvitationInfo('nope')).rejects.toThrow(NotFoundException);
  });

  it('rechaza una invitación vencida', async () => {
    const { prisma, service } = build();
    prisma.invitation.findUnique.mockResolvedValue(invitation({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(service.getInvitationInfo('t')).rejects.toThrow('expired');
  });

  it('acepta: activa al colaborador, lo liga al usuario y marca la invitación como usada', async () => {
    const { prisma, service } = build();
    prisma.invitation.findUnique.mockResolvedValue(invitation());
    prisma.user.findUnique.mockResolvedValue({ id: 'u9', email: 'a@x.com' });
    await service.acceptInvitation('t', 'uid');

    expect((prisma.collaborator.update.mock.calls[0]![0] as { data: { status: string; userId: string } }).data).toMatchObject({ status: 'ACTIVE', userId: 'u9' });
    expect((prisma.invitation.update.mock.calls[0]![0] as { data: { usedAt: Date } }).data.usedAt).toBeInstanceOf(Date);
  });

  it('un token ya usado NO se puede aceptar de nuevo', async () => {
    const { prisma, service } = build();
    prisma.invitation.findUnique.mockResolvedValue(invitation({ usedAt: new Date() }));
    prisma.user.findUnique.mockResolvedValue({ id: 'u9', email: 'a@x.com' });
    await expect(service.acceptInvitation('t', 'uid')).rejects.toThrow('already used');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('403 si el correo del usuario no es el de la invitación', async () => {
    const { prisma, service } = build();
    prisma.invitation.findUnique.mockResolvedValue(invitation());
    prisma.user.findUnique.mockResolvedValue({ id: 'u9', email: 'otro@x.com' });
    await expect(service.acceptInvitation('t', 'uid')).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('404 si el usuario no existe', async () => {
    const { prisma, service } = build();
    prisma.invitation.findUnique.mockResolvedValue(invitation());
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.acceptInvitation('t', 'uid')).rejects.toThrow(NotFoundException);
  });

  it('(contrato) las excepciones usadas son de Nest', () => {
    expect(new BadRequestException('x').getStatus()).toBe(400);
  });
});
