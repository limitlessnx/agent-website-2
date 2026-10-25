# Staging baseline manifest — dependency inventory (not executable)

**Revision:** 0.2, 24 October 2026
**Target:** Supabase staging project `rwewcnftxnaynpotbsms` only.
**Production target:** none.
**Status:** Review artifact; do not execute as SQL or treat as an approved migration.

This manifest defines the object allowlist and safety requirements for preparing a tenant-neutral staging baseline. The staging database currently has no public application tables. A comment-only preview now contains metadata-derived DDL for 42 allowlisted tables and 60 policies, but omits function bodies, trigger creation, grants, extensions, seeds and data. The preview and this manifest authorize no database write by themselves.

## 1. Tenant-neutral core schema allowlist

These are the shared objects required or referenced by the reviewed feature-layer migrations. All must be created from reviewed generic sources or a reviewed metadata-derived schema-only definition; no production table rows may be copied.

### Organization identity and permissions

- `organizations`
- `branches`
- `roles`
- `permissions`
- `organization_memberships`
- `membership_roles`
- `role_permissions`
- Supabase-managed `auth.users` and standard `anon`, `authenticated`, `service_role` roles

### Agent, project, integration, and workflow structure

- `agent_templates`
- `organization_templates`
- `organization_template_assignments`
- `agent_families`
- `projects`
- `agents`
- `organization_integrations`
- `workflow_registry`
- `workflow_definitions`
- `agent_workflow_assignments`
- `agent_test_runs`
- `agent_approval_requests`
- `agent_runtime_readiness`

`agent_readiness_snapshots` is **not** present in the live schema metadata; do not create it as a guess. The mismatch between that name and the existing `agent_runtime_readiness` must be resolved in the relevant function/application contract first.

### Customer, property, operations, and audit structure

- Legacy/canonical customer and lead tables: `leads`, `crm_customers`, `crm_leads`, `crm_conversations`, `crm_messages`, `crm_tasks`
- Property/calendar tables: `properties`, `appointments`
- Calendar FK parents discovered in the scoped metadata review: `organization_systems`, `appointment_calendar_resources`
- Customer-stage FK parent discovered in the scoped metadata review: `organization_customer_stages`
- System-catalog FK parent discovered in the scoped metadata review: `system_catalog`
- Scheduling/follow-up and handoff tables: `follow_ups`, `human_handoffs`, `handoff_notifications`
- Event/audit tables: `domain_events`, `audit_logs`
- Knowledge tables: `knowledge_collections`, `knowledge_sources`, `customer_memories`
- Model catalog: `ai_model_catalog`, `organization_ai_model_assignments`

Columns/defaults, constraints, indexes, RLS state and policy expressions for this allowlist are captured in [STAGING_BASELINE_DDL_PREVIEW.sql](STAGING_BASELINE_DDL_PREVIEW.sql), a fully commented review artifact. Trigger definitions and helper signatures/grants were inventoried separately; function bodies, executable trigger DDL and a staging grants plan remain intentionally absent.

## 2. Required generic helpers and security contracts

The baseline must define or safely import exact reviewed versions of these shared helpers where needed:

- `set_updated_at()`
- `is_organization_member(uuid)`
- `has_organization_permission(uuid, text)`
- `slugify_identifier(text)`
- `create_human_handoff(...)`
- Existing trigger helpers identified by trigger metadata (signatures/grants only; bodies not read): `touch_ai_model_updated_at()`, `timeline_from_appointment()`, `timeline_from_crm_lead()`, `timeline_from_crm_message()`, `timeline_from_crm_task()`, `timeline_from_domain_event()`, `sanitize_lead_budget_phone_collision()`, `attach_existing_onboarding_submissions_after_membership()`, `seed_organization_role_presets_after_membership()`, `sync_system_routes_after_installation_change()`, `ensure_organization_manager_access_code()`, `seed_customer_stages_for_new_organization()`
- `assert_real_estate_mutation_scope(...)`
- `rls_auto_enable()`
- `sync_payment_plan_total()`
- `update_updated_at_column()`
- `set_whatsapp_template_config_updated_at()`
- Provisioning functions required by onboarding: `provision_client_organization(...)`, `provision_client_workspace(...)`, `provision_trial_client_organization(...)`, plus the existing organization-template provisioning function(s)

No helper function body may be sourced from the quarantined foundation migration. Review the exact function owner, `SECURITY DEFINER` setting, fixed `search_path`, signature, and role grants. Provisioning RPCs remain service-role-only. Do not invoke them during schema setup. Metadata showed `sanitize_lead_budget_phone_collision()` (a `RETURNS trigger` helper) has `EXECUTE` for `anon` and `authenticated`; it is not callable as an ordinary RPC, but staging should not reproduce that grant. No live change to this helper's ACL was made or authorized.

## 3. Feature-layer migration prerequisites and relative order

The repair branch contains the already-applied ACL migration plus 21 pending application migrations (seven shared current-main migrations and 14 local app migrations); these are a delta layered on the core allowlist, not a standalone bootstrap:

1. **Provisioning:** applied production ACL version is `20261024140349_workspace_provisioning_acl.sql`; pending `20261024141900_client_provisioning_retry_safe.sql` follows it and still requires the core provisioning schema.
2. **Handoff idempotency and approvals:** require core conversations, agents, handoffs, organizations, Auth identities, memberships, roles/permissions, and audit structures.
3. **Inspection/calendar:** require organizations, leads and CRM relations, properties, appointments, domain events, audit logs, membership/permission functions, and update triggers.
4. **Estate catalog and knowledge links:** require organizations, canonical properties, knowledge sources/collections, membership/permission helpers, and composite tenant keys.
5. **Outbound tracking and delivery receipts:** require leads/follow-ups, inspection jobs, provider/message IDs, and status contracts.
6. **Atomic audit wrappers:** require the estate, knowledge, inspection, and audit objects/functions above.
7. **Campaign groups and customer service windows:** require leads/CRM customers, organizations, audit helpers, update triggers, and service-role RPC boundaries.
8. **Shared handoff receipt/retry state:** apply receipt-state changes before retry-safety columns and one-time approval/claim objects; review compatibility with the shared `handoff_notifications` contract first.

These are dependency families, not an authorized execution sequence. Exact ordering must be regenerated after core DDL and the two identified schema blockers are resolved. All 21 pending migration filenames now sort after the recorded production ACL migration as `20261024140400` through `20261024142400`; the SQL bodies are unchanged. Staging's independently recorded smoke-test versions still need reconciliation before any CLI or batch apply.

## 4. Data, seed, and test-fixture rules

Allowed staging-only fixture data, after the schema manifest is approved:

- One fictional Supabase Auth user.
- One synthetic active real-estate organization with synthetic owner membership, role, permission mappings, and explicit scheduler/feature opt-in only where a test needs it.
- Fictional properties, CRM customers/leads, inspections, estates, FAQs, calendars, handoffs, and campaign recipients.
- Generic permission/tool catalog seed rows only when their source and idempotency are reviewed.

Prohibited:

- FLUXNIT/Limitless customer, staff, property, conversation, message, credential, or tenant configuration rows.
- Any excluded-tenant source, records, configuration, integrations, workflows, or seed values.
- Any real provider send, live calendar event, or external scheduler activation.

The phase-10 integration-requirement backfill reads existing agents. On an empty staging database it should insert no rows, but verify the SQL and run only after confirming staging has no imported production data.

## 5. Known blockers and required resolution

1. The generic-named platform foundation source was quarantined after the scoped review encountered out-of-scope tenant-specific material; it is not part of this manifest.
2. The metadata preview supplies exact table/constraint/index/policy definitions for the allowlist, but omits function bodies, trigger creation, grants and extension setup. Existing production triggers call helpers whose behavior and additional table dependencies are not known under this scope.
3. A migration-order/RLS dependency cycle involves `customer_memories`: the preview places its table before policies, which is a possible resolution if the baseline is approved and feature migrations are reconciled. No DDL was applied, and required helper definitions remain unavailable.
4. Live metadata confirms `agent_readiness_snapshots` is absent while `agent_runtime_readiness` exists; a reviewed function migration uses the absent relation name. Resolve the schema/runtime contract before staging acceptance.
5. Local migration filenames have been rebased after live ACL version `20261024140349`; staging's MCP-applied ACL smoke migrations have independent versions and are not a synchronized app migration history. Reconcile staging history before any CLI or batch apply.
6. The feature functions use explicit real-estate tenant activation gates. Confirm the synthetic staging fixture can satisfy intended generic behavior without any production tenant ID or configuration.
7. Several production defaults encode Limitless/Nigeria runtime assumptions (`limitless-realty`, `production`, `n8n`, `Africa/Lagos`, `NGN`, `whatsapp`, `maia`). Review or replace these with explicit tenant-owned configuration before creating a reusable baseline.
8. Many selected tables grant effective privileges to browser roles while RLS is enabled. Do not clone table ACLs blindly; prepare and review a least-privilege staging grant plan.

## 6. Gate before creating/applying baseline DDL

The next artifact should be an executable migration only after:

- Every object in Sections 1–2 has an exact source, signature, and privilege/policy review.
- The missing core schema and RLS ordering cycle are resolved without reading or using the quarantined source.
- The readiness relation mismatch is resolved without adding a guessed compatibility table.
- The migration versions are aligned to staging and the already-applied FLUXNIT ACL migration.
- The resulting staging-only SQL contains no tenant/customer data and passes local SQL/behavioral checks.

Until then, keep staging at its ACL-smoke-only state and do not apply the comment-only preview or the 21 pending feature migrations.
