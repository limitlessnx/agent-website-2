import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecret } from "@/lib/runtime/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeSequenceStepDueAt, resolveFollowUpPolicy, text } from "@/lib/follow-up-policy";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function POST(request: NextRequest) {
  try {
    assertRuntimeSecret(request.headers.get("x-runtime-secret"));
    const body = record(await request.json().catch(() => ({})));
    const organizationId = text(body.organization_id);
    const agentId = text(body.agent_id);
    const customerId = text(body.customer_id);
    const leadId = text(body.lead_id);
    const taskId = text(body.task_id);
    const decision = record(body.decision);
    const currentStep = Math.max(1, Number(body.sequence_step) || 1);
    if (!organizationId || !agentId || !customerId) {
      return NextResponse.json({ error: "Missing tenant follow-up advancement fields." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const sourceTask = taskId
      ? await supabase.from("crm_tasks").select("*").eq("id", taskId).eq("organization_id", organizationId).maybeSingle()
      : { data: null, error: null };
    if (sourceTask.error) throw sourceTask.error;
    const sourceMeta = record(sourceTask.data?.metadata);
    const policy = body.policy && typeof body.policy === "object"
      ? body.policy as any
      : await resolveFollowUpPolicy(organizationId, text(sourceMeta.organization_key) || null);
    const sequence = Array.isArray(policy.sequence) ? policy.sequence : [];
    const action = text(decision.action) || "skip";
    const now = new Date().toISOString();
    const shouldStop = Boolean(decision.stop_sequence) || ["close", "handoff"].includes(action);

    if (taskId && sourceTask.data) {
      const updatedSource = await supabase.from("crm_tasks").update({
        status: shouldStop || action === "skip" ? "cancelled" : "completed",
        metadata: { ...sourceMeta, completed_at: now, completed_action: action, completed_step: currentStep },
        updated_at: now,
      }).eq("id", taskId).eq("organization_id", organizationId);
      if (updatedSource.error) throw updatedSource.error;
    }

    let nextTask: Record<string, unknown> | null = null;
    const nextStep = currentStep + 1;
    const nextConfig = sequence.find((entry: Record<string, unknown>) => Number(entry.step) === nextStep);
    if (!shouldStop && action === "send" && nextConfig) {
      if (taskId) {
        const existing = await supabase
          .from("crm_tasks")
          .select("id,status,due_at,metadata")
          .eq("organization_id", organizationId)
          .eq("customer_id", customerId)
          .eq("task_type", "sales_follow_up")
          .contains("metadata", { previous_task_id: taskId, sequence_step: nextStep })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (existing.error) throw existing.error;
        if (existing.data) nextTask = existing.data as Record<string, unknown>;
      }

      if (!nextTask) {
        const anchor = text(sourceMeta.sequence_anchor_at) || text(sourceTask.data?.due_at) || now;
        const dueAt = computeSequenceStepDueAt(policy, anchor, nextStep);
        if (dueAt) {
          const inserted = await supabase.from("crm_tasks").insert({
            organization_id: organizationId,
            customer_id: customerId,
            lead_id: leadId || null,
            assigned_agent_id: agentId,
            task_type: "sales_follow_up",
            title: `CRM follow-up step ${nextStep}`,
            description: text(nextConfig.purpose) || "Tenant follow-up sequence",
            status: "scheduled",
            due_at: dueAt,
            metadata: {
              ...sourceMeta,
              workflow_key: "crm_follow_up_v3",
              sequence_step: nextStep,
              sequence_anchor_at: anchor,
              previous_task_id: taskId || null,
              previous_execution_id: text(body.execution_id) || null,
            },
          }).select("id,status,due_at,metadata").single();
          if (inserted.error) throw inserted.error;
          nextTask = inserted.data as Record<string, unknown>;
        }
      }
    }

    return NextResponse.json({
      ...body,
      sequence_step: currentStep,
      sequence_completed: shouldStop || !nextConfig,
      next_sequence_step: nextTask ? nextStep : null,
      next_follow_up_task: nextTask,
      reschedule_action: nextTask,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to advance tenant follow-up sequence.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 500 });
  }
}
