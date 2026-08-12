import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import type { FollowupEnrollment, FollowupSequence, FollowupStep } from "@/lib/followup-control";

export type FollowupTimingStatus = "upcoming" | "due" | "overdue" | "completed" | "failed" | "cancelled" | "paused" | "unscheduled";

export type DueFollowupItem = {
  task_id: string;
  enrollment_id: string;
  organization_id: string;
  sequence_id: string;
  step_id: string;
  lead_id: string;
  lead_name: string | null;
  lead_phone: string | null;
  channel: FollowupStep["channel"];
  current_step: number;
  scheduled_for: string;
  sequence_name: string;
  step_title: string | null;
  message_template: string | null;
  workflow_id: string | null;
  idempotency_key: string;
  input: {
    enrollment_id: string;
    sequence_id: string;
    step_id: string;
    lead_id: string;
    lead_name: string | null;
    lead_phone: string | null;
    message_template: string | null;
  };
};

export type FollowupDueRuntimeResult = {
  items: DueFollowupItem[];
  skipped: Array<{ enrollment_id: string; reason: string }>;
  checked: number;
};

const overdueAfterMs = 24 * 60 * 60 * 1000;

export function classifyFollowupEnrollment(enrollment: Pick<FollowupEnrollment, "status" | "next_run_at">, now = new Date()): FollowupTimingStatus {
  if (enrollment.status === "completed") return "completed";
  if (enrollment.status === "failed") return "failed";
  if (enrollment.status === "cancelled") return "cancelled";
  if (enrollment.status === "paused") return "paused";
  if (!enrollment.next_run_at) return "unscheduled";

  const scheduled = new Date(enrollment.next_run_at).getTime();
  const current = now.getTime();
  if (Number.isNaN(scheduled)) return "unscheduled";
  if (scheduled > current) return "upcoming";
  if (current - scheduled >= overdueAfterMs) return "overdue";
  return "due";
}

export function summarizeFollowupStatuses(enrollments: FollowupEnrollment[], now = new Date()) {
  return enrollments.reduce<Record<FollowupTimingStatus, number>>((acc, enrollment) => {
    const status = classifyFollowupEnrollment(enrollment, now);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, { upcoming: 0, due: 0, overdue: 0, completed: 0, failed: 0, cancelled: 0, paused: 0, unscheduled: 0 });
}

function encode(value: string) {
  return encodeURIComponent(value);
}

function mapById<T extends { id: string }>(rows: T[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

export async function loadDueFollowups(input: { limit: number; organizationId?: string; now?: Date }): Promise<FollowupDueRuntimeResult> {
  const now = input.now || new Date();
  const limit = Math.max(1, Math.min(Number.isFinite(input.limit) ? input.limit : 100, 250));
  const organizationFilter = input.organizationId ? `&organization_id=eq.${encode(input.organizationId)}` : "";
  const enrollments = await supabaseServerRequest<FollowupEnrollment[]>(
    `followup_enrollments?status=eq.active&next_run_at=lte.${encode(now.toISOString())}${organizationFilter}&select=*&order=next_run_at.asc&limit=${limit}`,
  );

  const sequenceIds = [...new Set(enrollments.map((item) => item.sequence_id).filter(Boolean))];
  if (!sequenceIds.length) return { items: [], skipped: [], checked: 0 };

  const sequenceList = sequenceIds.map(encode).join(",");
  const [sequences, steps] = await Promise.all([
    supabaseServerRequest<FollowupSequence[]>(`followup_sequences?id=in.(${sequenceList})&select=*`),
    supabaseServerRequest<FollowupStep[]>(`followup_sequence_steps?sequence_id=in.(${sequenceList})&enabled=eq.true&select=*&order=sequence_id,position`),
  ]);

  const sequenceById = mapById(sequences);
  const stepBySequenceAndPosition = new Map(steps.map((step) => [`${step.sequence_id}:${step.position}`, step]));
  const skipped: FollowupDueRuntimeResult["skipped"] = [];
  const items: DueFollowupItem[] = [];

  for (const enrollment of enrollments) {
    const sequence = sequenceById.get(enrollment.sequence_id);
    if (!sequence || sequence.status !== "active") {
      skipped.push({ enrollment_id: enrollment.id, reason: "Sequence is not active." });
      continue;
    }

    const step = stepBySequenceAndPosition.get(`${enrollment.sequence_id}:${enrollment.current_step}`);
    if (!step) {
      skipped.push({ enrollment_id: enrollment.id, reason: "Current sequence step is missing or disabled." });
      continue;
    }

    if (!enrollment.lead_phone && step.channel === "whatsapp") {
      skipped.push({ enrollment_id: enrollment.id, reason: "Lead has no WhatsApp phone number." });
      continue;
    }

    const taskId = `followup:${enrollment.id}:step:${enrollment.current_step}`;
    items.push({
      task_id: taskId,
      enrollment_id: enrollment.id,
      organization_id: enrollment.organization_id,
      sequence_id: enrollment.sequence_id,
      step_id: step.id,
      lead_id: enrollment.lead_id,
      lead_name: enrollment.lead_name,
      lead_phone: enrollment.lead_phone,
      channel: step.channel,
      current_step: enrollment.current_step,
      scheduled_for: enrollment.next_run_at || now.toISOString(),
      sequence_name: sequence.name,
      step_title: step.title,
      message_template: step.message_template,
      workflow_id: step.workflow_id,
      idempotency_key: `crm-follow-up:${enrollment.id}:${enrollment.current_step}`,
      input: {
        enrollment_id: enrollment.id,
        sequence_id: enrollment.sequence_id,
        step_id: step.id,
        lead_id: enrollment.lead_id,
        lead_name: enrollment.lead_name,
        lead_phone: enrollment.lead_phone,
        message_template: step.message_template,
      },
    });
  }

  return { items, skipped, checked: enrollments.length };
}
