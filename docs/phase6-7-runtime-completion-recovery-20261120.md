# Phase 6/7 runtime completion recovery

Base: released main `38e2a1c0128e8c322a132562d89c0106662c3a21`, fetched before branch `fix/runtime-completion-recovery`. Open Gencouv, voice-pilot/sideband, Flux Social and legacy manager/inbox PRs were inspected and left unchanged. This increment follows PR #442; it does not rebuild provisioning, inbox, billing or authentication.

## Audit findings and change

The existing `/api/internal/runtime/actions/complete` handler updated execution status before separate usage/progress/queue writes. It did not inspect those write errors. Repeated requests appended workflow usage and terminal events again. The metadata incorrectly labeled every workflow as sales qualification. Most seriously, it marked *all* queued/claimed/running commands for the execution as successful, including email, appointment and follow-up delivery jobs that had only been enqueued. Workflow completion is not provider delivery confirmation.

The same route now validates identity/status/output, preserves the established JSON response and gateway secret boundary, and calls one service-only SECURITY INVOKER completion function. The function checks active organization and agent/execution ownership, locks the existing execution, and commits execution state, zero-cost workflow usage, terminal progress, parent command status and initiating gateway audit as one transaction. Only `agent.respond` is finalized; action delivery jobs and their failure evidence remain untouched. Production enqueue source was read to confirm that parent command type.

Exact retries recover the original completion timestamp/output after matching the canonical request fingerprint, execution state, usage reference and audit proof. Changed retries fail closed. Historic terminal or partial telemetry requires review; there is no automatic historical rewrite, usage deletion, refund or provider replay. Cancelled parents retain cancellation. Workflow metadata uses actual execution input/context when present and otherwise says `unknown`.

The migration adds only a function. Existing execution-row locking and organization/execution progress indexing are reused; no new table/index, wallet function or debit is needed. Anonymous/authenticated execution is denied; service-role execution is granted. Existing rates and reservations are untouched. Application errors distinguish missing scope, conflicting input, unavailable evidence and legacy review without exposing database diagnostics.

## Acceptance readiness

Read-only production lookup confirms **News** (`9f1e02e2-2412-446d-87f3-b0862b0c5e48`) is active, has one active owner, no manager and no pending access request. The user was asked to identify an existing test manager email; no membership or account was created/changed. No authenticated browser/session is available to this workspace, so actual owner/manager acceptance remains open. Do not forge sessions or use platform privileges as tenant membership.

ElevenLabs read-only inventory still fails with connector internal error `-32603`. No provider IDs were guessed, agents configured, calls/simulations made or customer communications sent. Canonical inbox integration, measured OpenAI duration policy and upstream provider reservation adoption remain separate work. No full Phase 6/7 completion is claimed.

## Validation and delivery

Eleven focused SQL/API cases passed, zero skipped: duplicate recovery, output/status conflicts, atomic rollback at each persistence boundary, foreign/inactive scope, legacy partial evidence, corrupted/missing completion proof, cancellation, service-only grants, malformed inputs and sanitized API failure handling. Changed-module lint, TypeScript, optimized production build, four migration-ledger checks and the complete 732-case support suite passed (zero failures/skips). The initial inactive-org test used an invalid fixture status (`paused`); it was corrected to the actual production constraint (`suspended`). No application constraint was weakened.

The existing support/release and billing workflows now include the focused tests. Independent PostgreSQL sessions run only against a named disposable localhost `runtime_completion_test` database and cover concurrent commit/rollback/recovery; local PGlite tests do not count as independent connections. Actual hosted results, preview, registration and release hashes will be recorded in the PR after execution. No UI source changed, and no new authenticated visual approval is claimed.

Release under the user's standing approval only after exact-source hosted checks; apply only the reviewed function migration, verify registration/body/grants/advisors and reconcile its actual migration version before application release. Do not push unrelated pending historical migrations. A compatible application rollback retains completion receipts/usage/audit and all action jobs; never delete or replay provider work to simulate rollback. The old completion endpoint's broad queue update is unsafe and should not be restored on live traffic.
