# Frontend Capa 3 — Zustand (estado UI puro)
# Checklist 10/10

**Score actual: 8.5/10 — nivel Notion/Figma**
**Score objetivo: 10/10**

## ✅ Completado

- [ ] `useShoppingBagStore` — modal open/close (ecommerce-front)
- [ ] `useSidebarStore` — sidebar mobile open/close (dashboard-front)
- [ ] `useUIStore` — login modal + bottom tab + mobile menu (sass-front)
- [ ] Stores contienen solo estado UI puro — sin datos de servidor duplicados

## ⏳ Pendiente para 10/10

### Enforcement (S4)
- [ ] Lint rule o code review check: campo en store que también existe en queryKey → bug
- [ ] Documentar qué estado va a Zustand vs TanStack Query en `conventions/state.md` — creado 2026-09-02

### Mejoras opcionales (S4)
- [ ] `zustand/middleware persist` para preferencias de UI que deben sobrevivir recarga
  → Ejemplos: tema seleccionado, sidebar colapsado/expandido por el usuario
  → Solo para preferencias — nunca para datos de servidor

## Regla dura

Zustand es para estado de UI puro: open/close, tabs activos, sidebar.
El dato (carrito, perfil, config) vive en TanStack Query — nunca duplicado en Zustand.
