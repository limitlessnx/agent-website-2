import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { inspectAndRepairMaiaCommandPath } from "@/lib/maia-command-diagnostics";

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const marker = request.nextUrl.searchParams.get("marker") || "TRACE-MAIA-7421";
    const report = await inspectAndRepairMaiaCommandPath(marker);
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to inspect Maia command routing.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const marker = typeof body.marker === "string" && body.marker.trim() ? body.marker.trim() : "TRACE-MAIA-7421";
    const report = await inspectAndRepairMaiaCommandPath(marker);
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to repair Maia command routing.",
      },
      { status: 500 },
    );
  }
}
