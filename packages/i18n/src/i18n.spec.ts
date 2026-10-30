import { describe, expect, it } from 'vitest';
import { LOCALES, isLocale, localeDir } from './config';
import { intlLocale, plural, t } from './format';
import { getCommonDictionary, mergeDictionaries } from './messages';
import { negotiateLocale, parseAcceptLanguage } from './negotiate';

describe('negotiateLocale', () => {
  it('la cookie gana sobre Accept-Language', () => {
    expect(negotiateLocale({ cookieLocale: 'de', acceptLanguage: 'pt-BR,pt;q=0.9' })).toEqual({ locale: 'de', source: 'cookie' });
  });
  it('una cookie inválida se ignora', () => {
    expect(negotiateLocale({ cookieLocale: 'xx', acceptLanguage: 'fr-CA' })).toEqual({ locale: 'fr', source: 'accept-language' });
  });
  it('respeta el peso q y salta idiomas inactivos', () => {
    expect(negotiateLocale({ acceptLanguage: 'ja;q=1, en;q=0.8, es;q=0.5' }).locale).toBe('en');
  });
  it('sin señales → idioma por defecto', () => {
    expect(negotiateLocale({})).toEqual({ locale: 'es', source: 'default' });
  });
  it('descarta tags vacíos, comodín y q=0', () => {
    expect(parseAcceptLanguage('*, ,en;q=0, pt')).toEqual([{ tag: 'pt', q: 1 }]);
  });
});

describe('format', () => {
  it('interpola y deja visibles los placeholders sin valor', () => {
    expect(t('Hola {name}, {x}', { name: 'Ana' })).toBe('Hola Ana, {x}');
  });
  it('plural con reglas CLDR', () => {
    const forms = { one: '{count} orden', other: '{count} órdenes' };
    expect(plural('es', 1, forms)).toBe('1 orden');
    expect(plural('es', 3, forms)).toBe('3 órdenes');
  });
  it('intlLocale combina idioma y región, y tolera basura', () => {
    expect(intlLocale('es', 'ar')).toBe('es-AR');
    expect(intlLocale('en', 'xyz')).toBe('en');
    expect(intlLocale('pt', null)).toBe('pt');
  });
});

describe('diccionarios', () => {
  it('todo idioma activo tiene diccionario común completo', () => {
    const keys = (o: object) => JSON.stringify(Object.entries(o).map(([k, v]) => [k, Object.keys(v as object)]));
    const base = keys(getCommonDictionary('es'));
    for (const l of LOCALES) expect(keys(getCommonDictionary(l))).toBe(base);
  });
  it('mergeDictionaries amplía secciones sin pisar las comunes', () => {
    const merged = mergeDictionaries(getCommonDictionary('es'), { auth: { extra: 'x' }, login: { title: 'T' } });
    expect(merged.auth.continueWithGoogle).toBe('Continuar con Google');
    expect((merged.auth as unknown as { extra: string }).extra).toBe('x');
    expect((merged as unknown as { login: { title: string } }).login.title).toBe('T');
  });
  it('config', () => {
    expect(isLocale('es')).toBe(true);
    expect(isLocale('ja')).toBe(false);
    expect(localeDir('es')).toBe('ltr');
  });
});
