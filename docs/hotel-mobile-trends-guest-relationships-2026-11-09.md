# Hotel mobile dashboard and guest relationships

Extends PR #358 from current main `0f7e26600f321056f98e1fb7ec4390dc3e8e16aa`. This remains a review branch: no production promotion, migration application or customer messages.

## Visible experience

- Hotel-only mobile shell: brand/notification/settings controls, published catalog photo header, six shortcuts, four compact cards where finance is permitted, arrivals, horizontal room rail, recent bookings and guest conversations, fixed six-item bottom navigation. More opens the existing drawer. Existing manager switching and preview exit remain available. Other industries retain their shell and destinations.
- Total active physical rooms and occupied rooms remain current snapshots. Check-ins use first recorded checked-in audit events. No historical room-inventory change is invented. Reports show new booking requests and actual check-ins over seven local days versus the previous seven.
- Revenue is **currently verified offline receipts by verification date**, not profit or accounting recognition. Pending, rejected and voided records are excluded. Voids restate earlier dates. Currencies are separate and selectable; today is partial. Exact integer aggregation/formatting preserves large totals and cents. Seven-day sparkline plus daily report table. Zero baselines do not produce imaginary growth percentages.
- Revenue is only requested and serialized with the existing payment-view permission. Optional trends/details failures remain visible and preserve authoritative room and booking totals.

## Marketing, Maia conversations and reminders

- Marketing remains `/portal/campaigns`. Hotel composer exposes linked approved hotel campaign templates, their selected language, editable values and a recipient preview. Customer names are filled per recipient. Blank required values block submission. Gateway selection honors the chosen language. A provider receipt means accepted, not delivered; missing receipts or uncertain submissions are unknown and not automatically retried. Existing consent, active booking and manager-handover guards stay in effect.
- Hotel-specific `/portal/hotel/inbox` supports literal guest-name search, recorded-state filtering and bounded pages with full counts. `/portal/hotel/inbox/[id]` shows the last 100 canonical messages and older history pages. Every conversation, customer and message lookup includes the current hotel. Sender labels distinguish guest, Maia, team, system and tool. No synthetic unread badges or new send/reply/activation control.
- `/portal/hotel/followups` tracks existing booking-enquiry, pre-arrival and after-stay records with purpose/status filters, hotel-local scheduled times, booking links and honest queued/processing/stopped/accepted/unknown outcomes. Accepted records without receipts require review. The page does not enqueue reminders or start an automatic runner.
- **This is not complete Realty automation parity.** Campaign scheduling, saved campaigns, hotel contact import, a new reminder planner/activation interface, a production scheduled runner and interactive manager reply/claim controls are not added here. The shared Maia runtime is preserved; monitoring does not prove channels/agent publication are active in production.

## Data and release

Additive migration `20261109090514_hotel_dashboard_trends.sql` adds service-role-only, security-invoker aggregate/index functions and reporting indexes. Client roles cannot execute them. Server callers derive the hotel from the authenticated session and recheck current grants and hotel membership; trusted admin previews are read-only. Existing row security and booking/payment writes are unchanged.

Both this migration and `20261109073001_hotel_service_operating_rules.sql` remain unapplied and explicitly listed as pending. Apply the reviewed migrations before releasing these features. No organization defaults, pricing, publication state, payment state or production scheduler is changed by this PR.

## Verification

Local hotel tests cover tenant boundaries, permissions/revocations, exact money above safe Number range, more than 10,000 receipts, multiple currencies, verification-date boundaries, DST, first check-in deduplication, literal name search, full inbox counts/pagination, bounded transcript history, reminder filters and missing/uncertain provider receipts. Shared Maia/Xposure/AI-writing regressions also run. A Maia source-contract assertion now includes the optional template language argument; handoff behavior is unchanged.

Synthetic browser checks use actual components and stubbed APIs, two hotel contexts and illustrative existing showroom photography. They cover mobile navigation, More drawer, five viewport widths, finance hiding, unavailable trends, currency switching, approved template filtering, language selection/preview, required values and uncertain outcomes. No live messages or customer data were used. The design follows the supplied mobile structure; it does not invent guest avatars, revenue or activity percentages to duplicate illustrative reference data.

Authenticated live preview/production and real messaging remain unverified. A previous protected-preview fetch was rejected by automatic review because it would create/reuse a temporary share link; no bypass or access grant was made. CI builds and local interaction evidence are used instead.
