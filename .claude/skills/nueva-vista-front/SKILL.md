---
name: nueva-vista-front
description: Usar al crear o modificar una página, vista o componente con datos en realsass-sass-front, realsass-dashboard-front o real-ecommerce-front (storefront). Aplica el modelo de rendering de Next.js App Router, los tres estados obligatorios y el norte de UI de domain/ui-front.md.
---

# Nueva vista en un front

## Modelo de rendering (no negociable)

```
Server Component (por defecto, sin 'use client')
  → await createServerCaller().<router>.<procedure>(...)
  → <HydrationBoundary state={dehydrate(queryClient)}> <ClientComponent/> </HydrationBoundary>
Client Component ('use client', solo si hay interactividad; justificarlo en un comentario)
  → trpc.<router>.<procedure>.useQuery()   ← misma queryKey que el prefetch; rehidrata
```

Prohibido: `fetch` manual, `useEffect` para traer datos, datos mock inline, `firebase/auth` importado directo
(se usa `@real/auth-client`), tipos de dominio escritos a mano (se infieren con `inferRouterOutputs`).

## Los tres estados, siempre

`loading` → `<Skeleton/>` · `error` → `<ErrorState/>` · sin datos → estado vacío. Una vista sin ellos está incompleta.

## Storefront (real-ecommerce-front)

- Las páginas son Server Components: usar `requireStore(slug)`, **nunca** `useStore()` (hook de cliente; rompe con
  "Attempted to call useStore() from the server" y el typecheck no lo detecta).
- Errores (ADR-016): `NOT_FOUND` → 404; **cualquier otra falla → 5xx**, jamás `catch {}` que devuelva `null` (una caída del back
  se convertiría en un 404 masivo y Google borraría el índice).
- El idioma va en la URL (`/{es|pt|en}/tienda/{slug}/…`); una URL con idioma nunca redirige.
- El tema del tenant sobrescribe los tokens base: no fijar colores en los componentes.

## UI (ver `domain/ui-front.md`)

- Usar **tokens semánticos** de `globals.css` (`--background`, `--primary`, `--radius`…) y componentes de `@real/ui`. Nada de colores ni
  medidas sueltas. Los valores marcados `TODO` en `ui-front.md` aún no están decididos: **no inventarlos**; usar los existentes y avisar.
- Adaptación nativa: navegación sidebar → riel → pestañas; modal → *sheet*; tabla → tarjetas; áreas táctiles de 44 px; sin acciones solo-hover.
- Accesibilidad: foco visible, uso con teclado, contraste, etiquetas, `prefers-reduced-motion`.

## Verificación final

- [ ] `pnpm --filter <front> lint` y `typecheck`
- [ ] `pnpm --filter <front> build` (detecta errores de Server/Client que el typecheck no ve)
- [ ] Storefront: `pnpm --filter real-ecommerce-front test` (vitest) y, si es una página nueva, un test de render
- [ ] Revisada en los **tres anchos** (desktop, tablet, mobile) y con loading/error/vacío forzados
- [ ] Sin hallazgos de `bash scripts/audit/run.sh arquitectura`

## Pendiente conocido

Aún no hay Playwright ni axe en CI (`deuda-tecnica.md`, DT-TEST-02 / DT-Q-17): la accesibilidad y los flujos se revisan a mano hasta entonces; decirlo en el reporte.

## Mantenimiento

Depende de `architecture/02-frontend-capas.md`, ADR-016, ADR-019 y `domain/ui-front.md` (cuando se cierren los tokens, reemplazar el párrafo "no inventarlos" por los valores).
