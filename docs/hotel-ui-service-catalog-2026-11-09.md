# Hotel dashboard and service operating rules

## Baseline and preservation

Built on main `0f7e26600f321056f98e1fb7ec4390dc3e8e16aa`, after the campaign/phone-import and AI-writing release, email drafts, social rendering and the four-variable WhatsApp follow-up fix. This PR changes hotel presentation, catalog guidance and their tests only. Existing booking transitions, payment verification, permissions, media protection, overview counts and Realty/Xposure paths remain in use.

The previous hotel chat's six-phase plan called for a simple hotel overview and a flexible room/service catalog, with service-specific concierge guidance. Existing catalog descriptions, prices, opening hours, images/videos and publication controls are extended rather than rebuilt. No Newt Enterprise content or defaults are copied into another tenant.

## Behavior

- Overview uses the hotel's saved name (organization name as fallback), five shortcuts, current operational metrics, arrivals/departures, published room-photo cards and five recent booking records. Prices, capacity and availability come from existing live room data. No sample revenue, guest portraits, fabricated occupancy or housekeeping queue is introduced.
- Presentation queries are bounded and tenant-scoped. Recent cards omit contacts, private notes and payment amounts. Only ready image media from published room entries gets 15-minute signed URLs. No image is invented when a hotel has not uploaded one. A details/media failure remains visible without erasing current authoritative operational counts.
- Hotel context changes reset the client overview/catalog state. The Services shortcut opens the service section; Room types and Services retain separate search/filter views.
- Each service can store questions to ask, booking requirements, restrictions, manager escalation rules and concierge guidance. Fields are limited to 2,000 characters and canonicalized for stable request fingerprints. Unknown keys, non-string values and room/service misuse are rejected.
- Rules use existing manager authorization, actor audit fields, revision conflict checks, draft workflow, publication locks and tenant RLS. Existing entries receive an empty rules object; their descriptions, media, pricing, publication state and identity are not changed.
- Concierge retrieval re-reads published rules for the active hotel along with current details and signed media. Guidance is business data, subordinate to hotel/platform privacy, consent and approval rules. It cannot grant permissions, confirm a service slot, book a room or collect payment. Unknown service availability still requires manager confirmation. Manager preview shows the service rules separately from guest-facing content.

## Migration and release boundary

`20261109073001_hotel_service_operating_rules.sql` is additive. It adds a bounded JSONB service-rules column and an immutable validation function, with no new client write grant or policy changes. The existing publication guard compares whole rows and protects the added column too. Apply the reviewed migration before releasing code that saves service rules. Without it, reads of legacy entries remain possible, but service-rule saves fail rather than silently dropping the data.

This change does not apply migrations, merge main, send WhatsApp messages, import real contacts or promote production. Payment collection, housekeeping, staff management, a new guest CRM, campaign scheduling and broader follow-up configuration remain outside this UI/catalog change.

## Verification

Targeted service/catalog/overview tests cover input limits, two-hotel isolation, published-only retrieval, fresh rules/media, service-slot uncertainty, manager/preview access, stale revisions, request replay, PostgreSQL constraints and published editing protection. Existing hotel regressions and shared Maia/Realty/Xposure checks are run separately. TypeScript, lint, production build and final CI evidence are recorded in the PR. Browser review uses clearly synthetic hotel data and never sends a customer message; it is not authenticated production verification.
