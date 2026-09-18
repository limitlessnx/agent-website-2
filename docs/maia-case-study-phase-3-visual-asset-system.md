# Maia Case Study — Phase 3 Visual Asset System

Branch scope: fluxknight-homepage-rebuild
Status: Visual system locked. No Vercel deployment.
Design standard: skills/gpt-tasteskill/SKILL.md
Source references reviewed:
- app/flux-theme.css
- app/globals.css
- components/MaiaCaseStudyTeaser.*
- app/services/ServicesClient.module.css
- app/industries/IndustriesClient.module.css

## Objective

Create one coherent visual language for every Maia case-study proof surface so the page feels like a single real operating system, not unrelated mockups.

Every major visual must answer:
1. What did the customer do?
2. What did Maia do?
3. What changed in the system?
4. What can the human team do next?

The visual system must look native to Fluxknight and inherit the current dark cinematic public-site direction without copying the admin dashboard literally.

---

# 1. Core visual language

## Base palette

Use existing Fluxknight values as source of truth:
- Page base: #03000a / #07040f
- Surface: #0d0719
- Elevated surface: #130b24
- Primary accent: #8b5cf6
- Accent light: #a970ff / #b68cff
- Primary text: #faf8ff
- Secondary text: #aaa0c0
- Muted text: #6e6483
- Border: rgba(180,139,255,.16)
- Strong border: rgba(188,146,255,.34)

Allowed supporting semantic accents:
- Success / confirmed: restrained green
- Warning / due soon: restrained amber
- Urgent / overdue: restrained rose
- Neutral / inactive: slate-violet

Do not introduce a rainbow palette.

## Surface treatment

Use three surface levels only:
1. Base canvas
2. Product panel
3. Elevated state / active panel

Avoid stacking translucent glass cards inside translucent glass cards.

Panels should feel operational:
- subtle border,
- clear header,
- deliberate row rhythm,
- restrained shadow,
- one accent state,
- no decorative blobs unless they support hierarchy.

## Radius system

- Large product frames: 24–28px
- Standard panels: 16–18px
- Nested operational rows: 10–12px
- Pills / statuses: 999px only where semantically appropriate

Do not turn every object into a pill.

## Shadow system

Primary panel:
0 30px 90px rgba(0,0,0,.32)

Focused state:
0 0 40px rgba(139,92,246,.12)

Avoid multiple dramatic shadows on every nested surface.

---

# 2. Typography hierarchy

Use existing project typography. Do not add Inter.

## Page / chapter headings
- wide, cinematic
- strong negative tracking
- 1–2 lines where possible
- no 5-line narrow headline stacks

## Product labels
- 0.64–0.72rem
- uppercase
- letter spacing .1–.15em
- muted violet

## Panel titles
- 0.82–1rem
- 700–850 weight
- concise

## Operational body text
- 0.72–0.9rem
- high enough contrast for real reading
- avoid tiny fake-dashboard text

## Micro metadata
- 0.62–0.7rem minimum
- use only for timestamps, source labels, statuses

---

# 3. Master visual grammar

All assets use the same shell anatomy:

[Context Header]
- feature / source label
- current state
- optional timestamp / status

[Primary Operational Area]
- conversation, property, CRM, campaign, calendar, or payment state

[System Response]
- what Maia changed

[Next Action]
- what happens next

This common anatomy is what makes different visuals feel like one product.

---

# 4. Asset A — Maia Conversation UI

## Purpose
Demonstrate real customer interaction and context retention.

## Anatomy
Top bar:
- Maia mark
- Maia
- Available 24/7
- channel label

Conversation:
- customer bubble
- Maia bubble
- optional rich property card
- optional system event divider

System footer:
- Context saved
- Lead updated
- Next action

## Rules
- No fake iMessage clone.
- No giant chatbot bubble occupying the whole section.
- Customer and Maia messages must look operational and readable.
- Show timestamps sparingly.
- Maia responses should be concise and natural.
- Never use lorem ipsum.

## States required
1. First enquiry
2. Qualification
3. Property Q&A
4. Contextual follow-up
5. Launch update
6. Promotion reminder
7. Viewing confirmation
8. Installment reminder

---

# 5. Asset B — CRM Lead Profile

## Purpose
Prove that conversation becomes structured customer data.

## Anatomy
Header:
- customer name
- lead stage
- source
- last activity

Profile fields:
- budget
- location
- property type
- purpose
- timeline
- payment preference
- interested properties

Operational state:
- owner / assigned agent
- next action
- follow-up due
- viewing status

History:
- compact activity timeline

## Rules
- Avoid a spreadsheet aesthetic.
- Keep critical fields visible without scrolling in the showcase state.
- Use one strong stage/status marker.
- Conversation should be visually traceable to updated fields.

---

# 6. Asset C — Property Recommendation Card

## Purpose
Show catalogue-aware recommendation inside Maia.

## Anatomy
- property image
- property name
- location
- property type
- price / configurable price
- availability
- payment-plan badge only where relevant
- action: View details / Compare / Book viewing

## Rules
- image-forward
- only 2–3 recommendations visible at once
- no crowded marketplace grid
- no invented property claims in final production copy
- price formatting must be localizable

---

# 7. Asset D — Campaign / Lead Source Panel

## Purpose
Show the connection between marketing activity and captured customer opportunity.

## Anatomy
Campaign header:
- campaign name
- source
- status

Engagement block:
- enquiries
- clicks / conversations
- comments or reactions where supported as aggregate campaign context

Conversion path:
Ad / Post / Landing page
→ CTA
→ identifiable conversation / form
→ Maia
→ CRM lead

## Rule
Do not visually imply an anonymous like automatically becomes a CRM contact.

---

# 8. Asset E — Audience Segment Panel

## Purpose
Demonstrate reusable lead intelligence.

## Anatomy
Segment name:
- Launch interest

Filter chips:
- property interest
- investor / owner-occupier
- budget band
- payment preference
- lead stage

Audience list preview:
- 3–5 prospects
- source
- current stage
- last interaction

Campaign action:
- Send approved update
- Schedule reminder

## Rules
- audience counts must be clearly demo/example data until backed by source data
- no fabricated business performance metrics

---

# 9. Asset F — Follow-Up Timeline

## Purpose
Show that Maia continues working after initial silence.

## Anatomy
Timeline events:
- initial enquiry
- follow-up due
- follow-up sent
- prospect replied
- next action

Each event:
- timestamp / relative time
- trigger
- Maia action
- resulting state

## Motion
When implemented, timeline can progressively activate on scroll.

## Rule
Contextual message should reference prior interest.

---

# 10. Asset G — Launch / Promotion Campaign Panel

## Purpose
Show reactivation at meaningful commercial moments.

## Anatomy
Campaign:
- Launch live / Promotion live
- selected audience
- approved message
- send schedule
- reminder schedule

Customer-side preview:
- one actual Maia message

Lifecycle:
Launch
→ reminder
→ promotion
→ expiry reminder

## Rule
Keep outbound communication framed as configured / approved messaging to relevant leads.

---

# 11. Asset H — Viewing / Inspection Calendar

## Purpose
Show movement from interest to booked action.

## Anatomy
Customer context:
- prospect
- property
- preferred time

Calendar:
- date
- time
- assigned agent

System state:
- appointment confirmed
- CRM updated
- reminder scheduled

## Supporting mini states
- 24h reminder
- 2h reminder
- agent notified

---

# 12. Asset I — Human Handoff Panel

## Purpose
Prove that Maia prepares the human agent instead of replacing them.

## Anatomy
Header:
- Ready for handoff
- priority state

Lead summary:
- property
- budget
- purpose
- payment preference
- timeline
- viewing
- key questions

Conversation summary:
- 2–3 concise sentences

Actions:
- Open conversation
- View lead
- Take over

## Visual priority
This should be one of the largest and clearest product visuals on the page.

---

# 13. Asset J — Deal Progression

## Purpose
Show the division of labor between Maia and the human sales team.

## Pipeline
Qualified
→ Viewing booked
→ Viewed
→ Offer / Reservation
→ Payment
→ Customer

## Human-owned stages
- negotiation
- relationship
- documentation
- closing

## Maia-supported stages
- reminders
- context
- CRM state
- next actions
- customer communication

## Rule
Do not imply Maia autonomously negotiates or executes legal/commercial commitments.

---

# 14. Asset K — Installment Reminder Panel

## Purpose
Show repetitive post-sale operational support.

## Anatomy
Payment schedule:
- deposit: paid
- installment 2: upcoming
- installment 3: scheduled
- overdue state where applicable

Customer preview:
- reminder message

Team state:
- customer record updated
- staff alert if escalation required

## Rule
Use configurable neutral currency / amount formatting in the reusable component.

---

# 15. Asset L — Operating System Reveal

## Purpose
Final synthesis of the entire Maia system.

## Composition
Do not use a generic flowchart.

Use a large integrated product board with real fragments from previous assets.

Top band:
MARKETING
- Ads
- Social
- Website
- Lead campaigns

Second band:
CUSTOMER CHANNELS
- WhatsApp
- Web
- supported messaging / forms

Center:
MAIA
- Converse
- Qualify
- Recommend
- Follow up
- Remind
- Schedule
- Escalate

Operations layer:
- Leads
- Properties
- Conversations
- Follow-ups
- Viewings
- Campaign audiences
- Payment schedules
- Customer history

Human team layer:
- Priority leads
- Handoffs
- Viewings
- Negotiation
- Closing

## Visual emphasis
Maia is the connective layer, not a giant mascot in the center.

---

# 16. Global localization rules

All showcase data must be easy to localize.

Avoid hardwiring:
- one currency
- one city
- one country
- one property type
- one timezone

Use configurable display data for:
- price
- location
- phone
- date/time
- property type
- payment plan
- viewing terminology

Use “viewing / inspection” language contextually.

---

# 17. Responsive asset rules

Desktop:
- product visuals can use 16:10, 4:3 and wide 2:1 compositions
- key handoff and operating-system visuals can span full content width

Tablet:
- preserve information hierarchy before reducing detail
- two-panel states stack when necessary

Mobile:
- conversation first
- resulting CRM/system state second
- timelines vertical
- no unreadably tiny dashboard replicas
- property cards may scroll horizontally only where that improves clarity
- operating-system reveal becomes stacked layers
- actions full-width where appropriate

---

# 18. Motion system

Motion may clarify state change, never decorate inactivity.

Allowed:
- CRM field population
- status transition
- timeline progression
- panel reveal
- small property-card entrance
- handoff summary expansion
- final operating-system layer assembly

Disallowed:
- endless floating particles
- random orbiting icons
- dramatic parallax on text
- excessive glow pulses
- looping attention effects

Always respect prefers-reduced-motion.

---

# 19. Asset consistency checklist

Every asset must pass:
- same palette family
- same radius family
- same typography hierarchy
- same status treatment
- same border logic
- same spacing rhythm
- no generic AI-template styling
- no fake metrics
- no unsupported feature claim
- readable at intended viewport
- clear business purpose
- visually connected to the customer journey

---

# 20. Build handoff contract for Phase 4

Phase 4 may now build the page skeleton using these reusable visual families:

- MaiaConversation
- LeadProfile
- PropertyRecommendation
- CampaignSource
- AudienceSegment
- FollowUpTimeline
- LaunchCampaign
- ViewingCalendar
- HumanHandoff
- DealProgression
- InstallmentReminder
- OperatingSystemReveal

Phase 4 should not invent a new style. It must implement this visual system and the Phase 2 storyboard using the existing Fluxknight public design language and TasteSkill constraints.
