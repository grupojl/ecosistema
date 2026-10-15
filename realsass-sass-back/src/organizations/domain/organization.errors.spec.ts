import { OrganizationForbiddenError, OrganizationNotFoundError } from '@/organizations/domain/organization.errors';

describe('errores de organizaciones', () => {
  it('llevan nombre propio y mensaje claro', () => {
    expect(new OrganizationNotFoundError('org-1')).toMatchObject({ name: 'OrganizationNotFoundError', message: 'Organization not found: org-1' });
    expect(new OrganizationForbiddenError()).toMatchObject({ name: 'OrganizationForbiddenError', message: 'User is not the owner of this organization' });
    expect(new OrganizationForbiddenError()).toBeInstanceOf(Error);
  });
});
