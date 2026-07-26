# Ecosistema Real — welver/

## Entorno
- Windows + Git Bash
- Node 24.14.0
- pnpm 10.30.3
- Deploy: Railway

## CRÍTICO — pnpm catalog
**Los named catalogs NO funcionan en este entorno.**
`catalog:backend`, `catalog:frontend`, `catalog:trpc` → todos dan error.
Usar SIEMPRE un solo `catalog:` default para todo el ecosistema.
Si ves `catalog:algo` en cualquier package.json → es un bug, hay que normalizarlo a `catalog:`.

## Repos (todos en la raíz de welver/)
| Carpeta | Nombre en package.json | Rol |
|---------|----------------------|-----|
| `realsass-sass-back` | `realsass-sass-back` | NestJS — identidad, orgs, memberships, API keys, config, auditoría |
| `realsass-ecommerce-back` | `realsass-ecommerce-back` | NestJS — catálogo, stock, órdenes, carrito, propiedades, zonas |
| `realsass-sass-front` | `realsass-sass-front` | Next.js — dashboard dueños |
| `realsass-dashboard-front` | `realsass-dashboard-front` | Next.js — dashboard colaboradores |
| `real-ecommerce-front` | `real-ecommerce-front` | Next.js — storefront público SSG/ISR |
| `packages/auth-client` | `@real/auth-client` | Firebase auth, apiFetch, AppError |
| `packages/ui` | `@real/ui` | componentes shadcn compartidos, cn() |
| `packages/trpc` | `@real/trpc` | contratos tRPC inter-servicios |

## Paquetes fuera del catalog estándar (están en los repos pero son específicos)
- `swagger-ui-express` — backends
- `joi` — realsass-sass-back
- `framer-motion` — realsass-sass-front
- `@vercel/analytics` — fronts
- `@types/qs` — realsass-sass-back

## Stack
- Backend: NestJS 11 · Prisma 7 · PostgreSQL · Redis · BullMQ · Firebase Admin
- Frontend: Next.js 15 · React 19 · TailwindCSS 4 · shadcn/ui · TanStack Query · Zustand · Firebase
- Inter-servicios: tRPC 11 (en implementación — S1/S2)
- Auth: Firebase Authentication (client) + Firebase Admin (server)
- Workspace: pnpm 10 workspaces con catalog único

## Convenciones de código
- TypeScript strict — `any` implícito es bug de diseño
- Lógica de negocio en domain/application, nunca en controllers o componentes UI
- Queries N+1 son errores — siempre `include` explícito en Prisma
- RBAC: OWNER > ADMIN > MEMBER > VIEWER
- Multi-tenant: toda query lleva `organizationId` como filtro obligatorio
- Cobertura mínima 85% en paths críticos

## Sprints pendientes
- S1: fusionar realsass-config-back → realsass-sass-back + adaptar tRPC
- S2: fusionar realsass-dashboard-back → realsass-ecommerce-back
- S3: implementar @real/auth-client y @real/ui + TanStack Query en fronts
- S4: tests 85% + OpenTelemetry