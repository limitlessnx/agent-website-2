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
