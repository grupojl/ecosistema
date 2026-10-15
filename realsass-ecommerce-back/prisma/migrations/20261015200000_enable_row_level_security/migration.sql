-- ADR-027 — Row Level Security por organización.
--
-- El aislamiento entre tenants deja de depender solo de que cada consulta lleve `organization_id` en el
-- WHERE: la base filtra por sí misma según las variables de sesión que fija el TenantAwarePool
-- (app.organization_id / app.rls_bypass). Sin variables => 0 filas visibles y escrituras rechazadas.
--
-- IMPORTANTE: RLS no se aplica a SUPERUSER ni a roles con BYPASSRLS. La aplicación debe conectarse con un rol
-- común (ver prisma/rls/app-role.sql); el servicio no arranca en producción si no es así.

-- ─── Función de política ──────────────────────────────────────────────────────
-- true si la fila pertenece a la organización de la sesión, o si la sesión es de sistema (runAsSystem).
-- Sin SECURITY DEFINER: se evalúa con los permisos de quien consulta.
CREATE OR REPLACE FUNCTION app_tenant_matches(row_organization_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.rls_bypass', true) = 'on'
      OR (
        coalesce(current_setting('app.organization_id', true), '') <> ''
        AND row_organization_id = current_setting('app.organization_id', true)
      )
$$;

-- ─── Tablas con organization_id propio ────────────────────────────────────────
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "categories"
  USING (app_tenant_matches("organization_id")) WITH CHECK (app_tenant_matches("organization_id"));

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "products"
  USING (app_tenant_matches("organization_id")) WITH CHECK (app_tenant_matches("organization_id"));

ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_variants" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "product_variants"
  USING (app_tenant_matches("organization_id")) WITH CHECK (app_tenant_matches("organization_id"));

ALTER TABLE "inventory_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "inventory_items"
  USING (app_tenant_matches("organization_id")) WITH CHECK (app_tenant_matches("organization_id"));

ALTER TABLE "store_customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "store_customers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "store_customers"
  USING (app_tenant_matches("organization_id")) WITH CHECK (app_tenant_matches("organization_id"));

ALTER TABLE "customer_activity_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_activity_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "customer_activity_events"
  USING (app_tenant_matches("organization_id")) WITH CHECK (app_tenant_matches("organization_id"));

ALTER TABLE "carts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "carts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "carts"
  USING (app_tenant_matches("organization_id")) WITH CHECK (app_tenant_matches("organization_id"));

ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "orders"
  USING (app_tenant_matches("organization_id")) WITH CHECK (app_tenant_matches("organization_id"));

-- ─── Tablas hijas (sin organization_id): heredan la visibilidad del padre ─────
-- El EXISTS consulta al padre con SU política: si la fila padre no es visible, la hija tampoco.
ALTER TABLE "customer_addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_addresses" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "customer_addresses"
  USING (EXISTS (SELECT 1 FROM "store_customers" p WHERE p."id" = "customer_addresses"."customer_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "store_customers" p WHERE p."id" = "customer_addresses"."customer_id"));

ALTER TABLE "cart_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cart_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "cart_items"
  USING (EXISTS (SELECT 1 FROM "carts" p WHERE p."id" = "cart_items"."cart_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "carts" p WHERE p."id" = "cart_items"."cart_id"));

ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "order_items"
  USING (EXISTS (SELECT 1 FROM "orders" p WHERE p."id" = "order_items"."order_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "orders" p WHERE p."id" = "order_items"."order_id"));

ALTER TABLE "order_status_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_status_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "order_status_events"
  USING (EXISTS (SELECT 1 FROM "orders" p WHERE p."id" = "order_status_events"."order_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "orders" p WHERE p."id" = "order_status_events"."order_id"));

-- ─── Permisos del rol de aplicación ───────────────────────────────────────────
-- Por convención el rol de aplicación se llama `eco_app` (se crea aparte: prisma/rls/app-role.sql).
-- Si ya existe cuando corre la migración, recibe los permisos acá; si no, el script del rol los otorga.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eco_app') THEN
    GRANT USAGE ON SCHEMA public TO eco_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO eco_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO eco_app;
    GRANT EXECUTE ON FUNCTION app_tenant_matches(text) TO eco_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO eco_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO eco_app;
  END IF;
END
$$;
