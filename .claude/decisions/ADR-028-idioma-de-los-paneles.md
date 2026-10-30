# ADR-028 — Idioma de los paneles (`@real/i18n`)

**Estado:** aceptada · 2026-10-30 · complementa ADR-016 (SEO + idioma del storefront) y respeta ADR-022 (URLs limpias).

## Decisión

Los paneles (`realsass-sass-front`, `realsass-dashboard-front`, `realsass-docs-front`) se adaptan al idioma igual que el storefront, con un paquete
compartido `@real/i18n`:

- **El idioma NO va en la URL.** Los paneles no se indexan y sus URLs limpias son contrato (ADR-022). Se decide por **cookie `NEXT_LOCALE`**
  (la misma del storefront, así la elección sigue al usuario entre fronts del mismo dominio) > `Accept-Language` > `es`.
- Mismos idiomas activos que el storefront: `es · pt · en · fr · de`. `RTL_LOCALES` ya existe (vacío); `<html dir>` lo lee.
- **Diccionarios tipados**: común en `@real/i18n` (acciones, estados, acceso) + uno propio por front (`lib/i18n/{es,en,pt,fr,de}.ts` con
  `satisfies`): una key sin traducir rompe el typecheck.
- El layout (servidor) negocia el idioma con `getRequestLocale()` (`@real/i18n/server`), carga **solo** el diccionario de ese idioma y lo pasa a
  `<I18nProvider>`; los Client Components usan `useMessages<Dictionary>()`. El cliente nunca descarga los demás idiomas.
- Selector: `LanguageSwitcher` (pieza visual en `@real/ui`) + `LocaleSwitcher` (cableado en `@real/i18n`: cookie + `router.refresh()`).
- Los componentes de `@real/ui` con texto propio reciben las traducciones por props (`LoginPanel.messages`); su español queda como valor por defecto.

## Consecuencias / límites

- Leer cookie/headers en el layout hace **dinámicas** las rutas de esos fronts (sin render estático).
- **Landing de `realsass-sass-front` (indexable):** hoy el idioma varía por cookie/`Accept-Language` en la misma URL. Googlebot no manda
  `Accept-Language` → ve siempre `es`, consistente. Si se quiere posicionar la landing en otros idiomas, debe pasar a `/{locale}` (regla de ADR-016).
- `realsass-docs-front`: se traduce el marco de la interfaz; las guías (`content/*.md`) siguen en español y se marcan con `lang="es"`.
- `realsass-design-front` (documentación interna del equipo) queda fuera.
- Adopción gradual: se traduce por pantalla. Pendiente: resto de `@real/ui` con textos fijos (`FeedbackDialog`, `DevicesDialog`, `EmptyState`…),
  preferencia de idioma guardada en el perfil del usuario, y unificar con el storefront (hoy duplica config/negociación).
