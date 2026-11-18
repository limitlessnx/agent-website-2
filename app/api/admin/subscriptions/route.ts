import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { BASIC_FREE_TRIAL_CREDITS, BASIC_FREE_TRIAL_DAYS, ensureFluxWallet } from "@/lib/flux-credits";
import { getFluxPlanDefinition } from "@/lib/fluxknight-plans";
import { isOrganizationId } from "@/lib/organization-context-catalog";
import { isSameOriginAdminRequest } from "@/lib/admin-request-origin";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const organizationId = new URL(request.url).searchParams.get("organizationId");
  if (!isOrganizationId(organizationId)) return NextResponse.json({ error: "Invalid organization." }, { status: 400 });
  try {
    const admin = createAdminClient();
    const [organization, plans, subscription] = await Promise.all([
      admin.from("organizations").select("id,status").eq("id", organizationId!).maybeSingle(),
      admin.from("billing_plans").select("id,name").eq("status", "active").order("name"),
      admin.from("organization_subscriptions").select("plan_id,status").eq("organization_id", organizationId!).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (organization.error || plans.error || subscription.error) throw new Error("Unavailable");
    if (!organization.data) return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    return NextResponse.json({ plans: plans.data || [], subscription: subscription.data, organizationStatus: organization.data.status });
  } catch { return NextResponse.json({ error: "Plan options are unavailable. Try again." }, { status: 503 }); }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    if (!isSameOriginAdminRequest(request)) return NextResponse.json({ error: "Same-origin request required." }, { status: 403 });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const organizationId = String(body.organizationId || "").trim();
    const planId = String(body.planId || "").trim();
    const status = String(body.status || "active").trim();
    const allowedStatuses = new Set(["pending", "trialing", "active", "past_due", "grace_period", "suspended", "cancelled"]);
    if (!isOrganizationId(organizationId) || !planId || !allowedStatuses.has(status)) {
      return NextResponse.json({ error: "Organization, plan and a valid status are required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const [{ data: organization, error: organizationError }, { data: plan, error: planError }] = await Promise.all([
      admin.from("organizations").select("id,name,status").eq("id", organizationId).maybeSingle(),
      admin.from("billing_plans").select("id,name,slug,status,metadata").eq("id", planId).eq("status", "active").maybeSingle(),
    ]);
    if (organizationError) throw organizationError;
    if (planError) throw planError;
    if (!organization) return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    if (organization.status === "archived") return NextResponse.json({ error: "Archived organizations cannot be upgraded." }, { status: 409 });
    if (!plan) return NextResponse.json({ error: "Active billing plan not found." }, { status: 404 });

    const fluxPlan = getFluxPlanDefinition(
      String((plan.metadata as Record<string, unknown> | null)?.plan_code || plan.slug || plan.name || "basic"),
    );
    const requestedCredits = Number(body.monthlyCredits || (plan.metadata as Record<string, unknown> | null)?.monthly_credits || fluxPlan.monthlyCredits);
    const monthlyCredits = fluxPlan.configurableMonthlyCredits && Number.isFinite(requestedCredits)
      ? Math.max(25000, requestedCredits)
      : fluxPlan.monthlyCredits;
    const now = new Date();
    const trialEndsAt = status === "trialing" ? new Date(now.getTime() + BASIC_FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString() : null;

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
      current_period_start: status === "active" || status === "trialing" ? now.toISOString() : null,
      current_period_end: status === "active" ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() : trialEndsAt,
      trial_ends_at: trialEndsAt,
      metadata: {
        activated_by: session.email,
        activation_source: "phase_14_admin",
        plan_code: fluxPlan.code,
        monthly_credits: status === "trialing" ? BASIC_FREE_TRIAL_CREDITS : monthlyCredits,
        trial_credit_limit: status === "trialing" ? BASIC_FREE_TRIAL_CREDITS : null,
      },
      updated_at: now.toISOString(),
    };

    const auditId = randomUUID();
    const auditMetadata = { actor_email: session.email, auth_mode: session.authMode || "legacy", plan_id: planId, status, outcome: "requested", provider: "manual" };
    const audit = await admin.from("audit_logs").insert({ id: auditId, organization_id: organizationId, actor_user_id: session.authMode === "account" ? session.userId : null, action: "admin.subscription.assign", resource_type: "organization", resource_id: organizationId, metadata: auditMetadata });
    if (audit.error) return NextResponse.json({ error: "Plan change could not be logged. No plan was changed." }, { status: 503 });
    const result = existing
      ? await admin.from("organization_subscriptions").update(payload).eq("id", existing.id).eq("organization_id", organizationId).select("id,status").single()
      : await admin.from("organization_subscriptions").insert(payload).select("id,status").single();
    if (result.error) {
      try { await admin.from("audit_logs").update({ metadata: { ...auditMetadata, outcome: "unconfirmed" } }).eq("id", auditId).eq("organization_id", organizationId); } catch { /* Intent is retained for reconciliation. */ }
      throw result.error;
    }

    let warning = "";
    try { await ensureFluxWallet(organizationId); }
    catch { warning = "Plan saved, but wallet synchronization could not be confirmed. Review credits before retrying."; }
    try {
      const completion = await admin.from("audit_logs").update({ metadata: { ...auditMetadata, outcome: warning ? "plan_saved_wallet_unconfirmed" : "saved" } }).eq("id", auditId).eq("organization_id", organizationId);
      if (completion.error) warning = warning || "Plan saved; final audit outcome needs review.";
    } catch { warning = warning || "Plan saved; final audit outcome needs review."; }
    return NextResponse.json({ ok: true, subscription: result.data, ...(warning ? { warning } : {}) });
  } catch {
    return NextResponse.json({ error: "Unable to confirm the plan change. Refresh billing before retrying." }, { status: 503 });
  }
}
