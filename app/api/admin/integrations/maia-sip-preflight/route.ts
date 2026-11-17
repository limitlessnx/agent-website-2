import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getWhatsAppCredentials, getWhatsAppIntegration } from "@/lib/whatsapp-integration";
import { LIMITLESS_REALTY_ORGANIZATION_ID } from "@/lib/limitless-data";

export const dynamic = "force-dynamic";

type Json = Record<string, unknown>;

function object(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}

/**
 * Read-only inspection of Meta Calling/SIP status for the existing Limitless
 * Cloud API phone number. Never return the access token, SIP credentials,
 * SDP, full Meta response body, or WhatsApp customer details.
 *
 * Deliberately does not implement POST: changing SIP mode replaces the Meta
 * calling webhook signaling route and must follow a staged voice cutover.
 */
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const integration = await getWhatsAppIntegration(LIMITLESS_REALTY_ORGANIZATION_ID);
  const credentials = await getWhatsAppCredentials(LIMITLESS_REALTY_ORGANIZATION_ID);

  const phoneNumberId = String(credentials?.phone_number_id || credentials?.phoneNumberId || "").trim();
  const token = String(credentials?.access_token || credentials?.accessToken || "").trim();
  const providerFamily = String(credentials?.provider_family || object(integration?.configuration).provider_family || "meta").toLowerCase();

  if (providerFamily !== "meta") return NextResponse.json({
    ok: false,
    reason: "not_meta_cloud_api",
    voiceCutoverReady: false,
  }, { status: 409 });

  if (!phoneNumberId || !/^\d{8,22}$/.test(phoneNumberId) || !token) return NextResponse.json({
    ok: false,
    reason: "meta_credentials_unavailable",
    voiceCutoverReady: false,
  }, { status: 409 });

  // Only the configured Graph version is allowed; never use a user-supplied
  // hostname, phone ID, token or API version for this privileged probe.
  const configuredVersion = String(credentials?.graph_version || "v23.0");
  const graphVersion = /^v\d+\.\d+$/.test(configuredVersion) ? configuredVersion : "v23.0";
  const url = new URL(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/settings`);
  url.searchParams.set("fields", "calling");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return NextResponse.json({ ok: false, reason: "meta_settings_unreachable", voiceCutoverReady: false }, { status: 502 });
  }

  // Never forward provider errors verbatim; they can contain sensitive data.
  if (!response.ok) return NextResponse.json({
    ok: false,
    reason: "meta_settings_request_failed",
    metaHttpStatus: response.status,
    voiceCutoverReady: false,
  }, { status: 502 });

  const raw = object(await response.json().catch(() => ({})));
  const calling = object(raw.calling || (Array.isArray(raw.data) ? object(raw.data[0]).calling : null));
  const sip = object(calling.sip);
  const servers = Array.isArray(sip.servers) ? sip.servers : [];

  return NextResponse.json({
    ok: true,
    provider: "meta_cloud_api",
    organizationId: LIMITLESS_REALTY_ORGANIZATION_ID,
    integrationConnected: integration?.status === "connected",
    callingStatus: String(calling.status || "UNKNOWN"),
    sipStatus: String(sip.status || "UNKNOWN"),
    sipServerCount: servers.length,
    // Never report ready until an actual ElevenLabs SIP endpoint and
    // end-to-end call test have been independently verified.
    voiceCutoverReady: false,
    nextStep: "Verify ElevenLabs SIP import and Meta-compatible TLS/SRTP/codec signaling before enabling SIP on the live number.",
  }, { headers: { "Cache-Control": "no-store" } });
}
