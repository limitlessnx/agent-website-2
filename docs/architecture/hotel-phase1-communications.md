# Hotel Phase 1: shared communications

Phase 1 extends the existing organization membership, canonical CRM, campaign composer, WhatsApp provider routing, delivery receipts and Trigger task infrastructure. It does not create a second guest identity system. Limitless Realty retains its existing routes and policies; Xposure retains the shared studio composer and delivery behavior.

## Tenant setup and access

An active organization is a hotel when its server-managed `metadata.industry_slug` / `metadata.industry`, or onboarding profile industry, is `hotel`, `hotels` or `hospitality`. The normal `hotels` experience exposes Campaigns in the existing portal navigation. No organization is automatically converted or provisioned by this migration.

Each manager needs an active organization membership with `customers.manage` to change hotel records and `conversations.reply` to schedule or dispatch follow-ups. Campaign sending uses the existing `conversations.reply` permission. Multiple managers use the same membership system; no owner-email shortcut is introduced. Admin preview is read-only through `requirePortalPermission`.

## CRM and booking-enquiry preparation

`hotel_guest_profiles` extends `crm_customers` with explicit marketing/service opt-in, global opt-out, manager handover and consent provenance. Unknown consent is ineligible. `hotel_booking_enquiries` holds communication lifecycle and stay dates, not inventory or room allocation. Composite foreign keys bind guests, enquiries and follow-ups to one organization and customer. Read RLS delegates to existing organization permissions; writes are service-only through authorized APIs.

`GET /api/portal/hotel` returns the latest 200 guest profiles, enquiries and follow-ups per collection. `POST` supports:

- `save_guest`: `customerId`, `marketingConsent`, `serviceConsent` (`unknown|opted_in|opted_out`), `optedOut`, `humanHandoff`, optional `consentSource`.
- `save_enquiry`: `customerId`, `status`, optional `arrivalDate`, `departureDate` (calendar dates in `YYYY-MM-DD` form); updates also require `bookingId` and current `revision` for optimistic concurrency. Omitted dates preserve stored values; explicit `null` clears a date.
- `schedule_followup`: `customerId`, `bookingId`, unique UUID `requestId`, future ISO `scheduledAt`, `purpose`, `message`, optional `templateName`.
- `dispatch_followups`: dispatch at most 25 due jobs for the session organization.

These are Phase 1 preparation APIs. A dedicated hotel reservation dashboard and automated intake enrollment remain later work.

## Eligibility and delivery

Hotel campaigns use `hotel_campaign` template configurations and require marketing opt-in, no opt-out or handover, and no confirmed/current stay. Manual selections undergo the same checks at dispatch. Existing composer requests infer the hotel purpose. Templates must be active, tenant-owned, and carry verified `metadata.provider_status = approved`. Named or numbered composer values follow configured `variable_keys`. Provider approval metadata must be maintained through the existing trusted template configuration process; this change does not claim to synchronize provider approvals automatically.

Follow-up purposes are `booking_recovery` (enquiry/quoted), `pre_arrival` (confirmed), and `post_stay` (checked_out). They require service opt-in and use `hotel_<purpose>` templates outside the service window. Supported variables are `customer_name`, `message`, `booking_status`, `arrival_date`, `departure_date`; every configured variable must have a value. No templates are registered or marked approved by the migration.

Only canonical inbound WhatsApp messages open the 24-hour window. Missing, invalid, future and expired timestamps require a template. Manager handover is checked in guest profiles, canonical conversations and agent conversations. A reply since enrollment suppresses that reminder. All reads fail closed.

Booking lifecycle/date changes increment a revision and cancel pending/processing reminders transactionally. Enrollment locks the booking and rejects stale revisions. Dispatch claims each job atomically, refreshes eligibility, and rechecks persisted cancellation immediately before sending. As with any external provider call, a state change after that final check cannot recall an in-flight message. Accepted messages retain provider IDs and use the existing delivery-attempt/receipt pipeline; acceptance is not delivery. Uncertain provider outcomes stay `unknown` without automatic retries. Stuck `processing` jobs likewise need manual reconciliation rather than resending.

## Release boundary

The `hotel-followup-drain` Trigger task takes an explicit organization ID, has one attempt, and has no schedule. Applying the migration, deploying code/tasks, activating schedules and creating hotel tenant/template configuration are separate release actions. Nothing in this PR performs them. Payment collection, offline payment validation, housekeeping and staff management are excluded.

## Validation

Run `npm run test:hotel`, `npm run test:real-estate`, `npm run test:maia`, `npm run test:xposure-dashboard`, and `npx tsc --noEmit`. Hotel tests execute the migration in PGlite, exercise permission isolation and multiple managers, campaign dispatch, provider approval for Meta/Twilio, 24-hour boundaries, duplicate drains, booking changes, handover and opt-outs. No live tenant data or WhatsApp messages are used.
