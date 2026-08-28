# Entorno de desarrollo

- SO: Windows + Git Bash
- Node: 24.14.0
- pnpm: 10.30.3
- Deploy: Railway (cada servicio individual, ver `architecture/00-principios.md`)

## pnpm catalog

**CRÍTICO** — Los named catalogs NO funcionan en este entorno.
`catalog:backend`, `catalog:frontend`, `catalog:trpc` → todos dan error.
Usar SIEMPRE un solo `catalog:` default. Ver `decisions/ADR-002-catalog-unico.md`.

Si aparece `catalog:algo` en cualquier `package.json` → es un bug, normalizar
a `catalog:`.

## Paquetes fuera del catalog estándar (específicos de un servicio)

| Paquete | Dónde |
|---|---|
| `swagger-ui-express` | backends |
| `joi` | `realsass-sass-back` |
| `framer-motion` | `realsass-sass-front` |
| `@vercel/analytics` | fronts |
| `@types/qs` | `realsass-sass-back` |

## .npmrc (raíz del monorepo)
enable-pre-post-scripts=true
shamefully-hoist=true
strict-peer-dependencies=false
auto-install-peers=true
link-workspace-packages=true
dedupe-peer-dependents=true
ignore-scripts=true

Nota: `shamefully-hoist=true` es la razón por la que los Dockerfiles de los
fronts hacen `output: standalone` deshabilitado en algunos casos — ver
comentarios en `next.config.mjs` de `realsass-sass-front` y
`realsass-dashboard-front`: *"el monorepo usa shamefully-hoist, los
node_modules están en la raíz del workspace. standalone no los incluye
correctamente en ese setup y rompe en runtime."*

## Stack canónico

- Backend: NestJS 11 · Prisma 7 · PostgreSQL · Redis · BullMQ · Firebase Admin
- Frontend: Next.js 15 · React 19 · TailwindCSS 4 · shadcn/ui · TanStack Query
  · Zustand · Firebase
- Inter-servicios: tRPC 11 (en implementación S1/S2)
- Auth: Firebase Authentication (client) + Firebase Admin (server)
- Workspace: pnpm 10 workspaces con catalog único
