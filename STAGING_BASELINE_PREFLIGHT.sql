-- READ-ONLY STAGING BASELINE PREFLIGHT
-- Target: Supabase staging project rwewcnftxnaynpotbsms only.
-- Source: approved STAGING_BASELINE_DDL_PREVIEW.sql table/policy names and the
-- tenant-neutral STAGING_BASELINE_MANIFEST.md helper inventory.
-- This query reads catalog metadata only; it reads no application rows and makes no writes.
-- It is intended to run AFTER the reviewed baseline and the 21 feature migrations.
-- An empty result means presence/ACL checks pass, NOT that function semantics,
-- search_path, trigger behavior/attachments, non-provisioning grants, extensions,
-- tenant-neutral defaults, or end-to-end workflows are correct.
-- Unknown organization-template provisioning function names are not checked here.
-- Function checks are by name only; exact signatures and trigger attachments require review.

WITH expected_tables(table_name) AS (
  VALUES
    ('agent_approval_requests'),
    ('agent_families'),
    ('agent_runtime_readiness'),
    ('agent_templates'),
    ('agent_test_runs'),
    ('agent_workflow_assignments'),
    ('agents'),
    ('ai_model_catalog'),
    ('appointment_calendar_resources'),
    ('appointments'),
    ('audit_logs'),
    ('branches'),
    ('crm_conversations'),
    ('crm_customers'),
    ('crm_leads'),
    ('crm_messages'),
    ('crm_tasks'),
    ('customer_memories'),
    ('domain_events'),
    ('follow_ups'),
    ('handoff_notifications'),
    ('human_handoffs'),
    ('knowledge_collections'),
    ('knowledge_sources'),
    ('leads'),
    ('membership_roles'),
    ('organization_ai_model_assignments'),
    ('organization_customer_stages'),
    ('organization_integrations'),
    ('organization_memberships'),
    ('organization_systems'),
    ('organization_template_assignments'),
    ('organization_templates'),
    ('organizations'),
    ('permissions'),
    ('projects'),
    ('properties'),
    ('role_permissions'),
    ('roles'),
    ('system_catalog'),
    ('workflow_definitions'),
    ('workflow_registry')
),
expected_policies(table_name, policy_name) AS (
  VALUES
    ('agent_approval_requests', 'members_create_agent_approvals'),
    ('agent_approval_requests', 'members_update_agent_approvals'),
    ('agent_approval_requests', 'members_view_agent_approvals'),
    ('agent_families', 'agent_families_member_select'),
    ('agent_runtime_readiness', 'Members read own runtime readiness'),
    ('agent_test_runs', 'members_create_agent_tests'),
    ('agent_test_runs', 'members_view_agent_tests'),
    ('agent_workflow_assignments', 'Members read own workflow assignments'),
    ('agents', 'agents_member_manage'),
    ('agents', 'agents_member_select'),
    ('appointment_calendar_resources', 'appointment_calendar_resources_select'),
    ('appointments', 'appointments_select'),
    ('audit_logs', 'audit_logs_member_select'),
    ('branches', 'branches_member_select'),
    ('crm_conversations', 'crm_conversations_delete'),
    ('crm_conversations', 'crm_conversations_insert'),
    ('crm_conversations', 'crm_conversations_select'),
    ('crm_conversations', 'crm_conversations_update'),
    ('crm_customers', 'crm_customers_delete'),
    ('crm_customers', 'crm_customers_insert'),
    ('crm_customers', 'crm_customers_select'),
    ('crm_customers', 'crm_customers_update'),
    ('crm_leads', 'crm_leads_delete'),
    ('crm_leads', 'crm_leads_insert'),
    ('crm_leads', 'crm_leads_select'),
    ('crm_leads', 'crm_leads_update'),
    ('crm_messages', 'crm_messages_delete'),
    ('crm_messages', 'crm_messages_insert'),
    ('crm_messages', 'crm_messages_select'),
    ('crm_messages', 'crm_messages_update'),
    ('crm_tasks', 'crm_tasks_member_access'),
    ('customer_memories', 'customer_memories_member_manage'),
    ('customer_memories', 'customer_memories_member_select'),
    ('customer_memories', 'memories_tenant'),
    ('follow_ups', 'follow_ups_manage'),
    ('follow_ups', 'follow_ups_select'),
    ('handoff_notifications', 'handoff_notifications_select'),
    ('human_handoffs', 'human_handoffs_select'),
    ('knowledge_collections', 'knowledge_collections_member_manage'),
    ('knowledge_collections', 'knowledge_collections_member_select'),
    ('knowledge_sources', 'knowledge_sources_member_manage'),
    ('knowledge_sources', 'knowledge_sources_member_select'),
    ('leads', 'leads_tenant_member_access'),
    ('membership_roles', 'membership_roles_team_view'),
    ('organization_customer_stages', 'organization_customer_stages_select'),
    ('organization_integrations', 'integrations_member_manage'),
    ('organization_integrations', 'integrations_member_select'),
    ('organization_memberships', 'memberships_admin_manage'),
    ('organization_memberships', 'memberships_member_select'),
    ('organization_memberships', 'memberships_self_select'),
    ('organization_memberships', 'memberships_team_view'),
    ('organization_systems', 'organization_systems_member_select'),
    ('organizations', 'organizations_member_select'),
    ('permissions', 'permissions_authenticated_select'),
    ('projects', 'projects_member_select'),
    ('properties', 'properties_tenant_member_access'),
    ('role_permissions', 'role_permissions_team_view'),
    ('roles', 'roles_member_select'),
    ('workflow_definitions', 'Authenticated users read ready workflow definitions'),
    ('workflow_registry', 'workflow_registry_member_select')
),
required_core_helpers(function_name) AS (
  VALUES
    ('set_updated_at'),
    ('is_organization_member'),
    ('has_organization_permission'),
    ('slugify_identifier'),
    ('create_human_handoff'),
    ('rls_auto_enable'),
    ('sync_payment_plan_total'),
    ('update_updated_at_column'),
    ('set_whatsapp_template_config_updated_at'),
    ('provision_client_organization'),
    ('provision_client_workspace'),
    ('provision_trial_client_organization')
),
required_trigger_helpers(function_name) AS (
  VALUES
    ('touch_ai_model_updated_at'),
    ('timeline_from_appointment'),
    ('timeline_from_crm_lead'),
    ('timeline_from_crm_message'),
    ('timeline_from_crm_task'),
    ('timeline_from_domain_event'),
    ('sanitize_lead_budget_phone_collision'),
    ('attach_existing_onboarding_submissions_after_membership'),
    ('seed_organization_role_presets_after_membership'),
    ('sync_system_routes_after_installation_change'),
    ('ensure_organization_manager_access_code'),
    ('seed_customer_stages_for_new_organization')
),
checks(check_name, object_name) AS (
  SELECT 'missing_core_table', e.table_name::text
  FROM expected_tables e
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_name = e.table_name
      AND t.table_type = 'BASE TABLE'
    LIMIT 1
  )
  UNION ALL
  SELECT 'rls_not_enabled', e.table_name::text
  FROM expected_tables e
  LEFT JOIN pg_catalog.pg_class c
    ON c.relnamespace = 'public'::regnamespace
   AND c.relname = e.table_name
   AND c.relkind = 'r'
  WHERE c.oid IS NULL OR NOT c.relrowsecurity
  UNION ALL
  SELECT 'missing_core_policy', e.table_name || '.' || e.policy_name
  FROM expected_policies e
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = e.table_name
      AND p.policyname = e.policy_name
    LIMIT 1
  )
  UNION ALL
  SELECT 'missing_core_helper', e.function_name::text
  FROM required_core_helpers e
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = e.function_name
    LIMIT 1
  )
  UNION ALL
  SELECT 'missing_trigger_helper', e.function_name::text
  FROM required_trigger_helpers e
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = e.function_name
    LIMIT 1
  )
  UNION ALL
  SELECT 'provisioning_rpc_acl_violation', p.proname::text
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('provision_client_workspace', 'provision_client_organization', 'provision_trial_client_organization')
    AND (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
      OR NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
    )
)
SELECT check_name, object_name
FROM checks
ORDER BY check_name, object_name
LIMIT 250;
