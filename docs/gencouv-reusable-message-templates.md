# Gencouv reusable email message templates

Base: main `09131d0f2a033a1d0aefa04ceef623773ab958f6` (PR #457). Existing open import/campaign/Brevo PRs remain separate.

## Behavior

Both manual bulk campaigns and individual proposals offer Save message as template and Load selected template. A saved template contains sender, subject and message; the subject names it and its saved date identifies versions. Templates persist across sessions and are shared inside the authorized Gencouv workspace. Older saved campaigns are also reusable. Load more saved templates exposes records beyond the first 100.

Loading copies content into a fresh composer. It does not copy recipients, category, consent confirmation, send confirmation, campaign identity, request nonce or delivery history. Bulk reuse requires saving a new campaign and reviewing a new eligible audience. Individual reuse clears the prior recipient. A provider-uncertain composer cannot load another template or replace its held request. Nothing is sent by saving or loading; automation stays in its persisted state.

## Existing infrastructure reused

Saved message snapshots use the existing `gencouv_bulk_campaigns` draft storage and authorized campaign API. No new tables, schema migrations, separate sender, provider template synchronization or automatic sending. Existing sent campaign records remain immutable; the template action creates a new snapshot rather than editing those records.

- `components/gencouv/GencouvMessageTemplates.tsx`: shared library provider and reusable controls, paginated loading, retry feedback, shared save lock and stale-read protection.
- `components/gencouv/GencouvBulkCampaigns.tsx`: reusable content in a new campaign, clears recipient selection and review state; normal draft saves refresh the shared library.
- `components/gencouv/GencouvMarketingWorkspace.tsx`: provider shared by both composers, preserves existing starter proposals, clears recipient and confirmation when loading saved content.
- `app/api/dashboard/gencouv/campaigns/route.ts`: bounded pagination with stable ordering; retains administrator/workspace authorization, private headers, sender validation and immutable sent content.
- `components/gencouv/gencouv-marketing.css`: scoped purple library panel with existing responsive controls and focus states.
- Runtime/browser tests and the existing Gencouv verification workflow extend pagination, persistence, cross-composer reuse and recipient/history protection coverage. The browser fixture alone can mark a synthetic campaign locked; no such test endpoint exists in production.

## Verification boundaries

The browser suite uses synthetic contacts and a blocked external provider. Screenshots are rendered evidence, not an authenticated production send. No real email is needed for saving/loading templates; no customer communications or automation activation are authorized by a template save. Production deployment, checks and artifact links are recorded on the PR after verification.
