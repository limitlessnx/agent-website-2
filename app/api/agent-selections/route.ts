import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import {
  listActiveAgentOfferings,
  listOrganizationAgentSelections,
  saveOrganizationAgentSelections,
} from "@/lib/agent-catalog";

const AI_SALES_APPLICATION_WEBHOOK =
  process.env.AI_SALES_APPLICATION_WEBHOOK_URL ||
  "https://n8n.srv1720757.hstgr.cloud/webhook/fluxknight-ai-sales-test-v1";

const FLUXKNIGHT_ORGANIZATION_ID = "15046426-e520-438b-8694-7662a6986efb";
const FLUXKNIGHT_SALES_AGENT_ID = "23d18ba2-1de8-450f-95af-194378bc7dc9";

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

async function sendAgentApplicationToSales(input: {
  applicantOrganizationId: string;
  applicantEmail: string;
  selectedAgentKeys: string[];
  selections: Array<{
    agent_key: string;
    display_name: string;
    setup_price: number;
    monthly_price: number;
    currency: string;
  }>;
}) {
  const selected = input.selections.filter((item) => input.selectedAgentKeys.includes(item.agent_key));
  const setupTotal = selected.reduce((sum, item) => sum + Number(item.setup_price || 0), 0);
  const monthlyTotal = selected.reduce((sum, item) => sum + Number(item.monthly_price || 0), 0);
  const packageNames = selected.map((item) => item.display_name);
  const requestId = `agent-application-${input.applicantOrganizationId}-${Date.now()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(AI_SALES_APPLICATION_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organization_id: FLUXKNIGHT_ORGANIZATION_ID,
        agent_id: FLUXKNIGHT_SALES_AGENT_ID,
        idempotency_key: requestId,
        channel: "website",
        source: "agent_application_page",
        customer_external_key: input.applicantEmail,
        email: input.applicantEmail,
        name: input.applicantEmail.split("@")[0] || "Fluxknight applicant",
        message: `A tenant applied for ${packageNames.join(", ") || "a Fluxknight agent package"}.`,
        product_or_service: packageNames.join(", ") || "Fluxknight agent package",
        budget: String(setupTotal),
        timeline: "Application submitted",
        notes: JSON.stringify({
          applicant_organization_id: input.applicantOrganizationId,
          selected_agent_keys: input.selectedAgentKeys,
          selected_agents: packageNames,
          setup_total: setupTotal,
          monthly_total: monthlyTotal,
          currency: selected[0]?.currency || "NGN",
          application_source: "portal_agents_select",
        }),
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("AI sales application webhook rejected submission", {
        status: response.status,
        detail: detail.slice(0, 500),
        applicantOrganizationId: input.applicantOrganizationId,
      });
      return { delivered: false, status: response.status };
    }

    return { delivered: true, status: response.status };
  } catch (error) {
    console.error("AI sales application webhook failed", {
      applicantOrganizationId: input.applicantOrganizationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { delivered: false, status: 0 };
  } finally {
    clearTimeout(timeout);
  }
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

    const salesIntake = await sendAgentApplicationToSales({
      applicantOrganizationId: session.organizationId,
      applicantEmail: session.email,
      selectedAgentKeys: agentKeys,
      selections: result.selections,
    });

    return NextResponse.json({ ok: true, sales_intake: salesIntake, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed." },
      { status: statusFromError(error) },
    );
  }
}
