# Xposure Dashboard Diagnosis

## Executive conclusion

The supplied reference describes a dedicated photography-studio operating workspace, not a generic industry skin. It has a shared Fluxknight shell and visual system, but the information architecture is photography-specific: enquiries, client conversations, bookings, shoots, studio catalogue, campaigns, analytics, team, and organization settings.

The current application has a reusable tenant portal foundation and a real-estate-specific dashboard composition, but Xposure is not yet implemented as a first-class dashboard. At present, a photography organization would fall through to the generic command center rather than receive the reference experience.

## What is already implemented

### Shared tenant foundation

The portal already has organization-scoped session handling, a shared client layout, tenant-scoped agent/workflow/activity loading, plan and Flux Credit visibility, integrations, billing, team, analytics, notifications, and settings routes. The current onboarding work also lets a new organization owner provide their name and organization name, create the workspace, and enter the dashboard before completing detailed business knowledge and WhatsApp setup.

### Commercial and safety foundation

The current code includes plan-aware feature gates, Basic/Plus/Business/Business+ allocations, Flux Credit wallets, WhatsApp activation controls, Super Admin approval paths, tenant membership checks, and recent admin/tenant scope hardening. This foundation should be reused for Xposure rather than creating a separate billing or permission model.

### Limitless Realty composition

`components/portal/OrganizationDashboard.tsx` is currently a real-estate composition. It includes a property catalog, lead pipeline, upcoming viewings, quick actions, activity, plan access, and WhatsApp setup state. `app/portal/page.tsx` selects this composition when the industry is real estate.

This means the current architecture already points toward organization-specific dashboards, but only the real-estate branch has been completed.

### Existing generic routes that can be reused

The following existing areas map to parts of the Xposure reference:

- `/portal/conversations` can support the first version of Clients & Inbox.
- `/portal/appointments` can provide a starting point for Bookings & Calendar.
- `/portal/analytics` can support the analytics destination once photography metrics are added.
- `/portal/team` can support Team and permissions.
- `/portal/settings` and `/portal/integrations` can support Settings / Manage.
- `/portal/agents` and the existing Maia/agent controls can support the AI Agents destination.
- `/portal/systems` and campaign/workflow infrastructure can support Automations, but the UX is not yet photography-specific.

## What is missing for Xposure

### 1. No photography industry identity

`lib/industryCatalog.ts` and `lib/industryExperience.ts` have no `photography` or `photography-studio` entry. Xposure therefore cannot receive a dedicated vocabulary, feature map, dashboard description, or navigation model.

### 2. The dashboard branch is incomplete

The portal page only gives the specialized dashboard treatment to real estate. All other industries use the generic command center. Xposure therefore will not show the reference overview with:

- New enquiries
- Confirmed bookings
- Follow-ups due
- Shoots this week
- Upcoming bookings
- Maia WhatsApp Concierge
- Photography-specific quick actions

### 3. No photography-specific data model

The existing specialized dashboard data is centered around `PropertyRecord`, real-estate leads, and appointments. Xposure needs photography records such as:

- Studio enquiries / client conversations
- Clients and client relationship state
- Bookings or sessions
- Shoot type: portrait, wedding, maternity, birthday, family, creative set, etc.
- Photographer or team assignment
- Studio/location assignment
- Catalogue categories and catalogue items
- Package and pricing references
- Follow-up tasks
- Campaigns and templates
- Session status: enquiry, quoted, deposit pending, confirmed, in progress, delivered, cancelled

Without these records, the UI would only be visual mock data and would not be operationally trustworthy.

### 4. No photography catalogue surface

The reference includes a Studio Catalogue with categories and image-led cards. The current generic systems pages do not provide a photography catalogue with category navigation, shoot packages, sample work, pricing, availability, or item management.

### 5. No dedicated Clients & Inbox composition

The current conversations route is a generic conversation center. Xposure requires a combined inbox/client experience with:

- Client identity and avatar
- Conversation preview
- Unread state
- Booking context
- Package/pricing context
- Last activity
- Client profile and history
- Handoff state

### 6. No photography booking calendar composition

The current appointment surface can be reused technically, but the reference needs a calendar/list toggle, session cards, photographer/studio assignment, booking status, and a new-booking action. The current route does not yet express those photography-specific concepts.

### 7. Maia is not presented as an Xposure workspace concierge

The code has Maia-related runtime and admin surfaces, but the tenant dashboard needs a dedicated Maia card/page showing status, conversations, response rate, average response time, configuration entry, and human handover queue. These metrics must come from persisted tenant-scoped evidence rather than static UI values.

### 8. Automations are not yet photography-oriented

Xposure needs campaign, follow-up, and template views. The business rules should support consent, opt-out, plan entitlements, Flux Credit metering, and human handoff. Existing follow-up infrastructure is a useful base, but the UI needs photography language and session-aware triggers.

### 9. Analytics needs photography KPIs

The reference analytics screen expects metrics such as:

- Total enquiries
- Confirmed bookings
- Booking conversion rate
- Revenue or booked value
- Client satisfaction
- Enquiries by period
- Booking trend
- Follow-ups due/overdue
- Campaign performance
- Shoot-type distribution

The existing analytics foundations and tenant-scoped RPCs should be reused, with photography-specific aggregations added.

### 10. Menu and mobile navigation need an Xposure configuration

The reference uses a five-item bottom navigation: Overview, Inbox, Bookings, Catalogue, More. The current portal shell must receive a tenant/industry-aware navigation configuration. A generic nav should not be duplicated for every industry.

## Reference-to-current mapping

| Reference surface | Current state | Recommended treatment |
|---|---|---|
| Overview/Home | Generic portal plus real-estate specialization | Add `PhotographyDashboard` composition for Xposure |
| Clients & Inbox | Generic conversations route exists | Add photography inbox wrapper and client context |
| Bookings & Calendar | Generic appointments route exists | Add photography booking/session model and calendar UI |
| Studio Catalogue | Not implemented | Add catalogue categories, items, packages, and media |
| Maia / AI Agents | Agent pages and runtime exist | Add Xposure Maia workspace card and handover queue |
| Automations | Workflow/follow-up foundations exist | Add campaigns, templates, follow-ups, and consent-aware UI |
| Analytics | Generic tenant analytics exists | Add photography KPIs and dashboard cards |
| Team | Existing portal team route exists | Reuse with photography role labels and permissions |
| Settings / Manage | Existing settings/integrations/billing routes exist | Add studio profile, hours, packages, channels, and preferences |
| More menu | Portal navigation exists but is not reference-matched | Add industry-aware mobile menu |

## Recommended architecture

Do not fork the entire portal. Keep the following shared:

- Authentication and organization session handling
- Tenant membership and permission checks
- Plan and entitlement resolution
- Flux Credit metering
- Shared shell, typography, colors, cards, buttons, and responsive layout primitives
- Shared settings, billing, integrations, team, notifications, and support infrastructure

Add an industry composition layer:

```text
app/portal/page.tsx
  -> resolve organization industry / dashboard key
  -> PhotographyDashboard for Xposure / photography organizations
  -> OrganizationDashboard for real estate
  -> GenericCommandCenter for other organizations
```

Use a configuration object for vocabulary and navigation, but use dedicated data loaders for domain-specific records. Avoid pretending that a property record is a photography catalogue item.

## Recommended implementation phases

### Phase A — Production diagnosis and identity verification

Before applying code to production, identify the Xposure organization by organization ID/slug and inspect its current metadata, onboarding profile, plan, active agents, integrations, and existing records. Verify whether the production Xposure dashboard is already a deployed branch or only a design/reference update.

Do not run destructive writes during diagnosis.

### Phase B — Photography organization contract

Add a canonical photography industry key, likely `photography-studio`, with:

- Customer label: Clients
- Lead label: Enquiries
- Inventory label: Studio Catalogue
- Appointment label: Bookings / Shoots
- Features: catalogue, bookings, inbox, campaigns, analytics, team
- Dashboard key: `photography`

Add regression tests for vocabulary and industry resolution.

### Phase C — Xposure shell and Overview

Implement the reference-aligned shared shell and the photography overview:

- Xposure Studios organization switcher/header
- Greeting and studio context
- Four KPI cards
- Upcoming bookings list
- Maia concierge summary
- Quick actions
- Responsive mobile bottom navigation

Use empty states and real tenant data. Do not hard-code the numbers shown in the reference image.

### Phase D — Core photography records

Introduce tenant-scoped persisted records for clients, sessions/bookings, catalogue categories/items, and campaign/follow-up context. Add RLS/service-role controls and idempotent APIs. This is the point where the dashboard becomes operational rather than decorative.

### Phase E — Inbox, calendar, catalogue, and Maia surfaces

Build the four primary destinations using the shared shell. Add the photography-specific actions, filters, statuses, and profile context shown in the reference.

### Phase F — Automations and analytics

Connect campaigns, templates, follow-ups, Flux Credit metering, consent/opt-out handling, and photography-specific analytics. Keep plan locks visible and explain which package unlocks each capability.

### Phase G — Production rollout and migration

Deploy backward-compatible migrations, verify the Xposure organization in production, enable the photography dashboard only when its data contract is present, and retain the generic fallback for other organizations. Run a read-only production smoke diagnosis before enabling the new dashboard key.

## Highest-priority improvements

1. Add a real photography organization key and stop routing Xposure to the generic dashboard.
2. Build the Xposure Overview using real tenant-scoped metrics and empty states.
3. Create the booking/session and studio catalogue data contracts before polishing secondary screens.
4. Add an industry-aware navigation configuration matching the five-tab reference.
5. Present Maia as a photography concierge with persisted conversation and handover metrics.
6. Reuse the existing security, plan, onboarding, and Flux Credit controls rather than creating parallel systems.
7. Validate the production Xposure organization before any migration or feature flag is enabled.

## Production information still required

To compare this diagnosis with the live deployed state, the next step needs one of:

- Production Xposure URL, or
- Xposure organization slug/ID, or
- A screenshot/recording from the current production dashboard.

The supplied images are sufficient as the visual target. They are not sufficient to determine which Xposure code is already deployed or which production records and integrations are currently active.
