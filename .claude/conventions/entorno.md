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

Nota (2026-10-08): `shamefully-hoist=true` NO impide `output: 'standalone'`. Los tres fronts lo usan
(`.next/standalone` trae `node_modules` y `<front>/server.js`) y se verificó armando el runtime del
Dockerfile (standalone + static + public) y arrancando `server.js`: los tres responden HTTP 200.
`realsass-sass-front` era el único sin `output: 'standalone'`, por lo que su imagen no podía construirse.

## Variables de entorno (`.env.example`)

Cada servicio tiene un `.env.example` **versionado** con TODAS sus variables, un comentario por variable
y la marca `[REQUERIDA]` / `[OPCIONAL]`. Regla: si se agrega o quita un `process.env.X` en un servicio,
se actualiza su `.env.example` en el mismo PR. Comentarios siempre en su propia línea (Docker
`--env-file` no soporta comentarios en línea). Los `.gitignore` deben conservar `!.env.example`.

| Servicio | Puerto local | Notas |
|---|---|---|
| `realsass-sass-back` | 3000 | requiere `ALLOWED_ORIGINS`, `CONFIG_MASTER_KEY`, `INTERNAL_API_KEY` |
| `realsass-sass-front` | 3001 | `next dev -p 3001` |
| `realsass-dashboard-front` | 3002 | `next dev -p 3002` |
| `real-ecommerce-front` | 3003 | `next dev -p 3003` |
| `realsass-ecommerce-back` | 3005 | la imagen Docker usa `PORT=3001` |

Las `NEXT_PUBLIC_*` de un front son **Build Variables** (Next las incrusta al compilar; el Dockerfile
las recibe como `ARG`). Las URLs son la base del servicio, sin `/api/v1`: los clientes tRPC agregan
`/api/v1/trpc`. Las variables sin prefijo (`SITE_URL`, `ECOMMERCE_BACK_URL`, `SASS_BACK_URL`) son de
servidor y se leen en runtime.

## Stack canónico

- Backend: NestJS 11 · Prisma 7 · PostgreSQL · Redis · BullMQ · Firebase Admin
- Frontend: Next.js 15 · React 19 · TailwindCSS 4 · shadcn/ui · TanStack Query
  · Zustand · Firebase
- Inter-servicios: tRPC 11 (en implementación S1/S2)
- Auth: Firebase Authentication (client) + Firebase Admin (server)
- Workspace: pnpm 10 workspaces con catalog único
