import type { PlanKey } from "@/lib/industryCatalog";

export type IndustryPricingProfile = {
  slug: string;
  complexity: "Focused" | "Moderate" | "Advanced";
  typicalChannels: string[];
  scopeDrivers: string[];
  planNotes: Partial<Record<PlanKey, string>>;
};

export const industryPricingProfiles: IndustryPricingProfile[] = [
  {
    slug: "real-estate",
    complexity: "Advanced",
    typicalChannels: ["WhatsApp", "Website", "Inbound voice", "Email on Business"],
    scopeDrivers: ["Lead volume", "Property inventory depth", "Inspection workflow", "Team/admin users", "Cross-channel follow-up"],
    planNotes: {
      basic: "Best when the goal is fast property Q&A, buyer qualification and handoff without nurture.",
      starter: "Adds enquiry recovery and inspection reminders through the originating channel.",
      business: "Pricing rises with lead volume, multiple admins, WhatsApp + email sequences and inbound voice usage.",
      "business-plus": "Adds property, buyer, inspection and deal-stage data infrastructure when the module is available."
    }
  },
  {
    slug: "sales-companies",
    complexity: "Advanced",
    typicalChannels: ["WhatsApp", "Website", "Inbound voice", "Email on Business"],
    scopeDrivers: ["Lead volume", "Qualification depth", "Number of reps/admins", "Follow-up cadence", "Pipeline integrations"],
    planNotes: {
      basic: "Focused lead qualification and handoff for one primary channel.",
      starter: "Adds same-channel sales follow-up and reminders.",
      business: "Pricing scales with team access, cross-channel follow-up, reporting and usage credits.",
      "business-plus": "Adds structured prospect, account and opportunity records when released."
    }
  },
  {
    slug: "hotels",
    complexity: "Moderate",
    typicalChannels: ["WhatsApp", "Website", "Inbound voice", "Email on Business"],
    scopeDrivers: ["Room/service knowledge", "Booking enquiry volume", "Reservation workflow", "Front-desk users", "Property integrations"],
    planNotes: {
      basic: "Guest Q&A, reservation intake and front-desk handoff.",
      starter: "Adds reservation recovery and reminders on the originating channel.",
      business: "Pricing increases with higher guest volume, multiple admins, voice and cross-channel follow-up.",
      "business-plus": "Guest and booking operations data layer depends on supported hotel integrations."
    }
  },
  {
    slug: "restaurants",
    complexity: "Advanced",
    typicalChannels: ["WhatsApp ordering", "Inbound call ordering", "Website", "Email on Business"],
    scopeDrivers: ["Order volume", "Menu complexity", "Reservation/catering flows", "Voice usage", "Restaurant/POS integrations"],
    planNotes: {
      basic: "Menu Q&A plus order, reservation or catering intake and human handoff.",
      starter: "Adds same-channel reminders and recovery for unfinished orders, reservations and catering enquiries.",
      business: "Pricing is driven heavily by order volume, inbound voice minutes, admin users and multi-channel activity.",
      "business-plus": "Customer, order and reservation database scope depends on supported restaurant systems."
    }
  },
  {
    slug: "clinics",
    complexity: "Advanced",
    typicalChannels: ["WhatsApp", "Website", "Inbound voice", "Email on Business"],
    scopeDrivers: ["Appointment volume", "Scheduling workflow", "Admin users", "Privacy/security requirements", "Clinic integrations"],
    planNotes: {
      basic: "Approved non-clinical Q&A, appointment intake and staff escalation.",
      starter: "Adds appointment reminders and same-channel administrative follow-up.",
      business: "Pricing reflects higher admin controls, security expectations, voice usage and workflow complexity.",
      "business-plus": "Administrative data modules require privacy, consent, security and compliance scoping before pricing."
    }
  },
  {
    slug: "gyms",
    complexity: "Moderate",
    typicalChannels: ["WhatsApp", "Website", "Inbound voice", "Email on Business"],
    scopeDrivers: ["Membership enquiry volume", "Trial booking flow", "Renewal reminders", "Branches/admin users", "Membership integrations"],
    planNotes: {
      basic: "Membership Q&A, prospect qualification and trial handoff.",
      starter: "Adds trial, class and renewal reminders through the same originating channel.",
      business: "Pricing scales with branches, admins, member communication volume and cross-channel follow-up.",
      "business-plus": "Gym Membership System pricing will depend on member count, branches and required integrations."
    }
  },
  {
    slug: "service-businesses",
    complexity: "Moderate",
    typicalChannels: ["WhatsApp", "Website", "Inbound voice", "Email on Business"],
    scopeDrivers: ["Job enquiry volume", "Intake fields", "Quote/booking workflow", "Service areas", "Team/admin users"],
    planNotes: {
      basic: "Service Q&A, job intake, qualification and human handoff.",
      starter: "Adds quote, booking and site-visit reminders.",
      business: "Pricing varies with job volume, admins, voice usage and cross-channel workflows.",
      "business-plus": "Customer, job, quote and service-history database scope is industry-specific."
    }
  },
  {
    slug: "auto-shops",
    complexity: "Moderate",
    typicalChannels: ["WhatsApp", "Website", "Inbound voice", "Email on Business"],
    scopeDrivers: ["Service enquiry volume", "Vehicle intake depth", "Booking/quote workflow", "Service reminders", "Workshop integrations"],
    planNotes: {
      basic: "Vehicle and service intake with advisor handoff.",
      starter: "Adds quote, booking and maintenance reminders.",
      business: "Pricing scales with customer volume, voice usage, admins and cross-channel updates.",
      "business-plus": "Vehicle and service-history data modules depend on workshop-system integrations."
    }
  },
  {
    slug: "ecommerce",
    complexity: "Advanced",
    typicalChannels: ["Website", "WhatsApp", "Inbound voice where useful", "Email on Business"],
    scopeDrivers: ["Customer conversation volume", "Catalog size", "Order-support load", "Commerce integrations", "Follow-up volume"],
    planNotes: {
      basic: "Product Q&A, buying-intent capture and support intake.",
      starter: "Adds same-channel recovery for unfinished buying journeys.",
      business: "Pricing is strongly affected by conversation volume, catalog complexity and commerce integrations.",
      "business-plus": "Customer/order context database scope depends on the merchant stack and integration coverage."
    }
  },
  {
    slug: "professional-services",
    complexity: "Moderate",
    typicalChannels: ["WhatsApp", "Website", "Inbound voice", "Email on Business"],
    scopeDrivers: ["Prospect volume", "Qualification depth", "Consultation workflow", "Proposal/onboarding follow-up", "Admin users"],
    planNotes: {
      basic: "Service Q&A, qualification, discovery intake and professional handoff.",
      starter: "Adds consultation, proposal and onboarding reminders on the originating channel.",
      business: "Pricing scales with team size, cross-channel follow-up, admin visibility and workflow depth.",
      "business-plus": "Client and engagement data modules depend on the firm's operational structure and integrations."
    }
  }
];

export const industryPricingBySlug = Object.fromEntries(
  industryPricingProfiles.map((profile) => [profile.slug, profile])
) as Record<string, IndustryPricingProfile>;
