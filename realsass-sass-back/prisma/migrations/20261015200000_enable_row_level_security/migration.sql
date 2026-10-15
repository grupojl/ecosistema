-- ADR-027 — Row Level Security por organización (FASE 1 en sass-back).
--
-- Tablas puramente por organización y más sensibles: secretos, webhooks (+ log de entregas), cuotas y mercados.
-- La base filtra por sí misma según las variables de sesión que fija el TenantAwarePool
-- (app.organization_id / app.rls_bypass). Sin variables => 0 filas visibles y escrituras rechazadas.
--
-- FASE 2 (pendiente, ver ADR-027): collaborators, invitations, users, organizations, affiliate_data y las tablas con
-- filas globales (organizationId NULL: theme_configs, feature_flags, content_templates, config_audit_logs). Se
-- consultan ANTES de conocer la organización (autenticación) o mezclan filas globales con propias, y necesitan su
-- propio diseño de políticas.
--
-- IMPORTANTE: RLS no se aplica a SUPERUSER ni a roles con BYPASSRLS. La aplicación debe conectarse con un rol
-- común (ver prisma/rls/app-role.sql); el servicio no arranca en producción si no es así.

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

ALTER TABLE "secret_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "secret_configs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "secret_configs"
  USING (app_tenant_matches("organizationId")) WITH CHECK (app_tenant_matches("organizationId"));

ALTER TABLE "quota_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quota_configs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "quota_configs"
  USING (app_tenant_matches("organizationId")) WITH CHECK (app_tenant_matches("organizationId"));

ALTER TABLE "webhook_endpoints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_endpoints" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "webhook_endpoints"
  USING (app_tenant_matches("organizationId")) WITH CHECK (app_tenant_matches("organizationId"));

ALTER TABLE "markets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "markets" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "markets"
  USING (app_tenant_matches("organization_id")) WITH CHECK (app_tenant_matches("organization_id"));

-- Tabla hija sin organizationId: hereda la visibilidad de su endpoint (el EXISTS usa la política del padre).
ALTER TABLE "webhook_delivery_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_delivery_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "webhook_delivery_logs"
  USING (EXISTS (SELECT 1 FROM "webhook_endpoints" p WHERE p."id" = "webhook_delivery_logs"."webhookId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "webhook_endpoints" p WHERE p."id" = "webhook_delivery_logs"."webhookId"));

-- Permisos del rol de aplicación `eco_app` (se crea aparte: prisma/rls/app-role.sql). Si ya existe, los recibe acá.
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
