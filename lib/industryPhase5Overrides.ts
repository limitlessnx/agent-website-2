import type { IndustryDefinition } from "@/lib/industryCatalog";

export const industryPhase5Overrides: Record<string, Partial<IndustryDefinition>> = {
  "auto-shops": {
    hero: "Capture repair requests, vehicle details and service opportunities without slowing the workshop.",
    subhead: "Use WhatsApp, website support or inbound voice to collect vehicle and repair information, qualify service intent, book or route requests and keep customers updated without pulling advisors away from active jobs.",
    problem: [
      "Repair enquiries often arrive without the vehicle details technicians or service advisors need.",
      "Staff repeatedly answer opening hours, service availability, booking and maintenance questions.",
      "Quote and booking follow-up is inconsistent when the workshop gets busy.",
      "Customers call repeatedly for status updates that could be handled through approved information flows.",
      "Repeat-service opportunities are easily missed when service history is fragmented."
    ],
    outcomes: [
      "Cleaner vehicle and service intake",
      "Faster booking response",
      "More complete information before advisor handoff",
      "Consistent quote and appointment reminders",
      "Less repetitive service-desk communication",
      "Better repeat-service continuity"
    ],
    journey: ["Service enquiry", "Vehicle intake", "Service qualification", "Booking or quote request", "Reminder / update", "Advisor handoff"],
    basicExample: "Service Q&A, vehicle-detail intake, repair or maintenance qualification and advisor handoff through one primary channel plus website support. No automated reminders or follow-up.",
    starterExample: "Adds same-channel quote follow-up, booking reminders, missed-enquiry recovery and configured service or maintenance reminders.",
    businessExample: "Adds higher credits, admin users, WhatsApp + email follow-up, inbound voice, Leo and cross-channel visibility for service enquiries and customer updates.",
    businessPlusExample: "Adds a structured customer, vehicle and service-history database for lifecycle visibility as the vertical database module becomes available.",
    databaseLabel: "Customer + vehicle + service history database — Coming Soon",
    channels: ["WhatsApp", "Website support", "Inbound voice", "Email follow-up on Business"],
    workflowTitle: "From a vague repair message to a service-ready customer record.",
    workflowIntro: "The agent should collect the repetitive information service advisors need before a real workshop decision, without diagnosing mechanical faults it cannot inspect.",
    workflowSteps: [
      { title: "Answer approved service questions", description: "The agent handles configured questions about opening hours, location, supported service categories, booking process, maintenance options and other approved workshop information." },
      { title: "Capture the vehicle", description: "It collects details such as make, model, year, registration or identifier where appropriate, mileage and other configured intake fields." },
      { title: "Capture the service request", description: "The customer describes the repair, maintenance or inspection request. The AI records the information for staff without pretending to perform a mechanical diagnosis." },
      { title: "Qualify and route the request", description: "Configured rules can separate routine maintenance, urgent service enquiries, quote requests and specialist work so the right advisor receives the request." },
      { title: "Keep the customer moving", description: "Starter can send booking reminders, quote follow-up and configured same-channel service reminders. Business can coordinate WhatsApp and email communication." },
      { title: "Hand over to the service advisor", description: "Pricing decisions, technical diagnosis, parts availability, repair approval, disputes and anything outside approved information are escalated with the captured vehicle and enquiry context." }
    ],
    businessNotes: [
      "Leo can surface open quote requests, customers waiting for staff action, overdue follow-up and recent service conversations without advisors reading every chat.",
      "Business+ is designed to connect customer records, vehicles, visits, service history and maintenance lifecycle information as the module is released.",
      "Technical diagnosis and repair approval remain with qualified workshop staff."
    ]
  },
  "service-businesses": {
    hero: "Turn vague service enquiries into qualified jobs without making your team interrogate every customer manually.",
    subhead: "Capture job requirements, location, timing and customer intent across WhatsApp, website support or inbound voice, then move qualified requests toward quotes, appointments and the right human team member.",
    problem: [
      "Quote requests arrive with too little information to price or schedule efficiently.",
      "Teams spend time repeating service coverage, availability and process information.",
      "Promising enquiries disappear when follow-up depends on busy staff remembering each one.",
      "Bookings and site visits are missed when reminders are handled manually.",
      "Customer and job context becomes fragmented across chats, calls and individual staff members."
    ],
    outcomes: [
      "Cleaner job intake",
      "Faster qualification",
      "More quote-ready enquiries",
      "Better booking and site-visit follow-through",
      "Less repetitive admin",
      "Clearer handoff to staff"
    ],
    journey: ["Service enquiry", "Job intake", "Qualification", "Quote / booking", "Follow-up", "Staff handoff"],
    basicExample: "Approved service Q&A, job-detail intake, qualification and staff handoff through one primary channel plus website support. No automated follow-up or reminders.",
    starterExample: "Adds same-channel quote follow-up, appointment or site-visit reminders, missed-lead recovery and configured nurture sequences.",
    businessExample: "Adds higher usage, admins, WhatsApp + email follow-up, inbound voice, Leo and shared visibility across customer and job conversations.",
    businessPlusExample: "Adds a structured customer, job, quote, appointment and service-history database as the vertical operations module becomes available.",
    databaseLabel: "Customer + job operations database — Coming Soon",
    channels: ["WhatsApp", "Website support", "Inbound voice", "Email follow-up on Business"],
    workflowTitle: "Collect the job details before your team spends time chasing them.",
    workflowIntro: "Service businesses vary wildly, because apparently humans created an industry category containing everyone from cleaners to installers. The workflow therefore stays configurable around the information each team actually needs before accepting a job.",
    workflowSteps: [
      { title: "Answer approved service questions", description: "The agent responds to configured questions about service coverage, process, locations, opening hours, general pricing rules and availability boundaries." },
      { title: "Capture job requirements", description: "It collects the customer's requested service, location, timing, job size or scope, contact details and any other configured intake information." },
      { title: "Qualify the request", description: "Rules can identify whether the enquiry fits the service area, minimum job requirements, urgency, budget range or other criteria before staff spend time on it." },
      { title: "Prepare quote or booking handoff", description: "The system can capture preferred appointment or site-visit times and prepare a concise summary for the staff member responsible for pricing or scheduling." },
      { title: "Maintain follow-up", description: "Starter keeps quote and booking follow-up on the originating channel. Business can coordinate WhatsApp and email sequences with higher usage and team visibility." },
      { title: "Escalate the exceptions", description: "Custom pricing, technical judgement, unusual scope, complaints, payment issues and anything outside approved rules are handed to a human with the intake already completed." }
    ],
    businessNotes: [
      "Leo can show staff which jobs are waiting for quotes, which enquiries have gone quiet, which appointments need action and where a customer conversation was left.",
      "Business+ is designed to connect customer, job, quote, appointment and service-history records into a shared operational database."
    ]
  }
};

export function withIndustryPhase5Overrides(industry: IndustryDefinition): IndustryDefinition {
  const override = industryPhase5Overrides[industry.slug];
  return override ? { ...industry, ...override } : industry;
}
