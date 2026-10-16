# 12 — Norte: UI/UX en desktop, tablet y mobile

> 🔒 Contrato. Responde "¿cómo debería ser la interfaz?". Se edita solo por decisión explícita
> (ver `decisions/ADR-024-ui-ux-adaptable.md`). El estado actual de cada front vive en `roadmap/deuda-tecnica.md`.

## El norte en una línea

*Una sola interfaz que se adapta al dispositivo y al contexto, no tres interfaces distintas.*

**Referentes:** **Shopify Polaris** (principal: admin multi-tenant usable en escritorio y celular, tokens y reglas de layout públicos) ·
**Apple HIG** (lo táctil y el contenido mandan sobre la decoración) · **Material 3** (clases de tamaño de ventana: compact / medium / expanded).

## Los 6 pilares

### 1. Mobile-first con 3 clases de tamaño
Se diseña primero para compacto, luego medio y luego expandido. Los puntos de corte son únicos y viven en `@real/ui`.

| Clase | Ancho | Dispositivo típico |
|---|---|---|
| Compact | < 600 px | celular |
| Medium | 600–839 px | tablet / celular horizontal |
| Expanded | ≥ 840 px | desktop |

Ningún front define puntos de corte propios. Mapear estos valores al tema de Tailwind es deuda (DT-UI-01).

### 2. La navegación cambia de forma, no de contenido
| Clase | Navegación |
|---|---|
| Compact | barra inferior |
| Medium | riel lateral (íconos) |
| Expanded | barra lateral completa |

Misma información y mismas rutas en las tres; solo cambia la presentación.

### 3. Táctil primero
- Objetivos interactivos de **≥ 44×44 px**.
- Nada esencial depende de `hover`.
- Los atajos de teclado son mejora en desktop, nunca requisito.

### 4. Tokens únicos en `@real/ui`
Color, espaciado, radios, tipografía y motion salen de un solo lugar, con dark mode. Prohibido hardcodear
valores visuales (hex, px sueltos) dentro de un front. Detalle del sistema actual: `domain/ui.md`.

### 5. Rendimiento y accesibilidad son requisito, no extra
- Contraste **WCAG AA**, foco visible, navegación por teclado, etiquetas para lectores de pantalla.
- Respetar `prefers-reduced-motion`.
- Storefront: Core Web Vitals (LCP, INP, CLS) dentro de umbral "bueno".
- `viewport` sin `maximum-scale=1` ni `user-scalable=no` (bloquea el zoom: falla de accesibilidad).

### 6. Estados completos en toda pantalla
Cada vista con datos define: **cargando** (skeleton), **vacío**, **error** (con reintento) y **sin permisos**.
Mostrar solo el estado feliz es un defecto.

## Prioridad por front

| Front | Quién lo usa | Qué manda |
|---|---|---|
| `real-ecommerce-front` | cliente final, casi siempre en celular | **Prioridad 1.** Rendimiento y conversión; mobile primero |
| `realsass-dashboard-front` | dueño / colaboradores | Densidad de información en expanded; lo esencial operable en compact |
| `realsass-sass-front` | dueño (cuenta, organizaciones) | Igual que el dashboard |
| Tauri (`realsass-dashboard-desktop`) | dueño en escritorio | Hereda el dashboard; sin reglas propias |

## Anti-patrones prohibidos (checklist de code review)

| Anti-patrón | Por qué | Severidad |
|---|---|---|
| Puntos de corte propios de un front | Rompe la coherencia entre fronts | 🟠 Alta |
| Funcionalidad solo accesible con `hover` | Inusable en táctil | 🔴 Bloqueante |
| Objetivos táctiles < 44 px | Errores de toque | 🟠 Alta |
| `user-scalable=no` / `maximum-scale=1` | Bloquea zoom (accesibilidad) | 🟠 Alta |
| Valores visuales hardcodeados (hex, px) | Salta el sistema de tokens | 🟡 Media |
| Pantalla con datos sin estado de carga / vacío / error | Solo el estado feliz | 🟠 Alta |
| Navegación distinta (otras rutas) según dispositivo | Dos productos en uno | 🟠 Alta |
| Animación sin respetar `prefers-reduced-motion` | Accesibilidad | 🟡 Media |

## Fuera de alcance (por ahora)
- App nativa móvil (React Native): duplica el trabajo.
- Sistema de diseño público tipo Polaris con documentación propia: excesivo para la escala actual.
