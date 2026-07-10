import { NextRequest, NextResponse } from "next/server";

/**
 * Contact Form API Route
 *
 * Current: logs submissions and returns success.
 *
 * TO CONNECT n8n WEBHOOK:
 * 1. Create an n8n workflow with a "Webhook" trigger node
 * 2. Copy the webhook URL from n8n (e.g. https://your-n8n.cloud/webhook/contact-form)
 * 3. Add to your .env.local:  N8N_WEBHOOK_URL=https://your-n8n.cloud/webhook/contact-form
 * 4. Uncomment the n8n fetch block below
 *
 * TO CONNECT SUPABASE:
 * 1. Create a table: contact_submissions (id, name, email, phone, business_type, automation_goal, budget, created_at)
 * 2. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local
 * 3. Use @supabase/supabase-js to insert the row
 *
 * TO CONNECT CALENDLY:
 * 1. After form submission, redirect to your Calendly link or embed it in a modal
 * 2. Pass ?name=...&email=... query params to pre-fill the form
 *
 * TO ADD EMAIL NOTIFICATION:
 * 1. Use Resend (resend.com) or SendGrid
 * 2. Send an internal notification email on every submission
 * 3. Send the user a confirmation email
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, businessType, automationGoal, budget } = body;

    // Basic server-side validation
    if (!name || !email || !businessType || !automationGoal || !budget) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const submission = {
      name,
      email,
      phone: phone || "",
      businessType,
      automationGoal,
      budget,
      submittedAt: new Date().toISOString(),
      source: "boundlessflux.ai/contact",
    };

    // ── Dev: log to console ───────────────────────────────────────────────────
    if (process.env.NODE_ENV === "development") {
      console.log("[Contact Form Submission]", submission);
    }

    // ── n8n Webhook (uncomment when ready) ────────────────────────────────────
    // const n8nUrl = process.env.N8N_WEBHOOK_URL;
    // if (n8nUrl) {
    //   await fetch(n8nUrl, {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify(submission),
    //   });
    // }

    // ── Supabase (uncomment when ready) ───────────────────────────────────────
    // import { createClient } from "@supabase/supabase-js";
    // const supabase = createClient(
    //   process.env.SUPABASE_URL!,
    //   process.env.SUPABASE_SERVICE_ROLE_KEY!
    // );
    // const { error: dbError } = await supabase
    //   .from("contact_submissions")
    //   .insert([submission]);
    // if (dbError) throw dbError;

    // ── Email notification (uncomment when ready) ─────────────────────────────
    // import { Resend } from "resend";
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: "notifications@boundlessflux.ai",
    //   to: "hello@boundlessflux.ai",
    //   subject: `New Contact Form: ${name} — ${businessType}`,
    //   text: JSON.stringify(submission, null, 2),
    // });

    return NextResponse.json(
      { success: true, message: "Submission received" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Contact API Error]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
