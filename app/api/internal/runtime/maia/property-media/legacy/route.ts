import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecretFromHeaders } from "@/lib/runtime/auth";
import {
  getLegacyMaiaPropertyMedia,
  searchLegacyMaiaProperties,
  sendLegacyMaiaPropertyMedia,
} from "@/lib/ai/maia-legacy-property-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    assertRuntimeSecretFromHeaders(request.headers);
    const body = record(await request.json().catch(() => ({})));
    const operation = text(body.operation).toLowerCase();
    const organizationId = text(body.organization_id);

    if (!operation || !organizationId) {
      return NextResponse.json({ error: "operation and organization_id are required." }, { status: 400 });
    }

    if (operation === "search_properties") {
      const result = await searchLegacyMaiaProperties({
        organizationId,
        query: text(body.query),
        limit: Number(body.limit || 8),
      });
      return NextResponse.json({ ok: true, operation, ...result });
    }

    if (operation === "get_property_media") {
      const result = await getLegacyMaiaPropertyMedia({
        organizationId,
        propertyId: text(body.property_id),
        mediaType: text(body.media_type) || "any",
        limit: Number(body.limit || 12),
      });
      return NextResponse.json({ ok: true, operation, ...result });
    }

    if (operation === "send_property_media") {
      const result = await sendLegacyMaiaPropertyMedia({
        organizationId,
        leadId: text(body.lead_id),
        assetId: text(body.asset_id),
      });
      return NextResponse.json({ ok: true, operation, result });
    }

    return NextResponse.json({ error: "Unsupported property media operation." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Legacy Maia property media request failed.";
    const status = message === "Unauthorized." ? 401 : 500;
    console.error("maia_legacy_property_media_failed", { error: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
