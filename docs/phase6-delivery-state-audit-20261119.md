# Phase 6 next increment: legacy delivery-state audit

## Verified base and release

Main `dca301573f7d5d89bb2743dfb711d8884d7ce37a` merged PR #429 with explicit user release approval. Tree `c5d3c8f78360bd850cd51d8f166f435ccef8e18a` equals the tested candidate tree. Production deployment `dpl_4sVX7MZtahgBNCqbxZPzJ5R2wDof` is READY with `fluxknight.space` and `www.fluxknight.space` assigned.

The next isolated branch is `feat/phase6-delivery-state-audit`, based on that released main. Open PRs and current source were inspected. Existing voice PRs #411/#418 and unrelated Flux Social work remain untouched. This is an audit milestone, not certification that all Phase 6 requirements are complete.

## Architecture

Canonical Real Estate receipts use `syncRealEstateProviderStatus` and existing service-only `apply_real_estate_delivery_receipt`. That RPC matches organization/provider/message IDs, rejects ambiguous matches, and guards stale timestamps/status regression in SQL. Reuse it where compatible; do not introduce another receipt database or queue.

Legacy Limitless evidence remains separate: `bot_sessions` status logs feed cooldown checks and `whatsapp_delivery_attempts` reconciliation. The current campaign report store identifies `real_estate_outbound_tracking` as canonical and maintains the older recipient ledger as supplementary evidence. The Meta webhook also writes the legacy attempts directly before invoking canonical receipt processing. Correction to the initial audit note: the Twilio route validates the account binding/signature but its legacy update also filters only by message ID. Both callback paths require organization-scoped writes.

## Confirmed findings

| Priority | Finding | Evidence and implication |
| --- | --- | --- |
| High | Status-store failures are indistinguishable from empty data | `getRecentWhatsAppStatuses` returns `[]` on missing configuration or failed HTTP response. Synthetic HTTP failure reproduced an empty result and an empty cooldown map for a nonempty audience. This is not proof that any real send occurred during an outage. |
| High | Legacy state can regress | `reconcileLimitlessDeliveryLedger` picks the first arrival-ordered message ID and overwrites the stored status. A synthetic `read` attempt was overwritten with `sent`. It does not use the canonical SQL status/timestamp guard. |
| High | Meta legacy mutation lacks tenant predicate | `updateAttempt` filters only `provider_message_id`, even though the webhook resolves a tenant. The actual helper was executed against an in-memory query recorder: no organization predicate was present. No cross-tenant production exploit or customer mutation was attempted. |
| Medium | Replay/concurrency can overwrite stronger evidence | Recording an existing accepted campaign result updates status back to `accepted`; reconciliation updates by row ID after a scoped read without conditional version/state protection. Source-inspected; concurrency has not been reproduced in a real database in this audit. |
| Medium | Legacy evidence provenance is incomplete | The status-log projection discards organization/provider identity and provider event time. No in-repository writer of `role=whatsapp_status` was found in the inspected app/lib source. Its external provenance and active use must be established before trusting or migrating historical rows. |
| Medium | Reconciliation failures can be hidden | `getLimitlessCampaignDeliveryLedger` catches reconciliation failures and returns rows without a freshness/error envelope. The helper is exported but no in-repository consumer was found in the inspected app/lib search; do not invent a dashboard regression or call this a verified active UI defect. |

The reproduced findings were executed by `/workspace/phase6-delivery-state-audit.cjs` against actual TypeScript modules loaded with synthetic fetch/database/provider boundaries. This is a defect-reproduction artifact, not a regression suite proving desired behavior. No network provider calls, production reads containing customer records, communications or billing were involved.

## Implementation sequence and acceptance gates

1. Separate verified provider-to-organization binding from agent runtime availability using existing resolution logic. A disconnected or unpublished agent must not prevent valid delivery evidence from being scoped. Require a verified organization for legacy receipt writes and preserve signature verification. Test shared provider IDs in two tenants and unknown bindings with zero foreign writes.
2. Distinguish unavailable status evidence from confirmed empty data, with sanitized errors. Campaign/cooldown consumers must stop before approval/dispatch when their required evidence is unavailable. Test HTTP/configuration/network/invalid-payload failures and confirm zero provider dispatches.
3. Reuse canonical receipt safeguards for compatible tracking; for remaining legacy rows, establish provider/time provenance and conditional monotonic updates. Test delayed/replayed/conflicting receipts and concurrent writes against a local database before choosing whether an existing RPC suffices. Do not assume a new migration is necessary.
4. Preserve explicit unavailable/stale states for any active ledger consumer and retain current tenant authorization. Do not backfill old evidence or replay communications automatically.
5. Run permission, tenant-isolation, communications and relevant UI regressions; prepare a separate reviewable PR/preview. This new increment is not part of the just-approved production release.

## Remaining independent gates

ElevenLabs inventory access and designated test tenant/agent/cost cap are still prerequisites for live voice acceptance. Phase 2–3 authenticated visual/workflow/native-zoom/performance acceptance and designated manager join/approval/removal acceptance remain open. A READY deployment does not resolve those gates.

## Production verification limits

Read-only smoke: `/account/login` returned 200; `/api/admin/subscriptions` and `/api/client-auth/manager-access` returned 401 anonymously. `/api/admin/organizations` and `/api/admin/clients` returned 404 and were not treated as authorization checks. Runtime error/fatal grouped query for the new deployment over the first short release window returned no groups; this is not continuous monitoring or a complete provider workflow test. No authenticated customer action, signed provider event, test message or paid call was executed.
