# Gencouv email marketing verification

## Implementation

The existing marketing workspace now saves and edits campaign drafts, previews consent-eligible categories, personalizes reviewed messages, and reserves up to 100 recipients before calling Resend. The existing message ledger stores submission and provider delivery states independently. Stable request IDs, provider idempotency keys, campaign-recipient uniqueness and single-use submission authorization prevent request replay from sending again. Unknown/partial outcomes remain held; reconciliation reads provider outcomes without resending.

Imports validate CSV/XLSX/XLS/TXT content, reject oversized sheets instead of truncating them, normalize email case and commit contacts, category assignments, consent provenance and import history atomically. Existing contacts retain their prior consent. Publicly collected addresses are not converted into opted-in subscribers.

Legacy controls share persisted campaign settings. Limit-only changes preserve the saved toggle. The existing enrollment RPC now requires enabled, verified automation and documented CRM consent. Enabling an unverified external sender is deliberately blocked. Manual email remains independent. No worker is enabled by this release.

Signed Resend events filter Gencouv senders, deduplicate events, preserve advanced delivery states, and apply suppression transactionally. Genuine external Gencouv sends remain visible. Inbound events retrieve received message bodies and preserve reply threading. Individual proposals and inbox replies use the same durable sending reservation. Uncertain outcomes retain their draft and original request identity; checking a saved reply retains its recipient even when another inbox thread is viewed.

The external dashboard feed has a bounded timeout and validated response contract. A failed feed cannot disable imports, campaign drafts or manual sends.

## Files and reasons

| Area | Files | Purpose |
|---|---|---|
| Shared server boundaries | `lib/gencouv-admin.ts`, `lib/gencouv-email-policy.ts`, `lib/gencouv-campaign-settings.ts` | Workspace authorization, mutation-origin validation, consent eligibility, consistent persisted controls. |
| Delivery and events | `lib/gencouv-send.ts`, `lib/gencouv-resend-signature.ts` | Durable reservation, stable provider key, uncertain-outcome protection, signed unsubscribe and webhook verification. |
| Parsing and feed | `lib/gencouv-contact-import.ts`, `lib/gencouv-dashboard-feed.ts` | Bounded parsing, accurate duplicate/invalid counts and isolated external-feed errors. |
| Existing dashboard APIs | `app/api/dashboard/gencouv/{bulk-send,proposals,contact-import,campaign-audience,outbound-settings}/route.ts` | Connect existing workflows to scoped, transactional safeguards. |
| Campaigns/history | `app/api/dashboard/gencouv/{campaigns,email-history}/route.ts` | Draft persistence, immutable sent content, paginated delivery history and read-only reconciliation. |
| Legacy APIs | `app/api/gencouv/{email-control,email-reply,email-sequences,inbox-action,resend-webhook}/route.ts` | Close authorization gaps while preserving controls, inbox threading and external-event history. |
| Preferences | `app/api/gencouv/unsubscribe/route.ts` | Signed recipient capability; GET is scanner-safe, POST saves suppression. |
| Existing UI | `components/gencouv/{GencouvBulkCampaigns,GencouvMarketingWorkspace,GencouvContactImport,GencouvEmailControls,GencouvInbox}.tsx` | One campaign composer, explicit review, stable request identity, accurate controls and import history. |
| History UI/styles | `components/gencouv/GencouvEmailHistory.tsx`, `components/gencouv/gencouv-marketing.css` | Visible delivery states, retry/reconciliation feedback and purple responsive styling. |
| Dashboard | `app/dashboard/gencouv/page.tsx` | Scoped ledger reads and independent feed failure handling. |
| Database | `supabase/migrations/*_gencouv_email_marketing_reliability.sql`, `supabase/migration-ledger.production-snapshot.json` | Additive campaign/batch identity, existing-ledger links, service-only invoker RPCs, indexes and verified migration registration. |
| Tests | `tests/gencouv-marketing-{runtime,database}.test.cjs`, `tests/fixtures/gencouv-marketing.sql`, `tests/gencouv-marketing/*`, `playwright.gencouv.config.ts` | Provider-failure, schema, consent, isolation and six-width rendered workflow verification. |
| Regression/CI | `tests/gencouv-custom-lead-categories.test.mjs`, `.github/workflows/gencouv-email-marketing.yml` | Correct an existing stale migration path and retain repeatable checks/artifacts. |

## Evidence completed

- TypeScript and scoped ESLint passed locally.
- Runtime/database tests cover provider timeout, partial/rejected acceptance, ledger failure, duplicate replay, suppression, permission/origin failures, parsing limits, import provenance, quota enforcement, 100-recipient reservations, signed events, external-sender isolation and inbox reply threading.
- Existing category/navigation regression tests pass.
- Thirty-six rendered Playwright checks passed at 360, 430, 768, 1024, 1440 and 1920px. They exercise import, category assignment, campaign draft/preview, one synthetic provider submission, duplicate replay, signed delivery update, automation OFF preservation, denied access, empty/error states and unavailable-feed navigation. External provider network access is blocked in the fixture.
- Screenshots are generated by real rendered pages in `test-results/gencouv-captures/`; CI uploads the `gencouv-synthetic-responsive-evidence` artifact. These are synthetic after-change evidence, not approved historical visual baselines or authenticated production screenshots.
- The additive migration was applied with the task's production authorization. Readback verifies RLS, no browser grants, service-only invoker functions and preserved campaign state.
- A real-schema transaction using `service_role` exercised import, category assignment, import history, reservation, single-use authorization and uncertain replay, then rolled back. No provider was called and no synthetic contact/history records were retained.
- Security advisor warning categories/counts remained unchanged; the two new private tables add expected informational RLS-without-browser-policy notices.

## Acceptance still requiring external access

A successful direct provider test from an earlier session does not establish dashboard acceptance. This work has not sent the authorized live acceptance email. A signed-in production browser is required to complete that one-recipient dashboard submission and verify its provider delivery and saved history. Do not replace it with a direct provider send or broaden the recipient's permission into ongoing marketing consent.

Direct access to the external n8n host is blocked by this execution environment. No Gencouv-specific Trigger sender was found in the repository, and the live n8n sender/queued-work pause policy is not verified. Its ON control remains unavailable until the actual worker's pre-send permission, suppression, quota and persisted-state checks are reviewed. Do not mark the worker verified merely because database tests pass. Live feed authentication/response health also remains unverified; feed failure isolation is tested.

PR: https://github.com/limitlessnx/agent-website-2/pull/455. Release/preview status must be checked against the final implementation commit; an earlier READY preview is insufficient.
