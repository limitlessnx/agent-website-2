# Incremental real-estate production implementation

Preserve the existing Next.js App Router, Supabase canonical properties/customers/appointments/tasks/handoffs, current dashboards and Flux Credits. Work stays on the local repair branch in a deliberately sparse checkout. No new website, copied tenant data, parallel property catalog, independent credit counter, or new external scheduler. No excluded-tenant material is included in the local worktree or tests.

## Current phase state

- **Phase 0 — Diagnose:** baseline and read-only system checks are complete. Live n8n/Trigger execution verification remains unavailable.
- **Phase 1 — Maia/handover:** tenant-safe live property lookup, persisted/idempotent handoff, truthful acknowledgement, protected queue, signed tenant-bound Meta/Twilio receipts, and two-step staff-only retry are implemented and locally tested. Synchronous and callback-triggered error 131047 both use the same one-time approved-template fallback.
- **Phase 2 — Leo/security:** real-estate mutations and legacy inspection APIs require server-bound one-time approvals; replay/tenant tests pass locally.
- **Phase 3 — CRM/calendar/follow-ups/campaigns:** inspection intent, operator-confirmed calendar gating, revisioned reminders, tenant-isolated campaign groups, exact send previews/approvals, Meta service-window rules and delivery projections are covered locally.
- **Phases 4–5 — Property/estate:** canonical property assignment, reusable estate/FAQ/knowledge records and atomic tenant audit writes are implemented locally.
- **Phase 6 — Replication/onboarding:** real-estate-first workspace setup, verification/payment continuity, invitation protections, fail-closed readiness and retry-safe provisioning have local tests. The narrow workspace/trial RPC ACL hotfix is applied to FLUXNIT as migration `workspace_provisioning_acl` (`20261024140349`) and read-back verified; retry-safe provisioning remains unapplied.
- **Phase 7 — n8n:** no live credentials/dependency proof; no workflows or stored data have been changed.
- **Phase 8 — Dashboard:** operations, booking, approval, campaign, estate and handoff recovery views are wired locally; no browser/device review has been run.
- **Phase 9 — Release:** **156/156** scoped tests pass; TypeScript reports 0 diagnostics and the sparse-worktree Next.js build passes with dummy localhost Supabase values; changed-source ESLint has 0 errors and 4 external-image warnings. Same-org Supabase staging contains only non-functional RPC stubs and ACL smoke migrations; no app schema or end-to-end acceptance has been run. The metadata-only review produced a fully commented 42-table/60-policy DDL preview and closed the named FK set, but the preview omits function bodies, triggers and grants and preserves tenant-specific defaults for review. It orders `customer_memories` before policies but is not applied. The `agent_readiness_snapshots`/`agent_runtime_readiness` mismatch remains unresolved; full isolated staging acceptance/release remains blocked.

## Live workspace provisioning ACL finding and remediation

Read-only inspection of the active FLUXNIT project showed `provision_client_workspace(p_user_id, ...)` was a `SECURITY DEFINER` function executable by `anon` and `authenticated`, accepted a caller-supplied user UUID, and did not check `auth.uid()` before delegating organization creation. After explicit approval, migration `workspace_provisioning_acl` version `20261024140349` was applied. Read-back confirmed both workspace and trial provisioning RPCs deny `anon` and `authenticated` and allow `service_role`. No RPC was executed and no tenant rows were changed.

The local ACL migration file is aligned to the applied FLUXNIT version:

1. `20261024140349_workspace_provisioning_acl.sql` contains the applied browser/public revoke and service-role grant.
2. `20261024141200_client_provisioning_retry_safe.sql` adds serialized exact-request retry and safe slug-collision handling; it remains unapplied.

All 14 pending app migration filenames now sort after `20261024140349`, preserving their previous order; the retry-safe provisioning migration is `20261024141200_client_provisioning_retry_safe.sql`. Reconcile staging's independent smoke-test migration history before any Supabase CLI/bulk migration push. The staging ACL test remains an isolated smoke test with non-functional stubs, not the application's schema baseline. The comment-only preview is a possible table-before-policy resolution for the `customer_memories` ordering issue, but helpers/triggers/grants and the readiness-table mismatch remain unresolved; no broad DDL has been applied.

## Handoff retry and receipt design

- Only an active real-estate tenant’s authenticated `handoffs.manage` user sees retry controls.
- A prepare request returns the exact staff-only message, masked destination and short-lived approval; it does not send.
- A separate confirm sends only after the service-role RPC binds organization, user, active membership, handoff, notification, exact message digest and exact recipient. It atomically consumes the approval and claims only a still-open, definitively failed notification.
- Retries are capped at three. Ambiguous acceptance is `unknown`; timeout/5xx/uncertain outcomes require manual verification. Provider code `131047` and any prior approved-template fallback block free-form texting.
- Both the synchronous provider-error path and signed Meta/Twilio receipt path record the fallback attempt before sending the approved `human_handoff_staff` template. Duplicate receipt/retry claims cannot send twice. Template failure remains visible and is not represented as success.
- Signed callbacks bind to the organization resolved from Meta phone-number or Twilio account configuration. Receipt updates are monotonic, tenant/provider-ID scoped and preserve sanitized provider error codes.
- Ordered shared-schema migrations are `20261024141300_handoff_notification_receipt_states.sql`, `20261024141600_handoff_notification_retry_safety.sql` and `20261024141700_handoff_notification_retry_approvals.sql`. They remain unapplied and require cross-tenant compatibility review.

## Calendar and reminder flow

1. Maia/customer intent creates an auditable request; an inactive/missing property is not guessed.
2. An authorized operator verifies the live property, local date/time/timezone and calendar resource, then confirms the exact slot.
3. The canonical appointment stays pending until an external event ID and matching provider confirmation exist.
4. Only confirmed bookings schedule revision-keyed reminders. Reschedules/cancellations invalidate stale jobs; opt-out, customer reply, handoff, stale appointment and entitlement checks suppress unsafe sends.
5. The app-owned dispatcher uses the existing authenticated scheduler bridge and only tenant IDs returned by the audit-backed opt-in registry. The registry defaults off. Live scheduler cadence/credentials are unverified.
6. Provider acceptance, delivery and read receipts remain distinct statuses.

## Validation and boundaries

`npm run test:real-estate` passes **156/156** tests. Focused handoff retry/callback/template-fallback coverage passes **29/29**. PGlite executes the local provisioning, calendar, campaign-group, receipt and retry-approval migrations against fictional records; route/UI/provider behavior is mocked. TypeScript reports **0 diagnostics** and the optimized Next.js build succeeds in the exclusion-preserving sparse worktree with dummy localhost Supabase settings. Changed-source ESLint reports **0 errors / 4 external-image warnings**. The isolated staging ACL smoke check passed on non-functional stubs; no provider message or broad application migration was applied.

The local type/build checks now pass for the checked-out sparse project. This does not validate excluded source, Vercel environment configuration, mobile/desktop rendering, live scheduler/provider behavior, or production acceptance. Four remaining lint warnings are dynamic external-image `<img>` uses; no image-host configuration was introduced.

The isolated staging project is active but ACL-smoke-only; no tenant/customer data or app schema is present. The comment-only DDL preview is a review artifact and has not been applied. Only the narrow FLUXNIT ACL migration changed production database privileges; no tenant rows changed. No broad app migration, GitHub push/merge, Vercel/Trigger deployment, real-client/staff send or n8n cleanup occurred. The application branch remains local, uncommitted and unpushed. See [REAL_ESTATE_REVIEW.md](REAL_ESTATE_REVIEW.md), [STAGING_BASELINE_REVIEW.md](STAGING_BASELINE_REVIEW.md), [STAGING_BASELINE_MANIFEST.md](STAGING_BASELINE_MANIFEST.md), [STAGING_BASELINE_DDL_PREVIEW.sql](STAGING_BASELINE_DDL_PREVIEW.sql), [TODO.md](TODO.md) and [BRANCH_HANDOFF.md](BRANCH_HANDOFF.md) for current evidence and handover.
