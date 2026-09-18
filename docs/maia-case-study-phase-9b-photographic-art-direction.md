# Maia Case Study — Phase 9B Photographic Art Direction

Branch scope: `fluxknight-homepage-rebuild`
Status: Locked visual art direction. No asset generation or page integration in this phase.
Design standard: `skills/gpt-tasteskill/SKILL.md`
Depends on:
- `docs/maia-case-study-phase-9a-visual-context-map.md`
- `docs/maia-case-study-phase-3-visual-asset-system.md`
- current Fluxknight palette and typography

## Objective

Create one photographic world for the seven Maia visual-context assets so they
feel like frames from the same premium case study rather than unrelated AI images.

The images should feel:
- contemporary,
- credible,
- commercially serious,
- globally relatable,
- premium without luxury-ad clichés,
- dark enough to sit naturally inside Fluxknight,
- human enough to make the product story tangible.

The page should not look like a property brochure and should not look like a
cyberpunk AI campaign.

---

# 1. Master visual mood

## Core description

**Cinematic contemporary real estate operations at dusk / evening, with restrained
violet practical light, natural materials, real human behavior and premium
architectural environments.**

Visual references in words:
- high-end editorial photography,
- modern architecture magazine,
- premium SaaS launch film,
- understated commercial campaign,
- documentary realism with polished lighting.

The final result should feel photographed, not rendered.

## Emotional tone

Use:
- calm confidence,
- focus,
- momentum,
- preparedness,
- subtle commercial energy.

Avoid:
- excitement-for-excitement's-sake,
- exaggerated smiles,
- luxury flex,
- futuristic spectacle,
- cold corporate stock imagery.

---

# 2. Color and grading

## Base image palette

Photography should lean toward:
- charcoal,
- deep graphite,
- warm concrete,
- smoked glass,
- muted stone,
- dark wood,
- soft warm interior light,
- subtle cool-blue evening exterior light.

## Fluxknight integration

Violet should be an **accent**, not the world.

Allowed violet sources:
- screen glow,
- edge light,
- practical LED strip,
- reflected UI glow,
- subtle environmental accent,
- graded shadow hue.

Target impression:
**90% believable photography, 10% Fluxknight visual signature.**

Avoid:
- full purple rooms,
- neon purple skies,
- purple skin tones,
- purple fog,
- cyberpunk city lighting.

## Contrast

Moderate-to-high contrast with retained shadow detail.

Black point should visually harmonize with:
- `#03000a`
- `#07040f`

Highlights should not blow out to sterile white.

---

# 3. Lighting language

Use directional practical lighting.

Preferred:
- dusk exterior + warm interior,
- soft side light,
- screen glow on hands / face,
- window light,
- architectural practicals,
- low-key office lighting.

Human faces:
- realistic skin tone,
- soft shaping,
- no beauty-retouch plasticity.

Property scenes:
- believable ambient light,
- premium but lived-in,
- avoid showroom-perfect overexposure.

---

# 4. Camera language

## Lens feel

Use a restrained editorial lens language:
- 28–35mm for environment,
- 50mm for human + device,
- 70–85mm only for selective handoff / detail moments.

Do not overuse ultra-wide distortion.

## Depth of field

Moderate depth of field.

Use shallow focus only where it helps isolate:
- phone,
- customer,
- agent,
- product interface.

Property architecture should remain readable.

## Camera height

Mostly natural eye level.

Avoid:
- drone glamour shots,
- extreme low-angle architecture worship,
- surveillance-like overhead compositions,
- tilted Dutch angles.

---

# 5. Human casting direction

## Prospect / Alex

Alex should be presented as a globally relatable professional adult.

Direction:
- approximately late 20s to early 40s,
- smart casual,
- neutral contemporary wardrobe,
- understated grooming,
- believable prospect / investor / homebuyer energy.

Do not encode one nationality as the only target market.

If the same person appears in multiple scenes, maintain continuity in:
- approximate age,
- hairstyle,
- body type,
- clothing palette,
- device,
- visual demeanor.

Exact identity consistency is preferred but not mandatory unless the generation
workflow supports reliable reference continuity.

## Real-estate agent

Direction:
- professional,
- composed,
- modern,
- not stereotypical “salesperson” styling,
- neutral tailoring or polished business-casual clothing.

Avoid:
- call-centre headset cliché,
- hard-sell grin,
- oversized suit,
- handshake pose.

## Diversity

Across the full asset set, representation may vary, but the page must not feel
like seven unrelated casting campaigns.

---

# 6. Wardrobe

Preferred:
- black,
- charcoal,
- stone,
- navy,
- muted olive,
- cream accents,
- subtle texture.

Avoid:
- loud prints,
- bright brand colors,
- visible designer logos,
- overtly formal ceremony wear,
- streetwear that dates the image quickly.

---

# 7. Architecture direction

## Residential property

Use contemporary globally neutral design:
- modern apartment,
- refined townhouse,
- contemporary villa,
- mixed-use residential lobby,
- clean interior,
- architectural concrete,
- glass,
- timber,
- stone.

Avoid:
- famous skyline landmarks,
- country-specific architecture as the dominant cue,
- giant mansion / supercar visual shorthand,
- empty white-box showroom imagery.

## Workspace

Use modern real-estate / marketing workspace:
- premium laptop,
- clean desk,
- large monitor,
- restrained lighting,
- real materials,
- minimal clutter.

Avoid:
- generic startup beanbags,
- giant wall logos,
- fake trading-terminal visual density.

---

# 8. Device and interface rules

Generated device screens should **not** carry important final text.

Reason:
image generators routinely turn interface text into soup, because apparently
letters are still a bridge too far for civilization.

Use one of two approaches:

### Approach A — clean device plate
Generate the scene with:
- believable phone / laptop,
- dark screen or simple abstract interface,
- enough perspective and clean screen area for later compositing.

Then overlay the actual Maia UI in code or image compositing.

### Approach B — intentionally blurred interface
Use an interface that is visibly present but not expected to be read.

Never rely on generated text to prove:
- lead status,
- property details,
- price,
- appointment time,
- handoff summary,
- payment schedule.

Those stay in the real product UI components.

---

# 9. Image composition rules

Every image must preserve useful negative space.

## Safe zones

At least one side of each image should contain 25–35% visually calm space where:
- page copy,
- product UI,
- gradient fade,
- or card overlap can sit.

Do not center the main subject in every frame.

## Cropping flexibility

Primary generation should support:
- 16:10 desktop crop,
- 4:3 tablet crop,
- 4:5 or 3:4 mobile crop where possible.

Keep important faces / devices / architecture away from extreme frame edges.

---

# 10. Grain and texture

Use:
- subtle cinematic grain,
- natural glass reflection,
- realistic screen reflections,
- restrained atmospheric depth.

Avoid:
- heavy film grain,
- lens dirt,
- fake anamorphic flare everywhere,
- dramatic bloom,
- glowing particle overlays.

---

# 11. Asset-specific composition lock

## VC-01 — Marketing Attention

### Frame
Wide environmental scene, 16:10.

### Camera
28–35mm equivalent.

### Subject
Premium real-estate marketing workspace.

### Composition
- campaign imagery visible on one primary display,
- phone or secondary device nearby,
- human presence optional but not dominant,
- negative space on one side for Fluxknight text / transition.

### Lighting
Dusk / evening office.
Warm practical + cool monitor light.
Very subtle violet screen accent.

### Narrative cue
Demand is being created.

### Must not show
- fake metrics,
- giant social logos,
- exaggerated notification badges,
- sales graphs.

---

## VC-02 — Enquiry Entry

### Frame
Close-medium human + phone, 4:3 or 16:10.

### Camera
50mm equivalent.

### Subject
Prospect interacting with smartphone after discovering a property opportunity.

### Composition
- phone readable as an object, not necessarily its text,
- prospect slightly off-center,
- environment softly contextual,
- clean screen area for later Maia UI composite if needed.

### Lighting
Natural interior / café / home-office light plus screen glow.

### Narrative cue
Interest becomes an active enquiry.

### Expression
Focused, curious, neutral-positive.
Not delighted-at-a-phone stock-photo acting.

---

## VC-03 — Property Discovery

### Frame
Architecture-first wide frame, 16:10.

### Camera
28–35mm equivalent.

### Subject
Contemporary globally neutral residential property.

### Composition
- strong architecture,
- open negative space for product recommendation UI,
- no visible sales signage,
- one coherent property, not a collage.

### Lighting
Late afternoon / blue hour.
Warm interior pockets.

### Narrative cue
The buyer is now evaluating a real property option.

### Visual priority
Architecture > lifestyle.

---

## VC-04 — Reactivation Moment

### Frame
Device-led context, 4:3 or 16:10.

### Camera
50mm equivalent.

### Subject
Returning prospect seeing a relevant new property / launch update.

### Composition
- device in foreground or midground,
- contextual property visual in background / second screen,
- sense of continuity rather than first-time discovery,
- negative space for launch UI.

### Lighting
Calm evening environment.

### Narrative cue
Previous interest is being reactivated at the right moment.

### Avoid
Urgency-sale visual language.

---

## VC-05 — Viewing / Inspection

### Frame
Wide physical scene, 16:10.

### Camera
28–35mm equivalent.

### Subject
Prospect visiting / viewing a contemporary property.

### Composition
- prospect and agent small-to-medium in frame,
- property remains the environment,
- movement into space preferred over static pose,
- room for appointment UI near edge.

### Lighting
Natural daylight / late afternoon.

### Narrative cue
Digital intent has become a real appointment.

### Avoid
Handshake, keys, signed contract.

---

## VC-06 — Informed Human Handoff

### Frame
Human + workstation, 4:3.

### Camera
50–70mm equivalent.

### Subject
Real-estate agent reviewing customer context before taking over.

### Composition
- agent visible,
- laptop / tablet screen clean enough for real UI composite,
- customer may be implied in environment but not required,
- tighter, more intimate frame than VC-05.

### Lighting
Professional low-key office / property-lounge lighting.

### Narrative cue
The human enters with context already prepared.

### Expression
Concentrated, prepared, calm.

---

## VC-07 — Customer Lifecycle / Future Opportunity

### Frame
Wide calm lifestyle / property-discovery image, 16:10.

### Camera
35–50mm equivalent.

### Subject
Returning customer considering another relevant property opportunity.

### Composition
- subtle device or brochure / screen interaction,
- mature, calm environment,
- architecture or property context visible,
- visual continuity with VC-02 without duplicating it.

### Lighting
Golden hour into dusk.

### Narrative cue
The customer relationship remains valuable after the first transaction.

### Avoid
Investment-return imagery, wealth symbols, champagne, supercars.

---

# 12. UI-overlay system

Actual Maia UI overlays should use the existing product visual language.

When overlays sit over photography:
- use one primary panel only,
- max 28px radius,
- border `rgba(180,139,255,.16)`,
- dark surface around `rgba(13,7,25,.88)`,
- backdrop blur only if readability requires it,
- one focused violet state,
- no nested glass-card pile.

Overlay placement:
- never cover a face,
- never hide the key architectural subject,
- use negative-space side,
- maintain 24–40px desktop breathing room,
- on mobile move the UI below the image rather than forcing tiny overlays.

---

# 13. Aspect-ratio and export contract

Generate source assets with enough resolution for desktop use.

Preferred master:
- landscape: 1792×1120 or equivalent ~16:10
- portrait alternate when required: 1024×1280 or equivalent 4:5

For each approved asset prepare:
- desktop crop,
- mobile crop if the master does not crop safely,
- WebP production export,
- descriptive filename,
- alt text describing the real scene rather than product marketing claims.

Filename convention:
- `maia-vc-01-marketing-attention.webp`
- `maia-vc-02-enquiry-entry.webp`
- `maia-vc-03-property-discovery.webp`
- `maia-vc-04-reactivation.webp`
- `maia-vc-05-viewing.webp`
- `maia-vc-06-human-handoff.webp`
- `maia-vc-07-future-opportunity.webp`

---

# 14. Consistency test

Before an asset is approved, ask:

1. Could this image belong in the same case study as the other six?
2. Does it look photographic rather than AI-rendered?
3. Does it communicate one story moment within two seconds?
4. Does it leave room for product UI?
5. Does the violet treatment feel restrained?
6. Could it work in Dubai, London, Lagos, Toronto, Nairobi or Johannesburg without contradiction?
7. Is the property / human context believable?
8. Does it avoid fake product proof?
9. Does it avoid luxury-property cliché?
10. Would the page still feel like Fluxknight if the image were viewed without the logo?

If any answer is no, regenerate or revise.

---

# 15. Batch 1 generation briefs

Phase 9C1 should generate only the first three assets.

## VC-01 brief
Premium contemporary real-estate marketing workspace at dusk, cinematic editorial photography, large monitor showing elegant residential campaign imagery without readable fake metrics, smartphone on desk, subtle incoming-customer activity implied but not represented as floating icons, dark graphite and warm-stone materials, warm practical lighting mixed with cool screen light, restrained violet accent reflections, globally neutral modern office, realistic textures, 16:10 landscape, subject weighted to one side, 30% calm negative space, no logos, no readable generated text, no cyberpunk styling.

## VC-02 brief
Globally relatable professional property prospect in a refined contemporary interior using a smartphone after discovering a residential development, close-medium editorial photograph, natural focused expression, realistic skin, smart-casual muted wardrobe, phone clearly visible with clean dark screen area suitable for later Maia interface compositing, subtle property imagery or architectural context in environment, warm natural light with slight screen glow and restrained violet reflection, premium but believable, 4:3 / crop-safe 16:10 composition, negative space on one side, no logos, no generated chat text, no staged smiling-at-phone stock pose.

## VC-03 brief
Contemporary globally neutral residential architecture at blue hour, premium editorial architectural photography, refined apartment / townhouse / villa environment with glass, stone, timber and warm interior lighting, one coherent property subject, realistic scale, no landmark dependence, no sales signage, no people required, strong composition with 30% visually calm negative space for Maia property recommendation UI, restrained cool-violet undertone in shadows only, cinematic but believable, 16:10 landscape, no text, no currency, no luxury-car or mansion cliché.

---

# 16. Phase 9B acceptance criteria

Phase 9B is complete when:
- one master photographic mood is defined,
- lighting rules are defined,
- color treatment is defined,
- human casting is defined,
- architecture is defined,
- device / generated-text rules are defined,
- camera language is defined,
- negative-space and crop rules are defined,
- each of seven assets has a locked composition,
- UI overlay behavior is defined,
- production filenames are defined,
- Batch 1 briefs are ready for image generation.

## Locked conclusion

The visual-context layer should feel like a premium real-estate operations film
shot inside the Fluxknight world, not a collection of AI illustrations.

The next step is **Phase 9C1: generate VC-01, VC-02 and VC-03, review them as one
visual family, and reject any asset that breaks the locked art direction before
integrating anything into the page.**
