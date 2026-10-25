import { createAdminClient } from "@/lib/supabase/admin";

export type EstateKnowledgeSource = {
  id: string;
  title: string;
  source_type: string;
  source_url: string | null;
  content: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  updated_at: string;
};

export type EstateWebsiteSourceInput = {
  title: string;
  url: string;
  content: string;
  checksum: string;
};

function required(value: unknown, label: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function returnedSource(value: unknown): EstateKnowledgeSource {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("The website knowledge source was not returned.");
  const record = row as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.title !== "string" || typeof record.source_type !== "string" || typeof record.status !== "string") {
    throw new Error("The website knowledge source response was invalid.");
  }
  return record as unknown as EstateKnowledgeSource;
}

export async function listEstateKnowledgeSources(organizationId: string, estateId: string, approvedOnly = false) {
  if (!organizationId || !estateId) throw new Error("Organization and estate are required.");
  const admin = createAdminClient();
  const links = await admin
    .from("real_estate_estate_knowledge_links")
    .select("knowledge_source_id")
    .eq("organization_id", organizationId)
    .eq("estate_id", estateId)
    .limit(200);
  if (links.error) throw links.error;
  const ids = (links.data || []).map((row) => row.knowledge_source_id);
  if (!ids.length) return [];

  let query = admin
    .from("knowledge_sources")
    .select("id,title,source_type,source_url,content,status,metadata,updated_at")
    .eq("organization_id", organizationId)
    .in("id", ids)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (approvedOnly) query = query.eq("status", "ready");
  const result = await query;
  if (result.error) throw result.error;
  return (result.data || []) as EstateKnowledgeSource[];
}

export async function linkEstateKnowledgeSource(organizationId: string, estateId: string, sourceId: string, actorId: string, remove = false) {
  if (!organizationId || !estateId || !sourceId || !actorId?.trim()) throw new Error("Organization, estate, source and authenticated actor are required.");
  const result = await createAdminClient().rpc("link_real_estate_knowledge_source_with_audit", {
    p_organization_id: organizationId,
    p_actor_id: actorId,
    p_estate_id: estateId,
    p_knowledge_source_id: sourceId,
    p_remove: remove,
  });
  if (result.error) throw result.error;
  return { linked: !remove };
}

export async function captureEstateWebsiteSource(organizationId: string, estateId: string, source: EstateWebsiteSourceInput, actorId: string) {
  const result = await createAdminClient().rpc("capture_real_estate_website_source_with_audit", {
    p_organization_id: required(organizationId, "Organization"),
    p_actor_id: required(actorId, "Authenticated actor"),
    p_estate_id: required(estateId, "Estate"),
    p_title: required(source.title, "Website source title"),
    p_source_url: required(source.url, "Website source URL"),
    p_content: required(source.content, "Website snapshot text"),
    p_checksum: required(source.checksum, "Website snapshot checksum"),
  });
  if (result.error) throw result.error;
  return returnedSource(result.data);
}

export async function approveEstateWebsiteSource(organizationId: string, estateId: string, sourceId: string, actorId: string) {
  const result = await createAdminClient().rpc("approve_real_estate_website_source_with_audit", {
    p_organization_id: required(organizationId, "Organization"),
    p_actor_id: required(actorId, "Authenticated actor"),
    p_estate_id: required(estateId, "Estate"),
    p_knowledge_source_id: required(sourceId, "Website knowledge source"),
  });
  if (result.error) throw result.error;
  return returnedSource(result.data);
}
