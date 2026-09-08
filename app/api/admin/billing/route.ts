import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { adjustFluxCredits, getFluxInternalUsageSummary } from "@/lib/flux-credits";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim();
    const admin = createAdminClient();
    const { data: organizations, error } = await admin
      .from("organizations")
      .select("id,name,slug,status")
      .order("name", { ascending: true })
      .limit(200);
    if (error) throw error;

    const targets = organizationId
      ? (organizations || []).filter((organization) => organization.id === organizationId)
      : (organizations || []).filter((organization) => organization.status === "active").slice(0, 50);

    const summaries = await Promise.all(targets.map((organization) => getFluxInternalUsageSummary(organization.id).then((summary) => ({
      organization,
      usage: summary,
    }))));

    return NextResponse.json({ organizations: organizations || [], summaries });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load billing usage." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const organizationId = String(body.organizationId || "").trim();
    const amount = Number(body.amount || 0);
    const reason = String(body.reason || "").trim();
    const type = String(body.type || "adjustment").trim();

    if (!organizationId || !Number.isFinite(amount) || !Number.isInteger(amount) || amount === 0 || !reason) {
      return NextResponse.json({ error: "Organization, non-zero integer credits, and reason are required." }, { status: 400 });
    }
    if (!["bonus", "top_up", "adjustment"].includes(type)) {
      return NextResponse.json({ error: "Adjustment type must be bonus, top_up, or adjustment." }, { status: 400 });
    }

    const wallet = await adjustFluxCredits({
      organizationId,
      amount,
      reason,
      adminEmail: session.email,
      type: type as "bonus" | "top_up" | "adjustment",
    });

    return NextResponse.json({ ok: true, wallet });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to adjust credits." }, { status: 500 });
  }
}
