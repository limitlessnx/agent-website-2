import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { LIMITLESS_REALTY_ORGANIZATION_ID } from "@/lib/limitless-data";
import { maiaEstateTools } from "@/lib/ai/maia-estate-tools";
import { maiaPropertyTools } from "@/lib/ai/maia-property-tools";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Pilot-only voice tools for ElevenLabs.
 *
 * Never trust an LLM-supplied organization, agent ID, or phone number.
 * Auth is provided through an out-of-band shared secret, never as a query
 * parameter. Missing configuration fails closed and does not affect WhatsApp.
 */
function authorized(request: NextRequest) {
  const configured = process.env.MAIA_ELEVENLABS_TOOL_TOKEN?.trim() || "";
  if (configured.length < 32) return false;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  if (!token || token.length !== configured.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(configured));
}

const SAFE_TOOLS = new Set(["search_properties", "search_estates", "get_estate_knowledge"]);

function safeParameters(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const args = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of ["query", "estateId", "propertyId"]) {
    if (typeof args[key] === "string") result[key] = args[key].slice(0, 160).trim();
  }
  if (typeof args.limit === "number" && Number.isInteger(args.limit)) {
    result.limit = Math.max(1, Math.min(args.limit, 8));
  }
  return result;
}

export async function POST(request: NextRequest) {
  if (!process.env.MAIA_ELEVENLABS_TOOL_TOKEN || process.env.MAIA_ELEVENLABS_TOOL_TOKEN.trim().length < 32) {
    return NextResponse.json({ error: "Voice pilot tools are not configured." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  if (Number(request.headers.get("content-length") || 0) > 4096) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }
  let body: { tool?: unknown; parameters?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const toolName = typeof body?.tool === "string" ? body.tool : "";
  if (!SAFE_TOOLS.has(toolName)) {
    return NextResponse.json({ error: "Tool not allowed." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: agent, error: agentError } = await admin.from("agents")
      .select("id").eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID)
      .eq("slug", "maia").eq("status", "published").maybeSingle();
    if (agentError || !agent?.id) {
      return NextResponse.json({ error: "Maia voice pilot is unavailable." }, { status: 503 });
    }
    const definition = [...maiaPropertyTools(), ...maiaEstateTools()].find((tool) => tool.name === toolName);
    if (!definition) {
      return NextResponse.json({ error: "Tool unavailable." }, { status: 503 });
    }
    const result = await definition.execute(safeParameters(body.parameters), {
      organizationId: LIMITLESS_REALTY_ORGANIZATION_ID,
      agentId: agent.id,
      sessionId: "elevenlabs-voice-pilot",
    });
    return NextResponse.json({ ok: true, result }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("[maia-elevenlabs-voice-pilot] read-only tool error", {
      toolName,
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "Property lookup temporarily unavailable." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

// No GET handler, write tools, public credentials, or tenant-controlled routing.
