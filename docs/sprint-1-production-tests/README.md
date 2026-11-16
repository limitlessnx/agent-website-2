# Production-backed validation without a paid staging plan

The user authorized using the existing production environment for tests on 16 November 2026. An isolated paid staging project is no longer a prerequisite. Existing customer data, public messaging, paid-provider requests, production application deployment, and merge remain outside this testing procedure.

## Completed read-only preflight

- The original seven-argument creation RPC and template provisioner exist and permit only postgres/service_role execution.
- The proposed eight-argument retry-safe overload is not installed.
- The creation path's inspected triggers update timestamps, generate an Access ID, and seed default customer stages. The stage seed only inserts tenant-local configuration. No outbound HTTP/provider call was found in the inspected creation functions or their attached user triggers.
- The legacy organization-template catalog has active Real Estate, Customer Service and Computer Service templates. Hotel and Photography starter templates are absent from this catalog; the agent-template catalog has only the published Real Estate sales/support template. Existing customer dashboards were not changed.
- `hotel_tenant_inventory_readiness(uuid)` is not installed. Hotel catalog readiness will fail closed until that existing prerequisite is separately reviewed.
- The workflow registry has a unique `(organization_id text, workflow_key)` index. The existing provisioner writes the shared template slug into this legacy organization_id field and uses `ON CONFLICT DO NOTHING`. All seven Real Estate workflow keys and all five Computer Service keys are already claimed under those shared namespaces. Consequently another tenant created by that old path can receive zero workflow rows despite successful organization creation.
- Readiness-related table/column presence was inspected. This is not a full end-to-end application verification.
- Security advisors were inspected as a baseline. Existing findings include public SECURITY DEFINER access for access-request functions; no policies or grants were changed. [Supabase guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

## Local correction prompted by production evidence

The unapplied retry-safe overload now completes missing workflow rows using the new tenant UUID as its legacy registry namespace. It verifies the required count, corrects the returned/assignment creation count, and preserves other tenants' rows. The original seven-argument function remains unchanged. A local PGlite test reproduces the production shared-key conflict and checks two distinct tenants per industry receive their own draft workflow rows, while request replay remains idempotent.

## Reviewable rollback-only test

[rollback-creation.sql](rollback-creation.sql) contains the exact test. It temporarily creates the reviewed overload and restricted grants within one transaction, creates two clearly named synthetic Real Estate tenants, asserts replay/conflict handling, draft/disconnected assets and per-tenant workflow completeness, then rolls everything back. Short lock and statement timeouts are set. It does not invoke the HTTP API, n8n, Trigger.dev, billing, Auth signup, or any messaging service. No existing customer row is selected as a mutation target. The final query verifies neither test tenant nor the overload remains.

**Not executed.** Automatic approval review rejected the first proposed rollback-only execution because it included production `CREATE OR REPLACE FUNCTION` and `REVOKE/GRANT`; production testing authorization did not explicitly cover temporary schema and privilege changes. No alternate route was used to apply that SQL. Explicit approval for this exact temporary test is required.

A separate read-only query after rejection confirmed zero test organizations and that the overload remains absent. No persistent production schema, grant, customer-data, or application change was performed.

## After approval

1. Execute the reviewed SQL as one request and verify rollback results. Do not apply any other pending migration.
2. Stop on failed assertions and fix the branch locally.
3. Prepare a separate concrete request for a persistent migration/preview test tenant if needed for browser-based failure/retry tests. Database rollback tests cannot prove external-provider retries or browser feedback.
4. Keep Hotel/Photography catalog prerequisites explicit; do not copy configuration or business data from existing customers.
