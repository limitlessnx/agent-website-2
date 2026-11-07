# Follow-up visibility and approved reminder contract

The user's manually activated sequence existed, but Lead CRM showed zero “In Follow-up”. The counter used `leads.follow_up_stage > 0`, a legacy send-stage field that remains zero before a successful send. The first scheduled attempt then became unknown with a template validation error and no provider receipt.

## Confirmed production state during investigation

At 06:01 UTC / 12:01 Asia/Dhaka on 7 November 2026, one Limitless sequence was active: Blessing (Des), Iwinosa Mega City Promo. Its six steps existed. The first was unknown after one attempt, without `sent_at` or a provider message ID; the remaining five were pending future dates. This confirms enrollment, not message delivery. No production record was changed or message retried during this fix.

The active `follow_up_outside_24h` configuration was `limitless_realty_reminder`, language en_US, provider-approved, with the exact configured and approved metadata order:

1. customer_name
2. followup_context
3. property_details
4. next_step

The canonical runner still supplied the old seven-field order. This failed the required-value/strict-contract gates before a confirmed provider submission. The shared delivery validator stays strict; no provider configuration, approval metadata, consent or prior attempt is modified by this patch.

## Changes

- Lead CRM now reads tenant-scoped canonical active/paused sequences. It counts each active client once, even with multiple active property sequences. A new activation is included before any message succeeds.
- Per-client rows distinguish active, paused and inactive state. Unknown/failed attempts and incomplete consent are shown as needs review. Read errors are shown as unavailable instead of a misleading zero. The page links to Follow-up Control.
- The canonical reminder runner now supplies the four approved fields, using verified property information and its existing follow-up wording. Direct sends remain restricted to a verified service window. Opt-out, tenant, approval, variable-order, claim and duplicate guards remain in place.
- Other template contracts, including installment reminders, are unchanged. Existing unknown attempts remain held for reconciliation; correcting the contract does not automatically retry them.

## Checks

- 16 state, route and service-window/delivery tests pass. These include the actual runner's four-field input, the shared gateway's ordered four-parameter provider payload, opt-out and ambiguous-attempt rejection, count deduplication, tenant scoping and failure visibility.
- 58 canonical follow-up regressions pass.
- TypeScript and focused lint pass locally.
- Seven browser checks against actual Lead CRM and the dashboard theme pass with isolated fixture state at 1440, 768 and 390 widths. An active client with legacy stage zero shows count one; a historical stage-positive inactive client does not inflate the count. Unknown delivery shows needs review; a simulated read failure shows unavailable. No horizontal overflow or browser errors.

The old static test expecting the removed objection variable was updated to assert the current contract. The existing missing message-normalizer mock in the service-window test was supplied so the actual shared delivery validation and provider-payload test executes rather than failing during import.

## Release boundary

This is a code-only correction prepared from current main after the manual activation release. No migration is needed. Require CI/preview verification and production confirmation before promotion. Do not reset or resend the existing unknown attempt as part of deployment. A controlled retry needs explicit reconciliation/authorization through the appropriate exact-sequence procedure.
