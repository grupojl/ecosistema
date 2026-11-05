1. Infraestructura

- Dos servidores desde el inicio:
  - Uno para la app, que corre los servicios.
  - Uno para builds y utilidades. Puede ser un CX más chico, con el runner de CI, monitoreo y Coolify mismo, si querés separar el panel de lo que corre en producción.
- Hetzner Cloud Firewall y red privada. Solo se abren los puertos 80 y 443. SSH solo desde tu IP o por VPN (Tailscale o WireGuard). Las bases de datos nunca quedan expuestas a internet.
- Volumen aparte para datos (Postgres y Redis), para poder reemplazar el servidor sin perderlos.
- Backups de Hetzner activados (+20%), además de los de la base de datos.
- Endurecer el servidor: login por llave SSH sin contraseña, fail2ban, actualizaciones de seguridad automáticas.

2. Flujo de CI/CD (lo que más pesa)

push → CI (GitHub Actions)
  → lint + typecheck + tests (Jest, Vitest)
  → pnpm contracts   (orden de ADR-019)
  → build de imágenes Docker
  → push a GHCR (registry)
  → Coolify descarga la imagen y despliega
- Los builds no corren en el VPS de producción. Coolify solo descarga imágenes ya probadas.
- Imágenes con tag por commit (no latest), para que el rollback sea volver a un SHA conocido.
- Escaneo de imágenes y dependencias (Trivy, y el chequeo de ADR-018) en CI.
- Migraciones de Prisma como paso separado antes de levantar la versión nueva. Tienen que ser compatibles hacia atrás (expand/contract), así un rollback no rompe la base.
- Despliegue a preproducción automático desde main, y a producción con

3. Datos

- Postgres con backups probados. pg_dump o WAL a Hetzner ObjeStorage o Backb
- Una restauración de prueba por mes. Un backup que nunca se restauró no cue
- Para producción con pagos, evaluar Postgres administrado o con
  réplica. Es la  falla.
- Redis con persistencia si guarda algo que no se pueda regenerar (caché de acceso, colas).

4. Observabilidad

Ya la tenés prevista en la arquitectura (OpenTelemetry,
Prometheus, Grafaar:
- Uptime externo (Better Stack o UptimeRobot) sobre GET /health
  de cada serviciada front.
- Sentry para errores de front y back, y para el User Feedback de
  ADR-027.
- Alertas a WhatsApp o Telegram: disco lleno, RAM, caída de servicio, fallo de backup.
- Logs centralizan organizationId en cada línea.

5. Despliegue seguro

- Health checks reales en cada servicio (base de datos y Redis
  alcanzables, noa que elzero-downtime de Coolify funcione.
- Rollback de un obado antes denecesitarlo.
- Feature flags (ra publicar códigoapagado y activarlo después. Es más seguro que depender de un deploy.
- Ventana y avisoMexus, que atienden de noche.

6. Seguridad y secretos

- Coolify detrás n 2FA. Tiene tussecretos y acceso a Docker, así que es un objetivo.
- Secretos fuera  de claves de API y de Firebase.                                             
- Cloudflare delaprotección DDoS ycaché de los estáticos del storefront.
- Mantener Coolify actualizado. Ha tenido vulnerabilidades críticas, así que no lo dejes desactualizado.