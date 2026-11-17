import assert from "node:assert/strict";
import test from "node:test";
import loadTypescript from "./helpers/load-typescript.cjs";

const caller = "2348000000000";
const number = "1234567890";

function loadPilot(enabled = false) {
  const env = {
    MAIA_ELEVENLABS_PILOT_ENABLED: String(enabled),
    MAIA_ELEVENLABS_PILOT_CALLER: caller,
    MAIA_ELEVENLABS_PILOT_PHONE_NUMBER_ID: number,
    MAIA_ELEVENLABS_BRIDGE_URL: "https://example.com",
    MAIA_ELEVENLABS_BRIDGE_TOKEN: "synthetic-token-used-for-local-testing",
  };
  return { env, pilot: loadTypescript("lib/maia-elevenlabs-pilot.ts", {}, "", { process: { env }, URL }) };
}

test("Maia pilot requires an explicit flag, exact caller and exact receiving number", () => {
  const { env, pilot: { getMaiaElevenLabsPilotConfig } } = loadPilot();
  delete env.MAIA_ELEVENLABS_PILOT_ENABLED;
  assert.equal(getMaiaElevenLabsPilotConfig(caller, number), null);
  env.MAIA_ELEVENLABS_PILOT_ENABLED = "true";
  assert.equal(getMaiaElevenLabsPilotConfig("2348000000001", number), null);
  assert.equal(getMaiaElevenLabsPilotConfig(`wa:${caller}`, number), null);
  assert.equal(getMaiaElevenLabsPilotConfig(caller, "1234567891"), null);
  assert.equal(getMaiaElevenLabsPilotConfig(`+${caller}`, number)?.baseUrl.origin, "https://example.com");
  env.MAIA_ELEVENLABS_BRIDGE_URL = "http://example.com";
  assert.throws(() => getMaiaElevenLabsPilotConfig(caller, number));
});

test("pilot session IDs are stable and scoped to the receiving Meta phone ID", () => {
  const { pilot: { maiaPilotSessionId } } = loadPilot();
  const call = maiaPilotSessionId("1234567890", "synthetic-call");
  assert.equal(call, maiaPilotSessionId("1234567890", "synthetic-call"));
  assert.notEqual(call, maiaPilotSessionId("1234567891", "synthetic-call"));
  assert.match(call, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
});

test("only the approved inbound caller uses the ElevenLabs answer for Meta acceptance", async () => {
  const metaRequests = [];
  const pilotRequests = [];
  const tenant = { organizationId: "limitless", agentId: "maia" };
  const { pilot } = loadPilot(true);
  const fetch = async (url, options) => {
    metaRequests.push({ url, options });
    if (url.includes("openai.com")) {
      return new Response("legacy-answer", { headers: { location: "/calls/legacy-id" } });
    }
    return Response.json({ success: true });
  };
  const { acceptMaiaWhatsAppCall } = loadTypescript("lib/maia-whatsapp-calling.ts", {
    "@/lib/maia-elevenlabs-pilot": {
      ...pilot,
      prepareMaiaPilotCall: async (_config, id, sdp) => {
        pilotRequests.push({ id, sdp });
        return "v=0\r\npilot-answer";
      },
    },
    "@/lib/whatsapp-integration": {
      getWhatsAppCredentials: async () => ({ access_token: "synthetic", phone_number_id: number }),
    },
    "@/lib/flux-ai-metering": {
      preflightChargeableFluxAi: async () => {},
      recordChargeableFluxAiUsage: async () => {},
    },
    "@/lib/supabase/admin": {
      createAdminClient: () => {
        const query = {
          from: () => query, select: () => query, eq: () => query,
          maybeSingle: async () => ({ data: { name: "Maia" } }),
        };
        return query;
      },
    },
    "@/lib/limitless-data": { LIMITLESS_REALTY_ORGANIZATION_ID: tenant.organizationId },
  }, "", {
    fetch,
    process: { env: { MAIA_WHATSAPP_CALLING_ENABLED: "true" } },
    console: { info: () => {}, warn: () => {} },
  });
  const offer = {
    id: "synthetic-meta-call", from: caller, verifiedCaller: caller,
    phoneNumberId: number, event: "connect", direction: "USER_INITIATED",
    session: { sdp_type: "offer", sdp: "v=0\r\npilot-offer" },
  };
  const result = await acceptMaiaWhatsAppCall(offer, tenant);
  assert.equal(result.accepted, true);
  assert.equal(result.realtimeCallId, undefined);
  assert.equal(pilotRequests.length, 1);
  assert.equal(metaRequests.length, 1);
  assert.equal(JSON.parse(metaRequests[0].options.body).session.sdp, "v=0\r\npilot-answer");

  const other = await acceptMaiaWhatsAppCall({ ...offer, verifiedCaller: "2348000000001" }, tenant);
  assert.equal(other.realtimeCallId, "legacy-id");
  assert.equal(pilotRequests.length, 1);
  assert.match(metaRequests[1].url, /api\.openai\.com/);
});
