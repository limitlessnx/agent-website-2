import { createAdminClient } from "@/lib/supabase/admin";
import type { LeoIdentity } from "@/lib/leo-core";

export type LeoWorkspaceRelation = "owned" | "client";
export type LeoWorkspaceTarget = {
  organizationId: string;
  name: string;
  slug: string;
  status: string;
  relation: LeoWorkspaceRelation;
  aliases: string[];
};

type OrganizationRow = { id: string; name?: string | null; slug?: string | null; status?: string | null };

function text(value: unknown) { return String(value || "").trim(); }
function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function aliasesFor(row: OrganizationRow) {
  const raw = [text(row.name), text(row.slug)].filter(Boolean);
  const joined = normalize(raw.join(" "));
  if (/limitless|realty/.test(joined)) raw.push("limitless", "limitless realty", "realty", "maia");
  if (/gencouv/.test(joined)) raw.push("gencouv", "gencouv trading");
  if (/fluxknight|fluxagents|boundless flux/.test(joined)) raw.push("fluxknight", "fluxagents", "platform");
  return [...new Set(raw.map(normalize).filter(Boolean))];
}
function relationFor(row: OrganizationRow): LeoWorkspaceRelation {
  const value = normalize(`${row.name || ""} ${row.slug || ""}`);
  return /limitless|gencouv|fluxknight|fluxagents|boundless flux/.test(value) ? "owned" : "client";
}

export async function listLeoWorkspacePortfolio(identity: LeoIdentity) {
  if (identity.scope !== "super_admin") throw new Error("Cross-workspace portfolio access is restricted to Super Leo.");
  const admin = createAdminClient();
  const result = await admin.from("organizations").select("id,name,slug,status").order("created_at", { ascending: false }).limit(250);
  if (result.error) throw result.error;
  return ((result.data || []) as OrganizationRow[]).map((row) => ({
    organizationId: row.id,
    name: text(row.name) || "Unnamed workspace",
    slug: text(row.slug),
    status: text(row.status) || "unknown",
    relation: relationFor(row),
    aliases: aliasesFor(row),
  } satisfies LeoWorkspaceTarget));
}

export async function resolveLeoWorkspaceTarget(identity: LeoIdentity, reference: string) {
  const ref = normalize(reference);
  if (!ref) throw new Error("A workspace reference is required.");
  const workspaces = await listLeoWorkspacePortfolio(identity);
  const exact = workspaces.filter((workspace) => workspace.organizationId === reference || normalize(workspace.slug) === ref || normalize(workspace.name) === ref || workspace.aliases.includes(ref));
  if (exact.length === 1) return exact[0];
  const fuzzy = workspaces.filter((workspace) => [workspace.name, workspace.slug, ...workspace.aliases].some((value) => normalize(value).includes(ref) || ref.includes(normalize(value))));
  if (fuzzy.length === 1) return fuzzy[0];
  if (exact.length > 1 || fuzzy.length > 1) throw new Error("Workspace reference is ambiguous. Use an organization ID or a more specific workspace name.");
  throw new Error("Workspace was not found in the current Super Leo portfolio.");
}

export function compactLeoWorkspacePortfolio(workspaces: LeoWorkspaceTarget[]) {
  return workspaces.map((workspace) => ({ organizationId: workspace.organizationId, name: workspace.name, slug: workspace.slug || null, status: workspace.status, relation: workspace.relation }));
}
