import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { assertFluxFeatureAccess } from "@/lib/flux-credits";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = { templateName?: string; languageCode?: string; customerIds?: string[]; variables?: Record<string, string> };
type Credentials = { waba_id?: string; wabaId?: string; phone_number_id?: string; phoneNumberId?: string; access_token?: string; accessToken?: string; graph_version?: string };

function phone(value: unknown) { return String(value || "").replace(/[^\d]/g, ""); }

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await requirePortalPermission(session, ["conversations.reply"]); } catch { return NextResponse.json({ error: "You do not have permission to send campaigns." }, { status: 403 }); }
  try { await assertFluxFeatureAccess(session.organizationId, "follow_ups"); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Campaign sending is not included in this plan." }, { status: 409 }); }
  const body = await request.json().catch(() => ({})) as Body;
  const templateName = String(body.templateName || "").trim();
  const languageCode = String(body.languageCode || "en_US").trim();
  const customerIds = Array.isArray(body.customerIds) ? [...new Set(body.customerIds.map(String).filter(Boolean))].slice(0, 500) : [];
  if (!templateName || !customerIds.length) return NextResponse.json({ error: "Choose an approved template and at least one client." }, { status: 400 });
  const admin = createAdminClient();
  const [{ data: integration }, { data: rawCredentials }, { data: customers, error: customerError }] = await Promise.all([
    admin.from("organization_integrations").select("configuration,status").eq("organization_id", session.organizationId).eq("provider", "whatsapp").in("status", ["configured", "connected", "degraded"]).maybeSingle(),
    admin.rpc("get_organization_integration_credentials", { p_organization_id: session.organizationId, p_provider: "whatsapp" }),
    admin.from("crm_customers").select("id,full_name,phone").eq("organization_id", session.organizationId).in("id", customerIds),
  ]);
  if (customerError) return NextResponse.json({ error: "Unable to load the selected clients." }, { status: 500 });
  if (!integration) return NextResponse.json({ error: "Connect WhatsApp before sending a campaign." }, { status: 409 });
  const credentials = (rawCredentials && typeof rawCredentials === "object" ? rawCredentials : {}) as Credentials;
  const configuration = integration.configuration && typeof integration.configuration === "object" ? integration.configuration as Record<string, unknown> : {};
  const phoneNumberId = String(credentials.phone_number_id || credentials.phoneNumberId || configuration.phone_number_id || configuration.phoneNumberId || "").trim();
  const accessToken = String(credentials.access_token || credentials.accessToken || "").trim();
  const graphVersion = String(credentials.graph_version || configuration.graph_version || process.env.WHATSAPP_GRAPH_VERSION || "v26.0").trim();
  if (!/^\d+$/.test(phoneNumberId) || !accessToken) return NextResponse.json({ error: "Meta WhatsApp sending credentials are incomplete." }, { status: 409 });
  const values = body.variables || {};
  const parameters = Object.keys(values).sort((a, b) => Number(a) - Number(b)).map((key) => ({ type: "text", text: String(values[key] || "") }));
  let accepted = 0; let failed = 0; const results: Array<{ customerId: string; status: string; error?: string }> = [];
  for (const customer of customers || []) {
    const recipient = phone(customer.phone);
    if (!recipient) { failed += 1; results.push({ customerId: String(customer.id), status: "skipped", error: "Client has no phone number." }); continue; }
    const payload = { messaging_product: "whatsapp", recipient_type: "individual", to: recipient, type: "template", template: { name: templateName, language: { code: languageCode }, ...(parameters.length ? { components: [{ type: "body", parameters }] } : {}) } };
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}/messages`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store" });
    const result = await response.json().catch(() => ({})) as { messages?: Array<{ id?: string }>; error?: { code?: number; message?: string } };
    const status = response.ok ? "accepted" : "failed";
    if (response.ok) accepted += 1; else failed += 1;
    results.push({ customerId: String(customer.id), status, ...(response.ok ? {} : { error: result.error?.message || `Meta returned ${response.status}.` }) });
    await admin.from("whatsapp_delivery_attempts").insert({ organization_id: session.organizationId, recipient, message_type: "template", template_name: templateName, provider_message_id: result.messages?.[0]?.id || null, status, error_code: result.error?.code ? String(result.error.code) : null, error_message: result.error?.message || null, request_payload: { template_name: templateName, language_code: languageCode }, response_payload: result });
  }
  return NextResponse.json({ ok: accepted > 0, templateName, attempted: (customers || []).length, accepted, failed, results });
}
