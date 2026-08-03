import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const organizationId = String(body.organizationId || "").trim();
    const planId = String(body.planId || "").trim();
    const status = String(body.status || "active").trim();
    const allowedStatuses = new Set(["pending", "trialing", "active", "past_due", "grace_period", "suspended", "cancelled"]);
    if (!organizationId || !planId || !allowedStatuses.has(status)) {
      return NextResponse.json({ error: "Organization, plan and a valid status are required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const [{ data: organization, error: organizationError }, { data: plan, error: planError }] = await Promise.all([
      admin.from("organizations").select("id,name").eq("id", organizationId).maybeSingle(),
      admin.from("billing_plans").select("id,name,status").eq("id", planId).eq("status", "active").maybeSingle(),
    ]);
    if (organizationError) throw organizationError;
    if (planError) throw planError;
    if (!organization) return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    if (!plan) return NextResponse.json({ error: "Active billing plan not found." }, { status: 404 });

    const { data: existing, error: existingError } = await admin
      .from("organization_subscriptions")
      .select("id")
      .eq("organization_id", organizationId)
      .in("status", ["pending", "trialing", "active", "past_due", "grace_period", "suspended"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    const payload = {
      organization_id: organizationId,
      plan_id: planId,
      provider: "manual",
      status,
      current_period_start: status === "active" ? new Date().toISOString() : null,
      current_period_end: null,
      metadata: { activated_by: session.email, activation_source: "phase_14_admin" },
      updated_at: new Date().toISOString(),
    };

    const result = existing
      ? await admin.from("organization_subscriptions").update(payload).eq("id", existing.id).select("id,status").single()
      : await admin.from("organization_subscriptions").insert(payload).select("id,status").single();
    if (result.error) throw result.error;

    return NextResponse.json({ ok: true, subscription: result.data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update subscription." }, { status: 500 });
  }
}
