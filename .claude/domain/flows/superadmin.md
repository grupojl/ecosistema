# Flow: Superadmin — Operación interna

> Estado: 🔲 Por completar
> Servicios: `realsass-sass-back` (internal API)
> Usuarios: equipo interno

---

## Quién lo recorre

El equipo interno que opera la plataforma:
crea organizaciones, gestiona planes, depura tenants, controla mercados globales.

---

## Endpoints internos activos

| Endpoint | Método | Uso |
|---------|--------|-----|
| `/internal/organizations` | GET / POST / PATCH | CRUD de organizaciones |
| `/internal/markets` | GET / POST / PATCH | Gestión de mercados globales |

**Autenticación:** `INTERNAL_API_KEY` header — no Firebase.

---

## Flujos

### Crear organización manualmente
```
TODO: cuándo se usa (migración, cliente enterprise),
qué campos son obligatorios, qué se auto-genera.
```

### Gestionar mercados globales
```
TODO: cómo se activa/desactiva un mercado para todos los tenants.
Impacto en storefronts activos.
```

### Debug de tenant
```
TODO: herramientas internas para inspeccionar estado de una org
(logs, flags activos, quotas actuales, últimas transacciones).
```

---

## Invariantes

- Internal API nunca accesible sin INTERNAL_API_KEY válida
- Cambios de mercados globales son aditivos — no rompen storefronts activos
- Una organización desactivada no puede recibir nuevos pedidos
