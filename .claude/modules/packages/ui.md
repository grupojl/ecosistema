# Package: @real/ui (los componentes visuales)

## ¿Qué hace en palabras simples?

Es la caja de Legos visual del ecosistema. Contiene todos los botones,
formularios, tablas, modales, selectores y componentes visuales que se usan
en las tres pantallas. En lugar de diseñar un botón diferente en cada pantalla,
hay un solo botón que todas usan.

## ¿Qué problemas resuelve?

- "El botón de sass-front se ve diferente al de dashboard-front" → un solo botón para todos
- "Cambié el color primario, ¿cómo lo actualizo en todas las pantallas?" → se cambia en un solo lugar
- "Necesito un componente nuevo" → se agrega al package y todas las pantallas lo tienen

## Componentes disponibles (33)

Botones, alertas, diálogos, cajitas de avatar, badges, tarjetas, checkboxes,
menús desplegables, inputs de texto, labels, menús de navegación, barras de progreso,
selectores, separadores, drawers laterales, skeletons de carga, sliders,
switches, tablas, pestañas, áreas de texto, toasts de notificación (sonner),
tooltips, y más.

## ¿Cómo se usa?

```tsx
import { Button, Dialog, Avatar } from '@real/ui'
```

## Estado actual

✅ Completo. 33 componentes shadcn instalados con pnpm dlx shadcn@4.18.0.
Fuente única para las 3 pantallas. Las carpetas `components/ui/` locales fueron eliminadas.
