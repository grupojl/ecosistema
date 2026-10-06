# Providers — Proveedores de infraestructura

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

