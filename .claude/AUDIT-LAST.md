# AUDIT-LAST — ecosistema (welver)

Fecha: 2026-09-25
Score: 57/100 [D]

## FAILs pendientes
- A2/K4: 6/17 prisma-*.repository.ts sin toEntity() en realsass-ecommerce-back
- B1: 2 as any sin anotación en customers/types/customer.types.ts

## REVIEWs accionables
- H1: JSON.parse sin try en config-cache.service.ts y market-resolver.service.ts
- H3: 1 console.* en servicios de producción
- K1: 6 fetch directos (reemplazar con apiFetch de @real/auth-client)

## Siguientes pasos
1. Agregar toEntity() en los 6 repos de ecommerce-back (sprint actual)
2. Wrappear JSON.parse en try/catch
3. Migrar fetch directos a apiFetch
