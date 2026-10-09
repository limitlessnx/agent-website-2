# Leo Migration — Phase 0 Baseline and Merge Guardrails

**Prepared:** 2026-10-09  
**Repository:** `limitlessnx/agent-website-2`  
**Working branch:** `draft/leo-migration-phase0-20261009`  
**Base:** `main` at the start of this work; branch created from the live `main` ref.  
**Status:** Baseline inventory started. This is not a claim that tests or production checks have passed.

## Parallel-work protection (mandatory)

Another workstream is updating the repository/main in parallel. This branch must be treated as a narrow draft, not a replacement snapshot of the application.

1. Do not commit to or modify `main` directly.
2. Do not merge another workstream's branch or copy its full tree into this branch.
3. Before each code batch and before opening a PR, compare this branch with the then-current `main`.
4. Rebase/recreate from latest `main` when needed and reapply only the Leo-specific delta. If a conflict involves a file updated by the other workstream, inspect the current-main version and preserve its behavior; do not resolve by accepting the old branch wholesale.
5. Keep this work in one draft integration branch/PR. No intermediate merges. The final promotion is one reviewed merge after all required gates pass.
6. Review the final diff for unexpected deletions, reverted current-main fixes, unrelated files, stale SQL migrations and obsolete UI/runtime code.
7. If the branch becomes substantially stale or diverged, stop and rebuild a fresh narrow branch from current `main`; do not force-update or merge a stale branch.

## First-pass evidence from current main

These are observations from files fetched from the branch base, not a complete repository-wide static scan.

| Area | Evidence | Initial conclusion |
|---|---|---|
| Tool gateway | `app/api/leo/tool/route.ts` imports `executeLeoEnvelopeViaN8n` from `lib/leo-n8n-executor`. | A legacy n8n execution path is still wired into the API route; map exact callers before replacing it. |
| Tool runtime | `lib/leo-tool-runtime.ts` imports `activateN8nWorkflow` and `deactivateN8nWorkflow` from `lib/n8n-api`. | Workflow activation/deactivation is provider-specific. |
| Core permissions | `lib/leo-core.ts` declares tool scopes and approval modes; tenant organization access helpers are imported. | Preserve and regression-test the canonical permission model; do not duplicate it in a new dispatcher. |
| Task plans | `lib/leo-task-plan.ts` uses approval fingerprints, confirmation tokens and explicit approval states. | Reuse the existing approval/task model where appropriate; do not create a competing approval system. |
| Proactive monitor | `app/api/leo/monitor/route.ts` scans, reconciles and enriches persisted signals and handles degraded notification synchronization. | Preserve signal lifecycle and degraded-mode behavior while connecting remediation to the new executor. |
| Security tests | `tests/leo-core-security.test.mjs` reads `n8n/workflows/agent-leo-core-v2-executor.json`. | Possible stale test/fixture coupling. Determine whether the workflow is still required before deleting it or rewriting the test. |
| Production execution tests | `tests/leo-phase13-production-execution.test.mjs` checks the production registry, approvals, identity and tenant scope. | Keep these contracts and extend them to the provider-neutral dispatcher. |
| Migration tests | `tests/leo-phase12-runtime-migration.test.mjs` checks the shared runtime and organization-pinned service identity. | Preserve these invariants; avoid reverting the shared runtime migration. |
| Proactive lifecycle tests | `tests/leo-proactive-lifecycle-monitoring.test.mjs` checks lifecycle evidence and dashboard notification synchronization. | Treat this behavior as an existing contract, not a feature to rebuild. |
| Test commands | `package.json` defines `test:support` with broad Leo/security/runtime/tenant coverage and `test:maia` for Maia/tenant/reminder regression coverage. | Use targeted tests during changes, then run the broader relevant suite and build before handoff. |

## Expanded repository inventory (recursive tree from main)

The GitHub tree endpoint returned 1,181 tracked files with no truncation. The following n8n/Leo/Trigger paths were identified for classification; this is a path inventory, not proof every path is active at runtime.

**Leo execution/runtime candidates**
- `app/api/leo/tool/route.ts`
- `app/api/leo/public/tool/route.ts`
- `app/api/leo/runtime/execute/route.ts`
- `app/api/leo/runtime/engine/route.ts`
- `app/api/leo/runtime/engine/stream/route.ts`
- `app/api/leo/runtime/approvals/route.ts`
- `app/api/leo/n8n/webhook/route.ts`
- `lib/leo-n8n-executor.ts`
- `lib/leo-n8n.ts`
- `lib/leo-runtime-config.ts`
- `lib/leo-task-executor.ts`
- `lib/leo-tool-runtime.ts`
- `lib/n8n-api.ts`

**Other n8n product surfaces that must not be removed just because Leo is migrating**
- `app/api/admin/n8n/sync/route.ts`
- `app/api/admin/organizations/[organizationId]/n8n/sync/route.ts`
- `app/api/limitless/n8n/status/route.ts`
- `app/dashboard/automations/N8nDiscoveryClient.tsx`
- `lib/n8n-organization-provisioning.ts`
- `lib/limitless-campaign-n8n.ts`
- `app/api/internal/maintenance/maia-legacy-n8n-inspect/route.ts` and its suffixed maintenance route
- `n8n/workflows/*` (legacy workflow artifacts and fixtures)

**Existing Trigger.dev implementation candidates**
- `src/trigger/maia-runtime.ts`
- `src/trigger/tenant-channel-runtime.ts`
- `src/trigger/limitless-installment-reminders.ts`
- `src/trigger/system-orchestrator.ts`
- `src/trigger/health-check.ts`
- `trigger.config.ts`
- `.github/workflows/deploy-trigger.yml`
- `.github/workflows/sync-trigger-lockfile.yml`

**Important classification rule:** the migration target is Leo's supported execution path, not an indiscriminate repository-wide deletion of n8n. Campaigns, Maia, tenant provisioning, admin discovery and legacy inspection may still have independent dependencies. Each must be proven migrated or intentionally retained before any removal.

## Executor classification from current-main source inspection

| Action family / surface | Current implementation found | Classification / migration decision |
|---|---|---|
| Generic Admin/Super Leo tool gateway | `app/api/leo/tool/route.ts` calls `createLeoExecutionEnvelope` then `executeLeoEnvelopeViaN8n` for the generic path. | **Primary Phase 3 cutover point.** Keep direct handlers (public lead capture, orchestration inspect/retry and Limitless-specific paths) intact while migrating the generic path. |
| Runtime-configured workflow execution | `app/api/leo/runtime/execute/route.ts` loads `config.n8n.workflows`, creates `LeoN8nExecutor`, and registers a workflow-keyed gateway handler. | **Legacy Leo runtime path.** Must be explicitly migrated or retired based on callers and product requirements. |
| CRM follow-up | `lib/leo-tool-runtime.ts` → `delegateFollowUp` → `LEO_CRM_FOLLOWUP_WEBHOOK_URL` / n8n webhook default. | **Migrate.** Reuse existing tenant/customer validation and idempotency input, but fix the fallback idempotency key design: a fresh random key per retry does not guarantee deduplication across retried requests. |
| Appointment management | `lib/leo-tool-runtime.ts` → `delegateAppointment` → `LEO_APPOINTMENT_WEBHOOK_URL` / n8n webhook default. | **Migrate.** Preserve organization/agent/customer checks and stable request identity across retries. |
| Campaign execution | `lib/leo-tool-runtime.ts` uses `LEO_CAMPAIGN_EXECUTOR_WEBHOOK_URL`; separate `lib/limitless-campaign-n8n.ts` imports n8n workflow APIs. | **Split the cases.** Generic Leo campaign executor must be verified and migrated; Limitless Realty's campaign integration is a separate product path and must not be deleted without a dedicated replacement and regression plan. |
| Workflow activate/deactivate | `lib/leo-tool-runtime.ts` imports `activateN8nWorkflow` / `deactivateN8nWorkflow` from `lib/n8n-api.ts`. | **Provider-specific capability.** Implement only for providers with an explicit lifecycle API; otherwise fail closed as unsupported. Never claim generic Trigger.dev jobs can be activated/deactivated like n8n workflows without a verified equivalent. |
| Public Leo tools | `app/api/leo/public/tool/route.ts` and `lib/leo-public-tools.ts` contain a separate public path. | **Protect from the initial cutover.** Do not route public lead capture/pricing/recommendation through the new privileged executor. Preserve public scope boundaries. |
| Operational task execution | `lib/leo-task-executor.ts` invokes the existing `/api/leo/tool` route using a stable task-step request ID. | **Reuse.** Keep task-plan approvals, evidence classification and recovery logic. Validate the end-to-end idempotency behavior when the gateway changes. |
| Proactive monitoring | `app/api/leo/monitor/route.ts`, `lib/leo-proactive-monitor.ts`, persisted signal store and lifecycle cron routes. | **Preserve.** Monitoring and signal persistence should not be rewritten during dispatcher introduction; only connect eligible action blueprints after the new dispatcher is proven. |
| Maia Trigger.dev runtime | `src/trigger/maia-runtime.ts` uses Trigger.dev tasks and existing Maia runtime/outbound dispatch functions. | **Existing provider pattern, not a Leo executor.** Reuse patterns where appropriate; do not repurpose Maia tasks for unrelated Leo actions. |
| Tenant channel runtime | `src/trigger/tenant-channel-runtime.ts` contains a Trigger.dev inbound task and scoped tool handling. | **Potential shared infrastructure.** Inspect the actual tool contracts before reuse; do not duplicate or bypass its organization checks. |
| System event / appointment / follow-up drains | `src/trigger/system-orchestrator.ts` registers `system-event-dispatch`, `system-event-drain`, `limitless-followup-drain` and `appointment-reminder-drain`. | **Existing tasks to reuse only when semantics match.** The task IDs are real candidates for appointment/follow-up work, but they are not automatically equivalent to the manual Leo tool APIs. |
| Installment reminder sweep | `src/trigger/limitless-installment-reminders.ts` registers `limitless-installment-reminder-sweep` every 15 minutes in `Africa/Lagos`. | **Out of scope for Leo dispatcher.** Preserve schedule and reminder behavior; include in regression coverage only. |
| Runtime configuration and signed callback | `lib/leo-runtime-config.ts`, `lib/leo-n8n.ts`, `app/api/leo/n8n/webhook/route.ts`. | **Legacy configuration/protocol.** Remove only after no callers, signatures, callbacks, deployment variables or external workflows depend on them. |
| Admin n8n management and discovery | Admin sync/status routes and `N8nDiscoveryClient.tsx`. | **Not automatically part of Leo migration.** Keep until separate product-surface decisions and dependency checks authorize removal. |

### Architecture decision for the first code slice

Do not replace the generic n8n call with an unverified Trigger.dev API call in one step. First introduce a small provider-neutral execution contract at the Leo gateway boundary and test it against the existing behavior. The contract must carry authenticated identity/scope, organization ID, canonical tool key, normalized arguments, approval evidence, stable idempotency/request ID, and a typed result with status/evidence. Keep the current n8n implementation behind a clearly named legacy adapter temporarily. Then add Trigger.dev-backed handlers per action family, with an explicit unsupported result for capabilities that have no safe equivalent.

A provider-neutral wrapper is a migration seam, **not** completion of the n8n migration. Phase 3 remains open until the legacy adapter has no required runtime callers and the action-specific end-to-end tests pass.

## Phase 0 inventory still required

- [ ] Capture current `main` SHA immediately before any implementation batch.
- [ ] Enumerate every remaining n8n reference and classify it: runtime, configuration, test fixture, workflow artifact, documentation, or obsolete reference.
- [ ] Map each registered Leo tool to its real executor and side-effect class.
- [ ] Inventory existing Trigger.dev tasks and identify reusable task IDs/functions before adding new ones.
- [ ] Check current open/draft PRs and parallel branches for overlapping paths and newer implementations.
- [ ] Inspect all relevant SQL migrations and RLS policies against the current code and current schema assumptions.
- [ ] Run baseline TypeScript/build and targeted Leo security/runtime/monitoring tests in an executable environment; record exact results. GitHub file inspection alone does not prove tests pass.
- [ ] Record any baseline failures separately so this work does not silently claim or absorb unrelated fixes.

## Execution design constraints

- Supabase is the durable source of truth for task status, audit and evidence.
- Trigger.dev is the preferred asynchronous execution provider.
- Authorization, organization-scope enforcement, approval validation, idempotency and result verification remain centralized.
- A task that timed out or returned an ambiguous response must not be reported as successful without evidence.
- Read-only operations must remain side-effect free.
- Provider-specific workflow lifecycle actions must be explicitly supported or reported unavailable; do not fake parity by mapping arbitrary provider IDs.
- Do not remove n8n credentials, workflow artifacts or fixtures until callers and operational dependencies have been proven absent.

## Next gates

**Phase 0 exit:** Complete inventory, current-main baseline and test results documented.  
**Phase 1 exit:** Identity, tenant isolation, context persistence, migrations and security tests verified.  
**Phase 3 foundation exit:** A provider-neutral dispatcher is added without replacing the existing approval/security contracts; targeted tests pass.  
**Action migration exit:** CRM follow-up, appointment, campaign and workflow lifecycle paths each have verified implementations or are explicitly marked unsupported.  
**Final merge gate:** Reconcile against the latest `main`; run typecheck, lint, targeted and broad regressions, build, preview E2E and final diff review; merge once only after approval.

## Explicit non-goals for this baseline commit

- No changes to production behavior.
- No deletion of n8n files/configuration.
- No changes to tenant dashboard, onboarding, Maia, reminders or other parallel-workstream features.
- No claims of green tests or production readiness without actual run evidence.
