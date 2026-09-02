# Módulo: users (usuarios)

## ¿Qué hace en palabras simples?

Es la ficha personal de cada persona que usa el sistema. Guarda quién es,
qué organizaciones tiene, a qué organizaciones colabora, y construye el
"perfil completo" que el sistema usa para tomar decisiones.

## ¿Qué problemas resuelve?

- "¿Este usuario ya existe o es nuevo?" → upsert automático al primer login
- "¿Cuál es la organización activa de este usuario?" → perfil con org y colaboraciones
- "¿Este usuario tiene acceso a esta organización?" → verifica ownership o colaboración

## Funciones principales

- **buildProfile**: arma el perfil completo — datos personales + org propia + colaboraciones
- **getOrganizationAccess**: dado un usuario y una org, dice si tiene acceso, con qué rol
  y con qué permisos. Es lo que usa ecommerce-back para saber si alguien puede gestionar una tienda.
- **upsertUser**: crea o actualiza el usuario en la base de datos al hacer login.
- **selectRole**: permite al usuario elegir si quiere operar como dueño o como afiliado.

## ¿Quién lo usa?

- El módulo de auth (para sincronizar al usuario al login)
- El back de ecommerce (para verificar acceso a una org)
- Las pantallas del dueño y colaboradores (para mostrar el perfil)

## Estado actual

✅ Funcionando. Inyecta IUsersRepository — sin acceso directo a la base de datos.
