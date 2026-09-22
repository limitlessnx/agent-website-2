# Fluxknight Dashboard V3 — Reference & Regression Map

This document is the implementation authority for Phases 1–5 of the dashboard redesign.

## Source priority

1. Fluxknight supplied reference screens control brand identity, light/dark direction, AI-workforce presentation, and mobile identity.
2. Sidebar references control expanded/collapsed navigation hierarchy, spacing, grouping, and account/settings placement.
3. Desktop dashboard references control layout density, card proportions, visual hierarchy, analytics composition, and content grouping.
4. Mobile references control bottom navigation, touch sizing, stacking, information priority, and sheet/drawer behavior.
5. The repository `skills/gpt-tasteskill/SKILL.md` applies where it does not conflict with the supplied references.

When reference styling and current functionality conflict, preserve the business logic and adapt the presentation around it.

## Locked visual system

- Dark canvas: near-black purple, not neutral charcoal.
- Light canvas: cool off-white/lilac, not inverted dark mode.
- Purple/violet is the primary accent. Glow is restricted to selected/active/AI-working states.
- Sidebar is compact and information-dense, with clear section hierarchy and a quieter footer/account area.
- Cards use restrained borders and 2–3 elevation levels. Avoid every-card gradients.
- Dashboard uses mixed card sizes, not a uniform grid of identical boxes.
- Mobile is a distinct composition with a fixed bottom nav and bottom sheets/drawers for secondary context.
- Touch targets are at least 44px where practical.
- Motion explains state. Reduced-motion is mandatory.

## Functional baseline

The existing V3 behavior on the checkpoint commit must remain intact:
- auth/session redirect
- dashboard routing
- tenant/workspace switching
- search and navigation
- theme persistence
- agents CRUD
- conversations
- lead/CRM reads and writes
- workflow/automation reads and actions
- integrations and credential actions
- activity feeds
- settings
- Supabase/n8n/Trigger.dev dependent UI
- Leo/public/private boundaries

## Component implementation map

| Existing | V3 treatment | Risk | Required regression |
| --- | --- | --- | --- |
| AdminShell | preserve auth/data loading; refine chrome and responsive layout | auth/session, layout shift | login, redirect, desktop/tablet/mobile |
| AdminSidebar | reference-faithful hierarchy + compact/collapsible desktop behavior + mobile drawer | route access, hidden nav items | every nav destination, active state, drawer |
| PlatformChrome / ThemeToggle | integrate into quieter topbar control cluster | theme persistence | dark/light reload and system preference |
| MobileAdminHeader | compact mobile chrome with safe-area support | inaccessible nav | menu open/close, keyboard/focus |
| MobileBottomNav | locked Home / Agents / Conversations / Activity / Menu | route regressions | active route, safe area, touch target |
| Dashboard home | preserve live data; restructure to reference density and AI-workforce hierarchy | data loss/mislabeling | metrics, notices, command center |
| Agents / AgentManagementCenter | AI-workforce cards and workspace-like editor | CRUD breakage | create/edit/status/workflow bindings |
| Conversations | retain data flow; three-pane desktop / stacked mobile | selection/state loss | list/detail/context interactions |
| CRM | upgrade list/table/card presentation without changing tenant scoping | RLS/query changes | tenant isolation, data rendering |
| Automations | preserve workflow registry; present operating states cleanly | action/status mismatch | active/paused/error/retry paths |
| Analytics/value | preserve calculations and routes; improve chart/card composition | misleading data | filters/ranges/data presence |
| Integrations | marketplace-style cards around existing credential controls | credential flow breakage | connect/update/error states |
| Activity/notifications | unified feed and attention grouping | missing events | links, unread/attention states |
| Settings | quieter sectional layout; preserve all environment/workflow controls | destructive config changes | settings actions and workflow mapping |

## Responsive gates

Test layout intent at 320, 360, 375, 390, 430, 768, 820, 1024, 1280, 1440, 1600, and 1920px.

The CSS system must explicitly cover:
- phone: single-column, bottom nav, drawer/sidebar off-canvas
- tablet: compact chrome, 1–2 column content, no desktop squeeze
- desktop: sidebar + topbar + max-width content grid
- wide desktop: constrained content width, not edge-to-edge stretching

## Phase 1–5 acceptance

A phase is not complete because selectors exist. It must preserve current behavior, compile, pass automated checks, and remain compatible with dark/light and all target breakpoints. Visual screenshot comparison remains a separate gate and is never inferred from code review.
