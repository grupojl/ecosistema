import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { CollaboratorStatus } from '@prisma/client';
import { FULL_COLLABORATOR_PERMISSIONS } from './types/organization-access.types';

describe('UsersService.getOrganizationAccess', () => {
  let service: UsersService;
  let prisma: {
    user: { findUnique: jest.Mock };
    organization: { findUnique: jest.Mock };
    collaborator: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      organization: { findUnique: jest.fn() },
      collaborator: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: OrganizationsService, useValue: {} },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('retorna canAccess=false si el usuario no existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.getOrganizationAccess('uid-x', 'org-1');

    expect(result).toEqual({ canAccess: false, reason: 'Usuario no encontrado' });
  });

  it('retorna canAccess=false si la organización no existe', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.organization.findUnique.mockResolvedValue(null);

    const result = await service.getOrganizationAccess('uid-x', 'org-1');

    expect(result).toEqual({ canAccess: false, reason: 'Organización no encontrada' });
  });

  it('retorna role OWNER con permisos completos si el usuario es dueño de la org', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', userId: 'user-1' });

    const result = await service.getOrganizationAccess('uid-x', 'org-1');

    expect(result).toEqual({
      canAccess: true,
      userId: 'user-1',
      organizationId: 'org-1',
      role: 'OWNER',
      permissions: FULL_COLLABORATOR_PERMISSIONS,
    });
  });

  it('retorna canAccess=false si no es owner ni colaborador activo', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', userId: 'other-user' });
    prisma.collaborator.findFirst.mockResolvedValue(null);

    const result = await service.getOrganizationAccess('uid-x', 'org-1');

    expect(result).toEqual({ canAccess: false, reason: 'No tenés acceso a esta organización' });
    expect(prisma.collaborator.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', userId: 'user-1', status: CollaboratorStatus.ACTIVE },
    });
  });

  it('retorna role COLLABORATOR con los permisos granulares del colaborador', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', userId: 'other-user' });
    prisma.collaborator.findFirst.mockResolvedValue({
      canViewListings: true,
      canCreateListings: false,
      canEditListings: true,
      canDeleteListings: false,
      canViewStats: true,
      canManageLeads: false,
      canManageCollaborators: false,
    });

    const result = await service.getOrganizationAccess('uid-x', 'org-1');

    expect(result).toEqual({
      canAccess: true,
      userId: 'user-1',
      organizationId: 'org-1',
      role: 'COLLABORATOR',
      permissions: {
        canViewListings: true,
        canCreateListings: false,
        canEditListings: true,
        canDeleteListings: false,
        canViewStats: true,
        canManageLeads: false,
        canManageCollaborators: false,
      },
    });
  });
});
