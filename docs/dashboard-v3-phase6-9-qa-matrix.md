# Dashboard V3 — Phase 6–9 QA Matrix

This matrix is a gate, not a ceremonial checklist. A row is PASS only when it is actually executed.

## Reference mapping

| Fluxknight surface | Primary visual authority | Secondary authority | Functional baseline |
| --- | --- | --- | --- |
| Global shell/sidebar | supplied Riter sidebar reference | Fluxknight mobile concept | existing AdminShell/AdminSidebar routes and auth |
| Dashboard home | supplied Fluxknight mobile dashboard | Finovate desktop composition | current command-center data sources |
| AI workforce / Agents | supplied Fluxknight AI-team cards | G.Take workspace density | existing agent management API and workflow links |
| Conversations | supplied mobile hierarchy | G.Take three-pane workspace | current leads/campaign/workflow data |
| CRM | Finovate/Finlo enterprise density | Fluxknight surface tokens | tenant-scoped Supabase queries/RLS |
| Automations | existing V3 automation workspace | G.Take task/workspace patterns | workflow registry + n8n behavior |
| Integrations | supplied card language | Finlo restrained density | existing credential control |
| Activity | Fluxknight attention hierarchy | G.Take activity panels | existing activity data sources |
| Settings | Riter/Finlo navigation hierarchy | Fluxknight theme tokens | workflow/env/database controls |

## Required viewport executions

320, 360, 375, 390, 430, 768, 820, 1024, 1280, 1440, 1600, 1920px.

For each major surface inspect:
- no horizontal overflow
- no clipped controls/text
- correct stacking/recomposition
- nav visibility and active state
- drawers/sheets remain within viewport and safe areas
- tables/charts use intended overflow or mobile presentation
- focus order remains logical
- light and dark theme parity
- reduced-motion mode
- long labels, empty states, errors, and large numeric values

## Phase 6 motion gate

PASS requires:
- sidebar collapse communicates state without decorative motion
- activity drawer/sheet has restrained enter transition
- card hover does not cause meaningful layout shift
- reduced-motion removes nonessential transitions/animations
- no animated state blocks interaction

## Phase 7 accessibility gate

PASS requires:
- keyboard access to all dashboard controls
- visible :focus-visible states
- closed mobile navigation cannot receive sequential focus
- dialogs/drawers trap focus, close with Escape, and restore focus
- dialog controls expose aria-expanded / aria-controls
- agent filters expose selected state
- save result is announced
- mobile interactive targets are at least 44px where practical
- color is not the sole status indicator

## Phase 8 functional regression gate

Automated baseline:
- repository support/security/runtime test suite
- dashboard UI contract suite
- dashboard phase 6–9 contract suite
- TypeScript no-emit check
- Next production build

Critical manual/runtime flows that remain required when an authenticated browser runner is available:
- login/session redirect
- every navigation destination
- sidebar collapse persistence
- dark/light persistence
- workspace switcher
- create/edit agent
- conversation/lead navigation
- CRM tenant isolation
- automation controls/retry behavior
- integration credential actions
- settings workflow mapping

## Phase 9 visual regression gate

A screenshot comparison is required for Dashboard, Agents, Conversations, CRM, Automations, Integrations, Activity, and Settings in dark and light modes.

Minimum screenshot widths:
- 390 mobile
- 820 tablet
- 1440 desktop
- 1920 wide desktop

Additional layout-only checks are required at every viewport listed above.

Reference fidelity is evaluated on:
- composition
- proportions
- density
- typography hierarchy
- spacing
- card dimensions/treatment
- sidebar/navigation behavior
- icon scale
- border/radius/shadow discipline
- mobile information priority

Code inspection, successful build, or CSS media-query presence does not count as a screenshot PASS.
