import { createAdminClient } from "@/lib/supabase/admin";
import type { CrmExecution, ExecutionStatus } from "./contract";

export async function loadExecution(id: string): Promise<CrmExecution> {
  const { data, error } = await createAdminClient().from("leo_crm_executions").select("*").eq("id", id).single();
  if (error) throw error;
  return data as CrmExecution;
}
export async function transition(id: string, from: ExecutionStatus[], patch: Record<string, unknown>): Promise<CrmExecution | null> {
  const { data, error } = await createAdminClient().from("leo_crm_executions")
    .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).in("status", from).select("*").maybeSingle();
  if (error) throw error;
  return data as CrmExecution | null;
}
