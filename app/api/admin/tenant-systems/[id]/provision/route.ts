import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { provisionTenantSystem } from "@/lib/tenant-system-provisioning";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const { id } = await context.params;
    const result = await provisionTenantSystem(id, null);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to provision this tenant system.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
