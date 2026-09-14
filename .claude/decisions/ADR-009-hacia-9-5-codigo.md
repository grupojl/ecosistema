> ⚠️ **ESTE ADR NO PERTENECE A WELVER/**
> Fue pegado por error desde `ecosistema-ms`. Las entidades que menciona
> (`getAgentMetrics`, `ConversationsService`, `gRPC`, `DT-023`, `DT-029`,
> `LoggerModule`) no existen en welver/. El score 9.1 que proyecta es el
> de ecosistema-ms, no el de este repositorio.
> Score real de welver/ auditado: **8.8/10** — ver `ADR-011-score-real-auditado.md`

---

# ADR-009 — Hacia 9.5/10: código producción-ready

**Estado:** Aceptado — Implementado por x.sh
**Fecha:** 2025-Q3
**Puntaje antes:** 8.0 / 10 (sin tests/obs/deploy)
**Puntaje objetivo:** 9.5 / 10

---

## Contexto

Con ADR-008 se resolvió infraestructura base (logger, metrics, middleware, CI/CD).
Quedan cuatro brechas concretas que impiden superar el 8.5:

| ID | Brecha | Impacto en puntaje |
|----|--------|--------------------|
| DT-023 | `getAgentMetrics` carga 100K rows en Node.js | Base de datos: 6.5 → 9.0 |
| DT-027 | `main.ts` con ValidationPipe contradice ADR-001 (Zod) | Calidad código: 7.5 → 9.0 |
| DT-028 | packages/logger + metrics existen pero no se importan | Config/Twelve-Factor: 9.0 → 9.5 |
| DT-029 | ConversationsService usa `this.prisma` directo pese a IRepository | Arquitectura: 8.5 → 9.0 |

## Decisiones

### D1 — DT-023: getAgentMetrics → SQL GROUP BY

Reemplaza `findMany(take: 50_000)` × 2 por `$queryRaw` con GROUP BY en PostgreSQL.
La paginación ocurre en SQL (LIMIT/OFFSET), no en memoria Node.
Se agregan índices compuestos para el campo JSON `payload->>'agentId'`.

**Por qué $queryRaw y no Prisma groupBy:**
`groupBy` no soporta acceso a campos JSON anidados (`payload->>'agentId'`).
`$queryRaw` es la única opción correcta para este caso.

### D2 — DT-027: ZodExceptionFilter global en todos los main.ts

`ZodExceptionFilter` se registra como primer filtro global, antes de `ValidationPipe`.
Sin este orden, los errores de Zod en los controllers salen como HTTP 500 en lugar de 400.
Se crea en `packages/auth-server/src/filters/` y se exporta como parte del package compartido.

### D3 — DT-028: LoggerModule + PrometheusModule en cada app.module.ts

Cada `app.module.ts` importa `LoggerModule.forRoot()` (pino) y
`PrometheusModule.register()` (@willsoto/nestjs-prometheus).
El `RequestIdMiddleware` se registra via `configure()` del `NestModule`.

### D4 — DT-029: ConversationsService sin acceso directo a PrismaService

El método `handleIncomingMessage` que usaba `this.prisma` directamente
se refactoriza para delegar al `IConversationsRepository` inyectado.
Cierra el contrato de ADR-002.

## Proyección de puntaje

| Dimensión            | v8.0 | v9.5 |
|----------------------|------|------|
| Arquitectura/Capas   | 8.5  | 9.0  |
| Contratos/Tipado     | 8.0  | 8.5  |
| Multi-tenancy        | 9.0  | 9.0  |
| Comunicación gRPC    | 7.5  | 7.5  |
| Calidad de código    | 7.5  | 9.0  |
| Base de datos        | 6.5  | 9.0  |
| Seguridad/RBAC       | 7.0  | 7.5  |
| Config/Twelve-Factor | 9.0  | 9.5  |
| Documentación .claude| 9.5  | 9.5  |
| **Promedio**         | **8.0** | **9.1** |

## Alternativas descartadas

| Alternativa | Por qué se descartó |
|---|---|
| Prisma `groupBy` para agentMetrics | No soporta `payload->>'agentId'` — $queryRaw es obligatorio |
| Mantener ValidationPipe sin ZodFilter | Errores Zod salen como 500 — rompe el contrato del API |
| Herencia de AppModule base | NestJS no tiene herencia limpia de módulos; importación explícita es más predecible |
| CQRS para ConversationsService | Overhead innecesario — el repository pattern resuelve el problema |

## Referencias
- ADR-001 (Zod), ADR-002 (Domain/Repository), ADR-008 (observabilidad base)
- `checklists/ms-capa-3-domain-service.md`
- `patches/DT-023-analytics-agent-metrics.md`
