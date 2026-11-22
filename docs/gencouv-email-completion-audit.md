# Gencouv email marketing completion audit

Base: main `d832f207371d8451c71239e4ab943a36aa4b91b5`. PR #449 is merged. Open PRs #438 (import review), #439 (durable campaigns/consent) and #436 (optional Brevo adapter) were inspected. Preserve them; continue the existing Resend implementation rather than switching providers or introducing a second composer/publisher.

## Confirmed code defects

- Manual bulk and individual proposals call Resend without durable pre-submission reservations or idempotency keys. History is inserted after acceptance. A timeout or lost response can therefore cause duplicates on retry.
- Bulk history assumes acceptance means sent and returns raw provider responses on partial results. Submission, delivery and reconciliation need separate states.
- The legacy email-control endpoint lacks the newer admin/workspace/origin checks. Updating a limit explicitly overwrites the automation toggle. The sequence endpoint also lacks admin/workspace checks.
- The dashboard feed has no timeout or response validation. A missing/unavailable external feed must remain isolated from contact imports, campaign management and manual sends.
- The existing webhook accepts unsigned requests when its optional token is absent, has unscoped message lookups, can mirror another sender's events, and can overwrite newer outcomes with older events. Signature verification, tenant filtering, atomic deduplication and suppression are necessary.
- Imports lack an immutable batch identifier, can silently truncate worksheet reads, use case-sensitive existing-email lookups and mix category errors into import counts. The UI offers a review flow but backend import commits are not atomic.
- Campaign drafts, durable sending batches, unsubscribe handling and a proper history view are missing from the merged manual bulk implementation.

## Existing foundations to reuse

Reuse CRM contacts/categories/assignments, `gencouv_campaign_settings`, email messages/events/suppression, sync-run import history, the Resend adapter and the existing marketing/import/inbox components. Reuse #439's campaign concept and unsubscribe semantics; avoid adding its competing composer or dispatch system. The additive migration is justified only for durable campaign/batch identity and transactional reservations on the existing message ledger.

Automation remains off throughout work. Do not infer consent from public lists or bulk-upgrade old contacts. Any provider-uncertain submission stays held until reconciled. Only the user-authorized acceptance inbox may receive one real test email; larger batches use synthetic provider mocks.

## Verification boundaries

Database schema and operational checks are read-only until validated additive migrations/test records are necessary. Production customer records, addresses, schedules, operational metrics and secrets are omitted from this public report. Provider acceptance is not delivery. Synthetic browser tests must be labeled as such; authenticated production acceptance must be reported separately and must not be claimed without actually executing the dashboard workflow.
