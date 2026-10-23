# Leo-to-Trigger.dev migration diagnostic

**Run date:** 2026-10-23  
**Scope:** Read-only architecture inspection of current `main` plus the draft Phase 3A branch.  
**Production:** No production changes performed.  
**Validation status:** GitHub checks are still running; no passing result is claimed.

## Executive finding

Phase 3A is only an execution-boundary refactor. It is not yet a Trigger.dev migration. The new `lib/leo-execution/` folder keeps this work isolated, while the compatibility adapter continues to call the existing n8n executor.

## Findings

### 1. Generic privileged Leo tool gateway still executes through n8n

Current `main` uses `createLeoExecutionEnvelope` in `app/api/leo/tool/route.ts` and sends the signed envelope to `executeLeoEnvelopeViaN8n`. The Phase 3A draft changes the call to `dispatchLeoExecution`, but the default provider remains `legacy_n8n`, which calls that same executor.

**Impact:** Safe intermediate seam, but no runtime traffic has moved to Trigger.dev yet.

### 2. Action-specific n8n calls exist outside the new dispatcher

In `lib/leo-tool-runtime.ts`:
- CRM follow-up calls the `fluxknight/crm-follow-up/v3` webhook through `LEO_CRM_FOLLOWUP_WEBHOOK_URL`.
- Appointment actions call the `fluxknight/appointments/v4` webhook through `LEO_APPOINTMENT_WEBHOOK_URL`.
- Campaign sending calls `LEO_CAMPAIGN_EXECUTOR_WEBHOOK_URL`.
- Workflow activate/deactivate operations use the n8n workflow API and update `workflow_registry`.

**Impact:** Migrating only the generic route cannot remove these n8n dependencies. Each action family needs a documented contract and a dedicated replacement before its legacy path can be retired.

### 3. Trigger.dev is already present, but it is not a drop-in synchronous webhook

`trigger.config.ts` configures the Trigger.dev SDK and `src/trigger/` as its task directory. Existing task implementations use `task({ id, retry, run })`, and tenant WhatsApp inbound processing validates tenant bindings and claims an inbound event before doing work.

**Impact:** New Leo tasks should follow repository conventions, use explicit task IDs, enforce organization and agent binding inside the task, and deduplicate side effects. The route must define whether it waits for completion or returns an accepted/queued execution. Do not pretend a queued task result is equivalent to the current synchronous executor result.

### 4. Idempotency and execution evidence must be first-class

The existing envelope contains a request ID, issue/expiry timestamps, tool key, arguments, approval flag, tenant identity and signature. It expires after two minutes. The current n8n executor waits up to 95 seconds for a response.

**Risk to resolve:** Trigger.dev may execute after the original envelope expiry, retry a task, or return before the task completes. The adapter must verify authorization at enqueue time, pass a stable idempotency/correlation key, persist an execution record, and have a clear worker-side authorization/expiry policy. Never blindly replay a side-effecting tool after a timeout.

### 5. Existing security ownership must stay in place

The current gateway resolves identity, checks the canonical tool allowlist, enforces explicit organization targeting for privileged cross-tenant actions, requires confirmation for confirmation-gated tools, signs the envelope and records dispatch audit events.

**Guardrail:** Keep those checks at the gateway. The Trigger.dev worker must independently validate the signed/normalized action contract and tenant/agent binding; it must not trust arbitrary client-supplied organization IDs or task names.

### 6. Current test coverage is a contract smoke test, not behavioral proof

The new test checks source text for expected imports and guardrails. It does not exercise a fake provider, retries, timeouts, duplicate requests, approval denial, tenant mismatch or real Trigger.dev execution. The current preview and workflow checks are still in progress.

**Required before promotion:** Add behavioral dispatcher tests, run the targeted tests and `npm run test:support`, `npx tsc --noEmit`, and production build; then test chat and voice flows in the preview.

## Recommended migration order

1. Keep Phase 3A draft-only and validate the new folder/import changes.
2. Implement one allowlisted Trigger.dev task for CRM follow-up, with idempotency and persisted execution evidence.
3. Implement appointment actions separately, including cancellation/reschedule semantics and duplicate-delivery protection.
4. Migrate campaign execution after provider ownership, approval and delivery reporting are documented.
5. Treat workflow activation/deactivation as a separate lifecycle project; a task runner does not automatically replace n8n workflow management.
6. Inventory every remaining n8n call site and external workflow dependency before decommissioning anything.

## Status at diagnostic time

- Draft PR #268 remains open and unmerged.
- The branch is ahead of `main` and not behind it.
- Vercel status is pending.
- Repository workflows `Dashboard Final QA` and `Maia Draft Verification` are in progress.
- No test/build pass or production readiness is claimed.
