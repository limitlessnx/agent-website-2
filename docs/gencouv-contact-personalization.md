# Gencouv contact-name extraction and recipient personalization

Base: main `5447452616a29fc5fcda25f5b1211bb9cec2a758` (PR #458). Open Gencouv import/bulk/Brevo drafts and the homepage-video PR remain separate.

## Findings and behavior

CSV/Excel imports already read common name columns and the sender already supported `[Name]`, but TXT imports discarded names, later duplicate rows could discard a supplied name, missing existing CRM names were never filled, and message previews showed raw placeholders. UTF-8 CSV names without a BOM could also be misdecoded. JavaScript replacement-string tokens inside a literal contact name could corrupt the rendered provider message; historical SQL rendering was case-sensitive.

Names now come only from explicit file data. CSV/Excel support Name, Full Name, Contact Name, Recipient Name, First/Given Name, Middle Name and Last/Surname/Family Name. UTF-8 and legacy Windows CSV are decoded explicitly. TXT supports one named contact per line, e.g. `Ada Okafor <ada@example.com>` or `Ada Okafor,ada@example.com`. Lines containing multiple addresses are kept without assigning an ambiguous name. Email-only lists never infer a person's name from the address.

The first nonempty name for a duplicate address within the file is retained. Import preview reports named/unnamed counts. On an explicitly reviewed re-import, a supplied name can fill a blank existing name. Nonempty existing names, contact status, consent, suppression and other organizations are preserved. The result and audit include `names_added`; retrying the same import batch returns its saved result.

The campaign composer has Insert recipient name, which inserts `[Name]` at the cursor. After selecting an eligible audience, Preview message offers a recipient selector showing the actual rendered greeting for each selected contact. Missing names use `there`. Preview and provider payload use one literal renderer. SQL reservation stores the corresponding rendered body, including case-insensitive name-token handling. Subject personalization and email-address name guessing are not introduced. Individual proposal behavior is preserved.

## Files and safeguards

- `lib/gencouv-personalization.ts`: explicit-name cleanup and shared literal placeholder renderer.
- `lib/gencouv-contact-import.ts`: column aliases, UTF-8/Windows CSV decoding, TXT names, missing-name duplicate enrichment and counts.
- `lib/gencouv-send.ts`: shared renderer; reservations, authorization, quotas, consent, suppression and provider idempotency remain unchanged.
- `app/api/dashboard/gencouv/contact-import/route.ts`, `components/gencouv/GencouvContactImport.tsx`: name counts, supported formats and import outcomes.
- `components/gencouv/GencouvBulkCampaigns.tsx`: cursor insertion and per-selected-recipient message preview.
- `supabase/migrations/20261124150809_gencouv_contact_name_personalization.sql`: forward update of two existing invoker functions, guarded by prior function checksums. No tables, columns or backfill. Names change only when a user commits a reviewed import. Browser execution remains denied and service-role execution allowed.
- Existing runtime/database/browser fixtures and tests verify names, encoding, duplicate policy, consent/tenant isolation, idempotent import, literal names and provider/ledger/preview agreement at all six widths. The production migration ledger records only the verified new migration.

## Evidence and release boundary

Initial local checks passed: 21 runtime tests, 19 SQL tests, TypeScript, scoped ESLint and the first 360px name/missing-name preview case. Complete six-width browser and hosted release results are recorded on the PR after execution. Rendered evidence is synthetic and no real inbox delivery is claimed. The migration was applied under existing production authorization; readback confirms invoker functions, pinned search path, no browser execution and automation OFF. No production customer records were modified or test emails sent by applying these function definitions.
