import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type ResendEventPayload = Record<string, string | number | boolean | null>;

type SendLifecycleEventInput = {
  eventKey: string;
  event:
    | "fluxknight.user.verified"
    | "fluxknight.payment.succeeded"
    | "fluxknight.payment.failed"
    | "fluxknight.workspace.ready"
    | "fluxknight.provisioning.failed"
    | "fluxknight.onboarding.incomplete";
  email: string;
  payload: ResendEventPayload;
  userId?: string | null;
  organizationId?: string | null;
  paymentAttemptId?: string | null;
};

type DispatchResult =
  | { ok: true; skipped?: boolean; response?: unknown }
  | { ok: false; error: string };

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
 * Requests a trusted Fluxknight lifecycle event through Supabase.
 *
 * Supabase owns deduplication, the Resend credential in Vault, and the
 * outbound pg_net request. This keeps the Resend API key out of Vercel and
 * lets database-side lifecycle transitions use the exact same dispatcher.
 */
export async function sendFluxknightLifecycleEvent(input: SendLifecycleEventInput): Promise<DispatchResult> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("dispatch_fluxknight_lifecycle_event", {
    p_event_key: input.eventKey,
    p_event_type: input.event,
    p_recipient_email: input.email.trim().toLowerCase(),
    p_payload: input.payload,
    p_user_id: input.userId || null,
    p_organization_id: input.organizationId || null,
    p_payment_attempt_id: input.paymentAttemptId || null,
  });

  if (error) {
    console.error("Fluxknight lifecycle email dispatch failed", {
      eventKey: input.eventKey,
      event: input.event,
      error: error.message,
    });
    return { ok: false, error: error.message };
  }

  const response = data as { ok?: boolean; skipped?: boolean } | null;
  return {
    ok: true,
    skipped: Boolean(response?.skipped),
    response: data,
  };
}
