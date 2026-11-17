import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getTenantReadiness } from "@/lib/tenant-readiness-server";

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { organizationId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organizationId)) return NextResponse.json({ error: "Invalid organization." }, { status: 400 });
  try { return NextResponse.json(await getTenantReadiness(organizationId)); }
  catch { return NextResponse.json({ error: "Readiness evidence could not be loaded. Refresh setup." }, { status: 503 }); }
}
