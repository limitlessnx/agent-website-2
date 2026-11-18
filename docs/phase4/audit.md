# Phase 4 architecture audit

Base main: `ae2a41f9031544f340ae9144bc79fb0c72819b8b`, inspected 18 November 2026 (Africa/Lagos). Repository fetched before changes. Open PRs include Maia dispatch recovery #418, ElevenLabs bridge #411, brand film #407 and multiple Flux Social/Real Estate fixes. These remain separate; do not merge or overwrite them.

## Existing and preserved architecture

Earlier onboarding, purple foundation and settings/motion work is present in main, including normal-account admin authorization, readiness checks, safe retry paths, shared tokens/primitives, scoped tenant preview and responsive test fixtures. Source/history presence is not a claim of fresh authenticated production acceptance. Relevant tests and builds must be rerun for this phase. Production currently has newer Maia voice work, which this branch preserves.

- `lib/admin-auth.ts` authorizes verified account identities against the platform-admin registry, while retaining legacy shared-credential recovery. Account mode carries userId; legacy sessions have email/name only. Tenant membership remains separate.
- `AdminSidebar` and `navigationConfig.ts` own primary navigation. `WorkspaceRail` is contextual quick access, not another complete sidebar. Current groups cover Overview/Clients/Systems/Operations/Billing/Security, with overlapping destinations and incomplete platform operator organization.
- `admin-organization-context.ts` represents system/tenant selection; `admin-organization-scope.ts` resolves actual organization identity. Fluxknight, Limitless Realty and Gencouv are existing system entries. The selection cookie is not authentication or tenant membership.
- `/dashboard/clients` provides existing tenant setup/manage/inspect access; `/dashboard/organizations` currently provides a static internal-brand registry. `/dashboard/control-center` is an existing lifecycle analytics page and must remain compatible.
- `tenant-readiness-server.ts`, `n8n-organization-provisioning.ts` and existing readiness/retry routes are the authoritative provisioning infrastructure. Reuse rather than duplicate them.
- `platform-engine.ts` reads actual integration records and errors. Platform provider configuration must remain distinct from customer credentials and verified connection health. Return/render only whitelisted non-secret fields.
- Existing activity, health, agent operations, workflow, voice/email and Leo diagnostic surfaces should be linked/consolidated, preserving their pipelines and action approvals.

## Verified source defects and risks

1. The context POST requires admin access but does not validate a tenant identifier against the database or record the switch. This is an invalid/nonexistent-context and auditability gap; it is not proof that ordinary tenant users can become admins.
2. Internal organization classification is inconsistent: fixed system slugs in context code versus display-name substring heuristics in Leo workspace portfolio. A customer name containing an internal brand can be misclassified. Review downstream policy and use one exact trusted classification boundary.
3. Agent Operations ignores query errors, uses 100% success for zero runs, and counts non-failed pending work as successful. Missing evidence must not become healthy/complete.
4. Static owned-organization counts describe configured brands rather than live organization records. Context selection, management, preview and live membership access require explicit labels.
5. Primary navigation lacks distinct Onboarding/Provisioning and Communications sections, and must retain all established routes and internal dashboards.
6. Legacy shared credentials lack individual actor IDs. Preserve current access while recording authentication mode/email and verified account IDs where available; no auth replacement or role migration is authorized.

## Implementation boundaries

Create a read-only platform control-center projection and consolidate navigation around existing routes/readers. Reuse readiness/setup/retry actions, billing and monitoring. Validate context changes and record sensitive admin actions using the existing audit schema; do not create another audit/provisioning/billing system. Add failure/unknown states and bounded sample labels. Preserve separate tenant permissions and all industry operational routes.

Use approved Phase 2/3 purple primitives and original logos. Test synthetic fixtures at all six widths with outbound mutations blocked. Never start a provider call, disconnect a real integration, send communications, mutate customer data, merge main or deploy production for this phase.

## Environment limitations

GitHub CLI token is invalid, but the connected GitHub API works. Public clone succeeded through the permitted network environment. Publishing can use the connected Git data/PR tools rather than requesting credentials. No browser-control/desktop JavaScript tool is currently exposed for an authenticated hosted session; local repeatable browser tests and hosted build/reachability evidence must be distinguished from authenticated hosted acceptance.
