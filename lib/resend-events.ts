import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type ResendEventPayload = Record<string, string | number | boolean | null>;

type SendLifecycleEventInput = {
  eventKey: string;
  event: "fluxknight.user.verified" | "fluxknight.payment.succeeded" | "fluxknight.workspace.ready";
  email: string;
  payload: ResendEventPayload;
  userId?: string | null;
  organizationId?: string | null;
  paymentAttemptId?: string | null;
};

type DispatchResult =
  | { ok: true; skipped?: boolean; response?: unknown }
  | { ok: false; error: string };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function fluxknightPortalUrl() {
  const configured = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "https://fluxknight.space"
  ).trim();

  const origin = configured.startsWith("http://") || configured.startsWith("https://")
    ? configured
    : `https://${configured}`;

  return `${origin.replace(/\/$/, "")}/portal`;
}

/**
 * Dispatches a trusted application event to Resend Automations.
 *
 * The database event key is the source of idempotency because Resend's
 * Idempotency-Key header currently applies to /emails and /emails/batch,
 * not the custom /events endpoint.
 */
export async function sendFluxknightLifecycleEvent(input: SendLifecycleEventInput): Promise<DispatchResult> {
  const admin = createAdminClient();

  const record = {
    event_key: input.eventKey,
    event_type: input.event,
    user_id: input.userId || null,
    organization_id: input.organizationId || null,
    payment_attempt_id: input.paymentAttemptId || null,
    recipient_email: input.email.trim().toLowerCase(),
    payload: input.payload,
    status: "pending",
    updated_at: new Date().toISOString(),
  };

  const { error: insertError } = await admin.from("transactional_email_events").insert(record);

  if (insertError) {
    if (insertError.code !== "23505") {
      console.error("Unable to claim Fluxknight lifecycle email event", {
        eventKey: input.eventKey,
        event: input.event,
        error: insertError.message,
      });
      return { ok: false, error: insertError.message };
    }

    const { data: existing, error: existingError } = await admin
      .from("transactional_email_events")
      .select("status")
      .eq("event_key", input.eventKey)
      .maybeSingle();

    if (existingError) return { ok: false, error: existingError.message };
    if (existing?.status === "sent" || existing?.status === "pending") {
      return { ok: true, skipped: true };
    }

    const { error: retryError } = await admin
      .from("transactional_email_events")
      .update({
        status: "pending",
        last_error: null,
        payload: input.payload,
        recipient_email: record.recipient_email,
        updated_at: new Date().toISOString(),
      })
      .eq("event_key", input.eventKey)
      .eq("status", "failed");

    if (retryError) return { ok: false, error: retryError.message };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    const message = "RESEND_API_KEY is not configured.";
    await admin
      .from("transactional_email_events")
      .update({ status: "failed", last_error: message, updated_at: new Date().toISOString() })
      .eq("event_key", input.eventKey);
    console.error("Fluxknight lifecycle email not dispatched", { eventKey: input.eventKey, error: message });
    return { ok: false, error: message };
  }

  try {
    const response = await fetch("https://api.resend.com/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "fluxknight/1.0",
      },
      body: JSON.stringify({
        event: input.event,
        email: record.recipient_email,
        payload: input.payload,
      }),
      cache: "no-store",
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = typeof result?.message === "string"
        ? result.message
        : `Resend event request failed with status ${response.status}.`;

      await admin
        .from("transactional_email_events")
        .update({
          status: "failed",
          last_error: message,
          provider_response: result,
          updated_at: new Date().toISOString(),
        })
        .eq("event_key", input.eventKey);

      console.error("Resend lifecycle event failed", {
        eventKey: input.eventKey,
        event: input.event,
        status: response.status,
        error: message,
      });
      return { ok: false, error: message };
    }

    await admin
      .from("transactional_email_events")
      .update({
        status: "sent",
        provider_response: result,
        last_error: null,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("event_key", input.eventKey);

    return { ok: true, response: result };
  } catch (error) {
    const message = errorMessage(error);
    await admin
      .from("transactional_email_events")
      .update({ status: "failed", last_error: message, updated_at: new Date().toISOString() })
      .eq("event_key", input.eventKey);
    console.error("Resend lifecycle event connection failed", {
      eventKey: input.eventKey,
      event: input.event,
      error: message,
    });
    return { ok: false, error: message };
  }
}
