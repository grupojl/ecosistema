-- ADR-027 — Rol de aplicación para Row Level Security.
--
-- Dos roles, dos responsabilidades:
--   dueño de las tablas (el que corre `prisma migrate deploy`): crea y altera el esquema. Variable MIGRATION_DATABASE_URL.
--   eco_app (este script): lo que usa el servicio en runtime (el mismo nombre en ambos backs; cada back tiene su base). NO es superusuario, NO tiene BYPASSRLS y no puede
--   alterar el esquema, así que las políticas RLS le aplican siempre. Variable DATABASE_URL.
--
-- Se ejecuta UNA vez por base, como administrador, ANTES o DESPUÉS de las migraciones (es idempotente):
--   psql "$ADMIN_DATABASE_URL" -v app_password="'<clave-larga-aleatoria>'" -f prisma/rls/app-role.sql
--
-- Después: DATABASE_URL=postgresql://eco_app:<clave>@host:5432/base  y  MIGRATION_DATABASE_URL=<el dueño>.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eco_app') THEN
    CREATE ROLE eco_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

ALTER ROLE eco_app NOSUPERUSER NOBYPASSRLS PASSWORD :app_password;

GRANT USAGE ON SCHEMA public TO eco_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO eco_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO eco_app;
-- Tablas que cree el dueño más adelante (migraciones futuras):
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO eco_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO eco_app;

-- La tabla de control de Prisma no es del servicio:
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    REVOKE ALL ON TABLE public._prisma_migrations FROM eco_app;
  END IF;
END
$$;
