import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { confirmFailedHumanHandoffNotificationRetry, prepareFailedHumanHandoffNotificationRetry } from "@/lib/handoff-notification-retry";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: handoffId } = await params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action || "");
  const notificationId = String(body.notificationId || "").trim();
  if (!notificationId) return NextResponse.json({ error: "notificationId is required" }, { status: 400 });

  try {
    if (action === "prepare") {
      const preview = await prepareFailedHumanHandoffNotificationRetry(session, handoffId, notificationId);
      return NextResponse.json({ ok: true, preview });
    }
    if (action === "confirm") {
      const approvalId = String(body.approvalId || "").trim();
      if (!approvalId) return NextResponse.json({ error: "approvalId is required" }, { status: 400 });
      const result = await confirmFailedHumanHandoffNotificationRetry(session, handoffId, notificationId, approvalId);
      return NextResponse.json({ ok: true, result });
    }
    return NextResponse.json({ error: "Unsupported notification retry action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Handoff notification retry failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
