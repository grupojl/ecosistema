import { resolveCustomerFromUser, type IdentifyFn } from '@/customers/resolve-customer';

const ORG = '68546da0-041d-4929-b932-7af5d2576693';
const verified = { email: 'ana@example.com', emailVerified: true, displayName: 'Ana' };

function identifySpy(): jest.MockedFunction<IdentifyFn> {
  return jest.fn(async () => ({ customerId: 'cust-1' }));
}

describe('resolveCustomerFromUser (ADR-021)', () => {
  it('usuario de Firebase con email verificado → cliente de ESA organización', async () => {
    const identify = identifySpy();
    await expect(resolveCustomerFromUser(verified, ORG, identify)).resolves.toBe('cust-1');
    expect(identify).toHaveBeenCalledWith(ORG, 'ana@example.com', 'Ana');
  });

  it('sin sesión → null y no toca la base', async () => {
    const identify = identifySpy();
    await expect(resolveCustomerFromUser(undefined, ORG, identify)).resolves.toBeNull();
    await expect(resolveCustomerFromUser(null, ORG, identify)).resolves.toBeNull();
    expect(identify).not.toHaveBeenCalled();
  });

  it.each([
    ['email NO verificado (alguien podría registrar el de otra persona)', { ...verified, emailVerified: false }],
    ['sin dato de verificación', { email: 'ana@example.com', displayName: null }],
    ['sin email', { ...verified, email: '' }],
  ])('%s → null y no crea nada', async (_label, user) => {
    const identify = identifySpy();
    await expect(resolveCustomerFromUser(user, ORG, identify)).resolves.toBeNull();
    expect(identify).not.toHaveBeenCalled();
  });

  it.each([null, '', 'x', 'otra-org', '68546da0-041d-4929-b932'])(
    'organización inválida %j → null (no se crean clientes con ids arbitrarios)',
    async (org) => {
      const identify = identifySpy();
      await expect(resolveCustomerFromUser(verified, org, identify)).resolves.toBeNull();
      expect(identify).not.toHaveBeenCalled();
    },
  );

  it('organización con formato válido pero inexistente o sin ecommerce → null y no crea el cliente', async () => {
    const identify = identifySpy();
    const enabled = jest.fn(async () => false);
    await expect(resolveCustomerFromUser(verified, ORG, identify, enabled)).resolves.toBeNull();
    expect(enabled).toHaveBeenCalledWith(ORG);
    expect(identify).not.toHaveBeenCalled();
  });

  it('organización válida → crea el cliente', async () => {
    const identify = identifySpy();
    await expect(resolveCustomerFromUser(verified, ORG, identify, async () => true)).resolves.toBe('cust-1');
  });

  it('si la validación de la organización falla por infraestructura, el error se propaga (no se confunde con "no existe")', async () => {
    const identify = identifySpy();
    await expect(resolveCustomerFromUser(verified, ORG, identify, async () => { throw new Error('sass-back caído'); })).rejects.toThrow('sass-back caído');
    expect(identify).not.toHaveBeenCalled();
  });

  it('no consulta la organización si el usuario ya no califica (ahorra una llamada HTTP)', async () => {
    const enabled = jest.fn(async () => true);
    await resolveCustomerFromUser({ ...verified, emailVerified: false }, ORG, identifySpy(), enabled);
    expect(enabled).not.toHaveBeenCalled();
  });

  it('sin displayName no manda nombre', async () => {
    const identify = identifySpy();
    await resolveCustomerFromUser({ ...verified, displayName: null }, ORG, identify);
    expect(identify).toHaveBeenCalledWith(ORG, 'ana@example.com', undefined);
  });

  it('cada organización es un cliente aparte: se llama con el organizationId pedido', async () => {
    const identify = identifySpy();
    const OTHER = '11111111-1111-4111-8111-111111111111';
    await resolveCustomerFromUser(verified, OTHER, identify);
    expect(identify.mock.calls[0]![0]).toBe(OTHER);
  });
});
