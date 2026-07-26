import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createOnboardingAccessToken, hashOnboardingAccessToken } from "@/lib/onboarding-access";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

const deploymentTasks = [
  ["create_organization", "Create organization"],
  ["assign_package", "Assign purchased package"],
  ["assign_ai_model", "Assign approved AI model"],
  ["enable_modules", "Enable package modules"],
  ["configure_agent", "Configure AI agent"],
  ["prepare_knowledge", "Prepare knowledge base"],
  ["connect_integrations", "Connect required integrations"],
  ["internal_testing", "Complete internal testing"],
  ["activate_workspace", "Activate client workspace"],
] as const;

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized.");
  return session;
}

export async function GET() {
  try {
    await requireAdmin();
    const submissions = await supabaseServerRequest(
      "client_onboarding_submissions?select=*,service_packages(id,name,slug,currency,billing_interval),organizations(id,name,slug,status)&order=created_at.desc",
    );
    return NextResponse.json({ submissions });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load onboarding queue." }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "create_invitation") {
      const purchaserEmail = String(body.purchaserEmail || "").trim().toLowerCase();
      const packageId = String(body.packageId || "").trim();
      const paymentProvider = String(body.paymentProvider || "manual").trim();
      const paymentReference = String(body.paymentReference || "").trim();
      if (!purchaserEmail || !packageId) {
        return NextResponse.json({ error: "Purchaser email and package are required." }, { status: 400 });
      }

      const token = createOnboardingAccessToken();
      const rows = await supabaseServerRequest<Array<{ id: string }>>("client_onboarding_submissions", {
        method: "POST",
        body: JSON.stringify({
          purchaser_email: purchaserEmail,
          package_id: packageId,
          payment_provider: paymentProvider,
          payment_reference: paymentReference || null,
          payment_status: "paid",
          payment_confirmed_at: new Date().toISOString(),
          access_token_hash: hashOnboardingAccessToken(token),
          status: "payment_received",
          created_by: session.email || null,
        }),
      });

      const onboardingId = rows[0]?.id;
      if (!onboardingId) throw new Error("Onboarding invitation could not be created.");

      await supabaseServerRequest("organization_deployment_tasks", {
        method: "POST",
        body: JSON.stringify(deploymentTasks.map(([task_key, title]) => ({ onboarding_id: onboardingId, task_key, title }))),
      });

      return NextResponse.json({ ok: true, onboardingId, accessToken: token });
    }

    if (action === "link_organization") {
      const onboardingId = String(body.onboardingId || "").trim();
      const organizationId = String(body.organizationId || "").trim();
      if (!onboardingId || !organizationId) {
        return NextResponse.json({ error: "Onboarding record and organization are required." }, { status: 400 });
      }

      const result = await supabaseServerRequest(
        `client_onboarding_submissions?id=eq.${encodeURIComponent(onboardingId)}`,
        { method: "PATCH", body: JSON.stringify({ organization_id: organizationId, updated_at: new Date().toISOString() }) },
      );
      await supabaseServerRequest(
        `organization_deployment_tasks?onboarding_id=eq.${encodeURIComponent(onboardingId)}`,
        { method: "PATCH", body: JSON.stringify({ organization_id: organizationId, updated_at: new Date().toISOString() }) },
      );
      return NextResponse.json({ ok: true, result });
    }

    if (action === "update_status") {
      const onboardingId = String(body.onboardingId || "").trim();
      const status = String(body.status || "").trim();
      const allowed = ["under_review", "provisioning", "internal_testing", "live", "maintenance", "suspended", "cancelled"];
      if (!onboardingId || !allowed.includes(status)) {
        return NextResponse.json({ error: "A valid onboarding record and status are required." }, { status: 400 });
      }

      const current = await supabaseServerRequest<Array<{ status: string }>>(
        `client_onboarding_submissions?select=status&id=eq.${encodeURIComponent(onboardingId)}&limit=1`,
      );
      const previous = current[0]?.status || null;
      const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === "under_review") patch.reviewed_at = new Date().toISOString();
      if (status === "live") patch.activated_at = new Date().toISOString();

      const result = await supabaseServerRequest(
        `client_onboarding_submissions?id=eq.${encodeURIComponent(onboardingId)}`,
        { method: "PATCH", body: JSON.stringify(patch) },
      );
      await supabaseServerRequest("client_onboarding_status_events", {
        method: "POST",
        body: JSON.stringify({ onboarding_id: onboardingId, from_status: previous, to_status: status, reason: body.reason || null, changed_by: session.email || null }),
      });
      return NextResponse.json({ ok: true, result });
    }

    if (action === "add_note") {
      const onboardingId = String(body.onboardingId || "").trim();
      const note = String(body.note || "").trim();
      if (!onboardingId || !note) return NextResponse.json({ error: "Onboarding record and note are required." }, { status: 400 });
      const result = await supabaseServerRequest("client_onboarding_notes", {
        method: "POST",
        body: JSON.stringify({ onboarding_id: onboardingId, note, visibility: body.visibility === "client" ? "client" : "internal", author_email: session.email || null }),
      });
      return NextResponse.json({ ok: true, result });
    }

    if (action === "update_task") {
      const taskId = String(body.taskId || "").trim();
      const status = String(body.status || "").trim();
      if (!taskId || !["pending", "in_progress", "blocked", "completed", "skipped"].includes(status)) {
        return NextResponse.json({ error: "A valid deployment task and status are required." }, { status: 400 });
      }
      const result = await supabaseServerRequest(`organization_deployment_tasks?id=eq.${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status, completed_at: status === "completed" ? new Date().toISOString() : null, completed_by: status === "completed" ? session.email || null : null, updated_at: new Date().toISOString() }),
      });
      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update onboarding.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 400 });
  }
}
