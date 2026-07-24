import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { requireAutomationApiKey } from "@/lib/limitless-api-auth";
import { getWorkflowRegistrySummary, registerWorkflow } from "@/lib/workflow-registry";

async function authorize(request: NextRequest) {
  const session = await getAdminSession();
  const apiAuth = requireAutomationApiKey(request);
  return Boolean(session || apiAuth.ok);
}

export async function GET(request: NextRequest) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await getWorkflowRegistrySummary();
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load workflows." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const workflow = await registerWorkflow(payload);
    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to register workflow.";
    const status = message.includes("required") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
