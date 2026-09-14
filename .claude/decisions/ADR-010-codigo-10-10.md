# ADR-010: Últimos cambios para código 10/10 — welver/

**Fecha:** 2026-09-12
**Estado:** Aceptado — ejecutado vía x.sh

## Contexto

Auditoría 2026-09-12 identifica 3 gaps reales en el código (excluyendo tests/CI/OBS):

### Gap C1 — update-organization.dto.ts (class-validator activo)

`realsass-sass-back/src/organizations/dto/update-organization.dto.ts` es el único
archivo con `class-validator` que sobrevive en el código productivo.
`OrganizationsService.updateMyOrganization()` lo recibe como tipo.
El router tRPC `organizations.update` ya tiene el schema Zod inline — el DTO es redundante.

**Solución:**
- Eliminar `update-organization.dto.ts`
- Cambiar el tipo en `OrganizationsService.updateMyOrganization()` a `UpdateOrganizationInput`
  (que ya existe en `domain/organization.entity.ts`)
- El router tRPC pasa `ctx.input` (inferido de Zod) que es compatible con `UpdateOrganizationInput`

**Verificación post-cambio:**
```bash
grep -r "class-validator" realsass-sass-back/src --include="*.ts"
# → 0 resultados
```

### Gap C2 — Dockerfiles sin prisma migrate deploy

Ambos Dockerfiles (sass-back, ecommerce-back) terminan con:
```dockerfile
CMD ["dumb-init", "node", "dist/main"]
```
Sin `prisma migrate deploy` antes del arranque, las migraciones pendientes
no se aplican en Railway al deployar. Riesgo: schema desincronizado en producción.

**Solución:** reemplazar `CMD` con un entrypoint shell que ejecute migrate y luego el servidor.

### Gap C3 — .env.example ausente

Ningún servicio tiene `.env.example`. Un desarrollador nuevo no puede arrancar
el servicio sin leer los Dockerfiles y las llamadas a `process.env`.
Tampoco hay forma de auditar rápidamente qué vars faltan en un deploy.

## Decisión

Aplicar C1, C2 y C3 en x.sh. Son cambios independientes entre sí y pueden
aplicarse en cualquier orden. El orden en x.sh es C1 → C2 → C3.

## Alternativas descartadas

**C1 — Mantener el DTO y agregar `// @real/legacy-dto`:**
Un comentario no elimina la dependencia de class-validator. La única forma de
cerrar este gap es eliminar el archivo y actualizar el único caller.

**C2 — `prisma migrate deploy` en el build stage del Dockerfile:**
El build stage no tiene acceso a la base de datos de producción. La migración
debe ejecutarse en runtime, contra la DB real.

**C3 — Documentar vars en README:**
El `.env.example` es la convención del ecosistema (Twelve-Factor App, Escalón 2).
Un README no puede ser parseado automáticamente ni copiado directamente.

## Consecuencias

**Al completar:**
- `grep -r "class-validator" realsass-sass-back/src` → 0 resultados
- Deploy en Railway ejecuta migraciones antes de arrancar el servidor
- Un `cp .env.example .env` es suficiente para arrancar en local
- `tsc --noEmit` sigue pasando (el tipo del service no cambia structuralmente)

**Costo:**
- `collaborators.service.ts` importa `PrismaService` para tx — no cambia
- `OrganizationsService` pasa de `UpdateOrganizationDto` (clase) a
  `UpdateOrganizationInput` (interface) — compatible, más limpio

## Referencias

- `domain/organization.entity.ts` — `UpdateOrganizationInput` (el tipo destino)
- `trpc/routers/organizations.router.ts` — schema Zod ya inline (el DTO era redundante)
- `lifecycle/01-fase-desarrollo.md` — Escalón 1 y Escalón 2
- `lifecycle/02-fase-estabilizacion.md` — Escalón 4 (prisma migrate deploy)
