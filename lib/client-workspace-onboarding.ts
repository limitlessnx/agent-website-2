import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export type ClientOnboardingProfile = {
  id: string;
  organization_id: string;
  membership_id: string | null;
  user_id: string;
  status: "in_progress" | "submitted" | "configuration" | "testing" | "awaiting_approval" | "live" | "paused";
  current_step: number;
  business_name: string | null;
  industry: string | null;
  website: string | null;
  country: string | null;
  timezone: string | null;
  business_email: string | null;
  phone: string | null;
  staff_size: string | null;
  requested_agents: string[];
  business_goals: string[];
  channels: string[];
  existing_tools: string[];
  human_contact_name: string | null;
  human_contact_email: string | null;
  notes: string | null;
  agent_family_id: string | null;
  project_id: string | null;
  agent_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SaveOnboardingInput = Partial<Omit<ClientOnboardingProfile,
  "id" | "organization_id" | "membership_id" | "user_id" | "agent_family_id" | "project_id" | "agent_id" | "created_at" | "updated_at" | "completed_at"
>>;

const profileFields = [
  "id", "organization_id", "membership_id", "user_id", "status", "current_step",
  "business_name", "industry", "website", "country", "timezone", "business_email",
  "phone", "staff_size", "requested_agents", "business_goals", "channels", "existing_tools",
  "human_contact_name", "human_contact_email", "notes", "agent_family_id", "project_id",
  "agent_id", "completed_at", "created_at", "updated_at",
].join(",");

export async function getClientOnboardingProfile(organizationId: string) {
  const rows = await supabaseServerRequest<ClientOnboardingProfile[]>(
    `client_onboarding_profiles?organization_id=eq.${encodeURIComponent(organizationId)}&select=${profileFields}&limit=1`,
  );
  return rows[0] || null;
}

export async function ensureClientOnboardingProfile(input: {
  organizationId: string;
  membershipId: string;
  userId: string;
  businessName: string;
  email: string;
}) {
  const current = await getClientOnboardingProfile(input.organizationId);
  if (current) return current;

  const rows = await supabaseServerRequest<ClientOnboardingProfile[]>("client_onboarding_profiles", {
    method: "POST",
    body: JSON.stringify({
      organization_id: input.organizationId,
      membership_id: input.membershipId,
      user_id: input.userId,
      business_name: input.businessName,
      business_email: input.email,
      status: "in_progress",
      current_step: 1,
    }),
  });
  return rows[0];
}

export async function saveClientOnboardingProfile(
  organizationId: string,
  userId: string,
  input: SaveOnboardingInput,
) {
  const allowed = {
    current_step: input.current_step,
    business_name: input.business_name,
    industry: input.industry,
    website: input.website,
    country: input.country,
    timezone: input.timezone,
    business_email: input.business_email,
    phone: input.phone,
    staff_size: input.staff_size,
    requested_agents: input.requested_agents,
    business_goals: input.business_goals,
    channels: input.channels,
    existing_tools: input.existing_tools,
    human_contact_name: input.human_contact_name,
    human_contact_email: input.human_contact_email,
    notes: input.notes,
  };
  const payload = Object.fromEntries(Object.entries(allowed).filter(([, value]) => value !== undefined));

  const rows = await supabaseServerRequest<ClientOnboardingProfile[]>(
    `client_onboarding_profiles?organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
  return rows[0] || null;
}

export async function completeClientOnboarding(organizationId: string, userId: string) {
  return supabaseServerRequest<{
    onboarding_id: string;
    status: string;
    agent_family_id: string;
    project_id: string;
    agent_id: string;
  }>("rpc/complete_client_onboarding", {
    method: "POST",
    body: JSON.stringify({ p_organization_id: organizationId, p_user_id: userId }),
  });
}

export async function listClientOnboardingProfiles(limit = 50) {
  return supabaseServerRequest<ClientOnboardingProfile[]>(
    `client_onboarding_profiles?select=${profileFields}&order=created_at.desc&limit=${limit}`,
  );
}
