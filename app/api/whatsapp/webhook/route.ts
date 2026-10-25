import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordWhatsAppBusinessAppEcho } from "@/lib/whatsapp-coexistence";
import { syncHandoffNotificationStatus } from "@/lib/human-operations";
import { syncRealEstateProviderStatus } from "@/lib/real-estate-provider-status";

export const dynamic = "force-dynamic";

type WebhookRecord = Record<string, unknown>;

function record(value: unknown): WebhookRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as WebhookRecord : {};
}

function recordArray(value: unknown): WebhookRecord[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function optionalText(value: unknown): string | null {
  return value == null ? null : String(value);
}

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
  let maiaFlagConfigured = false;
  let matchedIntegration = false;

  for (const row of integrations || []) {
    const config = (row.configuration || {}) as Record<string, unknown>;
    if (String(config.phone_number_id || config.phoneNumberId || "") !== phoneNumberId) continue;
    matchedIntegration = true;
    organizationId = String(row.organization_id || "");
    maiaFlagConfigured = Object.prototype.hasOwnProperty.call(config, "maia_active");
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

  // Resolve published Maia agents inside this tenant before choosing a
  // runtime route. Some tenants have a named Maia instance (for example,
  // "maia-xposure") but predate the maia_active configuration flag. Treat a
  // missing flag as legacy/unset and infer activation only from a published
  // Maia agent. An explicit false remains an intentional opt-out.
  const { data: agents, error: agentsError } = await admin
    .from("agents")
    .select("id,slug,agent_type,configuration,updated_at")
    .eq("organization_id", organizationId)
    .eq("status", "published")
    .order("updated_at", { ascending: false });
  if (agentsError) throw agentsError;

  const publishedAgents = agents || [];
  const maiaAgent =
    publishedAgents.find((candidate) => candidate.slug === "maia") ||
    publishedAgents.find((candidate) => {
      const configuration = (candidate.configuration || {}) as Record<string, unknown>;
      const agentKey = String(configuration.agent_key || "").toLowerCase();
      return agentKey === "maia" || (agentKey === "whatsapp_agent" && String(candidate.slug || "").startsWith("maia-"));
    }) ||
    publishedAgents.find((candidate) => String(candidate.slug || "").startsWith("maia-"));

  const maiaEnabled = maiaActive || (!maiaFlagConfigured && Boolean(maiaAgent?.id));

  if (maiaEnabled && maiaAgent?.id) {
    return { organizationId, agentId: String(maiaAgent.id), mode: "maia" as const, sourceSystemId: null };
  }

  if (maiaActive) {
    // An explicitly active Maia route without a published agent is not ready.
    return null;
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

function providerEventIsStale(message: WebhookRecord) {
  const raw = Number(message?.timestamp);
  if (!Number.isFinite(raw) || raw <= 0) return false;
  const eventMs = raw > 10_000_000_000 ? raw : raw * 1000;
  return Date.now() - eventMs > MAX_PROVIDER_EVENT_AGE_MS;
}

function inboundText(message: WebhookRecord) {
  const type = String(message.type || "");
  const text = record(message.text);
  const image = record(message.image);
  const video = record(message.video);
  const document = record(message.document);
  const button = record(message.button);
  const interactive = record(message.interactive);
  const buttonReply = record(interactive.button_reply);
  const listReply = record(interactive.list_reply);
  if (type === "text") return String(text.body || "").trim();
  if (type === "image") return String(image.caption || "[Customer sent an image]").trim();
  if (type === "video") return String(video.caption || "[Customer sent a video]").trim();
  if (type === "document") return String(document.caption || document.filename || "[Customer sent a document]").trim();
  if (type === "audio") return "[Customer sent an audio message]";
  if (type === "button") return String(button.text || "").trim();
  if (type === "interactive") {
    return String(
      buttonReply.title ||
      listReply.title ||
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
  const signature = request.headers.get("x-hub-signature-256");
  const signatureValid = verifySignature(rawBody, signature);
  console.info("[whatsapp-webhook] inbound received", { signaturePresent: Boolean(signature), signatureValid, bodyLength: rawBody.length, vercelIdPresent: Boolean(request.headers.get("x-vercel-id")) });
  if (!signatureValid) {
    console.warn("[whatsapp-webhook] signature rejected", { signaturePresent: Boolean(signature), bodyLength: rawBody.length });
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let body: WebhookRecord;
  try { body = record(JSON.parse(rawBody) as unknown); }
  catch { return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 }); }

  if (body?.object !== "whatsapp_business_account") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  let statusUpdates = 0;
  let inboundQueued = 0;
  let ignoredInbound = 0;
  let humanEchoes = 0;

  for (const entry of recordArray(body.entry)) {
    for (const change of recordArray(entry.changes)) {
      const value = record(change.value);
      const metadata = record(value.metadata);
      const phoneNumberId = String(metadata.phone_number_id || "");
      let tenant = null;
      try {
        tenant = phoneNumberId ? await resolveWhatsAppTenant(phoneNumberId) : null;
      } catch (error) {
        console.error("[whatsapp-webhook] tenant lookup failed", { phoneNumberIdPresent: Boolean(phoneNumberId), errorType: error instanceof Error ? error.name : "unknown" });
        throw error;
      }
      console.info("[whatsapp-webhook] tenant lookup result", { phoneNumberIdPresent: Boolean(phoneNumberId), tenantResolved: Boolean(tenant), organizationId: tenant?.organizationId || null, mode: tenant?.mode || null, agentResolved: Boolean(tenant?.agentId) });

      for (const status of recordArray(value.statuses)) {
        const providerMessageId = String(status?.id || "");
        if (!providerMessageId) continue;
        const state = String(status?.status || "").toLowerCase();
        const firstError = record(recordArray(status.errors)[0]);
        const errorData = record(firstError.error_data);
        const nextStatus = ["delivered", "read", "sent", "failed"].includes(state) ? state : null;
        if (!nextStatus) continue;
        const ok = await updateAttempt(providerMessageId, {
          status: nextStatus,
          error_code: firstError?.code != null ? String(firstError.code) : null,
          error_message: firstError?.title || firstError?.message || null,
          response_payload: body,
        }).catch(() => false);
        if (ok) statusUpdates += 1;
        const providerTimestamp=Number(status?.timestamp);
        await syncRealEstateProviderStatus({
          provider:"meta",providerMessageId,status:nextStatus as "sent"|"delivered"|"read"|"failed",organizationId:String(tenant?.organizationId||""),
          eventAt:Number.isFinite(providerTimestamp)&&providerTimestamp>0?new Date(providerTimestamp*1000).toISOString():new Date().toISOString(),
          errorCode:firstError?.code!=null?String(firstError.code):null,
          errorMessage:optionalText(errorData.details || firstError.title || firstError.message),
        }).catch((error:unknown)=>console.warn("[whatsapp-webhook] real-estate receipt sync unavailable",{providerMessageIdPresent:true,errorType:error instanceof Error?error.name:"unknown"}));
        if(tenant?.organizationId){
          await syncHandoffNotificationStatus({
            organizationId:String(tenant.organizationId),
            providerMessageId,
            status: nextStatus as "sent" | "delivered" | "read" | "failed",
            errorCode: firstError?.code != null ? String(firstError.code) : null,
            errorMessage: optionalText(errorData.details || firstError.title || firstError.message),
          }).catch((error) => {
            console.error("[whatsapp-webhook] handoff notification status sync failed", {
              providerMessageIdPresent: Boolean(providerMessageId),
              errorType: error instanceof Error ? error.name : "unknown",
            });
          });
        }
      }

      const contacts = recordArray(value.contacts);
      const contact = contacts[0] || {};
      const contactProfile = record(contact.profile);
      const contactName = String(contactProfile.name || "");

      if (change.field === "smb_message_echoes" && tenant) {
        for (const echo of recordArray(value.message_echoes)) {
          const messageId=String(echo.id||"");
          const to=String(echo.to||"").replace(/[^0-9]/g,"");
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
            timestamp:String(echo.timestamp||"")||null,
          }).catch((error:unknown)=>{
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

      for (const message of recordArray(value.messages)) {
        const messageId = String(message.id || "");
        const from = String(message.from || "").replace(/[^0-9]/g, "");
        const text = inboundText(message);
        if (!tenant || !messageId || !from || !text) {
          ignoredInbound += 1;
          console.warn("[whatsapp-webhook] inbound ignored", { tenantResolved: Boolean(tenant), messageIdPresent: Boolean(messageId), senderPresent: Boolean(from), textPresent: Boolean(text), messageType: String(message.type || "unknown"), phoneNumberIdPresent: Boolean(phoneNumberId) });
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
            providerTimestamp: String(message.timestamp || ""),
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
            waId: String(contact.wa_id || from),
            messageType: String(message.type || "unknown"),
            mediaId: String(record(message.audio).id || record(message.image).id || record(message.video).id || record(message.document).id || ""),
            mimeType: String(record(message.audio).mime_type || record(message.image).mime_type || record(message.video).mime_type || record(message.document).mime_type || ""),
            timestamp: String(message.timestamp || ""),
          },
        };

        try {
          // Use the provider message ID as a queue-level idempotency key as well as
          // the runtime's durable event ledger. Meta may redeliver the same webhook;
          // this prevents needless duplicate Trigger runs before the ledger is reached.
          const idempotencyKey = `whatsapp-inbound:${tenant.organizationId}:${tenant.agentId}:${messageId}`;
          if (tenant.mode === "maia") {
            await tasks.trigger("maia-process-inbound-message", inboundPayload, { idempotencyKey });
          } else {
            await tasks.trigger("tenant-whatsapp-process-inbound-message", {
              ...inboundPayload,
              sourceSystemId: tenant.sourceSystemId,
            }, { idempotencyKey });
          }
          inboundQueued += 1;
          console.info("[whatsapp-webhook] inbound dispatched", { organizationId: tenant.organizationId, agentId: tenant.agentId, mode: tenant.mode, messageIdPresent: Boolean(messageId) });
        } catch (error) {
          console.error("[whatsapp-webhook] inbound dispatch failed", { organizationId: tenant.organizationId, agentId: tenant.agentId, mode: tenant.mode, errorType: error instanceof Error ? error.name : "unknown" });
          throw error;
        }
      }
    }
  }

  return NextResponse.json({ ok: true, statusUpdates, inboundQueued, ignoredInbound, humanEchoes });
}
