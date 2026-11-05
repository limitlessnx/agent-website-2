# Hotel Phase 2 — booking workspace

This phase is prepared on a separate branch for review. Its migration has not been applied and the code has not been merged or deployed to production. Phase 1 production remains unchanged. The manager interface is pending the required design-tool connection; the backend and tests can be reviewed independently.

## Model and booking rules

Room types define capacity, nightly rate in integer minor units, and currency. Physical rooms belong to one type and tenant. Type creation and room activation/deactivation are supported; room/type identity is immutable. Room deactivation requires resolving confirmed or in-house reservations first. There is no housekeeping or staff model.

The existing `hotel_booking_enquiries` table becomes the canonical reservation record. `enquiry` and `quoted` do not reserve a room. `confirmed` and `checked_in` occupy a physical room for the checkout-exclusive interval `[arrival, departure)`. Adjacent stays are allowed. Confirming requires a valid room, dates and capacity. A native GiST exclusion constraint prevents overlapping allocations, including concurrent transactions with repeatable-read snapshots. Row locks also serialize room activation and assignment checks. The migration installs `btree_gist` if needed and resolves its actual extension schema.

Transitions are enquiry → quoted/confirmed/cancelled/expired; quoted → confirmed/cancelled/expired; confirmed → checked_in/cancelled; checked_in → checked_out. Closed stay details cannot be edited. New reservations begin as enquiry, quoted or confirmed. Historical confirmed enquiries without assigned rooms are not automatically allocated or rewritten; they need room/date details before further active-state edits.

Booking writes use the current revision. Status-only writes preserve stay dates. Stay, guest count, room, rate, currency or note changes advance the revision and suppress stale Phase 1 reminders. Quotes use the room type's currency and a captured nightly rate; the room charge is rate × nights. No tax, discount, multi-room bundle, ancillary-charge, refund or exchange-rate engine is introduced.

## Manual offline payments

Recording a receipt creates a pending record with amount, currency, cash/bank transfer/POS/other method, optional reference and note. Currency must match the reservation quote. No gateway is called and no money is collected. Pending records do not count toward verified totals.

An authorized manager may verify or reject pending records. Verified records may be voided to correct an entry, with a required reason. A void is a ledger correction, not a refund. Original receipt details are immutable. Server timestamps and actor IDs identify reviews; append-only review history retains earlier notes when a verified record is later voided. Booking events retain lifecycle, assignment, quote and review-state history. Payment amounts and review notes are visible only to finance-authorized members.

Reservation operations require active hotel membership and `customers.manage`. Viewing requires `customers.view` or `customers.manage`. Recording, verifying, rejecting and voiding payments additionally require `billing.manage`. Payment records/totals require `billing.view` or `billing.manage` on reads. A second manager with those same grants can operate the same tenant. Admin preview cannot mutate records. The API never takes its tenant or actor ID from request data.

## API

`GET /api/portal/hotel/workspace?arrival=YYYY-MM-DD&departure=YYYY-MM-DD&guests=1` returns room types, rooms, the latest 250 reservations, up to 250 recent canonical customers plus customers referenced by those reservations, guest consent profiles, current availability and capability flags. Availability checks all confirmed/in-house reservations, independently of the list limit. Profiles are fetched for the returned customer IDs so an older opt-out is not mistaken for missing consent. Financial totals aggregate the full payment ledger for each returned booking, not just the latest visible receipts.

`GET ...?bookingId=<uuid>` returns one tenant-owned reservation, the latest 100 events, and (with finance permission) its latest 100 payment records and full totals.

`POST` actions:

- `create_type`: name, capacity, nightlyRate (decimal string), currency (three-letter code).
- `create_room`: name, roomTypeId.
- `set_room_active`: roomId, active (boolean).
- `create_guest`: requestId, name, optional phone/email. Canonical identity resolution is reused. A matching existing profile's opt-out, handover and consent are never reset; new consent defaults to unknown. Consent edits continue to use the Phase 1 API.
- `save_reservation`: status, optional roomId, arrivalDate, departureDate, guestCount, nightlyRate and notes. Creation requires customerId and requestId; updates require bookingId and current revision. Omitted fields are preserved; explicit null clears optional fields where booking rules allow it. Blank nightlyRate resets to the room type rate. A changed room resets rate/currency unless an explicit rate is supplied.
- `record_payment`: bookingId, requestId, amount (decimal string), method, optional reference/note. Other methods require a note.
- `verify_payment`, `reject_payment`, `void_payment`: paymentId and note (required for rejection/voiding).

Creation and receipt recording use tenant-scoped request IDs and fingerprints: exact retries return the original record, while changed-payload replays are rejected. Payment decisions compare-and-set the current state. Amount conversion handles each currency's minor-unit precision without floating-point arithmetic.

## Validation and release

Run `npm run test:hotel-workspace`, `npm run test:hotel`, migration-ledger tests, type checking and relevant Maia/Xposure regressions. PGlite executes the actual Phase 1 and Phase 2 migrations with `btree_gist`, exercising occupancy, capacity, transitions, financial totals, receipt corrections, RLS and reminder invalidation. API tests cover malicious tenant/actor/currency/state fields, both managers, permission denial, stale edits, idempotent creation and existing guest opt-outs.

CI also starts a disposable localhost PostgreSQL 17 database and runs `node tests/hotel-booking-concurrency.mjs`, with `HOTEL_TEST_DATABASE_URL` pointing to `/hotel_test`. The script refuses remote hosts or nonempty databases. It verifies that concurrent read-committed and repeatable-read allocations each commit exactly one reservation and that an adjacent stay succeeds. This uses no production database or staging subscription.

The migration ledger lists Phase 2 as pending only. Do not apply other pending migrations as part of this release. A production release, live tests, and real-number WhatsApp template validation remain separate actions. This phase does not enroll follow-ups, activate automatic sends, collect payments, or add staff/housekeeping workflows.
