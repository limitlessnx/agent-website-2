export type IndustryExperience = {
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
  return EXPERIENCES[String(industry || "").trim().toLowerCase()] || DEFAULT_EXPERIENCE;
}


export type IndustryFeature = keyof IndustryExperience["features"];

export function industryAllows(industry: string | null | undefined, feature: IndustryFeature) {
  return getIndustryExperience(industry).features[feature];
}
