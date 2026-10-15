// node --test scripts/hooks
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkFiles, isForbiddenPath, scanContent } = require('./check-staged.cjs');

const file = (path, content = '') => ({ path, read: () => content });

test('rechaza archivos que nunca se versionan', () => {
  for (const p of [
    'src/auth.service.ts.bak', 'x/y/config.orig', 'a.patch', 'realsass-ecommerce-back/src/orders/MARKETS_CHECKOUT_PATCH.md',
    '.env', 'realsass-sass-back/.env.local', 'apps/web/.env.production', 'certs/server.pem', 'deploy/id_rsa',
    'secrets/serviceAccount.json', 'firebase-adminsdk-abc.json',
  ]) assert.ok(isForbiddenPath(p), `debería frenar ${p}`);
});

test('NO frena los archivos legítimos', () => {
  for (const p of [
    '.env.example', 'realsass-sass-back/.env.example', 'src/app.module.ts', 'README.md', 'pnpm-lock.yaml',
    'scripts/audit/seguridad.sh', '.gitignore', 'docs/environment.md',
  ]) assert.equal(isForbiddenPath(p), null, `no debería frenar ${p}`);
});

test('detecta secretos reales en el contenido', () => {
  const casos = {
    'llave privada': '-----BEGIN RSA PRIVATE KEY-----\nMIIE...',
    'AWS access key id': 'const k = "AKIAIOSFODNN7EXAMPLQ"',
    'token de GitHub': 'token: ghp_' + 'a'.repeat(36),
    'token de Slack': 'SLACK=xoxb-1234567890-abcdefghij',
    'clave live de Stripe': 'const s = "sk_live_' + 'a'.repeat(24) + '"',
    'clave de API de Google (AIza…)': 'key = AIza' + 'a'.repeat(35),
    'URL con credenciales': 'DB=postgresql://admin:SuperSecreta123@db.interno.com:5432/prod',
    'secreto asignado en código': 'const apiKey = "abcdefghijklmnop1234567890XYZ"',
  };
  for (const [nombre, linea] of Object.entries(casos)) {
    const hallazgos = scanContent('src/config.ts', linea);
    assert.ok(hallazgos.some((h) => h.name === nombre), `no detectó: ${nombre} (${JSON.stringify(hallazgos)})`);
  }
});

test('no marca placeholders, referencias a env ni claves públicas por diseño', () => {
  for (const linea of [
    'const secret = process.env["API_SECRET_TOKEN_LONG_VALUE_123"]',
    'INTERNAL_API_KEY=<COMPLETAR>',
    'apiKey: "tu-clave-de-ejemplo-aqui-123456"',
    'NEXT_PUBLIC_FIREBASE_API_KEY=AIza' + 'a'.repeat(35),
    'const url = `postgresql://${user}:${password}@${host}/db`',
    'password = "changeme-changeme-changeme"',
  ]) assert.deepEqual(scanContent('src/x.ts', linea), [], `falso positivo: ${linea}`);
});

test('no escanea fixtures de tests, lockfile ni ejemplos', () => {
  const secreto = 'const apiKey = "abcdefghijklmnop1234567890XYZ"';
  for (const p of ['src/a.spec.ts', 'src/__tests__/b.ts', 'web/c.test.tsx', 'pnpm-lock.yaml', 'x/.env.example', 'doc/seguridad.md']) {
    assert.deepEqual(scanContent(p, secreto), [], p);
  }
});

test('checkFiles junta los problemas con archivo y línea, y no expone el valor completo', () => {
  const problemas = checkFiles([
    file('src/ok.ts', 'export const a = 1\n'),
    file('src/mal.ts', 'x\nconst token = "ghp_' + 'b'.repeat(36) + '"\n'),
    file('src/viejo.ts.bak', 'lo que sea'),
    file('assets/logo.png', 'PNG\u0000binario'),
  ]);
  assert.equal(problemas.length, 2);
  assert.match(problemas[0], /src\/mal\.ts:2: parece token de GitHub/);
  assert.match(problemas[1], /viejo\.ts\.bak: respaldo/);
  assert.ok(!problemas[0].includes('b'.repeat(36)), 'no debe imprimir el secreto completo');
});

test('un archivo que no se puede leer no rompe la revisión', () => {
  assert.deepEqual(checkFiles([{ path: 'x.ts', read: () => { throw new Error('no existe'); } }]), []);
});
