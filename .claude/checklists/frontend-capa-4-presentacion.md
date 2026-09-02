# Frontend Capa 4 — Presentación (componentes sin mocks)
# Checklist 10/10

**Score actual: 6/10 — nivel startup madura**
**Score objetivo: 10/10 — nivel Shopify storefront**

## ✅ Completado

- [x] Skeleton + ErrorState + data — 3 estados en páginas migradas
- [x] `error.tsx` global en raíz de cada app (error boundary Next.js)
- [x] `@real/ui` como fuente única — 33 componentes, sin duplicación entre fronts
- [x] Sin arrays literales inline con datos de producción

## ⏳ Pendiente para 10/10

### Mocks bloqueados por servicios externos
- [ ] `checkout-flow.tsx` — simula WebAuthn → bloqueado hasta `pagos-back`
- [ ] `lib/adapters/correo-adapter.ts` / `envia-adapter.ts` / `welivery-adapter.ts`
  → stubs con pricing hardcodeado → bloqueados hasta APIs de courier

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
