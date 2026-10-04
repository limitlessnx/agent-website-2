import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const clean = (v: unknown, max = 500) => typeof v === "string" ? v.trim().slice(0, max) : "";

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const industry = clean(b.industry, 120);
    const plan = clean(b.plan, 80);
    const c = b.contact || {};
    const name = clean(c.name);
    const email = clean(c.email, 320).toLowerCase();
    const phone = clean(c.phone, 80);
    const consent = c.consent === true;

    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone || !consent) {
      return NextResponse.json({ error: "Name, valid email, phone and consent are required before the evaluation starts." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.from("ai_business_evaluation_sessions").insert({
      industry: industry || null,
      context: { industry, plan },
      contact_name: name,
      contact_email: email,
      contact_phone: phone,
      contact_consent: true,
      status: "started",
    }).select("id").single();

    if (error) throw error;

    const messages = [{
      role: "assistant",
      content: `Thanks, ${name.split(/\s+/)[0]}. Let’s start with the business itself. What does your business do, who do you serve, and what would you most like to improve or automate?`,
    }];

    await admin.from("ai_business_evaluation_sessions")
      .update({ messages, updated_at: new Date().toISOString() })
      .eq("id", data.id);

    return NextResponse.json({ sessionId: data.id, messages, industry });
  } catch (error) {
    console.error("[evaluation/session]", error);
    return NextResponse.json({ error: "Unable to create the evaluation session. Please try again." }, { status: 500 });
  }
}
