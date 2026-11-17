# Sprint 1: tenant onboarding implementation and production-backed QA

[Draft PR #406](https://github.com/limitlessnx/agent-website-2/pull/406). Branch: `feat/sprint-1-tenant-readiness`. Initial main baseline: `967f2821`.

**Current production impact:** the explicitly approved additive database migration is installed, and one explicitly approved synthetic QA organization is retained. The production application has not been deployed or merged. Existing customer records were not mutation targets. No messages, paid-provider requests or external automation deployment were performed in these tests.

## Existing architecture and defects

The admin creation API calls the atomic `create_and_provision_organization` RPC, then the existing legacy n8n starter provisioner. Trigger.dev continues to run the existing application background tasks; this work does not replace Maia, Leo, Flux Social or industry operations. Readiness is derived from existing memberships, templates/families, entitlements, agents/runtime evidence, catalogs, system jobs, tests and approvals.

Confirmed defects corrected:

1. The route read scalar JSONB RPC output as an array.
2. External provisioning errors still returned full success, and the wizard displayed ready.
3. A lost response could create another tenant on replay.
4. Business-name-based remote lookup could collide between tenants; remote IDs were persisted too late for safe retries.
5. The original template provisioner uses a shared template slug in a registry unique on `(organization_id text, workflow_key)`. Production inspection found all seven Real Estate keys already claimed. Another tenant could silently receive no workflow rows. The new overload completes missing rows under the new tenant UUID and verifies completeness without changing existing tenants.
6. The creation wizard was not mounted by any route. It is now reachable at `/dashboard/clients/create`, linked from the clients page.
7. Saved-tenant retry queried a nonexistent `organizations.settings` column; it now reads the saved timezone from `metadata`.
8. Template availability was labeled “Provisioning ready”; the final copy says “Templates available” to avoid implying tenant readiness.

Relevant open invitation, legacy n8n removal, subscription, dashboard styling and Flux Social PRs were inspected before editing. None was merged or cherry-picked.

## Files and reasons

- `app/api/admin/organizations/create-and-provision/route.ts`: durable request ID, scalar JSONB support, separate creation/provisioning outcomes, sanitized errors.
- `app/api/admin/organizations/[organizationId]/n8n/sync/route.ts`: retry the saved tenant starter project, use the actual metadata schema, report complete/in-progress/attention truthfully.
- `app/api/admin/organizations/[organizationId]/readiness/route.ts`: authorized, tenant-scoped read-only readiness endpoint.
- `lib/n8n-organization-provisioning.ts`: tenant-specific identities, conditional retry claims, incremental mapping persistence, preserve mapped legacy workflows, fail closed on ambiguous creates. QA-marked projects are blocked before provider operations; no simulated successful deployment is reported.
- `lib/tenant-readiness.ts`, `lib/tenant-readiness-server.ts`: seven states, blockers and next actions from existing evidence; query failures fail closed and incomplete live tenants show needs attention.
- `app/dashboard/clients/OrganizationCreationWizard.tsx`: persist request identity, truthful partial results, continue saved setup, prevent duplicate submission after known creation, derive industry from template.
- `app/dashboard/clients/StarterProvisioningRetry.tsx`: accessible saved-tenant retry feedback.
- `app/dashboard/clients/[organizationId]/setup/page.tsx`: authorize before privileged reads and add readiness progress while preserving operational controls.
- `app/dashboard/clients/create/page.tsx`, `app/dashboard/clients/page.tsx`: mount and link the existing wizard without replacing the existing client onboarding queue.
- `supabase/migrations/20261116120507_admin_organization_creation_retry_safe.sql`: reviewed service-role-only overload reusing the original atomic provisioner, request serialization/replay, template/industry validation and complete per-tenant registry rows. Applied with explicit approval. Supabase assigned version `20261116120507`; the local file was renamed from its originally prepared `20261116104101` version without changing the reviewed SQL.
- `supabase/migration-ledger.production-snapshot.json`, `tests/supabase-migration-ledger.test.mjs`: record the actual applied version and remove it from the pending-review list.
- `tests/admin-organization-creation-retry.test.cjs`, `tests/tenant-onboarding-reliability.test.cjs`: PGlite and mocked provider/route checks for replay, collisions, ACL, tenant scope, retries, QA guard and readiness states. `package.json` includes both in the existing support CI command.
- `docs/sprint-1-production-tests/`: approved historical rollback SQL/results, current retained-QA evidence, hosted screenshots and machine-readable browser checks. `docs/sprint-1-evidence/` retains the earlier local synthetic visual checks.

## Tests and results

- Normal native Turbopack production build: passed for the functional code. Clean TypeScript, focused lint and diff checks passed.
- Support regression command: **66 test files passed**, including new creation/retry/ACL/QA-guard coverage. Additional retry-schema coverage passed in that command after the hosted finding.
- Onboarding/workspace selection: 4 files passed. Hotel setup: 11 passed. Xposure dashboard: 6 passed. GitHub disposable PostgreSQL hotel concurrency passed.
- Real Estate suite: 48/49 files passed; the customer-service-window failure was also reproduced on untouched main.
- Repository-wide lint has baseline failures (501 errors/77 warnings at the original check). Webpack fallback has existing CSS-module global-selector incompatibilities; the normal native build passes.
- Approved rollback-only test against the actual production database: passed creation/replay/conflict rejection, draft/disconnected assets, complete workflow rows for two separate tenants and function ACL. Everything in that transaction rolled back; independent cleanup verification passed. [Historical evidence](sprint-1-production-tests/rollback-result.json).
- Approved persistent migration: installed and verified. Original creation/template-provisioner hashes are unchanged. New overload permits service_role and denies anon/authenticated.
- Authenticated Vercel preview (`069e0023`) using the retained QA tenant: passed wizard replay with HTTP 201, `organization_created=true`, `ok=false`, needs-attention status and explicit blocked-provider feedback; the saved setup link works and repeated creation stays disabled. Retry returned HTTP 200 with needs attention and preserved the saved tenant. The readiness endpoint returned HTTP 200 with real setup blockers and no evidence-query error.
- Hosted 360/430/768/1024/1440/1920 checks: passed with no page-level horizontal overflow or browser errors. [Browser results](sprint-1-production-tests/hosted/results.json).
- Hosted in-progress check: a temporary QA-only in-flight marker produced the correct progress display and HTTP 202 retry response without starting a worker. The marker was reset afterward. [Evidence](sprint-1-production-tests/hosted/in-progress.json).

## Screenshots and preview

[Latest branch preview](https://limitlessnx-agent-website-2-git-feat-sprint-1-90a335-fluxagents.vercel.app).

Hosted screenshots use the synthetic retained QA organization against the real database: [partial-result wizard](sprint-1-production-tests/hosted/wizard-partial-failure.png), [in progress](sprint-1-production-tests/hosted/provisioning-in-progress.png), [360](sprint-1-production-tests/hosted/setup-360.png), [430](sprint-1-production-tests/hosted/setup-430.png), [768](sprint-1-production-tests/hosted/setup-768.png), [1024](sprint-1-production-tests/hosted/setup-1024.png), [1440](sprint-1-production-tests/hosted/setup-1440.png), [1920](sprint-1-production-tests/hosted/setup-1920.png). They were captured before the final template-availability badge wording change.

Preview access used a temporary deployment share link and the Vercel `_vercel_share` cookie exchange. App login used credentials scoped only to the feature preview; production credentials were unchanged. Temporary overrides were rotated and detached from the active branch, the temporary retirement branch was deleted, and private credential/session files were deleted. Three dormant sensitive-variable records remain scoped to that deleted retirement branch because the connector does not expose deletion and Vercel forbids renaming sensitive variables. They do not override active preview or production settings. Active browser-test share links were revoked or confirmed absent. One earlier temporary preview-access token was exposed in a diagnostic and immediately revoked; no production credential was exposed.

## Retained QA state and limitations

QA organization: `48b68a88-bd0a-48d9-b6e2-604e8f1bab9d`, **FLUXKNIGHT QA — Sprint 1**. Project: `d4bbffaf-bd80-42c8-adcf-a4d54c61c6a5`. Request: `c7dc530d-1863-4c62-a91a-f74a6c443ff7`.

Final checks confirm exactly one QA tenant, four draft agents, seven workflow rows, no connected integrations, no subscription, no queued provisioning jobs and no remote workflow/project mappings. The outbound guard remains enabled and the in-flight test marker is cleared. Use this existing tenant's setup/retry screen for further manual QA; arbitrary new unmarked tenants are outside the guarded test path.

Readiness is a conservative report. Existing activation gates remain authoritative. Actual provider failure/transfer/recovery remains mocked locally; no live external automation, paid model call or message was used to prove delivery. The browser creation test replayed the approved retained request; fresh creation was exercised by the real database tests, not by creating another unmarked tenant through the browser.

Hotel/Photography starter templates are absent from the live legacy template catalog, and the existing hotel inventory-readiness RPC is not installed. Those prerequisites still need a concrete reviewed rollout. Configuration changes outside agent rows may require rerunning tests even when the agent timestamp is unchanged. Ambiguous remote creates and interrupted real-worker claims still require verified administrator reconciliation; claims are not automatically stolen.

Hosted visual rendering is now verified at the required widths. The separately requested 12ui/iOS-style visual refinement remains incomplete because approval to share the design brief with that external service was not received. Full production application release, merge and activation remain unapproved. The PR stays draft.

## 17 November follow-up verification

Fresh main remains `967f2821`. The Phase 2 preflight found and corrected additional Phase 1 compatibility gaps:

- Hotel setup and readiness now reuse one inventory reader. It retains the existing RPC when available and uses paginated, tenant-filtered reads only for a missing-function response. Permission/database errors fail closed. No migration is required.
- Photography API authorization now accepts active Photography organizations based on database industry metadata, preserves Xposure compatibility, and still checks member permissions or the separately authenticated platform-admin tenant scope. Runtime tests reject unrelated tenants, forged scope slugs and insufficient permissions.
- Industry labels such as “Real Estate” and “Photography Studio” resolve to the existing industry workspace instead of the generic dashboard.
- New studios no longer inherit the Xposure catalogue sample counts or heading. The existing Xposure fallback remains intact.
- `industry-template-registration.sql` prepares empty Photography and Hotel starter definitions, replay-safe and without copying customer content. It has only been tested locally in PGlite. It has **not been executed against production** and requires explicit production-change approval.

Verification: support 67/67 files; Hotel setup 11/11; focused Photography catalogue/authorization/campaign checks 5/5; added runtime authorization, pagination, industry alias and local SQL replay tests pass; TypeScript and focused ESLint pass. A broader Photography check found two existing failing test files (outdated campaign copy assertion and missing historical migration filename), both reproduced on untouched main. These are not reported as passes.

The current environment blocks Turbopack's local worker port (`Operation not permitted`) even after requesting additional permissions. The new follow-up build is therefore **blocked**, not passed; earlier successful builds and hosted screenshots apply to the earlier commits only. No new hosted visual verification is claimed for these follow-ups. Phase 2 starts with the documented audit in `docs/phase2-audit.md`, preserving this distinction.
