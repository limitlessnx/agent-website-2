# Hotel Overview

Hotel tenants now land on a separate Overview at `/portal`. The Hotel workspace stays at `/portal/hotel`, and the catalog stays at `/portal/hotel/catalog`. Realty, Xposure and other industries retain their current landing components. This change is on the Phase 2 review branch only; the Overview migration is pending and has not been applied to production.

## Daily definitions

The hotel profile's IANA timezone determines the local calendar day. The server derives it, ignoring caller-supplied tenant, day or timezone fields. If the timezone is missing/invalid, UTC is used with a visible warning. The workspace's default stay dates now use the same calendar helper. Date-only arrival/departure fields remain date-only; timestamps in conversation previews and the updated time display in the hotel timezone.

- **Arriving today:** reservations whose arrival date is the local day and state is confirmed, checked in or checked out. Already arrived/completed stays remain part of that day's count.
- **Departing today:** reservations whose departure date is the local day and state is checked in or checked out. Unarrived/closed-cancelled enquiries are not counted as departures.
- **Rooms occupied:** distinct physical rooms on reservations marked checked in, irrespective of the recorded departure date. A past departure does not automatically check the guest out. The denominator is active physical rooms.
- **Payments to verify:** exact count of pending offline receipt records, not a count of bookings or a sum across currencies. Only finance-authorized members can read it. The first three pending records provide exact booking links, including bookings older than the recent workspace list.
- **Open enquiries/quotes:** all enquiry/quoted records. This is not an unread-message count. The next open record is directly linked.
- **Overdue departures:** checked-in stays whose recorded departure date has passed, with a link to an actual overdue stay.
- **Manager handovers:** all unresolved human-handoff records, shown only with handoff-view/manage permission.

The stable, security-invoker `hotel_overview_core` RPC calculates booking totals, daily lists and type-level availability over the entire tenant. It does not use the workspace's 250-record limit. It returns up to six daily stay rows and three enquiry/overdue links; counts remain complete. Execute is revoked from PUBLIC, anon and authenticated, and granted only to service_role. All API/page access is separately session/membership/industry checked.

## Availability and conversations

Room availability checks physical room allocation, capacity and checkout-exclusive dates for the selected range. Type counts and totals are aggregated in SQL so they are not truncated by an API row limit. Base nightly prices come from room types; checking availability does not hold a room or confirm a total with taxes/extras.

Conversation previews require conversations.view/reply. They show the latest three open conversations, scoped customer names, actual last-message text and recorded state. The interface does not invent unread counts or interpret an ordinary open conversation as an active manager handover. Handoff counts require their own permission; finance/inbox/handoff tables are not queried when the corresponding grant is absent.

## Actions and deep links

Authorized managers can check in/out through the existing workspace mutation API, with the current booking revision. Check-out asks for confirmation. Those changes retain lifecycle validation, audit history and reminder suppression; they do not send guest messages. Trusted admin previews are read-only.

Overview links can open an exact reservation, a new reservation with selected dates/guest count/type, room inventory, today's arrivals/departures, finance review, a conversation or the notification/handover center. Exact booking detail now loads its tenant-scoped customer and room context independently of the recent list. Daily workspace filters are applied before the 250-record cap, retained on refresh, and labelled as scoped views with a clear-view link. The workspace still does not provide full-history server pagination; that remains separate work.

Loading failures show an explicit retry state, never fabricated zero metrics. Refresh errors retain the last successful view and show an error. Counts and the local day refresh when the user refreshes or reopens the page; this release does not add polling or realtime subscriptions.

## Verification and release

`npm run test:hotel-overview` covers local midnight/daylight-saving boundaries and invalid-zone fallback, permissions, two managers, trusted previews, caller scope injection, error states, exact pending counts, and actual migration execution with 305 arrivals beyond the recent-list limit. Database tests distinguish occupancy/departures, adjacent stays, capacity, enquiry states and service-only RPC access. Workspace tests exercise exact older booking links and daily filters before the list limit.

Browser checks use real components with synthetic data and mocked transport in an external local harness: check-in updates occupancy, a reservation link retains dates/type/guest count, departures toggle, restricted controls/data are absent, failed loading retries successfully, and desktop/mobile layouts reflow without horizontal overflow. The synthetic harness is not shipped with the application. Live production login, real hotel data and outbound providers were not used for these checks.

CI includes Overview tests/lint alongside existing hotel messaging, booking, catalog, shared manager/portal, Xposure, migration-ledger, PostgreSQL concurrency and build checks. Review the Overview migration together with the other pending Phase 2 migrations before release; do not apply unrelated pending migrations. No production merge, migration or deployment is part of this implementation.
