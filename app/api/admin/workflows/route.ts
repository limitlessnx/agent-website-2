import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  getWorkflowRegistrySummary,
  registerWorkflow,
  updateWorkflow,
  type WorkflowRecord,
} from "@/lib/workflow-registry";

async function requireAdmin() {
  const session = await getAdminSession();
  return session || null;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });

  try {
    const summary = await getWorkflowRegistrySummary();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to load workflows." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Partial<WorkflowRecord>;

  try {
    const workflow = await registerWorkflow(body);
    return NextResponse.json({ ok: true, workflow }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to register workflow." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Partial<WorkflowRecord> & { id?: string };
  if (!body.id) return NextResponse.json({ ok: false, message: "Workflow ID is required." }, { status: 400 });

  try {
    const workflow = await updateWorkflow(body.id, body);
    return NextResponse.json({ ok: true, workflow });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to update workflow." },
      { status: 400 },
    );
  }
}
