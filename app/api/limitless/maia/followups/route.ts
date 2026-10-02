import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const LIMITLESS_REALTY_SLUG = "limitless-realty";
const CANONICAL_ROUTE = "existing-limitless-realty-maia-n8n";
const DEFAULT_INACTIVITY_HOURS = 24;

async function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (secret && supplied && supplied === secret) return true;

  const schedulerToken = request.headers.get("x-maia-scheduler-token")?.trim();
  if (!schedulerToken) return false;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("verify_maia_scheduler_secret", { candidate: schedulerToken });
  return !error && data === true;
}

async function sendViaCanonicalMaia(to: string, message: string) {
  const webhook =
    process.env.LIMITLESS_REALTY_MAIA_N8N_WEBHOOK_URL?.trim() ||
    process.env.LIMITLESS_REALTY_N8N_WEBHOOK_URL?.trim() ||
    process.env.N8N_LIMITLESS_REALTY_MAIA_WEBHOOK_URL?.trim();

  if (!webhook) {
    throw new Error(
      "Canonical Limitless Realty Maia n8n webhook is not configured. Follow-up was not sent through another WhatsApp route.",
    );
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channel: "whatsapp",
      to,
      message,
      source: "maia_followup",
      tenant: LIMITLESS_REALTY_SLUG,
      agent: "maia",
      route: CANONICAL_ROUTE,
    }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Canonical Maia WhatsApp workflow failed (${response.status}).`);
  return CANONICAL_ROUTE;
}

async function loadFollowUpGuardrails(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
) {
  const { data, error } = await admin
    .from("organization_follow_up_policies")
    .select("qualification")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;

  const qualification =
    data?.qualification &&
    typeof data.qualification === "object" &&
    !Array.isArray(data.qualification)
      ? (data.qualification as Record<string, unknown>)
      : {};

  const configuredHours = Number(qualification.inactivity_hours);
  const inactivityHours =
    Number.isFinite(configuredHours) && configuredHours > 0
      ? configuredHours
      : DEFAULT_INACTIVITY_HOURS;

  return { inactivityHours };
}

async function latestCustomerMessageAt(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  agentId: string,
  phone: string,
) {
  const { data, error } = await admin
    .from("maia_inbound_events")
    .select("received_at,status")
    .eq("organization_id", organizationId)
    .eq("agent_id", agentId)
    .eq("channel", "whatsapp")
    .eq("external_conversation_id", phone)
    .in("status", ["received", "processing", "completed"])
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.received_at || null;
}

async function cancelFollowUp(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  id: string,
  reason: string,
  extra: Record<string, unknown> = {},
) {
  await admin
    .from("follow_ups")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("organization_id", organizationId);

  return { id, status: "cancelled", reason, ...extra };
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: organization } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", LIMITLESS_REALTY_SLUG)
    .maybeSingle();

  if (!organization) {
    return NextResponse.json(
      { error: "Limitless Realty organization is not configured." },
      { status: 500 },
    );
  }

  const { data: maia } = await admin
    .from("agents")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("slug", "maia")
    .in("status", ["published", "active"])
    .maybeSingle();

  if (!maia) {
    return NextResponse.json(
      { error: "Canonical Limitless Realty Maia is not configured." },
      { status: 500 },
    );
  }

  const guardrails = await loadFollowUpGuardrails(admin, organization.id);
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: rows, error } = await admin
    .from("follow_ups")
    .select(
      "id,organization_id,lead_id,scheduled_at,message_sent,status,leads!follow_ups_lead_id_fkey(phone,name,opted_out)",
    )
    .eq("organization_id", organization.id)
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(25);

  if (error) {
    return NextResponse.json({ error: "Unable to load due follow-ups." }, { status: 500 });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const row of rows || []) {
    try {
      const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;
      const phone = String((lead as any)?.phone || "").replace(/[^\d]/g, "");

      const { data: handoffConversation } = phone
        ? await admin
            .from("agent_conversations")
            .select("id,ai_paused,status")
            .eq("organization_id", organization.id)
            .eq("external_thread_key", phone)
            .maybeSingle()
        : { data: null };

      if (!phone) {
        results.push(await cancelFollowUp(admin, organization.id, row.id, "missing_phone"));
        continue;
      }

      if (Boolean((lead as any)?.opted_out)) {
        results.push(await cancelFollowUp(admin, organization.id, row.id, "opted_out"));
        continue;
      }

      if (
        Boolean((handoffConversation as any)?.ai_paused) ||
        ["handoff", "human_handoff"].includes(String((handoffConversation as any)?.status || ""))
      ) {
        results.push(await cancelFollowUp(admin, organization.id, row.id, "human_handoff"));
        continue;
      }

      const lastCustomerMessageAt = await latestCustomerMessageAt(
        admin,
        organization.id,
        maia.id,
        phone,
      );

      if (!lastCustomerMessageAt) {
        results.push(
          await cancelFollowUp(
            admin,
            organization.id,
            row.id,
            "no_customer_message_context",
          ),
        );
        continue;
      }

      const lastCustomerMessageMs = new Date(lastCustomerMessageAt).getTime();
      const scheduledMs = new Date(String(row.scheduled_at)).getTime();

      if (Number.isNaN(lastCustomerMessageMs)) {
        results.push(
          await cancelFollowUp(
            admin,
            organization.id,
            row.id,
            "invalid_customer_message_timestamp",
          ),
        );
        continue;
      }

      if (!Number.isNaN(scheduledMs) && lastCustomerMessageMs >= scheduledMs) {
        results.push(
          await cancelFollowUp(
            admin,
            organization.id,
            row.id,
            "customer_replied_after_schedule",
            { last_customer_message_at: lastCustomerMessageAt },
          ),
        );
        continue;
      }

      const inactivityMs = guardrails.inactivityHours * 60 * 60 * 1000;
      if (now.getTime() - lastCustomerMessageMs < inactivityMs) {
        results.push(
          await cancelFollowUp(
            admin,
            organization.id,
            row.id,
            "inactivity_window_not_reached",
            {
              inactivity_hours: guardrails.inactivityHours,
              last_customer_message_at: lastCustomerMessageAt,
            },
          ),
        );
        continue;
      }

      const provider = await sendViaCanonicalMaia(phone, String(row.message_sent || ""));
      await admin
        .from("follow_ups")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("organization_id", organization.id)
        .eq("status", "pending");

      results.push({
        id: row.id,
        status: "sent",
        provider,
        last_customer_message_at: lastCustomerMessageAt,
      });
    } catch (error) {
      results.push({
        id: row.id,
        status: "failed",
        error: error instanceof Error ? error.message : "Follow-up failed",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    guardrails: {
      inactivity_hours: guardrails.inactivityHours,
    },
    results,
  });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
