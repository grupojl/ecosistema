import { safeEqual } from './safe-equal';

describe('safeEqual', () => {
  it('iguales → true', () => {
    expect(safeEqual('clave-interna', 'clave-interna')).toBe(true);
  });

  it('distintas → false, también con distinto largo o prefijo común', () => {
    expect(safeEqual('clave-interna', 'clave-interna-2')).toBe(false);
    expect(safeEqual('clave', 'clave-interna')).toBe(false);
    expect(safeEqual('clave-internA', 'clave-interna')).toBe(false);
  });

  it('vacío, nulo o ausente nunca coincide, ni con otro vacío', () => {
    expect(safeEqual('', '')).toBe(false);
    expect(safeEqual(undefined, undefined)).toBe(false);
    expect(safeEqual(null, 'x')).toBe(false);
    expect(safeEqual('x', undefined)).toBe(false);
  });

  it('soporta unicode', () => {
    expect(safeEqual('contraseña-ñ', 'contraseña-ñ')).toBe(true);
    expect(safeEqual('contraseña-ñ', 'contrasena-n')).toBe(false);
  });
});
