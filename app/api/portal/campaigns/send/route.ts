import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { assertFluxFeatureAccess } from "@/lib/flux-credits";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = { templateName?: string; templatePurpose?: string; customerIds?: string[]; variables?: Record<string, string> };

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await requirePortalPermission(session, ["conversations.reply"]); } catch { return NextResponse.json({ error: "You do not have permission to send campaigns." }, { status: 403 }); }
  try { await assertFluxFeatureAccess(session.organizationId, "follow_ups"); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Campaign sending is not included in this plan." }, { status: 409 }); }
  const body = await request.json().catch(() => ({})) as Body;
  const templateName = String(body.templateName || "").trim();
  const templatePurpose = String(body.templatePurpose || "campaign").trim();
  const customerIds = Array.isArray(body.customerIds) ? [...new Set(body.customerIds.map(String).filter(Boolean))].slice(0, 500) : [];
  if (!templateName || !customerIds.length) return NextResponse.json({ error: "Choose an approved template and at least one client." }, { status: 400 });
  if (!/^[a-z0-9_:-]{2,80}$/i.test(templatePurpose)) return NextResponse.json({ error: "The template purpose is invalid." }, { status: 400 });
  const admin = createAdminClient();
  const { data: customers, error: customerError } = await admin
    .from("crm_customers")
    .select("id,full_name,phone")
    .eq("organization_id", session.organizationId)
    .in("id", customerIds);
  if (customerError) return NextResponse.json({ error: "Unable to load the selected clients." }, { status: 500 });
  let accepted = 0; let failed = 0; const results: Array<{ customerId: string; status: string; error?: string }> = [];
  for (const customer of customers || []) {
    if (!customer.phone) { failed += 1; results.push({ customerId: String(customer.id), status: "skipped", error: "Client has no phone number." }); continue; }
    try {
      await sendWhatsAppMessage({
        organizationId: session.organizationId,
        to: customer.phone,
        text: String(body.variables?.message || "Campaign message"),
        deliveryMode: "template",
        forceTemplate: true,
        templatePurpose,
        requestedTemplateName: templateName,
        variables: { customer_name: customer.full_name || "", ...(body.variables || {}) },
      });
      accepted += 1;
      results.push({ customerId: String(customer.id), status: "accepted" });
    } catch (error) {
      failed += 1;
      results.push({ customerId: String(customer.id), status: "failed", error: error instanceof Error ? error.message : "WhatsApp delivery failed." });
    }
  }
  return NextResponse.json({ ok: accepted > 0, templateName, templatePurpose, attempted: (customers || []).length, accepted, failed, results });
}
