import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function verifySignature(rawBody: string, signature: string | null) {
  const appSecret = process.env.WHATSAPP_APP_SECRET || process.env.META_WHATSAPP_APP_SECRET || process.env.META_APP_SECRET || "";
  if (!appSecret || !signature) return false;
  if (!signature.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const supplied = signature.slice("sha256=".length);
  if (expected.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

async function updateAttempt(providerMessageId: string, patch: Record<string, unknown>) {
  if (!providerMessageId) return false;
  const admin = createAdminClient();
  const { error } = await admin.from("whatsapp_delivery_attempts").update(patch).eq("provider_message_id", providerMessageId);
  return !error;
}

async function resolveWhatsAppTenant(phoneNumberId: string) {
  const admin = createAdminClient();
  const { data: integrations } = await admin
    .from("organization_integrations")
    .select("organization_id,provider,status,configuration")
    .in("provider", ["whatsapp", "meta_whatsapp"])
    .in("status", ["configured", "connected", "degraded"]);

  let organizationId = "";
  let matchedIntegration = false;
  for (const row of integrations || []) {
    const config = (row.configuration || {}) as Record<string, unknown>;
    if (String(config.phone_number_id || config.phoneNumberId || "") === phoneNumberId) {
      matchedIntegration = true;
      if (config.maia_active === true) {
        organizationId = String(row.organization_id || "");
      }
      break;
    }
  }

  if (matchedIntegration && !organizationId) return null;

  if (!organizationId) {
    const legacyPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_WHATSAPP_PHONE_NUMBER_ID || "";
    if (legacyPhoneNumberId && legacyPhoneNumberId === phoneNumberId) {
      const { data: organization } = await admin.from("organizations").select("id").eq("slug", "limitless-realty").maybeSingle();
      organizationId = String(organization?.id || "");
    }
  }

  if (!organizationId) return null;

  const { data: selections } = await admin
    .from("organization_agent_selections")
    .select("configuration,status")
    .eq("organization_id", organizationId);

  const activeSelection = (selections || []).find((row) => {
    const status = String(row.status || "").toLowerCase();
    const configuration = (row.configuration || {}) as Record<string, unknown>;
    const channels = Array.isArray(configuration.channels) ? configuration.channels.map(String) : [];
    return ["active", "selected", "paid", "provisioning"].includes(status)
      && channels.includes("whatsapp")
      && Boolean(configuration.provisioned_agent_id);
  });

  let agentId = activeSelection
    ? String(((activeSelection.configuration || {}) as Record<string, unknown>).provisioned_agent_id || "")
    : "";

  if (!agentId) {
    const { data: agent } = await admin
      .from("agents")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("slug", "maia")
      .in("status", ["published", "active"])
      .limit(1)
      .maybeSingle();
    agentId = String(agent?.id || "");
  }

  return agentId ? { organizationId, agentId } : null;
}

function inboundText(message: Record<string, any>) {
  const type = String(message.type || "");
  if (type === "text") return String(message.text?.body || "").trim();
  if (type === "image") return String(message.image?.caption || "[Customer sent an image]").trim();
  if (type === "video") return String(message.video?.caption || "[Customer sent a video]").trim();
  if (type === "document") return String(message.document?.caption || message.document?.filename || "[Customer sent a document]").trim();
  if (type === "audio") return "[Customer sent an audio message]";
  if (type === "button") return String(message.button?.text || "").trim();
  if (type === "interactive") {
    return String(
      message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.title ||
      "",
    ).trim();
  }
  return "";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const nextUrl = request.nextUrl;
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.META_WHATSAPP_VERIFY_TOKEN || "";
  const verified = mode === "subscribe" && Boolean(token) && Boolean(challenge) && Boolean(expected) && token === expected;

  const queryKeys = Array.from(url.searchParams.keys()).sort();
  const nextUrlQueryKeys = Array.from(nextUrl.searchParams.keys()).sort();

  console.info("[whatsapp-webhook] verification", {
    host: url.host,
    pathname: url.pathname,
    queryKeys,
    nextUrlQueryKeys,
    rawSearchPresent: Boolean(url.search),
    rawSearchLength: url.search.length,
    modePresent: Boolean(mode),
    modeIsSubscribe: mode === "subscribe",
    challengePresent: Boolean(challenge),
    tokenPresent: Boolean(token),
    expectedTokenPresent: Boolean(expected),
    tokenMatches: Boolean(token && expected && token === expected),
    verified,
    userAgent: request.headers.get("user-agent") || "",
    refererPresent: Boolean(request.headers.get("referer")),
    forwardedHost: request.headers.get("x-forwarded-host") || "",
    forwardedProto: request.headers.get("x-forwarded-proto") || "",
    vercelIdPresent: Boolean(request.headers.get("x-vercel-id")),
  });

  if (verified) {
    return new Response(challenge, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  return NextResponse.json(
    {
      error: "Webhook verification failed.",
      diagnostics: {
        queryKeys,
        modePresent: Boolean(mode),
        challengePresent: Boolean(challenge),
        tokenPresent: Boolean(token),
        expectedTokenPresent: Boolean(expected),
      },
    },
    {
      status: 403,
      headers: { "cache-control": "no-store" },
    },
  );
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let body: any;
  try { body = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 }); }

  if (body?.object !== "whatsapp_business_account") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  let statusUpdates = 0;
  let inboundQueued = 0;
  let ignoredInbound = 0;

  for (const entry of Array.isArray(body.entry) ? body.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const value = change?.value || {};

      for (const status of Array.isArray(value.statuses) ? value.statuses : []) {
        const providerMessageId = String(status?.id || "");
        if (!providerMessageId) continue;
        const state = String(status?.status || "").toLowerCase();
        const firstError = Array.isArray(status?.errors) ? status.errors[0] || {} : {};
        const nextStatus = ["delivered", "read", "sent", "failed"].includes(state) ? state : null;
        if (!nextStatus) continue;
        const ok = await updateAttempt(providerMessageId, {
          status: nextStatus,
          error_code: firstError?.code != null ? String(firstError.code) : null,
          error_message: firstError?.title || firstError?.message || null,
          response_payload: body,
        }).catch(() => false);
        if (ok) statusUpdates += 1;
      }

      const phoneNumberId = String(value?.metadata?.phone_number_id || "");
      const tenant = phoneNumberId ? await resolveWhatsAppTenant(phoneNumberId) : null;
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const contactName = String(contacts[0]?.profile?.name || "");

      for (const message of Array.isArray(value.messages) ? value.messages : []) {
        const messageId = String(message?.id || "");
        const from = String(message?.from || "").replace(/[^0-9]/g, "");
        const text = inboundText(message);
        if (!tenant || !messageId || !from || !text) {
          ignoredInbound += 1;
          continue;
        }

        await tasks.trigger("maia-process-inbound-message", {
          organizationId: tenant.organizationId,
          agentId: tenant.agentId,
          channel: "whatsapp",
          provider: "meta_whatsapp",
          externalEventId: messageId,
          externalConversationId: from,
          customerPhone: from,
          customerName: contactName,
          message: text,
          metadata: {
            phoneNumberId,
            waId: String(contacts[0]?.wa_id || from),
            messageType: String(message?.type || "unknown"),
            timestamp: String(message?.timestamp || ""),
          },
        });
        inboundQueued += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, statusUpdates, inboundQueued, ignoredInbound });
}
