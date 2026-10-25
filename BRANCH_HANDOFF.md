# Limitless Realty release checkpoint

**Updated:** 25 October 2026 20:18 Europe/London

**Branch:** `integration/limitless-realty-production-20261025`

**PR:** [#281](https://github.com/limitlessnx/agent-website-2/pull/281), open against `main`

**Latest code-bearing checkpoint:** `4ca3bb4b96c569e3f89c4962e0345150041d0422`

## Branch checks and Preview

At code-bearing checkpoint `4ca3bb4`, exact-head tenant-neutral PR check `40225114836` and push check `40225112062` passed. Broad Maia `verify-maia` and `regression` jobs were skipped with empty step lists for this branch. Vercel Preview `dpl_8F4BJemCCTmyVH3wtNNWVvr9TA8a` is READY. At that checkpoint, PR checks reported four successful, three skipped, none pending, with merge state CLEAN. This validates branch build/tests only—not Supabase runtime behavior. The handoff/status follow-up itself is documentation-only; verify the actual latest PR head before any merge. PR #281 remains unmerged.

## Implemented candidate and validation

The tenant-neutral `npm run test:real-estate` suite passes **190/190**; focused real-estate PGlite tests pass **11/11**, and the new authorization-core draft tests pass **4/4**. ESLint and `git diff --check` are clean. The auth draft has pg_catalog-only definer paths, explicit `postgres` ownership, active-only self visibility, same-organization role checks, immutable membership/role organization IDs, and SELECT-only browser policies; tests pin the policy-drop list to all nine observed policies. It is a post-schema review candidate, **not a migration and not applied**. No true multi-session PostgreSQL concurrency stress test has been run.

The 21 pending application migrations are sequenced after applied ACL `20261024140349` as `20261024140400`–`20261024142400`; only the atomic-audit helper migration has a later body change (`FOR KEY SHARE` to `FOR SHARE`). None has been applied.

## Staging and Production gate

Same-organization staging project `rwewcnftxnaynpotbsms` still has no public app schema and only non-functional ACL smoke stubs. The bounded read-only preflights returned 166 findings for the original 42-table/60-policy baseline and 50 for 17 transitive tables/16 helpers; no application rows were read and no DDL was applied. The 17-table metadata preview is separate, comment-only, and outside the original allowlist. A dependency-complete baseline, locale/tenant-default decisions, least-privilege grants, readiness-table reconciliation, and privileged staging E2E remain open.

Production remains READY on `main` at `3521ed4`; no merge, Production deployment, broad FLUXNIT migration, Trigger deployment, n8n edit, real provider send, or customer-data copy occurred. The previously authorized FLUXNIT ACL hotfix remains the only database change. Preserve the strict excluded/Xposure tenant boundary.

## Evidence files

- [Staging baseline review](STAGING_BASELINE_REVIEW.md)
- [Staging allowlist manifest](STAGING_BASELINE_MANIFEST.md)
- [Authorization-core draft](STAGING_BASELINE_AUTHZ_CORE_DRAFT.sql)
- [Authorization PGlite tests](tests/staging-core-authorization-pglite.test.mjs)
- [Routine and trigger source review](STAGING_BASELINE_ROUTINE_SOURCE_REVIEW.md)
- [Routine metadata inventory](STAGING_BASELINE_ROUTINE_INVENTORY.md)
- [Read-only dependency preflight](STAGING_BASELINE_DEPENDENCY_PREFLIGHT.sql)
- [17-table comment-only metadata preview](STAGING_BASELINE_DEPENDENCY_METADATA_PREVIEW.sql)
