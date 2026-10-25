import { schedules } from "@trigger.dev/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_ATTEMPTS = 5;
const STALE_PROCESSING_MINUTES = 15;

export const tenantAppointmentReminderDrain = schedules.task({
  id: "tenant-appointment-reminder-drain",
  cron: { pattern: "*/5 * * * *", timezone: "Africa/Lagos" },
  run: async () => {
    const admin = createAdminClient();
    const now = new Date();
    const nowIso = now.toISOString();
    const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MINUTES * 60_000).toISOString();

    // Recover claims left behind by a crashed worker. The normal claim below remains
    // compare-and-set, so two workers cannot process the same queued row at once.
    const { error: recoveryError } = await admin
      .from("tenant_appointment_reminders")
      .update({
        status: "queued",
        last_error: "Recovered stale processing claim.",
        updated_at: nowIso,
      })
      .eq("status", "processing")
      .lt("updated_at", staleBefore);
    if (recoveryError) throw recoveryError;

    const { data, error } = await admin
      .from("tenant_appointment_reminders")
      .select("id,organization_id,appointment_id,reminder_offset_minutes,attempt_count")
      .eq("status", "queued")
      .lte("scheduled_for", nowIso)
      .order("scheduled_for", { ascending: true })
      .limit(100);
    if (error) throw error;

    let processed = 0;
    let failed = 0;
    let deferred = 0;

    for (const row of data || []) {
      const nextAttempt = Number(row.attempt_count || 0) + 1;
      const { data: claim, error: claimError } = await admin
        .from("tenant_appointment_reminders")
        .update({ status: "processing", attempt_count: nextAttempt, updated_at: new Date().toISOString() })
        .eq("organization_id", row.organization_id)
        .eq("id", row.id)
        .eq("status", "queued")
        .select("id")
        .maybeSingle();

      if (claimError) throw claimError;
      if (!claim) continue;

      try {
        const { data: appointment, error: appointmentError } = await admin
          .from("appointments")
          .select("id,title,status,start_at,timezone")
          .eq("organization_id", row.organization_id)
          .eq("id", row.appointment_id)
          .maybeSingle();

        if (appointmentError) throw appointmentError;

        if (
          !appointment ||
          !["confirmed", "rescheduled"].includes(appointment.status) ||
          !appointment.start_at ||
          new Date(appointment.start_at) <= new Date()
        ) {
          const { error: cancelError } = await admin
            .from("tenant_appointment_reminders")
            .update({
              status: "cancelled",
              last_error: "Appointment is no longer upcoming and confirmed.",
              updated_at: new Date().toISOString(),
            })
            .eq("organization_id", row.organization_id)
            .eq("id", row.id)
            .eq("status", "processing");
          if (cancelError) throw cancelError;
          continue;
        }

        const { error: notificationError } = await admin
          .from("tenant_appointment_reminder_notifications")
          .upsert(
            {
              organization_id: row.organization_id,
              appointment_id: row.appointment_id,
              reminder_id: row.id,
              title: "Upcoming appointment: " + String(appointment.title || "Appointment"),
              body:
                "Confirmed for " +
                new Date(appointment.start_at).toLocaleString("en-US", {
                  timeZone: appointment.timezone || "Africa/Lagos",
                }) +
                ". Reminder " +
                row.reminder_offset_minutes +
                " minutes before.",
            },
            { onConflict: "organization_id,reminder_id", ignoreDuplicates: true },
          );
        if (notificationError) throw notificationError;

        const { error: finishError } = await admin
          .from("tenant_appointment_reminders")
          .update({
            status: "sent",
            result: { reason: "internal_notification_created" },
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", row.organization_id)
          .eq("id", row.id)
          .eq("status", "processing");
        if (finishError) throw finishError;
        processed++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const terminal = nextAttempt >= MAX_ATTEMPTS;
        const { error: recoveryUpdateError } = await admin
          .from("tenant_appointment_reminders")
          .update({
            status: terminal ? "failed" : "queued",
            last_error: message.slice(0, 2000),
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", row.organization_id)
          .eq("id", row.id)
          .eq("status", "processing");

        if (recoveryUpdateError) {
          throw new Error(
            "Reminder processing failed (" +
              message +
              ") and status recovery failed (" +
              recoveryUpdateError.message +
              ").",
          );
        }

        if (terminal) failed++;
        else deferred++;
      }
    }

    return {
      considered: data?.length || 0,
      processed,
      failed,
      deferred,
      staleClaimsRecoveredBeforeRun: true,
    };
  },
});
