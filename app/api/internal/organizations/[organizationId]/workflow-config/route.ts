import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

function secureMatch(provided: string, expected: string) {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
  const expectedKey = process.env.FLUXKNIGHT_WORKFLOW_SYNC_KEY || "";
  const providedKey = request.headers.get("x-fluxknight-workflow-key") || "";

  if (!expectedKey) {
    return NextResponse.json({ error: "Workflow configuration access is not configured." }, { status: 503 });
  }
  if (!providedKey || !secureMatch(providedKey, expectedKey)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { organizationId } = await context.params;
  const encodedId = encodeURIComponent(organizationId);

  try {
    const [organizations, projects, agents, workflows, integrations] = await Promise.all([
      supabaseServerRequest<Array<Record<string, unknown>>>(
        `organizations?select=id,name,slug,status,settings,metadata&id=eq.${encodedId}&limit=1`,
      ),
      supabaseServerRequest<Array<Record<string, unknown>>>(
        `projects?select=id,name,slug,status,metadata&organization_id=eq.${encodedId}&order=created_at.asc`,
      ),
      supabaseServerRequest<Array<Record<string, unknown>>>(
        `agents?select=id,name,slug,agent_type,status,system_prompt,language,temperature,communication_channels,escalation_rules,human_handoff_destination,knowledge_sources,configuration,project_id&organization_id=eq.${encodedId}&order=created_at.asc`,
      ),
      supabaseServerRequest<Array<Record<string, unknown>>>(
        `workflow_registry?select=id,workflow_key,name,status,current_version,external_workflow_id,endpoint_url,metadata,project_uuid&organization_uuid=eq.${encodedId}&order=name.asc`,
      ),
      supabaseServerRequest<Array<Record<string, unknown>>>(
        `organization_integrations?select=provider,display_name,status,configuration,health&organization_id=eq.${encodedId}&order=provider.asc`,
      ),
    ]);

    const organization = organizations[0];
    if (!organization) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

    return NextResponse.json({
      organization,
      projects,
      agents,
      workflows,
      integrations,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load workflow configuration." },
      { status: 500 },
    );
  }
}
