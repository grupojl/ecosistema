# UI Front — Norte y sistema de diseño

> Estado: 🔶 Dirección definida · tokens por cerrar (los valores marcados *propuesto* no son decisión final)
> Última actualización: 2026-10-15
> Alcance: los 3 frontends — `realsass-sass-front`, `realsass-dashboard-front`, `real-ecommerce-front`
> Stack: Tailwind CSS + shadcn/ui + lucide-react (confirmados en los 3 frontends)
> Referencia de código: `.claude/ui/` (tokens.md, brand.md, components.md)

---

## 1. El norte

**Una referencia da dirección y un piso alto; no da la nota.** Un 10/10 sale de la ejecución, no de copiar
un sistema. La meta realista es **8 – 8,5 sólido**; el 10 es una dirección, no un entregable.

*Nativo en cada pantalla (desktop, tablet, mobile), consistente en los 3 fronts, medido y no supuesto.*

### Referencias elegidas

| Superficie | Referencia | Qué se toma |
|---|---|---|
| Lenguaje base (todas) | **Apple HIG** | Jerarquía, espacio, tipografía, movimiento y modo oscuro |
| Dashboard del dueño | **Shopify Polaris + Linear** | Polaris: admin de comercio (tablas, filtros, formularios). Linear: densidad y velocidad en desktop |
| Storefront | **apple.com/store** | Producto como protagonista, mucho aire; el tema del tenant manda sobre los tokens base |

Regla: **una sola estética por pantalla.** Apple HIG es la base; Polaris solo aporta patrones del admin.
No se mezclan tres lenguajes visuales en la misma vista.

### Dónde verlas

- Apple HIG: `developer.apple.com/design/human-interface-guidelines` · kits Figma: `developer.apple.com/design/resources`
  (secciones útiles: Layout, Typography, Color, Dark Mode, Motion, Sidebars, Tab bars, Sheets)
- Polaris: `polaris.shopify.com` · ejemplo real: `admin.shopify.com` (cuenta de prueba)
- Linear: `linear.app`
- Tienda: `apple.com/shop` (probar una ficha de producto en los tres anchos)
- Bloques en el stack propio: `ui.shadcn.com/blocks`

---

## 2. Adaptación nativa por pantalla

| Elemento | Desktop | Tablet | Mobile |
|---|---|---|---|
| Navegación | Sidebar fija | Sidebar colapsable a riel de íconos | Barra de pestañas abajo (4-5 ítems) |
| Modales | Diálogo centrado | Diálogo o popover | Hoja inferior (*sheet*) con arrastre para cerrar |
| Tablas | Tabla densa | Columnas priorizadas | Lista de tarjetas |
| Interacción | Hover y atajos de teclado | Mixta | Táctil, áreas de 44 px |
| Bordes del sistema | — | — | *Safe areas* y teclado virtual |

Reglas que valen para las tres:
- Nunca depender de `hover` para una acción esencial.
- Cada pantalla define sus estados **vacío, cargando y error**; no se entrega una vista sin ellos.
- Probar en los tres anchos antes de dar una vista por terminada.

---

## 3. Qué hace falta para un 10/10 (y no sale de una referencia)

1. **Ejecución consistente.** Los 3 fronts usan los mismos tokens, componentes y estados, sin excepciones.
2. **Flujos bien resueltos.** Onboarding del dueño, carga de producto y checkout con pocos pasos y sin
   fricción. Es UX, no estética, y se valida con usuarios reales.
3. **Accesibilidad.** Contraste, foco visible, uso con teclado, lectores de pantalla y áreas de toque.
4. **Rendimiento percibido.** LCP bajo, sin saltos de layout y transiciones fluidas.
   `images.unoptimized: true` (DT-SEO-08) resta puntos hoy.
5. **Pulido real en cada pantalla.** Probado en dispositivos de verdad, no solo en el navegador de escritorio.
6. **Iteración con datos.** Observar cómo lo usa la gente y corregir.

### Cómo se verifica

> Principio de ADR-022: *una regla que no falla en CI no es una regla.* Los umbrales son **propuestas**.

| Punto | Verificación | Umbral propuesto |
|---|---|---|
| Consistencia | Auditoría de tokens (sin colores/medidas sueltas fuera de los tokens) | 0 hallazgos |
| Flujos | Test e2e Playwright de onboarding y checkout + pruebas con personas | Completan sin ayuda |
| Accesibilidad | axe en CI sobre las páginas clave | 0 violaciones graves |
| Rendimiento | Lighthouse CI | LCP ≤ 2,5 s, CLS ≤ 0,1 |
| Dispositivos | Revisión manual en iPhone, iPad y desktop antes de cada release | Checklist firmada |
| Iteración | Analítica de embudo (onboarding, checkout) | Definir métricas |

### Orden de trabajo

1. Cerrar este documento: tokens, tipografía y reglas por pantalla.
2. Aplicarlo en un front y medirlo (accesibilidad y rendimiento).
3. Extender a los otros dos fronts.
4. Probar onboarding y checkout con personas reales.

---

## 4. Tipografía

> Estado: 🔶 Propuesto

| Rol | Fuente | Peso | Uso |
|-----|--------|------|-----|
| Display | SF Pro en dispositivos Apple; **Inter** (variable) como fallback | TODO | Títulos hero, headings grandes |
| Body | Ídem | TODO | Texto de interfaz, párrafos |
| Mono | TODO | TODO | Código, SKUs, IDs técnicos |

**Criterios para elegir fuentes:**
- [ ] Variable font (performance en web)
- [ ] Soporte de caracteres latinos extendidos (ñ, acentos, ç)
- [ ] Licencia libre para uso comercial
- [ ] Legible en tamaños pequeños en mobile

---

## 5. Paleta de colores

> Estado: 🔲 Por definir. Siempre **tokens semánticos**, nunca colores fijos en los componentes.

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
- [x] Dark mode **desde el día uno** (parte del norte; cada token define su par claro/oscuro).

---

## 6. Espaciado

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

## 7. Bordes y radios

> Propuesto: radios entre 10 y 16 px, consistentes.

| Token | Valor | Uso |
|-------|-------|-----|
| sm | TODO (≈10px) | Inputs, chips |
| md | TODO (≈12px) | Cards, modals |
| lg | TODO (≈16px) | Panels grandes |
| full | 9999px | Avatars, pills |

---

## 8. Iconografía

- **Librería:** lucide-react (confirmado en package.json de los 3 frontends)
- **Estilo:** outline, trazo uniforme
- **Tamaño estándar en UI:** 16px inline, 20px standalone

---

## 9. Motion / Animaciones

- Transiciones cortas tipo resorte, **≈ 200-300 ms** *(propuesto)*; 150 ms en microinteracciones.
- Easing estándar: ease-out.
- Respetar `prefers-reduced-motion`: **sí (obligatorio** para accesibilidad).

---

## 10. Componentes shadcn/ui — customizaciones

> shadcn/ui está configurado con `components.json` en los 3 frontends.
> Documentar aquí cualquier override del estilo base.

| Componente | Customización | Estado |
|-----------|--------------|--------|
| Button | TODO | 🔲 |
| Input | TODO | 🔲 |
| Card | TODO | 🔲 |
| Badge | TODO | 🔲 |
| Dialog | TODO (en mobile se vuelve *sheet*) | 🔲 |
| Toast | TODO | 🔲 |
| Table | TODO (en mobile se vuelve lista de tarjetas) | 🔲 |
| Sidebar | TODO (riel en tablet, pestañas en mobile) | 🔲 |

---

## 11. Notas de implementación

- Los tokens van en `tailwind.config` de cada frontend + CSS variables en `globals.css`.
- Cualquier token nuevo que se defina aquí debe reflejarse en los 3 frontends:
  `realsass-sass-front`, `realsass-dashboard-front`, `real-ecommerce-front`.
- Los componentes compartidos viven en `@real/ui` (fuente única de UI); no se duplican en cada front.
- El storefront público hereda el tema del tenant en runtime (config-themes en sass-back):
  los tokens del tenant sobreescriben los tokens base en el storefront.
