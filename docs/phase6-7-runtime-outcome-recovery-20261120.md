# Phase 6/7: runtime email and voice outcome recovery

## Audit and existing architecture

Base: main `d2c9947e151cc47ab76f3a66984f0ae158856544` (PR #441), fetched before creating `fix/runtime-outcome-recovery`. Open Gencouv #436/#438/#439, voice #411/#418 and Flux Social work were reviewed and left untouched.

The existing n8n email/voice workflows call the runtime provider, persist a decision, dispatch action intents through the existing command queue, then complete the execution. The provider and outbound transport stages are distinct from outcome persistence. Existing wallets, debit/capacity functions, runtime executions/progress, CRM records, queue uniqueness and audit logs remain the sources of truth.

Both persistence routes returned `200 duplicate` as soon as a matching message existed, even if subsequent CRM/task/usage/billing writes had failed. Voice events without transcripts had no primary-message marker and could repeat side effects. Separate HTTP writes could leave an audit message without a charged/completed outcome; concurrent requests had no shared transaction or claim.

Production schema inspection also verified unsupported `sender_type=assistant`, unsupported email usage type/unit fields, and the mismatch between `agent_conversations.customer_id` (legacy customer_profiles) and CRM IDs. The ignored usage writes could fail without affecting the response. Dispatch queried nonexistent `runtime_executions.input_payload`, omitted email subjects, used plain inserts for an already unique queue key, ignored progress-write errors, and reported blocked actions as successful dispatch.

Actual inspected triggers update timestamps and append CRM timeline entries; they do not dispatch providers. Tests retain production column defaults, checks, internal foreign keys and the existing debit body. The schema-only fixture omits unrelated stage/domain foreign keys and production triggers; it contains no customer rows or credentials. No real communications or calls are used as tests.

## Implementation

- `lib/runtime/communication-outcome.ts` and the two existing persistence routes: preserve authenticated route/JSON boundaries and existing rate/feature distinctions, normalize identity/date/text fields, and call a scoped atomic RPC. Errors distinguish invalid identity, feature denial, scope mismatch, unavailable evidence and legacy outcomes requiring review without disclosing database/provider diagnostics.
- Function and receipt-index migration `runtime_communication_outcome_recovery`: one partial unique index for new receipt events plus a service-only SECURITY INVOKER function with empty search_path. It verifies an active organization, agent/execution ownership, request fingerprint, expected wallet plan and available credits; serializes scoped retries; persists CRM/conversation/message/task/handoff/memory/usage effects; invokes the unchanged existing Flux debit; and commits completion proof plus initiating gateway/agent/execution audit together. Any failure rolls everything back. No new table, public grant, billing system or provider pipeline is introduced. The migration refuses unexpected prior function/accounting state.
- Exact retries recover the saved action intent, including original generated IDs/due dates, only with matching input and committed audit/billing proof. Zero-balance replay does not charge again. Historic partial writes fail closed for review; there is no automatic historical debit, refund, provider replay or backfill.
- Legacy customer/profile stores are not copied or merged. Existing verified profile links remain; otherwise a new conversation records the CRM reference in metadata with a null legacy-profile pointer. Cross-tenant and conflicting customer/conversation/lead IDs are rejected. Unrelated lead details remain intact. New messages use the supported agent sender type; usage uses ai_tokens and existing columns. Unsubscribe uses supported inactive lifecycle plus explicit suppression metadata, preventing later sends.
- `lib/runtime/command-queue.ts` and the existing dispatch route: reuse the existing `(organization_id,idempotency_key)` constraint with conflict-ignore insertion and verified existing-command lookup. Do not overwrite/restart jobs. Conflicting or failed jobs require review. Preserve subjects and sanitized command responses, distinguish integration lookup failure from missing configuration, check progress persistence, and return needs-attention for blocked/partial actions. Recovered email actions recheck current contact suppression and recipient identity. Existing Maia WhatsApp gateway dispatch remains in place.
- New runtime/database/dispatch tests, schema fixture, query adapter, existing commercial/catalog contracts, package scripts and the existing billing CI workflow cover this boundary and independent PostgreSQL sessions. Source assertions were moved to the shared implementation; runtime tests verify the actual gates and units.

## Billing and compatibility

Rates are unchanged. The real plan catalog also exposed a missing Business+ email-follow-up entitlement despite its full email automation; that omission is corrected without granting Basic/Plus email access or Business full automation: email remains 3 credits, email follow-up 2, voice retains its existing rounded terminal-event units and minimum-unit fallback. Missing duration is explicitly labeled `legacy_minimum_unit`, not a fabricated measured duration. Nonterminal voice events keep the existing no-debit behavior. Maia's user-selected 2-credit reasoning-step policy remains unchanged. Provider costs remain modeled, not invoice verification.

This increment makes internal outcome writes and their existing charge atomic. It does not certify upstream email/voice provider pre-execution reservation coverage, measured OpenAI duration policy, live email/voice delivery, legacy outcome reconciliation, provider mapping or callback acceptance. The existing ElevenLabs signed-receipt path is preserved.

## Verification and rollout

Verification results, exact candidate/release hashes, migration registration, preview and production readback will be recorded after execution. Do not infer a passed independent-connection test from PGlite's single connection. No new UI or layout is introduced, so no newly authenticated screenshot/visual-baseline approval is claimed; hosted responsive regressions remain applicable to their actual synthetic cases.

Apply only this reviewed function/index migration after exact-head hosted tests pass, verify its actual registration/body/grants and reconcile the repository ledger, then release the application after final exact-head gates. Do not push the entire historical migration directory. Retaining the unused function permits a compatible application rollback; preserve all committed records, queue evidence, ledger and receipts. Never delete/restart a queue entry or replay a provider as a rollback shortcut.

News remains the non-customer acceptance organization; authenticated owner/manager and controlled provider acceptance are still open. Xposure's approved packages/prices/availability/knowledge are still required. This work does not mark Phases 6/7 or the cross-phase acceptance gates complete.

### Local candidate verification

- Focused actual SQL/runtime/dispatch recovery: **31 passed**, zero skipped.
- Full support suite after the final ownership/suppression guards: **720 passed**, zero skipped.
- Existing financial wallet/capacity/recovery/operation/visibility regression: **122 passed**, zero skipped.
- Migration-ledger and commercial/catalog contracts: **28 passed**, zero skipped.
- Changed-module ESLint, TypeScript and optimized production build passed. Test groups overlap and are not additive unique-case counts.
- Independent PostgreSQL concurrency is configured in the existing billing job against a dedicated disposable localhost database. It has not run locally; no hosted result is claimed yet.

Initial fixture runs identified foreign-key setup ordering and VM Error-constructor identity mistakes; those harness issues were fixed without weakening authorization/rollback assertions. Early actual SQL execution also exposed an ambiguous audit-column reference in replay, which was qualified before the successful run. Only synthetic local data was involved.

The existing progress lookup has an organization/execution index. The new partial unique index covers only committed communication receipt events and enforces scoped operation identity without changing existing history. Legacy saved outcomes still require evidence review. The canonical tenant inbox wiring, provider availability/mapping, upstream provider reservation adoption and final authenticated acceptance remain separate work; this increment is not a channel rollout or delivery certification.

### Verified production schema registration

Source candidate `99f59cafc07f4790fae0cc7cbd0b79d56e0b1a25` passed all applicable hosted workflows, including the new independent PostgreSQL sessions (two tests, zero skipped) and the six-width control-center suite. Its preview `dpl_7CEF81DXPwhbGtKZTKcurh1FkWwG` is READY at https://limitlessnx-agent-website-2-ihme8jzqs-fluxagents.vercel.app; the protected login fetch returned 200. This is not authenticated tenant acceptance.

After those gates passed, Supabase applied only the reviewed migration as **20261120121533_runtime_communication_outcome_recovery**. The official CLI-generated candidate filename was reconciled to that actual registration, with identical SQL bytes (SHA-256 `7e5a0acdeaed2724986298f442f6d8a7820839def983f2ec5c97922e6f7ccd2a`). Remote migration history was not rewritten; unrelated pending migrations remain pending.

Readback verified function body MD5 `6518d2d07bdc5dc687c5add49da80a66`, SECURITY INVOKER, empty search_path, denied anonymous/authenticated execution and allowed service execution. The partial unique index is valid. The existing debit body MD5 `cad92f4730562aa51d724a20b217effb` is unchanged. Existing service table and sequence permissions were checked individually; no new table grants were required. The security advisor returned no finding referencing either new object; pre-existing findings remain outside this increment.

This registration modifies production schema only. No customer rows, wallets, subscriptions, existing history or provider configuration were backfilled or edited; no real runtime outcome, communication, call, simulation or charge was initiated as a test. The new function remains compatible with the preceding application because it has no automatic trigger/consumer on registration.

The final registration/Business+ entitlement commit must pass exact-head hosted checks before application merge/deployment. Local follow-up verification passed **32 focused cases**, **four ledger checks** and **41 plan/runtime/catalog/metering checks**, with zero skipped, plus changed-module lint and types. Earlier 720 support/122 financial runs remain evidence for their source; final hosted tests cover the entitlement correction. The plan matrix uses actual feature definitions, not an always-allow mock, and proves Basic/Plus denial, Business follow-up-only access and Business+ full/follow-up access.

The read-only ElevenLabs inventory retry still returned connector internal error `-32603`. No IDs were guessed, provider configuration changed or calls/simulations made. Actual provider mapping/availability remains unverified. Generic execution-finalization telemetry/replay and canonical inbox wiring remain separate acceptance work alongside upstream reservation coverage and authenticated owner/manager journeys. No complete Phase 6/7 claim is made.
