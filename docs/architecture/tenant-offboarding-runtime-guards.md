# Tenant offboarding runtime guards (draft)

## Purpose

Organization deactivation must stop new tenant-owned scheduled work from being queued or delivered while preserving shared schedules and other organizations' workloads. This draft adds active-organization checks to selected known scheduled execution paths rather than disabling global Trigger.dev or pg_cron schedules.

## Guarded paths

- Limitless Realty follow-up drain: verifies the organization status before reading due follow-ups.
- Installment reminder sweep: only processes payment plans whose organization appears in the active-organization lookup.
- Flux Social publisher: cancels a scheduled publication when the owning organization is missing or inactive.
- Flux Social generation worker: skips generation for a missing/inactive organization.
- Tenant reminder sweep: does not enqueue reminder executions for inactive organizations.
- Tenant appointment reminder drain: cancels due appointment reminders for missing/inactive organizations.

All checks are organization-scoped. Shared schedules remain enabled; no global cron or Trigger.dev schedule is paused.

## Validation and limitations

- A static contract test covers all six guards.
- Build and CI results are pending for this draft.
- These checks are not a complete cancellation/drain solution for already-running provider operations or other asynchronous queues. Additional task families still need inventory and non-production testing.
- The generation worker currently returns a skipped result for an inactive tenant; it does not delete generation-job rows.
- No production code is deployed, no Supabase migration is included, and no live queue rows or organization statuses were modified.

## Required next tests

1. Run the full build and relevant test suites.
2. Test deactivation while each task is queued, running, and retrying using synthetic tenant data.
3. Verify that active Xposure, Limitless Realty, Gencouv, and unrelated tenants continue to operate normally.
4. Test that no external provider send begins after the organization is inactive, while already-accepted provider operations are accurately reconciled.
5. Expand source tracing to every Trigger.dev task, database-backed queue, and shared pg_cron endpoint before calling offboarding complete.
