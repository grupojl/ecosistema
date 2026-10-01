# Runbook de incidente — welver/

**Última actualización:** 2026-09-30
**Aplica a:** realsass-sass-back, realsass-ecommerce-back, Redis, PostgreSQL

---

## Cómo detectar un incidente

1. **Railway Dashboard** → el health check `/health` falla → servicio en estado ERROR
2. **Alerta por email/Slack** (configurar en Railway → servicio → Settings → Alerts)
3. **Reportes de usuarios** — clientes no pueden acceder

---

## Escenario 1 — sass-back caído

**Impacto:** Login bloqueado. ecommerce-back no puede validar tenants → 503 en storefront.

**Pasos:**
1. Railway Dashboard → realsass-sass-back → ver logs de error
2. Si hay crash loop: Deployments → seleccionar el último deployment exitoso → Redeploy
3. Si es por DB: ver Escenario 3
4. Si es por env var faltante: Settings → Variables → verificar ALLOWED_ORIGINS, DATABASE_URL, FIREBASE_*
5. Verificar: `curl https://<sass-back-url>/api/v1/health` → debe retornar `{"status":"ok"}`

**Rollback rápido:**
Railway → realsass-sass-back → Deployments → último deployment verde → tres puntos → Redeploy

---

## Escenario 2 — ecommerce-back caído

**Impacto:** Storefront y dashboards de tiendas no responden.

**Pasos:**
1. Railway Dashboard → realsass-ecommerce-back → ver logs
2. Verificar que sass-back está UP — ecommerce-back depende de él para validar tenants
3. Si sass-back está UP y ecommerce-back falla: Redeploy desde último deployment exitoso
4. Verificar: `curl https://<ecommerce-back-url>/api/v1/health`

---

## Escenario 3 — Base de datos caída / corrupta

**CRÍTICO — no correr prisma migrate reset en producción**

**Pasos:**
1. Railway Dashboard → PostgreSQL → ver estado del servicio
2. Si el servicio está DOWN: esperar recuperación automática de Railway (HA en plans Pro+)
3. Si hay corrupción: Railway → PostgreSQL → Backups → restaurar último backup
4. Después de restaurar: reiniciar el back correspondiente para re-ejecutar health checks
5. Las migraciones Prisma NO se re-ejecutan en restart — `entrypoint.sh` usa `migrate deploy` que es idempotente

**RPO (Recovery Point Objective):** ver .claude/roadmap/deuda-tecnica.md DB-01

---

## Escenario 4 — Redis caído

**Impacto limitado:** ambos backs tienen fallback a MemoryCacheAdapter. El sistema
sigue funcionando con degradación — pérdida de caché de tenant context y config.

**Pasos:**
1. Railway Dashboard → Redis → estado
2. Los backs detectan Redis caído y cambian a MemoryCacheAdapter automáticamente
3. Cuando Redis vuelve: los backs reconectan automáticamente (retryStrategy configurada)
4. No es necesario reiniciar los backs — la reconexión es transparente

**Limitación con réplicas:** si hay múltiples réplicas de un back, cada una tiene su
propio MemoryCacheAdapter en memoria → inconsistencia de caché entre réplicas.
Esto es aceptable temporalmente mientras Redis no está disponible.

---

## Post-incidente

Dentro de las 24hs de resolver el incidente, documentar en este archivo:

```markdown
### Incidente YYYY-MM-DD — Título

**Duración:** Xh Ym
**Impacto:** Qué servicios afectados, cuántos usuarios
**Causa raíz:** Qué falló
**Resolución:** Qué se hizo para resolverlo
**Prevención:** Qué cambio se hace para evitar repetición
```

---

## Contactos y recursos

- **Railway Dashboard:** https://railway.app/dashboard
- **Logs en tiempo real:** Railway → servicio → Logs
- **Health checks:**
  - sass-back: `GET /api/v1/health`
  - ecommerce-back: `GET /api/v1/health`
- **Filtrar eventos de seguridad en logs:** buscar `securityEvent:true`
