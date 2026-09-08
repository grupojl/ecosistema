# Lifecycle — Software de Clase Mundial

Los 13 escalones que llevan welver/ al top 5-10% mundial.
**Última actualización:** 2026-09-08 (ADR-011)

## Las 4 fases

| Fase | Cuándo | Escalones | Estado |
|------|--------|-----------|--------|
| [Desarrollo](01-fase-desarrollo.md) | ✅ Completo | 1, 2, 4 | ✅ Completo |
| [Estabilización](02-fase-estabilizacion.md) | Antes de producción | 3, 5, 6 | 🟡 En curso |
| [Hardening](03-fase-hardening.md) | Primer ecosistema en prod | 7, 8, 10 | ⚪ Pendiente |
| [Escala](04-fase-escala.md) | 3 ecosistemas simultáneos | 9, 11, 12, 13 | ⚪ Pendiente |

## Los 13 escalones — estado post ADR-011

| # | Escalón | Referente mundial | Fase | Estado |
|---|---------|-------------------|------|--------|
| 1 | Código — Arquitectura y Calidad | Stripe · SQLite | Desarrollo | ✅ 10/10 |
| 2 | Configuración y Entorno | Twelve-Factor App | Desarrollo | ✅ 10/10 |
| 3 | Infraestructura y Red | Cloudflare | Estabilización | 🟡 7/10 |
| 4 | Base de Datos y Almacenamiento | PlanetScale | Desarrollo | 🟡 9/10 |
| 5 | CI/CD y Despliegues | Vercel · GitHub | Estabilización | ❌ 0/10 |
| 6 | Observabilidad y Operaciones | Datadog | Estabilización | ❌ 0/10 |
| 7 | Seguridad Defensiva (SecOps) | Snyk · CrowdStrike | Hardening | ⚪ Pendiente |
| 8 | Cumplimiento Legal y Privacidad | Apple | Hardening | ⚪ Pendiente |
| 9 | Recuperación ante Desastres | AWS | Escala | ⚪ Pendiente |
| 10 | Datos Masivos y Async | Kafka · Redis | Hardening | 🟡 8/10 |
| 11 | Rendimiento Percibido (UX) | Linear · Figma | Escala | ⚪ Pendiente |
| 12 | Alta Disponibilidad y Chaos | Netflix | Escala | ⚪ Pendiente |
| 13 | Eficiencia Financiera (FinOps) | Airbnb · Uber | Escala | ⚪ Pendiente |

## Posición actual post ADR-011

**Escalones 1+2 completos: Top 5% Latam · Top 15% mundial en código y estructura.**
El siguiente salto de posición requiere CI/CD (Escalón 5) — activa el enforcement
automático que hace que la calidad de Escalones 1+2 sea sostenible con el equipo.
