# ADR-026: Content-Security-Policy con nonces en los fronts

**Fecha:** 2026-10-14
**Estado:** Propuesto — no implementado
**Alcance:** los 4 fronts Next.js
**Complementa:** ADR-023 (modelo de seguridad)

## Contexto

| Front | CSP hoy |
|---|---|
| `realsass-sass-front` | Completa, pero con `script-src 'self' 'unsafe-inline' 'unsafe-eval'` |
| `realsass-docs-front` | Completa, con `'unsafe-inline'` |
| `real-ecommerce-front` | Solo el subconjunto que no restringe scripts (`frame-ancestors`, `base-uri`, `object-src`, `form-action`) |
| `realsass-dashboard-front` | Igual que el storefront |

Con `'unsafe-inline'` la CSP no frena un XSS: cualquier `<script>` inyectado se ejecuta. Es la mitigación que falta
para que la cookie HttpOnly (ADR-004/023) sea realmente una segunda línea de defensa.

## Por qué no se implementó

Una CSP con nonces **cambia cómo se renderiza cada página** y solo se puede validar en un navegador real:
- El nonce se genera por request: obliga a render dinámico. El storefront usa SSG/ISR (cacheable por SEO,
  ADR-016): con nonces pierde el caché estático salvo que se usen **hashes** para los scripts inline conocidos.
- Firebase Auth, Facebook Connect y Apple ID inyectan scripts y abren iframes; hay que comprobar cuáles necesitan
  `'unsafe-eval'` y cuáles toleran `'strict-dynamic'`.
- Un error acá **rompe el login o el checkout en producción** y el typecheck/CI no lo detecta.

## Plan de despliegue (a ejecutar con un navegador a mano)

1. **Report-Only primero**: `Content-Security-Policy-Report-Only` con la política objetivo + un endpoint
   `/api/csp-report` que loguea las violaciones. No bloquea nada.
2. **Medir una semana** en producción: qué scripts/orígenes violan la política. Ajustar la lista.
3. **Nonce vía `proxy.ts`** (Next 16): genera el nonce, lo pone en la CSP y en `x-nonce`; las páginas autenticadas
   (dashboard, sass-front) pasan a dinámicas. Para el storefront, evaluar hashes en lugar de nonces.
4. **Enforce** (`Content-Security-Policy`) front por front, empezando por `docs-front` (el más simple) y
   terminando por el checkout.
5. Quitar `'unsafe-eval'` y `'unsafe-inline'`; sumar un test que lea los headers del build y falle si reaparecen.

## Política objetivo

```
default-src 'self';
script-src 'self' 'nonce-<n>' 'strict-dynamic';
style-src 'self' 'unsafe-inline';        # Tailwind/shadcn inyectan estilos; los estilos son bajo riesgo
img-src 'self' data: blob: https:;
connect-src 'self' <API propia> <Firebase>;
frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'
```
