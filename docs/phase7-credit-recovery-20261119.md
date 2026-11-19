# Phase 7 — evidence-based reservation recovery

Base: released main aaf05ea18369e0ee9427df2b2c9b61f5e856614e (PR #433). Isolated branch: feat/phase7-credit-recovery. Latest main/open PRs were reviewed before editing; unrelated voice/social/industry branches are preserved.

## Architecture audit and scope

Existing flux_credit_wallets, flux_credit_reservations, consumption ledger, runtime result/usage/progress records and audit_logs remain authoritative. finish_flux_credit_capacity already locks the wallet, settles idempotently and protects plan/period eligibility. Calling it directly from an administrator form would omit proof validation and atomic administrator audit. Older records also lack a reservation identifier linking completion evidence.

This increment adds proof fields to new internal Web AI executions, a narrowly scoped invoker reconciliation RPC, an authorized same-origin administrator endpoint and a recovery section in the existing purple billing page. No new financial system, provider replay, automatic expiry, credit release, customer communication or plan/rate change is introduced. Unknown or incomplete outcomes remain held/reviewable.

## Safety contract

The RPC locks the organization, existing wallet and reservation, preventing an archive-state change during reconciliation. It only supports the current two-credit Web AI unit from phase12_provider_runtime for active organizations. A single succeeded model request must match the organization/execution key, reservation UUID, canonical request fingerprint and provider response identity, with completion after reservation creation. A single usage record and provider-completed progress record must match those identifiers, provider and token quantity. The saved modeled cost must match the existing one-cent provider-cost unit. Duplicated, missing, stale, foreign or conflicting evidence blocks settlement.

Existing finish_flux_credit_capacity then enforces the original billing period/plan and wallet/trial eligibility and performs the actual debit. Repeats return the settled result without another debit; released reservations cannot be charged. Blocked/settled/review outcomes and the initiating administrator identity/reason are written to existing audit_logs in the same transaction. Audit insertion failure rolls back the debit, history and reservation change together. Legacy administrator sessions retain email attribution; account sessions additionally record their verified user UUID. No browser-supplied actor identity is trusted.

Only service_role can execute the new invoker RPC, which uses an empty search_path. The API requires the existing verified platform admin session, same-origin request, scoped UUIDs, 15–500 character reason and explicit confirmation. Public responses expose only safe outcomes; provider payloads, prompts and raw diagnostics are not sent to the form. The form shows the selected organization's oldest 20 unresolved holds, explicit read failures, processing/blocked/verified feedback and refresh instructions. Existing tenant permissions/routing are not merged with platform access.

## Files and reasons

- supabase/migrations/*_flux_credit_reconciliation.sql: atomic proof validation, existing settlement/audit, service-only grants and organization/execution lookup indexes. Indexes avoid broad scans under the financial lock; none replaces existing organization/time indexes. Migration uses 5-second lock and 60-second statement limits to fail safely if production is busy. No existing data/backfill is changed.
- app/api/internal/runtime/provider/execute/route.ts: persist reservation UUID/fingerprint, current modeled cost/token quantity and response references in actual completed result/usage/progress records. Billing units and provider behavior remain unchanged.
- app/api/admin/billing/reservations/route.ts: administrator authorization, CSRF/confirmation/validation, server identity, sanitized outcomes and precise recovery blockers.
- app/dashboard/billing/CreditReservationRecovery.tsx, its scoped CSS module and page.tsx: reuse existing purple billing surfaces and form styles for the tenant-scoped queue/action. No navigation, agent or industry dashboard rebuild.
- tests/helpers/flux-recovery-database.cjs and tests/flux-credit-recovery-database.test.cjs: isolated fixtures and lifecycle/evidence/grant/eligibility/audit rollback cases.
- tests/flux-credit-recovery-api.test.cjs: session, same-origin, input/confirmation, server identity, safe repeat and error/tenant checks.
- tests/flux-credit-capacity-runtime.test.cjs: verify actual provider persistence carries matching proof and unchanged consumption.
- tests/flux-credit-capacity-concurrency.test.cjs: extend existing disposable PostgreSQL pipeline with independent recovery/audit-failure sessions.
- tests/phase4/start-fixture.cjs and control-center.spec.ts: extend existing rendered six-width harness with recovery confirmation, pending/blocked/success and unavailable queue states. Writes/providers remain synthetic/local.
- .github/workflows/monthly-billing-verification.yml: extend existing financial tests and scoped lint, keeping the existing independent PostgreSQL service.
- supabase/migration-ledger.production-snapshot.json and tests/supabase-migration-ledger.test.mjs: reconcile only the actual verified migration registration; other pending work remains pending.

## Verification

Initial isolated SQL run found a test-fixture row-lock permission omission; production metadata already grants the required UPDATE privilege. The fixture now mirrors that privilege without changing production grants. An initial browser assertion followed the changing button label and lost its locator during processing; it now targets the stable submit control. These failed attempts are not counted as passes.

Local evidence before publication: 25 SQL cases, 15 API authorization cases and 14 provider-runtime cases passed in their respective runs. Twelve targeted browser cases passed at 360, 430, 768, 1024, 1440 and 1920px. The provider-runtime/API suites are rerun after final proof validation refinements. Exact-head lint/types/build, broad regressions, independent PostgreSQL concurrency and full responsive results are recorded in the PR before release. No real customer communications, provider calls or test credit charges occur.

Rendered fixture screenshots use recovery-blocked, recovery-settled and recovery-unavailable names under docs/phase4/after at each width. They are after-change synthetic captures, not approved visual baselines, before/after comparisons or authenticated production acceptance. Existing card/form styles are reused; no significant design-system restructuring or new 12ui reference is claimed.

## Rollout and rollback

The migration was generated with the installed official Supabase CLI. Apply only its reviewed exact SQL after first candidate gates pass, read actual remote registration back, reconcile local filename/snapshot without rewriting remote history, and revalidate the final candidate before application release under standing approval. No live reservation is reconciled as part of deployment/testing. Verify RPC grants/invoker configuration, indexes and migration registration; then verify merged source tree, Vercel READY/domain assignment and read-only production authorization responses without following redirects.

Previous application versions continue using the existing wallet/settlement functions. If the new action must be disabled, stop the new route/UI; retain all reservations, evidence, audits and financial ledger entries. Never drop evidence or automatically release unknown holds. No customer data cleanup/backfill is part of rollback.

## Remaining limits

Older holds without the new proof links and executions with partial persistence remain in review. This RPC does not repair missing result/usage/progress records or accept an operator's assertion in place of proof. Provider failure/absence evidence is still required before any future release control can be considered. Other billable channels, historical/period reporting and designated authenticated/live-provider acceptance remain Phase 7 work. The current work does not mark the full master roadmap complete.

Screenshot review identified an inherited oversized checkbox style in the first candidate. The recovery form now scopes its checkbox to the existing 20px control geometry and purple brand token, keeping a 44px label target. A browser assertion checks its dimensions at all six widths; final release checks run on this refined source.

## Reviewed candidate and schema registration

Candidate fd4197578e7b29d1ba788706b253c8a2f0057ece passed Monthly Billing Verification 44534467291, Maia Draft Verification 44534467221 and Dashboard Final QA 44534467317. Hosted PostgreSQL ran the independent concurrent recovery/audit-failure cases successfully. Browser logs report 132 passing cases, including recovery at all six widths. Preview dpl_bKk1JXwfFgc5XaQZPFGWZt8ooHHW was READY; direct HTTP access redirects to Vercel SSO (302), so authenticated preview acceptance is not claimed. Local final recovery browser cases passed 12/12; support suite 656/656 and build passed.

After these gates, apply_migration succeeded. Readback verified actual registration 20261119134520 / flux_credit_reconciliation, function body MD5 cc7df6518c35b73c7383dc522829408b, invoker/empty search_path, anonymous/authenticated denial and service execution, both composite lookup indexes and unchanged debit MD5 cad92f4730562aa51d724a20b217effb. The CLI-generated migration file was renamed to its actual registration with identical SQL SHA256 1f50fadcc92293da76c2b031760284bc785b5bfa447e832837cc4af90afe56fb; remote history was not rewritten. The migration created schema/index objects only; no live reservation was reconciled, no customer row was seeded/backfilled and no provider was called.

The registration/documentation-only follow-up is revalidated on its exact commit before application merge/deployment. Actual final runs, merge tree, production deployment and read-only post-release evidence are recorded in the PR after they occur.
