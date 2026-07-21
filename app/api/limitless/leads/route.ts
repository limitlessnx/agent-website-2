import { NextRequest, NextResponse } from "next/server";
import { createLead, getLeads } from "@/lib/limitless-data";
import { getAdminSession } from "@/lib/admin-auth";
import { requireAutomationApiKey } from "@/lib/limitless-api-auth";

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  const apiAuth = requireAutomationApiKey(request);
  if (!session && !apiAuth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const leads = await getLeads();
  return NextResponse.json({ leads });
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  const apiAuth = requireAutomationApiKey(request);
  if (!session && !apiAuth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await request.json();
  const lead = await createLead(payload);
  return NextResponse.json({ lead });
}
