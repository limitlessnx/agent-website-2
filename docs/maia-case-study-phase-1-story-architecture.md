# Maia Case Study — Phase 1 Story Architecture

Branch scope: fluxknight-homepage-rebuild
Status: Locked story architecture only. No production UI change in this phase.

## Purpose

The Maia case study is a primary sales asset for Fluxknight's real-estate operating system. It must demonstrate Maia as the operating layer between property marketing, customer conversations, CRM, follow-up, scheduling, reminders, human handoff and post-sale customer management.

The story must remain globally relatable. Real-estate-specific depth is required, but the example must not feel locked to one country, city, currency, property class or local process.

## Core positioning

Maia is not positioned as a chatbot.

Maia is positioned as a 24/7 real-estate customer operations agent that:
- captures and responds to enquiries,
- turns conversations into structured lead data,
- keeps customer context in CRM,
- recommends relevant properties where catalogue data supports it,
- follows up and nurtures prospects,
- supports property launch and promotion update workflows,
- books inspections/viewings,
- reminds prospects about appointments,
- hands qualified prospects to human agents with full context,
- and supports repetitive post-sale reminders such as installment-payment reminders where configured.

Human agents remain responsible for judgement-heavy work such as negotiation, relationship building, legal/commercial decisions and closing.

## Story spine

Use one fictional-but-realistic prospect throughout the page so each stage feels connected.

Working prospect:
- Name: Alex Morgan
- Source: property launch campaign
- Channel: WhatsApp or web conversation
- Interest: upcoming residential development
- Budget: shown as configurable / market-specific in visuals
- Buying purpose: investment or residence
- Timeline: 3–6 months
- Payment preference: outright or installment
- Status progression: New → Qualified → Warm/Hot → Viewing Booked → Human Handoff → Customer

The exact geography, currency and property type should remain easy to localize so the narrative works for Dubai, London, Lagos, Johannesburg, Toronto, Nairobi and other markets.

## Chapter 1 — Capture

### Goal
Show how marketing attention becomes identifiable customer data instead of disappearing after a campaign.

### Story
1. A real-estate company runs an awareness or launch campaign.
2. Prospects interact through supported paths such as:
   - paid ads,
   - organic social posts,
   - website,
   - WhatsApp,
   - lead forms,
   - listing or campaign CTAs.
3. Campaign CTA encourages the prospect to request launch updates, ask for details, request a brochure or chat with the 24/7 property assistant.
4. Alex starts a conversation.
5. Maia responds immediately.
6. A lead record is created and source/context are saved.

### What the visual must prove
- marketing source can be associated with the lead,
- customer enters through a supported channel,
- Maia responds 24/7,
- enquiry becomes a trackable lead,
- source, contact and interest are retained in CRM.

### Important product truth
Do not imply every anonymous like or reaction automatically becomes a fully identified CRM contact. The case study should show supported conversion paths from engagement into an identifiable interaction or lead capture.

## Chapter 2 — Understand

### Goal
Show that Maia turns conversations into usable sales intelligence.

### Story
1. Alex asks about the development.
2. Maia answers approved property/business questions.
3. Maia asks relevant qualification questions.
4. CRM profile fills progressively from the conversation.
5. Maia identifies:
   - preferred location,
   - property type,
   - budget range,
   - purchase purpose,
   - timeline,
   - payment preference,
   - property interests,
   - lead temperature / stage.
6. Maia surfaces relevant property options where catalogue data supports the recommendation.
7. Alex asks comparison or availability questions.
8. Maia retains context instead of restarting the conversation.

### What the visual must prove
- natural conversation,
- qualification,
- context retention,
- structured CRM data,
- property catalogue knowledge,
- relevant property recommendations,
- lead-status progression.

### Core message
Every useful conversation becomes organizational memory.

## Chapter 3 — Nurture

### Goal
Demonstrate the feature that differentiates Maia from a simple response bot: the system keeps working after the first conversation.

### Story
1. Alex is interested but does not buy immediately.
2. Maia keeps the context and next action.
3. A follow-up is scheduled.
4. Maia sends a contextual follow-up based on Alex's original interest.
5. Alex can be grouped into a launch-interest or property-interest audience.
6. When the property officially launches, relevant prospects can receive an approved launch update.
7. If a promotion becomes available, relevant prospects can receive the promotion update.
8. Before expiry, appropriate prospects can receive reminder messages.
9. Long-term leads can be nurtured with relevant future opportunities instead of disappearing.

### What the visual must prove
- contextual follow-up,
- scheduled reminders,
- audience segmentation,
- launch updates,
- promotion updates,
- promotion-expiry reminders,
- long-term nurture,
- CRM activity history,
- no dependence on individual staff memory for repetitive follow-up.

### Audience examples
Segments may include:
- launch watchlist,
- investors,
- owner-occupiers,
- 1/2/3-bedroom interest,
- location preference,
- installment interest,
- budget range,
- hot/warm/cold stage.

## Chapter 4 — Convert & Operate

### Goal
Show how Maia connects customer intent to the human sales team and keeps operations moving.

### Story
1. Alex decides to book a viewing/inspection.
2. Maia captures preferred date/time.
3. Viewing is scheduled.
4. CRM is updated.
5. Confirmation is sent.
6. Prospect receives reminders.
7. Assigned human agent is notified.
8. Maia prepares the handoff context:
   - lead summary,
   - property interest,
   - budget,
   - timeline,
   - payment preference,
   - important questions,
   - conversation history,
   - scheduled appointment,
   - recommended next action.
9. Human agent takes over.
10. Human conducts viewing, negotiates and closes.
11. CRM stage continues through the transaction.
12. If the customer is on an installment plan, configured payment reminders can continue.
13. Customer history remains available for future relevant opportunities.

### What the visual must prove
- booking,
- calendar/inspection context,
- reminders,
- CRM updates,
- agent assignment,
- complete human handoff,
- clear boundary between Maia automation and human closing,
- post-sale reminder capability,
- long-term customer record.

## Final product reveal

After following Alex's story, zoom out and reveal the complete Maia Real Estate Operating System:

Marketing
→ Customer Channels
→ Maia
→ CRM / Property Data / Automations
→ Human Team

### Marketing layer
- paid ads,
- social,
- website,
- lead campaigns,
- launch campaigns.

### Customer channels
- WhatsApp,
- web,
- supported messaging / form channels,
- future/connected channels only where implemented.

### Maia layer
- converse,
- qualify,
- answer,
- recommend,
- follow up,
- send configured updates,
- remind,
- schedule,
- escalate.

### Operations layer
- leads,
- conversations,
- properties,
- follow-ups,
- inspections/viewings,
- campaign audiences,
- reminders,
- customer history,
- payment schedule where configured,
- analytics / operational visibility.

### Human layer
- priority leads,
- handoffs,
- inspections,
- negotiation,
- closing,
- relationship management.

## Capability guardrails

The case study must not:
- claim anonymous engagement becomes a CRM contact without a supported identifiable interaction,
- invent property facts,
- invent ROI or conversion statistics,
- imply Maia independently performs legal, negotiation or closing decisions,
- imply unsupported integrations are live,
- imply all outbound marketing is unsolicited or unconsented.

Any capability not currently implemented should be labelled future/planned and kept out of the proof narrative until available.

## Page narrative order

1. Hero: Maia turns property interest into organized action.
2. The leak: marketing attention is generated, but leads and context are lost.
3. Chapter 1: Capture.
4. Chapter 2: Understand.
5. Chapter 3: Nurture.
6. Chapter 4: Convert & Operate.
7. Operating-system reveal.
8. Evidence / outcomes supported by real data only.
9. CTA: See Pricing.
10. Secondary CTA: Evaluate Your Business.

## Visual rule

Every major section must visually answer:
"What did Maia just do?"

Preferred visuals:
- campaign/source panel,
- realistic customer conversation,
- CRM profile being populated,
- property recommendation UI,
- follow-up timeline,
- segmented audience,
- launch/promotion update,
- viewing calendar,
- human handoff summary,
- payment reminder,
- complete operating-system dashboard.

Avoid generic icon-only explanation where a product-state visual can demonstrate the capability.

## Success test

A real-estate operator in any major market should finish the case study understanding that:
1. Maia captures and organizes customer interest.
2. Maia preserves context and customer data.
3. Maia keeps follow-up moving over time.
4. Maia can reactivate relevant leads around launches and promotions.
5. Maia moves qualified prospects toward viewings/inspections.
6. Maia gives human agents complete context at handoff.
7. Maia continues handling repetitive customer operations after the first sale stage.
8. Maia is a real-estate operating system layer, not merely a chatbot.
