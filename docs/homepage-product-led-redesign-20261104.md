# Fluxknight homepage redesign: Phase 1 audit and Phase 2 design brief

Date: 2026-11-04
Branch: draft/homepage-product-led-multi-industry-20261104
Status: design brief; no production release authorization

## Positioning
Universal platform promise: "Your business. Running on AI."
Real estate is the flagship proven case study, not the sole industry identity. Retain industry pages for real estate, hotels, restaurants, clinics, gyms and other categories. Do not imply an integration is live unless verified.

## Verified source architecture (main at audit)
- Next.js 16.4.3, React 19.2.4, Tailwind CSS 4, TypeScript, Framer Motion.
- Homepage: app/page.tsx
- Hero: components/home/ReferenceFluxHeroPhase1.tsx
- Journey: components/home/AutomationJourney.tsx
- Channel carousel: components/home/ChannelAutomationCarousel.tsx
- Leo: components/home/MeetLeoSection.tsx
- Maia case study: components/MaiaCaseStudyTeaser.tsx
- Industries: components/IndustryCarousel.tsx, lib/industryCatalog.ts
- Reviews: components/ClientReviews.tsx
- Evaluation: app/evaluation/page.tsx
- Shared shell and global CSS: app/layout.tsx, components/SiteShell
- package.json scripts include prebuild tsc --noEmit, build, lint and targeted Maia/support/real estate tests.

## Proposed seven-section homepage
1. Universal hero: one clear promise, authentic platform preview, CTA to evaluation.
2. One connected customer journey: enquiry → response → CRM → action → follow-up.
3. Interactive industry selector using existing lib/industryCatalog.ts; avoid a duplicated source of truth.
4. Product exploration: CRM, inbox, workflows, analytics, with real screenshots or explicitly labeled demo data.
5. AI workforce: Maia flagship, Leo supporting, interactive controlled demo.
6. Verified customer implementations: Limitless Realty and Xposure; avoid unverifiable testimonials.
7. Final conversion: existing /evaluation, FAQs and footer.

## Design direction
Premium product-led SaaS. Preserve Fluxknight identity; restrained violet accent, dark editorial hero, clean product sections, strong type hierarchy, intentional whitespace. Responsive mobile-first, keyboard-accessible industry tabs, reduced-motion support, fast image loading. Avoid stock illustrations where real product imagery exists.

## Critical dependencies and guardrails
- Global layout imports many homepage and dashboard stylesheets: prefer scoped CSS modules and avoid broad global selectors.
- Preserve SiteShell, Leo public entrypoints, existing navigation anchors where linked, /evaluation and industry routes.
- Preserve Maia/Trigger.dev runtime, tenant isolation, CRM, dashboard and billing flows.
- No Supabase migrations or branches as part of visual redesign without explicit separate approval.
- Instagram/Messenger unified inbox must not be advertised as live until confirmed.
- Current ClientReviews has anonymous/abbreviated attribution; require proof and approval before publishing as verified outcomes.
- Hero contains illustrative metrics: clearly label sample values.
- No direct changes to main; PR stays draft until QA and owner approval.

## Acceptance gates
- Phase 2: inspect at least four 12ui design candidates, select one approved direction, generate full-page desktop/mobile references.
- Phase 3: implement industry switcher, responsive hero, scoped styles, existing navigation and conversion.
- Phase 4: product demos interactive and labeled; no customer data exposure.
- Phase 5: content, accessibility and SEO accuracy, verified case studies.
- Phase 6: lint, tsc, build, targeted regression tests, desktop/mobile and keyboard QA, preview deployment.
- Phase 7: merge/promotion only with explicit owner approval after green checks.

## Outstanding checks
- Confirm exact existing industry route implementations and SiteShell navigation contract.
- Inventory current homepage anchor links and public Leo widget dependencies.
- Verify case-study screenshots and customer approvals.
- Validate actual Vercel preview and test suite before any merge.
