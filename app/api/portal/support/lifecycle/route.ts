import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import {
  getSupportLifecycleCases,
  mergeSupportLifecycleMetadata,
  supportTargetHours,
  type SupportPriority,
  type SupportStatus,
} from "@/lib/support-lifecycle";

type ConversationRow = {
  id: string;
  organization_id: string | null;
  title: string;
  status: SupportStatus;
  priority: SupportPriority;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const ACTIONS = new Set(["request_escalation", "resolve", "reopen", "submit_feedback"]);

async function getCase(organizationId: string, id: string) {
  const rows = await supabaseServerRequest<ConversationRow[]>(
    `support_conversations?select=id,organization_id,title,status,priority,metadata,created_at&id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(organizationId)}&limit=1`,
  ).catch(() => []);
  return rows[0] || null;
}

export async function GET() {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const cases = await getSupportLifecycleCases(session.organizationId);
  return NextResponse.json({ ok: true, cases });
}

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const caseId = String(body.caseId || "").trim();
  const action = String(body.action || "").trim();
  if (!caseId || !ACTIONS.has(action)) return NextResponse.json({ error: "Unsupported support action." }, { status: 400 });

  const supportCase = await getCase(session.organizationId, caseId);
  if (!supportCase) return NextResponse.json({ error: "Support case not found in this workspace." }, { status: 404 });

  const now = new Date().toISOString();
  let status = supportCase.status;
  let metadata = supportCase.metadata || {};
  let auditAction = `support.${action}`;
  let reason = String(body.reason || "").trim().slice(0, 1000);

  if (action === "request_escalation") {
    metadata = mergeSupportLifecycleMetadata(metadata, {
      escalation_requested_at: now,
      escalation_requested_by: session.email,
      escalation_reason: reason || "Customer requested human review",
      escalation_required: true,
    });
    status = "waiting_approval";
  } else if (action === "resolve") {
    metadata = mergeSupportLifecycleMetadata(metadata, {
      resolved_by_customer_at: now,
      resolved_by_customer: session.email,
      escalation_required: false,
    });
    status = "resolved";
  } else if (action === "reopen") {
    const targetAt = new Date(Date.now() + supportTargetHours(supportCase.priority) * 60 * 60 * 1000).toISOString();
    metadata = mergeSupportLifecycleMetadata(metadata, {
      reopened_at: now,
      reopened_by: session.email,
      response_target_at: targetAt,
      escalation_required: false,
    });
    status = "open";
  } else if (action === "submit_feedback") {
    const score = Number(body.score || 0);
    const comment = String(body.comment || "").trim().slice(0, 1500);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return NextResponse.json({ error: "Feedback score must be between 1 and 5." }, { status: 400 });
    }
    metadata = mergeSupportLifecycleMetadata(metadata, {
      feedback_score: score,
      feedback_comment: comment || null,
      feedback_submitted_at: now,
      feedback_submitted_by: session.email,
    });
    reason = comment || `Customer support rating: ${score}/5`;
  }

  await supabaseServerRequest(
    `support_conversations?id=eq.${encodeURIComponent(caseId)}&organization_id=eq.${encodeURIComponent(session.organizationId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status, metadata, updated_at: now }),
    },
  );

  await supabaseServerRequest("audit_logs", {
    method: "POST",
    body: JSON.stringify({
      organization_id: session.organizationId,
      actor_user_id: session.userId,
      action: auditAction,
      resource_type: "support_conversation",
      resource_id: caseId,
      reason: reason || null,
      metadata: { previous_status: supportCase.status, next_status: status, role: session.role },
    }),
  }).catch(() => null);

  const cases = await getSupportLifecycleCases(session.organizationId);
  return NextResponse.json({ ok: true, cases });
}
