# ADR-002: Migración de class-validator → Zod para validación de DTOs

**Fecha:** 2026-09-12
**Estado:** Aceptado
**Aplica a:** grupojl-control-backend

## Contexto

`class-validator` y `class-transformer` están en las dependencias del backend
pero el sistema usa TypeScript strict con tipos de dominio ya definidos en
`@grupojl/shared-types`. Mantener dos sistemas de tipos (clases decoradas +
tipos planos) genera drift inevitable: el DTO dice una cosa, el tipo dice otra.

El ADR-001 menciona intención de migrar. Este ADR la formaliza y cierra la deuda.

## Decisión

Usar **Zod** para toda validación de entrada en el backend.
Eliminar `class-validator` y `class-transformer` de las dependencias.

### Patrón canónico post-migración

```ts
// dto/list-audit.dto.ts
import { z } from 'zod';

export const ListAuditSchema = z.object({
  ecosystemId: z.string().optional(),
  page:        z.coerce.number().int().positive().default(1),
  limit:       z.coerce.number().int().min(1).max(100).default(50),
});
export type ListAuditDto = z.infer<typeof ListAuditSchema>;
```

```ts
// En el controller — ZodValidationPipe global en main.ts
@Get()
findAll(@Query() dto: ListAuditDto) {
  return this.svc.findAll(dto); // dto ya está tipado y validado
}
```

### ZodValidationPipe global

```ts
// main.ts — reemplaza ValidationPipe de class-validator
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
app.useGlobalPipes(new ZodValidationPipe());
```

## Alternativas descartadas

**Mantener class-validator:** dos sistemas de tipos es deuda activa.
**Migrar a tRPC:** ecosistema-ms usa gRPC. grupojl-control es HTTP interno.
tRPC no agrega valor aquí y rompe la simetría con el resto del stack.

## Consecuencias

**Ganancia:**
- `z.infer<typeof Schema>` produce el tipo directamente — cero drift DTO ↔ tipo
- Zod schemas son valores en runtime — testeable sin decorators
- `class-validator` y `class-transformer` fuera de dependencias
- Errores de validación estructurados (ZodError → 422 con detalle por campo)

**Costo:**
- DTOs existentes (audit, railway query params) a migrar — estimado: 1 sesión
- `ZodValidationPipe` y `ZodExceptionFilter` a crear en `common/`

**Regla permanente post-migración:**
Un import de `class-validator` en código nuevo es un bug de arquitectura.
Se bloquea en code review sin excepción.

## Archivos afectados

- `grupojl-control-backend/package.json` — remover class-validator, class-transformer; agregar zod
- `grupojl-control-backend/src/main.ts` — ZodValidationPipe global
- `grupojl-control-backend/src/common/pipes/zod-validation.pipe.ts` — nuevo
- `grupojl-control-backend/src/common/filters/zod-exception.filter.ts` — nuevo
- `grupojl-control-backend/src/audit/dto/list-audit.dto.ts` — migrar
- `grupojl-control-backend/src/railway/dto/list-deployments.dto.ts` — nuevo
- `package.json` (root catalog) — agregar zod al catalog
