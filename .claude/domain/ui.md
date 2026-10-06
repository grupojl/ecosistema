# UI — Sistema de diseño

> Estado: 🔲 Por completar
> Última actualización: —
> Referencia de código: `.claude/ui/` (tokens.md, brand.md, components.md)
> Stack: Tailwind CSS + shadcn/ui + lucide-react (confirmados en los 3 frontends)

---

## Tipografía

> Estado: 🔲 Por definir

| Rol | Fuente | Peso | Uso |
|-----|--------|------|-----|
| Display | TODO | TODO | Títulos hero, headings grandes |
| Body | TODO | TODO | Texto de interfaz, párrafos |
| Mono | TODO | TODO | Código, SKUs, IDs técnicos |

**Criterios para elegir fuentes:**
- [ ] Variable font (performance en web)
- [ ] Soporte de caracteres latinos extendidos (ñ, acentos, ç)
- [ ] Licencia libre para uso comercial
- [ ] Legible en tamaños pequeños en mobile

---

## Paleta de colores

> Estado: 🔲 Por definir

| Token CSS | Valor | Uso |
|-----------|-------|-----|
| `--color-primary` | TODO | Acción principal, CTA |
| `--color-primary-foreground` | TODO | Texto sobre primary |
| `--color-secondary` | TODO | Acción secundaria |
| `--color-accent` | TODO | Highlights, badges |
| `--color-background` | TODO | Fondo base |
| `--color-foreground` | TODO | Texto base |
| `--color-muted` | TODO | Texto secundario, placeholders |
| `--color-border` | TODO | Bordes, divisores |
| `--color-destructive` | TODO | Errores, acciones destructivas |
| `--color-success` | TODO | Confirmaciones, estados ok |
| `--color-warning` | TODO | Alertas, estados pendientes |

### Dark mode
> El código ya tiene `ThemeProvider` (next-themes) en los 3 frontends.
- [ ] Dark mode: sí desde el día uno / roadmap

---

## Espaciado

> Basado en la escala de 4px de Tailwind.

| Token | Valor | Uso típico |
|-------|-------|-----------|
| xs | 4px | Gap entre elementos inline |
| sm | 8px | Padding de badges, chips |
| md | 16px | Padding de cards, inputs |
| lg | 24px | Gap entre secciones |
| xl | 40px | Separación de bloques |
| 2xl | 64px | Secciones de landing |

**Contenedor máximo:** TODO (recomendado: `max-w-7xl`)

---

## Bordes y radios

| Token | Valor | Uso |
|-------|-------|-----|
| sm | TODO | Inputs, chips |
| md | TODO | Cards, modals |
| lg | TODO | Panels grandes |
| full | 9999px | Avatars, pills |

---

## Iconografía

- **Librería:** lucide-react (confirmado en package.json de los 3 frontends)
- **Estilo:** TODO — outline / filled / duotone
- **Tamaño estándar en UI:** TODO (recomendado: 16px inline, 20px standalone)

---

## Motion / Animaciones

- [ ] ¿El producto usa animaciones o es estático?
- [ ] Duración estándar de transiciones: TODO (recomendado: 150ms)
- [ ] Easing estándar: TODO (recomendado: ease-out)
- [ ] Respetar `prefers-reduced-motion`: sí (obligatorio para accesibilidad)

---

## Componentes shadcn/ui — customizaciones

> shadcn/ui está configurado con `components.json` en los 3 frontends.
> Documentar aquí cualquier override del estilo base.

| Componente | Customización | Estado |
|-----------|--------------|--------|
| Button | TODO | 🔲 |
| Input | TODO | 🔲 |
| Card | TODO | 🔲 |
| Badge | TODO | 🔲 |
| Dialog | TODO | 🔲 |
| Toast | TODO | 🔲 |
| Table | TODO | 🔲 |
| Sidebar | TODO | 🔲 |

---

## Notas de implementación

- Los tokens van en `tailwind.config` de cada frontend + CSS variables en `globals.css`
- Cualquier token nuevo que se defina aquí debe reflejarse en los 3 frontends:
  `realsass-sass-front`, `realsass-dashboard-front`, `real-ecommerce-front`
- El storefront público hereda el tema del tenant en runtime (config-themes en sass-back)
  — los tokens del tenant sobreescriben los tokens base en el storefront
