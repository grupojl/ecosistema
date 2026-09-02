# Design Tokens

Los tokens son los valores concretos del sistema de diseño.
Viven como variables CSS en `packages/ui/src/globals.css` y se extienden
en los `tailwind.config.ts` de cada front.

## Cómo aplicar los tokens

### 1. globals.css (en packages/ui/src/)

```css
:root {
  /* Colores de marca */
  --color-primary:       #______;
  --color-primary-dark:  #______;
  --color-primary-light: #______;
  --color-secondary:     #______;
  --color-accent:        #______;

  /* Neutros */
  --background:          #______;
  --surface-1:           #______;
  --surface-2:           #______;
  --border:              #______;
  --border-strong:       #______;

  /* Texto */
  --text-primary:        #______;
  --text-secondary:      #______;
  --text-muted:          #______;

  /* Semánticos */
  --bg-success:          #______;
  --text-success:        #______;
  --bg-warning:          #______;
  --text-warning:        #______;
  --bg-danger:           #______;
  --text-danger:         #______;
  --bg-accent:           #______;
  --text-accent:         #______;
  --border-accent:       #______;

  /* Radios */
  --radius:              ______px; /* radio base de bordes redondeados */
  --radius-sm:           ______px;
  --radius-lg:           ______px;
  --radius-full:         9999px;

  /* Sombras */
  --shadow-sm:           ______;
  --shadow-md:           ______;
  --shadow-lg:           ______;

  /* Tipografía */
  --font-sans:           '______', system-ui, sans-serif;
  --font-display:        '______', system-ui, sans-serif;
  --font-mono:           '______', monospace;
}

.dark {
  /* Sobreescribir variables para modo oscuro */
  --background:          #______;
  --surface-1:           #______;
  /* ... */
}
```

### 2. tailwind.config.ts (en cada front)

```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:    'var(--color-primary)',
        secondary:  'var(--color-secondary)',
        accent:     'var(--color-accent)',
        background: 'var(--background)',
        surface:    {
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
        },
        border:     'var(--border)',
      },
      fontFamily: {
        sans:    ['var(--font-sans)'],
        display: ['var(--font-display)'],
        mono:    ['var(--font-mono)'],
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm:      'var(--radius-sm)',
        lg:      'var(--radius-lg)',
        full:    'var(--radius-full)',
      },
    },
  },
} satisfies Config
```

## Espaciado

El sistema de espaciado usa la escala estándar de Tailwind (múltiplos de 4px).
No se definen tokens custom de espaciado salvo excepciones documentadas.

| Token Tailwind | Valor | Uso común |
|---|---|---|
| `p-1` / `gap-1` | 4px | Espaciado mínimo interno |
| `p-2` / `gap-2` | 8px | Entre elementos inline |
| `p-3` / `gap-3` | 12px | Padding de badge, chip |
| `p-4` / `gap-4` | 16px | Padding estándar de card |
| `p-6` / `gap-6` | 24px | Padding de sección |
| `p-8` / `gap-8` | 32px | Padding de página |
| `p-12` | 48px | Separación entre secciones |
| `p-16` | 64px | Separación grande (landing) |

## Z-index

| Nombre | Valor | Uso |
|---|---|---|
| `z-0` | 0 | Base |
| `z-10` | 10 | Cards flotantes |
| `z-20` | 20 | Dropdowns, popovers |
| `z-30` | 30 | Sticky headers |
| `z-40` | 40 | Drawers, sheets |
| `z-50` | 50 | Modales, dialogs |
| `z-[100]` | 100 | Toasts, notificaciones |
