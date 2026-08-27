# Fluxknight Phase 4A / 4B Navigation Baseline

Baseline branch: `main`

## Phase 4A purpose

Phase 4A established an authoritative, route-faithful navigation inventory without changing live navigation presentation, responsive composition, business logic, APIs, authentication, CRM, agents, campaigns, Leo, or database behavior.

## Protected baseline

The pre-Phase-4A live navigation implementation is preserved in commit `8e9cf4682c1bd71ba2dc05edd93fdca098f59aa1`.

## Canonical model

`components/admin/navigationConfig.ts` is the canonical inventory for the existing `AdminSidebar` navigation. It preserves the existing destination hrefs, grouping, hash destinations, public-site destinations, and dynamic client-workspace pattern.

## Verified AdminSidebar inventory

### Fluxknight Platform

- Command Center → `/dashboard`
- Agent Leo AI Support → `/dashboard/support`
- Admin Notifications → `/dashboard/notifications`
- Evaluation Leads → `/dashboard/evaluations`
- Super Assistant → `/dashboard/agents`
- Global Activity → `/dashboard/activity`

### Home Agents / Limitless Realty

- Leads → `/dashboard/limitless/leads`
- Daily Briefs → `/dashboard/limitless/daily-briefs`
- Follow-ups → `/dashboard/limitless/followups`
- Properties → `/dashboard/limitless/properties`
- Knowledge & Media → `/dashboard/limitless/media`
- Campaigns → `/dashboard/limitless/campaigns`
- Agentic Systems → `/dashboard/limitless/agentic`
- Workflows → `/dashboard/workflows`
- Payments → `/dashboard/limitless/payments`

### Home Agents / Gencouv

- Overview → `/dashboard/gencouv`
- Email Control → `/dashboard/gencouv#email-control`
- Inbox → `/dashboard/gencouv#gencouv-inbox`
- Lead Board → `/dashboard/gencouv#lead-board`
- Sequence Status → `/dashboard/gencouv#sequence-status`
- Acquisition → `/dashboard/gencouv#acquisition`
- Operations → `/dashboard/gencouv#operations`

### Platform Governance

- AI Model Control → `/dashboard/ai-models`
- Knowledge Center → `/dashboard/knowledge`
- Memory Center → `/dashboard/memory`
- Platform Settings → `/dashboard/settings`

### Client Onboarding

- New Client → `/dashboard/onboarding#new-client`
- Onboarding Queue → `/dashboard/onboarding#queue`
- Client Registry → `/dashboard/clients`
- Client Workspaces → dynamic `/dashboard/clients?organizationId=<organizationId>` entries generated from tenants

### Public Website

- Homepage → `/`
- Services → `/services`
- Pricing → `/pricing`
- Industries → `/industries`
- Evaluation → `/evaluation`

Public Website links retain the existing behavior of opening in a new tab.

## Phase 4B completed work

`AdminSidebar.tsx` now consumes the canonical navigation inventory for its static platform groups, Public Website links, onboarding entries, and dynamic client workspaces. The sidebar retains its existing presentation, group/section state, mobile drawer state, icons, active-state behavior, and close-on-navigation behavior.

Icons remain a presentation concern and are mapped by the canonical href rather than duplicating route/group definitions.

## Route verification

Verified against the protected pre-Phase-4A repository tree:

- Dashboard core destinations exist as App Router pages.
- Limitless Realty destinations exist, including `agentic`, `media`, `campaigns`, `daily-briefs`, `followups`, `leads`, `payments`, and `properties`.
- `/dashboard/workflows` exists and remains the Workflows destination.
- Gencouv has a real `/dashboard/gencouv` page; its secondary destinations remain hash anchors and were not converted into guessed routes.
- `/dashboard/ai-models`, `/dashboard/knowledge`, `/dashboard/memory`, and `/dashboard/settings` exist.
- `/dashboard/onboarding` and `/dashboard/clients` exist; the onboarding page contains the `new-client` and `queue` sections used by the existing navigation.
- Public Website destinations `/`, `/services`, `/pricing`, `/industries`, and `/evaluation` exist.
- Dynamic client workspaces continue to resolve through the existing `/dashboard/clients?organizationId=...` destination pattern.

## Important distinction: WorkspaceRail

`WorkspaceRail` is a separate desktop workspace/context navigation surface. It is not merged into `ADMIN_NAV_GROUPS` in Phase 4B. Its destinations remain independently owned until the WorkspaceRail-specific route inventory and context behavior are migrated deliberately.

## Important distinction: mobile navigation

`MobileAdminHeader` and `MobileBottomNav` continue to use `MobileNavigationProvider`. Phase 4B does not replace their interaction model or change the working mobile drawer implementation.

## Important distinction: Leo

Leo remains an AI utility surface, not a navigation destination/controller. Phase 4B does not alter Leo behavior.

## Legacy navigation

`MobileMenuButton` remains unretired until its repository import graph is conclusively verified. No deletion is justified merely because the shared navigation provider is now the preferred mechanism.

## CSS protection

Phase 4B does not introduce new global CSS overrides and does not modify the working mobile drawer CSS. Navigation presentation changes are intentionally deferred to the later navigation simplification phases.

## Subsequent phase rules

1. Navigation presentation must consume the canonical model where that surface is explicitly migrated.
2. No route may be removed merely because it is inconvenient to display.
3. Any stale destination must be verified against the repository and intended behavior before removal or replacement.
4. Hash destinations must not be converted into guessed routes.
5. Responsive composition remains a later phase.
6. The working mobile drawer fix remains protected.
7. CSS ownership must not be changed through global overrides as a shortcut.
8. WorkspaceRail remains a separately verified navigation surface until its route ownership is resolved.
9. Legacy `MobileMenuButton` must be import-verified before retirement.
