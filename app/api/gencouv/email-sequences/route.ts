import { NextResponse } from "next/server";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

const GENCOUV_ORG_ID = "05737e03-f8f0-4202-8e9b-0a8982a1091c";

function cleanText(value: unknown, max = 20000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export async function GET() {
  try {
    const sequences = await supabaseServerRequest<any[]>(
      `gencouv_email_sequences?select=*,gencouv_email_sequence_steps(*)&organization_id=eq.${GENCOUV_ORG_ID}&order=created_at.asc`,
    );

    return NextResponse.json({
      success: true,
      sequences: sequences.map((sequence) => ({
        ...sequence,
        steps: [...(sequence.gencouv_email_sequence_steps || [])].sort(
          (a: any, b: any) => a.step_order - b.step_order,
        ),
        gencouv_email_sequence_steps: undefined,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to load sequences." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sequenceId = cleanText(body.sequence_id, 100);
    const senderName = cleanText(body.sender_name, 120) || "Gencouv";
    const senderEmail = cleanText(body.sender_email, 200) || "info@gencouv.com";
    const replyToEmail = cleanText(body.reply_to_email, 200) || "support@gencouv.com";
    const name = cleanText(body.name, 160) || "Gencouv email sequence";
    const description = cleanText(body.description, 1000);
    const status = ["draft", "active", "paused", "archived"].includes(body.status) ? body.status : "draft";
    const dailyLimit = clampInt(body.daily_limit, 1, 500, 10);
    const steps = Array.isArray(body.steps) ? body.steps.slice(0, 30) : [];

    if (!steps.length) {
      return NextResponse.json({ success: false, message: "Add at least one email step." }, { status: 400 });
    }

    const sequencePayload = {
      organization_id: GENCOUV_ORG_ID,
      name,
      description,
      status,
      sender_name: senderName,
      sender_email: senderEmail,
      reply_to_email: replyToEmail,
      daily_limit: dailyLimit,
      resend_domain: "gencouv.com",
      updated_at: new Date().toISOString(),
    };

    let savedSequence: any;
    if (sequenceId) {
      const rows = await supabaseServerRequest<any[]>(
        `gencouv_email_sequences?id=eq.${encodeURIComponent(sequenceId)}&organization_id=eq.${GENCOUV_ORG_ID}`,
        { method: "PATCH", body: JSON.stringify(sequencePayload) },
      );
      savedSequence = rows[0];
    } else {
      const rows = await supabaseServerRequest<any[]>("gencouv_email_sequences", {
        method: "POST",
        body: JSON.stringify({ ...sequencePayload, created_at: new Date().toISOString() }),
      });
      savedSequence = rows[0];
    }

    if (!savedSequence?.id) throw new Error("Supabase did not return a saved sequence.");

    const existing = await supabaseServerRequest<any[]>(
      `gencouv_email_sequence_steps?select=id&sequence_id=eq.${savedSequence.id}`,
    );
    const incomingIds = new Set(steps.map((step: any) => cleanText(step.id, 100)).filter(Boolean));

    for (const oldStep of existing) {
      if (!incomingIds.has(oldStep.id)) {
        await supabaseServerRequest(`gencouv_email_sequence_steps?id=eq.${oldStep.id}`, { method: "DELETE" });
      }
    }

    const savedSteps = [];
    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index] || {};
      const stepId = cleanText(step.id, 100);
      const payload = {
        sequence_id: savedSequence.id,
        step_order: index + 1,
        name: cleanText(step.name, 160) || `Step ${index + 1}`,
        subject: cleanText(step.subject, 300),
        preview_text: cleanText(step.preview_text, 300),
        html_body: cleanText(step.html_body, 50000),
        text_body: cleanText(step.text_body, 50000),
        delay_minutes: clampInt(step.delay_minutes, 0, 525600, 0),
        resend_template_id: cleanText(step.resend_template_id, 200) || null,
        resend_template_alias: cleanText(step.resend_template_alias, 200) || null,
        is_enabled: step.is_enabled !== false,
        updated_at: new Date().toISOString(),
      };

      const rows = stepId
        ? await supabaseServerRequest<any[]>(`gencouv_email_sequence_steps?id=eq.${stepId}&sequence_id=eq.${savedSequence.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await supabaseServerRequest<any[]>("gencouv_email_sequence_steps", {
            method: "POST",
            body: JSON.stringify({ ...payload, created_at: new Date().toISOString() }),
          });

      const savedStep = rows[0];
      savedSteps.push(savedStep);

      const alias = payload.resend_template_alias;
      const apiKey = process.env.RESEND_API_KEY;
      if (alias && apiKey) {
        const updateResponse = await fetch(`https://api.resend.com/templates/${encodeURIComponent(alias)}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: payload.name,
            subject: payload.subject,
            from: `${senderName} <${senderEmail}>`,
            reply_to: replyToEmail,
            html: payload.html_body || undefined,
            text: payload.text_body || undefined,
          }),
        });
        if (!updateResponse.ok) {
          const detail = await updateResponse.text().catch(() => "");
          throw new Error(`Resend template update failed: ${detail || updateResponse.status}`);
        }

        const publishResponse = await fetch(`https://api.resend.com/templates/${encodeURIComponent(alias)}/publish`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!publishResponse.ok) {
          const detail = await publishResponse.text().catch(() => "");
          throw new Error(`Resend template publish failed: ${detail || publishResponse.status}`);
        }
      }
    }

    return NextResponse.json({ success: true, sequence: savedSequence, steps: savedSteps });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to save sequence." },
      { status: 500 },
    );
  }
}
