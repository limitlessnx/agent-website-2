import { NextRequest, NextResponse } from "next/server";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LeadPayload = { name?: unknown; email?: unknown; phone?: unknown; organization?: unknown };

function clean(value: unknown, max = 180) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as LeadPayload;
    const name = clean(body.name);
    const email = clean(body.email, 240).toLowerCase();
    const phone = clean(body.phone, 80);
    const organization = clean(body.organization);
    if (!name || !email || !phone || !organization) return NextResponse.json({ error: "Name, email, phone and organization are required." }, { status: 400 });
    if (!validEmail(email)) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });

    const now = new Date().toISOString();
    const rows = await supabaseServerRequest<Array<{ id: string }>>("evaluation_leads", {
      method: "POST",
      body: JSON.stringify({
        name, email, phone, business_name: organization, business_type: "Not specified", agent_types: [],
        main_goal: "Public Leo consultation", current_tools: null,
        lead_volume: "Not discussed", timeline: "Not discussed", budget: "Not discussed",
        preferred_contact_time: null, consent_given: false, source: "public_leo", status: "new", submitted_at: now,
      }),
    });
    return NextResponse.json({ ok: true, leadId: rows[0]?.id || null, capturedAt: now });
  } catch (error) {
    console.error("[Leo Lead Capture]", error);
    return NextResponse.json({ error: "Leo could not save your details. Please try again." }, { status: 500 });
  }
}
