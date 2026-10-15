import { firstKey, identifyCaller, matchesAnyKey, parseKeyEntries, parseKeys, safeEqual } from '../keys';

describe('claves de servicio rotables', () => {
  describe('parseKeys', () => {
    it('separa por coma, recorta espacios y descarta vacíos', () => {
      expect(parseKeys(' nueva , vieja ,, ')).toEqual(['nueva', 'vieja']);
      expect(parseKeys(undefined)).toEqual([]);
      expect(parseKeys('')).toEqual([]);
    });
  });

  describe('safeEqual', () => {
    it('compara en tiempo constante, incluso con largos distintos', () => {
      expect(safeEqual('abc', 'abc')).toBe(true);
      expect(safeEqual('abc', 'abd')).toBe(false);
      expect(safeEqual('abc', 'abcd')).toBe(false); // timingSafeEqual a secas lanzaría por largo distinto
      expect(safeEqual('', 'a')).toBe(false);
    });
  });

  describe('matchesAnyKey (quien recibe)', () => {
    it('rotación: acepta la nueva y la vieja mientras ambas estén configuradas', () => {
      expect(matchesAnyKey('nueva', 'nueva,vieja')).toBe(true);
      expect(matchesAnyKey('vieja', 'nueva,vieja')).toBe(true);
      expect(matchesAnyKey('vieja', 'nueva')).toBe(false); // retirada
    });

    it('rechaza una clave distinta, parecida, vacía o ausente', () => {
      expect(matchesAnyKey('otra', 'nueva,vieja')).toBe(false);
      expect(matchesAnyKey('nuevaX', 'nueva')).toBe(false);
      expect(matchesAnyKey('', 'nueva')).toBe(false);
      expect(matchesAnyKey(undefined, 'nueva')).toBe(false);
    });

    it('FALLA CERRADO: sin claves configuradas no pasa nada (ni una clave vacía)', () => {
      expect(matchesAnyKey('x', undefined)).toBe(false);
      expect(matchesAnyKey('x', '')).toBe(false);
      expect(matchesAnyKey('', '')).toBe(false);
    });
  });

  describe('una clave por servicio (nombre=clave)', () => {
    const ECO = 'k-ecommerce-0123456789abcdef';
    const ADM = 'k-superadmin-0123456789abcdef';
    const CONFIG = `ecommerce=${ECO},superadmin=${ADM}`;

    it('parseKeyEntries separa nombre y clave; las simples quedan como "default"', () => {
      expect(parseKeyEntries(CONFIG)).toEqual([{ name: 'ecommerce', key: ECO }, { name: 'superadmin', key: ADM }]);
      expect(parseKeyEntries('nueva,vieja')).toEqual([{ name: 'default', key: 'nueva' }, { name: 'default', key: 'vieja' }]);
      expect(parseKeys(CONFIG)).toEqual([ECO, ADM]); // compatible hacia atrás: solo las claves
    });

    it('identifyCaller dice QUIÉN llama (auditoría)', () => {
      expect(identifyCaller(ECO, CONFIG)).toBe('ecommerce');
      expect(identifyCaller(ADM, CONFIG)).toBe('superadmin');
      expect(identifyCaller('robada', CONFIG)).toBeNull();
      expect(identifyCaller(undefined, CONFIG)).toBeNull();
      expect(identifyCaller('nueva', 'nueva,vieja')).toBe('default');
    });

    it('el nombre NO es una credencial: mandar "ecommerce=<clave>" no autentica', () => {
      expect(matchesAnyKey(`ecommerce=${ECO}`, CONFIG)).toBe(false);
      expect(matchesAnyKey(ECO, CONFIG)).toBe(true);
    });

    it('revocar a UN servicio = borrar su entrada; los demás siguen funcionando', () => {
      const sinSuperadmin = `ecommerce=${ECO}`;
      expect(matchesAnyKey(ADM, sinSuperadmin)).toBe(false);
      expect(matchesAnyKey(ECO, sinSuperadmin)).toBe(true);
    });

    it('quien envía manda solo la clave de la primera entrada (sin el nombre)', () => {
      expect(firstKey(CONFIG, 'K')).toBe(ECO);
    });

    it('una clave base64 con padding ("==") o con símbolos NO se confunde con un nombre', () => {
      const base64 = 'abcdefghijklmnopqrstuvwxyz0123456789ABCD==';
      expect(parseKeyEntries(base64)).toEqual([{ name: 'default', key: base64 }]);
      const conSimbolos = 'ab+cd/ef=ghijklmnopqrstuvwxyz0123456789';
      expect(parseKeyEntries(conSimbolos)).toEqual([{ name: 'default', key: conSimbolos }]);
      expect(matchesAnyKey(base64, base64)).toBe(true);
    });

    it('una entrada con nombre pero clave demasiado corta (< 16) se trata como clave simple', () => {
      expect(parseKeyEntries('ecom=corta')).toEqual([{ name: 'default', key: 'ecom=corta' }]);
    });
  });

  describe('firstKey (quien envía)', () => {
    it('usa siempre la primera', () => {
      expect(firstKey('nueva,vieja', 'K')).toBe('nueva');
    });

    it('sin clave lanza: nunca se envía una clave vacía', () => {
      expect(() => firstKey('', 'INTERNAL_API_KEY')).toThrow(/INTERNAL_API_KEY/);
      expect(() => firstKey(undefined, 'K')).toThrow();
    });
  });
});
