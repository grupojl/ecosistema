# Dashboard de escritorio — qué es y qué cambia (en palabras simples)

> Estado: 📝 **Propuesto**, todavía no existe. Ver `roadmap/desktop-tauri.md` y `decisions/ADR-028-desktop-tauri.md`.

## ¿Qué es?

Es el mismo panel de colaboradores, pero instalable como una aplicación: tiene su propio ícono, su ventana, y puede
avisar de cosas nuevas (por ejemplo, un pedido) sin tener el navegador abierto. No es un producto aparte: es el mismo
panel, con una cáscara nativa.

## ¿Qué NO cambia?

- Los datos, los permisos y las reglas de negocio son los mismos que en la web.
- El panel web sigue funcionando en el navegador igual que hoy.
- Cada organización sigue viendo solo lo suyo.

## ¿Cómo se inicia sesión?

Para no abrir el login de Google dentro de la aplicación (Google no lo permite de forma segura en apps de escritorio), la
aplicación abre el **navegador**, el usuario inicia sesión ahí como siempre, y el navegador le devuelve la sesión a la
aplicación mediante un enlace de un solo uso que vence a los 60 segundos.

## ¿Cómo se actualiza?

El contenido del panel se actualiza solo (es la misma web). La cáscara de la aplicación se actualiza con paquetes firmados:
si la firma no es válida, la actualización se rechaza.

## ¿Qué necesita el negocio decidir?

Qué cosa concreta justifica instalar una aplicación en lugar de usar el navegador o una PWA (notificaciones de pedidos,
impresión de tickets, escáner de código de barras, trabajar sin conexión…). Si no hay una, conviene una PWA, que es más
barata de mantener.
