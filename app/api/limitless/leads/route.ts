import { NextRequest, NextResponse } from "next/server";
import { getLimitlessCrmLeads, createLimitlessCrmLead } from "@/lib/limitless-crm-leads";
import { getAdminSession } from "@/lib/admin-auth";
import { requireAutomationApiKey } from "@/lib/limitless-api-auth";

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  const apiAuth = requireAutomationApiKey(request);
  if (!session && !apiAuth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const leads = await getLimitlessCrmLeads();
    return NextResponse.json({ leads, source: "crm" }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Limitless CRM leads." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  const apiAuth = requireAutomationApiKey(request);
  if (!session && !apiAuth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const payload = await request.json();
    const result = await createLimitlessCrmLead(payload);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save Limitless CRM lead." }, { status: 500 });
  }
}
