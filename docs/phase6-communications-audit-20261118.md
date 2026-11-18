# Phase 6 — Unified AI Communications: audit and receipt recovery

Date: 18 November 2026. This is the master SaaS communications workstream, not the older dashboard lifecycle document's separately numbered usage-reporting phase.

Base inspected: main `bfa3e0bd6af07a79bc7df6bb97f0fa9986ca0f97`, including the approved independent Super Admin and Photography releases. Branch: `feat/phase6-unified-communications`. This isolated branch now implements receipt recovery; no production implementation, schema or provider configuration has been changed.

Release status: #422 and #425 are merged independent application releases; production verification is recorded separately. #423/#424 remain held because automatic approval review rejected their exact production security migration pending explicit approval after disclosure of its effects. This increment does not bypass the earlier release gates or mark all earlier phases complete.

## Existing architecture to retain

- `lib/system-orchestrator.ts`, `lib/orchestration-operations.ts` and `lib/orchestration-observability.ts` already supply shared event routing, correlation, delivery evidence and operational recovery. Do not add a parallel event bus or provisioning service.
- `lib/canonical-customer.ts` already resolves customer identity and writes conversations/timeline events through scoped RPCs. Keep identity conflicts explicit and tenant-bound.
- `lib/human-operations.ts` already separates canonical handoff state from notification delivery and records outcomes/correlation. Notification failure must not be represented as completed handoff delivery.
- Existing runtime-auth, Maia/Leo action gateways, membership checks and approval boundaries remain authoritative. Platform privileges, tenant permissions and provider authentication are separate boundaries.
- `lib/flux-ai-metering-core.ts` and its existing preflight/usage functions remain the commercial boundary. Do not add billing or change prices. Audit replay/concurrency before introducing any additional metering call.
- Existing Meta Maia webhook/calling, ElevenLabs pilot and post-call receipt, and runtime email/voice routes remain channel adapters. Flux Social work stays in its existing branches.

## Confirmed initial findings

### Failed ElevenLabs receipt processing is lost on replay

Main at the inspected base inserted `elevenlabs_voice_webhook_events` before processing, then returned successful duplicate acknowledgment for every repeated event key, including failed attempts. The isolated baseline reproduced 500 followed by 200/duplicate without another processing attempt. The first runtime regression suite failed 10 of 12 cases on that source.

This branch now retries only matching, incomplete receipts and acknowledges only committed completion. It preserves the first verified tenant binding through failed attempts. The existing receipt row and a per-call advisory lock serialize settlement; the existing credit function, metered marker, call/conversation, handoff and receipt completion share one database transaction. Aborted transactions roll back every effect. No new receipt table, queue or processing-lease columns are needed because there are no external provider effects inside this transaction.

The initial ad hoc diagnostic has been replaced with automated runtime/database tests and real PostgreSQL concurrency/interruption tests. Authentication is exercised with synthetic HMAC signatures; provider/billing boundaries are mocked or local synthetic SQL. See [delivery and release prerequisites](phase6-receipt-recovery-delivery.md).

### Production foundation is not installed

A read-only production metadata check on 18 November found that `elevenlabs_voice_calls` and `elevenlabs_voice_webhook_events` are absent. Existing conversations, handoffs and the credit RPC are present. The older `20261012090000_phase7_elevenlabs_voice_runtime.sql` foundation therefore needs separate review before deployment of the proposed recovery function. This is a deployment blocker, not evidence that the hosted voice workflow already works. Neither migration was applied. The new migration explicitly refuses to run when its existing foundation is missing.

### Provider correlation is inconsistently available

`addCanonicalTimelineEvent` currently always supplies `p_correlation_id: null`, although the existing timeline RPC and orchestrator accept correlation. Trace existing callers and event identity before extending this helper; a correlation ID is evidence, never authority to access another tenant or customer.

### Existing voice branches require reconciliation

Open #411 and #418 predate newer caller-scoped Maia pilot work. They are not assumed to be ready for release. In particular, the inspected #418 head changes the Meta webhook to terminate an accepted call after sideband enqueue failure, despite its preservation-oriented title. Current main and its source-contract test preserve accepted media when optional sideband dispatch fails. Validate intended recovery behavior and reconcile the actual patch; do not copy an old whole-file snapshot over the current pilot.

The much older #46 voice UI branch and the Flux Social/integration/handoff branches also require individual review; their titles or previews do not prove compatibility. None is merged by this audit.

## First implementation milestone

Implemented on this branch: failed/completed receipt differentiation, verified tenant/provider binding, atomic settlement through the existing credit function, rollback/retry recovery, sparse-content preservation, and synthetic runtime/database/concurrency coverage. The older accepted-WhatsApp-media/pilot and Flux Social code paths remain unchanged.

Remaining: review/install the existing voice foundation and proposed recovery migration in an explicitly approved release; perform controlled authenticated/provider acceptance without customer communications; then extend correlation propagation and channel-state parity. This is the first Phase 6 increment, not completion of every communications channel.

## Verification and boundaries

Next-phase tests must cover rejected signatures, foreign/unresolved tenant identities, revoked users, completed/failed/in-progress receipts, duplicate delivery events, true handoff outcomes, safe errors and permitted read-only diagnostics. Add browser checks only for changed interface behavior, preserving the existing purple design system and reduced-motion support.

No live call, email, campaign, message, trial, agent activation, integration disconnection, provider charge or production customer-data edit is authorized as a test. Hosted authenticated acceptance and real provider behavior remain separate from synthetic fixtures. This audit does not mark all earlier master phases complete or certify all channels ready.
