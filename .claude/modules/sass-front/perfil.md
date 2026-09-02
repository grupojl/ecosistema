# Página: Perfil del dueño (/profile)

## ¿Qué hace en palabras simples?

Es el panel central del dueño. Desde acá puede ver todo lo de su cuenta
en un solo lugar: su organización, su equipo, y su panel de afiliado.
Tiene cuatro vistas que se navegan sin recargar la página.

## Vistas

### Overview (vista principal)
Muestra el resumen de todo: datos del usuario, organización activa,
colaboraciones en otras orgs, y el link de referido para el programa de afiliados.
Desde acá se puede ir al dashboard de colaboradores con un solo clic (SSO).

### Editar organización
Formulario para cambiar el nombre, descripción, logo y sitio web de la org.
Los cambios se guardan en tiempo real.

### Seleccionar rol
Para usuarios que aún no tienen una organización creada. Permite elegir
entre operar como dueño (con tienda propia) o como afiliado (sin tienda, con comisiones).

### Gestión de colaboradores
Lista de colaboradores activos y pendientes. Desde acá el dueño puede:
- Ver quién tiene acceso a su org
- Invitar a alguien nuevo por email
- Eliminar el acceso de alguien

## Estado actual

✅ Migrado a TanStack Query + hooks tRPC. Sin useEffect con fetch manual.
