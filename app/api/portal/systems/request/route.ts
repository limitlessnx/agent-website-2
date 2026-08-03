import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getMarketplaceSystem, requestOrganizationSystem } from "@/lib/client-systems";

export async function POST(request: NextRequest) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const slug = String(body.slug || "").trim();
    if (!slug) return NextResponse.json({ error: "System is required." }, { status: 400 });

    const system = await getMarketplaceSystem(slug);
    if (!system || system.status !== "available") {
      return NextResponse.json({ error: "This system is not currently available." }, { status: 409 });
    }

    const installation = await requestOrganizationSystem(session.organizationId, session.userId, system.id);
    return NextResponse.json({ ok: true, installation, message: `${system.name} was added to your organization.` });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to add this system." },
      { status: 500 },
    );
  }
}
