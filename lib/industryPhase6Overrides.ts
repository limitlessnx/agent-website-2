import type { IndustryDefinition } from "@/lib/industryCatalog";

export const industryPhase6Overrides: Record<string, Partial<IndustryDefinition>> = {
  ecommerce: {
    hero: "Turn product questions and buying intent into cleaner purchases, support handoffs and recovered opportunities.",
    subhead: "Use WhatsApp, website support or inbound voice to answer approved product questions, capture purchase intent, support order-related intake and recover unfinished customer journeys without making support staff chase every conversation manually.",
    problem: [
      "Customers abandon purchases when product, delivery or policy questions are not answered quickly.",
      "Support teams repeat the same product, shipping, returns and order-status information across channels.",
      "Buying intent disappears when incomplete conversations are not followed up.",
      "Order-support requests often reach staff without enough context.",
      "Customer history becomes fragmented across chat, email and support interactions."
    ],
    outcomes: [
      "Faster product support",
      "Cleaner purchase-intent capture",
      "More recovered unfinished buying journeys",
      "Better order-support intake",
      "Less repetitive support work",
      "Stronger customer continuity"
    ],
    journey: ["Product enquiry", "Buying intent", "Product or order support", "Follow-up", "Human escalation", "Customer continuity"],
    basicExample: "Product and policy Q&A, purchase-intent capture, order-support intake and human handoff through one primary channel plus website support. No automated follow-up or reminders.",
    starterExample: "Adds same-channel follow-up for unfinished buying journeys, abandoned enquiries and configured order-related reminders.",
    businessExample: "Adds higher usage, admin users, WhatsApp + email follow-up, inbound voice where relevant, Leo and cross-channel visibility across buyer and support conversations.",
    businessPlusExample: "Adds a structured customer, order-context and lifecycle database where supported by commerce integrations as the module becomes available.",
    databaseLabel: "Customer + commerce operations database — Coming Soon",
    channels: ["WhatsApp", "Website support", "Inbound voice", "Email follow-up on Business"],
    workflowTitle: "Keep buying intent alive from the first product question to the right next action.",
    workflowIntro: "The system should remove repetitive pre-sale and support friction while leaving payment, fulfilment, refund approval and inventory truth to connected commerce systems and authorized staff.",
    workflowSteps: [
      { title: "Answer approved product questions", description: "The agent responds to configured questions about products, variants, availability rules, delivery, returns, policies and other approved store information." },
      { title: "Capture buying intent", description: "It records what the customer wants, preferred product or variant, quantity, location and other configured details needed to continue the purchase journey." },
      { title: "Support order-related intake", description: "For order questions, the agent captures the order reference and the customer's request so staff receive a cleaner support case rather than a vague message." },
      { title: "Recover unfinished intent", description: "Starter can follow up through the same originating channel when a configured buying conversation is incomplete or a customer stops before the next step." },
      { title: "Coordinate customer context", description: "Business can combine WhatsApp and email follow-up, give administrators a shared view of conversation history and let Leo surface unresolved or high-intent customer activity." },
      { title: "Escalate the decisions that need a human", description: "Refund approvals, payment disputes, inventory exceptions, fulfilment issues and anything outside approved rules are handed to staff with the captured context." }
    ],
    businessNotes: [
      "Leo can surface unresolved support requests, high-intent buyers, conversations waiting for staff action and follow-up that has gone quiet.",
      "Business+ is designed to connect customer and order-context records where supported by the merchant's commerce stack.",
      "Payments, refunds, inventory and fulfilment remain governed by connected systems and authorized staff."
    ]
  },
  "professional-services": {
    hero: "Turn enquiries into qualified consultations without burying professionals in repetitive intake and follow-up.",
    subhead: "Use WhatsApp, website support or inbound voice to answer approved service questions, qualify prospects, collect discovery details, schedule consultations and keep proposal or onboarding conversations moving toward the right professional.",
    problem: [
      "Professionals spend too much time on enquiries that are not qualified.",
      "Discovery-call intake varies depending on who answers first.",
      "Prospects disappear between initial interest, consultation and proposal follow-up.",
      "Important client context is often scattered across email, chat and individual staff notes.",
      "Onboarding becomes repetitive when the same information must be collected manually."
    ],
    outcomes: [
      "Better-qualified consultations",
      "Cleaner discovery intake",
      "More consistent consultation and proposal follow-up",
      "Less repetitive onboarding admin",
      "Stronger client continuity",
      "Clearer handoff to the responsible professional"
    ],
    journey: ["Enquiry", "Qualification", "Discovery intake", "Consultation", "Proposal / follow-up", "Professional handoff"],
    basicExample: "Approved service Q&A, prospect qualification, discovery intake and professional handoff through one primary channel plus website support. No automated follow-up or reminders.",
    starterExample: "Adds same-channel consultation reminders, missed-enquiry recovery, proposal follow-up and configured onboarding reminders.",
    businessExample: "Adds higher usage, admin users, WhatsApp + email follow-up, inbound voice, Leo and shared visibility across prospect and client conversations.",
    businessPlusExample: "Adds a structured client, engagement, proposal and onboarding database as the professional-services operations module becomes available.",
    databaseLabel: "Client + engagement operations database — Coming Soon",
    channels: ["WhatsApp", "Website support", "Inbound voice", "Email follow-up on Business"],
    workflowTitle: "Qualify the prospect before expensive professional time enters the conversation.",
    workflowIntro: "The AI should handle repetitive intake and coordination, not deliver legal, financial, engineering, consulting or other professional judgement that belongs to qualified humans.",
    workflowSteps: [
      { title: "Answer approved service questions", description: "The agent handles configured questions about services, process, availability, consultation format, general fee structure and other approved information." },
      { title: "Qualify the prospect", description: "It captures need, urgency, budget range, location, company or personal context and other configured criteria before routing the opportunity." },
      { title: "Collect discovery intake", description: "The system gathers the background information the professional team wants before a consultation so the first human conversation starts with context." },
      { title: "Book the consultation", description: "Where scheduling is configured, it captures or presents consultation availability and prepares reminders under Starter and above." },
      { title: "Maintain proposal and onboarding follow-up", description: "Starter keeps follow-up on the originating channel. Business can coordinate WhatsApp and email around proposals, missing information and onboarding steps." },
      { title: "Hand over professional judgement", description: "Advice, scope decisions, custom fees, regulated judgement, contractual decisions and complex client matters are escalated to the appropriate professional with the intake summary attached." }
    ],
    businessNotes: [
      "Leo can surface prospects waiting for review, consultations needing action, proposals with no response and onboarding conversations missing required information.",
      "Business+ is designed to connect client, engagement, proposal and onboarding records into a structured operational view.",
      "Professional judgement remains with qualified staff."
    ]
  }
};

export function withIndustryPhase6Overrides(industry: IndustryDefinition): IndustryDefinition {
  const override = industryPhase6Overrides[industry.slug];
  return override ? { ...industry, ...override } : industry;
}
