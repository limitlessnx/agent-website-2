# Phase 6 — Unified AI Communications: initial audit

Date: 18 November 2026. This is the master SaaS communications workstream, not the older dashboard lifecycle document's separately numbered usage-reporting phase.

Base inspected: main `bfa3e0bd6af07a79bc7df6bb97f0fa9986ca0f97`, including the approved independent Super Admin and Photography releases. Branch: `feat/phase6-unified-communications`. No communications implementation or provider configuration has been changed by this audit.

Release status: #422 and #425 are merged independent application releases; production verification is recorded separately. #423/#424 remain held because automatic approval review rejected their exact production security migration pending explicit approval after disclosure of its effects. This phase begins with read-only architecture/recovery auditing; it does not bypass the earlier release gates or mark all earlier phases complete.

## Existing architecture to retain

- `lib/system-orchestrator.ts`, `lib/orchestration-operations.ts` and `lib/orchestration-observability.ts` already supply shared event routing, correlation, delivery evidence and operational recovery. Do not add a parallel event bus or provisioning service.
- `lib/canonical-customer.ts` already resolves customer identity and writes conversations/timeline events through scoped RPCs. Keep identity conflicts explicit and tenant-bound.
- `lib/human-operations.ts` already separates canonical handoff state from notification delivery and records outcomes/correlation. Notification failure must not be represented as completed handoff delivery.
- Existing runtime-auth, Maia/Leo action gateways, membership checks and approval boundaries remain authoritative. Platform privileges, tenant permissions and provider authentication are separate boundaries.
- `lib/flux-ai-metering-core.ts` and its existing preflight/usage functions remain the commercial boundary. Do not add billing or change prices. Audit replay/concurrency before introducing any additional metering call.
- Existing Meta Maia webhook/calling, ElevenLabs pilot and post-call receipt, and runtime email/voice routes remain channel adapters. Flux Social work stays in its existing branches.

## Confirmed initial findings

### Failed ElevenLabs receipt processing is lost on replay

`app/api/webhooks/elevenlabs/post-call/route.ts` inserts `elevenlabs_voice_webhook_events` before processing. Any unique-key conflict immediately returns HTTP 200 with `duplicate: true`, without checking `processed_at` or `processing_error`. The failure handler records `processing_error` and returns HTTP 500. A provider retry of that failed event is therefore acknowledged without resuming it.

An isolated runtime probe loaded the real route/helper and used a synthetic database and authentication boundary. The first attempt hit a synthetic agent lookup failure and returned 500. The same event retried as 200/duplicate; the processing lookup occurred only once. Provider/billing calls: **zero**. Authentication was mocked deliberately; this probe establishes replay behavior, not signature verification or provider delivery. Evidence: `/tmp/phase6-webhook-retry-probe.log`. A repeatable local diagnostic is included at `scripts/audit-elevenlabs-webhook-replay.cjs`; run it after installing the repository dependencies. It intentionally exits **1 when the defect reproduces** (18 November: reproduced), and is not a passing correctness test or a live provider test. Its changed-file ESLint check passed.

The existing receipt table has `event_key`, `received_at`, `processed_at` and `processing_error`; it does not provide a durable processing lease. Repair must distinguish completed duplicates, failed attempts, in-progress attempts and crash recovery. A blind retry must not duplicate metering, messages, transcripts or handoffs. Reuse current durable execution/receipt infrastructure where compatible, and justify any necessary schema change explicitly.

### Provider correlation is inconsistently available

`addCanonicalTimelineEvent` currently always supplies `p_correlation_id: null`, although the existing timeline RPC and orchestrator accept correlation. Trace existing callers and event identity before extending this helper; a correlation ID is evidence, never authority to access another tenant or customer.

### Existing voice branches require reconciliation

Open #411 and #418 predate newer caller-scoped Maia pilot work. They are not assumed to be ready for release. In particular, the inspected #418 head changes the Meta webhook to terminate an accepted call after sideband enqueue failure, despite its preservation-oriented title. Current main and its source-contract test preserve accepted media when optional sideband dispatch fails. Validate intended recovery behavior and reconcile the actual patch; do not copy an old whole-file snapshot over the current pilot.

The much older #46 voice UI branch and the Flux Social/integration/handoff branches also require individual review; their titles or previews do not prove compatibility. None is merged by this audit.

## First implementation milestone

1. Add failing runtime tests for the confirmed receipt replay defect using only synthetic events. Include completed replay, failed replay, simultaneous retries and interruption recovery.
2. Identify and reuse the existing durable execution/claim and idempotent metering boundaries. Preserve signature validation before storage/processing and server-resolved tenant/agent bindings.
3. Implement retry/recovery on an isolated branch. Verify exactly-once commercial settlement where supported; do not claim exactly-once external delivery solely from a database claim.
4. Extend tenant-isolation, permission and no-provider-call tests; keep WhatsApp media/pilot behavior unchanged. Then close correlation and channel-state parity gaps incrementally.

## Verification and boundaries

Next-phase tests must cover rejected signatures, foreign/unresolved tenant identities, revoked users, completed/failed/in-progress receipts, duplicate delivery events, true handoff outcomes, safe errors and permitted read-only diagnostics. Add browser checks only for changed interface behavior, preserving the existing purple design system and reduced-motion support.

No live call, email, campaign, message, trial, agent activation, integration disconnection, provider charge or production customer-data edit is authorized as a test. Hosted authenticated acceptance and real provider behavior remain separate from synthetic fixtures. This audit does not mark all earlier master phases complete or certify all channels ready.
