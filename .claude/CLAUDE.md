# Ecosistema Real — Documentación de arquitectura

> Este directorio es la memoria persistente del proyecto. Antes de implementar
> cualquier feature, se consulta esta documentación. No se redefine desde cero
> lo que ya está decidido acá.

## Resumen de una línea

SaaS multi-tenant donde cada organización gestiona su negocio (catálogo, stock,
órdenes, config, colaboradores) a través de 3 frontends Next.js sobre 2 backends
NestJS compartidos, con auth/tenant resuelto una sola vez y contrato tipado
end-to-end vía tRPC.

## Contrato vs snapshot

Antes de editar cualquier archivo de esta carpeta, identificar a qué grupo pertenece. La regla evita que la documentación de arquitectura se vaya "blanqueando" para que coincida con el código actual en vez de marcar desviaciones como deuda.

### 🔒 No modificables de base (contrato)

Responden a **"¿cómo debería ser esto?"**. Son la fuente de verdad no negociable. Se editan solo por decisión explícita de arquitectura, nunca para que "cuadren" con una desviación del código real. Si el código contradice lo que dicen acá, el conflicto se resuelve con un ADR o se anota en `roadmap/deuda-tecnica.md` — no se edita el contrato en silencio.

architecture/00-principios.md # regla de aislamiento Railway — LA ley
architecture/01-backend-capas.md # ideal terminado de cada capa backend
architecture/02-frontend-capas.md # ideal terminado de cada capa frontend
architecture/03-reglas-duras.md # checklist de reglas — cambia solo si cambia la arquitectura
decisions/ADR-*.md # cada ADR aceptado es inmutable — se reemplaza por otro ADR, no se edita
contracts/tenant-context.md # shape de datos entre servicios
contracts/organization-access.md # patrón canónico de comunicación HTTP+cache


**Antes de tocar uno de estos:** preguntarse *"¿estoy documentando una decisión de arquitectura nueva, o estoy blanqueando una desviación del código?"* — lo primero amerita el cambio (con ADR si es grande), lo segundo va a `roadmap/deuda-tecnica.md`.

### 🔄 Dinámicas (estado actual)

Responden a **"¿cómo está esto hoy?"**. Se espera que queden desactualizadas si no se tocan — reflejan el estado real del código, no el ideal. Se actualizan cada vez que el servicio/roadmap cambia de verdad.

services/*.md # un archivo por servicio, refleja su estado real
contracts/trpc-routers.md # namespaces expuestos — crece con cada procedure nuevo
roadmap/sprints.md # estado de S1-S4, se actualiza cada sprint
roadmap/deuda-tecnica.md # lista viva de deuda consciente
logs/README.md # convención operativa, rara vez cambia


**Cuándo actualizar:** cada vez que se mergea un cambio que modifica el comportamiento real de un servicio, se cierra o abre deuda técnica, o avanza/cambia el estado de un sprint.

### Tabla resumen rápida

| Tipo | Carpetas/archivos | Responde a | Se edita cuando |
|---|---|---|---|
| 🔒 No modificable | `architecture/*`, `decisions/ADR-*`, `contracts/tenant-context.md`, `contracts/organization-access.md` | ¿Cómo **debería** ser? | Cambia la decisión de arquitectura en sí (requiere ADR) |
| 🔄 Dinámica | `services/*`, `roadmap/*`, `contracts/trpc-routers.md`, `logs/README.md` | ¿Cómo **está** hoy? | Cada vez que el código/roadmap cambia de verdad |

**Regla rápida antes de editar algo del grupo 🔒:** si estás por "corregir" el documento para que coincida con una desviación del código en vez de documentar una decisión nueva, pará — eso va a `roadmap/deuda-tecnica.md`, no acá.

## Punto de partida no negociable

**El monorepo es solo herramienta de desarrollo.** Railway consume cada servicio
de forma individual y aislada vía su propio Dockerfile + railway.json. Ver
`architecture/00-principios.md` antes de escribir cualquier código que cruce
la frontera de un servicio.

## Índice

- `architecture/00-principios.md` — regla no negociable de aislamiento por servicio
- `architecture/01-backend-capas.md` — las 6 capas backend objetivo
- `architecture/02-frontend-capas.md` — las 5 capas frontend objetivo
- `architecture/03-reglas-duras.md` — checklist rápido de reglas duras
- `services/*.md` — un archivo por servicio real del ecosistema
- `contracts/*.md` — contratos que cruzan la frontera entre servicios
- `decisions/*.md` — ADRs de decisiones no obvias
- `conventions/*.md` — entorno, testing, deploy
- `roadmap/sprints.md` — estado de S1-S4
- `roadmap/deuda-tecnica.md` — lista viva de deuda consciente
- `logs/README.md` — convención de archivos `*-logs.xml`

## Servicios (hoy 2 backs + 3 fronts, meta 6 backs)

| Carpeta | Nombre package.json | Rol |
|---|---|---|
| `realsass-sass-back` | `realsass-sass-back` | Identidad, orgs, colaboradores, config, auditoría |
| `realsass-ecommerce-back` | `realsass-ecommerce-back` | Catálogo, stock, órdenes, carrito, clientes |
| `realsass-sass-front` | `realsass-sass-front` | Dashboard dueños |
| `realsass-dashboard-front` | `realsass-dashboard-front` | Dashboard colaboradores |
| `real-ecommerce-front` | `real-ecommerce-front` | Storefront público SSG/ISR |
| `packages/auth-client` | `@real/auth-client` | Firebase auth, apiFetch, AppError |
| `packages/auth-server` | `@real/auth-server` | Guards, decorators, CachePort, FirebaseModule |
| `packages/ui` | `@real/ui` | Componentes shadcn compartidos |
| `packages/trpc` | `@real/trpc` | Contratos tRPC inter-servicios |

## Cómo se usa esto en una sesión nueva

1. Leer este archivo primero.
2. Ir a `architecture/` para saber en qué capa entra la feature pedida.
3. Ir a `services/<servicio>.md` para contexto específico del dominio.
4. Si la decisión no es obvia, crear un ADR en `decisions/` antes de codear.
5. Actualizar `roadmap/deuda-tecnica.md` si se deja algo pendiente a propósito.
