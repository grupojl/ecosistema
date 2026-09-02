# Módulo: auth (autenticación y sesión)

## ¿Qué hace en palabras simples?

Es el portero del sistema. Cuando alguien quiere entrar, este módulo verifica
quién es (con Google, Apple o Facebook) y le da un pase especial (una "cookie")
que viaja en silencio con cada acción que hace. También es el que cierra la puerta
cuando alguien hace logout.

## ¿Qué problemas resuelve?

- "¿Esta persona realmente tiene una cuenta?" → sincroniza al usuario con la base de datos
- "¿Quién es este usuario?" → emite y actualiza los datos de identidad
- "¿Cómo paso de la landing al panel sin volver a logearme?" → SSO entre pantallas

## Funciones principales

- **Login**: cuando alguien inicia sesión, crea una cookie segura que el navegador
  guarda automáticamente. Esta cookie reemplaza al token que antes viajaba visible.
- **Logout**: borra la cookie en todos los dispositivos al mismo tiempo.
- **Refresh de identidad**: cuando el dueño cambia de organización activa, reemite
  los datos de acceso para que el sistema sepa cuál es la org que corresponde.
- **SSO**: permite pasar del panel del dueño al panel de colaboradores sin tener
  que loguearse de nuevo.

## ¿Quién lo usa?

- El front del dueño (sass-front) — para el login/logout
- El front de colaboradores (dashboard-front) — para el SSO
- El back de ecommerce (ecommerce-back) — para verificar si un dueño tiene acceso

## Estado actual

✅ Funcionando. Cookies HttpOnly implementadas (más seguro que tokens visibles).
