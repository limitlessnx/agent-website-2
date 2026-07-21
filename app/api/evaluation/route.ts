import { NextRequest, NextResponse } from "next/server";

type EvaluationPayload = {
  name?: string;
  email?: string;
  phone?: string;
  businessName?: string;
  businessType?: string;
  agentTypes?: string[];
  mainGoal?: string;
  currentTools?: string;
  leadVolume?: string;
  timeline?: string;
  budget?: string;
  preferredContactTime?: string;
  consent?: boolean;
};

const requiredStringFields: Array<keyof EvaluationPayload> = [
  "name",
  "email",
  "phone",
  "businessName",
  "businessType",
  "mainGoal",
  "leadVolume",
  "timeline",
  "budget",
];

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function saveToSupabase(row: Record<string, unknown>) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return { configured: false };
  }

  const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/evaluation_leads`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(`Supabase save failed: ${message}`);
  }

  return { configured: true, data: await res.json() };
}

async function sendToN8n(payload: Record<string, unknown>) {
  const webhookUrl = process.env.N8N_EVALUATION_WEBHOOK_URL;

  if (!webhookUrl) {
    return { configured: false };
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(`n8n webhook failed: ${message}`);
  }

  return { configured: true };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as EvaluationPayload;

    const normalized: EvaluationPayload = {
      name: sanitizeString(body.name),
      email: sanitizeString(body.email).toLowerCase(),
      phone: sanitizeString(body.phone),
      businessName: sanitizeString(body.businessName),
      businessType: sanitizeString(body.businessType),
      agentTypes: Array.isArray(body.agentTypes)
        ? body.agentTypes.map(sanitizeString).filter(Boolean)
        : [],
      mainGoal: sanitizeString(body.mainGoal),
      currentTools: sanitizeString(body.currentTools),
      leadVolume: sanitizeString(body.leadVolume),
      timeline: sanitizeString(body.timeline),
      budget: sanitizeString(body.budget),
      preferredContactTime: sanitizeString(body.preferredContactTime),
      consent: body.consent === true,
    };

    for (const field of requiredStringFields) {
      if (!normalized[field]) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }

    if (!isValidEmail(normalized.email || "")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    if (!normalized.agentTypes?.length) {
      return NextResponse.json({ error: "At least one agent type is required" }, { status: 400 });
    }

    if (!normalized.consent) {
      return NextResponse.json({ error: "Consent is required before an AI call can be triggered" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const lead = {
      name: normalized.name,
      email: normalized.email,
      phone: normalized.phone,
      business_name: normalized.businessName,
      business_type: normalized.businessType,
      agent_types: normalized.agentTypes,
      main_goal: normalized.mainGoal,
      current_tools: normalized.currentTools || null,
      lead_volume: normalized.leadVolume,
      timeline: normalized.timeline,
      budget: normalized.budget,
      preferred_contact_time: normalized.preferredContactTime || null,
      consent_given: normalized.consent,
      source: "website_evaluation",
      status: "new",
      submitted_at: now,
    };

    const supabaseResult = await saveToSupabase(lead);
    const n8nResult = await sendToN8n({
      event: "evaluation_request_created",
      lead,
      createdAt: now,
    });

    if (!supabaseResult.configured && !n8nResult.configured && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "No evaluation destination is configured" },
        { status: 503 }
      );
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[Evaluation Request]", lead);
    }

    return NextResponse.json(
      {
        success: true,
        destinations: {
          supabase: supabaseResult.configured,
          n8n: n8nResult.configured,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Evaluation API Error]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
