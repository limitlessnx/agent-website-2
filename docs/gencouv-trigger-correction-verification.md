# Gencouv: Trigger.dev correction and native dashboard controls

Base: main `dd466bc82be22fcf74f3af140f3088b9d956fcad` (PR #455). Open PRs #438, #439 and #436 remain separate; none is overwritten or merged here.

## Findings

The user confirmed n8n is not currently used. Trigger deployment run [45119768044](https://github.com/limitlessnx/agent-website-2/actions/runs/45119768044) succeeded from main. `trigger.config.ts` deploys `src/trigger` to `proj_ckweruqrgwndssqpjdvg`; these tasks contain no Gencouv-specific email sender. Manual dashboard email uses `lib/gencouv-send.ts` and the existing Resend adapter directly. The successful shared Trigger deployment does not prove Gencouv automated email works.

Two live dashboard paths still depended on n8n: contact classification and the overview feed. Optional webhook forwarding also retained the retired integration. Those dependencies are removed in this follow-up. Existing provider verification, manual sending reservations, consent, suppression and delivery history are reused.

## Changes

- `app/api/gencouv/email-control/route.ts`: existing administrator, selected workspace and origin checks; scoped database operation instead of external webhook.
- `supabase/migrations/*_gencouv_native_dashboard_controls.sql`: two service-only invoker functions. Contact classification, suppression and actor audit are transactional. Classification never changes consent or activates sequences. Native snapshot reads CRM and qualified contacts, deduplicates identity, excludes suppression/blocked CRM identities and reads persisted campaign state. No new tables or customer backfills.
- `lib/gencouv-dashboard-feed.ts`, `app/dashboard/gencouv/page.tsx`: database snapshot instead of external URL/secret. Errors stay isolated. Persisted OFF cannot be overridden by an old feed value.
- `components/gencouv/GencouvLeadActions.tsx`: reports saved action accurately and refreshes displayed classifications.
- `app/api/gencouv/resend-webhook/route.ts`: no retired n8n forwarding. Signed events still update the existing ledger; the legacy `sheet_sync` response remains explicitly disabled for compatibility.
- `scripts/verify-gencouv-trigger.mjs`, existing Gencouv Actions workflow: read-only production deployment and worker-configuration audit via the existing CI token. No tasks triggered, provider requests or production writes. Only deployment identifiers, configuration-presence booleans and pause state are output; credentials stay private. Source task candidates do not prove safe sending.
- Existing database/runtime/browser fixtures and tests extended for native snapshot, classification, isolation, audit rollback and zero provider calls.

## Verification

Local type check and scoped lint passed. Sixteen database tests and sixteen runtime tests passed. Browser evidence and deployment audit results are recorded after execution below.

## Remaining gates

Automated sending remains OFF and unverified. No Gencouv-specific automated sender has passed deployed-task acceptance. This follow-up does not add a replacement campaign sender merely to satisfy a green connection indicator.

The single authorized real inbox has not been emailed by this follow-up. A normal administrator browser login with Gencouv selected is still required for true production dashboard acceptance; no separate account/password is needed. Synthetic browser sessions do not establish real-session acceptance.

## Executed evidence (2026-11-23)

- Local TypeScript and scoped ESLint passed; 17 database tests, 16 runtime tests, navigation/category regressions and four migration-ledger checks passed.
- The full rendered suite passed 42 checks at 360, 430, 768, 1024, 1440 and 1920px. A screenshot review identified the inherited Cold fallback; the affected six native-overview cases were rerun after showing the real saved temperature. Evidence is in `test-results/gencouv-captures/native-overview-*.png` and the standard import/review/history/error screenshots. These are synthetic rendered screenshots, not authenticated production acceptance.
- Additive function migration registered in production as `20261123075453_gencouv_native_dashboard_controls`. Readback confirms security invoker, pinned search path, no anon/authenticated execution, and service-role execution. Native snapshot succeeds with automation OFF. Existing security advisory categories/counts are unchanged. No customer records were updated.
- Read-only deployed audit job 137557087601, run [45134395831](https://github.com/limitlessnx/agent-website-2/actions/runs/45134395831), passed. Production Trigger deployment `deployment_wwien955oyi5dkyynt8vt`, version `20261123.1`, is DEPLOYED for main `dd466bc82be22fcf74f3af140f3088b9d956fcad`. Its existing database configuration could read Gencouv's persisted paused state from CI. This is configuration verification, not execution of a Gencouv sender in the worker.
- The audit found **no `RESEND_API_KEY` in the worker environment**, no Gencouv task candidate in the deployed source, `workerVerified: false`, and `automationEnabled: false`. Vercel manual Resend delivery is separate; its credential was not removed or changed. Gencouv automated email is an identified implementation/configuration gap, not an n8n reconnection task.
- The audit triggered zero tasks, sent zero emails and performed zero production writes. No real inbox email has been sent by this follow-up.

Review: https://github.com/limitlessnx/agent-website-2/pull/456. Application release readiness and final-head CI must be verified before merging; the applied database functions alone are not a Vercel release.

Additional visual review corrected the inherited `ready`/`Cold` fallbacks for contacts without recorded sequence/temperature state: no sequence now displays `not_enrolled`, and a classification alone never implies permission to send.

The normal Vercel preview build for commit `2fab451b72177a9644c92397953701a2e18e4d86` reached READY. Locally, default Turbopack builds hit this execution sandbox's child-process port restriction. The Webpack fallback failed on existing global selectors in `AdminSidebar.module.css`, `LeoRealtimeVoice.module.css` and `HotelWelcomeTour.module.css`; unrelated CSS was preserved. Those local build attempts are failures/limitations, not claimed passes. The final release uses the normal Vercel build and hosted checks for its exact commit.
