import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { getCampaignAudienceLeads, normalizeLeadPhone } from "@/lib/lead-profile-service";

export type RealEstateCampaignGroupRules = {
  state?: string;
  interest?: string;
  propertyInterest?: string;
  status?: string;
  score?: string;
  budgetMin?: string;
  budgetMax?: string;
  campaignEligibleOnly?: boolean;
};

export type RealEstateCampaignGroup = {
  id: string;
  name: string;
  groupType: "manual" | "smart";
  description: string;
  leadIds: string[];
  /** Always empty: real-estate groups never store or send standalone phone numbers. */
  phones: string[];
  rules?: RealEstateCampaignGroupRules;
  createdAt: string;
  updatedAt: string;
};

type GroupRow = {
  id: string;
  organization_id: string;
  name: string;
  group_type: "manual" | "smart";
  description: string;
  rules: RealEstateCampaignGroupRules;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type MemberRow = { group_id: string; lead_id: string };

function required(value: string, name: string) {
  const result = String(value || "").trim();
  if (!result) throw new Error(`${name} is required.`);
  return result;
}

function sanitizeRules(input?: Record<string, unknown> | RealEstateCampaignGroupRules): RealEstateCampaignGroupRules {
  const rules = input || {};
  const result = Object.fromEntries(Object.entries({
    state: String(rules.state || "").trim(),
    interest: String(rules.interest || "").trim(),
    propertyInterest: String(rules.propertyInterest || "").trim(),
    status: String(rules.status || "").trim(),
    score: String(rules.score || "").trim(),
    budgetMin: String(rules.budgetMin || "").trim(),
    budgetMax: String(rules.budgetMax || "").trim(),
    campaignEligibleOnly: rules.campaignEligibleOnly !== false,
  }).filter(([, value]) => value !== "")) as RealEstateCampaignGroupRules;
  return result;
}

function mapGroup(row: GroupRow, leadIds: string[] = []): RealEstateCampaignGroup {
  return {
    id: row.id,
    name: row.name,
    groupType: row.group_type,
    description: row.description || "",
    leadIds,
    phones: [],
    rules: row.group_type === "smart" ? sanitizeRules(row.rules) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function readGroups(organizationId: string, id?: string) {
  const org = required(organizationId, "organizationId");
  const filters = [`organization_id=eq.${encodeURIComponent(org)}`];
  if (id) filters.push(`id=eq.${encodeURIComponent(id)}`);
  const rows = await supabaseServerRequest<GroupRow[]>(
    `real_estate_campaign_groups?select=id,organization_id,name,group_type,description,rules,created_by,created_at,updated_at&${filters.join("&")}&order=updated_at.desc&limit=500`,
  );
  return rows;
}

async function mapGroups(organizationId: string, rows: GroupRow[]) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const members = await supabaseServerRequest<MemberRow[]>(
    `real_estate_campaign_group_members?select=group_id,lead_id&organization_id=eq.${encodeURIComponent(organizationId)}&group_id=in.(${ids.map(encodeURIComponent).join(",")})&limit=10000`,
  );
  const byGroup = new Map<string, string[]>();
  for (const member of members) byGroup.set(member.group_id, [...(byGroup.get(member.group_id) || []), member.lead_id]);
  return rows.map((row) => mapGroup(row, byGroup.get(row.id) || []));
}

export async function getRealEstateCampaignGroups(organizationId: string) {
  return mapGroups(organizationId, await readGroups(organizationId));
}

export async function getRealEstateCampaignGroup(organizationId: string, id: string) {
  const normalizedId = required(id, "Campaign group ID");
  const rows = await readGroups(organizationId, normalizedId);
  return (await mapGroups(organizationId, rows))[0] || null;
}

function isContactable(lead: { phone?: string; status?: string; campaign_eligible?: boolean }) {
  const status = String(lead.status || "").trim().toLowerCase();
  return Boolean(lead.phone && lead.campaign_eligible !== false && !["opted_out", "do_not_contact", "blocked", "invalid"].includes(status));
}

export async function saveRealEstateCampaignGroup(input: {
  organizationId: string;
  actorId: string;
  id?: string;
  name: string;
  groupType?: "manual" | "smart";
  description?: string;
  leadIds?: string[];
  phones?: string[];
  rules?: Record<string, unknown> | RealEstateCampaignGroupRules;
}) {
  const organizationId = required(input.organizationId, "organizationId");
  const actorId = required(input.actorId, "actorId");
  const name = required(input.name, "Group name");
  const groupType = input.groupType === "smart" ? "smart" : "manual";
  let leadIds = [...new Set((input.leadIds || []).map((id) => String(id).trim()).filter(Boolean))];
  const phones = [...new Set((input.phones || []).map((phone) => normalizeLeadPhone(String(phone))).filter(Boolean))];

  if (phones.length) {
    const leads = await getCampaignAudienceLeads(organizationId, 10000);
    const eligibleByPhone = new Map(leads.filter(isContactable).map((lead) => [normalizeLeadPhone(lead.phone), String(lead.id)]));
    const unresolved = phones.filter((phone) => !eligibleByPhone.has(phone));
    if (unresolved.length) throw new Error("Campaign groups can include only campaign-eligible CRM leads in this organization. Add or verify the contacts as leads first.");
    leadIds = [...new Set([...leadIds, ...phones.map((phone) => eligibleByPhone.get(phone) as string)])];
  }

  const rules = groupType === "smart" ? sanitizeRules(input.rules) : {};
  if (groupType === "smart" && !Object.entries(rules).some(([key, value]) => key !== "campaignEligibleOnly" && Boolean(value))) {
    throw new Error("Add at least one smart filter before saving a smart group.");
  }
  if (groupType === "manual" && !leadIds.length) throw new Error("Select at least one CRM lead before saving a manual campaign group.");
  if (leadIds.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    throw new Error("Campaign group members must be valid CRM lead IDs.");
  }
  if (groupType === "smart" && leadIds.length) throw new Error("Smart campaign groups cannot pin individual leads.");

  const result = await supabaseServerRequest<GroupRow[]>("rpc/save_real_estate_campaign_group_with_audit", {
    method: "POST",
    body: JSON.stringify({
      p_organization_id: organizationId,
      p_actor_id: actorId,
      p_group_id: input.id || null,
      p_name: name,
      p_group_type: groupType,
      p_description: String(input.description || "").trim(),
      p_rules: rules,
      p_lead_ids: leadIds,
    }),
  });
  const row = Array.isArray(result) ? result[0] : undefined;
  if (!row?.id) throw new Error("Campaign group was not saved.");
  return (await getRealEstateCampaignGroup(organizationId, row.id)) || mapGroup(row, leadIds);
}

export async function deleteRealEstateCampaignGroup(organizationId: string, actorId: string, id: string) {
  const org = required(organizationId, "organizationId");
  const actor = required(actorId, "actorId");
  const groupId = required(id, "Campaign group ID");
  await supabaseServerRequest("rpc/delete_real_estate_campaign_group_with_audit", {
    method: "POST",
    body: JSON.stringify({ p_organization_id: org, p_actor_id: actor, p_group_id: groupId }),
  });
}

export function matchesRealEstateCampaignGroupRules(
  lead: {
    phone?: string;
    status?: string;
    score?: string;
    budget?: string;
    location_preference?: string;
    property_type?: string;
    property_interest?: string;
    purpose?: string;
    campaign_eligible?: boolean;
  },
  rules?: RealEstateCampaignGroupRules,
) {
  const normalized = sanitizeRules(rules);
  const status = String(lead.status || "").trim().toLowerCase();
  if (normalized.campaignEligibleOnly !== false && !isContactable(lead)) return false;
  if (normalized.state && !String(lead.location_preference || "").toLowerCase().includes(normalized.state.toLowerCase())) return false;
  if (normalized.status && normalized.status !== "all" && status !== normalized.status.toLowerCase()) return false;
  if (normalized.score && normalized.score !== "all" && String(lead.score || "unscored").toLowerCase() !== normalized.score.toLowerCase()) return false;
  const interest = [lead.purpose, lead.property_type, lead.property_interest].map((value) => String(value || "").toLowerCase()).join(" ");
  if (normalized.interest && !interest.includes(normalized.interest.toLowerCase())) return false;
  if (normalized.propertyInterest && !interest.includes(normalized.propertyInterest.toLowerCase())) return false;
  const budget = Number(String(lead.budget || "").replace(/[^\d.]/g, "")) || 0;
  const minimum = Number(String(normalized.budgetMin || "").replace(/[^\d.]/g, "")) || 0;
  const maximum = Number(String(normalized.budgetMax || "").replace(/[^\d.]/g, "")) || 0;
  if (minimum && (!budget || budget < minimum)) return false;
  if (maximum && (!budget || budget > maximum)) return false;
  return true;
}
