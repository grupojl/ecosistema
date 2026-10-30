# 13 — Norte: reportes de usuario (algo falló / hay un bug)

> 🔒 Contrato. Responde "¿cómo debería ser un reporte de problema?". Se edita solo por decisión explícita
> (ver `decisions/ADR-027-reportes-de-usuario.md`). El estado de la implementación vive en `roadmap/deuda-tecnica.md`.

## El norte en una línea

*El usuario cuenta el problema en tres líneas; el equipo recibe el contexto técnico completo sin pedírselo.*

**Referentes:** **Sentry User Feedback** (principal: el reporte queda atado al evento técnico — trace, release, URL, usuario) ·
**Apple Feedback Assistant** (diagnóstico adjunto con consentimiento visible, ID de seguimiento) ·
**Shopify** (el reporte nace desde el contexto en que estás: organización y módulo, no un formulario genérico).

## Los 5 pilares

### 1. El contexto lo pone el sistema, no el usuario
Cada reporte lleva sin que nadie lo escriba: `organizationId`, módulo, ruta, release, `requestId`/`traceId`, rol, clase de tamaño y user agent.
El usuario aporta solo: qué pasó y (opcional) qué esperaba.

### 2. Consentimiento visible
Todo adjunto de diagnóstico (captura, últimos errores de consola, trace) se muestra antes de enviar y se puede quitar.
**Nunca** se envían secretos, tokens, cookies, cuerpos de request ni datos de pago.

### 3. Seguimiento
El usuario recibe un ID al enviar y ve el estado de sus reportes: `RECEIVED` · `IN_PROGRESS` · `RESOLVED` · `WONT_FIX`.

### 4. Aislamiento por tenant
El dueño y sus colaboradores solo ven los reportes de **su** organización (los suyos, o todos si es OWNER). Superadmin ve todos.

### 5. Un solo canal, el de siempre
```
front --tRPC feedback.*--> sass-back (dueño del modelo) <--HTTP interno + x-internal-api-key-- superadmin
```
Superadmin **lee y actualiza** (patrón ADR-013), no recibe pushes. Cero fetch manual desde el front. Toda vista define cargando, vacío, error y sin permisos (ADR-024).

## Lo que NO hacemos (y por qué)

- Chat/soporte conversacional → es otro producto (Intercom/Zendesk); acá es un reporte, no una conversación.
- Grabación de sesión (replay) → privacidad y costo; se evalúa solo si el volumen lo justifica.
- Reporte anónimo → todo reporte pertenece a un usuario y una organización.
