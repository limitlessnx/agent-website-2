# Execution providers

Add provider adapters here only after documenting their supported action contract, authentication model, idempotency behavior, retry semantics, timeout handling, and observable execution result.

The first Trigger.dev adapter should be action-specific. Do not create a generic arbitrary-task runner or let untrusted input choose task identifiers.
