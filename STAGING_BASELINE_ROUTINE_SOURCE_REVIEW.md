# Shared routine source review — staging baseline

**Captured:** 25 October 2026
**Scope:** The 25 shared helper names in `STAGING_BASELINE_MANIFEST.md`, plus only the transitive routine names directly called by those definitions and table dependencies explicitly named by the bodies.
**Status:** Read-only review evidence; not DDL, not a migration, and not approval to write to staging or Production.

## Safety boundary

The review read catalog definitions only for the manifest's named `public` routines and the direct dependencies they call. The source query returned no application table rows and redacted any definition that contained the explicit excluded-tenant marker. The four historical signup migrations read were screened for that marker first. No excluded-tenant source, configuration, records, or seed values were queried or used. No Production function body was copied into the repository or into a candidate migration; the bodies were reviewed only to find dependency closure and unsafe assumptions.

The original 42-table/60-policy metadata preview is **not** dependency-complete. The function bodies call at least 17 additional shared public tables not included in that 42-table allowlist. All 17 were confirmed in the Production catalog; columns and RLS flags for `dashboard_notifications` were also read, while its complete constraints, policies, grants, and trigger inventory still need review. Some routines also call additional helpers and touch other tables, so 17 is a lower bound, not a final closure count.

## Dependency closure discovered

### Additional relations outside the 42-table allowlist

- Onboarding and identity: `client_onboarding_profiles`, `client_onboarding_submissions`, `platform_super_admins`.
- Customer timeline and notifications: `customer_timeline_events`, `dashboard_notifications`.
- Credits and billing: `flux_credit_wallets`, `flux_credit_ledger`, `billing_plans`, `organization_subscriptions`.
- Real-estate payment plans: `payment_plans`, `payment_records`.
- Service packages and routing: `organization_entitlements`, `organization_service_packages`, `service_packages`, `service_package_systems`, `system_event_routes`, `system_event_route_templates`.

Catalog checks found all 17 dependency tables and the named 42-table set have RLS enabled in FLUXNIT; the additional tables checked were not forced-RLS. This is presence evidence only. It does not make current Production ACLs safe to copy. In the audited dependency set, Production directly grants broad privileges to browser roles on several sensitive tables, including `platform_super_admins`, `billing_plans`, `client_onboarding_profiles`, `organization_subscriptions`, `payment_plans`, and `payment_records`. `payment_plans` and `payment_records` use a broad `is_organization_member(organization_id)` all-command policy. The staging baseline must use a separately reviewed least-privilege grant and policy design; do not clone those grants.

### Additional helper dependencies

The named routines call or transitively depend on `is_platform_super_admin`, `add_customer_timeline_event`, `seed_default_customer_stages`, `ensure_organization_role_presets`, `sync_organization_system_event_routes`, `organization_can_use_system`, `organization_active_service_package`, `start_fluxknight_basic_free_trial`, `ensure_flux_credit_wallet`, `resolve_flux_monthly_allowance`, `sync_flux_credit_wallet_from_subscription`, `sync_flux_credit_threshold_notification`, `sync_flux_subscription_wallet_trigger`, `resolve_onboarding_submission_organization`, `prevent_flux_credit_ledger_mutation`, and `installment_frequency_interval`. Further calls are visible in the bodies but require a complete closure audit before implementation, including `organization_can_use_system`'s package/entitlement path and any notification/ledger triggers.

## Function-by-function findings

| Routine group | Observed behavior / dependency | Baseline disposition |
| --- | --- | --- |
| `set_updated_at`, `update_updated_at_column`, `touch_ai_model_updated_at`, `slugify_identifier` | Simple timestamp/ASCII slug utilities. The slug helper strips non-ASCII characters rather than transliterating. | Suitable for a reviewed tenant-neutral utility layer, with explicit EXECUTE grants and tests; do not copy Production's broad utility grants. |
| `is_organization_member`, `has_organization_permission` | Both bypass normal membership checks for `is_platform_super_admin()`, which reads `platform_super_admins`. That table has RLS enabled but catalog metadata showed broad direct grants and no policy in the reviewed metadata. | Do not reproduce the bypass/table ACL as-is. Either explicitly model a tightly protected platform-admin exception, or use a fail-closed membership-only helper for staging and document the behavioral difference. Test cross-tenant and inactive-membership denial. |
| `create_human_handoff` and `timeline_from_*` | Validate customer/conversation tenant linkage and write handoff rows, then call `add_customer_timeline_event`; the latter writes `customer_timeline_events` with an upsert on `(organization_id, source_table, source_id, event_type)`. | Requires adding the timeline table, its partial unique index, RLS, and the tenant-bound helper. Preserve tenant predicates and test idempotency/cross-tenant rejection. |
| `seed_customer_stages_for_new_organization` | Calls `seed_default_customer_stages` to create five organization-scoped stages. The target table is already in the 42-table list. | Candidate for the real-estate baseline after the unique key and stages are tested in fictional organizations. |
| `seed_organization_role_presets_after_membership` | Calls `ensure_organization_role_presets`; creates Owner/Manager/Supervisor/Team Member roles, gives Owner all catalog permissions, and grants a hard-coded Manager/Supervisor/Member list. | Requires explicit, reviewed permission seeds and least-privilege role matrices; the Production mapping is not approved for replication as-is. |
| `attach_existing_onboarding_submissions_after_membership` and `resolve_onboarding_submission_organization` | Read Auth emails and associate unscoped submission rows to an active membership by email, including selecting the first matching membership. They require `client_onboarding_submissions`. | Do not attach unchanged. Design an explicit, atomic, verified submission-claim flow (payment state, token/hash, unique ownership, membership selection) and test duplicate-email, multiple-membership, and replay cases first. |
| `provision_client_organization` | Creates organization, Main Branch, Owner role, membership, and optional agent/project records; adds every row in `permissions` to the Owner role. Current branch migration makes the organization provisioning retry/idempotency-aware. | Uses mostly allowlisted core tables, but requires a reviewed permission seed catalogue and tests proving only intended permission keys are assigned. Keep RPC service-role-only. |
| `provision_client_workspace` | Wraps organization provisioning, stores `workspace_mode='free'` and an industry slug, creates a zero/paused Basic wallet, writes a client onboarding profile, and defaults channels/preferences to WhatsApp/need-help. | Requires `client_onboarding_profiles`, wallet/ledger/notification dependencies, and explicit platform defaults. Keep the RPC service-role-only and test retries, not just name/ACL presence. |
| `provision_trial_client_organization` and billing helpers | Starts a Basic trial using an active Basic billing plan, prefers slug `whatsapp-ai-starter`, sets 14 days and 250 trial credits, and routes through wallet/subscription/ledger helpers. Billing plan currency defaults to NGN; monthly credit allowances are hard-coded by plan. | Treat these as platform billing policy, not generic schema. Use a staging-only synthetic plan after those values are explicitly represented as configuration; do not silently seed or charge. No Production billing change is authorized. |
| Credit-wallet triggers | `sync_flux_subscription_wallet_trigger` calls `sync_flux_credit_wallet_from_subscription`; the wallet threshold trigger writes `dashboard_notifications`; wallet setup writes immutable `flux_credit_ledger` records. These need more helpers/tables and grant review. | Separate billing module. Do not include the triggers until their full dependency closure and notification/ledger behavior are reviewed and tested. |
| `sync_system_routes_after_installation_change` | Calls route synchronization, system entitlement/package checks, route templates, and service-package mappings. Dependencies include the six service-package/routing relations listed above and further helper functions. | Separate integration-routing module. Do not attach this trigger to staging until that package is closed; skipping it must be explicit in the staging test scope. |
| `sync_payment_plan_total` | Mutates payment plans based on payment records and `installment_frequency_interval`; defaults monthly installments to 30 days and other unknown intervals to 14 days. Payment table RLS policy permits all commands to any active member. | Separate financial module. Rework to explicit financial permissions and test currency, rounding, and schedule rules before including it. |
| `sanitize_lead_budget_phone_collision` | Treats Nigerian `234` numbers specially while normalizing budget/phone strings. | Replace the country-code assumption with a tenant-region-aware policy or omit the heuristic; add locale tests before enabling the trigger for other regions. |
| `ensure_organization_manager_access_code` | Uses `extensions.gen_random_bytes`, emits a `FLX-` prefix, and loops for uniqueness. `pgcrypto` exists in schema `extensions`. | Make the prefix configurable or define a generic code contract; test uniqueness/race behavior and preserve the trusted extension schema. |
| `rls_auto_enable` | A global `ddl_command_end` event trigger enables RLS on every `public` table and catches/logs failures. | For an audited baseline, prefer explicit `ENABLE ROW LEVEL SECURITY` on every allowlisted table and verify it. Do not install a global event trigger as a substitute for review. |
| `set_whatsapp_template_config_updated_at` | No attachment was found on the approved 42-table list. | Do not require it for the minimal baseline until its table and actual use are in scope. |

## Readiness decision

Do **not** create an executable 42-table baseline by simply uncommenting `STAGING_BASELINE_DDL_PREVIEW.sql` or by copying the inspected Production function bodies. Doing so would omit required relations, helpers, triggers, and grants while importing unsafe role, billing, locale, and email-matching assumptions.

The next local deliverable must be a dependency-closed **module plan** with separate acceptance scopes:

1. Core real-estate operations: organizations/memberships/roles, properties/CRM, appointments/inspections, handoffs/audit, customer timeline, and minimum onboarding profile state.
2. Optional platform billing/trials: wallets, ledger, plans/subscriptions, and notification integration, with explicit staging-only plan configuration and no provider charge.
3. Optional service routing and payment plans: separately allowlisted tables, privileges, functions, and fictional tests.
4. Safe signup/submission claim: verified identity/payment handoff, not the current email-only auto-association trigger.

For each module, close the recursive table/function/trigger dependencies, author a tenant-neutral least-privilege candidate, and run fictional PGlite tests. Keep the candidate outside `supabase/migrations` until the full DDL and exact execution order are reviewed. Only after the complete SQL is shown should any staging write be considered. No stage or Production DDL was applied during this review.


## Supplemental read-only preflight result

`STAGING_BASELINE_DEPENDENCY_PREFLIGHT.sql` is a separate catalog-only gap checker for the 17 additional relation names and 16 direct helper names above. Its four static contract tests pass; the query also executed in an ephemeral PGlite database with fictional role names and returned the expected 17 missing tables, 17 corresponding RLS-not-enabled findings, and 16 missing helpers. The live read-only staging query returned the same 50 findings: 17 missing relations, 17 corresponding no-RLS findings because those relations do not exist, and 16 missing helper names. It returned no direct-grant findings; because the relations are absent, that is **not** evidence that their future grants are safe. No application rows were read and no staging DDL was run.
