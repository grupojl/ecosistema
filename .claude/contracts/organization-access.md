# Contrato: Organization Access (patrón canónico HTTP + cache)

Este es el patrón de referencia para **toda** comunicación entre backs.
Cualquier feature nueva que necesite datos de otro servicio debe seguir esta
misma forma.

## Endpoint fuente de verdad

`GET /auth/organization-access` en `realsass-sass-back`
(`Headers('x-organization-id')`, requiere `@CurrentUser()`).

## Consumidor de referencia

`realsass-ecommerce-back/src/organizations-client/organizations-client.service.ts`

```ts
export interface OrganizationAccessResult {
  canAccess: boolean;
  userId?: string;
  organizationId?: string;
  role?: TenantRole;
  permissions?: Record<string, boolean>;
  reason?: string;
}
```

## Flujo

1. `TenantGuard` (de `@real/auth-server`) extrae `firebaseToken`, `uid`,
   `organizationId` del request.
2. Llama `OrganizationsClientService.getAccess(firebaseToken, uid, organizationId)`.
3. El service arma una `cacheKey(firebaseUid, organizationId)` y consulta Redis
   primero (`RedisService`, TTL corto).
4. Si no hay cache, hace `fetch` HTTP real a
   `${SASS_BACK_URL}/auth/organization-access` con el Bearer token reenviado
   y el header `x-organization-id`.
5. Cachea el resultado en Redis antes de devolver.

## Por qué es el patrón correcto

- No hay import de clases entre backs.
- `SASS_BACK_URL` es una env var, no una ruta relativa — funciona igual en
  local (`docker-compose`) y en Railway (URL pública/privada del servicio).
- El cache Redis evita golpear `sass-back` en cada request sin acoplar los
  procesos.
- Documentado en el propio código: "Mismo servicio, palabra por palabra, que
  usa real-config-back — así cualquiera que ya conozca ese microservicio
  reconoce este al toque." → sirve como molde para servicios futuros
  (`chat-ia-back`, `pagos-back`).

## Middleware unificado (Capa 1)

`createTrpcAuthMiddleware` (en `@real/auth-server`) recibe una función
`getOrganizationAccess: (token, uid, orgId) => Promise<OrganizationAccessResult>`
inyectable — así `sass-back` pasa su propia resolución Prisma y
`ecommerce-back` pasa `OrganizationsClientService.getAccess`, sin duplicar la
lógica de middleware Express (extracción de Bearer, inyección en `req`).
