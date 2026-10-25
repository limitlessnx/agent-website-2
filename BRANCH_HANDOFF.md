# Integration branch status

## Branch and CI

The `integration/limitless-realty-production-20261025` branch is based on `origin/main` at `3521ed4`. PR [#281](https://github.com/limitlessnx/agent-website-2/pull/281) is open against `main`; nothing from this branch has been merged. The 21-migration chronology correction and read-only baseline preflight are pushed. Current code head `a0ea24d` passed tenant-neutral PR check `40217496426` and push check `40217492257`; broad Dashboard Final QA and Maia Draft Verification were skipped with zero steps by exact-source-branch guards. The isolated Vercel Preview for `a0ea24d` was still BUILDING at the last status read; check the current state before any merge decision.

## Preview and Production

The full-tree Vercel Preview for application commit `0af7682` is READY and passed TypeScript, Next.js production compilation, and generation of 217 static pages. The later branch Preview for `a0ea24d` was BUILDING at the last read; it is still build-only and cannot validate privileged runtime flows because staging has no app schema or service-role key. Production remains READY on `main` at `3521ed4`; this work has made no Production deployment. Forty-three branch-specific Preview overrides still point database aliases to same-organization staging and keep external side-effect credentials inert.

## Migration and database state

The 21 currently unapplied migrations—seven shared current-main migrations plus 14 local app migrations—are ordered after the applied ACL version `20261024140349`, from `20261024140400` through `20261024142400`. A byte comparison confirmed all SQL bodies are unchanged. This is a filename/order correction only; none of these migrations has been applied. The narrowly authorized `workspace_provisioning_acl` migration remains the sole database change made to FLUXNIT; read-back confirmed browser roles cannot execute the workspace/trial provisioning RPCs, while `service_role` can.

Same-organization staging (`rwewcnftxnaynpotbsms`) contains no public app schema, tenant, or customer data; it has only three ACL smoke migrations and non-functional provisioning stubs. The 42-table/60-policy metadata DDL preview remains comment-only and incomplete: helper function bodies, trigger creation, grants, extensions, and tenant-neutral defaults are unresolved. The readiness-relation mismatch and staging migration-history discrepancy remain open. No application-schema DDL has been applied. See [STAGING_BASELINE_REVIEW.md](STAGING_BASELINE_REVIEW.md) and [STAGING_BASELINE_MANIFEST.md](STAGING_BASELINE_MANIFEST.md).

## Validation and operational boundaries

The local tenant-neutral `npm run test:real-estate` suite passed **181/181** after migration re-sequencing, including four contract tests for the preflight inventory and read-only bounds; focused handoff retry/callback/template-fallback tests passed **29/29**. The [preflight SQL](STAGING_BASELINE_PREFLIGHT.sql) parsed in ephemeral local PGlite and was run read-only against staging: it returned 166 catalog findings (42 missing tables, 42 corresponding RLS-not-enabled findings, 60 missing policies, 10 missing core helper names, 12 missing trigger helper names), with no provisioning RPC ACL violations or unexpected forced RLS. The three non-functional provisioning smoke stubs satisfy only name/ACL presence checks; no application data rows were read and no DDL was run. Changed safe-source ESLint reported **0 errors and 0 warnings across 77 files**. Maia's direct-booking tool requires real-estate operator confirmation before appointment or calendar side effects; non-real-estate tenant validation remains enabled.

No broad FLUXNIT migration, Trigger deployment or execution, n8n change, real provider send, customer-data copy, or Production deployment occurred. The PR #280 workflow scope incident is documented. Preserve the strict excluded/Xposure tenant boundary: do not inspect, modify, test, deploy, or use excluded tenant code, configuration, integrations, workflows, or records.

See [REAL_ESTATE_REVIEW.md](REAL_ESTATE_REVIEW.md), [REAL_ESTATE_PLAN.md](REAL_ESTATE_PLAN.md), [TODO.md](TODO.md), [MAIN_INTEGRATION_REVIEW.md](MAIN_INTEGRATION_REVIEW.md), and [STAGING_BASELINE_DDL_PREVIEW.sql](STAGING_BASELINE_DDL_PREVIEW.sql) for detail.
