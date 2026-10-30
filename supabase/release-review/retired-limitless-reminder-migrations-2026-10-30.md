# Retired Limitless installment reminder migrations

Captured during production reconciliation on 2026-10-30.

The following local migration files were removed from the deployable `supabase/migrations` directory because their effects are already represented by production migrations recorded in the live Supabase ledger and verified against current production state:

- `20261028132000_set_limitless_installment_reminder_template.sql`
- `20261029071600_limitless_installment_reminder_reschedule_10am.sql`

The production database currently has the approved `installment_reminder` WhatsApp template active with the seven approved variables in the expected order. The intended reminder template is enabled and the other WhatsApp reminder templates for Limitless Realty are disabled.

All five active installment plans with reminders enabled and a positive balance already use the approved template and have `next_due_date = 2026-11-12`. They also currently have `next_reminder_at = 2026-10-29 09:00:00+00`, which is in the past as of this review. The retired reschedule migration would reapply that stale timestamp and broad plan updates, so it must not be run.

Do not restore or execute these migrations. If the five plans need a new reminder schedule, implement a separate narrowly scoped, reviewed operation after confirming the desired schedule and the current reminder delivery state. Git history retains the original SQL for audit.
