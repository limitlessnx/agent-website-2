import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MetaTemplate = {
  name?: string;
  status?: string;
  language?: string;
  category?: string;
  components?: Array<{ type?: string; text?: string; format?: string }>;
};
type MetaTemplatesResponse = {
  data?: MetaTemplate[];
  paging?: { next?: string };
  error?: { message?: string; code?: number };
};
type MetaPhoneNumberResponse = {
  whatsapp_business_account?: { id?: string };
  error?: { message?: string; code?: number };
};

function placeholderIndexes(template: MetaTemplate) {
  const found = new Set<number>();
  for (const component of template.components || []) {
    const text = component.text || "";
    for (const match of text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) {
      const index = Number(match[1]);
      if (Number.isInteger(index) && index > 0) found.add(index);
    }
  }
  return [...found].sort((a, b) => a - b);
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const admin = createAdminClient();
    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .select("id,name,slug")
      .eq("slug", "xposure")
      .maybeSingle();
    if (organizationError) throw organizationError;
    if (!organization) return NextResponse.json({ error: "Xposure organization was not found." }, { status: 404 });

    const { data: integration, error: integrationError } = await admin
      .from("organization_integrations")
      .select("id,status,configuration")
      .eq("organization_id", organization.id)
      .eq("provider", "whatsapp")
      .in("status", ["configured", "connected", "degraded"])
      .maybeSingle();
    if (integrationError) throw integrationError;
    if (!integration) return NextResponse.json({ error: "Xposure WhatsApp integration is not connected." }, { status: 409 });

    const { data: rawCredentials, error: credentialsError } = await admin.rpc(
      "get_organization_integration_credentials",
      { p_organization_id: organization.id, p_provider: "whatsapp" },
    );
    if (credentialsError) throw credentialsError;
    const credentials = rawCredentials && typeof rawCredentials === "object"
      ? rawCredentials as Record<string, unknown>
      : {};
    const configuration = integration.configuration && typeof integration.configuration === "object"
      ? integration.configuration as Record<string, unknown>
      : {};
    let wabaId = String(credentials.waba_id || credentials.wabaId || configuration.waba_id || "").trim();
    const phoneNumberId = String(credentials.phone_number_id || credentials.phoneNumberId || configuration.phone_number_id || configuration.phoneNumberId || "").trim();
    const accessToken = String(credentials.access_token || credentials.accessToken || "").trim();
    const graphVersion = String(credentials.graph_version || configuration.graph_version || process.env.WHATSAPP_GRAPH_VERSION || "v26.0").trim();

    if (!accessToken || !/^v\d+\.\d+$/.test(graphVersion) || (!/^\d+$/.test(wabaId) && !/^\d+$/.test(phoneNumberId))) {
      return NextResponse.json({
        error: "Xposure's Meta Phone Number ID or server-side credentials are incomplete.",
      }, { status: 409 });
    }

    // Prefer the explicitly configured WABA ID. A valid phone-number token may
    // send messages but still cannot expose the whatsapp_business_account field;
    // deriving it must only be a fallback when no WABA ID was configured.
    if (!/^\d+$/.test(wabaId) && /^\d+$/.test(phoneNumberId)) {
      const phoneResponse = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}?fields=whatsapp_business_account{id}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const phonePayload = await phoneResponse.json().catch(() => ({})) as MetaPhoneNumberResponse;
      const derivedWabaId = String(phonePayload.whatsapp_business_account?.id || "").trim();
      if (!phoneResponse.ok || !/^\d+$/.test(derivedWabaId)) {
        return NextResponse.json({
          error: "Meta could not resolve Xposure's WhatsApp Business Account from its Phone Number ID.",
          provider_status: phoneResponse.status,
          provider_error_code: phonePayload.error?.code ?? null,
          provider_error: phonePayload.error?.message ?? null,
        }, { status: phoneResponse.status >= 400 && phoneResponse.status < 500 ? 502 : 503 });
      }
      wabaId = derivedWabaId;
    }

    let nextUrl: URL | null = new URL(`https://graph.facebook.com/${graphVersion}/${wabaId}/message_templates`);
    nextUrl.searchParams.set("fields", "name,status,language,category,components");
    nextUrl.searchParams.set("limit", "100");
    const rawTemplates: MetaTemplate[] = [];
    let hasMore = false;
    let pageCount = 0;

    while (nextUrl && pageCount < 10) {
      const response = await fetch(nextUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({})) as MetaTemplatesResponse;
      if (!response.ok) {
        return NextResponse.json({
          error: "Meta could not return the WhatsApp template inventory.",
          provider_status: response.status,
          provider_error_code: payload.error?.code ?? null,
          provider_error: payload.error?.message ?? null,
        }, { status: response.status >= 400 && response.status < 500 ? 502 : 503 });
      }
      rawTemplates.push(...(payload.data || []));
      const next = payload.paging?.next;
      if (!next) {
        nextUrl = null;
      } else {
        const candidate = new URL(next);
        if (candidate.protocol !== "https:" || candidate.hostname !== "graph.facebook.com" || !candidate.pathname.includes(`/${wabaId}/message_templates`)) {
          throw new Error("Meta returned an unexpected pagination URL.");
        }
        nextUrl = candidate;
        hasMore = true;
      }
      pageCount += 1;
    }
    if (nextUrl) hasMore = true;

    const templates = rawTemplates.map((template) => {
      const componentTypes = (template.components || []).map((component) => String(component.type || "unknown"));
      const placeholders = placeholderIndexes(template);
      return {
        name: String(template.name || ""),
        status: String(template.status || "UNKNOWN"),
        language: String(template.language || ""),
        category: String(template.category || ""),
        components: componentTypes,
        placeholder_indexes: placeholders,
        placeholder_count: placeholders.length,
      };
    }).sort((a, b) => a.name.localeCompare(b.name) || a.language.localeCompare(b.language));

    return NextResponse.json({
      ok: true,
      organization: { id: organization.id, name: organization.name, slug: organization.slug },
      source: "meta_graph_api",
      graph_version: graphVersion,
      count: templates.length,
      templates,
      has_more: hasMore,
      note: "Only template metadata and placeholder indexes are returned. Access tokens and full template copy are never returned.",
    }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Xposure WhatsApp template inventory check failed.", error);
    return NextResponse.json({ error: "Unable to inspect Xposure's WhatsApp template inventory." }, { status: 500 });
  }
}
