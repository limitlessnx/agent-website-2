# Phase 7 increment — wallet availability and preflight boundaries

Base: production main ff6b6716816936c90fb245585ddbe658991a88e3, containing approved PR #430. Work is isolated on feat/phase7-wallet-availability.

## Architecture and demonstrated defects

Fluxknight already has plan definitions, feature gates, a shared wallet summary, metering adapters, subscription synchronization, a row-locked debit RPC, top-up handling and billing views. This increment reuses them. No prices, plan names, rates, wallet balances, subscription agreements, schema or provider settings are changed.

The application wallet summary considered only status=paused to be inactive. Suspended/cancelled wallets with a positive balance could pass both metering preflight adapters and reach the actual provider-execution handler before the existing database debit RPC rejected consumption. Unknown statuses were also allowed by that application check.

The same summary used a rounded integer usage percentage as an exhaustion gate. For example, 2 remaining credits from a 12,000-credit allowance rounded to 100%, pausing a wallet that could still fund the existing 2-credit Web AI unit.

The unchanged-source baseline produced five failing cases: suspended, cancelled, pending and unexpected statuses reached the synthetic provider boundary; the final affordable action did not. Paused, normal funded, expired-trial and other existing protections were exercised alongside them.

## Change

Only lib/flux-credits.ts changes application behavior:

- Only existing active/trialing wallet states may authorize chargeable work.
- Balance and trial expiry determine exhaustion; a display percentage is not a financial gate.
- Positive balances display at most 99% used, reserving 100% for exhaustion and retaining a low-balance warning.
- Requested-action affordability, free-trial restrictions and existing feature entitlements remain enforced.
- Inactive wallets remain readable. No tenant workspace/session/data access rule changes.

The existing core and HTTP metering adapters both delegate to this shared helper. No second quota system, new API or replacement billing service is introduced. The provider route is tested but not modified.

## Tests and files

tests/flux-wallet-preflight.test.cjs adds 14 behavioral cases using the actual plan/wallet helpers, both metering adapters and the existing provider-execution route. All database/provider boundaries are synthetic. The provider stub stops before execution/metering; no real provider request or credit charge is made.

Coverage includes paused/suspended/cancelled/unknown states, active/trialing wallets, the last affordable unit, insufficient and exhausted balances, expired/valid trials, paid-only feature gates, top-up-funded balances, unavailable wallet data and existing runtime-secret/tenant checks.

The exact proposed source and test bytes passed in-memory execution: 14 passed. Baseline: nine passed and five failed, reproducing provider reachability and premature exhaustion. Changed-source/test lint has no errors; the existing unused planFromSubscription helper produces one warning.

The existing Monthly Billing Verification workflow runs the new cases and changed-module lint and now watches the wallet/metering paths. The existing Dashboard Final QA workflow also watches wallet and regression-test changes, retaining the six-width browser gate. No duplicate workflow or test shell is added.

The refreshed master roadmap distinguishes released implementations from outstanding full-phase acceptance. Final exact-head hosted build/types, billing/database/permission/regression and responsive results are recorded in the PR.

## Verification limits

The local workspace remains disk-constrained after the prior optional Docker test attempt. This increment uses in-memory test/lint execution, isolated GitHub tree/branch publication and existing hosted CI/build environments. No local full build is claimed. The existing checkout's staged work is preserved; no repository/history reset or shared database-volume cleanup is performed.

There is no new layout, style or animation. Hosted rendered fixtures do not constitute authenticated customer/provider acceptance or a newly approved visual baseline.

## Remaining Phase 7 work

This fixes wallet availability gates, not all commercial accounting. Source audit still finds provider paths that check funds before work but debit afterward; a function named reserveFluxCredits currently calls the existing consumption RPC rather than creating a durable pre-execution hold. Inventory each billable unit/channel and reuse existing accounting primitives before designing any necessary atomic hold/settle/release increment. Validate duplicate/concurrent requests and failure compensation without customer charges.

Do not silently reprice plans or assume examples named in the master brief replace the approved Basic/Plus/Business/Business+ configuration. Historical usage-period reporting, spending visibility, billing-read permission parity and every channel's final units remain acceptance topics. No historical ledger backfill, refunds, credits or subscription changes are included.

## Release authorization

The user granted ongoing approval to test and deploy completed work. Once the candidate's required exact-head gates pass, this increment may be merged and deployed without another permission round. Deployment and read-only post-release results must be verified and recorded; approval does not make untested phases complete.

No real communications, paid calls, customer-data changes, migrations or provider activation are used for testing.
