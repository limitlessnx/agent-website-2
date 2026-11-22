import { NextResponse } from "next/server";
import { requireGencouvAdmin, gencouvError, gencouvPrivateHeaders } from "@/lib/gencouv-admin";
import { sendGencouvBatch, type GencouvSendInput } from "@/lib/gencouv-send";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const { db, organizationId, session } = await requireGencouvAdmin(request);
    const input = await request.json().catch(() => null);
    if (!input || input.mode !== "one_time") return NextResponse.json({ error: "A reviewed one-time send is required." }, { status: 400, headers: gencouvPrivateHeaders });
    const result = await sendGencouvBatch(db, organizationId, session.email, input as GencouvSendInput);
    return NextResponse.json(result, { status: result.replayed ? 200 : 201, headers: gencouvPrivateHeaders });
  } catch (error) { const safe = gencouvError(error); return NextResponse.json({ error: safe.message }, { status: safe.status, headers: gencouvPrivateHeaders }); }
}
