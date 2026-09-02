# UI — Identidad de marca y sistema de diseño

Esta carpeta define cómo se ve y se siente el ecosistema.
Es la fuente de verdad para cualquier decisión visual — colores, tipografía,
espaciado, íconos y cómo se comporta el diseño en distintos tamaños de pantalla.

Cuando se reutiliza el ecosistema para una marca nueva, este directorio
es lo primero que se completa. El resto del código ya respeta estas definiciones.

## Índice

| Archivo | Qué define |
|---|---|
| [brand.md](brand.md) | Nombre, logo, colores, tipografía, tono de voz |
| [tokens.md](tokens.md) | Variables de diseño — los valores numéricos y hexadecimales concretos |
| [screens.md](screens.md) | Breakpoints y comportamiento en mobile, tablet y desktop |
| [components.md](components.md) | Guía de uso de los 33 componentes de @real/ui |
| [icons.md](icons.md) | Set de íconos, criterios de uso y tamaños |
| [motion.md](motion.md) | Animaciones, transiciones y durations |

## Cómo usar estos archivos

1. Al empezar un proyecto nuevo, completar `brand.md` con los valores de la marca
2. Trasladar esos valores a `tokens.md` como variables CSS
3. Aplicar los tokens en `packages/ui/src/globals.css`
4. El resto del código los consume automáticamente vía Tailwind + shadcn

## Relación con el código

```
brand.md + tokens.md
  → packages/ui/src/globals.css   (variables CSS :root)
  → tailwind.config.ts de cada front (extend.colors, extend.fontFamily)
  → packages/ui/src/components/*  (usan las variables vía className)
```
