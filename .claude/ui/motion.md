# Animaciones y movimiento

## Principio general

Las animaciones son para dar feedback, no para llamar la atención.
Una animación bien hecha no se nota — solo hace que la interfaz se sienta fluida.

## Librería: Framer Motion

El ecosistema usa `framer-motion` para animaciones de componentes React.
Las transiciones de CSS (hover, focus) van con Tailwind (`transition`, `duration-*`).

```tsx
import { motion, AnimatePresence } from 'framer-motion'
```

## Duraciones estándar

| Tipo | Duración | Uso |
|---|---|---|
| Micro (feedback inmediato) | 100–150ms | Hover, focus, click |
| Corta (elemento aparece) | 150–200ms | Tooltips, dropdowns, badges |
| Media (cambio de vista) | 200–300ms | Modales, drawers, page transitions |
| Larga (onboarding, empty state) | 400–600ms | Primeras cargas, ilustraciones |

**Regla:** nada que el usuario tenga que esperar para interactuar debería durar más de 300ms.

## Easing estándar

| Nombre | Valor | Uso |
|---|---|---|
| `ease-out` | `[0, 0, 0.2, 1]` | Elementos que entran (aparecen) |
| `ease-in` | `[0.4, 0, 1, 1]` | Elementos que salen (desaparecen) |
| `ease-in-out` | `[0.4, 0, 0.2, 1]` | Elementos que cambian de estado |
| `spring` | `{ type: "spring", stiffness: 300, damping: 30 }` | Interacciones táctiles, drag |

## Variantes reutilizables

```tsx
// Fade in simple — para elementos que aparecen
const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
  transition: { duration: 0.15 }
}

// Slide desde abajo — para modales, drawers, toasts
const slideUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: 16 },
  transition: { duration: 0.2, ease: 'easeOut' }
}

// Slide desde la derecha — para cambio de vista (profile sections)
const slideRight = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0  },
  exit:    { opacity: 0, x: -16 },
  transition: { duration: 0.15 }
}

// Scale — para confirmaciones, íconos de éxito
const scaleIn = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1,   opacity: 1 },
  transition: { type: 'spring', stiffness: 400, damping: 25 }
}
```

## AnimatePresence — para montar/desmontar

```tsx
// Siempre envolver con AnimatePresence cuando el componente puede desaparecer
<AnimatePresence mode="wait">
  {isVisible && (
    <motion.div key="unico" {...fadeIn}>
      contenido
    </motion.div>
  )}
</AnimatePresence>
```

## Transiciones CSS con Tailwind

Para hover y focus — no usar Framer Motion, usar Tailwind:

```tsx
// ✅ Hover con Tailwind
<button className="transition-colors duration-150 hover:bg-accent">

// ✅ Transformaciones simples con Tailwind
<div className="transition-transform duration-200 hover:scale-105">

// ❌ No usar Framer Motion para hover states — es innecesario
```

## Reglas de accesibilidad

- Respetar `prefers-reduced-motion` — Framer Motion lo hace automáticamente
- Nunca usar `animation: infinite` en elementos de contenido (solo en loaders)
- El spinner de carga (`Loader2 animate-spin`) es la única animación infinita permitida en UI

## Qué no animar

- ❌ Tablas y listas largas — demasiado ruido visual
- ❌ Cada item de una lista individualmente (solo el contenedor)
- ❌ Elementos que el usuario no vio aparecer (no tiene sentido animar si ya estaba)
- ❌ Formularios — el usuario está trabajando, no mirando animaciones
