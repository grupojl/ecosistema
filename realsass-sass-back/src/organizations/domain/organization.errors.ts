export class OrganizationNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Organization not found: ${identifier}`);
    this.name = 'OrganizationNotFoundError';
  }
}

export class OrganizationForbiddenError extends Error {
  constructor() {
    super('User is not the owner of this organization');
    this.name = 'OrganizationForbiddenError';
  }
}
