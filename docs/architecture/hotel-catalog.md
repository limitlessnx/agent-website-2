# Hotel Catalog and WhatsApp offer lookup

The Hotel Catalog at `/portal/hotel/catalog` has Room types and Facilities & experiences sections. It follows the repository GPT TasteSkill and the existing portal controls. It extends the Phase 2 review branch; no migration, storage bucket, agent change or UI has been released to production.

## Manager workflow

Create room types and physical rooms in the Hotel workspace first. Each room type can have one catalog entry, linked by a tenant-scoped foreign key. The entry adds a description, bed options, amenities, guest guidance, photos and videos. Capacity, name, currency and base nightly price remain owned by the existing room type; catalog edits cannot duplicate or overwrite them. Existing reservation quotes remain snapshots.

Facilities and experiences have a name, description, features, opening hours, booking instructions and one pricing mode: included as described, paid, or manager-confirmed. Paid services have an exact minor-unit price, currency and per-session/person/day/stay unit. This is a service catalog, not service-session scheduling or payment collection.

Entries begin as drafts. A description is required to publish. Published content and media must be withdrawn to draft before editing. Archive is reversible through Restore to draft. State/content writes compare the current revision; media changes also advance the parent revision. Multiple authorized managers share the catalog without silently overwriting stale content. A failed save keeps the form open.

Catalog reads require active hotel membership and `customers.view` or `customers.manage`; writes require `customers.manage`. Trusted admin previews are read-only. Tenant and actor come from the server session. Other industries retain their existing navigation and tools.

## Private media

The pending migration creates the private `hotel-catalog` bucket. A restrictive Storage policy denies direct anonymous/authenticated object access for this bucket even if an older broad permissive policy exists. It does not change access to other buckets. Server authorization issues one-time-path signed uploads and short-lived signed reads; no service credential enters the browser.

Images support JPG, PNG and WebP up to 6 MiB. Short videos support MP4 up to 16 MiB. There are at most 12 active/pending files per entry. Uploads go directly from the browser to signed Storage URLs, avoiding the application request-body size limit. A pending media row reserves a tenant/item-scoped random path. Finalization downloads the bounded object, checks its byte length and media signature, and marks it ready. SVG, arbitrary external URLs and unsupported video formats cannot be attached. Caption/order are editable on drafts; the first ordered image is the catalog cover. Videos use native controls without autoplay.

Pending uploads prevent publication. A manager can finish verification after an interrupted upload or remove the pending entry and retry. Removed objects remain private in Storage; this release does not add a purge job. Signed read links expire in 15 minutes, including links already shared before withdrawal. Unpublishing stops new agent retrieval but cannot revoke an already issued bearer URL immediately.

## WhatsApp agent

The existing Maia runtime exposes `search_hotel_catalog` only for hotel industry context and still applies the tenant's tool policy. The tool independently verifies that the organization is an active hotel. It reads only published entries, their ready media, current room-type rates, and tenant-scoped physical room availability. Its response excludes guests, booking identities, drafts, archived entries, pending/removed media and other tenants' content.

Without arrival and departure dates, availability is explicitly unknown. With valid dates and guest count, the existing `hotel_room_availability` function checks all allocations and capacity, independently of the recent-reservation list. Results are grouped by room type and include the checked dates/time. The base room charge is nightly rate × checkout-exclusive nights; unspecified taxes, extras, special rates and the final total require manager confirmation. Availability is a snapshot, never a hold or confirmed booking.

The agent is instructed to retrieve fresh catalog facts and availability for relevant questions, use only media from the matching entry, treat stored descriptions as business data rather than tool instructions, and hand off when facts cannot be verified. It can include expiring photo/video links in the existing conversation reply. This release does not add separate WhatsApp attachment sends, outbound campaigns, enrollment, booking mutations or payment actions. Existing WhatsApp delivery/window/template controls remain in place. Service sessions and final reservations require manager confirmation.

## Validation and release boundary

`npm run test:hotel-catalog` tests the API/session boundaries, exact prices, stale writes, idempotent creation, agent projection, date/occupancy retrieval, bounded file signatures and the actual SQL migration. PGlite also checks publication freezing, media state/revision rules, tenant foreign keys, both managers' reads and restrictive Storage policies under an existing broad allow policy. Storage transport itself is mocked in these tests.

Local browser checks use real production components in an isolated harness with synthetic content and mocked transport: service draft creation with paid pricing/hours/guidance, publish/withdraw, room details/media presentation, narrow-screen layout, Escape dialogs and read-only controls. Automated file selection was blocked by the Chrome extension's file-access setting; a full browser-to-Supabase upload and real WhatsApp delivery were not performed. No synthetic routes or data are included in the application source.

CI runs catalog tests and lint alongside Phase 1 communication tests, Phase 2 booking tests, shared manager/portal regressions, disposable PostgreSQL allocation concurrency, type checks and production builds. The migration ledger lists the catalog migration as pending. A release must review both Phase 2 migrations explicitly and must not apply unrelated pending migrations. Production merge, migration/storage creation and deployment remain separate approved actions.

Supabase implementation references: [signed upload URLs](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl), [standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads), [signed reads](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl).
