# Flows — Cómo leer este directorio

## Qué son los flows

Cada archivo describe un flujo de usuario de extremo a extremo —
desde la acción del usuario hasta los servicios que se invocan
y la pantalla resultante.

No son diagramas técnicos de secuencia. Son la experiencia del usuario
mapeada contra el sistema real.

## Formato de cada flow

```
## Quién lo recorre
El usuario y su contexto.

## Pantallas involucradas
Lista de pantallas con su servicio de origen.

## Pasos
1. Usuario hace X en [pantalla] → [servicio] hace Y → usuario ve Z

## Estados alternativos
Qué pasa si algo falla en cada paso.

## Invariantes
Lo que nunca debe ocurrir en este flujo.
```

## Archivos

| Flow | Usuarios | Servicios | Estado |
|------|----------|-----------|--------|
| `saas-onboarding.md` | Nuevo tenant | sass-back + sass-front | 🔲 |
| `tenant-store.md` | Tenant activo | sass-back + dashboard-front + ecommerce-back | 🔲 |
| `storefront-buy.md` | Comprador | ecommerce-back + ecommerce-front | 🔲 |
| `dashboard-ops.md` | Tenant operando | dashboard-front + ecommerce-back + sass-back | 🔲 |
| `superadmin.md` | Admin interno | sass-back (internal API) | 🔲 |
