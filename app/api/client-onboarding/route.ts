import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import {
  completeClientOnboarding,
  ensureClientOnboardingProfile,
  getClientOnboardingProfile,
  saveClientOnboardingProfile,
  type SaveOnboardingInput,
} from "@/lib/client-workspace-onboarding";

const allowedStatuses = new Set(["in_progress"]);
const allowedAgentKeys = new Set([
  "ai_sales_agent",
  "customer_support_agent",
  "whatsapp_agent",
  "voice_agent",
  "lead_generation_agent",
  "email_automation",
  "crm_automation",
  "custom_workflow",
]);

function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : undefined;
}

function cleanList(value: unknown, allowed?: Set<string>) {
  if (!Array.isArray(value)) return undefined;
  const items = [...new Set(value.map((item) => String(item).trim()).filter(Boolean))].slice(0, 30);
  return allowed ? items.filter((item) => allowed.has(item)) : items;
}

function parseStep(value: unknown) {
  const step = Number(value);
  if (!Number.isInteger(step) || step < 1 || step > 5) return undefined;
  return step;
}

function validateEmail(value: string | null | undefined, field: string) {
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error(`${field} must be a valid email address.`);
  }
}

function sanitizePayload(body: Record<string, unknown>): SaveOnboardingInput {
  const payload: SaveOnboardingInput = {
    current_step: parseStep(body.current_step),
    business_name: cleanText(body.business_name, 160),
    industry: cleanText(body.industry, 120),
    website: cleanText(body.website, 300),
    country: cleanText(body.country, 100),
    timezone: cleanText(body.timezone, 100),
    business_email: cleanText(body.business_email, 254),
    phone: cleanText(body.phone, 60),
    staff_size: cleanText(body.staff_size, 40),
    requested_agents: cleanList(body.requested_agents, allowedAgentKeys),
    business_goals: cleanList(body.business_goals),
    channels: cleanList(body.channels),
    existing_tools: cleanList(body.existing_tools),
    human_contact_name: cleanText(body.human_contact_name, 160),
    human_contact_email: cleanText(body.human_contact_email, 254),
    notes: cleanText(body.notes, 5000),
  };

  validateEmail(payload.business_email, "Business email");
  validateEmail(payload.human_contact_email, "Human contact email");

  if (body.status && !allowedStatuses.has(String(body.status))) {
    throw new Error("Client onboarding status cannot be changed from this form.");
  }

  return payload;
}

function statusFromError(error: unknown) {
  const message = error instanceof Error ? error.message : "Onboarding request failed.";
  if (/authentication required/i.test(message)) return 401;
  if (/not found/i.test(message)) return 404;
  if (/required|select at least|valid email|cannot be changed|invalid/i.test(message)) return 400;
  if (/not configured/i.test(message)) return 503;
  return 500;
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Onboarding request failed.";
  console.error("Client onboarding API error", error);
  return NextResponse.json({ error: message }, { status: statusFromError(error) });
}

async function requireSession() {
  const session = await getClientSession();
  if (!session) throw new Error("Authentication required.");
  return session;
}

export async function GET() {
  try {
    const session = await requireSession();
    const profile = await ensureClientOnboardingProfile({
      organizationId: session.organizationId,
      membershipId: session.membershipId,
      userId: session.userId,
      businessName: session.organizationSlug,
      email: session.email,
    });

    return NextResponse.json({ profile });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const payload = sanitizePayload(body);

    await ensureClientOnboardingProfile({
      organizationId: session.organizationId,
      membershipId: session.membershipId,
      userId: session.userId,
      businessName: session.organizationSlug,
      email: session.email,
    });

    const profile = await saveClientOnboardingProfile(session.organizationId, session.userId, payload);
    if (!profile) throw new Error("Onboarding profile could not be updated.");

    return NextResponse.json({ profile });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.action !== "complete") {
      return NextResponse.json({ error: "Unsupported onboarding action." }, { status: 400 });
    }

    const profile = await getClientOnboardingProfile(session.organizationId);
    if (!profile) throw new Error("Onboarding profile not found.");
    if (!profile.business_name?.trim() || !profile.industry?.trim()) {
      throw new Error("Business name and industry are required.");
    }
    if (!profile.requested_agents?.length) throw new Error("Select at least one AI agent.");
    if (!profile.business_goals?.length) throw new Error("Select at least one business goal.");
    if (!profile.human_contact_email?.trim()) throw new Error("A human contact email is required.");
    validateEmail(profile.human_contact_email, "Human contact email");

    const result = await completeClientOnboarding(session.organizationId, session.userId);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return failure(error);
  }
}
