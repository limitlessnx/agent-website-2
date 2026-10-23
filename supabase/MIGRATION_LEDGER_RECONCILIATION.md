# Supabase migration ledger reconciliation

## Root cause

Supabase production recorded 186 migration versions, while the repository's `supabase/migrations` directory was missing 20 of those versions. Eleven migrations had equivalent SQL retained under a different local filename/version. Nine historical migrations had no matching local file and were reconstructed from the current production schema, available branch source, and existing template records.

The snapshot in `migration-ledger.production-snapshot.json` records the remote version/name pairs captured on 2026-10-23. The CI regression test verifies that every recorded remote version has a local SQL file, exact versions are unique, and no shorter numeric version is a prefix of a longer version.

## Confirmed Supabase branch failure

The Supabase Branches dashboard workflow log recorded:

`ERROR Remote migration versions not found in local migrations directory.`

This matches the read-only ledger comparison: production has 186 recorded versions, and the original `main` branch lacked 20 corresponding SQL files. After those missing files were restored, fresh hosted workflow logs exposed a second issue: versions `20260724` and `202607240001` trigger an ordering bug in the Supabase Go migration runner. The workaround renumbers `workflow_orchestrator_foundation` to `202607250001`, avoiding the ambiguous prefix without changing its SQL schema intent.

After the merge, a rebase was requested for the existing Supabase development branch (`eb49549a-3e7f-4f5d-a225-2502290f6816`). The rebase API returned success, but subsequent branch status checks continued to show `CREATING_PROJECT` and then `MIGRATIONS_FAILED`, with a stale update timestamp from 2026-07-23. The branch replay is therefore **not verified as successful**.

Fresh workflow logs on 2026-10-23 continued to report `Remote migration versions not found in local migrations directory` after the file-restoration repair. The numeric-prefix collision above is the identified cause. The workaround requires coordinated migration-ledger metadata reconciliation in production and the existing preview branch; it does not require applying the SQL migration body.

Dashboard:
https://supabase.com/dashboard/project/tacxegmlppngnuvldojy/branches

## Explicitly pending migrations

After reconciliation, these nine local migrations are not present in the captured production ledger. They are intentionally left pending and must not be applied as part of this ledger repair without a separate review and approval:

| Version | Migration | Known effect / review note |
| --- | --- | --- |
| `20261001233000` | `recurring_limitless_installment_reminders` | Changes Limitless Realty reminder-template enablement and timing. The live database currently has three enabled templates; this migration disables all templates for the organization and enables a 14-day check-in. Do not apply implicitly. |
| `202610020001` | `client_onboarding_outcome_intake` | Adds profile fields and comments. The fields already exist in production; likely mostly idempotent. |
| `202610020002` | `expose_service_readiness_refresh` | Adds a service-role-only public wrapper around the private readiness function. The public wrapper is currently absent. |
| `20261002003000` | `maia_canonical_handoff_route` | Changes Limitless Realty Maia's configured delivery route from the legacy n8n route to `sendWhatsAppMessage`. This is a behavioral routing change. |
| `20261004150000` | `ai_business_evaluation` | Adds evaluation schema/indexes and lead columns. The core tables already exist in production; review for any residual schema drift before applying. |
| `20261007193000` | `public_leo_session_storage` | Creates Leo session/message/tool-call tables, which are absent in production. |
| `20261009230000` | `phase2_plan_channel_allocations` | Creates organization plan/channel allocation structures, which are absent in production. |
| `20261011143000` | `phase7_business_voice_allocation` | Changes plan/channel allocation rules and depends on the Phase 2 allocation structures. Review together with the preceding migration. |
| `20261012090000` | `phase7_elevenlabs_voice_runtime` | Creates ElevenLabs voice runtime tables, which are absent in production. |

The explicitly draft-only `20261003_limitless_maia_knowledge_source_of_truth.sql` was moved to `supabase/drafts/migrations/` because its own header says not to execute it in production.

## Safety boundary

The file-level workaround and regression test are prepared on a repair branch. The production ledger metadata and preview branch state must be reconciled before the hosted workflow can be considered healthy. No SQL schema migration was applied, no database branch was created, and applying any of the nine pending migrations remains a separate release decision.
