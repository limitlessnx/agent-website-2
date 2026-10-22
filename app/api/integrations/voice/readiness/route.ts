import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationAccessContext, assertAnyOrganizationPermission } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFluxPlanDefinition, planIncludesChannel } from "@/lib/fluxknight-plans";
import { getFluxWalletSummary } from "@/lib/flux-credits";
import { getVoiceActivationGate, voiceActivationError } from "@/lib/voice-activation-gate";

async function authorize() {
  const session = await getClientSession();
  if (!session) return { error: "Authentication required.", status: 401 as const };
  const access = await getOrganizationAccessContext(session.organizationId, session.userId);
  try {
    assertAnyOrganizationPermission(access, ["integrations.view", "integrations.manage"]);
  } catch {
    return { error: "integrations.view or integrations.manage is required.", status: 403 as const };
  }
  return { session, access };
}

export async function GET() {
  const auth = await authorize();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const wallet = await getFluxWalletSummary(auth.session.organizationId);
    const plan = getFluxPlanDefinition(wallet.planCode);
    const gate = await getVoiceActivationGate(auth.session.organizationId);
    return NextResponse.json({ ok: true, available: planIncludesChannel(plan.code, "voice"), plan: plan.code, gate, error: gate.ready ? null : voiceActivationError(gate) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to check Voice readiness." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authorize();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.access.permissions.has("integrations.manage")) return NextResponse.json({ error: "Integration management permission is required." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const businessPhone = String(body.businessPhone || body.business_phone_e164 || "").trim();
  const transferNumber = String(body.transferNumber || body.handoff_number || "").trim();
  if (!businessPhone) return NextResponse.json({ error: "businessPhone is required." }, { status: 400 });
  if (!/^\+[1-9]\d{7,14}$/.test(businessPhone)) return NextResponse.json({ error: "businessPhone must be an E.164 number." }, { status: 400 });
  if (transferNumber && !/^\+[1-9]\d{7,14}$/.test(transferNumber)) return NextResponse.json({ error: "transferNumber must be an E.164 number." }, { status: 400 });
  try {
    const wallet = await getFluxWalletSummary(auth.session.organizationId);
    const plan = getFluxPlanDefinition(wallet.planCode);
    if (!planIncludesChannel(plan.code, "voice")) return NextResponse.json({ error: "Voice calling is available on the Business plan and above." }, { status: 409 });
    const admin = createAdminClient();
    const elevenLabs = await admin.from("organization_integrations").select("id,provider,configuration,health").eq("organization_id", auth.session.organizationId).eq("provider", "elevenlabs").maybeSingle();
    if (elevenLabs.error) throw elevenLabs.error;
    const legacyTwilio = elevenLabs.data ? null : await admin.from("organization_integrations").select("id,provider,configuration,health").eq("organization_id", auth.session.organizationId).eq("provider", "twilio_voice").maybeSingle();
    if (legacyTwilio?.error) throw legacyTwilio.error;
    const existing = elevenLabs.data || legacyTwilio?.data || null;
    const configuration = { ...((existing?.configuration || {}) as Record<string, unknown>), business_phone_e164: businessPhone, transfer_number_e164: transferNumber || null, client_confirmed_at: new Date().toISOString(), client_confirmed_by: auth.session.userId };
    const payload = { organization_id: auth.session.organizationId, provider: existing?.provider === "twilio_voice" ? "elevenlabs" : (existing ? undefined : "elevenlabs"), display_name: "ElevenLabs Voice Calling", status: "configured", configuration: { ...configuration, provider: "elevenlabs", transport: "twilio_or_elevenlabs_phone" }, health: { state: "setup_pending", message: "Voice destination recorded; Fluxknight Super Admin must connect and publish the ElevenLabs Voice agent." }, updated_at: new Date().toISOString() };
    const query = existing?.id
      ? admin.from("organization_integrations").update(payload).eq("id", existing.id).eq("organization_id", auth.session.organizationId)
      : admin.from("organization_integrations").insert(payload);
    const { error } = await query;
    if (error) throw error;
    const gate = await getVoiceActivationGate(auth.session.organizationId);
    return NextResponse.json({ ok: true, gate, error: gate.ready ? null : voiceActivationError(gate) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save Voice setup details." }, { status: 500 });
  }
}
