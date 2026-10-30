-- ============================================================================================================
-- ADR-029 · fase 4 — Row-Level Security (aislamiento por tenant en la base de datos)
--
-- ESTE ARCHIVO NO ES UNA MIGRACIÓN y a propósito NO está en prisma/migrations/: `prisma migrate deploy` lo aplicaría
-- solo. Se aplica a mano, UNA vez que TODA query de tenant corra dentro de `runAsTenant` (src/prisma/tenant-context.ts).
-- Si se activa antes, cualquier query sin `app.organization_id` devuelve 0 filas (falla cerrado) y la tienda "se vacía".
--
-- ANTES DE APLICARLO
--   1. La app debe conectarse con un rol que NO sea superusuario ni dueño con BYPASSRLS: un superusuario ignora RLS
--      aunque esté FORZADO. En Railway el usuario por defecto (`postgres`) es superusuario. Crear uno aparte:
--
--        CREATE ROLE app_user LOGIN PASSWORD '<elegir>' NOBYPASSRLS;
--        GRANT USAGE ON SCHEMA public TO app_user;
--        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
--        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
--
--      y poner ese usuario en DATABASE_URL. Las migraciones siguen corriendo con el usuario administrador.
--   2. Probarlo primero en una base de staging con una copia de los datos.
--
-- CÓMO FUNCIONA
--   · Cada transacción de tenant hace  set_config('app.organization_id', '<id>', true)  (vale solo hasta el COMMIT).
--   · Sin ese valor, current_setting(..., true) es NULL y la condición no se cumple: 0 filas. Falla cerrado.
--   · Los trabajos de sistema sin tenant (el relay del outbox, purgas) fijan  app.bypass_rls = 'on'  en su transacción.
--
-- REVERSA: prisma/rls/disable-rls.sql
-- ============================================================================================================

DO $$
DECLARE
  tenant_tables CONSTANT text[] := ARRAY[
    'categories',
    'products',
    'product_variants',
    'inventory_items',
    'store_customers',
    'customer_activity_events',
    'carts',
    'orders',
    'outbox_events'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      $policy$
        CREATE POLICY tenant_isolation ON %I
          USING      (organization_id = current_setting('app.organization_id', true) OR current_setting('app.bypass_rls', true) = 'on')
          WITH CHECK (organization_id = current_setting('app.organization_id', true) OR current_setting('app.bypass_rls', true) = 'on')
      $policy$,
      t
    );
  END LOOP;
END
$$;
