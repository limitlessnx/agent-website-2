---
name: gpt-taste
description: Premium UX/UI and motion design rules adapted from Leonxlnx/taste-skill for the Fluxknight rebuild.
source: https://github.com/Leonxlnx/taste-skill/tree/main/skills/gpt-tasteskill
---

# GPT TasteSkill — Fluxknight Build Rules

Use this skill for premium frontend design and motion work in this repository.

## Priority order
1. Explicit user-approved reference designs and project constraints always win.
2. Existing Fluxknight copy, pricing content, routes, working functionality, and approved components must be preserved unless the user explicitly asks to change them.
3. Apply the premium layout, spacing, typography, card restraint, motion, and implementation principles below without inventing a different visual direction.

## Visual quality rules
- Build cinematic, highly polished layouts with strong spacing and clear hierarchy.
- Avoid generic AI-template styling, decorative filler, excessive glassmorphism, random gradients, fake metrics, and repetitive card grids.
- Keep H1 copy wide and readable. Avoid narrow 5–6 line headline wraps.
- Use premium typography and strong contrast. Do not use Inter for the rebuild unless already required by the project.
- Use large section spacing so each chapter feels intentional rather than cramped.
- Every card must have a clear business purpose and meaningful content.
- Use dense, mathematically complete grids when bento layouts are needed. Do not leave dead cells or awkward empty corners.
- Maintain perfect button contrast and legibility.
- Prevent horizontal overflow from animations or off-canvas elements.

## Motion rules
- Use restrained, high-quality GSAP/ScrollTrigger interactions where motion materially improves the experience.
- Appropriate patterns include subtle scroll reveals, card stacking, image scale/fade, and pinned storytelling sections.
- Hover interactions should feel physical and deliberate, not noisy.
- Respect reduced-motion preferences and do not let motion interfere with readability or mobile usability.

## Fluxknight reference lock
For the current homepage rebuild, do NOT randomize the page architecture. The approved D'task-style reference controls the composition and section rhythm.

Locked visual direction:
- dark cinematic hero
- centered/wide headline treatment
- large product/dashboard visual overlapping the hero boundary
- white integrations strip
- white proof/numbers section
- dark story/workflow section
- large rounded white section overlapping the dark section
- clean feature/product cards
- white mobile-product section
- dark footer
- Fluxknight purple used as the primary accent in place of the reference site's cyan/blue accents

## Fluxknight content locks
Do not rewrite existing Fluxknight card copy.
Do not rewrite existing pricing copy.
Keep all four existing pricing plans, including Custom.
Preserve existing CTAs, routes, forms, integrations, and working application behavior unless explicitly instructed otherwise.

New homepage story components may be added only where approved:
- New Lead
- Maia Qualifies
- Follow-up Sent
- Reminder Scheduled
- Appointment Booked
- Customer / Deal Closed
- Organization card
- Industry carousel
- Case study placement

The Customer / Deal Closed outcome must remain visible on desktop, tablet, and mobile.

## Copy style for newly added content
Keep new copy simple, direct, and outcome-focused. Explain exactly what Fluxknight does for the business. Avoid jargon and abstract AI language.

## Implementation check before coding
Before changing UI code:
- identify the exact existing component being restyled
- confirm which copy and business logic are locked
- map the section to the approved reference image
- define desktop and mobile behavior
- verify the design does not remove important existing functionality

## Acceptance check after each section
- compare the rendered section against the approved reference structure
- confirm spacing and proportions remain faithful
- confirm existing wording is unchanged where locked
- confirm mobile keeps all required story outcomes
- confirm no generic AI filler was introduced
- confirm the section remains accessible and responsive
