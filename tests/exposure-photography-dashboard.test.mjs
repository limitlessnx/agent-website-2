import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(path, "utf8");

test("photography organizations use Xposure vocabulary and dashboard composition", () => {
  const experience = read("lib/industryExperience.ts");
  const catalog = read("lib/industryCatalog.ts");
  const portal = read("app/portal/page.tsx");
  const dashboard = read("components/portal/PhotographyDashboard.tsx");
  assert.match(experience, /"photography-studio"/);
  assert.match(experience, /Studio Catalogue/);
  assert.match(catalog, /Photography Studios/);
  assert.match(catalog, /Meta template campaigns on Business/);
  assert.match(portal, /experience\.slug === "photography-studio"/);
  for (const marker of ["Upcoming bookings", "Clients & enquiries", "Studio catalogue", "Maia · WhatsApp Concierge", "Run campaign"]) assert.match(dashboard, new RegExp(marker.replace(/[·&]/g, "\\$&")));
});

test("Xposure campaign APIs remain tenant scoped and do not expose Meta credentials", () => {
  const templates = read("app/api/portal/campaigns/meta-templates/route.ts");
  const send = read("app/api/portal/campaigns/send/route.ts");
  assert.match(templates, /getClientSession/);
  assert.match(templates, /organization_id.*session\.organizationId/);
  assert.match(templates, /get_organization_integration_credentials/);
  assert.match(templates, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.doesNotMatch(templates, /NextResponse\.json\([^\n]*accessToken/);
  assert.match(send, /requirePortalPermission/);
  assert.match(send, /assertFluxFeatureAccess/);
  assert.match(send, /crm_customers/);
  assert.match(send, /\.eq\("organization_id", session\.organizationId\)/);
  assert.match(send, /whatsapp_delivery_attempts/);
});

test("Xposure campaign UI uses approved templates and explicit send confirmation", () => {
  const page = read("app/portal/campaigns/CampaignComposer.tsx");
  const route = read("app/portal/campaigns/page.tsx");
  assert.match(page, /meta-templates/);
  assert.match(page, /approved Meta templates/);
  assert.match(page, /window\.confirm/);
  assert.match(page, /aria-busy/);
  assert.match(route, /requirePortalPermission/);
  assert.match(route, /photography-studio/);
});

test("Xposure operational routes use photography-specific hierarchy without changing tenant reads", () => {
  const customers = read("app/portal/customers/page.tsx");
  const conversations = read("app/portal/conversations/page.tsx");
  const appointments = read("app/portal/appointments/page.tsx");
  for (const source of [customers, conversations, appointments]) {
    assert.match(source, /photography-studio/);
    assert.match(source, /getClientOnboardingProfile/);
  }
  assert.match(customers, /Clients and studio enquiries/);
  assert.match(conversations, /Client conversations/);
  assert.match(appointments, /Bookings & calendar/);
  assert.match(customers, /organization_id=eq/);
  assert.match(conversations, /crm_conversations\?organization_id=eq/);
  assert.match(appointments, /appointments\?organization_id=eq/);
});
