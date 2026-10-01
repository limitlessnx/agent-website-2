import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordWhatsAppBusinessAppEcho } from "@/lib/whatsapp-coexistence";

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
  const { data: integrations, error: integrationsError } = await admin
    .from("organization_integrations")
    .select("organization_id,provider,status,configuration")
    .in("provider", ["whatsapp", "meta_whatsapp"])
    .in("status", ["configured", "connected", "degraded"]);
  if (integrationsError) throw integrationsError;

  let organizationId = "";
  let maiaActive = false;
  let matchedIntegration = false;

  for (const row of integrations || []) {
    const config = (row.configuration || {}) as Record<string, unknown>;
    if (String(config.phone_number_id || config.phoneNumberId || "") !== phoneNumberId) continue;
    matchedIntegration = true;
    organizationId = String(row.organization_id || "");
    maiaActive = config.maia_active === true;
    break;
  }

  if (!organizationId && !matchedIntegration) {
    const legacyPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_WHATSAPP_PHONE_NUMBER_ID || "";
    if (legacyPhoneNumberId && legacyPhoneNumberId === phoneNumberId) {
      const { data: organization } = await admin
        .from("organizations")
        .select("id")
        .eq("slug", "limitless-realty")
        .maybeSingle();
      organizationId = String(organization?.id || "");
      maiaActive = Boolean(organizationId);
    }
  }

  if (!organizationId) return null;

  if (maiaActive) {
    const { data: agent } = await admin
      .from("agents")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("slug", "maia")
      .in("status", ["published", "active"])
      .limit(1)
      .maybeSingle();
    return agent?.id ? { organizationId, agentId: String(agent.id), mode: "maia" as const, sourceSystemId: null } : null;
  }

  const { data: catalog } = await admin
    .from("system_catalog")
    .select("id")
    .eq("slug", "whatsapp-agent")
    .eq("status", "available")
    .maybeSingle();
  if (!catalog?.id) return null;

  const { data: installation } = await admin
    .from("organization_systems")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("system_id", catalog.id)
    .eq("status", "active")
    .maybeSingle();
  if (!installation?.id) return null;

  const { data: selections } = await admin
    .from("organization_agent_selections")
    .select("configuration,status")
    .eq("organization_id", organizationId)
    .eq("system_catalog_id", catalog.id)
    .in("status", ["active", "selected", "paid", "provisioning"]);

  const activeSelection = (selections || []).find((row) =>
    Boolean(((row.configuration || {}) as Record<string, unknown>).provisioned_agent_id),
  );
  const agentId = activeSelection
    ? String(((activeSelection.configuration || {}) as Record<string, unknown>).provisioned_agent_id || "")
    : "";

  return agentId
    ? { organizationId, agentId, mode: "modular" as const, sourceSystemId: String(installation.id) }
    : null;
}

const MAX_PROVIDER_EVENT_AGE_MS = 24 * 60 * 60 * 1000;

function providerEventIsStale(message: Record<string, any>) {
  const raw = Number(message?.timestamp);
  if (!Number.isFinite(raw) || raw <= 0) return false;
  const eventMs = raw > 10_000_000_000 ? raw : raw * 1000;
  return Date.now() - eventMs > MAX_PROVIDER_EVENT_AGE_MS;
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
  const queryKeys = Array.from(url.searchParams.keys()).sort();
  const nextUrlQueryKeys = Array.from(nextUrl.searchParams.keys()).sort();
  const tokenMatches = Boolean(token && expected && token === expected);
  const isMetaProbe = request.headers.get("user-agent") === "facebookexternalua";

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
    tokenMatches,
    isMetaProbe,
    userAgent: request.headers.get("user-agent") || "",
    refererPresent: Boolean(request.headers.get("referer")),
    forwardedHost: request.headers.get("x-forwarded-host") || "",
    forwardedProto: request.headers.get("x-forwarded-proto") || "",
    vercelIdPresent: Boolean(request.headers.get("x-vercel-id")),
  });

  // Meta connectivity checks can hit the callback URL without the
  // verification query string. Keep those probes healthy; the actual
  // subscription handshake below still requires the configured token.
  if (!mode && !token && !challenge && isMetaProbe) {
    return NextResponse.json(
      { ok: true, probe: true },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  }

  const verified = mode === "subscribe" && tokenMatches && Boolean(challenge);

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
        tokenMatches,
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
  let humanEchoes = 0;

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

      if (change?.field === "smb_message_echoes" && tenant) {
        for (const echo of Array.isArray(value.message_echoes) ? value.message_echoes : []) {
          const messageId=String(echo?.id||"");
          const to=String(echo?.to||"").replace(/[^0-9]/g,"");
          const text=inboundText(echo);
          if(!messageId||!to||!text) continue;
          await recordWhatsAppBusinessAppEcho({
            organizationId:tenant.organizationId,
            sourceSystemId:tenant.sourceSystemId,
            agentId:tenant.agentId,
            customerPhone:to,
            messageId,
            text,
            phoneNumberId,
            timestamp:String(echo?.timestamp||"")||null,
          }).catch((error)=>{
            console.error("[whatsapp-webhook] coexistence echo failed",{
              organizationId:tenant.organizationId,
              messageId,
              error:error instanceof Error?error.message:"unknown",
            });
          });
          humanEchoes += 1;
        }
        continue;
      }

      for (const message of Array.isArray(value.messages) ? value.messages : []) {
        const messageId = String(message?.id || "");
        const from = String(message?.from || "").replace(/[^0-9]/g, "");
        const text = inboundText(message);
        if (!tenant || !messageId || !from || !text) {
          ignoredInbound += 1;
          continue;
        }

        // Meta can redeliver webhook events long after the original message was sent.
        // Never turn an old provider event into a fresh Maia conversation or outbound reply.
        if (providerEventIsStale(message)) {
          ignoredInbound += 1;
          console.info("[whatsapp-webhook] ignoring stale provider event", {
            organizationId: tenant.organizationId,
            agentId: tenant.agentId,
            externalEventId: messageId,
            customerPhone: from,
            providerTimestamp: String(message?.timestamp || ""),
            maxAgeMs: MAX_PROVIDER_EVENT_AGE_MS,
          });
          continue;
        }

        const inboundPayload = {
          organizationId: tenant.organizationId,
          agentId: tenant.agentId,
          channel: "whatsapp" as const,
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
        };

        if (tenant.mode === "maia") {
          await tasks.trigger("maia-process-inbound-message", inboundPayload);
        } else {
          await tasks.trigger("tenant-whatsapp-process-inbound-message", {
            ...inboundPayload,
            sourceSystemId: tenant.sourceSystemId,
          });
        }
        inboundQueued += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, statusUpdates, inboundQueued, ignoredInbound, humanEchoes });
}
