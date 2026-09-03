import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { getAccountAdministrationSnapshot } from "@/lib/account-administration";

const OWNER_ROLES = new Set(["owner"]);
const ALLOWED_ACTIONS = new Set([
  "suspend_workspace",
  "reactivate_workspace",
  "request_cancellation",
  "revoke_cancellation",
  "request_ownership_transfer",
]);

function lifecycleMetadata(metadata: Record<string, unknown>) {
  const value = metadata.account_lifecycle;
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

export async function GET() {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const snapshot = await getAccountAdministrationSnapshot(session.organizationId);
  if (!snapshot) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  return NextResponse.json(snapshot);
}

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!OWNER_ROLES.has(session.role)) return NextResponse.json({ error: "Owner access required" }, { status: 403 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action || "");
  if (!ALLOWED_ACTIONS.has(action)) return NextResponse.json({ error: "Unsupported account action" }, { status: 400 });
  if (body.confirm !== true) return NextResponse.json({ error: "Explicit confirmation required" }, { status: 400 });

  const rows = await supabaseServerRequest<Array<{ id: string; status: string; metadata: Record<string, unknown> | null }>>(
    `organizations?id=eq.${encodeURIComponent(session.organizationId)}&select=id,status,metadata&limit=1`,
  );
  const organization = rows[0];
  if (!organization) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  const now = new Date().toISOString();
  const metadata = { ...(organization.metadata || {}) };
  const lifecycle = lifecycleMetadata(metadata);
  let nextStatus = organization.status;
  let reason = String(body.reason || "").trim().slice(0, 1000);

  if (action === "suspend_workspace") {
    nextStatus = "suspended";
  } else if (action === "reactivate_workspace") {
    nextStatus = "active";
    lifecycle.cancellation_requested_at = undefined;
    lifecycle.cancellation_reason = undefined;
    lifecycle.cancellation_requested_by = undefined;
  } else if (action === "request_cancellation") {
    lifecycle.cancellation_requested_at = now;
    lifecycle.cancellation_reason = reason || "No reason provided";
    lifecycle.cancellation_requested_by = session.email;
  } else if (action === "revoke_cancellation") {
    lifecycle.cancellation_requested_at = undefined;
    lifecycle.cancellation_reason = undefined;
    lifecycle.cancellation_requested_by = undefined;
  } else if (action === "request_ownership_transfer") {
    const targetEmail = String(body.targetEmail || "").trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes("@")) return NextResponse.json({ error: "A valid target email is required" }, { status: 400 });
    if (targetEmail === session.email.toLowerCase()) return NextResponse.json({ error: "Target owner must be a different account" }, { status: 400 });
    lifecycle.ownership_transfer_requested_at = now;
    lifecycle.ownership_transfer_target_email = targetEmail;
    lifecycle.ownership_transfer_requested_by = session.email;
    reason = reason || `Ownership transfer requested for ${targetEmail}`;
  }

  lifecycle.last_account_action = action;
  lifecycle.last_account_action_at = now;
  metadata.account_lifecycle = lifecycle;

  await supabaseServerRequest(`organizations?id=eq.${encodeURIComponent(session.organizationId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: nextStatus, metadata, updated_at: now }),
  });

  await supabaseServerRequest("audit_logs", {
    method: "POST",
    body: JSON.stringify({
      organization_id: session.organizationId,
      actor_user_id: session.userId,
      action: `account.${action}`,
      resource_type: "organization",
      resource_id: session.organizationId,
      reason: reason || null,
      metadata: { previous_status: organization.status, next_status: nextStatus, role: session.role },
    }),
  });

  const snapshot = await getAccountAdministrationSnapshot(session.organizationId);
  return NextResponse.json({ ok: true, snapshot });
}
