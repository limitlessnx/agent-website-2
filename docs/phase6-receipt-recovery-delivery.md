# Phase 6: reliable ElevenLabs receipt recovery

Base: `bfa3e0bd6af07a79bc7df6bb97f0fa9986ca0f97`, latest main inspected before implementation and publication. Branch: `feat/phase6-unified-communications`; existing draft PR #427 is extended in place.

## Behavior and architecture

The old receipt adapter returned 200/duplicate after a prior failed processing attempt. Its separate credit recording and `metered_at` update also left a retry window for duplicate debits. Retrying that route without an atomic boundary would be unsafe.

Matching unprocessed receipts now resume. Completed receipts return successful duplicate acknowledgment. Conflicting content under the same identity is rejected; ordinary JSON property reordering remains compatible. Invalid/stale HMAC signatures are rejected before database work. Missing provider identities, ambiguous mappings and conflicting organization hints cannot select a default tenant or agent. The first server-verified organization binding is preserved even when later reads or commercial preflight fail.

One proposed service-only, security-invoker RPC uses the existing receipt row lock and a per-provider-call transaction advisory lock. It rechecks and holds the configured agent mapping, verifies original payload identity, writes the existing conversation/call/handoff records, calls the existing `record_flux_credit_usage`, writes the metering marker and commits completion together. Different event keys for the same call share that boundary. A lost HTTP response cannot overwrite committed completion; interrupted database transactions roll back and release their locks. No additional queue, event table, lease fields or billing service is introduced.

The existing central application preflight computes the usage quote and enforces the voice entitlement. The transaction rejects a changed wallet plan and uses the existing wallet/ledger function for actual settlement. Rates and first-positive-duration settlement behavior remain unchanged. Already-metered calls do not debit again. Existing failure/handoff evidence and transcript/summary/analysis survive later sparse receipts; human-paused/archived conversation state is preserved.

Errors distinguish invalid input/signature, tenant mismatch, conflicting replay and retryable processing unavailability. Responses and failure evidence use safe messages rather than raw database/provider details. If the new RPC is absent, the adapter fails with retryable 503 and never falls back to non-atomic billing.

## Changed files and reasons

| Files | Purpose |
| --- | --- |
| `app/api/webhooks/elevenlabs/post-call/route.ts` | Existing authenticated adapter: accurate replay states, server-resolved tenant binding, safe failures and one atomic persistence call. |
| `supabase/migrations/20261118163533_elevenlabs_voice_receipt_atomic_recovery.sql` | CLI-generated proposed migration adding one invoker RPC with service-only execution; explicit foundation prerequisite. No existing roles, data or pricing are rewritten. |
| `tests/elevenlabs-receipt-runtime.test.cjs` | Actual route/helper with synthetic HMAC and database boundaries; failed replay, completed duplicate, binding drift, changed content, malformed input, missing migration and lost-response recovery. |
| `tests/elevenlabs-receipt-database.test.mjs`, `tests/helpers/elevenlabs-receipt-database.mjs` | Execute the real proposed SQL and existing foundation/credit function in PGlite, including rollback, isolation, record retention and grants. |
| `tests/elevenlabs-receipt-concurrency.mjs` | Independent real PostgreSQL sessions: same-event competition, distinct events for one call, interrupted transaction and mapping change. Refuses non-test database targets. |
| `tests/phase-7-elevenlabs-voice-runtime.test.mjs` | Preserve existing contract checks at the new atomic persistence boundary; actual behavior is additionally exercised by runtime/database tests. |
| `tests/supabase-migration-ledger.test.mjs` | Explicitly list only the new proposed version as pending. Production ledger/snapshot remains untouched. |
| `package.json`, `.github/workflows/maia-draft-verification.yml` | Register focused tests in the existing Maia command and add isolated PostgreSQL concurrency verification to its existing workflow. No duplicate communications pipeline. |
| Audit/delivery docs; retired ad hoc diagnostic | Replace the diagnostic that intentionally reproduced the defect with regression coverage and an accurate implementation/release record. |

## Verification

- Initial baseline runtime: 10 failures / two passes, demonstrating the original behavior against the first 12 regression cases.
- Final runtime: **13/13 passed**; database behavior: **10/10 passed**; existing voice contracts: **5/5 passed** (28 targeted cases total).
- **Four real PostgreSQL scenarios passed**, covering same-event retries, separate events for one call, termination after uncommitted settlement and an agent mapping writer blocked until commit. Each retry scenario preserves one committed debit/handoff.
- Maia: **25 test files passed**; support: **604 cases passed**; billing: **27 cases passed**; migration-ledger checks: **4/4 passed**. Counts reflect the actual runner summaries, not estimated nested totals.
- Final changed-file ESLint, type checking and production build passed. Whitespace validation preserves the existing CRLF workflow/ledger format. Historical whole-repository lint debt remains.
- Hosted CI and preview results are recorded in the PR description for its exact head; local success is not substituted for a pending hosted check.

Logs: `/tmp/phase6-*.log`. All records/wallet debits in tests are synthetic. Authentication uses a synthetic secret; no credential was retrieved or published. PostgreSQL ran inside a network-isolated local test container with a separate empty `receipt_test` database. A fresh container initially exceeded local disk capacity; the existing isolated test instance was reused without changing its other databases.

This is a backend-only change. No UI/screenshot baseline is changed, and no new authenticated hosted or visual acceptance is claimed. Existing public preview/login reachability does not prove a functioning voice provider connection.

## Deployment prerequisites and limits

Read-only production metadata confirms the two ElevenLabs call/receipt tables are absent, while conversations, handoffs and the existing credit function are present. The recovery code is not deployed and no database change was performed.

Before a future release, review the existing `20261012090000_phase7_elevenlabs_voice_runtime.sql` foundation, including its RLS/grants and actual schema prerequisites. Then review this increment's `20261118163533` function migration and apply only the exact approved prerequisites in order. Do not push the historical migration directory or mark an unapplied version as deployed. Run hosted schema/grant/advisor checks and controlled provider acceptance before enabling callbacks. No test should send a real call, email, message, campaign or incur customer billing.

The unrelated team-access migration and industry preset release remain held by their existing explicit-approval requirement. Neither is copied into or applied by this PR. The newer Maia WhatsApp pilot, accepted-media behavior, Leo, industry dashboards and Flux Social are preserved.

This does not implement all Phase 6 channels, a provider retry scheduler/backlog replay service, historical agent-ownership reconstruction, new pricing or duration-adjustment billing. It makes redelivery of the existing receipt adapter transactional and recoverable. Correlation propagation and channel-state parity are subsequent scoped milestones.

Future rollback must retain receipt/ledger evidence and avoid restoring non-atomic retry behavior while callbacks are active. Any provider/callback or production release change needs its own explicit approval; no automatic rollback or integration disconnection was performed here.
