import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GENCOUV_ORGANIZATION_ID } from "@/lib/gencouv-admin";
import { verifyBrevoWebhook } from "@/lib/gencouv-brevo-events";
import { reconcileBrevoBatch } from "@/lib/gencouv-brevo-reconcile";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ") || !verifyBrevoWebhook(authorization.slice(7), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.GENCOUV_BREVO_API_KEY) return NextResponse.json({ checked: 0, configured: false });

  const db = createAdminClient();
  const org = GENCOUV_ORGANIZATION_ID;
  const deadline = AbortSignal.timeout(40000);
  const batches = await db.from("gencouv_send_batches").select("id,from_email,submitted_at")
    .eq("organization_id", org).eq("provider", "brevo").in("status", ["submitting", "unknown", "partial"])
    .lt("submitted_at", new Date(Date.now() - 120000).toISOString())
    .gte("submitted_at", new Date(Date.now() - 89 * 86400000).toISOString())
    .order("updated_at").limit(4);
  if (batches.error) return NextResponse.json({ error: "Brevo batch history unavailable" }, { status: 503 });

  let checked = 0;
  let failed = 0;
  for (const batch of batches.data) {
    if (deadline.aborted) break;
    try {
      const messages = await db.from("gencouv_email_messages").select("id,recipient_email,provider,provider_email_id")
        .eq("organization_id", org).eq("send_batch_id", batch.id);
      if (messages.error) throw messages.error;
      const result = await reconcileBrevoBatch(db, org, batch, messages.data, deadline);
      checked += result.checked;
    } catch {
      failed++;
    } finally {
      // Rotate unresolved batches so one missing receipt cannot starve newer work.
      await db.from("gencouv_send_batches").update({ updated_at: new Date().toISOString() })
        .eq("id", batch.id).eq("organization_id", org).eq("provider", "brevo")
        .in("status", ["submitting", "unknown", "partial"]);
    }
  }
  return NextResponse.json({ checked, failed }, { status: failed ? 503 : 200 });
}
