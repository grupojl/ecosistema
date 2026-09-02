# Módulos del ecosistema — glosario de negocio

Esta carpeta explica qué hace cada pieza del sistema en lenguaje simple.
No hace falta saber programar para entender estos archivos.
Están pensados para que cualquier persona del equipo pueda leerlos y
saber exactamente para qué sirve cada módulo y qué problema resuelve.

## Cómo está organizado el ecosistema

El sistema tiene **dos motores principales** (backends) y **tres pantallas** (frontends):

### Los dos motores
- `sass-back` → todo lo que tiene que ver con la cuenta, la organización y su configuración
- `ecommerce-back` → todo lo que tiene que ver con la tienda: productos, stock, pedidos

### Las tres pantallas
- `sass-front` → la landing pública + el panel del dueño de la organización
- `dashboard-front` → el panel de los colaboradores (empleados/socios)
- `ecommerce-front` → la tienda que ven los clientes finales

### Las piezas compartidas (packages)
- `@real/auth-client` → todo lo de "iniciar sesión" en las 3 pantallas
- `@real/auth-server` → todo lo de "verificar quién sos" en los 2 motores
- `@real/trpc` → el "contrato" tipado entre motores y pantallas
- `@real/ui` → los botones, formularios y componentes visuales de las 3 pantallas

## Índice completo

### Pantalla del dueño (sass-front)
- [Resumen general](sass-front/README.md) — qué es y cómo funciona
- [Perfil del dueño](sass-front/perfil.md) — organización, colaboradores, afiliado
- [Configuración](sass-front/configuracion.md) — flags, temas, webhooks, secretos
- [Landing](sass-front/landing.md) — página pública de presentación

### Panel de colaboradores (dashboard-front)
- [Resumen general](dashboard-front/README.md) — qué es y cómo funciona
- [Tienda](dashboard-front/tienda.md) — productos, pedidos, preview
- [Chat IA](dashboard-front/chat.md) — asistente de inteligencia artificial
- [Configuración](dashboard-front/configuracion.md) — flags, temas, webhooks

### Tienda pública (ecommerce-front)
- [Resumen general](ecommerce-front/README.md) — qué es y cómo funciona
- [Flujo del cliente](ecommerce-front/storefront.md) — cómo compra un cliente
- [Carrito](ecommerce-front/carrito.md) — cómo funciona el carrito

### Motor de organización (sass-back)
- [auth](sass-back/auth.md) · [users](sass-back/users.md) · [organizations](sass-back/organizations.md)
- [collaborators](sass-back/collaborators.md) · [affiliate](sass-back/affiliate.md)
- [config-flags](sass-back/config-flags.md) · [config-quotas](sass-back/config-quotas.md)
- [config-themes](sass-back/config-themes.md) · [config-webhooks](sass-back/config-webhooks.md)
- [config-secrets](sass-back/config-secrets.md) · [config-templates](sass-back/config-templates.md)
- [config-audit](sass-back/config-audit.md)

### Motor de tienda (ecommerce-back)
- [catalog](ecommerce-back/catalog.md) · [inventory](ecommerce-back/inventory.md)
- [cart](ecommerce-back/cart.md) · [orders](ecommerce-back/orders.md)
- [customers](ecommerce-back/customers.md) · [store](ecommerce-back/store.md)
- [activity](ecommerce-back/activity.md)

### Piezas compartidas (packages)
- [@real/auth-client](packages/auth-client.md) · [@real/auth-server](packages/auth-server.md)
- [@real/trpc](packages/trpc.md) · [@real/ui](packages/ui.md)
