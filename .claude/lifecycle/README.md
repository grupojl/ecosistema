# Lifecycle — Software de Clase Mundial

Los 13 escalones que llevan welver/ al top 5-10% mundial.
Organizados en 4 fases de construcción — en orden de ejecución, no de importancia.

## Por qué este orden

El error que mata proyectos es implementar el escalón 9 antes de tener sólido
el escalón 1. Los escalones más altos son inútiles si los fundamentos fallan.
Netflix tiene Chaos Engineering porque primero tuvo arquitectura limpia.

## Las 4 fases

| Fase | Cuándo | Escalones | Estado |
|------|--------|-----------|--------|
| [Desarrollo](01-fase-desarrollo.md) | Ahora | 1, 2, 4 | 🟡 Avanzado |
| [Estabilización](02-fase-estabilizacion.md) | Antes de producción | 3, 5, 6 | 🔴 En curso |
| [Hardening](03-fase-hardening.md) | Primer ecosistema en prod | 7, 8, 10 | ⚪ Pendiente |
| [Escala](04-fase-escala.md) | 3 ecosistemas simultáneos | 9, 11, 12, 13 | ⚪ Pendiente |

## Los 13 escalones completos

| # | Escalón | Referente mundial | Fase | Estado welver |
|---|---------|-------------------|------|---------------|
| 1 | Código — Arquitectura y Calidad | Stripe · SQLite | Desarrollo | 🟡 9/10 |
| 2 | Configuración y Entorno | Twelve-Factor App · Heroku | Desarrollo | ✅ 9.5/10 |
| 3 | Infraestructura y Red | Cloudflare | Estabilización | ⚠️ Parcial |
| 4 | Base de Datos y Almacenamiento | PlanetScale · Supabase | Desarrollo | 🟡 8/10 |
| 5 | CI/CD y Despliegues | Vercel · GitHub | Estabilización | ❌ No iniciado |
| 6 | Observabilidad y Operaciones | Datadog | Estabilización | ❌ No iniciado |
| 7 | Seguridad Defensiva (SecOps) | Snyk · CrowdStrike | Hardening | ⚪ Pendiente |
| 8 | Cumplimiento Legal y Privacidad | Apple | Hardening | ⚪ Pendiente |
| 9 | Recuperación ante Desastres | AWS | Escala | ⚪ Pendiente |
| 10 | Datos Masivos y Async | Apache Kafka · Redis | Hardening | ⚪ Pendiente |
| 11 | Rendimiento Percibido (UX) | Linear · Figma | Escala | ⚪ Pendiente |
| 12 | Alta Disponibilidad y Chaos | Netflix | Escala | ⚪ Pendiente |
| 13 | Eficiencia Financiera (FinOps) | Airbnb · Uber | Escala | ⚪ Pendiente |

## Capa 0 — lo que sostiene los 13 escalones

Cultura de ingeniería documentada. ADRs, reglas duras, moldes vivos, checklists.
Sin esto, los 13 escalones colapsan cuando escala el equipo.
Welver tiene esto documentado en `.claude/` — es la ventaja diferencial.

## Posición objetivo

Con los 13 escalones sólidos + base documental:
**Top 5-10% mundial · Top 1% Latinoamérica**

El salto al top 1% mundial lo da el tiempo bajo carga real en producción,
no una decisión de arquitectura.
