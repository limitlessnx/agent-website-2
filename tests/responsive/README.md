# Responsive and visual checks

`npm run test:responsive` starts an isolated Next.js instance and synthetic Supabase fixture on loopback ports 4400/4401. It covers admin overview, organization management, generic tenant overview, Real Estate, Photography, Hotel, and the shared component states at 360/430/768/1024/1440/1920px. Install Chromium with `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a system Chromium binary.

The fixture inherits no production/provider environment variables. It denies mutations; the only POST exceptions are the read-only Hotel inventory, overview and trends RPCs. Browser requests deny writes and all external origins. Lifecycle notification/Leo monitor writes receive 405 locally by design. These tests do not prove real provider delivery or production database behavior.

Screenshots are captured for every case. Closed native disclosures, intentionally off-canvas navigation and bounded scrolling regions are excluded from the primary-content overflow check; page-level document overflow is always checked. Component tests also verify visible menu placement, modal focus return, Escape, tab keys, validation, disabled/loading states, and loading geometry.

`npm run test:visual` compares against the reviewed `docs/phase2-evidence/after` captures and refuses to run without a recorded implementation review in `visual-review.json`. It never approves or updates snapshots automatically. A missing baseline fails. Review changes visually before updating baseline images and their review metadata. Implementation review is distinct from stakeholder approval of the PR.
