import { CollaboratorAlreadyExistsError, CollaboratorNotFoundError } from '@/collaborators/domain/collaborator.errors';

describe('errores de colaboradores', () => {
  it('llevan nombre propio y el dato que falló', () => {
    expect(new CollaboratorNotFoundError('c-1')).toMatchObject({ name: 'CollaboratorNotFoundError', message: 'Collaborator not found: c-1' });
    expect(new CollaboratorAlreadyExistsError('a@b.co')).toMatchObject({ name: 'CollaboratorAlreadyExistsError', message: 'Collaborator already exists: a@b.co' });
    expect(new CollaboratorNotFoundError('x')).toBeInstanceOf(Error);
  });
});
