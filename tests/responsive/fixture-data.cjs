const organizations = [
  ["general", "General", "Demo Business"],
  ["real-estate", "Real Estate", "Demo Realty"],
  ["photography-studio", "Photography Studio", "Demo Studio"],
  ["hotels", "Hotel", "Demo Hotel"],
].map(([slug, industry, name], index) => ({
  id: `10000000-0000-4000-8000-00000000000${index + 1}`,
  slug: `qa-${slug}`,
  name,
  status: "active",
  metadata: { industry, qa_test: true, outbound_disabled: true },
}));
const permissions = [
  "customers.view",
  "customers.manage",
  "systems.view",
  "systems.manage",
  "appointments.view",
  "appointments.manage",
  "analytics.view",
  "members.view",
  "billing.view",
  "integrations.view",
  "conversations.view",
  "support.escalate",
  "workflows.read",
];
function fixture(url) {
  const table = url.pathname.split("/").pop();
  const filter =
    url.searchParams.get("organization_id") ||
    url.searchParams.get("organization_uuid") ||
    "";
  const organization =
    organizations.find((org) => filter.includes(org.id)) || organizations[0];
  const profile = (org) => ({
    id: `profile-${org.id}`,
    organization_id: org.id,
    business_name: org.name,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    business_email: "owner@example.test",
    industry: org.metadata.industry,
    status: "configuration",
    business_knowledge: {},
    whatsapp_preferences: {},
    requested_agents: [],
    business_goals: [],
    channels: [],
    existing_tools: [],
    country: "Nigeria",
    timezone: "Africa/Lagos",
    user_id: "qa-owner",
  });
  if (table === "organizations") {
    const id = url.searchParams.get("id");
    return id
      ? organizations.filter((org) => id.includes(org.id))
      : organizations;
  }
  if (table === "client_onboarding_profiles")
    return filter ? [profile(organization)] : organizations.map(profile);
  if (table === "organization_memberships")
    return [
      {
        id: "qa-membership",
        user_id: "qa-owner",
        organization_id: organization.id,
        status: "active",
        organizations: { slug: organization.slug },
        membership_roles: [
          {
            roles: {
              id: "qa-role",
              slug: "owner",
              name: "Owner",
              role_permissions: permissions.map((key) => ({
                permissions: { key },
              })),
            },
          },
        ],
      },
    ];
  if (table === "organization_systems")
    return [
      { status: "active", system_catalog: { slug: "appointment-system" } },
    ];
  if (table === "hotel_overview_core")
    return {
      arrivals_count: 0,
      departures_count: 0,
      occupied_rooms: 1,
      active_rooms: 4,
      enquiries_count: 0,
      overdue_departures: 0,
      arrivals: [],
      departures: [],
      enquiries: [],
      overdue_stays: [],
      availability: [
        {
          id: "qa-room-type",
          name: "Demo Suite",
          capacity: 2,
          nightly_rate_minor: "250000",
          currency: "NGN",
          available_rooms: 3,
          active_rooms: 4,
        },
      ],
    };
  if (table === "hotel_dashboard_trends")
    return {
      daily: [
        { day: "2026-11-16", bookings: 0, checkins: 0 },
        { day: "2026-11-17", bookings: 0, checkins: 0 },
      ],
      revenue: [],
    };
  if (table === "hotel_tenant_inventory_readiness")
    return {
      roomTypes: 0,
      activeRooms: 0,
      activeRoomTypes: 0,
      publishedRoomTypes: 0,
      unpublishedRoomTypes: 0,
      publishedServices: 0,
    };
  return [];
}
module.exports = { organizations, fixture };
