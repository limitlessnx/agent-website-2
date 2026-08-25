import { NextRequest, NextResponse } from "next/server";
import { requireAutomationApiKey } from "@/lib/limitless-api-auth";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = requireAutomationApiKey(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const organizationId = String(body.organization_id || "limitless-realty");
    const to = String(body.to || body.recipient || body.phone || "");

    if (!to) return NextResponse.json({ error: "to is required." }, { status: 400 });

    const propertyImageUrls = Array.isArray(body.property_image_urls)
      ? body.property_image_urls.filter((value: unknown): value is string => typeof value === "string")
      : undefined;

    const result = await sendWhatsAppMessage({
      organizationId,
      to,
      text: typeof body.text === "string" ? body.text : typeof body.message === "string" ? body.message : undefined,
      lastCustomerMessageAt: typeof body.last_customer_message_at === "string" ? body.last_customer_message_at : null,
      forceTemplate: body.force_template === true,
      templatePurpose: typeof body.template_purpose === "string" ? body.template_purpose : undefined,
      variables: body.variables && typeof body.variables === "object" ? body.variables : undefined,
      propertyImageUrls,
    });

    return NextResponse.json(result);
  } catch (error) {
    const typed = error as Error & { status?: number; code?: string; response?: unknown };
    const status = typed.status && typed.status >= 400 && typed.status < 600 ? typed.status : /No active approved WhatsApp template/.test(typed.message) ? 409 : 500;
    return NextResponse.json({
      ok: false,
      error: typed.message || "Unable to send WhatsApp message.",
      code: typed.code || null,
      provider_response: typed.response || null,
    }, { status });
  }
}
