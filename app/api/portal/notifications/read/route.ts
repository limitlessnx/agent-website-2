import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { markAllDashboardNotificationsRead, markDashboardNotificationRead } from "@/lib/dashboard-notifications";

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { notificationId?: string; all?: boolean };
  try {
    if (body.all) {
      const count = await markAllDashboardNotificationsRead(session.organizationId, session.userId);
      return NextResponse.json({ ok: true, count });
    }
    if (!body.notificationId) return NextResponse.json({ error: "notificationId is required" }, { status: 400 });
    await markDashboardNotificationRead(session.organizationId, session.userId, body.notificationId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update notification" }, { status: 400 });
  }
}
