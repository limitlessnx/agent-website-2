# FLUXNIT routine and trigger metadata inventory

**Captured:** 25 October 2026<br>
**Source:** FLUXNIT Supabase project `tacxegmlppngnuvldojy`, PostgreSQL catalogs only<br>
**Scope:** 25 named helpers in the staging manifest, plus trigger attachments on the approved 42-table public-schema allowlist<br>
**Status:** Metadata and bounded source-review evidence only; not executable DDL and not approval to apply anything.

## Safety and limits

This inventory records function identity arguments, result types, ownership, `SECURITY DEFINER`, configured `search_path`, direct `EXECUTE` privilege flags for `anon`, `authenticated`, and `service_role`, and trigger/event-trigger attachment metadata. A bounded follow-up read selected definitions only for the 25 manifest names and directly called helper names; explicit excluded-tenant markers were redacted before return. No application rows or excluded-tenant sources/data were selected or used. Regular trigger metadata was restricted to the approved 42-table allowlist. The source review identified additional referenced relations outside that original table allowlist; see [STAGING_BASELINE_ROUTINE_SOURCE_REVIEW.md](STAGING_BASELINE_ROUTINE_SOURCE_REVIEW.md).

Metadata is not behavior. In particular, a signature or an existing production function body is not sufficient authority to reproduce that body in staging. Security-definer behavior, writes to dependent tables, error paths, idempotency, tenant binding, and trigger side effects still require reviewed implementation source and tests. Never use no-op stubs to make object-presence checks pass.

## Named routine metadata

All listed routines were owned by `postgres` in the queried project. `EXECUTE` columns below describe direct function privileges, not whether invoking a trigger requires those privileges.

| Function | Identity arguments → result | Security definer | Configured `search_path` | EXECUTE anon/auth/service_role |
| --- | --- | --- | --- | --- |
| `attach_existing_onboarding_submissions_after_membership` | `()` → `trigger` | yes | `public, auth` | no / no / yes |
| `create_human_handoff` | `p_organization_id uuid, p_customer_id uuid, p_conversation_id uuid, p_reason text, p_category text, p_priority text, p_source_system_id uuid, p_source_agent_id uuid, p_correlation_id uuid, p_sla_due_at timestamptz, p_created_by_type text, p_created_by_id text, p_metadata jsonb` → `uuid` | yes | empty | no / no / yes |
| `ensure_organization_manager_access_code` | `()` → `trigger` | no | `public` | no / no / yes |
| `has_organization_permission` | `target_organization_id uuid, permission_key text` → `boolean` | yes | `public, auth` | no / yes / yes |
| `is_organization_member` | `target_organization_id uuid` → `boolean` | yes | `public, auth` | no / yes / yes |
| `provision_client_organization` | `p_user_id uuid, p_organization_name text, p_organization_slug text, p_template_slug text, p_agent_family_name text` → `jsonb` | yes | `public, auth` | no / no / yes |
| `provision_client_workspace` | `p_user_id uuid, p_organization_name text, p_organization_slug text, p_industry_slug text, p_business_email text` → `jsonb` | yes | `public, auth` | no / no / yes |
| `provision_trial_client_organization` | `p_user_id uuid, p_organization_name text, p_organization_slug text, p_template_slug text, p_agent_family_name text` → `jsonb` | yes | `public, auth` | no / no / yes |
| `rls_auto_enable` | `()` → `event_trigger` | yes | `pg_catalog` | no / no / yes |
| `sanitize_lead_budget_phone_collision` | `()` → `trigger` | no | empty | yes / yes / yes |
| `seed_customer_stages_for_new_organization` | `()` → `trigger` | yes | empty | no / no / yes |
| `seed_organization_role_presets_after_membership` | `()` → `trigger` | yes | empty | no / no / yes |
| `set_updated_at` | `()` → `trigger` | no | empty | yes / yes / yes |
| `set_whatsapp_template_config_updated_at` | `()` → `trigger` | no | `pg_catalog, public` | yes / yes / yes |
| `slugify_identifier` | `value text` → `text` | no | `pg_catalog, public` | yes / yes / yes |
| `sync_payment_plan_total` | `()` → `trigger` | yes | `public` | no / no / yes |
| `sync_system_routes_after_installation_change` | `()` → `trigger` | yes | empty | no / no / yes |
| `timeline_from_appointment` | `()` → `trigger` | yes | empty | no / no / yes |
| `timeline_from_crm_lead` | `()` → `trigger` | yes | empty | no / no / yes |
| `timeline_from_crm_message` | `()` → `trigger` | yes | empty | no / no / yes |
| `timeline_from_crm_task` | `()` → `trigger` | yes | empty | no / no / yes |
| `timeline_from_domain_event` | `()` → `trigger` | yes | empty | no / no / yes |
| `touch_ai_model_updated_at` | `()` → `trigger` | no | `public` | no / no / yes |
| `update_updated_at_column` | `()` → `trigger` | no | `pg_catalog, public` | yes / yes / yes |

The metadata query found **24 of the 25** names in the approved helper inventory in FLUXNIT's `public` schema. `assert_real_estate_mutation_scope(uuid,text)` is absent there, but the reviewed, unapplied branch migration `20261024141800_real_estate_atomic_audit.sql` already defines it. That pending implementation requires a nonblank audit actor and an active organization whose slug is exactly `limitless-realty` or whose `industry_slug`/`industry` metadata normalizes to `realestate`. Its row lookup now uses `FOR SHARE`, so a concurrent organization-row update cannot change the status/classification during a guarded transaction; the lock mode was hardened in this branch after review. It is not necessary to invent this function; its special legacy-slug exception still needs deliberate review for the replication model. All three listed provisioning routines exist in FLUXNIT with service-role-only direct execution, but the corresponding staging objects are non-functional smoke stubs and are not validated by these catalog facts.

### Event trigger

`rls_auto_enable()` is attached to event trigger `ensure_rls`, enabled (`O`), owned by `postgres`, on `ddl_command_end`, for tags `CREATE TABLE`, `CREATE TABLE AS`, and `SELECT INTO`. This inventory does not copy the event-trigger function body or authorize installing the event trigger in staging.

## Trigger attachments on the approved 42 tables

The catalog query returned **30 enabled regular-trigger attachments across 14 distinct trigger functions** on the allowlisted tables. Below are the metadata-derived definitions; preserve them only after the referenced table/column set and function behavior are independently reviewed. These statements are **not** a migration and must not be executed from this document.

```sql
CREATE TRIGGER agent_families_set_updated_at BEFORE UPDATE ON agent_families FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER agent_templates_set_updated_at BEFORE UPDATE ON agent_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER agents_set_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER ai_model_catalog_touch_updated_at BEFORE UPDATE ON ai_model_catalog FOR EACH ROW EXECUTE FUNCTION touch_ai_model_updated_at();
CREATE TRIGGER appointment_customer_timeline AFTER INSERT OR UPDATE OF status, start_at, end_at ON appointments FOR EACH ROW EXECUTE FUNCTION timeline_from_appointment();
CREATE TRIGGER branches_set_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_crm_conversations_updated_at BEFORE UPDATE ON crm_conversations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_crm_customers_updated_at BEFORE UPDATE ON crm_customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER crm_lead_customer_timeline AFTER INSERT OR UPDATE OF stage, score, summary ON crm_leads FOR EACH ROW EXECUTE FUNCTION timeline_from_crm_lead();
CREATE TRIGGER set_crm_leads_updated_at BEFORE UPDATE ON crm_leads FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER crm_message_customer_timeline AFTER INSERT ON crm_messages FOR EACH ROW EXECUTE FUNCTION timeline_from_crm_message();
CREATE TRIGGER crm_task_customer_timeline AFTER INSERT OR UPDATE OF status, due_at, completed_at ON crm_tasks FOR EACH ROW EXECUTE FUNCTION timeline_from_crm_task();
CREATE TRIGGER set_crm_tasks_updated_at BEFORE UPDATE ON crm_tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER domain_event_customer_timeline AFTER INSERT ON domain_events FOR EACH ROW EXECUTE FUNCTION timeline_from_domain_event();
CREATE TRIGGER set_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sanitize_lead_budget_phone_collision BEFORE INSERT OR UPDATE OF budget, phone ON leads FOR EACH ROW EXECUTE FUNCTION sanitize_lead_budget_phone_collision();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER organization_ai_model_assignments_touch_updated_at BEFORE UPDATE ON organization_ai_model_assignments FOR EACH ROW EXECUTE FUNCTION touch_ai_model_updated_at();
CREATE TRIGGER organization_membership_attach_onboarding_submissions AFTER INSERT OR UPDATE OF status ON organization_memberships FOR EACH ROW EXECUTE FUNCTION attach_existing_onboarding_submissions_after_membership();
CREATE TRIGGER organization_membership_seed_role_presets AFTER INSERT ON organization_memberships FOR EACH ROW EXECUTE FUNCTION seed_organization_role_presets_after_membership();
CREATE TRIGGER organization_memberships_set_updated_at BEFORE UPDATE ON organization_memberships FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER organization_system_sync_event_routes AFTER INSERT OR DELETE OR UPDATE OF status, system_id ON organization_systems FOR EACH ROW EXECUTE FUNCTION sync_system_routes_after_installation_change();
CREATE TRIGGER organizations_ensure_manager_access_code BEFORE INSERT ON organizations FOR EACH ROW EXECUTE FUNCTION ensure_organization_manager_access_code();
CREATE TRIGGER organizations_set_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER seed_customer_stages_on_organization_insert AFTER INSERT ON organizations FOR EACH ROW EXECUTE FUNCTION seed_customer_stages_for_new_organization();
CREATE TRIGGER projects_set_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER roles_set_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER workflow_registry_set_updated_at BEFORE UPDATE ON workflow_registry FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

The trigger inventory does **not** include attachments for `set_whatsapp_template_config_updated_at` or `sync_payment_plan_total` because no attachment for either function appeared on the approved 42-table list. Their attachment/dependency must not be inferred from this absence. The RLS event trigger is documented separately above.

## Baseline consequences

- Production definitions were read only to map behavior and dependency closure; no body was copied into a migration or candidate. Their tenant-neutral adaptations and recursive dependencies still require review; see [STAGING_BASELINE_ROUTINE_SOURCE_REVIEW.md](STAGING_BASELINE_ROUTINE_SOURCE_REVIEW.md).
- The pending migration's `assert_real_estate_mutation_scope` contract has been exercised in fictional PGlite fixtures: the legacy Limitless slug and metadata-tagged real-estate organizations (including `industry_slug` precedence) are accepted; retail/inactive organizations, missing organization IDs, and blank/NULL actors are rejected. `anon`/`authenticated` cannot call the helper or audit wrapper; `service_role` cannot call the helper directly but can invoke the granted audit wrapper. The focused database test passed 11/11 and the full tenant-neutral suite, including both four-test preflight contracts and four authorization-core draft tests, passed 190/190. The authorization draft is a separate post-schema candidate, not a migration, and remains unapproved/unapplied. The mutation-scope helper's `FOR SHARE` behavior was code-reviewed but not concurrency-tested in PGlite; the authorization draft now blocks all membership/role organization-ID changes, but its row-lock behavior also lacks a true multi-session stress test. Review the hard-coded legacy slug exception before considering this part of the baseline complete.
- The 12 staging-missing trigger helpers are present by name in FLUXNIT and their definitions have been inspected. That inspection found at least 17 additional table dependencies and more transitive helpers beyond the 42-object allowlist. They are not authorized additions; classify them into real-estate core, billing, onboarding-claim, and integration-routing modules before drafting DDL.
- Review direct `EXECUTE` grants independently. In particular, several trigger/pure utility functions have direct `EXECUTE` for `anon` and/or `authenticated` in Production metadata; do not reproduce those grants automatically. `sanitize_lead_budget_phone_collision()` is one observed example.
- The dependency-complete staging DDL, least-privilege RLS/grants, tenant-neutral routine adaptations, trigger attachment plan, and module defaults remain incomplete. No staging or Production schema write has been made from this inventory or source review.
