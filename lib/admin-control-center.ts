import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOrganizationId, SYSTEM_ORGANIZATIONS, type OrganizationCategory } from "@/lib/organization-context-catalog";

export type Evidence<T> = { available: boolean; rows: T[]; truncated: boolean };
export type OrganizationSummary = { id: string; name: string; slug: string; status: string; created_at: string };
export type IntegrationSummary = { id: string; organization_id: string; organization_name: string; provider: string; display_name: string; status: string; last_checked_at: string | null; has_credentials: boolean };
export type JobSummary = { id: string; organization_id: string; status: string; attempts: number; max_attempts: number; updated_at: string };
export type OperationSummary = { id: string; organization_id: string | null; status: string };
export type AuditSummary = { id: string; organization_id: string | null; actor_user_id: string | null; action: string; resource_type: string; created_at: string; actorEmail: string | null; outcome: string | null };

/** Bounded, independently fallible reads. Never include payloads, credentials or provider errors. */
async function evidence<T>(query: PromiseLike<{ data: unknown; error: unknown }>, limit: number): Promise<Evidence<T>> {
  try {
    const result = await query;
    if (result.error || !Array.isArray(result.data)) return { available: false, rows: [], truncated: false };
    return { available: true, rows: result.data.slice(0, limit) as T[], truncated: result.data.length > limit };
  } catch { return { available: false, rows: [], truncated: false }; }
}

export async function getAdminOrganizations(options: { search?: string; page?: number; category?: OrganizationCategory } = {}) {
  if (!await getAdminSession()) throw new Error("Platform administrator access required.");
  let query = createAdminClient().from("organizations").select("id,name,slug,status,created_at");
  const search = options.search?.trim().slice(0, 200);
  if (search) query = isOrganizationId(search) ? query.eq("id", search) : query.ilike("name", `%${search.replace(/[\\%_]/g, "\\$&")}%`);
  if (options.category === "platform") query = query.eq("slug", "fluxknight");
  if (options.category === "internal") query = query.in("slug", SYSTEM_ORGANIZATIONS.filter(item => item.id !== "fluxknight").map(item => item.id));
  if (options.category === "customer") query = query.not("slug", "in", `(${SYSTEM_ORGANIZATIONS.map(item => item.id).join(",")})`);
  const page = Number.isSafeInteger(options.page) && Number(options.page) > 0 ? Math.min(Number(options.page), 10000) : 1;
  return evidence<OrganizationSummary>(query.order("created_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * 100, page * 100), 100);
}

export async function getAdminControlCenter() {
  if (!await getAdminSession()) throw new Error("Platform administrator access required.");
  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [organizations, integrations, jobs, tools, maia, whatsapp, email, voice, auditRows] = await Promise.all([
    evidence<OrganizationSummary>(admin.from("organizations").select("id,name,slug,status,created_at").order("created_at", { ascending: false }).limit(101), 100),
    evidence<IntegrationSummary>(admin.from("organization_integration_admin_view").select("id,organization_id,organization_name,provider,display_name,status,last_checked_at,has_credentials").order("updated_at", { ascending: false }).limit(301), 300),
    evidence<JobSummary>(admin.from("automation_provisioning_jobs").select("id,organization_id,status,attempts,max_attempts,updated_at").order("updated_at", { ascending: false }).limit(101), 100),
    evidence<OperationSummary>(admin.from("agent_runtime_tool_runs").select("id,organization_id,status").gte("started_at", since).order("started_at", { ascending: false }).limit(101), 100),
    evidence<OperationSummary>(admin.from("maia_inbound_events").select("id,organization_id,status").gte("received_at", since).order("received_at", { ascending: false }).limit(101), 100),
    evidence<OperationSummary>(admin.from("whatsapp_delivery_attempts").select("id,organization_id,status").gte("created_at", since).order("created_at", { ascending: false }).limit(101), 100),
    evidence<OperationSummary>(admin.from("transactional_email_events").select("id,organization_id,status").gte("created_at", since).order("created_at", { ascending: false }).limit(101), 100),
    evidence<OperationSummary>(admin.from("elevenlabs_voice_calls").select("id,organization_id,status").gte("created_at", since).order("created_at", { ascending: false }).limit(101), 100),
    evidence<Omit<AuditSummary, "actorEmail" | "outcome"> & { metadata?: Record<string, unknown> }>(admin.from("audit_logs").select("id,organization_id,actor_user_id,action,resource_type,created_at,metadata").order("created_at", { ascending: false }).limit(21), 20),
  ]);
  // Only explicitly approved audit metadata crosses the rendering boundary.
  const audit: Evidence<AuditSummary> = { ...auditRows, rows: auditRows.rows.map(row => ({
    id: row.id, organization_id: row.organization_id, actor_user_id: row.actor_user_id,
    action: row.action, resource_type: row.resource_type, created_at: row.created_at,
    actorEmail: typeof row.metadata?.actor_email === "string" ? row.metadata.actor_email : null,
    outcome: typeof row.metadata?.outcome === "string" ? row.metadata.outcome : null,
  })) };
  return { organizations, integrations, jobs, tools, maia, whatsapp, email, voice, audit, since };
}
export type AdminControlCenter = Awaited<ReturnType<typeof getAdminControlCenter>>;
