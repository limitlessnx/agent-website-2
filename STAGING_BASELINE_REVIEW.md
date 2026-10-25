# Limitless Realty staging baseline review

**Date:** 25 October 2026 (follow-up)
**Status:** Dependency review complete; no application-baseline DDL has been applied.
**Staging project:** `Limitless Realty Staging` — `rwewcnftxnaynpotbsms`, same Supabase organization as FLUXNIT, `eu-north-1`, active/healthy, quoted at $0/month.

## Scope and safety boundary

This review covers generic real-estate feature migrations and specifically named platform dependencies. It does not copy production tenant/customer rows, execute application provisioning RPCs, send messages, or change FLUXNIT beyond the already approved and verified ACL migration. During an initial local suite run, upstream source-pattern tests loaded some out-of-scope tenant-specific admin-route source; after discovery, those tests were removed from the local safe target, upstream test files were restored unchanged, and local route copies were removed. This was an unintended source-scope access. No tenant data, tenant integration records, workflows or route requests were accessed, and source details are not reproduced. Vercel variable names/target assignments were reviewed read-only with decryption disabled.

During baseline-source triage, one generic-named core migration was opened from the base commit. Inspection stopped when out-of-scope tenant-specific material appeared; its contents are not reproduced, summarized, copied, modified, tested, or used as a staging baseline. No broad migration batch has been applied.

## Staging project state

The staging database has **zero public application tables**. Its recorded migrations are only:

- `20261024135706_staging_acl_function_stubs`
- `20261024135714_workspace_provisioning_acl`
- `20261024135758_staging_organization_rpc_acl_parity`

These created non-functional provisioning RPC stubs and applied role-grant smoke checks. Read-back confirmed `anon` and `authenticated` cannot execute the three staging stubs while `service_role` can. The stubs raise errors and do not provision organizations. This validates ACL behavior only; staging is not an app-schema or end-to-end environment yet.

## Feature migration dependency review

The 21 pending feature-layer migrations (seven shared main migrations plus 14 local app migrations) have tenant-neutral local regression coverage, but are **feature-layer deltas**, not a complete schema bootstrap. PGlite coverage is limited to the migrations exercised by the targeted tests. They require pre-existing shared objects, including:

- Organizations, branches, roles, permissions, memberships, role-permission joins, and Auth users.
- Agents, agent families, templates, projects, integrations, workflow definitions/registry, and knowledge collections/sources.
- Legacy and canonical CRM tables, customers, conversations, leads, properties, appointments, follow-ups, domain events, audit logs, human handoffs, and handoff notifications.
- Helper functions such as `set_updated_at`, membership/permission checks, identifier slugification, the canonical handoff creator, and existing organization-provisioning functions.
- Expected composite unique constraints, RLS policies, grants, and PostgreSQL/Supabase platform objects.

The core source migrations that were safely reviewed still depend on additional foundational tables/functions not defined in those files. A complete, safe apply order cannot be certified from the reviewed set alone.

### Specific dependency hazards

1. **Foundation coverage is incomplete.** The earliest candidate foundation source cannot be used under the exclusion boundary. Other reviewed migrations assume organizations, agent hierarchy, integrations, workflow tables, audit logs, helper functions, and parent composite keys already exist.
2. **RLS ordering cycle.** The comment-only DDL preview creates `customer_memories` before its policy statements, which provides a possible table-order fix if the later feature migrations are reconciled. No DDL was applied, and the membership-helper body is not part of the metadata-only authorization.
3. **Readiness relation mismatch.** The reviewed agent-execution migration refers to `public.agent_readiness_snapshots`; read-only FLUXNIT metadata shows that relation is absent while `public.agent_runtime_readiness` exists. This is a confirmed schema-name/runtime compatibility issue to resolve before staging validation or further deployment.
4. **Data-dependent migration step.** The phase-10 runtime migration backfills integration requirements from existing agent rows. A clean empty staging project would produce no backfill rows, but this is not a substitute for reviewing the full prerequisite schema and must never be run against copied production tenant data.
5. **Tenant activation gates.** Several feature RPCs require explicit active real-estate opt-in metadata. Staging tests should use a synthetic organization and fictional identity; do not reuse FLUXNIT identifiers or configuration.
6. **Migration history ordering.** FLUXNIT records the approved ACL migration as version `20261024140349`. All 21 currently unapplied migration filenames now sort after that version as `20261024140400` through `20261024142400`, preserving their relative dependency order; the SQL bodies were not changed. The seven named current-main reminder/provisioning migrations (under their original timestamps) and 14 local app migrations are absent from FLUXNIT and staging, as are the queried reminder tables. Staging's three MCP-applied smoke migrations are independently timestamped and have no matching local migration files; reconcile that history before any CLI or bulk migration deployment.

## Read-only production metadata evidence

Allowlisted FLUXNIT catalog queries covered 42 named public tables plus Supabase-managed `auth.users`, their columns/defaults, constraints, indexes, RLS/policy definitions, table grants, trigger definitions, and helper/provisioning function signatures and grants. They read no table rows and no function bodies. The FK closure check found zero references outside the allowlist and `auth.users`. All 42 selected public tables have RLS enabled and not forced; the 60 policies are membership/permission scoped. Provisioning RPCs remain server-role-only after the approved hotfix.

The [comment-only DDL preview](STAGING_BASELINE_DDL_PREVIEW.sql) contains the exact allowlisted table, constraint, non-constraint index, RLS-enable and policy DDL. It contains 42 table definitions and 60 policy statements; every line is commented out. It intentionally omits function bodies, trigger creation, grants, extensions, seed rows and data, so it is **not an executable or complete application baseline**.

The metadata surfaced defaults that must not be copied into a reusable tenant baseline without review: `workflow_registry.organization_id = 'limitless-realty'`, `environment = 'production'`, `provider = 'n8n'`, appointment timezone `Africa/Lagos`, currency `NGN`, follow-up channel `whatsapp`, and agent key `maia`. The preview preserves source defaults for inspection only. Table-level browser-role grants are broad on many selected tables; RLS is enabled, but staging needs an explicit least-privilege grant plan rather than blind ACL reproduction. One `RETURNS trigger` helper, `sanitize_lead_budget_phone_collision()`, also has `EXECUTE` for `anon` and `authenticated`; PostgreSQL trigger-return functions are not callable as ordinary RPCs, but staging should omit that grant, and any separate live ACL change remains outside the approved hotfix.

## Validation performed

- Tenant-neutral `npm run test:real-estate`: **181 passed, 0 failed** locally after adding four contract checks for the read-only baseline preflight; direct real-estate booking is blocked before calendar side effects while non-real-estate tenant validation remains enabled.
- [STAGING_BASELINE_PREFLIGHT.sql](STAGING_BASELINE_PREFLIGHT.sql) parses in ephemeral local PGlite, and its four Node contract tests pass. It reads catalogs only, has not been run against staging, does not validate function bodies/trigger attachments/full privilege semantics, and makes no writes.
- Local sparse TypeScript: one missing import solely for the excluded dashboard component and **0 in-scope diagnostics**. The full-tree Vercel Preview build on `0af7682` passed TypeScript, Next.js production compilation, and static generation of 217 pages.
- Changed-source ESLint: **77 safe files, 0 errors, 0 warnings**.
- Focused handoff retry/callback/template-fallback tests previously passed **29/29**.
- PGlite tests exercise feature migrations against fictional fixtures; that does not prove full Supabase baseline compatibility.
- Staging public-table inventory: empty.
- Staging ACL smoke grants: passed on non-functional stubs.
- FLUXNIT schema checks: metadata only; no production data rows read for this baseline review.

## Decision before any application-schema apply

The current evidence is **not sufficient to apply the 21 pending feature migrations to staging**. The metadata-only option was performed, and the exact table/policy DDL is available in [STAGING_BASELINE_DDL_PREVIEW.sql](STAGING_BASELINE_DDL_PREVIEW.sql), but it is deliberately comment-only and incomplete. The read-only [preflight query](STAGING_BASELINE_PREFLIGHT.sql) helps check catalog presence only after a reviewed baseline; it does not supply the missing helper/trigger implementations or authorize a write. The [object manifest](STAGING_BASELINE_MANIFEST.md) records the allowlist and dependency findings.

To turn this into a runnable staging baseline, prepare a tenant-neutral generic core bundle from the reviewed allowlist and named safe helper/trigger sources, add grants and tenant-neutral defaults, and resolve the readiness-relation mismatch. Test the resulting executable migration sequence locally before any staging apply; show the exact DDL first. Do not copy production data or inspect/use the quarantined source. Current `main` is already deployed in Vercel, but both checked Supabase projects lack the seven named reminder/provisioning versions and queried reminder tables.

No application-schema migration has been applied to staging or production. PR #281 is open against `main`; current code head `a0ea24d` passed tenant-neutral safe PR check `40217496426`, while broad Maia/dashboard jobs were skipped only for this exact source branch by narrow job-level guards. Its isolated Preview was BUILDING at last read; this is a build-only environment and cannot validate privileged runtime flows. No merge or Production code deployment has occurred. The full-tree isolated Preview for application commit `0af7682` is READY; latest main deployment `3521ed4` remains READY and unchanged. Forty-three Vercel Preview variables are scoped only to the integration branch; production/default Preview variables were not edited. Preview service-key aliases use the staging anon key only, so privileged actions remain unavailable. No Trigger action, real message or n8n change occurred from this work. PR #280's out-of-scope lint incident is documented; the no-DDL staging decision remains unchanged.
