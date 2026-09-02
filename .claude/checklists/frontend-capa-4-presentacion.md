# Frontend Capa 4 — Presentación (componentes sin mocks)
# Checklist 10/10

**Score actual: 7/10 — nivel startup madura+**
**Score objetivo: 10/10 — nivel Shopify storefront**
**Última actualización:** 2026-09-02

## ✅ Completado

- [x] Skeleton + ErrorState + data — 3 estados en todas las páginas con datos async
- [x] `error.tsx` global en raíz de cada app (error boundary Next.js)
- [x] `@real/ui` como fuente única — 33 componentes, sin duplicación entre fronts
- [x] Sin arrays literales inline con datos de producción
- [x] Componentes legacy de dominio real-estate eliminados (ADR-008)
  → `components/catalog/` — eliminado (5 archivos)
  → `components/product/` — eliminado (5 archivos)
  → `types/product.ts` — eliminado (tipos hardcodeados)
- [x] `components/header.tsx` — sin import de `@/lib/ecommerce` (ADR-008)
- [x] Solo componentes vivos en el storefront:
  → `checkout-flow.tsx` — stub documentado (espera `pagos-back`)
  → `tracking-view.tsx` — funcional
  → `product-hero.tsx` — funcional (landing)
  → `shopping-bag-modal.tsx` — funcional
  → `header.tsx` — corregido
  → `footer.tsx` — funcional

## ⏳ Pendiente para 10/10

### Mocks bloqueados por servicios externos
- [ ] `checkout-flow.tsx` — simula WebAuthn → bloqueado hasta `pagos-back`
- [ ] `lib/adapters/correo-adapter.ts` / `envia-adapter.ts` / `welivery-adapter.ts`
  → stubs con pricing hardcodeado → bloqueados hasta APIs de courier

### Componentes de storefront con tipos correctos (post-limpieza)
- [ ] Las páginas `/tienda/[slug]/` tienen JSX inline — cuando el design system
  del storefront esté definido, extraer componentes con tipos de `EcommerceAppRouter`
  → `StoreProduct`, `StoreCategory` desde `lib/trpc/types.ts`
  → nunca desde `@/types/product` ni datos hardcodeados

### Tests de componentes (S4)
- [ ] React Testing Library: componentes críticos con los 3 estados
  → loading (skeleton visible), error (mensaje visible), data (contenido correcto)
- [ ] Vitest: unit tests de funciones de utilidad (formatters, validators)
- [ ] Playwright E2E: flujo completo de compra en ecommerce-front
- [ ] Playwright E2E: flujo de invitación de colaborador en sass-front

### Enforcement CI (S4)
- [ ] ESLint rule `@real/no-inline-mock-data`
  → Detecta arrays con > 2 objetos literales en componentes fuera de `*.stories.tsx`

## Contrato de UI — los 3 estados son obligatorios

```tsx
// ✅ CORRECTO
if (isLoading) return <Skeleton />
if (error)     return <ErrorState message={getErrorMessage(error)} />
return <ComponenteConDatos data={data} />

// ❌ PROHIBIDO — estado de error ignorado
return <div>{data?.items?.map(...) ?? null}</div>
```

## Regla dura — nuevos componentes de storefront

Todo componente nuevo que muestre datos del ecommerce:
- Tipos desde `inferRouterOutputs<EcommerceAppRouter>` vía `@/lib/trpc/types.ts`
- Nunca desde `@/types/product` ni archivos de datos hardcodeados
- Siempre los 3 estados: loading → skeleton, error → alert, data → render
