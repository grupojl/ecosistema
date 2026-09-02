# Módulo: config-flags (feature flags)

## ¿Qué hace en palabras simples?

Son interruptores de funciones. Permiten activar o desactivar características
de la plataforma para una organización específica sin tocar código. Por ejemplo:
"activar el módulo de chat IA para esta org" o "desactivar el checkout para
org en prueba".

## ¿Qué problemas resuelve?

- "Quiero probar una función nueva solo con algunos clientes" → activar flag solo para ellos
- "Esta función está causando problemas, la apago sin deploy" → desactivar el flag
- "Algunos planes tienen acceso a X, otros no" → flags por plan

## Funciones principales

- **list**: devuelve todos los flags de la org (propios + globales del sistema).
- **update**: activa o desactiva un flag. Solo el dueño puede hacer esto.

## ¿Quién lo usa?

- El panel del dueño (sass-front) — para ver y cambiar los flags de su org
- El panel de colaboradores (dashboard-front) — para ver el estado de las funciones

## Estado actual

✅ Funcionando. Los flags se evalúan al cargar el dashboard.
