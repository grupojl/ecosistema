# ADR-024: Tests que protegen las reglas — y Zod como única validación

**Fecha:** 2026-10-14
**Estado:** Aceptado
**Alcance:** realsass-sass-back, realsass-ecommerce-back, `@real/auth-server`, real-ecommerce-front
**Complementa:** ADR-022 (las reglas se verifican solas), ADR-023 (modelo de seguridad)

## Contexto

Los tests existían pero **no corrían**: cada back tenía dos configuraciones de jest (`jest.config.js` y la
clave `jest` de `package.json`) y jest abortaba con "Multiple configurations found". Además la mitad de los specs
eran plantillas de Nest ("should be defined") sin proveedores, y los demás probaban código que ya había cambiado
(`COMPLETED` en lugar de `CONVERTED`, rutas movidas, UUID que Zod 4 ya no acepta). Nada impedía regresiones: el
bug del prefijo global de tRPC (`/api/v1/api/v1/trpc`) llegó a producción porque ningún test montaba el módulo.

## Decisión

```
Config      Una sola por workspace (jest.config.js / vitest.config.ts). Los alias salen de tsconfig.paths; los exactos
            van antes que el comodín '@/*' (TypeScript los prioriza así). jose@6 (solo ESM) se stubbea
Dónde       El spec vive AL LADO del archivo (foo.service.ts → foo.service.spec.ts). Integración en __tests__/
Qué         dominio puro · services con repositorios fake · guards · integración tRPC con el router REAL ·
            montaje real de TrpcModule con el prefijo de producción · primitivas de seguridad
Datos       NUNCA una base real: el .env local apunta a Railway. Repositorios en memoria y fetch mockeado
Cobertura   Umbral por workspace que SOLO sube (jest.config.js → coverageThreshold). El CI falla si baja
Bugs        Todo bug corregido deja un test que falla sin el arreglo (se verifica rompiendo el código a propósito)
Auditoría   scripts/audit/testing.sh exige specs en dominio, services críticos, guards y la máquina de estados de órdenes
Validación  Zod es la ÚNICA librería: input() de tRPC y ZodValidationPipe. Sin class-validator / class-transformer /
            joi (ningún DTO los usaba; el ValidationPipe global era inerte)
```

Umbrales de partida (medidos el 2026-10-14): sass-back 32 / 20 / 31 / 32 (líneas / funciones / ramas / sentencias),
ecommerce-back 58 / 49 / 47 / 56, `@real/auth-server` 64 / 55 / 63 / 64. Subirlos es parte de cada PR que agrega tests.

## Qué destaparon los tests (corregido en el mismo cambio)

| Hallazgo | Impacto |
|---|---|
| `RolesGuard`: un rol requerido inexistente (typo en `@Roles('SUPERADMN')`) valía nivel 0 | Dejaba pasar a **cualquier** usuario del tenant (fallaba abierto) |
| Anti-SSRF de webhooks: no cubría IPv4 mapeada en IPv6 (`[::ffff:a9fe:a9fe]`), NAT64, 6to4 ni IPv4-compatible | Un dueño de organización podía apuntar un webhook a `169.254.169.254` o a la red interna |
| `acceptInvitation` no miraba `usedAt` | Un colaborador **removido** reaceptaba su token (vigente 7 días) y recuperaba el acceso |
| `generateCustomToken*` contaba colaboraciones de cualquier estado | Un colaborador removido o pendiente obtenía el token SSO |
| `ecommerce-back` no traducía excepciones de Nest a códigos tRPC | `NotFound` / `Conflict` / `422` llegaban al storefront como 500 |
| `TenantGuard` (mi primera versión) contaba el 403 como falla del servicio | 5 pedidos a una organización ajena abrían el circuito y dejaban sin servicio a todos |
| `CryptoService.decrypt` concatenaba `Buffer + string` | Corrompía caracteres multibyte en los secretos |
| `OrdersService.checkout`: `subtotalCents` guardaba el total con envío y `shippingCents` no se persistía | La orden no cerraba (subtotal + envío ≠ total) |
| `Market` resuelto en el checkout pero no guardado | La orden no conservaba el fulfillment con el que se vendió (ADR-014) |
| `CartRecord.status` decía `COMPLETED`; el esquema usa `CONVERTED` | Tipo y test desalineados con la base |
| `reserveWithinTransaction` resta `available` **y** suma `reserved`, pero filtra por `available - reserved` | **Posible doble descuento de stock** si "available" ya es neto. Sin cambiar (el código pide no tocarlo); decidir el modelo |

## Pendiente

- Los repositories Prisma y los routers de `sass-back` no tienen tests (cobertura 33 %): necesitan una Postgres efímera
  en el CI (contenedor de servicio de GitHub Actions) para probar las consultas reales.
- Tests end-to-end del storefront y del dashboard (Playwright), que cubran también las cookies en un navegador.
- Resolver el modelo de stock de `reserveWithinTransaction` (ver tabla) y cubrirlo con un test de concurrencia.
