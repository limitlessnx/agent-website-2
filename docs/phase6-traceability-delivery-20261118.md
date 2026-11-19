# Phase 6 increment: communication evidence traceability

Base inspected: released main `c850347a1051a21909167518808fbff78387ff12`. Branch: `feat/phase6-communication-correlation`. Latest main, recent releases, open PRs and the relevant #411/#418 file lists were reviewed before changes. Those older voice branches are not merged or copied over the current runtime.

## Current state

The approved atomic voice-receipt release #427 and account onboarding #428 are live. Read-only production metadata confirms both voice tables, the atomic receipt function and the two canonical voice migration records exist. The old audit's missing-foundation statements describe its original inspection and are not current blockers.

Provider acceptance is still incomplete: zero `agents.configuration.elevenlabs_agent_id` mappings are configured. Two read-only ElevenLabs agent-list requests (general inventory and Maia search) returned MCP internal error `-32603`. This is not evidence that the provider workspace is empty or connected correctly. No agent/configuration/call was changed. See [provider acceptance plan](phase6-provider-acceptance-plan.md).

## Confirmed defect and change

`addCanonicalTimelineEvent` discarded correlation IDs by always sending `p_correlation_id: null`, even though the existing timeline RPC and database column accept UUID traces. As a result, application-created timeline evidence could not be followed through the same trace as its originating inspection or session.

The helper now accepts an optional explicit correlation ID. It does not infer one from metadata, generate a random trace on retry or use a trace as tenant/customer authority. Existing callers that omit the field retain null behavior.

Existing source IDs supply the trace:

- Public Leo lead capture uses its persisted session ID.
- Evaluation capture uses its evaluation ID.
- Inspection outcome and its provider-accepted follow-up use the inspection ID, matching the correlation already used for booking/rescheduling/cancellation system events.

Organization, customer, conversation and actor arguments remain independently scoped. The actual existing SQL enforces composite tenant foreign keys. No provider dispatch, timing, consent, approval, opt-out, handoff, metering or delivery-state behavior changes. An accepted send remains `accepted`; missing provider acceptance still records `unknown`, emits no successful follow-up timeline and performs no metering in the tested path.

## Compatibility and historical records

Production's existing timeline function body MD5 is `b63486216effce2be535ee68e2d25ac5`, matching the function executed in local SQL tests. No new RPC, event bus, queue, table or migration is introduced. Browser roles cannot execute the privileged timeline RPC; its existing grants are retained.

The current RPC's source-key upsert updates summary/metadata/time while preserving the first stored correlation. Replaying an existing row cannot replace its trace. Existing null-correlated records remain null; this increment does not backfill historical data or claim to repair every older trace. Historical recovery needs a separately reviewed plan, not automatic customer-record edits or communication replay.

The local migration snapshot incrementally records only the two voice migrations whose production registration was read back. The pending-migration test removes only those now-applied versions. No production migration history was modified by this work.

## Changed files

| Files | Reason |
| --- | --- |
| `lib/canonical-customer.ts` | Forward explicit trace IDs to the existing RPC and pass persisted public Leo/evaluation source IDs; remove unnecessary broad `any` casts using the existing SDK client. |
| `lib/real-estate-inspections.ts`, `lib/real-estate-inspection-worker.ts` | Preserve the inspection trace in outcome and accepted-follow-up timeline evidence. No message-send or billing behavior is changed. |
| `tests/communication-correlation.test.cjs` | Seven actual helper/producer/worker scenarios, synthetic provider/database boundaries only. |
| `tests/communication-correlation-database.test.mjs` | Five real-SQL scenarios using the existing table/RPC: storage, replay, tenant isolation, grants and explicit historical-null behavior. |
| `supabase/migration-ledger.production-snapshot.json`, its test | Record only verified applied voice migrations; preserve unrelated pending versions and original baseline dates. |
| `package.json`, existing Maia verification workflow | Register focused checks and full existing inspection regressions without creating a second communications pipeline. |
| Phase 6 delivery/acceptance docs and historical-audit notices | Distinguish released functionality, this increment and remaining provider/channel work. |

## Verification

The initial helper baseline reproduced the supplied-correlation failure before the fix. Final focused checks: **12 passed** (seven runtime/producer cases and five database scenarios). Tests execute the actual helper, public/evaluation capture code, inspection outcome/worker and the existing timeline SQL, not just source patterns.

Local Real Estate suite: 49 test files passed. Support suite: 77 files passed, including the two new focused files. Maia: 25 files passed. Changed-file lint and migration-ledger checks passed. Final local production build/type checks passed. Current-head hosted CI/preview results are recorded in the PR after completion. Historical whole-repository lint debt remains.

Tests use PGlite or synthetic stubs only. Provider dispatch and metering boundaries are mocked. No real message, email, call, valid provider callback, trial, charge or customer-data write was performed. No UI change or new screenshot/visual baseline is claimed; existing hosted regression suites still run.

## Remaining Phase 6 work

1. Restore read-only provider inventory access and select an authorized test tenant/agent before proposing an exact activation/test plan and cost cap.
2. Validate the signed provider callback, tenant mapping, entitlement and real provider lifecycle under separate explicit approval. Installed storage is not a functioning voice connection.
3. Continue channel-state parity audit. The legacy Limitless delivery ledger still needs a scoped review of status-log read failures, out-of-order receipt handling and tenant/provider identity evidence; this increment does not certify or rewrite that pipeline.
4. Design historical correlation/backlog recovery without automatically replaying communications or altering customer records.

This is a traceability increment, not completion of every Phase 6 channel. Live manager approval/removal acceptance from #428 also remains pending designated test-account details.

## Production boundary

No main merge, production deployment, schema/grant/provider change, activation, customer record update or real communication is performed by this branch. User approval to return to Phase 6 authorizes this isolated implementation/review work; production release and any billable provider acceptance require their own explicit approval.
