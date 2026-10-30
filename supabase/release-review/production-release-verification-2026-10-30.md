# Production release verification: 2026-10-30

## GitHub and Vercel
- PR #300 merged into `main` at `98a4f86f2a726c76a590187a75a39318fe88e96b`.
- PR #302's positive-installment guard changes are included in the #300 merge tree.
- The three PR validation workflows passed on the validated release head: Maia draft verification, dashboard regression, and Limitless safe regression. The merge commit has a successful Vercel status.
- Production deployment `dpl_BF5B7AcakErRvorh5NNCqcCHXHVL` is READY and uses the exact merge SHA above.
- Production aliases include `fluxknight.space` and `www.fluxknight.space`; live `https://fluxknight.space` returned HTTP 200.

## Supabase production
- Project: `tacxegmlppngnuvldojy`.
- Positive-installment guard recorded as `20261030190935_limitless_reminder_positive_installment_guard`.
- Maia follow-up identity migration recorded as `20261030191816_limitless_maia_followup_sequence_identity`.
- Installment contract plus strict positive guard applied atomically as `20261030191938_limitless_installment_reminder_contract_positive_guard`.
- The production migration snapshot is refreshed from the live migration ledger.
- Maia follow-up tables and events table exist; all 19 identity columns, five required service-role RPCs, and relevant tenant policies are present.
- Five active reminder-enabled installment plans have non-positive installment amounts; zero have reminder cursors.
- Authorization and cursor functions both reject non-positive installment amounts. Tenant-scoped installment schedule sync is installed.
- Payment records: 8. Negative payment records: 0. Reminder attempts: 10. Invalid reminder statuses: 0. Duplicate schedule-key groups: 0.
- The migrations performed no payment-record writes and no financial amount changes. The strict guard's only data update targets stale reminder cursors on invalid plans; preflight found zero such cursors.
- No reminder sweep was run and no customer messages were sent.

## Remaining operational verification
- Trigger.dev production deployment/version and active `maia-process-inbound-message` task are not yet independently verified through the available connected controls.
- No controlled inbound/outbound WhatsApp test has been run. This remains pending until the active Trigger.dev production version can be confirmed and a designated test number is available.
- Do not replay pending inbound runs or send real customer messages.
