# Módulo: config-audit (auditoría y historial)

## ¿Qué hace en palabras simples?

Es la bitácora de cambios. Registra automáticamente quién cambió qué y cuándo
en la configuración de la organización. Si alguien cambia un tema, activa un
flag, o crea un webhook, queda registrado para siempre. Es para saber qué pasó
si algo salió mal.

## ¿Qué problemas resuelve?

- "¿Quién desactivó el flag de pagos y cuándo?" → historial de cambios
- "Necesito ver todos los cambios del último mes" → filtrado por fecha y tipo
- "El sistema cambió algo, ¿fue automático o lo hizo un usuario?" → distingue acciones

## Funciones principales

- **log**: registra un cambio en segundo plano (fire-and-forget — no frena la operación).
- **getByOrg**: devuelve el historial de cambios de una org, con filtros opcionales
  por tipo de config, usuario o rango de fechas.

## ¿Quién lo usa?

- Todos los demás módulos de configuración — registran sus cambios automáticamente
- El panel del dueño (sass-front) — para que el dueño vea qué cambió y quién

## Estado actual

✅ Funcionando. El log es asíncrono — si falla, no interrumpe la operación principal.
