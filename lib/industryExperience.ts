export type IndustryExperience = {
  workspacePreset?: WorkspacePresetKey;
  workspaceSetupNote?: string;
  slug: string;
  name: string;
  customerLabel: string;
  inventoryLabel: string;
  inventorySingular: string;
  appointmentLabel: string;
  leadLabel: string;
  dashboardDescription: string;
  features: {
    propertyCatalog: boolean;
    serviceCatalog: boolean;
    inventory: boolean;
    appointments: boolean;
    memberships: boolean;
    orders: boolean;
    vehicles: boolean;
  };
};

const DEFAULT_FEATURES = { propertyCatalog:false, serviceCatalog:true, inventory:false, appointments:true, memberships:false, orders:false, vehicles:false } as const;
const DEFAULT_EXPERIENCE: IndustryExperience = {
  workspacePreset: "general",
  slug: "general",
  name: "Business",
  customerLabel: "Customers",
  inventoryLabel: "Services & products",
  inventorySingular: "Service or product",
  appointmentLabel: "Appointments",
  leadLabel: "Leads",
  dashboardDescription: "Your business command center.",
  features: { ...DEFAULT_FEATURES },
};

const EXPERIENCES: Record<string, IndustryExperience> = {
  "photography-studio": {
    slug: "photography-studio",
    name: "Photography Studio",
    customerLabel: "Clients",
    inventoryLabel: "Studio Catalogue",
    inventorySingular: "Studio item",
    appointmentLabel: "Bookings & shoots",
    leadLabel: "Enquiries",
    dashboardDescription: "Your client, booking, catalogue and studio operations command center.",
    features: { propertyCatalog:false, serviceCatalog:true, inventory:true, appointments:true, memberships:false, orders:false, vehicles:false },
  },
  "real-estate": {
    slug: "real-estate",
    name: "Real Estate",
    customerLabel: "Leads",
    inventoryLabel: "Property Catalog",
    inventorySingular: "Property",
    appointmentLabel: "Inspections & appointments",
    leadLabel: "Leads",
    dashboardDescription: "Your property, lead and customer operations command center.",
    features: { propertyCatalog:true, serviceCatalog:false, inventory:false, appointments:true, memberships:false, orders:false, vehicles:false },
  },
  "hotels": {
    slug: "hotels",
    name: "Hotels",
    customerLabel: "Guests",
    inventoryLabel: "Rooms & services",
    inventorySingular: "Room or service",
    appointmentLabel: "Bookings",
    leadLabel: "Booking enquiries",
    dashboardDescription: "Your guest, booking and service operations command center.",
    features: { propertyCatalog:false, serviceCatalog:true, inventory:true, appointments:true, memberships:false, orders:false, vehicles:false },
  },
  "restaurants": {
    workspacePreset: "restaurant",
    workspaceSetupNote: "Confirm menus, opening hours and who handles reservation and order requests. Table inventory, fulfilment and payments require your connected restaurant system.",
    slug: "restaurants",
    name: "Restaurants",
    customerLabel: "Customers",
    inventoryLabel: "Menu & services",
    inventorySingular: "Menu item or service",
    appointmentLabel: "Reservations",
    leadLabel: "Enquiries",
    dashboardDescription: "Your customer, reservation and service operations command center.",
    features: { propertyCatalog:false, serviceCatalog:true, inventory:true, appointments:true, memberships:false, orders:true, vehicles:false },
  },
  "beauty-salons": {
    workspacePreset: "appointments",
    workspaceSetupNote: "Confirm service durations, staff availability and cancellation policies before accepting appointments.",
    slug: "beauty-salons",
    name: "Beauty & Salons",
    customerLabel: "Customers",
    inventoryLabel: "Services",
    inventorySingular: "Service",
    appointmentLabel: "Appointments",
    leadLabel: "Enquiries",
    dashboardDescription: "Your customer, service, appointment and campaign command center.",
    features: { propertyCatalog:false, serviceCatalog:true, inventory:false, appointments:true, memberships:false, orders:false, vehicles:false },
  },
  "auto-shops": {
    workspacePreset: "jobs",
    workspaceSetupNote: "Capture vehicle details and service requests for your advisor. Repair authorizations, job cards and service history require your connected workshop system.",
    slug: "auto-shops",
    name: "Auto Shops",
    customerLabel: "Customers",
    inventoryLabel: "Vehicles & services",
    inventorySingular: "Vehicle or service",
    appointmentLabel: "Service bookings",
    leadLabel: "Service enquiries",
    dashboardDescription: "Your customer, vehicle and service operations command center.",
    features: { propertyCatalog:false, serviceCatalog:true, inventory:true, appointments:true, memberships:false, orders:false, vehicles:true },
  },
  "gyms": {
    workspacePreset: "memberships",
    workspaceSetupNote: "Confirm membership options, class availability and trial handoffs. Membership billing, attendance and class capacity require your connected gym system.",
    slug: "gyms",
    name: "Gyms",
    customerLabel: "Members",
    inventoryLabel: "Memberships & services",
    inventorySingular: "Membership or service",
    appointmentLabel: "Bookings",
    leadLabel: "Membership enquiries",
    dashboardDescription: "Your member, booking and membership operations command center.",
    features: { propertyCatalog:false, serviceCatalog:true, inventory:false, appointments:true, memberships:true, orders:false, vehicles:false },
  },
  "clinics": {
    workspacePreset: "appointments",
    workspaceSetupNote: "Use approved administrative enquiries and appointment intake. Clinical records and medical decisions remain in your approved clinical system.",
    slug: "clinics",
    name: "Clinics",
    customerLabel: "Patients",
    inventoryLabel: "Services",
    inventorySingular: "Service",
    appointmentLabel: "Appointments",
    leadLabel: "Enquiries",
    dashboardDescription: "Your approved administrative and appointment operations command center.",
    features: { propertyCatalog:false, serviceCatalog:true, inventory:false, appointments:true, memberships:false, orders:false, vehicles:false },
  },
  "ecommerce": {
    workspacePreset: "commerce",
    workspaceSetupNote: "Confirm product information, returns and support handoffs. Orders, stock, payments and fulfilment require your connected commerce system.",
    slug: "ecommerce",
    name: "E-commerce",
    customerLabel: "Customers",
    inventoryLabel: "Products & orders",
    inventorySingular: "Product",
    appointmentLabel: "Orders & delivery",
    leadLabel: "Buying enquiries",
    dashboardDescription: "Your customer, product and commerce operations command center.",
    features: { propertyCatalog:false, serviceCatalog:true, inventory:true, appointments:false, memberships:false, orders:true, vehicles:false },
  },
  "sales-companies": {
    workspacePreset: "sales",
    workspaceSetupNote: "Confirm your offers, qualification questions, sales stages and the person responsible for each handoff.",
    slug: "sales-companies",
    name: "Sales Companies",
    customerLabel: "Prospects",
    inventoryLabel: "Offers & products",
    inventorySingular: "Offer or product",
    appointmentLabel: "Sales meetings",
    leadLabel: "Leads",
    dashboardDescription: "Your prospect, opportunity and sales operations command center.",
    features: { propertyCatalog:false, serviceCatalog:true, inventory:false, appointments:true, memberships:false, orders:false, vehicles:false },
  },
  "professional-services": {
    workspacePreset: "sales",
    workspaceSetupNote: "Confirm service scope, consultation availability and proposal handoffs. Engagement terms need an authorized team review.",
    slug: "professional-services",
    name: "Professional Services",
    customerLabel: "Clients",
    inventoryLabel: "Services",
    inventorySingular: "Service",
    appointmentLabel: "Consultations",
    leadLabel: "Prospects",
    dashboardDescription: "Your client, consultation and service operations command center.",
    features: { propertyCatalog:false, serviceCatalog:true, inventory:false, appointments:true, memberships:false, orders:false, vehicles:false },
  },
  "service-businesses": {
    workspacePreset: "jobs",
    workspaceSetupNote: "Confirm your service areas, request details, quote approval and scheduling handoffs. Job dispatch and fulfilment require your connected service system.",
    slug: "service-businesses",
    name: "Service Businesses",
    customerLabel: "Customers",
    inventoryLabel: "Services & jobs",
    inventorySingular: "Service or job",
    appointmentLabel: "Bookings",
    leadLabel: "Service enquiries",
    dashboardDescription: "Your customer, job and service operations command center.",
    features: { propertyCatalog:false, serviceCatalog:true, inventory:true, appointments:true, memberships:false, orders:false, vehicles:false },
  },
};

export function getIndustryExperience(industry?: string | null): IndustryExperience {
  const key = String(industry || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (["hotel", "hospitality"].includes(key)) return EXPERIENCES.hotels;
  if (["photography", "photographystudios"].includes(key)) return EXPERIENCES["photography-studio"];
  return Object.values(EXPERIENCES).find((item) =>
    [item.slug, item.name].some((name) => name.toLowerCase().replace(/[^a-z0-9]/g, "") === key),
  ) || DEFAULT_EXPERIENCE;
}

export type WorkspacePresetKey = "general" | "sales" | "appointments" | "memberships" | "commerce" | "restaurant" | "jobs";
export type WorkspacePreset = {
  readonly version: 1;
  readonly key: WorkspacePresetKey;
  readonly title: string;
  readonly journey: readonly string[];
  readonly requirements: readonly string[];
};

// Configuration only. No tenant records, prices, credentials or enabled automations.
const WORKSPACE_PRESETS: Record<WorkspacePresetKey, Omit<WorkspacePreset, "key" | "version">> = {
  general: {
    title: "General business",
    journey: ["Receive enquiry", "Understand the request", "Assign a team member", "Record the outcome"],
    requirements: ["Business hours and contact details", "Approved services, products and answers", "Human handoff contact and escalation rules"],
  },
  sales: {
    title: "Sales & client services",
    journey: ["Capture prospect", "Qualify the enquiry", "Arrange consultation", "Follow through with your team"],
    requirements: ["Offers, services and qualification questions", "Consultation availability and ownership", "Sales stages and follow-up approval rules"],
  },
  appointments: {
    title: "Appointment services",
    journey: ["Receive request", "Check service availability", "Confirm appointment", "Record the handoff"],
    requirements: ["Service durations and business hours", "Staff availability and calendar connection", "Cancellation rules and administrative handoff"],
  },
  memberships: {
    title: "Memberships & classes",
    journey: ["Receive membership enquiry", "Explain approved options", "Arrange trial or visit", "Hand over to your team"],
    requirements: ["Membership options and class information", "Trial scheduling and staff contact", "Connected membership system and approval rules"],
  },
  commerce: {
    title: "Products & customer support",
    journey: ["Receive product enquiry", "Answer approved questions", "Route order support", "Record the outcome"],
    requirements: ["Product information and support policies", "Connected store and fulfilment contacts", "Returns, consent and escalation rules"],
  },
  restaurant: {
    title: "Reservations & menu enquiries",
    journey: ["Receive guest enquiry", "Clarify menu or booking request", "Confirm with your team", "Record the outcome"],
    requirements: ["Menu, opening hours and approved answers", "Reservation intake and connected restaurant tools", "Order handoff and staff escalation contact"],
  },
  jobs: {
    title: "Service requests & jobs",
    journey: ["Capture service request", "Collect job details", "Arrange quote or visit", "Hand over to your team"],
    requirements: ["Services, service areas and intake questions", "Scheduling, quote approval and assigned staff", "Connected job system and fulfilment handoff"],
  },
};

export function getIndustryWorkspacePreset(experience: IndustryExperience): WorkspacePreset {
  const key = experience.workspacePreset || "general";
  return { key, version: 1, ...WORKSPACE_PRESETS[key] };
}


export type IndustryFeature = keyof IndustryExperience["features"];

export function industryAllows(industry: string | null | undefined, feature: IndustryFeature) {
  return getIndustryExperience(industry).features[feature];
}
