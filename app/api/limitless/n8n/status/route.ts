import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { requireAutomationApiKey } from "@/lib/limitless-api-auth";
import { getN8nStatus } from "@/lib/limitless-data";

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  const apiAuth = requireAutomationApiKey(request);
  if (!session && !apiAuth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const status = await getN8nStatus();
  return NextResponse.json(status);
}
