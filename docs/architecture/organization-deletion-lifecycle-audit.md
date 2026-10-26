# Organization Deletion Lifecycle Audit (Draft)

**Status:** Discovery/design only. No deletion endpoint, schema change, migration, or destructive action is implemented by this document.

**Scope:** Static review of repository migrations and current organization-management surfaces, with emphasis on tenant isolation, financial evidence, external integrations, and scheduled work.

## Executive finding

Organization deletion must not be implemented as a single `DELETE FROM organizations` operation. The repository contains multiple tenant-owned data families with cascading foreign keys, tenant-scoped ledgers, payment/booking evidence, and asynchronous reminder execution. Database cascades alone cannot revoke external credentials, cancel provider-side jobs, produce a customer export, preserve financial/audit evidence, or guarantee that queued work stops before tenant access is disabled.

The existing migration `20260926222444_b4_route_sync_safe_org_delete.sql` makes the route-sync trigger tolerate an organization row that no longer exists. It is a trigger-safety fix, **not** a complete deletion lifecycle.

This audit now includes a read-only live-schema inventory from the active Supabase project **FLUXNIT** (`tacxegmlppngnuvldojy`). It enumerated direct foreign keys to `public.organizations` and inspected selected indirect financial/queue dependencies. It is still not a complete inventory of external provider jobs, storage objects, backups, or every indirect cascade path; do not treat it as approval to delete tenant data.

## Live schema result (read-only, FLUXNIT)

A read-only query against PostgreSQL system catalogs found **171 direct foreign-key constraints** referencing `public.organizations`:

- **159** use `ON DELETE CASCADE`
- **11** use `ON DELETE SET NULL`
- **1** uses default `NO ACTION`

The direct `NO ACTION` constraint is `follow_ups.organization_id -> organizations(id)`. It may block a direct organization delete while follow-up rows remain. Do not bypass it by dropping the constraint or mass-deleting follow-ups; first determine the intended tenant lifecycle and whether the rows are still active. Additional indirect blockers include `appointments` referencing organization systems with RESTRICT, `customer_stage_history` referencing tenant stages with RESTRICT, `organization_invitations` referencing roles with RESTRICT, and payment attempts referencing organization quotes with RESTRICT.

The `SET NULL` group includes `audit_logs`, `checkout_sessions`, onboarding submissions/documents, and support/evaluation records. These preserve some rows but remove their direct organization association, which affects traceability and reconciliation.

A broader read-only query of all foreign keys owned by public tables containing an `organization_id` column found **452 constraints across 169 tenant-scoped tables**: 310 CASCADE, 105 SET NULL, 24 RESTRICT, and 13 NO ACTION. This includes indirect links to shared catalog/template records, workflow definitions, memberships, leads/properties, appointment systems, and billing objects. These non-cascade constraints make a naive delete graph even less predictable.

**High-risk confirmed behavior:** the live schema currently cascades organization deletion into `flux_credit_ledger`, `flux_credit_wallets`, `payment_attempts`, `payment_records`, `organization_subscriptions`, and `xposure_bookings`. This is a concrete reason not to expose hard deletion yet: a direct delete could erase credit/payment/booking history. The ledger also has a `RESTRICT` FK to its wallet, and payment attempts have a `RESTRICT` FK to organization quotes, so indirect FK interactions require a deliberate dry-run before any deletion design is implemented.

The deployed FLUXNIT migration ledger's latest version is `20261026144829`, matching the latest migration filename in the repository at the time of this audit. This is a latest-version spot check, not a full per-version reconciliation. The separate project named **Limitless Realty Staging** did not have `public.organizations` when queried and is not a valid substitute for this schema inventory. No schema was changed and no tenant business rows were queried or modified.

## Evidence reviewed

- `supabase/migrations/20260801194930_secure_multitenant_crm_foundation.sql`
- `supabase/migrations/20260926184807_a2_a3_tenant_membership_permissions.sql`
- `supabase/migrations/20260926222444_b4_route_sync_safe_org_delete.sql`
- `supabase/migrations/20260927093533_g3_flux_credit_topup_pricing.sql`
- `supabase/migrations/20261025092354_xposure_booking_payment_lifecycle.sql`
- `supabase/migrations/20261025092400_xposure_atomic_booking_confirmation.sql`
- `supabase/migrations/20261025210354_20261024140500_tenant_reminder_rules.sql`
- `supabase/migrations/20261025210407_20261024140600_tenant_reminder_executions.sql`
- `supabase/migrations/20261025210412_20261024140700_tenant_reminder_notifications.sql`
- `supabase/migrations/20261025210424_20261024140800_tenant_customer_contacts.sql`
- `supabase/migrations/20261025210436_20261024140900_tenant_appointment_lifecycle_reminders.sql`
- Current admin organization inspection/setup surfaces and organization membership APIs.

## Dependency inventory: confirmed from reviewed migration source

| Data family | Evidence and current behavior | Deletion concern |
|---|---|---|
| CRM customers, leads, conversations, messages, tasks | CRM foundation declares organization-owned rows with `ON DELETE CASCADE`; some composite customer/conversation references also cascade. Agent references may be set null. | A hard delete can remove business records and conversation history in bulk. Export and retention decisions must precede any irreversible action. |
| Channel bindings | Tenant-scoped bindings reference organization integrations and agents with cascading behavior. | Removing rows does not revoke WhatsApp, email, voice, calendar, or other provider credentials outside the database. |
| Organization invitations | Invitations reference the organization with cascade; role references restrict; user references can be set null. | Pending invitation links/tokens must be invalidated and role dependencies verified before deletion. |
| Reminder rules, executions, notifications | Rules reference organizations with cascade. Execution/notification records also reference parent rules/executions with cascade. | Cascading rows does not guarantee already-enqueued Trigger.dev tasks or provider-side messages are canceled. A pre-delete queue drain/cancel step is required. |
| Customer contacts and appointment reminders | Tenant reminder/contact tables cascade with organization deletion; appointment reminder rows also reference tenant appointments. | Personal data retention/export requirements must be applied. Queued reminders must be suppressed before access is revoked, and the shared reminder engine must remain tenant-specific. |
| Xposure bookings | `xposure_bookings.organization_id` references organizations with cascade. The lifecycle stores booking status, payment status, verification actor/timestamps, and confirmation metadata. | Deleting a tenant can erase booking/payment-review evidence. Preserve or export records under a defined retention policy; never infer that a booking's payment has been refunded or reconciled by deleting its row. |
| Flux Credits top-up ledger | `apply_flux_credit_topup_from_checkout` uses checkout session state, a credit ledger, wallet rows, and a unique checkout-session ledger key for idempotency. The live FLUXNIT schema currently has organization-delete cascades to both `flux_credit_ledger` and `flux_credit_wallets`. | Financial ledger and checkout evidence must be reconciled and retained according to an approved policy. Current FK behavior is unsafe for unguarded hard deletion; do not cascade-delete or mutate ledger history as a shortcut to tenant deletion. |
| System route synchronization | The safe-delete migration checks whether the organization still exists before calling route synchronization. | This only prevents one trigger path from attempting a sync for a missing organization. It does not clean up all route bindings, scheduled tasks, external systems, or historical records. |

## Risks that still need verification

The following are **not yet proven safe** and require a full schema/runtime inventory before implementing any deletion workflow:

1. **Indirect foreign-key graph and migration drift:** the direct FK list to `organizations` is inventoried for FLUXNIT, but indirect cascade/restrict paths across every table still need a full generated report. Compare all deployed constraints with migration history and current migration files.
2. **Billing and subscriptions:** verify wallet, credit ledger, checkout session, subscription, invoice/payment event, and plan-assignment FK behavior. Financial history should normally be retained or anonymized under an approved policy, not silently cascaded.
3. **Audit and security events:** verify that admin actions, webhook/event logs, consent records, handover summaries, and security logs survive tenant offboarding for the required retention window.
4. **External credentials and integrations:** identify token/secret storage and provider revoke/disconnect procedures. Secrets must not be copied into exports or exposed in the admin page.
5. **Asynchronous work:** enumerate Trigger.dev tasks, retry queues, webhook deliveries, reminder drains, and any remaining legacy integration jobs. Establish cancellation and idempotency behavior before removing database rows.
6. **Media and storage:** inventory Supabase Storage buckets, object paths, signed URLs, catalog images/videos, and backups. Database deletion alone may leave orphaned objects; deleting objects first may make recovery impossible.
7. **Identity and ownership:** define owner transfer, active sessions, invitations, memberships, manager access, and what happens when the last owner leaves.
8. **Legal/data retention:** define export format, customer approval, retention periods, deletion exceptions, and who authorizes irreversible erasure.

## Proposed lifecycle (design only)

Use a staged, auditable lifecycle rather than a direct hard delete.

1. **Request and authorize**
   - Require an authenticated Super Admin and a second confirmation bound to the exact organization ID and slug.
   - Record actor, reason, request time, approval, and a correlation ID.
   - Block system organizations and any tenant with unresolved ownership/billing disputes unless an explicit reviewed exception exists.

2. **Freeze tenant operations**
   - Mark the tenant as `deletion_pending` or an equivalent lifecycle state only after the schema/state machine is reviewed.
   - Deny new sessions, invitations, agent provisioning, credit top-ups, and new bookings.
   - Stop outbound agent actions and reminder scheduling for this organization without changing behavior for any other tenant.

3. **Quiesce asynchronous work**
   - Enumerate and cancel queued/retrying tasks for this tenant.
   - Wait for in-flight work to finish or time out safely.
   - Re-check that no task can re-enqueue tenant work after the freeze.

4. **Export and verify**
   - Produce a tenant-scoped export with a manifest, record counts, timestamps, and checksums.
   - Exclude credentials/secrets; include references to media or separately export approved media.
   - Require an explicit export verification record before continuing.

5. **Reconcile external and financial dependencies**
   - Disconnect/revoke external provider credentials using supported provider flows.
   - Reconcile subscription state, wallet balance, credits, checkout sessions, refunds/chargebacks, and booking payment evidence.
   - Preserve immutable financial/audit records as required by the retention policy.

6. **Archive or anonymize**
   - Apply approved retention rules to CRM, conversations, booking/payment records, media, consent, and audit data.
   - Prefer reversible soft deletion/tombstoning for the initial rollout.
   - Keep tenant identifiers in retained financial/security records only where policy requires it; document any anonymization mapping.

7. **Hard delete only after a separate gate**
   - Run a dry-run dependency report and require zero unexplained dependencies.
   - Require an explicit, separately authorized final action.
   - Execute in a controlled transaction/batch where possible, with verified recovery/backup and post-delete integrity checks.
   - Preserve the tombstone and deletion audit event outside the rows being removed.

8. **Post-delete verification**
   - Confirm tenant access is blocked, external credentials are revoked, no queued work remains, no cross-tenant records were affected, and the export/retention evidence exists.
   - Produce a signed/immutable deletion receipt and alert on any residual references.

## Acceptance criteria before implementation

- [ ] Live deployed-schema FK inventory is captured and reviewed.
- [ ] Migration history and pending migrations are reconciled; no migration is run as part of this audit.
- [ ] Billing/credits/payment retention rules are approved.
- [ ] Export and recovery procedure is tested on non-production data.
- [ ] Trigger.dev and provider-side task cancellation is demonstrated for one test tenant.
- [ ] Integration credential revocation is demonstrated for each supported provider.
- [ ] Tenant freeze is tested to prevent new bookings, credit top-ups, invites, and outbound messages.
- [ ] Cross-tenant isolation tests prove another tenant's jobs, reminders, integrations, and data are unaffected.
- [ ] Audit trail survives offboarding and cannot be erased by the same delete operation.
- [ ] A dry-run report and explicit final-action confirmation are reviewed before any destructive capability is exposed.

## Guardrails

- This document adds no runtime behavior and contains no SQL migration.
- No Supabase project/branch was created and no database query or mutation was executed against a live project.
- No tenant was paused, deleted, exported, or otherwise mutated.
- Organization deletion must remain absent from the UI until the acceptance criteria are met and the user explicitly approves implementation.
