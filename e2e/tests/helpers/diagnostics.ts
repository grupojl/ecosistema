import { test as base, expect } from '@playwright/test';

/**
 * `test` con un fixture automático que registra errores de consola, respuestas HTTP >= 400 y requests caídos de la
 * página, y los adjunta al reporte (y los imprime) SOLO si el test falla. Los 401 de `auth.me`/`auth.ping` antes de
 * ingresar son normales y por eso no se muestran cuando el test pasa.
 */
export const test = base.extend<{ pageDiagnostics: void }>({
  pageDiagnostics: [
    async ({ page }, use, info) => {
      const lines: string[] = [];
      page.on('console', (m) => m.type() === 'error' && lines.push(`[console] ${m.text().slice(0, 400)}`));
      page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message.slice(0, 400)}`));
      page.on('response', (r) => r.status() >= 400 && lines.push(`[http ${r.status()}] ${r.request().method()} ${r.url().slice(0, 200)}`));
      page.on('requestfailed', (r) => lines.push(`[requestfailed] ${r.url().slice(0, 200)} ${r.failure()?.errorText ?? ''}`));
      await use();
      if (info.status !== info.expectedStatus && lines.length > 0) {
        await info.attach('diagnostico-de-la-pagina', { body: lines.join('\n'), contentType: 'text/plain' });
        console.log(`\n--- diagnóstico de la página (${info.title}) ---\n${lines.join('\n')}\n`);
      }
    },
    { auto: true },
  ],
});

export { expect };
