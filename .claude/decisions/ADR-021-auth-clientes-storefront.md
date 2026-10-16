# ADR-021: Autenticación de clientes del storefront con Firebase, por ecosistema y organización

**Fecha:** 2026-10-16
**Estado:** Aceptado — implementado en ecommerce-back y real-ecommerce-front
**Alcance:** `realsass-ecommerce-back` · `real-ecommerce-front` · `@real/auth-server`
**Enmienda:** ADR-004 ("No aplica — el storefront usa customerId + sessionId, no Firebase") y `modules/ecommerce-back/customers.md`

## Contexto

Los clientes del storefront se "identificaban" con un email sin verificar: `customer.identify` devolvía un `customerId` y el
back confiaba en los headers `x-customer-id` + `x-organization-id`. Quien conociera un email obtenía el cliente (carrito,
pedidos). Además `identify` estaba roto (todos los visitantes recibían el mismo cliente; corregido el 2026-10-16) y es
inaceptable antes de cobrar.

El producto planteaba autenticar a los clientes con **Firebase**, igual que a dueños y colaboradores, y que el cliente
exista **dentro de su ecosistema y de la organización (tienda)** donde compra.

## Decisión

1. **Identidad = Firebase.** El cliente entra con Google en el storefront (Firebase Web SDK, mismo proyecto Firebase que el
   resto del ecosistema `welver`). Cada request tRPC del cliente lleva `Authorization: Bearer <ID token>`.
2. **El back verifica, no confía.** El middleware compartido (`@real/auth-server`) ya valida el token; se agrega
   `emailVerified` a `req.user`. Un cliente solo existe si el email **está verificado por Firebase**.
3. **Alcance por organización.** El `StoreCustomer` es único por `(organizationId, email)`: el mismo usuario de Firebase es un
   cliente distinto en cada tienda (su carrito y sus pedidos no se mezclan). El ecosistema lo da el proyecto Firebase
   (`Organization.ecosystemId`, hoy `welver`): una cuenta, todas las tiendas del ecosistema.
4. **El `customerId` se deriva, nunca se recibe.** `customerProcedure` resuelve el cliente desde el token verificado + el
   `x-organization-id` (alta perezosa en el primer uso). El header `x-customer-id` **deja de usarse** y `customer.identify`
   **se elimina** (era el agujero).
5. **UI:** el navbar tiene un único **avatar**. Cerrado: "Ingresar con Google". Abierto: cuenta, bolsa (ítems, subtotal,
   checkout), "Mis pedidos" y "Cerrar sesión". Reemplaza al ícono de bolsa.
6. Sin cookie ni sesión propia en el storefront: el SDK de Firebase mantiene el token y lo renueva.

## Alternativas descartadas

- **Email verificado con enlace/código propio** — requiere servicio de mail y reinventa lo que Firebase ya resuelve.
- **Cookie de sesión de Firebase para clientes (como los dueños)** — exige `POST /auth/session` y dominio de cookie
  compartido con el back; el Bearer por request es más simple y no tiene CSRF.
- **Cuenta única global con perfil por tienda** — es lo que se obtiene con (3); no se necesita otro modelo.

## Consecuencias

**Se gana:** los pedidos de un cliente no se pueden ver sabiendo su email; un solo login para todas las tiendas del ecosistema.

**Límites / deuda consciente:**
- Solo Google por ahora (Apple/Facebook existen en `@real/auth-client` pero requieren configurar los proveedores).
- Un dueño o colaborador que entra a una tienda ajena como cliente es un cliente más (misma cuenta Firebase, otro rol).
- El `organizationId` del header no se valida contra el sass-back: un id inexistente crea un `StoreCustomer` huérfano
  (DT-STORE-SEC-3).
- El token vive en IndexedDB por origen: no hay SSO entre `localhost:3021`, `:3022` y `:3023`; cada front inicia sesión.
- `cart.get` y `checkout` aún no comprueban que el carrito sea del cliente (DT-STORE-SEC-2).

## Referencias

- `realsass-ecommerce-back/src/trpc/trpc.ts` · `trpc.module.ts` · `src/customers/`
- `packages/auth-server/src/middleware/create-trpc-auth-middleware.ts`
- `real-ecommerce-front/components/commerce/`
- ADR-004, ADR-018 (el storefront pasa a declarar `@real/auth-client`)
