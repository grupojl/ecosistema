# Flow: Configuración de tienda → Storefront live

> Estado: 🔲 Por completar
> Servicios: `realsass-sass-back` · `realsass-dashboard-front` · `realsass-ecommerce-back`
> Usuarios: tenant configurando su tienda por primera vez

---

## Quién lo recorre

El tenant que completó el onboarding y quiere su storefront público funcionando.

---

## Pantallas involucradas

| Pantalla | Ruta | Servicio |
|---------|------|---------|
| Dashboard home | `/dashboard` | dashboard-front → sass-back |
| Tema | `/dashboard/configuracion/tema` | dashboard-front → sass-back (config-themes) |
| Productos | `/dashboard/tienda/productos` | dashboard-front → ecommerce-back (catalog) |
| Preview | `/dashboard/tienda/preview` | dashboard-front → ecommerce-front |
| Storefront público | `[locale]/tienda/[slug]` | ecommerce-front → ecommerce-back |

---

## Pasos

```
1. Tenant en /dashboard
   → TODO

2. Configurar tema (colores, logo)
   → sass-back guarda en config-themes
   → TODO: ¿se aplica en tiempo real al storefront o requiere acción?

3. Agregar primer producto
   → ecommerce-back: catalog + inventory
   → TODO: ¿hay límite por plan? (quotas en sass-back)

4. Configurar mercados (moneda, idioma, país)
   → sass-back markets
   → TODO: ¿es obligatorio antes de publicar?

5. Preview → live
   → TODO: ¿hay un paso de "publicar" explícito o es automático?
```

---

## Invariantes

- Un storefront nunca se sirve sin `organizationId` válido
- Productos sin stock no se muestran en el storefront público
- Mercados inactivos no generan URLs accesibles
- El tema del tenant sobreescribe los tokens base del storefront en runtime
