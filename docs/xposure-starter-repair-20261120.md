# Xposure Photography starter repair — 20 November 2026

## Audit and scope

Latest main fetched: `e930d63663a7272b88e48d52c50e1ae52b118784` (PR #440). Open Gencouv, voice and Flux Social changes were inspected and preserved. Work is isolated on `fix/tenant-starter-repair`.

Read-only production inspection confirmed Xposure's Photography onboarding profile still has an active Computer Service starter. The Photography template already exists. Its original provisioner creates starter drafts and disconnected integration placeholders; it does not deploy workflows externally. The inspected attached user triggers only update timestamps. The original provisioner body matches its migration source exactly.

The workflow registry still uses a shared template namespace, so an existing tenant can own the keys and another receive no workflows. The retry-safe creation overload already completes tenant-UUID registry rows, but is unsuitable for repairing an existing business because it creates an organization. This repair reuses the existing template provisioner and the same tenant-UUID completion convention; it does not add a service, table, grant, migration or public endpoint.

## Changes

- `lib/tenant-readiness-server.ts`: include assignment IDs and recognize paused history only when it references a different, current, active assignment whose active template matches the scoped organization industry. Unresolved paused/failed/provisioning records still block readiness. A foreign/missing replacement cannot exempt an assignment.
- `docs/operations/xposure-photography-starter-repair.sql`: one operator-run, Xposure-scoped atomic data repair. Verify identity/profile/expected assignment, preserve all existing agents/integrations/knowledge/workflows, call the existing Photography provisioner, complete and verify workflow keys in Xposure's namespace, retain the old assignment as paused history with a replacement reference, audit the outcome and assert billing unchanged. Unexpected changes/activation or audit failure roll back everything. The script is not run by deployment or CI and never sends messages.
- `tests/fixtures/tenant-starter-repair/schema.sql`: schema-only production column/default/check/unique snapshot, no customer records or credentials. Foreign keys and external triggers are intentionally omitted; tests are isolated PGlite, not production acceptance.
- `tests/tenant-starter-repair.test.cjs`: execute the actual provisioner and operator script against synthetic IDs, covering shared-key conflicts, newly inserted workflow normalization, existing Maia/configuration preservation, safe replay, audit rollback, conflicting custom workflows, changed profile and unexpected activation.
- Existing readiness tests, browser fixture/spec, package scripts and preset CI: keep this regression in the existing pipelines and show truthful repaired readiness across six widths.

## Verification

- Focused onboarding/readiness/repair/admin regression: **64 passed**, zero skipped.
- Full support suite: **689 passed**, zero skipped. Counts overlap; they are not additive unique-case totals.
- Changed-module ESLint, TypeScript and optimized production build passed.
- Rendered repaired-state browser tests: **6 passed**, at 360, 430, 768, 1024, 1440 and 1920px. Screenshots show the template ready, paused history visible and unfinished agents blocked. The existing [mismatch screenshots](xposure-readiness-evidence/README.md) document the preceding blocked state. These are local synthetic read-only rendered pages, not authenticated Xposure screenshots or stakeholder-approved baselines. Representative 360/1440 screenshots were visually inspected.

## Remaining gates

A correct starter assignment does not activate Xposure. Approved packages/prices/durations/capacity, availability, knowledge, current integration evidence, agent tests and activation approval remain required. Its published Maia is preserved; new starter agents/workflows remain draft. Its separately requested 15-day Plus promotion remains unchanged.

Phase 6 still needs email/voice receipt recovery, verified provider mappings and controlled provider acceptance. Phase 7 still needs coordinated email/voice metering and authenticated owner/manager acceptance. News is the non-customer acceptance organization; no session is forged, real customer/provider test is initiated or call is charged by this increment. This repair does not close either phase or earlier authenticated/visual/accessibility acceptance gates.

## Release and production operation

PR, exact-head hosted verification, preview/deployment and actual repair readback will be recorded after completion. Until that evidence is recorded, the script is prepared/tested only; this document does not claim production configuration was repaired.
