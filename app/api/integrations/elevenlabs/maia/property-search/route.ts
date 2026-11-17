import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIMITLESS_REALTY_ORGANIZATION_ID } from "@/lib/limitless-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Private ElevenLabs Maia pilot tool. Deliberately has no CRM writes,
 * booking actions, message sends, or configurable organization input.
 * Disabled unless its dedicated, high-entropy server-side secret is set.
 */
function authorized(request: NextRequest) {
  const secret = process.env.ELEVENLABS_MAIA_TOOL_SECRET?.trim();
  if (!secret || secret.length < 32) return false;
  const supplied = request.headers.get("authorization") || "";
  // ElevenLabs may send a workspace Secret as the full Authorization value.
  // Support both that raw value and the standard Bearer scheme during this pilot.
  const token = supplied.startsWith("Bearer ") ? supplied.slice("Bearer ".length) : supplied;
  const expected = Buffer.from(secret);
  const received = Buffer.from(token);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

const responseHeaders = { "Cache-Control": "no-store" };
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";

export async function POST(request: NextRequest) {
  const configured = (process.env.ELEVENLABS_MAIA_TOOL_SECRET || "").trim();
  if (configured.length < 32) {
    return NextResponse.json({ error: "voice_tool_not_configured" }, { status: 503, headers: responseHeaders });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: responseHeaders });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || Array.isArray(body) || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: responseHeaders });
  }
  const query = clean(body.query).slice(0, 120);
  if (query.length < 2 || !/^[\p{L}\p{N} -]+$/u.test(query)) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400, headers: responseHeaders });
  }

  const limit = Math.min(5, Math.max(1, Number.isFinite(Number(body.limit)) ? Math.floor(Number(body.limit)) : 3));
  const admin = createAdminClient();
  try {
    const { data, error } = await admin
      .from("properties")
      .select("id,title,type,location_city,location_area,price,status,description,updated_at")
      .eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID)
      .in("status", ["active", "available", "published"])
      .or(`title.ilike.%${query}%,location_city.ilike.%${query}%,location_area.ilike.%${query}%,type.ilike.%${query}%`)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw error;
    return NextResponse.json({
      verified: true,
      matching_properties: (data || []).map((p) => ({
        id: p.id,
        title: p.title,
        type: p.type,
        location_city: p.location_city,
        location_area: p.location_area,
        price: p.price,
        status: p.status,
        description: typeof p.description === "string" ? p.description.slice(0, 500) : null,
        catalog_updated_at: p.updated_at,
      })),
      caveat: "Catalog data is subject to seller confirmation. This endpoint does not reserve or book properties.",
    }, { headers: responseHeaders });
  } catch (error) {
    console.error("[maia-elevenlabs-voice-pilot] property lookup failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "catalog_temporarily_unavailable" }, { status: 503, headers: responseHeaders });
  }
}
