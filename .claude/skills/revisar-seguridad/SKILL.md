---
name: revisar-seguridad
description: Usar para revisar la seguridad de un cambio, módulo o servicio de este monorepo (identidad, tenant, CORS, secretos, guards, SSRF, rate limit) o al tocar auth, sesiones, guards, webhooks o endpoints públicos. Aplica ADR-023 y reporta hallazgos con severidad y evidencia.
---

# Revisión de seguridad (ADR-023)

> Nada que el cliente pueda fabricar es una credencial · todo falla cerrado · todo secreto es rotable.

Es una **revisión**: se reportan hallazgos con `archivo:línea`; se corrige solo si el usuario lo pide.

## Lista (sobre el diff, o sobre el módulo pedido)

| # | Pregunta | Cómo se comprueba |
|---|---|---|
| 1 | **Identidad**: ¿`customerId` sale solo de la cookie HttpOnly `store_session`? | Buscar `x-customer-id`/`x-customer-token`; el procedure usa `customerProcedure` |
| 2 | **Tenant**: ¿todo query lleva `organizationId` y viene de `ctx`, no del input? | `where` de cada consulta; input Zod sin `organizationId` |
| 3 | **Carrito/pedido**: ¿se verifica el dueño (`getOwnedCart`, `findById(org, id)`)? | Leer el service; test cross-tenant |
| 4 | **Falla cerrado**: ¿un rol/permiso inexistente o ausente deniega? | Guards con nivel desconocido ⇒ denegar (bug real: `RolesGuard` con typo de rol dejaba pasar a todos) |
| 5 | **Arranque**: sin `ALLOWED_ORIGINS`, `INTERNAL_API_KEY` ni `CUSTOMER_SESSION_SECRET` el servicio **no** levanta | Config de arranque |
| 6 | **CORS**: lista explícita; `origin: true` y `"*"` prohibidos | `bash scripts/audit/seguridad.sh` (S2) |
| 7 | **Claves de servicio**: comparación en tiempo constante (`matchesAnyKey`), nunca `===`/`?? ''`; rotables (`nueva,vieja`) | S3 |
| 8 | **Rate limit** en `/trpc` por IP y usuario con contador en Redis | S4 |
| 9 | **Llamadas entre servicios**: timeout siempre; circuit breaker en las críticas; un 403 no abre el circuito | Revisar clientes (`organizations-client`) |
| 10 | **SSRF**: URLs de webhooks validadas incluyendo IPv6 mapeada, NAT64, 6to4 y metadatos (`169.254.169.254`) | Validador anti-SSRF y su spec |
| 11 | **Secretos**: nunca en logs, errores ni respuestas; cifrados en reposo (AES-256-GCM); ninguno commiteado | Hook de pre-commit, gitleaks, `git diff` |
| 12 | **Errores**: sin stack ni detalles internos al cliente; `NotFound` ≠ `500` | `mapNestErrors` |
| 13 | **Público**: endpoints/procedures públicos solo exponen lo mínimo (sin ids internos ni tokens) | Forma de la respuesta |

## Ejecutar

```bash
bash scripts/audit/seguridad.sh --ci     # S1-S7
pnpm audit:deps
pnpm --filter realsass-sass-back test:cov && pnpm --filter realsass-ecommerce-back test:cov && pnpm --filter @real/auth-server test:cov
```
Y los tests de integración de aislamiento si hay Postgres local (skill `test-integracion-tenant`).

## Reporte

```
[CRÍTICO|ALTO|MEDIO|BAJO] archivo:línea — qué pasa
  Escenario: entrada/estado concreto → resultado dañino
  Arreglo sugerido: …
```
Si no hay hallazgos, decir qué se revisó y qué **no** (por ejemplo, "no se probó contra un navegador" para cookies o CSP).

## Fuera de alcance conocido

CSP con nonces (ADR-026) y cuentas recurrentes por email (ADR-025) están sin implementar: no reportarlos como regresión, sí recordarlos como riesgo residual.

## Mantenimiento

Depende de ADR-023 (y su tabla de riesgo residual), ADR-024 (hallazgos históricos) y `scripts/audit/seguridad.sh`. Al cerrar ADR-025/026, ampliar la lista.
