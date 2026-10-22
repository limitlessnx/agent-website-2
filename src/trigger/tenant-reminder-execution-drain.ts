import { schedules } from "@trigger.dev/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

export const tenantReminderExecutionDrain = schedules.task({
  id: "tenant-reminder-execution-drain",
  cron: { pattern: "*/5 * * * *", timezone: "Africa/Lagos" },
  run: async () => {
    const admin = createAdminClient();
    const { data: rows, error } = await admin.from("tenant_reminder_executions")
      .select("id,organization_id,rule_id,scheduled_for,channel,status")
      .eq("status", "queued").eq("channel", "internal")
      .lte("scheduled_for", new Date().toISOString()).order("scheduled_for", { ascending: true }).limit(100);
    if (error) throw error;
    let completed = 0;
    for (const row of rows || []) {
      const claim = await admin.from("tenant_reminder_executions")
        .update({ status: "processing", started_at: new Date().toISOString(), attempt_count: 1, updated_at: new Date().toISOString() })
        .eq("id", row.id).eq("organization_id", row.organization_id).eq("status", "queued").select("id").maybeSingle();
      if (claim.error) throw claim.error;
      if (!claim.data) continue;
      const { data: rule, error: ruleError } = await admin.from("tenant_reminder_rules")
        .select("name,description,status").eq("id", row.rule_id).eq("organization_id", row.organization_id).maybeSingle();
      if (ruleError) throw ruleError;
      if (!rule || rule.status !== "active") {
        const { error: skipError } = await admin.from("tenant_reminder_executions")
          .update({ status: "cancelled", completed_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: "Reminder rule was removed or paused before execution." })
          .eq("id", row.id).eq("organization_id", row.organization_id).eq("status", "processing");
        if (skipError) throw skipError;
        continue;
      }
      const { error: noticeError } = await admin.from("tenant_reminder_notifications").upsert({
        organization_id: row.organization_id, rule_id: row.rule_id, execution_id: row.id,
        title: rule.name, body: rule.description || "A scheduled reminder rule is due.",
      }, { onConflict: "organization_id,execution_id", ignoreDuplicates: true });
      if (noticeError) {
        await admin.from("tenant_reminder_executions").update({ status: "failed", attempt_count: 1, last_error: "Could not create internal reminder notification.", updated_at: new Date().toISOString() }).eq("id", row.id).eq("organization_id", row.organization_id);
        throw noticeError;
      }
      const { error: finishError } = await admin.from("tenant_reminder_executions")
        .update({ status: "sent", completed_at: new Date().toISOString(), updated_at: new Date().toISOString(), result: { reason: "internal_notification_created" }, last_error: null })
        .eq("id", row.id).eq("organization_id", row.organization_id).eq("status", "processing");
      if (finishError) throw finishError;
      completed++;
    }
    return { considered: rows?.length || 0, completed };
  },
});
