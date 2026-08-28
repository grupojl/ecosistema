import type { Collaborator, InviteCollaboratorInput, UpdateCollaboratorInput } from '../domain/collaborator.entity';

export const COLLABORATORS_REPOSITORY = Symbol('COLLABORATORS_REPOSITORY');

export interface ICollaboratorsRepository {
  findAllByOrganization(organizationId: string): Promise<Collaborator[]>;
  findById(id: string, organizationId: string): Promise<Collaborator | null>;
  findByEmail(email: string, organizationId: string): Promise<Collaborator | null>;
  create(input: InviteCollaboratorInput): Promise<Collaborator>;
  update(id: string, input: UpdateCollaboratorInput): Promise<Collaborator>;
  remove(id: string): Promise<void>;
}
