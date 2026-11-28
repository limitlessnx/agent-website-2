import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncWhatsAppTemplateInventory } from "@/lib/whatsapp-template-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: integrations, error } = await admin.from("organization_integrations")
    .select("organization_id,provider,configuration").in("provider", ["whatsapp", "meta_whatsapp"]).in("status", ["configured", "connected", "degraded"]);
  if (error) return NextResponse.json({ error: "Unable to read connected integrations." }, { status: 503 });
  const candidates = new Map<string, string>();
  for (const row of [...(integrations || [])].sort((a,b) => Number(b.provider === "whatsapp") - Number(a.provider === "whatsapp"))) {
    const id = String(row.organization_id);
    const config = row.configuration as Record<string, unknown> | null;
    if (!candidates.has(id)) candidates.set(id, String(config?.provider_family || "meta"));
  }
  const ids = [...candidates].filter(([, family]) => family === "meta").map(([id]) => id);
  if (!ids.length) return NextResponse.json({ checked: 0, failed: 0 });
  const { data: organizations, error: orgError } = await admin.from("organizations").select("id").eq("status", "active").in("id", ids);
  if (orgError) return NextResponse.json({ error: "Unable to read active organizations." }, { status: 503 });
  const active = (organizations || []).map(row => String(row.id));
  const deadline = AbortSignal.timeout(40000);
  let checked = 0, failed = 0;
  for (let offset = 0; offset < active.length; offset += 3) {
    if (deadline.aborted) break;
    const batch = await Promise.allSettled(active.slice(offset, offset + 3).map(id => syncWhatsAppTemplateInventory(id, deadline)));
    for (const result of batch) { if (result.status === "fulfilled") checked++; else failed++; }
  }
  const deferred = active.length - checked - failed;
  return NextResponse.json({ checked, failed, deferred }, { status: failed || deferred ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
