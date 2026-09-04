import { NextRequest, NextResponse } from "next/server";

type ContactPayload = {
  name?: string;
  email?: string;
  phone?: string;
  businessName?: string;
  businessType?: string;
  automationGoal?: string;
  budget?: string;
  consent?: boolean;
};

function sanitizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function saveToSupabase(row: Record<string, unknown>) {
  const supabaseUrl =
    process.env.LIMITLESS_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return { configured: false };

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/evaluation_leads`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });

  if (!response.ok) throw new Error(`Supabase save failed: ${await response.text()}`);
  return { configured: true, data: await response.json() };
}

async function sendToN8n(payload: Record<string, unknown>) {
  const webhookUrl = process.env.N8N_CONTACT_WEBHOOK_URL || process.env.N8N_EVALUATION_WEBHOOK_URL;
  if (!webhookUrl) return { configured: false };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`n8n webhook failed: ${await response.text()}`);
  return { configured: true };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ContactPayload;
    const normalized = {
      name: sanitizeString(body.name),
      email: sanitizeString(body.email).toLowerCase(),
      phone: sanitizeString(body.phone),
      businessName: sanitizeString(body.businessName),
      businessType: sanitizeString(body.businessType),
      automationGoal: sanitizeString(body.automationGoal),
      budget: sanitizeString(body.budget),
      consent: body.consent === true,
    };

    if (!normalized.name || !normalized.email || !normalized.businessName || !normalized.businessType || !normalized.automationGoal || !normalized.budget) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!isValidEmail(normalized.email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    if (!normalized.consent) {
      return NextResponse.json({ error: "Consent is required before we can follow up on this request" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const lead = {
      name: normalized.name,
      email: normalized.email,
      phone: normalized.phone || "Not provided",
      business_name: normalized.businessName,
      business_type: normalized.businessType,
      agent_types: [],
      main_goal: normalized.automationGoal,
      current_tools: null,
      lead_volume: "Not provided via contact",
      timeline: "Not provided via contact",
      budget: normalized.budget,
      preferred_contact_time: null,
      consent_given: true,
      source: "website_contact",
      status: "new",
      submitted_at: now,
    };

    const supabaseResult = await saveToSupabase(lead);
    const n8nResult = await sendToN8n({ event: "contact_request_created", lead, createdAt: now });

    if (!supabaseResult.configured && !n8nResult.configured && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "No contact destination is configured" }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      destinations: { supabase: supabaseResult.configured, n8n: n8nResult.configured },
    });
  } catch (error) {
    console.error("[Contact API Error]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
