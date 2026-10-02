import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { listActiveAgentOfferings, saveOrganizationAgentSelections } from "@/lib/agent-catalog";

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

function profileText(profile: any) {
  const knowledge = profile?.business_knowledge && typeof profile.business_knowledge === "object"
    ? Object.entries(profile.business_knowledge).map(([k,v]) => `${k} ${String(v)}`).join(" ")
    : "";
  return [profile?.business_name, profile?.business_description, profile?.ai_requirements, ...(profile?.business_goals || []), knowledge].filter(Boolean).join(" ").toLowerCase();
}

function scoreOffering(offering: any, brief: string) {
  const haystack = [offering.agent_key, offering.display_name, offering.metadata?.summary, ...(offering.metadata?.capabilities || [])].filter(Boolean).join(" ").toLowerCase();
  let score = 0;
  const rules: Array<[string[], number]> = [
    [["whatsapp", "customer", "conversation", "chat"], 8],
    [["support", "faq", "question", "service"], 6],
    [["lead", "prospect", "capture", "qualify", "sales"], 6],
    [["follow", "reminder", "nurture", "email"], 5],
    [["call", "voice", "phone"], 5],
    [["appointment", "booking", "schedule"], 4],
  ];
  for (const [terms, weight] of rules) {
    if (terms.some((term) => brief.includes(term)) && terms.some((term) => haystack.includes(term))) score += weight;
  }
  if (brief.includes("whatsapp") && haystack.includes("whatsapp")) score += 10;
  return score;
}

function promptFor(agent: any, profile: any) {
  const knowledge = profile.business_knowledge && typeof profile.business_knowledge === "object"
    ? Object.entries(profile.business_knowledge).filter(([,v]) => v !== null && String(v).trim()).map(([k,v]) => `${k.replaceAll("_"," ")}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join("\n")
    : "";
  return [
    `You are the ${agent.name} for ${profile.business_name || "this business"}.`,
    profile.business_description ? `Business: ${profile.business_description}` : "",
    profile.ai_requirements ? `AI responsibilities: ${profile.ai_requirements}` : "",
    knowledge ? `Approved business knowledge:\n${knowledge}` : "",
    profile.business_goals?.length ? `Requested outcomes: ${profile.business_goals.join(", ")}` : "",
    "Operate only with approved tenant knowledge and connected tenant tools. Never invent pricing, policies, availability or business facts.",
    "Keep tenant data isolated. Escalate requests requiring human approval, exceptions, sensitive decisions or information you cannot verify.",
  ].filter(Boolean).join("\n\n");
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const organizationId = text(body.organizationId);
    if (!organizationId) return NextResponse.json({ error: "Organization is required." }, { status: 400 });

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("client_onboarding_profiles")
      .select("id,organization_id,status,business_name,business_description,ai_requirements,business_knowledge,business_goals,whatsapp_preferences")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return NextResponse.json({ error: "Client onboarding brief not found." }, { status: 404 });
    if (!profile.business_name || !profile.business_description || !profile.ai_requirements) {
      return NextResponse.json({ error: "The client brief is incomplete. Business description and AI responsibilities are required." }, { status: 409 });
    }

    const offerings = await listActiveAgentOfferings();
    const brief = profileText(profile);
    const ranked = offerings
      .map((offering) => ({ offering, score: scoreOffering(offering, brief) }))
      .sort((a,b) => b.score - a.score);
    const selected = ranked.filter((item) => item.score > 0).map((item) => item.offering.agent_key);

    if (!selected.length) {
      return NextResponse.json({ error: "No marketplace agent matches the client's requested outcomes. Review the catalog before provisioning." }, { status: 409 });
    }

    const allocation = await saveOrganizationAgentSelections({
      organizationId,
      agentKeys: selected,
      allocationSource: "admin",
    });

    const { data: provisioning, error: provisioningError } = await admin.rpc("provision_selected_agent_allocations", {
      p_organization_id: organizationId,
      p_actor_user_id: null,
    });
    if (provisioningError) throw provisioningError;

    const { data: selections, error: selectionError } = await admin
      .from("organization_agent_selections")
      .select("agent_key,display_name,configuration,status")
      .eq("organization_id", organizationId)
      .in("agent_key", selected);
    if (selectionError) throw selectionError;

    const agentIds = [...new Set((selections || [])
      .map((row) => text((row.configuration as Record<string, unknown> | null)?.provisioned_agent_id))
      .filter(Boolean))];

    if (agentIds.length) {
      const { data: agents, error: agentsError } = await admin
        .from("agents")
        .select("id,name,agent_type")
        .eq("organization_id", organizationId)
        .in("id", agentIds);
      if (agentsError) throw agentsError;

      const selectedAgents = agents || [];
      for (const agent of selectedAgents) {
        const channels = (String(agent.agent_type || "").includes("voice") || String(agent.agent_type || "").includes("call"))
          ? ["voice"]
          : ["whatsapp"];
        const { error } = await admin.from("agents").update({
          system_prompt: promptFor(agent, profile),
          communication_channels: channels,
          configuration: {
            onboarding_profile_id: profile.id,
            provisioning_source: "client_outcome_brief",
            business_knowledge: profile.business_knowledge || {},
            ai_requirements: profile.ai_requirements,
            business_description: profile.business_description,
            business_goals: profile.business_goals || [],
            whatsapp_preferences: profile.whatsapp_preferences || {},
            provisioned_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        }).eq("id", agent.id).eq("organization_id", organizationId);
        if (error) throw error;
      }
    }

    const { error: statusError } = await admin
      .from("client_onboarding_profiles")
      .update({ status: "configuration" })
      .eq("id", profile.id)
      .eq("organization_id", organizationId);
    if (statusError) throw statusError;

    return NextResponse.json({
      ok: true,
      status: "configuration",
      selectedAgentKeys: selected,
      provisionedAgentCount: agentIds.length,
      provisioning,
      allocation: { ...allocation.allocationContext },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to provision the client brief." }, { status: 400 });
  }
}
