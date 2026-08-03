import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import {
  listActiveAgentOfferings,
  listOrganizationAgentSelections,
  saveOrganizationAgentSelections,
} from "@/lib/agent-catalog";

async function sessionOrThrow() {
  const session = await getClientSession();
  if (!session) throw new Error("Authentication required.");
  return session;
}

function statusFromError(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed.";
  if (/authentication required/i.test(message)) return 401;
  if (/select at least/i.test(message)) return 400;
  return 500;
}

export async function GET() {
  try {
    const session = await sessionOrThrow();
    const [selections, catalog] = await Promise.all([
      listOrganizationAgentSelections(session.organizationId),
      listActiveAgentOfferings(),
    ]);
    return NextResponse.json({ selections, catalog });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed." },
      { status: statusFromError(error) },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await sessionOrThrow();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const rawAgentKeys = Array.isArray(body.agent_keys) ? body.agent_keys : [];
    const agentKeys = rawAgentKeys.map((value) => String(value).trim()).filter(Boolean);
    const result = await saveOrganizationAgentSelections({
      organizationId: session.organizationId,
      agentKeys,
      allocationSource: "tenant",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed." },
      { status: statusFromError(error) },
    );
  }
}
