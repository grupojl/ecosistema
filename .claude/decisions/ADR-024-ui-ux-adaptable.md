# ADR-024 — UI/UX adaptable: una interfaz para desktop, tablet y mobile

**Fecha:** 2026-10-17
**Estado:** Aceptado — norte definido; la auditoría de los 3 fronts contra el norte está pendiente (DT-UI-*)

## Contexto
Hay un sistema de diseño (`domain/ui.md`) y un package de componentes (`@real/ui`), pero ningún norte que diga cómo debe
comportarse la interfaz según el dispositivo. Cada front decidía por su cuenta. El storefront lo usan clientes finales
sobre todo desde el celular; el dashboard y sass-front los usa el dueño en escritorio y, cada vez más, en el celular.

## Decisión
Adoptar el norte de `architecture/12-ui-norte.md`:
- **Referentes:** Shopify Polaris (principal), Apple HIG, Material 3 (clases de tamaño).
- **6 pilares:** mobile-first con 3 clases de tamaño · navegación que cambia de forma (barra inferior / riel / barra lateral) ·
  táctil primero (≥ 44 px, sin depender de hover) · tokens únicos en `@real/ui` · rendimiento y accesibilidad como requisito ·
  estados completos (cargando / vacío / error / sin permisos).
- **Prioridad:** storefront primero; dashboard y sass-front después; Tauri hereda el dashboard.
- **Puntos de corte:** 600 px y 840 px (Material 3).

## Qué se asumió
El usuario aprobó la propuesta ("deja eso actualizado") sin responder por separado las cuatro preguntas abiertas. Se tomaron
las opciones recomendadas: Polaris como referencia principal, los 6 pilares tal cual, storefront primero y cortes 600/840.
Cualquiera de las cuatro se puede cambiar editando este ADR.

## Consecuencias
- Los puntos de corte 600/840 no coinciden con los de Tailwind por defecto (640/768/1024): hay que mapearlos en el tema (DT-UI-01).
- Aparecen deudas por auditar en cada front (viewport que bloquea zoom, objetivos táctiles, estados vacíos/error, navegación por tamaño).
- No se construye app nativa móvil ni un sistema de diseño público.

## Alternativas descartadas
- **Interfaces separadas por dispositivo (m.dominio, app aparte):** duplican mantenimiento y rompen SEO/URLs únicas (ADR-016, ADR-022).
- **App nativa React Native:** costo desproporcionado para la escala actual.
- **Solo "responsive" sin norte:** es lo que había; produjo decisiones distintas en cada front.
