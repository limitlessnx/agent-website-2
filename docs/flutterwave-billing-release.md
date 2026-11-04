# Flutterwave billing recovery release

PR #333 adds expiring webhook claims, ownership tokens, a permanent transaction
ledger, and database transactions covering renewal/cancellation plus wallet sync.
Both Flutterwave webhook URLs use the same handler. Initial trial activation uses
UTC calendar arithmetic and repairs wallet synchronization on retry.

## Verification

`npm run test:billing` executes route behavior and PGlite PostgreSQL regression
tests. The Monthly Billing Verification workflow additionally starts PostgreSQL
17 and runs `tests/flutterwave-concurrency.test.mjs` through independent `psql`
connections. Those sessions contend on the same subscription and replay the
same transaction identities; the test checks dates, wallet state, and ledger
counts. PGlite alone cannot establish multi-connection locking behavior.

The fixture accepts only an explicitly configured localhost database through
`BILLING_TEST_DATABASE_URL`. It creates tables and must use an empty disposable
database. No payment provider credentials or real cards are used by the tests.

## Production gate

Migration `20261104114151_flutterwave_atomic_renewals.sql` is prepared for review.
It has **not** been applied to production. Adding its version to the pending
migration inventory records the proposed change; it does not approve application.

Before release, confirm the PR head equals the branch SHA and that billing CI,
typecheck, build, and preview checks passed for that SHA. Obtain approval for
production database application and release. There are other pending migrations
in the repository: do not run an indiscriminate database push.

With release approval, coordinate a drained webhook worker cutover so that old
workers using non-atomic renewal writes cannot overlap the new handler. Apply
the reviewed migration before switching traffic to code that requires its RPCs.
Keep delivery retryable during the cutover; do not acknowledge an event as
processed unless its work completed. The new handler returns 5xx if an RPC is
missing rather than silently granting access.

After cutover, check event processing errors and verify the ledger, subscription
dates, and wallet agree using an approved non-charging verification procedure.
Claims without an owner, including legacy interrupted rows, can be reclaimed.
Live claims expire after five minutes; replaced tokens cannot mutate renewals,
cancellations, or completion/error records. No scheduled card charging is added.

Do not roll back only the handler to an old version while new claims or payments
are in flight. Preserve the permanent ledger and coordinate recovery before
replaying events. Existing historical metadata transaction IDs are respected;
the permanent ledger records every renewal processed by the new implementation.

Reference: [Supabase database functions](https://supabase.com/docs/guides/database/functions)
and [Flutterwave payment plan webhooks](https://developer.flutterwave.com/docs/payment-plans-1).
