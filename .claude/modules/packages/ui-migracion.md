# @real/ui — flujo de migración desde el taller

> **Estado actual (snapshot):** `packages/ui/src` es un **artefacto generado**. La fuente de los componentes vive en
> `realsass-design-front/ui`, el taller del sistema de diseño. Se cambia allá, se valida allá y se migra con un script.
> Ese paquete **no se edita a mano**: una guarda lo impide.

## Por qué

Antes la UI se editaba en `packages/ui` y el front de diseño solo la reexportaba. Eso mezclaba prototipo y contrato.
Ahora el taller es dueño de los componentes y `packages/ui` es lo que consumen los demás fronts.

```
realsass-design-front/ui/      ← FUENTE (se edita acá)
  components/ hooks/ utils/ styles/ index.ts
        │
        │  pnpm ui:migrate   (revisión → respaldo → reemplazo → línea base)
        ▼
packages/ui/src/              ← ARTEFACTO (no se edita a mano; .ui-synced.json guarda el hash de cada archivo)
        │
        ▼
sass-front · dashboard-front · real-ecommerce-front · docs-front   (piezas propias de cada front: en cada front)
```

## Dónde vive cada cosa

| La pieza… | Va en |
|---|---|
| No sabe de negocio y la usarán 2 o más fronts (botón, modal, panel de login, toast, tabla) | **Taller → `@real/ui`** |
| Depende de datos, rutas, sesión o idioma de un solo front (StoreHeader, DashboardShell, markets-manager) | **Ese front** (`components/`), construida solo con `@real/ui` |
| Empieza en un front y luego se necesita en otro, sin depender del negocio | Se **promueve** al taller y se migra |

Las piezas de cada front no arman HTML ni colores propios: `ui:lint` lo revisa.

## Comandos (desde la raíz)

| Comando | Qué hace |
|---|---|
| `pnpm ui:check` | Revisar (dry-run, no modifica nada): exports y firmas de props, dependencias, ediciones manuales del paquete y HTML/colores sueltos en los fronts. |
| `pnpm ui:migrate` | Aplicar. Se niega si un front perdería un export que usa, si falta una dependencia en `packages/ui/package.json` **o si `packages/ui/src` fue editado a mano** (no se pisa en silencio). Respalda en `.ui-backup/<fecha>/`, reemplaza `components`, `hooks`, `utils`, `styles` e `index.ts` y registra la línea base. `--verify` encadena la verificación; `--force` salta los frenos. |
| `pnpm ui:verify` | Tipado de los 5 fronts (`--build` también compila). Si algo falla, la migración **no** se da por buena. |
| `pnpm ui:guard` | **La guarda** (CI / pre-commit): falla si `packages/ui/src` cambió respecto de la última migración. `--strict` además exige que el taller y el paquete sean idénticos. |
| `pnpm ui:lint` | Detalle de HTML suelto (`<button>`, `<input>`…), colores fuera de los tokens (`text-gray-500`, `#hex`) en las piezas de cada front. `--strict` hace que falle. Excepción justificada: `ui-lint-ignore` en la misma línea. |
| `pnpm ui:snap` / `pnpm ui:snapcheck` | Capturas de 12 pantallas × claro/oscuro × escritorio/celular (48). `snap` fija la línea base (cuando el cambio de aspecto es intencional); `snapcheck` compara píxel a píxel y falla si algo cambió. Necesita el taller en marcha en `:3026`. |
| `pnpm ui:restore` | Volver al último respaldo (también restaura la línea base de la guarda). |

### Orden de trabajo

1. Editar en `realsass-design-front/ui` y mirar el cambio en el taller (`pnpm --filter realsass-design-front dev`, puerto 3026).
2. `pnpm ui:snapcheck` → si cambió algo que no esperabas, es una regresión; si es intencional, `pnpm ui:snap`.
3. `pnpm ui:check` → revisa qué rompería.
4. Cuando el taller esté listo: `pnpm ui:migrate --verify` (o `pnpm ui:verify --build`).
5. Revisar a ojo los fronts (compilar no revisa el diseño) y commitear paquete, taller e imágenes de `snapshots/`.

La guarda es la que hace que «el taller puede ir adelantado» sea seguro: el taller puede tener trabajo a medias, pero
`packages/ui` solo cambia cuando tú decides migrar, y nunca se pisa una edición manual sin avisar.

## Reglas del taller

- Los archivos de `ui/` importan con las **mismas rutas que usarán dentro del paquete**: `@real/ui/utils` para `cn` y rutas relativas
  (`./button`) entre componentes. Nunca `@real/ui` a secas (se rompería al copiarse). El taller las resuelve con `paths` en su `tsconfig`.
- Un valor que un layout del **servidor** necesita (p. ej. `THEME_COLOR` para `viewport`) va en un archivo **sin** `"use client"`
  (`ui/utils/`): un export de un módulo cliente llega al servidor como referencia y no se puede leer.
- `realsass-design-front` **no depende de `@real/ui`**: sus dependencias (Radix, lucide, cva…) están en su `package.json`. `ui:check`
  falla si el taller importa una librería que `packages/ui/package.json` no declara y avisa de versiones distintas.
- Las páginas del taller importan de `@/components/ui` (reexporta `../../ui`).
- Agregar un archivo nuevo a `ui/components` exige exportarlo desde `ui/index.ts`.
- Los estilos (`welver.css`, `modal.css`) también son fuente en `ui/styles`; los fronts siguen importando `@real/ui/styles/welver.css`.

## Límites (qué NO garantiza)

- **Compilar no es revisar el diseño.** Las capturas detectan que «algo cambió» en las pantallas del taller, no en los fronts con datos
  reales (necesitan backend) ni en pantallas con métricas en vivo (gobierno, accesibilidad, motion).
- Cambios de **comportamiento** con la misma firma (p. ej. un toast distinto) no se detectan: `ui:check` compara nombres y firmas de
  `interface`/`type`, no el cuerpo de las funciones.
- `packages/ui/package.json` no se migra (solo `src/`): las dependencias nuevas se agregan a mano en ambos lados.
- Los respaldos (`.ui-backup/`) no están en git; las capturas nuevas (`snapshots/__nuevo__/`) tampoco.
- `ui:guard` solo protege si alguien lo ejecuta: engancharlo a CI o a un pre-commit es lo que lo vuelve obligatorio.

## Pendiente

- Enganchar `ui:guard`, `ui:check --strict` y `ui:snapcheck` a CI / pre-commit.
- Pruebas automáticas por componente (axe + Playwright) más allá de las capturas.
- Que `ui:check` valide también las versiones entre taller y paquete como error (hoy es aviso).
