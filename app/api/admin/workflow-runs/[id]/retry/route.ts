import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getWorkflowRuns } from "@/lib/workflow-registry";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const runs = await getWorkflowRuns(500);
    const previousRun = runs.find((run) => run.id === id);

    if (!previousRun) {
      return NextResponse.json({ error: "Workflow run not found." }, { status: 404 });
    }

    if (!["failed", "timed_out", "cancelled"].includes(previousRun.status)) {
      return NextResponse.json(
        { error: `Only failed, timed out, or cancelled runs can be retried. Current status: ${previousRun.status}.` },
        { status: 409 },
      );
    }

    const response = await fetch(new URL("/api/workflows/run", request.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") || "",
      },
      body: JSON.stringify({
        organization_id: previousRun.organization_id,
        workflow_key: previousRun.workflow_key,
        payload: previousRun.input_payload || {},
        attempt: previousRun.attempt + 1,
      }),
      cache: "no-store",
    });

    const result = await response.json().catch(() => ({}));
    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to retry workflow run." },
      { status: 500 },
    );
  }
}
