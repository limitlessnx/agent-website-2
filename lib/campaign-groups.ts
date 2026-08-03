import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { normalizeLeadPhone } from "@/lib/lead-profile-service";

export type CampaignGroup = {
  id: string;
  name: string;
  groupType: "manual" | "smart";
  description?: string;
  leadIds: string[];
  phones: string[];
  rules?: CampaignGroupRules;
  createdAt?: string;
  updatedAt?: string;
};

export type CampaignGroupRules = {
  state?: string;
  interest?: string;
  propertyInterest?: string;
  status?: string;
  score?: string;
  budgetMin?: string;
  budgetMax?: string;
  campaignEligibleOnly?: boolean;
};

type GroupRow = {
  id: string;
  content?: string | Record<string, unknown>;
  created_at?: string;
};

function parseContent(content: GroupRow["content"]) {
  try {
    return typeof content === "string" ? JSON.parse(content) as Record<string, unknown> : content || {};
  } catch {
    return {};
  }
}

function normalizeGroup(row: GroupRow): CampaignGroup {
  const content = parseContent(row.content);
  const leadIds = Array.isArray(content.lead_ids) ? content.lead_ids.map(String).filter(Boolean) : [];
  const phones = Array.isArray(content.phones)
    ? content.phones.map((phone) => normalizeLeadPhone(String(phone))).filter(Boolean)
    : [];
  const groupType = content.group_type === "smart" ? "smart" : "manual";
  return {
    id: row.id,
    name: String(content.name || "Manual campaign group"),
    groupType,
    description: String(content.description || ""),
    leadIds: [...new Set(leadIds)],
    phones: [...new Set(phones)],
    rules: groupType === "smart" && typeof content.rules === "object" && content.rules
      ? sanitizeRules(content.rules as Record<string, unknown>)
      : undefined,
    createdAt: row.created_at || String(content.created_at || ""),
    updatedAt: String(content.updated_at || ""),
  };
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function lower(value: unknown) {
  return cleanText(value).toLowerCase();
}

function money(value: unknown) {
  const parsed = Number(String(value || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sanitizeRules(input?: Record<string, unknown> | CampaignGroupRules): CampaignGroupRules {
  const rules = input || {};
  return Object.fromEntries(
    Object.entries({
      state: cleanText(rules.state),
      interest: cleanText(rules.interest),
      propertyInterest: cleanText(rules.propertyInterest),
      status: cleanText(rules.status),
      score: cleanText(rules.score),
      budgetMin: cleanText(rules.budgetMin),
      budgetMax: cleanText(rules.budgetMax),
      campaignEligibleOnly: rules.campaignEligibleOnly !== false,
    }).filter(([, value]) => value !== ""),
  ) as CampaignGroupRules;
}

export function matchesCampaignGroupRules(
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
  rules?: CampaignGroupRules,
) {
  const normalized = sanitizeRules(rules);
  const status = lower(lead.status);

  if (normalized.campaignEligibleOnly !== false) {
    if (!lead.phone || lead.campaign_eligible === false) return false;
    if (["opted_out", "do_not_contact", "blocked", "invalid"].includes(status)) return false;
  }

  if (normalized.state && !lower(lead.location_preference).includes(lower(normalized.state))) return false;
  if (normalized.status && normalized.status !== "all" && status !== lower(normalized.status)) return false;
  if (normalized.score && normalized.score !== "all" && lower(lead.score || "unscored") !== lower(normalized.score)) return false;

  if (normalized.interest) {
    const searchable = [lead.purpose, lead.property_type, lead.property_interest].map(lower).join(" ");
    if (!searchable.includes(lower(normalized.interest))) return false;
  }

  if (normalized.propertyInterest) {
    const searchable = [lead.property_interest, lead.property_type, lead.purpose].map(lower).join(" ");
    if (!searchable.includes(lower(normalized.propertyInterest))) return false;
  }

  const leadBudget = money(lead.budget);
  const minimum = money(normalized.budgetMin);
  const maximum = money(normalized.budgetMax);
  if (minimum && (!leadBudget || leadBudget < minimum)) return false;
  if (maximum && (!leadBudget || leadBudget > maximum)) return false;
  return true;
}

export async function getCampaignGroups(limit = 100): Promise<CampaignGroup[]> {
  const rows = await supabaseServerRequest<GroupRow[]>(
    `bot_sessions?select=id,content,created_at&role=eq.campaign_group&order=created_at.desc&limit=${Math.max(1, Math.min(limit, 500))}`,
  ).catch(() => []);
  return rows.map(normalizeGroup);
}

export async function getCampaignGroup(id: string): Promise<CampaignGroup | null> {
  if (!id) return null;
  const rows = await supabaseServerRequest<GroupRow[]>(
    `bot_sessions?select=id,content,created_at&id=eq.${encodeURIComponent(id)}&role=eq.campaign_group&limit=1`,
  ).catch(() => []);
  return rows[0] ? normalizeGroup(rows[0]) : null;
}

export async function saveCampaignGroup(input: {
  id?: string;
  name: string;
  groupType?: "manual" | "smart";
  description?: string;
  leadIds?: string[];
  phones?: string[];
  rules?: CampaignGroupRules;
}) {
  const id = input.id || crypto.randomUUID();
  const groupType = input.groupType === "smart" ? "smart" : "manual";
  const leadIds = [...new Set((input.leadIds || []).map(String).filter(Boolean))];
  const phones = [...new Set((input.phones || []).map((phone) => normalizeLeadPhone(String(phone))).filter(Boolean))];
  if (!String(input.name || "").trim()) throw new Error("Group name is required.");
  if (groupType === "manual" && !leadIds.length && !phones.length) {
    throw new Error("Select leads or add phone numbers before saving a manual group.");
  }
  const rules = sanitizeRules(input.rules);
  if (groupType === "smart" && !Object.entries(rules).some(([key, value]) => key !== "campaignEligibleOnly" && value)) {
    throw new Error("Add at least one smart filter before saving a smart group.");
  }

  const content = {
    type: "campaign_group",
    group_type: groupType,
    name: String(input.name).trim(),
    description: String(input.description || "").trim(),
    lead_ids: leadIds,
    phones,
    rules: groupType === "smart" ? rules : undefined,
    updated_at: new Date().toISOString(),
  };

  const rows = await supabaseServerRequest<GroupRow[]>("bot_sessions?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      id,
      user_id: "fluxknight_admin",
      role: "campaign_group",
      content: JSON.stringify(content),
    }),
  });
  return rows[0]
    ? normalizeGroup(rows[0])
    : {
        id,
        name: String(input.name).trim(),
        groupType,
        description: String(input.description || "").trim(),
        leadIds,
        phones,
        rules: groupType === "smart" ? rules : undefined,
      };
}

export async function deleteCampaignGroup(id: string) {
  if (!id) throw new Error("Campaign group ID is required.");
  return supabaseServerRequest<GroupRow[]>(
    `bot_sessions?id=eq.${encodeURIComponent(id)}&role=eq.campaign_group`,
    {
      method: "DELETE",
      headers: { Prefer: "return=representation" },
    },
  );
}
