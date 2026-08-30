import { NextRequest, NextResponse } from "next/server";
import { parseLeoN8nWebhook } from "@/lib/leo-n8n";
import { loadLeoRuntimeConfiguration } from "@/lib/leo-runtime-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const config = loadLeoRuntimeConfiguration();
    const secret = config.n8n.signingSecret;
    if (!config.n8n.enabled || !secret) {
      return NextResponse.json({ error: "n8n callback infrastructure is not configured." }, { status: 503 });
    }

    const timestamp = request.headers.get("x-fluxknight-timestamp") || "";
    const signature = request.headers.get("x-fluxknight-signature") || "";
    const rawBody = await request.text();
    const event = parseLeoN8nWebhook({ rawBody, timestamp, signature, secret });

    return NextResponse.json(
      { ok: true, accepted: true, executionId: event.executionId, type: event.type },
      { status: 202, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid n8n callback." }, { status: 401 });
  }
}
