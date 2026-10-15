---
name: runbook-incidente
description: Usar cuando algo falla en producción o staging del ecosistema (servicio caído, errores 5xx/404 masivos, deploy que no arranca, login o checkout rotos) para triar, diagnosticar con los fallos conocidos, mitigar y dejar el postmortem.
---

# Runbook de incidente

> ⚠️ **Skill sin probar en un incidente real.** Los "fallos conocidos" salen de problemas ya vividos y documentados; el resto es
> método general. Tras cada incidente, agregar el nuevo caso a la tabla.

## 0. Guardas

- Mitigar antes de arreglar. **No** ejecutar nada destructivo sobre una base remota ni cambiar variables en Railway sin confirmación del usuario.
- No pegar secretos en el reporte. Hechos observados ≠ hipótesis: separarlos.

## 1. Triaje (5 minutos)

1. **Alcance**: ¿qué servicio(s)? ¿todos los tenants o uno? ¿desde cuándo? ¿hubo deploy o cambio de variables justo antes?
2. **Severidad**: SEV1 (nadie puede comprar/entrar) · SEV2 (parcial o un tenant) · SEV3 (degradado).
3. `GET /health` de cada back; logs de Railway del servicio (primeras líneas tras el arranque suelen decir la causa).

## 2. Fallos conocidos (buscar primero acá)

| Síntoma | Causa conocida | Verificar / mitigar |
|---|---|---|
| El back no arranca y no hay error de código | Falta `ALLOWED_ORIGINS`, `INTERNAL_API_KEY` o `CUSTOMER_SESSION_SECRET` (falla cerrado por diseño) | Log de arranque; definir la variable |
| Deploy cae al iniciar, DB inalcanzable o migración falla | `prisma migrate deploy` corre en el entrypoint | Log del entrypoint; rollback de código si la migración fue aditiva; **no** tocar SQL a mano sin decidirlo |
| `Unable to transform response from server` / 404 en tRPC de ecommerce | Prefijo duplicado `/api/v1/api/v1/trpc` (bug ya corregido) | Probar la ruta real `/api/v1/trpc` |
| Storefront devuelve 404 masivo | Se tragó un error del back como `NOT_FOUND` (debe ser 5xx, ADR-016) | Confirmar el estado de sass-back; revisar los `catch` |
| "Attempted to call useStore() from the server" | Hook de cliente en un Server Component | Usar `requireStore(slug)` |
| Una org ajena abre el circuito y cae el servicio para todos | 403 contado como falla (bug ya corregido) | Revisar el breaker del `TenantGuard` |
| Webhooks no salen | Falta Redis real (BullMQ) o `REDIS_URL` | Verificar Redis; el worker exige conexión |
| Carritos vacíos tras activar la sesión firmada | Cambio de `CUSTOMER_SESSION_SECRET` / `COOKIE_DOMAIN` | Esperado una vez (DT-Q-10); verificar el dominio de la cookie |
| Bundle con valores `undefined` | `NEXT_PUBLIC_*` solo como variable de runtime | Definirlas también como build variables y rebuild |
| Cambió un package compartido y el servicio no se actualizó | Railway no detecta rebuilds por packages | Commit vacío (`make git-empty`) con confirmación |

## 3. Mitigar

Orden de preferencia: rollback del último deploy → revertir la variable cambiada → pausar la funcionalidad (`pause-store` en `/internal/organizations`
para un tenant) → recién entonces parche.

## 4. Comunicar

Un mensaje inicial (qué pasa, a quién afecta, próxima actualización) y uno al resolver. Para el formato de actualizaciones y postmortem usar el skill
`engineering:incident-response`.

## 5. Cierre

1. Postmortem sin culpables: línea de tiempo, causa raíz, qué lo detectó (o por qué no se detectó).
2. **Todo incidente deja un test** que falle sin el arreglo (ADR-024) o una regla en `scripts/audit/`.
3. Registrar en `roadmap/deuda-tecnica.md` (skill `cerrar-sesion`) y agregar la fila a la tabla de arriba.

## Mantenimiento

Depende de ADR-016, ADR-023, ADR-024, `conventions/deploy.md` y `roadmap/deuda-tecnica.md`. Revisar tras cada incidente.
