import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGencouvUnsubscribeToken } from "@/lib/gencouv-bulk-unsubscribe";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
const page = (message: string, status = 200) => new Response(
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Gencouv email preferences</title></head><body style="font:16px system-ui;max-width:520px;margin:60px auto;padding:24px"><h1>Gencouv Capital</h1><p>' +
    message + '</p></body></html>',
  { status, headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } }
);

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const identity = verifyGencouvUnsubscribeToken(token);
  if (!identity) return page("This unsubscribe link is invalid.", 400);
  // GET does not alter preferences: email scanners may follow links automatically.
  const safeToken = token.replace(/[^A-Za-z0-9_.-]/g, "");
  return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="font:16px system-ui;max-width:520px;margin:60px auto;padding:24px"><h1>Stop Gencouv marketing emails</h1><form method="post"><input type="hidden" name="token" value="' +
    safeToken + '"><button style="padding:12px 18px" type="submit">Unsubscribe</button></form></body></html>',
    { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
}

export async function POST(request: NextRequest) {
  let token = request.nextUrl.searchParams.get("token") || "";
  if (!token) {
    const form = await request.formData().catch(() => null);
    token = String(form?.get("token") || "");
  }
  const identity = verifyGencouvUnsubscribeToken(token);
  if (!identity) return page("This unsubscribe link is invalid.", 400);
  const db = createAdminClient();
  const { error } = await db.from("gencouv_suppression_list").upsert({
    organization_id: identity.organizationId,
    normalized_email: identity.email,
    reason: "Marketing unsubscribe",
    source: "gencouv_bulk_unsubscribe",
    event_type: "unsubscribe",
    updated_at: new Date().toISOString()
  }, { onConflict: "organization_id,normalized_email" });
  if (error) return page("Unable to save your preference. Please contact Gencouv support.", 503);
  return page("You have been unsubscribed from Gencouv marketing emails.");
}
