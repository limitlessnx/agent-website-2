# Maia Case Study — Phase 9A Visual Context Map

Branch scope: `fluxknight-homepage-rebuild`
Status: Locked visual-context blueprint. No page implementation changes in this phase.
Design standard: `skills/gpt-tasteskill/SKILL.md`
Source of truth:
- `docs/maia-case-study-phase-2-visual-storyboard.md`
- `docs/maia-case-study-phase-3-visual-asset-system.md`
- current `app/case-studies/maia/page.tsx`

## Why Phase 9 exists

The current case study already explains the Maia operating system with product-state UI:
conversation, CRM, qualification, property matching, follow-up, launch audience,
reminders, viewing workflow, handoff, deal progression, post-sale operations and
the operating-system reveal.

What is still missing is the real-world visual-context layer that helps a visitor
understand where those product states exist in an actual real-estate journey.

Phase 9 does **not** replace the product UI. It pairs selected product UI moments
with a limited number of narrative images.

The page should move between:

**real-world context → Maia product proof → real-world context → Maia product proof**

not become a gallery of decorative real-estate photography.

---

# 1. Visual-context rules

1. Context imagery is used only when it clarifies a change of environment or human moment.
2. Product UI remains the proof surface for what Maia actually does.
3. No section gets an image simply because empty space exists.
4. A context image may never imply an unsupported product capability.
5. Images must be globally relatable and avoid hard-wiring one country, city or currency.
6. Property imagery should feel premium and contemporary, but not like generic luxury-property advertising.
7. Human imagery should show believable sales / customer moments, not staged “AI robot” scenes.
8. Fluxknight purple may appear through light, interface reflections, overlays or environment accents, but the image itself should remain photographic and credible.
9. No text baked into generated imagery unless the text is intentionally part of a device/interface mockup and remains readable.
10. On mobile, the context image should never separate the relevant copy from the Maia product proof by an excessive scroll distance.

---

# 2. Locked asset count

Use **7 primary context assets**.

This is intentionally fewer than the number of story beats. The existing product
visuals already explain most operational states. Adding one image to every beat
would make the page repetitive and busy.

Primary assets:

- VC-01 Marketing Attention
- VC-02 Enquiry Entry
- VC-03 Property Discovery
- VC-04 Nurture / Reactivation
- VC-05 Viewing / Inspection
- VC-06 Human Handoff
- VC-07 Customer Lifecycle / Future Opportunity

Optional secondary crop:
- VC-05B can be a tighter appointment / property-arrival crop derived from VC-05 if required.

No separate context image is required for:
- CRM profile
- audience segmentation
- promotion timeline
- appointment reminder sequence
- deal progression
- installment schedule
- operating-system reveal
- proof ledger

Those are stronger as product UI.

---

# 3. Section-by-section visual map

## HERO

### Existing proof
`HeroSystemVisual`

### Context-image decision
**No separate hero photograph.**

### Reason
The hero must establish Maia as a real operating system immediately. A large
property photograph here would weaken the product-first positioning and make the
page resemble a real-estate landing page rather than a Fluxknight case study.

### Keep
- customer conversation
- CRM state
- property recommendation / next action

### Visual role
Product proof first.

---

## THE LEAK

### Asset
**VC-01 — Marketing Attention**

### Story moment
A real-estate company is actively creating demand, but the commercial context
behind incoming interest is fragmented.

### Image direction
A cinematic property-marketing environment showing:
- premium residential campaign imagery visible on a laptop / large screen / phone,
- a real estate marketing or sales workspace,
- several incoming customer touchpoints implied through screens,
- visual energy around campaign activity without showing fake analytics.

### Product pairing
Place alongside or behind `MarketingLeakVisual`.

### What the visitor should understand
**The business is already spending effort to create attention. The problem begins after attention arrives.**

### Desktop placement
Wide image-led opening to the problem section, followed immediately by the
product-state leak visual.

### Mobile placement
Image first, then problem copy, then `MarketingLeakVisual`.

### Avoid
- giant “FOR SALE” stock signs,
- fake social-media metrics,
- floating app logos,
- robots,
- anonymous likes visibly turning into CRM contacts.

---

## CHAPTER 1 — CAPTURE

### Asset
**VC-02 — Enquiry Entry**

### Story moment
Alex moves from campaign interest into an identifiable WhatsApp / web conversation.

### Image direction
A believable prospect using a smartphone after seeing a property campaign.
The environment can be home, café, office or commute-adjacent, but the phone
interaction should be the focus.

The device may show a Fluxknight / Maia conversation UI if composited from the
actual product mockup rather than generated as unreadable pseudo-text.

### Product pairing
`CaptureVisual`

### What the visitor should understand
**Marketing interest becomes a real conversation with an identifiable prospect.**

### Desktop placement
Split story:
- narrative context image,
- `CaptureVisual` product proof.

### Mobile placement
Context image → short copy → product proof.

### Avoid
- implying passive social engagement is enough,
- fake WhatsApp branding if not needed,
- overly staged “person smiling at phone” stock-photo treatment.

---

## CHAPTER 2 — UNDERSTAND / QUALIFICATION

### Context-image decision
**No new standalone image.**

### Existing proof
`QualificationVisual`

### Reason
The important visual transformation is conversation → structured customer data.
A lifestyle photo here would interrupt the proof.

### Keep
Chat + CRM profile updating as the main visual.

---

## CHAPTER 2 — PROPERTY DISCOVERY

### Asset
**VC-03 — Property Discovery**

### Story moment
Alex is now considering real options rather than merely asking a question.

### Image direction
A premium but globally neutral contemporary residential property scene.
The image should support:
- apartment / residence discovery,
- investment or residence consideration,
- modern real-estate inventory.

Prefer an architectural image with enough negative space to pair with or host
the actual product recommendation UI.

### Product pairing
`PropertyMatchVisual`

### What the visitor should understand
**Maia is connecting the buyer’s recorded preferences to actual property inventory.**

### Desktop placement
Large architectural image with the property-recommendation UI partially
overlapping or immediately adjacent.

### Mobile placement
Property image → recommendations.

### Avoid
- location-specific landmark dependence,
- baked-in price/currency,
- fake property claims,
- three or more unrelated properties competing visually.

---

## CHAPTER 2 — SALES INTELLIGENCE

### Context-image decision
**No new image.**

### Existing proof
Qualification + CRM state already carries this meaning.

### Reason
This is a system-memory moment, not a physical-world moment.

---

## CHAPTER 3 — FOLLOW-UP / PROSPECT GOES QUIET

### Context-image decision
**No new image for the silence beat.**

### Existing proof
`FollowUpVisual`

### Reason
The paused timeline is more informative than a generic photo of someone ignoring
a phone.

---

## CHAPTER 3 — NURTURE / LAUNCH / PROMOTION

### Asset
**VC-04 — Reactivation Moment**

### Story moment
A prospect who originally enquired is contacted again because a genuinely
relevant commercial moment occurs.

### Image direction
A smartphone / laptop context showing a property-launch or new-release moment
without turning into an ad poster.

Possible composition:
- property launch imagery on one screen,
- Maia update on the other,
- subtle environment suggesting the prospect is re-engaging after time has passed.

### Product pairing
Use with:
- `LaunchCampaignVisual`
- `PromotionLifecycleVisual`
- `LongTermNurtureVisual`

### What the visitor should understand
**The original enquiry remains useful because Maia preserved the context.**

### Desktop placement
Use once at the beginning of the launch/reactivation sequence. Do not repeat the
same image beside all three product panels.

### Mobile placement
One image before the sequence, followed by the three product states.

### Avoid
- countdown-sale graphics,
- fake audience counts,
- spammy marketing aesthetics,
- visual implication that Maia sends messages without configured consent / workflow.

---

## CHAPTER 3 — AUDIENCE SEGMENT

### Context-image decision
**No standalone image.**

### Existing proof
`AudienceVisual`

### Reason
Segmentation is operational data. Product UI is the clearer proof.

---

## CHAPTER 4 — VIEWING / INSPECTION

### Asset
**VC-05 — Viewing / Inspection**

### Story moment
Digital intent becomes a physical sales action.

### Image direction
A believable property-viewing scene:
- prospect arriving at or viewing a contemporary property,
- sales agent present or implied,
- premium but natural environment,
- no contract-signing cliché.

This should be one of the strongest contextual images on the page because it is
the point where the online system produces an offline next step.

### Product pairing
- `AppointmentVisual`
- `AppointmentReminderVisual`

### What the visitor should understand
**Maia has moved the opportunity from conversation into a real appointment.**

### Desktop placement
Large image-led section followed by the calendar / reminder proof.

### Mobile placement
Image → viewing confirmation → reminder sequence.

### Avoid
- handshake-at-the-door stock photography,
- keys being handed over before the deal,
- implying the viewing itself is automated.

---

## CHAPTER 4 — HUMAN HANDOFF

### Asset
**VC-06 — Informed Human Handoff**

### Story moment
The human salesperson takes over with the full customer story already prepared.

### Image direction
A professional real-estate agent reviewing the customer context on a laptop,
tablet or phone before or during a client interaction.

The visual should feel like:
- prepared,
- informed,
- human-led,
- commercially serious.

Use actual Maia handoff UI as the readable interface layer if shown on-device.

### Product pairing
`HandoffVisual`

### What the visitor should understand
**The human does not inherit a cold contact. The human inherits context.**

### Desktop placement
Context image and handoff UI in one cinematic composition.

### Mobile placement
Image → handoff summary → actions.

### Avoid
- AI replacing the salesperson,
- futuristic holograms,
- staged call-centre imagery,
- negotiation being shown as automated.

---

## CHAPTER 4 — DEAL PROGRESSION

### Context-image decision
**No new image.**

### Existing proof
`DealProgressionVisual`

### Reason
The boundary between Maia and the human team is clearer in the pipeline UI than
in photography.

---

## CHAPTER 4 — INSTALLMENT REMINDERS

### Context-image decision
**No separate image.**

### Existing proof
`InstallmentVisual`

### Reason
The point is operational continuity. A payment-themed stock image would cheapen
the section and could imply unsupported financial handling.

---

## CHAPTER 4 — FUTURE OPPORTUNITY

### Asset
**VC-07 — Customer Lifecycle / Future Opportunity**

### Story moment
Alex is no longer merely an old lead. The relationship remains useful when a
new, relevant opportunity appears later.

### Image direction
A returning-customer / investment context:
- mature, calm visual,
- property portfolio or new-development discovery,
- same customer identity can be implied,
- visual sense of time having passed.

This image should feel less like “another ad” and more like an existing
relationship being intelligently reactivated.

### Product pairing
`FutureOpportunityVisual`

### What the visitor should understand
**Customer history becomes reusable business intelligence.**

### Desktop placement
Wide transition before the final operating-system reveal.

### Mobile placement
Image → future-opportunity UI.

### Avoid
- wealth-porn imagery,
- fake ROI charts,
- luxury-car shorthand,
- implying guaranteed investment returns.

---

## OPERATING SYSTEM REVEAL

### Context-image decision
**No separate image.**

### Existing proof
`OperatingSystemRevealVisual`

### Reason
This section is the product payoff. It should assemble the earlier UI states,
not retreat into lifestyle photography.

---

## OUTCOME / PROOF

### Context-image decision
**No new image.**

### Existing proof
Operational proof ledger.

### Reason
The page should become calmer here. Reintroducing photography would dilute the
evidence and CTA transition.

---

## FINAL CTA

### Context-image decision
**No large context image.**

### Optional
A small product fragment may remain if needed after integration.

### Reason
The CTA needs whitespace, confidence and a clear decision path.

---

# 4. Asset priority and production batches

## Batch 1 — commercial journey foundation
Create first:
1. VC-01 Marketing Attention
2. VC-02 Enquiry Entry
3. VC-03 Property Discovery

These establish the top half of the story and determine the photographic art
direction for the rest of the case study.

## Batch 2 — retention and physical conversion
4. VC-04 Reactivation Moment
5. VC-05 Viewing / Inspection
6. VC-06 Informed Human Handoff

These prove that Maia operates beyond the first conversation.

## Batch 3 — lifecycle close
7. VC-07 Customer Lifecycle / Future Opportunity

This bridges the customer journey into the operating-system reveal.

Do not generate Batch 2 or 3 until Batch 1 establishes a consistent visual
language.

---

# 5. Composition system

To keep the page from becoming repetitive, the seven assets should use different
but related compositions.

- VC-01: wide environmental campaign scene
- VC-02: human + device close-medium scene
- VC-03: architecture-first property scene
- VC-04: device / launch reactivation scene
- VC-05: wide physical property-viewing scene
- VC-06: human professional + readable product interface
- VC-07: calm returning-customer / new-opportunity scene

Do not use seven nearly identical people-holding-phone compositions.

---

# 6. Integration density

Maximum image-led moments by chapter:

- Hero: 0 new context images
- The Leak: 1
- Capture: 1
- Understand: 1
- Nurture: 1
- Convert & Operate: 3
- OS Reveal / Proof / CTA: 0

Total: **7**

This keeps approximately half of the major story beats product-led and half
context-supported.

---

# 7. Desktop integration pattern

Preferred alternation:

1. Product-led hero
2. Image-led problem
3. Split context + product
4. Product-led qualification
5. Image + product recommendation
6. Product-led follow-up
7. Image-led reactivation transition
8. Product-led nurture sequence
9. Image-led physical viewing
10. Product reminder proof
11. Image + handoff UI
12. Product deal progression
13. Product post-sale operations
14. Image + future-opportunity UI
15. Product OS reveal
16. Proof
17. CTA

This prevents card fatigue and gives the page a deliberate cinematic rhythm.

---

# 8. Mobile integration pattern

On mobile, every context-supported beat follows:

**short heading → context image → product proof → concise takeaway**

Exceptions:
- The Leak: context image may precede the heading if the crop is strong.
- Human Handoff: heading → image → handoff UI.
- Future Opportunity: image → product UI → transition to OS reveal.

No full-bleed image may force the visitor to scroll more than one viewport
before reaching the product proof it supports.

---

# 9. Asset-generation guardrails

All generated context assets must:
- be high-resolution enough for desktop crops,
- allow safe 16:10 and 4:3 crops where possible,
- retain useful negative space for product UI overlays,
- avoid unreadable generated interface text,
- avoid brand/logo hallucinations,
- avoid identifiable real public figures,
- avoid country-specific flags, currency symbols or landmarks unless explicitly requested,
- keep clothing / interiors / architecture contemporary and globally neutral,
- avoid “AI robot” symbolism,
- avoid excessive neon cyberpunk aesthetics,
- match the restrained Fluxknight palette through lighting and grading rather than purple-washing everything.

---

# 10. Phase 9A acceptance criteria

Phase 9A is complete when:
- every major section has an explicit image/no-image decision,
- every approved image has one business-story purpose,
- each image is paired to an existing product proof surface,
- the asset count is capped,
- desktop placement is defined,
- mobile placement is defined,
- unsupported-capability risks are documented,
- the page rhythm avoids repetitive photography,
- the hero, OS reveal, proof and CTA remain product-led.

## Locked conclusion

The Maia case study needs **7 primary narrative context assets**, not an image
for every feature.

The next implementation step is **Phase 9B: lock the photographic art direction
and composition rules for those seven assets before generating Batch 1**.
