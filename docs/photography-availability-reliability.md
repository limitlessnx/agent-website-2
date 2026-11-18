# Photography workflow reliability: availability evidence

Base: `main ae2a41f9031544f340ae9144bc79fb0c72819b8b`, fetched before changes on 18 November 2026. Branch: `fix/photography-availability-read-failures`. Production modified: **No**.

## Finding and repair

The industry workflow review reproduced a failure in the existing photographer conflict helper. An error reading `photography_booking_metadata`, or a failed/missing appointment read, returned `null`, the same result as verified availability. The existing create/edit routes could then insert or update a booking. Editing also treated a failed current-assignment read as an unassigned photographer and skipped conflict checking.

The existing helper now distinguishes unavailable evidence from a verified empty result. Returned errors, missing list data and rejected reads raise a safe `PhotographyAvailabilityError`. The same two existing routes return JSON HTTP 503 with a retry instruction before any booking or metadata write. They retain HTTP 409 for a real overlap and their previous success responses after a verified check. Editing only reads the previous assignment when the request needs that fallback, and a failed read cannot silently clear it. Provider/database error details are not exposed.

No new booking system, migration, pricing, permission model, provider call, communication or UI component is introduced. Existing tenant filters, permission checks, self exclusion, adjacent time handling, blocking statuses and partial-success metadata warnings are preserved.

## Changed files

| File | Reason |
| --- | --- |
| `lib/photography-booking-conflicts.ts` | Fail closed when either availability read is unavailable; retain verified empty/conflict results. |
| `app/api/portal/bookings/route.ts` | Return retryable JSON failure before creation if availability is unknown. |
| `app/api/portal/bookings/[id]/route.ts` | Protect both current-assignment fallback and conflict verification before editing. |
| `tests/photography-availability-reliability.test.cjs` | Real helper and route runtime checks with synthetic database/auth boundaries and no provider traffic. |
| `package.json` | Add the runtime test to the established Photography regression command. |
| `.github/workflows/dashboard-final-qa.yml` | Trigger the existing regression pipeline when these routes/helper/tests change; no duplicate workflow. |
| `tests/real-estate-customer-service-window.test.cjs` | Reuse the exact previously reviewed #422 fixture repair: real pure normalizer mock and precise validation assertion. Production messaging code is untouched. |

## Evidence

- The final 18-case runtime suite fails against the unchanged combined/main helper/routes: **12 failures, six passes**. This is a deliberate reproduction, not a passing baseline.
- The repaired source passes **18/18 cases**. Coverage includes both failed list reads, missing data, rejected queries, failed current-assignment lookup, safe error text, zero writes on failed checks, 409 conflicts, normal success, tenant scope, self exclusion and anonymous/permission denial.
- The established Photography command passes **seven test files**, including the new suite. Changed-file lint and whitespace checks pass.
- Local production build and final type check passed. Broader support/permission regressions: **581 cases passed**; Real Estate: **275 passed**. No provider communications or billing executed.
- Whitespace validation preserves the existing workflow CRLF format (`git -c core.whitespace=cr-at-eol diff --check`). Repository-wide historical lint debt is not claimed as resolved.

There is no layout change, so no new screenshot baseline is introduced. Browser interaction against an authenticated hosted studio remains unverified; this is a backend reliability repair. Test source can be selected with `PHOTOGRAPHY_TEST_SOURCE_ROOT` solely to reproduce the original defect locally.

## Boundaries

This does not create an atomic photographer reservation or certify two simultaneous bookings cannot race between an availability read and a write. It repairs the demonstrated outage path; separate concurrency/capacity validation remains part of industry workflow acceptance. Existing unassigned/unscheduled behavior and broader booking lifecycle are not redesigned here.

PRs #422–#424 remain separate drafts. This fix starts from main and does not merge their features or apply #423's proposed team migration. Its identical test-fixture repair can be reconciled without weakening assertions. No customer account, organization, booking, database schema, production deployment or communication has been changed.
