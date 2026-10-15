import { parseAllowedOrigins, requireEnv, trustProxyHops } from '../require-env';

describe('configuración que falla cerrado', () => {
  const saved: Record<string, string | undefined> = {};
  const set = (vars: Record<string, string | undefined>) => {
    for (const [k, v] of Object.entries(vars)) {
      if (!(k in saved)) saved[k] = process.env[k];
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  };
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  });

  describe('requireEnv', () => {
    it('lanza si falta o está vacía', () => {
      set({ X_REQ: undefined });
      expect(() => requireEnv('X_REQ')).toThrow(/X_REQ no está definida/);
      set({ X_REQ: '   ' });
      expect(() => requireEnv('X_REQ')).toThrow();
    });

    it('lanza si es más corta que el mínimo', () => {
      set({ X_REQ: 'corta' });
      expect(() => requireEnv('X_REQ', { minLength: 32 })).toThrow(/demasiado corta/);
    });

    it('devuelve el valor si cumple', () => {
      set({ X_REQ: 'c'.repeat(32) });
      expect(requireEnv('X_REQ', { minLength: 32 })).toHaveLength(32);
    });
  });

  describe('parseAllowedOrigins (CORS)', () => {
    it('sin definir => lanza (el servicio no arranca)', () => {
      set({ ALLOWED_ORIGINS: undefined });
      expect(() => parseAllowedOrigins()).toThrow();
    });

    it('"*" => lanza: con credenciales sería una vulnerabilidad CORS activa', () => {
      set({ ALLOWED_ORIGINS: '*' });
      expect(() => parseAllowedOrigins()).toThrow(/"\*"/);
      set({ ALLOWED_ORIGINS: 'https://a.com,*' });
      expect(() => parseAllowedOrigins()).toThrow();
    });

    it('lista explícita => se devuelve limpia', () => {
      set({ ALLOWED_ORIGINS: 'https://a.com, https://b.com ,' });
      expect(parseAllowedOrigins()).toEqual(['https://a.com', 'https://b.com']);
    });
  });

  describe('trustProxyHops', () => {
    it('default: 1 en producción (Railway), 0 en local', () => {
      set({ TRUST_PROXY: undefined, NODE_ENV: 'production' });
      expect(trustProxyHops()).toBe(1);
      set({ NODE_ENV: 'development' });
      expect(trustProxyHops()).toBe(0);
    });

    it('TRUST_PROXY manda y se valida', () => {
      set({ TRUST_PROXY: '2' });
      expect(trustProxyHops()).toBe(2);
      set({ TRUST_PROXY: 'abc' });
      expect(() => trustProxyHops()).toThrow();
      set({ TRUST_PROXY: '-1' });
      expect(() => trustProxyHops()).toThrow();
    });
  });
});
