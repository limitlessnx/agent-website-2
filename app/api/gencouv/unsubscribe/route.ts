import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGencouvUnsubscribe } from "@/lib/gencouv-send";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const url = new URL(request.url);const id = url.searchParams.get("message") || "";const token = url.searchParams.get("token") || "";
  if (!verifyGencouvUnsubscribe(id, token)) return new NextResponse("This unsubscribe link is invalid.", { status: 400 });
  // Email scanners may follow GET links. Unsubscribe only after an explicit POST.
  return new NextResponse('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gencouv email preferences</title><body><main><h1>Gencouv email preferences</h1><p>Stop receiving Gencouv marketing emails.</p><form method="post"><button type="submit">Unsubscribe</button></form></main></body></html>', { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'; form-action 'self'; frame-ancestors 'none'" } });
}
export async function POST(request: Request) {
  const url = new URL(request.url);const id = url.searchParams.get("message") || "";const token = url.searchParams.get("token") || "";
  if (!verifyGencouvUnsubscribe(id, token)) return new NextResponse("This unsubscribe link is invalid.", { status: 400 });
  const result = await createAdminClient().rpc("gencouv_unsubscribe_message", { p_message_id: id });
  if (result.error || result.data !== true) return new NextResponse("Unsubscribe could not be saved. Please retry.", { status: 503 });
  return new NextResponse("You have been unsubscribed from Gencouv marketing emails.", { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
