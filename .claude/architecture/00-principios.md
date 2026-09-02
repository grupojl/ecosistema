# Principios no negociables

## El monorepo es solo herramienta de desarrollo

pnpm workspaces + `catalog:` único existen para compartir tipos y código entre
servicios **en local**. En producción, **cada servicio se despliega individual
y aisladamente en Railway** vía su propio `Dockerfile` + `railway.json`
(`dockerfilePath` apuntando a esa carpeta).

## Consecuencias de diseño

1. Ningún servicio puede asumir en runtime que los otros viven en el mismo
   filesystem o proceso.
2. Los `packages/*` (`@real/auth-server`, `@real/auth-client`, `@real/ui`,
   `@real/trpc`) se **copian y buildean dentro de cada imagen Docker** — no son
   un servicio corriendo aparte, son librería compilada al momento del build.
3. Toda comunicación entre servicios en producción es **HTTP/tRPC de red
   real**, nunca import directo de un service de otro back.
   `OrganizationsClientService` (HTTP + Redis cache) es el patrón correcto;
   un `import { CatalogService } from '../../otro-back/...'` sería un bug de
   arquitectura aunque el monorepo lo permita compilar.
4. Variables de entorno (`ARG`/`ENV` en cada Dockerfile) son la única fuente
   de configuración por servicio — nada de asumir `.env` compartido entre backs.

## Regla de oro para toda decisión nueva

> ¿Esto asume que dos servicios comparten proceso, filesystem o memoria en
> producción? Si la respuesta es sí, está mal — aunque funcione en el
> monorepo local. Railway los corre aislados; el contrato entre ellos es
> HTTP/tRPC + env vars, punto.

## Señales de alarma concretas

### 1. Import que cruza la frontera de un back a otro
```ts
// PROHIBIDO
import { CatalogService } from '../../../realsass-sass-back/src/catalog/catalog.service';
```
El Dockerfile de cada servicio solo copia su propia carpeta + `packages/`.
Esa ruta no existe en la imagen.

### 2. Asumir un filesystem compartido
```ts
// PROHIBIDO
fs.readFileSync('/app/realsass-sass-back/uploads/logo.png')
```
Cada contenedor tiene su propio filesystem efímero.

### 3. Estado en memoria compartido entre procesos
```ts
// PROHIBIDO para datos cross-request
let cacheGlobal = new Map();
```
En prod son procesos Node separados en containers separados — memoria no se
comparte, ni con múltiples réplicas del mismo servicio. Usar Redis
(`RedisService`, `ConfigCacheService`) para esto. Única excepción documentada:
`MemoryCacheAdapter` en `@real/auth-server`, que explícitamente declara la
limitación "no se comparte entre instancias del proceso (escala vertical)".

### 4. Llamar un método de servicio en vez de HTTP
```ts
// PROHIBIDO
const access = organizationsService.getOrganizationAccess(uid, orgId);

// CORRECTO — patrón ya usado en el repo
const access = await this.organizationsClientService.getAccess(token, uid, orgId);
```

### 5. Rutas relativas en vez de env vars
```ts
// PROHIBIDO
const SASS_BACK_URL = '../realsass-sass-back';

// CORRECTO
const SASS_BACK_URL = process.env.SASS_BACK_URL;
```

## Checklist de 3 preguntas antes de escribir código nuevo

1. ¿Este import sale de mi carpeta de servicio + `packages/`? → Si sí, prohibido.
2. ¿Este dato lo necesito "ya generado por otro back"? → Tiene que llegar por
   request o llamada HTTP, nunca por disco/memoria compartida.
3. ¿Si Railway escala este servicio a 3 réplicas, esto se rompe? → Si depende
   de memoria compartida entre réplicas, va a Redis o Postgres.

## Ejemplo canónico de "bien hecho"

`realsass-ecommerce-back/src/organizations-client/organizations-client.service.ts`:
- No importa nada de `sass-back`.
- Hace `fetch` HTTP real a una URL de env var (`SASS_BACK_URL`).
- Cachea en Redis (no en memoria) con TTL corto.
- Comentario explícito en el código: "real-back es la única fuente de verdad".

## Degradación y resiliencia entre servicios

**Esta sección documenta decisiones tomadas, no aspiraciones.**
Cada decisión de degradación debe estar acá antes de llegar a producción.

### OrganizationsClientService (ecommerce-back → sass-back)

| Escenario | Comportamiento decidido | Razón |
|---|---|---|
| sass-back no responde (timeout 2s) | Rechazar con 503 | No servir con permisos desconocidos — seguridad > disponibilidad |
| Redis caído | Fallback a MemoryCacheAdapter (ya implementado) | Degradación aceptable, documenta limitación de réplicas |
| sass-back responde lento (>500ms) | Log de warning + continuar | Alertar sin romper — el TTL de Redis amortigua |

### OrganizationsClientService — comportamiento por tipo de endpoint (S4-A — 2026-09-02)

El timeout de 2s ya configurado es correcto. Lo que varía es la acción
post-timeout según qué datos maneja el endpoint:

| Escenario | Endpoint | Comportamiento | Razón |
|---|---|---|---|
| OrganizationsClientService tarda > 2s | Checkout / admin dashboard | Rechazar con 503 | Datos organizacionales sensibles — seguridad > disponibilidad |
| OrganizationsClientService tarda > 2s | Catálogo público storefront | Continuar con cache vencida + log warning | Sin datos sensibles — disponibilidad > seguridad estricta |

### FirebaseAuthGuard (todos los backs)

| Escenario | Comportamiento decidido | Razón |
|---|---|---|
| Firebase Admin SDK no disponible | Rechazar con 503, no 401 | 401 implica "token inválido", 503 implica "no puedo verificar" — semánticamente distinto |
| Token expirado | 401 con `code: TOKEN_EXPIRED` | El front debe forzar refresh y reintentar |
| Token válido pero claims desactualizados | Servir con claims viejos + log | Aceptable hasta el refresh natural (55 min) — documentado en ADR-003 |

### Health check con Firebase Admin (S4-A — 2026-09-02)

| Escenario | Comportamiento decidido | Razón |
|---|---|---|
| Firebase Admin SDK no disponible al arranque | No arrancar — crash intencional | Un servicio que no puede verificar identidad no debe servir requests |
| Firebase Admin SDK cae en runtime | Health check devuelve `degraded`, no `down` | Railway no reinicia en `degraded` — el servicio sigue procesando tokens en cache |
| Firebase Admin SDK no responde en > 3s (health check) | Health check devuelve `degraded` | No bloquear el endpoint que Railway usa para decidir si reiniciar |

Implementación requerida en cada `/health`:
```ts
// La distinción degraded vs down es la clave:
// - down   → Railway reinicia el servicio (evitar por Firebase solo)
// - degraded → Railway alerta sin reiniciar (correcto cuando Firebase falla en runtime)
const firebaseOk = await checkFirebaseWithTimeout(3000).catch(() => false);
return {
  status:   firebaseOk ? 'ok' : 'degraded',
  firebase: firebaseOk ? 'ok' : 'degraded',
  database: await checkPrisma(),
  redis:    await checkRedis(),
};
```

### Servicios futuros: chat-ia-back y pagos-back (S4-A — 2026-09-02)

| Servicio | Timeout | Comportamiento post-timeout | SLA distinto | Razón |
|---|---|---|---|---|
| `chat-ia-back` | 2s | 503 | No | Datos organizacionales — mismo criterio que admin |
| `pagos-back` | 5s | 503 | **Sí** | Transacciones financieras toleran más latencia; un pago que tarda 4s es preferible a un 503 |

**Regla para servicios nuevos:** documentar el comportamiento de degradación
en esta sección antes de escribir la primera línea de código.
El patrón default es timeout 2s + 503. Excepciones requieren justificación explícita acá.

## Comunicación interna — tRPC, nunca REST

**Regla:** Todo consumo interno entre servicios usa tRPC (o gRPC cuando el
volumen lo justifique). REST se reserva para APIs públicas externas.

```
✅ Front → Back:           tRPC (httpBatchLink con credentials: include)
✅ Server Component → Back: createServerCaller() tRPC (sin React)
✅ Back → Back:            tRPC HTTP (OrganizationsClientService)
✅ Client Component:        rehidrata desde Server, no fetch propio

❌ Front → Back REST:      bug de arquitectura
❌ Server Component fetch:  bug si existe el procedure tRPC equivalente
❌ Client fetch manual:     bug si existe el hook tRPC equivalente
```

**Excepciones permanentes documentadas:**

| Endpoint | Por qué REST |
|---|---|
| `POST /auth/session` | Bootstrap cookie HttpOnly — Set-Cookie header (ADR-004) |
| `DELETE /auth/session` | Revocación cookie HttpOnly — mismo motivo |
| `GET /health` | Railway healthcheck — no es comunicación de datos |
| APIs públicas externas | Consumidores externos no tienen cliente tRPC |

## Modelo Server/Client Components

```
page.tsx (Server Component)
  ├─ await createCaller().catalog.list({ orgId })  ← tRPC server-side
  ├─ <HydrationBoundary state={dehydrate(queryClient)}>
  └─ <ProductList />                               ← client rehidrata

ProductList (Client Component, 'use client')
  ├─ trpc.catalog.list.useQuery({ orgId })         ← rehidrata desde server
  └─ NO fetch propio — los datos ya vinieron del server
```
