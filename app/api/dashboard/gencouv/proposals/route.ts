import { NextResponse } from "next/server";
import { requireGencouvAdmin, gencouvError, gencouvPrivateHeaders } from "@/lib/gencouv-admin";
import { sendGencouvBatch } from "@/lib/gencouv-send";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const { db, organizationId, session } = await requireGencouvAdmin(request);
    const input = await request.json().catch(() => null);
    const result = await sendGencouvBatch(db, organizationId, session.email, { ...(input || {}), mode: "proposal" });
    return NextResponse.json(result, { status: result.replayed ? 200 : 201, headers: gencouvPrivateHeaders });
  } catch (error) { const safe = gencouvError(error); return NextResponse.json({ error: safe.message }, { status: safe.status, headers: gencouvPrivateHeaders }); }
}
