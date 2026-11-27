import { NextResponse } from "next/server";
import { requireGencouvAdmin, gencouvError, gencouvPrivateHeaders } from "@/lib/gencouv-admin";
import { readGencouvBrevoReadiness } from "@/lib/gencouv-brevo-readiness";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const {db,organizationId}=await requireGencouvAdmin(request);
    const readiness = await readGencouvBrevoReadiness(db, organizationId);
    return NextResponse.json(readiness, { headers: gencouvPrivateHeaders });
  } catch (error) {
    const safe = gencouvError(error);
    return NextResponse.json({ error: safe.message }, {status: safe.status, headers: gencouvPrivateHeaders});
  }
}
