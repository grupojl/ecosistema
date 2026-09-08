# Convención: Claves de Redis con scope de tenant

**Regla:** Toda clave de Redis que almacene datos de negocio DEBE incluir
`organizationId` (y cuando aplique `ecosystemId`) como prefijo.

## Patrón obligatorio

```ts
// ❌ Clave sin scope — bug de seguridad multi-tenant
const key = `config:${configKey}`;

// ✅ Clave con scope de organización
const key = `org:${organizationId}:config:${configKey}`;

// ✅ Clave con scope completo (ecosistema + organización)
const key = `${ecosystemId}:${organizationId}:conversation:${conversationId}`;
```

## Claves existentes y su estado

### realsass-sass-back

| Service | Key pattern | Estado |
|---------|------------|--------|
| `ConfigCacheService` | `org:${organizationId}:${type}:${key}` | ✅ Correcto |
| `OrganizationsClientService` (ecommerce) | `org:${organizationId}:store-info` | ✅ Correcto |

### Claves que NO deben usarse

```ts
// Sin scope — PROHIBIDO en código de negocio
const key = `theme:${themeId}`;         // ❌ pertenece a una org
const key = `flags:${key}`;             // ❌ pertenece a una org
const key = `secret:${secretKey}`;      // ❌ pertenece a una org
```

## TTLs estándar

| Tipo de dato | TTL | Razón |
|---|---|---|
| Tenant context (org info) | 5 min | Cambia poco, impacta performance |
| Feature flags | 30 s | Cambia en dashboards — quiero rapidez |
| Temas (themes) | 5 min | Cambia raramente |
| Session tokens | 14 días | Igual a la cookie |
| Health check probes | 3 s | Solo para no saturar DB |

## Enforcement

ESLint rule `@real/no-unscoped-cache-key` — pendiente de implementar en S4-G.
Hasta entonces: code review manual con esta convención como referencia.
