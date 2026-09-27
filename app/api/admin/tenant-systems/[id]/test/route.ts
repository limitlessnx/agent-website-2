import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { testTenantSystem } from "@/lib/tenant-system-management";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const { id } = await context.params;
    const result = await testTenantSystem(id);
    return NextResponse.json({ ok: result.passed, result }, { status: result.passed ? 200 : 409 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to test tenant system." },
      { status: 409 },
    );
  }
}
