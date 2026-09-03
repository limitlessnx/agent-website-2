# Fluxknight Dashboard-First Lifecycle Roadmap

## Current decision

Phase 3B (subscription provisioning) and Phase 4 (customer activation) are deferred until the payment plan and onboarding/subscription model are finalized.

For the remaining lifecycle work, the dashboard is the default notification surface. Email is reserved for critical account, billing, security, and selected periodic summary communications.

## Routing rule

System event -> lifecycle engine -> notification router -> one or more destinations:

- Customer dashboard notification
- Admin / Leo operational alert
- Resend email only when necessary

## Phase 5 - Customer health

Primary surface: dashboard/admin.

- customer health score
- inactivity detection
- integration health
- unresolved support risk
- usage trend detection
- internal intervention triggers

Email: only for critical customer-facing failures.

## Phase 6 - Usage reporting and value proof

Primary surface: customer dashboard.

- conversations handled
- leads captured
- automated actions completed
- bookings or outcomes where attributable
- time saved where measurable
- weekly/monthly trends

Email: optional monthly digest only.

## Phase 7 - Expansion intelligence

Primary surface: dashboard/admin.

- capacity/usage thresholds
- additional agent opportunities
- channel expansion opportunities
- voice/WhatsApp/workflow recommendations

Email: normally disabled.

## Phase 8 - Account administration

Primary surface: dashboard.

- membership changes
- organization ownership changes
- account state changes
- suspension/reactivation status

Email: enabled for account-critical changes.

Billing-specific upgrade/downgrade behavior remains deferred until the payment model is finalized.

## Phase 9 - Support and escalation

Primary surface: dashboard/admin.

- support case opened
- SLA state
- human escalation
- resolution state
- recurring issue detection
- customer follow-up status

Email: only for important support milestones or when the user is required to act.

## Phase 10 - Churn prevention and win-back

Primary surface: admin intelligence plus customer dashboard where appropriate.

- declining usage
- inactivity risk
- cancellation intent
- feedback capture
- reactivation path

Email: reserved for deliberate recovery/win-back journeys, not routine risk signals.

## Phase 11 - Lifecycle intelligence

Primary surface: internal admin/Leo.

Unified customer state should eventually expose:

- lifecycle stage
- health score
- usage state
- integration state
- account state
- support state
- billing state
- recommended next action

## Phase 12 - Lifecycle analytics and control center

Primary surface: admin dashboard.

- activation and usage metrics
- retention/churn
- customer health distribution
- support performance
- lifecycle notification performance
- admin controls for customer journeys

## Notification center requirements

The eventual customer notification center should support:

- unread badge/count
- notification history
- severity: info, success, warning, critical
- category
- deep links/actions
- mark read / mark all read
- dismiss where appropriate
- timestamps
- realtime delivery via Supabase where useful
- persistent critical notices
- user notification preferences later

## Email policy

Email should be sent primarily for:

- payment failure
- renewal reminders
- subscription cancellation
- workspace suspension
- important security/account events
- selected monthly value summaries

Routine activity, usage, health, expansion, and operational information belongs in the dashboard by default.
