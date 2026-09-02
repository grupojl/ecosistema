# Package: @real/auth-server (seguridad en el back)

## ¿Qué hace en palabras simples?

Es el "verificador de identidad" de los dos motores del sistema. Cuando
llega una acción al back, este package verifica que quien la envía es quien
dice ser, que tiene acceso a la organización correcta, y que tiene los permisos
necesarios para hacer lo que quiere hacer. Si algo no cuadra, bloquea la acción.

## ¿Qué problemas resuelve?

- "¿Este token de sesión es válido o está vencido?" → FirebaseAuthGuard
- "¿Este usuario tiene acceso a esta organización?" → TenantGuard
- "¿Este usuario es dueño o colaborador?" → RolesGuard
- "¿Cómo creo y revoco la cookie de sesión?" → SessionService
- "¿Cómo verifico la identidad en los routers tRPC?" → createTrpcAuthMiddleware

## ¿Por qué existe como package separado?

Porque los dos motores (sass-back y ecommerce-back) necesitan exactamente
la misma lógica de seguridad. En lugar de copiarla dos veces (y arriesgarse
a que diverjan), vive en un solo lugar.

## Estado actual

✅ Completo. Guards, middleware, SessionService, AuthSessionController implementados.
Cookies HttpOnly (ADR-004). Custom claims Firebase (ADR-003).
