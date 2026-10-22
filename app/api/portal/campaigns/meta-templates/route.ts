import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MetaTemplate = { name?: string; status?: string; language?: string; category?: string; components?: Array<{ type?: string; text?: string }> };
type MetaResponse = { data?: MetaTemplate[]; paging?: { next?: string }; error?: { message?: string; code?: number } };

function placeholders(template: MetaTemplate) {
  const found = new Set<number>();
  for (const component of template.components || []) for (const match of (component.text || "").matchAll(/\{\{\s*(\d+)\s*\}\}/g)) found.add(Number(match[1]));
  return [...found].filter(Number.isInteger).sort((a, b) => a - b);
}

export async function GET() {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: integration, error: integrationError } = await admin.from("organization_integrations").select("configuration,status").eq("organization_id", session.organizationId).eq("provider", "whatsapp").in("status", ["configured", "connected", "degraded"]).maybeSingle();
  if (integrationError) return NextResponse.json({ error: "Unable to read WhatsApp configuration." }, { status: 500 });
  if (!integration) return NextResponse.json({ error: "Connect WhatsApp before loading Meta templates." }, { status: 409 });
  const { data: rawCredentials, error: credentialsError } = await admin.rpc("get_organization_integration_credentials", { p_organization_id: session.organizationId, p_provider: "whatsapp" });
  if (credentialsError) return NextResponse.json({ error: "WhatsApp credentials are not available." }, { status: 409 });
  const credentials = rawCredentials && typeof rawCredentials === "object" ? rawCredentials as Record<string, unknown> : {};
  const configuration = integration.configuration && typeof integration.configuration === "object" ? integration.configuration as Record<string, unknown> : {};
  const wabaId = String(credentials.waba_id || credentials.wabaId || configuration.waba_id || "").trim();
  const accessToken = String(credentials.access_token || credentials.accessToken || "").trim();
  const graphVersion = String(credentials.graph_version || configuration.graph_version || process.env.WHATSAPP_GRAPH_VERSION || "v26.0").trim();
  if (!/^\d+$/.test(wabaId) || !accessToken || !/^v\d+\.\d+$/.test(graphVersion)) return NextResponse.json({ error: "Meta WhatsApp Business credentials are incomplete." }, { status: 409 });
  let nextUrl: URL | null = new URL(`https://graph.facebook.com/${graphVersion}/${wabaId}/message_templates`);
  nextUrl.searchParams.set("fields", "name,status,language,category,components"); nextUrl.searchParams.set("limit", "100");
  const rows: MetaTemplate[] = []; let pageCount = 0;
  while (nextUrl && pageCount < 10) {
    const response = await fetch(nextUrl, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    const payload = await response.json().catch(() => ({})) as MetaResponse;
    if (!response.ok) return NextResponse.json({ error: "Meta could not return the template inventory.", provider_error: payload.error?.message || null }, { status: 502 });
    rows.push(...(payload.data || []));
    const next = payload.paging?.next;
    if (!next) nextUrl = null;
    else { const candidate = new URL(next); if (candidate.protocol !== "https:" || candidate.hostname !== "graph.facebook.com") return NextResponse.json({ error: "Meta returned an unsafe pagination URL." }, { status: 502 }); nextUrl = candidate; }
    pageCount += 1;
  }
  return NextResponse.json({ ok: true, templates: rows.map((template) => ({ name: String(template.name || ""), status: String(template.status || "UNKNOWN"), language: String(template.language || ""), category: String(template.category || ""), placeholder_count: placeholders(template).length, placeholder_indexes: placeholders(template) })).filter((template) => template.status === "APPROVED").sort((a, b) => a.name.localeCompare(b.name)) });
}
