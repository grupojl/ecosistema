#!/usr/bin/env bash
# =============================================================================
# x.sh — ecosistema (SaaS ecommerce)
# Crea .claude/infrastructure/ con providers.md y environments.md
#
# Idempotente: si el archivo ya existe, no lo sobreescribe.
# Uso: bash x.sh
# Make: make x
# =============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$ROOT/.claude/infrastructure"

GREEN='\033[0;32m'
GREY='\033[0;90m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
skip() { echo -e "${GREY}[~]${NC} $1 (ya existe — sin cambios)"; }

write_file() {
  local path="$1"
  local content="$2"
  if [ -f "$path" ]; then
    skip "$(basename "$path")"
  else
    printf '%s\n' "$content" > "$path"
    ok "$(basename "$path")"
  fi
}

mkdir -p "$INFRA_DIR"
ok "Carpeta .claude/infrastructure/"

# =============================================================================
# providers.md
# =============================================================================
write_file "$INFRA_DIR/providers.md" '# Providers — Proveedores de infraestructura

> Última actualización: 2026-10-03
> Regla: cada proveedor documenta su rol, sus límites y su estrategia de resiliencia.
> Antes de agregar un proveedor nuevo → agregar su sección aquí primero.

---

## Autenticación

### Firebase Authentication (activo)

**Rol:** proveedor principal de autenticación en todos los entornos.
**Usado en:** `packages/auth-client` (cliente) · `packages/auth-server` (servidor)
**Métodos activos:** Google SSO · Apple · Facebook · Custom Token (SSO entre fronts)

**Flujo backend:**
```
Cliente → Firebase (idToken) → auth-server verifica con Firebase Admin SDK
       → custom claims (organizationId, role) → request autenticada
```

**Límites conocidos:**
- Firebase Admin SDK requiere `FIREBASE_PRIVATE_KEY` con saltos de línea escapados (`\n`)
- El popup de Google falla silenciosamente si el dominio no está en la whitelist de Firebase Console
- `signInWithCustomToken` expira en 1 hora — el dashboard-front hace refresh automático

**Resiliencia:**
- Circuit breaker: ⚠️ no implementado — si Firebase cae, toda la auth cae
- Fallback: 🔲 pendiente de decisión (ver sección "Fallback de auth" abajo)
- Timeout configurado: no visible en el código actual

**Variables de entorno:**
```bash
# Backend (Firebase Admin)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Frontend (Firebase cliente — NEXT_PUBLIC_)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

---

### Fallback de auth (pendiente de decisión)

> Estado: 🔲 Por decidir antes del entorno de producción económica (Hetzner)
> El fallback entra en juego cuando Firebase Authentication no está disponible.

**Opciones evaluadas:**

| Opción | Pros | Contras |
|--------|------|---------|
| JWT propio (email + password) | Control total, sin dependencia externa | Hay que implementar y mantener el flujo completo |
| Auth0 como proveedor secundario | Robusto, fácil de integrar | Costo adicional, otra dependencia externa |
| Magic link por email (Resend) | Sin password, UX simple | Requiere que el email llegue — dependencia de Resend |

**Decisión:** TODO — ADR pendiente antes de llegar a producción económica.

**Lo que hay que implementar cuando se decida:**
- [ ] `AuthProviderPort` — interface en `packages/auth-server`
- [ ] `FirebaseAuthAdapter` — implementación actual envuelta en la interface
- [ ] `{Fallback}AuthAdapter` — implementación del proveedor elegido
- [ ] Circuit breaker en `auth-server` que detecte fallo de Firebase y conmute
- [ ] Feature flag `auth.provider` para controlar el switch sin redeploy

---

## Base de datos

### PostgreSQL (activo)

**Rol:** base de datos principal — un servidor dedicado por servicio backend.
**ORM:** Prisma 7
**Entornos:**
- Desarrollo: instancia local Docker (`docker-compose.yml`)
- Railway: PostgreSQL plugin por servicio
- Hetzner (económico): instancia dedicada en el mismo servidor o managed DB
- AWS (tope): RDS PostgreSQL Multi-AZ

**Resiliencia:**
- Migraciones: `prisma migrate deploy` en `entrypoint.sh` — se ejecutan al arrancar
- Backups: 🔲 pendiente de configurar en Hetzner y AWS
- Read replicas: 🔲 roadmap para AWS

**Variables de entorno:**
```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

---

### Redis (activo)

**Rol:** caché, sesiones, BullMQ queues, pub/sub para SSE
**Usado en:** `realsass-sass-back` · `realsass-ecommerce-back`
**Entornos:**
- Desarrollo: instancia local Docker
- Railway: Redis plugin compartido
- Hetzner: instancia dedicada en el mismo servidor
- AWS: ElastiCache

**Resiliencia:**
- Si Redis cae: BullMQ pierde jobs en vuelo (sin persistencia AOF configurada visible)
- Carrito: 🔲 verificar si el carrito anónimo sobrevive un restart de Redis
- Circuit breaker: 🔲 no implementado

**Variables de entorno:**
```bash
REDIS_URL=redis://user:pass@host:6379
```

---

## Email

### Resend (activo)

**Rol:** envío de emails transaccionales
**Usado en:** `realsass-sass-back` (templates de org)
**Templates:** Handlebars — en `config-templates`

**Resiliencia:**
- Fallback: 🔲 sin fallback si Resend cae
- Queue: los emails van por BullMQ — si Resend falla, el job hace retry con backoff
- DLQ: jobs fallidos van a DLQ con retry manual

**Variables de entorno:**
```bash
RESEND_API_KEY=
```

---

## Shipping

### Adaptadores activos

> ⚠️ Estado actual: los 3 adaptadores viven en `real-ecommerce-front` — son stubs.
> Pendiente mover a `realsass-ecommerce-back/src/infrastructure/shipping/`

| Adaptador | Carrier | Mercado | Estado |
|-----------|---------|---------|--------|
| `envia-adapter.ts` | Envia | México / LATAM | Stub — sin API real |
| `welivery-adapter.ts` | Welivery | Argentina | Stub — sin API real |
| `correo-adapter.ts` | Correo | LATAM | Stub — sin API real |

**Selección de carrier actual (`carrier-selector.ts`):**
- < 5kg → Envia
- 5-20kg + $50-$2000 → Welivery
- > 20kg o > $2000 → Correo

**Pendiente:**
- [ ] Mover adapters a `ecommerce-back/src/infrastructure/shipping/`
- [ ] Implementar `ShippingPort` como interface
- [ ] Conectar APIs reales (Envia, Welivery, Correo)
- [ ] Agregar carriers internacionales para escala global (DHL, FedEx, UPS)

---

## Observabilidad

### OpenTelemetry (parcial)

**Estado:** `instrumentation.ts` presente en `realsass-sass-back` — sin collector unificado visible.
**Pendiente:** conectar a un backend de trazas (Grafana Tempo en Hetzner, AWS X-Ray en AWS).

---

## Regla general de resiliencia

Antes de pasar cualquier proveedor a producción económica (Hetzner):
1. Tiene que tener timeout configurado
2. Tiene que tener retry con backoff exponencial
3. Tiene que tener circuit breaker o degradación elegante documentada
4. Tiene que tener su variable de entorno en el `.env.example` del servicio
'

# =============================================================================
# environments.md
# =============================================================================
write_file "$INFRA_DIR/environments.md" '# Environments — Entornos del ecosistema

> Última actualización: 2026-10-03
> Regla: cada entorno nuevo requiere actualizar este archivo + los `.env.example`
> de los servicios afectados antes de hacer el primer deploy.

---

## Mapa de entornos

```
DESARROLLO (local)
     ↓
RAILWAY (staging + primer producci\u00f3n)
     ↓
HETZNER — Producci\u00f3n econ\u00f3mica
     ↓
AWS — Producci\u00f3n tope de gama
  ├── Preproducci\u00f3n (staging productivo)
  └── Producci\u00f3n
```

---

## 1. Desarrollo (local)

**Estado:** ✅ Activo
**Plataforma:** Windows + Git Bash · Node 24.14.0 · pnpm 10.30.3
**Infraestructura local:** Docker Compose — PostgreSQL + Redis

**Cómo levantar:**
```bash
docker-compose up -d        # PostgreSQL + Redis
pnpm install
pnpm --filter realsass-sass-back run start:dev
pnpm --filter realsass-ecommerce-back run start:dev
pnpm --filter realsass-sass-front run dev
pnpm --filter realsass-dashboard-front run dev
pnpm --filter real-ecommerce-front run dev
```

**Variables de entorno:** `.env` local por servicio (no commitear)
**Migraciones:** `pnpm --filter realsass-sass-back run prisma:migrate`

**Diferencias con producción:**
- `NODE_ENV=development`
- Firebase: proyecto de desarrollo separado (distinto `FIREBASE_PROJECT_ID`)
- No hay Redis persistente — los jobs BullMQ se pierden al reiniciar
- Shipping adapters son stubs — no llaman APIs reales
- Sin SSL

---

## 2. Railway (staging / primer deploy productivo)

**Estado:** ✅ Activo — entorno actual de producción
**Plataforma:** Railway.app
**Modelo de deploy:** monorepo en GitHub, servicios independientes por Dockerfile

**Servicios en Railway:**

| Servicio | Dockerfile | Root Directory |
|---------|-----------|----------------|
| `realsass-sass-back` | `realsass-sass-back/Dockerfile` | `/` |
| `realsass-ecommerce-back` | `realsass-ecommerce-back/Dockerfile` | `/` |
| `realsass-sass-front` | `realsass-sass-front/Dockerfile` | `/` |
| `realsass-dashboard-front` | `realsass-dashboard-front/Dockerfile` | `/` |
| `real-ecommerce-front` | `real-ecommerce-front/Dockerfile` | `/` |

**Infraestructura:**
- PostgreSQL: plugin por servicio backend
- Redis: plugin compartido
- Dominio: `.railway.app` o dominio custom por servicio

**Comunicación interna:**
```bash
# Red privada Railway (no salen a internet)
SASS_BACK_URL=https://realsass-sass-back.railway.internal
ECOMMERCE_BACK_URL=https://realsass-ecommerce-back.railway.internal
```

**Variables de build time (ARG en Dockerfile):**
```bash
# Se setean en Railway → Service → Variables
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_SASS_BACK_URL=
# ... (ver providers.md para la lista completa)
```

**Migraciones:** automáticas en `entrypoint.sh` (`prisma migrate deploy`)

**Limitaciones conocidas:**
- Sin named catalogs en pnpm — usar solo `catalog:` default
- `nixpacks.toml` y Dockerfile pueden coexistir — Railway usa el Dockerfile si existe
- `shamefully-hoist=true` en `.npmrc` para que standalone de Next.js funcione

---

## 3. Hetzner — Producción económica

**Estado:** 🔲 Planificado — siguiente fase después de Railway
**Plataforma:** Hetzner Cloud (VPS dedicado o Cloud Servers)
**Modelo:** Docker Compose en servidor dedicado o Docker Swarm para HA básico

**Por qué Hetzner:**
- Costo por performance superior a Railway a volumen medio
- Control total sobre la infraestructura
- Servidores en Frankfurt (Europa) — buena latencia para LATAM + Europa

**Infraestructura objetivo:**

```
Hetzner Cloud
├── Load Balancer (Hetzner LB)
├── Servidor app (CX32 o superior)
│   ├── realsass-sass-back
│   ├── realsass-ecommerce-back
│   ├── realsass-sass-front
│   ├── realsass-dashboard-front
│   └── real-ecommerce-front
├── Servidor DB (CPX31)
│   ├── PostgreSQL (sass-back DB)
│   └── PostgreSQL (ecommerce-back DB)
└── Servidor Redis (CX21)
    └── Redis con AOF persistence
```

**Diferencias vs Railway:**
- CI/CD: GitHub Actions → SSH deploy (no Railway CLI)
- SSL: Caddy o Traefik como reverse proxy con Let'\''s Encrypt
- Backups: `pg_dump` programado + Hetzner Volumes snapshots
- Monitoreo: Grafana + Prometheus en servidor dedicado o Grafana Cloud free tier
- Redis: AOF habilitado — los jobs BullMQ sobreviven reinicios

**Checklist antes de migrar a Hetzner:**
- [ ] GitHub Actions pipeline de deploy por servicio
- [ ] Secrets en GitHub Actions (no en `.env` commiteado)
- [ ] Caddy config con SSL automático
- [ ] `pg_dump` cron backup diario
- [ ] Redis AOF habilitado
- [ ] Health checks externos (Better Uptime o similar)
- [ ] Fallback de auth definido (ver `providers.md`)
- [ ] `.env.example` completo por servicio

---

## 4. AWS — Producción tope de gama

**Estado:** 🔲 Roadmap — fase final de escalabilidad global
**Plataforma:** Amazon Web Services
**Modelo:** ECS Fargate + RDS + ElastiCache + CloudFront

### 4a. Preproducción AWS

**Propósito:** staging productivo — mismo entorno que producción pero con tráfico interno.
Toda feature pasa por preproducción antes de ir a producción.

**Infraestructura:**
```
AWS (región us-east-1 o eu-west-1)
├── ECS Fargate (cluster preprod)
│   └── Task definitions por servicio (mismas imágenes que prod, distinto tag)
├── RDS PostgreSQL (instancia small — db.t3.medium)
├── ElastiCache Redis (cache.t3.micro)
└── CloudFront (misma config que prod, distinto origin)
```

**Variables diferenciadas vs producción:**
```bash
NODE_ENV=production          # igual que prod — queremos detectar bugs de prod
DATABASE_URL=                # RDS preprod separado
REDIS_URL=                   # ElastiCache preprod separado
# Firebase: mismo proyecto o proyecto de staging según política
```

### 4b. Producción AWS

**Infraestructura objetivo:**

```
AWS (multi-región)
├── Route 53 (DNS + health checks)
├── CloudFront (CDN global — assets + SSR cacheado)
├── ALB (Application Load Balancer)
├── ECS Fargate (auto-scaling por servicio)
│   ├── realsass-sass-back        (2+ tasks)
│   ├── realsass-ecommerce-back   (2+ tasks)
│   ├── realsass-sass-front       (2+ tasks)
│   ├── realsass-dashboard-front  (2+ tasks)
│   └── real-ecommerce-front      (2+ tasks)
├── RDS PostgreSQL Multi-AZ
│   ├── sass-back DB
│   └── ecommerce-back DB
├── ElastiCache Redis Cluster
├── S3 + CloudFront (assets de productos)
└── SES o Resend (email — evaluar en este punto)
```

**Lo que cambia vs Hetzner:**
- Auto-scaling real por servicio según carga
- RDS Multi-AZ — failover automático si la DB primaria cae
- CloudFront resuelve el gap de CDN para assets de productos (latencia global)
- Secrets Manager en vez de variables de entorno planas
- VPC privada — los backends no tienen IP pública

**Checklist antes de migrar a AWS:**
- [ ] Terraform o CDK para infraestructura como código
- [ ] ECR como registry de imágenes Docker
- [ ] ECS task definitions por servicio
- [ ] RDS Multi-AZ configurado
- [ ] CloudFront distribution conectada al storefront
- [ ] AWS Secrets Manager para todas las variables sensibles
- [ ] WAF en el ALB (OWASP rules)
- [ ] CloudWatch + alarmas por servicio
- [ ] Runbook de incident response actualizado

---

## Comparación de entornos

| Dimensión | Desarrollo | Railway | Hetzner | AWS Preprod | AWS Prod |
|-----------|-----------|---------|---------|-------------|----------|
| Costo | $0 | Bajo | Medio | Medio-alto | Alto |
| Control | Total | Bajo | Alto | Alto | Alto |
| HA / Failover | No | Parcial | Manual | Sí | Sí |
| Auto-scaling | No | Básico | No | Sí | Sí |
| CDN | No | No | Caddy | CloudFront | CloudFront |
| DB backup | No | Plugin | Manual | RDS auto | RDS auto |
| Observabilidad | Logs | Logs | Grafana | CloudWatch | CloudWatch |
| Estado | ✅ Activo | ✅ Activo | 🔲 Próximo | 🔲 Roadmap | 🔲 Roadmap |

---

## Política de promoción entre entornos

```
feature branch
     ↓ PR aprobado
main (Railway — staging)
     ↓ tag vX.Y.Z
Hetzner (producción económica)
     ↓ validación con tráfico real
AWS Preproducción
     ↓ smoke tests + aprobación manual
AWS Producción
```

**Regla:** ningún cambio va a producción económica sin haber corrido en Railway primero.
**Regla:** ningún cambio va a AWS producción sin haber pasado por AWS preproducción.
'

# =============================================================================
# Resumen
# =============================================================================
echo ""
echo "================================================="
echo " .claude/infrastructure/ generado"
echo "================================================="
echo ""
echo "  Archivos:"
echo "    .claude/infrastructure/providers.md"
echo "    .claude/infrastructure/environments.md"
echo ""
echo "  Lo que documenta providers.md:"
echo "    - Firebase Auth (activo) + fallback pendiente de decisión"
echo "    - PostgreSQL + Redis + Resend + Shipping adapters"
echo "    - Regla de resiliencia antes de pasar a producción"
echo ""
echo "  Lo que documenta environments.md:"
echo "    - Desarrollo local"
echo "    - Railway (activo)"
echo "    - Hetzner (próximo — producción económica)"
echo "    - AWS Preproducción + Producción (roadmap)"
echo "    - Política de promoción entre entornos"
echo ""
echo "  Commit sugerido:"
echo "    git add .claude/infrastructure"
echo "    git commit -m 'docs: infraestructura — providers y entornos'"
echo "================================================="