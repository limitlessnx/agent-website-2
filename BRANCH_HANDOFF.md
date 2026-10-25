# Limitless Realty release checkpoint

**Updated:** 25 October 2026, 22:20 Europe/London

**Integration branch:** `integration/limitless-realty-production-20261025`

**PR:** [#281](https://github.com/limitlessnx/agent-website-2/pull/281), open against `main`

**Last pushed branch head:** `de5a107`; the local migration-ledger reconciliation and permission-scope test changes are not yet pushed.

## Production database rollout

At the user's explicit direction to bypass staging, 21 feature migrations plus one narrow real-estate permission-scope migration were applied to FLUXNIT. The actual Supabase versions and matching local filenames are recorded in [the Production rollout report](PRODUCTION_ROLLOUT_STATUS_2026-10-25.md). The 42-table/60-policy/core-helper preflight returned zero findings. A focused postflight confirmed all 16 new feature tables exist with RLS enabled, no anon SELECT/INSERT, and service-role INSERT. Critical service-only RPC grants were confirmed.

The supplemental catalog check found 42 pre-existing broad grants on shared platform dependencies (24 anon privileges and 18 authenticated write privileges on onboarding/admin/billing/payment tables). These were not changed in this real-estate rollout because modifying them can affect shared signup/billing flows and other tenants; they need their own scoped review. No customer-row content was copied or exposed; checks were catalog metadata plus aggregate status counts. No message, calendar event, or notification was sent.

## Code branch and validation

The tenant-neutral real-estate suite passes **194/194** locally after migration filename reconciliation. The changed CommonJS tests pass ESLint with the repository's `no-require-imports` rule disabled for those files; ESM tests lint cleanly, and `git diff --check` passes. Because the migration filenames and test references are now changed locally, the current worktree still needs its exact-head GitHub safe check and isolated Vercel Preview after commit/push. The last pushed code-bearing checkpoint had a READY build-only Preview; it does not prove backend runtime behavior.

Vercel Production remains on `main` at `3521ed4`; application code has not been merged or deployed. PR #281 remains open. Once the local ledger filenames, tests, and rollout evidence are committed and pushed, the remaining release path is exact-head safe checks, Preview READY, merge PR #281 as authorized, then verify the Production deployment and run read-only health checks.

## Staging and operational limits

Staging project `rwewcnftxnaynpotbsms` remains empty of application tables; staging was intentionally bypassed for this rollout and no staging DDL was applied. This means privileged staging E2E for onboarding, inspection/calendar, handoff/retry, reminders, campaigns, Trigger scheduling, and provider receipts has not been performed. Trigger deployment/status and n8n remain unverified; no n8n change or real provider send occurred.

Strict excluded-tenant boundary preserved: no Xposure source, configuration, or customer records were read or changed.

## Evidence

- [Production rollout ledger and post-checks](PRODUCTION_ROLLOUT_STATUS_2026-10-25.md)
- [Detailed real-estate review](REAL_ESTATE_REVIEW.md)
- [Staging baseline review](STAGING_BASELINE_REVIEW.md)
- [Read-only baseline preflight](STAGING_BASELINE_PREFLIGHT.sql)
- [Read-only dependency preflight](STAGING_BASELINE_DEPENDENCY_PREFLIGHT.sql)
- [Auth-core candidate, not applied](STAGING_BASELINE_AUTHZ_CORE_DRAFT.sql)
