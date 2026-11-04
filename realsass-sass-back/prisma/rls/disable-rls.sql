-- ADR-029 · reversa de enable-rls.sql. Quita las políticas y desactiva RLS en las tablas con tenant.
DO $$
DECLARE
  tenant_tables CONSTANT text[] := ARRAY[
    'collaborators',
    'secret_configs',
    'quota_configs',
    'webhook_endpoints',
    'markets',
    'feedback_reports',
    'theme_configs',
    'content_templates',
    'organization_settings'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END
$$;
