# Phase 3A validation — 6 November 2026

Baseline: `36de5e12`, current main when implementation started and re-fetched before review. Fresh branch: `feat/leo-phase3a-crm-trigger-20261106`. PR #268 was inspected, not merged or cherry-picked. PR #282's internal approval gate is unchanged.

| Check | Local result |
| --- | --- |
| `npm ci --no-audit --no-fund` | Passed; dependency versions/lockfile unchanged |
| `npm run test:leo-execution` | 49/49 passed |
| `npm run test:maia` | 134/134 passed |
| `npm run test:hotel` | 26/26 passed |
| `npm run test:hotel-setup` | 44/44 passed |
| `npm run test:hotel-workspace` | 20/20 passed |
| `npm run test:support` | Final expanded run 524/525; one baseline Windows path-separator assertion failure |
| `npm run test:real-estate` | 265/272; seven failures reproduced against untouched current main |
| `npx tsc --noEmit` | Passed, exit 0 |
| Focused ESLint | Existing synchronous hydration effect corrected; final lint result recorded in PR |
| `npm run build` | Passed, exit 0; Next 16.4.3 compilation, TypeScript and page generation completed |
| `git diff --check` | Passed |

## Baseline failures, independently reproduced

A `git archive origin/main` snapshot was extracted separately and the failing files were rerun there using the same installed dependencies. All eight distinct failures below reproduce on untouched main. They are disclosed rather than suppressed or bundled with unrelated fixes.

- `trigger-schedules-paused.test.mjs`: Windows `path.join` produces backslashes while the expected list contains forward slashes. No new automatic schedule was introduced.
- `maia-campaign-direct-delivery.test.cjs`: malformed literal escaped newline content prevents the existing test file from parsing.
- `real-estate-customer-service-window.test.cjs`: the strict-template test's loader does not mock the existing `@/lib/whatsapp-message-normalizer` dependency.
- `staging-baseline-dependency-preflight.test.mjs`: two assertions expect a VALUES section absent from the referenced current preflight scripts.
- `staging-baseline-preflight.test.mjs`: three assertions expect a VALUES section absent from the referenced current preflight scripts.

## Scope of behavioral proof

New tests exercise the real dispatcher, client approval transport, signed-envelope verification, permission engine, status route, enqueue adapter and worker with controlled provider/storage dependencies. PostgreSQL-compatible PGlite tests execute the actual migration and RPC: atomic approval consumption, permanent execution identity, rollback, exact-action replay checks, tenant/principal/session/channel/token rejection, expired approval denial, service-only access, CAS worker claims and provider-receipt completion constraints.

Tests cover concurrent duplicate tasks, late execution authorization, revoked permissions, changed membership, mismatched tenant/approval/principal, handoff/window/entitlement suppression, provider timeout, missing receipt, enqueue ambiguity, stable retry key, logging failure after acceptance and private status access. Unknown delivery outcomes cannot automatically resend. Client summaries distinguish unconfirmed dispatch, queued execution and provider acceptance from delivery.

## Release limitations

The application preview keeps the new provider flag off unless explicitly configured for staging. No hosted database migration, Trigger worker deployment, production configuration, live WhatsApp send or real voice call is performed. A green application preview cannot establish those separate integrations. Complete the staging procedure in `PHASE3A-2026-11-06.md` and resolve/review all required CI results before asking for merge or production promotion approval.

Do not merge or promote without passing required checks and the user's explicit confirmation.
