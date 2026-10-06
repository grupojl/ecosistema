# Flow: Dashboard — Operación diaria del tenant

> Estado: 🔲 Por completar
> Servicios: `realsass-dashboard-front` · `realsass-ecommerce-back` · `realsass-sass-back`
> Usuarios: tenant gestionando su tienda activa

---

## Quién lo recorre

El tenant que ya tiene su tienda live y la opera día a día:
pedidos, stock, configuración, métricas, campañas, chat IA.

---

## Pantallas involucradas

| Pantalla | Ruta | Servicio |
|---------|------|---------|
| Home | `/dashboard` | dashboard-front → sass-back |
| Pedidos | `/dashboard/tienda/pedidos` | dashboard-front → ecommerce-back |
| Productos | `/dashboard/tienda/productos` | dashboard-front → ecommerce-back |
| Pagos | `/dashboard/pagos` | dashboard-front → sass-back |
| Campañas | `/dashboard/campanas` | dashboard-front → sass-back |
| Chat IA | `/dashboard/chat` | dashboard-front → chatia (servicio externo) |
| Flags | `/dashboard/configuracion/flags` | dashboard-front → sass-back |
| Quotas | `/dashboard/configuracion/quotas` | dashboard-front → sass-back |
| Tema | `/dashboard/configuracion/tema` | dashboard-front → sass-back |
| Webhooks | `/dashboard/configuracion/webhooks` | dashboard-front → sass-back |
| Zonas de envío | `/dashboard/zonas` | dashboard-front → ecommerce-back |

---

## Flujos críticos por completar

### Gestión de pedidos
```
TODO: cómo el tenant filtra, ve el detalle y actualiza estado de un pedido.
```

### Gestión de productos
```
TODO: crear, editar, archivar. Límites de quota. Reflejo en storefront.
```

### Webhooks
```
TODO: cómo el tenant conecta su sistema externo con eventos del ecommerce.
Qué eventos dispara la plataforma.
```

---

## Invariantes

- Un tenant solo ve datos de su propia organización (RBAC en sass-back)
- Acciones de collaborator limitadas por rol
- Cambios de tema en dashboard se reflejan en storefront sin redeploy
