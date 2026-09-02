# realsass-sass-front — Panel del dueño

## ¿Qué es en palabras simples?

Es la pantalla que ve el dueño de una organización. Tiene dos partes:

1. **La landing pública** — lo que ve cualquier persona que visita el sitio:
   presentación del producto, precios, y el botón para registrarse o iniciar sesión.

2. **El panel privado** — lo que ve el dueño una vez que inicia sesión:
   su organización, sus colaboradores, la configuración de su tienda, y el enlace
   para ir al panel de colaboradores (dashboard).

## ¿A quién está dirigido?

Al **dueño** (OWNER) de la organización. Es la persona que crea la cuenta,
configura la tienda y gestiona el equipo.

## Páginas principales

| Página | Ruta | Qué hace |
|---|---|---|
| Landing | `/` | Presentación del producto, pricing, CTA |
| Perfil / panel | `/profile` | Datos de la org, colaboradores, afiliado |
| Configuración | `/profile/config` | Flags, quotas, temas, webhooks, secretos |
| Invitación | `/invite/[token]` | Aceptar invitación de colaborador |
| SSO redirect | `/auth/sso` | Redirige al dashboard tras login |

## Módulos que usa

- [auth](../sass-back/auth.md) — para el login y la sesión
- [users](../sass-back/users.md) — para ver el perfil del dueño
- [organizations](../sass-back/organizations.md) — para ver y editar la org
- [collaborators](../sass-back/collaborators.md) — para gestionar el equipo
- [affiliate](../sass-back/affiliate.md) — para ver el panel de referidos
- [config-flags](../sass-back/config-flags.md) — para activar/desactivar funciones
- [config-quotas](../sass-back/config-quotas.md) — para ver los límites de uso
- [config-themes](../sass-back/config-themes.md) — para el diseño de la tienda
- [config-webhooks](../sass-back/config-webhooks.md) — para las notificaciones automáticas
- [config-secrets](../sass-back/config-secrets.md) — para las claves seguras
- [config-templates](../sass-back/config-templates.md) — para las plantillas de texto
- [config-audit](../sass-back/config-audit.md) — para ver el historial de cambios

## Cómo se comunica con el back

Exclusivamente vía tRPC. La cookie de sesión viaja automáticamente en cada
acción. No hay llamadas REST (salvo el login/logout de la cookie, que es
una excepción técnica documentada).

## Estado actual

✅ Funcional. Migrado completamente a tRPC (ADR-005 + ADR-006).
Sin lib/api.ts, sin lib/firebase.ts — todo a través de @real/auth-client y tRPC.
