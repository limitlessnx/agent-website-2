export type PlanKey = "basic" | "starter" | "business" | "business-plus";

export type PlanDefinition = {
  key: PlanKey;
  name: string;
  eyebrow: string;
  summary: string;
  bestFor: string;
  includes: string[];
  notIncluded?: string[];
  unavailable?: string[];
  comingSoon?: string[];
  leoExplanation?: string;
};

export type WorkflowStep = {
  title: string;
  description: string;
};

export type IndustryDefinition = {
  slug: string;
  name: string;
  hero: string;
  subhead: string;
  problem: string[];
  outcomes: string[];
  journey: string[];
  basicExample: string;
  starterExample: string;
  businessExample: string;
  businessPlusExample: string;
  databaseLabel: string;
  channels?: string[];
  workflowTitle?: string;
  workflowIntro?: string;
  workflowSteps?: WorkflowStep[];
  businessNotes?: string[];
};

export const planDefinitions: PlanDefinition[] = [
  {
    key: "basic",
    name: "Basic",
    eyebrow: "Answer. Qualify. Hand over.",
    summary: "A focused customer-facing system for organizations that mainly need instant response, qualification and human handoff without automated follow-up.",
    bestFor: "Businesses that want one AI channel handling enquiries cleanly before a human takes over.",
    includes: [
      "One primary customer channel: WhatsApp or inbound voice",
      "Website support agent",
      "Approved FAQ, product or service knowledge",
      "Lead qualification or sales intake",
      "Customer detail capture",
      "Human handoff or escalation",
      "Basic conversation visibility"
    ],
    notIncluded: ["No automated follow-up", "No reminder sequences", "No cross-channel nurture"]
  },
  {
    key: "starter",
    name: "Starter",
    eyebrow: "Keep the conversation moving.",
    summary: "Everything in Basic, plus automated follow-up and reminders through the same channel the lead originally used.",
    bestFor: "Businesses losing enquiries because staff cannot consistently remember every follow-up, booking, inspection or reminder.",
    includes: [
      "Everything in Basic",
      "Same-channel automated follow-up",
      "Appointment, booking, quote or inspection reminders where relevant",
      "Missed-lead recovery",
      "Scheduled nurture sequences",
      "Simple lead status tracking"
    ]
  },
  {
    key: "business",
    name: "Business",
    eyebrow: "Operate across the customer journey.",
    summary: "Everything in Starter, with higher usage, admin controls, cross-channel follow-up, deeper workflows and Leo Admin Assistance for staff.",
    bestFor: "Organizations with teams, multiple channels and enough lead volume that management needs visibility, control and coordinated follow-up.",
    includes: [
      "Everything in Starter",
      "Higher monthly usage and credits",
      "Admin workspace and team access",
      "WhatsApp and email follow-up",
      "Inbound voice support",
      "Cross-channel customer context",
      "Workflow visibility and reporting",
      "Human escalation controls",
      "Leo Admin Assistance"
    ],
    unavailable: ["Outbound AI calling is currently unavailable"],
    leoExplanation: "Leo is the internal AI admin assistant for authorized staff. It helps teams find and summarize leads, review conversations, identify hot or neglected opportunities, surface missed follow-ups, retrieve customer context, explain pipeline activity and suggest the next action. Controlled admin actions can be added as those capabilities are enabled."
  },
  {
    key: "business-plus",
    name: "Business+",
    eyebrow: "Add the operating database.",
    summary: "Everything in Business, plus an industry-specific customer or operations database designed around how the organization actually works.",
    bestFor: "Organizations that want the AI system tied to a structured operational database rather than only conversations and follow-up.",
    includes: [
      "Everything in Business",
      "Industry-specific customer or operations database",
      "Deeper record history and lifecycle visibility",
      "More advanced reporting and segmentation",
      "Structured operational data for staff"
    ],
    comingSoon: ["Industry database modules are being released progressively"]
  }
];

export const industries: IndustryDefinition[] = [
  {
    slug: "real-estate",
    name: "Real Estate",
    hero: "Turn more property enquiries into inspections, qualified buyers and closed opportunities.",
    subhead: "Respond instantly, qualify serious buyers, keep property conversations organized and move enquiries toward inspections and human agents without losing context.",
    problem: [
      "Property enquiries arrive across WhatsApp, calls and websites at all hours.",
      "Agents repeat the same property, pricing and location answers every day.",
      "Cold and warm buyers are often followed up inconsistently.",
      "Inspection interest can disappear when reminders and handoff are manual."
    ],
    outcomes: [
      "Faster buyer response",
      "Cleaner qualification by budget, location and urgency",
      "More inspection-ready leads",
      "Consistent follow-up without relying on agent memory",
      "Better visibility into every property conversation"
    ],
    journey: ["Enquiry", "Qualification", "Property match", "Inspection", "Follow-up", "Human agent handoff"],
    basicExample: "Property Q&A, buyer qualification, detail capture and human-agent handoff.",
    starterExample: "Adds property enquiry follow-up and inspection reminders through the same originating channel.",
    businessExample: "Adds admin users, higher usage, WhatsApp + email sequences, inbound voice, Leo and cross-channel lead visibility.",
    businessPlusExample: "Adds a buyer, property, inspection and deal-stage database for deeper operational control.",
    databaseLabel: "Buyer + property operations database",
    channels: ["WhatsApp", "Website support", "Inbound voice", "Email follow-up on Business"],
    workflowTitle: "From first property question to an inspection-ready lead.",
    workflowIntro: "The system should remove repetitive sales admin without pretending an AI should replace the agent who actually closes the deal.",
    workflowSteps: [
      { title: "Answer the property enquiry", description: "The agent responds to approved questions about available properties, location, pricing, payment plans, documentation and inspection availability." },
      { title: "Qualify the buyer", description: "It captures budget, preferred location, property type, purchase timeline, financing or payment preference and urgency." },
      { title: "Match the opportunity", description: "Where configured, the system recommends relevant listings or routes the lead to the right property or human specialist." },
      { title: "Book or prepare inspection", description: "Starter and above can schedule inspection interest and send reminders through the same originating channel." },
      { title: "Follow up intelligently", description: "Business can continue the conversation across WhatsApp and email while keeping the lead context connected for staff." },
      { title: "Hand over to the closer", description: "Hot, urgent or complex opportunities are escalated with a concise summary so the human agent starts with context instead of asking everything again." }
    ],
    businessNotes: [
      "Leo can show agents which leads are hot, overdue for follow-up or waiting for an inspection response.",
      "Business+ is designed to connect buyer records, properties, inspections and deal stages into one operational view."
    ]
  },
  {
    slug: "sales-companies",
    name: "Sales Companies",
    hero: "Respond faster, qualify demand and keep every opportunity moving toward a closer.",
    subhead: "Give sales teams a consistent intake and follow-up layer across customer channels without forcing reps to spend their day chasing repetitive conversations.",
    problem: [
      "Sales enquiries are lost when response time is slow.",
      "Reps spend too much time repeating basic product or service answers.",
      "Follow-up quality varies by rep and workload.",
      "Management lacks one clear view of who is cold, warm or ready to buy."
    ],
    outcomes: ["Faster lead response", "Consistent qualification", "More disciplined follow-up", "Clearer sales handoff", "Better management visibility"],
    journey: ["Lead", "Qualification", "Sales intake", "Follow-up", "Sales-ready status", "Closer handoff"],
    basicExample: "Product or service Q&A, lead qualification, intake capture and human sales handoff.",
    starterExample: "Adds same-channel sales follow-up and scheduled reminders.",
    businessExample: "Adds admin users, higher credits, email + WhatsApp follow-up, inbound voice, Leo and pipeline visibility.",
    businessPlusExample: "Adds a prospect, account and opportunity database with lifecycle tracking.",
    databaseLabel: "Prospect + opportunity database",
    channels: ["WhatsApp", "Website support", "Inbound voice", "Email follow-up on Business"],
    workflowTitle: "Give every lead a consistent route to the right salesperson.",
    workflowIntro: "The goal is not to automate the closer. It is to automate the repetitive work that happens before and between real sales conversations.",
    workflowSteps: [
      { title: "Handle first response", description: "The AI answers approved product, service, availability, pricing-range and process questions immediately." },
      { title: "Capture sales intake", description: "It collects the information the sales team actually needs, such as need, budget, company size, location, urgency or purchase timeline." },
      { title: "Score intent", description: "Leads can be categorized by configured criteria so staff can separate low-intent enquiries from opportunities that deserve fast human attention." },
      { title: "Maintain follow-up", description: "Starter keeps follow-up on the originating channel. Business can coordinate WhatsApp and email follow-up with higher usage allowances." },
      { title: "Give management visibility", description: "Business adds admins, reporting and Leo so managers can see neglected leads, conversation context and pipeline movement without reading every chat manually." },
      { title: "Hand over to the closer", description: "When buying intent is clear, the assigned salesperson receives the lead context and can continue from a much stronger starting point." }
    ],
    businessNotes: [
      "Leo can summarize pipeline activity, surface leads that have gone quiet and help staff understand why a lead was marked warm or hot.",
      "Business+ is designed to add structured prospect, account and opportunity records around the conversational system."
    ]
  },
  {
    slug: "hotels",
    name: "Hotels",
    hero: "Turn guest questions into bookings without making the front desk carry every conversation.",
    subhead: "Answer room, amenity and reservation questions quickly, qualify valuable booking enquiries and keep guest requests moving to the right staff.",
    problem: ["Guest enquiries arrive outside front-desk hours.", "Teams repeat room and amenity information constantly.", "Reservation interest is easy to lose when follow-up is manual."],
    outcomes: ["Faster guest response", "More booking-ready enquiries", "Less repetitive front-desk work", "Cleaner staff handoff"],
    journey: ["Guest enquiry", "Room or service Q&A", "Booking qualification", "Reminder", "Staff handoff"],
    basicExample: "Guest Q&A, reservation intake, qualification and staff handoff.",
    starterExample: "Adds booking and reservation reminders on the originating channel.",
    businessExample: "Adds cross-channel guest follow-up, admin access, inbound voice, Leo and higher usage.",
    businessPlusExample: "Adds structured guest, booking and service-history records where integrations permit.",
    databaseLabel: "Guest + booking operations database"
  },
  {
    slug: "restaurants",
    name: "Restaurants",
    hero: "Handle reservations, menu questions and catering interest without slowing down service.",
    subhead: "Give customers immediate answers while keeping reservation, catering and repeat-customer opportunities organized.",
    problem: ["Teams answer the same menu and opening-hour questions repeatedly.", "Reservation and catering interest can go unanswered during busy service periods.", "Repeat-customer follow-up is inconsistent."],
    outcomes: ["Faster customer response", "Cleaner reservation intake", "Better catering qualification", "More repeat-customer continuity"],
    journey: ["Customer enquiry", "Menu or service Q&A", "Reservation or order intent", "Reminder", "Staff handoff"],
    basicExample: "Menu and service Q&A, reservation or catering intake and human handoff.",
    starterExample: "Adds reservation reminders and same-channel follow-up.",
    businessExample: "Adds admin users, higher credits, email + WhatsApp follow-up, inbound voice and Leo.",
    businessPlusExample: "Adds customer, reservation and loyalty-style records where supported.",
    databaseLabel: "Customer + reservation database"
  },
  {
    slug: "clinics",
    name: "Clinics",
    hero: "Reduce missed enquiries and administrative booking friction around patient care.",
    subhead: "Use AI for approved non-clinical questions, appointment intake, reminders and staff routing while keeping clinical decisions with qualified humans.",
    problem: ["Missed calls create appointment leakage.", "Administrative teams repeat basic booking and service information.", "Reminder and rescheduling work consumes staff time."],
    outcomes: ["Faster administrative response", "Cleaner appointment intake", "Fewer missed reminders", "Better staff routing"],
    journey: ["Enquiry", "Approved admin Q&A", "Appointment intake", "Reminder", "Staff escalation"],
    basicExample: "Approved administrative Q&A, appointment intake and human escalation.",
    starterExample: "Adds appointment reminders and same-channel follow-up.",
    businessExample: "Adds admin users, email + WhatsApp follow-up, inbound voice, Leo and workflow visibility.",
    businessPlusExample: "Adds carefully scoped non-clinical administrative records subject to privacy and compliance requirements.",
    databaseLabel: "Administrative patient-service database"
  },
  {
    slug: "gyms",
    name: "Gyms",
    hero: "Turn trial interest into memberships and keep member communication from becoming manual admin work.",
    subhead: "Answer membership questions, qualify prospects, schedule trials and automate reminders while staff focus on members in the facility.",
    problem: ["Trial leads go cold after initial contact.", "Membership questions repeat across every channel.", "Renewal and class reminders rely on staff memory."],
    outcomes: ["More trial bookings", "Faster membership response", "Consistent reminders", "Cleaner member communication"],
    journey: ["Membership enquiry", "Qualification", "Trial booking", "Reminder", "Membership handoff"],
    basicExample: "Membership Q&A, trial qualification, intake capture and staff handoff.",
    starterExample: "Adds trial, renewal and same-channel reminders.",
    businessExample: "Adds higher credits, admin users, cross-channel follow-up, inbound voice, Leo and reporting.",
    businessPlusExample: "Adds a dedicated gym membership database for members, plans, renewals and lifecycle visibility.",
    databaseLabel: "Gym membership system"
  },
  {
    slug: "service-businesses",
    name: "Service Businesses",
    hero: "Qualify service requests before they consume your team’s time.",
    subhead: "Capture job details, answer approved service questions, identify intent and move qualified customers toward booking or staff handoff.",
    problem: ["Teams waste time on repetitive service questions.", "Quote requests arrive without enough information.", "Follow-up depends on busy staff remembering each enquiry."],
    outcomes: ["Cleaner service intake", "Faster qualification", "Better booking conversion", "Less repetitive admin"],
    journey: ["Service enquiry", "Job intake", "Qualification", "Booking", "Follow-up", "Staff handoff"],
    basicExample: "Service Q&A, job-detail intake, qualification and human handoff.",
    starterExample: "Adds quote, booking and same-channel follow-up reminders.",
    businessExample: "Adds admin users, higher usage, cross-channel follow-up, inbound voice and Leo.",
    businessPlusExample: "Adds customer, job, quote and service-history records.",
    databaseLabel: "Customer + job operations database"
  },
  {
    slug: "auto-shops",
    name: "Auto Shops",
    hero: "Capture repair requests, vehicle details and repeat-service opportunities without slowing the workshop.",
    subhead: "Automate service intake and reminders while keeping mechanics and service advisors focused on actual vehicle work.",
    problem: ["Repair enquiries often arrive without complete vehicle details.", "Service advisors repeat the same information daily.", "Quote and maintenance follow-up is inconsistent."],
    outcomes: ["Cleaner vehicle intake", "Faster booking response", "More consistent quote follow-up", "Better repeat-service reminders"],
    journey: ["Service enquiry", "Vehicle intake", "Qualification", "Booking", "Reminder", "Advisor handoff"],
    basicExample: "Service Q&A, vehicle-detail intake, qualification and advisor handoff.",
    starterExample: "Adds quote, booking and maintenance reminders on the originating channel.",
    businessExample: "Adds admin users, cross-channel follow-up, inbound voice, Leo and higher usage.",
    businessPlusExample: "Adds customer, vehicle and service-history records.",
    databaseLabel: "Vehicle + service history database"
  },
  {
    slug: "ecommerce",
    name: "E-commerce",
    hero: "Answer buying questions faster and recover more customer intent before it disappears.",
    subhead: "Support product discovery, order questions and follow-up without forcing support teams to manually chase every conversation.",
    problem: ["Product questions delay purchases.", "Support teams repeat order and policy information.", "Abandoned intent is rarely followed up consistently."],
    outcomes: ["Faster product support", "Cleaner buyer qualification", "More recovered intent", "Less repetitive support work"],
    journey: ["Product enquiry", "Buying intent", "Support", "Follow-up", "Human escalation"],
    basicExample: "Product Q&A, buyer-intent capture and human support handoff.",
    starterExample: "Adds same-channel follow-up for abandoned or incomplete buying journeys.",
    businessExample: "Adds email + WhatsApp follow-up, admin users, inbound voice where relevant, Leo and higher usage.",
    businessPlusExample: "Adds customer and order-context records where supported by integrations.",
    databaseLabel: "Customer + commerce operations database"
  },
  {
    slug: "professional-services",
    name: "Professional Services",
    hero: "Turn enquiries into qualified consultations without burying your team in intake and follow-up.",
    subhead: "Pre-qualify prospects, collect the right details, book discovery conversations and keep client intake organized.",
    problem: ["Professionals spend time on enquiries that are not qualified.", "Discovery-call intake is inconsistent.", "Proposal and onboarding follow-up is easy to lose."],
    outcomes: ["Better-qualified consultations", "Cleaner intake", "More consistent proposal follow-up", "Stronger client continuity"],
    journey: ["Enquiry", "Qualification", "Discovery booking", "Follow-up", "Professional handoff"],
    basicExample: "Service Q&A, prospect qualification, intake and professional handoff.",
    starterExample: "Adds consultation and proposal reminders on the originating channel.",
    businessExample: "Adds admin users, higher usage, email + WhatsApp follow-up, inbound voice and Leo.",
    businessPlusExample: "Adds client, engagement and onboarding records.",
    databaseLabel: "Client + engagement database"
  }
];

export const industryBySlug = Object.fromEntries(industries.map((industry) => [industry.slug, industry])) as Record<string, IndustryDefinition>;
