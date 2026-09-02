import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fluxknightPortalUrl, sendFluxknightLifecycleEvent } from "@/lib/resend-events";

function firstName(value: string, email: string) {
  return value.trim().split(/\s+/)[0] || email.split("@")[0] || "there";
}

function failureReason(data: Record<string, unknown>) {
  const gateway = String(data.gateway_response || "").trim();
  const message = String(data.message || "").trim();
  const status = String(data.status || "failed").trim();
  return gateway || message || `Payment status: ${status}`;
}

async function authorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (cronSecret && supplied === cronSecret) return true;

  const schedulerToken = request.headers.get("x-maia-scheduler-token")?.trim();
  if (!schedulerToken) return false;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("verify_maia_scheduler_secret", { candidate: schedulerToken });
  return !error && data === true;
}

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secret) return NextResponse.json({ error: "Paystack is not configured." }, { status: 503 });

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const oldest = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

  const { data: attempts, error } = await admin
    .from("payment_attempts")
    .select("id,organization_id,provider_reference,amount,currency,created_by,created_at")
    .eq("provider", "paystack")
    .eq("status", "pending")
    .lte("created_at", cutoff)
    .gte("created_at", oldest)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) throw error;

  const results: Array<{ id: string; status: string; notified?: boolean; error?: string }> = [];

  for (const attempt of attempts || []) {
    try {
      const response = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(attempt.provider_reference)}`,
        {
          headers: { Authorization: `Bearer ${secret}` },
          cache: "no-store",
        },
      );
      const verified = await response.json().catch(() => ({}));
      if (!response.ok || !verified?.status || !verified?.data) {
        results.push({ id: attempt.id, status: "verification_error", error: String(verified?.message || response.status) });
        continue;
      }

      const transactionStatus = String(verified.data.status || "").toLowerCase();
      if (!["failed", "abandoned", "reversed"].includes(transactionStatus)) {
        results.push({ id: attempt.id, status: transactionStatus || "unknown" });
        continue;
      }

      const localStatus = transactionStatus === "abandoned" ? "cancelled" : "failed";
      const { data: claimed, error: updateError } = await admin
        .from("payment_attempts")
        .update({
          status: localStatus,
          provider_payload: verified.data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", attempt.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (updateError) throw updateError;

      // Another request may have marked this payment paid after our initial read.
      // Only the request that actually transitions pending -> failed/cancelled may notify.
      if (!claimed?.id) {
        results.push({ id: attempt.id, status: "state_changed" });
        continue;
      }

      let email = String(verified.data?.customer?.email || "").trim().toLowerCase();
      let fullName = String(verified.data?.customer?.first_name || "").trim();
      if (attempt.created_by) {
        const userResult = await admin.auth.admin.getUserById(attempt.created_by);
        const user = userResult.data?.user;
        email = String(user?.email || email).trim().toLowerCase();
        fullName = String(user?.user_metadata?.full_name || fullName).trim();
      }

      let notified = false;
      if (email) {
        const lifecycle = await sendFluxknightLifecycleEvent({
          eventKey: `payment-failed:${attempt.id}`,
          event: "fluxknight.payment.failed",
          email,
          userId: attempt.created_by || null,
          organizationId: attempt.organization_id,
          paymentAttemptId: attempt.id,
          payload: {
            first_name: firstName(fullName, email),
            amount: String(attempt.amount),
            currency: String(attempt.currency || ""),
            reason: failureReason(verified.data as Record<string, unknown>),
            retry_url: fluxknightPortalUrl(),
          },
        });
        notified = lifecycle.ok;
      }

      results.push({ id: attempt.id, status: localStatus, notified });
    } catch (itemError) {
      results.push({
        id: attempt.id,
        status: "error",
        error: itemError instanceof Error ? itemError.message : String(itemError),
      });
    }
  }

  return NextResponse.json({ ok: true, checked: attempts?.length || 0, results });
}
