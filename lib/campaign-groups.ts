import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { normalizeLeadPhone } from "@/lib/lead-profile-service";

export type CampaignGroup = {
  id: string;
  name: string;
  description?: string;
  leadIds: string[];
  phones: string[];
  createdAt?: string;
  updatedAt?: string;
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
  return {
    id: row.id,
    name: String(content.name || "Manual campaign group"),
    description: String(content.description || ""),
    leadIds: [...new Set(leadIds)],
    phones: [...new Set(phones)],
    createdAt: row.created_at || String(content.created_at || ""),
    updatedAt: String(content.updated_at || ""),
  };
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
  description?: string;
  leadIds?: string[];
  phones?: string[];
}) {
  const id = input.id || crypto.randomUUID();
  const leadIds = [...new Set((input.leadIds || []).map(String).filter(Boolean))];
  const phones = [...new Set((input.phones || []).map((phone) => normalizeLeadPhone(String(phone))).filter(Boolean))];
  if (!String(input.name || "").trim()) throw new Error("Group name is required.");
  if (!leadIds.length && !phones.length) throw new Error("Select leads or add phone numbers before saving a group.");

  const content = {
    type: "campaign_group",
    name: String(input.name).trim(),
    description: String(input.description || "").trim(),
    lead_ids: leadIds,
    phones,
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
  return rows[0] ? normalizeGroup(rows[0]) : { id, ...input, leadIds, phones };
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
