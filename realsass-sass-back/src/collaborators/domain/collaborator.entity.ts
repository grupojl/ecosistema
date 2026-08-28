export interface CollaboratorPermissions {
  canViewListings:       boolean;
  canCreateListings:     boolean;
  canEditListings:       boolean;
  canDeleteListings:     boolean;
  canViewStats:          boolean;
  canManageLeads:        boolean;
  canManageCollaborators: boolean;
}

export interface Collaborator {
  id:             string;
  organizationId: string;
  userId:         string | null;
  email:          string;
  status:         'PENDING' | 'ACTIVE' | 'REMOVED';
  permissions:    CollaboratorPermissions;
  createdAt:      Date;
  updatedAt:      Date;
}

export interface InviteCollaboratorInput {
  organizationId: string;
  email:          string;
  permissions?:   Partial<CollaboratorPermissions>;
}

export interface UpdateCollaboratorInput {
  permissions: Partial<CollaboratorPermissions>;
}
