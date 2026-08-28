# ADR-001: Permisos de Collaborator migrados a JSONB

**Fecha:** (ver historial de schema, migración S1)
**Estado:** Aceptado

## Contexto

Originalmente `Collaborator` tenía columnas booleanas individuales
(`canViewListings`, `canCreateListings`, etc.) directamente en la tabla.

## Decisión

Migrar todas las columnas booleanas de permisos a un solo campo
`permissions Json @default("{}")` en el modelo `Collaborator`.

## Estructura esperada del JSON

```json
{
  "canViewListings": boolean,
  "canCreateListings": boolean,
  "canEditListings": boolean,
  "canDeleteListings": boolean,
  "canViewStats": boolean,
  "canManageLeads": boolean,
  "canManageCollaborators": boolean
}
```

## Regla asociada

El Owner siempre recibe permisos completos **desde el servicio**, nunca se
persisten en DB para el owner — evita duplicar la fuente de verdad de "OWNER
puede todo".

## Alternativas descartadas

- Mantener columnas booleanas — descartado porque cada permiso nuevo requería
  una migración de schema; JSONB permite agregar permisos sin migración.

## Consecuencias

- Ganancia: extensibilidad sin migraciones para nuevos permisos.
- Costo: pérdida de constraints a nivel DB (no hay `NOT NULL` ni tipos
  fuertes sobre las claves del JSON) — la validación vive en
  `parsePermissions()`/`buildPermissionsPatch()` en el service, no en Prisma.
- Deuda: helpers `parsePermissions(raw: unknown)` y
  `buildPermissionsPatch(current: unknown, dto: any)` en
  `collaborators.service.ts` usan `any` — candidato a tipar con Zod cuando se
  aplique Capa 2 (Router/Contrato con Zod).

## Referencias

`realsass-sass-back/prisma/schema.prisma` (modelo `Collaborator`),
`realsass-sass-back/src/collaborators/collaborators.service.ts`
