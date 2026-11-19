# Phase 6 provider acceptance — not activated

This is a review plan, not an authorization to configure a provider or make a call. Current evidence: the approved voice storage/recovery function is installed; application agent mappings count is zero. The connected ElevenLabs inventory operation failed twice with internal error `-32603`. Provider agent availability and configuration remain unverified.

## Prerequisites for an exact proposal

1. Restore the existing read-only ElevenLabs connection and retrieve actual agent/branch IDs. Do not guess IDs or create a replacement agent to hide an inventory failure.
2. Identify a designated test organization and authorized owner. Verify its active state and current voice entitlement through existing services; platform privileges do not confer tenant membership.
3. Inspect the chosen agent, current branch/deployment, tool permissions and handoff destination without modifying them. Reconcile with current Maia pilot behavior and older open PRs rather than overwriting working configuration.
4. Review the unique server-side organization/agent/provider mapping. A signed payload's organization hint is not authority to select a tenant. Do not bind a customer agent merely because its name resembles the organization.
5. Check the callback target `https://fluxknight.space/api/webhooks/elevenlabs/post-call` and existing signature/secret configuration without revealing or retrieving secret values. The user/provider dashboard should configure secrets directly when needed.
6. Prepare the concrete mapping/configuration diff, rollback steps and a maximum authorized call duration/cost. No provider configuration, callback activation, phone assignment, real call or billable simulation is included in the current application-only increment.

## Controlled acceptance after separate approval

- Use the designated tenant/test identity, not a customer contact or production customer membership.
- Confirm invalid signatures and unresolved/ambiguous/foreign mappings fail closed. Local synthetic tests already cover these boundaries; do not fabricate call history or billing evidence in production to demonstrate readiness.
- If approved, make only the specified controlled call and observe actual provider events. Never animate or report listening/speaking/availability without a real application event.
- Verify the provider's real conversation identity resolves to the approved tenant/agent, that persisted call/conversation/handoff evidence is accurate, and that existing credit settlement occurs once.
- Use a legitimate newly signed provider redelivery to verify completed/incomplete receipt behavior. Do not reuse expired signatures, re-sign customer payloads with retrieved secrets or replay historical backlogs automatically.
- Check accepted/completed/failed/transfer/handoff outcomes separately. Provider acceptance is not successful customer delivery or a completed human handoff.
- Record exact deployed commit, provider branch/version, results and limitations. Stop at the approved cost/duration cap or unexpected effects.

## Rollback and outstanding scope

Retain receipts, conversation/handoff evidence, metering markers and ledger records. Do not restore the old non-atomic callback handler while callbacks are active or delete storage as an application rollback shortcut. Provider disconnection, configuration reversal, refunds and historical retries need their own reviewed authorization.

Correlation propagation and channel-state parity can continue safely on isolated application branches while provider access is unresolved. This plan does not mark email, WhatsApp, voice, Leo, Maia or Flux Social as fully accepted in production.
