# Phase 4 — Super Admin Modernization, Organization Management & Team Access

Base: `ae2a41f9031544f340ae9144bc79fb0c72819b8b` (latest main inspected 18 November 2026).
Branch: `fix/tenant-owner-manager-seat-guardrails-20261118`.
Pull request: https://github.com/limitlessnx/agent-website-2/pull/423 (existing draft, extended in place).
Production modified by this work: **No**.

## Architecture and review findings

[Nine-phase status audit](master-roadmap-status-20261118.md) distinguishes merged implementation from verified functionality. #422 contains the separate platform control center, workspace authorization, existing readiness integration and confirmed manual upgrade/archive controls. This PR adds tenant team access to the same Phase 4 workstream without merging platform administrators and organization owners.

The existing `organization_memberships`, `membership_roles`, `roles`, `role_permissions`, `organization_invitations`, `organization_access_requests`, `audit_logs`, invitation token hashing and authenticated-account onboarding remain authoritative. No new table, service, authentication system, invitation delivery service or commercial model was added.

All six original #423 changed files and its 543-line proposed migration were reviewed. Current production function definitions/ACLs, mutation policies, table grants and migration history were read without accessing customer messages or secrets. The migration is absent in production. The original draft's ready Vercel preview coexisted with failed Maia/regression checks; those failures were inspected rather than treating preview readiness as acceptance.

## Defects corrected

- Owner membership is required in the application and SQL for invitations, request approval/rejection, role changes, suspension/removal, reactivation and revocation. A foreign organization's role cannot authorize the selected tenant. A legacy `admin` role does not become ownership. Permission cleanup is restricted to organization-owned roles; global platform roles are preserved and covered by the migration replay test.
- Browser-authenticated direct mutation privileges (including RLS-bypassing TRUNCATE) are removed from the team/access tables. Existing service-role RPCs enforce actor/tenant/role checks and audit records; read policies and service-role server operations remain.
- Invitation creation, acceptance, revocation, Access ID approval/rejection and member updates acquire the same organization advisory transaction lock before seat/row changes. Acceptance rechecks the current plan after a downgrade. Reactivation from a non-occupied state checks available capacity. Suspended members retain their existing seats.
- Approval converts a matching email invitation reservation without double counting. Expired/revoked invitations release capacity. Stale requests cannot overwrite active roles, and manager invitation/approval/reactivation paths cannot restore or transfer owner privileges.
- Approval and rejection now produce audit events. Audit failure rolls back these database transactions rather than silently claiming success.
- Managers cannot obtain billing mutation powers through customized roles. Authenticated checkout/top-up endpoints independently require owner membership before provider, wallet or database mutations. Public new-customer checkout behavior remains available. Admin tenant preview remains read-only.
- Trial activation is also owner-only and rejects preview/revoked sessions before its existing trial RPC. This previously unguarded path was found during the general-template review; the fix stays in the existing team-access workstream.
- Team & Access exposes the existing plan's effective maximum, active seats, suspended seats, reserved invitations, available seats and full roster to owners and managers. Owner-only controls support generated invitation links, pending requests, revocation, suspend/remove and reactivation. No email is automatically sent.
- Failed team reads show a retryable error, not an empty roster or invented capacity. Unknown capacity disables additions. Existing purple cards/fields/buttons are reused; long identifiers wrap and mobile actions stack without clipping.

## Files changed and rationale

| Files | Reason |
| --- | --- |
| `lib/organization-membership.ts` | Existing owner authorization, organization-bound role/permission reads, effective seat summary, expiring invitations, nondelegable billing/access powers. |
| `app/api/portal/team/access-requests/route.ts` | Existing scoped request/RPC flow, roster/seat summary, read-only preview guard and manager lifecycle actions. |
| `app/api/organization/{invitations,members,roles}/route.ts` | Explicit read-only preview protection before mutations; existing routes and contracts retained. |
| `app/api/checkout/route.ts`, `app/api/payments/create/route.ts`, `app/api/portal/billing/top-up/route.ts` | Owner authorization before chargeable checkout initialization; no test provider calls. |
| `app/portal/team/page.tsx`, `AccessRequestsClient.tsx`, `team.css` | Incremental purple UI, all-member visibility, truthful seat/loading/error feedback, owner-only actions and responsive text/actions. |
| `supabase/migrations/20261118091000_owner_only_tenant_manager_access.sql` | Extend the existing unapplied #423 migration to close demonstrated SQL/seat/direct-write gaps; no additional competing migration. |
| `tests/helpers/team-access-database.mjs`, `tests/tenant-team-access-{database,concurrency,api}.test.*` | Synthetic schema plus actual SQL execution, real concurrent PostgreSQL sessions and runtime authorization/provider-call prevention. |
| `tests/team-access/*`, `playwright.team.config.ts`, `.github/workflows/team-access.yml` | Six-width real rendered browser tests and repeatable isolated CI. No image artifacts are publicly uploaded. |
| `package.json` | Register existing-draft and new behavioral tests in support/targeted commands. |
| Existing manager/membership source-contract tests and Hotel manager fixture | Preserve scope/removal/revoked-session checks while following the explicit owner-only guard and new labels. |
| Existing Real Estate customer-service-window fixture | Baseline reproduced a missing normalizer dependency and outdated blank-parameter error assertion; load the real pure normalizer, retain mocked network and all delivery-blocking assertions. Production messaging source is unchanged. |
| `tests/responsive/fixture-data.cjs` | Include selected role organization ID to match the real membership query. |
| `tests/supabase-migration-ledger.test.mjs` | Explicitly register only this reviewed pending migration; do not mark it applied or rewrite the production snapshot. |

## Verification boundaries and commands

Use the final PR description for exact final CI commit and preview. Local command logs are under `/tmp/team-*.log`; browser results and screenshots are under `test-results/` (ignored).

- `npm run test:team-access`: six runtime API cases and the SQL behavior suite, plus existing draft guard contracts. No real provider functions execute.
- `TEAM_TEST_DOCKER_CONTAINER=<isolated-name> node --test tests/tenant-team-access-concurrency.test.mjs`: PostgreSQL 17 in an ephemeral `--network none` container, separate real sessions competing for final capacity. Covers invite/invite, invite/approval, approval/approval, invite/reactivation and parallel reserved-seat acceptance.
- `npm run test:support`, `npm run test:maia`, `npm run test:real-estate`, `npm run test:xposure-dashboard`, `npm run test:hotel-setup`, `npm run test:billing`: existing business, tenant, agent and billing regressions. Initial failures and corrective reruns are reported in final results, not hidden.
- Changed-file ESLint, repository ESLint inventory, `npx tsc --noEmit`, `npm run build` and `git diff --check` run separately. The production build does not deploy anything.
- `TEAM_CAPTURE_BEFORE=1 TEAM_TEST_APP_ROOT=/tmp/flux-team-before npx playwright test --config playwright.team.config.ts`: original #423 source at `17f1c2f`, 12 owner/manager captures at all six widths; new-only states skipped intentionally. These are audit captures, not approved baselines.
- `TEAM_TEST_APP_ROOT=/tmp/flux-team-build npx playwright test --config playwright.team.config.ts`: updated source, 42 cases: owner actions, manager read-only controls, loading/error/retry and four existing industry overviews at 360/430/768/1024/1440/1920px. Reduced motion and 125% CSS zoom are checked; CSS zoom is not native browser chrome zoom certification.
- Existing industry screenshot comparisons run without updating any approved baseline. All fixtures inherit synthetic credentials only and block external traffic and writes, except locally fulfilled browser actions and explicitly read-only RPCs.

## Migration and release gates

1. Review this exact migration and commit alongside #422. Do not run `supabase db push` on the whole historical directory: the ledger snapshot is stale and unrelated pending/version-renamed migrations exist (including open #273).
2. Production plan catalog currently has no explicit `team.seats` rows. Preserve `organization_effective_seat_limit` and its established effective-entitlement/fallback behavior. Commercial owners must confirm intended plan allowances; no prices or seat values are invented here.
3. Obtain separate explicit production migration/release approval. This migration deliberately removes existing non-owner administrative permissions, so review any existing customized roles before deployment. Do not copy member/customer records into public artifacts.
4. Apply only the reviewed migration transactionally in an approved release window. Verify function signatures, service-only execute grants, table mutation restrictions and owner access using approved test accounts. No production migration has been executed in this work.
5. Release the application only with compatible migrated database behavior, then validate owner invitation/acceptance, request review, cancellation and revoked-session behavior using dedicated accounts without communications or billing. Hosted authenticated acceptance is still outstanding.

Rollback: retain the exact pre-release Vercel deployment and database function/ACL snapshot in secure operational storage. RPC signatures remain compatible, so an application rollback can retain the stricter owner/seat SQL rather than reopening public grants or restoring delegable powers. Reverting role-permission cleanup or widening access requires separate security review; do not automatically restore the unsafe legacy grants. No customer data or accounts are deleted by migration application.

## Design and remaining limitations

The existing purple design system and industry workflows remain. Before/after images are local synthetic evidence, not stakeholder-approved visual baselines. Public screenshot publication remains outside the established approval boundary.

The [12ui skill](skill://plugins_6a8915941e8c8191ae58d10e41cc322f/12ui-design/SKILL.md) requires: “For every non-trivial completed design implementation, close against the original approved design.” Its account connection is missing in this workspace and has been requested. No new reference/alignment kit is claimed. This does not prevent the authorized security corrections; design closure remains an explicit validation gap.

This does not certify full provider delivery, actual customer billing, every native browser zoom/accessibility scenario, production data cleanup or all nine phases as complete. Those are separate acceptance/release gates. No migrations, production merges/deployments, account enrollment, customer-data writes, live campaigns, emails or voice calls were performed.

## Recorded local results

- SQL behavior: 21 scenarios passed (22 including the parent test); six API/runtime cases passed. Five actual PostgreSQL concurrency scenarios passed (six including parent). The final owner-reactivation safeguard was included in the SQL/concurrency rerun.
- Support: 72 test files passed; Maia: 22; Real Estate: 49; Photography: 6; Hotel setup: 11; billing: 3. Existing revoked-session, cross-tenant request and provider-call blocking assertions remain.
- New responsive suite: **42/42 passed**. Before audit: **12 captured, six new-only cases intentionally skipped**. The initial after run had six identical test-selector failures caused by the framework route announcer sharing `role=alert`; the application alert selector was scoped and all 42 cases passed on a fresh run.
- Real Estate baseline initially failed on an unmocked existing normalizer dependency; the unchanged baseline reproduced it. After repairing the fixture and blank-variable assertion, the entire 49-file suite passed. No messaging implementation was changed.
- Changed-file lint, type checking, production build and whitespace validation passed. Full-repository ESLint completed with 491 errors and 74 warnings; the existing main baseline had 492 errors and 74 warnings. Unrelated lint debt is not presented as passing.
- New images remain local under `test-results/team-evidence/{before,after}/`; names include owner/manager/error/industry and viewport width. These are real rendered synthetic Next.js pages. No customer records, live microphone or provider sessions were used.
