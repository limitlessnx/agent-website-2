# Tenant offboarding runtime guards (draft)

## Purpose

Organization deactivation must stop new tenant-owned scheduled work from being queued or delivered while preserving shared schedules and other organizations' workloads. This draft adds active-organization checks to selected known scheduled execution paths rather than disabling global Trigger.dev or pg_cron schedules.

## Guarded paths

- Limitless Realty follow-up drain: verifies the organization status before reading due follow-ups.
- Installment reminder sweep: only processes payment plans whose organization appears in the active-organization lookup.
- Tenant reminder sweep: does not enqueue reminder executions for inactive organizations.
- Tenant reminder execution drain: cancels already-queued internal notifications for inactive organizations.
- Tenant appointment reminder drain: cancels due appointment reminders for missing/inactive organizations.
- CRM appointment reminder and human-handoff follow-up drains: cancel due tasks for inactive organizations before creating events or sending messages.
- System-event dispatcher and recovery sweep: mark inactive-tenant events as failed with an explicit offboarding-suppression reason and exclude those terminal suppressions from automatic retry.

Flux Social task handlers are deliberately excluded from this phase and remain unchanged. All included checks are organization-scoped. Shared schedules remain enabled; no global cron or Trigger.dev schedule is paused.

## Validation and limitations

- Static contract tests cover the non-Flux-Social guarded paths, including appointment/handoff follow-ups and system-event suppression.
- Static guard contracts, TypeScript, and production build passed on recorded head `d605979d12e057486df52cdfd1a13dd645c1531e` (2026-10-27). These checks validate source contracts and build integrity, not runtime task behavior.
- These checks are not a complete cancellation/drain solution for already-running provider operations or other asynchronous queues. Additional task families still need inventory and non-production testing.
- No production code is deployed, no Supabase migration is included, and no live queue rows or organization statuses were modified.

## Current runtime-validation blocker (2026-10-27)

No disposable/non-production Supabase branch is currently available; the connected project lists only `main`, which reports `MIGRATIONS_FAILED`. No branch was created and no live data or queue was changed. Synthetic-tenant runtime validation remains blocked until an approved safe environment and test credentials are available.

## Required next tests

1. Run the full build and relevant test suites.
2. Test deactivation while each task is queued, running, and retrying using synthetic tenant data.
3. Verify that active Xposure, Limitless Realty, Gencouv, and unrelated tenants continue to operate normally.
4. Test that no external provider send begins after the organization is inactive, while already-accepted provider operations are accurately reconciled.
5. Expand source tracing to every Trigger.dev task, database-backed queue, and shared pg_cron endpoint before calling offboarding complete.
