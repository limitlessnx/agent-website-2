import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecret } from "@/lib/runtime/auth";
import { prepareExecutionWithoutDispatch, prepareNextQueuedExecution } from "@/lib/runtime/worker";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    assertRuntimeSecret(request.headers.get("x-runtime-secret"));

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const executionId = body.execution_id ? String(body.execution_id) : "";
    const supabase = createAdminClient();
    const result = executionId
      ? await prepareExecutionWithoutDispatch(supabase, executionId)
      : await prepareNextQueuedExecution(supabase);

    if (!result) return NextResponse.json({ status: "idle", execution_enabled: false });
    return NextResponse.json({ ...result, execution_enabled: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to run runtime worker.";
    const status = message === "Unauthorized." ? 401 : message === "Execution not found." ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
