# Package: @real/auth-client (inicio de sesión en el front)

## ¿Qué hace en palabras simples?

Es la pieza que maneja todo lo de "entrar al sistema" en las tres pantallas.
Cuando alguien hace clic en "Iniciar sesión con Google", es este package
el que hace la magia. También es el que cierra la sesión y el que obtiene
el "pase" que se necesita para hacer acciones autenticadas.

## ¿Qué problemas resuelve?

- "¿Cómo inicio sesión con Google/Apple/Facebook?" → signInWithGoogle, signInWithApple, signInWithFacebook
- "¿Cómo cierro sesión?" → signOut
- "¿Cómo sabe el sistema quién soy al hacer cada acción?" → getIdToken (el pase)
- "¿Cómo recuerdo cuál es mi organización activa?" → setActiveOrganizationId

## ¿Por qué existe como package separado?

Porque las tres pantallas (sass-front, dashboard-front, ecommerce-front) necesitan
exactamente lo mismo para el login. En lugar de copiar el código tres veces,
se pone en un solo lugar y las tres pantallas lo usan. Si algo cambia, se cambia
una sola vez.

## ¿Quién lo usa?

Las tres pantallas del ecosistema. ecommerce-front lo usa de forma diferente
(sin login de usuario, solo para el contexto del cliente de la tienda).

## Estado actual

✅ Completo. signInWithGoogle, signInWithApple, signInWithFacebook, signOut, getIdToken.
