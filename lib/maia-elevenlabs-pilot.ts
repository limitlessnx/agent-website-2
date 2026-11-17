import { createHash } from "node:crypto";

export function getMaiaElevenLabsPilotConfig(caller: string, phoneNumberId: string) {
  if (process.env.MAIA_ELEVENLABS_PILOT_ENABLED !== "true") return null;
  const approvedCaller = process.env.MAIA_ELEVENLABS_PILOT_CALLER?.trim();
  const approvedNumber = process.env.MAIA_ELEVENLABS_PILOT_PHONE_NUMBER_ID?.trim();
  if (!/^\+?[1-9]\d{7,14}$/.test(caller) || caller.replace(/^\+/, "") !== approvedCaller) return null;
  if (!/^\d{8,22}$/.test(phoneNumberId) || phoneNumberId !== approvedNumber) return null;

  const baseUrl = new URL(process.env.MAIA_ELEVENLABS_BRIDGE_URL || "");
  const token = process.env.MAIA_ELEVENLABS_BRIDGE_TOKEN || "";
  if (baseUrl.protocol !== "https:" || baseUrl.username || baseUrl.password ||
      baseUrl.search || baseUrl.hash || baseUrl.pathname !== "/" || !/^[!-~]{32,}$/.test(token)) {
    throw new Error("Maia ElevenLabs pilot configuration is invalid.");
  }
  return { baseUrl, token };
}

type PilotConfig = NonNullable<ReturnType<typeof getMaiaElevenLabsPilotConfig>>;

export function maiaPilotSessionId(phoneNumberId: string, metaCallId: string) {
  const digest = createHash("sha256").update(phoneNumberId).update("\0").update(metaCallId).digest("hex");
  return [digest.slice(0, 8), digest.slice(8, 12), digest.slice(12, 16), digest.slice(16, 20), digest.slice(20, 32)].join("-");
}

export async function prepareMaiaPilotCall(config: PilotConfig, id: string, sdp: string) {
  const response = await fetch(new URL("/calls", config.baseUrl), {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id, sdp }),
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 409) return null;
  if (!response.ok) throw new Error("Maia ElevenLabs bridge rejected the call.");
  const body = await response.json();
  if (typeof body.sdp !== "string" || !body.sdp.startsWith("v=0") || body.sdp.length > 64000) {
    throw new Error("Maia ElevenLabs bridge returned an invalid answer.");
  }
  return body.sdp as string;
}

export async function closeMaiaPilotCall(config: PilotConfig, id: string) {
  const response = await fetch(new URL(`/calls/${id}`, config.baseUrl), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${config.token}` },
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) throw new Error("Maia ElevenLabs bridge cleanup failed.");
}
