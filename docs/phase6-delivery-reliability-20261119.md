# Phase 6 delivery reliability increment

Base: released main `dca301573f7d5d89bb2743dfb711d8884d7ce37a`. Isolated branch: `feat/phase6-delivery-state-audit`.

## Problem and resulting behavior

Legacy delivery evidence could be updated by a signed callback using only a provider message ID, status-log outages looked like empty data, and delayed/replayed events could replace delivery/read evidence with an earlier state. The audit and synthetic reproductions are recorded in `phase6-delivery-state-audit-20261119.md`. The initial audit's claim that Twilio's legacy mutation was already tenant-filtered was incorrect and has been corrected: both callback paths needed the filter.

Both Meta and Twilio callbacks now pass their verified organization binding into a conditional update in the existing delivery-ledger module. The SQL update filters organization, provider message ID and permitted preceding statuses. Unknown/ambiguous Meta bindings cannot mutate receipt evidence; provider signatures are still required. Meta binding resolution is separated from runtime-agent lookup, so status-only callbacks do not depend on a published/running agent. Inbound message/call runtime routing retains its existing activation checks.

The ordering matches the existing canonical receipt policy: pending/unknown → accepted → sent → failed → delivered → read. Stronger delivery evidence wins over an earlier failure, while stale failures cannot downgrade delivered/read. Blocked and other historical states are not automatically reinterpreted. Duplicate/equal-state receipts perform no legacy update. The existing Real Estate receipt RPC remains authoritative for its own provider/tenant/timestamp validation; it is not replaced.

Callback persistence failures, including canonical receipt errors previously swallowed, now propagate as retryable non-success responses. These retries process provider evidence only; they never dispatch a message or start an agent call. Existing scoped installment-recovery compare-and-set logic and handoff processing are preserved.

## Campaign and availability boundaries

- Missing configuration, failed HTTP/network requests, malformed JSON/collections or malformed content now raise a sanitized unavailable error instead of returning an empty status list. Provider response bodies and credentials are not exposed. Confirmed empty data remains empty, and an empty audience does not fetch status data.
- Both campaign routes await required cooldown evidence before approval/outbox claim/dispatch. Tests inject unavailable evidence and observe zero approvals and zero dispatches. Existing consent, entitlement, service-window and approval checks remain in place.
- Campaign report persistence requires the route's explicitly resolved organization. It no longer falls back to the internal Limitless organization for another tenant's report. The report writer only returns successful persistence when its write succeeds; the routes retain their existing post-dispatch logging boundary so an already accepted send is not represented as an unsent message eligible for automatic replay.
- Replayed acceptance/failure reports cannot overwrite stronger provider evidence. New report rows use a deterministic digest-derived UUID primary key and conflict-ignore upsert. The key includes tenant/message/recipient, or tenant/campaign/execution/recipient when no provider ID is available. Replaying one execution inserts once; a different execution remains separate evidence. This uses the existing primary key, with no migration or historical data rewrite.
- Historical `bot_sessions` logs lack verified tenant/provider identity. Matching one of those logs by message ID alone now raises an explicit unverified-evidence error rather than mutating a tenant row. The legacy ledger getter propagates refresh failure. No active in-repository app/lib consumer of that getter was found; current canonical report readers remain unchanged. Historical identity repair is still separate work.

## Files and reasons

| Files | Reason |
| --- | --- |
| `lib/whatsapp-delivery-ledger.ts` | Reuse existing ledger for scoped conditional receipts, replay-safe report inserts and explicit historical-provenance failures. |
| `lib/whatsapp-status-log.ts` | Distinguish unavailable/malformed status evidence from confirmed empty data without disclosing raw failures. |
| Meta/Twilio callback routes | Preserve signature boundaries; use verified tenant identity; keep receipt failures retryable. Separate Meta binding from agent readiness. |
| `lib/campaign-report-store.ts`, existing campaign send/direct routes | Carry resolved organization into supplementary evidence and propagate persistence failure to the existing caller boundary. |
| Two new test files | Actual helper/SQL, signed Meta and Twilio callback, duplicate/late receipt, unavailable evidence, retry and tenant-isolation coverage using synthetic boundaries. |
| Existing campaign/provider/source-contract tests | Add dispatch-stop coverage and update assertions for the shared receipt helper and separated binding resolver. |
| Existing package script and Maia CI workflow | Run new tests with the existing Real Estate suite and lint changed modules; no duplicate pipeline. |
| Audit/delivery docs | Preserve initial findings, corrected inspection notes, verification scope and remaining acceptance gates. |

## Validation checkpoint

Focused runtime/SQL/campaign suite: **32 scenarios passed**. Actual existing legacy table DDL and expanded status constraint are executed in PGlite; a small Supabase-query adapter executes the helper's predicates/upserts as SQL. The SQL tests demonstrate tenant separation, delayed/equal-state receipt rejection, interleaved update safety and conflict-ignore report replay. PGlite uses one connection; this is not a claim of independent multi-connection PostgreSQL lock testing or live PostgREST acceptance.

Changed-file ESLint reports no errors and three pre-existing unused-variable warnings in the campaign fixture. Final broader local checks and exact-head hosted build/CI/preview results will be recorded in the PR. An earlier check run exposed two stale source-contract assertions; they were corrected without removing the assertions' security/dispatch-audit intent. Initial new fixture failures (missing VM URLSearchParams and cross-realm Error identity) were fixed before the final focused pass.

No UI, design-token, layout, animation, or baseline screenshot change is included. Existing hosted responsive regression remains applicable, with its synthetic/authenticated limitations retained. A green backend build must not be described as completed Phase 2–3 visual acceptance.

## Rollout implications and limits

Campaign preparation/send will now fail closed while required legacy status evidence is unavailable. Restore evidence access to recover; do not bypass cooldowns or automatically resend. Provider callbacks may return non-success during receipt storage outages so the provider can retry. Duplicate receipt processing is harmless, but this increment does not introduce a provider-event durable inbox or guarantee retries beyond the provider's retention window.

No unverified historical logs are backfilled. Legacy rows have no provider dimension/timestamp equivalent to the canonical table, so this increment does not claim to fully reconstruct historical provider identity, enrich equal-state old rows, or certify every legacy writer. Existing ambiguous/duplicate historical data requires separate review. Missing provider-ID acceptance semantics and broader channel-state parity remain separate acceptance topics.

ElevenLabs inventory/mapping and designated cost-capped live acceptance, authenticated UI/workflow/native-zoom/performance acceptance, and designated manager join/approval/removal acceptance remain open. No real provider connection, message, email, campaign, paid call, metering charge or customer data mutation is performed during testing.

Production remains on the previously approved #429 release. This increment is isolated for review; no main merge, production deployment, migration, provider activation or customer-data change is included without separate explicit release approval.
