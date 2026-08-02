import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getClientSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const db = createAdminClient();
    const organizationId = session.organizationId;

    const [agentsResult, blocksResult, versionsResult, collectionsResult, sourcesResult, bindingsResult, requirementsResult, integrationsResult, testsResult, approvalsResult, assignmentsResult] = await Promise.all([
      db.from("agents").select("id,name,description,status,agent_type,communication_channels,current_version").eq("organization_id", organizationId).order("created_at"),
      db.from("agent_prompt_blocks").select("id,agent_id,block_key,title,content,sort_order,status,version,updated_at").eq("organization_id", organizationId).order("sort_order"),
      db.from("agent_prompt_versions").select("id,agent_id,version,status,created_at").eq("organization_id", organizationId).order("version", { ascending: false }),
      db.from("knowledge_collections").select("id,name,description,status,source_count,updated_at").eq("organization_id", organizationId).order("name"),
      db.from("knowledge_sources").select("id,collection_id,title,source_type,source_url,status,updated_at").eq("organization_id", organizationId).order("updated_at", { ascending: false }),
      db.from("agent_knowledge_bindings").select("id,agent_id,collection_id,required,status").eq("organization_id", organizationId),
      db.from("organization_integration_requirements").select("id,agent_id,channel,integration_id,required,status").eq("organization_id", organizationId),
      db.from("organization_integrations").select("id,provider,display_name,status,last_connected_at,last_checked_at").eq("organization_id", organizationId),
      db.from("agent_test_runs").select("agent_id,status,score,completed_at,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }),
      db.from("agent_approval_requests").select("agent_id,status,submitted_at,reviewed_at,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }),
      db.from("agent_workflow_assignments").select("agent_id,status,readiness,assigned_at,verified_at").eq("organization_id", organizationId),
    ]);

    const firstError = [agentsResult, blocksResult, versionsResult, collectionsResult, sourcesResult, bindingsResult, requirementsResult, integrationsResult, testsResult, approvalsResult, assignmentsResult].find((result) => result.error)?.error;
    if (firstError) throw firstError;

    const agents = agentsResult.data || [];
    const tests = testsResult.data || [];
    const approvals = approvalsResult.data || [];
    const assignments = assignmentsResult.data || [];
    const blocks = blocksResult.data || [];
    const sources = sourcesResult.data || [];
    const bindings = bindingsResult.data || [];
    const requirements = requirementsResult.data || [];

    const readiness = agents.map((agent) => {
      const agentBlocks = blocks.filter((block) => block.agent_id === agent.id);
      const agentBindings = bindings.filter((binding) => binding.agent_id === agent.id && binding.status === "active");
      const boundCollectionIds = new Set(agentBindings.map((binding) => binding.collection_id));
      const agentSources = sources.filter((source) => source.collection_id && boundCollectionIds.has(source.collection_id));
      const agentRequirements = requirements.filter((requirement) => requirement.agent_id === agent.id && requirement.required);
      const latestTest = tests.find((test) => test.agent_id === agent.id);
      const latestApproval = approvals.find((approval) => approval.agent_id === agent.id);
      const workflowAssignments = assignments.filter((assignment) => assignment.agent_id === agent.id);

      const checks = {
        business_profile: true,
        prompt: agentBlocks.some((block) => block.status === "active" && block.content.trim().length > 0),
        knowledge: agentSources.some((source) => ["ready", "active", "processed"].includes(source.status)),
        integrations: agentRequirements.every((requirement) => ["connected", "waived"].includes(requirement.status)),
        testing: latestTest?.status === "passed",
        approval: latestApproval?.status === "approved",
        workflow: workflowAssignments.some((assignment) => ["assigned", "ready"].includes(assignment.status)),
      };
      const completed = Object.values(checks).filter(Boolean).length;
      return {
        agent_id: agent.id,
        score: Math.floor((completed * 100) / Object.keys(checks).length),
        blockers: Object.entries(checks).filter(([, ready]) => !ready).map(([key]) => key),
        checks,
      };
    });

    return NextResponse.json({
      agents,
      prompt_blocks: blocks,
      prompt_versions: versionsResult.data || [],
      collections: collectionsResult.data || [],
      sources,
      knowledge_bindings: bindings,
      integration_requirements: requirements,
      integrations: integrationsResult.data || [],
      readiness,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load runtime configuration." }, { status: 400 });
  }
}
