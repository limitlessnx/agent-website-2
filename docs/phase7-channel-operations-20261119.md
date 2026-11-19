# Phase 7 channel operations and billing-period reporting

This increment extends the existing wallet/reservation/ledger lifecycle. It does not create another billing system or change prices. Base: main `cc06911` (PR #434). Open/draft PRs, including #418, #411 and the separate disabled-by-default Gencouv email adapter #436, were inspected; their provider transport changes are not incorporated.

## Current architecture and corrected defects

Previously, several AI/reminder consumers checked capacity, dispatched, and only then debited. Concurrent requests could pass the same balance check; settlement failure left no durable operation identity. Campaign drafting and installment reminders instead debited before provider work, including failed calls.

`lib/flux-ai-operation.ts` composes the existing reserve and finish RPCs. A tenant-scoped operation key and canonical request fingerprint permit only the newly created hold owner to dispatch. Model failures/definite provider rejections release capacity; unknown delivery retains it. Observed completion is recorded before settlement. Accounting failure after completion never requests another provider dispatch. Agent, execution, session, task and reminder references are preserved in completion/ledger context without storing prompts, SDP, credentials or message contents. Repeated operation IDs with changed inputs fail closed. Terminal released operations require a genuinely new attempt identity; a retry never reuses the old dispatch.

Adopted consumers: tenant Leo chat/support, Maia model steps, campaign writeup, internal agent execution, administrator live agent tests, inspection/handoff/installment/appointment reminders, and tenant Leo realtime call acceptance. Existing public/admin Leo unbilled behavior and industry/permission guards remain intact. Appointment reminders use the persisted event and target IDs, not a shared conversation correlation ID. Concurrent handoff observers cannot overwrite the dispatch owner's task result.

Stable IDs come from executions, tasks, attempts, events and supplied message IDs. The updated interactive clients send an operation ID per explicit action. Legacy HTTP callers without an ID receive a new attempt ID; they must supply/reuse an ID to obtain transport-retry deduplication. Production callers do not cache provider responses in reservation metadata. Repeating a settled request without a cached result returns explicit review/refresh feedback rather than rerunning downstream actions.

## Rates and channel boundaries

| Consumer | Existing unit preserved | Lifecycle in this increment |
| --- | --- | --- |
| Maia | 2 credits per reasoning step, including WhatsApp | Hold then settle each successful step |
| Tenant Leo chat/support | 6 credits per model response | Hold then settle |
| Campaign/internal/admin-test model work | 2 credits per completion | Hold then settle |
| WhatsApp reminders | 3 credits per accepted submission | Unknown outcomes retained; no fabricated delivery receipt |
| Leo OpenAI realtime | 20 credits per call acceptance | Existing single-unit behavior preserved; measured-duration billing is not certified |
| Maia WhatsApp live calling | Existing call-start charge | Separate accepted-media/sideband work, unchanged here |
| Outbound email / voice receptionist runtime | Existing downstream outcome charges | Not migrated here; provider-to-receipt ownership/partial-persistence recovery remain open |
| ElevenLabs signed post-call receipt | Existing measured rounded-minute atomic receipt | Preserved unchanged |

The user explicitly selected **keep the current 2-credit reasoning-step policy for this release**. The catalog's separate 4-credit WhatsApp action is not applied silently. Provider costs in the ledger include modeled amounts, not independently verified provider invoices.

## Recovery and reporting

The migration adds no tables and replaces only the existing service-role/invoker reconciliation function after an exact previous-body hash check. Its original Phase 12 result/usage/progress evidence requirements remain. New whitelisted operation sources can recover from a server-written SHA-256 completion envelope bound to organization, reservation, fingerprint, source, action, amount and cost. Unknown/incomplete evidence remains blocked. Operator confirmation alone is insufficient. Debit, state and initiating administrator audit commit or roll back together. No provider is replayed and this endpoint never refunds/releases capacity.

`get_flux_credit_period_usage` aggregates every usage debit within the wallet's half-open billing-period bounds, excluding top-ups and other tenants. Existing calendar-month APIs retain compatibility. Admin history/cost breakdowns are now labeled as the latest 5,000-row sample; current-period totals are separate. Tenant API output includes period/count/credit totals only, excluding internal costs and margin. Unavailable period evidence remains explicit.

## Verification and limitations

Results and release links will be appended after checks finish. Browser tests use the real rendered pages against a local synthetic read-only database boundary. They are not live authenticated customer acceptance or approved visual baselines. No provider calls, customer communications or test charges are authorized by these fixtures.

The user designated **News** (`9f1e02e2-2412-446d-87f3-b0862b0c5e48`) for non-customer acceptance. Read-only lookup confirmed the organization. Connected authenticated browser access is unavailable in this workspace; owner/manager acceptance is still open. No production session is forged and no News/customer records are modified to simulate it.

Phase 7 as a whole remains open for coordinated email/voice receipt adoption, measured OpenAI duration policy/verification and authenticated News acceptance. Passing this increment's tests is not proof those gates are complete.

## Local verification recorded

- Broad support/Maia/real-estate/campaign/billing/hotel/team/manager regressions: **1,120 passed, zero skipped** across 156 files. Focused follow-up contracts cover subsequent metadata/UI-only refinements: **49 passed** for campaign, billing field allowlist, metering and support security contracts.
- Existing financial SQL/runtime/preflight/recovery/visibility regression: **101 passed, zero skipped**. An earlier combined run lost the recovery test child while browser/SQL workloads overlapped; it was rerun alone (25 passed), followed by the successful full sequential 101-case run.
- Actual new operation boundary plus public billing visibility: **36 passed**, covering concurrent duplicate dispatch, hash/input/scope conflicts, release vs uncertain delivery, durable completion recovery, altered proof fields, audit rollback, service-only grants, period boundaries and more than 5,000 usage rows. Core financial tests use PGlite, not a production wallet.
- Changed-module ESLint: **zero errors, four pre-existing warnings** (unused support prop/helper and two voice hook dependency warnings). TypeScript passed. The optimized local production build passed; exact release-head hosted checks are recorded in the PR.
- Six-width rendered billing tests: **12 passed** (admin and tenant at all six widths), including explicit unavailable feedback. See [visual evidence](phase7-channel-evidence/README.md). The first two browser attempts exposed test-harness locator/fixture-port mistakes; those failed runs are not counted as passes. Visual inspection then identified and corrected the separate metric/list spacing defect.
- Hosted financial CI includes independent PostgreSQL sessions: concurrent settlement happens once, and every failed audit rolls back billing. No local PostgreSQL binary is installed, so independent-session verification is hosted rather than claimed as a local run.

## Rollback and remaining acceptance

The schema change is additive for older application code: an extra read RPC and an extended existing recovery function. Code rollback can restore the prior Vercel deployment while retaining all holds, ledger and evidence for review. Do not delete reservations or fabricate refunds as a rollback. The previous reconciliation definition remains in migration history; replacing it requires explicit reviewed schema rollback. The existing debit function is unchanged.

PR: https://github.com/limitlessnx/agent-website-2/pull/437. Production registration, exact release head, preview and deployed status will be recorded only after verification. This increment does not close the remaining channel/authenticated acceptance gates above.
