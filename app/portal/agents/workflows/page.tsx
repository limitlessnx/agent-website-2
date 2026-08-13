import { GitBranch, LockKeyhole, Workflow } from "@/components/admin/ServerIcons";
import { getClientSession } from "@/lib/client-auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Assignment = {
  id: string;
  agent_id: string;
  role: string;
  status: string;
  readiness: Record<string, unknown>;
  agents: { name: string; status: string } | { name: string; status: string }[] | null;
  workflow_definitions:
    | { name: string; workflow_key: string; provider: string; channel: string; contract_version: number; external_workflow_id: string | null; endpoint_reference: string | null }
    | Array<{ name: string; workflow_key: string; provider: string; channel: string; contract_version: number; external_workflow_id: string | null; endpoint_reference: string | null }>
    | null;
};

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

export default async function WorkflowAssignmentsPage() {
  const session = await getClientSession();
  if (!session) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agent_workflow_assignments")
    .select("id,agent_id,role,status,readiness,agents(name,status),workflow_definitions(name,workflow_key,provider,channel,contract_version,external_workflow_id,endpoint_reference)")
    .eq("organization_id", session.organizationId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  const assignments = (data || []) as Assignment[];
  const executable = assignments.filter((item) => Boolean(one(item.workflow_definitions)?.external_workflow_id) && Boolean(one(item.workflow_definitions)?.endpoint_reference));

  return (
    <main className="portal-page">
      <header className="portal-section-title">
        <h1>Workflow assignments</h1>
        <p>Approved agents are linked to shared workflow definitions. One workflow engine, isolated organisation configuration, considerably less copy-and-paste archaeology.</p>
      </header>

      <section className="portal-cards">
        <article className="portal-card">
          <div className="portal-agent-icon"><Workflow size={22} /></div>
          <h2>{assignments.length}</h2>
          <p>Workflow assignments for this organisation</p>
        </article>
        <article className="portal-card">
          <div className="portal-agent-icon"><GitBranch size={22} /></div>
          <h2>{executable.length}</h2>
          <p>Definitions with an external workflow and endpoint linked</p>
        </article>
        <article className="portal-card">
          <div className="portal-agent-icon"><LockKeyhole size={22} /></div>
          <h2>Disabled</h2>
          <p>Execution remains off until n8n credentials, endpoints, and verification are approved.</p>
        </article>
      </section>

      <section className="portal-card">
        <div className="portal-card-head"><div><h2>Assigned definitions</h2><p>Assignments are tenant-scoped and cannot point to another organisation&apos;s agent.</p></div></div>
        <div className="portal-list">
          {assignments.map((assignment) => {
            const agent = one(assignment.agents);
            const workflow = one(assignment.workflow_definitions);
            const linked = Boolean(workflow?.external_workflow_id && workflow?.endpoint_reference);
            return (
              <div className="portal-list-row" key={assignment.id}>
                <div>
                  <strong>{workflow?.name || "Workflow definition"}</strong>
                  <span>{agent?.name || "Agent"} · {workflow?.channel || "core"} · contract v{workflow?.contract_version || 1}</span>
                  <small>{workflow?.workflow_key || assignment.id}</small>
                </div>
                <em>{linked ? assignment.status : "awaiting n8n link"}</em>
              </div>
            );
          })}
          {!assignments.length ? <p className="portal-empty">No workflow has been assigned yet. An approved agent must match a ready workflow definition first.</p> : null}
        </div>
      </section>
    </main>
  );
}
