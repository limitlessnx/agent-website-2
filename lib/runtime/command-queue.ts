import type { SupabaseClient } from "@supabase/supabase-js";

type Command = { organization_id: string; agent_id: string; execution_id: string; command_type: string; payload: Record<string, unknown>; idempotency_key: string; status: string; priority: number; max_attempts: number; available_at?: string };
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).filter(key => (value as Record<string, unknown>)[key] !== undefined).sort().map(key => JSON.stringify(key) + ":" + canonical((value as Record<string, unknown>)[key])).join(",") + "}";
  return JSON.stringify(value) ?? "null";
}
/** Reuse the queue's existing tenant/idempotency constraint. Never overwrite or restart a job. */
export async function enqueueRuntimeCommand(admin: SupabaseClient, command: Command) {
  const inserted = await admin.from("command_queue").upsert(command, { onConflict: "organization_id,idempotency_key", ignoreDuplicates: true })
    .select("id,status,agent_id,execution_id,command_type,payload,available_at").maybeSingle();
  if (inserted.error) throw new Error("Command persistence is unavailable. Do not redispatch; retry the same operation only.");
  let row = inserted.data;
  if (!row) {
    const previous = await admin.from("command_queue").select("id,status,agent_id,execution_id,command_type,payload,available_at")
      .eq("organization_id", command.organization_id).eq("idempotency_key", command.idempotency_key).maybeSingle();
    if (previous.error || !previous.data) throw new Error("Command evidence is unavailable. Do not redispatch.");
    row = previous.data;
  }
  if (row.agent_id !== command.agent_id || row.execution_id !== command.execution_id || row.command_type !== command.command_type || canonical(row.payload) !== canonical(command.payload)) throw new Error("Command input conflicts with its original operation. Review required.");
  if (!["queued", "claimed", "running", "succeeded"].includes(row.status)) throw new Error("The existing command requires review. It was not restarted.");
  // Keep private integration references/payloads out of the dispatch response.
  return { id: row.id as string, status: row.status as string, ...(command.available_at ? { available_at: row.available_at as string } : {}) };
}
