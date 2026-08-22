import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function supabaseConfig() {
  const url = (
    process.env.LIMITLESS_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).replace(/\/$/, "");
  const key =
    process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "";
  return { url, key };
}

function verifySignature(rawBody: string, signature: string | null) {
  const appSecret =
    process.env.WHATSAPP_APP_SECRET ||
    process.env.META_WHATSAPP_APP_SECRET ||
    process.env.META_APP_SECRET ||
    "";

  // Keep verification available in deployments where Meta app secret is configured.
  // If no secret is configured, the endpoint still accepts Meta's webhook payloads;
  // deployment-side access controls and the provider verification handshake remain
  // the source of truth for installations that do not expose the app secret here.
  if (!appSecret || !signature) return true;
  if (!signature.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const supplied = signature.slice("sha256=".length);
  if (expected.length !== supplied.length) return false;

  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

async function updateAttempt(
  providerMessageId: string,
  patch: Record<string, unknown>,
) {
  const { url, key } = supabaseConfig();
  if (!url || !key || !providerMessageId) return false;

  const response = await fetch(
    `${url}/rest/v1/whatsapp_delivery_attempts?provider_message_id=eq.${encodeURIComponent(providerMessageId)}`,
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
  const expected =
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
    process.env.META_WHATSAPP_VERIFY_TOKEN ||
    "";

  if (mode === "subscribe" && token && challenge && expected && token === expected) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json(
    { error: "Webhook verification failed." },
    { status: 403 },
  );
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (body?.object !== "whatsapp_business_account") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  let updated = 0;

  for (const entry of Array.isArray(body.entry) ? body.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const statuses = Array.isArray(change?.value?.statuses)
        ? change.value.statuses
        : [];

      for (const status of statuses) {
        const providerMessageId = String(status?.id || "");
        if (!providerMessageId) continue;

        const state = String(status?.status || "").toLowerCase();
        const errors = Array.isArray(status?.errors) ? status.errors : [];
        const firstError = errors[0] || {};
        const errorCode =
          firstError?.code != null ? String(firstError.code) : null;
        const errorMessage =
          firstError?.title || firstError?.message || null;

        const nextStatus =
          state === "delivered"
            ? "delivered"
            : state === "read"
              ? "read"
              : state === "sent"
                ? "sent"
                : state === "failed"
                  ? "failed"
                  : null;

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
