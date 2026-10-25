# Integration branch status

## Branch and CI

The `integration/limitless-realty-production-20261025` branch is based on `origin/main` at `3521ed4`. PR [#281](https://github.com/limitlessnx/agent-website-2/pull/281) is open against `main`; nothing from this branch has been merged. The 21-migration chronology correction is pushed. Latest pushed head `ed86419` had successful tenant-neutral safe run `40215319963`; broad Dashboard Final QA and Maia Draft Verification were skipped with zero steps by exact-source-branch guards. The new preflight and its tests are currently local and still need a fresh PR check and isolated Preview after push.

## Preview and Production

The full-tree Vercel Preview for application commit `0af7682` is READY and passed TypeScript, Next.js production compilation, and generation of 217 static pages. A newer Preview build is associated with the branch; check its current state before treating Preview validation as complete. Production remains READY on `main` at `3521ed4`; this work has made no Production deployment. Forty-three branch-specific Preview overrides still point database aliases to same-organization staging and keep external side-effect credentials inert.

## Migration and database state

The 21 currently unapplied migrations—seven shared current-main migrations plus 14 local app migrations—are ordered after the applied ACL version `20261024140349`, from `20261024140400` through `20261024142400`. A byte comparison confirmed all SQL bodies are unchanged. This is a filename/order correction only; none of these migrations has been applied. The narrowly authorized `workspace_provisioning_acl` migration remains the sole database change made to FLUXNIT; read-back confirmed browser roles cannot execute the workspace/trial provisioning RPCs, while `service_role` can.

Same-organization staging (`rwewcnftxnaynpotbsms`) contains no public app schema, tenant, or customer data; it has only three ACL smoke migrations and non-functional provisioning stubs. The 42-table/60-policy metadata DDL preview remains comment-only and incomplete: helper function bodies, trigger creation, grants, extensions, and tenant-neutral defaults are unresolved. The readiness-relation mismatch and staging migration-history discrepancy remain open. No application-schema DDL has been applied. See [STAGING_BASELINE_REVIEW.md](STAGING_BASELINE_REVIEW.md) and [STAGING_BASELINE_MANIFEST.md](STAGING_BASELINE_MANIFEST.md).

## Validation and operational boundaries

The local tenant-neutral `npm run test:real-estate` suite passed **181/181** after migration re-sequencing, including four new contract tests for the preflight inventory and read-only bounds; focused handoff retry/callback/template-fallback tests passed **29/29**. The [preflight SQL](STAGING_BASELINE_PREFLIGHT.sql) was syntax-checked in ephemeral local PGlite and has not been run against Supabase; it makes no writes and is not a baseline. Changed safe-source ESLint reported **0 errors and 0 warnings across 77 files**. Maia's direct-booking tool requires real-estate operator confirmation before appointment or calendar side effects; non-real-estate tenant validation remains enabled.

No broad FLUXNIT migration, Trigger deployment or execution, n8n change, real provider send, customer-data copy, or Production deployment occurred. The PR #280 workflow scope incident is documented. Preserve the strict excluded/Xposure tenant boundary: do not inspect, modify, test, deploy, or use excluded tenant code, configuration, integrations, workflows, or records.

See [REAL_ESTATE_REVIEW.md](REAL_ESTATE_REVIEW.md), [REAL_ESTATE_PLAN.md](REAL_ESTATE_PLAN.md), [TODO.md](TODO.md), [MAIN_INTEGRATION_REVIEW.md](MAIN_INTEGRATION_REVIEW.md), and [STAGING_BASELINE_DDL_PREVIEW.sql](STAGING_BASELINE_DDL_PREVIEW.sql) for detail.
