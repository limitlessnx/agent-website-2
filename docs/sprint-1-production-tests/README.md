# Production-backed validation without a paid staging plan

The user authorized using the existing production environment for tests on 16 November 2026. An isolated paid staging project is no longer a prerequisite. Existing customer data, public messaging, paid-provider requests, production application deployment, and merge remain outside this testing procedure.

## Completed read-only preflight

- The original seven-argument creation RPC and template provisioner exist and permit only postgres/service_role execution.
- At the original preflight, the eight-argument retry-safe overload was not installed. It has since been applied with separate explicit approval (see the persistent QA section below).
- The creation path's inspected triggers update timestamps, generate an Access ID, and seed default customer stages. The stage seed only inserts tenant-local configuration. No outbound HTTP/provider call was found in the inspected creation functions or their attached user triggers.
- The legacy organization-template catalog has active Real Estate, Customer Service and Computer Service templates. Hotel and Photography starter templates are absent from this catalog; the agent-template catalog has only the published Real Estate sales/support template. Existing customer dashboards were not changed.
- `hotel_tenant_inventory_readiness(uuid)` is not installed. Hotel catalog readiness will fail closed until that existing prerequisite is separately reviewed.
- The workflow registry has a unique `(organization_id text, workflow_key)` index. The existing provisioner writes the shared template slug into this legacy organization_id field and uses `ON CONFLICT DO NOTHING`. All seven Real Estate workflow keys and all five Computer Service keys are already claimed under those shared namespaces. Consequently another tenant created by that old path can receive zero workflow rows despite successful organization creation.
- Readiness-related table/column presence was inspected. This is not a full end-to-end application verification.
- Security advisors were inspected as a baseline. Existing findings include public SECURITY DEFINER access for access-request functions; no policies or grants were changed. [Supabase guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

## Local correction prompted by production evidence

The reviewed retry-safe overload completes missing workflow rows using the new tenant UUID as its legacy registry namespace. It verifies the required count, corrects the returned/assignment creation count, and preserves other tenants' rows. The original seven-argument function remains unchanged. A local PGlite test reproduces the production shared-key conflict and checks two distinct tenants per industry receive their own draft workflow rows, while request replay remains idempotent.

## Reviewable rollback-only test

[rollback-creation.sql](rollback-creation.sql) contains the exact test. It temporarily creates the reviewed overload and restricted grants within one transaction, creates two clearly named synthetic Real Estate tenants, asserts replay/conflict handling, draft/disconnected assets and per-tenant workflow completeness, then rolls everything back. Short lock and statement timeouts are set. It does not invoke the HTTP API, n8n, Trigger.dev, billing, Auth signup, or any messaging service. No existing customer row is selected as a mutation target. The final query verifies neither test tenant nor the overload remains.

## Approved execution result

The first attempt was rejected by automatic approval review because temporary production schema/grant changes were not explicitly authorized. The user subsequently approved this exact test. It executed successfully as one SQL request on 16 November 2026; the SQL file is retained unchanged from that approval, including its historical BLOCKED comment.

All test assertions passed: request replay returned the same tenant/result, conflicting input was rejected, the starter project and agents existed, both distinct test tenants had their required workflow rows, checked agents/workflows stayed draft and integrations disconnected, and anon/authenticated execution was denied.

The transaction ended with `ROLLBACK`. Its final verification returned zero test organizations and no temporary overload. An independent read-only query confirmed the same, plus the original seven-argument function and its restricted permissions remained intact. [Machine-readable evidence and exact script hash](rollback-result.json).

**At the rollback-test checkpoint, persistent production changes were none.** The test temporarily created function/grant/test rows within its transaction and rolled them back. No application deployment, external automation call, customer-data mutation target, messaging request or paid-provider request occurred. The migration was still unapplied at that checkpoint; the subsequent persistent rollout is recorded below.

## Follow-up identified at the rollback checkpoint

1. Prepare a separately reviewed persistent migration and preview test tenant if needed for browser-based failure/retry tests. This rollback-only approval does not authorize those changes.
2. Database rollback assertions do not prove external-provider retries or browser feedback. Keep these acceptance checks open.
3. Keep Hotel/Photography catalog prerequisites explicit; do not copy configuration or business data from existing customers.

## Approved persistent migration and retained QA tenant

The user separately approved permanently applying the tested migration and retaining a dedicated QA tenant for preview tests. Supabase applied `admin_organization_creation_retry_safe` as version `20261116120507`; the repository filename was reconciled to that actual remote version without changing its reviewed SQL. The production ledger snapshot now records this applied version. The original seven-argument creation function and template provisioner hashes match their pre-deployment values, and the new overload denies anon/authenticated execution while allowing service_role.

The retained organization is `48b68a88-bd0a-48d9-b6e2-604e8f1bab9d`, named **FLUXKNIGHT QA — Sprint 1**, with project `d4bbffaf-bd80-42c8-adcf-a4d54c61c6a5`. It has seven draft workflow rows, draft agents, disconnected integrations and no real contact destination or subscription. Its project carries `qa_outbound_disabled: true`; the existing provisioner now checks this marker before any provider operation and reports an explicit QA-blocked needs-attention outcome. The guard is tested and does not simulate successful deployment.

Preview authentication uses temporary credentials scoped only to `feat/sprint-1-tenant-readiness`. Production credentials are unchanged. Preview access uses a short-lived deployment share link and the `_vercel_share` cookie exchange; no deployment-protection setting was disabled. One temporary preview-access token appeared in diagnostic output during setup; it was immediately revoked and replaced without logging the replacement.

Hosted validation also identified and corrected two integration defects on the branch: the creation wizard was not mounted by any route, and the retry route queried a nonexistent organizations.settings column. The existing wizard is now available at `/dashboard/clients/create` with a link from the clients page; retry uses organizations.metadata for the saved timezone. These application changes are preview-only until separately approved for production release.

## Hosted results and cleanup

The authenticated hosted wizard replay, saved-tenant retry, readiness endpoint, six required widths and in-progress feedback checks passed. [Hosted results](hosted/results.json), [in-progress scenario](hosted/in-progress.json), and [persistent QA evidence](persistent-qa-result.json). The in-progress marker was reset; no real worker started.

Temporary preview login overrides were rotated and detached from the active branch after testing. Vercel forbids renaming sensitive variables and the connector has no delete tool, so three dormant records remain scoped to a deleted, temporary retirement branch. Active feature preview has zero temporary login overrides and again inherits the shared login configuration on its next deployment. Private credential/session files were deleted. Active browser-test access links were revoked or confirmed absent. No production credential changed.

The production database now intentionally retains the approved migration and one marked QA tenant; the earlier rollback-only checkpoint is historical. Production application deployment/merge and live-provider tests remain unapproved. See the [current full report](../sprint-1-implementation.md) for remaining industry and visual-refinement prerequisites.
