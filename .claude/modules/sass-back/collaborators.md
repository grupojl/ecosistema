# Módulo: collaborators (colaboradores)

## ¿Qué hace en palabras simples?

Permite al dueño de una organización invitar a otras personas a colaborar
en la gestión del negocio. Cada colaborador tiene permisos específicos que
el dueño puede ajustar: puede ver productos pero no borrarlos, puede ver
estadísticas pero no invitar a otros, etc.

## ¿Qué problemas resuelve?

- "Quiero que mi empleado pueda cargar productos pero no borrarlos" → permisos granulares
- "¿Cómo invito a alguien?" → sistema de invitación por email con link de un solo uso
- "Este colaborador ya no trabaja conmigo" → eliminación segura (soft delete)

## Funciones principales

- **listCollaborators**: muestra todos los colaboradores activos y pendientes de la org.
- **inviteCollaborator**: envía una invitación por email con un link de acceso temporal.
- **acceptInvitation**: el colaborador hace clic en el link, se autentica y queda activo.
- **updateCollaborator**: el dueño ajusta los permisos de un colaborador existente.
- **removeCollaborator**: desactiva el acceso del colaborador (no borra el historial).

## Permisos disponibles

Cada colaborador puede tener habilitado o deshabilitado cada uno de estos:
ver productos, crear productos, editar productos, borrar productos,
ver estadísticas, gestionar leads, gestionar otros colaboradores.

## ¿Quién lo usa?

- El panel del dueño (sass-front) — para gestionar el equipo
- El panel de colaboradores (dashboard-front) — para el proceso de aceptar invitación

## Estado actual

✅ Funcionando. Los permisos se guardan como JSON flexible (ADR-001).
⚠️ Las transacciones de invitación usan Prisma directamente (deuda técnica documentada).
