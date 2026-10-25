# Current-main integration and release-readiness review

- **Captured:** 25 October 2026, 20:35 +06:00
- **Repository:** [`limitlessnx/agent-website-2`](https://github.com/limitlessnx/agent-website-2)
- **Remote main:** `3521ed4bbfb25f0c57a376ec8b1015a7c58467e9`
- **Integration branch:** `integration/limitless-realty-production-20261025`; application commit `0af7682b7392b5b32f944ea2cdab91d28ed6ba3f` has a READY isolated Preview; draft PR #280 is closed and no PR is open.
- **Local workspace:** `/home/ubuntu/Fluxknight/limitless realty`

## Deployment result

The branch-specific Vercel Preview for `0af7682` is **READY** (`dpl_FtikbJ7hBAeDaLE8Bb5A3swgRaCb`), and its GitHub Vercel status is success. The full-tree build passed the prebuild TypeScript check, Next.js compilation, Next.js TypeScript phase, and generation of 217 static pages. It is an isolated Preview, not a Production deployment. The current Production deployment remains **READY** on `main` at `3521ed4`; this work did not change Production.

An earlier Preview attempt (`9c615d2`) failed the full-tree type check because two shared Leo call sites passed arguments in the wrong positions. The issue was corrected on `0af7682` by passing the resolved tenant organization ID and bounded result limit; six tenant-scope regressions were added. The subsequent full Preview build passed.

The Preview's build-event stream also returned a route inventory containing some out-of-scope route names; no route source was opened and no endpoint was requested. Earlier, upstream local source-pattern tests inadvertently loaded out-of-scope route source; the safe target was narrowed, upstream tests restored, and local copies removed. **Additional incident (25 October):** draft PR #280 was opened then closed after an unexpected PR-triggered workflow completed a lint step against out-of-scope source and failed at its next step; later test/build steps were skipped. That automated lint read source that should have remained out of scope. The agent did not receive those source contents. No tenant rows, integration records, credentials, customer messages, route requests, or Production changes occurred. PR #280 remains closed; PR #281 is open with narrow branch-only job guards and a dedicated tenant-neutral check.

## Branch, CI, and merge status

The branch is based on the fetched production `main` SHA above and preserves the shared dashboard, package-script, and Maia runtime changes. PR #281 is open against `main`; nothing is merged, and no application code from this branch has been deployed to Production.

A dedicated `Limitless Realty safe checks` workflow runs only `npm run test:real-estate` on branch pushes and PRs to `main`. PR #281's dedicated safe check completed successfully; `Dashboard Final QA` and `Maia Draft Verification` are skipped only for this exact integration source branch by narrow job-level guards, while their existing behavior remains for other branches. PR #280 remains closed after the documented scope incident. No excluded tests are run by the dedicated safe workflow.

## Supabase and scheduler state

- The approved FLUXNIT migration `workspace_provisioning_acl` (`20261024140349`) remains the only production database change from this work. Read-back confirmed browser roles cannot execute the workspace/trial provisioning RPCs and `service_role` can. No provisioning RPC or application-schema migration was run in Production.
- Read-only migration checks on FLUXNIT (`tacxegmlppngnuvldojy`) and same-organization staging (`rwewcnftxnaynpotbsms`) found none of the seven named main reminder/provisioning migrations (original versions `20261021180000` through `20261022160000`) and none of the specifically queried reminder tables. The branch now sequences all 21 unapplied migrations—seven shared main migrations plus 14 local app migrations—as `20261024140400` through `20261024142400`, after the applied production ACL version; SQL bodies are unchanged. This is a filename/order correction only, not an apply.
- Staging still contains only non-functional ACL smoke-test RPC stubs, with no public application tables, tenant, or customer data. The allowlisted preview has 42 table definitions and 60 policy statements, all commented out; it omits function bodies, triggers, grants, extensions, and data and is not a runnable baseline.
- The unresolved readiness relation mismatch (`agent_readiness_snapshots` absent; `agent_runtime_readiness` present) and independent staging migration history must be reconciled before application schema validation.
- No Trigger deployment/run or live schedule was verified for this branch. No n8n workflow was changed, no calendar/provider callback was executed, and no real message was sent.

## Preview isolation

Vercel's default Preview assignments included Production-target database and integration variables. Forty-three branch-scoped Preview overrides now apply only to this integration branch: Supabase endpoints/public keys point to the same-organization staging project; server/service-key aliases use only the staging anon key, preserving RLS and intentionally denying service-role privilege; database URLs use localhost; external AI, payment, email, Google, n8n, workflow, and admin credentials are inert placeholders. Production and other branches' Preview assignments were not edited. No plaintext Production values were requested or saved. The Preview SSO protection remains enabled. No least-privilege staging service-role key is available through the current connector, so privileged end-to-end actions remain unavailable.

## Local validation

- Tenant-neutral `npm run test:real-estate`: **177 passed, 0 failed**; fixtures and provider boundaries are mocked or fictional.
- Focused handoff retry/callback/template-fallback tests: **29 passed, 0 failed**.
- Changed safe-source ESLint: **77 files, 0 errors, 0 warnings**.
- Full local sparse-worktree TypeScript check has one unresolved missing import only because the intentionally excluded component is absent; it has **zero in-scope diagnostics**. The complete, non-sparse Vercel Preview build passed TypeScript and Next.js production compilation.
- PGlite exercises the reviewed local migration sequences and tenant constraints, but does not prove compatibility with a complete Supabase baseline.
- No browser/device review, staging app-schema E2E, live calendar/scheduler/provider run, or real-message test occurred.

## Gates before PR or Production release

1. Prepare and locally validate a complete tenant-neutral staging baseline from safe reviewed sources; keep the current DDL preview comment-only until exact executable DDL and helper/trigger/grant contracts are reviewed.
2. Resolve the readiness-relation mismatch and staging-versus-repository migration-history discrepancy; do not apply broad migrations to FLUXNIT.
3. Obtain a least-privilege staging server credential, then test fictional-tenant onboarding, Maia intent → operator confirmation → calendar event → reminders, campaign preview/approval, handoff → receipt → template fallback, and tenant isolation.
4. Verify Trigger deployment/schedules for the intended commit and a CI workflow path that does not run excluded-tenant tests.
5. PR #281 is open for code review and tenant-neutral checks, but it is not ready to merge while the staging baseline, privileged staging validation, and remaining release gates are unresolved. Production application deployment and broad FLUXNIT schema changes are not ready.

## Source links

- [Current main commit](https://github.com/limitlessnx/agent-website-2/commit/3521ed4bbfb25f0c57a376ec8b1015a7c58467e9)
- [Integration branch](https://github.com/limitlessnx/agent-website-2/tree/integration/limitless-realty-production-20261025)
- [Current Production deployment](https://vercel.com/fluxagents/limitlessnx-agent-website-2/dpl_CfkrmvxvR1ZZMgWN5x5dDPaZB2Dg)
- [FLUXNIT Supabase project](https://supabase.com/dashboard/project/tacxegmlppngnuvldojy)
- [Same-organization staging project](https://supabase.com/dashboard/project/rwewcnftxnaynpotbsms)
- [Detailed real-estate review](REAL_ESTATE_REVIEW.md)
- [Staging baseline review](STAGING_BASELINE_REVIEW.md)
- [Staging object manifest](STAGING_BASELINE_MANIFEST.md)
- [Comment-only DDL preview](STAGING_BASELINE_DDL_PREVIEW.sql)
- Vercel branch-specific environment precedence: https://vercel.com/docs/environment-variables
- Vercel per-branch deployment settings: https://vercel.com/docs/project-configuration/git-configuration
