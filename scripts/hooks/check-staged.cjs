#!/usr/bin/env node
// Pre-commit: frena secretos y archivos que no deben versionarse ANTES de que entren al historial
// (borrar un secreto de un commit posterior no lo saca del historial: hay que rotarlo).
//
//   node scripts/hooks/check-staged.cjs        → revisa lo que está en el índice (lo usa .githooks/pre-commit)
//
// Sin dependencias (el repo usa ignore-scripts=true, así que husky no instala el hook por sí solo):
//   pnpm setup:hooks   → git config core.hooksPath .githooks
// Es una red de contención, no la única: gitleaks corre igual en el CI sobre todo el historial.
const { execFileSync } = require('node:child_process');

/** Nombres de archivo que nunca se versionan. */
const FORBIDDEN_PATHS = [
  { re: /\.(bak|bak2|orig|rej|patch)$/i, why: 'respaldo / parche (git ya es el backup)' },
  { re: /(^|\/)[^/]*PATCH\.md$/, why: 'nota de parche (ya aplicado: borrarla)' },
  { re: /(^|\/)\.env$|(^|\/)\.env\.(local|production|development|staging|test)$/, why: 'archivo .env con valores reales (usar .env.example)' },
  { re: /\.(pem|p12|pfx|jks|keystore)$/i, why: 'certificado / llave privada' },
  { re: /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/, why: 'llave SSH' },
  { re: /(^|\/)(service-?account|firebase-adminsdk)[^/]*\.json$/i, why: 'credencial de servicio de Google/Firebase' },
];

/** Contenido que parece un secreto real. */
const SECRET_PATTERNS = [
  { name: 'llave privada', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/ },
  { name: 'AWS access key id', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: 'token de GitHub', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: 'token de Slack', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'clave live de Stripe', re: /\b[sr]k_live_[A-Za-z0-9]{16,}\b/ },
  { name: 'clave de API de Google (AIza…)', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'credencial de servicio de Google (private_key_id)', re: /"private_key_id"\s*:\s*"[0-9a-f]{20,}"/ },
  { name: 'URL con credenciales', re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/'"]+:[^\s@/'"]{6,}@[^\s'"/]+/i },
  {
    name: 'secreto asignado en código',
    re: /(?:secret|passw(?:or)?d|api[_-]?key|private[_-]?key|access[_-]?token|auth[_-]?token)\w*\s*[:=]\s*['"][A-Za-z0-9+/_\-=.]{20,}['"]/i,
  },
];

/** Líneas que, aunque matcheen, son legítimas (placeholders, referencias a env, claves públicas por diseño). */
const LINE_ALLOW = /process\.env|import\.meta\.env|<COMPLETAR>|placeholder|ejemplo|example|changeme|change-me|your[-_]|xxxxxx|catalog:|NEXT_PUBLIC_|getOrThrow|\$\{/i;

/** Rutas cuyo contenido no se escanea (fixtures de tests, lockfile, ejemplos documentados). */
const SKIP_CONTENT = /(^|\/)(pnpm-lock\.yaml|.*\.example|.*\.spec\.[tj]sx?|.*\.test\.[cm]?[tj]sx?|.*__tests__\/.*|\.gitleaks\.toml|.*\.md)$/;

function isForbiddenPath(path) {
  return FORBIDDEN_PATHS.find(({ re }) => re.test(path)) ?? null;
}

/** Devuelve los hallazgos de un archivo: [{ line, name, text }] (text con el valor del secreto oculto). */
function scanContent(path, text) {
  if (SKIP_CONTENT.test(path)) return [];
  const findings = [];
  text.split('\n').forEach((line, i) => {
    if (LINE_ALLOW.test(line)) return;
    for (const { name, re } of SECRET_PATTERNS) {
      const m = re.exec(line);
      if (!m) continue;
      // El hallazgo se muestra con el valor OCULTO: la terminal / el log del CI no deben filtrar el secreto.
      const hidden = line.trim().replace(m[0], m[0].slice(0, 4) + '…[oculto]');
      findings.push({ line: i + 1, name, text: hidden.slice(0, 80) });
    }
  });
  return findings;
}

/** Revisa una lista de archivos { path, read() }. Devuelve los problemas encontrados. */
function checkFiles(files) {
  const problems = [];
  for (const { path, read } of files) {
    const forbidden = isForbiddenPath(path);
    if (forbidden) { problems.push(`${path}: ${forbidden.why}`); continue; }
    let content;
    try { content = read(); } catch { continue; }
    if (content === null || content.includes('\u0000') || content.length > 1_000_000) continue; // binario / enorme
    for (const f of scanContent(path, content)) problems.push(`${path}:${f.line}: parece ${f.name} → ${f.text}`);
  }
  return problems;
}

function stagedFiles() {
  const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM', '-z'], { encoding: 'utf8' });
  return out.split('\u0000').filter(Boolean).map((path) => ({
    path,
    read: () => execFileSync('git', ['show', `:${path}`], { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 }),
  }));
}

if (require.main === module) {
  const problems = checkFiles(stagedFiles());
  if (problems.length > 0) {
    console.error('\n✋ Commit frenado: hay archivos que no deben versionarse.\n');
    for (const p of problems) console.error('  • ' + p);
    console.error('\nSi es un secreto real: NO lo commitees; rotalo y movelo a una variable de entorno.');
    console.error('Si es un falso positivo: git commit --no-verify (y avisalo en el PR).\n');
    process.exit(1);
  }
}

module.exports = { isForbiddenPath, scanContent, checkFiles };
