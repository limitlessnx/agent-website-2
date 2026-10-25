# Current-main integration and release-readiness review

- **Captured:** 25 October 2026, 20:02 +06:00
- **Repository:** [`limitlessnx/agent-website-2`](https://github.com/limitlessnx/agent-website-2)
- **Remote main:** `3521ed4bbfb25f0c57a376ec8b1015a7c58467e9`
- **Local branch:** `integration/limitless-realty-production-20261025` (based on current main; unpublished)
- **Local workspace:** `/home/ubuntu/Fluxknight/limitless realty`

## Integration result

The current local branch is based on the fetched `origin/main` SHA above and preserves its shared dashboard, package-script and Maia runtime changes. The repair checkpoint was integrated locally after resolving shared-file conflicts; no force reset or remote update occurred. The latest remote check found no PR for this branch. **Nothing from this branch has been pushed, opened as a PR, merged, or deployed.**

During the first integrated local test attempt, upstream source-pattern tests loaded some out-of-scope tenant-specific admin-route source. This was unintended. After discovering it, those tests were removed from the local safe target, the upstream test files were restored unchanged, and locally materialized route copies were removed. Tenant-neutral replacements now exercise only shared scheduler/schema behavior. No route request, tenant record, tenant integration record, workflow, or customer message was accessed; no source details are repeated. A separate baseline-source triage also stopped when out-of-scope tenant-specific material appeared in a generic-named migration; that content was not copied, summarized, tested, or applied.

## Current shared production state

- The latest Vercel production deployment is **READY** on `main` at `3521ed4`. The successful GitHub commit status for that SHA is Vercel. This deployment was already live; it was not initiated by this repair work.
- No GitHub Actions run is associated with the exact `3521ed4` SHA. In particular, a current-SHA Trigger deployment is not verified; no Trigger task schedule, run history, credentials, or live execution was inspected in this step.
- Read-only Supabase metadata queries on FLUXNIT (`tacxegmlppngnuvldojy`) and staging (`rwewcnftxnaynpotbsms`) returned **none** of the seven named main reminder/provisioning migration versions (`20261021180000`, `20261022090000`, `20261022100000`, `20261022120000`, `20261022130000`, `20261022140000`, `20261022160000`) and **none** of the specifically queried reminder tables.
- The approved FLUXNIT ACL migration `workspace_provisioning_acl` (`20261024140349`) remains the only production database change from this work. It was verified separately; no provisioning RPC or app migration was executed.
- The staging project remains an ACL smoke-test target with non-functional provisioning stubs and no application schema, tenant, or customer data. The 42-table/60-policy DDL artifact is fully commented, omits functions/triggers/grants, and preserves defaults requiring tenant-neutral review; it is not a runnable baseline.

The absence of the shared reminder schema from both checked projects is a deployment-order/runtime-readiness risk for the reminder features on current main. Do not attempt a broad FLUXNIT migration to address it: first complete and validate the isolated staging baseline.

## Vercel Preview safety blocker

A read-only Vercel project/environment inventory with decryption disabled showed that the Preview target shares Production-target Supabase and integration environment-variable assignments, including database and messaging/automation categories. No plaintext values were requested or saved. A branch push or PR could create a preview deployment with access to live services; the current Preview is therefore **not isolated**. No branch is being published until Preview variables are safely separated from production and pointed at a usable staging setup. No Vercel project settings or variables were changed.

## Local changes and validation

The integration branch adds and preserves the following shared safeguards:

- Tenant-composite uniqueness and foreign keys across reminder executions/notifications and appointment reminders, plus a non-null reminder idempotency key; PGlite coverage tests the ordered shared migrations and integrity constraints.
- A reusable organization-industry gate in Maia's shared direct-booking tool. Active real-estate organizations receive `operator_confirmation_required` before appointment queries or calendar-provider side effects, preserving the operator-confirmed inspection workflow; a regression test covers the bypass.
- Human-handoff compare-and-set claim/resolve transitions, strict receipt RPC result validation, tenant-bound callbacks, bounded retry, and compliant WhatsApp template fallback.
- Safe local reminder tests are separate tenant-neutral files; upstream tenant-specific reminder tests are restored unchanged and are not in the local safe test target.

Latest local checks: `npm run test:real-estate` **171 passed / 0 failed**; changed-source ESLint **75 files, 0 errors / 0 warnings**; scoped TypeScript **73 safe application sources, 0 diagnostics**. Full project `tsc`, `npm run build`, and Next compile-only build cannot complete in this intentionally sparse worktree because a shared dashboard import references an omitted out-of-scope component. No complete application build is claimed. No browser/device review, staging app-schema E2E, live calendar/scheduler/provider run, or real message test occurred.

## Readiness gates before any remote publish or production merge

1. Isolate Vercel Preview from Production database, messaging, automation, payment and other live integration variables; establish safe staging-only assignments.
2. Build a complete tenant-neutral staging schema baseline from explicitly safe sources, resolve the readiness-relation mismatch, and prepare/test an executable migration sequence. Keep the existing DDL preview comment-only; show exact DDL before any staging write.
3. Apply and validate migrations on staging in order, use fictional tenants/users only, then run end-to-end flows for Maia inspection request → operator confirmation → calendar event → reminders, campaign preview/approval, handoff → receipt → template fallback, and onboarding retry/isolation.
4. Verify Trigger deployment and scheduled-task status for the intended commit, plus a complete non-sparse build and required CI checks, without inspecting or running tenant-specific code locally.
5. Only after these gates pass, prepare a reviewed PR. Production merge/deploy and broad FLUXNIT migrations remain not ready.

## Source links

- GitHub current-main commit: https://github.com/limitlessnx/agent-website-2/commit/3521ed4bbfb25f0c57a376ec8b1015a7c58467e9
- Vercel current-main production deployment: https://vercel.com/fluxagents/limitlessnx-agent-website-2/dpl_CfkrmvxvR1ZZMgWN5x5dDPaZB2Dg
- FLUXNIT Supabase project: https://supabase.com/dashboard/project/tacxegmlppngnuvldojy
- Isolated same-organization staging project: https://supabase.com/dashboard/project/rwewcnftxnaynpotbsms
- Detailed application review: [REAL_ESTATE_REVIEW.md](REAL_ESTATE_REVIEW.md)
- Staging baseline review: [STAGING_BASELINE_REVIEW.md](STAGING_BASELINE_REVIEW.md)


## 2026-10-25 Preview isolation mechanics

Vercel documents that Preview variables may be scoped to a specific Git branch and that branch-specific values override default Preview variables with the same key; other branches retain their default Preview values. Changes apply to new deployments, not existing ones. Source: https://vercel.com/docs/environment-variables

Vercel documents that an Ignore Build Step exits with code 0 to skip a build and code 1 to continue; `commandForIgnoringBuildStep` is a project setting, and `vercel.json` may override it for a deployment. Source: https://vercel.com/docs/project-configuration/vercel-json

The integration branch is not yet present in the connected Git repository. Vercel rejected creation of its branch-scoped environment variables with HTTP 400 and reported no branch match; no Preview variables were created by that attempt. The project has no custom environments. The Supabase MCP provides the staging URL and publishable/anon keys but does not expose a staging service-role key; any Preview server-key alias must therefore remain restricted to the staging anon key until a least-privilege server credential is obtained. A project-wide Preview shutdown was not used. A temporary `vercel.json` guard that skips only this exact branch's first Vercel build is being evaluated; it has not yet been added or pushed.


Vercel's Git configuration documentation confirms that `git.deploymentEnabled[branch] = false` suppresses automatic deployments for that branch, while unspecified branches remain enabled; branch patterns are also supported. Source: https://vercel.com/docs/project-configuration/git-configuration

The safe bootstrap is branch-local: add one `false` entry for this integration branch, push it so Vercel indexes the branch without starting a Preview build, create the branch-specific staging overrides, then remove the entry and push again. This sequence changes no shared project setting and leaves every other branch rule unchanged.
