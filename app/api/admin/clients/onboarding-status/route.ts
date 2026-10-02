import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedStatuses = new Set(["submitted", "configuration", "testing", "awaiting_approval", "live", "paused"]);

export async function PATCH(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "").trim();
    const status = String(body.status || "").trim();
    if (!id) return NextResponse.json({ error: "Onboarding record ID is required." }, { status: 400 });
    if (!allowedStatuses.has(status)) return NextResponse.json({ error: "Invalid onboarding status." }, { status: 400 });

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("client_onboarding_profiles")
      .select("id,organization_id,status")
      .eq("id", id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return NextResponse.json({ error: "Onboarding record was not found." }, { status: 404 });

    if (status === "live") {
      const [{ data: agents, error: agentsError }, { data: readiness, error: readinessError }, { data: models, error: modelsError }] = await Promise.all([
        admin.from("agents").select("id,system_prompt").eq("organization_id", profile.organization_id),
        admin.from("agent_runtime_readiness").select("agent_id,readiness_score,business_profile_ready,prompt_ready,knowledge_ready,integrations_ready,test_ready,approval_ready,workflow_ready").eq("organization_id", profile.organization_id),
        admin.from("organization_ai_model_assignments").select("model_id").eq("organization_id", profile.organization_id),
      ]);
      if (agentsError) throw agentsError;
      if (readinessError) throw readinessError;
      if (modelsError) throw modelsError;

      const agentRows = agents || [];
      const readinessByAgent = new Map((readiness || []).map((row) => [String(row.agent_id), row]));
      const ready = agentRows.length > 0
        && (models || []).length > 0
        && agentRows.every((agent) => {
          const snapshot = readinessByAgent.get(String(agent.id));
          return Boolean(
            String(agent.system_prompt || "").trim()
            && snapshot
            && Number(snapshot.readiness_score || 0) >= 100
            && snapshot.business_profile_ready
            && snapshot.prompt_ready
            && snapshot.knowledge_ready
            && snapshot.integrations_ready
            && snapshot.test_ready
            && snapshot.approval_ready
            && snapshot.workflow_ready
          );
        });
      if (!ready) {
        return NextResponse.json({ error: "Launch blocked. Every agent needs a configured prompt, assigned model and 100% runtime readiness before the tenant can go live." }, { status: 409 });
      }
    }

    const { data: updated, error } = await admin
      .from("client_onboarding_profiles")
      .update({ status })
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .select("id,status")
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, profile: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update onboarding status." }, { status: 400 });
  }
}
