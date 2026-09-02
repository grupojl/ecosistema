# Pantallas y breakpoints

## Breakpoints del sistema

Heredados de Tailwind CSS — no se customizan salvo necesidad documentada.

| Nombre | Breakpoint | Rango | Dispositivos típicos |
|---|---|---|---|
| `xs` (sin prefijo) | 0px | 0 – 639px | Teléfonos en portrait |
| `sm` | 640px | 640 – 767px | Teléfonos en landscape, tablets pequeñas |
| `md` | 768px | 768 – 1023px | Tablets en portrait |
| `lg` | 1024px | 1024 – 1279px | Tablets en landscape, laptops pequeñas |
| `xl` | 1280px | 1280 – 1535px | Laptops, desktops |
| `2xl` | 1536px | 1536px+ | Monitores grandes |

## Estrategia de diseño: Mobile First

Se diseña primero para el tamaño más chico y se va agregando complejidad
hacia arriba. En el código: `clase-base md:clase-tablet lg:clase-desktop`.

```tsx
// ✅ Correcto — mobile first
<div className="flex flex-col md:flex-row lg:gap-8">

// ❌ Evitar — diseñar solo para desktop
<div className="hidden lg:flex">
```

## Comportamiento por pantalla — cada app

### sass-front (landing + panel del dueño)

| Sección | Mobile (< 768px) | Tablet (768–1023px) | Desktop (1024px+) |
|---|---|---|---|
| Landing / hero | Stack vertical, CTA full-width | 2 columnas | 2 columnas, texto a la izquierda |
| Navbar | Hamburger menu | Hamburger o links | Links horizontales |
| Panel de perfil | Bottom tabs + drawer | Sidebar colapsable | Sidebar fijo |
| Formularios de config | Full width, scroll | Max 600px centrado | Max 720px centrado |
| Modales | Full screen drawer | Dialog centrado | Dialog centrado |

### dashboard-front (panel de colaboradores)

| Sección | Mobile (< 768px) | Tablet (768–1023px) | Desktop (1024px+) |
|---|---|---|---|
| Layout principal | Header + contenido full | Sidebar colapsable (240px) | Sidebar fijo (240px) |
| Tablas de datos | Cards apiladas | Tabla scrolleable | Tabla completa |
| Filtros | Drawer inferior | Sidebar de filtros | Inline sobre la tabla |
| Detalle de orden | Page nueva | Panel lateral | Panel dividido |

### ecommerce-front (tienda pública)

| Sección | Mobile (< 768px) | Tablet (768–1023px) | Desktop (1024px+) |
|---|---|---|---|
| Grilla de productos | 2 columnas | 3 columnas | 4 columnas |
| Detalle de producto | Stack vertical | 2 columnas (imagen + info) | 2 columnas con sticky |
| Carrito | Drawer lateral | Drawer lateral | Panel fijo derecha |
| Checkout | Steps a página completa | Steps centrados | 2 columnas (form + resumen) |
| Navbar | Logo + bag icon | Logo + búsqueda + bag | Logo + nav + búsqueda + bag |

## Anchos máximos de contenido

| Contexto | Max width | Tailwind class |
|---|---|---|
| Contenido de artículo / texto largo | 720px | `max-w-2xl` o `max-w-prose` |
| Formularios y panels de config | 640px | `max-w-xl` |
| Contenido de página normal | 1024px | `max-w-4xl` |
| Layout full con sidebar | 1280px | `max-w-5xl` o `max-w-6xl` |
| Landing / hero | Sin límite | `w-full` con padding lateral |

## Imágenes y assets

| Tipo | Formato recomendado | Tamaños a generar |
|---|---|---|
| Logo | SVG (vectorial) | 1 archivo, escala libre |
| Favicon | ICO + PNG 32x32 + PNG 180x180 | 3 archivos |
| Foto de producto | WebP | 400w, 800w, 1200w |
| Avatar de usuario | WebP / JPG | 64x64, 128x128 |
| Banner / hero | WebP | 768w, 1280w, 1920w |
| OG image (social) | JPG / PNG | 1200x630 fijo |

## Safe areas (mobile)

Para teléfonos con notch o home indicator:

```tsx
// Padding inferior para home indicator en iPhone
<div className="pb-safe"> // requiere plugin tailwindcss-safe-area

// O manualmente:
<div className="pb-6 md:pb-0">
```
