# ADR-008: Eliminar componentes legacy del storefront (dominio real-estate)

**Fecha:** 2026-09-02
**Estado:** Aceptado

## Contexto

`real-ecommerce-front` contiene dos familias de componentes que nacieron
en el dominio real-estate (el producto anterior) y nunca fueron limpiados
cuando el storefront migró al modelo multi-tenant con rutas `/tienda/[slug]/`.

### Familia 1 — components/catalog/

Componentes de catálogo con layout y comportamiento específico de real-estate:
- `catalog-header.tsx` — header con selector de modelos (real-estate)
- `catalog-lineup.tsx` — grilla con tipo `Product` de `@/lib/catalog-data`
- `catalog-closer-look.tsx` — sección de video/features
- `catalog-features.tsx` — lista de features con ícono SVG
- `catalog-footer.tsx` — footer de catálogo

### Familia 2 — components/product/

Componentes de detalle de producto con tipos del dominio real-estate:
- `product-gallery.tsx` — galería de imágenes estáticas
- `product-info.tsx` — info con `ColorOption`, `Product` de `@/types/product`
- `related-products.tsx` — grilla de `RelatedProduct` (tipo legacy)
- `whats-in-box.tsx` — lista de `BoxItem` (tipo legacy)
- `included-services.tsx` — lista de `Service` (tipo legacy)

Estos componentes dependen de `@/types/product` y `@/lib/catalog-data` —
tipos hardcodeados que no vienen de `inferRouterOutputs<EcommerceAppRouter>`.

### Por qué son código muerto

Al confirmar el análisis del código real (ecosistema.xml, 2026-09-02):

1. Las páginas `/app/categoria/[categoria]/page.tsx` y `/app/products/[handle]/page.tsx`
   que los importaban fueron reemplazadas por redirects 308 permanentes (ADR-006 + sesión Fase 1, 2026-09-02).

2. Las páginas canónicas `/app/tienda/[slug]/` **no los importan**:
   - `/tienda/[slug]/page.tsx` — Server Component con `@/lib/store` + JSX inline
   - `/tienda/[slug]/productos/page.tsx` — ídem
   - `/tienda/[slug]/productos/[handle]/page.tsx` — ídem
   - `/tienda/[slug]/categoria/[categoria]/page.tsx` — ídem

3. `grep` en todo `real-ecommerce-front` confirma: **0 importaciones activas**
   de estos 10 componentes en ninguna página viva.

### Problema adicional — header.tsx legacy

`components/header.tsx` (usado en `app/layout.tsx`) todavía importa de
`@/lib/ecommerce` (la función `getCategories`), que a su vez era un shim
de `lib/store/`. Con `lib/ecommerce/index.ts` eliminado, este import
rompe en build. El header del storefront público necesita migrar a
`@/lib/store` directamente o ser reemplazado por el header de cada página
`/tienda/[slug]/layout.tsx` que ya existe.

## Decisión

**Eliminar los 10 componentes muertos y los tipos legacy asociados.**

Los componentes del storefront multi-tenant viven en las páginas
`/tienda/[slug]/` como Server Components con JSX directo —
no necesitan componentes intermedios de presentación mientras
el design system esté en construcción. Cuando se necesite un componente
reutilizable para el storefront, se crea desde cero con tipos inferidos
de `EcommerceAppRouter`, no se migra el legacy.

### Archivos a eliminar

#### Componentes (10 archivos)
```
real-ecommerce-front/components/catalog/catalog-header.tsx
real-ecommerce-front/components/catalog/catalog-lineup.tsx
real-ecommerce-front/components/catalog/catalog-closer-look.tsx
real-ecommerce-front/components/catalog/catalog-features.tsx
real-ecommerce-front/components/catalog/catalog-footer.tsx
real-ecommerce-front/components/product/product-gallery.tsx
real-ecommerce-front/components/product/product-info.tsx
real-ecommerce-front/components/product/related-products.tsx
real-ecommerce-front/components/product/whats-in-box.tsx
real-ecommerce-front/components/product/included-services.tsx
```

#### Tipos legacy (si quedan huérfanos tras eliminar los componentes)
```
real-ecommerce-front/types/product.ts   → verifica 0 usos antes de eliminar
real-ecommerce-front/lib/catalog-data.ts → verifica 0 usos antes de eliminar
```

#### Directorios vacíos (si quedan vacíos)
```
real-ecommerce-front/components/catalog/   → eliminar si queda vacío
real-ecommerce-front/components/product/   → eliminar si queda vacío
```

### Archivos a corregir (no eliminar)

**`components/header.tsx`** — migrar `getCategories` de `@/lib/ecommerce`
a `@/lib/store` directamente. Es el único header vivo del layout raíz
del storefront y necesita usar el canal canónico.

### Archivos que NO se tocan

| Componente | Por qué se mantiene |
|---|---|
| `components/checkout/checkout-flow.tsx` | Stub esperando `pagos-back` — documentado en deuda |
| `components/tracking/tracking-view.tsx` | Funcional, usado en `app/tracking/` |
| `components/product-hero.tsx` | Usado en `app/page.tsx` (landing del storefront) |
| `components/shopping-bag-modal.tsx` | Usado en `components/header.tsx` |
| `components/header.tsx` | Usado en `app/layout.tsx` — corregir, no eliminar |
| `components/footer.tsx` | Usado en `app/layout.tsx` |

## Alternativas descartadas

**Alternativa 1: Migrar los componentes a tipos de `EcommerceAppRouter`**
Descartado — los componentes tienen UI específica del dominio real-estate
(layout de modelos, selección de color, grilla de variantes) que no corresponde
al storefront genérico multi-tenant. Migrarlos implicaría reescribirlos desde
cero de todos modos — es más limpio eliminar y crear cuando se necesite.

**Alternativa 2: Moverlos a una carpeta `legacy/` o `deprecated/`**
Descartado — código muerto con otro nombre sigue siendo código muerto. Agrega
confusión sobre qué está activo. El ADR es la documentación de que existieron;
no necesitan existir en el repo.

**Alternativa 3: Mantenerlos como referencia de diseño**
Descartado — el sistema de diseño vive en `@real/ui` (33 componentes shadcn).
Los componentes del storefront multi-tenant se construyen con `@real/ui` + tipos
de `EcommerceAppRouter`. Los componentes legacy son ruido, no referencia.

## Consecuencias

**Ganancia:**
- 0 archivos con tipos `@/types/product` (legacy real-estate) en el monorepo
- 0 referencias a `@/lib/catalog-data` (datos hardcodeados)
- `components/catalog/` y `components/product/` vacíos → eliminados
- El storefront queda con componentes vivos únicamente
- Superficie de código reducida: menos archivos que leer al hacer onboarding
- Frontend Capa 4 sube de 6/10 a 7/10 — código muerto era parte del score bajo

**Costo / deuda técnica consciente:**
- Las páginas `/tienda/[slug]/` quedan con JSX inline sin componentes
  de presentación dedicados. Esto es aceptable mientras el design system
  del storefront no esté definido. Cuando se necesiten, se crean con
  tipos correctos desde el inicio.
- `checkout-flow.tsx` sigue siendo un stub — no se puede resolver hasta
  que exista `pagos-back`. Documentado en `roadmap/deuda-tecnica.md`.

## Orden de ejecución (para el x.sh de limpieza)

1. Verificar 0 imports activos de cada componente (`grep -r`)
2. Eliminar los 10 componentes de `components/catalog/` y `components/product/`
3. Verificar si `@/types/product` tiene otros consumers — eliminar si no
4. Verificar si `@/lib/catalog-data` tiene otros consumers — eliminar si no
5. Eliminar directorios vacíos `catalog/` y `product/`
6. Corregir `components/header.tsx`: `@/lib/ecommerce` → `@/lib/store`
7. Actualizar `checklists/frontend-capa-4-presentacion.md` con score 7/10

## Referencias

- `real-ecommerce-front/app/tienda/[slug]/` — rutas canónicas (sin componentes legacy)
- `real-ecommerce-front/components/checkout/checkout-flow.tsx` — stub documentado
- `decisions/ADR-005-rest-to-trpc.md` — migración REST → tRPC que dejó los componentes huérfanos
- `decisions/ADR-006-front-cleanup.md` — limpieza anterior de lib/api.ts
- `checklists/frontend-capa-4-presentacion.md` — score 6/10 → 7/10 tras esta limpieza
- `roadmap/deuda-tecnica.md` — checkout-flow.tsx como deuda consciente
