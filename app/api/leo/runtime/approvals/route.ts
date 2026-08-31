import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { reviewRuntimeApproval } from "@/lib/ai-runtime/approvals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const approvalRequestId = String(body.approvalRequestId || body.id || "").trim();
    const decision = String(body.decision || "").trim();
    if (!approvalRequestId) return NextResponse.json({ error: "approvalRequestId is required." }, { status: 400 });
    if (!["approved", "rejected", "cancelled"].includes(decision)) return NextResponse.json({ error: "decision must be approved, rejected or cancelled." }, { status: 400 });
    const approval = await reviewRuntimeApproval({ identity, organizationId: typeof body.organizationId === "string" ? body.organizationId : undefined, approvalRequestId, decision: decision as "approved" | "rejected" | "cancelled", notes: typeof body.notes === "string" ? body.notes : undefined });
    return NextResponse.json({ ok: true, approval }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Approval review failed.";
    const status = /forbidden|requires Super Admin|not allowed|permission/i.test(message) ? 403 : /not found/i.test(message) ? 404 : 409;
    return NextResponse.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
  }
}
