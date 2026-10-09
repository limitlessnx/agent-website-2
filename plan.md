# Fluxknight homepage draft update

## Status

Draft only. This change is intentionally **not deployed** and remains uncommitted for review.

## Implementation approach

The current Fluxknight visual identity, dashboard preview, Maia story, industries, reviews, pricing, and evaluation section remain in place. The hero is now outcome-led: it explains that Fluxknight turns customer conversations into business follow-through, keeps **Evaluate My Business** as the primary CTA, and sends the secondary CTA to a concise “How it works” section.

The draft also adds a compact **“Channels that can keep moving”** carousel. It rotates through Voice call agent, WhatsApp agent, Telegram agent, Automated email, and Instagram automation. Each slide explains a concrete outcome rather than only naming a channel. The carousel advances every 4.5 seconds, pauses on hover and keyboard focus, provides previous/next controls and selectable dots, and disables automatic movement when reduced motion is requested.

## Design direction

The page keeps its dark operational SaaS aesthetic with violet accents. The new channel block uses a single compact panel, a channel-specific accent color, a small icon, and short outcome-led copy. On mobile it becomes a single-column panel with the channel rail removed, larger touch targets, and the same manual controls.

## Files in this draft

- `components/home/ReferenceFluxHeroPhase1.tsx`
- `components/home/AutomationJourney.tsx`
- `components/home/AutomationJourney.module.css`
- `components/home/ChannelAutomationCarousel.tsx`
- `components/home/ChannelAutomationCarousel.module.css`
- `public/manus-routes.json`

## Explicit non-goals

- No Vercel deployment.
- No GitHub push or commit.
- No database, authentication, billing, or Trigger.dev changes.
