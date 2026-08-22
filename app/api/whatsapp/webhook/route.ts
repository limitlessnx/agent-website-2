import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function supabaseConfig() {
  const url = (process.env.LIMITLESS_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  return { url, key };
}

async function updateAttempt(messageId: string, patch: Record<string, unknown>) {
  const { url, key } = supabaseConfig();
  if (!url || !key || !messageId) return false;
  const response = await fetch(
    `${url}/rest/v1/whatsapp_delivery_attempts?provider_message_id=eq.${encodeURIComponent(messageId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(patch),
      cache: "no-store",
    },
  );
  return response.ok;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.META_WHATSAPP_VERIFY_TOKEN || "";

  if (mode === "subscribe" && token && challenge && expected && token === expected) {
    return new Response(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Webhook verification failed." }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as any;
  if (!body || body.object !== "whatsapp_business_account") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  let updated = 0;
  for (const entry of Array.isArray(body.entry) ? body.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const statuses = Array.isArray(change?.value?.statuses) ? change.value.statuses : [];
      for (const status of statuses) {
        const providerMessageId = String(status?.id || "");
        if (!providerMessageId) continue;

        const state = String(status?.status || "").toLowerCase();
        const errors = Array.isArray(status?.errors) ? status.errors : [];
        const firstError = errors[0] || {};
        const errorCode = firstError?.code != null ? String(firstError.code) : null;
        const errorMessage = firstError?.title || firstError?.message || null;
        const nextStatus = state === "delivered" ? "delivered" : state === "read" ? "read" : state === "sent" ? "sent" : state === "failed" ? "failed" : null;
        if (!nextStatus) continue;

        const ok = await updateAttempt(providerMessageId, {
          status: nextStatus,
          error_code: errorCode,
          error_message: errorMessage,
          response_payload: body,
        }).catch(() => false);
        if (ok) updated += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, updated });
}
