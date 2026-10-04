export type IndustryExperience = {
  slug: string;
  name: string;
  customerLabel: string;
  inventoryLabel: string;
  inventorySingular: string;
  appointmentLabel: string;
  leadLabel: string;
  dashboardDescription: string;
};

const DEFAULT_EXPERIENCE: IndustryExperience = {
  slug: "general",
  name: "Business",
  customerLabel: "Customers",
  inventoryLabel: "Services & products",
  inventorySingular: "Service or product",
  appointmentLabel: "Appointments",
  leadLabel: "Leads",
  dashboardDescription: "Your business command center.",
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
  },
};

export function getIndustryExperience(industry?: string | null): IndustryExperience {
  return EXPERIENCES[String(industry || "").trim().toLowerCase()] || DEFAULT_EXPERIENCE;
}
