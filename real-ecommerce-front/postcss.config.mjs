/** @type {import("postcss").Config} */
// postcss.config.mjs — TailwindCSS v4
//
// Motor: @tailwindcss/postcss → Lightning CSS interno
// Lightning CSS lee .browserslistrc y aplica:
//   - Prefijos vendor según el target de cada servicio
//   - Downgrade de oklch, CSS nesting, logical properties, color-mix
//
// Ref: https://tailwindcss.com/docs/installation/using-postcss
//      https://lightningcss.dev/transpilation.html

export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

