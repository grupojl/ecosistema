export class CollaboratorNotFoundError extends Error {
  constructor(id: string) {
    super(`Collaborator not found: ${id}`);
    this.name = 'CollaboratorNotFoundError';
  }
}

export class CollaboratorAlreadyExistsError extends Error {
  constructor(email: string) {
    super(`Collaborator already exists: ${email}`);
    this.name = 'CollaboratorAlreadyExistsError';
  }
}
