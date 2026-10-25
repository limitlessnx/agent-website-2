# Production-first rollout status — 25 October 2026

## Current state

The user explicitly directed the release to bypass staging and apply the 21 pending feature migrations directly to FLUXNIT. Those 21 features and one narrow real-estate permission-scope guard are now recorded in the FLUXNIT Production migration ledger. The database layer is applied; the application branch has **not** yet been merged to `main` or deployed to Vercel Production.

The target is Supabase project `tacxegmlppngnuvldojy` (FLUXNIT). No customer-row content was copied or exposed; only catalog metadata and aggregate status counts were queried. No WhatsApp message, calendar event, or customer notification was sent. The strict excluded-tenant boundary was preserved: no Xposure source or customer records were inspected or modified.

## Production migration ledger reconciliation

The 22 local filenames have been renamed to match the actual Supabase ledger versions so a future `supabase db push` will see them as applied rather than replaying them. Each filename retains the recorded migration name after its ledger version. This reconciliation is committed locally but not yet pushed; require exact-head CI/Preview after pushing the integration branch and before merge.

| Production version | Recorded migration name | Local filename |
| --- | --- | --- |
| `20261025210257` | `20261024140400_secure_workspace_provisioning_rpc` | `20261025210257_20261024140400_secure_workspace_provisioning_rpc.sql` |
| `20261025210354` | `20261024140500_tenant_reminder_rules` | `20261025210354_20261024140500_tenant_reminder_rules.sql` |
| `20261025210407` | `20261024140600_tenant_reminder_executions` | `20261025210407_20261024140600_tenant_reminder_executions.sql` |
| `20261025210412` | `20261024140700_tenant_reminder_notifications` | `20261025210412_20261024140700_tenant_reminder_notifications.sql` |
| `20261025210424` | `20261024140800_tenant_customer_contacts` | `20261025210424_20261024140800_tenant_customer_contacts.sql` |
| `20261025210436` | `20261024140900_tenant_appointment_lifecycle_reminders` | `20261025210436_20261024140900_tenant_appointment_lifecycle_reminders.sql` |
| `20261025210454` | `20261024141000_appointment_capacity_guard` | `20261025210454_20261024141000_appointment_capacity_guard.sql` |
| `20261025210504` | `20261024141100_real_estate_handoff_idempotency` | `20261025210504_20261024141100_real_estate_handoff_idempotency.sql` |
| `20261025210535` | `20261024141200_real_estate_action_approvals` | `20261025210535_20261024141200_real_estate_action_approvals.sql` |
| `20261025210604` | `20261024141300_real_estate_inspections` | `20261025210604_20261024141300_real_estate_inspections.sql` |
| `20261025210620` | `20261024141400_real_estate_estate_catalog` | `20261025210620_20261024141400_real_estate_estate_catalog.sql` |
| `20261025210627` | `20261024141500_real_estate_knowledge_links` | `20261025210627_20261024141500_real_estate_knowledge_links.sql` |
| `20261025210639` | `20261024141600_real_estate_outbound_tracking` | `20261025210639_20261024141600_real_estate_outbound_tracking.sql` |
| `20261025211057` | `20261024141650_real_estate_permission_scope` | `20261025211057_20261024141650_real_estate_permission_scope.sql` |
| `20261025211219` | `20261024141700_real_estate_delivery_receipts` | `20261025211219_20261024141700_real_estate_delivery_receipts.sql` |
| `20261025211249` | `20261024141800_real_estate_atomic_audit` | `20261025211249_20261024141800_real_estate_atomic_audit.sql` |
| `20261025211315` | `20261024141900_client_provisioning_retry_safe` | `20261025211315_20261024141900_client_provisioning_retry_safe.sql` |
| `20261025211347` | `20261024142000_handoff_notification_receipt_states` | `20261025211347_20261024142000_handoff_notification_receipt_states.sql` |
| `20261025211401` | `20261024142100_real_estate_campaign_groups` | `20261025211401_20261024142100_real_estate_campaign_groups.sql` |
| `20261025211411` | `20261024142200_real_estate_customer_service_windows` | `20261025211411_20261024142200_real_estate_customer_service_windows.sql` |
| `20261025211421` | `20261024142300_handoff_notification_retry_safety` | `20261025211421_20261024142300_handoff_notification_retry_safety.sql` |
| `20261025211432` | `20261024142400_handoff_notification_retry_approvals` | `20261025211432_20261024142400_handoff_notification_retry_approvals.sql` |

The narrow permission-scope migration replaces only the three new estate/FAQ/knowledge write policies; the helper rejects cross-organization role mappings. It does not rewrite unrelated shared policies.

## Read-only Production checks after apply

- The catalog-only 42-table/60-policy preflight returned **zero findings**: all expected tables, policies, named helpers, and trigger helpers exist; the three workspace/trial provisioning RPCs deny `anon` and `authenticated` and allow `service_role`.
- The supplemental 17-table/16-helper dependency preflight found **no missing tables, RLS gaps, or helper names**. It did report **42 pre-existing broad grant findings** on shared platform dependencies: 24 direct `anon` privileges and 18 direct authenticated write privileges across sensitive onboarding, platform-admin, billing, subscription, and payment tables. These grants predate this rollout and were not changed because their effect on shared signup/billing flows and other tenants requires a separate scoped review. RLS remains enabled, but these grants are a residual security-hardening item.
- A focused postflight confirmed all 16 new feature tables have RLS enabled, no `anon` SELECT/INSERT, and service-role INSERT access. Authenticated INSERT is present only on the three estate-content tables and remains constrained by the replacement tenant/permission RLS policies.
- Critical audit, receipt, retry, campaign, service-window, and provisioning RPCs are `postgres`-owned `SECURITY DEFINER` routines with `anon`/`authenticated` denied and `service_role` allowed. `has_real_estate_permission` is the intentional exception: authenticated callers may invoke it for RLS policy evaluation; `anon` and `service_role` are denied.
- Local fictional tenant-neutral suite after filename reconciliation: **194/194 passed**. ESLint on updated tests and `git diff --check` passed. PR CI and Preview still must run against the new branch head.

## Still required before the release is complete

1. Commit and push the exact ledger-version filenames and their updated safe test references to the existing integration branch; do not force-push.
2. Confirm the current-head tenant-neutral PR check and isolated Vercel Preview succeed, and confirm the Maia/dashboard broad jobs remain skipped only for the scoped branch.
3. Merge PR #281 to `main` as authorized by the user, then verify the Vercel Production deployment reaches `READY` on the merge commit.
4. Run post-deploy read-only health checks. Staging remains empty and was intentionally bypassed for this release, so there is no privileged end-to-end staging validation; do not claim that real provider/calendar or Trigger runtime flows were tested.
5. Keep the 42 shared-table grant findings as a separate tracked security item. Do not broaden this release by changing platform-wide grants or excluded-tenant behavior without an explicitly scoped, tested migration.

Trigger deployment/production scheduler status and n8n remain unverified; no Trigger or n8n change was made in this rollout.
