# Módulo: activity (registro de eventos)

## ¿Qué hace en palabras simples?

Es el registro de todo lo que pasa en la tienda: qué productos se vieron,
qué se agregó al carrito, qué se compró. Es la materia prima para futuras
analíticas, reportes y recomendaciones.

## ¿Qué problemas resuelve?

- "¿Qué productos son los más vistos?" → eventos de vista de producto
- "¿Cuántos carritos se abandonaron esta semana?" → eventos de carrito
- "¿Cuál es el funnel de conversión?" → eventos de checkout

## Funciones principales

- **logEvent**: registra un evento con su tipo (view_product, add_to_cart, checkout_completed)
  y los datos relevantes. Lo llaman los otros módulos automáticamente.

## Estado actual

⚠️ Módulo básico implementado. Pendiente: consumidor de eventos y analíticas.
