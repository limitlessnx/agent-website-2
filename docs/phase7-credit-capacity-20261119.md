# Phase 7 — atomic Web AI credit capacity

Base: main a2c026dc8c77a7000e262bae988226c57ab1a1b3 (released PR #431).
Branch: feat/phase7-credit-capacity. Scope: first bounded adoption, not completion of Phase 7.

## Existing architecture and accounting unit

The existing flux_credit_wallets, flux_credit_ledger, plan gates, subscription synchronization and record_flux_credit_usage remain authoritative. The existing reserveFluxCredits helper actually debits; it is retained for compatibility. New capacity helpers distinguish holds from actual consumption. The internal Web AI provider execution retains its existing two-credit successful-invocation unit and modeled cost. Email and voice retain their downstream accounting.

A reservation is not consumption, a charge or a second wallet. Holds reduce available capacity; settlement calls the existing debit RPC transactionally once. Release frees a hold without inventing a refund or ledger credit.

## Implementation and safeguards

The new service-only reservations table records organization, execution key, canonical request fingerprint, action, fixed credits, plan/period snapshot, provider references and transition history. It stores no prompts or credentials. RLS and revoked anonymous/authenticated privileges protect it; the three new RPCs are security invoker with empty search_path. Existing tenant/execution/runtime-secret checks precede provider dispatch.

The wallet row serializes reservation admission, settlement, release and legacy consumption. The existing debit RPC now respects all held/review capacity. Shared preflight also reads reserved/available capacity and fails closed when evidence is unavailable. This prevents older preflights treating held credits as free, but does not make every older provider check/debit sequence atomic.

Only the request that creates a hold may dispatch or reconcile it. Repeated execution keys with conflicting input fail. Equivalent reordered JSON has the same fingerprint. Duplicate in-progress/released/review requests do not dispatch or release another request's hold. Settled retries return the persisted result even at zero balance or after suspension; missing stored results fail closed.

Provider exceptions release the hold under the existing success-only billing rule and leave that execution terminal. A new explicit execution is required for a new attempt. When the provider returns but persistence/settlement is uncertain, capacity remains held or needs_attention, with no automatic refund, redispatch or false success. A missing prepared result row is a persistence failure. Settlement detects plan/period changes and inactive wallets rather than charging a changed agreement. Debit failure rolls back provisional settlement and consumption together.

## Files

- lib/flux-credits.ts: availability-aware shared preflight and scoped capacity helpers.
- app/api/internal/runtime/provider/execute/route.ts: Web AI claim, durable result checks, settle/release/review and cached retries.
- supabase/migrations/*_flux_credit_capacity.sql: capacity table/RPCs and compatible legacy debit guard.
- tests/helpers/flux-capacity-database.cjs: isolated SQL fixture using existing schema/accounting.
- tests/flux-credit-capacity-database.test.cjs: SQL lifecycle, tenant/grant/plan/period and rollback behavior.
- tests/flux-credit-capacity-runtime.test.cjs: actual route/shared helper with synthetic providers and isolated SQL.
- tests/flux-credit-capacity-concurrency.test.cjs: independent PostgreSQL sessions against a dedicated disposable localhost database.
- tests/flux-wallet-preflight.test.cjs: retained wallet cases plus held/unavailable capacity boundaries.
- supabase/migration-ledger.production-snapshot.json and tests/supabase-migration-ledger.test.mjs: actual verified migration registration; no other pending migration is marked applied.
- .github/workflows/monthly-billing-verification.yml: extend existing financial pipeline, including independent PostgreSQL concurrency.

## Verification and deployment gates

All automated providers/data are synthetic. No customer communications, provider calls or customer charges are used for testing. SQL cases, route cases, shared wallet preflight, lint, support regressions, types/build and exact-head hosted billing/concurrency/responsive checks must pass before release. The independent PostgreSQL case is not certified by PGlite's single connection; hosted PostgreSQL runs it explicitly.

No UI/style changes are included. Existing six-width synthetic browser coverage is regression evidence, not authenticated live acceptance or newly approved screenshots. Exact run/deployment evidence is recorded in the PR.

## Migration rollout and rollback

The migration was generated with the official Supabase CLI 3.2.0. It requires the known existing debit function body MD5 a43e1354c80b13d48424bd9684f49761 (or its already-patched cad92f4730562aa51d724a20b217effb). Drift fails before changes. Transactional DDL adds no seeded customer rows and performs no balance/history backfill.

After reviewed exact-source checks pass, apply only this migration with apply_migration. Read back the actual migration registration, reconcile the local filename/snapshot to that registration without rewriting remote history, and re-run exact-head gates before application release. Empty capacity infrastructure remains compatible with previous main. Do not push the entire historical migration directory.

Rollback must preserve holds, actual debits and provider evidence. Stop new adoption if necessary; never drop financial evidence, automatically expire unknown holds, replay completed providers or restore a debit function that ignores existing holds. Reconcile only with verified provider/result/accounting evidence.

## Remaining scope

Other billable channels still need measured unit inventory and incremental atomic adoption. Reserved/available customer-facing spending visibility, explicit authorized recovery UI/jobs for crash/unknown outcomes, period-transition acceptance and designated authenticated/live-provider acceptance remain open. Holds have no automatic expiry because elapsed time is not evidence of provider failure. This increment does not close all master phases.

The user has standing approval to test, merge and deploy verified completed increments. Production application/schema status is reported from actual release readback; authorization alone is not verification.

## Reviewed source and schema evidence

Candidate 8d6af77e02983e1ac70ba2db7d08439417cc6a06 passed Monthly Billing Verification run 44485574737, Maia Draft Verification 44485574739 and Dashboard Final QA 44485574741. Vercel preview dpl_99W5xX2wS3jFD5C17Luh7FQfz64b was READY. Dashboard browser logs record 108 passing synthetic cases at all six widths; this is not authenticated live acceptance or visual baseline approval.

Local evidence: 12 SQL cases, 30 runtime/wallet cases, 27 billing regressions, 656 support cases, four migration-ledger checks and production build passed. Changed-module lint has zero errors and one pre-existing unused planFromSubscription warning. Hosted billing independently passed 16 wallet cases, 26 SQL/runtime cases, renewal concurrency and the new independent PostgreSQL capacity test, plus types/build.

After these gates passed, apply_migration succeeded. Production readback reports actual registration 20261119082208 / flux_credit_capacity. The CLI-generated file was renamed to that actual registration with identical SQL bytes (SHA256 ed2d43cf910a77a9626708342960aea91e8441b22a874410a97b5593be1aafd3); remote migration history was not rewritten. RLS is enabled, anonymous/authenticated table reads and new function execution are denied, all three new functions are invoker with empty search_path, service execution is granted, and the existing debit body is the reviewed patched MD5. No customer wallets, subscriptions or history were backfilled or edited by the migration.

The registration/snapshot-only follow-up must pass exact-head checks and produce a READY preview before merging. Production schema is now extended; application release and read-only post-release checks are recorded in the PR after actual deployment. Existing prior advisory groups are outside this bounded change; the service-only reservations table intentionally has no client RLS policies.
