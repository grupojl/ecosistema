Actuá como ingeniero senior de TypeScript/NestJS trabajando sobre el monorepo
ecosistema-ms. Tu tarea es eliminar type assertions (`as any`, `as unknown as`,
`as never`) inseguras, reemplazándolas por tipos declarados correctamente.

## Contexto del proyecto
- Monorepo pnpm workspaces: chatia-backend, pasarelapagos-backend,
  notificaciones-backend, analytics-backend, workers-backend, packages/*
- Prisma 7 con campos `Json` en varios modelos (featureFlags, limits, metadata,
  payload, businessData, etc.)
- Convención existente: todo cast intencional lleva el comentario
  `// @ecosistema-ms/jsonb-cast` (u otro sufijo según el tipo de excepción)
- Regla dura del proyecto (ADR-007): un cast sin ese comentario es bloqueante
  en code review

## Regla de decisión — aplicá esto para CADA cast que encuentres

1. **Ambos lados del cast son tipos definidos dentro de este repo**
   (ej: tu interfaz de input vs. un campo Prisma.Json) →
   NO uses `as`. Solución correcta:
   - Redeclará el tipo de entrada con el shape real de dominio
     (ej: `Partial<ChatFeatureFlags>` en vez de `Partial<Record<string, boolean>>`)
   - Al escribir hacia Prisma, usá `satisfies Prisma.InputJsonValue` en vez de `as`
   - Al leer desde Prisma, tipá explícito el resultado con una interfaz de
     dominio (`(row.featureFlags as ChatFeatureFlags)` está prohibido —
     definí una función `toChatFeatureFlags(json: Prisma.JsonValue): ChatFeatureFlags`
     que valide/mapee campo por campo, o al menos tipe el retorno de la función
     que llama a Prisma)

2. **El dato viene de un sistema externo real** (webhook de Stripe/MercadoPago,
   respuesta de un SDK con tipos incompletos, payload de otro microservicio
   sin contrato .proto) →
   El cast ES legítimo. Dejalo, pero:
   - Agregá el comentario marcador correspondiente al final de la línea
   - Si no existe un marcador para ese caso, creá uno nuevo consistente con
     los existentes (`@ecosistema-ms/external-cast`, `@ecosistema-ms/sdk-cast`)
   - Acotá el cast al campo mínimo necesario, nunca al objeto completo

3. **Es un `as never`** →
   Casi nunca es necesario. `never` es el bottom type y es asignable a
   cualquier tipo — es la forma "más peligrosa" y silenciosa de bypassear
   el compilador porque no explota subtipado real, solo aprovecha una regla
   de tipos vacíos. Reemplazalo SIEMPRE por:
   - El tipo concreto que se espera (ej: `Prisma.InputJsonValue`,
     `Prisma.PaymentCreateInput`), o
   - Si de verdad no hay forma de tipar (raro), usá `as unknown as TipoConcreto`
     con el marcador correspondiente — nunca dejes `as never` sin justificación
     explícita en un comentario

## Pasos a seguir

1. Corré esto en cada uno de los 5 microservicios para listar los casts sin marcar:
```bash
   grep -rn "as any\|as unknown as\|as never" */src --include="*.ts" \
     | grep -v "@ecosistema-ms/"
```

2. Para cada resultado, aplicá la regla de decisión de arriba. Priorizá en
   este orden (mayor riesgo primero):
   a. `organization-config/` en chatia, pasarela y notificaciones
      (featureFlags, limits — son tipos de dominio ya definidos, no deberían
      necesitar cast)
   b. `circuit-breaker.service.ts` en los 4 MS que lo usan (el `as unknown as
      CircuitBreaker<...>` — tipar el Map de breakers correctamente en vez
      de castear en cada acceso)
   c. `webhook.processor.ts` y providers de pago (legítimos, solo necesitan
      el comentario marcador)
   d. El resto

3. Después de cada cambio, corré `tsc --noEmit` en el servicio afectado para
   confirmar que sigue compilando:
```bash
   pnpm --filter <servicio> typecheck
```

4. NO toques lógica de negocio, nombres de variables, ni estructura de
   carpetas — el único objetivo es la seguridad de tipos.

5. Al final, generá un resumen con:
   - Cuántos casts se eliminaron reemplazándolos por tipos reales
   - Cuántos quedaron como legítimos y qué marcador se les agregó
   - Cualquier caso ambiguo que requiera decisión humana (explicalo, no lo
     resuelvas a ciegas)

Entregá el resultado como parches por archivo (diff), no reescribas archivos
completos salvo que el cambio sea mayoritario.

## 1. Detección Exhaustiva de Assertions
El comando `grep` anterior era insuficiente. Para encontrar TODOS los type assertions (incluyendo sintaxis simple y legacy), la búsqueda debe incluir:

```bash
grep -rn " as \|<[A-Za-z0-9_]\+>" */src --include="*.ts" \
  | grep -v "@ecosistema-ms/" \
  | grep -v " import " \
  | grep -v " export "
