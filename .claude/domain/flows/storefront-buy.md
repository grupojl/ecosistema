# Flow: Storefront — Visitante → Compra completada

> Estado: 🔲 Por completar
> Servicios: `realsass-ecommerce-back` · `real-ecommerce-front`
> Usuarios: comprador en el storefront público

---

## Quién lo recorre

Visitante que llegó al storefront de una tienda. Puede estar logueado o no.
Mobile o desktop. Cualquier país e idioma.

---

## Pantallas involucradas

| Pantalla | Ruta | Servicio |
|---------|------|---------|
| Home tienda | `[locale]/tienda/[slug]` | ecommerce-front → ecommerce-back |
| Categoría | `[locale]/tienda/[slug]/categoria/[cat]` | ecommerce-front → ecommerce-back |
| Producto | `[locale]/tienda/[slug]/productos/[handle]` | ecommerce-front → ecommerce-back |
| Checkout | `/checkout` | ecommerce-front → ecommerce-back |
| Tracking | `/tracking` | ecommerce-front → ecommerce-back |

---

## Pasos

```
1. Visitante llega al storefront
   → Market resolver detecta país → asigna moneda y región
   → i18n negocia idioma (Accept-Language header)
   → TODO: ¿tema del tenant se carga dinámicamente?

2. Navega y agrega al carrito
   → Cart en Zustand (cliente)
   → TODO: ¿carrito persiste entre sesiones? ¿requiere login?

3. Checkout
   → TODO: ¿guest checkout o requiere cuenta?
   → Selección shipping (correo-adapter / envia-adapter / welivery-adapter)
   → TODO: ¿qué métodos de pago están disponibles?

4. Pago
   → ecommerce-back → sass-back (pasarela)
   → TODO: ¿el pago pasa por ecommerce-back o directo a sass-back?

5. Confirmación
   → Orden creada en ecommerce-back
   → TODO: ¿email de confirmación? ¿qué servicio lo envía?
   → Redirect a /tracking
```

---

## Invariantes

- Precio mostrado al visitante nunca difiere del precio cobrado
- Producto sin stock no puede completar checkout
- Carrito no puede mezclar productos de organizaciones distintas
- Moneda del checkout siempre es la del market resuelto al entrar a la tienda
