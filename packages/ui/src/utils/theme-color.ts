/**
 * Color de la barra del navegador (meta theme-color) por modo. No admite variables CSS: es el único lugar con estos valores
 * (= --background de welver.css). Va en un archivo SIN "use client" para poder leerse desde `viewport` de un layout del servidor.
 */
export const THEME_COLOR = [
  { media: "(prefers-color-scheme: light)", color: "#fbfbf8" },
  { media: "(prefers-color-scheme: dark)", color: "#0a1511" },
] as const
