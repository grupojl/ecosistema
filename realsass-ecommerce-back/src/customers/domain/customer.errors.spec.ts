import { assertValidEmail, CustomerNotFoundError, InvalidEmailError } from '@/customers/domain/customer.errors';

describe('assertValidEmail', () => {
  it.each(['ana@ejemplo.com', 'a.b+tag@sub.dominio.com.ar', 'x@y.co'])('acepta %s', (email) => {
    expect(() => assertValidEmail(email)).not.toThrow();
  });

  it.each(['', 'sin-arroba', '@sin-usuario.com', 'sin-dominio@', 'sin-punto@dominio', 'con espacio@dominio.com', 'dos@@dominio.com'])(
    'rechaza %p', (email) => {
      expect(() => assertValidEmail(email)).toThrow(InvalidEmailError);
    },
  );
});

describe('errores de customers', () => {
  it('llevan nombre propio y el dato que falló', () => {
    expect(new CustomerNotFoundError('c-1')).toMatchObject({ name: 'CustomerNotFoundError', message: 'Cliente no encontrado: c-1' });
    expect(new InvalidEmailError('x').message).toContain('x');
  });
});
