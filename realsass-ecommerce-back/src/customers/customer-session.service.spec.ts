import { createHmac } from 'node:crypto';
import { CustomerSessionService } from '@/customers/customer-session.service';

const S1 = 'a'.repeat(40);
const S2 = 'b'.repeat(40);
const b64 = (x: string | Buffer) => Buffer.from(x).toString('base64url');
const forge = (secret: string, payload: object) => {
  const data = `v1.${b64(JSON.stringify(payload))}`;
  return `${data}.${b64(createHmac('sha256', secret).update(data).digest())}`;
};

describe('CustomerSessionService (sesión firmada del storefront)', () => {
  const saved: Record<string, string | undefined> = {};
  const env = (vars: Record<string, string | undefined>) => {
    for (const [k, v] of Object.entries(vars)) {
      if (!(k in saved)) saved[k] = process.env[k];
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  };
  afterEach(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
  const make = (secret = S1) => { env({ CUSTOMER_SESSION_SECRET: secret }); return new CustomerSessionService(); };
  const future = () => Date.now() + 1_000_000;

  describe('arranque (falla cerrado)', () => {
    it('sin secreto, o con uno corto, el servicio no se construye', () => {
      env({ CUSTOMER_SESSION_SECRET: undefined });
      expect(() => new CustomerSessionService()).toThrow();
      env({ CUSTOMER_SESSION_SECRET: 'corto' });
      expect(() => new CustomerSessionService()).toThrow();
      env({ CUSTOMER_SESSION_SECRET: `${S1},corto` });
      expect(() => new CustomerSessionService()).toThrow(/al menos 32/);
    });
  });

  describe('emitir y verificar', () => {
    it('ida y vuelta: devuelve cliente y organización', () => {
      const svc = make();
      const { token, expiresAt } = svc.issue({ customerId: 'c1', organizationId: 'o1' });
      expect(svc.verify(token)).toEqual({ customerId: 'c1', organizationId: 'o1' });
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('un id suelto o un token inventado NO es una credencial', () => {
      const svc = make();
      for (const fake of ['c1', 'v1.abc.def', '', 'v2.a.b', 'a.b', undefined, null, `v1.${b64('{"cid":"c1"}')}.firmaFalsa`]) {
        expect(svc.verify(fake)).toBeNull();
      }
    });

    it('payload alterado (cambiar de cliente) => rechazado', () => {
      const svc = make();
      const [v, , sig] = svc.issue({ customerId: 'c1', organizationId: 'o1' }).token.split('.') as [string, string, string];
      const evil = b64(JSON.stringify({ cid: 'OTRO', oid: 'o1', iat: 1, exp: future() }));
      expect(svc.verify(`${v}.${evil}.${sig}`)).toBeNull();
    });

    it('firmado con otro secreto => rechazado; con el propio => aceptado', () => {
      const svc = make();
      const payload = { cid: 'c1', oid: 'o1', iat: 1, exp: future() };
      expect(svc.verify(forge(S2, payload))).toBeNull();
      expect(svc.verify(forge(S1, payload))).toEqual({ customerId: 'c1', organizationId: 'o1' });
    });

    it('vencido => rechazado', () => {
      expect(make().verify(forge(S1, { cid: 'c1', oid: 'o1', iat: 1, exp: Date.now() - 1 }))).toBeNull();
    });

    it('payload mal formado (aunque esté bien firmado) => rechazado', () => {
      const svc = make();
      expect(svc.verify(forge(S1, { cid: 5, oid: 'o1', exp: future() }))).toBeNull();
      expect(svc.verify(forge(S1, { cid: 'c1', exp: future() }))).toBeNull();
      expect(svc.verify(forge(S1, { cid: 'c1', oid: 'o1' }))).toBeNull();
    });
  });

  describe('rotación de secretos ("nuevo,viejo")', () => {
    it('firma con el primero y acepta los dos; al retirar el viejo, deja de valer', () => {
      const viejo = make(S1).issue({ customerId: 'c1', organizationId: 'o1' }).token;

      const rotando = make(`${S2},${S1}`);
      expect(rotando.verify(viejo)).not.toBeNull(); // sigue valiendo durante la rotación
      const nuevo = rotando.issue({ customerId: 'c1', organizationId: 'o1' }).token;

      const soloNuevo = make(S2);
      expect(soloNuevo.verify(nuevo)).not.toBeNull(); // firmado con el secreto nuevo
      expect(soloNuevo.verify(viejo)).toBeNull();      // retirado
    });
  });

  describe('cookie (ADR-004)', () => {
    it('producción: HttpOnly + SameSite=Strict + Secure + dominio compartido con __session', () => {
      const svc = make();
      env({ NODE_ENV: 'production', COOKIE_DOMAIN: '.midominio.com' });
      expect(svc.cookieOptions()).toMatchObject({ httpOnly: true, sameSite: 'strict', secure: true, path: '/', domain: '.midominio.com' });
      expect(svc.cookieOptions().maxAge).toBeGreaterThan(0);
    });

    it('local: sin Secure ni dominio (host-only), pero siempre HttpOnly', () => {
      const svc = make();
      env({ NODE_ENV: 'development', COOKIE_DOMAIN: undefined });
      const o = svc.cookieOptions();
      expect(o).toMatchObject({ httpOnly: true, secure: false });
      expect(o).not.toHaveProperty('domain');
    });

    it('borrar exige los mismos path/domain con que se emitió (y sin maxAge)', () => {
      const svc = make();
      env({ COOKIE_DOMAIN: '.midominio.com' });
      const c = svc.clearCookieOptions();
      expect(c).toMatchObject({ domain: '.midominio.com', path: '/', httpOnly: true });
      expect(c).not.toHaveProperty('maxAge');
    });
  });
});
