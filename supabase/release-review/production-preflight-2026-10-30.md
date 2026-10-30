# Production preflight: pending Limitless migrations

Review date: 2026-10-30
Supabase project: `tacxegmlppngnuvldojy`
Organization: Limitless Realty (`b15f21b4-5697-4d21-9421-8a34eae3476d`)

This is a read-only preflight. No migration, SQL write, data repair, Supabase branch creation, or customer message was executed.

## CI state

Commit `30d3e0b81cf6d0249398660c94d2e5e946966f0f` passed all three PR workflows:
- Dashboard Final QA: success, including TypeScript and production build.
- Limitless Realty safe checks: success, including tenant-neutral acceptance suite and changed runtime TypeScript.
- Maia Draft Verification: success, including `tests/supabase-migration-ledger.test.mjs`, `npm run test:maia`, and production build.

## Migration 20261027220000: installment reminder contract

Production already has the added columns, reminder cursor function/trigger, reminder-state function/trigger, reminder status check, and schedule unique index. However, the deployed `sync_payment_plan_total()` is still the older implementation. The pending migration replaces it with tenant-scoped payment aggregation and installment schedule advancement, and adds the send-authorization RPC. It is not safe to mark this migration as applied or remove it based on partial schema overlap.

Read-only preflight:
- Duplicate reminder schedule keys: 0 groups.
- Nonstandard reminder attempt statuses: 0 rows.
- Negative payment records: 0 rows.
- Installment plans with `installment_amount <= 0`: 5 rows.

The migration preserves the existing nonnegative installment amount constraint and does not automatically repair the five zero-value plans. Their values need business/operator review before any future schedule advancement is expected from payment records.

## Migration 20261027220100: canonical Maia follow-up identity

Production does not yet have `limitless_maia_followup_sequences` or `limitless_maia_followup_events`, nor the sequence identity columns on `follow_ups`. The existing tenant tables and required identity columns are present for the migration's scoped checks. The application RPC calls inspected in `lib/ai/limitless-realty-maia.ts`, `app/api/limitless/maia/followups/route.ts`, and `src/trigger/maia-runtime.ts` match the intended RPC argument names.

This migration remains pending and requires a reviewed production deployment window. It is not applied by this preflight.

## Reminder schedule operational blocker

Five active installment plans with reminders enabled and a positive balance currently share:
- approved template `9167a170-57ee-4511-a0ac-6be4a238bcfa`
- next due date `2026-11-12`
- reminder cursor `2026-10-29 09:00:00+00` (10:00 Africa/Lagos), now in the past.

Reminder history currently contains 4 failed and 6 sent attempts; none of those 10 attempts has `send_authorized_at` set. This history does not establish whether a reminder was delivered outside the local attempt table or whether a retry is safe. Do not blindly replay the old reschedule migration or send retries. First reconcile provider delivery records and agree the next due/send time for these five plans, then make a narrowly scoped, audited schedule update.

## Release decision

- Keep both migrations pending.
- Do not apply migrations or update customer plan data until the above checks and deployment plan are explicitly reviewed.
- PR #300 remains draft/unmerged.
- Trigger.dev worker version and an actual inbound-to-outbound WhatsApp reply remain unverified.
