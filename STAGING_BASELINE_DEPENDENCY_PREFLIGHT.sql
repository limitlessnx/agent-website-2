-- READ-ONLY ROUTINE DEPENDENCY PREFLIGHT
-- Supplement to STAGING_BASELINE_PREFLIGHT.sql; this is not an executable baseline.
-- Source: STAGING_BASELINE_ROUTINE_SOURCE_REVIEW.md, based on bounded catalog/source review.
-- This query reads pg_catalog/information_schema metadata only and no application rows.
-- It reports dependencies outside the initial 42-table allowlist; it does not authorize adding them.
-- Function checks are by name only. An empty result does not prove body safety, signatures,
-- search_path, trigger wiring, tenant isolation, grants beyond the checks below, or runtime behavior.

WITH expected_dependencies(module, table_name) AS (
  VALUES
    ('authorization', 'platform_super_admins'),
    ('timeline', 'customer_timeline_events'),
    ('onboarding_claim', 'client_onboarding_submissions'),
    ('onboarding_profile', 'client_onboarding_profiles'),
    ('billing', 'flux_credit_wallets'),
    ('billing', 'flux_credit_ledger'),
    ('billing', 'billing_plans'),
    ('billing', 'organization_subscriptions'),
    ('billing_notifications', 'dashboard_notifications'),
    ('payments', 'payment_plans'),
    ('payments', 'payment_records'),
    ('system_routing', 'organization_entitlements'),
    ('system_routing', 'organization_service_packages'),
    ('system_routing', 'service_packages'),
    ('system_routing', 'service_package_systems'),
    ('system_routing', 'system_event_routes'),
    ('system_routing', 'system_event_route_templates')
),
expected_helpers(function_name) AS (
  VALUES
    ('is_platform_super_admin'),
    ('add_customer_timeline_event'),
    ('seed_default_customer_stages'),
    ('ensure_organization_role_presets'),
    ('sync_organization_system_event_routes'),
    ('organization_can_use_system'),
    ('organization_active_service_package'),
    ('start_fluxknight_basic_free_trial'),
    ('ensure_flux_credit_wallet'),
    ('resolve_flux_monthly_allowance'),
    ('sync_flux_credit_wallet_from_subscription'),
    ('sync_flux_credit_threshold_notification'),
    ('resolve_onboarding_submission_organization'),
    ('prevent_flux_credit_ledger_mutation'),
    ('installment_frequency_interval'),
    ('sync_flux_subscription_wallet_trigger')
),
missing_tables AS (
  SELECT 'dependency_table_missing'::text AS check_name, d.module || '.' || d.table_name AS object_name
  FROM expected_dependencies d
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_name = d.table_name AND t.table_type = 'BASE TABLE'
    LIMIT 1
  )
),
rls_findings AS (
  SELECT CASE WHEN c.oid IS NULL OR NOT c.relrowsecurity THEN 'dependency_rls_not_enabled' ELSE 'dependency_force_rls_unexpected' END::text AS check_name,
         d.module || '.' || d.table_name AS object_name
  FROM expected_dependencies d
  LEFT JOIN pg_catalog.pg_namespace n ON n.nspname = 'public'
  LEFT JOIN pg_catalog.pg_class c ON c.relnamespace = n.oid AND c.relname = d.table_name AND c.relkind IN ('r', 'p')
  WHERE c.oid IS NULL OR NOT c.relrowsecurity OR c.relforcerowsecurity
),
role_findings AS (
  SELECT 'dependency_anon_direct_privilege'::text AS check_name,
         d.module || '.' || d.table_name || '.' || p.privilege AS object_name
  FROM expected_dependencies d
  JOIN pg_catalog.pg_namespace n ON n.nspname = 'public'
  JOIN pg_catalog.pg_class c ON c.relnamespace = n.oid AND c.relname = d.table_name AND c.relkind IN ('r', 'p')
  CROSS JOIN LATERAL (VALUES
    ('SELECT', has_table_privilege('anon', c.oid, 'SELECT')),
    ('INSERT', has_table_privilege('anon', c.oid, 'INSERT')),
    ('UPDATE', has_table_privilege('anon', c.oid, 'UPDATE')),
    ('DELETE', has_table_privilege('anon', c.oid, 'DELETE'))
  ) AS p(privilege, granted)
  WHERE p.granted
  UNION ALL
  SELECT 'dependency_sensitive_authenticated_write'::text AS check_name,
         d.module || '.' || d.table_name || '.' || p.privilege AS object_name
  FROM expected_dependencies d
  JOIN pg_catalog.pg_namespace n ON n.nspname = 'public'
  JOIN pg_catalog.pg_class c ON c.relnamespace = n.oid AND c.relname = d.table_name AND c.relkind IN ('r', 'p')
  CROSS JOIN LATERAL (VALUES
    ('INSERT', has_table_privilege('authenticated', c.oid, 'INSERT')),
    ('UPDATE', has_table_privilege('authenticated', c.oid, 'UPDATE')),
    ('DELETE', has_table_privilege('authenticated', c.oid, 'DELETE'))
  ) AS p(privilege, granted)
  WHERE d.table_name IN (
    'platform_super_admins', 'client_onboarding_profiles', 'client_onboarding_submissions',
    'billing_plans', 'organization_subscriptions', 'payment_plans', 'payment_records',
    'flux_credit_wallets', 'flux_credit_ledger'
  ) AND p.granted
),
missing_helpers AS (
  SELECT 'dependency_helper_missing'::text AS check_name, h.function_name::text AS object_name
  FROM expected_helpers h
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = h.function_name
    LIMIT 1
  )
)
SELECT check_name, object_name
FROM (
  SELECT * FROM missing_tables
  UNION ALL SELECT * FROM rls_findings
  UNION ALL SELECT * FROM role_findings
  UNION ALL SELECT * FROM missing_helpers
) findings
ORDER BY check_name, object_name
LIMIT 200;
