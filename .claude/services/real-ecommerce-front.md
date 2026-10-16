# real-ecommerce-front

## URLs (ADR-022)

Canónica: `/{locale}/{slug}/…` (`app/[locale]/[slug]`), p. ej. `/es/mi-marca/productos/zapatilla`. `{slug}` es el slug de la organización, no un UUID. Sin idioma (`/{slug}` o el viejo `/tienda/{slug}`) → 307 al idioma negociado (`proxy.ts`). `/{locale}/tienda/{slug}/…` → 308 a la URL nueva (`next.config.mjs`).

## Rol

Storefront público multi-tenant, SSG/ISR con Next.js 15 App Router.
Los clientes inician sesión con Firebase (Google), por organización (ADR-021).

## Modelo de rendering (canónico)

```
Server Component (page.tsx, layout.tsx)
  → tRPC server caller para obtener datos
  → renderiza HTML con datos
  → pasa initialData a Client Components via props/HydrationBoundary

Client Component ('use client')
  → rehidrata con useQuery() misma queryKey
  → NUNCA hace fetch propio al back
```

El único fetch manual permitido es `customer.identify` para obtener el
`customerId` inicial — es el bootstrap del contexto de cliente, equivalente
a lo que hace `POST /auth/session` para el sistema de auth de owners.

## Le corresponde

- `/[slug]/*` — ruta canónica multi-tenant
- `/categoria/[categoria]`, `/products/[handle]` — rutas legacy, pendientes de migrar
- `/checkout`, `/tracking` — flujo de compra y seguimiento

## Conecta con

- `realsass-ecommerce-back` **únicamente vía tRPC** — `EcommerceAppRouter`
  - Server Components: `createServerCaller()` → procedures de `customer.*`
  - Client Components: `trpc.customer.*` hooks (rehidratación)

## Configuración (2026-10-08)

- `proxy.ts` (antes `middleware.ts`) negocia el idioma de `/tienda/*`; ver `modules/ecommerce-front/seo-i18n.md`.
- `SITE_URL` es de **runtime**. `app/robots.ts` es `force-dynamic` para leerla por request (antes se
  prerenderizaba en el build y, sin la variable, `robots.txt` quedaba sin la línea `Sitemap`).
- Firebase solo para el login de clientes (`lib/commerce/firebase.ts`, variables `NEXT_PUBLIC_FIREBASE_*` = las del dashboard). Cada request tRPC lleva `Authorization: Bearer <ID token>` + `x-organization-id`.
- `NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID` es la única fuente del header `x-organization-id` del navegador;
  los procedures de carrito y checkout lo exigen (limitación para multi-tienda, DT-ENV-03).
- Variables completas en `.env.example`.

## Estado funcional (2026-10-16)

Funciona con datos reales: portada de tienda, listado y detalle de productos, categorías, idiomas es/pt/en (solo el primario indexa),
robots, sitemap por tienda, JSON-LD, 404 de tienda inexistente, redirect 307 de `/tienda/...` sin idioma. Estado vacío: "Esta tienda aún no
tiene productos cargados". **No funciona de punta a punta**: carrito (sin UI), checkout y tracking (mocks), login de cliente.
Para probar con datos hay que cargar productos desde el dashboard (Tienda → Productos).
`NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID` debe ser el id de la organización de la tienda (lo exigen carrito y checkout).

## Diseño de la tienda por organización (2026-10-16)

Todas las tiendas (`/{locale}/{slug}`) comparten el lenguaje visual de la home base (`localhost:3023/`), con datos reales:
- **Cabecera** `components/storefront/store-header.tsx`: fija y translúcida, logo + nombre de la tienda, navegación, selector de idioma y
  bolsa. La bolsa abre un panel que dice que el carrito todavía no está disponible (no simula contenido).
- **Home**: hero de marca (oscuro) + hasta 4 productos destacados como secciones `ProductHero` (alternan claro/oscuro, botón "Conocer más"
  al detalle) + categorías + resto del catálogo en grilla. Sin productos: hero de marca y estado vacío.
- **Pie** `store-footer.tsx`: columnas con los enlaces reales de la tienda (inicio, productos, categorías). Sin enlaces `#`.
- `ProductHero` acepta `primary`/`secondary` (con destino) además de `buttons` (la home genérica sigue igual).
- El `<main>` del layout ya no impone contenedor: cada página pone su ancho (la home usa secciones a pantalla completa).
- Claves nuevas de i18n en los 5 idiomas: `store.learnMore`, `bagTitle`, `bagEmpty`, `bagSoon`, `footerShop`.
- Los productos todavía no tienen imágenes (DT-SEO-09): las secciones muestran un bloque "Sin imagen".
- La home genérica (`(site)`) conserva `Header`/`Footer`/`ShoppingBagModal` con datos de ejemplo y textos en inglés; no es parte de las tiendas.

## Cuenta, bolsa, checkout y pedidos (2026-10-16)

Dentro de /{locale}/{slug}, `CommerceProvider` (components/commerce) maneja el cliente, la bolsa y el cliente tRPC de ESA tienda:
- **Navbar** (`commerce/store-header.tsx`): un único **avatar**. Sin sesión abre "Continuar con Google". Con sesión abre un panel con la cuenta, la bolsa (ítems, quitar, subtotal, "Finalizar compra"), "Mis pedidos" y "Cerrar sesión". Ya no hay ícono de bolsa aparte.
- **Producto**: `AddToCart` (variante + cantidad). Sin cliente ingresado abre el diálogo y completa la acción al terminar.
- **/checkout**: dirección de envío → `customer.checkout` (reserva stock, crea el pedido en PENDING_PAYMENT). **No hay pago en línea**: el texto lo dice y la tienda coordina el cobro.
- **/pedidos**: historial (`customer.orders`) con estado traducido, ítems, dirección y total. Ambas páginas son `noindex`.
- localStorage con clave por organización solo para el carrito (`store:{orgId}:cartId|sessionId`). La identidad la mantiene Firebase. El precio de la bolsa sale de la variante (cart-math.ts).
- Sin las variables de Firebase el ingreso queda deshabilitado con un mensaje (no rompe la tienda).

## Estado de migración pendiente

- `lib/store/client.ts` — fetch REST manual a eliminar → reemplazar por tRPC server caller
- `lib/store/resolver.ts` — `resolveStore()` via REST → reemplazar por `trpc.customer.resolveStore`
- `lib/ecommerce/index.ts` — shim legacy → eliminar cuando migren páginas `/categoria/` y `/products/`
- `context/customer-context.tsx` — usa `identifyCustomer()` via REST → migrar a `trpc.customer.identify`

## Mocks pendientes (capa 4, presentación)

- `components/checkout/checkout-flow.tsx` — simula WebAuthn, bloqueado hasta `pagos-back`
- `lib/services/shipping-service.ts` / `lib/adapters/*` — stubs, bloqueado hasta APIs courier

## UI

Todos los componentes desde `@real/ui`. `lib/utils.ts` re-exporta `cn` desde `@real/ui`.
