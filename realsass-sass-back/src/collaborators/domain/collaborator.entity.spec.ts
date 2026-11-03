/**
 * collaborator.entity.spec.ts — Tests de dominio puro
 *
 * REGLA: este archivo NO puede importar @nestjs/* ni @prisma/client
 */
import { CollaboratorAlreadyExistsError, CollaboratorNotFoundError } from './collaborator.errors';

describe('errores de dominio de colaboradores', () => {
  it('CollaboratorNotFoundError lleva el id y un nombre tipado', () => {
    const e = new CollaboratorNotFoundError('c-1');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('CollaboratorNotFoundError');
    expect(e.message).toContain('c-1');
  });

  it('CollaboratorAlreadyExistsError lleva el email y un nombre tipado', () => {
    const e = new CollaboratorAlreadyExistsError('a@b.com');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('CollaboratorAlreadyExistsError');
    expect(e.message).toContain('a@b.com');
  });
});
