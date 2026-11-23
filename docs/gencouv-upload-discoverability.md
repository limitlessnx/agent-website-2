# Gencouv campaign upload discoverability

Base: main `80ac9ecb55549d70479daaf9d6708f6fd9f4e0c0`. The user could not locate the file uploader from Email Marketing: it existed on `/dashboard/gencouv/contacts`, but its campaign-screen link looked like ordinary text.

Changes reuse `GencouvContactImport` directly at the top of Email Marketing. Its compact presentation omits the separate contacts/history tables and links to their existing page. The composer has a 44px purple shortcut to the visible upload section; it no longer navigates away from an unsaved campaign. The native file chooser has a purple touch target. CSV/Excel/TXT limits, preview, categories, duplicates and consent handling are unchanged.

The automated-campaign explanation now states plainly that automatic sending is not set up yet. Manual reviewed sends remain independent. This presentation change does not implement or enable the missing Trigger email sender, alter authorization, grant consent, send email or change production customer data. No API, database or provider configuration changes.

Files: `GencouvMarketingWorkspace.tsx` embeds the existing importer; `GencouvContactImport.tsx` supports compact presentation; `GencouvBulkCampaigns.tsx` adds the in-page upload shortcut and clear automation explanation; `gencouv-marketing.css` styles the file chooser/shortcut; the marketing page describes uploading; the existing Playwright workflow now starts its full import-to-manual-send scenario on Email Marketing and checks the upload input is in view at each of six widths.

Verification uses the existing synthetic provider/database fixture, not real recipient delivery. Screenshot evidence is generated under `test-results/gencouv-captures/imported-*.png`. Hosted checks, preview and production release status are recorded on the pull request after they finish. No authenticated production send is claimed.
