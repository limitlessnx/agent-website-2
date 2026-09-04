import type { IndustryDefinition } from "@/lib/industryCatalog";

export const industryPhase4Overrides: Record<string, Partial<IndustryDefinition>> = {
  restaurants: {
    hero: "Handle reservations, orders, menu questions and catering interest without slowing down service.",
    subhead: "Give customers immediate answers and capture restaurant orders through WhatsApp or inbound calls while keeping reservations, catering and repeat-customer opportunities organized.",
    problem: [
      "Teams answer the same menu, availability and opening-hour questions repeatedly.",
      "Phone and WhatsApp orders interrupt staff during busy service periods.",
      "Reservation and catering interest can go unanswered while the floor team is occupied.",
      "Order details can be incomplete or misheard when intake is rushed.",
      "Repeat-customer follow-up is inconsistent."
    ],
    outcomes: [
      "Faster customer response",
      "Structured WhatsApp and inbound-call order intake",
      "Cleaner reservation intake",
      "Better catering qualification",
      "Fewer incomplete order details before staff fulfilment",
      "More repeat-customer continuity"
    ],
    journey: ["Customer contact", "Menu or service Q&A", "Order / reservation / catering intake", "Confirmation", "Reminder or follow-up", "Staff fulfilment or handoff"],
    basicExample: "Menu and service Q&A plus reservation, catering or ordering intake through WhatsApp or inbound voice, followed by staff handoff. No automated reminders or follow-up.",
    starterExample: "Adds same-channel reservation, catering and incomplete-order follow-up plus configured reminders through the channel the customer originally used.",
    businessExample: "Adds higher usage, admin access, WhatsApp + email follow-up, inbound voice order intake, Leo and cross-channel customer visibility.",
    businessPlusExample: "Adds a structured customer, order, reservation and loyalty-style operations database where supported.",
    databaseLabel: "Customer + order + reservation database",
    channels: ["WhatsApp ordering", "Inbound call ordering", "Website support", "Email follow-up on Business"],
    workflowTitle: "From a hungry customer to a clean order, reservation or catering handoff.",
    workflowIntro: "The restaurant agent should take repetitive intake off the service team without pretending it can replace kitchen, payment or fulfilment controls that still belong to staff and connected systems.",
    workflowSteps: [
      { title: "Answer menu and service questions", description: "The agent answers approved questions about menu items, opening hours, location, reservation rules, delivery or pickup options and other configured restaurant information." },
      { title: "Capture an order from WhatsApp or an inbound call", description: "The system can collect the requested items, quantities, customer name, phone number, pickup or delivery preference and other configured fulfilment details through either supported intake channel." },
      { title: "Confirm the intake", description: "Before handoff, the agent summarizes the captured order or request so the customer can correct missing or misunderstood details instead of sending staff a half-complete ticket." },
      { title: "Handle reservations and catering", description: "The same front-desk layer can capture party size, preferred date and time, event type, estimated guest count and other configured reservation or catering details." },
      { title: "Recover unfinished conversations", description: "Starter can follow up through the same originating channel when a configured order, reservation or catering intake was not completed, and can send relevant reminders." },
      { title: "Escalate to restaurant staff", description: "Availability exceptions, payment issues, allergies, complaints, unusual custom orders and other cases outside approved boundaries are routed to a human with the captured context." }
    ],
    businessNotes: [
      "Leo can help authorized staff review unresolved orders, reservation enquiries, catering opportunities and conversations waiting for human action.",
      "The AI captures the order intake; fulfilment, payment confirmation and kitchen acceptance remain tied to staff or supported restaurant systems.",
      "Business+ is designed to add structured customer, order, reservation and repeat-customer records as those modules are released."
    ]
  },
  gyms: {
    problem: [
      "Trial and membership enquiries go cold when response is slow.",
      "Staff repeat membership plans, opening hours, class and trainer information across channels.",
      "Trial bookings, renewals and class reminders rely too heavily on staff memory.",
      "Management has limited visibility into which prospects are waiting for a response or renewal action."
    ],
    outcomes: [
      "More trial-ready prospects",
      "Faster membership response",
      "Cleaner prospect qualification",
      "Consistent trial, class and renewal reminders",
      "Better visibility into member and prospect communication"
    ],
    journey: ["Membership enquiry", "Qualification", "Trial or consultation booking", "Reminder", "Membership decision", "Staff handoff"],
    basicExample: "Membership and class Q&A, prospect qualification, trial intake and staff handoff without automated follow-up.",
    starterExample: "Adds same-channel trial reminders, missed-lead recovery, class reminders and configured membership renewal reminders.",
    businessExample: "Adds higher credits, admin users, WhatsApp + email follow-up, inbound voice, Leo and management visibility across prospect and member conversations.",
    businessPlusExample: "Adds the Gym Membership System for structured member profiles, plans, renewal dates, membership status and lifecycle visibility as the module becomes available.",
    databaseLabel: "Gym Membership System — Coming Soon",
    channels: ["WhatsApp", "Website support", "Inbound voice", "Email follow-up on Business"],
    workflowTitle: "Move a membership enquiry from first question to a staff-ready prospect.",
    workflowIntro: "The system handles repetitive membership communication and follow-up while coaches, trainers and front-desk staff keep control of actual membership decisions and in-facility service.",
    workflowSteps: [
      { title: "Answer membership questions", description: "The agent answers approved questions about plans, opening hours, facilities, classes, trainers, trial options and configured policies." },
      { title: "Qualify the prospect", description: "It captures goals, preferred location or branch, training interests, schedule, membership interest and other configured sales-intake details." },
      { title: "Book a trial or consultation", description: "Where scheduling is configured, the system captures a preferred trial, tour, assessment or consultation slot and prepares the handoff." },
      { title: "Keep the prospect moving", description: "Starter can send same-channel reminders before a trial and follow up after missed or unfinished membership conversations." },
      { title: "Support member communication", description: "Business can coordinate WhatsApp and email reminders, surface renewal or class-related communication and give administrators a shared view of customer context." },
      { title: "Escalate to gym staff", description: "Membership exceptions, payment disputes, health-related questions, trainer-specific decisions and anything outside approved knowledge are handed to staff with context." }
    ],
    businessNotes: [
      "Leo can surface trial leads waiting for action, summarize conversations, show missed follow-ups and help staff identify renewal-related communication that needs attention.",
      "Business+ is planned to add the Gym Membership System: member records, membership plans, start and renewal dates, status and other operational fields as integrations are released."
    ]
  },
  clinics: {
    hero: "Reduce missed enquiries and administrative booking friction without putting clinical decisions in an AI agent.",
    subhead: "Use AI for approved non-clinical service information, appointment intake, scheduling support, reminders, rescheduling and staff routing while diagnosis and treatment remain with qualified healthcare professionals.",
    problem: [
      "Missed calls and after-hours enquiries create appointment leakage.",
      "Administrative teams repeatedly answer opening hours, location, booking and approved service questions.",
      "Appointment reminders, rescheduling and cancellation handling consume staff time.",
      "Patients may repeat basic administrative information when conversations move between channels and staff."
    ],
    outcomes: [
      "Faster administrative response",
      "Cleaner appointment intake",
      "More consistent appointment reminders",
      "Simpler rescheduling and cancellation routing",
      "Better staff handoff without automating clinical judgement"
    ],
    journey: ["Administrative enquiry", "Approved service Q&A", "Appointment intake", "Scheduling / rescheduling", "Reminder", "Staff escalation"],
    basicExample: "Approved non-clinical Q&A, appointment intake and human staff escalation. No diagnosis, treatment advice, automated follow-up or reminders.",
    starterExample: "Adds same-channel appointment reminders, missed-enquiry follow-up and configured rescheduling or cancellation reminders.",
    businessExample: "Adds admin users, higher usage, WhatsApp + email administrative follow-up, inbound voice, Leo and workflow visibility while clinical decisions stay with qualified staff.",
    businessPlusExample: "Adds carefully scoped administrative patient-service records only where privacy, consent, security and applicable compliance requirements are satisfied.",
    databaseLabel: "Administrative patient-service database — Coming Soon",
    channels: ["WhatsApp", "Website support", "Inbound voice", "Email follow-up on Business"],
    workflowTitle: "Automate the administrative path around an appointment, not the medical decision.",
    workflowIntro: "Fluxknight can reduce reception workload around approved information and scheduling. It must not diagnose symptoms, recommend treatment or replace emergency and clinical triage procedures.",
    workflowSteps: [
      { title: "Answer approved administrative questions", description: "The agent can provide configured information such as opening hours, location, booking process, accepted service categories and other non-clinical details approved by the clinic." },
      { title: "Capture appointment intake", description: "It collects the administrative details required to request an appointment without attempting to interpret symptoms or make a clinical determination." },
      { title: "Support scheduling", description: "Where the clinic enables scheduling, the system can present or capture appointment options and route booking requests according to configured availability." },
      { title: "Send reminders", description: "Starter and above can send appointment reminders and configured follow-up through the same originating channel, reducing repetitive reception work." },
      { title: "Handle rescheduling and cancellations", description: "The agent can collect a reschedule or cancellation request and follow the clinic's approved administrative workflow or escalate it to staff." },
      { title: "Escalate anything clinical or urgent", description: "Symptoms, medical advice, treatment questions, emergencies, complaints requiring judgement and any request outside approved administrative scope are handed to qualified staff or the clinic's emergency process." }
    ],
    businessNotes: [
      "Leo can help authorized administrative staff review appointment-related conversations, missed follow-ups and unresolved service enquiries, subject to the access controls configured for the clinic.",
      "Business+ administrative records must be scoped around applicable privacy, security, consent and healthcare-data requirements before deployment."
    ]
  }
};

export function withIndustryPhase4Overrides(industry: IndustryDefinition): IndustryDefinition {
  const override = industryPhase4Overrides[industry.slug];
  return override ? { ...industry, ...override } : industry;
}
