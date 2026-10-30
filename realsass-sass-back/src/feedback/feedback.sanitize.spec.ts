import { maskSecretsInText, sanitizeConsoleErrors, stripSecrets } from '@/feedback/feedback.sanitize';

describe('feedback.sanitize (ADR-027)', () => {
  it('descarta claves que parecen secretos, a cualquier profundidad', () => {
    const out = stripSecrets({ release: 'abc', Authorization: 'x', nested: { apiKey: 'k', ok: 1, cookie: 'c' } });
    expect(out).toEqual({ release: 'abc', nested: { ok: 1 } });
  });

  it('enmascara bearer, JWT y parámetros sensibles en el texto', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghij';
    const text = maskSecretsInText(`Bearer ${jwt} y ${jwt} en /x?token=123&a=1`);
    expect(text).not.toContain('eyJ');
    expect(text).not.toContain('123');
    expect(text).toContain('a=1');
  });

  it('acota cantidad y largo de los errores de consola', () => {
    const errors = Array.from({ length: 60 }, () => 'e'.repeat(900));
    const out = sanitizeConsoleErrors(errors);
    expect(out).toHaveLength(20);
    expect(out[0]?.length).toBe(500);
  });
});
