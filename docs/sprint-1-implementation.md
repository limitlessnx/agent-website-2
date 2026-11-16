# Sprint 1: tenant onboarding reliability

Branch: `feat/sprint-1-tenant-readiness`. Baseline: `main` at `967f2821`.

## Architecture and findings

The admin wizard calls the service-role `create_and_provision_organization` RPC, which atomically creates a tenant and starter template assets. It does not assign an owner or prove activation readiness. The route then calls the existing n8n starter provisioner. Despite Trigger.dev handling active background tasks, this legacy starter deployment path still exists on main. This change preserves that boundary rather than replacing Maia, Leo, Flux Social or tenant system execution.

The route treated a JSONB RPC result as a table array. It caught external automation errors and returned `ok: true`; the wizard ignored the external result and displayed “ready”. Project lookup by business name also risked collisions between tenants with identical names. A lost creation response could cause a duplicate organization on resubmission.

Reviewed open PRs before editing, including #238 (invitation handoffs), #170 (legacy n8n removal), #332 (subscriptions), #228 (dashboard styling), and the open Flux Social work. No PR was merged or cherry-picked.

## Changes

- `app/api/admin/organizations/create-and-provision/route.ts`: accept scalar JSONB results; require a durable creation request ID; return `organization_created` independently of automation completion; use sanitized failure feedback.
- `supabase/migrations/20261116104101_admin_organization_creation_retry_safe.sql`: add an eight-argument overload of the existing RPC. Transaction advisory locking and a saved request fingerprint/result make replay safe. Delegate starter creation to the original RPC; complete missing tenant workflow rows under a tenant-specific namespace and verify the required count. Validate industry against the selected active template. Only service_role can execute. **Not applied to production.**
- `lib/n8n-organization-provisioning.ts`: use tenant-specific project/workflow names, tenant filters, compare-and-set claims in existing project metadata, incremental remote identity persistence, and fail-closed reconciliation of ambiguous creates. Keep workflows inactive. Do not treat missing provider configuration as success.
- `app/api/admin/organizations/[organizationId]/n8n/sync/route.ts`: reuse the saved starter project for retries and return truthful outcomes.
- `lib/tenant-readiness.ts`: pure seven-state projection with blockers and required next actions.
- `lib/tenant-readiness-server.ts`: aggregate existing memberships, template assignments/families, subscription/effective entitlements, agents/runtime readiness, industry catalogs, systems/jobs, latest tests and approvals. Database errors fail closed. An existing “live” tenant with blockers is shown as needing attention.
- `app/api/admin/organizations/[organizationId]/readiness/route.ts`: authenticated, tenant-scoped read-only snapshot endpoint.
- `app/dashboard/clients/OrganizationCreationWizard.tsx`: retain request identity across response loss, show partial outcomes, continue into saved tenant setup, prevent repeated creation after a known success, derive industry from template.
- `app/dashboard/clients/StarterProvisioningRetry.tsx`: retry existing starter setup with accessible progress feedback.
- `app/dashboard/clients/[organizationId]/setup/page.tsx`: explicitly authorize before service-role reads; show readiness progress and next actions using existing dashboard components; preserve configuration/testing/launch controls.
- `package.json`: include both new reliability suites in the existing support regression command used by CI.
- `tests/supabase-migration-ledger.test.mjs`: register the new migration as pending review without altering the production snapshot.
- `tests/admin-organization-creation-retry.test.cjs`, `tests/tenant-onboarding-reliability.test.cjs`: local database and mocked provider/route tests. No messages, paid services or customer records used.

## Validation

- Locked dependency installation passed.
- Support regression suite: passed, 66 test files, including both new reliability suites.
- Onboarding/workspace regression selection: passed, 4 test files.
- Hotel setup suite: passed, 11 test files.
- Xposure dashboard suite: passed, 6 test files.
- Real Estate suite: 48/49 test files passed. `real-estate-customer-service-window.test.cjs` also fails on untouched main in a separate worktree.
- New mocked reliability, mapped legacy preservation, migration ledger and local PGlite migration suites: passed. Cover scalar/array RPC responses, auth before side effects, partial transfer failure/recovery, uncertain creation, concurrent claims, missing provider configuration, all seven states, tenant filters, fail-closed evidence, three industry templates, parameter conflict and function ACL.
- Focused ESLint and `git diff --check`: passed.
- Full repository ESLint: fails with 501 errors and 77 warnings across existing files; not a clean baseline.
- TypeScript passed on clean native Turbopack output. A Webpack experiment generated incompatible types for an existing optional hotel GET parameter; removing those generated temporary files restored the native check.
- Normal Turbopack production build: passed outside the restricted sandbox with synthetic database settings. Webpack fallback fails on existing CSS-module global selectors in Leo Voice and HotelWelcomeTour; the sandboxed Turbopack attempt stalled and was stopped.
- Synthetic local browser evidence: `sprint-1-evidence/responsive.json` and screenshots at 360, 430, 768, 1024, 1440 and 1920 px. All six returned HTTP 200 with no page-level horizontal overflow or browser errors. External browser requests blocked. Existing voice/allocation widgets use incomplete synthetic fixtures; this is not proof of live provider functionality.

## Review links and visual evidence

- [Draft PR #406](https://github.com/limitlessnx/agent-website-2/pull/406)
- [Code preview](https://limitlessnx-agent-website-2-6rvbnbqvj-fluxagents.vercel.app) — code commit `70edf7d2`; build status checked separately from local rendering. [Latest branch preview](https://limitlessnx-agent-website-2-git-feat-sprint-1-90a335-fluxagents.vercel.app).
- Local fixture screenshots: [360](sprint-1-evidence/setup-360.png), [430](sprint-1-evidence/setup-430.png), [768](sprint-1-evidence/setup-768.png), [1024](sprint-1-evidence/setup-1024.png), [1440](sprint-1-evidence/setup-1440.png), [1920](sprint-1-evidence/setup-1920.png).
- [Machine-readable responsive results](sprint-1-evidence/responsive.json).

Supabase project discovery found the active production project and an **inactive** Limitless Realty Staging project. No active isolated staging database was identified. The inactive project was not resumed, and no hosted database was changed.

## Release and recovery limitations

The user has chosen production-backed testing to avoid paid staging. The exact rollback-only procedure and read-only production findings are documented in [the production test runbook](sprint-1-production-tests/README.md). The retry-safety migration remains unapplied; the exact temporary production schema/grant test was subsequently explicitly approved, executed successfully, and rolled back. Persistent migration/application release remains unapproved. This code intentionally fails rather than silently falling back to non-idempotent creation if the overload is absent.

Ambiguous remote create responses require administrator reconciliation. If the remote resource exists, retry resolves its stable tenant-specific name and persists it. If it cannot be found, do not clear the pending marker until absence is verified. Interrupted worker claims are not automatically stolen: after 15 minutes the readiness snapshot reports needs attention. After confirming no worker is running and reconciling pending remote operations, an administrator may clear `onboarding_sync_running` in that tenant's project metadata, then retry. No production reconciliation was performed.

Existing legacy projects keep saved mappings. Unmapped old resources are not adopted by business name; an administrator must verify and bind their identities before retrying to avoid guessing tenant ownership.

Readiness is a conservative reporting projection. Existing activation gates remain authoritative; this change does not enable a new background task, send a test message, start a paid integration, or approve/activate a tenant. Catalog checks establish tenant-owned active inventory presence (hotel also checks published room information); content completeness still requires operational review. Configuration changes outside agent rows may require rerunning tests even if the agent timestamp did not change.

Hosted 12ui visual refinement was blocked by automatic approval review because sharing the workflow brief with the external service requires user approval. Existing styling is retained; this visual refinement is not claimed complete. The local screenshots document functional responsive rendering, not full visual acceptance.

**Persistent production changes: none.** The separately approved rollback-only test temporarily created a function, grants and synthetic tenant rows, then rolled them back. No application release, permanent migration, merge, live message or billable-provider test request was performed. Independent verification confirmed no test organizations or temporary overload remain.

## Hosted verification status

The first preview build completed successfully according to Vercel build events. The updated code preview for `70edf7d2` reached READY; subsequent commits only update test integration, migration review bookkeeping and documentation. The connected Vercel fetch tool could not pass deployment authentication (HTTP 401, including its temporary-share-link retry); no Vercel CLI fallback is installed. Authenticated browser acceptance and preview creation against a migrated isolated database are not claimed. The GitHub hotel concurrency job passed. Maia verification initially stopped at the pending-migration ledger gate; the new migration is now explicitly listed as pending review and the ledger suite passes locally. Final hosted checks remain recorded in the PR.

## Production-backed test preflight update

Read-only production inspection found a shared workflow-registry uniqueness collision that can silently omit a new tenant's workflows. The unapplied overload now completes and verifies the new tenant's own registry rows. Local tests reproduce the actual unique-index conflict across two tenants in each industry. Hotel/Photography templates are absent from the live legacy catalog, and the existing hotel inventory-readiness RPC is not installed; these are explicit deployment prerequisites, not passing production onboarding checks. See the [runbook and exact blocked rollback-only SQL](sprint-1-production-tests/README.md). The first attempted temporary-schema test was rejected before execution. After explicit user approval, the exact test passed and rolled back; an independent read-only follow-up confirmed no test tenant or overload exists and the original function permissions remain restricted.

## Approved production database rollback test

Passed on 16 November 2026 after explicit approval. This verifies real-schema creation/replay, conflicting request rejection and complete per-tenant workflow registries for two distinct synthetic Real Estate tenants. The test transaction and an independent follow-up both verify zero retained test tenants and no temporary overload. Original creation-function permissions remain unchanged. See [evidence and script hash](sprint-1-production-tests/rollback-result.json). Hosted browser acceptance, external-provider recovery, Hotel/Photography prerequisites and persistent rollout remain open.
