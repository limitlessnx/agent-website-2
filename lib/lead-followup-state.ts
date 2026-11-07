import { createAdminClient } from "@/lib/supabase/admin";

export type LeadFollowupState = { active: boolean; paused: boolean; needsReview: boolean };
type Sequence = { id: string; lead_id: string | null; status: string; consent_state: string };
type Issue = { sequence_id: string | null; status: string };

export function summarizeLeadFollowups(sequences: Sequence[], issues: Issue[]) {
  const problemIds = new Set(issues.filter(step => ["unknown", "failed", "error"].includes(step.status)).map(step => step.sequence_id));
  const states: Record<string, LeadFollowupState> = {};
  for (const sequence of sequences) {
    if (!sequence.lead_id || !["active", "paused"].includes(sequence.status)) continue;
    const state = states[sequence.lead_id] ||= { active: false, paused: false, needsReview: false };
    state.active ||= sequence.status === "active";
    state.paused ||= sequence.status === "paused";
    state.needsReview ||= sequence.consent_state !== "opted_in" || problemIds.has(sequence.id);
  }
  return states;
}

export async function getLeadFollowupStates(organizationId: string) {
  const admin = createAdminClient();
  const sequences = await admin.from("limitless_maia_followup_sequences")
    .select("id,lead_id,status,consent_state", { count: "exact" }).eq("organization_id", organizationId)
    .in("status", ["active", "paused"]).limit(1000);
  if (sequences.error || (sequences.count ?? sequences.data?.length ?? 0) > 1000) throw new Error("Unable to load complete follow-up state.");
  const rows = (sequences.data || []) as Sequence[];
  const batches: Sequence[][] = [];
  for (let index = 0; index < rows.length; index += 50) batches.push(rows.slice(index, index + 50));
  const results = await Promise.all(batches.map(batch => admin.from("follow_ups")
    .select("sequence_id,status", { count: "exact" }).eq("organization_id", organizationId)
    .in("sequence_id", batch.map(sequence => sequence.id)).in("status", ["unknown", "failed", "error"]).limit(1000)));
  if (results.some(result => result.error || (result.count ?? result.data?.length ?? 0) > 1000)) throw new Error("Unable to load complete follow-up delivery state.");
  return summarizeLeadFollowups(rows, results.flatMap(result => result.data || []) as Issue[]);
}
