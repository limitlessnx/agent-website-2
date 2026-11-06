# Xposure campaign workspace

Xposure's existing `/portal/campaigns` destination now shows the linked customer follow-up/campaign template, its language, live provider approval and message body. Inputs use the configured variable names; customer name is filled for each recipient. Staff handover and appointment reminder templates are excluded from campaign selection. Other tenants retain their existing composer; hotel sending keeps its specialized policy.

## Contacts and sending

The contact area supports manual international phone numbers, a browser contact picker and `.vcf` import. A review list allows names, phone numbers and selection to be corrected before saving. The picker requests only name and phone. No contact is imported merely by opening the page, choosing a file or adding it to review. Files over 2 MB and batches over 500 contacts are rejected.

The API uses the existing Xposure authorization guard and `tenant_customer_contacts` store. It ignores client-supplied tenant and consent fields. Only an explicit boolean confirmation records marketing permission. Numbers require a country code, are normalized to E.164 form and deduplicated within the batch. Existing contacts cause an atomic conflict response; import never overwrites an opt-out. No migration is required. Existing Limitless import code is unchanged.

The audience combines existing CRM clients with saved contacts, preferring the saved contact for the same normalized phone. Contacts without recorded marketing permission or with an opt-out cannot be selected. Current server-side permission, tenant binding, active linked template, live Meta approval, exact language/purpose and contact consent are checked at submission. Missing receipts and uncertain submission failures are reported as unknown, with no automatic retry. Provider acceptance is explicitly distinguished from delivery.

Campaigns use the existing synchronous send endpoint. This change does not introduce a campaign scheduler, durable campaign queue, send-once campaign job or automatic retry. Large audiences retain the existing endpoint's hosting/runtime limits.

## Design and verification

The user explicitly selected Taste as the alternative to the unavailable 12ui account. Applied Taste's plain labels, one control system, aligned edges, restrained neutral surfaces, readable forms and reduced-motion behavior within the existing portal shell. Its marketing-only full-screen hero, invented-brand, photo and footer rules were not applied to this authenticated working screen. No new dependency was added to the application manifest.

The actual client components were bundled into a local fixture using test-only HTTP endpoints, without production contacts or credentials. Browser interaction checks cover template loading, disabled opt-outs, required values, explicit review/cancel, manual import without consent, vCard import with consent, a mocked campaign submission and a simulated contact picker. Five viewport widths (1440, 1024, 820, 768 and 390) have no horizontal overflow or browser runtime errors. A hidden file input overflow found during verification was fixed. Taste's screenshot script produced desktop and phone evidence. Fixture screenshots do not establish authenticated production access, live Meta template text or actual device-picker compatibility on a physical phone.

The [Contact Picker API](https://developer.mozilla.org/en-US/docs/Web/API/Contact_Picker_API) depends on browser support and a secure top-level context; the picker is invoked directly from the user's button click. Unsupported browsers retain manual entry and vCard import.

## Checks

- Campaign/contacts behavioral tests: 15 passing.
- Xposure dashboard/tenant authorization: 26 passing.
- Hotel regressions: 26 passing.
- Maia regressions: 134 passing.
- Support: 525/526 on Windows. The existing `trigger-schedules-paused.test.mjs` assertion expects forward-slash paths but receives Windows backslashes; no scheduling code changed.
- TypeScript and focused lint passed during implementation; repeat on final commit in CI.
- Remote production build and preview: pending PR checks at initial publication.

Production has not been promoted and no real campaign message has been sent. Review and required checks must complete before release.
