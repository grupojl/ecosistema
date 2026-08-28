# Contrato: TenantContext

## Shape (definido en @real/auth-server)

```ts
export type TenantRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'; // genérico del package

export interface TenantContext {
  readonly userId: string;          // id interno (PK de users), NO el firebaseUid
  readonly organizationId: string;
  readonly role: TenantRole;
  readonly permissions: Readonly<Record<string, boolean>>;
}
```

## Shape real usado hoy (sass-back / ecommerce-back)

En la implementación actual, `TenantRole` es más simple:
```ts
type TenantRole = 'OWNER' | 'COLLABORATOR';
```
La jerarquía de 4 niveles (OWNER > ADMIN > MEMBER > VIEWER) mencionada en
convenciones generales del proyecto **no está implementada así en el código
real** — verificar contra el schema/tipo antes de asumir 4 niveles.

## Permisos granulares (Collaborator)

```ts
interface CollaboratorPermissions {
  canViewListings: boolean;
  canCreateListings: boolean;
  canEditListings: boolean;
  canDeleteListings: boolean;
  canViewStats: boolean;
  canManageLeads: boolean;
  canManageCollaborators: boolean;
}
```
Owner siempre recibe permisos completos desde el servicio — no se guarda en DB.
Ver `decisions/ADR-001-permisos-jsonb.md` para por qué es JSONB.

## Cómo se resuelve en cada back

| Back | Método | Detalle |
|---|---|---|
| `realsass-sass-back` | Prisma directo | `TenantGuard` local en `src/common/guards/tenant.guard.ts`, lee `Collaborator`/`Organization` directo. Es dueño de la tabla. |
| `realsass-ecommerce-back` | HTTP + Redis cache | `TenantGuard` de `@real/auth-server` + `OrganizationsClientService.getAccess()`. Ver `contracts/organization-access.md`. |

## Regla dura

El *shape* de `TenantContext` y la jerarquía de roles debe ser idéntica en
todos los backs, aunque el *método* de resolución difiera. Si un back nuevo
necesita otro shape, se extiende `@real/auth-server`, no se bifurca.
