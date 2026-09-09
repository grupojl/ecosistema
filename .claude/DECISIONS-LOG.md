# DECISIONS-LOG.md — Historial de decisiones tomadas en sesiones de chat

**Repo:** grupojl/welver

Decisiones pequeñas que no justifican un ADR pero que si se olvidan
generan conversaciones repetidas o propuestas que ya se descartaron.

**Formato:** al cerrar una sesión, agregar una sección con la fecha
y las 2-5 decisiones más importantes tomadas. Una línea por decisión,
en bold el tema, después el razonamiento en una oración.

---

## 2026-09-08 — Sesión ADR-011 + ADR-012

- **tRPC exclusivo en ecommerce-back:** controllers REST legacy eliminados. Si un endpoint nuevo no puede ir por tRPC (ej: necesita Set-Cookie), va a REST con justificación en el ADR.
- **lib/store/client.ts usa tRPC server caller:** no fetch REST manual. Excepción documentada: POST /auth/session en auth-context.tsx (necesita Set-Cookie).
- **Cookie `__session` con `sameSite: strict`:** se eligió strict sobre lax porque los fronts están en subdominios propios, no en dominios de terceros. Si se integra un widget embeddable en otros dominios, revisar esta decisión.
- **Rate limiting en auth: 10 req/min por IP:** elegido sobre 5 (muy restrictivo para usuarios legítimos) y 20 (poco efectivo contra bots lentos).
- **Dockerfiles con `dumb-init`:** PID 1 correcto para Node.js en containers. No cambiar a `node dist/main` directo sin revisar manejo de señales.
- **`prisma migrate deploy` en CMD del Dockerfile:** se eligió sobre un script wrapper separado para mantener el Dockerfile simple. Riesgo aceptado: si la migration falla el container no levanta — esto es el comportamiento correcto.
- **Componentes legacy del storefront eliminados (ADR-008):** `catalog/` y `product/` — 0 importaciones activas confirmadas antes de eliminar. Si alguien reporta una página rota, revisar si había un import dinámico no detectado por grep estático.
- **`noImplicitAny: true` en tsconfig.base.json:** heredado por todos los tsconfig del monorepo. Si un servicio nuevo necesita flexibilidad temporal, puede sobrescribir en su tsconfig local con comentario que justifique y fecha de expiración.
- **Named catalogs pnpm PROHIBIDOS:** `catalog:backend`, `catalog:frontend`, etc. no funcionan en el entorno Windows + Git Bash actual. Solo `catalog:` default. No proponer named catalogs aunque parezca más organizado.

---

## Template para nuevas sesiones

```markdown
## YYYY-MM-DD — Sesión [descripción]

- **[Tema]:** [decisión tomada] porque [razón en una oración]. [Qué revisar si cambia el contexto].
```
